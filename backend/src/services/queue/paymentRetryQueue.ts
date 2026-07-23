/**
 * ============================================================================
 * Toroloom — Payment Retry Queue (BullMQ)
 * ============================================================================
 *
 * BullMQ queue for smart payment retry scheduling with exponential backoff.
 * When a UPI Autopay payment fails, a job is scheduled with delays:
 *   1h → 4h → 12h → 24h → 48h (5 attempts over ~3.5 days)
 *
 * Queue name: "payment-retry"
 *
 * This queue is only available when Redis is configured (env.hasRedis).
 * When Redis is not available, retries are handled client-side via the
 * existing retryFailedPayment flow in the subscription store.
 *
 * ============================================================================
 */

import { Queue } from 'bullmq';
import { env } from '../../config/env';
import type { PaymentRetryJobData, PaymentRetryJobResult } from './paymentRetryTypes';
import { PAYMENT_RETRY_QUEUE_NAME, PAYMENT_RETRY_DELAYS, MAX_PAYMENT_RETRIES } from './paymentRetryTypes';

/** Shared queue instance (lazy-initialized) */
let paymentRetryQueue: Queue<PaymentRetryJobData, PaymentRetryJobResult> | null = null;

/**
 * Get or create the payment retry queue.
 * Returns null if Redis is not configured (callers must fall back to client-side retry).
 */
export function getPaymentRetryQueue(): Queue<PaymentRetryJobData, PaymentRetryJobResult> | null {
  if (!env.hasRedis) {
    return null;
  }

  if (!paymentRetryQueue) {
    const connection = { url: env.redisUrl };
    paymentRetryQueue = new Queue<PaymentRetryJobData, PaymentRetryJobResult>(PAYMENT_RETRY_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: MAX_PAYMENT_RETRIES,
        backoff: {
          type: 'exponential',
          delay: 60 * 60 * 1000, // Base delay: 1 hour (BullMQ doubles each attempt: 1h, 2h, 4h, 8h, 16h)
        },
        removeOnComplete: {
          age: 7 * 24 * 3600,    // Keep completed jobs for 7 days
          count: 500,             // Keep last 500 completed
        },
        removeOnFail: {
          age: 14 * 24 * 3600,   // Keep failed jobs for 14 days
        },
      },
    });
  }

  return paymentRetryQueue;
}

/**
 * Schedule a payment retry job.
 * Returns the job ID if scheduled, or null if the queue is unavailable.
 */
export async function schedulePaymentRetry(data: PaymentRetryJobData): Promise<string | null> {
  const queue = getPaymentRetryQueue();
  if (!queue) {
    console.log('[PaymentRetry] Redis unavailable — retry will be handled client-side');
    return null;
  }

  // Calculate the actual delay for this attempt using the custom schedule
  const delayMs = PAYMENT_RETRY_DELAYS[data.attempt - 1] || PAYMENT_RETRY_DELAYS[PAYMENT_RETRY_DELAYS.length - 1];

  const job = await queue.add(
    `retry-${data.userId}-${data.attempt}`,
    data,
    {
      delay: delayMs,
      jobId: `payment-retry-${data.userId}-${data.failedAt}-${data.attempt}`,
      attempts: MAX_PAYMENT_RETRIES - data.attempt + 1,
      backoff: {
        type: 'exponential',
        delay: delayMs,
      },
    },
  );

  console.log(`[PaymentRetry] Scheduled retry #${data.attempt} for user ${data.userId} in ${delayMs / 3600000}h`);
  return job.id ?? null;
}

/**
 * Gracefully close the queue connection.
 * Call during server shutdown.
 */
export async function closePaymentRetryQueue(): Promise<void> {
  if (paymentRetryQueue) {
    await paymentRetryQueue.close();
    paymentRetryQueue = null;
  }
}
