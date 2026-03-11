# Tenant File Storage Implementation Checklist

Quick reference for implementing tenant-separated file storage.

## Files Created/Modified

### ✅ Created Files

1. **fileAccessService.js**
   - Location: `server/services/fileAccessService.js`
   - Purpose: Manages tenant access verification, signed URLs, cross-tenant detection
   - Key class: FileAccessService with 12+ methods

2. **fileAccessControl.js**
   - Location: `server/middleware/fileAccessControl.js`
   - Purpose: Middleware for file access protection
   - Key middleware: verifyFileOwnership, verifyFileDeletePermission, validatePublicIdFormat, etc.

3. **TENANT_FILE_STORAGE_GUIDE.md**
   - Location: `server/TENANT_FILE_STORAGE_GUIDE.md`
   - Purpose: Complete documentation and usage guide

### ✅ Modified Files

1. **cloudinary.js**
   - Added: `uploadToTenantFolder()` function
   - Uploads to: `notesmitra/{tenantId}/notes/`
   - Returns: tenant info in response

2. **upload.js (middleware)**
   - Added: Import of `uploadToTenantFolder`
   - Modified: `uploadToCloud` middleware to use tenant folder
   - Now: Automatically uses tenant context from req.tenant.id

3. **noteController.js**
   - Added: Imports for fileAccessService and AppError
   - Modified: `downloadNote` function with tenant verification
   - Now: Verifies cross-tenant access and generates tenant-scoped signed URLs

## Integration Steps

### Step 1: Verify Middleware Order ✓

In `server.js`, ensure this order:

```javascript
// 1. FIRST: Tenant resolution
app.use(tenantResolverMiddleware);

// 2. SECOND: Tenant context
app.use(tenantContextMiddleware);

// 3. THIRD: Services
app.use((req, res, next) => {
  req.subscriptionService = subscriptionService;
  req.planLimitsService = planLimitsService;
  next();
});

// 4. Parse request
app.use(express.json());

// 5. File service (new)
app.use(attachFileService);
app.use(logFileAccess);
app.use(validatePublicIdFormat);
```

### Step 2: Update Note Routes

In `routes/noteRoutes.js`:

```javascript
import { verifyFileOwnership, verifyFileDeletePermission } from '../middleware/fileAccessControl.js';
import { protect, requireRole } from '../middleware/authz.js';
import upload, { uploadToCloud, handleUploadError } from '../middleware/upload.js';

// Upload endpoint
router.post(
  '/upload',
  protect,
  requireRole('seller'),
  upload.single('file'),
  handleUploadError,
  uploadToCloud,  // ← Now tenant-scoped
  uploadNote
);

// Download endpoint
router.get(
  '/:id/download',
  protect,
  verifyFileOwnership,  // ← NEW: Tenant verification
  downloadNote
);

// Delete endpoint  
router.delete(
  '/:id',
  protect,
  requireRole('seller', 'admin'),
  verifyFileDeletePermission,  // ← NEW: Tenant verification
  deleteNote
);
```

### Step 3: Test Flows

#### Test 1: Upload File

```bash
curl -X POST http://localhost:5000/api/notes/upload \
  -H "Authorization: Bearer token" \
  -H "x-tenant-id: tenant1" \
  -F "file=@file.pdf" \
  -F "title=Economics Notes" \
  -F "description=Chapter 1-3" \
  -F "subject=Economics" \
  -F "semester=Fall 2024" \
  -F "price=5.99" \
  -F "pages=25"

# Response should include:
{
  "cloudinaryFile": {
    "publicId": "notesmitra/tenant1/notes/...",
    "tenantId": "tenant1",
    "folderPath": "notesmitra/tenant1/notes"
  }
}
```

#### Test 2: Download File (Same Tenant) ✓

```bash
curl -X GET http://localhost:5000/api/notes/123/download \
  -H "Authorization: Bearer token" \
  -H "x-tenant-id: tenant1"

# Response: Signed URL that works
{
  "success": true,
  "downloadUrl": "https://res.cloudinary.com/...",
  "tenantVerified": true,
  "expiresAt": "2024-02-25T10:00:00Z"
}
```

#### Test 3: Cross-Tenant Download (Different Tenant) ✗

```bash
curl -X GET http://localhost:5000/api/notes/123/download \
  -H "Authorization: Bearer token_tenant2" \
  -H "x-tenant-id: tenant2"

# Response: Error
{
  "success": false,
  "error": "Note not found in your tenant"
}

# Log: 🚨 Cross-tenant note access attempted
```

#### Test 4: Invalid Public ID Format ✗

```bash
curl -X GET http://localhost:5000/api/notes/123/download?publicId=invalid_format \
  -H "Authorization: Bearer token"

# Response: Error
{
  "success": false,
  "error": "Invalid file reference format"
}
```

## Validation Checklist

- [ ] fileAccessService.js created and imports correctly
- [ ] fileAccessControl.js created with all middleware
- [ ] cloudinary.js has uploadToTenantFolder function
- [ ] upload.js middleware updated to use tenant folder
- [ ] noteController.js has tenant verification in downloadNote
- [ ] Server middleware order is correct (tenant → context → services)
- [ ] Note routes have file access control middleware
- [ ] Tenant ID is extracted correctly from publicId format
- [ ] Cross-tenant access is blocked and logged
- [ ] Signed URLs expire correctly
- [ ] Upload creates tenant-scoped folder path

## Security Verification

- [ ] No direct cross-tenant file access possible
- [ ] PublicId format includes tenant ID
- [ ] Tenant ownership verified at download
- [ ] Signed URLs include tenant context
- [ ] Access attempts logged for audit
- [ ] File deletion only works for tenant owner
- [ ] Error messages don't leak tenant info to other users

## Performance Verification

- [ ] Uploads complete to tenant folder
- [ ] Signed URL generation doesn't add latency
- [ ] Tenant verification doesn't hit database unnecessarily
- [ ] No N+1 queries in file operations

## Testing Scenarios

### Scenario 1: Normal User Download
1. User purchases a note
2. Clicks download
3. Gets signed URL for their tenant's file ✓

### Scenario 2: Unpurchased Download Attempt
1. User tries to download file they didn't purchase
2. Gets "Must purchase first" error ✓

### Scenario 3: Cross-Tenant Hack Attempt
1. User A in Tenant 1 gets file publicId from Tenant 2
2. Tries to download with Tenant 2's publicId
3. Tenant verification fails
4. Access denied + logged ✓

### Scenario 4: File Owned by Different Seller
1. User A (Tenant 1) purchases note from Seller B (Tenant 1)
2. Note's tenantId = Tenant 1
3. User C (Tenant 2) can't access (different tenant) ✓

## Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Upload fails with "Tenant not found" | uploadToCloud returns error | Check tenantResolver middleware is first |
| Download shows "Invalid publicId" | File appears in browser cache wrong | Validate publicId format matches: `notesmitra/{tenantId}/notes/...` |
| Cross-tenant access not blocked | Same publicId works across tenants | Verify verifyFileOwnership middleware is on download route |
| Signed URL returns 401 | URL works for 5 min then fails | Check expiry (default 1 hour from generation) |
| Logs show no access attempts | Can't audit file access | Verify logFileAccess middleware is applied globally |

## Deployment Checklist

- [ ] All new files deployed to production
- [ ] Environment variables set for Cloudinary
- [ ] Database indices exist (if applicable)
- [ ] Monitoring set up for cross-tenant access attempts
- [ ] Logs configured for security events
- [ ] Backup of existing files (if migrating)
- [ ] Test cross-tenant access is blocked
- [ ] Verify signed URLs work from different networks
- [ ] Set up alerts for suspicious access patterns

## Feature Flags (Optional)

To enable/disable new features:

```javascript
// config/features.js
export const FEATURES = {
  TENANT_SCOPED_FILES: true,
  FILE_ACCESS_LOGGING: true,
  CROSS_TENANT_BLOCK: true,
  SIGNED_URLS: true
};
```

Usage:
```javascript
if (FEATURES.TENANT_SCOPED_FILES) {
  // Use tenant-scoped upload
  await uploadToTenantFolder(...);
}
```

## Rollback Plan

If issues arise:

1. **Disable new middleware** in server.js
2. **Fall back to old upload** in upload.js
3. **Revert note controller** downloads
4. **Keep Cloudinary files** as-is (won't break existing links)

## Monitoring & Metrics

### Key Metrics to Track

```javascript
// In analytics/monitoring
{
  tenant_file_uploads: 1234,
  tenant_file_downloads: 5678,
  cross_tenant_attempts: 0,  // Should be 0
  signed_url_generations: 5600,
  file_access_errors: 12,
  average_download_time: 1.2  // seconds
}
```

### Alerts to Set Up

- [ ] Any cross-tenant access attempt
- [ ] More than 5 failed downloads per hour
- [ ] Upload failures > 2% of attempts
- [ ] Signed URL generation delay > 500ms

## Documentation Links

- [Tenant File Storage Guide](./TENANT_FILE_STORAGE_GUIDE.md)
- [FileAccessService](./services/fileAccessService.js)
- [File Access Control Middleware](./middleware/fileAccessControl.js)
- [Cloudinary Config](./config/cloudinary.js)
- [Note Controller](./controllers/noteController.js)

## Quick Command Reference

### Check Cloudinary Tenant Folders

```bash
# List files in tenant1's folder
cloudinary_cli --c=list --p=notesmitra/tenant1/notes/

# Get file metadata
cloudinary_cli --c=info --p=notesmitra/tenant1/notes/file.pdf
```

### View Access Logs

```bash
# See all cross-tenant attempts
grep "Cross-tenant" server.log

# See all file downloads
grep "File access" server.log
```

## Next Steps

1. **Deploy to staging** and run test scenarios
2. **Monitor for cross-tenant issues** (should be 0)
3. **Get user feedback** on download experience
4. **Configure alerts** for security events
5. **Deploy to production** after validation
6. **Archive old files** if needed
7. **Add to documentation** for support team

## Support Contact

For questions or issues:
- Check TENANT_FILE_STORAGE_GUIDE.md first
- Review test scenarios above
- Check server logs for errors
- Verify tenant context is set correctly
