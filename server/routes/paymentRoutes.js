import express from 'express';
import { z } from 'zod';
import {
  purchaseNote,
  razorpayWebhook,
  getPurchases,
  getSales,
  getPurchase,
  refundPurchase
} from '../controllers/paymentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { paymentLimiter, paymentStrictLimiter } from '../config/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { replayGuard } from '../middleware/replayGuard.js';

const router = express.Router();

const purchaseSchema = z.object({
  noteId: z.string().min(1),
  paymentMethod: z.enum(['wallet', 'razorpay'])
});

const refundSchema = z.object({
  reason: z.string().min(3).max(500)
});

router.use(paymentLimiter);

router.post('/webhook', express.raw({ type: 'application/json' }), razorpayWebhook);

router.post('/purchase', paymentStrictLimiter, protect, validateBody(purchaseSchema), replayGuard(), purchaseNote);
router.post('/refund/:id', paymentStrictLimiter, protect, authorize('admin'), validateBody(refundSchema), replayGuard(), refundPurchase);
router.get('/purchases', protect, getPurchases);
router.get('/sales', protect, getSales);
router.get('/purchases/:id', protect, getPurchase);

export default router;
