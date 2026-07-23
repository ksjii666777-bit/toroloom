/**
 * ============================================================================
 * Toroloom — Trial Reminder Worker (BullMQ)
 * ============================================================================
 *
 * Worker that picks jobs from the "trial-reminder" queue and sends
 * push + in-app notifications to users whose trial is ending soon.
 *
 * Reminder schedule:
 *   - Pro trial (7 days): notification at 3 days before end
 *   - Elite trial (3 days): notification at 1 day before end
 *
 * ============================================================================
 */

import { Worker, Job } from 'bullmq';
import { env } from '../../config/env';
import { getStorage } from '../storage';
import { sendExpoPushNotification } from '../pushNotifications';
import { saveNotification } from '../notifications';
import { pushTokenStore } from '../../routes/pushNotifications';
import type { TrialReminderJobData, TrialReminderJobResult } from './trialReminderTypes';
import { TRIAL_REMINDER_QUEUE_NAME } from './trialReminderTypes';

/** Shared worker instance (lazy-initialized) */
let trialReminderWorker: Worker<TrialReminderJobData, TrialReminderJobResult> | null = null;

/**
 * Start the trial reminder worker.
 * Called at server startup.
 */
export function startTrialReminderWorker(): void {
  if (!env.hasRedis) {
    if (env.nodeEnv !== 'test') {
      console.log('   [TrialReminder] Redis unavailable — trial reminders disabled');
    }
    return;
  }

  if (trialReminderWorker) {
    return; // Already started
  }

  const connection = { url: env.redisUrl };

  trialReminderWorker = new Worker<TrialReminderJobData, TrialReminderJobResult>(
    TRIAL_REMINDER_QUEUE_NAME,
    async (job: Job<TrialReminderJobData>): Promise<TrialReminderJobResult> => {
      const { userId, planTier, trialEndDate, daysRemaining, reminderType, scheduledAt } = job.data;
      const now = new Date();

      console.log(`[TrialReminder] Sending ${reminderType} reminder for user ${userId} (${planTier}, ${daysRemaining}d remaining)`);

      try {
        // ── Verify the trial is still active ─────────────────────────────
        const storage = await getStorage();
        const existing = await storage.loadSubscription(userId);
        if (!existing) {
          console.log(`[TrialReminder] User ${userId} has no subscription — skipping`);
          return {
            userId,
            success: false,
            reminderType,
            error: 'No subscription found',
            completedAt: now.toISOString(),
          };
        }

        if (existing.status !== 'trial') {
          console.log(`[TrialReminder] User ${userId} trial already ended/cancelled — skipping`);
          return {
            userId,
            success: false,
            reminderType,
            error: `Trial status is ${existing.status}, not 'trial'`,
            completedAt: now.toISOString(),
          };
        }

        // ── Build notification title and message based on reminder type ──
        let title: string;
        let message: string;
        let data: Record<string, any>;

        if (reminderType === 'expired') {
          title = '⏰ Trial Expired — Upgrade to Keep Premium';
          message = `Your ${planTier === 'elite' ? 'Elite' : 'Pro'} trial has ended. Upgrade now to continue enjoying premium features like AI insights, Iron Lock, and real-time data.`;
          data = { type: 'trial_expired', userId, planTier };
        } else {
          const dayWord = daysRemaining === 1 ? 'day' : 'days';
          title = `⏳ Trial Ending in ${daysRemaining} ${dayWord}`;
          message = `Your ${planTier === 'elite' ? 'Elite' : 'Pro'} trial ends on ${new Date(trialEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}. Upgrade now to keep unlimited access!`;
          data = { type: 'trial_ending', userId, planTier, daysRemaining, trialEndDate };
        }

        // ── Send push notification (fire-and-forget) ─────────────────────
        const pushToken = pushTokenStore.get(userId);
        if (pushToken) {
          sendExpoPushNotification(
            pushToken,
            title,
            message,
            data,
          ).catch((err: any) => console.warn('[TrialReminder] Push notification error:', err?.message));
        }

        // ── Save in-app notification (fire-and-forget) ────────────────────
        saveNotification({
          id: `trial_${reminderType}_${userId}_${now.getTime()}`,
          userId,
          type: 'system',
          title,
          message,
          read: false,
          timestamp: now.toISOString(),
          data,
        }).catch((err: any) => console.warn('[TrialReminder] Save notification error:', err?.message));

        console.log(`[TrialReminder] ✅ ${reminderType} reminder sent to user ${userId}`);

        return {
          userId,
          success: true,
          reminderType,
          completedAt: now.toISOString(),
        };

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown reminder error';
        console.error(`[TrialReminder] ❌ Failed for user ${userId}: ${message}`);

        return {
          userId,
          success: false,
          reminderType,
          error: message,
          completedAt: now.toISOString(),
        };
      }
    },
    {
      connection,
      concurrency: 10, // Process up to 10 reminders concurrently
      lockDuration: 30000, // 30 seconds lock per job
      maxStalledCount: 3,
    },
  );

  trialReminderWorker.on('completed', (job: Job<TrialReminderJobData>, result: TrialReminderJobResult) => {
    if (result.success) {
      console.log(`[TrialReminder] Worker completed ${result.reminderType} for user ${result.userId} ✅`);
    }
  });

  trialReminderWorker.on('failed', (job: Job<TrialReminderJobData> | undefined, error: Error) => {
    if (job) {
      console.log(`[TrialReminder] Worker FAILED for user ${job.data.userId}: ${error.message}`);
    }
  });

  if (env.nodeEnv !== 'test') {
    console.log('   [TrialReminder] Worker started — sends notifications 3 days before trial end');
  }
}

/**
 * Gracefully stop the trial reminder worker.
 * Call during server shutdown.
 */
export async function stopTrialReminderWorker(): Promise<void> {
  if (trialReminderWorker) {
    await trialReminderWorker.close();
    trialReminderWorker = null;
    if (env.nodeEnv !== 'test') {
      console.log('   [TrialReminder] Worker stopped');
    }
  }
}
