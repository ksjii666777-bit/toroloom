/**
 * ============================================================================
 * Toroloom — Forex Rate Service
 * ============================================================================
 *
 * Fetches live exchange rates from Frankfurter API (no API key required).
 * Falls back to static rates on network failure.
 *
 * Architecture:
 *   forexRateService (pure) → useForexRates (React hook) → CurrencyConverterModal
 *
 * Caching:
 *   - In-memory cache with 5-minute TTL
 *   - No AsyncStorage persistence — rates are ephemeral
 *   - Stale-while-revalidate: returns cached rates immediately, refreshes in bg
 *
 * Frankfurter API:
 *   https://api.frankfurter.dev/v2/latest?base=INR
 *   Returns EUR-based rates — we derive INR rates via the EUR bridge.
 *
 * ============================================================================
 */

import { CURRENCIES, getCurrency } from '../utils/currencyConverter';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ForexRates {
  /** ISO 4217 currency code → INR rate (e.g., USD → 83.45) */
  [code: string]: number;
}

export interface CacheEntry {
  rates: ForexRates;
  timestamp: number;
}

export interface FetchResult {
  rates: ForexRates;
  isLive: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const FRANKFURTER_API = 'https://api.frankfurter.dev/v2/latest';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** The subset of currency codes we care about */
const TRACKED_CODES = new Set(CURRENCIES.map(c => c.code));

// ── Cache ────────────────────────────────────────────────────────────────────

let cache: CacheEntry | null = null;

export function getCache(): CacheEntry | null {
  return cache;
}

export function clearCache(): void {
  cache = null;
}

// ── Static fallback rates (from currencyConverter.ts) ─────────────────────────

export function getStaticRates(): ForexRates {
  const rates: ForexRates = {};
  for (const cur of CURRENCIES) {
    rates[cur.code] = cur.inrRate;
  }
  return rates;
}

// ── Frankfurter API ──────────────────────────────────────────────────────────

/**
 * Build a query string for tracked currencies.
 * Frankfurter supports `from` (base) and `to` (comma-separated symbols).
 *
 * We fetch against EUR because Frankfurter's free tier only supports EUR as base.
 * Then we calculate INR rates using EUR as the bridge.
 *
 *   INR rate for USD = EUR/INR rate / EUR/USD rate
 */
const TRACKED_SYMBOLS = Array.from(TRACKED_CODES).filter(c => c !== 'EUR').join(',');

/**
 * Parse the Frankfurter API response (EUR-based) into INR-based rates.
 *
 * Frankfurter returns: { amount: 1, base: "EUR", date: "2025-01-15", rates: { USD: 1.08, INR: 90.78, ... } }
 *
 * We derive INR rates via:
 *   inrRate(USD) = EUR_INR / EUR_USD = 90.78 / 1.08 = 84.06
 */
function parseFrankfurterResponse(data: any): ForexRates | null {
  if (!data || !data.rates || typeof data.rates !== 'object') return null;

  const eurRateInInr = data.rates['INR'];
  if (!eurRateInInr || typeof eurRateInInr !== 'number') return null;

  const rates: ForexRates = { EUR: 0, INR: 1 };
  rates.EUR = eurRateInInr; // EUR/INR rate

  for (const code of TRACKED_CODES) {
    if (code === 'INR') continue;
    if (code === 'EUR') {
      rates.EUR = eurRateInInr; // 1 EUR = X INR
      continue;
    }
    const eurRate = data.rates[code];
    if (eurRate && typeof eurRate === 'number' && eurRate > 0) {
      // inrRate(code) = EUR/INR / EUR/code
      rates[code] = eurRateInInr / eurRate;
    } else {
      // Fallback to static rate for this currency
      rates[code] = getCurrency(code).inrRate;
    }
  }

  return rates;
}

/**
 * Fetch live rates from Frankfurter API.
 * Returns null on network error or parse failure.
 */
export async function fetchLiveRates(): Promise<ForexRates | null> {
  try {
    const url = `${FRANKFURTER_API}?base=EUR&to=${TRACKED_SYMBOLS}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[ForexRateService] Frankfurter API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    return parseFrankfurterResponse(data);
  } catch (err) {
    console.warn('[ForexRateService] Network error fetching rates:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch the latest forex rates with cache layer.
 *
 * Caching strategy:
 *   1. If cache is fresh (within TTL), return cached rates immediately.
 *   2. If cache is stale, return cached rates but refresh in the background.
 *   3. If no cache exists, fetch synchronously.
 *
 * Returns: { rates, isLive, lastUpdated, error }
 */
export async function getForexRates(): Promise<FetchResult> {
  const now = Date.now();

  // ── Cache hit (fresh) ──────────────────────────────────────────────────
  if (cache && (now - cache.timestamp) < CACHE_TTL_MS) {
    return {
      rates: { ...cache.rates },
      isLive: true,
      lastUpdated: new Date(cache.timestamp),
      error: null,
    };
  }

  // ── Cache hit (stale) — background refresh ────────────────────────────
  if (cache) {
    // Don't await — let it refresh in background
    fetchLiveRates().then(liveRates => {
      if (liveRates) {
        cache = { rates: liveRates, timestamp: Date.now() };
      }
    }).catch(() => { /* Silently ignore background refresh error */ });

    return {
      rates: { ...cache.rates },
      isLive: true,
      lastUpdated: new Date(cache.timestamp),
      error: null,
    };
  }

  // ── No cache — fetch synchronously ────────────────────────────────────
  const liveRates = await fetchLiveRates();

  if (liveRates) {
    cache = { rates: liveRates, timestamp: now };
    return {
      rates: liveRates,
      isLive: true,
      lastUpdated: new Date(now),
      error: null,
    };
  }

  // ── Fallback to static rates ──────────────────────────────────────────
  return {
    rates: getStaticRates(),
    isLive: false,
    lastUpdated: null,
    error: 'Using static rates. Could not fetch live data.',
  };
}

/**
 * Force a fresh fetch from the API, bypassing cache.
 * Useful for pull-to-refresh.
 */
export async function refreshRates(): Promise<FetchResult> {
  const liveRates = await fetchLiveRates();

  if (liveRates) {
    cache = { rates: liveRates, timestamp: Date.now() };
    return {
      rates: liveRates,
      isLive: true,
      lastUpdated: new Date(),
      error: null,
    };
  }

  // Keep existing cache or fallback
  if (cache) {
    return {
      rates: { ...cache.rates },
      isLive: true,
      lastUpdated: new Date(cache.timestamp),
      error: null,
    };
  }

  return {
    rates: getStaticRates(),
    isLive: false,
    lastUpdated: null,
    error: 'Using static rates. Could not fetch live data.',
  };
}
