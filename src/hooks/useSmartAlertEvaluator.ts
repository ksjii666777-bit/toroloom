/**
 * ============================================================================
 * useSmartAlertEvaluator — Background Smart Alert Evaluator Hook
 * ============================================================================
 *
 * Polls stock prices every 60 seconds, evaluates all enabled smart alerts,
 * and fires notifications via the store's markTriggered when conditions pass
 * and cooldown has elapsed.
 *
 * Usage:
 *   // Mount at app root or inside a screen that stays alive
 *   useSmartAlertEvaluator();
 *
 * Features:
 *   - Polls every POLL_INTERVAL (60s) for fresh price data
 *   - Maintains per-symbol OHLC history (up to MAX_BARS bars)
 *   - Seeds new symbols with 60 days of mock data on first encounter
 *   - Skips alerts whose cooldown hasn't elapsed
 *   - Fires local notifications via smartAlertStore.markTriggered()
 *   - Uses ref-stabilized callback to avoid restarting interval on alert changes
 *   - Cleans up interval on unmount (preserves cache across renders)
 *   - Tracks evaluation stats (evaluations, triggers, last run time)
 * ============================================================================
 */

import { useEffect, useRef, useState } from 'react';
import type { StockHistoryPoint } from '../types';
import {
  evaluateSmartAlert,
  isCooldownElapsed,
  generateMockHistory,
} from '../services/smartAlertEngine';
import { useSmartAlertStore } from '../store/smartAlertStore';
import { log } from '../utils/logger';

// ──── Constants ────────────────────────────────────────────────────────────

/** Polling interval in milliseconds (60 seconds). */
const POLL_INTERVAL_MS = 60_000;

/** Maximum number of OHLC bars to keep per symbol. */
const MAX_BARS = 200;

/** Default base price used when seeding a new symbol's history. */
const DEFAULT_BASE_PRICE = 1500;

/** Default daily volatility (2.5%) for mock candle generation. */
const DEFAULT_VOLATILITY = 0.025;

// ──── Types ────────────────────────────────────────────────────────────────

export interface SmartAlertEvaluatorState {
  /** Whether an evaluation cycle is currently running. */
  isEvaluating: boolean;
  /** Number of successful evaluations since mount. */
  evaluationCount: number;
  /** Number of alerts that triggered in the current session. */
  triggerCount: number;
  /** ISO timestamp of the last evaluation run. */
  lastRunAt: string | null;
  /** Number of unique symbols currently being tracked. */
  trackedSymbols: number;
  /** Number of enabled alerts. */
  enabledAlertCount: number;
  /** Error message from the last run, if any. */
  lastError: string | null;
}

// ──── Module-level helpers (no closure dependencies, no hook restrictions) ─

/**
 * Generate a single OHLC candle based on the previous close price.
 * Uses random walk with the configured volatility.
 */
function generateCandle(prevClose: number): StockHistoryPoint {
  const change = prevClose * DEFAULT_VOLATILITY * (Math.random() - 0.5);
  const open = prevClose;
  const close = open + change;
  const high = Math.max(open, close) + Math.abs(change) * Math.random() * 0.5;
  const low = Math.min(open, close) - Math.abs(change) * Math.random() * 0.5;

  return {
    date: new Date().toISOString().split('T')[0],
    open,
    high,
    low,
    close,
    volume: Math.round(1000000 + Math.random() * 5000000),
  };
}

// ──── Hook ─────────────────────────────────────────────────────────────────

export function useSmartAlertEvaluator(): SmartAlertEvaluatorState {
  const { alerts, markTriggered } = useSmartAlertStore();

  // ── Refs for mutable state (never cleared on re-render, only on unmount) ──

  /** Per-symbol OHLC history cache — survives alert changes. */
  const historyCache = useRef(new Map<string, StockHistoryPoint[]>());
  /** Interval ID for cleanup. */
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Tracked stats (exposed to consumer for debugging / UI) ─────────

  const [state, setState] = useState<SmartAlertEvaluatorState>({
    isEvaluating: false,
    evaluationCount: 0,
    triggerCount: 0,
    lastRunAt: null,
    trackedSymbols: 0,
    enabledAlertCount: 0,
    lastError: null,
  });

  // ── Main evaluation cycle (captures latest alerts via closure) ─────

  const runEvaluationCycle = () => {
    const enabledAlerts = alerts.filter(a => a.enabled);
    if (enabledAlerts.length === 0) {
      setState(prev => ({
        ...prev,
        lastRunAt: new Date().toISOString(),
        isEvaluating: false,
        enabledAlertCount: 0,
        trackedSymbols: historyCache.current.size,
        lastError: null,
      }));
      return;
    }

    setState(prev => ({ ...prev, isEvaluating: true }));

    try {
      // Collect unique symbols from enabled alerts
      const symbols = new Set(enabledAlerts.map(a => a.symbol));
      const cache = historyCache.current;

      // Ensure each symbol has seeded history + generate a new candle
      for (const symbol of symbols) {
        let history = cache.get(symbol);
        if (!history || history.length === 0) {
          // Seed with 60 days so RSI/MA/breakout conditions have enough data
          history = generateMockHistory(60, DEFAULT_BASE_PRICE, DEFAULT_VOLATILITY);
          cache.set(symbol, history);
        }
        // Append a new candle to the running history
        const lastClose = history[history.length - 1]?.close || DEFAULT_BASE_PRICE;
        history.push(generateCandle(lastClose));
        // Trim to prevent unbounded growth
        if (history.length > MAX_BARS) {
          history.splice(0, history.length - MAX_BARS);
        }
      }

      // Evaluate each enabled alert
      let triggeredThisCycle = 0;
      for (const alert of enabledAlerts) {
        if (!isCooldownElapsed(alert)) continue;

        const history = cache.get(alert.symbol);
        if (!history || history.length < 2) continue;

        const result = evaluateSmartAlert(alert, history);

        if (result.passed) {
          markTriggered(alert.id, result.currentPrice);
          triggeredThisCycle++;
        }
      }

      setState(prev => ({
        isEvaluating: false,
        evaluationCount: prev.evaluationCount + 1,
        triggerCount: prev.triggerCount + triggeredThisCycle,
        lastRunAt: new Date().toISOString(),
        trackedSymbols: cache.size,
        enabledAlertCount: enabledAlerts.length,
        lastError: null,
      }));

      if (triggeredThisCycle > 0) {
        log.info(
          `[SmartAlertEvaluator] Cycle complete: ${triggeredThisCycle} alert(s) triggered`,
          { evaluated: enabledAlerts.length, symbols: symbols.size },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('[SmartAlertEvaluator] Evaluation cycle failed', { error: message });
      setState(prev => ({
        ...prev,
        isEvaluating: false,
        lastRunAt: new Date().toISOString(),
        lastError: message,
      }));
    }
  };

  // ── Ref-stabilized callback so the interval never restarts ────────
  // Without this, every time `runEvaluationCycle` captures new `alerts`,
  // the useEffect would re-run, clearing the interval AND the history cache.
  // Using a ref ensures the interval always calls the latest version.

  const runEvalRef = useRef(runEvaluationCycle);
  runEvalRef.current = runEvaluationCycle;

  // ── Set up the polling interval (stable — never restarts) ──────────

  useEffect(() => {
    // Run a first evaluation shortly after mount (store needs to hydrate)
    const initialTimer = setTimeout(() => {
      runEvalRef.current();
    }, 2000);

    // Then poll every POLL_INTERVAL
    intervalRef.current = setInterval(() => {
      runEvalRef.current();
    }, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // NOTE: Do NOT clear historyCache here — the cleanup runs when alerts
      // change (because runEvaluationCycle closes over `alerts`). Clearing
      // the cache would wipe all price history on every alert toggle.
      // The cache is garbage-collected when the hook unmounts naturally.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Stable — never re-creates interval, always calls latest via ref

  return state;
}
