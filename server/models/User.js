import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import tenantPlugin from '../utils/tenantPlugin.js';

const userSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  googleId: {
    type: String,
    sparse: true,
    index: true
  },
  password: {
    type: String,
    required: function () { return !this.googleId; },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['buyer', 'seller', 'admin', 'student', 'teacher'],
    default: 'buyer'
  },
  isTenantAdmin: {
    type: Boolean,
    default: false,
    index: true
  },
  isSuperAdmin: {
    type: Boolean,
    default: false,
    index: true
  },
  walletBalance: {
    type: Number,
    default: 0,
    min: [0, 'Wallet balance cannot be negative']
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: [0, 'Total earnings cannot be negative']
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: [0, 'Total spent cannot be negative']
  },
  // Premium Subscription Fields
  currentSubscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSubscription',
    sparse: true,
    index: true
  },
  subscriptionType: {
    type: String,
    enum: ['free_buyer', 'premium_buyer', 'free_seller', 'premium_seller', 'combo'],
    default: 'free_buyer',
    index: true
  },
  isPremiumBuyer: {
    type: Boolean,
    default: false,
    index: true
  },
  isPremiumSeller: {
    type: Boolean,
    default: false,
    index: true
  },
  subscriptionExpiry: {
    type: Date,
    sparse: true,
    index: true
  },
  monthlyUploadsCount: {
    type: Number,
    default: 0,
    min: [0, 'Uploads count cannot be negative']
  },
  lastUploadReset: {
    type: Date,
    default: Date.now
  },
  bookmarksCount: {
    type: Number,
    default: 0,
    min: [0, 'Bookmarks count cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  // Only true for users who signed up AFTER email verification was introduced.
  // Old accounts default to false → no verification banner shown.
  needsEmailVerification: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'],
    sparse: true
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
// Email must be unique within a tenant, not globally
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, isTenantAdmin: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  if (!this.password) return false; // Google-only account
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user can upload more notes this month
userSchema.methods.canUploadNote = async function() {
  // Reset counter if it's a new month
  const now = new Date();
  const lastReset = this.lastUploadReset || now;
  const monthsSinceReset = (now.getFullYear() - lastReset.getFullYear()) * 12 + 
                           (now.getMonth() - lastReset.getMonth());
  
  if (monthsSinceReset >= 1) {
    this.monthlyUploadsCount = 0;
    this.lastUploadReset = now;
    await this.save();
  }

  // Premium seller or combo has unlimited uploads
  if (this.isPremiumSeller || this.subscriptionType === 'combo') {
    return { canUpload: true, remaining: -1 }; // -1 means unlimited
  }

  // Free seller limited to 5 per month
  const limit = 5;
  return {
    canUpload: this.monthlyUploadsCount < limit,
    remaining: Math.max(0, limit - this.monthlyUploadsCount)
  };
};

// Check if user can add more bookmarks
userSchema.methods.canAddBookmark = function() {
  // Premium buyer or combo has unlimited bookmarks
  if (this.isPremiumBuyer || this.subscriptionType === 'combo') {
    return { canAdd: true, remaining: -1 }; // -1 means unlimited
  }

  // Free buyer limited to 10 bookmarks
  const limit = 10;
  return {
    canAdd: this.bookmarksCount < limit,
    remaining: Math.max(0, limit - this.bookmarksCount)
  };
};

// Get payment gateway fee percentage
userSchema.methods.getPaymentGatewayFee = function() {
  // Premium buyer or combo pays 0% gateway fee
  if (this.isPremiumBuyer || this.subscriptionType === 'combo') {
    return 0;
  }
  // Free buyer pays 2% gateway fee
  return 2;
};

// Get discount range for premium buyer
userSchema.methods.getDiscountRange = function() {
  // Premium buyer or combo gets 5-10% discount
  if (this.isPremiumBuyer || this.subscriptionType === 'combo') {
    return { min: 5, max: 10 };
  }
  return { min: 0, max: 0 };
};

// Check if subscription is active
userSchema.methods.hasActiveSubscription = function() {
  if (!this.subscriptionExpiry) return false;
  return new Date() <= this.subscriptionExpiry;
};

// Remove password from JSON response
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Apply tenant plugin
userSchema.plugin(tenantPlugin);

const User = mongoose.model('User', userSchema);

export default User;
