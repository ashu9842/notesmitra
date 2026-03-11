# Subscription API Documentation

Complete API reference for the subscription system endpoints.

## Base URL
```
http://localhost:5000/api/subscriptions
```

## Authentication

All endpoints (except `/auth/*`) require Bearer token:

```bash
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Get Subscription Status

Get current subscription status for tenant.

**URL:** `GET /status`  
**Auth:** Required  
**Permissions:** Own tenant

**Response:**
```json
{
  "success": true,
  "subscription": {
    "_id": "507f1f77bcf86cd799439011",
    "tenantId": "507f1f77bcf86cd799439010",
    "plan": "pro",
    "status": "active",
    "startDate": "2024-01-01T00:00:00Z",
    "expiryDate": "2024-02-01T00:00:00Z",
    "billingCycle": "monthly",
    "daysRemaining": 15,
    "isActive": true,
    "features": {
      "maxUsers": 100,
      "maxUploads": 500,
      "storageLimit": 100,
      "advancedAnalytics": true,
      "customBranding": true
    }
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "subscription": null,
  "message": "No active subscription found"
}
```

---

### 2. Get Subscription Details

Get complete subscription info including features and usage.

**URL:** `GET /details`  
**Auth:** Required  
**Permissions:** Own tenant

**Response:**
```json
{
  "success": true,
  "subscription": {
    "_id": "507f1f77bcf86cd799439011",
    "plan": "pro",
    "status": "active",
    "features": {
      "maxUsers": 100,
      "maxUploads": 500,
      "storageLimit": 100,
      "advancedAnalytics": true,
      "customBranding": true,
      "prioritySupport": true,
      "apiAccess": false,
      "sso": false,
      "dataResidency": false
    },
    "daysRemaining": 15,
    "renewalDate": "2024-02-01T00:00:00Z",
    "autoRenew": true
  },
  "tenant": {
    "maxUsers": 100,
    "maxUploads": 500,
    "storageLimit": 100
  }
}
```

---

### 3. Get Subscription Usage

Get current usage stats against plan limits.

**URL:** `GET /usage`  
**Auth:** Required  
**Permissions:** Own tenant

**Response:**
```json
{
  "success": true,
  "usage": {
    "plan": "pro",
    "status": "active",
    "limits": {
      "maxUsers": 100,
      "maxUploads": 500,
      "storageLimit": 100
    },
    "current": {
      "users": 25,
      "uploads": 150,
      "storage": 45.5
    },
    "percentage": {
      "users": "25.00",
      "uploads": "30.00",
      "storage": "45.50"
    },
    "daysRemaining": 15,
    "renewalDate": "2024-02-01T00:00:00Z"
  }
}
```

---

### 4. Check Feature Available

Check if specific feature is enabled in subscription.

**URL:** `GET /feature/:featureName`  
**Auth:** Required  
**Permissions:** Own tenant

**Parameters:**
- `featureName` (string): Feature name (advancedAnalytics, customBranding, sso, apiAccess, etc.)

**Example:**
```bash
GET /feature/advancedAnalytics
```

**Response:**
```json
{
  "success": true,
  "feature": "advancedAnalytics",
  "available": true,
  "plan": "pro"
}
```

**Error Response:**
```json
{
  "success": true,
  "feature": "sso",
  "available": false,
  "message": "Feature not available in pro plan"
}
```

---

### 5. Check Subscription Validity

Check if subscription is currently valid/active.

**URL:** `GET /valid`  
**Auth:** Required  
**Permissions:** Own tenant

**Response:**
```json
{
  "success": true,
  "valid": true
}
```

---

### 6. Create Subscription

Create new subscription (usually after payment).

**URL:** `POST /`  
**Auth:** Required  
**Permissions:** Own tenant

**Body:**
```json
{
  "plan": "pro",
  "billingCycle": "monthly",
  "paymentMethod": "stripe",
  "transactionId": "txn_1234567890",
  "price": 9999
}
```

**Body Parameters:**
- `plan` (string, required): "free", "pro", or "enterprise"
- `billingCycle` (string, required): "monthly", "quarterly", or "yearly"
- `paymentMethod` (string, optional): Default "manual"
- `transactionId` (string, optional): Payment processor ID
- `price` (number, optional): Cost in cents. Default 0

**Response:**
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "subscription": {
    "_id": "507f1f77bcf86cd799439011",
    "tenantId": "507f1f77bcf86cd799439010",
    "plan": "pro",
    "status": "active",
    "startDate": "2024-01-01T00:00:00Z",
    "expiryDate": "2024-02-01T00:00:00Z",
    "billingCycle": "monthly",
    "price": 9999,
    "features": { ... }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Plan and billing cycle are required",
  "code": 400
}
```

---

### 7. Renew Subscription

Manually renew subscription (extend by one billing cycle).

**URL:** `POST /renew`  
**Auth:** Required  
**Permissions:** Own tenant

**Body:** None

**Response:**
```json
{
  "success": true,
  "message": "Subscription renewed successfully",
  "subscription": {
    "_id": "507f1f77bcf86cd799439011",
    "expiryDate": "2024-03-01T00:00:00Z",
    "daysRemaining": 45
  }
}
```

---

### 8. Upgrade Plan

Upgrade to higher tier plan.

**URL:** `POST /upgrade`  
**Auth:** Required  
**Permissions:** Own tenant

**Body:**
```json
{
  "plan": "enterprise"
}
```

**Body Parameters:**
- `plan` (string, required): "free", "pro", or "enterprise"

**Response:**
```json
{
  "success": true,
  "message": "Plan upgraded to enterprise",
  "subscription": {
    "plan": "enterprise",
    "features": {
      "maxUsers": 1000,
      "maxUploads": 10000,
      "storageLimit": 1000,
      "customBranding": true,
      "advancedAnalytics": true,
      "sso": true,
      "apiAccess": true,
      "dataResidency": true
    }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Invalid plan type",
  "code": 400
}
```

---

### 9. Cancel Subscription

Cancel current subscription.

**URL:** `POST /cancel`  
**Auth:** Required  
**Permissions:** Own tenant

**Body:**
```json
{
  "reason": "Too expensive"
}
```

**Body Parameters:**
- `reason` (string, optional): Cancellation reason

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "subscription": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "cancelled",
    "cancelledAt": "2024-01-15T10:30:00Z",
    "cancellationReason": "Too expensive"
  }
}
```

---

## Admin Endpoints

### 10. Get Expiring Subscriptions

Get all subscriptions expiring within N days.

**URL:** `GET /admin/expiring?days=7`  
**Auth:** Required  
**Permissions:** Super Admin

**Query Parameters:**
- `days` (number, optional): Days until expiry. Default 7

**Response:**
```json
{
  "success": true,
  "days": 7,
  "count": 3,
  "subscriptions": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "tenantId": "507f1f77bcf86cd799439010",
      "plan": "pro",
      "expiryDate": "2024-01-20T00:00:00Z",
      "daysRemaining": 5
    }
  ]
}
```

---

### 11. Get Expired Subscriptions

Get all expired subscriptions.

**URL:** `GET /admin/expired`  
**Auth:** Required  
**Permissions:** Super Admin

**Response:**
```json
{
  "success": true,
  "count": 5,
  "subscriptions": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "tenantId": "507f1f77bcf86cd799439010",
      "plan": "free",
      "status": "expired",
      "expiryDate": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 12. Mark Expired Subscriptions

Find and mark all expired subscriptions.

**URL:** `POST /admin/mark-expired`  
**Auth:** Required  
**Permissions:** Super Admin

**Body:** None

**Response:**
```json
{
  "success": true,
  "message": "Marked 12 subscriptions as expired",
  "count": 12
}
```

---

### 13. Get Subscription for Tenant

Get subscription for specific tenant.

**URL:** `GET /admin/tenant/:tenantId`  
**Auth:** Required  
**Permissions:** Super Admin

**URL Parameters:**
- `tenantId` (ObjectId): Tenant ID

**Response:**
```json
{
  "success": true,
  "subscription": {
    "_id": "507f1f77bcf86cd799439011",
    "plan": "pro",
    "status": "active",
    "features": { ... }
  }
}
```

---

### 14. Create Subscription for Tenant

Manually create subscription for specific tenant.

**URL:** `POST /admin/create-for-tenant`  
**Auth:** Required  
**Permissions:** Super Admin

**Body:**
```json
{
  "tenantId": "507f1f77bcf86cd799439010",
  "plan": "enterprise",
  "billingCycle": "yearly"
}
```

**Body Parameters:**
- `tenantId` (ObjectId, required): Tenant ID
- `plan` (string, required): "free", "pro", or "enterprise"
- `billingCycle` (string, required): "monthly", "quarterly", or "yearly"

**Response:**
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "subscription": { ... }
}
```

---

### 15. Renew Subscription for Tenant

Manually renew subscription for specific tenant.

**URL:** `POST /admin/renew/:tenantId`  
**Auth:** Required  
**Permissions:** Super Admin

**URL Parameters:**
- `tenantId` (ObjectId): Tenant ID

**Response:**
```json
{
  "success": true,
  "message": "Subscription renewed successfully",
  "subscription": { ... }
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (no token) |
| 403 | Forbidden (no permission) |
| 404 | Not found |
| 409 | Conflict (subscription already exists) |
| 500 | Server error |

---

## Plan Limits

### Free Plan
```json
{
  "maxUsers": 10,
  "maxUploads": 50,
  "storageLimit": 10,
  "features": {
    "customBranding": false,
    "advancedAnalytics": false,
    "prioritySupport": false,
    "apiAccess": false,
    "sso": false,
    "dataResidency": false
  }
}
```

### Pro Plan
```json
{
  "maxUsers": 100,
  "maxUploads": 500,
  "storageLimit": 100,
  "features": {
    "customBranding": true,
    "advancedAnalytics": true,
    "prioritySupport": true,
    "apiAccess": false,
    "sso": false,
    "dataResidency": false
  }
}
```

### Enterprise Plan
```json
{
  "maxUsers": 1000,
  "maxUploads": 10000,
  "storageLimit": 1000,
  "features": {
    "customBranding": true,
    "advancedAnalytics": true,
    "prioritySupport": true,
    "apiAccess": true,
    "sso": true,
    "dataResidency": true
  }
}
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "statusCode": 400,
  "details": {
    "field": "value"
  }
}
```

### Common Error Codes

| Code | Message |
|------|---------|
| SUBSCRIPTION_INVALID | Subscription missing or expired |
| NO_ACTIVE_SUBSCRIPTION | No active subscription found |
| FEATURE_NOT_AVAILABLE | Feature not available in plan |
| SUBSCRIPTION_EXPIRED | Subscription expired |
| INVALID_PLAN | Invalid plan type |
| INVALID_BILLING_CYCLE | Invalid billing cycle |
| UNAUTHORIZED | Not authenticated |
| FORBIDDEN | Insufficient permissions |

---

## Webhooks (Coming Soon)

- `subscription.created`
- `subscription.renewed`
- `subscription.upgraded`
- `subscription.expired`
- `subscription.cancelled`

---

## Examples

### Create Free Subscription
```bash
curl -X POST http://localhost:5000/api/subscriptions \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "free",
    "billingCycle": "monthly"
  }'
```

### Upgrade to Pro
```bash
curl -X POST http://localhost:5000/api/subscriptions/upgrade \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "pro"
  }'
```

### Check Analytics Feature
```bash
curl -X GET http://localhost:5000/api/subscriptions/feature/advancedAnalytics \
  -H "Authorization: Bearer eyJhbGc..."
```

### Get Usage Stats
```bash
curl -X GET http://localhost:5000/api/subscriptions/usage \
  -H "Authorization: Bearer eyJhbGc..."
```

### Cancel Subscription
```bash
curl -X POST http://localhost:5000/api/subscriptions/cancel \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Switching to competitor"
  }'
```

---

## Rate Limiting

Currently no rate limiting. Should be added in production:

- 100 requests per minute per user
- 1000 requests per minute per IP

---

## Caching Recommendations

For performance:

- Cache subscription status for 5 minutes
- Cache features list for 24 hours
- Cache plan limits for 24 hours
- Invalidate cache on subscription change

---

## Postman Collection

Download [Subscription API Postman Collection](./postman-collection.json)

---

## Changelog

### v1.0.0 (Current)
- Initial release
- Core subscription CRUD
- Plan management
- Expiry tracking
- Feature gating
- Admin endpoints
