# Multi-Tenant SaaS Implementation Checklist

Complete reference for all components created and their integration status.

## ✅ Completed Components

### Core Models
- [x] **Institution.js** - Tenant container with plan tracking
  - Fields: name, slug, plan, maxUsers, maxUploads, storageLimit
  - Subscription tracking: subscriptionId, subscriptionStatus, subscriptionExpiry
  - Location: `server/models/Institution.js`

- [x] **User.js** - Multi-tenant users with roles
  - Fields: email, password, tenantId, isTenantAdmin, isSuperAdmin
  - Role: student, seller, teacher, buyer, admin
  - Location: `server/models/User.js`

- [x] **Subscription.js** - Subscription lifecycle management
  - Fields: tenantId, plan, status, startDate, expiryDate, billingCycle, features
  - Methods: isActive(), isExpired(), getDaysRemaining(), getRenewalDate()
  - Location: `server/models/Subscription.js`

- [x] **Note.js, Purchase.js, Wallet.js, Ticket.js** - All multi-tenant models
  - All have: tenantId field with automatic filtering
  - Location: `server/models/{Model}.js`

### Services
- [x] **SubscriptionService** - Subscription lifecycle management
  - 11 methods: create, renew, cancel, getActive, isValid, getStatus, getExpiring, markExpired, upgrade, getDetails, getExpired
  - Location: `server/services/subscriptionService.js`
  - Dependencies: AuthRepository

- [x] **PlanLimitsService** - Enforce usage limits per plan
  - 8 methods: canAddUser, canUploadNote, canStoreFile, addStorageUsage, removeStorageUsage, incrementUploadCount, decrementUploadCount, getUsageStats
  - Location: `server/services/planLimitsService.js`
  - Dependencies: AuthRepository

### Middleware
- [x] **tenantResolver.js** - Extract tenant from subdomain/header
  - Detects: subdomain (college.notesmitra.com) or x-tenant-id header
  - Sets: req.tenant = { id, slug, name, plan, maxUsers, storageLimit, source }
  - Location: `server/middleware/tenantResolver.js`

- [x] **tenantContext.js** - AsyncLocalStorage for query context
  - Sets tenant context for automatic query filtering
  - Works with tenantPlugin for transparent multi-tenancy
  - Location: `server/middleware/tenantContext.js`

- [x] **tenantPlugin.js** - Mongoose plugin for auto-filtering queries
  - Applies to all models with tenantId field
  - Auto-adds { tenantId: context } to all find/update/delete operations
  - Location: `server/middleware/tenantPlugin.js`

- [x] **authz.js** - Role-based access control
  - 7 middleware: protect, requireSuperAdmin, requireTenantAdmin, requireRole, requirePermission, verifyOwnership, requireMinimumRole
  - Uses: roles.js for role hierarchy and permissions
  - Location: `server/middleware/authz.js`

- [x] **subscription.js** - Subscription verification middleware
  - 4 middleware: verifySubscriptionActive, checkSubscriptionFeature, subscriptionExpiryWarning, allowReadOnlyIfExpired
  - Location: `server/middleware/subscription.js`

- [x] **planLimits.js** - Plan limit enforcement middleware
  - 3 middleware: checkUserLimit, checkUploadLimit, checkStorageLimit
  - Location: `server/middleware/planLimits.js`

### Configuration
- [x] **roles.js** - Role definitions and permissions
  - ROLES enum: admin, buyer, seller, student, teacher
  - ROLE_HIERARCHY: numeric values (admin=8, seller=5, buyer=3, student=1, teacher=6)
  - PERMISSIONS: granular per-role permissions with matrix
  - Location: `server/config/roles.js`

- [x] **planLimits.js** - Plan definitions and limits
  - PLAN_LIMITS: free (10u, 50up, 10GB), pro (100u, 500up, 100GB), enterprise (1000u, 10000up, 1000GB)
  - Features per plan: customBranding, advancedAnalytics, sso, apiAccess, dataResidency, prioritySupport
  - Location: `server/config/planLimits.js`

### Controllers
- [x] **subscriptionController.js** - Subscription route handlers
  - 15 methods: create, getStatus, getDetails, getUsage, checkFeature, renew, upgrade, cancel, isValid, getExpiring, getExpired, markExpired, getForTenant, createForTenant, renewForTenant
  - Location: `server/controllers/subscriptionController.js`

### Routes
- [x] **subscriptionRoutes.js** - Subscription API endpoints
  - 15 endpoints: POST /, GET /status, /details, /usage, /feature/:featureName, /valid, POST /renew, /upgrade, /cancel
  - Admin endpoints: /admin/expiring, /admin/expired, /admin/mark-expired, /admin/tenant/:tenantId
  - Location: `server/routes/subscriptionRoutes.js`

### Documentation
- [x] **SUBSCRIPTION_SYSTEM_GUIDE.md** - Complete feature walkthrough
  - Overview, model fields, service methods, middleware usage, integration steps, examples
  - Location: `server/SUBSCRIPTION_SYSTEM_GUIDE.md`

- [x] **SERVER_INTEGRATION_GUIDE.md** - Step-by-step server.js integration
  - Service initialization, middleware order, complete template, troubleshooting
  - Location: `server/SERVER_INTEGRATION_GUIDE.md`

- [x] **SUBSCRIPTION_API_DOCS.md** - Complete API reference
  - All 15 endpoints documented with examples, error codes, plan limits
  - Location: `server/SUBSCRIPTION_API_DOCS.md`

---

## ⏳ Partially Complete

### AuthRepository Updates
- [x] Imported Subscription model
- [x] Added subscription methods: findSubscriptionByTenant, createSubscription, updateSubscription, getExpiringSubscriptions
- ⏳ Pending: Full integration testing and Institution lookup methods

### Server Integration
- ⏳ Services not yet initialized in server.js
- ⏳ Middleware chain not yet integrated
- ⏳ Routes not yet imported
- ⏳ Error handling not yet configured for subscription errors

---

## 🔲 Not Started

### Scheduled Jobs
- [ ] Daily job to mark expired subscriptions
- [ ] Reminder emails for expiring subscriptions (7 days, 3 days, 1 day)
- [ ] Auto-renewal for subscriptions with autoRenew=true
- [ ] Subscription usage reports

### Payment Integration
- [ ] Razorpay subscription webhook handling
- [ ] Stripe Payment Intent for subscriptions
- [ ] Payment method management
- [ ] Invoice generation and storage
- [ ] Refund processing for downgrades

### Advanced Features
- [ ] Plan proration (refund/charge on mid-cycle upgrade)
- [ ] Downgrade restrictions and refund policy
- [ ] Trial period support
- [ ] Coupon/discount codes
- [ ] Usage-based billing (overage charges)

### Monitoring & Analytics
- [ ] Subscription revenue dashboard
- [ ] Churn tracking and analysis
- [ ] Feature adoption tracking
- [ ] Plan migration reports
- [ ] Payment method distribution

### Client Integration
- [ ] Frontend subscription management page
- [ ] Plan selection UI
- [ ] Billing history page
- [ ] Usage statistics display
- [ ] Payment form integration

---

## File Structure

```
server/
├── models/
│   ├── Institution.js          ✅
│   ├── User.js                 ✅
│   ├── Subscription.js         ✅
│   ├── Note.js                 ✅
│   ├── Purchase.js             ✅
│   ├── Wallet.js               ✅
│   ├── Ticket.js               ✅
│   └── RefreshToken.js         ✅
│
├── services/
│   ├── subscriptionService.js  ✅
│   └── planLimitsService.js    ✅
│
├── controllers/
│   ├── subscriptionController.js✅
│   ├── authController.js       ⏳ (needs subscription init on signup)
│   ├── noteController.js       ⏳ (needs plan limit checks)
│   ├── paymentController.js    ⏳ (needs subscription creation)
│   ├── adminController.js      (existing)
│   ├── ticketController.js     (existing)
│   ├── walletController.js     (existing)
│   └── razorpayController.js   (existing)
│
├── routes/
│   ├── subscriptionRoutes.js   ✅
│   ├── authRoutes.js           ⏳ (needs subscription creation)
│   ├── noteRoutes.js           ⏳ (needs plan limit middleware)
│   ├── paymentRoutes.js        (existing)
│   ├── adminRoutes.js          (existing)
│   ├── ticketRoutes.js         (existing)
│   ├── walletRoutes.js         (existing)
│   └── razorpayRoutes.js       (existing)
│
├── middleware/
│   ├── tenantResolver.js       ✅
│   ├── tenantContext.js        ✅
│   ├── tenantPlugin.js         ✅
│   ├── authz.js                ✅
│   ├── subscription.js         ✅
│   ├── planLimits.js           ✅
│   ├── auth.js                 (existing)
│   ├── error.js                (existing)
│   └── upload.js               (existing)
│
├── config/
│   ├── roles.js                ✅
│   ├── planLimits.js           ✅
│   └── database.js             (existing)
│
├── modules/auth/
│   ├── repository.js           ⏳ (subscription methods added)
│   └── (other auth modules)    (existing)
│
├── server.js                   ⏳ (needs integration)
│
├── SUBSCRIPTION_SYSTEM_GUIDE.md ✅
├── SERVER_INTEGRATION_GUIDE.md  ✅
├── SUBSCRIPTION_API_DOCS.md     ✅
└── IMPLEMENTATION_CHECKLIST.md  (this file)
```

---

## Integration Steps (In Order)

### Step 1: Verify All Files Exist
```bash
# Check models
test -f server/models/Subscription.js && echo "✅ Subscription model exists"
test -f server/models/Institution.js && echo "✅ Institution model exists"

# Check services
test -f server/services/subscriptionService.js && echo "✅ SubscriptionService exists"
test -f server/services/planLimitsService.js && echo "✅ PlanLimitsService exists"

# Check controllers & routes
test -f server/controllers/subscriptionController.js && echo "✅ SubscriptionController exists"
test -f server/routes/subscriptionRoutes.js && echo "✅ SubscriptionRoutes exists"

# Check middleware
test -f server/middleware/subscription.js && echo "✅ Subscription middleware exists"
test -f server/middleware/tenantResolver.js && echo "✅ TenantResolver middleware exists"
test -f server/middleware/tenantContext.js && echo "✅ TenantContext middleware exists"

# Check config
test -f server/config/roles.js && echo "✅ Roles config exists"
test -f server/config/planLimits.js && echo "✅ Plan limits config exists"
```

### Step 2: Initialize Services in server.js
```javascript
// Top of server.js
import SubscriptionService from './services/subscriptionService.js';
import PlanLimitsService from './services/planLimitsService.js';
import { AuthRepository } from './modules/auth/repository.js';

// After app creation
const authRepository = new AuthRepository();
const subscriptionService = new SubscriptionService(authRepository);
const planLimitsService = new PlanLimitsService(authRepository);

// Before routes
app.use((req, res, next) => {
  req.subscriptionService = subscriptionService;
  req.planLimitsService = planLimitsService;
  next();
});
```

### Step 3: Apply Middleware in Correct Order
```javascript
// 1. Tenant detection (FIRST)
app.use(tenantResolverMiddleware);

// 2. Tenant context (SECOND)
app.use(tenantContextMiddleware);

// 3. Standard middleware
app.use(express.json());
app.use(cookieParser());

// 4. Routes
```

### Step 4: Import and Use Routes
```javascript
import subscriptionRoutes from './routes/subscriptionRoutes.js';

app.use('/api/subscriptions', subscriptionRoutes);
```

### Step 5: Create Subscription on Signup
```javascript
// In authController.js signup function
if (isFirstUser) {
  const subscriptionService = new SubscriptionService(authRepository);
  await subscriptionService.createSubscription({
    tenantId: tenant._id,
    plan: 'free',
    billingCycle: 'monthly'
  });
}
```

### Step 6: Add Plan Limit Checks
```javascript
// In noteController.js uploadNote
const canUpload = await req.planLimitsService.canUploadNote(req.tenant.id);
if (!canUpload) {
  return next(new AppError('Upload limit exceeded', 403));
}
```

---

## Testing Checklist

### Unit Tests (Controllers)
- [ ] Create subscription with valid plan
- [ ] Create subscription with invalid plan → error
- [ ] Get subscription status for active subscription
- [ ] Get subscription status when no subscription → null
- [ ] Renew subscription extends expiry date
- [ ] Upgrade plan updates features
- [ ] Cancel subscription marks as cancelled

### Integration Tests (Routes)
- [ ] POST /api/subscriptions → 201 (authenticated)
- [ ] POST /api/subscriptions → 401 (no auth)
- [ ] GET /api/subscriptions/status → 200 with data
- [ ] GET /api/subscriptions/feature/:name → 200 with availability
- [ ] POST /api/subscriptions/upgrade → 200 with upgraded subscription
- [ ] POST /api/subscriptions/cancel → 200 with cancelled status

### Middleware Tests
- [ ] tenantResolver sets req.tenant correctly
- [ ] tenantContext auto-filters queries by tenant
- [ ] verifySubscriptionActive blocks expired subscriptions
- [ ] checkSubscriptionFeature blocks unavailable features
- [ ] allowReadOnlyIfExpired allows GET, blocks POST
- [ ] requireTenantAdmin rejects non-admin users

### Plan Limits Tests
- [ ] canUploadNote returns false when limit exceeded
- [ ] canAddUser returns false at user limit
- [ ] canStoreFile returns false at storage limit
- [ ] addStorageUsage updates Institution.usedStorage
- [ ] getUsageStats returns correct percentages

### Multi-Tenant Tests
- [ ] User A cannot see User B's notes (different tenants)
- [ ] User A cannot cancel User B's subscription
- [ ] Each tenant has separate subscription
- [ ] Subscription limits per tenant (not global)

### Expiry Tests
- [ ] isExpired() returns true when past expiryDate
- [ ] getDaysRemaining() returns correct count
- [ ] Pre-save updates status to "expired" if past expiry
- [ ] markExpiredSubscriptions finds all expired subs

---

## Performance Considerations

### Database Indices
Ensure these indices exist:

```javascript
// Subscription model
db.subscriptions.createIndex({ tenantId: 1 });
db.subscriptions.createIndex({ status: 1, expiryDate: 1 });
db.subscriptions.createIndex({ expiryDate: 1 });

// Institution model
db.institutions.createIndex({ slug: 1 });

// User model
db.users.createIndex({ tenantId: 1, email: 1 });
db.users.createIndex({ tenantId: 1 });
```

### Caching Recommendations
- Cache subscription status (5 min TTL)
- Cache plan limits (24 hour TTL)
- Cache features list (24 hour TTL)
- Invalidate on subscription change

### Query Optimization
- Use `select()` to limit fields returned
- Use pagination for list endpoints
- Use lean() for read-only queries
- Populate only needed references

---

## Monitoring & Logging

### Key Metrics
- [ ] New subscriptions per day
- [ ] Plan upgrade/downgrade rates
- [ ] Churn rate per plan
- [ ] Feature adoption rates
- [ ] Revenue per plan
- [ ] Average subscription lifetime

### Alerts
- [ ] Subscription failed to create
- [ ] Payment webhook failed
- [ ] Subscription remained expired >24h
- [ ] High error rate on subscription endpoints
- [ ] Quota exceeded for storage/uploads

### Logs
```javascript
// Log subscription changes
subscriptionService.on('created', (sub) => logger.info('Subscription created', sub));
subscriptionService.on('renewed', (sub) => logger.info('Subscription renewed', sub));
subscriptionService.on('upgraded', (sub) => logger.info('Subscription upgraded', sub));
subscriptionService.on('expired', (sub) => logger.warn('Subscription expired', sub));
subscriptionService.on('cancelled', (sub) => logger.info('Subscription cancelled', sub));
```

---

## Rollout Plan

### Phase 1: Core Infrastructure (DONE)
- ✅ Models created
- ✅ Services created
- ✅ Controllers & routes created
- ✅ Documentation written

### Phase 2: Server Integration (NEXT)
- [ ] Initialize services in server.js
- [ ] Apply middleware chain
- [ ] Import routes
- [ ] Test locally

### Phase 3: Payment Integration (FUTURE)
- [ ] Razorpay webhook handling
- [ ] Plan pricing configuration
- [ ] Invoice generation
- [ ] Refund processing

### Phase 4: Automation (FUTURE)
- [ ] Scheduled jobs (mark expired, reminders)
- [ ] Email notifications
- [ ] Usage tracking

### Phase 5: Client Integration (FUTURE)
- [ ] Frontend subscription page
- [ ] Plan selection UI
- [ ] Billing dashboard
- [ ] Payment form

### Phase 6: Advanced Features (FUTURE)
- [ ] Proration calculations
- [ ] Coupon codes
- [ ] Usage-based billing
- [ ] Analytics dashboard

---

## Support & Troubleshooting

### Common Issues

**Issue: "Tenant not set in request"**
- Check tenantResolver middleware is applied FIRST
- Verify subdomain or x-tenant-id header is present
- Check Institution slug matches

**Issue: "No active subscription found"**
- Verify subscription exists for tenant
- Check subscription status is "active"
- Check subscription expiryDate is in future

**Issue: "All queries return empty"**
- Check tenantContext middleware is applied SECOND
- Verify tenantPlugin is imported in model
- Enable debug logging: `getTenantContext()`

**Issue: "Feature not available"**
- Check subscription features object
- Verify plan includes that feature
- Check subscription status is "active"

### Debug Mode

Enable debug logging:

```javascript
// server.js
process.env.DEBUG = 'notesmitra:*';

// In services
const debug = require('debug')('notesmitra:subscription');
debug('Creating subscription', { tenantId, plan });
```

---

## Next Steps for User

1. **Review** the three documentation files:
   - SUBSCRIPTION_SYSTEM_GUIDE.md
   - SERVER_INTEGRATION_GUIDE.md
   - SUBSCRIPTION_API_DOCS.md

2. **Test** locally by:
   - Following SERVER_INTEGRATION_GUIDE.md integration steps
   - Running test requests from SUBSCRIPTION_API_DOCS.md
   - Verifying middleware order is correct

3. **Implement** missing pieces:
   - Subscription creation on signup
   - Plan limit checks in noteController
   - Add tests for all endpoints

4. **Add** payment integration (Razorpay)

5. **Deploy** to production with monitoring

---

## Contact & Support

For issues or questions, refer to:
- SUBSCRIPTION_SYSTEM_GUIDE.md for overview
- SERVER_INTEGRATION_GUIDE.md for setup help
- SUBSCRIPTION_API_DOCS.md for endpoint documentation
- Code comments in controller/service files
