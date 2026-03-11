import mongoose from 'mongoose';
import tenantPlugin from '../utils/tenantPlugin.js';

const purchaseSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  noteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    required: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  platformFee: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  sellerEarnings: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    required: true
  },
  razorpayPaymentId: {
    type: String,
    unique: true,
    sparse: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  refundReason: {
    type: String,
    trim: true
  },
  purchasedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate purchases
purchaseSchema.index({ buyerId: 1, noteId: 1 });
purchaseSchema.index({ sellerId: 1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ createdAt: -1 });

const allowedTransitions = {
  pending: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: ['refunded'],
  failed: [],
  refunded: []
};

const isValidTransition = (fromStatus, toStatus) => {
  if (!fromStatus || fromStatus === toStatus) return true;
  const allowed = allowedTransitions[fromStatus] || [];
  return allowed.includes(toStatus);
};

purchaseSchema.pre('save', function (next) {
  if (!this.isModified('status')) {
    return next();
  }

  const previousStatus = this.$locals.previousStatus || this.get('status');
  if (!isValidTransition(previousStatus, this.status)) {
    return next(new Error('Invalid purchase status transition'));
  }

  return next();
});

purchaseSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() || {};
  const nextStatus = update.status || (update.$set && update.$set.status);

  if (!nextStatus) {
    return next();
  }

  const current = await this.model.findOne(this.getQuery()).lean();
  if (!current) {
    return next();
  }

  if (!isValidTransition(current.status, nextStatus)) {
    return next(new Error('Invalid purchase status transition'));
  }

  return next();
});

// Apply tenant plugin
purchaseSchema.plugin(tenantPlugin);

const Purchase = mongoose.model('Purchase', purchaseSchema);

export default Purchase;
