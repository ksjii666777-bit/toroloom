/**
 * ============================================================================
 * Toroloom — Queue Service (BullMQ)
 * ============================================================================
 *
 * Async job queues for order processing and payment retry using BullMQ
 * (backed by Redis).
 *
 * Usage:
 *   import { getOrderQueue, startOrderWorker, closeOrderQueue } from './services/queue';
 *   import { schedulePaymentRetry, startPaymentRetryWorker } from './services/queue';
 *
 * Enqueue an order:
 *   const queue = getOrderQueue();
 *   if (queue) {
 *     await queue.add('order-execution', { correlationId, params, enqueuedAt });
 *   } else {
 *     // Fall back to synchronous execution
 *   }
 *
 * ============================================================================
 */

export { getOrderQueue, closeOrderQueue } from './orderQueue';
export { startOrderWorker, stopOrderWorker } from './orderWorker';
export type { OrderJobData, OrderJobResult, OrderJobStatus } from './types';

// ──── Payment Retry Queue ────────────────────────────────────────
export {
  getPaymentRetryQueue,
  schedulePaymentRetry,
  closePaymentRetryQueue,
} from './paymentRetryQueue';
export { startPaymentRetryWorker, stopPaymentRetryWorker } from './paymentRetryWorker';
export type { PaymentRetryJobData, PaymentRetryJobResult } from './paymentRetryTypes';
export { MAX_PAYMENT_RETRIES, PAYMENT_RETRY_DELAYS } from './paymentRetryTypes';

// ──── Trial Reminder Queue ───────────────────────────────────────
export {
  getTrialReminderQueue,
  scheduleTrialReminder,
  closeTrialReminderQueue,
} from './trialReminderQueue';
export { startTrialReminderWorker, stopTrialReminderWorker } from './trialReminderWorker';
export type { TrialReminderJobData, TrialReminderJobResult } from './trialReminderTypes';
export { getReminderDelayMs } from './trialReminderTypes';

// ──── Market Schedule Worker ────────────────────────────────────
export { startMarketScheduleWorker, stopMarketScheduleWorker, getMarketScheduleHealth, _resetMarketScheduleMetrics } from './marketScheduleWorker';
export type { MarketScheduleHealth } from './marketScheduleWorker';

// ──── Stock Alert Poller ────────────────────────────────────────
export { startStockAlertPoller, stopStockAlertPoller, getStockAlertPollerHealth, _resetStockAlertPollerMetrics } from './stockAlertPoller';
export type { StockAlertPollerHealth } from './stockAlertPoller';
