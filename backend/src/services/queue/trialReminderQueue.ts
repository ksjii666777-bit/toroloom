/**
 * ============================================================================
 * Toroloom — Trial Reminder Queue (BullMQ)
 * ============================================================================
 *
 * BullMQ queue for scheduling trial end reminder notifications.
 * When a trial starts, a job is scheduled with a delay so it fires
 * when the trial is 3 days (or 1 day for short trials) from expiry.
 *
 * Queue name: "trial-reminder"
 *
 * This queue is only available when Redis is configured (env.hasRedis).
 * When Redis is not available, reminders are handled client-side via
 * the subscription store's refreshTrialStatus() interval.
 *
 * ============================================================================
 */

import { Queue } from 'bullmq';
import { env } from '../../config/env';
import type { TrialReminderJobData, TrialReminderJobResult } from './trialReminderTypes';
import { TRIAL_REMINDER_QUEUE_NAME } from './trialReminderTypes';

/** Shared queue instance (lazy-initialized) */
let trialReminderQueue: Queue<TrialReminderJobData, TrialReminderJobResult> | null = null;

/**
 * Get or create the trial reminder queue.
 * Returns null if Redis is not configured.
 */
export function getTrialReminderQueue(): Queue<TrialReminderJobData, TrialReminderJobResult> | null {
  if (!env.hasRedis) {
    return null;
  }

  if (!trialReminderQueue) {
    const connection = { url: env.redisUrl };
    trialReminderQueue = new Queue<TrialReminderJobData, TrialReminderJobResult>(TRIAL_REMINDER_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60 * 60 * 1000, // 1 hour base delay between retries
        },
        removeOnComplete: {
          age: 7 * 24 * 3600,    // Keep completed jobs for 7 days
          count: 1000,
        },
        removeOnFail: {
          age: 30 * 24 * 3600,   // Keep failed jobs for 30 days
        },
      },
    });
  }

  return trialReminderQueue;
}

/**
 * Schedule a trial end reminder job.
 * Returns the job ID if scheduled, or null if the queue is unavailable.
 */
export async function scheduleTrialReminder(data: TrialReminderJobData, delayMs: number): Promise<string | null> {
  const queue = getTrialReminderQueue();
  if (!queue) {
    console.log('[TrialReminder] Redis unavailable — reminders will be handled client-side');
    return null;
  }

  const job = await queue.add(
    `trial-end-${data.userId}-${data.reminderType}`,
    data,
    {
      delay: delayMs,
      jobId: `trial-reminder-${data.userId}-${data.reminderType}`,
      attempts: 3,
    },
  );

  const hoursUntilReminder = Math.round(delayMs / 3600000);
  console.log(`[TrialReminder] Scheduled ${data.reminderType} reminder for user ${data.userId} in ${hoursUntilReminder}h`);
  return job.id ?? null;
}

/**
 * Gracefully close the queue connection.
 * Call during server shutdown.
 */
export async function closeTrialReminderQueue(): Promise<void> {
  if (trialReminderQueue) {
    await trialReminderQueue.close();
    trialReminderQueue = null;
  }
}
