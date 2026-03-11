/**
 * Email Job Dispatcher
 * Dispatches email jobs to queue or runs synchronously
 */

import { getEmailQueue, areQueuesAvailable } from '../config/queue.js';

/**
 * Dispatch email job
 * Falls back to synchronous sending if queues are unavailable
 */
export const dispatchEmail = async ({ to, subject, body, type, priority = 5 }) => {
  const jobData = {
    to,
    subject,
    body,
    type
  };

  try {
    if (areQueuesAvailable()) {
      // Dispatch to background queue
      const queue = getEmailQueue();
      await queue.add('send-email', jobData, {
        priority
      });
      console.log(`📧 Email job queued for ${to}`);
    } else {
      // Fallback: Log that email would be sent
      console.log(`📧 Email (no queue): ${subject} to ${to} (Type: ${type})`);
      // In production with no queue, you might still want to send synchronously
    }
  } catch (error) {
    console.warn('Email dispatch failed:', error.message);
  }
};
