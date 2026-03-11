import UserSubscription from '../models/UserSubscription.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import * as cache from '../utils/cache.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';

/**
 * @desc    Get available premium plans
 * @route   GET /api/premium/plans
 * @access  Public
 */
export const getAvailablePlans = async (req, res, next) => {
  try {
    const plans = [
      {
        type: 'free_buyer',
        name: 'Free Buyer',
        price: 0,
        currency: '₹',
        billingCycle: 'month',
        description: 'Basic access to all notes',
        features: [
          'Access to all notes',
          '7-page preview before purchase',
          'Pay 2% payment gateway fee',
          'Up to 10 bookmarks'
        ],
        isCurrent: req.user && req.user.subscriptionType === 'free_buyer'
      },
      {
        type: 'premium_buyer',
        name: 'Premium Buyer',
        price: 99,
        currency: '₹',
        billingCycle: 'month',
        description: 'Save money and get exclusive benefits',
        features: [
          'Zero payment gateway fee (save 2%!)',
          '24-hour early access to new notes',
          '5-10% exclusive discounts on all purchases',
          'Unlimited bookmarks',
          'Premium buyer badge',
          'Priority customer support'
        ],
        isCurrent: req.user && req.user.subscriptionType === 'premium_buyer'
      },
      {
        type: 'free_seller',
        name: 'Free Seller',
        price: 0,
        currency: '₹',
        billingCycle: 'month',
        description: 'Start selling your notes',
        features: [
          'Upload up to 5 notes/month',
          'Standard approval (3-5 days)',
          'Earn 80% on each sale',
          'Basic dashboard'
        ],
        isCurrent: req.user && req.user.subscriptionType === 'free_seller'
      },
      {
        type: 'premium_seller',
        name: 'Premium Seller',
        price: 99,
        currency: '₹',
        billingCycle: 'month',
        description: 'Boost your sales and reach more students',
        features: [
          'Unlimited note uploads',
          'Priority approval (24 hours)',
          'Featured visibility boost',
          'Advanced sales analytics',
          'Premium seller badge',
          'Increased discoverability'
        ],
        isCurrent: req.user && req.user.subscriptionType === 'premium_seller'
      },
      {
        type: 'combo',
        name: 'Combo Pack',
        price: 149,
        originalPrice: 198,
        savings: 49,
        currency: '₹',
        billingCycle: 'month',
        badge: 'BEST VALUE',
        description: 'Seller Premium + Buyer Premium Combined!',
        features: [
          'All Seller Premium Features:',
          '  • Unlimited uploads',
          '  • Priority 24hr approval',
          '  • Featured visibility',
          'All Buyer Premium Features:',
          '  • Zero payment fees',
          '  • 5-10% discounts',
          '  • Early access to notes'
        ],
        isCurrent: req.user && req.user.subscriptionType === 'combo'
      }
    ];

    res.status(200).json({
      success: true,
      data: plans
    });
  } catch (error) {
    logger.error('Error fetching premium plans', {
      error: error.message
    });
    next(error);
  }
};

/**
 * @desc    Get current user subscription
 * @route   GET /api/premium/my-subscription
 * @access  Private
 */
export const getMySubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const subscription = await UserSubscription.findOne({
      userId,
      status: 'active'
    });

    const user = await User.findById(userId).select(
      'subscriptionType isPremiumBuyer isPremiumSeller subscriptionExpiry monthlyUploadsCount bookmarksCount'
    );

    // Get usage stats
    const uploadLimit = await user.canUploadNote();
    const bookmarkLimit = user.canAddBookmark();

    res.status(200).json({
      success: true,
      data: {
        subscription: subscription || null,
        currentPlan: user.subscriptionType,
        isPremiumBuyer: user.isPremiumBuyer,
        isPremiumSeller: user.isPremiumSeller,
        expiryDate: user.subscriptionExpiry,
        usage: {
          uploads: {
            used: user.monthlyUploadsCount,
            limit: uploadLimit.remaining === -1 ? 'unlimited' : 5,
            canUpload: uploadLimit.canUpload
          },
          bookmarks: {
            used: user.bookmarksCount,
            limit: bookmarkLimit.remaining === -1 ? 'unlimited' : 10,
            canAdd: bookmarkLimit.canAdd
          }
        },
        benefits: {
          paymentGatewayFee: user.getPaymentGatewayFee(),
          discountRange: user.getDiscountRange()
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching user subscription', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * @desc    Subscribe to a premium plan
 * @route   POST /api/premium/subscribe
 * @access  Private
 * @body    { planType: 'premium_buyer'|'premium_seller'|'combo', billingCycle: 'monthly'|'quarterly'|'yearly' }
 */
export const subscribeToPlan = async (req, res, next) => {
  try {
    const { planType, billingCycle = 'monthly' } = req.body;
    const userId = req.user._id;
    const tenantId = req.user.tenantId;

    // Validate plan type
    const validPlans = ['premium_buyer', 'premium_seller', 'combo'];
    if (!validPlans.includes(planType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan type. Choose: premium_buyer, premium_seller, or combo'
      });
    }

    // Validate billing cycle
    const validCycles = ['monthly', 'quarterly', 'yearly'];
    if (!validCycles.includes(billingCycle)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid billing cycle. Choose: monthly, quarterly, or yearly'
      });
    }

    // Clean up any stale pending subscriptions for this user before creating a new one
    await UserSubscription.updateMany(
      { userId, tenantId, status: 'pending' },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Superseded by new subscription attempt' } }
    );

    // Check if user already has an active subscription
    const existingSubscription = await UserSubscription.findOne({
      userId,
      tenantId,
      status: 'active'
    });

    if (existingSubscription) {
      const now = new Date();
      if (now > existingSubscription.expiryDate) {
        // Subscription expired but status wasn't updated — auto-expire it and allow new subscription
        existingSubscription.status = 'expired';
        await existingSubscription.save();

        // Reset user premium flags
        const staleUser = await User.findById(userId);
        if (staleUser) {
          staleUser.isPremiumBuyer = false;
          staleUser.isPremiumSeller = false;
          staleUser.subscriptionType = 'free_buyer';
          staleUser.subscriptionExpiry = null;
          staleUser.currentSubscriptionId = null;
          await staleUser.save();
          await cache.del(`user:${userId}`);
        }
      } else if (existingSubscription.planType === planType) {
        return res.status(400).json({
          success: false,
          error: `You already have an active ${planType} subscription.`
        });
      } else {
        // Different plan — auto-cancel existing and allow upgrade
        existingSubscription.status = 'cancelled';
        existingSubscription.cancelledAt = new Date();
        existingSubscription.cancellationReason = `Upgraded to ${planType}`;
        existingSubscription.autoRenew = false;
        await existingSubscription.save();
      }
    }

    // Get plan configuration
    const planConfig = UserSubscription.getPlanConfig(planType);

    // Calculate expiry date based on billing cycle
    const startDate = new Date();
    const expiryDate = new Date();

    if (billingCycle === 'monthly') {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    } else if (billingCycle === 'quarterly') {
      expiryDate.setMonth(expiryDate.getMonth() + 3);
    } else if (billingCycle === 'yearly') {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    // Create subscription
    const subscription = await UserSubscription.create({
      tenantId,
      userId,
      planType,
      price: planConfig.price,
      status: 'pending', // pending until payment is confirmed
      startDate,
      expiryDate,
      billingCycle,
      features: planConfig.features,
      autoRenew: true
    });

    logger.info('User initiated premium subscription', {
      userId,
      planType,
      billingCycle,
      subscriptionId: subscription._id
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created. Please complete payment.',
      data: {
        subscriptionId: subscription._id,
        planType,
        price: planConfig.price,
        billingCycle,
        expiryDate,
        paymentRequired: planConfig.price > 0
      }
    });
  } catch (error) {
    logger.error('Error subscribing to plan', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * @desc    Activate subscription after payment
 * @route   POST /api/premium/activate/:subscriptionId
 * @access  Private
 * @body    { transactionId: string, paymentMethod: string }
 */
export const activateSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    let { transactionId, paymentMethod } = req.body;
    const userId = req.user._id;

    const tenantId = req.user.tenantId;

    const subscription = await UserSubscription.findOne({
      _id: subscriptionId,
      userId,
      tenantId,
      status: 'pending'
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found or already activated'
      });
    }

    // Handle wallet payment server-side
    if (paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return res.status(400).json({
          success: false,
          error: 'Wallet not found'
        });
      }
      if (wallet.balance < subscription.price) {
        return res.status(400).json({
          success: false,
          error: `Insufficient wallet balance. Required: ₹${subscription.price}, Available: ₹${wallet.balance.toFixed(2)}`
        });
      }
      const walletTxnId = `sub_${uuidv4()}`;
      wallet.balance -= subscription.price;
      wallet.transactions.unshift({
        id: walletTxnId,
        type: 'debit',
        amount: subscription.price,
        description: `Premium subscription: ${subscription.planType}`,
        status: 'completed',
        timestamp: new Date()
      });
      await wallet.save();
      await User.findByIdAndUpdate(userId, { walletBalance: wallet.balance });
      // Use the generated transaction ID
      transactionId = walletTxnId;
    }

    // Update subscription status
    subscription.status = 'active';
    subscription.transactionId = transactionId;
    subscription.paymentMethod = paymentMethod;
    await subscription.save();

    // Credit platform wallet with subscription revenue
    const platformUserId = config.platformUserId;
    if (platformUserId) {
      let platformWallet = await Wallet.findOne({ userId: platformUserId });
      if (!platformWallet) {
        platformWallet = await Wallet.create({
          userId: platformUserId,
          balance: 0,
          transactions: []
        });
      }
      platformWallet.balance += subscription.price;
      platformWallet.transactions.unshift({
        id: `sub_rev_${uuidv4()}`,
        type: 'credit',
        amount: subscription.price,
        description: `Premium Subscription — ${subscription.planType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} Plan (User: ${userId})`,
        status: 'completed',
        timestamp: new Date()
      });
      await platformWallet.save();
      await User.findByIdAndUpdate(platformUserId, { walletBalance: platformWallet.balance });
    }

    // Update user subscription info
    const user = await User.findById(userId);
    user.currentSubscriptionId = subscription._id;
    user.subscriptionType = subscription.planType;
    user.subscriptionExpiry = subscription.expiryDate;

    // Set premium flags based on plan
    if (subscription.planType === 'premium_buyer') {
      user.isPremiumBuyer = true;
      user.isPremiumSeller = false;
    } else if (subscription.planType === 'premium_seller') {
      user.isPremiumBuyer = false;
      user.isPremiumSeller = true;
    } else if (subscription.planType === 'combo') {
      user.isPremiumBuyer = true;
      user.isPremiumSeller = true;
    }

    await user.save();

    // Clear cache
    await cache.del(`user:${userId}`);

    logger.info('User premium subscription activated', {
      userId,
      subscriptionId: subscription._id,
      planType: subscription.planType
    });

    res.status(200).json({
      success: true,
      message: 'Subscription activated successfully!',
      data: {
        subscription: {
          id: subscription._id,
          planType: subscription.planType,
          status: subscription.status,
          expiryDate: subscription.expiryDate
        },
        benefits: {
          isPremiumBuyer: user.isPremiumBuyer,
          isPremiumSeller: user.isPremiumSeller,
          paymentGatewayFee: user.getPaymentGatewayFee(),
          discountRange: user.getDiscountRange()
        }
      }
    });
  } catch (error) {
    logger.error('Error activating subscription', {
      userId: req.user._id,
      subscriptionId: req.params.subscriptionId,
      error: error.message
    });
    next(error);
  }
};

/**
 * @desc    Cancel subscription
 * @route   POST /api/premium/cancel
 * @access  Private
 * @body    { reason?: string }
 */
export const cancelSubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { reason = '' } = req.body;

    const tenantId = req.user.tenantId;

    const subscription = await UserSubscription.findOne({
      userId,
      tenantId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Update subscription
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason;
    subscription.autoRenew = false;
    await subscription.save();

    // Update user
    const user = await User.findById(userId);
    user.subscriptionType = 'free_buyer';
    user.isPremiumBuyer = false;
    user.isPremiumSeller = false;
    user.currentSubscriptionId = null;
    user.subscriptionExpiry = null;
    await user.save();

    // Clear cache
    await cache.del(`user:${userId}`);

    logger.info('User cancelled premium subscription', {
      userId,
      subscriptionId: subscription._id,
      reason
    });

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling subscription', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * @desc    Get subscription statistics (for user profile)
 * @route   GET /api/premium/stats
 * @access  Private
 */
export const getSubscriptionStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select(
      'subscriptionType isPremiumBuyer isPremiumSeller monthlyUploadsCount bookmarksCount subscriptionExpiry'
    );

    const uploadLimit = await user.canUploadNote();
    const bookmarkLimit = user.canAddBookmark();

    // Calculate days remaining
    let daysRemaining = 0;
    if (user.subscriptionExpiry) {
      const now = new Date();
      const diff = user.subscriptionExpiry - now;
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    res.status(200).json({
      success: true,
      data: {
        currentPlan: user.subscriptionType,
        isPremium: user.isPremiumBuyer || user.isPremiumSeller,
        expiryDate: user.subscriptionExpiry,
        daysRemaining,
        limits: {
          uploads: {
            used: user.monthlyUploadsCount,
            remaining: uploadLimit.remaining,
            unlimited: uploadLimit.remaining === -1
          },
          bookmarks: {
            used: user.bookmarksCount,
            remaining: bookmarkLimit.remaining,
            unlimited: bookmarkLimit.remaining === -1
          }
        },
        fees: {
          paymentGateway: user.getPaymentGatewayFee()
        },
        discounts: user.getDiscountRange()
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription stats', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};
