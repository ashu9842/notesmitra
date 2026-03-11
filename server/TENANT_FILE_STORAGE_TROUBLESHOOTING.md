# Tenant File Storage: Troubleshooting Reference

Quick reference for common issues and solutions during implementation and testing.

## Table of Contents
1. [Server Integration Issues](#server-integration-issues)
2. [Upload Problems](#upload-problems)
3. [Download Problems](#download-problems)
4. [Cross-Tenant Prevention](#cross-tenant-prevention)
5. [Middleware Order Issues](#middleware-order-issues)
6. [Database Issues](#database-issues)
7. [Cloudinary Issues](#cloudinary-issues)
8. [Performance Issues](#performance-issues)

---

## Server Integration Issues

### Issue: Server crashes on startup

**Error:** `Cannot find module './services/fileAccessService'`

**Solution:**
```bash
# Verify file exists
ls -la server/services/fileAccessService.js

# If missing, create it from documentation
# If exists, check import path is correct:
# ✓ require('./services/fileAccessService')
# ✗ require('./fileAccessService')
# ✗ require('../services/fileAccessService')
```

**Checklist:**
- [ ] File is at `server/services/fileAccessService.js`
- [ ] Import path uses `./` relative to server.js location
- [ ] No typos in filename
- [ ] File permissions allow read access

---

### Issue: "TypeError: FileAccessService is not a constructor"

**Error:** When initializing service in server.js

**Cause:** File doesn't export the class correctly

**Solution:**
**Check end of fileAccessService.js:**
```javascript
// ✓ Correct
module.exports = FileAccessService;

// ✗ Wrong
module.exports = {
  fileAccessService: FileAccessService
};

// ✗ Wrong
exports.FileAccessService = FileAccessService;
```

---

### Issue: "Cannot read property 'fileAccessService' of undefined"

**Error:** In route handler: `req.fileAccessService is undefined`

**Cause:** Middleware not attached before routing

**Solution in server.js:**
```javascript
// ❌ WRONG - Service attached after routes
app.use('/api', routes);
app.use((req, res, next) => {
  req.fileAccessService = fileAccessService;
  next();
});

// ✓ CORRECT - Service attached before routes
app.use((req, res, next) => {
  req.fileAccessService = fileAccessService;
  next();
});
app.use('/api', routes);
```

**Verify with test middleware:**
```javascript
// Add temporarily to verify
app.use((req, res, next) => {
  console.log('fileAccessService attached:', !!req.fileAccessService);
  next();
});
```

---

### Issue: "req.tenant is undefined"

**Error:** `Cannot read property 'id' of undefined` (req.tenant)

**Cause:** tenantResolverMiddleware not running first

**Current middleware stack (check in server.js):**
```javascript
// ❌ WRONG
app.use(express.json());
app.use(tenantResolverMiddleware);
app.use(routes);

// ✓ CORRECT
app.use(express.json());
app.use(tenantResolverMiddleware);     // FIRST
app.use(tenantContextMiddleware);      // SECOND
app.use((req, res, next) => {
  req.fileAccessService = fileAccessService;  // THIRD
  next();
});
app.use(routes);                       // LAST
```

**Debug tenantResolver:**
```javascript
// In tenantResolver middleware, add this line:
console.log({
  subdomain: req.hostname,
  headers: req.headers['x-tenant-id'],
  extractedTenant: req.tenant?.id,
});
```

---

## Upload Problems

### Issue: "Tenant not found" when uploading

**Error:** `400 Bad Request - Tenant not found`

**Cause:** req.tenant is undefined or missing

**Solution:**
1. **Verify header is sent:**
   ```bash
   curl -X POST http://localhost:5000/api/notes/upload \
     -H "Authorization: Bearer TOKEN" \
     -H "x-tenant-id: 507f1f77bcf86cd799439010" \
     -F "pdf=@file.pdf" \
     -F "title=My Note"
   ```

2. **If using subdomain:**
   ```bash
   curl -X POST http://college123.localhost:5000/api/notes/upload \
     -H "Authorization: Bearer TOKEN" \
     -F "pdf=@file.pdf"
   ```

3. **Verify tenantResolver extracts from correct source:**
   ```javascript
   // In tenantResolver.js, check:
   const subdomain = req.hostname.split('.')[0];  // subdomain-based
   const tenantId = req.headers['x-tenant-id'];   // header-based
   
   // Log both to debug
   console.log('Subdomain:', subdomain, 'Header:', tenantId);
   ```

---

### Issue: "PDF upload fails" or "File rejected"

**Error:** `400 Bad Request` during file upload

**Possible causes:**

**1. Wrong file type:**
```javascript
// upload.js checks for PDF
.fileFilter((req, file, cb) => {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files allowed'));
  }
  cb(null, true);
});
```

**Solution:** Upload actual PDF file
```bash
# ✓ Correct
curl -F "pdf=@document.pdf" ...

# ✗ Wrong
curl -F "pdf=@document.txt" ...
```

**2. File too large:**
```javascript
// Check limits in upload.js
.limits({ fileSize: 50 * 1024 * 1024 }) // 50MB
```

**Solution:** Use smaller file
```bash
# Check file size
ls -lh file.pdf  # Should be < 50MB
```

**3. Missing required middleware:**
This should be automatic via multer, but verify upload.js imports correctly:
```javascript
// ✓ Correct import
const multer = require('multer');

// ✓ Correct usage
const upload = multer({ /* config */ });
router.post('/upload', upload.single('pdf'), uploadNote);
```

---

### Issue: File uploads but tenantId not saved in Note model

**Error:** File exists in Cloudinary but Note.tenantId is null

**Cause:** uploadNote controller doesn't include tenantId

**Solution in noteController.js:**
```javascript
// ❌ Wrong
const newNote = await Note.create({
  cloudinaryPublicId: publicId,
  cloudinaryUrl: url,
  title,
  description,
  // Missing tenantId!
});

// ✓ Correct
const newNote = await Note.create({
  cloudinaryPublicId: publicId,
  cloudinaryUrl: url,
  tenantId: req.tenant.id,  // ← Add this
  title,
  description,
});
```

**Verify in database:**
```bash
# MongoDB shell
db.notes.findOne({_id: ObjectId("...")})

# Should show:
# { _id: ..., tenantId: ObjectId("..."), ... }
```

---

## Download Problems

### Issue: Signed URL generation fails

**Error:** `500 Internal Server Error` when downloading

**Cause 1: Missing note in database**
```bash
# Verify note exists
db.notes.findById("noteId")
# Should return document
```

**Cause 2: Missing fileAccessService**
```javascript
// In downloadNote, verify this works:
const signedUrl = await req.fileAccessService.generateTenantSignedUrl(
  publicId,
  tenantId,
  3600
);
```

**Cause 3: Cloudinary not configured**
```javascript
// In cloudinary.js, check:
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
```

**Solution:**
```bash
# Verify .env has Cloudinary credentials
cat .env | grep CLOUDINARY

# Should output:
# CLOUDINARY_CLOUD_NAME=your_cloud_name
# CLOUDINARY_API_KEY=your_key
# CLOUDINARY_API_SECRET=your_secret
```

---

### Issue: "Cannot extract tenant from publicId"

**Error:** `400 Bad Request - Invalid public ID format`

**Cause:** PublicId doesn't match expected format

**Solution:**
```javascript
// Expected format:
// notesmitra/{tenantId}/notes/{filename}

// ✓ Valid:
"notesmitra/507f1f77bcf86cd799439010/notes/economics123"

// ✗ Invalid (no tenant folder):
"pdfs/economics123"
"notes/economics123"
"economics123"
```

**Verify Cloudinary uploads to correct path:**
```bash
# Check upload middleware uses tenant folder
grep -A5 "uploadToTenantFolder" server/middleware/upload.js

# Should show:
# uploadToTenantFolder(filePath, tenantId, 'notes', 'raw')
```

---

### Issue: Signed URL expires too quickly

**Error:** URL works initially but "Access denied" after few minutes

**Cause:** Expiry time set too short

**Solution in fileAccessService.js:**
```javascript
// Default should be 3600 (1 hour)
generateTenantSignedUrl(publicId, tenantId, expiresIn = 3600) {
  // ✓ Correct: 3600 = 1 hour
  // ✗ Wrong: 60 = 1 minute (too short)
  
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
}
```

**Solution in downloadNote:**
```javascript
// ✓ Correct - 1 hour
const signedUrl = await req.fileAccessService.generateTenantSignedUrl(
  publicId,
  tenantId,
  3600
);

// ✗ Wrong - 5 minutes
const signedUrl = await req.fileAccessService.generateTenantSignedUrl(
  publicId,
  tenantId,
  300
);
```

---

## Cross-Tenant Prevention

### Issue: Cross-tenant access NOT blocked

**Error:** User B can download User A's files

**Critical - Security Issue!**

**Cause 1: Missing tenant check in downloadNote**
```javascript
// In noteController.js, downloadNote must have:
if (note.tenantId.toString() !== tenantId.toString()) {
  return res.status(404).json({ message: 'Note not found' });
}
```

**Verify:**
```bash
grep -n "tenantId.toString()" server/controllers/noteController.js

# Should show match comparison
```

**Cause 2: fileAccessService not called**
```javascript
// Must call this:
await req.fileAccessService.verifyFileAccess(publicId, tenantId);
```

**Cause 3: fileAccessService broken**
```javascript
// Test fileAccessService directly:
const service = require('./services/fileAccessService');
const result = service.isValidTenantPublicId(
  'notesmitra/tenantA/notes/file',
  'tenantA'
);
console.log('Validation:', result); // Should be true

const result2 = service.isValidTenantPublicId(
  'notesmitra/tenantA/notes/file',
  'tenantB'
);
console.log('Validation:', result2); // Should be false
```

---

### Issue: Cross-tenant attempts not logged

**Error:** No 🚨 alert in logs for cross-tenant access

**Cause:** Debug logging not enabled or logs not checked

**Solution:**
1. **Verify logs exist:**
   ```bash
   # Check console during test
   npm run dev 2>&1 | grep -i "cross-tenant"
   
   # Should show:
   # 🚨 Cross-tenant access attempt
   ```

2. **Enable file logging:**
   ```javascript
   // In noteController.js, replace console.log with:
   const fs = require('fs');
   
   fs.appendFileSync('cross-tenant-attempts.log', 
     JSON.stringify({
       timestamp: new Date().toISOString(),
       attemptedTenant: tenantId,
       noteTenant: note.tenantId,
       user: req.user._id,
       ip: req.ip,
     }) + '\n'
   );
   ```

3. **Check logs:**
   ```bash
   cat cross-tenant-attempts.log
   # Should be empty (0 attempts) or show attack attempts
   ```

---

## Middleware Order Issues

### Issue: Middleware executing in wrong order

**Error:** Unexpected behavior, validation skipped, or errors

**Verify execution order:**
```javascript
// In each middleware, add log:
app.use((req, res, next) => {
  console.log('1. JSON parsing');
  next();
});

app.use((req, res, next) => {
  console.log('2. Tenant resolver');
  next();
});

app.use((req, res, next) => {
  console.log('3. Tenant context');
  next();
});

app.use((req, res, next) => {
  console.log('4. File service');
  next();
});

app.use((req, res, next) => {
  console.log('5. Routes');
  res.json({ message: 'OK' });
});
```

**Expected output:**
```
1. JSON parsing
2. Tenant resolver
3. Tenant context
4. File service
5. Routes
```

**If different, reorder in server.js**

---

## Database Issues

### Issue: "Cannot find note" on valid request

**Error:** 404 when downloading own note

**Cause 1: tenantId mismatch in database**
```bash
# Check saved note
db.notes.findById(ObjectId("..."))

# View result:
{
  _id: ObjectId("..."),
  tenantId: ObjectId("611f..."),  # Check this
  cloudinaryPublicId: "...",
}
```

**Compare with request:**
```javascript
// In downloadNote, log both:
console.log('Note tenant:', note.tenantId);
console.log('Request tenant:', tenantId);
console.log('Match:', note.tenantId.toString() === tenantId.toString());
```

**Cause 2: Note was created without tenantId**
```bash
# Check for null tenantId
db.notes.find({ tenantId: null })

# Should return no results
```

**Solution:** Migrate old notes
```javascript
// Run once in mongo shell:
db.notes.updateMany(
  { tenantId: null },
  { $set: { tenantId: ObjectId("DEFAULT_TENANT_ID") } }
);
```

**Cause 3: ObjectId format mismatch**
```javascript
// Ensure comparison as strings:
// ✓ Correct
note.tenantId.toString() === tenantId.toString()

// ✗ Wrong
note.tenantId === tenantId
// ObjectId objects don't compare with ===
```

---

### Issue: "Duplicate key error" when creating new notes

**Error:** `E11000 duplicate key error`

**Cause:** Indexing conflict

**Solution:**
1. **Drop and recreate indexes:**
   ```bash
   # In mongo shell:
   db.notes.dropIndex("tenantId_1_createdAt_-1")
   db.notes.createIndex({ tenantId: 1, createdAt: -1 })
   ```

2. **Or drop entire collection and recreate:**
   ```bash
   # In mongo shell:
   db.notes.drop()
   # Then re-upload notes
   ```

---

## Cloudinary Issues

### Issue: "Cloudinary authentication failed"

**Error:** `401 Unauthorized` from Cloudinary API

**Cause:** Invalid credentials

**Solution:**
```bash
# Verify .env
echo $CLOUDINARY_CLOUD_NAME
echo $CLOUDINARY_API_KEY
echo $CLOUDINARY_API_SECRET

# Should all have values

# Test Cloudinary manually:
curl -u "api_key:api_secret" \
  https://api.cloudinary.com/v1_1/cloud_name/metadata/fields
```

---

### Issue: Files uploaded but not in tenant folder

**Error:** Files appear in `notesmitra/` but not `notesmitra/{tenantId}/notes/`

**Cause:** uploadToTenantFolder not being used

**Solution:**
1. **Verify upload.js calls uploadToTenantFolder:**
   ```bash
   grep -n "uploadToTenantFolder" server/middleware/upload.js
   # Should show function call
   ```

2. **Check upload.js imports it:**
   ```bash
   grep -n "import.*uploadToTenantFolder" server/middleware/upload.js
   # Should show import statement
   ```

3. **Verify cloudinary.js exports it:**
   ```bash
   grep -n "uploadToTenantFolder" server/config/cloudinary.js
   # Should show function definition
   ```

---

### Issue: Cloudinary folder structure is flat (no tenant folders)

**Error:** All files in `notesmitra/notes/` instead of `notesmitra/{tenantId}/notes/`

**Cause:** Tenant ID not extracted or passed to upload

**Solution in upload.js:**
```javascript
// Must extract tenant:
const tenantId = req.tenant.id;

if (!tenantId) {
  return res.status(400).json({ message: 'Tenant not found' });
}

// Must pass to uploadToTenantFolder:
const result = await uploadToTenantFolder(
  filePath,
  tenantId,      // ← Must include
  'notes',
  'raw'
);
```

---

## Performance Issues

### Issue: Uploads are slow

**Expected:** < 2 seconds for typical PDF

**Slow symptoms:** > 10 seconds

**Cause 1: Large file**
```bash
# Check file size
ls -lh file.pdf
# Should be < 50MB
```

**Cause 2: Network latency**
```bash
# Test Cloudinary connectivity
curl -I https://api.cloudinary.com/v1_1/{cloud_name}/upload
# Should be < 100ms
```

**Cause 3: Cloudinary transformation**
Check if transformations are slow:
```javascript
// In uploadToTenantFolder, verify no expensive transforms
const result = await cloudinary.uploader.upload(filePath, {
  folder: 'notesmitra/' + tenantId + '/notes',
  // Don't add auto quality/format/transform etc
  // These slow down uploads
});
```

---

### Issue: Downloads are slow

**Expected:** < 500ms to generate signed URL

**Slow symptoms:** > 3 seconds

**Cause 1: Database query slow**
```bash
# Verify indexes exist
db.notes.getIndexes()
# Should include: { tenantId: 1, createdAt: -1 }
```

**Cause 2: fileAccessService doing too much**
```javascript
// generateTenantSignedUrl should be < 50ms
// Profile if slow:
const start = Date.now();
const url = await req.fileAccessService.generateTenantSignedUrl(...);
console.log('Signed URL generation:', Date.now() - start, 'ms');
```

**Cause 3: Cloudinary API slowness**
```bash
# Test Cloudinary API
curl https://api.cloudinary.com/v1_1/{cloud_name}/tags
# Should be < 200ms
```

---

## Testing Checklist

Before going to production, verify all scenarios:

### Upload Tests
- [ ] Upload as Tenant A → File in notesmitra/A/notes/
- [ ] Upload as Tenant B → File in notesmitra/B/notes/
- [ ] Note record has tenantId set
- [ ] cloudinaryPublicId has tenant in path

### Download Tests
- [ ] Download own file (Tenant A) → Signed URL
- [ ] Signed URL works in browser
- [ ] Signed URL expires after 1 hour
- [ ] Old non-tenant files still downloadable (legacy)

### Security Tests
- [ ] Tenant B cannot download Tenant A file
- [ ] Cross-tenant attempt logged
- [ ] publicId format validated
- [ ] Manual publicId manipulation fails

### Performance Tests
- [ ] Upload < 5 seconds (typical PDF)
- [ ] Signed URL generation < 1 second
- [ ] Download link works within 5 seconds
- [ ] No memory leaks over 100 requests

---

## Emergency Contacts

If none of this fixes the issue:

1. **Check file integrity:**
   ```bash
   ls -la server/services/fileAccessService.js
   md5sum server/services/fileAccessService.js
   ```

2. **Check server logs:**
   ```bash
   npm run dev 2>&1 | head -100
   # Look for errors in first 100 lines
   ```

3. **Reset to known good state:**
   ```bash
   git status
   git reset --hard HEAD
   npm start
   # Back to last known working version
   ```

4. **Document the issue:**
   - [ ] Exact error message
   - [ ] Steps to reproduce
   - [ ] Server logs (first 50 lines of error)
   - [ ] Database state (db.notes.count(), sample note)
   - [ ] Cloudinary folder structure screenshot

---

Good luck with your integration! 🚀
