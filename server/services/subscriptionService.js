/**
 * Subscription Service
 * Manages subscription creation, renewal, expiry checks
 */
import Subscription from '../models/Subscription.js';
import { PLAN_LIMITS } from '../config/planLimits.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

export class SubscriptionService {
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * Create new subscription for tenant
   */
  async createSubscription({
    tenantId,
    plan,
    billingCycle = 'monthly',
    price,
    paymentMethod,
    transactionId
  }) {
    const limits = PLAN_LIMITS[plan];
    if (!limits) {
      throw new AppError(`Invalid plan: ${plan}`, 400);
    }

    // Check if subscription already exists
    const existing = await Subscription.findOne({ tenantId });
    if (existing && existing.isActive()) {
      throw new AppError('Active subscription already exists for this tenant', 409);
    }

    // Calculate dates
    const startDate = new Date();
    const expiryDate = this._calculateExpiryDate(startDate, billingCycle);

    const subscription = await Subscription.create({
      tenantId,
      plan,
      status: 'active',
      startDate,
      expiryDate,
      billingCycle,
      price,
      paymentMethod,
      transactionId,
      features: {
        maxUsers: limits.maxUsers,
        maxUploads: limits.maxUploads,
        storageLimit: limits.storageLimit,
        ...limits.features
      },
      autoRenew: true
    });

    // Update Institution with subscription details
    await this.repository.updateInstitution(tenantId, {
      plan,
      maxUsers: limits.maxUsers,
      maxUploads: limits.maxUploads,
      storageLimit: limits.storageLimit,
      subscriptionId: subscription._id,
      subscriptionExpiry: expiryDate
    });

    logger.info(`Subscription created: ${tenantId}, plan: ${plan}`);

    return subscription;
  }

  /**
   * Renew subscription
   */
  async renewSubscription(tenantId) {
    const subscription = await Subscription.findOne({ tenantId });
    if (!subscription) {
      throw new AppError('No subscription found', 404);
    }

    const newStartDate = new Date(subscription.expiryDate);
    const newExpiryDate = this._calculateExpiryDate(newStartDate, subscription.billingCycle);

    const renewed = await Subscription.findByIdAndUpdate(
      subscription._id,
      {
        startDate: newStartDate,
        expiryDate: newExpiryDate,
        status: 'active',
        updatedAt: new Date()
      },
      { new: true }
    );

    logger.info(`Subscription renewed: ${tenantId}, new expiry: ${newExpiryDate}`);

    return renewed;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(tenantId, reason) {
    const subscription = await Subscription.findOne({ tenantId });
    if (!subscription) {
      throw new AppError('No subscription found', 404);
    }

    const cancelled = await Subscription.findByIdAndUpdate(
      subscription._id,
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        autoRenew: false,
        updatedAt: new Date()
      },
      { new: true }
    );

    logger.warn(`Subscription cancelled: ${tenantId}, reason: ${reason}`);

    return cancelled;
  }

  /**
   * Get current active subscription
   */
  async getActiveSubscription(tenantId) {
    const subscription = await Subscription.findOne({
      tenantId,
      status: 'active'
    });

    if (!subscription) {
      return null;
    }

    // Check if expired
    if (subscription.isExpired()) {
      await Subscription.findByIdAndUpdate(
        subscription._id,
        { status: 'expired', updatedAt: new Date() }
      );
      return null;
    }

    return subscription;
  }

  /**
   * Check if subscription is valid & active
   */
  async isSubscriptionValid(tenantId) {
    const subscription = await this.getActiveSubscription(tenantId);
    return !!subscription;
  }

  /**
   * Get subscription status
   */
  async getSubscriptionStatus(tenantId) {
    const subscription = await Subscription.findOne({ tenantId });
    if (!subscription) {
      return {
        status: 'no_subscription',
        message: 'No subscription found'
      };
    }

    if (subscription.isExpired()) {
      return {
        status: 'expired',
        expiryDate: subscription.expiryDate,
        daysExpired: Math.ceil(
          (new Date() - subscription.expiryDate) / (1000 * 60 * 60 * 24)
        ),
        message: `Subscription expired on ${subscription.expiryDate.toISOString()}`
      };
    }

    return {
      status: 'active',
      plan: subscription.plan,
      expiryDate: subscription.expiryDate,
      daysRemaining: subscription.getDaysRemaining(),
      renewalDate: subscription.getRenewalDate(),
      autoRenew: subscription.autoRenew,
      message: `Active until ${subscription.expiryDate.toISOString()}`
    };
  }

  /**
   * Get subscriptions expiring soon (within days)
   */
  async getExpiringSubscriptions(daysUntil = 7) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysUntil * 24 * 60 * 60 * 1000);

    return Subscription.find({
      status: 'active',
      expiryDate: {
        $gte: now,
        $lte: futureDate
      }
    }).sort({ expiryDate: 1 });
  }

  /**
   * Get expired subscriptions to process
   */
  async getExpiredSubscriptions() {
    const now = new Date();

    return Subscription.find({
      status: 'active',
      expiryDate: { $lt: now }
    });
  }

  /**
   * Mark subscriptions as expired
   */
  async markExpiredSubscriptions() {
    const expired = await this.getExpiredSubscriptions();

    for (const subscription of expired) {
      await Subscription.findByIdAndUpdate(
        subscription._id,
        { status: 'expired', updatedAt: new Date() }
      );

      // Deactivate institution or set to free tier
      await this.repository.updateInstitution(subscription.tenantId, {
        subscriptionStatus: 'expired'
      });

      logger.warn(`Marked subscription as expired: ${subscription.tenantId}`);
    }

    return expired.length;
  }

  /**
   * Upgrade subscription plan
   */
  async upgradeSubscription(tenantId, newPlan) {
    const subscription = await Subscription.findOne({ tenantId });
    if (!subscription) {
      throw new AppError('No subscription found', 404);
    }

    const newLimits = PLAN_LIMITS[newPlan];
    if (!newLimits) {
      throw new AppError(`Invalid plan: ${newPlan}`, 400);
    }

    const upgraded = await Subscription.findByIdAndUpdate(
      subscription._id,
      {
        plan: newPlan,
        'features.maxUsers': newLimits.maxUsers,
        'features.maxUploads': newLimits.maxUploads,
        'features.storageLimit': newLimits.storageLimit,
        ...newLimits.features,
        updatedAt: new Date()
      },
      { new: true }
    );

    // Update Institution
    await this.repository.updateInstitution(tenantId, {
      plan: newPlan,
      maxUsers: newLimits.maxUsers,
      maxUploads: newLimits.maxUploads,
      storageLimit: newLimits.storageLimit
    });

    logger.info(`Subscription upgraded: ${tenantId}, new plan: ${newPlan}`);

    return upgraded;
  }

  /**
   * Get subscription usage details
   */
  async getSubscriptionDetails(tenantId) {
    const subscription = await Subscription.findOne({ tenantId });
    if (!subscription) {
      throw new AppError('No subscription found', 404);
    }

    const daysRemaining = subscription.isActive() ? subscription.getDaysRemaining() : 0;

    return {
      plan: subscription.plan,
      status: subscription.status,
      startDate: subscription.startDate,
      expiryDate: subscription.expiryDate,
      daysRemaining,
      renewalDate: subscription.getRenewalDate(),
      billingCycle: subscription.billingCycle,
      price: subscription.price,
      autoRenew: subscription.autoRenew,
      features: subscription.features,
      paymentMethod: subscription.paymentMethod,
      transactionId: subscription.transactionId,
      cancelledAt: subscription.cancelledAt,
      cancellationReason: subscription.cancellationReason
    };
  }

  /**
   * Calculate expiry date based on billing cycle
   */
  _calculateExpiryDate(startDate, billingCycle) {
    const expiryDate = new Date(startDate);

    if (billingCycle === 'monthly') {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    } else if (billingCycle === 'quarterly') {
      expiryDate.setMonth(expiryDate.getMonth() + 3);
    } else if (billingCycle === 'yearly') {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    return expiryDate;
  }
}

export default SubscriptionService;
