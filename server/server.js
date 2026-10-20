import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import connectDB from './config/database.js';
import { errorHandler, notFound } from './middleware/error.js';
import { requireCsrf } from './middleware/csrf.js';
import { socketAuthMiddleware, socketAuthGuard } from './middleware/socketAuth.js';
import { initializeSocketServer } from './socketServer.js';
import { closeRedis, getRedisPublisher, getRedisSubscriber } from './config/redis.js';
import { globalLimiter } from './config/rateLimit.js';
import config from './config/index.js';
import { initializeCacheClient } from './utils/cache.js';
import logger from './utils/logger.js';
import suppressConsoleOutput from './utils/consoleSuppress.js';

import { requestLogger, requestTimer, slowRequestLogger } from './middleware/requestLogger.js';
import { initializeFirebase } from './config/firebase.js';
import { 
  initializeQueues, 
  closeQueues, 
  startPaymentLogWorker, 
  stopPaymentLogWorker,
  startEmailWorker,
  stopEmailWorker
} from './jobs/index.js';

// Suppress ALL console output globally
suppressConsoleOutput();

// Initialize Firebase Admin SDK (Google sign-in token verification)
initializeFirebase();

mongoose.set('strictQuery', true);

// Connect to database
connectDB();

// Route imports
import authRoutes from './modules/auth/routes.js';
import noteRoutes from './routes/noteRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import razorpayRoutes from './routes/razorpayRoutes.js';
import superadminRoutes from './routes/superadminRoutes.js';
import premiumRoutes from './routes/premiumRoutes.js';
import diagnosticRoutes from './routes/diagnosticRoutes.js';

// Initialize express app
const app = express();

// Trust the first proxy (Render, Heroku, etc.) so req.protocol correctly
// reflects HTTPS even though the proxy terminates SSL before reaching Node.js.
app.set('trust proxy', 1);

app.disable('x-powered-by');

// Remove the Server header so the underlying technology stack is not fingerprinted
app.use((req, res, next) => {
  res.removeHeader('Server');
  next();
});

// CORS - MUST be early, before rate limiting
const allowedOrigins = [
  ...(Array.isArray(config.clientUrl) ? config.clientUrl : String(config.clientUrl || '').split(',')),
  'https://notesmitra.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-idempotency-key'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      // Allow iframing PDFs from our own server AND Cloudinary
      frameSrc: ["'self'", 'https://res.cloudinary.com'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(helmet.frameguard({ action: 'sameorigin' }));
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));
app.use((req, res, next) => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
app.use(mongoSanitize()); // Prevent NoSQL injection

const hasUnsafeKeys = (value) => {
  if (!value || typeof value !== 'object') return false;

  if (Array.isArray(value)) {
    return value.some((item) => hasUnsafeKeys(item));
  }

  return Object.keys(value).some((key) => {
    if (key.startsWith('$') || key.includes('.')) return true;
    return hasUnsafeKeys(value[key]);
  });
};

app.use((req, res, next) => {
  if (hasUnsafeKeys(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request payload'
    });
  }

  if (hasUnsafeKeys(req.query)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid query filter'
    });
  }

  return next();
});

// Rate limiting

app.use('/api', globalLimiter);
// Response compression (skip small responses < 1KB)
app.use(compression({
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Default compression level (balance between speed and ratio)
  filter: (req, res) => {
    // Don't compress if client doesn't accept encoding
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  }
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(requestLogger);
app.use(requestTimer);
app.use(slowRequestLogger);

// Diagnostic routes (must be BEFORE CSRF middleware so they don't require tokens)
app.use('/api/diagnostic', diagnosticRoutes);

// CSRF protection for state-changing requests
app.use(requireCsrf);

// DB readiness gate — return 503 immediately instead of letting Mongoose buffer timeout
app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable. The server is starting up — please retry in a few seconds.'
    });
  }
  next();
});

// Health check route with detailed status
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check MongoDB connection
    const mongoStatus = {
      connected: mongoose.connection.readyState === 1,
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };

    // Check Redis connection
    let redisStatus = {
      enabled: config.redisEnabled,
      connected: false,
      publisher: 'not_configured',
      subscriber: 'not_configured'
    };

    if (config.redisEnabled) {
      const redisPublisher = getRedisPublisher();
      const redisSubscriber = getRedisSubscriber();
      
      if (redisPublisher && redisSubscriber) {
        try {
          // Check if clients are ready
          const publisherReady = redisPublisher.isReady;
          const subscriberReady = redisSubscriber.isReady;
          
          redisStatus = {
            enabled: true,
            connected: publisherReady && subscriberReady,
            publisher: publisherReady ? 'connected' : 'disconnected',
            subscriber: subscriberReady ? 'connected' : 'disconnected'
          };
        } catch (redisError) {
          redisStatus.error = redisError.message;
        }
      } else {
        redisStatus.publisher = 'not_initialized';
        redisStatus.subscriber = 'not_initialized';
      }
    }

    // System metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const health = {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(uptime),
        formatted: formatUptime(uptime)
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      },
      database: mongoStatus,
      redis: redisStatus,
      environment: config.env,
      nodeVersion: process.version,
      platform: process.platform,
      responseTime: `${Date.now() - startTime}ms`
    };

    // Determine overall status
    if (!mongoStatus.connected) {
      health.status = 'degraded';
      health.warnings = ['Database not connected'];
    }
    
    if (config.redisEnabled && !redisStatus.connected) {
      health.status = health.status === 'degraded' ? 'unhealthy' : 'degraded';
      health.warnings = health.warnings || [];
      health.warnings.push('Redis not connected');
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: `${Date.now() - startTime}ms`
    });
  }
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// Simple ping endpoint for load balancers
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Serve uploaded files (local storage fallback when Cloudinary is not configured)
// In production, Cloudinary is used exclusively – this only activates for local-storage notes
app.use('/uploads', express.static(config.uploadPath || './uploads', {
  index: false,
  dotfiles: 'deny'
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/razorpay', razorpayRoutes);
// diagnostic routes are already mounted before CSRF middleware above

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to NotesMitra API',
    version: '1.0.0',
    endpoints: {
      health: '/health (detailed health check)',
      ping: '/ping (simple health check)',
      auth: '/api/auth',
      notes: '/api/notes',
      wallet: '/api/wallet',
      payments: '/api/payments',
      tickets: '/api/tickets',
      admin: '/api/admin',
      razorpay: '/api/razorpay'
    }
  });
});

// Error handlers (must be after routes)
app.use(notFound);
app.use(errorHandler);

// Create HTTP server for Socket.io
const httpServer = createServer(app);

// Module-level server reference so gracefulShutdown can close it
let server;

// Initialize Socket.io with secure CORS configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  transports: ['websocket', 'polling'],
  pingInterval: 30000,
  pingTimeout: 60000,
  allowEIO3: false
});

// Apply authentication middleware to all connections
io.use(socketAuthMiddleware);

// Apply auth guard to all events
io.use(socketAuthGuard);

// Initialize cache client (async)
initializeCacheClient().catch((error) => {
  logger.warn('Cache initialization had errors', { error: error.message });
  // Continue running even if cache setup fails
});

// Initialize job queues
initializeQueues();

// Start background workers
startPaymentLogWorker();
startEmailWorker();

// Initialize socket server with room management and Redis adapter (async)
initializeSocketServer(io).catch((error) => {
  logger.warn('Socket.IO setup had errors', { error: error.message });
  // Continue running even if Redis setup fails
});

// Make io instance globally available for other modules (like controllers)
global.io = io;

// Attach io instance to app for use in routes if needed
app.set('io', io);

const PORT = Number(process.env.PORT || config.port || 5000);

server = httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info('Server started successfully', {
    environment: config.env,
    port: PORT,
  });
});

server.on('error', (err) => {
  logger.error('HTTP server error', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception - Server will shut down', {
    error: err.message,
    stack: err.stack,
    name: err.name
  });
  
  // Try to close server gracefully
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection - Server will shut down', {
    error: err.message,
    stack: err.stack,
    promise: promise.toString()
  });
  
  // Try to close server gracefully
  gracefulShutdown('unhandledRejection');
});

// Handle PM2 warning signals
process.on('warning', (warning) => {
  logger.warn('Process warning', {
    name: warning.name,
    message: warning.message,
    stack: warning.stack
  });
});

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info('Graceful shutdown initiated', { signal });
  
  // Prevent multiple shutdown calls
  if (gracefulShutdown.inProgress) {
    logger.warn('Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  gracefulShutdown.inProgress = true;
  
  // Close HTTP server (stop accepting new connections)
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close Socket.IO connections
    try {
      io.close();
      logger.info('Socket.IO server closed');
    } catch (error) {
      logger.error('Error closing Socket.IO', { error: error.message });
    }
    
    // Close Redis connections
    try {
      await closeRedis();
      logger.info('Redis connections closed');
    } catch (error) {
      logger.error('Error closing Redis', { error: error.message });
    }
    
    // Stop background workers and close queues
    try {
      await stopPaymentLogWorker();
      await stopEmailWorker();
      await closeQueues();
      logger.info('Background workers and queues closed');
    } catch (error) {
      logger.error('Error closing workers/queues', { error: error.message });
    }
    
    // Close MongoDB connection
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB', { error: error.message });
    }
    
    logger.info('Server shutdown complete');
    
    // Exit with appropriate code
    const exitCode = signal === 'uncaughtException' || signal === 'unhandledRejection' ? 1 : 0;
    process.exit(exitCode);
  });

  // Force shutdown after 30 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forced shutdown after 30 seconds timeout');
    process.exit(1);
  }, 30000).unref(); // unref() allows process to exit even if timer is active
};

// Handle graceful shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker/Kubernetes
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT')); // PM2 reload

// PM2 graceful shutdown
process.on('message', (msg) => {
  if (msg === 'shutdown') {
    logger.info('Received shutdown message from PM2');
    gracefulShutdown('PM2_SHUTDOWN');
  }
});

// Notify PM2 that app is ready (for wait_ready option)
if (process.send) {
  process.send('ready');
  logger.info('Sent ready signal to PM2');
}

export default app;