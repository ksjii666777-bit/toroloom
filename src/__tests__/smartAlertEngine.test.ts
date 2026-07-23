/**
 * ============================================================================
 * Smart Alert Engine — Unit Tests
 * ============================================================================
 *
 * Covers:
 *   - All 18 condition kinds (pass/fail/edge cases)
 *   - evaluateSmartAlert with AND/OR logic
 *   - Candle pattern detection (12 patterns)
 *   - generateMockHistory structure
 *   - summarizeEvalResult
 *   - isCooldownElapsed
 *   - Empty / insufficient data edge cases
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StockHistoryPoint } from '../types';
import {
  evaluateCondition,
  evaluateSmartAlert,
  isCooldownElapsed,
  summarizeEvalResult,
  generateMockHistory,
  CANDLE_PATTERNS,
} from '../services/smartAlertEngine';
import type {
  SmartAlertCondition,
  SmartAlert,
} from '../services/smartAlertEngine';

// ============================================================================
// Helpers
// ============================================================================

function makeCandle(overrides: Partial<StockHistoryPoint> = {}): StockHistoryPoint {
  return {
    date: '2026-07-19',
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 1_000_000,
    ...overrides,
  };
}

function makeCandleWithBody(open: number, close: number, high?: number, low?: number, volume?: number): StockHistoryPoint {
  return {
    date: '2026-07-19',
    open,
    high: high ?? Math.max(open, close) + 5,
    low: low ?? Math.min(open, close) - 5,
    close,
    volume: volume ?? 1_000_000,
  };
}

/**
 * Build a multi-day series where closes follow a specific pattern.
 * Useful for testing consecutive gain/loss, MA crossover, etc.
 */
function buildSeries(closes: number[], volume: number = 1_000_000): StockHistoryPoint[] {
  return closes.map((c, i) => ({
    date: `2026-07-${String(19 - closes.length + i + 1).padStart(2, '0')}`,
    open: c - 1,
    high: c + 2,
    low: c - 2,
    close: c,
    volume,
  }));
}

/** Helper to create a simple SmartAlertCondition */
function cond(
  kind: SmartAlertCondition['kind'],
  params: SmartAlertCondition['params'] = {},
): SmartAlertCondition {
  return { id: `c_test`, kind, params };
}

/** Helper to create a SmartAlert for testing */
function makeAlert(conditions: SmartAlertCondition[], logic: 'AND' | 'OR' = 'AND'): SmartAlert {
  return {
    id: 'test_alert',
    name: 'Test Alert',
    symbol: 'TEST',
    stockName: 'Test Stock',
    conditions,
    logic,
    cooldownMinutes: 30,
    enabled: true,
    triggered: false,
    lastTriggeredAt: null,
    createdAt: new Date().toISOString(),
    notificationType: 'local',
    badge: true,
  };
}

// ============================================================================
// Candlestick Pattern Detection
// ============================================================================

describe('CANDLE_PATTERNS metadata', () => {
  it('should have all 12 patterns defined', () => {
    expect(CANDLE_PATTERNS).toHaveLength(12);
    expect(CANDLE_PATTERNS.map(p => p.name)).toEqual([
      'doji', 'hammer', 'shooting_star',
      'bullish_engulfing', 'bearish_engulfing',
      'bullish_harami', 'bearish_harami',
      'morning_star', 'evening_star',
      'three_white_soldiers', 'three_black_crows',
      'marubozu',
    ]);
  });

  it.each(CANDLE_PATTERNS)('pattern $name should have all required fields', (p) => {
    expect(p.label).toBeTruthy();
    expect(p.icon).toBeTruthy();
    expect(p.description).toBeTruthy();
    expect(typeof p.bullish).toBe('boolean');
  });
});

// ============================================================================
// evaluateCondition — Price Conditions
// ============================================================================

describe('evaluateCondition — price_cross_above', () => {
  it('should pass when close > threshold', () => {
    const result = evaluateCondition(cond('price_cross_above', { threshold: 100 }), [makeCandle({ close: 105 })]);
    expect(result.passed).toBe(true);
    expect(result.value).toBe(105);
    expect(result.threshold).toBe(100);
  });

  it('should fail when close ≤ threshold', () => {
    const result = evaluateCondition(cond('price_cross_above', { threshold: 100 }), [makeCandle({ close: 95 })]);
    expect(result.passed).toBe(false);
  });

  it('should fail when close equals threshold exactly', () => {
    const result = evaluateCondition(cond('price_cross_above', { threshold: 100 }), [makeCandle({ close: 100 })]);
    expect(result.passed).toBe(false);
  });

  it('should use default threshold of 0', () => {
    const result = evaluateCondition(cond('price_cross_above'), [makeCandle({ close: 5 })]);
    expect(result.passed).toBe(true);
  });

  it('should report no data when array is empty', () => {
    const result = evaluateCondition(cond('price_cross_above'), []);
    expect(result.passed).toBe(false);
    expect(result.detail).toBe('No data available');
  });
});

describe('evaluateCondition — price_cross_below', () => {
  it('should pass when close < threshold', () => {
    const result = evaluateCondition(cond('price_cross_below', { threshold: 100 }), [makeCandle({ close: 90 })]);
    expect(result.passed).toBe(true);
  });

  it('should fail when close ≥ threshold', () => {
    const result = evaluateCondition(cond('price_cross_below', { threshold: 100 }), [makeCandle({ close: 110 })]);
    expect(result.passed).toBe(false);
  });

  it('should fail on exact equality', () => {
    const result = evaluateCondition(cond('price_cross_below', { threshold: 100 }), [makeCandle({ close: 100 })]);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — price_change_pct', () => {
  it('should pass when change magnitude ≥ threshold', () => {
    // close went from 100 to 110 = +10%
    const result = evaluateCondition(
      cond('price_change_pct', { threshold: 5 }),
      [makeCandle({ close: 100, open: 100 }), makeCandle({ close: 110 })],
    );
    expect(result.passed).toBe(true);
    expect(result.value).toBeCloseTo(10, 0);
  });

  it('should fail when change magnitude < threshold', () => {
    // close went from 100 to 101 = +1%
    const result = evaluateCondition(
      cond('price_change_pct', { threshold: 5 }),
      [makeCandle({ close: 100 }), makeCandle({ close: 101 })],
    );
    expect(result.passed).toBe(false);
  });

  it('should need at least 2 bars', () => {
    const result = evaluateCondition(cond('price_change_pct'), [makeCandle()]);
    expect(result.passed).toBe(false);
    expect(result.detail).toBe('Need at least 2 bars');
  });

  it('should work with negative changes (big drop)', () => {
    // close went from 100 to 85 = -15%
    const result = evaluateCondition(
      cond('price_change_pct', { threshold: 10 }),
      [makeCandle({ close: 100 }), makeCandle({ close: 85 })],
    );
    expect(result.passed).toBe(true);
    expect(result.value).toBeCloseTo(-15, 0);
  });
});

// ============================================================================
// evaluateCondition — Volume Conditions
// ============================================================================

describe('evaluateCondition — volume_spike', () => {
  const avgVolBase = 1_000_000;

  function makeVolCandle(volume: number): StockHistoryPoint {
    return { date: '2026-07-19', open: 100, high: 102, low: 98, close: 101, volume };
  }

  function buildVolumeHistory(lastVol: number): StockHistoryPoint[] {
    // 9 bars at average volume + 1 bar at lastVol
    const bars: StockHistoryPoint[] = [];
    for (let i = 0; i < 9; i++) {
      bars.push(makeVolCandle(avgVolBase));
    }
    bars.push(makeVolCandle(lastVol));
    return bars;
  }

  it('should pass when volume > 2x average', () => {
    const data = buildVolumeHistory(avgVolBase * 3);
    const result = evaluateCondition(cond('volume_spike', { multiplier: 2 }), data);
    expect(result.passed).toBe(true);
  });

  it('should fail when volume is normal', () => {
    const data = buildVolumeHistory(avgVolBase);
    const result = evaluateCondition(cond('volume_spike', { multiplier: 2 }), data);
    expect(result.passed).toBe(false);
  });

  it('should need 10+ bars', () => {
    const result = evaluateCondition(cond('volume_spike'), [makeVolCandle(500000)]);
    expect(result.passed).toBe(false);
    expect(result.detail).toBe('Need 10+ bars for volume baseline');
  });
});

describe('evaluateCondition — volume_drop', () => {
  const avgVolBase = 1_000_000;

  function buildVolumeHistory(lastVol: number): StockHistoryPoint[] {
    const bars: StockHistoryPoint[] = [];
    for (let i = 0; i < 9; i++) {
      bars.push({ date: '2026-07-19', open: 100, high: 102, low: 98, close: 101, volume: avgVolBase });
    }
    bars.push({ date: '2026-07-19', open: 100, high: 102, low: 98, close: 101, volume: lastVol });
    return bars;
  }

  it('should pass when volume < 0.5x average', () => {
    const data = buildVolumeHistory(avgVolBase * 0.3);
    const result = evaluateCondition(cond('volume_drop', { multiplier: 0.5 }), data);
    expect(result.passed).toBe(true);
  });

  it('should fail when volume is normal', () => {
    const data = buildVolumeHistory(avgVolBase);
    const result = evaluateCondition(cond('volume_drop', { multiplier: 0.5 }), data);
    expect(result.passed).toBe(false);
  });
});

// ============================================================================
// evaluateCondition — RSI Conditions
// ============================================================================

describe('evaluateCondition — rsi_oversold', () => {
  function buildRSIData(closes: number[]): StockHistoryPoint[] {
    return closes.map((c, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      open: c - 1,
      high: c + 2,
      low: c - 2,
      close: c,
      volume: 1_000_000,
    }));
  }

  it('should pass when RSI < 30 (strong downtrend)', () => {
    // 20 bars with sharp decline → RSI should be near 0
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i * 5);
    const data = buildRSIData(closes);
    const result = evaluateCondition(cond('rsi_oversold', { threshold: 30 }), data);
    expect(result.passed).toBe(true);
    expect(result.value).toBeLessThan(30);
  });

  it('should fail when RSI > 30 (uptrend)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 5);
    const data = buildRSIData(closes);
    const result = evaluateCondition(cond('rsi_oversold', { threshold: 30 }), data);
    expect(result.passed).toBe(false);
    expect(result.value).toBeGreaterThanOrEqual(70);
  });

  it('should need 15+ bars', () => {
    const result = evaluateCondition(cond('rsi_oversold'), [makeCandle()]);
    expect(result.passed).toBe(false);
    expect(result.detail).toContain('Need');
  });
});

describe('evaluateCondition — rsi_overbought', () => {
  function buildRSIData(closes: number[]): StockHistoryPoint[] {
    return closes.map((c, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      open: c - 1,
      high: c + 2,
      low: c - 2,
      close: c,
      volume: 1_000_000,
    }));
  }

  it('should pass when RSI > 70 (strong uptrend)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 5);
    const data = buildRSIData(closes);
    const result = evaluateCondition(cond('rsi_overbought', { threshold: 70 }), data);
    expect(result.passed).toBe(true);
    expect(result.value).toBeGreaterThan(70);
  });

  it('should fail when RSI < 70 (downtrend)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i * 5);
    const data = buildRSIData(closes);
    const result = evaluateCondition(cond('rsi_overbought', { threshold: 70 }), data);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — rsi_cross_above', () => {
  it('should pass when RSI crosses above threshold', () => {
    // Steep 20-bar decline (RSI near 0) followed by 2-bar sharp rise at the end.
    // rsiPrev with -5 declines + small gains keeps RSI below 50.
    // rsiNow with the last bar (+50 gain) pushes RSI above 50.
    const downtrend = Array.from({ length: 20 }, (_, i) => 100 - i * 5); // 100, 95, 90, ..., 5
    const closes = [...downtrend, 3, 50, 100]; // big drop then massive spike
    const data = closes.map((c, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      open: c - 1, high: c + 2, low: c - 2, close: c, volume: 1_000_000,
    }));
    const result = evaluateCondition(cond('rsi_cross_above', { threshold: 50 }), data);
    expect(result.passed).toBe(true);
    expect(result.detail).toContain('crossed above');
  });

  it('should need 16+ bars', () => {
    const result = evaluateCondition(cond('rsi_cross_above'), [makeCandle()]);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — rsi_cross_below', () => {
  it('should pass when RSI crosses below threshold', () => {
    const uptrend = Array.from({ length: 15 }, (_, i) => 10 + i * 5);
    const downtrend = Array.from({ length: 5 }, (_, i) => 90 - i * 20);
    const closes = [...uptrend, ...downtrend];
    const data = closes.map((c, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      open: c - 1, high: c + 2, low: c - 2, close: c, volume: 1_000_000,
    }));
    const result = evaluateCondition(cond('rsi_cross_below', { threshold: 50 }), data);
    expect(result.passed).toBe(true);
    expect(result.detail).toContain('crossed below');
  });
});

// ============================================================================
// evaluateCondition — Candlestick Patterns
// ============================================================================

describe('evaluateCondition — candle_pattern (doji)', () => {
  it('should detect doji when close ≈ open', () => {
    const data = [makeCandleWithBody(100, 100.05)];
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'doji' }), data);
    expect(result.passed).toBe(true);
  });

  it('should not detect doji when body is large', () => {
    const data = [makeCandleWithBody(100, 110)];
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'doji' }), data);
    expect(result.passed).toBe(false);
  });

  it('should report no pattern when pattern param is missing', () => {
    const result = evaluateCondition(cond('candle_pattern'), [makeCandle()]);
    expect(result.passed).toBe(false);
    expect(result.detail).toBe('No pattern specified');
  });

  it('should handle zero range (doji edge case)', () => {
    const data = [{ date: '2026-07-19', open: 100, high: 100, low: 100, close: 100, volume: 1000 }];
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'doji' }), data);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — candle_pattern (hammer)', () => {
  it('should detect hammer: long lower wick, small body', () => {
    // open=100, close=101 (body=1), low=90 (lowerWick=10), high=101.4 (upperWick=0.4)
    // lowerWick(10) > body*2(2) ✅, upperWick(0.4) < body*0.5(0.5) ✅
    const data = [{ date: '2026-07-19', open: 100, high: 101.4, low: 90, close: 101, volume: 1000 }];
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'hammer' }), data);
    expect(result.passed).toBe(true);
  });

  it('should not detect hammer when body is too large', () => {
    const data = [{ date: '2026-07-19', open: 100, high: 110, low: 90, close: 109, volume: 1000 }];
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'hammer' }), data);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — candle_pattern (shooting_star)', () => {
  it('should detect shooting star: long upper wick, small body', () => {
    // open=100, close=99 (body=1), high=115 (upperWick=15), low=98.6 (lowerWick=0.4)
    // upperWick(15) > body*2(2) ✅, lowerWick(0.4) < body*0.5(0.5) ✅
    const data = [{ date: '2026-07-19', open: 100, high: 115, low: 98.6, close: 99, volume: 1000 }];
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'shooting_star' }), data);
    expect(result.passed).toBe(true);
  });
});

describe('evaluateCondition — candle_pattern (engulfing)', () => {
  it('should detect bullish engulfing', () => {
    // prev: red candle, curr: green candle that fully engulfs it
    const prev = makeCandleWithBody(110, 100); // red: close=100 < open=110
    const curr = makeCandleWithBody(95, 115);  // green: close=115 > open=95, engulfs prev
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'bullish_engulfing' }), [prev, curr]);
    expect(result.passed).toBe(true);
  });

  it('should detect bearish engulfing', () => {
    const prev = makeCandleWithBody(100, 110); // green: close=110 > open=100
    const curr = makeCandleWithBody(115, 95);  // red: close=95 < open=115, engulfs prev
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'bearish_engulfing' }), [prev, curr]);
    expect(result.passed).toBe(true);
  });

  it('should fail with only 1 bar', () => {
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'bullish_engulfing' }), [makeCandle()]);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — candle_pattern (harami)', () => {
  it('should detect bullish harami', () => {
    const prev = makeCandleWithBody(100, 90);  // red: close=90 < open=100
    const curr = makeCandleWithBody(92, 96);   // green inside prev: open > prev.close, close < prev.open
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'bullish_harami' }), [prev, curr]);
    expect(result.passed).toBe(true);
  });

  it('should detect bearish harami', () => {
    const prev = makeCandleWithBody(100, 110); // green
    const curr = makeCandleWithBody(108, 102); // red inside prev
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'bearish_harami' }), [prev, curr]);
    expect(result.passed).toBe(true);
  });
});

describe('evaluateCondition — candle_pattern (3-candle patterns)', () => {
  it('should detect morning star', () => {
    // d1: red (downtrend), d2: small body, d3: green above midpoint of d1
    const d1 = makeCandleWithBody(110, 90);
    const d2 = makeCandleWithBody(92, 91);
    const d3 = makeCandleWithBody(95, 115);
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'morning_star' }), [d1, d2, d3]);
    expect(result.passed).toBe(true);
  });

  it('should detect evening star', () => {
    const d1 = makeCandleWithBody(90, 110);   // green
    const d2 = makeCandleWithBody(108, 107);  // small body
    const d3 = makeCandleWithBody(105, 85);   // red below midpoint
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'evening_star' }), [d1, d2, d3]);
    expect(result.passed).toBe(true);
  });

  it('should detect three white soldiers', () => {
    const d1 = makeCandleWithBody(100, 108, 110, 98);
    const d2 = makeCandleWithBody(106, 115, 117, 104);
    const d3 = makeCandleWithBody(113, 122, 124, 111);
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'three_white_soldiers' }), [d1, d2, d3]);
    expect(result.passed).toBe(true);
  });

  it('should detect three black crows', () => {
    const d1 = makeCandleWithBody(110, 102, 112, 100);
    const d2 = makeCandleWithBody(104, 95, 106, 93);
    const d3 = makeCandleWithBody(97, 88, 99, 86);
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'three_black_crows' }), [d1, d2, d3]);
    expect(result.passed).toBe(true);
  });

  it('should fail 3-candle patterns with fewer than 3 bars', () => {
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'morning_star' }), [makeCandle(), makeCandle()]);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — candle_pattern (marubozu)', () => {
  it('should detect marubozu: almost no wicks, large body', () => {
    // open=100, close=120 (body=20), high=120.5 (upperWick=0.5), low=99.5 (lowerWick=0.5)
    // range=21, (upperWick+lowerWick)/range = 1/21 ≈ 0.048 < 0.05 ✅
    // body/range = 20/21 ≈ 0.95 > 0.8 ✅
    const data = [{ date: '2026-07-19', open: 100, high: 120.5, low: 99.5, close: 120, volume: 1000 }];
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'marubozu' }), data);
    expect(result.passed).toBe(true);
  });

  it('should not detect marubozu with large wicks', () => {
    const data = [{ date: '2026-07-19', open: 100, high: 130, low: 70, close: 120, volume: 1000 }];
    const result = evaluateCondition(cond('candle_pattern', { pattern: 'marubozu' }), data);
    expect(result.passed).toBe(false);
  });
});

// ============================================================================
// evaluateCondition — Consecutive Gain / Loss
// ============================================================================

describe('evaluateCondition — consecutive_gain', () => {
  it('should detect 3 consecutive gains', () => {
    const data = buildSeries([100, 102, 105, 108]);
    const result = evaluateCondition(cond('consecutive_gain', { threshold: 3 }), data);
    expect(result.passed).toBe(true);
    expect(result.value).toBe(3);
  });

  it('should fail with only 2 consecutive gains when 3 required', () => {
    // Last 2 bars are gains (102→103, 103→105) but need 3
    const data = buildSeries([106, 104, 102, 103, 105]);
    const result = evaluateCondition(cond('consecutive_gain', { threshold: 3 }), data);
    expect(result.passed).toBe(false);
    expect(result.value).toBe(2);
  });

  it('should handle insufficient bars', () => {
    const result = evaluateCondition(cond('consecutive_gain', { threshold: 3 }), [makeCandle()]);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — consecutive_loss', () => {
  it('should detect 3 consecutive losses', () => {
    const data = buildSeries([108, 105, 102, 100]);
    const result = evaluateCondition(cond('consecutive_loss', { threshold: 3 }), data);
    expect(result.passed).toBe(true);
    expect(result.value).toBe(3);
  });

  it('should fail with only 2 consecutive losses', () => {
    const data = buildSeries([108, 105, 102, 104]);
    const result = evaluateCondition(cond('consecutive_loss', { threshold: 3 }), data);
    expect(result.passed).toBe(false);
  });
});

// ============================================================================
// evaluateCondition — Moving Average Crossover
// ============================================================================

describe('evaluateCondition — ma_crossover', () => {
  it('should detect MA crossover: fast crosses above slow', () => {
    // 20 bars flat at close=100, then the last bar spikes to 150.
    // fast(5)-SMA before last bar = 100, slow(10)-SMA before last bar = 100.
    // After last bar: fast(5)-SMA = (100+100+100+100+150)/5 = 110
    //                 slow(10)-SMA = (100*9 + 150)/10 = 105
    // prevFast(100) <= prevSlow(100) ✅ → fastSMA(110) > slowSMA(105) ✅
    const data = buildSeries([...Array(19).fill(100), 150]);
    const result = evaluateCondition(cond('ma_crossover', { fastPeriod: 5, slowPeriod: 10 }), data);
    expect(result.passed).toBe(true);
  });

  it('should fail when fast MA is below slow MA', () => {
    const data = buildSeries(Array.from({ length: 20 }, (_, i) => 100 - i));
    const result = evaluateCondition(cond('ma_crossover', { fastPeriod: 5, slowPeriod: 10 }), data);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — ma_crossunder', () => {
  it('should detect MA crossunder: fast crosses below slow', () => {
    // 20 bars flat at close=100, then the last bar drops to 50.
    // fast(5)-SMA before last bar = 100, slow(10)-SMA before last bar = 100.
    // After last bar: fast(5)-SMA = (100+100+100+100+50)/5 = 90
    //                 slow(10)-SMA = (100*9 + 50)/10 = 95
    // prevFast(100) >= prevSlow(100) ✅ → fastSMA(90) < slowSMA(95) ✅
    const data = buildSeries([...Array(19).fill(100), 50]);
    const result = evaluateCondition(cond('ma_crossunder', { fastPeriod: 5, slowPeriod: 10 }), data);
    expect(result.passed).toBe(true);
  });

  it('should fail with insufficient bars for slow MA', () => {
    const result = evaluateCondition(cond('ma_crossunder', { fastPeriod: 5, slowPeriod: 30 }), buildSeries([100]));
    expect(result.passed).toBe(false);
    expect(result.detail).toContain('Need');
  });
});

// ============================================================================
// evaluateCondition — Breakout / Breakdown
// ============================================================================

describe('evaluateCondition — breakout_high', () => {
  it('should detect breakout above 20-bar high', () => {
    // 20 bars in a range, then a breakout bar
    const range = Array.from({ length: 20 }, () => 100 + Math.random() * 10);
    const breakoutBar = makeCandle({ close: 120, high: 122 });
    const data = [...buildSeries(range), breakoutBar];
    const result = evaluateCondition(cond('breakout_high', { period: 20 }), data);
    expect(result.passed).toBe(true);
  });

  it('should fail when close is within range', () => {
    const data = buildSeries(Array.from({ length: 25 }, () => 100 + Math.random() * 10));
    const result = evaluateCondition(cond('breakout_high', { period: 20 }), data);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — breakout_low', () => {
  it('should detect breakdown below 20-bar low', () => {
    const range = Array.from({ length: 20 }, () => 100 + Math.random() * 10);
    const breakdownBar = makeCandle({ close: 75, low: 73 });
    const data = [...buildSeries(range), breakdownBar];
    const result = evaluateCondition(cond('breakout_low', { period: 20 }), data);
    expect(result.passed).toBe(true);
  });
});

// ============================================================================
// evaluateCondition — Gap Conditions
// ============================================================================

describe('evaluateCondition — gap_up', () => {
  it('should detect gap up above threshold', () => {
    const prev = makeCandle({ close: 100 });
    const curr = makeCandle({ open: 103 }); // 3% gap up
    const result = evaluateCondition(cond('gap_up', { threshold: 1 }), [prev, curr]);
    expect(result.passed).toBe(true);
    expect(result.value).toBeCloseTo(3, 0);
  });

  it('should fail when gap is below threshold', () => {
    const prev = makeCandle({ close: 100 });
    const curr = makeCandle({ open: 100.5 }); // 0.5% gap
    const result = evaluateCondition(cond('gap_up', { threshold: 2 }), [prev, curr]);
    expect(result.passed).toBe(false);
  });

  it('should fail with gap down (negative gap)', () => {
    const prev = makeCandle({ close: 100 });
    const curr = makeCandle({ open: 97 });
    const result = evaluateCondition(cond('gap_up'), [prev, curr]);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateCondition — gap_down', () => {
  it('should detect gap down above threshold', () => {
    const prev = makeCandle({ close: 100 });
    const curr = makeCandle({ open: 96 }); // 4% gap down
    const result = evaluateCondition(cond('gap_down', { threshold: 1 }), [prev, curr]);
    expect(result.passed).toBe(true);
  });

  it('should fail when gap is below threshold', () => {
    const prev = makeCandle({ close: 100 });
    const curr = makeCandle({ open: 99.5 });
    const result = evaluateCondition(cond('gap_down', { threshold: 2 }), [prev, curr]);
    expect(result.passed).toBe(false);
  });

  it('should fail with gap up (not a gap down)', () => {
    const prev = makeCandle({ close: 100 });
    const curr = makeCandle({ open: 102 });
    const result = evaluateCondition(cond('gap_down'), [prev, curr]);
    expect(result.passed).toBe(false);
  });
});

// ============================================================================
// evaluateSmartAlert — AND / OR Logic
// ============================================================================

describe('evaluateSmartAlert — AND logic', () => {
  it('should pass when ALL conditions pass', () => {
    const alert = makeAlert([
      cond('price_cross_above', { threshold: 100 }),
      cond('price_cross_below', { threshold: 200 }),
    ], 'AND');
    const data = [makeCandle({ close: 150 })]; // 150 > 100 AND 150 < 200
    expect(evaluateSmartAlert(alert, data).passed).toBe(true);
  });

  it('should fail when ANY condition fails (AND)', () => {
    const alert = makeAlert([
      cond('price_cross_above', { threshold: 100 }),
      cond('price_cross_below', { threshold: 140 }),
    ], 'AND');
    const data = [makeCandle({ close: 150 })]; // 150 > 100 BUT 150 is NOT < 140
    expect(evaluateSmartAlert(alert, data).passed).toBe(false);
  });

  it('should fail with zero conditions', () => {
    const alert = makeAlert([], 'AND');
    const result = evaluateSmartAlert(alert, [makeCandle()]);
    expect(result.passed).toBe(false);
  });
});

describe('evaluateSmartAlert — OR logic', () => {
  it('should pass when ANY condition passes', () => {
    const alert = makeAlert([
      cond('price_cross_above', { threshold: 100 }),
      cond('price_cross_below', { threshold: 50 }),
    ], 'OR');
    const data = [makeCandle({ close: 150 })]; // 150 > 100 is true
    expect(evaluateSmartAlert(alert, data).passed).toBe(true);
  });

  it('should fail when ALL conditions fail (OR)', () => {
    const alert = makeAlert([
      cond('price_cross_above', { threshold: 200 }),
      cond('price_cross_below', { threshold: 50 }),
    ], 'OR');
    const data = [makeCandle({ close: 150 })]; // 150 not > 200 AND 150 not < 50
    expect(evaluateSmartAlert(alert, data).passed).toBe(false);
  });
});

describe('evaluateSmartAlert — result structure', () => {
  it('should return correct alertId, name, symbol, and currentPrice', () => {
    const alert = makeAlert([cond('price_cross_above', { threshold: 50 })]);
    const data = [makeCandle({ close: 100 })];
    const result = evaluateSmartAlert(alert, data);
    expect(result.alertId).toBe('test_alert');
    expect(result.name).toBe('Test Alert');
    expect(result.symbol).toBe('TEST');
    expect(result.currentPrice).toBe(100);
    expect(result.timestamp).toBeTruthy();
    expect(result.conditions).toHaveLength(1);
  });
});

// ============================================================================
// isCooldownElapsed
// ============================================================================

describe('isCooldownElapsed', () => {
  it('should return true when never triggered', () => {
    const alert = makeAlert([cond('price_cross_above')]);
    expect(isCooldownElapsed(alert)).toBe(true);
  });

  it('should return false when triggered recently (within cooldown)', () => {
    const alert = makeAlert([cond('price_cross_above')]);
    alert.lastTriggeredAt = new Date().toISOString(); // just now
    alert.cooldownMinutes = 30;
    expect(isCooldownElapsed(alert)).toBe(false);
  });

  it('should return true when cooldown has elapsed', () => {
    const alert = makeAlert([cond('price_cross_above')]);
    alert.lastTriggeredAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    alert.cooldownMinutes = 30;
    expect(isCooldownElapsed(alert)).toBe(true);
  });
});

// ============================================================================
// summarizeEvalResult
// ============================================================================

describe('summarizeEvalResult', () => {
  it('should join passed condition details', () => {
    const result = evaluateSmartAlert(
      makeAlert([cond('price_cross_above', { threshold: 50 }), cond('price_cross_below', { threshold: 200 })], 'AND'),
      [makeCandle({ close: 100 })],
    );
    const summary = summarizeEvalResult(result);
    expect(summary).toContain('TEST');
    expect(summary).toContain('>');
    expect(summary).toContain('<');
  });

  it('should return no-conditions-met message when nothing passes', () => {
    const result = evaluateSmartAlert(
      makeAlert([cond('price_cross_above', { threshold: 200 })]),
      [makeCandle({ close: 100 })],
    );
    const summary = summarizeEvalResult(result);
    expect(summary).toContain('No conditions met');
    expect(summary).toContain('TEST');
    expect(summary).toContain('100');
  });
});

// ============================================================================
// generateMockHistory
// ============================================================================

describe('generateMockHistory', () => {
  it('should generate the requested number of bars (skipping weekends)', () => {
    // 60 days with ~weekends → roughly 43 bars
    const data = generateMockHistory(60, 1500, 0.02);
    expect(data.length).toBeGreaterThan(40);
    expect(data.length).toBeLessThanOrEqual(61);
  });

  it('should have valid OHLCV structure for each bar', () => {
    const data = generateMockHistory(10, 100, 0.02);
    for (const bar of data) {
      expect(bar.date).toBeTruthy();
      expect(typeof bar.open).toBe('number');
      expect(typeof bar.high).toBe('number');
      expect(typeof bar.low).toBe('number');
      expect(typeof bar.close).toBe('number');
      expect(typeof bar.volume).toBe('number');
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
      expect(bar.volume).toBeGreaterThan(0);
    }
  });

  it('should use the provided base price', () => {
    const data = generateMockHistory(5, 5000, 0.01);
    // First bar should be close to base price
    expect(data[0].close).toBeGreaterThan(4000);
    expect(data[0].close).toBeLessThan(6000);
  });

  it('should start from today and go backward', () => {
    const data = generateMockHistory(5, 100, 0.01);
    // Dates should be sequential (oldest first)
    const dateObjs = data.map(d => new Date(d.date));
    for (let i = 1; i < dateObjs.length; i++) {
      expect(dateObjs[i].getTime()).toBeGreaterThan(dateObjs[i - 1].getTime());
    }
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases — empty / null data', () => {
  it('should handle empty array for any condition', () => {
    const kinds: SmartAlertCondition['kind'][] = [
      'price_cross_above', 'price_cross_below', 'price_change_pct',
      'volume_spike', 'volume_drop', 'rsi_oversold', 'rsi_overbought',
      'rsi_cross_above', 'rsi_cross_below', 'candle_pattern',
      'consecutive_gain', 'consecutive_loss', 'ma_crossover', 'ma_crossunder',
      'breakout_high', 'breakout_low', 'gap_up', 'gap_down',
    ];
    for (const kind of kinds) {
      const result = evaluateCondition(cond(kind), []);
      expect(result.passed).toBe(false);
      expect(result.detail).toBe('No data available');
    }
  });

  it('should handle null threshold gracefully', () => {
    const result = evaluateCondition(
      { id: 'test', kind: 'price_cross_above', params: {} },
      [makeCandle({ close: -5 })],
    );
    // threshold defaults to 0, close=-5, so -5 > 0 is false
    expect(result.passed).toBe(false);
  });
});

describe('edge cases — single bar', () => {
  it('price_change_pct needs 2 bars', () => {
    const r = evaluateCondition(cond('price_change_pct'), [makeCandle()]);
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('2 bars');
  });

  it('gap_up needs 2 bars', () => {
    const r = evaluateCondition(cond('gap_up'), [makeCandle()]);
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('2 bars');
  });

  it('candle engulfing needs 2 bars', () => {
    const r = evaluateCondition(cond('candle_pattern', { pattern: 'bullish_engulfing' }), [makeCandle()]);
    expect(r.passed).toBe(false);
  });

  it('3-candle patterns need 3 bars', () => {
    const r = evaluateCondition(cond('candle_pattern', { pattern: 'morning_star' }), [makeCandle(), makeCandle()]);
    expect(r.passed).toBe(false);
  });
});
