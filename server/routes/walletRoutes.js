import express from 'express';
import {
  getWallet,
  addFunds,
  withdrawFunds,
  getTransactions,
  getPendingWithdrawals,
  completeWithdrawal,
} from '../controllers/walletController.js';
import { protect } from '../middleware/auth.js';
import { requireRole } from '../middleware/authz.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.get('/', protect, getWallet);
router.post('/add-funds', protect, addFunds);
router.post('/withdraw', protect, withdrawFunds);
router.get('/transactions', protect, getTransactions);
router.get('/admin/pending-withdrawals', protect, requireRole(ROLES.ADMIN), getPendingWithdrawals);
router.post('/admin/complete-withdrawal', protect, requireRole(ROLES.ADMIN), completeWithdrawal);

export default router;
