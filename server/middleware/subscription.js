/**
 * Subscription Validation Middleware
 * Checks if tenant subscription is active before allowing operations
 */
import logger from '../utils/logger.js';

/**
 * Verify subscription is active
 * Blocks access if subscription expired or not found
 */
export const verifySubscriptionActive = async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context required',
        code: 'NO_TENANT'
      });
    }

    if (!req.subscriptionService) {
      return res.status(500).json({
        success: false,
        message: 'Subscription service not available',
        code: 'SERVICE_ERROR'
      });
    }

    // Check if subscription is valid
    const isValid = await req.subscriptionService.isSubscriptionValid(req.tenant.id);

    if (!isValid) {
      const status = await req.subscriptionService.getSubscriptionStatus(req.tenant.id);

      logger.warn(
        `Access denied - subscription ${status.status}: ${req.tenant.id}`
      );

      return res.status(403).json({
        success: false,
        message: `Subscription ${status.status}. ${status.message}`,
        code: 'SUBSCRIPTION_INVALID',
        subscriptionStatus: status
      });
    }

    next();
  } catch (error) {
    logger.error('Subscription verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying subscription',
      code: 'SUBSCRIPTION_CHECK_ERROR'
    });
  }
};

/**
 * Check subscription allows action
 * Optional: block only certain operations for expired subscriptions
 */
export const checkSubscriptionFeature = (feature) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required',
          code: 'NO_TENANT'
        });
      }

      if (!req.subscriptionService) {
        return res.status(500).json({
          success: false,
          message: 'Subscription service not available',
          code: 'SERVICE_ERROR'
        });
      }

      const subscription = await req.subscriptionService.getActiveSubscription(
        req.tenant.id
      );

      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'No active subscription or subscription expired',
          code: 'NO_ACTIVE_SUBSCRIPTION'
        });
      }

      // Check if feature is enabled in subscription
      if (subscription.features[feature] === false) {
        logger.warn(
          `Feature not available: ${feature} for tenant ${req.tenant.id}`
        );

        return res.status(403).json({
          success: false,
          message: `Feature '${feature}' not available in your ${subscription.plan} plan`,
          code: 'FEATURE_NOT_AVAILABLE'
        });
      }

      next();
    } catch (error) {
      logger.error('Feature check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking subscription features',
        code: 'FEATURE_CHECK_ERROR'
      });
    }
  };
};

/**
 * Warn if subscription expiring soon
 * Attaches warning to response header
 */
export const subscriptionExpiryWarning = async (req, res, next) => {
  try {
    if (!req.tenant || !req.subscriptionService) {
      return next();
    }

    const subscription = await req.subscriptionService.getActiveSubscription(
      req.tenant.id
    );

    if (subscription) {
      const daysRemaining = subscription.getDaysRemaining();

      if (daysRemaining <= 7) {
        res.set('X-Subscription-Warning', `Your subscription expires in ${daysRemaining} days`);
      }
    }

    next();
  } catch (error) {
    logger.error('Subscription warning error:', error);
    next();
  }
};

/**
 * Allow read-only access for expired subscriptions
 * Useful for viewing data but blocking uploads/edits
 */
export const allowReadOnlyIfExpired = async (req, res, next) => {
  try {
    if (!req.tenant || !req.subscriptionService) {
      return next();
    }

    const subscription = await req.subscriptionService.getActiveSubscription(
      req.tenant.id
    );

    if (!subscription) {
      // Check if we allow read-only
      if (req.method === 'GET' || req.method === 'HEAD') {
        // Allow read operations
        req.readOnlyMode = true;
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Subscription expired or not found. Read-only mode active.',
        code: 'SUBSCRIPTION_EXPIRED',
        readOnly: true
      });
    }

    next();
  } catch (error) {
    logger.error('Read-only check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking subscription status',
      code: 'SUBSCRIPTION_CHECK_ERROR'
    });
  }
};

export default {
  verifySubscriptionActive,
  checkSubscriptionFeature,
  subscriptionExpiryWarning,
  allowReadOnlyIfExpired
};
