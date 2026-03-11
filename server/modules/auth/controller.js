import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { verifyFirebaseToken, isFirebaseEnabled } from '../../config/firebase.js';
import { emitAdminStatsUpdate } from '../../services/paymentService.js';
import AppError from '../../utils/AppError.js';
import { ROLES, ERROR_CODES } from '../../config/constants.js';
import { AuthService } from './service.js';
import { AuthRepository } from './repository.js';
import { setCsrfCookie } from '../../middleware/csrf.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { AUTH_COOKIES, AUTH_TOKEN_TYPES } from '../../config/constants.js';
import { dispatchEmail } from '../../jobs/index.js';
import { sendEmail } from '../../utils/email.js';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';

const ACCESS_COOKIE_NAME = AUTH_COOKIES.ACCESS;
const REFRESH_COOKIE_NAME = AUTH_COOKIES.REFRESH;

const isProduction = process.env.NODE_ENV === 'production';

const getCookieOptions = (type) => {
  const baseOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax'
  };

  if (type === AUTH_TOKEN_TYPES.ACCESS) {
    return {
      ...baseOptions,
      maxAge: 15 * 60 * 1000
    };
  }

  return {
    ...baseOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
};

// clearCookie must NOT include maxAge (that would re-set expiry instead of deleting).
// Only path/domain/sameSite/secure must match the original Set-Cookie header.
const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax'
});

const authRepository = new AuthRepository();
const authService = new AuthService({
  repository: authRepository,
  jwt,
  crypto,
  AppError,
  constants: { 
    ROLES, 
    ERROR_CODES,
    jwtAccessSecret: config.jwtAccessSecret,
    jwtAccessExpire: config.jwtAccessExpire
  },
  emitAdminStatsUpdate
});

// Helper: generate and save a verification token for a user
const generateVerificationToken = async (userId) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  await authRepository.updateUserById(
    userId,
    {
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    },
    { new: true }
  );
  return rawToken;
};

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req, res) => {
  try {
    const { user, accessToken, refreshToken } = await authService.signupUser(req.body);

    res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(AUTH_TOKEN_TYPES.ACCESS));
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(AUTH_TOKEN_TYPES.REFRESH));
    setCsrfCookie(res);

    // Email verification is handled by Firebase on the frontend (sendFirebaseVerificationEmail).
    // The backend marks isEmailVerified = true via POST /auth/confirm-email-verified
    // once Firebase reports the email as verified.

    res.status(201);
    return successResponse(res, { user });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Login user (Buyer/Seller)
// @route   POST /api/auth/signin
// @access  Public
export const signin = async (req, res) => {
  try {
    const { user, accessToken, refreshToken } = await authService.signinUser(req.body);

    // Prevent admin from using regular signin endpoint
    if (user.role === ROLES.ADMIN) {
      return errorResponse(res, new AppError('Admin account detected. Please use admin login portal.', 403, ERROR_CODES.AUTH));
    }

    res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(AUTH_TOKEN_TYPES.ACCESS));
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(AUTH_TOKEN_TYPES.REFRESH));
    setCsrfCookie(res);

    res.status(200);
    return successResponse(res, { user });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Admin Login
// @route   POST /api/auth/admin/signin
// @access  Public
export const adminSignin = async (req, res) => {
  try {
    const { user, accessToken, refreshToken } = await authService.signinUser(req.body);

    // Only admin users can login via this endpoint
    if (user.role !== ROLES.ADMIN) {
      return errorResponse(res, new AppError('Invalid admin credentials. Please check your email and password.', 403, ERROR_CODES.AUTH));
    }

    res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(AUTH_TOKEN_TYPES.ACCESS));
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(AUTH_TOKEN_TYPES.REFRESH));
    setCsrfCookie(res);

    res.status(200);
    return successResponse(res, { user });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshAccessToken = async (req, res) => {
  try {
    const { accessToken } = await authService.refreshAccessTokenForUser({
      refreshToken: req.body.refreshToken,
      cookieHeader: req.headers.cookie,
      refreshCookieName: REFRESH_COOKIE_NAME
    });

    res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(AUTH_TOKEN_TYPES.ACCESS));
    setCsrfCookie(res);

    res.status(200);
    return successResponse(res, {}, 'Access token refreshed');
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    await authService.logoutUser({
      cookieHeader: req.headers.cookie,
      refreshCookieName: REFRESH_COOKIE_NAME
    });

    res.clearCookie(ACCESS_COOKIE_NAME, getClearCookieOptions());
    res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());

    res.status(200);
    return successResponse(res, {}, 'Logged out successfully');
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = async (req, res) => {
  try {
    const user = await authService.getUserProfile(req.user._id);

    res.status(200);
    return successResponse(res, { user });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const user = await authService.updateUserProfile({
      userId: req.user._id,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone
    });

    res.status(200);
    return successResponse(res, { user });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Change user password
// @route   POST /api/auth/change-password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const user = await authService.changeUserPassword({
      userId: req.user._id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword
    });

    res.status(200);
    return successResponse(res, { user }, 'Password changed successfully');
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Verify email address via token link
// @desc    Mark the authenticated user's email as verified (called after Firebase confirms)
// @route   POST /api/auth/confirm-email-verified
// @access  Private
export const confirmEmailVerified = async (req, res) => {
  try {
    await authRepository.updateUserById(
      req.user._id,
      { isEmailVerified: true },
      { new: true }
    );
    return successResponse(res, {}, 'Email verified successfully.');
  } catch (error) {
    return errorResponse(res, error);
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await authRepository.findUserByVerificationToken(hashedToken);

    if (!user) {
      return res.redirect(`${config.clientUrl}?verifyResult=invalid`);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.redirect(`${config.clientUrl}?verifyResult=success`);
  } catch (error) {
    return res.redirect(`${config.clientUrl}?verifyResult=error`);
  }
};

// @desc    Resend email verification link
// @route   POST /api/auth/resend-verification
// @access  Private
export const resendVerification = async (req, res) => {
  try {
    const user = await authRepository.findUserById(req.user._id);

    if (!user) {
      return errorResponse(res, new AppError('User not found.', 404, ERROR_CODES.AUTH));
    }
    if (user.isEmailVerified) {
      res.status(200);
      return successResponse(res, {}, 'Your email is already verified.');
    }

    const rawToken = await generateVerificationToken(user._id);
    const verifyUrl = `${config.clientUrl}?verifyToken=${rawToken}`;

    dispatchEmail({
      to: user.email,
      subject: 'Verify Your NotesMitra Email',
      body: `Hi ${user.name},\n\nPlease verify your email address by clicking the link below (valid for 24 hours):\n\n${verifyUrl}\n\nIf you did not create an account, you can ignore this email.`,
      type: 'verify_email',
      priority: 2
    }).catch(() => {});

    res.status(200);
    return successResponse(res, {}, 'Verification email sent. Please check your inbox.');
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Send password reset email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await authRepository.findUserByEmail(email, { includePassword: false });

    // Always respond with success to prevent email enumeration
    if (!user) {
      res.status(200);
      return successResponse(res, {}, 'If that email is registered, a reset link has been sent.');
    }

    if (user.googleId && !user.password) {
      res.status(200);
      return successResponse(res, { isGoogleAccount: true }, 'This account uses Google sign-in. Use "Continue with Google" to log in instead.');
    }

    // Generate a secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${config.clientUrl}?resetToken=${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset Your NotesMitra Password',
        body: `Hi ${user.name},\n\nYou requested a password reset.\n\nClick the link below to reset your password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
      });
    } catch (emailErr) {
      logger.error('Failed to send password reset email', { error: emailErr.message, to: user.email });
      // Don't expose failure — still respond with generic success
    }

    res.status(200);
    return successResponse(res, {}, 'If that email is registered, a reset link has been sent.');
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await authRepository.findUserByResetToken(hashedToken);
    if (!user) {
      return errorResponse(res, new AppError('Reset link is invalid or has expired.', 400, ERROR_CODES.AUTH));
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200);
    return successResponse(res, {}, 'Password reset successful. You can now log in.');
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Reset MongoDB password using a Firebase email-link ID token
// @route   POST /api/auth/reset-password-firebase
// @access  Public (identity verified via Firebase ID token)
export const resetPasswordViaFirebase = async (req, res) => {
  try {
    if (!isFirebaseEnabled()) {
      return errorResponse(res, new AppError('Firebase is not configured on this server.', 503, ERROR_CODES.AUTH));
    }

    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.length < 6) {
      return errorResponse(res, new AppError('Password must be at least 6 characters.', 400, ERROR_CODES.VALIDATION));
    }

    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return errorResponse(res, new AppError('No Firebase token provided.', 401, ERROR_CODES.AUTH));
    }

    let decoded;
    try {
      decoded = await verifyFirebaseToken(idToken);
    } catch {
      return errorResponse(res, new AppError('Reset link is invalid or expired. Please request a new one.', 401, ERROR_CODES.AUTH));
    }

    if (!decoded?.email) {
      return errorResponse(res, new AppError('Could not verify email from reset link.', 401, ERROR_CODES.AUTH));
    }

    const user = await authRepository.findUserByEmail(decoded.email, { includePassword: false });
    if (!user) {
      return errorResponse(res, new AppError('No account found for this email. Please sign up.', 404, ERROR_CODES.AUTH));
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200);
    return successResponse(res, {}, 'Password reset successful. You can now log in.');
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Verify a Firebase ID token and sign in / register the user
// @route   POST /api/auth/google/firebase
// @access  Public
export const firebaseGoogleAuth = async (req, res) => {
  try {
    if (!isFirebaseEnabled()) {
      return errorResponse(res, new AppError('Google sign-in is not configured on this server.', 503, ERROR_CODES.AUTH));
    }

    const { idToken } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      return errorResponse(res, new AppError('idToken is required.', 400, ERROR_CODES.VALIDATION));
    }

    // Verify the token with Firebase Admin SDK
    let decoded;
    try {
      decoded = await verifyFirebaseToken(idToken);
    } catch {
      return errorResponse(res, new AppError('Invalid or expired Google token.', 401, ERROR_CODES.AUTH));
    }

    const { uid, email, name, picture } = decoded;
    if (!email) {
      return errorResponse(res, new AppError('Google account must have an email address.', 400, ERROR_CODES.AUTH));
    }

    // Find or create the user
    const user = await authService.findOrCreateGoogleUser({ googleId: uid, email, name, picture });

    const { accessToken, refreshToken } = await authService.issueTokensForUser(user);

    res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(AUTH_TOKEN_TYPES.ACCESS));
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(AUTH_TOKEN_TYPES.REFRESH));
    setCsrfCookie(res);

    res.status(200);
    return successResponse(res, { user });
  } catch (error) {
    return errorResponse(res, error);
  }
};
