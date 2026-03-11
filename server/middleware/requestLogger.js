import morgan from 'morgan';
import logger from '../utils/logger.js';
import config from '../config/index.js';

// Custom token for response time
morgan.token('response-time-ms', (req, res) => {
  if (!req._startTime) return '-';
  const diff = process.hrtime(req._startTime);
  const ms = diff[0] * 1000 + diff[1] / 1000000;
  return ms.toFixed(2);
});

// Custom token for user ID
morgan.token('user-id', (req) => {
  return req.user?._id || 'anonymous';
});

// Development format
const devFormat = ':method :url :status :response-time-ms ms - :res[content-length]';

// Production format (more detailed)
const prodFormat = ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms ms';

// Skip logging for health check endpoints
const skip = (req, res) => {
  // Skip health checks and static assets
  if (req.url === '/health' || req.url === '/nginx-health') return true;
  if (req.url.startsWith('/static')) return true;
  return false;
};

/**
 * Request logging middleware
 * Uses morgan for HTTP logging with Winston transport
 */
export const requestLogger = morgan(
  config.isProduction ? prodFormat : devFormat,
  {
    stream: logger.stream,
    skip
  }
);

/**
 * Custom request timing middleware
 * Adds request start time for response time calculation
 */
export const requestTimer = (req, res, next) => {
  req._startTime = process.hrtime();
  
  // Log when response finishes
  res.on('finish', () => {
    const diff = process.hrtime(req._startTime);
    const responseTime = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);
    
    // Only log if took longer than 100ms or is an error
    if (responseTime > 100 || res.statusCode >= 400) {
      logger.logRequest(req, res, responseTime);
    }
  });

  next();
};

/**
 * Log slow requests (>1 second)
 */
export const slowRequestLogger = (req, res, next) => {
  req._startTime = process.hrtime();

  const originalSend = res.send;
  res.send = function (data) {
    const diff = process.hrtime(req._startTime);
    const ms = diff[0] * 1000 + diff[1] / 1000000;

    if (ms > 1000) {
      logger.warn('Slow Request Detected', {
        method: req.method,
        url: req.originalUrl || req.url,
        responseTime: `${ms.toFixed(2)}ms`,
        statusCode: res.statusCode
      });
    }

    originalSend.call(this, data);
  };

  next();
};

export default requestLogger;
