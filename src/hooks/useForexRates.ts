/**
 * ============================================================================
 * Toroloom — useForexRates Hook
 * ============================================================================
 *
 * React hook that wraps forexRateService with:
 *   - Auto-fetch on mount
 *   - Auto-refresh every 5 minutes
 *   - Loading, error, and live/mock state
 *   - Manual refresh function
 *
 * Usage:
 *   const { rates, isLive, isLoading, error, lastUpdated, refresh } = useForexRates();
 *
 *   rates.USD  → 83.45 (INR rate for USD)
 *   isLive     → true if using live API data
 *
 * ============================================================================
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getForexRates, refreshRates, type ForexRates } from '../services/forexRateService';

export interface UseForexRatesResult {
  /** Currency code → INR rate */
  rates: ForexRates;
  /** True if the rates are from the live API (vs static fallback) */
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

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useForexRates(enabled: boolean = true): UseForexRatesResult {
  const [rates, setRates] = useState<ForexRates>({});
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
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

  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;

    // Fetch immediately when enabled
    fetch();

    // Auto-refresh every 5 minutes
    intervalRef.current = setInterval(fetch, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetch, enabled]);

  return {
    rates,
    isLive,
    isLoading,
    error,
    lastUpdated,
    refresh: handleRefresh,
  };
}
