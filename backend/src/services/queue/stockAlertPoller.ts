/**
 * ============================================================================
 * Toroloom — Stock Alert Poller
 * ============================================================================
 *
 * Periodic poller that checks active stock price alerts against live market
 * prices and auto-triggers alerts when target conditions are met.
 *
 * Flow:
 *   1. Every 60s, collects all active alerts grouped by symbol
 *   2. Fetches current prices for those symbols via the active broker
 *   3. Compares each alert's targetPrice + direction with the current price
 *   4. Triggers alerts whose conditions are met (above/below target)
 *   5. Creates notifications and fires webhook events for triggered alerts
 *
 * Follows the same lightweight setInterval pattern as marketScheduleWorker.
 *
 * ============================================================================
 */

import { getBroker } from '../broker';
import { saveNotification } from '../notifications';
import { dispatchWebhookEvent } from '../webhookService';
import {
  getActiveAlertsBySymbols,
  triggerAlert,
} from '../stockAlertService';

/** Polling interval: check alerts every 60 seconds */
const POLL_INTERVAL_MS = 60_000;

/** Periodic timer handle (for cleanup) */
let pollerTimer: ReturnType<typeof setInterval> | null = null;

/** Guard flag prevents overlapping poll cycles (async doPoll may take >60s) */
let _pollingInProgress = false;

// ──── Health / Metrics Tracking ──────────────────────────────────────────

let startedAt: string | null = null;
let lastPollTimestamp: string | null = null;
let totalPolls = 0;
let totalErrors = 0;
let totalTriggered = 0;
let lastCheckedCount = 0;

/**
 * Internal poll handler. Fetches market prices and triggers matching alerts.
 * Uses a guard flag (_pollingInProgress) to prevent overlapping cycles in
 * case a poll takes longer than the 60s interval.
 */
async function doPoll(): Promise<void> {
  if (_pollingInProgress) return;
  _pollingInProgress = true;
  totalPolls++;

  try {
    // 1. Collect all active alerts grouped by symbol
    // getActiveAlertsBySymbols with empty array fetches ALL active alerts
    const allActiveAlerts = await getActiveAlertsBySymbols([]);

    if (allActiveAlerts.size === 0) {
      // No active alerts — nothing to do
      lastPollTimestamp = new Date().toISOString();
      lastCheckedCount = 0;
      return;
    }

    // 2. Fetch current prices from the broker
    const symbols = Array.from(allActiveAlerts.keys());
    const broker = await getBroker();
    const quotes = await broker.getBulkQuotes(symbols);

    // 3. Check each alert against the current price
    let triggeredThisCycle = 0;
    for (const [symbol, alerts] of allActiveAlerts) {
      const quote = quotes.get(symbol);
      if (!quote) continue; // Symbol not found — skip

      const currentPrice = quote.lastPrice;

      for (const alert of alerts) {
        let shouldTrigger = false;

        if (alert.direction === 'above' && currentPrice >= alert.targetPrice) {
          shouldTrigger = true;
        } else if (alert.direction === 'below' && currentPrice <= alert.targetPrice) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          // Trigger the alert (status = 'triggered', records the price)
          const triggered = await triggerAlert(alert.id, alert.userId, currentPrice);
          if (triggered) {
            triggeredThisCycle++;
            totalTriggered++;

            // Create a notification for the user
            const directionLabel = alert.direction;
            await saveNotification({
              id: `sa_ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              userId: alert.userId,
              type: 'price_alert',
              title: `🎯 Alert Triggered: ${symbol}`,
              message: `${symbol} hit ₹${currentPrice.toFixed(2)} — your ${directionLabel} target of ₹${alert.targetPrice} was met!`,
              read: false,
              timestamp: new Date().toISOString(),
              data: {
                alertId: alert.id,
                symbol,
                targetPrice: alert.targetPrice,
                triggeredPrice: currentPrice,
                direction: alert.direction,
              },
            });

            // Fire webhook event (fire-and-forget)
            dispatchWebhookEvent('price:alert_triggered', {
              alertId: alert.id,
              symbol,
              targetPrice: alert.targetPrice,
              triggeredPrice: currentPrice,
              direction: alert.direction,
            }, alert.userId).catch(() => {});
          }
        }
      }
    }

    lastCheckedCount = symbols.length;
    lastPollTimestamp = new Date().toISOString();

    if (triggeredThisCycle > 0 && process.env.NODE_ENV !== 'test') {
      console.log(
        `   [StockAlerts] Poll completed — ${triggeredThisCycle} alert(s) triggered across ${symbols.length} symbol(s)`,
      );
    }
  } catch (error: unknown) {
    totalErrors++;
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[StockAlerts] Poll error (${totalErrors}): ${message}`);
  } finally {
    _pollingInProgress = false;
  }
}

// ──── Public API ─────────────────────────────────────────────────────────

/**
 * Health snapshot for the stock alert poller.
 */
export interface StockAlertPollerHealth {
  isRunning: boolean;
  startedAt: string | null;
  lastPollTimestamp: string | null;
  totalPolls: number;
  totalErrors: number;
  totalTriggered: number;
  lastCheckedCount: number;
  pollIntervalMs: number;
  uptimeSeconds: number | null;
}

/**
 * Returns the current health / metrics snapshot.
 */
export function getStockAlertPollerHealth(): StockAlertPollerHealth {
  let uptimeSeconds: number | null = null;
  if (startedAt) {
    uptimeSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  }

  return {
    isRunning: pollerTimer !== null,
    startedAt,
    lastPollTimestamp,
    totalPolls,
    totalErrors,
    totalTriggered,
    lastCheckedCount,
    pollIntervalMs: POLL_INTERVAL_MS,
    uptimeSeconds,
  };
}

/**
 * Start the stock alert poller.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startStockAlertPoller(): void {
  if (pollerTimer) {
    return; // Already running
  }

  startedAt = new Date().toISOString();
  pollerTimer = setInterval(doPoll, POLL_INTERVAL_MS);

  // Fire immediately on start
  doPoll();

  if (process.env.NODE_ENV !== 'test') {
    console.log('   [StockAlerts] Poller started — checks active alerts every 60s');
  }
}

/**
 * Gracefully stop the stock alert poller.
 * Call during server shutdown.
 */
export function stopStockAlertPoller(): void {
  if (pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = null;
    _pollingInProgress = false;

    if (process.env.NODE_ENV !== 'test') {
      console.log('   [StockAlerts] Poller stopped');
    }
  }
}

/**
 * Reset all metrics (for testing).
 */
export function _resetStockAlertPollerMetrics(): void {
  startedAt = null;
  lastPollTimestamp = null;
  totalPolls = 0;
  totalErrors = 0;
  totalTriggered = 0;
  lastCheckedCount = 0;
  _pollingInProgress = false;
}
