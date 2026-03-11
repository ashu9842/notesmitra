/**
 * Payment Log Job Dispatcher
 * Dispatches payment logging jobs to queue or runs synchronously
 */

import { getPaymentLogQueue, areQueuesAvailable } from '../config/queue.js';
import PaymentLog from '../../models/PaymentLog.js';

/**
 * Dispatch payment log job
 * Falls back to synchronous logging if queues are unavailable
 */
export const dispatchPaymentLog = async ({
  eventType,
  source,
  purchase,
  statusFrom,
  statusTo,
  razorpayPaymentId,
  ip,
  userAgent,
  payload
}) => {
  const jobData = {
    eventType,
    source,
    purchaseId: purchase?._id,
    noteId: purchase?.noteId,
    buyerId: purchase?.buyerId,
    sellerId: purchase?.sellerId,
    paymentMethod: purchase?.paymentMethod,
    razorpayPaymentId: razorpayPaymentId || purchase?.razorpayPaymentId,
    statusFrom,
    statusTo,
    ip,
    userAgent,
    payload
  };

  try {
    if (areQueuesAvailable()) {
      // Dispatch to background queue
      const queue = getPaymentLogQueue();
      await queue.add('log-payment', jobData, {
        priority: eventType === 'purchase_completed' ? 1 : 5
      });
    } else {
      // Fallback: Synchronous logging
      await PaymentLog.create(jobData);
    }
  } catch (error) {
    console.warn('Payment log dispatch failed:', error.message);
  }
};
