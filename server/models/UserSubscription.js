import mongoose from 'mongoose';
import tenantPlugin from '../utils/tenantPlugin.js';

const userSubscriptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Tenant ID is required'],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    planType: {
      type: String,
      enum: {
        values: ['free_buyer', 'premium_buyer', 'free_seller', 'premium_seller', 'combo'],
        message: 'Plan type must be one of: free_buyer, premium_buyer, free_seller, premium_seller, combo'
      },
      required: [true, 'Plan type is required'],
      index: true
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'expired', 'cancelled', 'pending'],
        message: 'Status must be one of: active, expired, cancelled, pending'
      },
      default: 'pending',
      index: true
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required']
    },
    billingCycle: {
      type: String,
      enum: {
        values: ['monthly', 'quarterly', 'yearly'],
        message: 'Billing cycle must be one of: monthly, quarterly, yearly'
      },
      default: 'monthly'
    },
    features: {
      // Seller Features
      maxNotesPerMonth: {
        type: Number,
        default: 5 // Free: 5, Premium: unlimited (-1)
      },
      priorityApproval: {
        type: Boolean,
        default: false // Premium seller: true (24 hours)
      },
      featuredVisibility: {
        type: Boolean,
        default: false // Premium seller: true
      },
      advancedAnalytics: {
        type: Boolean,
        default: false // Premium seller: true
      },
      premiumSellerBadge: {
        type: Boolean,
        default: false // Premium seller: true
      },
      increasedDiscoverability: {
        type: Boolean,
        default: false // Premium seller: true
      },
      earningPercentage: {
        type: Number,
        default: 80 // Free: 80%, Premium could be higher
      },
      
      // Buyer Features
      paymentGatewayFee: {
        type: Number,
        default: 2 // Free: 2%, Premium: 0%
      },
      earlyAccessHours: {
        type: Number,
        default: 0 // Premium: 24 hours
      },
      discountPercentageMin: {
        type: Number,
        default: 0 // Premium: 5%
      },
      discountPercentageMax: {
        type: Number,
        default: 0 // Premium: 10%
      },
      maxBookmarks: {
        type: Number,
        default: 10 // Free: 10, Premium: unlimited (-1)
      },
      premiumBuyerBadge: {
        type: Boolean,
        default: false // Premium buyer: true
      },
      prioritySupport: {
        type: Boolean,
        default: false // Premium buyer: true
      }
    },
    autoRenew: {
      type: Boolean,
      default: true
    },
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'stripe', 'wallet'],
      required: false
    },
    transactionId: {
      type: String,
      sparse: true,
      index: true
    },
    cancelledAt: {
      type: Date
    },
    cancellationReason: {
      type: String
    },
    notes: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Unique index - user can only have one active subscription at a time
userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ tenantId: 1, planType: 1, status: 1 });
userSubscriptionSchema.index({ expiryDate: 1, status: 1 });
userSubscriptionSchema.index({ createdAt: -1 });

// Pre-save hook to validate expiry > start
userSubscriptionSchema.pre('save', function (next) {
  if (this.expiryDate <= this.startDate) {
    return next(new Error('Expiry date must be after start date'));
  }

  // Auto-update status based on dates
  const now = new Date();
  if (this.status === 'active' && now > this.expiryDate) {
    this.status = 'expired';
  }

  next();
});

// Static method to get plan configurations
userSubscriptionSchema.statics.getPlanConfig = function(planType) {
  const configs = {
    free_buyer: {
      price: 0,
      features: {
        maxNotesPerMonth: 0,
        priorityApproval: false,
        featuredVisibility: false,
        advancedAnalytics: false,
        premiumSellerBadge: false,
        increasedDiscoverability: false,
        earningPercentage: 0,
        paymentGatewayFee: 2,
        earlyAccessHours: 0,
        discountPercentageMin: 0,
        discountPercentageMax: 0,
        maxBookmarks: 10,
        premiumBuyerBadge: false,
        prioritySupport: false
      }
    },
    premium_buyer: {
      price: 99,
      features: {
        maxNotesPerMonth: 0,
        priorityApproval: false,
        featuredVisibility: false,
        advancedAnalytics: false,
        premiumSellerBadge: false,
        increasedDiscoverability: false,
        earningPercentage: 0,
        paymentGatewayFee: 0,
        earlyAccessHours: 24,
        discountPercentageMin: 5,
        discountPercentageMax: 10,
        maxBookmarks: -1, // unlimited
        premiumBuyerBadge: true,
        prioritySupport: true
      }
    },
    free_seller: {
      price: 0,
      features: {
        maxNotesPerMonth: 5,
        priorityApproval: false,
        featuredVisibility: false,
        advancedAnalytics: false,
        premiumSellerBadge: false,
        increasedDiscoverability: false,
        earningPercentage: 80,
        paymentGatewayFee: 0,
        earlyAccessHours: 0,
        discountPercentageMin: 0,
        discountPercentageMax: 0,
        maxBookmarks: 0,
        premiumBuyerBadge: false,
        prioritySupport: false
      }
    },
    premium_seller: {
      price: 99,
      features: {
        maxNotesPerMonth: -1, // unlimited
        priorityApproval: true,
        featuredVisibility: true,
        advancedAnalytics: true,
        premiumSellerBadge: true,
        increasedDiscoverability: true,
        earningPercentage: 80,
        paymentGatewayFee: 0,
        earlyAccessHours: 0,
        discountPercentageMin: 0,
        discountPercentageMax: 0,
        maxBookmarks: 0,
        premiumBuyerBadge: false,
        prioritySupport: false
      }
    },
    combo: {
      price: 149, // ₹99 + ₹99 = ₹198, Save ₹49
      features: {
        maxNotesPerMonth: -1, // unlimited
        priorityApproval: true,
        featuredVisibility: true,
        advancedAnalytics: true,
        premiumSellerBadge: true,
        increasedDiscoverability: true,
        earningPercentage: 80,
        paymentGatewayFee: 0,
        earlyAccessHours: 24,
        discountPercentageMin: 5,
        discountPercentageMax: 10,
        maxBookmarks: -1, // unlimited
        premiumBuyerBadge: true,
        prioritySupport: true
      }
    }
  };

  return configs[planType] || configs.free_buyer;
};

// Method to check if subscription is active
userSubscriptionSchema.methods.isActive = function () {
  const now = new Date();
  return this.status === 'active' && now <= this.expiryDate;
};

// Method to check if subscription is expired
userSubscriptionSchema.methods.isExpired = function () {
  const now = new Date();
  return this.status === 'expired' || now > this.expiryDate;
};

// Method to get days remaining
userSubscriptionSchema.methods.getDaysRemaining = function () {
  if (!this.isActive()) return 0;
  const now = new Date();
  const diffTime = Math.abs(this.expiryDate - now);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Method to check if user has seller features
userSubscriptionSchema.methods.hasSellerFeatures = function () {
  return ['premium_seller', 'combo'].includes(this.planType);
};

// Method to check if user has buyer features
userSubscriptionSchema.methods.hasBuyerFeatures = function () {
  return ['premium_buyer', 'combo'].includes(this.planType);
};

// Apply tenant plugin
userSubscriptionSchema.plugin(tenantPlugin);

export default mongoose.model('UserSubscription', userSubscriptionSchema);
