/**
 * ============================================================================
 * Toroloom — Market Schedule Worker
 * ============================================================================
 *
 * Periodic scheduler that polls `isMarketHours()` every 30 seconds to detect
 * market open/close transitions and fire the corresponding webhook events.
 *
 * Why a periodic poll instead of a cron job?
 *   - `isMarketHours()` (in routes/ironLock.ts) uses a module-level
 *     `lastMarketWasOpen` variable to detect transitions from open→close
 *     and close→open. Webhook events fire ONLY on the transition, not on
 *     every poll.
 *   - Without this worker, market open/close events only fire when an API
 *     request hits an ironLock endpoint. During quiet periods (e.g. weekends,
 *     holidays, low traffic) the transition would be missed.
 *   - The 30-second interval is well below the ~6-hour gap between market
 *     open and close, so transitions are detected within 30s of occurring.
 *
 * This worker does NOT use BullMQ/Redis — it's a lightweight in-process
 * setInterval that starts/stops alongside the server.
 *
 * ============================================================================
 */

import { isMarketHours } from '../../routes/ironLock';
import { updateMarketScheduleMetrics, _resetMarketScheduleMetricsPrometheus } from '../metrics';

/** Interval (ms) between market status polls — 30 seconds */
const POLL_INTERVAL_MS = 30_000;

/** Periodic timer handle (for cleanup) */
let marketScheduleTimer: ReturnType<typeof setInterval> | null = null;

// ──── Health / Metrics Tracking ─────────────────────────────────

/** Timestamp (ISO string) when the worker was last started */
let startedAt: string | null = null;

/** Timestamp (ISO string) of the last successful poll */
let lastPollTimestamp: string | null = null;

/** Total number of polls (initial + interval ticks) since worker start */
let totalPolls = 0;

/** Total number of poll errors since worker start */
let totalErrors = 0;

/** Number of market:close transitions detected by the poller */
let marketCloseCount = 0;

/** Number of market:open transitions detected by the poller */
let marketOpenCount = 0;

/** Last known market-hours state from the previous poll (for transition detection) */
let lastPollResult: boolean | null = null;

/**
 * Internal poll handler. Calls `isMarketHours()` and updates tracking metrics
 * including transition detection for market open/close.
 *
 * Safe to call from both the initial startup and the interval callback.
 */
function doPoll(): void {
  totalPolls++;
  try {
    const result = isMarketHours();
    lastPollTimestamp = new Date().toISOString();

    // Detect market open/close transitions
    if (lastPollResult === false && result === true) {
      marketOpenCount++;
    }
    if (lastPollResult === true && result === false) {
      marketCloseCount++;
    }
    lastPollResult = result;
  } catch (error: unknown) {
    totalErrors++;
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MarketSchedule] Poll error (${totalErrors}): ${message}`);
  }

  // Push metrics to Prometheus registry after every poll
  pushMetrics();
}

/**
 * Push the current health snapshot to the Prometheus registry.
 * Called after every poll and on start/stop state changes.
 */
function pushMetrics(): void {
  updateMarketScheduleMetrics(getMarketScheduleHealth());
}

/**
 * Return type for {@link getMarketScheduleHealth}.
 */
export interface MarketScheduleHealth {
  isRunning: boolean;
  startedAt: string | null;
  lastPollTimestamp: string | null;
  totalPolls: number;
  totalErrors: number;
  marketOpenCount: number;
  marketCloseCount: number;
  pollIntervalMs: number;
  uptimeSeconds: number | null;
}

/**
 * Returns the current health / metrics snapshot for the market schedule worker.
 *
 * Use this in health check endpoints (e.g., `/health`, `/api/queue/status`)
 * to monitor whether the market open/close poller is running correctly.
 */
export function getMarketScheduleHealth(): MarketScheduleHealth {
  let uptimeSeconds: number | null = null;
  if (startedAt) {
    uptimeSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  }

  return {
    isRunning: marketScheduleTimer !== null,
    startedAt,
    lastPollTimestamp,
    totalPolls,
    totalErrors,
    marketOpenCount,
    marketCloseCount,
    pollIntervalMs: POLL_INTERVAL_MS,
    uptimeSeconds,
  };
}

/**
 * Start the market schedule poller.
 * Calls `isMarketHours()` every 30 seconds so market open/close transitions
 * are detected and webhook events fire reliably.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 */
/**
 * Reset all tracking metrics. Used by integration tests to clean state
 * between test cases without restarting the module.
 * Only exported for testing — do not call in production code.
 */
export function _resetMarketScheduleMetrics(): void {
  startedAt = null;
  lastPollTimestamp = null;
  totalPolls = 0;
  totalErrors = 0;
  marketOpenCount = 0;
  marketCloseCount = 0;
  lastPollResult = null;

  // Reset Prometheus gauges so stale values don't leak across test cases
  _resetMarketScheduleMetricsPrometheus();
}

/**
 * Start the market schedule poller.
 * Calls `isMarketHours()` every 30 seconds so market open/close transitions
 * are detected and webhook events fire reliably.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startMarketScheduleWorker(): void {
  if (marketScheduleTimer) {
    return; // Already running
  }

  startedAt = new Date().toISOString();

  // Set the interval BEFORE the initial poll so the first pushMetrics()
  // call inside doPoll() reports isRunning = true.
  marketScheduleTimer = setInterval(doPoll, POLL_INTERVAL_MS);

  // Call immediately on start so we set the initial state.
  doPoll();

  if (process.env.NODE_ENV !== 'test') {
    console.log('   [MarketSchedule] Worker started — polls isMarketHours() every 30s');
  }
}

/**
 * Gracefully stop the market schedule poller.
 * Call during server shutdown.
 */
export function stopMarketScheduleWorker(): void {
  if (marketScheduleTimer) {
    clearInterval(marketScheduleTimer);
    marketScheduleTimer = null;

    // Push stopped state to Prometheus
    pushMetrics();

    if (process.env.NODE_ENV !== 'test') {
      console.log('   [MarketSchedule] Worker stopped');
    }
  }
}
