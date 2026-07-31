/**
 * ============================================================================
 * Toroloom — useForexRates Hook
 * ============================================================================
 *
 * React hook that provides forex rates with a WS-first architecture:
 *   - Subscribes to forex pairs over the WebSocket feed (USDINR, EURINR, …)
 *     so rates update in real time while the app is connected.
 *   - Falls back to the REST forexRateService (Frankfurter) for the initial
 *     baseline and whenever the WS feed is unavailable/offline.
 *   - Loading, error, and live state tracking + manual refresh.
 *
 * Usage:
 *   const { rates, isLive, isLoading, error, lastUpdated, refresh } = useForexRates();
 *
 *   rates.USD  → 83.45 (INR rate for USD)
 *   isLive     → true if live data is flowing (WS tick or live API)
 *
 * ============================================================================
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getForexRates, refreshRates, type ForexRates } from '../services/forexRateService';
import { getActiveWS } from '../services/wsRegistry';

// Forex symbols the backend /ws feed streams. Only the INR pairs map directly
// onto the code → INR-rate shape of ForexRates (crosses are not INR-denominated).
const FOREX_WS_SYMBOLS = [
  'USDINR', 'EURINR', 'GBPINR', 'JPYINR',
  'SGDINR', 'CNYINR', 'HKDINR', 'THBINR',
];

/** WS tick symbol → currency code (e.g. USDINR → USD). */
const SYMBOL_TO_CODE: Record<string, string> = {
  USDINR: 'USD', EURINR: 'EUR', GBPINR: 'GBP', JPYINR: 'JPY',
  SGDINR: 'SGD', CNYINR: 'CNY', HKDINR: 'HKD', THBINR: 'THB',
};

export interface UseForexRatesResult {
  /** Currency code → INR rate */
  rates: ForexRates;
  /** True if the rates are live (WS tick or live API, vs static fallback) */
  isLive: boolean;
  /** True during initial fetch (no cached data yet) */
  isLoading: boolean;
  /** Error message if fetch failed and no cache was available */
  error: string | null;
  /** When the rates were last updated (null for static) */
  lastUpdated: Date | null;
  /** Force a fresh fetch from the API */
  refresh: () => Promise<void>;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (REST fallback only)

export function useForexRates(enabled: boolean = true): UseForexRatesResult {
  const [rates, setRates] = useState<ForexRates>({});
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // True when the WS feed has connected — live ticks then drive the rates.
  const [wsConnected, setWsConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    try {
      const result = await getForexRates();
      if (!mountedRef.current) return;
      setRates(result.rates);
      setIsLive(result.isLive);
      setError(result.error);
      setLastUpdated(result.lastUpdated);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch forex rates');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await refreshRates();
      if (!mountedRef.current) return;
      setRates(result.rates);
      setIsLive(result.isLive);
      setError(result.error);
      setLastUpdated(result.lastUpdated);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to refresh forex rates');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // ── WebSocket subscription: live forex ticks (primary source) ────────
  useEffect(() => {
    if (!enabled) return;

    const ws = getActiveWS();
    // WS may be unavailable (not connected / backend offline) — REST fallback covers rates.
    if (!ws) return;
    const conn = ws.connect();
    if (conn && typeof conn.catch === 'function') {
      conn.catch(() => {
        // Connection failed — REST fallback keeps rates flowing.
      });
    }

    // Track WS connection state so the REST poll can pause while live.
    ws.onConnectionChangeCallback?.((connected) => {
      if (!mountedRef.current) return;
      setWsConnected(connected);
      if (connected) {
        setIsLive(true);
        setError(null);
      }
    });

    // Subscribe to each INR pair — a tick updates the code → INR-rate map.
    for (const symbol of FOREX_WS_SYMBOLS) {
      ws.subscribe(
        symbol,
        (tick) => {
          const code = SYMBOL_TO_CODE[tick.stockId];
          if (!code || !mountedRef.current) return;
          setRates(prev => ({ ...prev, [code]: tick.price }));
          setIsLive(true);
          setError(null);
          setLastUpdated(new Date(tick.timestamp || Date.now()));
        },
        () => {}, // No candle data for forex
      );
    }

    return () => {
      for (const symbol of FOREX_WS_SYMBOLS) {
        ws.unsubscribe(symbol);
      }
    };
  }, [enabled]);

  // ── REST fallback: initial baseline + 5-min poll while WS is offline ──
  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;

    // Fetch immediately when enabled (baseline before WS ticks arrive)
    fetch();

    // Auto-refresh every 5 minutes — only when the WS feed is NOT live.
    if (wsConnected) return;
    intervalRef.current = setInterval(fetch, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetch, enabled, wsConnected]);

  return {
    rates,
    isLive,
    isLoading,
    error,
    lastUpdated,
    refresh: handleRefresh,
  };
}
