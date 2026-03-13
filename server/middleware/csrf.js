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

  // Use req.originalUrl — it is NEVER modified by Express prefix-stripping
  // (e.g. app.use('/api', limiter) changes req.url but not req.originalUrl).
  const url = req.originalUrl.split('?')[0]; // strip query string

  if (
    url.includes('/auth/signin') ||
    url.includes('/auth/signup') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/google/firebase') ||
    url.includes('/auth/google') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password') ||
    url.includes('/auth/verify-email') ||
    url.includes('/auth/resend-verification') ||
    url.includes('/auth/confirm-email-verified') ||
    url.includes('/auth/csrf-token') ||
    url === '/api/payments/webhook' ||
    url.endsWith('/payments/webhook')
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
