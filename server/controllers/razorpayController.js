import Razorpay from 'razorpay';
import crypto from 'crypto';
import Purchase from '../models/Purchase.js';
import Note from '../models/Note.js';
import Wallet from '../models/Wallet.js';
import User from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';

// Initialize Razorpay with lazy loading
let razorpay;

const getRazorpayInstance = () => {
  if (!razorpay) {
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      throw new Error(
        'Razorpay credentials not found.'
      );
    }
    razorpay = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret
    });
  }
  return razorpay;
};

// @desc    Create Razorpay order for wallet recharge
// @route   POST /api/razorpay/create-order/wallet
// @access  Private
export const createWalletOrder = async (req, res, next) => {
  try {
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      return res.status(503).json({
        success: false,
        error: 'Razorpay payment is not configured. Please use wallet top-up via the Wallet tab instead.'
      });
    }

    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid amount'
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise (must be integer)
      currency: 'INR',
      receipt: `w_${uuidv4().replace(/-/g, '').slice(0, 32)}`, // max 40 chars
      notes: {
        userId: req.user._id.toString(),
        type: 'wallet_recharge'
      }
    };

    let order;
    try {
      order = await getRazorpayInstance().orders.create(options);
    } catch (rzpError) {
      const description = rzpError?.error?.description || rzpError?.message || 'Failed to create payment order. Please check your Razorpay credentials.';
      return res.status(422).json({ success: false, error: description });
    }

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: config.razorpayKeyId
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay payment and add funds to wallet
// @route   POST /api/razorpay/verify-payment/wallet
// @access  Private
export const verifyWalletPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Fetch payment details from Razorpay
    const payment = await getRazorpayInstance().payments.fetch(razorpay_payment_id);
    const amount = payment.amount / 100; // Convert from paise to rupees

    // Get or create wallet
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
        availableBalance: 0,
        transactions: []
      });
    }

    // Create transaction
    const transaction = {
      id: `txn_${uuidv4()}`,
      type: 'credit',
      amount: amount,
      description: 'Wallet recharge via Razorpay',
      paymentMethod: 'razorpay',
      status: 'completed',
      timestamp: new Date()
    };

    // Update wallet
    wallet.balance += amount;
    wallet.transactions.unshift(transaction);
    
    // Update available balance
    await wallet.updateAvailableBalance();
    await wallet.save();

    // Update user wallet balance
    await User.findByIdAndUpdate(req.user._id, {
      walletBalance: wallet.balance
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified and wallet recharged successfully',
      wallet,
      transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Razorpay order for premium subscription (does NOT credit user wallet)
// @route   POST /api/razorpay/create-order/premium
// @access  Private
export const createPremiumOrder = async (req, res, next) => {
  try {
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      return res.status(503).json({
        success: false,
        error: 'Razorpay payment is not configured. Please use wallet payment instead.'
      });
    }

    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid amount'
      });
    }

    const options = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `prem_${uuidv4().replace(/-/g, '').slice(0, 30)}`,
      notes: {
        userId: req.user._id.toString(),
        type: 'premium_subscription'
      }
    };

    let order;
    try {
      order = await getRazorpayInstance().orders.create(options);
    } catch (rzpError) {
      const description = rzpError?.error?.description || rzpError?.message || 'Failed to create payment order.';
      return res.status(422).json({ success: false, error: description });
    }

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay premium payment (signature check only, does NOT credit wallet)
// @route   POST /api/razorpay/verify-payment/premium
// @access  Private
export const verifyPremiumPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment verification fields' });
    }

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified',
      paymentId: razorpay_payment_id
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Razorpay order for note purchase
// @route   POST /api/razorpay/create-order/note
// @access  Private
export const createNoteOrder = async (req, res, next) => {
  try {
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      return res.status(503).json({
        success: false,
        error: 'UPI/Card payment is not configured. Please use wallet payment instead.'
      });
    }

    const { noteId } = req.body;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide noteId'
      });
    }

    // Get note
    const note = await Note.findById(noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Check if note is approved
    if (note.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Note is not available for purchase'
      });
    }

    // Check if already purchased
    const existingPurchase = await Purchase.findOne({
      buyerId: req.user._id,
      noteId: note._id
    });

    if (existingPurchase) {
      return res.status(400).json({
        success: false,
        error: 'You have already purchased this note'
      });
    }

    // Check buyer premium status for fee/discount benefits
    const buyer = await User.findById(req.user._id).select(
      'isPremiumBuyer subscriptionType subscriptionExpiry'
    );
    const hasActiveSub = buyer && buyer.hasActiveSubscription();
    const isPremiumBuyer = buyer && (buyer.isPremiumBuyer || buyer.subscriptionType === 'combo') && hasActiveSub;

    // Apply flat 5% discount for premium buyers
    let discountPercentage = 0;
    let discountAmount = 0;
    if (isPremiumBuyer) {
      discountPercentage = 5;
      discountAmount = Number((note.price * discountPercentage / 100).toFixed(2));
    }
    const priceAfterDiscount = Number((note.price - discountAmount).toFixed(2));

    // Premium buyers pay 0% gateway fee; non-premium buyers pay 2% of original price
    const gatewayFee = isPremiumBuyer ? 0 : Number((note.price * 0.02).toFixed(2));

    // Total amount: premium = discounted price, non-premium = original + 2% fee
    const totalAmount = isPremiumBuyer
      ? priceAfterDiscount
      : Number((note.price + gatewayFee).toFixed(2));

    // Platform fee for display (not used in payment)
    const serviceFeeRate = config.platformFeePercent / 100; // 20%
    const serviceFee = isPremiumBuyer
      ? Number((priceAfterDiscount * serviceFeeRate).toFixed(2))
      : Number((note.price * serviceFeeRate).toFixed(2));
    const platformFee = Number((gatewayFee + serviceFee).toFixed(2));

    // Create Razorpay order
    const options = {
      amount: Math.round(totalAmount * 100), // Convert to paise (must be integer)
      currency: 'INR',
      receipt: `n_${uuidv4().replace(/-/g, '').slice(0, 32)}`, // max 40 chars
      notes: {
        userId: req.user._id.toString(),
        noteId: note._id.toString(),
        type: 'note_purchase',
        discountPercentage: String(discountPercentage),
        isPremiumBuyer: String(isPremiumBuyer)
      }
    };

    let order;
    try {
      order = await getRazorpayInstance().orders.create(options);
    } catch (rzpError) {
      const description = rzpError?.error?.description || rzpError?.message || 'Failed to create payment order. Please check your Razorpay credentials.';
      return res.status(422).json({ success: false, error: description });
    }

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: config.razorpayKeyId,
        noteTitle: note.title,
        notePrice: note.price,
        discountPercentage,
        discountAmount,
        priceAfterDiscount,
        platformFee: platformFee,
        totalAmount: totalAmount,
        isPremiumBuyer
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay payment and complete note purchase
// @route   POST /api/razorpay/verify-payment/note
// @access  Private
export const verifyNotePayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, noteId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !noteId) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment verification fields'
      });
    }

    // Idempotency guard first: if purchase is already completed, return success
    // even if client retries with stale/partial signature payload.
    const alreadyPurchased = await Purchase.findOne({
      buyerId: req.user._id,
      noteId,
      status: 'completed'
    });

    if (alreadyPurchased) {
      return res.status(200).json({
        success: true,
        message: 'Purchase already completed',
        purchase: alreadyPurchased
      });
    }

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Get note
    const note = await Note.findById(noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Guard against double-spend: reject if this payment was already processed
    const alreadyProcessed = await Purchase.findOne({
      razorpayPaymentId: razorpay_payment_id,
      buyerId: req.user._id
    });
    if (alreadyProcessed) {
      if (alreadyProcessed.status !== 'completed') {
        const reconciledPurchase = await Purchase.findOneAndUpdate(
          {
            _id: alreadyProcessed._id,
            status: { $in: ['pending', 'processing'] }
          },
          {
            status: 'completed',
            purchasedAt: alreadyProcessed.purchasedAt || new Date()
          },
          { new: true }
        );

        return res.status(200).json({
          success: true,
          message: 'Payment already verified',
          purchase: reconciledPurchase || alreadyProcessed
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        purchase: alreadyProcessed
      });
    }

    // Guard against duplicate note purchase
    const existingPurchase = await Purchase.findOne({
      buyerId: req.user._id,
      noteId: note._id,
      status: 'completed'
    });
    if (existingPurchase) {
      return res.status(200).json({
        success: true,
        message: 'Purchase already completed',
        purchase: existingPurchase
      });
    }

    // Fetch original order from Razorpay to retrieve the discount applied at order creation
    let storedDiscountPercentage = 0;
    let storedIsPremiumBuyer = false;
    try {
      const rzpOrder = await getRazorpayInstance().orders.fetch(razorpay_order_id);
      storedDiscountPercentage = parseInt(rzpOrder.notes?.discountPercentage || '0', 10);
      storedIsPremiumBuyer = rzpOrder.notes?.isPremiumBuyer === 'true';
    } catch (_) {
      // If fetch fails, continue with no discount (safe fallback)
    }

    // Recalculate fees using stored discount — must match order creation exactly
    const discountAmount = Number((note.price * storedDiscountPercentage / 100).toFixed(2));
    const priceAfterDiscount = Number((note.price - discountAmount).toFixed(2));
    const gatewayFee = storedIsPremiumBuyer ? 0 : Number((priceAfterDiscount * 0.02).toFixed(2));
    const serviceFeeRate = config.platformFeePercent / 100; // 20%
    const serviceFee = Number((priceAfterDiscount * serviceFeeRate).toFixed(2));
    const commissionAmount = Number((gatewayFee + serviceFee).toFixed(2));
    const totalAmount = Number((priceAfterDiscount + gatewayFee).toFixed(2));
    const sellerEarnings = Number((priceAfterDiscount - serviceFee).toFixed(2)); // Seller gets 80% of post-discount price

    // Add to seller's wallet
    let sellerWallet = await Wallet.findOne({ userId: note.sellerId });

    if (!sellerWallet) {
      sellerWallet = await Wallet.create({
        userId: note.sellerId,
        tenantId: note.tenantId,
        balance: 0,
        availableBalance: 0,
        transactions: []
      });
    }

    sellerWallet.balance += sellerEarnings;
    sellerWallet.transactions.unshift({
      id: `txn_${uuidv4()}`,
      type: 'credit',
      amount: sellerEarnings,
      description: `Sale: ${note.title}`,
      status: 'completed',
      timestamp: new Date()
    });
    
    // Update available balance
    await sellerWallet.updateAvailableBalance();
    await sellerWallet.save();

    // Update seller's profile
    await User.findByIdAndUpdate(note.sellerId, {
      walletBalance: sellerWallet.balance,
      $inc: { totalEarnings: sellerEarnings }
    });

    // Update buyer's profile
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalSpent: totalAmount },
      ...(storedIsPremiumBuyer && { lastPremiumSaveAt: new Date() })
    });

    // Credit platform wallet with full commission (2% from buyer + 20% from seller)
    const platformUserId = config.platformUserId;
    if (platformUserId) {
      let platformWallet = await Wallet.findOne({ userId: platformUserId });
      if (!platformWallet) {
        platformWallet = await Wallet.create({
          userId: platformUserId,
          tenantId: note.tenantId,
          balance: 0,
          availableBalance: 0,
          transactions: []
        });
      }
      platformWallet.balance += commissionAmount;
      platformWallet.transactions.unshift({
        id: `txn_${uuidv4()}`,
        type: 'credit',
        amount: commissionAmount,
        description: `Platform Fee (${storedIsPremiumBuyer ? 'Service 20%' : 'Txn 2% + Service 20%'}): ${note.title}`,
        discountApplied: storedDiscountPercentage > 0 ? `${storedDiscountPercentage}% premium discount` : undefined,
        status: 'completed',
        timestamp: new Date()
      });
      
      // Update available balance
      await platformWallet.updateAvailableBalance();
      await platformWallet.save();
      await User.findByIdAndUpdate(platformUserId, { walletBalance: platformWallet.balance });
    }

    // Create purchase record
    const purchase = await Purchase.create({
      tenantId: note.tenantId,
      noteId: note._id,
      buyerId: req.user._id,
      sellerId: note.sellerId,
      amount: note.price,
      platformFee: commissionAmount,
      totalAmount,
      sellerEarnings,
      paymentMethod: 'razorpay',
      razorpayPaymentId: razorpay_payment_id,
      status: 'completed',
      purchasedAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Payment verified and purchase completed successfully',
      purchase
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Razorpay key for frontend
// @route   GET /api/razorpay/key
// @access  Public
export const getRazorpayKey = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      key: config.razorpayKeyId
    });
  } catch (error) {
    next(error);
  }
};
