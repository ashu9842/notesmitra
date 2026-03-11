/**
 * Plan Limits Configuration
 * Defines hard limits for each subscription plan
 */

export const PLAN_LIMITS = {
  free: {
    name: 'Free',
    maxUsers: 10,
    maxUploads: 50,
    storageLimit: 10, // GB
    features: {
      customBranding: false,
      advancedAnalytics: false,
      prioritySupport: false,
      apiAccess: false
    }
  },
  pro: {
    name: 'Professional',
    maxUsers: 100,
    maxUploads: 500,
    storageLimit: 100, // GB
    features: {
      customBranding: true,
      advancedAnalytics: true,
      prioritySupport: true,
      apiAccess: true
    }
  },
  enterprise: {
    name: 'Enterprise',
    maxUsers: 1000,
    maxUploads: 10000,
    storageLimit: 1000, // GB
    features: {
      customBranding: true,
      advancedAnalytics: true,
      prioritySupport: true,
      apiAccess: true,
      sso: true,
      dataResidency: true
    }
  }
};

/**
 * Get plan limits for a subscription plan
 */
export const getPlanLimits = (plan) => {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
};

/**
 * Check if plan has feature
 */
export const hasFeature = (plan, feature) => {
  const limits = getPlanLimits(plan);
  return limits.features[feature] || false;
};

export default PLAN_LIMITS;
