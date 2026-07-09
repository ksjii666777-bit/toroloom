/**
 * ============================================================================
 * Toroloom — Multi-Timeframe Mock OHLC Generator
 * ============================================================================
 *
 * Generates realistic OHLC (Open, High, Low, Close, Volume) candlestick data
 * for multiple timeframes. Used by MockBroker to power interactive charts.
 *
 * Supported intervals:
 *   Intraday: 1min, 5min, 15min, 30min, 1h  (market hours 9:15-15:30 IST)
 *   Daily:    1d                               (one candle per trading day)
 *   Weekly:   1w                               (one candle per ~5 trading days)
 *   Monthly:  1m                               (one candle per ~22 trading days)
 *
 * Features:
 *   - Random walk with momentum (trend persistence)
 *   - U-shaped volume pattern for intraday (higher at open/close)
 *   - Higher volatility at market open/close
 *   - Overnight gap for daily candles
 *   - Skips weekends for all non-intraday intervals
 *   - Adjustable volatility per interval
 * ============================================================================
 */

import type { OHLCData } from '../services/broker/interface';

// ============================================================================
// Constants
// ============================================================================

/** Market open: 9:15 AM IST */
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 15;

/** Market close: 3:30 PM IST */
const MARKET_CLOSE_HOUR = 15;
const MARKET_CLOSE_MINUTE = 30;

/** Total trading minutes per day = 6.25 hours = 375 minutes */
const TRADING_MINUTES_PER_DAY = 375;

/** Interval to minutes lookup */
const INTERVAL_MINUTES: Record<string, number> = {
  '1min': 1,
  '5min': 5,
  '15min': 15,
  '30min': 30,
  '1h': 60,
  '1d': 1440,
  '1w': 10080,
  '1m': 43200,
};

/**
 * Maximum candles generated per interval to keep response sizes manageable.
 * - Intraday: enough for a full trading day's history
 * - Daily: capped at 2 years' worth of trading days (~520)
 * - Weekly/Monthly: fewer, longer lookback
 */
const MAX_CANDLES: Record<string, number> = {
  '1min': 2000,
  '5min': 2000,
  '15min': 1500,
  '30min': 1000,
  '1h': 750,
  '1d': 520,
  '1w': 156,
  '1m': 60,
};

// ============================================================================
// Helpers
// ============================================================================

function isTradingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // Skip Sunday (0) and Saturday (6)
}

function getMarketOpen(date: Date): Date {
  const d = new Date(date);
  d.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE, 0, 0);
  return d;
}

function getMarketClose(date: Date): Date {
  const d = new Date(date);
  d.setHours(MARKET_CLOSE_HOUR, MARKET_CLOSE_MINUTE, 0, 0);
  return d;
}

/**
 * Random walk state — keeps momentum across candles for realistic trends.
 */
interface WalkState {
  price: number;
  momentum: number;
}

function nextPrice(
  state: WalkState,
  baseVolatility: number,
  volatilityMultiplier: number,
  minPriceFactor: number,
): WalkState {
  // Momentum decay: 60% of previous momentum + 40% random noise
  state.momentum = state.momentum * 0.6 + (Math.random() - 0.48) * 0.4;

  // Slight bullish bias (random 0-0.48 vs 0.5 neutral) to avoid flatlining
  const change =
    state.momentum * baseVolatility * volatilityMultiplier +
    (Math.random() - 0.48) * baseVolatility * 0.8 * volatilityMultiplier;

  const newPrice = Math.max(state.price + change, state.price * minPriceFactor);
  state.price = Math.round(newPrice * 100) / 100;
  return state;
}

function roundCandlePrice(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================================================
// Intraday Generator (1min, 5min, 15min, 30min, 1h)
// ============================================================================

/**
 * Generate intraday OHLC data for the requested number of calendar days.
 * Each trading day generates candles from 9:15 to 15:30 based on interval.
 * Non-trading days (weekends) are skipped.
 */
function generateIntraday(
  basePrice: number,
  interval: string,
  days: number,
): OHLCData[] {
  const data: OHLCData[] = [];
  const intervalMin = INTERVAL_MINUTES[interval] || 5;
  const candlesPerDay = Math.floor(TRADING_MINUTES_PER_DAY / intervalMin);
  const maxCandles = MAX_CANDLES[interval] || 1000;

  const state: WalkState = { price: basePrice, momentum: 0 };
  const today = new Date();
  let totalGenerated = 0;

  // Walk backward from today to generate candles
  for (let d = days; d >= 0 && totalGenerated < maxCandles; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    if (!isTradingDay(date)) continue;

    const marketOpen = getMarketOpen(date);

    for (let c = 0; c < candlesPerDay && totalGenerated < maxCandles; c++) {
      const candleTime = new Date(marketOpen);
      candleTime.setMinutes(candleTime.getMinutes() + c * intervalMin);

      // Time progress within the day (0.0 = open, 1.0 = close)
      const timeFactor = c / candlesPerDay;

      // U-shaped volume: higher at open and close, lower midday
      const volumePattern = 0.4 + 0.6 * (1 - Math.abs(timeFactor - 0.5) * 2);

      // Volatility: higher at open (news/orders) and close (position squaring)
      const volMultiplier = 1 + 0.4 * (1 - Math.abs(timeFactor - 0.5) * 2);

      // Base volatility scales with price and time interval
      const baseVol = basePrice * 0.0015 * Math.sqrt(intervalMin / 5);

      const open = state.price;
      nextPrice(state, baseVol, volMultiplier, 0.92);
      const close = state.price;

      // High/low extend beyond open/close
      const spread = Math.abs(close - open);
      const high = roundCandlePrice(Math.max(open, close) + spread * (0.2 + Math.random() * 0.5));
      const low = roundCandlePrice(Math.min(open, close) - spread * (0.2 + Math.random() * 0.5));

      data.push({
        date: candleTime.toISOString(),
        open: roundCandlePrice(open),
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 1500000 * volumePattern) + 300000,
      });

      totalGenerated++;
    }

    // Overnight gap: random price jump between trading days
    const gap = (Math.random() - 0.48) * basePrice * 0.004;
    state.price = Math.max(state.price + gap, basePrice * 0.5);
  }

  return data;
}

// ============================================================================
// Daily Generator
// ============================================================================

/**
 * Generate daily OHLC data. One candle per trading day.
 * Skips weekends for a realistic trading calendar.
 */
function generateDaily(
  basePrice: number,
  days: number,
): OHLCData[] {
  const data: OHLCData[] = [];
  const maxCandles = MAX_CANDLES['1d'];
  const state: WalkState = { price: basePrice, momentum: 0 };
  const today = new Date();
  let totalGenerated = 0;

  for (let i = days; i >= 0 && totalGenerated < maxCandles; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (!isTradingDay(date)) continue;

    const open = state.price;

    // Higher volatility for daily (more time between candles)
    const baseVol = basePrice * 0.012;

    // Momentum with higher persistence for daily trends
    state.momentum = state.momentum * 0.7 + (Math.random() - 0.48) * 0.3;
    const change =
      state.momentum * baseVol +
      (Math.random() - 0.5) * baseVol * 0.5;

    const close = roundCandlePrice(Math.max(open + change, open * 0.85));
    state.price = close;

    const spread = Math.abs(close - open);
    const high = roundCandlePrice(Math.max(open, close) + spread * (0.3 + Math.random() * 0.6));
    const low = roundCandlePrice(Math.min(open, close) - spread * (0.3 + Math.random() * 0.6));

    data.push({
      date: date.toISOString().split('T')[0],
      open: roundCandlePrice(open),
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 18000000) + 4000000,
    });

    totalGenerated++;
  }

  return data;
}

// ============================================================================
// Weekly Generator
// ============================================================================

/**
 * Generate weekly OHLC data. One candle per ~5 trading days.
 * Uses higher volatility for the longer aggregation period.
 */
function generateWeekly(
  basePrice: number,
  days: number,
): OHLCData[] {
  return generateAggregated(basePrice, days, 5, 'weekly');
}

// ============================================================================
// Monthly Generator
// ============================================================================

/**
 * Generate monthly OHLC data. One candle per ~22 trading days.
 * Uses even higher volatility for the monthly period.
 */
function generateMonthly(
  basePrice: number,
  days: number,
): OHLCData[] {
  return generateAggregated(basePrice, days, 22, 'monthly');
}

/**
 * Generic aggregated-interval generator (used by weekly and monthly).
 * Simulates price movement across N trading days, then emits one candle.
 * This provides realistic-looking weekly/monthly candles with proper
 * cumulative high/low ranges.
 */
function generateAggregated(
  basePrice: number,
  days: number,
  candlesPerGroup: number,
  label: string,
): OHLCData[] {
  const data: OHLCData[] = [];
  const maxCandles = label === 'monthly' ? MAX_CANDLES['1m'] : MAX_CANDLES['1w'];
  const state: WalkState = { price: basePrice, momentum: 0 };
  const today = new Date();
  let totalGenerated = 0;
  let tradingDayCount = 0;
  let groupOpen = basePrice;
  let groupHigh = basePrice;
  let groupLow = basePrice;
  let groupVolume = 0;
  let groupDate: Date | null = null;

  function emitGroup(): void {
    if (!groupDate) return;
    data.push({
      date: groupDate.toISOString().split('T')[0],
      open: roundCandlePrice(groupOpen),
      high: roundCandlePrice(groupHigh),
      low: roundCandlePrice(groupLow),
      close: roundCandlePrice(state.price),
      volume: groupVolume,
    });
    totalGenerated++;
  }

  for (let i = days; i >= 0 && totalGenerated < maxCandles; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (!isTradingDay(date)) continue;

    tradingDayCount++;

    // Start of a new group
    if (tradingDayCount % candlesPerGroup === 1) {
      groupOpen = state.price;
      groupHigh = state.price;
      groupLow = state.price;
      groupVolume = 0;
      groupDate = date;
    }

    // Simulate the trading day's price movement
    const baseVol = basePrice * 0.012;
    state.momentum = state.momentum * 0.7 + (Math.random() - 0.48) * 0.3;
    const change =
      state.momentum * baseVol +
      (Math.random() - 0.5) * baseVol * 0.5;
    const newPrice = Math.max(state.price + change, state.price * 0.88);
    state.price = roundCandlePrice(newPrice);

    // Track high/low within the group
    groupHigh = Math.max(groupHigh, state.price);
    groupLow = Math.min(groupLow, state.price);
    groupVolume += Math.floor(Math.random() * 18000000) + 4000000;

    // Emit at the end of each group
    if (tradingDayCount % candlesPerGroup === 0) {
      emitGroup();
    }
  }

  // Emit partial trailing group if any
  if (tradingDayCount % candlesPerGroup !== 0 && totalGenerated < maxCandles) {
    emitGroup();
  }

  return data;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate realistic multi-timeframe OHLC candlestick data for charting.
 *
 * @param basePrice  Starting price for the random walk
 * @param interval   Candle interval: '1min' | '5min' | '15min' | '30min' | '1h' | '1d' | '1w' | '1m'
 * @param days       Lookback period in calendar days
 * @returns          Array of OHLCData points sorted chronologically (oldest first)
 */
export function generateMultiTimeframeOHLC(
  basePrice: number,
  interval: string,
  days: number,
): OHLCData[] {
  const safeDays = Math.min(Math.max(days, 1), 730);

  switch (interval) {
    case '1min':
    case '5min':
    case '15min':
    case '30min':
    case '1h':
      return generateIntraday(basePrice, interval, safeDays);
    case '1d':
      return generateDaily(basePrice, safeDays);
    case '1w':
      return generateWeekly(basePrice, safeDays);
    case '1m':
      return generateMonthly(basePrice, safeDays);
    default:
      // Fallback to daily for unknown intervals
      return generateDaily(basePrice, safeDays);
  }
}
