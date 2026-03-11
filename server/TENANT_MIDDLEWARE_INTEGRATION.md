/**
 * INTEGRATION EXAMPLE FOR server.js
 * 
 * Add these imports and middleware to enable automatic tenant isolation
 */

// ============ IMPORTS TO ADD ============
import tenantResolver from "./middleware/tenantResolver.js";
import tenantContextMiddleware from "./middleware/tenantContext.js";

// ============ MIDDLEWARE ORDER (IN server.js) ============
// 
// Correct order is critical:
//
// 1. Tenant Resolution (detect tenant)
app.use(tenantResolver);

// 2. Tenant Context (set async context for queries)
app.use(tenantContextMiddleware);

// 3. Other middleware
app.use(express.json());
app.use(cors());
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]'));

// 4. Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/purchases', purchaseRoutes);
// ... other routes

// ============ WHAT THIS ENABLES ============
//
// With tenant context middleware in place:
//
// ❌ OLD WAY (manual tenantId passing):
// const notes = await Note.find({ tenantId: req.tenant.id, sellerId: req.user.id });
//
// ✅ NEW WAY (automatic tenant filtering):
// const notes = await Note.find({ sellerId: req.user.id });
// tenantId filter is automatically applied by the plugin!
//
// ============ HOW IT WORKS ============
//
// 1. Request arrives → tenantResolver detects tenant from subdomain/header
// 2. Sets req.tenant with tenant info
// 3. tenantContextMiddleware sets AsyncLocalStorage context
// 4. Every DB query automatically gets tenantId filter from context
// 5. Response sent with tenant-scoped data only
//
// ============ EXAMPLE FLOW ============
//
// Request: GET /api/notes (from college.notesmitra.com)
//          ↓
// tenantResolver: Detects "college" subdomain → finds Institution
//          ↓
// req.tenant = { id: ObjectId(...), slug: 'college', ... }
//          ↓
// tenantContextMiddleware: Sets context with tenant ID
//          ↓
// Controller: await Note.find({ sellerId: req.user.id })
//          ↓
// tenantPlugin: Automatically adds { tenantId: context }
//          ↓
// Query executed: { tenantId: ObjectId(...), sellerId: ObjectId(...) }
//          ↓
// Only notes from 'college' tenant are returned
//          ↓
// Response sent
//
// ============ IMPORTANT NOTES ============
//
// • Must apply tenantResolver BEFORE routes
// • Must apply tenantContextMiddleware AFTER tenantResolver
// • All models with tenantPlugin now have automatic filtering
// • Never manually pass tenantId in controllers (it's automatic)
// • For background jobs, use withTenantContext helper
//
// ============ ERROR RESPONSES ============
//
// If tenant not found:     404 - "Tenant '...' not found"
// If tenant inactive:      403 - "Tenant account is inactive"
// If no tenant detected:   400 - "No tenant detected"
// If missing on localhost: 400 - "Tenant ID required in x-tenant-id header"
//
// ============ FOR LOCALHOST DEVELOPMENT ============
//
// Add header: x-tenant-id: college
// Example: curl http://localhost:5000/api/notes \
//            -H "x-tenant-id: college"
//
// ============ MODELS WITH AUTO-FILTERING ============
//
// ✓ User.find(), User.findOne(), User.updateMany(), etc.
// ✓ Note.find(), Note.findOne(), Note.deleteOne(), etc.
// ✓ Purchase.find(), Purchase.updateOne(), Purchase.deleteMany(), etc.
// ✓ Wallet.find(), Wallet.findOneAndUpdate(), etc.
// ✓ Ticket.find(), Ticket.findOne(), Ticket.update(), etc.
//
// All automatically filtered by tenant context!
