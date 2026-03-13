import Wallet from '../models/Wallet.js';
import User from '../models/User.js';
import Purchase from '../models/Purchase.js';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ROLES } from '../config/constants.js';

const getSellerWithdrawableBalance = async ({ userId, wallet }) => {
  if (!wallet) return 0;

  const sellerId =
    typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

  const [earningsSummary] = await Purchase.aggregate([
    { $match: { sellerId, status: 'completed' } },
    { $group: { _id: null, totalEarnings: { $sum: '$sellerEarnings' } } }
  ]);

  const totalEarnings = Number(earningsSummary?.totalEarnings || 0);

  const completedWithdrawals = (wallet.transactions || []).reduce((sum, transaction) => {
    const description = String(transaction.description || '').toLowerCase();
    const isWithdrawal = transaction.type === 'debit' && description.includes('withdrawal');

    if (!isWithdrawal || transaction.status !== 'completed') {
      return sum;
    }

    return sum + Number(transaction.amount || 0);
  }, 0);

  const withdrawable = Math.max(
    0,
    Math.min(Number(wallet.balance || 0), totalEarnings - completedWithdrawals)
  );

  return Number(withdrawable.toFixed(2));
};

// @desc    Get user wallet
// @route   GET /api/wallet
// @access  Private
export const getWallet = async (req, res, next) => {
  try {
    // Get user with tenantId
    const user = await User.findById(req.user._id).select('tenantId');
    if (!user?.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'User tenant information not found'
      });
    }

    let wallet = await Wallet.findOne({ userId: req.user._id });

    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user._id,
        tenantId: user.tenantId,
        balance: 0,
        transactions: []
      });
    }

    let withdrawableBalance = Number(wallet.balance || 0);
    if (req.user?.role === ROLES.SELLER) {
      withdrawableBalance = await getSellerWithdrawableBalance({
        userId: req.user._id,
        wallet
      });
    }

    res.status(200).json({
      success: true,
      wallet,
      withdrawableBalance
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add funds to wallet
// @route   POST /api/wallet/add-funds
// @access  Private
export const addFunds = async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid amount'
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a payment method'
      });
    }

    // Get wallet
    const user = await User.findById(req.user._id).select('tenantId');
    if (!user?.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'User tenant information not found'
      });
    }

    let wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet) {
      wallet = await Wallet.create({
        userId: req.user._id,
        tenantId: user.tenantId,
        balance: 0,
        transactions: []
      });
    }

    // Create transaction
    const transaction = {
      id: `txn_${uuidv4()}`,
      type: 'credit',
      amount: parseFloat(amount),
      description: 'Wallet recharge',
      paymentMethod,
      status: 'completed',
      timestamp: new Date()
    };

    // Update wallet
    wallet.balance += parseFloat(amount);
    wallet.transactions.unshift(transaction);

    await wallet.save();

    // Update user wallet balance
    await User.findByIdAndUpdate(req.user._id, {
      walletBalance: wallet.balance
    });

    res.status(200).json({
      success: true,
      wallet,
      transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request withdrawal — recorded as pending, admin pays manually via UPI
// @route   POST /api/wallet/withdraw
// @access  Private
export const withdrawFunds = async (req, res, next) => {
  try {
    const { amount, method } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Please provide a valid amount' });
    }

    const parsedAmount = parseFloat(amount);
    const isAdminUser = req.user?.role === ROLES.ADMIN;
    const maxWithdrawal = isAdminUser ? 1000 : 500;

    if (parsedAmount < 100) {
      return res.status(400).json({ success: false, error: 'Minimum withdrawal amount is ₹100' });
    }
    if (parsedAmount > maxWithdrawal) {
      return res.status(400).json({ success: false, error: `Maximum withdrawal amount is ₹${maxWithdrawal}` });
    }
    if (!method || !method.trim()) {
      return res.status(400).json({ success: false, error: 'Please provide your UPI ID' });
    }

    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) return res.status(404).json({ success: false, error: 'Wallet not found' });

    let availableBalance = Number(wallet.balance || 0);
    if (req.user?.role === ROLES.SELLER) {
      availableBalance = await getSellerWithdrawableBalance({
        userId: req.user._id,
        wallet
      });
    }

    if (availableBalance < parsedAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient available balance' });
    }

    const transaction = {
      id: `txn_${uuidv4()}`,
      type: 'debit',
      amount: parsedAmount,
      description: `Withdrawal to ${method.trim()}`,
      paymentMethod: method.trim(),
      status: 'pending',
      timestamp: new Date(),
    };

    wallet.balance -= parsedAmount;
    wallet.transactions.unshift(transaction);
    await wallet.save();

    await User.findByIdAndUpdate(req.user._id, { walletBalance: wallet.balance });

    res.status(200).json({
      success: true,
      wallet,
      transaction,
      message: 'Withdrawal request submitted. Admin will send payment to your UPI within 1–2 business days.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all pending withdrawal requests (admin only)
// @route   GET /api/wallet/admin/pending-withdrawals
// @access  Admin
export const getPendingWithdrawals = async (req, res, next) => {
  try {
    const wallets = await Wallet.find({ 'transactions.status': 'pending', 'transactions.type': 'debit' })
      .populate('userId', 'name email');

    const pending = [];
    for (const wallet of wallets) {
      for (const txn of wallet.transactions) {
        if (txn.type === 'debit' && txn.status === 'pending') {
          pending.push({
            txnId: txn.id,
            walletId: wallet._id,
            userId: wallet.userId?._id,
            sellerName: wallet.userId?.name || 'Unknown',
            sellerEmail: wallet.userId?.email || '',
            amount: txn.amount,
            upiId: txn.paymentMethod,
            requestedAt: txn.timestamp,
          });
        }
      }
    }

    // Sort newest first
    pending.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    res.status(200).json({ success: true, withdrawals: pending });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a withdrawal as completed (admin paid via UPI)
// @route   POST /api/wallet/admin/complete-withdrawal
// @access  Admin
export const completeWithdrawal = async (req, res, next) => {
  try {
    const { walletId, txnId } = req.body;
    if (!walletId || !txnId) {
      return res.status(400).json({ success: false, error: 'walletId and txnId are required' });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) return res.status(404).json({ success: false, error: 'Wallet not found' });

    const txn = wallet.transactions.find(t => t.id === txnId);
    if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found' });
    if (txn.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Transaction is not pending' });
    }

    txn.status = 'completed';
    await wallet.save();

    res.status(200).json({ success: true, message: 'Withdrawal marked as completed' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get transaction history
// @route   GET /api/wallet/transactions
// @access  Private
export const getTransactions = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    res.status(200).json({
      success: true,
      transactions: wallet.transactions
    });
  } catch (error) {
    next(error);
  }
};
