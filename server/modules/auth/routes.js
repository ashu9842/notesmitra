import express from 'express';
import {
  signup,
  signin,
  adminSignin,
  refreshAccessToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  confirmEmailVerified,
  firebaseGoogleAuth,
  resetPasswordViaFirebase,
} from './controller.js';
import { protect } from '../../middleware/auth.js';
import { authLimiter } from '../../config/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';
import {
  signupSchema,
  signinSchema,
  refreshSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from './validator.js';

const router = express.Router();

// Google sign-in via Firebase ID token — NOT rate-limited (short-lived token, one-shot)
router.post('/google/firebase', firebaseGoogleAuth);
// Email verification link (browser redirect — not rate-limited)
router.get('/verify-email/:token', verifyEmail);

// All other auth routes are rate-limited
router.use(authLimiter);

router.post('/signup', validateBody(signupSchema), signup);
router.post('/signin', validateBody(signinSchema), signin);
router.post('/admin/signin', validateBody(signinSchema), adminSignin);
router.post('/refresh', validateBody(refreshSchema), refreshAccessToken);
router.post('/logout', logout);
router.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);
router.post('/reset-password-firebase', resetPasswordViaFirebase);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, validateBody(updateProfileSchema), updateProfile);
router.post('/change-password', protect, changePassword);
router.post('/resend-verification', protect, resendVerification);
router.post('/confirm-email-verified', protect, confirmEmailVerified);

export default router;
