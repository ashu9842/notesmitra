/**
 * Queue Configuration for BullMQ
 * Manages Redis connection and queue instances
 */

import { Queue } from 'bullmq';
import config from '../../config/index.js';

// Redis connection configuration for BullMQ
const _redisUrl = config.redisEnabled && config.redisUrl?.includes('://') ? new URL(config.redisUrl) : null;
const connection = config.redisEnabled
  ? {
      host: _redisUrl?.hostname || 'localhost',
      port: parseInt(_redisUrl?.port || '6379'),
      password: _redisUrl?.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    }
  : null;

// Queue instances
let paymentLogQueue = null;
let emailQueue = null;

/**
 * Initialize job queues
 */
export const initializeQueues = () => {
  if (!config.redisEnabled) {
    console.log('ℹ️  Queues: Redis disabled. Background jobs will run synchronously.');
    return;
  }

  try {
    // Payment logging queue
    paymentLogQueue = new Queue('payment-logs', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000
        },
        removeOnFail: {
          age: 604800 // Keep failed jobs for 7 days
        }
      }
    });

    // Email queue
    emailQueue = new Queue('emails', {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100
        },
        removeOnFail: {
          age: 604800
        }
      }
    });

    console.log('✅ Queues: Initialized successfully');
  } catch (error) {
    console.error('❌ Queues: Initialization failed:', error.message);
    paymentLogQueue = null;
    emailQueue = null;
  }
};

/**
 * Get payment log queue instance
 */
export const getPaymentLogQueue = () => {
  return paymentLogQueue;
};

/**
 * Get email queue instance
 */
export const getEmailQueue = () => {
  return emailQueue;
};

/**
 * Check if queues are available
 */
export const areQueuesAvailable = () => {
  return config.redisEnabled && paymentLogQueue !== null;
};

/**
 * Close all queues
 */
export const closeQueues = async () => {
  try {
    if (paymentLogQueue) {
      await paymentLogQueue.close();
      console.log('✅ Queues: Payment log queue closed');
    }
    if (emailQueue) {
      await emailQueue.close();
      console.log('✅ Queues: Email queue closed');
    }
  } catch (error) {
    console.error('Queues close error:', error.message);
  }
};
