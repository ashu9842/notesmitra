import mongoose from 'mongoose';
import tenantPlugin from '../utils/tenantPlugin.js';

const subscriptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Tenant ID is required'],
      unique: true,
      index: true
    },
    plan: {
      type: String,
      enum: {
        values: ['free', 'pro', 'enterprise'],
        message: 'Plan must be one of: free, pro, enterprise'
      },
      required: [true, 'Plan is required'],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'expired', 'cancelled', 'pending', 'suspended'],
        message: 'Status must be one of: active, expired, cancelled, pending, suspended'
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
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    features: {
      maxUsers: {
        type: Number,
        required: true,
        min: [1, 'maxUsers must be at least 1']
      },
      maxUploads: {
        type: Number,
        required: true,
        min: [1, 'maxUploads must be at least 1']
      },
      storageLimit: {
        type: Number,
        required: true,
        min: [1, 'storageLimit must be at least 1 GB']
      },
      customBranding: {
        type: Boolean,
        default: false
      },
      advancedAnalytics: {
        type: Boolean,
        default: false
      },
      prioritySupport: {
        type: Boolean,
        default: false
      },
      apiAccess: {
        type: Boolean,
        default: false
      },
      sso: {
        type: Boolean,
        default: false
      },
      dataResidency: {
        type: Boolean,
        default: false
      }
    },
    autoRenew: {
      type: Boolean,
      default: true
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'stripe', 'razorpay'],
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
    suspendedAt: {
      type: Date
    },
    suspensionReason: {
      type: String
    },
    notes: {
      type: String
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Index for querying expiring subscriptions
subscriptionSchema.index({ expiryDate: 1, status: 1 });
subscriptionSchema.index({ tenantId: 1, status: 1 });
subscriptionSchema.index({ createdAt: -1 });

// Pre-save hook to validate expiry > start
subscriptionSchema.pre('save', function (next) {
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

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function () {
  const now = new Date();
  return this.status === 'active' && now <= this.expiryDate;
};

// Method to check if subscription is expired
subscriptionSchema.methods.isExpired = function () {
  const now = new Date();
  return this.status === 'expired' || now > this.expiryDate;
};

// Method to get days remaining
subscriptionSchema.methods.getDaysRemaining = function () {
  if (!this.isActive()) return 0;
  const now = new Date();
  const diffTime = Math.abs(this.expiryDate - now);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Method to get renewal date
subscriptionSchema.methods.getRenewalDate = function () {
  if (this.billingCycle === 'monthly') {
    const renewal = new Date(this.expiryDate);
    renewal.setMonth(renewal.getMonth() + 1);
    return renewal;
  } else if (this.billingCycle === 'quarterly') {
    const renewal = new Date(this.expiryDate);
    renewal.setMonth(renewal.getMonth() + 3);
    return renewal;
  } else if (this.billingCycle === 'yearly') {
    const renewal = new Date(this.expiryDate);
    renewal.setFullYear(renewal.getFullYear() + 1);
    return renewal;
  }
  return null;
};

// Apply tenant plugin
subscriptionSchema.plugin(tenantPlugin);

export default mongoose.model('Subscription', subscriptionSchema);
