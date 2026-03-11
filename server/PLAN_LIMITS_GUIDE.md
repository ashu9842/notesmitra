# Plan Limits Enforcement Guide

## Plan Tiers

| Plan | Max Users | Max Uploads | Storage | Features |
|------|-----------|------------|---------|----------|
| **Free** | 10 | 50 | 10 GB | Basic |
| **Pro** | 100 | 500 | 100 GB | Advanced analytics, custom branding |
| **Enterprise** | 1000 | 10000 | 1000 GB | Full access, SSO, data residency |

## Architecture

### 1. **Plan Limits Config** (`config/planLimits.js`)
Defines hard limits for each plan:
```javascript
PLAN_LIMITS = {
  free: { maxUsers: 10, maxUploads: 50, storageLimit: 10 },
  pro: { maxUsers: 100, maxUploads: 500, storageLimit: 100 },
  enterprise: { maxUsers: 1000, maxUploads: 10000, storageLimit: 1000 }
}
```

### 2. **Institution Model** (`models/Institution.js`)
Tracks usage:
```javascript
{
  plan: 'free',              // Current plan
  maxUsers: 10,              // Limit from plan
  maxUploads: 50,            // Limit from plan
  storageLimit: 10,          // GB - Limit from plan
  currentUploads: 25,        // Current count
  usedStorage: 3.5,          // GB - Current usage
}
```

### 3. **Plan Limits Service** (`services/planLimitsService.js`)
Core business logic:
- `canAddUser()` - Check user limit
- `canUploadNote()` - Check upload limit
- `canStoreFile()` - Check storage before upload
- `addStorageUsage()` - Track storage
- `getUsageStats()` - Get current usage

### 4. **Middleware** (`middleware/planLimits.js`)
Validation before operations:
- `checkUserLimit` - Before add user
- `checkUploadLimit` - Before create note
- `checkStorageLimit` - Before file upload

## Integration Steps

### Step 1: Initialize Service in Server

```javascript
import { AuthRepository } from './modules/auth/repository.js';
import PlanLimitsService from './services/planLimitsService.js';

const authRepository = new AuthRepository();
const planLimitsService = new PlanLimitsService(authRepository);

// Attach to request
app.use((req, res, next) => {
  req.planLimitsService = planLimitsService;
  next();
});
```

### Step 2: Protect Routes

#### Add User Route
```javascript
import { protect, requireTenantAdmin } from '../middleware/authz.js';
import { checkUserLimit } from '../middleware/planLimits.js';

router.post('/api/admin/users',
  protect,
  requireTenantAdmin,
  checkUserLimit,        // Check before creating user
  inviteUser
);
```

#### Create Note Route
```javascript
import { protect, requireRole } from '../middleware/authz.js';
import { checkUploadLimit, checkStorageLimit } from '../middleware/planLimits.js';

router.post('/api/notes',
  protect,
  requireRole('seller'),
  checkUploadLimit,      // Check upload count
  checkStorageLimit(),   // Check available storage
  uploadNote
);
```

## Usage Examples

### Check User Limit (Before Creating User)
```javascript
const planLimitsService = req.planLimitsService;

try {
  // Throws error if limit exceeded
  await planLimitsService.canAddUser(req.tenant.id);
  
  // Proceed with user creation
} catch (error) {
  res.status(403).json({
    message: error.message,  // "User limit exceeded..."
    code: 'PLAN_LIMIT_EXCEEDED'
  });
}
```

### Track Upload
```javascript
// When user uploads note
const note = await Note.create(noteData);
await planLimitsService.incrementUploadCount(req.tenant.id);
```

### Track Storage
```javascript
// When file uploaded
const fileSizeGB = fileSize / (1024 * 1024 * 1024);

// Check before upload
await planLimitsService.canStoreFile(req.tenant.id, fileSizeGB);

// Track after successful upload
await planLimitsService.addStorageUsage(req.tenant.id, fileSizeGB);
```

### Remove Storage (When File Deleted)
```javascript
const fileSizeGB = 0.5; // GB
await planLimitsService.removeStorageUsage(req.tenant.id, fileSizeGB);
```

### Get Usage Stats
```javascript
const stats = await planLimitsService.getUsageStats(req.tenant.id);

console.log(stats);
// {
//   plan: 'free',
//   limits: { maxUsers: 10, maxUploads: 50, storageLimit: 10 },
//   usage: { currentUsers: 5, currentUploads: 25, usedStorage: 3.5 },
//   percentages: { users: '50.0', uploads: '50.0', storage: '35.0' }
// }
```

## Complete Controller Example

```javascript
import { PlanLimitsService } from '../services/planLimitsService.js';

export const uploadNote = async (req, res) => {
  try {
    const { name, description, price, file } = req.body;
    const planLimitsService = req.planLimitsService;

    // Check limits before proceeding
    await planLimitsService.canUploadNote(req.tenant.id);
    
    // Calculate file size in GB
    const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(3);
    
    await planLimitsService.canStoreFile(req.tenant.id, fileSizeGB);

    // Upload to Cloudinary (or local storage)
    const uploadResult = await uploadToCloudinary(file);

    // Create note
    const note = await Note.create({
      tenantId: req.tenant.id,
      sellerId: req.user._id,
      name,
      description,
      price,
      fileSize: fileSizeGB,
      cloudinaryUrl: uploadResult.url,
      cloudinaryPublicId: uploadResult.publicId
    });

    // Track usage
    await planLimitsService.incrementUploadCount(req.tenant.id);
    await planLimitsService.addStorageUsage(req.tenant.id, fileSizeGB);

    res.status(201).json({
      success: true,
      note
    });
  } catch (error) {
    if (error.code === 'PLAN_LIMIT_EXCEEDED') {
      return res.status(403).json({
        success: false,
        message: error.message,
        code: 'PLAN_LIMIT_EXCEEDED'
      });
    }
    res.status(500).json({ error: error.message });
  }
};
```

## Error Responses

### User Limit Exceeded
```json
{
  "success": false,
  "message": "User limit exceeded. Your free plan allows 10 users.",
  "code": "PLAN_LIMIT_EXCEEDED"
}
```

### Upload Limit Exceeded
```json
{
  "success": false,
  "message": "Upload limit exceeded. Your free plan allows 50 uploads.",
  "code": "PLAN_LIMIT_EXCEEDED"
}
```

### Storage Limit Exceeded
```json
{
  "success": false,
  "message": "Storage limit exceeded. You have 2.50GB remaining. Your free plan allows 10GB total.",
  "code": "PLAN_LIMIT_EXCEEDED"
}
```

## Usage Endpoint

**GET /api/usage** (Protected, tenant-scoped)
```javascript
router.get('/api/usage', protect, async (req, res) => {
  const stats = await req.planLimitsService.getUsageStats(req.tenant.id);
  res.json(stats);
});
```

**Response:**
```json
{
  "plan": "free",
  "limits": {
    "maxUsers": 10,
    "maxUploads": 50,
    "storageLimit": 10
  },
  "usage": {
    "currentUsers": 3,
    "currentUploads": 12,
    "usedStorage": 2.5
  },
  "percentages": {
    "users": "30.0",
    "uploads": "24.0",
    "storage": "25.0"
  }
}
```

## Database Fields Added to Institution

```javascript
{
  // Existing fields
  plan: 'free',
  maxUsers: 10,
  maxUploads: 50,
  storageLimit: 10,
  
  // New tracking fields
  usedStorage: 2.5,        // Current storage usage in GB
  currentUploads: 12,      // Current upload count
}
```

## Upgrade Plan Flow

When admin upgrades plan:

```javascript
export const upgradePlan = async (req, res) => {
  const { newPlan } = req.body;
  const limits = getPlanLimits(newPlan);
  
  const updated = await Institution.findByIdAndUpdate(
    req.tenant.id,
    {
      plan: newPlan,
      maxUsers: limits.maxUsers,
      maxUploads: limits.maxUploads,
      storageLimit: limits.storageLimit
    },
    { new: true }
  );
  
  res.json({ success: true, institution: updated });
};
```

## Key Features

✅ **Automatic Enforcement**: Middleware validates before operations  
✅ **Real-time Tracking**: Usage counts update instantly  
✅ **Multi-tenant**: Each tenant tracked separately  
✅ **Flexible**: Easy to add new limits  
✅ **Clear Errors**: Users told exactly what exceeded  
✅ **Usage Visibility**: Endpoint to check current usage  

## Monitoring

Check tenant usage:
```javascript
// Get stats
const stats = await planLimitsService.getUsageStats(tenantId);

if (stats.percentages.storage > 90) {
  // Send warning email
  sendStorageWarning(tenant, stats);
}
```
