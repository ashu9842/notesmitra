import mongoose from 'mongoose';
import tenantPlugin from '../utils/tenantPlugin.js';

const transactionSchema = new mongoose.Schema({
  id: {
    type: String
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  paymentMethod: String,
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed'],
    default: 'completed'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const walletSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  transactions: [transactionSchema]
}, {
  timestamps: true
});

// Compound unique index - one wallet per user per tenant
walletSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

// Apply tenant plugin
walletSchema.plugin(tenantPlugin);

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;
