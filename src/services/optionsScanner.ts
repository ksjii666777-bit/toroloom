/**
 * ============================================================================
 * Toroloom — Options Scanner Service
 * ============================================================================
 *
 * Analyzes live option chain data (PCR, Max Pain, IV, OI concentration) to
 * determine current market conditions and recommend suitable strategies.
 *
 * Usage:
 *   import { scanMarket, type ScannerResult } from '../../services/optionsScanner';
 *   const result = scanMarket(optionChain, symbol);
 *   // result.marketCondition — bullish/bearish/neutral, IV rank, support/resistance
 *   // result.suggestions — [{ strategyName, rationale, confidence }, ...]
 *
 * ============================================================================
 */

import type { OptionChain} from '../types';

// ──── Types ────────────────────────────────────────────────────────────────

export interface MarketCondition {
  symbol: string;
  spotPrice: number;
  maxPain: number;
  pcr: number;
  /** Distance of spot from max pain (%) */
  maxPainDistancePercent: number;
  /** Average IV of near-ATM options */
  avgAtmIv: number;
  /** Whether IV is low, moderate, or high */
  ivState: 'low' | 'moderate' | 'high';
  /** Market direction bias */
  bias: 'bullish' | 'bearish' | 'neutral';
  /** PCR interpretation */
  pcrInterpretation: string;
  /** Max Pain interpretation */
  maxPainInterpretation: string;
  /** Identified support level (max PE OI concentration) */
  supportLevel: number;
  /** Identified resistance level (max CE OI concentration) */
  resistanceLevel: number;
  /** Bullish signal count */
  bullishSignals: number;
  /** Bearish signal count */
  bearishSignals: number;
  /** Total signals considered */
  totalSignals: number;
}

export interface StrategySuggestion {
  /** Display name of the strategy */
  strategyName: string;
  /** Internal ID matching PrebuiltStrategy.id */
  strategyId: string;
  /** Human-readable reason for suggesting this strategy */
  rationale: string;
  /** Confidence score 0–100 */
  confidence: number;
  /** Market direction this strategy profits from */
  direction: 'bullish' | 'bearish' | 'neutral';
  /** Risk category */
  riskCategory: 'low' | 'moderate' | 'high';
  /** Tags for filtering */
  tags: string[];
}

export interface ScannerResult {
  /** Current market conditions derived from the option chain */
  marketCondition: MarketCondition;
  /** Ordered list of strategy suggestions (best first) */
  suggestions: StrategySuggestion[];
  /** Quick one-line summary for display */
  summaryLine: string;
}

// ──── Constants ────────────────────────────────────────────────────────────

/** Standard NIFTY IV range (~15-25% typical) */
const IV_LOW_THRESHOLD = 14;
const IV_HIGH_THRESHOLD = 22;

/** PCR thresholds */
const PCR_BEARISH_THRESHOLD = 1.2;
const PCR_BULLISH_THRESHOLD = 0.7;

/** Max pain distance threshold (%) */
const MAX_PAIN_DISTANCE_SIGNIFICANT = 0.5;

// ──── Scan Logic ───────────────────────────────────────────────────────────

/**
 * Analyze an option chain and return market conditions + strategy suggestions.
 */
export function scanMarket(
  optionChain: OptionChain,
  symbol: string,
): ScannerResult {
  // ── 1. Calculate market conditions ──
  const condition = analyzeMarketCondition(optionChain, symbol);

  // ── 2. Generate strategy suggestions ──
  const suggestions = generateSuggestions(condition, optionChain);

  // ── 3. Build summary ──
  const summaryLine = buildSummaryLine(condition, suggestions);

  return {
    marketCondition: condition,
    suggestions,
    summaryLine,
  };
}

// ──── Market Condition Analysis ────────────────────────────────────────────

function analyzeMarketCondition(
  chain: OptionChain,
  symbol: string,
): MarketCondition {
  const { spotPrice, maxPain, pcr, rows } = chain;

  // ── PCR Analysis ──
  let pcrInterpretation: string;
  let biasFromPCR: 'bullish' | 'bearish' | 'neutral';
  if (pcr >= PCR_BEARISH_THRESHOLD) {
    pcrInterpretation = `Put-Call Ratio ${pcr.toFixed(2)} — Bearish (excessive puts)`;
    biasFromPCR = 'bearish';
  } else if (pcr <= PCR_BULLISH_THRESHOLD) {
    pcrInterpretation = `Put-Call Ratio ${pcr.toFixed(2)} — Bullish (more calls)`;
    biasFromPCR = 'bullish';
  } else {
    pcrInterpretation = `Put-Call Ratio ${pcr.toFixed(2)} — Neutral range`;
    biasFromPCR = 'neutral';
  }

  // ── Max Pain Analysis ──
  const maxPainDist = maxPain > 0
    ? ((spotPrice - maxPain) / maxPain) * 100
    : 0;
  let maxPainInterpretation: string;
  let biasFromMaxPain: 'bullish' | 'bearish' | 'neutral';
  if (Math.abs(maxPainDist) < MAX_PAIN_DISTANCE_SIGNIFICANT) {
    maxPainInterpretation = `Spot near Max Pain (${maxPain.toFixed(0)}) — neutral pin action expected`;
    biasFromMaxPain = 'neutral';
  } else if (maxPainDist > 0) {
    maxPainInterpretation = `Spot above Max Pain by ${maxPainDist.toFixed(1)}% — bullish bias`;
    biasFromMaxPain = 'bullish';
  } else {
    maxPainInterpretation = `Spot below Max Pain by ${Math.abs(maxPainDist).toFixed(1)}% — bearish bias`;
    biasFromMaxPain = 'bearish';
  }

  // ── IV Analysis ──
  const atmIvValues: number[] = [];
  const price = spotPrice;
  for (const row of rows) {
    const dist = Math.abs(row.strike - price);
    if (dist / price < 0.02) {
      // Near-ATM options (within 2% of spot)
      if (row.ce && row.ce.iv > 0) atmIvValues.push(row.ce.iv);
      if (row.pe && row.pe.iv > 0) atmIvValues.push(row.pe.iv);
    }
  }
  const avgAtmIv = atmIvValues.length > 0
    ? atmIvValues.reduce((s, v) => s + v, 0) / atmIvValues.length
    : 15; // fallback

  let ivState: 'low' | 'moderate' | 'high';
  if (avgAtmIv < IV_LOW_THRESHOLD) ivState = 'low';
  else if (avgAtmIv > IV_HIGH_THRESHOLD) ivState = 'high';
  else ivState = 'moderate';

  // ── Support & Resistance (by OI concentration) ──
  let maxCeOi = 0;
  let maxCeStrike = 0;
  let maxPeOi = 0;
  let maxPeStrike = 0;

  for (const row of rows) {
    if (row.ce && row.ce.openInterest > maxCeOi) {
      maxCeOi = row.ce.openInterest;
      maxCeStrike = row.strike;
    }
    if (row.pe && row.pe.openInterest > maxPeOi) {
      maxPeOi = row.pe.openInterest;
      maxPeStrike = row.strike;
    }
  }

  // ── Aggregate Bias ──
  let bullishSignals = 0;
  let bearishSignals = 0;

  // Signal 1: PCR
  if (biasFromPCR === 'bullish') bullishSignals++;
  else if (biasFromPCR === 'bearish') bearishSignals++;

  // Signal 2: Max Pain
  if (biasFromMaxPain === 'bullish') bullishSignals++;
  else if (biasFromMaxPain === 'bearish') bearishSignals++;

  // Signal 3: Spot vs OI-based support/resistance
  // max PE OI = support (put wall), max CE OI = resistance (call wall)
  if (maxPeStrike > 0 && spotPrice > maxPeStrike) bullishSignals++;   // Above put support = bullish
  if (maxCeStrike > 0 && spotPrice < maxCeStrike) bullishSignals++;   // Below call resistance = bullish
  if (maxCeStrike > 0 && spotPrice > maxCeStrike) bearishSignals++;   // Above call resistance = bearish
  if (maxPeStrike > 0 && spotPrice < maxPeStrike) bearishSignals++;   // Below put support = bearish

  // Signal 4: Total OI comparison (CE vs PE)
  if (chain.totalCEOi > chain.totalPEOi * 1.3) bearishSignals++;
  else if (chain.totalPEOi > chain.totalCEOi * 1.3) bullishSignals++;

  const bias: 'bullish' | 'bearish' | 'neutral' =
    bullishSignals > bearishSignals + 1 ? 'bullish'
    : bearishSignals > bullishSignals + 1 ? 'bearish'
    : 'neutral';

  return {
    symbol,
    spotPrice,
    maxPain,
    pcr,
    maxPainDistancePercent: Math.round(maxPainDist * 10) / 10,
    avgAtmIv: Math.round(avgAtmIv * 10) / 10,
    ivState,
    bias,
    pcrInterpretation,
    maxPainInterpretation,
    supportLevel: maxPeStrike,
    resistanceLevel: maxCeStrike,
    bullishSignals,
    bearishSignals,
    totalSignals: 7,
  };
}

// ──── Strategy Suggestions ─────────────────────────────────────────────────

function generateSuggestions(
  condition: MarketCondition,
  _chain: OptionChain,
): StrategySuggestion[] {
  const suggestions: StrategySuggestion[] = [];
  const { bias, ivState } = condition;

  // ── Determine which strategies apply ──

  // Bullish strategies
  if (bias === 'bullish') {
    if (ivState === 'low' || ivState === 'moderate') {
      // Low IV = cheaper to buy → debit spreads
      suggestions.push({
        strategyName: 'Bull Call Spread',
        strategyId: 'bull_call_spread',
        rationale: `Bullish bias with ${
          ivState === 'low' ? 'low' : 'moderate'
        } IV — buy a call spread to capture upside with defined risk`,
        confidence: 85,
        direction: 'bullish',
        riskCategory: 'low',
        tags: ['bullish', 'debit', 'defined-risk'],
      });
    }
    if (ivState === 'high') {
      // High IV = expensive options → sell premium (credit spread)
      suggestions.push({
        strategyName: 'Bull Put Spread',
        strategyId: 'bull_put_spread',
        rationale: `Bullish bias + high IV (${condition.avgAtmIv.toFixed(0)}%) — sell put spread to collect elevated premium`,
        confidence: 80,
        direction: 'bullish',
        riskCategory: 'low',
        tags: ['bullish', 'credit', 'income'],
      });
    }
  }

  // Bearish strategies
  if (bias === 'bearish') {
    if (ivState === 'low' || ivState === 'moderate') {
      suggestions.push({
        strategyName: 'Bear Put Spread',
        strategyId: 'bear_put_spread',
        rationale: `Bearish bias with ${
          ivState === 'low' ? 'low' : 'moderate'
        } IV — buy a put spread for defined-risk downside`,
        confidence: 85,
        direction: 'bearish',
        riskCategory: 'low',
        tags: ['bearish', 'debit', 'defined-risk'],
      });
    }
    if (ivState === 'high') {
      suggestions.push({
        strategyName: 'Bear Call Spread',
        strategyId: 'bear_call_spread',
        rationale: `Bearish bias + high IV (${condition.avgAtmIv.toFixed(0)}%) — sell call spread to collect premium with bearish outlook`,
        confidence: 80,
        direction: 'bearish',
        riskCategory: 'low',
        tags: ['bearish', 'credit', 'income'],
      });
    }
  }

  // Neutral strategies (always applicable but especially in neutral bias + any IV)
  if (bias === 'neutral') {
    if (ivState === 'high') {
      suggestions.push({
        strategyName: 'Iron Condor',
        strategyId: 'iron_condor',
        rationale: `Neutral outlook + high IV (${condition.avgAtmIv.toFixed(0)}%) — sell Iron Condor to collect premium in a range-bound market`,
        confidence: 90,
        direction: 'neutral',
        riskCategory: 'low',
        tags: ['neutral', 'credit', 'income', 'range-bound'],
      });
      suggestions.push({
        strategyName: 'Short Straddle',
        strategyId: 'short_straddle',
        rationale: `Neutral + elevated IV — sell straddle to profit from volatility crush. High risk — monitor closely`,
        confidence: 65,
        direction: 'neutral',
        riskCategory: 'high',
        tags: ['neutral', 'income', 'high-risk'],
      });
    }
    if (ivState === 'low') {
      suggestions.push({
        strategyName: 'Long Straddle',
        strategyId: 'long_straddle',
        rationale: `Neutral bias but low IV (${condition.avgAtmIv.toFixed(0)}%) — buy straddle ahead of expected volatility expansion`,
        confidence: 70,
        direction: 'neutral',
        riskCategory: 'moderate',
        tags: ['neutral', 'volatility', 'debit'],
      });
    }
  }

  // Directional strategies for clear bias (regardless of IV)
  if (bias === 'bullish') {
    suggestions.push({
      strategyName: 'Long Call',
      strategyId: 'long_call',
      rationale: `Clear bullish bias with ${bullishBearishText(condition)} — buy ATM call for unlimited upside potential`,
      confidence: 60,
      direction: 'bullish',
      riskCategory: 'moderate',
      tags: ['bullish', 'directional', 'unlimited-profit'],
    });
  }

  if (bias === 'bearish') {
    suggestions.push({
      strategyName: 'Long Put',
      strategyId: 'long_put',
      rationale: `Clear bearish bias with ${bullishBearishText(condition)} — buy ATM put for downside protection`,
      confidence: 60,
      direction: 'bearish',
      riskCategory: 'moderate',
      tags: ['bearish', 'directional', 'hedge'],
    });
  }

  // Collar (always applicable when holding the underlying)
  if (bias === 'bullish') {
    suggestions.push({
      strategyName: 'Collar',
      strategyId: 'collar',
      rationale: 'Bullish with hedging — buy stock + protective put + sell OTM call to finance the put',
      confidence: 50,
      direction: 'bullish',
      riskCategory: 'low',
      tags: ['bullish', 'hedged', 'stock'],
    });
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
}

function bullishBearishText(condition: MarketCondition): string {
  return `${condition.ivState} IV (${condition.avgAtmIv.toFixed(0)}%)`;
}

// ──── Summary Line ─────────────────────────────────────────────────────────

function buildSummaryLine(
  condition: MarketCondition,
  suggestions: StrategySuggestion[],
): string {
  const biasEmoji = condition.bias === 'bullish' ? '📈'
    : condition.bias === 'bearish' ? '📉' : '↔️';
  const ivEmoji = condition.ivState === 'high' ? '🔥'
    : condition.ivState === 'low' ? '❄️' : '📊';

  const topSuggestion = suggestions.length > 0
    ? ` · Best: ${suggestions[0].strategyName} (${suggestions[0].confidence}% confidence)`
    : '';

  return `${biasEmoji} ${condition.bias.toUpperCase()} · PCR ${condition.pcr.toFixed(2)} · IV ${condition.avgAtmIv.toFixed(0)}% ${ivEmoji} · Max Pain ${condition.maxPain.toFixed(0)}${topSuggestion}`;
}

/**
 * Determine how far the spot price should move to hit max pain.
 * Useful for short-term directional bias.
 */
export function distanceToMaxPain(spotPrice: number, maxPain: number): { distance: number; percent: number; direction: 'up' | 'down' | 'at' } {
  if (maxPain <= 0) return { distance: 0, percent: 0, direction: 'at' };
  const dist = spotPrice - maxPain;
  return {
    distance: Math.abs(dist),
    percent: Math.round((Math.abs(dist) / maxPain) * 10000) / 100,
    direction: dist > 0 ? 'down' : dist < 0 ? 'up' : 'at',
  };
}
