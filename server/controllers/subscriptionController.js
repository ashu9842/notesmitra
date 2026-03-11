import AppError from '../utils/AppError.js';
import { authRepository } from '../modules/auth/repository.js';

/**
 * Create a new subscription
 * POST /api/subscriptions
 * Body: { plan, billingCycle, paymentMethod, transactionId }
 */
export const createSubscription = async (req, res, next) => {
  try {
    const { plan, billingCycle, paymentMethod, transactionId, price } = req.body;
    const tenantId = req.tenant.id;

    // Validate required fields
    if (!plan || !billingCycle) {
      return next(new AppError('Plan and billing cycle are required', 400));
    }

    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return next(new AppError('Invalid plan type', 400));
    }

    if (!['monthly', 'quarterly', 'yearly'].includes(billingCycle)) {
      return next(new AppError('Invalid billing cycle', 400));
    }

    // Create subscription via service
    const subscription = await req.subscriptionService.createSubscription({
      tenantId,
      plan,
      billingCycle,
      price: price || 0,
      paymentMethod: paymentMethod || 'manual',
      transactionId: transactionId || null
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      subscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current subscription status
 * GET /api/subscriptions/status
 */
export const getSubscriptionStatus = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;

    const status = await req.subscriptionService.getSubscriptionStatus(tenantId);

    if (!status) {
      return res.json({
        success: true,
        subscription: null,
        message: 'No active subscription found'
      });
    }

    res.json({
      success: true,
      subscription: status
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subscription details including usage and features
 * GET /api/subscriptions/details
 */
export const getSubscriptionDetails = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;

    const details = await req.subscriptionService.getSubscriptionDetails(tenantId);

    if (!details) {
      return res.json({
        success: true,
        subscription: null,
        message: 'No subscription found'
      });
    }

    res.json({
      success: true,
      subscription: details,
      tenant: {
        maxUsers: details.features.maxUsers,
        maxUploads: details.features.maxUploads,
        storageLimit: details.features.storageLimit
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subscription usage stats
 * GET /api/subscriptions/usage
 */
export const getSubscriptionUsage = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;

    const subscription = await req.subscriptionService.getActiveSubscription(tenantId);

    if (!subscription) {
      return next(new AppError('No active subscription found', 404));
    }

    // Get institution for usage tracking
    const institution = await authRepository.findInstitutionById(tenantId);

    res.json({
      success: true,
      usage: {
        plan: subscription.plan,
        status: subscription.status,
        limits: {
          maxUsers: subscription.features.maxUsers,
          maxUploads: subscription.features.maxUploads,
          storageLimit: subscription.features.storageLimit
        },
        current: {
          users: institution?.users?.length || 0,
          uploads: institution?.currentUploads || 0,
          storage: institution?.usedStorage || 0
        },
        percentage: {
          users: institution ? ((institution?.users?.length || 0) / subscription.features.maxUsers * 100).toFixed(2) : 0,
          uploads: institution ? ((institution?.currentUploads || 0) / subscription.features.maxUploads * 100).toFixed(2) : 0,
          storage: institution ? ((institution?.usedStorage || 0) / subscription.features.storageLimit * 100).toFixed(2) : 0
        },
        daysRemaining: subscription.getDaysRemaining(),
        renewalDate: subscription.getRenewalDate()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if specific plan feature is available
 * GET /api/subscriptions/feature/:featureName
 */
export const checkFeatureAvailable = async (req, res, next) => {
  try {
    const { featureName } = req.params;
    const tenantId = req.tenant.id;

    const subscription = await req.subscriptionService.getActiveSubscription(tenantId);

    if (!subscription) {
      return res.json({
        success: true,
        available: false,
        reason: 'No active subscription'
      });
    }

    const available = subscription.features[featureName] || false;

    res.json({
      success: true,
      feature: featureName,
      available,
      plan: subscription.plan,
      subscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Renew subscription (manual)
 * POST /api/subscriptions/renew
 */
export const renewSubscription = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;

    const subscription = await req.subscriptionService.renewSubscription(tenantId);

    res.json({
      success: true,
      message: 'Subscription renewed successfully',
      subscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upgrade subscription plan
 * POST /api/subscriptions/upgrade
 * Body: { plan, billingCycle }
 */
export const upgradePlan = async (req, res, next) => {
  try {
    const { plan } = req.body;
    const tenantId = req.tenant.id;

    if (!plan) {
      return next(new AppError('New plan is required', 400));
    }

    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return next(new AppError('Invalid plan type', 400));
    }

    const subscription = await req.subscriptionService.upgradeSubscription(tenantId, plan);

    res.json({
      success: true,
      message: `Plan upgraded to ${plan}`,
      subscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel subscription
 * POST /api/subscriptions/cancel
 * Body: { reason }
 */
export const cancelSubscription = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const tenantId = req.tenant.id;

    const subscription = await req.subscriptionService.cancelSubscription(
      tenantId,
      reason || 'No reason provided'
    );

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subscription validity
 * GET /api/subscriptions/valid
 */
export const isSubscriptionValid = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;

    const isValid = await req.subscriptionService.isSubscriptionValid(tenantId);

    res.json({
      success: true,
      valid: isValid
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [ADMIN] Get all expiring subscriptions
 * GET /api/subscriptions/admin/expiring?days=7
 */
export const getExpiringSubscriptions = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;

    const subscriptions = await req.subscriptionService.getExpiringSubscriptions(parseInt(days));

    res.json({
      success: true,
      days: parseInt(days),
      count: subscriptions.length,
      subscriptions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [ADMIN] Get all expired subscriptions
 * GET /api/subscriptions/admin/expired
 */
export const getExpiredSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await req.subscriptionService.getExpiredSubscriptions();

    res.json({
      success: true,
      count: subscriptions.length,
      subscriptions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [ADMIN] Mark all expired subscriptions
 * POST /api/subscriptions/admin/mark-expired
 */
export const markExpiredSubscriptions = async (req, res, next) => {
  try {
    const count = await req.subscriptionService.markExpiredSubscriptions();

    res.json({
      success: true,
      message: `Marked ${count} subscriptions as expired`,
      count
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [SUPERADMIN] Get subscription for specific tenant
 * GET /api/subscriptions/admin/tenant/:tenantId
 */
export const getSubscriptionForTenant = async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    const subscription = await req.subscriptionService.getActiveSubscription(tenantId);

    if (!subscription) {
      return res.json({
        success: true,
        subscription: null,
        message: 'No active subscription for this tenant'
      });
    }

    res.json({
      success: true,
      subscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [SUPERADMIN] Manually create subscription for tenant
 * POST /api/subscriptions/admin/create-for-tenant
 * Body: { tenantId, plan, billingCycle }
 */
export const createSubscriptionForTenant = async (req, res, next) => {
  try {
    const { tenantId, plan, billingCycle } = req.body;

    if (!tenantId || !plan || !billingCycle) {
      return next(new AppError('tenantId, plan, and billingCycle are required', 400));
    }

    const subscription = await req.subscriptionService.createSubscription({
      tenantId,
      plan,
      billingCycle,
      paymentMethod: 'manual',
      price: 0
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      subscription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [SUPERADMIN] Manually renew subscription for tenant
 * POST /api/subscriptions/admin/renew/:tenantId
 */
export const renewSubscriptionForTenant = async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    const subscription = await req.subscriptionService.renewSubscription(tenantId);

    res.json({
      success: true,
      message: 'Subscription renewed successfully',
      subscription
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createSubscription,
  getSubscriptionStatus,
  getSubscriptionDetails,
  getSubscriptionUsage,
  checkFeatureAvailable,
  renewSubscription,
  upgradePlan,
  cancelSubscription,
  isSubscriptionValid,
  getExpiringSubscriptions,
  getExpiredSubscriptions,
  markExpiredSubscriptions,
  getSubscriptionForTenant,
  createSubscriptionForTenant,
  renewSubscriptionForTenant
};
