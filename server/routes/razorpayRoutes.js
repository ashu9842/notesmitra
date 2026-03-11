import express from 'express';
import {
  createWalletOrder,
  verifyWalletPayment,
  createPremiumOrder,
  verifyPremiumPayment,
  createNoteOrder,
  verifyNotePayment,
  getRazorpayKey
} from '../controllers/razorpayController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/key', getRazorpayKey);
router.post('/create-order/wallet', protect, createWalletOrder);
router.post('/verify-payment/wallet', protect, verifyWalletPayment);
router.post('/create-order/premium', protect, createPremiumOrder);
router.post('/verify-payment/premium', protect, verifyPremiumPayment);
router.post('/create-order/note', protect, createNoteOrder);
router.post('/verify-payment/note', protect, verifyNotePayment);

export default router;
