/**
 * Redis Configuration for Socket.IO Adapter
 * Enables pub/sub across multiple server instances
 */

import redis from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import config from './index.js';
import logger from '../utils/logger.js';

let redisPublisher = null;
let redisSubscriber = null;

/**
 * Initialize Redis clients for Socket.IO adapter
 * Creates separate pub and sub clients as required by Socket.IO
 * With timeout to prevent hanging if Redis is unavailable
 */
export const initializeRedis = async (timeoutMs = 5000) => {
  try {
    if (!config.redisEnabled) {
      console.log('ℹ️  Redis disabled by config. Skipping Redis initialization.');
      return { redisPublisher: null, redisSubscriber: null };
    }

    // Parse Redis URL from environment
    const redisUrl = config.redisUrl || 'redis://localhost:6379';

    console.log('🔴 Connecting to Redis...');
    console.log(`📍 Redis URL: ${config.redisUrl ? redisUrl.replace(/:[^:]*@/, ':***@') : 'localhost:6379'}`);

    // Create publisher client
    redisPublisher = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 2) return false; // Stop retrying after 2 attempts
          const delay = Math.min(retries * 50, 500);
          logger.debug(`Redis publisher reconnection attempt ${retries + 1}`);
          return delay;
        },
        connectTimeout: timeoutMs
      }
    });

    // Create subscriber client (must be separate for Socket.IO)
    redisSubscriber = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 2) return false; // Stop retrying after 2 attempts
          const delay = Math.min(retries * 50, 500);
          logger.debug(`Redis subscriber reconnection attempt ${retries + 1}`);
          return delay;
        },
        connectTimeout: timeoutMs
      }
    });

    // Error handlers
    redisPublisher.on('error', (err) => {
      logger.error('Redis Publisher Error:', err.message);
    });

    redisSubscriber.on('error', (err) => {
      logger.error('Redis Subscriber Error:', err.message);
    });

    // Connect events
    redisPublisher.on('connect', () => {
      logger.debug('Redis Publisher Connected');
    });

    redisSubscriber.on('connect', () => {
      logger.debug('Redis Subscriber Connected');
    });

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Redis connection timeout after ${timeoutMs}ms`)), timeoutMs)
    );

    // Connect both clients with timeout
    try {
      await Promise.race([
        Promise.all([
          redisPublisher.connect(),
          redisSubscriber.connect()
        ]),
        timeoutPromise
      ]);
    } catch (timeoutError) {
      // Close clients if they got partially connected
      if (redisPublisher) await redisPublisher.quit().catch(() => {});
      if (redisSubscriber) await redisSubscriber.quit().catch(() => {});
      redisPublisher = null;
      redisSubscriber = null;
      throw timeoutError;
    }

    logger.debug('Redis Ready for Socket.IO Adapter');
    return { redisPublisher, redisSubscriber };
  } catch (error) {
    logger.error('Failed to initialize Redis:', error.message);
    redisPublisher = null;
    redisSubscriber = null;
    throw error;
  }
};

/**
 * Create Socket.IO Redis Adapter
 * Must be called after Socket.IO server is initialized
 * 
 * @param {Server} io - Socket.IO server instance
 * @returns {Promise<void>}
 */
export const setupSocketIORedisAdapter = async (io) => {
  try {
    if (!config.redisEnabled) {
      console.log('ℹ️  Redis adapter disabled by config. Running without Redis.');
      return io;
    }

    if (!redisPublisher || !redisSubscriber) {
      logger.warn('Redis clients not initialized. Initializing now...');
      await initializeRedis();
    }

    // Attach Redis adapter to Socket.IO
    // This enables pub/sub across multiple server instances
    io.adapter(createAdapter(redisPublisher, redisSubscriber, {
      key: 'socket.io',  // Redis key prefix for pub/sub channels
    }));

    logger.debug('Socket.IO Redis Adapter Configured');
    logger.debug('Multi-instance pub/sub enabled');

    return io;
  } catch (error) {
    logger.error('Failed to setup Socket.IO Redis adapter:', error.message);
    throw error;
  }
};

/**
 * Get Redis publisher client
 */
export const getRedisPublisher = () => redisPublisher;

/**
 * Get Redis subscriber client
 */
export const getRedisSubscriber = () => redisSubscriber;

/**
 * Close Redis connections gracefully
 */
export const closeRedis = async () => {
  try {
    if (!config.redisEnabled) {
      return;
    }

    if (redisPublisher) {
      await redisPublisher.quit();
      logger.debug('Redis Publisher Closed');
    }
    if (redisSubscriber) {
      await redisSubscriber.quit();
      logger.debug('Redis Subscriber Closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connections:', error.message);
  }
};

/**
 * Test Redis connection
 */
export const testRedisConnection = async () => {
  try {
    if (!config.redisEnabled) {
      console.log('ℹ️  Redis disabled by config. Skipping connection test.');
      return false;
    }

    if (!redisPublisher || !redisSubscriber) {
      await initializeRedis();
    }

    // Test ping
    const pong1 = await redisPublisher.ping();
    const pong2 = await redisSubscriber.ping();

    logger.debug('Redis Publisher Ping successful');
    console.log('✅ Redis Subscriber Ping:', pong2);

    return true;
  } catch (error) {
    console.error('❌ Redis connection test failed:', error.message);
    return false;
  }
};

export default {
  initializeRedis,
  setupSocketIORedisAdapter,
  getRedisPublisher,
  getRedisSubscriber,
  closeRedis,
  testRedisConnection
};
