/**
 * ============================================================================
 * Toroloom — Correlation Matrix Service
 * ============================================================================
 *
 * Computes a Pearson correlation matrix between portfolio holdings using
 * simulated daily return data. The service:
 *
 *   1. Gets the user's holdings from the portfolio store
 *   2. Generates correlated daily return series for each holding
 *      (sector-aware: same-sector stocks share a common factor + idiosyncratic noise)
 *   3. Computes the Pearson correlation coefficient for each pair
 *   4. Returns a full matrix + diversification metrics + recommendations
 *
 * ============================================================================
 */

import type { Holding } from '../types';
import type { CorrelationMatrix, CorrelationPair } from '../types';
import { inferSector } from '../utils/sector';

// ─── Sector correlation factors (base inter-sector correlation) ─────
// Simulates real-world correlations between sectors.
// Same sector = higher base correlation; different = lower.
const SECTOR_BASE_CORRELATION: Record<string, Record<string, number>> = {
  Energy:      { Energy: 0.85, Technology: 0.35, Finance: 0.40, Telecom: 0.45, Consumer: 0.50, Automobile: 0.45, Others: 0.30 },
  Technology:  { Energy: 0.35, Technology: 0.80, Finance: 0.45, Telecom: 0.55, Consumer: 0.40, Automobile: 0.35, Others: 0.30 },
  Finance:     { Energy: 0.40, Technology: 0.45, Finance: 0.82, Telecom: 0.40, Consumer: 0.50, Automobile: 0.42, Others: 0.30 },
  Telecom:     { Energy: 0.45, Technology: 0.55, Finance: 0.40, Telecom: 0.78, Consumer: 0.45, Automobile: 0.40, Others: 0.30 },
  Consumer:    { Energy: 0.50, Technology: 0.40, Finance: 0.50, Telecom: 0.45, Consumer: 0.75, Automobile: 0.50, Others: 0.35 },
  Automobile:  { Energy: 0.45, Technology: 0.35, Finance: 0.42, Telecom: 0.40, Consumer: 0.50, Automobile: 0.80, Others: 0.30 },
  Others:      { Energy: 0.30, Technology: 0.30, Finance: 0.30, Telecom: 0.30, Consumer: 0.35, Automobile: 0.30, Others: 0.60 },
};

// ─── Generate correlated daily returns ─────────────────────────────
function generateDailyReturns(
  days: number,
  sector1: string,
  sector2: string,
): { returns1: number[]; returns2: number[] } {
  const returns1: number[] = [];
  const returns2: number[] = [];
  const baseCorr = SECTOR_BASE_CORRELATION[sector1]?.[sector2] ?? 0.30;

  // Annualized volatility ~18% → daily ~1.13%
  const dailyVol = 0.0113;
  const commonFactorVol = dailyVol * Math.sqrt(baseCorr);
  const idioVol1 = dailyVol * Math.sqrt(1 - baseCorr);
  const idioVol2 = dailyVol * Math.sqrt(1 - baseCorr);

  for (let d = 0; d < days; d++) {
    const commonFactor = randn() * commonFactorVol;
    const idio1 = randn() * idioVol1;
    const idio2 = randn() * idioVol2;
    // Add small drift (0.05% daily ≈ 12% annualized)
    returns1.push(0.0005 + commonFactor + idio1);
    returns2.push(0.0005 + commonFactor + idio2);
  }

  return { returns1, returns2 };
}

// ─── Standard normal RNG │Box-Muller│ ─────────────────────────────
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── Pearson correlation ───────────────────────────────────────────
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;

  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  const sumY2 = y.reduce((s, v) => s + v * v, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return Math.max(-1, Math.min(1, numerator / denominator));
}

// ─── Main function ─────────────────────────────────────────────────

const TRADING_DAYS = 252; // One year of daily data

/**
 * Compute the full correlation matrix for the given holdings.
 *
 * @param holdings  Array of portfolio holdings (from portfolioStore).
 * @returns         CorrelationMatrix with pairs, 2D matrix, and metrics.
 */
export function computeCorrelationMatrix(holdings: Holding[]): CorrelationMatrix {
  if (holdings.length < 2) {
    const symbols = holdings.map(h => h.symbol);
    return {
      symbols,
      pairs: [],
      matrix: [[1]],
      averageCorrelation: 0,
      diversificationScore: holdings.length === 1 ? 0 : 100,
      highCorrelationPairs: [],
      recommendations: ['Add at least 2 holdings to see correlation analysis.'],
    };
  }

  const n = holdings.length;
  const symbols = holdings.map(h => h.symbol);
  const sectors = holdings.map(h => inferSector(h.name, h.symbol));
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const pairs: CorrelationPair[] = [];
  const highCorrelationPairs: { asset1: string; asset2: string; correlation: number }[] = [];
  let totalCorrelation = 0;
  let pairCount = 0;

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1; // Self-correlation is always 1

    for (let j = i + 1; j < n; j++) {
      // Generate correlated daily returns based on sector relationship
      const { returns1, returns2 } = generateDailyReturns(
        TRADING_DAYS,
        sectors[i],
        sectors[j],
      );

      const corr = pearsonCorrelation(returns1, returns2);
      const rounded = Math.round(corr * 1000) / 1000;

      matrix[i][j] = rounded;
      matrix[j][i] = rounded;

      pairs.push({
        asset1: symbols[i],
        asset2: symbols[j],
        correlation: rounded,
        dataPoints: TRADING_DAYS,
      });

      totalCorrelation += Math.abs(rounded);
      pairCount++;

      if (rounded > 0.7) {
        highCorrelationPairs.push({
          asset1: symbols[i],
          asset2: symbols[j],
          correlation: rounded,
        });
      }
    }
  }

  const averageCorrelation = pairCount > 0
    ? Math.round((totalCorrelation / pairCount) * 1000) / 1000
    : 0;

  // Diversification score: 0-100 based on avg correlation
  // Lower avg correlation = higher diversification
  // 0.0 avg corr → 100, 0.5 avg corr → 50, 1.0 avg corr → 0
  const diversificationScore = Math.round(Math.max(0, Math.min(100,
    (1 - averageCorrelation) * 100,
  )));

  // Generate recommendations
  const recommendations: string[] = [];

  if (highCorrelationPairs.length > 0) {
    recommendations.push(
      `Highly correlated pairs: ${highCorrelationPairs
        .map(p => `${p.asset1}–${p.asset2} (${(p.correlation * 100).toFixed(0)}%)`)
        .join(', ')}. Consider diversifying across sectors.`,
    );
  }

  if (averageCorrelation < 0.3) {
    recommendations.push('Your portfolio is well-diversified across low-correlation assets. Consider rebalancing annually to maintain this balance.');
  } else if (averageCorrelation < 0.5) {
    recommendations.push('Moderate portfolio diversification. Adding assets from unrelated sectors (e.g., gold, bonds, international) could further reduce correlation.');
  } else {
    recommendations.push('Your portfolio has high average correlation. Consider adding assets like gold ETFs, bonds, or international stocks to improve diversification.');
  }

  // Check sector concentration
  const sectorCount = new Set(sectors).size;
  if (sectorCount <= 2 && holdings.length >= 3) {
    recommendations.push(`Portfolio is concentrated in only ${sectorCount} sector(s). Spreading across 4+ sectors can reduce unsystematic risk.`);
  }

  recommendations.push('Review the correlation matrix quarterly. Correlations change over market cycles and may require portfolio rebalancing.');

  return {
    symbols,
    pairs,
    matrix,
    averageCorrelation,
    diversificationScore,
    highCorrelationPairs,
    recommendations,
  };
}
