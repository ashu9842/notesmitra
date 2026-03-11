const DEFAULT_TTL_MS = 10 * 60 * 1000;
const replayCache = new Map();

const cleanupCache = () => {
  const now = Date.now();
  for (const [key, expiresAt] of replayCache.entries()) {
    if (expiresAt <= now) {
      replayCache.delete(key);
    }
  }
};

export const replayGuard = (options = {}) => (req, res, next) => {
  const ttlMs = options.ttlMs || DEFAULT_TTL_MS;
  const idempotencyKey = req.headers['x-idempotency-key'];

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length < 12) {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid idempotency key'
    });
  }

  cleanupCache();

  const userPart = req.user?._id ? req.user._id.toString() : 'anonymous';
  const cacheKey = `${userPart}:${req.method}:${req.originalUrl}:${idempotencyKey}`;

  if (replayCache.has(cacheKey)) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate request detected'
    });
  }

  replayCache.set(cacheKey, Date.now() + ttlMs);
  return next();
};
