import express from 'express';
import {
  getAvailablePlans,
  getMySubscription,
  subscribeToPlan,
  activateSubscription,
  cancelSubscription,
  getSubscriptionStats
} from '../controllers/premiumController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public route
router.get('/plans', getAvailablePlans);

// Protected routes
router.use(protect);
router.get('/my-subscription', getMySubscription);
router.post('/subscribe', subscribeToPlan);
router.post('/activate/:subscriptionId', activateSubscription);
router.post('/cancel', cancelSubscription);
router.get('/stats', getSubscriptionStats);

export default router;
