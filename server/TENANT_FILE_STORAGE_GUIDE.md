# Tenant-Separated File Storage Guide

Complete guide for file storage with tenant isolation, cross-tenant prevention, and signed URLs.

## Overview

The system implements tenant-separated file storage with:
- **Tenant-scoped folders**: `/tenantId/notes/` structure in Cloudinary
- **Cross-tenant access prevention**: Validates tenant ownership on all file operations
- **Signed URLs**: Time-limited, tenant-verified download links
- **Access control**: Middleware-based permission verification
- **Audit logging**: All file access attempts logged

## Architecture

### File Path Structure

```
Cloudinary
└── notesmitra
    ├── {tenantId1}
    │   └── notes
    │       ├── file1.pdf
    │       ├── file2.pdf
    │       └── file3.pdf
    ├── {tenantId2}
    │   └── notes
    │       └── file4.pdf
    └── {tenantId3}
        └── notes
            └── file5.pdf
```

### Public ID Format

Public IDs follow tenant-scoped pattern:
```
notesmitra/{tenantId}/notes/{filename}
```

Example:
```
notesmitra/507f1f77bcf86cd799439010/notes/economics_notes_abc123.pdf
```

## Components

### 1. FileAccessService

**Location**: `server/services/fileAccessService.js`

Manages all file access operations with tenant verification.

#### Methods

##### Get Tenant Folder Path
```javascript
const folderPath = fileAccessService.getTenantFolderPath(tenantId, 'notes');
// Returns: notesmitra/{tenantId}/notes
```

##### Extract Tenant from Public ID
```javascript
const tenantId = fileAccessService.extractTenantFromPublicId(publicId);
// Parses: notesmitra/{tenantId}/notes/{filename}
// Returns: {tenantId}
```

##### Verify File Access
```javascript
await fileAccessService.verifyFileAccess(publicId, requesterTenantId);
// Throws AppError if:
// - Invalid public ID format
// - File belongs to different tenant
// - Tenant mismatch detected
```

##### Generate Tenant-Scoped Signed URL
```javascript
const result = fileAccessService.generateTenantSignedUrl(
  publicId,
  requesterTenantId,
  3600 // expires in 1 hour
);

// Returns:
{
  success: true,
  url: "...", // Signed Cloudinary URL
  expiresIn: 3600,
  tenantId: requesterTenantId,
  expiresAt: Date
}
```

##### Detect Cross-Tenant Access
```javascript
const check = fileAccessService.detectCrossTenantAccess(publicId, requesterTenantId);

// Returns:
{
  detected: true/false,
  severity: 'critical' | 'high' | 'medium',
  message: 'Description',
  attemptedTenant?: ...,
  fileTenant?: ...
}
```

### 2. File Access Control Middleware

**Location**: `server/middleware/fileAccessControl.js`

Protects file endpoints with permission checks.

#### Middleware Functions

##### verifyFileOwnership
```javascript
import { verifyFileOwnership } from '../middleware/fileAccessControl.js';

// Protect download endpoint
router.get(
  '/notes/:noteId/download',
  protect,
  verifyFileOwnership,  // ← Verify tenant ownership
  downloadNote
);
```

Query parameters checked:
- `publicId`: Cloudinary public ID of file

##### verifyFileDeletePermission
```javascript
import { verifyFileDeletePermission } from '../middleware/fileAccessControl.js';

router.delete(
  '/notes/:noteId',
  protect,
  requireTenantAdmin,
  verifyFileDeletePermission,  // ← Verify before delete
  deleteNote
);
```

Body parameters checked:
- `publicId`: File to delete

##### validatePublicIdFormat
```javascript
import { validatePublicIdFormat } from '../middleware/fileAccessControl.js';

// Validates all public IDs have correct format
router.use(validatePublicIdFormat);
```

##### attachFileService
```javascript
app.use(attachFileService);
// Now available as req.fileAccessService throughout request
```

##### logFileAccess
```javascript
import { logFileAccess } from '../middleware/fileAccessControl.js';

// Log all file access attempts
app.use(logFileAccess);
```

##### redirectToTenantNamespace
```javascript
import { redirectToTenantNamespace } from '../middleware/fileAccessControl.js';

// Prevent cross-tenant file access
router.use('/notes/download', redirectToTenantNamespace);
```

## Cloudinary Configuration

### uploadToCloudinary (Legacy)

```javascript
import { uploadToCloudinary } from '../config/cloudinary.js';

const result = await uploadToCloudinary(filePath, 'notes', 'raw');
// Uploads to: notesmitra/notes/
// NOT TENANT-SCOPED - For backward compatibility only
```

### uploadToTenantFolder (New)

```javascript
import { uploadToTenantFolder } from '../config/cloudinary.js';

const result = await uploadToTenantFolder(
  filePath,
  tenantId,
  'notes',    // file type
  'raw'       // resource type
);

// Uploads to: notesmitra/{tenantId}/notes/
// Returns:
{
  success: true,
  url: "...",
  publicId: "notesmitra/{tenantId}/notes/filename",
  tenantId: "{tenantId}",
  folderPath: "notesmitra/{tenantId}/notes",
  tags: ["tenant:{tenantId}", "type:notes"],
  bytes: 123456
}
```

### generateSignedUrl

```javascript
import { generateSignedUrl } from '../config/cloudinary.js';

// WITHOUT tenant verification (legacy)
const signedUrl = generateSignedUrl(publicId, 3600);
```

## Upload Handler

### Upload Middleware

**File**: `server/middleware/upload.js`

Modified to support tenant-scoped uploads:

```javascript
import { uploadToCloud } from '../middleware/upload.js';

// Requires tenantResolver middleware to be applied first
router.post(
  '/notes/upload',
  protect,
  upload.single('file'),
  uploadToCloud,  // ← Uploads to tenant folder automatically
  uploadNote
);
```

The middleware:
1. Extracts tenant ID from `req.tenant.id`
2. Calls `uploadToTenantFolder` with tenant context
3. Attaches tenant info to `req.cloudinaryFile`
4. Fails if tenant not found

## Download Handler

### Enhanced Download Controller

**File**: `server/controllers/noteController.js`

```javascript
export const downloadNote = async (req, res, next) => {
  // 1. Find note
  const note = await Note.findById(req.params.id);

  // 2. VERIFY TENANT OWNERSHIP
  if (note.tenantId.toString() !== req.tenant.id.toString()) {
    // Cross-tenant access attempt detected and logged
    throw new AppError('Note not found in your tenant', 404);
  }

  // 3. Check purchase
  const purchase = await Purchase.findOne({ ... });
  if (!purchase) {
    throw new AppError('Buy first', 403);
  }

  // 4. GENERATE TENANT-SCOPED SIGNED URL
  const fileVerification = await fileAccessService.verifyFileAccess(
    note.cloudinaryPublicId,
    req.tenant.id
  );

  const signedUrl = fileAccessService.generateTenantSignedUrl(
    note.cloudinaryPublicId,
    req.tenant.id,
    3600
  );

  // 5. Return tenant-verified download URL
  return res.json({
    success: true,
    downloadUrl: signedUrl.url,
    tenantVerified: true,
    expiresAt: signedUrl.expiresAt
  });
};
```

## Integration Example

### Recommended Route Structure

```javascript
import express from 'express';
import { protect, requireRole } from '../middleware/authz.js';
import {
  verifyFileOwnership,
  validatePublicIdFormat,
  attachFileService,
  logFileAccess
} from '../middleware/fileAccessControl.js';
import { uploadNote, downloadNote, deleteNote } from '../controllers/noteController.js';
import upload, { uploadToCloud } from '../middleware/upload.js';

const router = express.Router();

// Attach file service and logging
router.use(attachFileService);
router.use(logFileAccess);
router.use(validatePublicIdFormat);

// Upload (requires seller role)
router.post(
  '/:id/upload',
  protect,
  requireRole('seller'),
  upload.single('file'),
  uploadToCloud,  // ← Tenant-scoped upload
  uploadNote
);

// Download (requires purchase)
router.get(
  '/:id/download',
  protect,
  verifyFileOwnership,  // ← Tenant verification
  downloadNote
);

// Delete (seller or tenant admin)
router.delete(
  '/:id',
  protect,
  requireRole('seller', 'admin'),
  verifyFileOwnership,  // ← Tenant verification
  deleteNote
);

export default router;
```

### Server Integration

In `server.js`:

```javascript
import { attachFileService, logFileAccess } from './middleware/fileAccessControl.js';

// Apply globally for all file operations
app.use(attachFileService);
app.use(logFileAccess);

// Routes
app.use('/api/notes', noteRoutes);
```

## Security Features

### Cross-Tenant Prevention

Multiple layers prevent cross-tenant file access:

1. **Public ID Format Validation**
   ```javascript
   // Only accepts: notesmitra/{currentTenantId}/notes/...
   fileAccessService.isValidTenantPublicId(publicId, tenantId)
   ```

2. **Tenant Extraction Verification**
   ```javascript
   const fileTenant = fileAccessService.extractTenantFromPublicId(publicId);
   if (fileTenant !== requestTenant) {
     throw new Error('Cross-tenant access detected');
   }
   ```

3. **Database-Level Verification**
   ```javascript
   // Check note.tenantId matches request tenant
   if (note.tenantId !== req.tenant.id) {
     throw new Error('Note not in your tenant');
   }
   ```

4. **Signed URL Tenant Binding**
   - URL includes tenant context
   - Cloudinary checks authentication
   - Time-limited (1 hour default)

### Audit Logging

All file access logged:

```javascript
const logEntry = fileAccessService.createAccessLog(
  publicId,      // File accessed
  tenantId,       // Tenant context
  userId,         // Who accessed
  'download',     // Action
  success,        // Success/failure
  error           // Error if any
);

// Logged data:
{
  publicId: "...",
  tenantId: "...",
  userId: "...",
  action: "download",
  success: true,
  timestamp: Date,
  ipAddress: "...",
  userAgent: "..."
}
```

## Configuration

### Environment Variables

```env
# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
USE_CLOUDINARY=true

# File storage
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=20971520  # 20MB
```

### Tenant-Specific Settings

Files are automatically segregated. No additional config needed per tenant.

## Rate Limiting

Rate limit downloads per tenant:

```javascript
import { rateLimitFileDownload } from '../middleware/fileAccessControl.js';

router.get(
  '/:id/download',
  protect,
  rateLimitFileDownload(100, 1000),  // 100/hour, 1000/day
  downloadNote
);
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Tenant not found in request" | Tenant middleware not applied | Ensure tenantResolver before file operations |
| "Invalid file reference format" | PublicId doesn't match pattern | Use publicIds from uploads only |
| "You do not have permission to access this file" | Cross-tenant access attempt | Verify tenant context in request |
| "File not found in your tenant" | File belongs to different tenant | Check note.tenantId |
| "Cannot generate signed URL for file outside your tenant" | Trying to access other tenant's file | Use correct tenantId |

### Error Response Examples

```json
{
  "success": false,
  "message": "You do not have permission to access this file",
  "code": 403
}
```

```json
{
  "success": false,
  "message": "Cross-tenant access detected",
  "code": 403
}
```

## Testing

### Test Cross-Tenant Prevention

```bash
# Setup: User A in Tenant 1, User B in Tenant 2
# User A uploads file → publicId: notesmitra/tenant1/notes/file.pdf
# User B tries to download User A's file

curl -X GET 'http://localhost:5000/api/notes/download?publicId=notesmitra/tenant1/notes/file.pdf' \
  -H "Authorization: Bearer user_b_token" \
  -H "x-tenant-id: tenant2"

# Expected: 403 Forbidden
# Log: 🚨 Cross-tenant access attempted
```

### Test Signed URL Expiry

```bash
# Get signed URL
curl -X GET 'http://localhost:5000/api/notes/123/download' \
  -H "Authorization: Bearer token"

# Response includes expiresAt
# After expiresAt, Cloudinary rejects the link
```

### Test Upload Segregation

```bash
# Tenant 1 uploads
curl -X POST 'http://localhost:5000/api/notes/upload' \
  -H "x-tenant-id: tenant1" \
  -F "file=@notes.pdf"

# Check Cloudinary: notesmitra/tenant1/notes/... ✓

# Tenant 2 uploads same filename
# Check Cloudinary: notesmitra/tenant2/notes/... (separate folder) ✓
```

## Monitoring

### Key Metrics

- Cross-tenant access attempts (should be 0)
- Failed file downloads (track issues)
- Signed URL generation rate
- Storage usage per tenant

### Alerts

Set alerts for:
- Any cross-tenant access attempt
- Repeated failed file access
- Unusual download volume

## Best Practices

1. **Always verify tenant** before any file operation
2. **Use signed URLs** for downloads, never direct links
3. **Set expiry times** appropriately (1 hour for downloads)
4. **Log all access** for security audit
5. **Validate public IDs** before accepting from client
6. **Clear temp files** after upload
7. **Use HTTPS** for all file transfers

## Troubleshooting

### Q: Files not uploading to tenant folder
**A**: Check tenant middleware is applied before uploadToCloud middleware

### Q: Cross-tenant access not blocked
**A**: Verify validatePublicIdFormat middleware is applied to all file routes

### Q: Signed URLs not working
**A**: Ensure Cloudinary authenticated mode is enabled and API credentials are valid

### Q: Can't find tenant in publicId
**A**: Use publicIds returned from upload endpoint, not custom ones

## Migration Guide

### From Old Non-Tenant Storage

If migrating from non-tenant files:

```javascript
// Identify old files in notesmitra/notes/
// Reorganize to notesmitra/{tenantId}/notes/

await cloudinary.api.resources({
  prefix: 'notesmitra/notes/',
  type: 'authenticated'
}).then(resources => {
  // Move each resource to tenant folder
});
```

## Future Enhancements

- [ ] Batch file operations with tenant verification
- [ ] File sharing with temporary cross-tenant links
- [ ] Storage quota per tenant file type
- [ ] Automatic file retention policies per tenant
- [ ] Tenant-specific file encryption
- [ ] Archive old files to cheaper storage

## Support

For issues related to:
- **Upload failures**: Check upload middleware order and tenant context
- **Access denied**: Verify tenant ID extraction and comparison
- **Signed URL issues**: Confirm Cloudinary config and public ID format
- **Audit logs**: Check fileAccessService logging implementation
