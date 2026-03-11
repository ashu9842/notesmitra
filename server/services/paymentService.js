import Purchase from '../models/Purchase.js';
import Note from '../models/Note.js';
import Wallet from '../models/Wallet.js';
import User from '../models/User.js';
import PaymentLog from '../models/PaymentLog.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import config from '../config/index.js';
import { emitToSeller, emitToUser, emitToAdmins } from '../socketServer.js';
import { runTransaction } from '../utils/dbTransaction.js';
import * as cache from '../utils/cache.js';
import { dispatchPaymentLog } from '../jobs/index.js';
import logger from '../utils/logger.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getRequestContext = (requestContext = {}) => ({
  ip: requestContext.ip,
  userAgent: requestContext.userAgent
});

/**
 * Calculate pricing with premium benefits
 * @param {number} notePrice - Original note price
 * @param {Object} user - User object with premium info
 * @returns {Object} - Pricing breakdown
 */
const calculatePremiumPricing = async (notePrice, userId) => {
  const user = await User.findById(userId).select(
    'isPremiumBuyer subscriptionType subscriptionExpiry'
  );

  const hasActiveSubscription = user && user.hasActiveSubscription();
  const isPremiumBuyer = user && (user.isPremiumBuyer || user.subscriptionType === 'combo') && hasActiveSubscription;

  // Apply discount for premium buyers (5-10% random)
  let discountPercentage = 0;
  let discountAmount = 0;
  
  if (isPremiumBuyer) {
    // Random discount between 5-10%
    discountPercentage = Math.floor(Math.random() * 6) + 5; // 5 to 10
    discountAmount = Number((notePrice * discountPercentage / 100).toFixed(2));
  }

  const priceAfterDiscount = Number((notePrice - discountAmount).toFixed(2));

  // Premium buyers pay 0% gateway fee; free buyers pay 2%
  const gatewayFee = isPremiumBuyer ? 0 : Number((priceAfterDiscount * 0.02).toFixed(2));

  // 20% service charge deducted from seller's share (18% service + 2% seller platform fee)
  // Controlled by PLATFORM_FEE_PERCENT=20 in .env
  const serviceFeeRate = config.platformFeePercent / 100;
  const serviceFee = Number((priceAfterDiscount * serviceFeeRate).toFixed(2));

  // Buyer pays: note price + 2% transaction fee
  const totalAmount = Number((priceAfterDiscount + gatewayFee).toFixed(2));

  // Seller receives 80% of the note price
  const sellerEarnings = Number((priceAfterDiscount - serviceFee).toFixed(2));

  // Platform receives: 2% from buyer + 20% from seller = 22% of note price
  const commissionAmount = Number((gatewayFee + serviceFee).toFixed(2));

  return {
    originalPrice: notePrice,
    discountPercentage,
    discountAmount,
    priceAfterDiscount,
    commissionAmount,
    gatewayFee,
    totalAmount,
    sellerEarnings,
    isPremiumBuyer,
    savings: discountAmount + gatewayFee
  };
};

const logPaymentEvent = async ({
  requestContext,
  eventType,
  source,
  purchase,
  statusFrom,
  statusTo,
  razorpayPaymentId,
  payload
}) => {
  try {
    const { ip, userAgent } = getRequestContext(requestContext);
    
    // Dispatch to background job queue (non-blocking)
    await dispatchPaymentLog({
      eventType,
      source,
      purchase,
      statusFrom,
      statusTo,
      razorpayPaymentId,
      ip,
      userAgent,
      payload
    });
  } catch (error) {
    logger.warn('Payment log dispatch failed', { error: error.message });
  }
};

const getIO = () => {
  try {
    if (typeof global !== 'undefined' && global.io) {
      return global.io;
    }
  } catch (error) {
    logger.warn('Could not access global io instance', { error: error.message });
  }
  return null;
};

const emitPurchaseCompletedEvent = async (purchase, note) => {
  try {
    const io = getIO();

    if (!io) {
      logger.warn('Socket.io not available for purchase event emission');
      return;
    }

    const buyer = await User.findById(purchase.buyerId).select('name');
    const seller = await User.findById(purchase.sellerId).select('name');

    if (!buyer || !seller) {
      logger.warn('Buyer or seller not found for purchase event');
      return;
    }

    const eventData = {
      purchaseId: purchase._id,
      noteTitle: note?.title || 'Deleted Note',
      buyerName: buyer.name,
      amount: purchase.amount,
      sellerEarnings: purchase.sellerEarnings
    };

    emitToSeller(io, purchase.sellerId, 'purchase:completed', eventData);
    logger.info('Purchase event emitted to seller', { sellerName: seller.name, sellerId: purchase.sellerId });
  } catch (error) {
    logger.warn('Failed to emit purchase:completed event', { error: error.message });
  }
};

const emitWalletUpdatedEvent = async (buyerId, newBalance) => {
  try {
    const io = getIO();

    if (!io) {
      logger.warn('Socket.io not available for wallet event emission');
      return;
    }

    const eventData = {
      newBalance
    };

    emitToUser(io, buyerId, 'wallet:updated', eventData);
    logger.info('Wallet update event emitted to buyer', { buyerId, newBalance });
  } catch (error) {
    logger.warn('Failed to emit wallet:updated event', { error: error.message });
  }
};

export const emitAdminStatsUpdate = async () => {
  try {
    // Invalidate admin stats cache
    await cache.del('admin:stats');

    const io = getIO();

    if (!io) {
      logger.warn('Socket.io not available for admin stats emission');
      return;
    }

    const totalUsers = await User.countDocuments();
    const totalNotes = await Note.countDocuments();
    const totalPurchases = await Purchase.countDocuments();

    const notesByStatus = await Note.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const purchasesByStatus = await Purchase.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const totalRevenue = await Purchase.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$platformFee' } } }
    ]);

    const totalPlatformEarnings = totalRevenue[0]?.total || 0;

    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const eventData = {
      totalUsers,
      totalNotes,
      totalPurchases,
      totalPlatformEarnings,
      notesByStatus: notesByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      purchasesByStatus: purchasesByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };

    emitToAdmins(io, 'admin:stats:update', eventData);

    logger.info('Admin stats updated', { totalUsers, totalNotes, totalPurchases });
  } catch (error) {
    logger.warn('Failed to emit admin:stats:update event', { error: error.message });
  }
};

export const purchaseNoteService = async ({ userId, noteId, paymentMethod, requestContext }) => {
  if (!noteId || !paymentMethod) {
    throw createError('Please provide noteId and paymentMethod', 400);
  }

  const note = await Note.findById(noteId);

  if (!note) {
    throw createError('Note not found', 404);
  }

  if (note.status !== 'approved') {
    throw createError('Note is not available for purchase', 400);
  }

  const existingPurchase = await Purchase.findOne({
    buyerId: userId,
    noteId: note._id
  });

  if (existingPurchase) {
    throw createError('You have already purchased this note', 400);
  }

  // Calculate pricing with premium benefits
  const pricing = await calculatePremiumPricing(note.price, userId);

  const {
    originalPrice,
    discountPercentage,
    discountAmount,
    priceAfterDiscount,
    commissionAmount,
    gatewayFee,
    totalAmount,
    sellerEarnings,
    isPremiumBuyer,
    savings
  } = pricing;

  if (paymentMethod === 'wallet') {
    const transactionResult = await runTransaction(async (session) => {
      const platformUserId = config.platformUserId;

      const latestPurchase = await Purchase.findOne({
        buyerId: userId,
        noteId: note._id
      }).session(session);

      if (latestPurchase) {
        throw createError('You have already purchased this note', 400);
      }

      const buyerWallet = await Wallet.findOne({ userId }).session(session);

      if (!buyerWallet || buyerWallet.balance < totalAmount) {
        throw createError('Insufficient wallet balance', 400);
      }

      buyerWallet.balance -= totalAmount;
      buyerWallet.transactions.unshift({
        id: `txn_${uuidv4()}`,
        type: 'debit',
        amount: totalAmount,
        description: `Purchase: ${note.title}`,
        status: 'completed',
        timestamp: new Date()
      });
      await buyerWallet.save({ session });

      await User.findByIdAndUpdate(
        userId,
        {
          walletBalance: buyerWallet.balance,
          $inc: { totalSpent: totalAmount }
        },
        { session }
      );

      let sellerWallet = await Wallet.findOne({ userId: note.sellerId }).session(session);

      if (!sellerWallet) {
        sellerWallet = await Wallet.create([
          {
            userId: note.sellerId,
            tenantId: note.tenantId,
            balance: 0,
            transactions: []
          }
        ], { session });
        sellerWallet = sellerWallet[0];
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
      await sellerWallet.save({ session });

      await User.findByIdAndUpdate(
        note.sellerId,
        {
          walletBalance: sellerWallet.balance,
          $inc: { totalEarnings: sellerEarnings }
        },
        { session }
      );

      // Credit platform commission wallet only if PLATFORM_USER_ID is configured
      if (platformUserId) {
        let platformWallet = await Wallet.findOne({ userId: platformUserId }).session(session);

        if (!platformWallet) {
          platformWallet = await Wallet.create([
            {
              userId: platformUserId,
              balance: 0,
              transactions: []
            }
          ], { session });
          platformWallet = platformWallet[0];
        }

        platformWallet.balance += commissionAmount;
        platformWallet.transactions.unshift({
          id: `txn_${uuidv4()}`,
          type: 'credit',
          amount: commissionAmount,
          description: `Platform Fee (Txn 2% + Service 20%): ${note.title}`,
          status: 'completed',
          timestamp: new Date()
        });
        await platformWallet.save({ session });

        await User.findByIdAndUpdate(
          platformUserId,
          { walletBalance: platformWallet.balance },
          { session }
        );
      }

      const purchase = await Purchase.create([
        {
          tenantId: note.tenantId,
          noteId: note._id,
          buyerId: userId,
          sellerId: note.sellerId,
          amount: priceAfterDiscount,
          platformFee: commissionAmount,
          totalAmount,
          sellerEarnings,
          paymentMethod,
          status: 'completed',
          purchasedAt: new Date()
        }
      ], { session });

      return {
        purchase: purchase[0],
        buyerBalance: buyerWallet.balance
      };
    });

    await emitPurchaseCompletedEvent(transactionResult.purchase, note);
    await emitWalletUpdatedEvent(userId, transactionResult.buyerBalance);
    await emitAdminStatsUpdate();

    await logPaymentEvent({
      requestContext,
      eventType: 'purchase.completed',
      source: 'purchase',
      purchase: transactionResult.purchase,
      statusFrom: 'processing',
      statusTo: 'completed'
    });

    return {
      statusCode: 201,
      payload: {
        success: true,
        purchase: transactionResult.purchase,
        pricing: {
          originalPrice,
          discount: discountAmount,
          discountPercentage,
          gatewayFee,
          finalPrice: totalAmount,
          isPremiumBuyer,
          savings
        },
        message: isPremiumBuyer 
          ? `Premium discount applied! Saved ₹${savings.toFixed(2)}` 
          : 'Purchase completed successfully'
      }
    };
  }

  const pendingPurchase = await Purchase.create({
    tenantId: note.tenantId,
    noteId: note._id,
    buyerId: userId,
    sellerId: note.sellerId,
    amount: priceAfterDiscount,
    platformFee: commissionAmount,
    totalAmount,
    sellerEarnings,
    paymentMethod,
    status: 'pending',
    purchasedAt: new Date()
  });

  await logPaymentEvent({
    requestContext,
    eventType: 'purchase.pending',
    source: 'purchase',
    purchase: pendingPurchase,
    statusFrom: 'processing',
    statusTo: 'pending'
  });

  return {
    statusCode: 202,
    payload: {
      success: true,
      purchase: pendingPurchase
    }
  };
};

export const razorpayWebhookService = async ({
  signature,
  secret,
  body,
  requestContext
}) => {
  if (!secret) {
    logger.warn('Razorpay webhook secret is missing');
    throw createError('Webhook secret not configured', 500);
  }

  const bodyBuffer = Buffer.isBuffer(body)
    ? body
    : Buffer.from(JSON.stringify(body || {}));

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(bodyBuffer)
    .digest('hex');

  if (!signature || signature !== expectedSignature) {
    const rawPayload = Buffer.isBuffer(body)
      ? body.toString('utf8')
      : JSON.stringify(body || {});

    await logPaymentEvent({
      requestContext,
      eventType: 'webhook.invalid_signature',
      source: 'webhook',
      statusFrom: null,
      statusTo: null,
      payload: rawPayload,
      razorpayPaymentId: null
    });

    logger.warn('Suspicious webhook request', {
      ip: requestContext?.ip,
      signature
    });

    throw createError('Invalid webhook signature', 400);
  }

  const payload = Buffer.isBuffer(body)
    ? JSON.parse(body.toString('utf8'))
    : body;

  await logPaymentEvent({
    requestContext,
    eventType: payload?.event || 'webhook.unknown',
    source: 'webhook',
    statusFrom: null,
    statusTo: null,
    payload,
    razorpayPaymentId: payload?.payload?.payment?.entity?.id
  });

  if (payload?.event !== 'payment.captured') {
    return { statusCode: 200, payload: { success: true } };
  }

  const paymentEntity = payload?.payload?.payment?.entity;
  const notes = paymentEntity?.notes || {};
  const buyerId = notes.userId;
  const noteId = notes.noteId;
  const razorpayPaymentId = paymentEntity?.id;
  // Read premium context stored at order creation time
  const webhookIsPremiumBuyer = notes.isPremiumBuyer === 'true';
  const webhookDiscountPct = parseInt(notes.discountPercentage || '0', 10);

  if (!buyerId || !noteId) {
    logger.warn('Webhook missing note or user details', {
      ip: requestContext?.ip,
      event: payload?.event
    });
    throw createError('Missing purchase metadata', 400);
  }

  const note = await Note.findById(noteId);

  if (!note) {
    throw createError('Note not found', 404);
  }

  const grossAmount = note.price;
  const discountAmount = Number((grossAmount * webhookDiscountPct / 100).toFixed(2));
  const priceAfterDiscount = Number((grossAmount - discountAmount).toFixed(2));
  // Premium buyers paid 0% gateway fee; free buyers paid 2%
  const gatewayFee = webhookIsPremiumBuyer ? 0 : Number((priceAfterDiscount * 0.02).toFixed(2));
  const serviceFeeRate = config.platformFeePercent / 100; // 20%
  const serviceFee = Number((priceAfterDiscount * serviceFeeRate).toFixed(2));
  const commissionAmount = Number((gatewayFee + serviceFee).toFixed(2));
  const netPayout = Number((priceAfterDiscount - serviceFee).toFixed(2)); // seller gets 80% of discounted price
  const totalAmount = Number((priceAfterDiscount + gatewayFee).toFixed(2)); // actual amount buyer paid

  let purchase = null;

  if (razorpayPaymentId) {
    purchase = await Purchase.findOne({ razorpayPaymentId });

    if (purchase && purchase.status === 'completed') {
      return { statusCode: 200, payload: { success: true, purchase } };
    }
  }

  if (!purchase) {
    purchase = await Purchase.findOne({
      buyerId,
      noteId,
      status: 'pending'
    });
  }

  if (!purchase) {
    purchase = await Purchase.create({
      tenantId: note.tenantId,
      noteId: note._id,
      buyerId,
      sellerId: note.sellerId,
      amount: grossAmount,
      platformFee: commissionAmount,
      totalAmount,
      sellerEarnings: netPayout,
      paymentMethod: 'razorpay',
      razorpayPaymentId,
      status: 'pending',
      purchasedAt: new Date()
    });
  } else if (razorpayPaymentId && !purchase.razorpayPaymentId) {
    purchase.razorpayPaymentId = razorpayPaymentId;
    await purchase.save();
  }

  let sellerWallet = await Wallet.findOne({ userId: note.sellerId });

  if (!sellerWallet) {
    sellerWallet = await Wallet.create({
      userId: note.sellerId,
      tenantId: note.tenantId,
      balance: 0,
      transactions: []
    });
  }

  sellerWallet.balance += netPayout;
  sellerWallet.transactions.unshift({
    id: `txn_${uuidv4()}`,
    type: 'credit',
    amount: netPayout,
    description: `Sale: ${note.title}`,
    status: 'completed',
    timestamp: new Date()
  });
  await sellerWallet.save();

  await User.findByIdAndUpdate(note.sellerId, {
    walletBalance: sellerWallet.balance,
    $inc: { totalEarnings: netPayout }
  });

  await User.findByIdAndUpdate(buyerId, {
    $inc: { totalSpent: totalAmount }
  });

  // Credit platform wallet with full commission (2% from buyer + 20% from seller = 22%)
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
    platformWallet.balance += commissionAmount;
    platformWallet.transactions.unshift({
      id: `txn_${uuidv4()}`,
      type: 'credit',
      amount: commissionAmount,
      description: `Platform Fee (Gateway ${webhookIsPremiumBuyer ? '0' : '2'}% + Service 20%): ${note.title}`,
      status: 'completed',
      timestamp: new Date()
    });
    await platformWallet.save();
    await User.findByIdAndUpdate(platformUserId, { walletBalance: platformWallet.balance });
  }

  const previousStatus = purchase.status;
  const updatedPurchase = await Purchase.findOneAndUpdate(
    { _id: purchase._id, status: { $ne: 'completed' } },
    { status: 'completed', purchasedAt: new Date() },
    { new: true }
  );

  if (updatedPurchase && updatedPurchase.status === 'completed') {
    await emitPurchaseCompletedEvent(updatedPurchase, note);
    await emitAdminStatsUpdate();
  }

  await logPaymentEvent({
    requestContext,
    eventType: 'payment.completed',
    source: 'webhook',
    purchase: updatedPurchase || purchase,
    statusFrom: previousStatus,
    statusTo: 'completed',
    razorpayPaymentId
  });

  return {
    statusCode: 200,
    payload: {
      success: true,
      purchase: updatedPurchase || purchase
    }
  };
};

export const getPurchasesService = async ({ userId, page = 1, limit = 10 }) => {
  const normalizedPage = Math.max(parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (normalizedPage - 1) * normalizedLimit;

  const query = { buyerId: userId, status: 'completed' };
  const totalCount = await Purchase.countDocuments(query).maxTimeMS(5000);

  const purchases = await Purchase.find(query)
    .select('noteId sellerId buyerId amount sellerEarnings platformFee status paymentMethod createdAt')
    .populate('noteId', 'title subject semester price')
    .populate('sellerId', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(normalizedLimit)
    .maxTimeMS(5000)
    .lean();

  const formattedPurchases = purchases.map((purchase) => ({
    ...purchase,
    noteTitle: purchase.noteId?.title || 'Deleted Note',
    noteSubject: purchase.noteId?.subject || 'N/A',
    sellerName: purchase.sellerId?.name || 'Unknown'
  }));

  return {
    statusCode: 200,
    payload: {
      success: true,
      count: purchases.length,
      totalCount,
      totalPages: Math.ceil(totalCount / normalizedLimit),
      page: normalizedPage,
      limit: normalizedLimit,
      purchases: formattedPurchases
    }
  };
};

export const getSalesService = async (userId) => {
  const sales = await Purchase.find({ sellerId: userId })
    .populate('noteId', 'title subject semester price')
    .populate('buyerId', 'name email')
    .sort({ createdAt: -1 });

  const totalEarnings = sales.reduce((sum, sale) => sum + sale.sellerEarnings, 0);

  return {
    statusCode: 200,
    payload: {
      success: true,
      count: sales.length,
      totalEarnings,
      sales
    }
  };
};

export const getPurchaseService = async ({ purchaseId, userId, userRole }) => {
  const purchase = await Purchase.findById(purchaseId)
    .populate('noteId')
    .populate('buyerId', 'name email')
    .populate('sellerId', 'name email');

  if (!purchase) {
    throw createError('Purchase not found', 404);
  }

  if (
    purchase.buyerId._id.toString() !== userId.toString() &&
    purchase.sellerId._id.toString() !== userId.toString() &&
    userRole !== 'admin'
  ) {
    throw createError('Not authorized to view this purchase', 403);
  }

  return {
    statusCode: 200,
    payload: {
      success: true,
      purchase
    }
  };
};

export const refundPurchaseService = async ({
  purchaseId,
  reason,
  requestContext
}) => {
  const transactionResult = await runTransaction(async (session) => {
    if (!reason || typeof reason !== 'string') {
      throw createError('Refund reason is required', 400);
    }

    const purchase = await Purchase.findById(purchaseId).session(session);

    if (!purchase) {
      throw createError('Purchase not found', 404);
    }

    if (purchase.status === 'refunded') {
      return {
        shouldLog: false,
        purchase
      };
    }

    if (purchase.status !== 'completed') {
      throw createError('Only completed purchases can be refunded', 400);
    }

    const platformUserId = config.platformUserId;
    if (!platformUserId) {
      throw createError('Platform commission account not configured', 500);
    }

    const sellerWallet = await Wallet.findOne({ userId: purchase.sellerId }).session(session);
    if (!sellerWallet || sellerWallet.balance < purchase.sellerEarnings) {
      throw createError('Seller wallet balance insufficient for refund', 400);
    }

    sellerWallet.balance -= purchase.sellerEarnings;
    sellerWallet.transactions.unshift({
      id: `txn_${uuidv4()}`,
      type: 'debit',
      amount: purchase.sellerEarnings,
      description: `Refund: ${purchase.noteId}`,
      status: 'completed',
      timestamp: new Date()
    });
    await sellerWallet.save({ session });

    await User.findByIdAndUpdate(
      purchase.sellerId,
      {
        walletBalance: sellerWallet.balance,
        $inc: { totalEarnings: -purchase.sellerEarnings }
      },
      { session }
    );

    const platformWallet = await Wallet.findOne({ userId: platformUserId }).session(session);
    if (platformWallet && platformWallet.balance >= purchase.platformFee) {
      platformWallet.balance -= purchase.platformFee;
      platformWallet.transactions.unshift({
        id: `txn_${uuidv4()}`,
        type: 'debit',
        amount: purchase.platformFee,
        description: `Refund commission: ${purchase.noteId}`,
        status: 'completed',
        timestamp: new Date()
      });
      await platformWallet.save({ session });

      await User.findByIdAndUpdate(
        platformUserId,
        { walletBalance: platformWallet.balance },
        { session }
      );
    }

    if (purchase.paymentMethod === 'wallet') {
      const buyerWallet = await Wallet.findOne({ userId: purchase.buyerId }).session(session);

      if (!buyerWallet) {
        throw createError('Buyer wallet not found', 400);
      }

      buyerWallet.balance += purchase.totalAmount;
      buyerWallet.transactions.unshift({
        id: `txn_${uuidv4()}`,
        type: 'credit',
        amount: purchase.totalAmount,
        description: `Refund: ${purchase.noteId}`,
        status: 'completed',
        timestamp: new Date()
      });
      await buyerWallet.save({ session });

      await User.findByIdAndUpdate(
        purchase.buyerId,
        {
          walletBalance: buyerWallet.balance,
          $inc: { totalSpent: -purchase.totalAmount }
        },
        { session }
      );
    } else {
      await User.findByIdAndUpdate(
        purchase.buyerId,
        { $inc: { totalSpent: -purchase.totalAmount } },
        { session }
      );
    }

    const previousStatus = purchase.status;
    purchase.status = 'refunded';
    purchase.refundReason = reason.trim();
    await purchase.save({ session });

    return {
      shouldLog: true,
      purchase,
      previousStatus
    };
  });

  if (transactionResult.shouldLog) {
    await logPaymentEvent({
      requestContext,
      eventType: 'refund.completed',
      source: 'refund',
      purchase: transactionResult.purchase,
      statusFrom: transactionResult.previousStatus,
      statusTo: 'refunded'
    });
  }

  return {
    statusCode: 200,
    payload: {
      success: true,
      purchase: transactionResult.purchase
    }
  };
};
