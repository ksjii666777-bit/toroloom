/**
 * ============================================================================
 * Toroloom — AI Earnings Call Analyzer
 * ============================================================================
 *
 * Pure functions for analyzing quarterly earnings data:
 *   - analyzeEarnings(): Compute key metrics & generate AI summary
 *   - comparePeers(): Compare financials across peer companies
 *   - computeHistoricalTrend(): Analyze revenue/profit trends
 *   - generateKeyTakeaways(): Extract top 5 takeaways from data
 *   - assessSentiment(): Compute sentiment score from metrics
 *
 * All functions are pure — no side effects, no API calls.
 * Designed to work with mock data in demo mode, or real data in production.
 * ============================================================================
 */

import type { EarningsSummary, EarningsMetrics, EarningsQuarter } from '../../types';

// ─── Constants ──────────────────────────────────────────────

const QUARTER_MAP: Record<string, string> = {
  '01': 'Q4',
  '02': 'Q4',
  '03': 'Q4',
  '04': 'Q1',
  '05': 'Q1',
  '06': 'Q1',
  '07': 'Q2',
  '08': 'Q2',
  '09': 'Q2',
  '10': 'Q3',
  '11': 'Q3',
  '12': 'Q3',
};

// ─── Helper Functions ───────────────────────────────────────

/** Safe division — returns 0 if divisor is 0 */
function safeDiv(a: number, b: number): number {
  if (b === 0 || !isFinite(b)) return 0;
  const result = a / b;
  return isFinite(result) ? result : 0;
}

/** Compute YoY growth percentage */
function computeGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return safeDiv(current - previous, Math.abs(previous)) * 100;
}

/** Format a number in Cr with appropriate precision */
export function formatCr(value: number): string {
  if (Math.abs(value) >= 100000) return `${(value / 100000).toFixed(1)}L Cr`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K Cr`;
  return `${value.toFixed(1)} Cr`;
}

/** Format a percentage for display */
export function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/** Determine which quarter a date falls in */
export function getQuarterLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const q = QUARTER_MAP[month] || 'Q4';
  const fy = d.getMonth() >= 3 ? year + 1 : year;
  return `${q} FY${String(fy).slice(2)}`;
}

/** Determine fiscal year from a date */
export function getFiscalYear(dateStr: string): string {
  const d = new Date(dateStr);
  const fy = d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear();
  return `FY${String(fy).slice(2)}`;
}

// ─── Sentiment Assessment ───────────────────────────────────

/**
 * Assess overall sentiment based on earnings metrics.
 * Returns a score from -100 (extremely bearish) to +100 (extremely bullish).
 */
export function assessSentiment(metrics: EarningsMetrics): {
  score: number;
  label: 'bullish' | 'bearish' | 'neutral';
} {
  let score = 0;

  // Revenue growth (0-30 pts)
  if (metrics.revenueGrowth > 20) score += 30;
  else if (metrics.revenueGrowth > 10) score += 20;
  else if (metrics.revenueGrowth > 0) score += 10;
  else if (metrics.revenueGrowth < -10) score -= 20;
  else if (metrics.revenueGrowth < 0) score -= 10;

  // Profit growth (0-30 pts)
  if (metrics.profitGrowth > 25) score += 30;
  else if (metrics.profitGrowth > 10) score += 20;
  else if (metrics.profitGrowth > 0) score += 10;
  else if (metrics.profitGrowth < -15) score -= 25;
  else if (metrics.profitGrowth < 0) score -= 15;

  // Margins (0-20 pts)
  const avgMargin = (metrics.operatingMargin + metrics.netMargin) / 2;
  if (avgMargin > 25) score += 20;
  else if (avgMargin > 15) score += 15;
  else if (avgMargin > 8) score += 10;
  else if (avgMargin > 0) score += 5;
  else score -= 10;

  // Revenue vs estimate beat (0-10 pts)
  if (metrics.revenueBeat !== null) {
    if (metrics.revenueBeat > 5) score += 10;
    else if (metrics.revenueBeat > 2) score += 7;
    else if (metrics.revenueBeat > 0) score += 4;
    else if (metrics.revenueBeat < -5) score -= 10;
    else if (metrics.revenueBeat < 0) score -= 5;
  }

  // Profit vs estimate beat (0-10 pts)
  if (metrics.profitBeat !== null) {
    if (metrics.profitBeat > 8) score += 10;
    else if (metrics.profitBeat > 3) score += 7;
    else if (metrics.profitBeat > 0) score += 4;
    else if (metrics.profitBeat < -8) score -= 10;
    else if (metrics.profitBeat < 0) score -= 5;
  }

  // Clamp score to [-100, 100]
  score = Math.max(-100, Math.min(100, score));

  const label = score >= 25 ? 'bullish'
    : score <= -25 ? 'bearish'
    : 'neutral';

  return { score, label };
}

// ─── Generate Executive Summary ────────────────────────────

/**
 * Generate a natural-language executive summary from earnings metrics.
 */
export function generateExecutiveSummary(metrics: EarningsMetrics, companyName: string): string {
  const parts: string[] = [];

  // Revenue
  const revDir = metrics.revenueGrowth >= 0 ? 'rose' : 'declined';
  parts.push(`${companyName} reported revenue of ₹${formatCr(metrics.revenue)} for the quarter, which ${revDir} ${Math.abs(metrics.revenueGrowth).toFixed(1)}% YoY.`);

  // Profit
  const profitDir = metrics.profitGrowth >= 0 ? 'rose' : 'declined';
  parts.push(`Net profit ${profitDir} ${Math.abs(metrics.profitGrowth).toFixed(1)}% YoY to ₹${formatCr(metrics.netProfit)}, with EPS of ₹${metrics.eps.toFixed(2)}.`);

  // Margins
  parts.push(`Operating margins stood at ${metrics.operatingMargin.toFixed(1)}% and net margins at ${metrics.netMargin.toFixed(1)}%.`);

  // EBITDA
  parts.push(`EBITDA came in at ₹${formatCr(metrics.ebitda)} with an EBITDA margin of ${metrics.ebitdaMargin.toFixed(1)}%.`);

  // Beat/Miss
  const beats: string[] = [];
  if (metrics.revenueBeat !== null) {
    const revBeatDir = metrics.revenueBeat >= 0 ? 'beat' : 'missed';
    beats.push(`Revenue ${revBeatDir} estimates by ${Math.abs(metrics.revenueBeat).toFixed(1)}%`);
  }
  if (metrics.profitBeat !== null) {
    const profBeatDir = metrics.profitBeat >= 0 ? 'beat' : 'missed';
    beats.push(`profit ${profBeatDir} estimates by ${Math.abs(metrics.profitBeat).toFixed(1)}%`);
  }
  if (beats.length > 0) {
    parts.push(`The company ${beats.join(' and ')}.`);
  }

  return parts.join(' ');
}

// ─── Key Takeaways Generator ───────────────────────────────

/**
 * Generate top 5 key takeaways from earnings metrics.
 */
export function generateKeyTakeaways(metrics: EarningsMetrics): string[] {
  const takeaways: string[] = [];

  // Revenue takeaway
  if (metrics.revenueGrowth > 15) {
    takeaways.push(`🚀 Strong revenue growth of ${metrics.revenueGrowth.toFixed(1)}% YoY, indicating robust demand.`);
  } else if (metrics.revenueGrowth > 5) {
    takeaways.push(`📈 Healthy revenue growth of ${metrics.revenueGrowth.toFixed(1)}% YoY.`);
  } else if (metrics.revenueGrowth > 0) {
    takeaways.push(`📊 Modest revenue growth of ${metrics.revenueGrowth.toFixed(1)}% YoY.`);
  } else {
    takeaways.push(`⚠️ Revenue declined ${Math.abs(metrics.revenueGrowth).toFixed(1)}% YoY — monitor demand trends.`);
  }

  // Profit takeaway
  if (metrics.profitGrowth > 20) {
    takeaways.push(`💰 Exceptional profit growth of ${metrics.profitGrowth.toFixed(1)}% YoY, driven by operational efficiency.`);
  } else if (metrics.profitGrowth > 0) {
    takeaways.push(`💵 Profit grew ${metrics.profitGrowth.toFixed(1)}% YoY.`);
  } else {
    takeaways.push(`🔻 Profit declined ${Math.abs(metrics.profitGrowth).toFixed(1)}% YoY — examine cost pressures.`);
  }

  // EPS takeaway
  if (metrics.epsGrowth > 15) {
    takeaways.push(`📊 EPS grew ${metrics.epsGrowth.toFixed(1)}% to ₹${metrics.eps.toFixed(2)} — strong shareholder value creation.`);
  } else if (metrics.epsGrowth > 0) {
    takeaways.push(`📊 EPS of ₹${metrics.eps.toFixed(2)} — up ${metrics.epsGrowth.toFixed(1)}% YoY.`);
  } else {
    takeaways.push(`📊 EPS declined to ₹${metrics.eps.toFixed(2)} — down ${Math.abs(metrics.epsGrowth).toFixed(1)}% YoY.`);
  }

  // Margin takeaway
  if (metrics.operatingMargin > 20) {
    takeaways.push(`🎯 Industry-leading operating margin of ${metrics.operatingMargin.toFixed(1)}%.`);
  } else if (metrics.operatingMargin > 10) {
    takeaways.push(`✅ Healthy operating margin of ${metrics.operatingMargin.toFixed(1)}%.`);
  } else if (metrics.operatingMargin > 0) {
    takeaways.push(`📉 Operating margin of ${metrics.operatingMargin.toFixed(1)}% — room for improvement.`);
  } else {
    takeaways.push(`⚠️ Negative operating margin of ${metrics.operatingMargin.toFixed(1)}% — profitability concern.`);
  }

  // Beat/Miss takeaway
  if (metrics.revenueBeat !== null && metrics.profitBeat !== null) {
    if (metrics.revenueBeat > 0 && metrics.profitBeat > 0) {
      takeaways.push(`🎯 Strong double beat — both revenue and profit exceeded analyst estimates.`);
    } else if (metrics.revenueBeat < 0 && metrics.profitBeat < 0) {
      takeaways.push(`⚠️ Double miss — both revenue and profit fell short of expectations.`);
    } else if (metrics.revenueBeat > 0) {
      takeaways.push(`📈 Revenue surpassed estimates by ${metrics.revenueBeat.toFixed(1)}%, though profit slightly missed.`);
    } else {
      takeaways.push(`📉 Revenue missed estimates by ${Math.abs(metrics.revenueBeat).toFixed(1)}%, but profit beat expectations.`);
    }
  }

  return takeaways.slice(0, 5);
}

// ─── Compute Historical Trend ──────────────────────────────

/**
 * Analyze revenue/profit trends over the last 4 quarters.
 */
export function computeHistoricalTrend(quarters: EarningsQuarter[]): {
  revenueTrend: 'growing' | 'declining' | 'volatile' | 'stable';
  profitTrend: 'growing' | 'declining' | 'volatile' | 'stable';
  revenueCagr: number;
  profitCagr: number;
  averageMargin: number;
} {
  if (quarters.length < 2) {
    return {
      revenueTrend: 'stable',
      profitTrend: 'stable',
      revenueCagr: 0,
      profitCagr: 0,
      averageMargin: quarters[0]?.margin ?? 0,
    };
  }

  const sorted = [...quarters].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const revenues = sorted.map(q => q.revenue);
  const profits = sorted.map(q => q.netProfit);
  const margins = sorted.map(q => q.margin);

  // Compute CAGR over the period
  const periods = sorted.length - 1;
  const firstRev = revenues[0];
  const lastRev = revenues[revenues.length - 1];
  const revenueCagr = firstRev > 0
    ? (Math.pow(lastRev / firstRev, 1 / periods) - 1) * 100
    : 0;

  const firstProfit = profits[0];
  const lastProfit = profits[profits.length - 1];
  const profitCagr = firstProfit > 0
    ? (Math.pow(lastProfit / firstProfit, 1 / periods) - 1) * 100
    : firstProfit < 0 && lastProfit > 0 ? 100
    : 0;

  const averageMargin = margins.reduce((s, m) => s + m, 0) / margins.length;

  // Determine trends using standard deviation
  const revMean = revenues.reduce((s, r) => s + r, 0) / revenues.length;
  const revVariance = revenues.reduce((s, r) => s + (r - revMean) ** 2, 0) / revenues.length;
  const revStdDev = Math.sqrt(revVariance);
  const revCv = safeDiv(revStdDev, revMean); // Coefficient of variation

  const profitMean = profits.reduce((s, p) => s + p, 0) / profits.length;
  const profitVariance = profits.reduce((s, p) => s + (p - profitMean) ** 2, 0) / profits.length;
  const profitStdDev = Math.sqrt(profitVariance);
  const profitCv = safeDiv(profitStdDev, profitMean);

  // Revenue trend
  const revenueTrend: 'growing' | 'declining' | 'volatile' | 'stable' =
    revCv > 0.3 ? 'volatile'
    : revenueCagr > 5 ? 'growing'
    : revenueCagr < -5 ? 'declining'
    : 'stable';

  // Profit trend
  const profitTrend: 'growing' | 'declining' | 'volatile' | 'stable' =
    profitCv > 0.5 ? 'volatile'
    : profitCagr > 8 ? 'growing'
    : profitCagr < -8 ? 'declining'
    : 'stable';

  return {
    revenueTrend,
    profitTrend,
    revenueCagr,
    profitCagr,
    averageMargin,
  };
}

// ─── Compare Peers ─────────────────────────────────────────

/**
 * Compare a company's earnings metrics against peers.
 * Returns peerComparison array sorted by revenue (descending).
 */
export function comparePeers(
  current: { symbol: string; name: string; revenue: number; profit: number; peRatio: number; revenueGrowth: number; profitGrowth: number },
  peers: { symbol: string; name: string; revenue: number; profit: number; peRatio: number; revenueGrowth: number; profitGrowth: number }[],
): EarningsSummary['peerComparison'] {
  const all = [current, ...peers];
  return all
    .sort((a, b) => b.revenue - a.revenue)
    .map(p => ({
      symbol: p.symbol,
      name: p.name,
      revenue: p.revenue,
      profit: p.profit,
      peRatio: p.peRatio,
      revenueGrowth: p.revenueGrowth,
      profitGrowth: p.profitGrowth,
    }));
}

// ─── Compute EPS from Net Profit & Shares ───────────────────

/**
 * Calculate EPS given net profit (in Cr) and shares outstanding (in Cr).
 */
export function computeEps(netProfitCr: number, sharesOutstandingCr: number): number {
  return safeDiv(netProfitCr * 10000000, sharesOutstandingCr * 10000000);
}

// ─── Main Analysis Function ────────────────────────────────

export interface EarningsInputData {
  symbol: string;
  companyName: string;
  date: string;
  revenue: number;           // Cr
  previousRevenue: number;   // Cr (same quarter last year)
  netProfit: number;         // Cr
  previousNetProfit: number; // Cr (same quarter last year)
  operatingProfit: number;   // Cr (EBIT)
  ebitda: number;            // Cr
  sharesOutstanding: number; // Cr
  revenueEstimate: number | null;   // Analyst estimate in Cr
  profitEstimate: number | null;    // Analyst estimate in Cr
  // Growth drivers & risks
  growthDrivers: string[];
  riskFactors: string[];
  managementHighlights: string[];
  // Peer data
  peers: {
    symbol: string;
    name: string;
    revenue: number;
    profit: number;
    peRatio: number;
    revenueGrowth: number;
    profitGrowth: number;
  }[];
  // Historical quarters
  historicalQuarters: EarningsQuarter[];
}

/**
 * Main entry point: analyze earnings data and produce a complete EarningsSummary.
 */
export function analyzeEarnings(input: EarningsInputData): EarningsSummary {
  const {
    symbol, companyName, date, revenue, previousRevenue,
    netProfit, previousNetProfit, operatingProfit, ebitda,
    sharesOutstanding, revenueEstimate, profitEstimate,
    growthDrivers, riskFactors, managementHighlights, peers, historicalQuarters,
  } = input;

  const revenueGrowth = computeGrowth(revenue, previousRevenue);
  const profitGrowth = computeGrowth(netProfit, previousNetProfit);
  const eps = computeEps(netProfit, sharesOutstanding);
  const previousEps = computeEps(previousNetProfit, sharesOutstanding);
  const epsGrowth = computeGrowth(eps, previousEps);
  const operatingMargin = safeDiv(operatingProfit, revenue) * 100;
  const netMargin = safeDiv(netProfit, revenue) * 100;
  const ebitdaMargin = safeDiv(ebitda, revenue) * 100;

  const revenueBeat = revenueEstimate !== null
    ? computeGrowth(revenue, revenueEstimate)
    : null;
  const profitBeat = profitEstimate !== null
    ? computeGrowth(netProfit, profitEstimate)
    : null;

  const metrics: EarningsMetrics = {
    revenue,
    revenueGrowth: Math.round(revenueGrowth * 100) / 100,
    netProfit,
    profitGrowth: Math.round(profitGrowth * 100) / 100,
    eps: Math.round(eps * 100) / 100,
    epsGrowth: Math.round(epsGrowth * 100) / 100,
    operatingMargin: Math.round(operatingMargin * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100,
    revenueBeat: revenueBeat !== null ? Math.round(revenueBeat * 100) / 100 : null,
    profitBeat: profitBeat !== null ? Math.round(profitBeat * 100) / 100 : null,
    ebitda: Math.round(ebitda * 100) / 100,
    ebitdaMargin: Math.round(ebitdaMargin * 100) / 100,
  };

  const sentiment = assessSentiment(metrics);
  const executiveSummary = generateExecutiveSummary(metrics, companyName);
  const keyTakeaways = generateKeyTakeaways(metrics);
  const peerComparison = comparePeers(
    { symbol, name: companyName, revenue, profit: netProfit, peRatio: 0, revenueGrowth, profitGrowth },
    peers,
  );

  return {
    id: `earnings_${symbol}_${date}`,
    symbol,
    companyName,
    quarter: getQuarterLabel(date),
    fiscalYear: getFiscalYear(date),
    date,
    metrics,
    peerComparison,
    historicalQuarters,
    managementHighlights,
    growthDrivers,
    riskFactors,
    analystConsensus: sentiment.score >= 40 ? 'strong_buy'
      : sentiment.score >= 15 ? 'buy'
      : sentiment.score >= -15 ? 'hold'
      : sentiment.score >= -40 ? 'sell'
      : 'strong_sell',
    analystTargetPrice: 0,
    analystTargetLow: 0,
    analystTargetHigh: 0,
    executiveSummary,
    keyTakeaways,
    sentimentScore: sentiment.score,
    sentimentLabel: sentiment.label,
    confidence: Math.min(95, 50 + Math.abs(sentiment.score) * 0.45),
    marketReaction: {
      preMarketChange: 0,
      dayChange: 0,
      volumeSurge: 0,
    },
    source: 'Toroloom AI Analysis',
  };
}
