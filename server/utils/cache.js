/**
 * Redis Cache Utility
 * Provides caching layer with automatic fallback when Redis is disabled
 */

import redis from 'redis';
import config from '../config/index.js';
import logger from './logger.js';

let cacheClient = null;
let isRedisAvailable = false;

/**
 * Initialize Redis cache client
 */
export const initializeCacheClient = async () => {
  try {
    if (!config.redisEnabled) {
      logger.info('Cache: Redis disabled by config. Caching unavailable.');
      return;
    }

    const redisUrl = config.redisUrl || 'redis://localhost:6379';
    
    cacheClient = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 2) return false;
          return Math.min(retries * 50, 500);
        },
        connectTimeout: 5000
      }
    });

    cacheClient.on('error', (err) => {
      logger.error('Cache Redis error:', err.message);
      isRedisAvailable = false;
    });

    cacheClient.on('connect', () => {
      logger.info('Cache: Redis client connected');
      isRedisAvailable = true;
    });

    cacheClient.on('ready', () => {
      logger.info('Cache: Redis client ready');
      isRedisAvailable = true;
    });

    await cacheClient.connect();
  } catch (error) {
    logger.error('Cache: Redis initialization failed:', error.message);
    isRedisAvailable = false;
    cacheClient = null;
  }
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Parsed value or null
 */
export const get = async (key) => {
  try {
    if (!isRedisAvailable || !cacheClient) {
      return null;
    }

    const value = await cacheClient.get(key);
    if (!value) return null;

    return JSON.parse(value);
  } catch (error) {
    logger.error(`Cache get error for key "${key}":`, error.message);
    return null;
  }
};

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttl - Time to live in seconds (default: 60)
 * @returns {Promise<boolean>} Success status
 */
export const set = async (key, value, ttl = 60) => {
  try {
    if (!isRedisAvailable || !cacheClient) {
      return false;
    }

    const serialized = JSON.stringify(value);
    await cacheClient.setEx(key, ttl, serialized);
    return true;
  } catch (error) {
    logger.error(`Cache set error for key "${key}":`, error.message);
    return false;
  }
};

/**
 * Delete single key from cache
 * @param {string} key - Cache key to delete
 * @returns {Promise<boolean>} Success status
 */
export const del = async (key) => {
  try {
    if (!isRedisAvailable || !cacheClient) {
      return false;
    }

    await cacheClient.del(key);
    return true;
  } catch (error) {
    logger.error(`Cache del error for key "${key}":`, error.message);
    return false;
  }
};

/**
 * Delete all keys matching a pattern
 * @param {string} pattern - Redis pattern (e.g., "notes:*")
 * @returns {Promise<number>} Number of keys deleted
 */
export const delPattern = async (pattern) => {
  try {
    if (!isRedisAvailable || !cacheClient) {
      return 0;
    }

    let deletedCount = 0;
    let cursor = 0;

    do {
      const result = await cacheClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });

      cursor = result.cursor;
      const keys = result.keys;

      if (keys.length > 0) {
        await cacheClient.del(keys);
        deletedCount += keys.length;
      }
    } while (cursor !== 0);

    return deletedCount;
  } catch (error) {
    logger.error(`Cache delPattern error for pattern "${pattern}":`, error.message);
    return 0;
  }
};

/**
 * Check if Redis cache is available
 * @returns {boolean}
 */
export const isAvailable = () => {
  return isRedisAvailable && cacheClient !== null;
};

/**
 * Close Redis connection
 */
export const closeCache = async () => {
  try {
    if (cacheClient) {
      await cacheClient.quit();
      cacheClient = null;
      isRedisAvailable = false;
      logger.info('Cache: Redis client closed');
    }
  } catch (error) {
    logger.error('Cache close error:', error.message);
  }
};
