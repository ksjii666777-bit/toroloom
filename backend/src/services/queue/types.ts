/**
 * ============================================================================
 * Toroloom — Queue Job Types
 * ============================================================================
 *
 * Type definitions for BullMQ job data and results used across the
 * order processing queue and its workers.
 *
 * ============================================================================
 */

import type { ExecuteOrderParams, ExecuteOrderResult } from '../orderExecution';

/**
 * Job data pushed into the "order-processing" queue.
 */
export interface OrderJobData {
  /** Unique job correlation ID for dedup and tracing */
  correlationId: string;

  /** The full order parameters to execute */
  params: ExecuteOrderParams;

  /** When the job was enqueued (ISO timestamp) */
  enqueuedAt: string;
}

/**
 * Result written back when a job completes or fails.
 */
export interface OrderJobResult {
  correlationId: string;
  success: boolean;
  result?: ExecuteOrderResult;
  error?: string;
  /** When processing completed (ISO timestamp) */
  completedAt: string;
}

/**
 * Possible states for a queued order, exposed via the status endpoint.
 */
export type OrderJobStatus =
  | 'queued'
  | 'active'
  | 'completed'
  | 'failed'
  | 'unknown';
