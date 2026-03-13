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
import { setCsrfCookie } from '../../middleware/csrf.js';
import { successResponse } from '../../utils/response.js';
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
// Backward-compat endpoint used by older clients
router.post('/google', firebaseGoogleAuth);
// Email verification link (browser redirect — not rate-limited)
router.get('/verify-email/:token', verifyEmail);

// CSRF token endpoint — called on app init so the frontend can obtain a fresh
// token even without logging in (needed for cross-origin SameSite=None setup).
router.get('/csrf-token', (req, res) => {
  const csrfToken = setCsrfCookie(res);
  return successResponse(res, { csrfToken });
});

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
