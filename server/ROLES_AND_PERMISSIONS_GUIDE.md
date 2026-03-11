# Tenant-Scoped Roles & Permissions Guide

## Role Hierarchy

```
Superadmin (Platform Owner)
    ↓
Tenant Admin (Tenant Owner)
    ↓
Teacher/Seller (Content Creators)
    ↓
Buyer/Student (Consumers)
```

## Role Definitions

| Role | Level | Scope | Purpose |
|------|-------|-------|---------|
| **superadmin** | 10 | Platform | Full platform control |
| **admin** | 8 | Tenant | Manage entire tenant |
| **teacher** | 6 | Tenant | Create & manage content |
| **seller** | 5 | Tenant | Sell notes (your project) |
| **buyer** | 3 | Tenant | Purchase notes (your project) |
| **student** | 1 | Tenant | Basic access |

## User Model Fields

```javascript
{
  role: 'seller',           // Global role (buyer/seller/admin/student/teacher)
  isTenantAdmin: true,      // Is admin of current tenant
  isSuperAdmin: false,      // Is platform superadmin
  tenantId: ObjectId        // Tenant this user belongs to
}
```

## Available Permissions

### Superadmin Permissions
```javascript
[
  'manage:institutions',    // Create/edit institutions
  'manage:users',          // Manage all users
  'manage:all:content',    // Manage all content
  'manage:payments',       // Manage payments
  'view:analytics',        // View platform analytics
  'manage:admins'          // Manage admins
]
```

### Tenant Admin Permissions
```javascript
[
  'manage:tenant:users',      // Manage tenant users
  'manage:tenant:content',    // Manage all tenant content
  'view:tenant:analytics',    // View tenant analytics
  'manage:tenant:settings',   // Manage tenant settings
  'moderate:content',         // Approve/reject content
  'manage:tickets'            // Handle support tickets
]
```

### Teacher Permissions
```javascript
[
  'create:content',           // Create educational content
  'edit:own:content',         // Edit own content
  'view:own:analytics',       // View own analytics
  'manage:own:resources'      // Manage resources
]
```

### Seller Permissions (Your Project)
```javascript
[
  'create:notes',             // Upload notes
  'edit:own:notes',           // Edit own notes
  'upload:files',             // Upload PDF files
  'view:own:earnings',        // View earnings
  'manage:own:notes'          // Manage listings
]
```

### Buyer Permissions (Your Project)
```javascript
[
  'view:notes',               // Browse notes
  'purchase:notes',           // Buy notes
  'download:purchased',       // Download bought notes
  'rate:content',             // Leave reviews
  'create:tickets',           // Open support tickets
  'manage:own:wallet'         // Manage wallet
]
```

## Middleware Usage

### 1. Protect Route (Authentication)
```javascript
import { protect } from '../middleware/authz.js';

// Verify user is authenticated and belongs to tenant
router.get('/api/notes', protect, getNotes);
```

Enforces:
- ✓ User is authenticated
- ✓ User belongs to current tenant
- ✓ Tenant context exists

### 2. Require Superadmin
```javascript
import { requireSuperAdmin } from '../middleware/authz.js';

// Only platform owner can access
router.post('/api/admin/institutions', requireSuperAdmin, createInstitution);
```

### 3. Require Tenant Admin
```javascript
import { requireTenantAdmin } from '../middleware/authz.js';

// Only tenant admin or superadmin
router.post('/api/admin/users', requireTenantAdmin, inviteUser);
```

### 4. Require Specific Role
```javascript
import { requireRole } from '../middleware/authz.js';

// Only sellers/teachers can upload
router.post('/api/notes/upload', requireRole('seller', 'teacher'), uploadNotes);

// Only admin can manage
router.put('/api/admin/notes/:id', requireRole('admin'), moderateNote);
```

### 5. Require Permission
```javascript
import { requirePermission } from '../middleware/authz.js';

// Check granular permission
router.delete('/api/notes/:id', requirePermission('edit:own:notes'), deleteNote);
```

### 6. Verify Ownership
```javascript
import { verifyResourceOwnership } from '../middleware/authz.js';

// User can only modify own notes (or admin can modify any)
router.put(
  '/api/notes/:id',
  protect,
  verifyResourceOwnership('userId'),
  updateNote
);
```

## Route Protection Examples

### Public Routes (No Auth)
```javascript
router.post('/api/auth/signup', signup);
router.post('/api/auth/login', login);
```

### Buyer Routes
```javascript
router.get('/api/notes', protect, getNotes);              // View notes
router.post('/api/purchases', protect, purchaseNote);    // Buy
router.get('/api/downloads/:id', protect, download);     // Download
```

### Seller Routes
```javascript
router.post('/api/notes', protect, requireRole('seller'), uploadNote);
router.put('/api/notes/:id', protect, verifyResourceOwnership('userId'), editNote);
router.get('/api/earnings', protect, requireRole('seller'), getEarnings);
```

### Tenant Admin Routes
```javascript
router.get('/api/admin/users', protect, requireTenantAdmin, getUsersList);
router.put('/api/admin/users/:id/role', protect, requireTenantAdmin, changeUserRole);
router.get('/api/admin/analytics', protect, requireTenantAdmin, getAnalytics);
```

### Superadmin Routes
```javascript
router.post('/api/institutions', protect, requireSuperAdmin, createInstitution);
router.put('/api/users/:id/superadmin', protect, requireSuperAdmin, setSuperAdmin);
```

## Complete Route Setup

```javascript
import express from 'express';
import { protect, requireRole, requireTenantAdmin, requireSuperAdmin, verifyResourceOwnership, requirePermission } from '../middleware/authz.js';
import { resolveTenant } from '../middleware/tenantResolver.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';

const app = express();

// Apply tenant resolution first
app.use(resolveTenant);
app.use(tenantContextMiddleware);

// Auth routes (public)
app.post('/api/auth/signup', authController.signup);
app.post('/api/auth/login', authController.signin);

// Buyer routes
app.get('/api/notes', protect, noteController.getNotes);
app.post('/api/purchases', protect, purchaseController.create);

// Seller routes
app.post('/api/notes', 
  protect, 
  requireRole('seller'), 
  noteController.create
);

app.put('/api/notes/:id',
  protect,
  requireRole('seller'),
  verifyResourceOwnership('sellerId'),
  noteController.update
);

// Tenant admin routes
app.get('/api/admin/users',
  protect,
  requireTenantAdmin,
  adminController.getUsers
);

// Superadmin routes
app.post('/api/institutions',
  protect,
  requireSuperAdmin,
  adminController.createInstitution
);
```

## Tenant Isolation Guarantee

Each middleware enforces:
1. User must belong to tenant
2. All queries auto-filtered by tenant (via tenantPlugin)
3. Cross-tenant access rejected

## Permission Checking in Controllers

```javascript
import { hasPermission, getRolePermissions } from '../config/roles.js';

export const uploadNote = async (req, res) => {
  const userRole = req.user.role;

  // Check if role has permission
  if (!hasPermission(userRole, 'create:notes')) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  // Get all permissions
  const permissions = getRolePermissions(userRole);
  console.log(permissions);

  // ... rest of logic
};
```

## Workflow Examples

### Signup Flow
```
POST /api/auth/signup
{
  "name": "John",
  "email": "john@college.com",
  "password": "...",
  "tenantSlug": "dtu"
}

Response:
{
  "user": {
    "id": "...",
    "role": "buyer",        // Default role
    "isTenantAdmin": true,  // First user in tenant
    "isSuperAdmin": false,
    "tenantId": "..."
  }
}
```

### Tenant Admin Invites User
```
POST /api/admin/users
(Bearer token: tenant admin)
{
  "email": "seller@college.com",
  "role": "seller"
}

✓ Tenant admin can invite
✓ New user added to same tenant
✓ New user gets "seller" role
✓ New user's isTenantAdmin = false
```

### Superadmin Creates Institution
```
POST /api/institutions
(Bearer token: superadmin)
{
  "name": "New College",
  "slug": "new-college",
  "plan": "pro"
}

✓ Only superadmin can create institutions
✓ New institution created
```

## Key Security Features

✅ **Tenant Isolation**: Every query auto-filtered by tenant  
✅ **Role-Based Access**: Fine-grained permission control  
✅ **Hierarchy Support**: Higher roles inherit lower permissions  
✅ **Ownership Verification**: Users can't modify others' resources  
✅ **Platform Segregation**: Superadmin controls all, admins control tenant  
✅ **Audit Logging**: Track all permission denials

## Migration for Your Project (admin/buyer/seller)

Your current roles map to:
- `admin` → Tenant Admin + superadmin capability
- `buyer` → Buyer role
- `seller` → Seller role

Both will work seamlessly with new system. You can optionally add `student`/`teacher` in future.
