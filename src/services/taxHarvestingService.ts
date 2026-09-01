/**
 * ============================================================================
 * Toroloom — Tax Harvesting Service
 * ============================================================================
 *
 * Core logic for tax-loss harvesting:
 *   - Scan holdings for unrealized losses (harvest opportunities)
 *   - Compute realized losses from closed trades
 *   - Generate tax year summary with estimated savings
 *   - Wash-sale detection (30-day rule)
 *   - Priority scoring for opportunities
 *
 * Indian tax rules (FY 2025-26):
 *   - STCG: taxed at slab rate (~30% for most traders)
 *   - LTCG: 12.5% above ₹1.25L exemption
 *   - STCL offsets both STCG + LTCG
 *   - LTCL offsets only LTCG
 *   - Losses can be carried forward 8 assessment years
 * ============================================================================
 */

import type {
  Holding,
  Trade,
  TaxHarvestOpportunity,
  RealizedLoss,
  TaxYearSummary,
} from '../types';

// ─── Tax Constants (FY 2025-26) ───────────────────────────────────────────

const STCG_RATE = 0.20; // 20% for listed equity (slab rate approximation)
const LTCG_RATE = 0.125; // 12.5% for listed equity
const LTCG_EXEMPTION = 125_000; // ₹1.25L exemption per year
const LONG_TERM_DAYS = 365; // 1 year for equity
const WASH_SALE_DAYS = 30; // 30-day wash sale window
const CURRENT_FY = 'FY 2025-26';

// ─── Helpers ───────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(b).getTime() - new Date(a).getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Compute Realized Losses from Trades ──────────────────────────────────

export function computeRealizedLosses(trades: Trade[]): RealizedLoss[] {
  const losses: RealizedLoss[] = [];

  // Group trades by symbol to match buy/sell pairs
  const buyTrades = trades.filter(t => t.type === 'buy');
  const sellTrades = trades.filter(t => t.type === 'sell');

  for (const sell of sellTrades) {
    // Find a matching buy trade (FIFO matching)
    const matchingBuy = buyTrades.find(
      b => b.stockId === sell.stockId && b.quantity >= sell.quantity
    );

    if (!matchingBuy) continue;

    const pnl = (sell.price - matchingBuy.price) * sell.quantity;
    if (pnl >= 0) continue; // Not a loss

    const holdingDays = daysBetween(matchingBuy.timestamp, sell.timestamp);
    const holdingType: 'short_term' | 'long_term' =
      holdingDays > LONG_TERM_DAYS ? 'long_term' : 'short_term';

    losses.push({
      tradeId: sell.id,
      symbol: sell.symbol,
      name: sell.name,
      loss: Math.abs(pnl),
      date: sell.timestamp,
      holdingType,
      holdingDays,
      quantity: sell.quantity,
    });

    // Reduce available buy quantity
    matchingBuy.quantity -= sell.quantity;
  }

  return losses.sort((a, b) => b.loss - a.loss);
}

// ─── Find Harvest Opportunities from Holdings ─────────────────────────────

export function findHarvestOpportunities(
  holdings: Holding[],
  trades: Trade[],
): TaxHarvestOpportunity[] {
  const opportunities: TaxHarvestOpportunity[] = [];
  const now = new Date();

  for (const h of holdings) {
    // Only consider holdings with unrealized losses
    if (h.pnl >= 0) continue;

    const unrealizedLoss = Math.abs(h.pnl);
    const lossPercent = h.pnlPercent; // Already negative
    const holdingDays = daysBetween(h.buyPrice > 0 ? now.toISOString() : now.toISOString(), now.toISOString());
    const daysToLongTerm = Math.max(0, LONG_TERM_DAYS - holdingDays);

    // Check wash sale risk: look for a buy trade within 30 days before/after today
    const washSaleRisk = checkWashSaleRisk(h.stockId, trades, now);

    // Calculate potential tax saved
    const isLongTerm = holdingDays > LONG_TERM_DAYS;
    const potentialTaxSaved = isLongTerm
      ? unrealizedLoss * LTCG_RATE // Would offset LTCG
      : unrealizedLoss * STCG_RATE; // Would offset STCG (higher rate)

    // Determine recommendation
    let recommendation: TaxHarvestOpportunity['recommendation'];
    if (washSaleRisk) {
      recommendation = 'avoid';
    } else if (daysToLongTerm <= 30 && unrealizedLoss < 5000) {
      // Close to long-term + small loss → wait
      recommendation = 'wait_long_term';
    } else if (daysToLongTerm > 90 && unrealizedLoss > 10000) {
      // Far from long-term + large loss → harvest now
      recommendation = 'harvest_now';
    } else if (unrealizedLoss > 15000) {
      recommendation = 'harvest_now';
    } else if (daysToLongTerm <= 60) {
      recommendation = 'wait_long_term';
    } else {
      recommendation = 'harvest_now';
    }

    // Priority score: higher = better opportunity
    // Factors: loss magnitude, days to LTCG, wash sale risk
    const lossScore = clamp((unrealizedLoss / 50000) * 50, 0, 50); // 50% weight
    const timeScore = clamp(((LONG_TERM_DAYS - daysToLongTerm) / LONG_TERM_DAYS) * 30, 0, 30); // 30% weight
    const washPenalty = washSaleRisk ? -30 : 0;
    const priorityScore = Math.round(clamp(lossScore + timeScore + washPenalty + 20, 0, 100));

    // Determine which gains this loss can offset
    const offsetsType: TaxHarvestOpportunity['offsetsType'] = isLongTerm
      ? 'long_term_only'
      : 'both';

    opportunities.push({
      id: `th_${h.stockId}_${Date.now()}`,
      symbol: h.symbol,
      name: h.name,
      unrealizedLoss,
      lossPercent: Math.abs(lossPercent),
      quantity: h.quantity,
      buyPrice: h.buyPrice,
      currentPrice: h.currentPrice,
      daysToLongTerm,
      holdingDays,
      potentialTaxSaved,
      offsetsType,
      washSaleRisk,
      recommendation,
      priorityScore,
      sector: guessSector(h.symbol),
    });
  }

  return opportunities.sort((a, b) => b.priorityScore - a.priorityScore);
}

// ─── Compute Tax Year Summary ──────────────────────────────────────────────

export function computeTaxYearSummary(
  holdings: Holding[],
  trades: Trade[],
): TaxYearSummary {
  const realizedLosses = computeRealizedLosses(trades);
  const opportunities = findHarvestOpportunities(holdings, trades);

  // Calculate gains from sell trades
  const buyTrades = trades.filter(t => t.type === 'buy');
  const sellTrades = trades.filter(t => t.type === 'sell');

  let shortTermGains = 0;
  let longTermGains = 0;

  for (const sell of sellTrades) {
    const matchingBuy = buyTrades.find(
      b => b.stockId === sell.stockId && b.quantity >= sell.quantity
    );
    if (!matchingBuy) continue;

    const pnl = (sell.price - matchingBuy.price) * sell.quantity;
    if (pnl <= 0) continue; // Skip losses

    const holdingDays = daysBetween(matchingBuy.timestamp, sell.timestamp);
    if (holdingDays > LONG_TERM_DAYS) {
      longTermGains += pnl;
    } else {
      shortTermGains += pnl;
    }

    matchingBuy.quantity -= sell.quantity;
  }

  const totalRealizedLosses = realizedLosses.reduce((s, r) => s + r.loss, 0);

  // Taxable LTCG after ₹1.25L exemption
  const taxableLtcg = Math.max(0, longTermGains - LTCG_EXEMPTION);

  // STCG tax (can be offset by STCL)
  const stclTotal = realizedLosses
    .filter(r => r.holdingType === 'short_term')
    .reduce((s, r) => s + r.loss, 0);
  const ltclTotal = realizedLosses
    .filter(r => r.holdingType === 'long_term')
    .reduce((s, r) => s + r.loss, 0);

  const netStcg = Math.max(0, shortTermGains - stclTotal);
  const stcgTax = netStcg * STCG_RATE;

  const netLtcg = Math.max(0, taxableLtcg - ltclTotal);
  const netLtcgTax = netLtcg * LTCG_RATE;

  const estimatedTaxLiability = stcgTax + netLtcgTax;

  // Estimate potential tax savings from harvesting
  const totalPotentialSavings = opportunities
    .filter(o => o.recommendation === 'harvest_now')
    .reduce((s, o) => s + o.potentialTaxSaved, 0);

  const estimatedTaxSavings = totalPotentialSavings;

  // Generate insights
  const insights: string[] = [];

  if (opportunities.length > 0) {
    const harvestNowCount = opportunities.filter(o => o.recommendation === 'harvest_now').length;
    if (harvestNowCount > 0) {
      insights.push(
        `${harvestNowCount} holding${harvestNowCount > 1 ? 's' : ''} with significant unrealized losses should be harvested before March 31 to offset your capital gains tax.`
      );
    }
  }

  if (totalRealizedLosses > 0) {
    insights.push(
      `You've realized ₹${(totalRealizedLosses / 1000).toFixed(1)}K in losses this FY. These can be carried forward for 8 years if unused.`
    );
  }

  const washSaleCount = opportunities.filter(o => o.washSaleRisk).length;
  if (washSaleCount > 0) {
    insights.push(
      `⚠️ ${washSaleCount} holding${washSaleCount > 1 ? 's have' : ' has'} wash sale risk — you bought within 30 days. Selling now may disallow the loss deduction.`
    );
  }

  if (shortTermGains > 0 && longTermGains === 0) {
    insights.push(
      'All gains are short-term (taxed at slab rate). Consider holding profitable positions >1 year for lower LTCG rate (12.5%).'
    );
  }

  if (longTermGains > LTCG_EXEMPTION * 0.8) {
    insights.push(
      `Your LTCG is approaching the ₹1.25L exemption limit. Consider harvesting losses to stay under the threshold.`
    );
  }

  if (insights.length === 0) {
    insights.push('Your tax position looks optimized. No urgent harvesting opportunities found.');
  }

  return {
    fiscalYear: CURRENT_FY,
    shortTermGains,
    longTermGains,
    totalRealizedLosses,
    taxableLtcg,
    estimatedTaxSavings,
    estimatedTaxLiability,
    realizedLosses,
    opportunities,
    insights,
  };
}

// ─── Wash Sale Detection ──────────────────────────────────────────────────

function checkWashSaleRisk(
  stockId: string,
  trades: Trade[],
  _now: Date,
): boolean {
  // Look for buy trades within the wash sale window
  const washWindowMs = WASH_SALE_DAYS * 24 * 60 * 60 * 1000;
  const recentBuys = trades.filter(
    t =>
      t.type === 'buy' &&
      t.stockId === stockId &&
      Math.abs(Date.now() - new Date(t.timestamp).getTime()) < washWindowMs
  );

  return recentBuys.length > 0;
}

// ─── Sector Guess (mock mapping for Indian stocks) ────────────────────────

function guessSector(symbol: string): string {
  const sectorMap: Record<string, string> = {
    RELIANCE: 'Energy',
    TCS: 'Technology',
    INFY: 'Technology',
    HDFCBANK: 'Finance',
    ICICIBANK: 'Finance',
    SBIN: 'Finance',
    BHARTIARTL: 'Telecom',
    ITC: 'Consumer',
    KOTAKBANK: 'Finance',
    LT: 'Infrastructure',
    AXISBANK: 'Finance',
    WIPRO: 'Technology',
    ASIANPAINT: 'Consumer',
    MARUTI: 'Automobile',
    HCLTECH: 'Technology',
    SUNPHARMA: 'Pharma',
    TATAMOTORS: 'Automobile',
    TATASTEEL: 'Metals',
    NTPC: 'Energy',
    POWERGRID: 'Energy',
    ONGC: 'Energy',
    COALINDIA: 'Mining',
    ULTRACEMCO: 'Cement',
    NESTLEIND: 'Consumer',
    BAJFINANCE: 'Finance',
    TITAN: 'Consumer',
    TECHM: 'Technology',
    INDUSINDBK: 'Finance',
    DRREDDY: 'Pharma',
    DIVISLAB: 'Pharma',
  };

  return sectorMap[symbol] || 'Other';
}

// ─── Mock Data Generators (for demo when no real holdings) ────────────────

export function generateMockHoldings(): Holding[] {
  return [
    {
      id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries',
      quantity: 15, buyPrice: 2650, currentPrice: 2380,
      totalInvested: 39750, currentValue: 35700,
      pnl: -4050, pnlPercent: -10.19, dayChange: -45, dayChangePercent: -1.06,
    },
    {
      id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services',
      quantity: 8, buyPrice: 4200, currentPrice: 3850,
      totalInvested: 33600, currentValue: 30800,
      pnl: -2800, pnlPercent: -8.33, dayChange: -120, dayChangePercent: -3.02,
    },
    {
      id: 'h3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank',
      quantity: 20, buyPrice: 1550, currentPrice: 1720,
      totalInvested: 31000, currentValue: 34400,
      pnl: 3400, pnlPercent: 10.97, dayChange: 35, dayChangePercent: 2.08,
    },
    {
      id: 'h4', stockId: 'ITC', symbol: 'ITC', name: 'ITC Limited',
      quantity: 50, buyPrice: 475, currentPrice: 415,
      totalInvested: 23750, currentValue: 20750,
      pnl: -3000, pnlPercent: -12.63, dayChange: -12, dayChangePercent: -2.81,
    },
    {
      id: 'h5', stockId: 'SBIN', symbol: 'SBIN', name: 'State Bank of India',
      quantity: 40, buyPrice: 820, currentPrice: 750,
      totalInvested: 32800, currentValue: 30000,
      pnl: -2800, pnlPercent: -8.54, dayChange: -18, dayChangePercent: -2.34,
    },
    {
      id: 'h6', stockId: 'INFY', symbol: 'INFY', name: 'Infosys',
      quantity: 12, buyPrice: 1800, currentPrice: 1650,
      totalInvested: 21600, currentValue: 19800,
      pnl: -1800, pnlPercent: -8.33, dayChange: -30, dayChangePercent: -1.79,
    },
    {
      id: 'h7', stockId: 'BHARTIARTL', symbol: 'BHARTIARTL', name: 'Bharti Airtel',
      quantity: 18, buyPrice: 1200, currentPrice: 1380,
      totalInvested: 21600, currentValue: 24840,
      pnl: 3240, pnlPercent: 15.0, dayChange: 25, dayChangePercent: 1.84,
    },
    {
      id: 'h8', stockId: 'TATAMOTORS', symbol: 'TATAMOTORS', name: 'Tata Motors',
      quantity: 30, buyPrice: 680, currentPrice: 580,
      totalInvested: 20400, currentValue: 17400,
      pnl: -3000, pnlPercent: -14.71, dayChange: -22, dayChangePercent: -3.65,
    },
  ];
}

export function generateMockTrades(): Trade[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return [
    // Realized losses (sell trades with buy matching)
    {
      id: 't1', stockId: 'WIPRO', symbol: 'WIPRO', name: 'Wipro',
      type: 'sell', quantity: 25, price: 380, total: 9500,
      timestamp: new Date(now - 30 * day).toISOString(),
    },
    {
      id: 't1b', stockId: 'WIPRO', symbol: 'WIPRO', name: 'Wipro',
      type: 'buy', quantity: 25, price: 420, total: 10500,
      timestamp: new Date(now - 120 * day).toISOString(),
    },
    {
      id: 't2', stockId: 'AXISBANK', symbol: 'AXISBANK', name: 'Axis Bank',
      type: 'sell', quantity: 15, price: 950, total: 14250,
      timestamp: new Date(now - 60 * day).toISOString(),
    },
    {
      id: 't2b', stockId: 'AXISBANK', symbol: 'AXISBANK', name: 'Axis Bank',
      type: 'buy', quantity: 15, price: 1050, total: 15750,
      timestamp: new Date(now - 200 * day).toISOString(),
    },
    // A profitable sell (to show in realized gains)
    {
      id: 't3', stockId: 'BAJFINANCE', symbol: 'BAJFINANCE', name: 'Bajaj Finance',
      type: 'sell', quantity: 5, price: 7200, total: 36000,
      timestamp: new Date(now - 45 * day).toISOString(),
    },
    {
      id: 't3b', stockId: 'BAJFINANCE', symbol: 'BAJFINANCE', name: 'Bajaj Finance',
      type: 'buy', quantity: 5, price: 6500, total: 32500,
      timestamp: new Date(now - 300 * day).toISOString(),
    },
  ];
}
