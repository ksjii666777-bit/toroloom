/**
 * ============================================================================
 * Toroloom — Monte Carlo Portfolio Simulation Service
 * ============================================================================
 *
 * Runs N (default 10,000) independent simulations of a portfolio's future value
 * using Geometric Brownian Motion (GBM) with:
 *
 *   - Initial investment
 *   - Monthly contributions
 *   - Annual expected return
 *   - Annual volatility
 *   - Time horizon (years)
 *
 * Returns percentiles (5th, 25th, 50th, 75th, 95th) at each year boundary,
 * plus the raw final values for histogram rendering, plus all paths for
 * the fan chart overlay.
 *
 * Formula (GBM with contributions):
 *   S(t+dt) = S(t) * exp((μ - σ²/2) * dt + σ * √dt * Z)
 *   Then add monthly contribution * dt (in months)
 *
 * ============================================================================
 */

import type { MonteCarloParams, MonteCarloResult, MonteCarloYearResult, MonteCarloPercentile } from '../types';

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_SIMULATIONS = 10000;
const MONTHS_PER_YEAR = 12;

/** Returns a standard normal random variate via Box-Muller */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── Main Simulation ──────────────────────────────────────────

/**
 * Run a full Monte Carlo simulation.
 *
 * @param params  Partial parameters; defaults fill in missing fields.
 * @returns       MonteCarloResult with percentiles, final values, and paths.
 */
export function runMonteCarloSimulation(
  params: Partial<MonteCarloParams> = {},
): MonteCarloResult {
  // ── Fill defaults ──────────────────────────────────────────
  const p: MonteCarloParams = {
    initialInvestment: params.initialInvestment ?? 100000,
    monthlyContribution: params.monthlyContribution ?? 10000,
    annualReturn: params.annualReturn ?? 0.12,
    annualVolatility: params.annualVolatility ?? 0.18,
    years: params.years ?? 10,
    simulations: params.simulations ?? DEFAULT_SIMULATIONS,
  };

  const {
    initialInvestment,
    monthlyContribution,
    annualReturn,
    annualVolatility,
    years,
    simulations,
  } = p;

  const totalMonths = years * MONTHS_PER_YEAR;
  const dt = 1 / MONTHS_PER_YEAR; // one month step
  const drift = annualReturn - (annualVolatility * annualVolatility) / 2;
  const volSqrtDt = annualVolatility * Math.sqrt(dt);

  // Storage: allPaths[simIndex][monthIndex]
  const allPaths: number[][] = [];
  // Storage: final values for histogram
  const finalValues: number[] = new Array(simulations);

  for (let sim = 0; sim < simulations; sim++) {
    const path: number[] = new Array(totalMonths + 1);
    let value = initialInvestment;
    path[0] = value;

    for (let month = 1; month <= totalMonths; month++) {
      const z = randn();
      // GBM step
      value *= Math.exp(drift * dt + volSqrtDt * z);
      // Add monthly contribution at the end of the month
      value += monthlyContribution;
      path[month] = Math.round(value * 100) / 100;
    }

    allPaths.push(path);
    finalValues[sim] = path[totalMonths];
  }

  // ── Compute percentiles at each year boundary ──────────────
  const yearResults: MonteCarloYearResult[] = [];
  for (let y = 0; y <= years; y++) {
    const monthIndex = y * MONTHS_PER_YEAR;
    const valuesAtYear = allPaths.map(p => p[monthIndex]);
    const sorted = [...valuesAtYear].sort((a, b) => a - b);

    yearResults.push({
      year: y,
      percentiles: [
        { percentile: 5, value: percentile(sorted, 5) },
        { percentile: 25, value: percentile(sorted, 25) },
        { percentile: 50, value: percentile(sorted, 50) },
        { percentile: 75, value: percentile(sorted, 75) },
        { percentile: 95, value: percentile(sorted, 95) },
      ],
    });
  }

  // ── Percentiles on final values ────────────────────────────
  const sortedFinal = [...finalValues].sort((a, b) => a - b);
  const p5 = percentile(sortedFinal, 5);
  const p25 = percentile(sortedFinal, 25);
  const p50 = percentile(sortedFinal, 50);
  const p75 = percentile(sortedFinal, 75);
  const p95 = percentile(sortedFinal, 95);

  // ── Probability of profit ──────────────────────────────────
  const profitableCount = finalValues.filter(v => v > initialInvestment).length;
  const probabilityOfProfit = Math.round((profitableCount / simulations) * 1000) / 10;

  // ── Thin the paths for display (max ~200 lines on chart) ────
  const displayPaths = thinPaths(allPaths, Math.min(200, simulations));

  return {
    params: p,
    medianEndValue: Math.round(p50 * 100) / 100,
    bestCaseValue: Math.round(p95 * 100) / 100,
    worstCaseValue: Math.round(p5 * 100) / 100,
    probabilityOfProfit,
    yearResults,
    finalValues: sortedFinal,
    allPaths: displayPaths,
  };
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Compute the value at a given percentile from a sorted array.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Thin thousands of paths down to `maxLines` by evenly sampling.
 */
function thinPaths(paths: number[][], maxLines: number): number[][] {
  if (paths.length <= maxLines) return paths;
  const step = Math.floor(paths.length / maxLines);
  const thinned: number[][] = [];
  for (let i = 0; i < paths.length && thinned.length < maxLines; i += step) {
    thinned.push(paths[i]);
  }
  return thinned;
}

// ─── Utility exports ──────────────────────────────────────────

/**
 * Format a rupee value in lakh/crore notation for display.
 */
export function formatRupees(value: number): string {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  }
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  }
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}
