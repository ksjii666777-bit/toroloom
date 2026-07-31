/**
 * ============================================================================
 * Toroloom — Shared Forex Quote Generator
 * ============================================================================
 *
 * Single source of truth for simulated forex tick generation. Used by:
 *   - MockBroker        (getQuote / getBulkQuotes / subscribeTicks)
 *   - ZerodhaBroker     (subscribeTicks — forex fallback when Kite tokens
 *                        cannot be resolved, e.g. USDINR / EURUSD)
 *   - UpstoxBroker      (subscribeTicks — forex streaming while the Upstox
 *                        market-data WS is not yet implemented)
 *   - AngelBroker       (subscribeTicks — forex fallback when SmartAPI token
 *                        resolution fails for currency pairs)
 *
 * The real brokers stream REAL ticks for resolvable symbols; forex pairs are
 * streamed from this shared simulator so the /ws feed always has live forex
 * data regardless of broker instrument coverage.
 * ============================================================================
 */

import type { MarketQuote } from './interface';

// ═══════════════════════════════════════════════════════════════════════════════
// FOREX SEEDS (mirrors forexService.ts MOCK_PAIRS)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Realistic forex price anchors used for simulated tick generation.
 * Rates are quote-per-base (e.g. USDINR = 83.45 means 1 USD = 83.45 INR).
 */
export interface ForexSeed {
  symbol: string;
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  /** Base rate (quote per base) */
  basePrice: number;
  /** Annualized volatility factor (lower = smoother) */
  volatility: number;
  /** Typical daily range as fraction of price */
  dailyRange: number;
}

export const forexSeeds: ForexSeed[] = [
  // ── INR pairs (quote directly as rates for the frontend) ──
  { symbol: 'USDINR', pair: 'USD/INR', baseCurrency: 'USD', quoteCurrency: 'INR', basePrice: 83.45, volatility: 0.06, dailyRange: 0.004 },
  { symbol: 'EURINR', pair: 'EUR/INR', baseCurrency: 'EUR', quoteCurrency: 'INR', basePrice: 90.78, volatility: 0.07, dailyRange: 0.005 },
  { symbol: 'GBPINR', pair: 'GBP/INR', baseCurrency: 'GBP', quoteCurrency: 'INR', basePrice: 106.20, volatility: 0.08, dailyRange: 0.006 },
  { symbol: 'JPYINR', pair: 'JPY/INR', baseCurrency: 'JPY', quoteCurrency: 'INR', basePrice: 0.54, volatility: 0.09, dailyRange: 0.007 },
  { symbol: 'SGDINR', pair: 'SGD/INR', baseCurrency: 'SGD', quoteCurrency: 'INR', basePrice: 61.80, volatility: 0.05, dailyRange: 0.003 },
  { symbol: 'CNYINR', pair: 'CNY/INR', baseCurrency: 'CNY', quoteCurrency: 'INR', basePrice: 11.52, volatility: 0.07, dailyRange: 0.005 },
  { symbol: 'HKDINR', pair: 'HKD/INR', baseCurrency: 'HKD', quoteCurrency: 'INR', basePrice: 10.68, volatility: 0.04, dailyRange: 0.003 },
  { symbol: 'THBINR', pair: 'THB/INR', baseCurrency: 'THB', quoteCurrency: 'INR', basePrice: 2.28, volatility: 0.06, dailyRange: 0.005 },
  // ── Crosses ──
  { symbol: 'EURUSD', pair: 'EUR/USD', baseCurrency: 'EUR', quoteCurrency: 'USD', basePrice: 1.0875, volatility: 0.08, dailyRange: 0.006 },
  { symbol: 'GBPUSD', pair: 'GBP/USD', baseCurrency: 'GBP', quoteCurrency: 'USD', basePrice: 1.2730, volatility: 0.09, dailyRange: 0.007 },
  { symbol: 'USDJPY', pair: 'USD/JPY', baseCurrency: 'USD', quoteCurrency: 'JPY', basePrice: 154.80, volatility: 0.10, dailyRange: 0.008 },
];

/**
 * Runtime price state for each forex pair — drifts via random walk.
 * Module-level so all brokers share one consistent market simulation.
 */
const forexPriceState = new Map<string, number>();
for (const seed of forexSeeds) {
  forexPriceState.set(seed.symbol, seed.basePrice);
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/** True when the symbol is a known forex pair (INR pair or cross). */
export function isForexSymbol(symbol: string): boolean {
  return forexSeeds.some(s => s.symbol === symbol);
}

/**
 * Generate a realistic MarketQuote for a forex pair using geometric random walk.
 * Precision adapts to rate magnitude (4 decimals for sub-1 rates like JPYINR).
 * Returns null when the symbol is not a known forex pair.
 */
export function generateForexQuote(symbol: string): MarketQuote | null {
  const seed = forexSeeds.find(s => s.symbol === symbol);
  if (!seed) return null;

  const currentPrice = forexPriceState.get(seed.symbol) ?? seed.basePrice;
  // Precision adapts to rate magnitude: INR pairs & USDJPY use 2 decimals,
  // crosses (EURUSD/GBPUSD) and sub-1 rates (JPYINR/THBINR) use 4.
  const decimals = seed.basePrice >= 10 ? 2 : 4;

  // ── Geometric random walk ───────────────────────────────────
  const stepSize = seed.basePrice * seed.volatility * 0.002;
  const idioShock = (Math.random() - 0.48) * stepSize;
  let newPrice = currentPrice + idioShock;

  // Clamp to prevent extreme moves: ±1% per tick
  const maxMove = currentPrice * 0.01;
  newPrice = Math.max(currentPrice - maxMove, Math.min(currentPrice + maxMove, newPrice));

  // Absolute floor at 50% of base (can't go to zero)
  const floor = seed.basePrice * 0.5;
  newPrice = Math.max(floor, newPrice);
  newPrice = Math.round(newPrice * Math.pow(10, decimals)) / Math.pow(10, decimals);

  // Persist new state
  forexPriceState.set(seed.symbol, newPrice);

  const change = Math.round((newPrice - seed.basePrice) * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const changePercent = Math.round((change / seed.basePrice) * 10000) / 100;

  return {
    symbol: seed.symbol,
    lastPrice: newPrice,
    change,
    changePercent,
    open: Math.round(seed.basePrice * (1 - Math.random() * 0.002) * Math.pow(10, decimals)) / Math.pow(10, decimals),
    high: Math.round(Math.max(newPrice, seed.basePrice) * (1 + Math.random() * 0.002) * Math.pow(10, decimals)) / Math.pow(10, decimals),
    low: Math.round(Math.min(newPrice, seed.basePrice) * (1 - Math.random() * 0.002) * Math.pow(10, decimals)) / Math.pow(10, decimals),
    close: seed.basePrice,
    volume: Math.floor(Math.random() * 100000) + 10000,
    bid: Math.round((newPrice - Math.random() * newPrice * 0.0005) * Math.pow(10, decimals)) / Math.pow(10, decimals),
    ask: Math.round((newPrice + Math.random() * newPrice * 0.0005) * Math.pow(10, decimals)) / Math.pow(10, decimals),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Start a shared simulated forex tick stream for the given symbols.
 * Non-forex symbols are ignored. Returns a stop function.
 *
 * Used by the real brokers in subscribeTicks() as a fallback for currency
 * pairs that their instrument/token resolution cannot handle.
 */
export function startForexTickStream(
  symbols: string[],
  onTick: (quote: MarketQuote) => void,
): () => void {
  const forexSymbols = symbols.filter(isForexSymbol);
  if (forexSymbols.length === 0) return () => {};

  const interval = setInterval(() => {
    forexSymbols.forEach(symbol => {
      const quote = generateForexQuote(symbol);
      if (quote) onTick(quote);
    });
  }, 1000 + Math.random() * 2000);

  return () => clearInterval(interval);
}
