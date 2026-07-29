/**
 * ============================================================================
 * Toroloom — buildPeriodReportHTML Unit Tests
 * ============================================================================
 *
 * Tests for the PDF HTML builder function that generates the full period
 * report as an HTML string. Tests cover:
 *   1. Empty data — no trades, holdings, metrics, etc.
 *   2. Full data — all 7 sections present with correct content
 *   3. Edge cases — missing sections, infinity PF, single holdings
 *
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import { buildPeriodReportHTML } from '../utils/periodReportPDF';
import type { Holding } from '../types';

// ============================================================================
// Mock Data
// ============================================================================

/** Minimal metrics — all zeros */
const emptyMetrics = {
  totalReturn: 0,
  totalReturnPercent: 0,
  dayChange: 0,
  winRate: 0,
  totalTrades: 0,
  sharpeRatio: 0,
  maxDrawdownPercent: 0,
  realizedPnl: 0,
  unrealizedPnl: 0,
  avgWin: 0,
  avgLoss: 0,
  profitFactor: 0,
  avgHoldingDays: 0,
  bestTrade: 0,
  worstTrade: 0,
  winningTrades: 0,
  losingTrades: 0,
};

/** Positive metrics — profitable period */
const positiveMetrics = {
  totalReturn: 15000,
  totalReturnPercent: 12.5,
  dayChange: 2300,
  winRate: 65,
  totalTrades: 42,
  sharpeRatio: 1.8,
  maxDrawdownPercent: -8.2,
  realizedPnl: 12000,
  unrealizedPnl: 3000,
  avgWin: 850,
  avgLoss: 420,
  profitFactor: 2.02,
  avgHoldingDays: 14,
  bestTrade: 5000,
  worstTrade: -1200,
  winningTrades: 27,
  losingTrades: 15,
};

/** Empty capital gains */
const emptyCG = {
  shortTerm: { gains: 0, count: 0, taxRate: 15, estimatedTax: 0 },
  longTerm: { gains: 0, count: 0, taxRate: 10, estimatedTax: 0 },
  totalEstimatedTax: 0,
  sttPaid: 0,
  totalBrokerage: 0,
};

/** Capital gains with positive tax liability */
const profitCG = {
  shortTerm: { gains: 50000, count: 20, taxRate: 15, estimatedTax: 7500 },
  longTerm: { gains: 150000, count: 5, taxRate: 10, estimatedTax: 5000 },
  totalEstimatedTax: 12500,
  sttPaid: 3200,
  totalBrokerage: 1850,
};

/** A single holding in Energy sector */
const energyHolding: Holding = {
  id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries',
  quantity: 10, buyPrice: 2450, currentPrice: 2400,
  totalInvested: 24500, currentValue: 24000,
  pnl: -500, pnlPercent: -2.04, dayChange: -50, dayChangePercent: -0.21,
};

const techHolding: Holding = {
  id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy',
  quantity: 5, buyPrice: 3800, currentPrice: 3600,
  totalInvested: 19000, currentValue: 18000,
  pnl: -1000, pnlPercent: -5.26, dayChange: -100, dayChangePercent: -0.55,
};

const bankHolding: Holding = {
  id: 'h3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank',
  quantity: 20, buyPrice: 1650, currentPrice: 1620,
  totalInvested: 33000, currentValue: 32400,
  pnl: -600, pnlPercent: -1.82, dayChange: -30, dayChangePercent: -0.18,
};

const profitHolding: Holding = {
  id: 'h4', stockId: 'WIPRO', symbol: 'WIPRO', name: 'Wipro',
  quantity: 8, buyPrice: 450, currentPrice: 520,
  totalInvested: 3600, currentValue: 4160,
  pnl: 560, pnlPercent: 15.56, dayChange: 40, dayChangePercent: 0.96,
};

/** Sector losers: Energy + Technology + Banking */
const sectorLosers = [
  { sector: 'Energy', totalLoss: -500, totalLossPercent: -2.04, stocks: [energyHolding] },
  { sector: 'Technology', totalLoss: -1000, totalLossPercent: -5.26, stocks: [techHolding] },
  { sector: 'Banking', totalLoss: -600, totalLossPercent: -1.82, stocks: [bankHolding] },
];

/** Sector metrics: positive */
const sectorMetricsPositive = [
  { sector: 'Technology', totalTrades: 15, totalWins: 10, totalLosses: 5, avgWin: 1200, avgLoss: 400, profitFactor: 3.0 },
  { sector: 'Energy', totalTrades: 10, totalWins: 6, totalLosses: 4, avgWin: 900, avgLoss: 350, profitFactor: 2.57 },
  { sector: 'Banking', totalTrades: 8, totalWins: 5, totalLosses: 3, avgWin: 600, avgLoss: 300, profitFactor: 2.0 },
];

/** Sector metrics: all wins (profitFactor 99 → ∞) */
const sectorMetricsAllWins = [
  { sector: 'Technology', totalTrades: 5, totalWins: 5, totalLosses: 0, avgWin: 800, avgLoss: 0, profitFactor: 99 },
];

/** Periods data */
const periods = [
  { label: 'Aug 2026', pnl: -450, trades: 1, winners: 0, losers: 1 },
  { label: 'Jul 2026', pnl: 2000, trades: 2, winners: 2, losers: 0 },
  { label: 'Jun 2026', pnl: 4750, trades: 2, winners: 1, losers: 1 },
];

/** Cognitive Summary with all three alerts — plain object (type: any fits function param) */
const alertedCognitive = {
  overTradingAlert: { flag: true, message: '60 trades this week — 10+ per day average', severity: 'high', details: { dailyCount: 12, maxRecommended: 10 } },
  brokerageLeakageAlert: { flag: true, message: '₹8,500 in brokerage (5.2% of P&L)', severity: 'medium', details: { totalBrokerage: 8500, pnlRatio: 0.052 } },
  concentrationRiskAlert: { flag: true, message: 'Energy at 62% of portfolio', severity: 'medium', details: { topSector: 'Energy', concentrationPct: 62 } },
  behavioralCritique: 'Your win rate is good but brokerage costs are eating into profits. Consider reducing trade frequency.',
  sectorConcentrationIndex: 0.42,
  winLossFrequencyRatio: 0.6,
};

/** Cognitive Summary with just a critique (no alert flags) */
const critiqueOnlyCognitive = {
  behavioralCritique: 'Consider reviewing your exit strategy for better consistency.',
};

// ============================================================================
// Tests
// ============================================================================

describe('buildPeriodReportHTML', () => {
  // ── Basic structure ────────────────────────────────────────────────
  it('returns valid HTML with basic structure', () => {
    const html = buildPeriodReportHTML(emptyMetrics, emptyCG, [], [], [], null, 'Monthly', []);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('<style>');
    expect(html).toContain('Toroloom');
  });

  it('includes the period badge label in the header', () => {
    const html = buildPeriodReportHTML(emptyMetrics, emptyCG, [], [], [], null, 'Weekly', []);
    expect(html).toContain('Weekly');
  });

  it('includes the generation date', () => {
    const html = buildPeriodReportHTML(emptyMetrics, emptyCG, [], [], [], null, 'Monthly', []);
    expect(html).toMatch(/Generated on/);
  });

  // ── Empty data ─────────────────────────────────────────────────────
  it('handles completely empty data gracefully', () => {
    const html = buildPeriodReportHTML(
      emptyMetrics, emptyCG, [], [], [], null, 'Monthly', [],
    );
    // Should still render Executive Summary, P&L Details, Tax Summary
    expect(html).toContain('Executive Summary');
    expect(html).toContain('P&amp;L Details');
    expect(html).toContain('Tax Summary');

    // Sections with no data should NOT appear
    expect(html).not.toContain('Loss Breakdown by Sector');
    expect(html).not.toContain('Sector-wise Trade');
    expect(html).not.toContain('Period Breakdown');
    expect(html).not.toContain('Behavioral Insights');
    expect(html).not.toContain('<th>Symbol</th>'); // holdings table header

    // But should have the footer
    expect(html).toContain('informational purposes');
  });

  it('shows zero values correctly in empty state', () => {
    const html = buildPeriodReportHTML(emptyMetrics, emptyCG, [], [], [], null, 'Monthly', []);
    expect(html).toContain('0.0%'); // win rate
    expect(html).toContain('0'); // total trades
  });

  // ── Full data — section presence ───────────────────────────────────
  it('includes Executive Summary with 6 metric cards', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).toContain('Executive Summary');
    expect(html).toContain('Total P&amp;L');
    expect(html).toContain('Period Return');
    expect(html).toContain('Win Rate');
    expect(html).toContain('Sharpe Ratio');
    expect(html).toContain('Max Drawdown');
  });

  it('includes P&L Details section with metrics', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).toContain('P&amp;L Details');
    expect(html).toContain('Realized P&amp;L');
    expect(html).toContain('Unrealized P&amp;L');
    expect(html).toContain('Best Trade');
    expect(html).toContain('Avg Win');
    expect(html).toContain('Avg Loss');
    expect(html).toContain('Profit Factor');
    expect(html).toContain('Avg Holding Days');
    expect(html).toContain('Winning Trades');
    expect(html).toContain('Losing Trades');
  });

  it('includes Tax Summary section with STCG and LTCG', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).toContain('Tax Summary');
    expect(html).toContain('STCG');
    expect(html).toContain('LTCG');
    expect(html).toContain('Estimated Tax');
    expect(html).toContain('STT');
    expect(html).toContain('Brokerage');
  });

  it('includes Behavioral Insights section with alert messages', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).toContain('Behavioral Insights');
    expect(html).toContain('Over-Trading Alert');
    expect(html).toContain('Brokerage Leakage');
    expect(html).toContain('Concentration Risk');
    expect(html).toContain('Critique');
  });

  it('includes Period Breakdown section with period rows', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).toContain('Period Breakdown');
    expect(html).toContain('Aug 2026');
    expect(html).toContain('Jul 2026');
    expect(html).toContain('Jun 2026');
  });

  it('includes Loss Breakdown by Sector section', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).toContain('Loss Breakdown by Sector');
    expect(html).toContain('Energy');
    expect(html).toContain('Banking');
    expect(html).toContain('RELIANCE');
    expect(html).toContain('TCS');
  });

  it('includes Sector-wise Trade Metrics section', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).toContain('Sector-wise Trade Metrics');
    expect(html).toContain('Technology');
    expect(html).toContain('Energy');
    expect(html).toContain('Banking');
  });

  it('includes Holdings section with stock symbol and name', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).toContain('RELIANCE');
    expect(html).toContain('TCS');
    expect(html).toContain('HDFCBANK');
    expect(html).toContain('WIPRO');
    expect(html).toContain('Reliance Industries');
    expect(html).toContain('Tata Consultancy');
    expect(html).toContain('HDFC Bank');
    expect(html).toContain('Wipro');
  });

  // ── Full data — correct values ──────────────────────────────────────
  it('renders P&L values correctly', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    // totalReturn = 15000 → formatCurrency(15000) without compact
    expect(html).toContain('₹15,000');
    // 12.5% → formatPercent returns something containing 12.50 or similar
    expect(html).toMatch(/12\.\d/);
  });

  it('renders profit factor from metrics', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).toContain('2.02');
  });

  it('renders winning and losing trade counts', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).toContain('27');
    expect(html).toContain('15');
  });

  it('renders tax-related numbers in the HTML', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    // Check for the tax breakdown by looking for tax rate numbers
    expect(html).toContain('15%'); // STCG rate
    expect(html).toContain('10%'); // LTCG rate
    expect(html).toContain('20'); // STCG trade count
    expect(html).toContain('5'); // LTCG trade count
  });

  it('renders period P&L values in the breakdown table', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    // Period labels should be present
    expect(html).toContain('Aug 2026');
    expect(html).toContain('Jul 2026');
    expect(html).toContain('Jun 2026');
    // P&L values in compact K format (formatCurrency(v, true))
    expect(html).toContain('450'); // from -450 period (standard format, < 1000)
    expect(html).toContain('2.0K'); // from 2000 period (compact format)
    expect(html).toContain('4.8K'); // from 4750 period (compact format: 4.75 → 4.8)
  });

  // ── Edge case: no losing positions ──────────────────────────────────
  it('hides Loss Breakdown section when sectorLosers is empty', () => {
    const html = buildPeriodReportHTML(positiveMetrics, profitCG, [], sectorMetricsPositive, periods, alertedCognitive, 'Monthly', [profitHolding]);
    expect(html).not.toContain('Loss Breakdown by Sector');
  });

  // ── Edge case: no cognitive summary ────────────────────────────────
  it('hides Behavioral Insights section when cognitiveSummary is null', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, null, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html).not.toContain('Behavioral Insights');
  });

  it('shows Behavioral Insights with critique when no alert flags', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, critiqueOnlyCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    // critiqueOnlyCognitive has behavioralCritique but no alert flags
    expect(html).toContain('Behavioral Insights');
    expect(html).toContain('Critique');
    expect(html).toContain('exit strategy');
    // No alert-specific messages
    expect(html).not.toContain('Over-Trading Alert');
    expect(html).not.toContain('Brokerage Leakage');
    expect(html).not.toContain('Concentration Risk');
  });

  // ── Edge case: no period breakdown ──────────────────────────────────
  it('hides Period Breakdown section when periods is empty', () => {
    const html = buildPeriodReportHTML(positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive, [], alertedCognitive, 'Monthly', [energyHolding, techHolding, bankHolding, profitHolding]);
    expect(html).not.toContain('Period Breakdown');
  });

  // ── Edge case: no sector metrics ────────────────────────────────────
  it('hides Sector-wise Trade Metrics section when sectorMetrics is empty', () => {
    const html = buildPeriodReportHTML(positiveMetrics, profitCG, sectorLosers, [], periods, alertedCognitive, 'Monthly', [energyHolding, techHolding, bankHolding, profitHolding]);
    expect(html).not.toContain('Sector-wise Trade Metrics');
  });

  // ── Edge case: no holdings ──────────────────────────────────────────
  it('hides Holdings table when holdings is empty', () => {
    const html = buildPeriodReportHTML(positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive, periods, alertedCognitive, 'Monthly', []);
    expect(html).not.toContain('<th>Symbol</th>');
  });

  // ── Edge case: single holding ───────────────────────────────────────
  it('renders Holdings with a single stock correctly', () => {
    const html = buildPeriodReportHTML(emptyMetrics, emptyCG, [], [], [], null, 'Monthly', [energyHolding]);
    expect(html).toContain('RELIANCE');
    expect(html).toContain('Reliance Industries');
  });

  // ── Edge case: profit factor infinity (99) ──────────────────────────
  it('renders infinity symbol for profit factor >= 99', () => {
    const html = buildPeriodReportHTML(emptyMetrics, emptyCG, [], sectorMetricsAllWins, [], null, 'Monthly', []);
    expect(html).toContain('∞');
  });

  // ── Edge case: all negative metrics ─────────────────────────────────
  it('renders negative P&L correctly', () => {
    const negativeMetrics = { ...emptyMetrics, totalReturn: -5000, totalReturnPercent: -8.5 };
    const html = buildPeriodReportHTML(negativeMetrics, emptyCG, [], [], [], null, 'Weekly', []);
    expect(html).toContain('-₹5,000');
  });

  // ── HTML structure integrity ────────────────────────────────────────
  it('produces well-formed HTML with matched opening/closing div tags', () => {
    const html = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    const openDivs = (html.match(/<div/g) || []).length;
    const closeDivs = (html.match(/<\/div>/g) || []).length;
    expect(openDivs).toBe(closeDivs);
  });

  it('includes the Toroloom footer in all outputs', () => {
    const html1 = buildPeriodReportHTML(emptyMetrics, emptyCG, [], [], [], null, 'Monthly', []);
    const html2 = buildPeriodReportHTML(
      positiveMetrics, profitCG, sectorLosers, sectorMetricsPositive,
      periods, alertedCognitive, 'Monthly',
      [energyHolding, techHolding, bankHolding, profitHolding],
    );
    expect(html1).toContain('Toroloom');
    expect(html2).toContain('Toroloom');
  });
});
