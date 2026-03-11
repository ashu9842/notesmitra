# Multi-Tenant Data Isolation Guide

This guide explains how the automatic tenant-based query filtering works and how to integrate it into your application.

## Architecture

### Components

1. **Tenant Context** (`utils/tenantContext.js`)
   - Uses AsyncLocalStorage to track current tenant across async operations
   - Provides `getTenantContext()` to retrieve tenant ID in any async context

2. **Tenant Plugin** (`utils/tenantPlugin.js`)
   - Mongoose plugin that auto-filters queries by tenantId
   - Applies to: `find`, `findOne`, `findOneAndUpdate`, `update`, `updateMany`, `deleteOne`, `deleteMany`, etc.
   - Automatically adds `{ tenantId: getTenantContext() }` filter to all queries

3. **Tenant Context Middleware** (`middleware/tenantContext.js`)
   - Sets tenant context for HTTP request lifecycle
   - Must be applied AFTER `resolveTenant` middleware

4. **Tenant Resolver** (`middleware/tenantResolver.js`)
   - Resolves tenant from subdomain or header
   - Attaches tenant info to `req.tenant`

### Models with Auto-Filtering

All main models now have tenantPlugin applied:
- ✅ User
- ✅ Note
- ✅ Purchase
- ✅ Wallet
- ✅ Ticket

## Integration Steps

### 1. Update server.js

```javascript
import tenantResolver from "./middleware/tenantResolver.js";
import tenantContextMiddleware from "./middleware/tenantContext.js";

// Apply middleware in correct order
app.use(tenantResolver);        // Resolve tenant from subdomain/header
app.use(tenantContextMiddleware); // Set tenant context for queries
app.use(express.json());
// ... other middleware
```

### 2. How It Works

#### Example Controller (BEFORE - Manual tenantId passing):
```javascript
export const getNotes = async (req, res) => {
  try {
    // Had to manually filter by tenantId
    const notes = await Note.find({ 
      tenantId: req.tenant.id,
      sellerId: req.user.id 
    });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

#### Example Controller (AFTER - Automatic filtering):
```javascript
export const getNotes = async (req, res) => {
  try {
    // tenantId filter automatically applied!
    const notes = await Note.find({ 
      sellerId: req.user.id 
    });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### 3. Query Examples

```javascript
// All these automatically filter by tenant context
await User.find({ role: 'seller' });
await Note.findOne({ _id: noteId });
await Purchase.updateOne({ _id: purchaseId }, { status: 'completed' });
await Wallet.deleteMany({ balance: 0 });
await Ticket.find({ status: 'open' });
```

## Key Benefits

✅ **No Manual Tenant Passing**
- Controllers don't need to include tenantId in queries
- Plugin automatically applies tenant filter

✅ **Prevents Data Leakage**
- Every query is scoped to current tenant
- Impossible to accidentally query across tenants

✅ **Consistent Behavior**
- All query methods automatically filtered
- Works across all models with plugin

✅ **Clean Code**
- Controllers focus on business logic
- Tenant isolation is implicit

## Advanced Usage

### Helper Methods on Models

```javascript
// Get all records for a specific tenant
const notes = await Note.forTenant(tenantId).find();

// Bypass tenant filter (use cautiously)
const allNotes = await Note.bypassTenantFilter(async (Notes) => {
  return await Notes.find();
});
```

### Using withTenantContext Helper

For background jobs or scheduled tasks outside HTTP context:

```javascript
import { withTenantContext } from './middleware/tenantContext.js';

// Process job for specific tenant
await withTenantContext(tenantId, async () => {
  const notes = await Note.find();
  // ... process notes
});
```

## Debugging

### Check Tenant Context

```javascript
import { getTenantContext } from './utils/tenantContext.js';

// In any controller or service
const currentTenant = getTenantContext();
console.log('Current tenant:', currentTenant);
```

### Verify Filtering

Enable logging in tenantPlugin.js to see which queries have tenant filter applied:

```javascript
const applyTenantFilter = (query) => {
  const tenantId = getTenantContext();
  console.log(`Applying tenant filter: ${tenantId} to ${query.collection?.name}`);
  // ...
};
```

## Security Considerations

⚠️ **Important**

1. **Always apply tenantContextMiddleware** after tenantResolver
2. **tenantId must be required** in all schemas
3. **Admin queries** should still check tenant ownership for operations
4. **Compound indexes** on (tenantId, other_field) for performance

Example admin route:
```javascript
export const deleteAnyNote = async (req, res) => {
  const { tenantId } = req.tenant;
  const { noteId } = req.params;
  
  // Verify note belongs to this tenant
  const note = await Note.findById(noteId);
  if (note.tenantId.toString() !== tenantId.toString()) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  await Note.deleteOne({ _id: noteId });
  res.json({ success: true });
};
```

## Troubleshooting

### "Query executed without tenant context"

**Cause**: Middleware not applied or operation runs outside request context

**Solution**:
```javascript
// In server.js, ensure order is correct:
app.use(tenantResolver);
app.use(tenantContextMiddleware); // Must be before routes
app.use(routes);
```

### Cross-tenant data visible

**Cause**: tenantId field missing or query running without context

**Solution**:
1. Verify tenantId field exists in schema
2. Check plugin is applied to model
3. Ensure middleware is in correct position

### Performance Issues

**Optimization**:
```javascript
// Create compound indexes
noteSchema.index({ tenantId: 1, sellerId: 1 });
noteSchema.index({ tenantId: 1, status: 1 });
purchaseSchema.index({ tenantId: 1, createdAt: -1 });
```

## Summary

The tenant plugin creates a **zero-configuration** multi-tenant query isolation layer:

1. Middleware sets tenant context
2. Plugin automatically filters all queries
3. Controllers work as normal without tenant awareness
4. Data isolation is implicit and guaranteed
