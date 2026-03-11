import express from 'express';
import * as subscriptionController from '../controllers/subscriptionController.js';
import { protect, requireTenantAdmin, requireSuperAdmin } from '../middleware/authz.js';
import { verifySubscriptionActive, checkSubscriptionFeature } from '../middleware/subscription.js';

const router = express.Router();

/**
 * Public Routes (Protected)
 */

// Get current subscription status
router.get('/status', protect, subscriptionController.getSubscriptionStatus);

// Get subscription details with features
router.get('/details', protect, subscriptionController.getSubscriptionDetails);

// Get subscription usage stats
router.get('/usage', protect, subscriptionController.getSubscriptionUsage);

// Check if specific feature is available
router.get('/feature/:featureName', protect, subscriptionController.checkFeatureAvailable);

// Check subscription validity
router.get('/valid', protect, subscriptionController.isSubscriptionValid);

// Create new subscription
router.post('/', protect, subscriptionController.createSubscription);

// Manual renewal
router.post('/renew', protect, subscriptionController.renewSubscription);

// Upgrade plan
router.post('/upgrade', protect, subscriptionController.upgradePlan);

// Cancel subscription
router.post('/cancel', protect, subscriptionController.cancelSubscription);

/**
 * Tenant Admin Routes
 */

// View subscription details (tenant admin)
router.get(
  '/admin/tenant',
  protect,
  requireTenantAdmin,
  subscriptionController.getSubscriptionDetails
);

/**
 * Super Admin Routes
 */

// Get all expiring subscriptions
router.get(
  '/admin/expiring',
  protect,
  requireSuperAdmin,
  subscriptionController.getExpiringSubscriptions
);

// Get all expired subscriptions
router.get(
  '/admin/expired',
  protect,
  requireSuperAdmin,
  subscriptionController.getExpiredSubscriptions
);

// Mark all expired subscriptions
router.post(
  '/admin/mark-expired',
  protect,
  requireSuperAdmin,
  subscriptionController.markExpiredSubscriptions
);

// Get subscription for specific tenant
router.get(
  '/admin/tenant/:tenantId',
  protect,
  requireSuperAdmin,
  subscriptionController.getSubscriptionForTenant
);

// Manually create subscription for tenant
router.post(
  '/admin/create-for-tenant',
  protect,
  requireSuperAdmin,
  subscriptionController.createSubscriptionForTenant
);

// Manually renew subscription for tenant
router.post(
  '/admin/renew/:tenantId',
  protect,
  requireSuperAdmin,
  subscriptionController.renewSubscriptionForTenant
);

export default router;
