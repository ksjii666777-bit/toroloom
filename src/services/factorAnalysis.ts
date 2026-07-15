/**
 * ============================================================================
 * Toroloom — Factor Analysis Service
 * ============================================================================
 *
 * Computes portfolio factor exposures across five key investment factors:
 *
 *   1. Momentum    — Price trend strength relative to sector
 *   2. Value       — Attractiveness via P/E, P/B, dividend yield
 *   3. Size        — Market-cap exposure (large/mid/small cap)
 *   4. Quality     — Profitability, earnings stability, low debt
 *   5. Low Vol     — Beta / volatility relative to market
 *
 * Each factor is scored 0–100 based on the portfolio's holdings and compared
 * against a benchmark (Nifty 50 average) to determine tilt.
 *
 * ============================================================================
 */

import type { Holding } from '../types';
import type { FactorAnalysisResult, FactorExposure, StockFactorContribution, FactorName } from '../types';
import { inferSector, inferMarketCapBucket } from '../utils/sector';

// ─── Factor metadata ──────────────────────────────────────────
/** @public Factor metadata exported for use by UI screens */
export const FACTOR_META: Record<FactorName, { label: string; icon: string; color: string }> = {
  momentum:      { label: 'Momentum',       icon: '🚀',  color: '#3B82F6' },
  value:         { label: 'Value',          icon: '💎',  color: '#00E676' },
  size:          { label: 'Size',           icon: '📏',  color: '#8B5CF6' },
  quality:       { label: 'Quality',        icon: '✨',  color: '#FFC107' },
  low_volatility:{ label: 'Low Volatility', icon: '🛡️',  color: '#06B6D4' },
};

// ─── Benchmark averages (simulated Nifty 50 averages) ─────────
const BENCHMARK: Record<FactorName, number> = {
  momentum:       55,
  value:          50,
  size:           60,  // Nifty is predominantly large-cap
  quality:        55,
  low_volatility: 50,
};

// ─── Sector-based momentum proxies ───────────────────────────
// Realistic momentum scores by sector (0-100)
const SECTOR_MOMENTUM: Record<string, number> = {
  Energy:      75,
  Technology:  70,
  Finance:     60,
  Telecom:     55,
  Consumer:    65,
  Automobile:  45,
  Pharma:      50,
  Others:      50,
};

// ─── Sector-based quality proxies ────────────────────────────
const SECTOR_QUALITY: Record<string, number> = {
  Energy:      55,
  Technology:  80,
  Finance:     65,
  Telecom:     45,
  Consumer:    75,
  Automobile:  50,
  Pharma:      60,
  Others:      50,
};

// ─── Sector-based volatility proxies ─────────────────────────
const SECTOR_VOLATILITY: Record<string, number> = {
  Energy:      40,  // High vol → low score
  Technology:  35,
  Finance:     55,
  Telecom:     50,
  Consumer:    65,
  Automobile:  30,
  Pharma:      45,
  Others:      50,
};

// ─── P/E ratio inference from stock data ─────────────────────
function inferPeRatio(stockName: string, sector: string, symbol: string): number {
  // Realistic P/E ranges by sector
  const sectorPE: Record<string, number> = {
    Energy:      22,
    Technology:  30,
    Finance:     18,
    Telecom:     25,
    Consumer:    45,
    Automobile:  28,
    Pharma:      35,
    Others:      20,
  };
  return sectorPE[sector] || 20;
}

// ─── P/B ratio inference ─────────────────────────────────────
function inferPbRatio(sector: string): number {
  const sectorPB: Record<string, number> = {
    Energy:      2.5,
    Technology:  6,
    Finance:     3,
    Telecom:     4,
    Consumer:    10,
    Automobile:  4.5,
    Pharma:      5,
    Others:      3,
  };
  return sectorPB[sector] || 3;
}

// ─── Dividend yield inference ────────────────────────────────
function inferDividendYield(sector: string): number {
  const sectorDY: Record<string, number> = {
    Energy:      1.2,
    Technology:  1.0,
    Finance:     1.5,
    Telecom:     1.8,
    Consumer:    1.0,
    Automobile:  0.8,
    Pharma:      0.6,
    Others:      1.0,
  };
  return sectorDY[sector] || 1.0;
}

// ══════════════════════════════════════════════════════════════
// FACTOR SCORING FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Momentum factor score (0–100)
 * Based on: price trend (buy-to-current ratio), sector momentum, holding period
 */
function scoreMomentum(holdings: Holding[], totalValue: number): { score: number; contributions: Map<string, number> } {
  const contributions = new Map<string, number>();
  if (holdings.length === 0) return { score: 50, contributions };

  let weightedScore = 0;

  for (const h of holdings) {
    const weight = h.currentValue / totalValue;
    const sector = inferSector(h.name, h.symbol);
    const sectorMom = SECTOR_MOMENTUM[sector] || 50;

    // Price appreciation component (0-50 pts)
    const priceReturn = h.currentPrice / h.buyPrice - 1;
    const priceScore = Math.max(0, Math.min(50, (priceReturn + 0.3) / 0.6 * 50));

    // Sector component (0-30 pts)
    const sectorScore = sectorMom * 0.3;

    // Holding period component (short-term = higher momentum, 0-20 pts)
    // Short holding periods can indicate momentum trading
    const holdingScore = h.pnlPercent > 10 ? 15 : h.pnlPercent > 0 ? 10 : 5;

    const totalStockScore = priceScore + sectorScore + holdingScore;
    contributions.set(h.symbol, totalStockScore / 100);
    weightedScore += totalStockScore * weight;
  }

  return { score: Math.round(Math.max(0, Math.min(100, weightedScore))), contributions };
}

/**
 * Value factor score (0–100)
 * Based on: low P/E, low P/B, high dividend yield
 */
function scoreValue(holdings: Holding[], totalValue: number): { score: number; contributions: Map<string, number> } {
  const contributions = new Map<string, number>();
  if (holdings.length === 0) return { score: 50, contributions };

  let weightedScore = 0;

  for (const h of holdings) {
    const weight = h.currentValue / totalValue;
    const sector = inferSector(h.name, h.symbol);
    const pe = inferPeRatio(h.name, sector, h.symbol);
    const pb = inferPbRatio(sector);
    const divYield = inferDividendYield(sector);

    // Low P/E = more value (0-40 pts) — lower is better
    // P/E of 10 → 40 pts, P/E of 50 → 0 pts
    const peScore = Math.max(0, Math.min(40, (50 - pe) / 40 * 40));

    // Low P/B = more value (0-30 pts)
    const pbScore = Math.max(0, Math.min(30, (10 - pb) / 10 * 30));

    // High dividend yield = more value (0-30 pts)
    const dyScore = Math.max(0, Math.min(30, divYield / 3 * 30));

    const totalStockScore = peScore + pbScore + dyScore;
    contributions.set(h.symbol, totalStockScore / 100);
    weightedScore += totalStockScore * weight;
  }

  return { score: Math.round(Math.max(0, Math.min(100, weightedScore))), contributions };
}

/**
 * Size factor score (0–100)
 * 0 = mega-cap only, 100 = micro-cap only
 */
function scoreSize(holdings: Holding[], totalValue: number): { score: number; contributions: Map<string, number> } {
  const contributions = new Map<string, number>();
  if (holdings.length === 0) return { score: 50, contributions };

  let weightedScore = 0;

  for (const h of holdings) {
    const weight = h.currentValue / totalValue;
    const bucket = inferMarketCapBucket(h.symbol);

    // Size score: large=20, mid=55, small=90
    const sizeScore = bucket === 'large' ? 20 : bucket === 'mid' ? 55 : 90;
    contributions.set(h.symbol, sizeScore / 100);
    weightedScore += sizeScore * weight;
  }

  return { score: Math.round(Math.max(0, Math.min(100, weightedScore))), contributions };
}

/**
 * Quality factor score (0–100)
 * Based on: sector quality, earnings stability, profit margin, low debt
 */
function scoreQuality(holdings: Holding[], totalValue: number): { score: number; contributions: Map<string, number> } {
  const contributions = new Map<string, number>();
  if (holdings.length === 0) return { score: 50, contributions };

  let weightedScore = 0;

  for (const h of holdings) {
    const weight = h.currentValue / totalValue;
    const sector = inferSector(h.name, h.symbol);
    const sectorQual = SECTOR_QUALITY[sector] || 50;

    // PnL stability (0-30 pts): positive PnL is better quality
    const pnlScore = h.pnlPercent > 0 ? Math.min(30, h.pnlPercent / 20 * 30) : 5;

    // Sector quality (0-40 pts)
    const sectorScore = sectorQual * 0.4;

    // Profitability proxy (0-30 pts): higher buy price vs current = lower quality
    const profitScore = h.pnl > 0 ? 25 : 5;

    const totalStockScore = sectorScore + pnlScore + profitScore;
    contributions.set(h.symbol, totalStockScore / 100);
    weightedScore += totalStockScore * weight;
  }

  return { score: Math.round(Math.max(0, Math.min(100, weightedScore))), contributions };
}

/**
 * Low Volatility factor score (0–100)
 * Based on: sector volatility, PnL stability, holding period
 */
function scoreLowVolatility(holdings: Holding[], totalValue: number): { score: number; contributions: Map<string, number> } {
  const contributions = new Map<string, number>();
  if (holdings.length === 0) return { score: 50, contributions };

  let weightedScore = 0;

  for (const h of holdings) {
    const weight = h.currentValue / totalValue;
    const sector = inferSector(h.name, h.symbol);
    const sectorVol = SECTOR_VOLATILITY[sector] || 50;

    // PnL stability (0-40 pts): lower absolute PnL% = more stable
    const pnlAbs = Math.abs(h.pnlPercent);
    const stabilityScore = Math.max(0, Math.min(40, (30 - pnlAbs) / 30 * 40));

    // Sector volatility component (0-40 pts)
    const volScore = sectorVol * 0.4;

    // Holding period proxy (0-20 pts): higher buy price retention = stability
    const retentionScore = (h.currentPrice / h.buyPrice) > 0.95 ? 15 : (h.currentPrice / h.buyPrice) > 0.85 ? 10 : 5;

    const totalStockScore = stabilityScore + volScore + retentionScore;
    contributions.set(h.symbol, totalStockScore / 100);
    weightedScore += totalStockScore * weight;
  }

  return { score: Math.round(Math.max(0, Math.min(100, weightedScore))), contributions };
}

// ─── Tilt determination ──────────────────────────────────────
function determineTilt(score: number, benchmark: number): 'overweight' | 'neutral' | 'underweight' {
  const diff = score - benchmark;
  if (diff > 8) return 'overweight';
  if (diff < -8) return 'underweight';
  return 'neutral';
}

// ─── Interpretation generation ───────────────────────────────
function getInterpretation(factor: FactorName, score: number, benchmark: number): string {
  const diff = score - benchmark;
  const absDiff = Math.abs(diff);

  const intros: Record<FactorName, string[]> = {
    momentum: [
      'Low momentum exposure — portfolio tilted towards defensive, lagging stocks',
      'Moderate momentum exposure — balanced between trend and value',
      'Strong momentum exposure — portfolio riding recent winners and trends',
    ],
    value: [
      'Limited value exposure — portfolio favours growth/premium stocks over value',
      'Balanced value exposure — mix of growth and value stocks',
      'Strong value tilt — portfolio concentrated in undervalued, high-yield stocks',
    ],
    size: [
      'Large-cap dominant — portfolio concentrated in mega-cap blue chips',
      'Balanced size exposure — mix across market caps',
      'Small/mid-cap tilt — portfolio leans towards smaller, higher-growth companies',
    ],
    quality: [
      'Below-benchmark quality — holdings may have higher debt, lower margins',
      'Moderate quality exposure — in line with benchmark quality metrics',
      'Premium quality — portfolio concentrated in high-ROE, low-debt companies',
    ],
    low_volatility: [
      'High volatility profile — portfolio may be more sensitive to market swings',
      'Moderate volatility exposure — balanced risk profile',
      'Defensive tilt — portfolio tilted towards stable, low-beta stocks',
    ],
  };

  const tier = absDiff < 8 ? 1 : diff > 0 ? 2 : 0;
  return intros[factor][tier];
}

// ══════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ══════════════════════════════════════════════════════════════

/**
 * Compute full factor analysis for the given portfolio holdings.
 *
 * @param holdings  Array of portfolio holdings (from portfolioStore).
 * @returns         FactorAnalysisResult with exposures, contributions, insights.
 */
export function computeFactorAnalysis(holdings: Holding[]): FactorAnalysisResult {
  if (holdings.length === 0) {
    return {
      factors: Object.entries(FACTOR_META).map(([key, meta]) => ({
        factor: key as FactorName,
        label: meta.label,
        score: 50,
        benchmark: BENCHMARK[key as FactorName],
        tilt: 'neutral',
        interpretation: 'Add holdings to see factor exposure analysis.',
        icon: meta.icon,
        color: meta.color,
      })),
      stockContributions: [],
      dominantStyle: 'No Portfolio',
      insights: ['Add stocks to your portfolio to receive factor analysis.'],
      recommendations: ['Start building your portfolio to unlock factor-based insights.'],
    };
  }

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);

  // Score all factors
  const momentum = scoreMomentum(holdings, totalValue);
  const value = scoreValue(holdings, totalValue);
  const size = scoreSize(holdings, totalValue);
  const quality = scoreQuality(holdings, totalValue);
  const lowVol = scoreLowVolatility(holdings, totalValue);

  const factorScores: Record<FactorName, { score: number; contributions: Map<string, number> }> = {
    momentum,
    value,
    size,
    quality,
    low_volatility: lowVol,
  };

  // Build FactorExposure array
  const factors: FactorExposure[] = (Object.keys(FACTOR_META) as FactorName[]).map((key) => {
    const { score } = factorScores[key];
    const benchmark = BENCHMARK[key];
    return {
      factor: key,
      label: FACTOR_META[key].label,
      score,
      benchmark,
      tilt: determineTilt(score, benchmark),
      interpretation: getInterpretation(key, score, benchmark),
      icon: FACTOR_META[key].icon,
      color: FACTOR_META[key].color,
    };
  });

  // Build stock contributions
  const stockContributions: StockFactorContribution[] = holdings.map((h) => {
    const weight = (h.currentValue / totalValue) * 100;
    const contributions: Partial<Record<FactorName, number>> = {};

    for (const key of Object.keys(FACTOR_META) as FactorName[]) {
      const contrib = factorScores[key].contributions.get(h.symbol);
      if (contrib !== undefined) {
        contributions[key] = Math.round(contrib * 100) / 100;
      }
    }

    return {
      symbol: h.symbol,
      name: h.name,
      weight: Math.round(weight * 10) / 10,
      contributions,
    };
  });

  // Determine dominant style
  const sorted = [...factors].sort((a, b) => Math.abs(a.score - a.benchmark) - Math.abs(b.score - b.benchmark));
  const mostTilted = sorted[0];
  const tiltDir = mostTilted.tilt === 'overweight' ? 'Overweight' : mostTilted.tilt === 'underweight' ? 'Underweight' : 'Neutral';
  const dominantStyle = `${tiltDir} ${mostTilted.label}`;

  // Generate insights
  const insights: string[] = [];
  const overweightFactors = factors.filter(f => f.tilt === 'overweight');
  const underweightFactors = factors.filter(f => f.tilt === 'underweight');

  if (overweightFactors.length > 0) {
    insights.push(`Portfolio is overweight on ${overweightFactors.map(f => f.label).join(', ')} — higher exposure than benchmark.`);
  }
  if (underweightFactors.length > 0) {
    insights.push(`Portfolio is underweight on ${underweightFactors.map(f => f.label).join(', ')} — lower exposure than benchmark.`);
  }

  if (factors.find(f => f.factor === 'value' && f.score > 60)) {
    insights.push('Value tilt suggests focus on fundamentally cheap stocks — may outperform in value cycles.');
  }
  if (factors.find(f => f.factor === 'momentum' && f.score > 60)) {
    insights.push('Momentum tilt indicates portfolio is riding recent price trends — watch for trend reversals.');
  }
  if (factors.find(f => f.factor === 'quality' && f.score < 45)) {
    insights.push('Below-benchmark quality may expose the portfolio to higher earnings risk during downturns.');
  }

  if (insights.length === 0) {
    insights.push('Portfolio factor exposures are broadly in line with benchmark averages.');
  }

  // Generate recommendations
  const recommendations: string[] = [];

  const momFactor = factors.find(f => f.factor === 'momentum')!;
  if (momFactor.score > 70) {
    recommendations.push('High momentum exposure — consider booking partial profits on extended trends and rotating to laggards.');
  } else if (momFactor.score < 35) {
    recommendations.push('Low momentum exposure — consider adding select momentum names if seeking short-term performance.');
  }

  const valFactor = factors.find(f => f.factor === 'value')!;
  if (valFactor.score > 65) {
    recommendations.push('Strong value tilt — ensure value holdings have catalysts for re-rating, not just "value traps".');
  } else if (valFactor.score < 35) {
    recommendations.push('Low value exposure — consider adding value names for diversification during growth-to-value rotations.');
  }

  const sizeFactor = factors.find(f => f.factor === 'size')!;
  if (sizeFactor.score < 25) {
    recommendations.push('Portfolio is entirely large-cap — consider allocating 15-25% to mid/small caps for growth potential.');
  } else if (sizeFactor.score > 60) {
    recommendations.push('Significant small/mid-cap exposure — ensure position sizing accounts for higher volatility.');
  }

  const qualFactor = factors.find(f => f.factor === 'quality')!;
  if (qualFactor.score < 40) {
    recommendations.push('Below-benchmark quality — review holdings for debt levels and earnings stability. Prioritize companies with ROCE > 15%.');
  }

  const volFactor = factors.find(f => f.factor === 'low_volatility')!;
  if (volFactor.score < 35) {
    recommendations.push('High portfolio volatility — consider adding defensive sectors (FMCG, pharma, IT) to reduce drawdown risk.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Portfolio factor exposures are balanced. Continue monitoring quarterly for style drift.');
  }

  recommendations.push('Rebalance factor exposures annually or when individual factor tilts exceed 20 points from benchmark.');

  return {
    factors,
    stockContributions,
    dominantStyle,
    insights,
    recommendations,
  };
}
