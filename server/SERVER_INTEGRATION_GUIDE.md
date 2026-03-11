# Server Integration Guide

This guide explains how to integrate the subscription and plan limits systems into your Express server.

## Overview

The system consists of three main components:

1. **Subscription Service** - Manages subscription lifecycle, expiry, features
2. **Plan Limits Service** - Enforces usage limits per plan
3. **Routes & Middleware** - HTTP endpoints and protection layers

## Integration Steps

### Step 1: Import Required Modules

Add these imports to the top of your `server.js`:

```javascript
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// ===== NEW: Import services and routes =====
import { AuthRepository } from './modules/auth/repository.js';
import SubscriptionService from './services/subscriptionService.js';
import PlanLimitsService from './services/planLimitsService.js';

// Import routes
import subscriptionRoutes from './routes/subscriptionRoutes.js';

// Import middleware
import tenantResolverMiddleware from './middleware/tenantResolver.js';
import tenantContextMiddleware from './middleware/tenantContext.js';
import { protect, requireSuperAdmin, requireTenantAdmin, requireRole } from './middleware/authz.js';
import errorHandler from './middleware/error.js';

// Import other existing routes
import authRoutes from './routes/authRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import razorpayRoutes from './routes/razorpayRoutes.js';
```

### Step 2: Initialize Services

Add this code after creating your Express app:

```javascript
const app = express();

// Middleware configuration
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// ===== NEW: Initialize services =====
const authRepository = new AuthRepository();
const subscriptionService = new SubscriptionService(authRepository);
const planLimitsService = new PlanLimitsService(authRepository);

// ===== NEW: Attach services to request =====
app.use((req, res, next) => {
  req.subscriptionService = subscriptionService;
  req.planLimitsService = planLimitsService;
  next();
});
```

### Step 3: Apply Middleware in Correct Order

**CRITICAL: Middleware order matters!**

```javascript
// ===== STEP 1: Tenant Detection =====
app.use(tenantResolverMiddleware);
// After this: req.tenant is available with { id, slug, name, plan, maxUsers, storageLimit, source }

// ===== STEP 2: Tenant Context for queries =====
app.use(tenantContextMiddleware);
// After this: all queries auto-filtered by tenantId

// ===== STEP 3: CORS & other middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ===== STEP 4: Public routes (no auth required) =====
app.use('/api/auth', authRoutes);

// ===== STEP 5: Protected routes (auth required) =====
// These automatically check subscription via verifySubscriptionActive middleware

app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notes', protect, noteRoutes);
app.use('/api/payments', protect, paymentRoutes);
app.use('/api/tickets', protect, ticketRoutes);
app.use('/api/wallet', protect, walletRoutes);

// ===== STEP 6: Admin routes (super admin required) =====
app.use('/api/admin', protect, requireSuperAdmin, adminRoutes);
app.use('/api/razorpay', protect, requireSuperAdmin, razorpayRoutes);

// ===== STEP 7: Error handling =====
app.use(errorHandler);
```

### Step 4: Add Service Initialization to Controllers

When creating new institutions/users, initialize subscription:

```javascript
// In authController.js - signup handler
import SubscriptionService from '../services/subscriptionService.js';

export const signup = async (req, res, next) => {
  try {
    // ... existing signup logic ...

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      tenantId: tenant._id,
      isTenantAdmin: isFirstUser
    });

    // ===== NEW: Create free subscription for new institution =====
    if (isFirstUser) {
      const subscriptionService = new SubscriptionService(authRepository);
      await subscriptionService.createSubscription({
        tenantId: tenant._id,
        plan: 'free',
        billingCycle: 'monthly',
        price: 0,
        paymentMethod: 'system',
        transactionId: null
      });
    }

    res.status(201).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};
```

## Middleware Integration Examples

### Using Subscription Verification

```javascript
// In your route handlers
import { verifySubscriptionActive } from '../middleware/subscription.js';

// Protect all note endpoints
router.use(protect, verifySubscriptionActive);

// OR selective protection
router.get('/my-notes', protect, verifySubscriptionActive, getNotes);

// OR with feature checking
import { checkSubscriptionFeature } from '../middleware/subscription.js';

router.get('/analytics', 
  protect, 
  verifySubscriptionActive,
  checkSubscriptionFeature('advancedAnalytics'),
  getAnalytics
);
```

### Using Plan Limits

```javascript
// In noteController.js
import { planLimitsService } from '../services/planLimitsService.js';

export const uploadNote = async (req, res, next) => {
  try {
    // ===== Check upload limit in controller =====
    const canUpload = await req.planLimitsService.canUploadNote(req.tenant.id);
    if (!canUpload) {
      return next(new AppError('Upload limit exceeded for your plan', 403));
    }

    // ... create note ...

    // ===== Track storage usage =====
    await req.planLimitsService.addStorageUsage(
      req.tenant.id,
      fileSize // in MB
    );

    res.status(201).json({ success: true, note });
  } catch (error) {
    next(error);
  }
};
```

## Example: Complete Route Handler

```javascript
// controllers/noteController.js
import Note from '../models/Note.js';
import AppError from '../utils/appError.js';

export const getNotes = async (req, res, next) => {
  try {
    // Middleware already verified:
    // - User is authenticated (protect)
    // - Subscription is active (verifySubscriptionActive)
    // - Tenant is set (tenantResolver)
    // - Query auto-scoped to tenant (tenantPlugin)

    const notes = await Note.find({ tenantId: req.tenant.id })
      .populate('createdBy', 'email name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      notes,
      count: notes.length
    });
  } catch (error) {
    next(error);
  }
};

export const uploadNote = async (req, res, next) => {
  try {
    // Check plan limits BEFORE creating
    const canUpload = await req.planLimitsService.canUploadNote(req.tenant.id);
    if (!canUpload) {
      return next(new AppError('Upload limit exceeded for your plan', 403));
    }

    // Create note
    const note = await Note.create({
      ...req.body,
      tenantId: req.tenant.id,
      createdBy: req.user._id
    });

    // Update storage usage
    const fileSizeMB = req.body.fileSize / (1024 * 1024);
    await req.planLimitsService.addStorageUsage(req.tenant.id, fileSizeMB);

    res.status(201).json({
      success: true,
      message: 'Note uploaded successfully',
      note
    });
  } catch (error) {
    next(error);
  }
};
```

## Complete server.js Template

Here's a complete working example:

```javascript
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config/.env' });

// ===== Services =====
import { AuthRepository } from './modules/auth/repository.js';
import SubscriptionService from './services/subscriptionService.js';
import PlanLimitsService from './services/planLimitsService.js';

// ===== Middleware =====
import tenantResolverMiddleware from './middleware/tenantResolver.js';
import tenantContextMiddleware from './middleware/tenantContext.js';
import { protect, requireSuperAdmin } from './middleware/authz.js';
import errorHandler from './middleware/error.js';

// ===== Routes =====
import authRoutes from './routes/authRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import walletRoutes from './routes/walletRoutes.js';

const app = express();

// ===== Initialize Services =====
const authRepository = new AuthRepository();
const subscriptionService = new SubscriptionService(authRepository);
const planLimitsService = new PlanLimitsService(authRepository);

// ===== Attach services to request =====
app.use((req, res, next) => {
  req.subscriptionService = subscriptionService;
  req.planLimitsService = planLimitsService;
  next();
});

// ===== Middleware Order (CRITICAL!) =====

// 1. Tenant detection (from subdomain/header)
app.use(tenantResolverMiddleware);

// 2. Tenant context (auto-filter queries)
app.use(tenantContextMiddleware);

// 3. Parse request
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// 4. CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// ===== Routes =====

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notes', protect, noteRoutes);
app.use('/api/payments', protect, paymentRoutes);
app.use('/api/tickets', protect, ticketRoutes);
app.use('/api/wallet', protect, walletRoutes);

// Admin routes
app.use('/api/admin', protect, requireSuperAdmin, adminRoutes);

// ===== Error handling =====
app.use(errorHandler);

// ===== Database Connection =====
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Tenant resolver: subdomain + header support enabled`);
  console.log(`Subscription system: active`);
  console.log(`Plan limits: enforced`);
});

export default app;
```

## Database Connection

The AuthRepository expects these environment variables:

```env
MONGODB_URI=mongodb://localhost:27017/notesmitra
NODE_ENV=development
PORT=5000
```

## Verification Checklist

After integration, verify:

- [ ] Services initialize without errors
- [ ] Middleware order is correct
- [ ] Subscription created for new institutions
- [ ] Plan limits enforced (try exceeding upload limit)
- [ ] Subscription expiry blocks access
- [ ] Tenant isolation works (can't see other tenant's data)
- [ ] Superadmin endpoints accessible only to superadmins
- [ ] Feature gates work (e.g., analytics requires feature)

## Testing

```bash
# Start server
npm start

# Test subscription creation
curl -X POST http://localhost:5000/api/subscriptions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "pro",
    "billingCycle": "monthly"
  }'

# Test subscription status
curl -X GET http://localhost:5000/api/subscriptions/status \
  -H "Authorization: Bearer TOKEN"

# Test plan limits
curl -X GET http://localhost:5000/api/subscriptions/usage \
  -H "Authorization: Bearer TOKEN"
```

## Common Issues

### Issue: Service is undefined in controller

**Solution**: Make sure services are initialized BEFORE routes are applied:

```javascript
// ✅ Correct order
const subscriptionService = new SubscriptionService(authRepository);
app.use((req, res, next) => {
  req.subscriptionService = subscriptionService;
  next();
});
app.use('/api/subscriptions', subscriptionRoutes);

// ❌ Wrong order
app.use('/api/subscriptions', subscriptionRoutes);
const subscriptionService = new SubscriptionService(authRepository);
```

### Issue: Tenant not attached to request

**Solution**: Make sure tenantResolver middleware is applied FIRST:

```javascript
// ✅ Correct order
app.use(tenantResolverMiddleware);  // ← First
app.use(tenantContextMiddleware);   // ← Second
app.use(express.json());             // ← Third
app.use('/api/subscriptions', subscriptionRoutes);

// ❌ Wrong order
app.use(express.json());
app.use(tenantResolverMiddleware);
```

### Issue: All queries return empty

**Solution**: Tenant context might not be set. Verify tenantContextMiddleware is applied:

```javascript
// Add debug logging
app.use((req, res, next) => {
  console.log('Tenant:', req.tenant);
  next();
});
```

### Issue: Subscription service throws "No active subscription found"

**Solution**: Ensure subscription was created during signup. Check Institution record for subscriptionId.

## Next Steps

1. **Add Payment Integration**: Connect to Razorpay or Stripe
2. **Add Scheduled Jobs**: Mark expired subscriptions, send reminders
3. **Add Billing**: Create invoices on subscription creation
4. **Add Analytics**: Track subscription revenue and usage
5. **Add Webhooks**: Handle payment processor notifications
