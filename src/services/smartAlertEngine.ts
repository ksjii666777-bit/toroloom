/**
 * ============================================================================
 * Smart Alert Engine — Multi-Condition Price Alert Evaluation
 * ============================================================================
 *
 * Evaluates complex alert conditions against stock OHLC data:
 *   - Price thresholds & % changes
 *   - Volume spikes / drops
 *   - RSI oversold / overbought / crossovers
 *   - Moving average crossovers
 *   - Candlestick pattern detection (12 patterns)
 *   - Breakout / breakdown from recent range
 *   - Gap detection
 *   - Consecutive gains / losses
 *   - Multi-condition AND / OR logic
 * ============================================================================
 */

import type { StockHistoryPoint } from '../types';

// ============================================================================
// Types
// ============================================================================

export type SmartAlertConditionKind =
  | 'price_cross_above'
  | 'price_cross_below'
  | 'price_change_pct'
  | 'volume_spike'
  | 'volume_drop'
  | 'rsi_oversold'
  | 'rsi_overbought'
  | 'rsi_cross_above'
  | 'rsi_cross_below'
  | 'candle_pattern'
  | 'consecutive_gain'
  | 'consecutive_loss'
  | 'ma_crossover'
  | 'ma_crossunder'
  | 'breakout_high'
  | 'breakout_low'
  | 'gap_up'
  | 'gap_down';

export type CandlePatternName =
  | 'doji'
  | 'hammer'
  | 'shooting_star'
  | 'bullish_engulfing'
  | 'bearish_engulfing'
  | 'bullish_harami'
  | 'bearish_harami'
  | 'morning_star'
  | 'evening_star'
  | 'three_white_soldiers'
  | 'three_black_crows'
  | 'marubozu';

export interface SmartAlertCondition {
  id: string;
  kind: SmartAlertConditionKind;
  params: {
    threshold?: number;
    period?: number;
    pattern?: CandlePatternName;
    multiplier?: number;
    fastPeriod?: number;
    slowPeriod?: number;
  };
}

export type ConditionLogic = 'AND' | 'OR';

export interface SmartAlert {
  id: string;
  name: string;
  symbol: string;
  stockName: string;
  conditions: SmartAlertCondition[];
  logic: ConditionLogic;
  cooldownMinutes: number;
  enabled: boolean;
  triggered: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  notificationType: 'local' | 'push';
  badge: boolean;
}

export interface SmartAlertTriggerEntry {
  alertId: string;
  alertName: string;
  symbol: string;
  conditions: SmartAlertCondition[];
  logic: ConditionLogic;
  price: number;
  timestamp: string;
  summary: string;
}

export interface ConditionEvalResult {
  conditionId: string;
  kind: SmartAlertConditionKind;
  passed: boolean;
  value: number | null;
  threshold: number | null;
  detail: string;
}

export interface SmartAlertEvalResult {
  alertId: string;
  name: string;
  symbol: string;
  passed: boolean;
  conditions: ConditionEvalResult[];
  currentPrice: number;
  timestamp: string;
}

// Candlestick pattern info for UI display
export interface CandlePatternInfo {
  name: CandlePatternName;
  label: string;
  icon: string;
  description: string;
  bullish: boolean;
}

export const CANDLE_PATTERNS: CandlePatternInfo[] = [
  { name: 'doji', label: 'Doji', icon: '◻️', description: 'Open & close are nearly equal — indecision', bullish: false },
  { name: 'hammer', label: 'Hammer', icon: '🔨', description: 'Long lower wick, small body — bullish reversal', bullish: true },
  { name: 'shooting_star', label: 'Shooting Star', icon: '⭐', description: 'Long upper wick, small body — bearish reversal', bullish: false },
  { name: 'bullish_engulfing', label: 'Bullish Engulfing', icon: '🟢', description: 'Green candle fully engulfs prior red — bullish', bullish: true },
  { name: 'bearish_engulfing', label: 'Bearish Engulfing', icon: '🔴', description: 'Red candle fully engulfs prior green — bearish', bullish: false },
  { name: 'bullish_harami', label: 'Bullish Harami', icon: '📗', description: 'Small green inside prior red — reversal', bullish: true },
  { name: 'bearish_harami', label: 'Bearish Harami', icon: '📕', description: 'Small red inside prior green — reversal', bullish: false },
  { name: 'morning_star', label: 'Morning Star', icon: '🌅', description: '3-candle bullish reversal pattern', bullish: true },
  { name: 'evening_star', label: 'Evening Star', icon: '🌆', description: '3-candle bearish reversal pattern', bullish: false },
  { name: 'three_white_soldiers', label: '3 White Soldiers', icon: '⚔️', description: '3 consecutive strong green candles — bullish', bullish: true },
  { name: 'three_black_crows', label: '3 Black Crows', icon: '🐦‍⬛', description: '3 consecutive strong red candles — bearish', bullish: false },
  { name: 'marubozu', label: 'Marubozu', icon: '📏', description: 'No wicks — strong momentum candle in either direction', bullish: false },
];

// ============================================================================
// Candle Pattern Detection
// ============================================================================

function detectDoji(candle: StockHistoryPoint): boolean {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  if (range === 0) return false;
  return body / range < 0.1;
}

function detectHammer(candle: StockHistoryPoint): boolean {
  const body = Math.abs(candle.close - candle.open);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const range = candle.high - candle.low;
  if (range === 0 || body === 0) return false;
  return lowerWick > body * 2 && upperWick < body * 0.5;
}

function detectShootingStar(candle: StockHistoryPoint): boolean {
  const body = Math.abs(candle.close - candle.open);
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const range = candle.high - candle.low;
  if (range === 0 || body === 0) return false;
  return upperWick > body * 2 && lowerWick < body * 0.5;
}

function detectBullishEngulfing(prev: StockHistoryPoint, curr: StockHistoryPoint): boolean {
  return prev.close < prev.open && curr.close > curr.open && curr.open < prev.close && curr.close > prev.open;
}

function detectBearishEngulfing(prev: StockHistoryPoint, curr: StockHistoryPoint): boolean {
  return prev.close > prev.open && curr.close < curr.open && curr.open > prev.close && curr.close < prev.open;
}

function detectBullishHarami(prev: StockHistoryPoint, curr: StockHistoryPoint): boolean {
  return prev.close < prev.open && curr.close > curr.open && curr.open > prev.close && curr.close < prev.open;
}

function detectBearishHarami(prev: StockHistoryPoint, curr: StockHistoryPoint): boolean {
  return prev.close > prev.open && curr.close < curr.open && curr.open < prev.close && curr.close > prev.open;
}

function detectMorningStar(d1: StockHistoryPoint, d2: StockHistoryPoint, d3: StockHistoryPoint): boolean {
  const b1 = d1.close < d1.open;
  const b2 = Math.abs(d2.close - d2.open) < (d1.high - d1.low) * 0.3; // small body
  const b3 = d3.close > d3.open && d3.close > (d1.open + d1.close) / 2;
  return b1 && b2 && b3;
}

function detectEveningStar(d1: StockHistoryPoint, d2: StockHistoryPoint, d3: StockHistoryPoint): boolean {
  const b1 = d1.close > d1.open;
  const b2 = Math.abs(d2.close - d2.open) < (d1.high - d1.low) * 0.3;
  const b3 = d3.close < d3.open && d3.close < (d1.open + d1.close) / 2;
  return b1 && b2 && b3;
}

function detectThreeWhiteSoldiers(d1: StockHistoryPoint, d2: StockHistoryPoint, d3: StockHistoryPoint): boolean {
  return (
    d1.close > d1.open && d2.close > d2.open && d3.close > d3.open &&
    d2.close > d1.close && d3.close > d2.close &&
    d2.open > d1.open && d3.open > d2.open
  );
}

function detectThreeBlackCrows(d1: StockHistoryPoint, d2: StockHistoryPoint, d3: StockHistoryPoint): boolean {
  return (
    d1.close < d1.open && d2.close < d2.open && d3.close < d3.open &&
    d2.close < d1.close && d3.close < d2.close &&
    d2.open < d1.open && d3.open < d2.open
  );
}

function detectMarubozu(candle: StockHistoryPoint): boolean {
  const body = Math.abs(candle.close - candle.open);
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const range = candle.high - candle.low;
  if (range === 0) return false;
  return (upperWick + lowerWick) / range < 0.05 && body / range > 0.8;
}

// ============================================================================
// Technical helpers
// ============================================================================

function computeSMA(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((s, v) => s + v, 0) / data.length;
}

function computeRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

// ============================================================================
// Main evaluation functions
// ============================================================================

/**
 * Evaluate a specific condition against historical data.
 * Returns a ConditionEvalResult with pass/fail and detail.
 */
export function evaluateCondition(
  condition: SmartAlertCondition,
  data: StockHistoryPoint[],
): ConditionEvalResult {
  const { kind, params } = condition;
  const current = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const defaultResult: ConditionEvalResult = {
    conditionId: condition.id,
    kind,
    passed: false,
    value: null,
    threshold: params.threshold ?? null,
    detail: 'Insufficient data',
  };

  if (!current) return { ...defaultResult, detail: 'No data available' };

  switch (kind) {
    case 'price_cross_above': {
      const target = params.threshold ?? 0;
      const passed = current.close > target;
      return {
        conditionId: condition.id, kind, passed,
        value: current.close, threshold: target,
        detail: passed
          ? `₹${current.close.toFixed(2)} > ₹${target.toFixed(2)}`
          : `₹${current.close.toFixed(2)} ≤ ₹${target.toFixed(2)}`,
      };
    }

    case 'price_cross_below': {
      const target = params.threshold ?? 0;
      const passed = current.close < target;
      return {
        conditionId: condition.id, kind, passed,
        value: current.close, threshold: target,
        detail: passed
          ? `₹${current.close.toFixed(2)} < ₹${target.toFixed(2)}`
          : `₹${current.close.toFixed(2)} ≥ ₹${target.toFixed(2)}`,
      };
    }

    case 'price_change_pct': {
      if (!prev) return { ...defaultResult, detail: 'Need at least 2 bars' };
      const changePct = ((current.close - prev.close) / prev.close) * 100;
      const target = params.threshold ?? 2;
      const passed = Math.abs(changePct) >= target;
      return {
        conditionId: condition.id, kind, passed,
        value: changePct, threshold: target,
        detail: passed
          ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% moved ≥ ${target}%`
          : `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% moved < ${target}%`,
      };
    }

    case 'volume_spike': {
      if (data.length < 10) return { ...defaultResult, detail: 'Need 10+ bars for volume baseline' };
      const recentVolumes = data.slice(-10, -1).map(d => d.volume);
      const avgVolume = computeSMA(recentVolumes);
      const multiplier = params.multiplier ?? 2;
      const passed = avgVolume > 0 && current.volume > avgVolume * multiplier;
      const ratio = avgVolume > 0 ? current.volume / avgVolume : 0;
      return {
        conditionId: condition.id, kind, passed,
        value: ratio, threshold: multiplier,
        detail: passed
          ? `Volume ${ratio.toFixed(1)}x avg (${multiplier}x threshold)`
          : `Volume ${ratio.toFixed(1)}x avg (need ${multiplier}x)`,
      };
    }

    case 'volume_drop': {
      if (data.length < 10) return { ...defaultResult, detail: 'Need 10+ bars' };
      const recentVolumes = data.slice(-10, -1).map(d => d.volume);
      const avgVolume = computeSMA(recentVolumes);
      const multiplier = params.multiplier ?? 0.5;
      const passed = avgVolume > 0 && current.volume < avgVolume * multiplier;
      const ratio = avgVolume > 0 ? current.volume / avgVolume : 0;
      return {
        conditionId: condition.id, kind, passed,
        value: ratio, threshold: multiplier,
        detail: passed
          ? `Volume ${ratio.toFixed(1)}x avg (below ${multiplier}x)`
          : `Volume ${ratio.toFixed(1)}x avg (not below ${multiplier}x)`,
      };
    }

    case 'rsi_oversold': {
      if (data.length < 15) return { ...defaultResult, detail: 'Need 15+ bars for RSI' };
      const closes = data.map(d => d.close);
      const rsi = computeRSI(closes, 14);
      const passed = rsi < (params.threshold ?? 30);
      return {
        conditionId: condition.id, kind, passed,
        value: rsi, threshold: params.threshold ?? 30,
        detail: passed
          ? `RSI ${rsi.toFixed(1)} is oversold`
          : `RSI ${rsi.toFixed(1)} is not oversold`,
      };
    }

    case 'rsi_overbought': {
      if (data.length < 15) return { ...defaultResult, detail: 'Need 15+ bars for RSI' };
      const closes = data.map(d => d.close);
      const rsi = computeRSI(closes, 14);
      const passed = rsi > (params.threshold ?? 70);
      return {
        conditionId: condition.id, kind, passed,
        value: rsi, threshold: params.threshold ?? 70,
        detail: passed
          ? `RSI ${rsi.toFixed(1)} is overbought`
          : `RSI ${rsi.toFixed(1)} is not overbought`,
      };
    }

    case 'rsi_cross_above': {
      if (data.length < 16) return { ...defaultResult, detail: 'Need 16+ bars for RSI crossover' };
      const closes = data.map(d => d.close);
      const rsiNow = computeRSI(closes, 14);
      const rsiPrev = computeRSI(closes.slice(0, -1), 14);
      const target = params.threshold ?? 50;
      const passed = rsiPrev <= target && rsiNow > target;
      return {
        conditionId: condition.id, kind, passed,
        value: rsiNow, threshold: target,
        detail: passed
          ? `RSI crossed above ${target} (${rsiPrev.toFixed(1)} → ${rsiNow.toFixed(1)})`
          : `RSI ${rsiNow.toFixed(1)} not crossing above ${target}`,
      };
    }

    case 'rsi_cross_below': {
      if (data.length < 16) return { ...defaultResult, detail: 'Need 16+ bars for RSI crossover' };
      const closes = data.map(d => d.close);
      const rsiNow = computeRSI(closes, 14);
      const rsiPrev = computeRSI(closes.slice(0, -1), 14);
      const target = params.threshold ?? 50;
      const passed = rsiPrev >= target && rsiNow < target;
      return {
        conditionId: condition.id, kind, passed,
        value: rsiNow, threshold: target,
        detail: passed
          ? `RSI crossed below ${target} (${rsiPrev.toFixed(1)} → ${rsiNow.toFixed(1)})`
          : `RSI ${rsiNow.toFixed(1)} not crossing below ${target}`,
      };
    }

    case 'candle_pattern': {
      const pattern = params.pattern;
      if (!pattern) return { ...defaultResult, detail: 'No pattern specified' };

      let detected = false;
      switch (pattern) {
        case 'doji': detected = detectDoji(current); break;
        case 'hammer': detected = detectHammer(current); break;
        case 'shooting_star': detected = detectShootingStar(current); break;
        case 'bullish_engulfing': detected = prev ? detectBullishEngulfing(prev, current) : false; break;
        case 'bearish_engulfing': detected = prev ? detectBearishEngulfing(prev, current) : false; break;
        case 'bullish_harami': detected = prev ? detectBullishHarami(prev, current) : false; break;
        case 'bearish_harami': detected = prev ? detectBearishHarami(prev, current) : false; break;
        case 'marubozu': detected = detectMarubozu(current); break;
        case 'morning_star': {
          if (data.length < 3) break;
          detected = detectMorningStar(data[data.length - 3], data[data.length - 2], current);
          break;
        }
        case 'evening_star': {
          if (data.length < 3) break;
          detected = detectEveningStar(data[data.length - 3], data[data.length - 2], current);
          break;
        }
        case 'three_white_soldiers': {
          if (data.length < 3) break;
          detected = detectThreeWhiteSoldiers(data[data.length - 3], data[data.length - 2], current);
          break;
        }
        case 'three_black_crows': {
          if (data.length < 3) break;
          detected = detectThreeBlackCrows(data[data.length - 3], data[data.length - 2], current);
          break;
        }
      }

      const patternInfo = CANDLE_PATTERNS.find(p => p.name === pattern);
      return {
        conditionId: condition.id, kind, passed: detected,
        value: detected ? 1 : 0, threshold: null,
        detail: detected
          ? `${patternInfo?.icon || ''} ${patternInfo?.label || pattern} detected!`
          : `No ${patternInfo?.label || pattern} pattern`,
      };
    }

    case 'consecutive_gain': {
      const daysNeeded = params.threshold ?? 3;
      if (data.length < daysNeeded + 1) return { ...defaultResult, detail: `Need ${daysNeeded + 1}+ bars` };
      let consecutive = 0;
      for (let i = data.length - 1; i > 0; i--) {
        if (data[i].close > data[i - 1].close) consecutive++;
        else break;
      }
      const passed = consecutive >= daysNeeded;
      return {
        conditionId: condition.id, kind, passed,
        value: consecutive, threshold: daysNeeded,
        detail: passed
          ? `${consecutive} consecutive gains (need ${daysNeeded})`
          : `${consecutive} consecutive gains (need ${daysNeeded})`,
      };
    }

    case 'consecutive_loss': {
      const daysNeeded = params.threshold ?? 3;
      if (data.length < daysNeeded + 1) return { ...defaultResult, detail: `Need ${daysNeeded + 1}+ bars` };
      let consecutive = 0;
      for (let i = data.length - 1; i > 0; i--) {
        if (data[i].close < data[i - 1].close) consecutive++;
        else break;
      }
      const passed = consecutive >= daysNeeded;
      return {
        conditionId: condition.id, kind, passed,
        value: consecutive, threshold: daysNeeded,
        detail: passed
          ? `${consecutive} consecutive losses (need ${daysNeeded})`
          : `${consecutive} consecutive losses (need ${daysNeeded})`,
      };
    }

    case 'ma_crossover': {
      const fast = params.fastPeriod ?? 10;
      const slow = params.slowPeriod ?? 30;
      if (data.length < slow + 1) return { ...defaultResult, detail: `Need ${slow + 1}+ bars` };
      const closes = data.map(d => d.close);
      const getSlice = (n: number) => closes.slice(closes.length - n);
      const fastSMA = computeSMA(getSlice(fast));
      const slowSMA = computeSMA(getSlice(slow));
      const prevFast = computeSMA(getSlice(fast).slice(0, -1));
      const prevSlow = computeSMA(getSlice(slow).slice(0, -1));
      const passed = prevFast <= prevSlow && fastSMA > slowSMA;
      return {
        conditionId: condition.id, kind, passed,
        value: fastSMA - slowSMA, threshold: 0,
        detail: passed
          ? `MA${fast} (${fastSMA.toFixed(2)}) crossed above MA${slow} (${slowSMA.toFixed(2)})`
          : `MA${fast} (${fastSMA.toFixed(2)}) not above MA${slow} (${slowSMA.toFixed(2)})`,
      };
    }

    case 'ma_crossunder': {
      const fast = params.fastPeriod ?? 10;
      const slow = params.slowPeriod ?? 30;
      if (data.length < slow + 1) return { ...defaultResult, detail: `Need ${slow + 1}+ bars` };
      const closes = data.map(d => d.close);
      const getSlice = (n: number) => closes.slice(closes.length - n);
      const fastSMA = computeSMA(getSlice(fast));
      const slowSMA = computeSMA(getSlice(slow));
      const prevFast = computeSMA(getSlice(fast).slice(0, -1));
      const prevSlow = computeSMA(getSlice(slow).slice(0, -1));
      const passed = prevFast >= prevSlow && fastSMA < slowSMA;
      return {
        conditionId: condition.id, kind, passed,
        value: fastSMA - slowSMA, threshold: 0,
        detail: passed
          ? `MA${fast} (${fastSMA.toFixed(2)}) crossed below MA${slow} (${slowSMA.toFixed(2)})`
          : `MA${fast} (${fastSMA.toFixed(2)}) not below MA${slow} (${slowSMA.toFixed(2)})`,
      };
    }

    case 'breakout_high': {
      const period = params.period ?? 20;
      if (data.length < period) return { ...defaultResult, detail: `Need ${period}+ bars` };
      const window = data.slice(-period - 1, -1);
      const highestHigh = Math.max(...window.map(d => d.high));
      const passed = current.close > highestHigh;
      return {
        conditionId: condition.id, kind, passed,
        value: current.close, threshold: highestHigh,
        detail: passed
          ? `Breakout above ${period}-bar high of ₹${highestHigh.toFixed(2)}`
          : `Below ${period}-bar high of ₹${highestHigh.toFixed(2)}`,
      };
    }

    case 'breakout_low': {
      const period = params.period ?? 20;
      if (data.length < period) return { ...defaultResult, detail: `Need ${period}+ bars` };
      const window = data.slice(-period - 1, -1);
      const lowestLow = Math.min(...window.map(d => d.low));
      const passed = current.close < lowestLow;
      return {
        conditionId: condition.id, kind, passed,
        value: current.close, threshold: lowestLow,
        detail: passed
          ? `Breakdown below ${period}-bar low of ₹${lowestLow.toFixed(2)}`
          : `Above ${period}-bar low of ₹${lowestLow.toFixed(2)}`,
      };
    }

    case 'gap_up': {
      if (!prev) return { ...defaultResult, detail: 'Need at least 2 bars' };
      const gap = current.open - prev.close;
      const pct = (gap / prev.close) * 100;
      const threshold = params.threshold ?? 1;
      const passed = gap > 0 && pct >= threshold;
      return {
        conditionId: condition.id, kind, passed,
        value: pct, threshold,
        detail: passed
          ? `Gap up of ${pct.toFixed(2)}% (≥ ${threshold}%)`
          : `No gap up (${Math.max(0, pct).toFixed(2)}%)`,
      };
    }

    case 'gap_down': {
      if (!prev) return { ...defaultResult, detail: 'Need at least 2 bars' };
      const gap = prev.close - current.open;
      const pct = (gap / prev.close) * 100;
      const threshold = params.threshold ?? 1;
      const passed = gap > 0 && pct >= threshold;
      return {
        conditionId: condition.id, kind, passed,
        value: pct, threshold,
        detail: passed
          ? `Gap down of ${pct.toFixed(2)}% (≥ ${threshold}%)`
          : `No gap down (${Math.max(0, pct).toFixed(2)}%)`,
      };
    }

    default:
      return { ...defaultResult, detail: `Unknown condition: ${kind}` };
  }
}

/**
 * Evaluate all conditions of an alert against historical data using AND/OR logic.
 */
export function evaluateSmartAlert(
  alert: SmartAlert,
  data: StockHistoryPoint[],
): SmartAlertEvalResult {
  const results = alert.conditions.map(c => evaluateCondition(c, data));

  let passed: boolean;
  if (results.length === 0) {
    passed = false;
  } else if (alert.logic === 'AND') {
    passed = results.every(r => r.passed);
  } else {
    passed = results.some(r => r.passed);
  }

  const currentPrice = data[data.length - 1]?.close ?? 0;

  return {
    alertId: alert.id,
    name: alert.name,
    symbol: alert.symbol,
    passed,
    conditions: results,
    currentPrice,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check whether the cooldown period has elapsed since the last trigger.
 */
export function isCooldownElapsed(alert: SmartAlert): boolean {
  if (!alert.lastTriggeredAt) return true;
  const elapsed = Date.now() - new Date(alert.lastTriggeredAt).getTime();
  return elapsed >= alert.cooldownMinutes * 60 * 1000;
}

/**
 * Generate a human-readable summary from an evaluation result.
 */
export function summarizeEvalResult(result: SmartAlertEvalResult): string {
  const parts: string[] = [];
  for (const cond of result.conditions) {
    if (cond.passed) {
      parts.push(cond.detail);
    }
  }
  if (parts.length === 0) {
    return `No conditions met for ${result.symbol} at ₹${result.currentPrice.toFixed(2)}`;
  }
  return `${result.symbol}: ${parts.join(' | ')}`;
}

/**
 * Generate mock OHLC data for testing / demoing alerts.
 */
export function generateMockHistory(
  days: number = 60,
  basePrice: number = 1500,
  volatility: number = 0.02,
): StockHistoryPoint[] {
  const data: StockHistoryPoint[] = [];
  let price = basePrice;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = price * volatility * (Math.random() - 0.5);
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.abs(change) * Math.random() * 0.5;
    const low = Math.min(open, close) - Math.abs(change) * Math.random() * 0.5;

    data.push({
      date: date.toISOString().split('T')[0],
      open,
      high,
      low,
      close,
      volume: Math.round(1000000 + Math.random() * 5000000),
    });

    price = close;
  }

  return data;
}

// ============================================================================
// Notification type — add to AppNotification in types
// ============================================================================

export const SMART_ALERT_NOTIFICATION_TYPE = 'smart_alert' as const;
