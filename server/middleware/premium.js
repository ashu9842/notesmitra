import User from '../models/User.js';
import Note from '../models/Note.js';
import logger from '../utils/logger.js';

/**
 * Middleware to check if user can upload notes based on their subscription
 */
export const checkUploadLimit = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Sync monthly upload count with actual uploads for this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const actualUploads = await Note.countDocuments({
      sellerId: user._id,
      uploadedAt: { $gte: monthStart, $lte: now }
    });

    if (user.monthlyUploadsCount !== actualUploads) {
      user.monthlyUploadsCount = actualUploads;
      user.lastUploadReset = now;
      await user.save();
    }

    const uploadCheck = await user.canUploadNote();

    if (!uploadCheck.canUpload) {
      return res.status(403).json({
        success: false,
        error: 'Upload limit reached',
        message: 'You have reached your monthly upload limit. Upgrade to Premium Seller for unlimited uploads.',
        limits: {
          used: user.monthlyUploadsCount,
          limit: 5,
          remaining: uploadCheck.remaining
        }
      });
    }

    req.uploadLimit = uploadCheck;
    next();
  } catch (error) {
    logger.error('Error checking upload limit', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Middleware to check if user can add bookmarks based on their subscription
 */
export const checkBookmarkLimit = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const bookmarkCheck = user.canAddBookmark();

    if (!bookmarkCheck.canAdd) {
      return res.status(403).json({
        success: false,
        error: 'Bookmark limit reached',
        message: 'You have reached your bookmark limit. Upgrade to Premium Buyer for unlimited bookmarks.',
        limits: {
          used: user.bookmarksCount,
          limit: 10,
          remaining: bookmarkCheck.remaining
        }
      });
    }

    req.bookmarkLimit = bookmarkCheck;
    next();
  } catch (error) {
    logger.error('Error checking bookmark limit', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Middleware to attach premium benefits to request
 */
export const attachPremiumBenefits = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'subscriptionType isPremiumBuyer isPremiumSeller subscriptionExpiry'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if subscription is expired
    const hasActiveSubscription = user.hasActiveSubscription();

    if (!hasActiveSubscription && (user.isPremiumBuyer || user.isPremiumSeller)) {
      // Subscription expired, downgrade to free
      user.subscriptionType = 'free_buyer';
      user.isPremiumBuyer = false;
      user.isPremiumSeller = false;
      user.subscriptionExpiry = null;
      user.currentSubscriptionId = null;
      await user.save();
    }

    req.premiumBenefits = {
      isPremiumBuyer: user.isPremiumBuyer && hasActiveSubscription,
      isPremiumSeller: user.isPremiumSeller && hasActiveSubscription,
      isCombo: user.subscriptionType === 'combo' && hasActiveSubscription,
      paymentGatewayFee: user.getPaymentGatewayFee(),
      discountRange: user.getDiscountRange(),
      hasActiveSubscription
    };

    next();
  } catch (error) {
    logger.error('Error attaching premium benefits', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Middleware to require premium seller access
 */
export const requirePremiumSeller = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'isPremiumSeller subscriptionType subscriptionExpiry'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const hasActiveSubscription = user.hasActiveSubscription();
    const isPremiumSeller = (user.isPremiumSeller || user.subscriptionType === 'combo') && hasActiveSubscription;

    if (!isPremiumSeller) {
      return res.status(403).json({
        success: false,
        error: 'Premium Seller subscription required',
        message: 'This feature is only available for Premium Seller subscribers.'
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking premium seller status', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Middleware to require premium buyer access
 */
export const requirePremiumBuyer = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'isPremiumBuyer subscriptionType subscriptionExpiry'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const hasActiveSubscription = user.hasActiveSubscription();
    const isPremiumBuyer = (user.isPremiumBuyer || user.subscriptionType === 'combo') && hasActiveSubscription;

    if (!isPremiumBuyer) {
      return res.status(403).json({
        success: false,
        error: 'Premium Buyer subscription required',
        message: 'This feature is only available for Premium Buyer subscribers.'
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking premium buyer status', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Middleware to add priority flag for premium sellers
 */
export const markPriorityApproval = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'isPremiumSeller subscriptionType subscriptionExpiry'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const hasActiveSubscription = user.hasActiveSubscription();
    const isPremiumSeller = (user.isPremiumSeller || user.subscriptionType === 'combo') && hasActiveSubscription;

    req.priorityApproval = isPremiumSeller;
    next();
  } catch (error) {
    logger.error('Error marking priority approval', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};
