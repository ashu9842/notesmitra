# Subscription System Guide

## Overview

Complete subscription management system for multi-tenant SaaS with:
- Subscription creation and renewal
- Expiry tracking and enforcement
- Feature gate per plan
- Automatic expiry detection
- Read-only mode for expired subscriptions

## Subscription Model

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `tenantId` | ObjectId | Reference to Institution |
| `plan` | String | free/pro/enterprise |
| `status` | String | active/expired/cancelled/pending/suspended |
| `startDate` | Date | Subscription start |
| `expiryDate` | Date | When subscription expires |
| `billingCycle` | String | monthly/quarterly/yearly |
| `price` | Number | Subscription cost |
| `features` | Object | Enabled features & limits |
| `autoRenew` | Boolean | Auto-renew on expiry |
| `paymentMethod` | String | Payment method used |
| `transactionId` | String | Payment processor reference |
| `cancelledAt` | Date | When cancelled |
| `cancellationReason` | String | Why cancelled |

### Features Object

```javascript
{
  maxUsers: 10,              // User limit
  maxUploads: 50,            // Upload limit
  storageLimit: 10,          // Storage in GB
  customBranding: false,     // Custom branding allowed
  advancedAnalytics: false,  // Advanced analytics
  prioritySupport: false,    // Priority support
  apiAccess: false,          // API access
  sso: false,                // Single sign-on
  dataResidency: false       // Data residency options
}
```

## Subscription Service

### Methods

#### Create Subscription
```javascript
const subscription = await subscriptionService.createSubscription({
  tenantId: ObjectId,
  plan: 'pro',
  billingCycle: 'monthly',
  price: 9999,
  paymentMethod: 'stripe',
  transactionId: 'txn_123'
});
```

#### Renew Subscription
```javascript
const renewed = await subscriptionService.renewSubscription(tenantId);
// Extends by one billing cycle
```

#### Check Active Subscription
```javascript
const isValid = await subscriptionService.isSubscriptionValid(tenantId);
// Returns boolean
```

#### Get Subscription Status
```javascript
const status = await subscriptionService.getSubscriptionStatus(tenantId);
// Returns: { status, plan, daysRemaining, renewalDate, message }
```

#### Get Expiring Subscriptions
```javascript
const expiring = await subscriptionService.getExpiringSubscriptions(7);
// Returns subscriptions expiring within 7 days
```

#### Mark Expired
```javascript
const count = await subscriptionService.markExpiredSubscriptions();
// Finds and marks all expired subscriptions
```

#### Upgrade Plan
```javascript
const upgraded = await subscriptionService.upgradeSubscription(tenantId, 'enterprise');
// Upgrades plan, updates features and Institution
```

#### Get Usage
```javascript
const details = await subscriptionService.getSubscriptionDetails(tenantId);
// Returns full subscription info with features
```

## Middleware

### Verify Active Subscription

Block access entirely if subscription expired:
```javascript
import { verifySubscriptionActive } from '../middleware/subscription.js';

router.get('/api/notes', 
  protect,
  verifySubscriptionActive,  // ← Blocks if not active
  getNotes
);
```

**Error Response:**
```json
{
  "success": false,
  "message": "Subscription expired. Subscription expired on 2024-02-15T00:00:00Z",
  "code": "SUBSCRIPTION_INVALID",
  "subscriptionStatus": {
    "status": "expired",
    "expiryDate": "2024-02-15T00:00:00Z",
    "daysExpired": 8
  }
}
```

### Check Feature

Block if specific feature not enabled:
```javascript
import { checkSubscriptionFeature } from '../middleware/subscription.js';

router.get('/api/analytics', 
  protect,
  checkSubscriptionFeature('advancedAnalytics'),  // ← Check feature
  getAnalytics
);
```

### Expiry Warning

Add header if expiring soon:
```javascript
import { subscriptionExpiryWarning } from '../middleware/subscription.js';

router.get('/api/dashboard',
  protect,
  subscriptionExpiryWarning,  // ← Adds X-Subscription-Warning header
  getDashboard
);

// Client gets header: "X-Subscription-Warning: Your subscription expires in 3 days"
```

### Allow Read-Only

Allow GET requests for expired subscriptions:
```javascript
import { allowReadOnlyIfExpired } from '../middleware/subscription.js';

router.use('/api/data', allowReadOnlyIfExpired);  // ← GET works, POST fails

// POST fails with:
// {
//   "success": false,
//   "message": "Subscription expired or not found. Read-only mode active.",
//   "code": "SUBSCRIPTION_EXPIRED",
//   "readOnly": true
// }
```

## Integration Steps

### Step 1: Initialize Service

```javascript
import { AuthRepository } from './modules/auth/repository.js';
import SubscriptionService from './services/subscriptionService.js';

const authRepository = new AuthRepository();
const subscriptionService = new SubscriptionService(authRepository);

// Attach to request middleware
app.use((req, res, next) => {
  req.subscriptionService = subscriptionService;
  next();
});
```

### Step 2: Protect Routes

```javascript
import { protect } from '../middleware/authz.js';
import { verifySubscriptionActive } from '../middleware/subscription.js';

// All protected routes
router.use(protect, verifySubscriptionActive);

// OR selective protection
router.post('/api/notes', 
  protect,
  verifySubscriptionActive,
  uploadNote
);
```

### Step 3: In Controllers

#### Create Subscription (Payment Success)
```javascript
export const createSubscription = async (req, res) => {
  try {
    const { tenantId, plan, billingCycle, price, transactionId } = req.body;

    const subscription = await req.subscriptionService.createSubscription({
      tenantId,
      plan,
      billingCycle,
      price,
      paymentMethod: 'stripe',
      transactionId
    });

    res.status(201).json({ success: true, subscription });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
```

#### Check Subscription Status (Dashboard)
```javascript
export const getSubscriptionStatus = async (req, res) => {
  try {
    const details = await req.subscriptionService.getSubscriptionDetails(req.tenant.id);
    res.json({ success: true, subscription: details });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};
```

#### Renew Subscription (Manual)
```javascript
export const renewSubscription = async (req, res) => {
  try {
    const subscription = await req.subscriptionService.renewSubscription(req.tenant.id);
    res.json({ success: true, subscription });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
```

## Usage Example: Complete Flow

### 1. User Signs Up → Gets Free Plan
```javascript
// signup creates free subscription automatically
```

### 2. User Wants to Upgrade
```javascript
POST /api/subscriptions/upgrade
{
  "plan": "pro",
  "billingCycle": "monthly"
}

// Backend:
// 1. Process payment
// 2. Create subscription
// 3. Update Institution with limits
// 4. Return subscription details
```

### 3. User Tries to Upload When Free Plan Exceeded
```javascript
POST /api/notes
{
  "title": "...",
  "file": {...}
}

// Flow:
// 1. protect middleware → user authenticated
// 2. verifySubscriptionActive → subscription valid
// 3. checkUploadLimit → free plan allows 50, but has 50 → FAIL
// 4. Error: "Upload limit exceeded. Your free plan allows 50 uploads."
```

### 4. Subscription Expiry Handling

#### Schedule Job (runs daily)
```javascript
import cron from 'node-cron';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  const count = await subscriptionService.markExpiredSubscriptions();
  console.log(`Marked ${count} subscriptions as expired`);
});
```

#### User Tries Access After Expiry
```javascript
GET /api/notes
// Error: "Subscription expired. Subscription expired on 2024-02-15T00:00:00Z"
```

## Feature Gating

### Check Feature in Middleware
```javascript
router.get('/api/analytics/advanced',
  protect,
  checkSubscriptionFeature('advancedAnalytics'),  // Pro+ only
  getAdvancedAnalytics
);
```

### Check Feature in Controller
```javascript
export const getAnalytics = async (req, res) => {
  const subscription = await req.subscriptionService.getActiveSubscription(req.tenant.id);
  
  const canUseAdvanced = subscription?.features?.advancedAnalytics;
  
  if (!canUseAdvanced) {
    return res.status(403).json({
      message: 'Advanced analytics available in Pro plan'
    });
  }
  
  // Return advanced data
};
```

## Monitoring & Alerts

### Check Expiring Subscriptions
```javascript
export const getExpiringSubscriptions = async (req, res) => {
  const expiring = await req.subscriptionService.getExpiringSubscriptions(7);
  
  // Send reminders
  for (const sub of expiring) {
    await sendReminderEmail(sub.tenantId, sub.expiryDate);
  }
  
  res.json({ count: expiring.length, subscriptions: expiring });
};
```

## Database Indices

Subscriptions uses these indices for performance:
- `expiryDate + status` - Query expiring subscriptions
- `tenantId + status` - Find tenant's active subscription
- `createdAt desc` - List subscriptions by date

## Error Codes

| Code | Meaning |
|------|---------|
| `SUBSCRIPTION_INVALID` | Subscription missing or expired |
| `NO_ACTIVE_SUBSCRIPTION` | No active subscription found |
| `FEATURE_NOT_AVAILABLE` | Feature not in plan |
| `SUBSCRIPTION_EXPIRED` | Read-only mode active |
| `SUBSCRIPTION_CHECK_ERROR` | Service error |

## Plan Comparison

```javascript
// Free Plan
{
  maxUsers: 10,
  maxUploads: 50,
  storageLimit: 10,
  features: { customBranding: false, advancedAnalytics: false }
}

// Pro Plan
{
  maxUsers: 100,
  maxUploads: 500,
  storageLimit: 100,
  features: { customBranding: true, advancedAnalytics: true }
}

// Enterprise Plan
{
  maxUsers: 1000,
  maxUploads: 10000,
  storageLimit: 1000,
  features: { all: true, sso: true, dataResidency: true }
}
```

## Key Features

✅ **Time-based Expiry**: Automatic enforcement of expiration dates  
✅ **Feature Gating**: Enable/disable features per plan  
✅ **Auto-renewal**: Support for automatic renewal  
✅ **Read-only Mode**: Allow viewing expired subscriptions  
✅ **Multi-tenant**: Each tenant has own subscription  
✅ **Plan Upgrades**: Seamless plan changes  
✅ **Usage Tracking**: Track subscription usage  
✅ **Alerts**: Expiry warnings and monitoring  
