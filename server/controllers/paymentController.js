import {
  purchaseNoteService,
  razorpayWebhookService,
  getPurchasesService,
  getSalesService,
  getPurchaseService,
  refundPurchaseService
} from '../services/paymentService.js';
import config from '../config/index.js';

// @desc    Purchase a note
// @route   POST /api/payments/purchase
// @access  Private
export const purchaseNote = async (req, res, next) => {
  try {
    const { statusCode, payload } = await purchaseNoteService({
      userId: req.user._id,
      noteId: req.body.noteId,
      paymentMethod: req.body.paymentMethod,
      requestContext: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    return res.status(statusCode).json(payload);
  } catch (error) {
    next(error);
  }
};

// @desc    Razorpay webhook handler
// @route   POST /api/payments/webhook
// @access  Public (signature verified)
export const razorpayWebhook = async (req, res, next) => {
  try {
    const { statusCode, payload } = await razorpayWebhookService({
      signature: req.headers['x-razorpay-signature'],
      secret: config.razorpayWebhookSecret,
      body: req.body,
      requestContext: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    return res.status(statusCode).json(payload);
  } catch (error) {
    return next(error);
  }
};

// @desc    Get user's purchases
// @route   GET /api/payments/purchases
// @access  Private
export const getPurchases = async (req, res, next) => {
  try {
    const { statusCode, payload } = await getPurchasesService({
      userId: req.user._id,
      page: req.query.page,
      limit: req.query.limit
    });
    res.status(statusCode).json(payload);
  } catch (error) {
    next(error);
  }
};

// @desc    Get seller's sales
// @route   GET /api/payments/sales
// @access  Private (Seller)
export const getSales = async (req, res, next) => {
  try {
    const { statusCode, payload } = await getSalesService(req.user._id);
    res.status(statusCode).json(payload);
  } catch (error) {
    next(error);
  }
};

// @desc    Get purchase by ID
// @route   GET /api/payments/purchases/:id
// @access  Private
export const getPurchase = async (req, res, next) => {
  try {
    const { statusCode, payload } = await getPurchaseService({
      purchaseId: req.params.id,
      userId: req.user._id,
      userRole: req.user.role
    });

    res.status(statusCode).json(payload);
  } catch (error) {
    next(error);
  }
};

// @desc    Refund a purchase
// @route   POST /api/payments/refund/:id
// @access  Private (Admin)
export const refundPurchase = async (req, res, next) => {
  try {
    const { statusCode, payload } = await refundPurchaseService({
      purchaseId: req.params.id,
      reason: req.body.reason,
      requestContext: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    return res.status(statusCode).json(payload);
  } catch (error) {
    return next(error);
  }
};
