/**
 * Email Worker
 * Processes email sending jobs in background
 */

import { Worker } from 'bullmq';
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
 * Process email job
 */
const processEmail = async (job) => {
  const { to, subject, body, type } = job.data;

  try {
    // TODO: Integrate email service (nodemailer, SendGrid, etc.)
    console.log(`📧 Sending email to ${to}: ${subject} (Type: ${type})`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In production, replace with actual email service:
    // await emailService.send({ to, subject, body, type });

    return { success: true, recipient: to };
  } catch (error) {
    console.error('Email job failed:', error);
    throw error;
  }
};

/**
 * Start email worker
 */
export const startEmailWorker = () => {
  if (!config.redisEnabled) {
    console.log('ℹ️  Worker: Redis disabled. Email worker not started.');
    return;
  }

  try {
    worker = new Worker('emails', processEmail, {
      connection,
      concurrency: 3,
      limiter: {
        max: 5,
        duration: 1000
      }
    });

    worker.on('completed', (job) => {
      console.log(`✅ Email job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Email job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
      console.error('❌ Email worker error:', err);
    });

    console.log('✅ Worker: Email worker started');
  } catch (error) {
    console.error('❌ Worker: Email worker failed to start:', error.message);
  }
};

/**
 * Stop email worker
 */
export const stopEmailWorker = async () => {
  if (worker) {
    await worker.close();
    console.log('✅ Worker: Email worker stopped');
  }
};
