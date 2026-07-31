/**
 * ============================================================================
 * Toroloom — useLiveConversion Hook
 * ============================================================================
 *
 * Shared hook that wraps useForexRates and provides live-rate-aware conversion
 * utilities. Used by both CurrencyConverterModal (bottom sheet) and
 * CurrencyConverterScreen (standalone screen) to keep the conversion logic DRY.
 *
 * Usage:
 *   const {
 *     getLiveCurrencyRate,  // (code: string) => number  — live INR rate or static fallback
 *     convertWithLive,      // (amount, from, to) => number — convert using live rates
 *     getLiveCurrency,      // (code: string) => CurrencyInfo — currency with live rate override
 *     isLive,               // boolean — true if API data is being used
 *     isLoading,            // boolean — true during initial fetch
 *     lastUpdated,          // Date | null
 *     refresh,              // () => Promise<void>
 *   } = useLiveConversion(enabled);
 * ============================================================================
 */

import { useCallback } from 'react';
import { getCurrency } from '../utils/currencyConverter';
import { useForexRates, type UseForexRatesResult } from './useForexRates';
import type { ForexRates } from '../services/forexRateService';
import type { CurrencyInfo } from '../utils/currencyConverter';

export interface UseLiveConversionResult extends Pick<
  UseForexRatesResult,
  'isLive' | 'isLoading' | 'error' | 'lastUpdated' | 'refresh'
> {
  /**
   * Raw live rate map (code → INR rate). Only contains codes with an actual
   * live value — codes without live data are absent (use getLiveCurrencyRate
   * when a static fallback is acceptable).
   */
  rates: ForexRates;

  /**
   * Get the INR rate for a currency, using live data when available.
   * Falls back to the static rate from currencyConverter.ts.
   */
  getLiveCurrencyRate: (code: string) => number;

  /**
   * Convert an amount between two currencies using live rates.
   * Uses INR bridge: result = (amount * from.inrRate) / to.inrRate
   */
  convertWithLive: (amount: number, fromCode: string, toCode: string) => number;

  /**
   * Get a CurrencyInfo object with the inrRate overridden by live data.
   */
  getLiveCurrency: (code: string) => CurrencyInfo;
}

/**
 * React hook providing live-rate-aware currency conversion utilities.
 *
 * @param enabled — Whether the underlying useForexRates hook should poll for
 *   live data. Pass `false` when the component is hidden to avoid unnecessary
 *   network requests.
 */
export function useLiveConversion(enabled: boolean = true): UseLiveConversionResult {
  const { rates: liveRates, isLive, isLoading, error, lastUpdated, refresh } = useForexRates(enabled);

  // Expose the raw live map so consumers can distinguish "live value present"
  // from "static fallback" (e.g. avoid clobbering REST-fetched rates offline).

  const getLiveCurrencyRate = useCallback((code: string): number => {
    return liveRates[code] ?? getCurrency(code).inrRate;
  }, [liveRates]);

  const convertWithLive = useCallback((amount: number, fromCode: string, toCode: string): number => {
    if (fromCode === toCode) return amount;
    const fromRate = getLiveCurrencyRate(fromCode);
    const toRate = getLiveCurrencyRate(toCode);
    if (fromRate === 0 || toRate === 0) return 0;
    return (amount * fromRate) / toRate;
  }, [getLiveCurrencyRate]);

  const getLiveCurrency = useCallback((code: string) => {
    const base = getCurrency(code);
    const liveInrRate = liveRates[code];
    if (liveInrRate !== undefined) {
      return { ...base, inrRate: liveInrRate };
    }
    return base;
  }, [liveRates]);

  return {
    rates: liveRates,
    getLiveCurrencyRate,
    convertWithLive,
    getLiveCurrency,
    isLive,
    isLoading,
    error,
    lastUpdated,
    refresh,
  };
}
