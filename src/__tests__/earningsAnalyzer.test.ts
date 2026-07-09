import { describe, it, expect } from 'vitest';
import {
  analyzeEarnings,
  assessSentiment,
  generateExecutiveSummary,
  generateKeyTakeaways,
  formatCr,
  formatPct,
  getQuarterLabel,
  getFiscalYear,
  computeHistoricalTrend,
  comparePeers,
  computeEps,
} from '../services/ai/earningsAnalyzer';
import type { EarningsQuarter } from '../types';

// ─── formatCr ────────────────────────────────────────────────
describe('formatCr', () => {
  it('formats values under 1000 Cr', () => {
    expect(formatCr(500)).toBe('500.0 Cr');
    expect(formatCr(0)).toBe('0.0 Cr');
    expect(formatCr(999.9)).toBe('999.9 Cr');
  });

  it('formats values in thousands of Cr', () => {
    expect(formatCr(1500)).toBe('1.5K Cr');
    expect(formatCr(89500)).toBe('89.5K Cr');
  });

  it('formats values in lakhs of Cr', () => {
    expect(formatCr(100000)).toBe('1.0L Cr');
    expect(formatCr(241000)).toBe('2.4L Cr');
  });
});

// ─── formatPct ────────────────────────────────────────────────
describe('formatPct', () => {
  it('adds + sign for positive values', () => {
    expect(formatPct(12.5)).toBe('+12.5%');
    expect(formatPct(0.1)).toBe('+0.1%');
  });

  it('adds - sign for negative values', () => {
    expect(formatPct(-5.3)).toBe('-5.3%');
    expect(formatPct(-100)).toBe('-100.0%');
  });

  it('handles zero', () => {
    expect(formatPct(0)).toBe('+0.0%');
  });
});

// ─── getQuarterLabel ─────────────────────────────────────────
describe('getQuarterLabel', () => {
  it('maps January to Q4 of previous fiscal year', () => {
    expect(getQuarterLabel('2026-01-15')).toBe('Q4 FY26');
  });

  it('maps April to Q1 of current fiscal year', () => {
    expect(getQuarterLabel('2026-04-15')).toBe('Q1 FY27');
  });

  it('maps July to Q2', () => {
    expect(getQuarterLabel('2026-07-15')).toBe('Q2 FY27');
  });

  it('maps October to Q3', () => {
    expect(getQuarterLabel('2026-10-15')).toBe('Q3 FY27');
  });
});

// ─── getFiscalYear ───────────────────────────────────────────
describe('getFiscalYear', () => {
  it('returns FY26 for April 2026 dates', () => {
    expect(getFiscalYear('2026-04-15')).toBe('FY27');
  });

  it('returns FY26 for January 2026 dates', () => {
    expect(getFiscalYear('2026-01-15')).toBe('FY26');
  });
});

// ─── assessSentiment ─────────────────────────────────────────
describe('assessSentiment', () => {
  it('returns bullish for strong growth across all metrics', () => {
    const result = assessSentiment({
      revenue: 100000, revenueGrowth: 22, netProfit: 20000, profitGrowth: 30,
      eps: 25, epsGrowth: 30, operatingMargin: 28, netMargin: 20,
      revenueBeat: 4, profitBeat: 6, ebitda: 35000, ebitdaMargin: 35,
    });
    expect(result.label).toBe('bullish');
    expect(result.score).toBeGreaterThanOrEqual(25);
  });

  it('returns bearish for declining revenue and profit', () => {
    const result = assessSentiment({
      revenue: 50000, revenueGrowth: -12, netProfit: 5000, profitGrowth: -20,
      eps: 8, epsGrowth: -20, operatingMargin: 5, netMargin: 2,
      revenueBeat: -6, profitBeat: -10, ebitda: 8000, ebitdaMargin: 16,
    });
    expect(result.label).toBe('bearish');
    expect(result.score).toBeLessThanOrEqual(-25);
  });

  it('returns neutral for mixed signals', () => {
    const result = assessSentiment({
      revenue: 60000, revenueGrowth: 3, netProfit: 8000, profitGrowth: -2,
      eps: 12, epsGrowth: -2, operatingMargin: 10, netMargin: 8,
      revenueBeat: 1, profitBeat: -1, ebitda: 12000, ebitdaMargin: 20,
    });
    expect(result.label).toBe('neutral');
    expect(result.score).toBeGreaterThanOrEqual(-25);
    expect(result.score).toBeLessThanOrEqual(25);
  });

  it('clamps score to [-100, 100]', () => {
    const extreme = assessSentiment({
      revenue: 200000, revenueGrowth: 50, netProfit: 50000, profitGrowth: 60,
      eps: 100, epsGrowth: 60, operatingMargin: 35, netMargin: 25,
      revenueBeat: 10, profitBeat: 15, ebitda: 80000, ebitdaMargin: 40,
    });
    expect(extreme.score).toBeLessThanOrEqual(100);

    const negative = assessSentiment({
      revenue: 10000, revenueGrowth: -30, netProfit: -1000, profitGrowth: -50,
      eps: -5, epsGrowth: -50, operatingMargin: -5, netMargin: -10,
      revenueBeat: -10, profitBeat: -15, ebitda: -2000, ebitdaMargin: -20,
    });
    expect(negative.score).toBeGreaterThanOrEqual(-100);
  });
});

// ─── generateExecutiveSummary ───────────────────────────────
describe('generateExecutiveSummary', () => {
  it('includes revenue, profit, EPS, and margins', () => {
    const summary = generateExecutiveSummary({
      revenue: 100000, revenueGrowth: 10, netProfit: 20000, profitGrowth: 15,
      eps: 25, epsGrowth: 15, operatingMargin: 20, netMargin: 20,
      revenueBeat: 2, profitBeat: 3, ebitda: 35000, ebitdaMargin: 35,
    }, 'Test Corp');
    expect(summary).toContain('Test Corp');
    expect(summary).toContain('revenue');
    expect(summary).toContain('profit');
    expect(summary).toContain('EPS');
    expect(summary).toContain('EBITDA');
  });

  it('mentions beat/miss when applicable', () => {
    const withBeat = generateExecutiveSummary({
      revenue: 50000, revenueGrowth: 8, netProfit: 10000, profitGrowth: 12,
      eps: 15, epsGrowth: 12, operatingMargin: 22, netMargin: 20,
      revenueBeat: 3, profitBeat: 5, ebitda: 18000, ebitdaMargin: 36,
    }, 'Growth Inc');
    expect(withBeat).toContain('beat');

    const withMiss = generateExecutiveSummary({
      revenue: 40000, revenueGrowth: -5, netProfit: 5000, profitGrowth: -10,
      eps: 8, epsGrowth: -10, operatingMargin: 10, netMargin: 12.5,
      revenueBeat: -4, profitBeat: -2, ebitda: 8000, ebitdaMargin: 20,
    }, 'Decline Inc');
    expect(withMiss).toContain('missed');
  });

  it('works without estimates (null beat)', () => {
    const summary = generateExecutiveSummary({
      revenue: 50000, revenueGrowth: 5, netProfit: 8000, profitGrowth: 8,
      eps: 12, epsGrowth: 8, operatingMargin: 18, netMargin: 16,
      revenueBeat: null, profitBeat: null, ebitda: 12000, ebitdaMargin: 24,
    }, 'No Est Corp');
    expect(summary).toContain('No Est Corp');
    expect(summary).not.toContain('beat');
    expect(summary).not.toContain('missed');
  });
});

// ─── generateKeyTakeaways ────────────────────────────────────
describe('generateKeyTakeaways', () => {
  it('returns exactly 5 takeaways', () => {
    const takeaways = generateKeyTakeaways({
      revenue: 100000, revenueGrowth: 15, netProfit: 20000, profitGrowth: 25,
      eps: 30, epsGrowth: 25, operatingMargin: 22, netMargin: 20,
      revenueBeat: 3, profitBeat: 5, ebitda: 40000, ebitdaMargin: 40,
    });
    expect(takeaways).toHaveLength(5);
    takeaways.forEach(t => expect(typeof t).toBe('string'));
  });

  it('handles negative growth metrics', () => {
    const takeaways = generateKeyTakeaways({
      revenue: 30000, revenueGrowth: -8, netProfit: 2000, profitGrowth: -15,
      eps: 5, epsGrowth: -15, operatingMargin: 4, netMargin: 6.7,
      revenueBeat: -3, profitBeat: -4, ebitda: 4000, ebitdaMargin: 13.3,
    });
    expect(takeaways).toHaveLength(5);
    takeaways.forEach(t => expect(typeof t).toBe('string'));
  });

  it('handles double beat scenario', () => {
    const takeaways = generateKeyTakeaways({
      revenue: 100000, revenueGrowth: 20, netProfit: 25000, profitGrowth: 30,
      eps: 40, epsGrowth: 30, operatingMargin: 28, netMargin: 25,
      revenueBeat: 5, profitBeat: 8, ebitda: 45000, ebitdaMargin: 45,
    });
    const beatMsg = takeaways.find(t => t.includes('double beat'));
    expect(beatMsg).toBeDefined();
  });
});

// ─── computeHistoricalTrend ─────────────────────────────────
describe('computeHistoricalTrend', () => {
  const quarters: EarningsQuarter[] = [
    { quarter: 'Q1', date: '2025-04-01', revenue: 40000, netProfit: 8000, eps: 12, margin: 20 },
    { quarter: 'Q2', date: '2025-07-01', revenue: 45000, netProfit: 9000, eps: 13.5, margin: 20 },
    { quarter: 'Q3', date: '2025-10-01', revenue: 52000, netProfit: 11000, eps: 16.5, margin: 21.2 },
    { quarter: 'Q4', date: '2026-01-01', revenue: 60000, netProfit: 14000, eps: 21, margin: 23.3 },
  ];

  it('detects growing trend', () => {
    const result = computeHistoricalTrend(quarters);
    expect(result.revenueTrend).toBe('growing');
    expect(result.profitTrend).toBe('growing');
    expect(result.revenueCagr).toBeGreaterThan(0);
    expect(result.profitCagr).toBeGreaterThan(0);
  });

  it('returns a positive average margin', () => {
    const result = computeHistoricalTrend(quarters);
    expect(result.averageMargin).toBeGreaterThan(0);
  });

  it('handles single quarter input', () => {
    const result = computeHistoricalTrend([quarters[0]]);
    expect(result.revenueTrend).toBe('stable');
    expect(result.revenueCagr).toBe(0);
  });

  it('handles declining trend', () => {
    const declining: EarningsQuarter[] = [
      { quarter: 'Q1', date: '2025-04-01', revenue: 60000, netProfit: 12000, eps: 20, margin: 20 },
      { quarter: 'Q2', date: '2025-07-01', revenue: 55000, netProfit: 10000, eps: 17, margin: 18.2 },
      { quarter: 'Q3', date: '2025-10-01', revenue: 48000, netProfit: 8000, eps: 13.5, margin: 16.7 },
    ];
    const result = computeHistoricalTrend(declining);
    expect(result.revenueTrend).toBe('declining');
    expect(result.profitTrend).toBe('declining');
  });
});

// ─── comparePeers ────────────────────────────────────────────
describe('comparePeers', () => {
  const current = { symbol: 'ABC', name: 'ABC Corp', revenue: 50000, profit: 10000, peRatio: 20, revenueGrowth: 10, profitGrowth: 15 };
  const peers = [
    { symbol: 'XYZ', name: 'XYZ Ltd', revenue: 80000, profit: 15000, peRatio: 25, revenueGrowth: 8, profitGrowth: 12 },
    { symbol: 'DEF', name: 'DEF Inc', revenue: 30000, profit: 5000, peRatio: 15, revenueGrowth: 5, profitGrowth: 8 },
  ];

  it('sorts peers by revenue descending', () => {
    const result = comparePeers(current, peers);
    expect(result[0].symbol).toBe('XYZ');
    expect(result[1].symbol).toBe('ABC');
    expect(result[2].symbol).toBe('DEF');
  });

  it('includes all entries', () => {
    const result = comparePeers(current, peers);
    expect(result).toHaveLength(3);
  });
});

// ─── computeEps ──────────────────────────────────────────────
describe('computeEps', () => {
  it('computes EPS correctly', () => {
    // Net profit 20,000 Cr, shares outstanding 1,000 Cr => EPS = 20
    const eps = computeEps(20000, 1000);
    expect(eps).toBeCloseTo(20, 1);
  });

  it('handles zero shares', () => {
    const eps = computeEps(10000, 0);
    expect(eps).toBe(0);
  });
});

// ─── analyzeEarnings (main function) ─────────────────────────
describe('analyzeEarnings', () => {
  const input = {
    symbol: 'TEST',
    companyName: 'Test Corp',
    date: '2026-04-15',
    revenue: 100000,
    previousRevenue: 85000,
    netProfit: 20000,
    previousNetProfit: 16000,
    operatingProfit: 22000,
    ebitda: 35000,
    sharesOutstanding: 1000,
    revenueEstimate: 98000,
    profitEstimate: 19500,
    growthDrivers: ['Driver 1', 'Driver 2'],
    riskFactors: ['Risk 1', 'Risk 2'],
    managementHighlights: ['Highlight 1'],
    peers: [
      { symbol: 'PEER', name: 'Peer Corp', revenue: 120000, profit: 24000, peRatio: 22, revenueGrowth: 8, profitGrowth: 10 },
    ],
    historicalQuarters: [
      { quarter: 'Q1', date: '2025-04-01', revenue: 85000, netProfit: 16000, eps: 16, margin: 18.8 },
    ],
  };

  it('returns a complete EarningsSummary', () => {
    const result = analyzeEarnings(input);
    expect(result.symbol).toBe('TEST');
    expect(result.companyName).toBe('Test Corp');
    expect(result.quarter).toBe('Q1 FY27');
    expect(result.fiscalYear).toBe('FY27');
    expect(result.metrics.revenue).toBe(100000);
    expect(result.metrics.revenueGrowth).toBeGreaterThan(0);
    expect(result.metrics.netProfit).toBe(20000);
    expect(result.metrics.profitGrowth).toBeGreaterThan(0);
    expect(result.metrics.eps).toBeGreaterThan(0);
  });

  it('generates executive summary and takeaways', () => {
    const result = analyzeEarnings(input);
    expect(result.executiveSummary.length).toBeGreaterThan(0);
    expect(result.keyTakeaways).toHaveLength(5);
    expect(result.growthDrivers).toEqual(['Driver 1', 'Driver 2']);
    expect(result.riskFactors).toEqual(['Risk 1', 'Risk 2']);
  });

  it('computes beat/miss correctly', () => {
    const result = analyzeEarnings(input);
    expect(result.metrics.revenueBeat).toBeGreaterThan(0);
    expect(result.metrics.profitBeat).toBeGreaterThan(0);
  });

  it('computes sentiment from metrics', () => {
    const result = analyzeEarnings(input);
    expect(['bullish', 'bearish', 'neutral']).toContain(result.sentimentLabel);
    expect(result.sentimentScore).toBeGreaterThanOrEqual(-100);
    expect(result.sentimentScore).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it('includes peer comparison sorted by revenue', () => {
    const result = analyzeEarnings(input);
    expect(result.peerComparison.length).toBe(2);
    expect(result.peerComparison[0].symbol).toBe('PEER');
  });

  it('handles null estimates', () => {
    const noEst = { ...input, revenueEstimate: null, profitEstimate: null };
    const result = analyzeEarnings(noEst);
    expect(result.metrics.revenueBeat).toBeNull();
    expect(result.metrics.profitBeat).toBeNull();
  });

  it('computes margin values correctly', () => {
    const result = analyzeEarnings(input);
    expect(result.metrics.operatingMargin).toBeCloseTo(22, 0);
    expect(result.metrics.netMargin).toBeCloseTo(20, 0);
    expect(result.metrics.ebitdaMargin).toBeCloseTo(35, 0);
  });
});
