/**
 * Payment Log Worker
 * Processes payment logging jobs in background
 */

import { Worker } from 'bullmq';
import PaymentLog from '../../models/PaymentLog.js';
import config from '../../config/index.js';

let worker = null;

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

/**
 * Process payment log job
 */
const processPaymentLog = async (job) => {
  const {
    eventType,
    source,
    purchaseId,
    noteId,
    buyerId,
    sellerId,
    paymentMethod,
    razorpayPaymentId,
    statusFrom,
    statusTo,
    ip,
    userAgent,
    payload
  } = job.data;

  try {
    await PaymentLog.create({
      eventType,
      source,
      purchaseId,
      noteId,
      buyerId,
      sellerId,
      paymentMethod,
      razorpayPaymentId,
      statusFrom,
      statusTo,
      ip,
      userAgent,
      payload
    });

    return { success: true, logId: purchaseId };
  } catch (error) {
    console.error('Payment log job failed:', error);
    throw error;
  }
};

/**
 * Start payment log worker
 */
export const startPaymentLogWorker = () => {
  if (!config.redisEnabled) {
    console.log('ℹ️  Worker: Redis disabled. Payment log worker not started.');
    return;
  }

  try {
    worker = new Worker('payment-logs', processPaymentLog, {
      connection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000
      }
    });

    worker.on('completed', (job) => {
      console.log(`✅ Payment log job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Payment log job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
      console.error('❌ Payment log worker error:', err);
    });

    console.log('✅ Worker: Payment log worker started');
  } catch (error) {
    console.error('❌ Worker: Payment log worker failed to start:', error.message);
  }
};

/**
 * Stop payment log worker
 */
export const stopPaymentLogWorker = async () => {
  if (worker) {
    await worker.close();
    console.log('✅ Worker: Payment log worker stopped');
  }
};
