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
  availableBalance: {
    type: Number,
    default: 0,
    min: [0, 'Available balance cannot be negative']
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: [0, 'Total withdrawn cannot be negative']
  },
  totalPendingWithdrawals: {
    type: Number,
    default: 0,
    min: [0, 'Pending withdrawals cannot be negative']
  },
  transactions: [transactionSchema]
}, {
  timestamps: true
});

// Compound unique index - one wallet per user per tenant
walletSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
walletSchema.index({ userId: 1, availableBalance: 1 });

/**
 * Calculate available balance for a wallet
 * For sellers: balance - (total earnings - completed withdrawals)
 * For others: full balance minus pending withdrawals
 */
walletSchema.methods.calculateAvailableBalance = function () {
  const pendingWithdrawals = (this.transactions || []).reduce((sum, txn) => {
    if (txn.type === 'debit' && txn.status === 'pending') {
      return sum + (txn.amount || 0);
    }
    return sum;
  }, 0);

  const completedWithdrawals = (this.transactions || []).reduce((sum, txn) => {
    if (txn.type === 'debit' && txn.status === 'completed') {
      return sum + (txn.amount || 0);
    }
    return sum;
  }, 0);

  const available = Math.max(
    0,
    Number((this.balance - pendingWithdrawals).toFixed(2))
  );

  return {
    availableBalance: available,
    pendingWithdrawals: Number(pendingWithdrawals.toFixed(2)),
    completedWithdrawals: Number(completedWithdrawals.toFixed(2))
  };
};

/**
 * Update available balance based on current transactions
 */
walletSchema.methods.updateAvailableBalance = async function () {
  const calc = this.calculateAvailableBalance();
  this.availableBalance = calc.availableBalance;
  this.totalPendingWithdrawals = calc.pendingWithdrawals;
  this.totalWithdrawn = calc.completedWithdrawals;
  return this;
};

// Apply tenant plugin
walletSchema.plugin(tenantPlugin);

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;
