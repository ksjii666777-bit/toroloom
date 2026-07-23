/**
 * ============================================================================
 * Toroloom — Trial Reminder Queue Job Types
 * ============================================================================
 *
 * Type definitions for BullMQ job data used by the trial reminder queue
 * and its worker.
 *
 * The worker sends push + in-app notifications to users whose trial is
 * ending soon (3 days before expiry).
 *
 * ============================================================================
 */

/**
 * Job data for a trial end reminder notification.
 */
export interface TrialReminderJobData {
  /** User whose trial is ending */
  userId: string;

  /** User's current plan tier (pro | elite) */
  planTier: string;

  /** When the trial ends (ISO timestamp) */
  trialEndDate: string;

  /** How many days remain until trial end */
  daysRemaining: number;

  /** Reminder type */
  reminderType: '3_day' | '1_day' | 'expired';

  /** When this reminder was scheduled (ISO timestamp) */
  scheduledAt: string;
}

/**
 * Result of a trial reminder job.
 */
export interface TrialReminderJobResult {
  userId: string;
  success: boolean;
  reminderType: string;
  error?: string;
  /** When processing completed (ISO timestamp) */
  completedAt: string;
}

/**
 * Queue name for trial end reminders.
 */
export const TRIAL_REMINDER_QUEUE_NAME = 'trial-reminder';

/**
 * Reminder schedule: send notification N days before trial end.
 * For Pro (7-day trial): 3 days before end = day 4
 * For Elite (3-day trial): 1 day before end = day 2
 */
export function getReminderDelayMs(trialDays: number): number {
  if (trialDays <= 3) {
    // Short trial: remind 1 day before end
    return Math.max(0, (trialDays - 1) * 24 * 60 * 60 * 1000);
  }
  // Standard trial: remind 3 days before end
  return Math.max(0, (trialDays - 3) * 24 * 60 * 60 * 1000);
}
