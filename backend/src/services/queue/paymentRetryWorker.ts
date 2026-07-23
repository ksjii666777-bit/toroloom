/**
 * ============================================================================
 * Toroloom — Payment Retry Worker (BullMQ)
 * ============================================================================
 *
 * Worker that picks jobs from the "payment-retry" queue and attempts to
 * re-charge the failed UPI mandate via Razorpay.
 *
 * On success: clears grace period, resets failure counters.
 * On failure: updates retry counters.
 * When max retries exhausted: sends final notification.
 *
 * ============================================================================
 */

import { Worker, Job } from 'bullmq';
import { env } from '../../config/env';
import { getStorage } from '../storage';
import { sendExpoPushNotification } from '../pushNotifications';
import { saveNotification } from '../notifications';
import { pushTokenStore } from '../../routes/pushNotifications';
import type { PaymentRetryJobData, PaymentRetryJobResult } from './paymentRetryTypes';
import { PAYMENT_RETRY_QUEUE_NAME, MAX_PAYMENT_RETRIES } from './paymentRetryTypes';

/** Lazy-loaded Razorpay instance */
let _Razorpay: any = null;
function getRazorpay(): any {
  if (!_Razorpay) {
    try {
      const Razorpay = require('razorpay');
      _Razorpay = new Razorpay({
        key_id: env.razorpayKeyId,
        key_secret: env.razorpayKeySecret,
      });
    } catch {
      return null;
    }
  }
  return _Razorpay;
}

/** Shared worker instance (lazy-initialized) */
let paymentRetryWorker: Worker<PaymentRetryJobData, PaymentRetryJobResult> | null = null;

/**
 * Start the payment retry worker.
 * Called at server startup.
 */
export function startPaymentRetryWorker(): void {
  if (!env.hasRedis) {
    if (env.nodeEnv !== 'test') {
      console.log('   [PaymentRetry] Redis unavailable — auto-retry disabled');
    }
    return;
  }

  if (paymentRetryWorker) {
    return; // Already started
  }

  const connection = { url: env.redisUrl };

  paymentRetryWorker = new Worker<PaymentRetryJobData, PaymentRetryJobResult>(
    PAYMENT_RETRY_QUEUE_NAME,
    async (job: Job<PaymentRetryJobData>): Promise<PaymentRetryJobResult> => {
      const { userId, planId, billingPeriod, mandateId, upiId, amount, attempt, maxRetries, failedAt } = job.data;
      const now = new Date();

      console.log(`[PaymentRetry] Attempt #${attempt}/${maxRetries} for user ${userId}, mandate ${mandateId}`);

      try {
        // ── Attempt to create a Razorpay order against the existing mandate ──
        const razorpay = getRazorpay();
        if (!razorpay) {
          throw new Error('Razorpay SDK not available');
        }

        const order = await razorpay.orders.create({
          amount,
          currency: 'INR',
          payment: {
            capture: 'automatic',
            capture_options: {
              automatic_expiry_period: 12,
            },
          },
          notes: {
            userId,
            planId,
            billingPeriod,
            retryAttempt: String(attempt),
            originalFailedAt: failedAt,
          },
        });

        // ── If order created successfully, clear failure state ──────────
        const storage = await getStorage();
        const existing = await storage.loadSubscription(userId);
        if (existing) {
          existing.paymentFailureCount = 0;
          existing.gracePeriodEndDate = undefined;
          existing.lastPaymentFailureDate = undefined;
          existing.lastPaymentRetryDate = now.toISOString();
          existing.failedPaymentRetryCount = 0;
          existing.mandateStatus = 'active';
          existing.updatedAt = now.toISOString();
          await storage.saveSubscription(userId, existing);
        }

        // ── Send success notification (fire-and-forget) ─────────────────
        const pushToken = pushTokenStore.get(userId);
        if (pushToken) {
          sendExpoPushNotification(
            pushToken,
            '✅ Payment Retry Successful',
            'Your UPI Autopay has been restored! No action needed.',
            { type: 'payment_retry_success', userId },
          ).catch(() => {});
        }

        saveNotification({
          id: `pay_retry_success_${userId}_${now.getTime()}`,
          userId,
          type: 'system',
          title: '✅ Payment Retry Successful',
          message: 'Your UPI Autopay has been restored successfully. Your premium features remain active.',
          read: false,
          timestamp: now.toISOString(),
          data: { type: 'payment_retry_success' },
        }).catch(() => {});

        console.log(`[PaymentRetry] ✅ Attempt #${attempt} succeeded for user ${userId}`);

        return {
          userId,
          success: true,
          attempt,
          completedAt: now.toISOString(),
        };

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown retry error';

        console.log(`[PaymentRetry] ❌ Attempt #${attempt} failed for user ${userId}: ${message}`);

        // ── Update retry counters ──────────────────────────────────────
        try {
          const storage = await getStorage();
          const existing = await storage.loadSubscription(userId);
          if (existing) {
            existing.failedPaymentRetryCount = attempt;
            existing.lastPaymentRetryDate = now.toISOString();
            existing.updatedAt = now.toISOString();
            await storage.saveSubscription(userId, existing);

            // ── If this was the last attempt, send final notification ──
            if (attempt >= maxRetries) {
              const pushToken = pushTokenStore.get(userId);
              if (pushToken) {
                sendExpoPushNotification(
                  pushToken,
                  '⚠️ Auto-Retry Exhausted',
                  'We tried 5 times but could not charge your UPI Autopay. Please update your payment method to avoid losing premium access.',
                  { type: 'payment_retry_exhausted', userId },
                ).catch(() => {});
              }

              saveNotification({
                id: `pay_retry_exhausted_${userId}_${now.getTime()}`,
                userId,
                type: 'system',
                title: '⚠️ Auto-Retry Exhausted',
                message: 'We tried 5 times over 3.5 days to retry your payment. Please update your UPI Autopay payment method to keep premium features active.',
                read: false,
                timestamp: now.toISOString(),
                data: { type: 'payment_retry_exhausted' },
              }).catch(() => {});
            }
          }
        } catch (storageErr) {
          console.error(`[PaymentRetry] Failed to update storage for user ${userId}:`, storageErr);
        }

        return {
          userId,
          success: false,
          attempt,
          error: message,
          completedAt: now.toISOString(),
        };
      }
    },
    {
      connection,
      concurrency: 5, // Process up to 5 retries concurrently
      lockDuration: 60000, // 1 minute lock per job
      maxStalledCount: 3,
    },
  );

  paymentRetryWorker.on('completed', (job: Job<PaymentRetryJobData>, result: PaymentRetryJobResult) => {
    if (result.success) {
      console.log(`[PaymentRetry] Worker completed retry #${result.attempt} for user ${result.userId} ✅`);
    }
  });

  paymentRetryWorker.on('failed', (job: Job<PaymentRetryJobData> | undefined, error: Error) => {
    if (job) {
      console.log(`[PaymentRetry] Worker FAILED retry #${job.data.attempt} for user ${job.data.userId}: ${error.message}`);
    }
  });

  if (env.nodeEnv !== 'test') {
    console.log('   [PaymentRetry] Worker started — 5 attempts with exponential backoff (1h→4h→12h→24h→48h)');
  }
}

/**
 * Gracefully stop the payment retry worker.
 * Call during server shutdown.
 */
export async function stopPaymentRetryWorker(): Promise<void> {
  if (paymentRetryWorker) {
    await paymentRetryWorker.close();
    paymentRetryWorker = null;
    if (env.nodeEnv !== 'test') {
      console.log('   [PaymentRetry] Worker stopped');
    }
  }
}
