import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrfToken';
const isProduction = process.env.NODE_ENV === 'production';

const getCsrfCookieOptions = () => ({
  httpOnly: false,
  secure: isProduction,
  // 'none' required for cross-origin deployment so the cookie is sent on
  // cross-site fetch requests AND so the token can be read from the response body.
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000
});

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...valueParts] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(valueParts.join('=') || '');
    return acc;
  }, {});
};

export const setCsrfCookie = (res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
  return token;
};

export const requireCsrf = (req, res, next) => {
  const method = req.method.toUpperCase();
  const requiresProtection = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (!requiresProtection) {
    return next();
  }

  if (
    req.path.startsWith('/api/auth/signin') ||
    req.path.startsWith('/api/auth/signup') ||
    req.path.startsWith('/api/auth/refresh') ||
    req.path.startsWith('/api/auth/google/firebase') ||
    req.path.startsWith('/api/auth/forgot-password') ||
    req.path.startsWith('/api/auth/reset-password') ||
    req.path.startsWith('/api/auth/verify-email') ||
    req.path.startsWith('/api/auth/resend-verification') ||
    req.path.startsWith('/api/auth/confirm-email-verified') ||
    req.path === '/api/payments/webhook'
  ) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie);
  const csrfCookie = cookies[CSRF_COOKIE_NAME];
  const csrfHeader = req.headers['x-csrf-token'];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token'
    });
  }

  return next();
};
