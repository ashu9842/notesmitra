import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';
import config from './index.js';

const require = createRequire(import.meta.url);

const isDevelopment = config.env === 'development';

// Skip rate limiting for localhost in development
const skipLocalhost = (req) => {
  if (req.method === 'OPTIONS') return true;
  if (isDevelopment) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  }
  return false;
};

const getRedisStore = () => {
  try {
    if (!config.redisUrl) {
      return undefined;
    }

    const { createClient } = require('redis');
    const { RedisStore } = require('rate-limit-redis');

    const client = createClient({ url: config.redisUrl });
    client.connect().catch(() => undefined);

    return new RedisStore({
      sendCommand: (...args) => client.sendCommand(args)
    });
  } catch (error) {
    return undefined;
  }
};

const createLimiter = ({ windowMs, max, devMax, message }) => {
  const store = getRedisStore();
  const effectiveMax = isDevelopment ? (devMax ?? max * 20) : max;

  return rateLimit({
    windowMs,
    max: effectiveMax,
    skip: skipLocalhost,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED'
      });
    },
    ...(store ? { store } : {})
  });
};

export const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  devMax: 2000,
  message: 'Too many requests from this IP, please try again later'
});

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min window (not 1 min)
  max: 10,
  devMax: 200,
  message: 'Too many auth attempts, please try again later'
});

export const paymentLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  devMax: 300,
  message: 'Too many payment requests, please try again later'
});

export const paymentStrictLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  devMax: 100,
  message: 'Too many sensitive payment requests, please try again later'
});
