// ============================================================================
// Toroloom — Chart Pattern Detection Engine
// Detects common technical analysis patterns from OHLC candlestick data.
// ============================================================================

import type { StockHistoryPoint } from '../../types';

// ============================================================================
// Types
// ============================================================================

export type PatternType =
  | 'head_and_shoulders'
  | 'inverse_head_and_shoulders'
  | 'double_top'
  | 'double_bottom'
  | 'bull_flag'
  | 'bear_flag'
  | 'ascending_triangle'
  | 'descending_triangle'
  | 'symmetrical_triangle';

export interface DetectedPattern {
  type: PatternType;
  label: string;
  /** Data index where the pattern starts */
  startIndex: number;
  /** Data index where the pattern ends */
  endIndex: number;
  /** Confidence score 0-100 */
  confidence: number;
  /** The direction the pattern predicts */
  direction: 'bullish' | 'bearish' | 'neutral';
  /** Key price levels for rendering the pattern on chart */
  levels: {
    x: number; // data index
    price: number;
    label?: string;
  }[];
  /** For H&S — the neckline price */
  necklinePrice?: number;
  /** Target price projection */
  targetPrice?: number;
  /** Current price relative to pattern completion */
  isComplete?: boolean;
}

// ============================================================================
// Helper — Swing highs/lows detection
// ============================================================================

interface SwingPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
}

function findSwingHighs(highs: number[], lookback = 5): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < highs.length - lookback; i++) {
    let isSwingHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (highs[j] >= highs[i]) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      swings.push({ index: i, price: highs[i], type: 'high' });
    }
  }
  return swings;
}

function findSwingLows(lows: number[], lookback = 5): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < lows.length - lookback; i++) {
    let isSwingLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (lows[j] <= lows[i]) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      swings.push({ index: i, price: lows[i], type: 'low' });
    }
  }
  return swings;
}

// ============================================================================
// Pattern Detection Functions
// ============================================================================

/**
 * Head & Shoulders — Three peaks with middle peak (head) higher than
 * the two shoulders. Neckline connects the two troughs.
 * Break below neckline = bearish.
 */
function detectHeadAndShoulders(
  data: StockHistoryPoint[],
  highs: number[],
  lows: number[],
): DetectedPattern | null {
  if (data.length < 40) return null;

  const swingHighs = findSwingHighs(highs, 4);

  // Need at least 3 swing highs
  if (swingHighs.length < 3) return null;

  // Look for 3 consecutive swing highs where middle is highest
  for (let i = 0; i < swingHighs.length - 2; i++) {
    const leftShoulder = swingHighs[i];
    const head = swingHighs[i + 1];
    const rightShoulder = swingHighs[i + 2];

    // Head must be higher than both shoulders
    if (head.price <= leftShoulder.price || head.price <= rightShoulder.price) continue;

    // Shoulders should be at similar height (within 15%)
    const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price) / Math.max(leftShoulder.price, rightShoulder.price);
    if (shoulderDiff > 0.15) continue;

    // Find neckline — the trough between left shoulder & head, and between head & right shoulder
    let trough1Index = leftShoulder.index;
    let trough1Price = Infinity;
    for (let j = leftShoulder.index; j <= head.index; j++) {
      if (lows[j] < trough1Price) {
        trough1Price = lows[j];
        trough1Index = j;
      }
    }

    let trough2Index = head.index;
    let trough2Price = Infinity;
    for (let j = head.index; j <= rightShoulder.index; j++) {
      if (lows[j] < trough2Price) {
        trough2Price = lows[j];
        trough2Index = j;
      }
    }

    const necklinePrice = (trough1Price + trough2Price) / 2;
    const headToNeckline = head.price - necklinePrice;
    const targetPrice = necklinePrice - headToNeckline;

    // Check if right shoulder volume is lower than left (confirmation)
    const leftVol = data.slice(leftShoulder.index - 2, leftShoulder.index + 3)
      .reduce((s, d) => s + d.volume, 0) / 5;
    const rightVol = data.slice(rightShoulder.index - 2, rightShoulder.index + 3)
      .reduce((s, d) => s + d.volume, 0) / 5;

    const recentClose = data[data.length - 1].close;
    const isComplete = recentClose < necklinePrice;

    // Confidence scoring
    let confidence = 65;
    if (rightVol < leftVol * 0.8) confidence += 15; // volume confirmation
    if (isComplete) confidence += 10;
    if (shoulderDiff < 0.08) confidence += 10;

    const span = rightShoulder.index - leftShoulder.index;
    if (span > 15 && span < 60) confidence += 5; // right time span

    return {
      type: 'head_and_shoulders',
      label: 'H&S',
      startIndex: leftShoulder.index,
      endIndex: rightShoulder.index + 3,
      confidence: Math.min(confidence, 100),
      direction: 'bearish',
      necklinePrice,
      targetPrice,
      isComplete,
      levels: [
        { x: leftShoulder.index, price: leftShoulder.price, label: 'LS' },
        { x: head.index, price: head.price, label: 'H' },
        { x: rightShoulder.index, price: rightShoulder.price, label: 'RS' },
        { x: trough1Index, price: trough1Price },
        { x: trough2Index, price: trough2Price },
      ],
    };
  }

  return null;
}

/**
 * Inverse Head & Shoulders — Three troughs with middle trough lowest.
 * Neckline connects the two peaks. Break above = bullish.
 */
function detectInverseHeadAndShoulders(
  data: StockHistoryPoint[],
  highs: number[],
  lows: number[],
): DetectedPattern | null {
  if (data.length < 40) return null;

  const swingLows = findSwingLows(lows, 4);

  if (swingLows.length < 3) return null;

  for (let i = 0; i < swingLows.length - 2; i++) {
    const leftShoulder = swingLows[i];
    const head = swingLows[i + 1];
    const rightShoulder = swingLows[i + 2];

    if (head.price >= leftShoulder.price || head.price >= rightShoulder.price) continue;

    const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price) / Math.max(leftShoulder.price, rightShoulder.price);
    if (shoulderDiff > 0.15) continue;

    // Find neckline peaks
    let peak1Index = leftShoulder.index;
    let peak1Price = 0;
    for (let j = leftShoulder.index; j <= head.index; j++) {
      if (highs[j] > peak1Price) {
        peak1Price = highs[j];
        peak1Index = j;
      }
    }

    let peak2Index = head.index;
    let peak2Price = 0;
    for (let j = head.index; j <= rightShoulder.index; j++) {
      if (highs[j] > peak2Price) {
        peak2Price = highs[j];
        peak2Index = j;
      }
    }

    const necklinePrice = (peak1Price + peak2Price) / 2;
    const necklineToHead = necklinePrice - head.price;
    const targetPrice = necklinePrice + necklineToHead;

    const recentClose = data[data.length - 1].close;
    const isComplete = recentClose > necklinePrice;

    let confidence = 65;
    if (isComplete) confidence += 15;
    if (shoulderDiff < 0.08) confidence += 10;

    return {
      type: 'inverse_head_and_shoulders',
      label: 'Inv H&S',
      startIndex: leftShoulder.index,
      endIndex: rightShoulder.index + 3,
      confidence: Math.min(confidence, 100),
      direction: 'bullish',
      necklinePrice,
      targetPrice,
      isComplete,
      levels: [
        { x: leftShoulder.index, price: leftShoulder.price, label: 'LS' },
        { x: head.index, price: head.price, label: 'H' },
        { x: rightShoulder.index, price: rightShoulder.price, label: 'RS' },
        { x: peak1Index, price: peak1Price },
        { x: peak2Index, price: peak2Price },
      ],
    };
  }

  return null;
}

/**
 * Double Top — Two peaks at similar price level with a trough in between.
 * Break below trough neckline = bearish.
 */
function detectDoubleTop(
  data: StockHistoryPoint[],
  highs: number[],
  lows: number[],
): DetectedPattern | null {
  if (data.length < 25) return null;

  const swingHighs = findSwingHighs(highs, 3);

  if (swingHighs.length < 2) return null;

  for (let i = 0; i < swingHighs.length - 1; i++) {
    const top1 = swingHighs[i];
    const top2 = swingHighs[i + 1];

    const priceDiff = Math.abs(top1.price - top2.price) / top1.price;
    if (priceDiff > 0.05) continue; // peaks must be within 5%

    // Find trough between tops
    let troughPrice = Infinity;
    let troughIndex = top1.index;
    for (let j = top1.index; j <= top2.index; j++) {
      if (lows[j] < troughPrice) {
        troughPrice = lows[j];
        troughIndex = j;
      }
    }

    const span = top2.index - top1.index;
    if (span < 5 || span > 40) continue;

    const necklinePrice = troughPrice;
    const peakAvg = (top1.price + top2.price) / 2;
    const height = peakAvg - necklinePrice;
    const targetPrice = necklinePrice - height;

    const recentClose = data[data.length - 1].close;
    const isComplete = recentClose < necklinePrice;

    let confidence = 60;
    if (priceDiff < 0.02) confidence += 20; // very similar peaks
    if (isComplete) confidence += 10;
    if (span > 10) confidence += 5;

    return {
      type: 'double_top',
      label: 'Dbl Top',
      startIndex: top1.index - 2,
      endIndex: top2.index + 2,
      confidence: Math.min(confidence, 100),
      direction: 'bearish',
      necklinePrice,
      targetPrice,
      isComplete,
      levels: [
        { x: top1.index, price: top1.price, label: '1' },
        { x: top2.index, price: top2.price, label: '2' },
        { x: troughIndex, price: troughPrice },
      ],
    };
  }

  return null;
}

/**
 * Double Bottom — Two troughs at similar price level with a peak in between.
 * Break above peak neckline = bullish.
 */
function detectDoubleBottom(
  data: StockHistoryPoint[],
  highs: number[],
  lows: number[],
): DetectedPattern | null {
  if (data.length < 25) return null;

  const swingLows = findSwingLows(lows, 3);

  if (swingLows.length < 2) return null;

  for (let i = 0; i < swingLows.length - 1; i++) {
    const bottom1 = swingLows[i];
    const bottom2 = swingLows[i + 1];

    const priceDiff = Math.abs(bottom1.price - bottom2.price) / bottom1.price;
    if (priceDiff > 0.05) continue;

    // Find peak between bottoms
    let peakPrice = 0;
    let peakIndex = bottom1.index;
    for (let j = bottom1.index; j <= bottom2.index; j++) {
      if (highs[j] > peakPrice) {
        peakPrice = highs[j];
        peakIndex = j;
      }
    }

    const span = bottom2.index - bottom1.index;
    if (span < 5 || span > 40) continue;

    const necklinePrice = peakPrice;
    const height = necklinePrice - (bottom1.price + bottom2.price) / 2;
    const targetPrice = necklinePrice + height;

    const recentClose = data[data.length - 1].close;
    const isComplete = recentClose > necklinePrice;

    let confidence = 60;
    if (priceDiff < 0.02) confidence += 20;
    if (isComplete) confidence += 10;
    if (span > 10) confidence += 5;

    return {
      type: 'double_bottom',
      label: 'Dbl Bottom',
      startIndex: bottom1.index - 2,
      endIndex: bottom2.index + 2,
      confidence: Math.min(confidence, 100),
      direction: 'bullish',
      necklinePrice,
      targetPrice,
      isComplete,
      levels: [
        { x: bottom1.index, price: bottom1.price, label: '1' },
        { x: bottom2.index, price: bottom2.price, label: '2' },
        { x: peakIndex, price: peakPrice },
      ],
    };
  }

  return null;
}

/**
 * Bull Flag — Sharp upward move (flagpole) followed by a
 * downward-sloping channel (flag). Break above = continuation.
 */
function detectBullFlag(
  data: StockHistoryPoint[],
  highs: number[],
  lows: number[],
): DetectedPattern | null {
  if (data.length < 20) return null;

  const closes = data.map(d => d.close);
  const lookback = 15;

  for (let endIdx = lookback; endIdx < data.length; endIdx++) {
    const startIdx = endIdx - lookback;

    // Find the flagpole: sharp price increase over ~5 bars
    let poleStart = -1, poleEnd = -1;
    let maxPoleMove = 0;

    for (let i = startIdx; i < endIdx - 5; i++) {
      const move = (highs[i + 4] - lows[i]) / lows[i];
      if (move > 0.04 && move > maxPoleMove) {
        maxPoleMove = move;
        poleStart = i;
        poleEnd = i + 4;
      }
    }

    if (poleStart === -1 || maxPoleMove < 0.04) continue;

    // After the pole, look for downward-sloping consolidation (the flag)
    const flagStart = poleEnd;
    const flagEnd = endIdx;
    const flagLen = flagEnd - flagStart;

    if (flagLen < 3 || flagLen > 12) continue;

    // Check that highs are making lower highs (flag slopes down)
    const flagHighs = highs.slice(flagStart, flagEnd + 1);
    const flagLows = lows.slice(flagStart, flagEnd + 1);

    let isSlopingDown = true;
    for (let i = 1; i < flagHighs.length; i++) {
      if (flagHighs[i] > flagHighs[i - 1] * 1.01) {
        isSlopingDown = false;
        break;
      }
    }

    if (!isSlopingDown) continue;

    // Check flag low is not too deep (should stay above the pole's midpoint)
    const poleMid = (highs[poleEnd] + lows[poleStart]) / 2;
    const flagLow = Math.min(...flagLows);
    if (flagLow < poleMid * 0.95) continue;

    // Volume should decline during flag
    const poleVol = data.slice(poleStart, poleEnd + 1).reduce((s, d) => s + d.volume, 0) / (poleEnd - poleStart + 1);
    const flagVol = data.slice(flagStart, flagEnd + 1).reduce((s, d) => s + d.volume, 0) / (flagLen + 1);
    const volumeDeclining = flagVol < poleVol * 0.85;

    const recentClose = closes[closes.length - 1];
    const isComplete = recentClose > flagHighs[flagHighs.length - 1];

    let confidence = 55;
    if (volumeDeclining) confidence += 15;
    if (isComplete) confidence += 15;
    if (maxPoleMove > 0.06) confidence += 10;

    const targetPrice = highs[poleEnd] + (highs[poleEnd] - lows[poleStart]);

    return {
      type: 'bull_flag',
      label: 'Bull Flag',
      startIndex: poleStart,
      endIndex: flagEnd,
      confidence: Math.min(confidence, 100),
      direction: 'bullish',
      targetPrice,
      isComplete,
      levels: [
        { x: poleStart, price: lows[poleStart], label: 'Pole' },
        { x: poleEnd, price: highs[poleEnd] },
        { x: flagEnd, price: closes[flagEnd] },
      ],
    };
  }

  return null;
}

/**
 * Bear Flag — Sharp downward move (flagpole) followed by an
 * upward-sloping channel (flag). Break below = continuation.
 */
function detectBearFlag(
  data: StockHistoryPoint[],
  highs: number[],
  lows: number[],
): DetectedPattern | null {
  if (data.length < 20) return null;

  const closes = data.map(d => d.close);
  const lookback = 15;

  for (let endIdx = lookback; endIdx < data.length; endIdx++) {
    const startIdx = endIdx - lookback;

    let poleStart = -1, poleEnd = -1;
    let maxPoleMove = 0;

    for (let i = startIdx; i < endIdx - 5; i++) {
      const move = (highs[i] - lows[i + 4]) / highs[i];
      if (move > 0.04 && move > maxPoleMove) {
        maxPoleMove = move;
        poleStart = i;
        poleEnd = i + 4;
      }
    }

    if (poleStart === -1 || maxPoleMove < 0.04) continue;

    const flagStart = poleEnd;
    const flagEnd = endIdx;
    const flagLen = flagEnd - flagStart;

    if (flagLen < 3 || flagLen > 12) continue;

    const flagHighs = highs.slice(flagStart, flagEnd + 1);
    const flagLows = lows.slice(flagStart, flagEnd + 1);

    // Flag should slope upward (higher lows)
    let isSlopingUp = true;
    for (let i = 1; i < flagLows.length; i++) {
      if (flagLows[i] < flagLows[i - 1] * 0.99) {
        isSlopingUp = false;
        break;
      }
    }

    if (!isSlopingUp) continue;

    // Flag should stay below the pole's midpoint
    const poleMid = (highs[poleStart] + lows[poleEnd]) / 2;
    const flagHigh = Math.max(...flagHighs);
    if (flagHigh > poleMid * 1.05) continue;

    const poleVol = data.slice(poleStart, poleEnd + 1).reduce((s, d) => s + d.volume, 0) / (poleEnd - poleStart + 1);
    const flagVol = data.slice(flagStart, flagEnd + 1).reduce((s, d) => s + d.volume, 0) / (flagLen + 1);
    const volumeDeclining = flagVol < poleVol * 0.85;

    const recentClose = closes[closes.length - 1];
    const isComplete = recentClose < flagLows[flagLows.length - 1];

    let confidence = 55;
    if (volumeDeclining) confidence += 15;
    if (isComplete) confidence += 15;
    if (maxPoleMove > 0.06) confidence += 10;

    const targetPrice = lows[poleEnd] - (highs[poleStart] - lows[poleEnd]);

    return {
      type: 'bear_flag',
      label: 'Bear Flag',
      startIndex: poleStart,
      endIndex: flagEnd,
      confidence: Math.min(confidence, 100),
      direction: 'bearish',
      targetPrice,
      isComplete,
      levels: [
        { x: poleStart, price: highs[poleStart], label: 'Pole' },
        { x: poleEnd, price: lows[poleEnd] },
        { x: flagEnd, price: closes[flagEnd] },
      ],
    };
  }

  return null;
}

/**
 * Triangle patterns — Look for converging swing highs/lows
 */
function detectTriangles(
  data: StockHistoryPoint[],
  highs: number[],
  lows: number[],
): DetectedPattern | null {
  if (data.length < 20) return null;

  const swingHighs = findSwingHighs(highs, 3);
  const swingLows = findSwingLows(lows, 3);

  if (swingHighs.length < 4 || swingLows.length < 4) return null;

  // Get the last 4 swing highs and swing lows
  const recentHighs = swingHighs.slice(-4);
  const recentLows = swingLows.slice(-4);

  // Check if highs are descending (lower highs)
  const highsDescending = recentHighs.length >= 3 &&
    recentHighs[recentHighs.length - 1].price < recentHighs[0].price &&
    recentHighs[recentHighs.length - 2].price < recentHighs[0].price;

  // Check if lows are ascending (higher lows)
  const lowsAscending = recentLows.length >= 3 &&
    recentLows[recentLows.length - 1].price > recentLows[0].price &&
    recentLows[recentLows.length - 2].price > recentLows[0].price;

  if (highsDescending && lowsAscending) {
    // Symmetrical triangle
    const startIdx = Math.min(recentHighs[0].index, recentLows[0].index);
    const endIdx = Math.max(recentHighs[recentHighs.length - 1].index, recentLows[recentLows.length - 1].index);
    const recentClose = data[data.length - 1].close;
    const isBreakout = recentClose > recentHighs[recentHighs.length - 1].price || 
                       recentClose < recentLows[recentLows.length - 1].price;

    return {
      type: 'symmetrical_triangle',
      label: 'Sym Triangle',
      startIndex: startIdx,
      endIndex: endIdx,
      confidence: 60,
      direction: 'neutral',
      isComplete: isBreakout,
      levels: [
        ...recentHighs.map(h => ({ x: h.index, price: h.price, label: '' as string })),
        ...recentLows.map(l => ({ x: l.index, price: l.price, label: '' as string })),
      ],
    };
  }

  if (highsDescending && !lowsAscending) {
    // Descending triangle (bearish)
    const startIdx = Math.min(recentHighs[0].index, recentLows[recentLows.length - 1].index);
    const endIdx = recentHighs[recentHighs.length - 1].index;

    // Find support level from lows
    const avgSupport = recentLows.reduce((s, l) => s + l.price, 0) / recentLows.length;
    const supportRange = recentLows.reduce((max, l) => Math.max(max, Math.abs(l.price - avgSupport)), 0) / avgSupport;

    if (supportRange > 0.03) return null; // support not flat enough

    return {
      type: 'descending_triangle',
      label: 'Desc Triangle',
      startIndex: startIdx,
      endIndex: endIdx,
      confidence: 65,
      direction: 'bearish',
      necklinePrice: avgSupport,
      levels: [
        ...recentHighs.map(h => ({ x: h.index, price: h.price, label: '' as string })),
        { x: recentLows[0].index, price: avgSupport, label: 'S' },
      ],
    };
  }

  if (!highsDescending && lowsAscending) {
    // Ascending triangle (bullish)
    const startIdx = Math.min(recentHighs[recentHighs.length - 1].index, recentLows[0].index);
    const endIdx = recentLows[recentLows.length - 1].index;

    // Find resistance level from highs
    const avgResistance = recentHighs.reduce((s, h) => s + h.price, 0) / recentHighs.length;
    const resistanceRange = recentHighs.reduce((max, h) => Math.max(max, Math.abs(h.price - avgResistance)), 0) / avgResistance;

    if (resistanceRange > 0.03) return null;

    return {
      type: 'ascending_triangle',
      label: 'Asc Triangle',
      startIndex: startIdx,
      endIndex: endIdx,
      confidence: 65,
      direction: 'bullish',
      necklinePrice: avgResistance,
      levels: [
        ...recentLows.map(l => ({ x: l.index, price: l.price, label: '' as string })),
        { x: recentHighs[0].index, price: avgResistance, label: 'R' },
      ],
    };
  }

  return null;
}

// ============================================================================
// Main Detection Entry Point
// ============================================================================

export interface PatternDetectionResult {
  patterns: DetectedPattern[];
}

/**
 * Run all pattern detection algorithms on the given candlestick data.
 * Returns detected patterns sorted by confidence (highest first).
 */
export function detectPatterns(data: StockHistoryPoint[]): PatternDetectionResult {
  if (!data || data.length < 20) {
    return { patterns: [] };
  }

  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  const patterns: DetectedPattern[] = [];

  // Run all detectors
  const hs = detectHeadAndShoulders(data, highs, lows);
  if (hs) patterns.push(hs);

  const ihs = detectInverseHeadAndShoulders(data, highs, lows);
  if (ihs) patterns.push(ihs);

  const dt = detectDoubleTop(data, highs, lows);
  if (dt) patterns.push(dt);

  const db = detectDoubleBottom(data, highs, lows);
  if (db) patterns.push(db);

  const bf = detectBullFlag(data, highs, lows);
  if (bf) patterns.push(bf);

  const bef = detectBearFlag(data, highs, lows);
  if (bef) patterns.push(bef);

  const tri = detectTriangles(data, highs, lows);
  if (tri) patterns.push(tri);

  // Sort by confidence descending
  patterns.sort((a, b) => b.confidence - a.confidence);

  // Return top patterns (max 3 to avoid clutter)
  return { patterns: patterns.slice(0, 3) };
}

/**
 * Get a color for a pattern type (for rendering on chart)
 */
export function getPatternColor(type: PatternType): string {
  switch (type) {
    case 'head_and_shoulders': return '#FF5252';
    case 'inverse_head_and_shoulders': return '#00E676';
    case 'double_top': return '#FF5252';
    case 'double_bottom': return '#00E676';
    case 'bull_flag': return '#00E676';
    case 'bear_flag': return '#FF5252';
    case 'ascending_triangle': return '#00E676';
    case 'descending_triangle': return '#FF5252';
    case 'symmetrical_triangle': return '#FFAB40';
  }
}

/**
 * Get a human-readable description for a pattern
 */
export function getPatternDescription(type: PatternType): string {
  switch (type) {
    case 'head_and_shoulders': return 'Bearish reversal — 3 peaks, middle highest. Break below neckline.';
    case 'inverse_head_and_shoulders': return 'Bullish reversal — 3 troughs, middle lowest. Break above neckline.';
    case 'double_top': return 'Bearish reversal — two peaks at similar level. Break below support.';
    case 'double_bottom': return 'Bullish reversal — two troughs at similar level. Break above resistance.';
    case 'bull_flag': return 'Bullish continuation — sharp up move + downward consolidation.';
    case 'bear_flag': return 'Bearish continuation — sharp down move + upward consolidation.';
    case 'ascending_triangle': return 'Bullish continuation — higher lows, flat resistance. Break up expected.';
    case 'descending_triangle': return 'Bearish continuation — lower highs, flat support. Break down expected.';
    case 'symmetrical_triangle': return 'Continuation pattern — converging highs/lows. Direction TBD.';
  }
}
