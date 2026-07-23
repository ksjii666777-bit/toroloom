/**
 * ============================================================================
 * Toroloom — Payment Retry Queue Job Types
 * ============================================================================
 *
 * Type definitions for BullMQ job data used by the payment retry queue
 * and its worker.
 *
 * ============================================================================
 */

/**
 * Job data pushed into the "payment-retry" queue when a UPI Autopay
 * payment fails. The worker will re-attempt charging the mandate.
 */
export interface PaymentRetryJobData {
  /** User whose payment failed */
  userId: string;

  /** User's current plan ID (e.g. plan_pro, plan_elite) */
  planId: string;

  /** Billing period: monthly | yearly */
  billingPeriod: string;

  /** The mandate ID to retry */
  mandateId: string;

  /** The UPI ID used for the mandate */
  upiId: string;

  /** Amount that failed (in paise — Razorpay format) */
  amount: number;

  /** Retry attempt number (1-based) */
  attempt: number;

  /** Maximum retry attempts */
  maxRetries: number;

  /** When the payment first failed (ISO timestamp) */
  failedAt: string;

  /** When this retry was scheduled (ISO timestamp) */
  scheduledAt: string;
}

/**
 * Result of a payment retry attempt.
 */
export interface PaymentRetryJobResult {
  userId: string;
  success: boolean;
  attempt: number;
  error?: string;
  /** When processing completed (ISO timestamp) */
  completedAt: string;
}

/**
 * Retry schedule configuration.
 * Attempts are spaced with exponential backoff:
 *   1h → 4h → 12h → 24h → 48h (total ~3.5 days)
 */
export const PAYMENT_RETRY_DELAYS = [
  60 * 60 * 1000,      // Attempt 1: 1 hour
  4 * 60 * 60 * 1000,  // Attempt 2: 4 hours
  12 * 60 * 60 * 1000, // Attempt 3: 12 hours
  24 * 60 * 60 * 1000, // Attempt 4: 24 hours
  48 * 60 * 60 * 1000, // Attempt 5: 48 hours
] as const;

export const MAX_PAYMENT_RETRIES = PAYMENT_RETRY_DELAYS.length;

export const PAYMENT_RETRY_QUEUE_NAME = 'payment-retry';
