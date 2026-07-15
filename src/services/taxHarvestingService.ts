/**
 * ============================================================================
 * Toroloom — Tax Harvesting Service
 * ============================================================================
 *
 * Analyzes trades and holdings to identify tax-loss harvesting opportunities
 * following Indian Income Tax rules (FY 2025-26):
 *
 *   - STCG: 15% on equity held ≤12 months
 *   - LTCG: 10% on gains exceeding ₹1L, held >12 months
 *   - Short-term losses can offset both STCG and LTCG
 *   - Long-term losses can only offset LTCG
 *   - Unused losses carry forward for 8 assessment years
 *   - Wash sale: Buying same/substantially-identical security within 30 days
 *     before or after the sale disallows the loss
 *
 * ============================================================================
 */

import type { Holding, Trade, RealizedLoss, TaxHarvestOpportunity, TaxYearSummary } from '../types';

// ==================== Constants ====================

const STCG_TAX_RATE = 0.15;
const LTCG_TAX_RATE = 0.10;
const LTCG_EXEMPTION = 100000;
const LONG_TERM_THRESHOLD_DAYS = 365;
const WASH_SALE_WINDOW_DAYS = 30;

// ==================== Helpers ====================

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

/** Infer sector from stock name (mirrors portfolioAnalyticsStore) */
function inferSector(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('bank') || n.includes('finance') || n.includes('bajaj') || n.includes('hdfc') || n.includes('icici')) return 'Finance';
  if (n.includes('tech') || n.includes('consultancy') || n.includes('infosys') || n.includes('wipro') || n.includes('tcs')) return 'Technology';
  if (n.includes('energy') || n.includes('reliance') || n.includes('oil') || n.includes('power')) return 'Energy';
  if (n.includes('consumer') || n.includes('unilever') || n.includes('itc') || n.includes('hul')) return 'Consumer';
  if (n.includes('auto') || n.includes('tata motor') || n.includes('maruti')) return 'Automobile';
  if (n.includes('telecom') || n.includes('airtel') || n.includes('idea')) return 'Telecom';
  if (n.includes('pharma') || n.includes('sun') || n.includes('cipla') || n.includes('dr. reddy')) return 'Pharma';
  if (n.includes('metal') || n.includes('tata steel') || n.includes('jsw') || n.includes('hindalco')) return 'Metals';
  return 'Others';
}

// ==================== Core Analysis ====================

/**
 * Analyze all trades to extract realized losses (both STCG and LTCG).
 */
export function computeRealizedLosses(trades: Trade[]): RealizedLoss[] {
  const losses: RealizedLoss[] = [];
  const sellTrades = trades.filter(t => t.type === 'sell');

  for (const sell of sellTrades) {
    // Find corresponding buy trade
    const buyTrade = trades.find(t => t.symbol === sell.symbol && t.type === 'buy');
    if (!buyTrade) continue;

    const holdDays = daysBetween(buyTrade.timestamp, sell.timestamp);
    const avgBuyPrice = buyTrade.price;
    const pnl = sell.quantity * (sell.price - avgBuyPrice);

    // Only record losses
    if (pnl >= 0) continue;

    const holdingType = holdDays <= LONG_TERM_THRESHOLD_DAYS ? 'short_term' : 'long_term';

    losses.push({
      tradeId: sell.id,
      symbol: sell.symbol,
      name: sell.name,
      loss: Math.abs(pnl),
      date: sell.timestamp,
      holdingType,
      holdingDays: holdDays,
      quantity: sell.quantity,
    });
  }

  // Sort by loss magnitude descending
  return losses.sort((a, b) => b.loss - a.loss);
}

/**
 * Identify tax-loss harvesting opportunities from current holdings.
 */
export function findHarvestOpportunities(
  holdings: Holding[],
  trades: Trade[],
): TaxHarvestOpportunity[] {
  const opportunities: TaxHarvestOpportunity[] = [];
  const now = new Date();

  for (const h of holdings) {
    // Only look at holdings with unrealized losses
    if (h.pnl >= 0) continue;

    // Find the first buy trade for this stock to determine holding period
    const buyTrade = trades.find(t => t.symbol === h.symbol && t.type === 'buy');
    const holdingDays = buyTrade ? daysBetween(buyTrade.timestamp, now.toISOString()) : 0;
    const daysToLT = Math.max(0, LONG_TERM_THRESHOLD_DAYS - holdingDays);

    const lossPercent = Math.abs(h.pnlPercent);
    const unrealizedLoss = Math.abs(h.pnl);

    // Determine harvesting recommendation
    let recommendation: 'harvest_now' | 'wait_long_term' | 'avoid';
    let offsetsType: 'long_term_only' | 'both';
    let potentialTaxSaved: number;

    if (holdingDays <= LONG_TERM_THRESHOLD_DAYS) {
      // Short-term holding: selling now realizes STCL which offsets both STCG and LTCG
      recommendation = 'harvest_now';
      offsetsType = 'both';
      // Tax saved = loss * STCG rate (maximum benefit)
      potentialTaxSaved = unrealizedLoss * STCG_TAX_RATE;
    } else if (unrealizedLoss > 50000) {
      // Already long-term: selling realizes LTCL which only offsets LTCG
      recommendation = 'harvest_now';
      offsetsType = 'long_term_only';
      potentialTaxSaved = unrealizedLoss * LTCG_TAX_RATE;
    } else {
      recommendation = 'avoid';
      offsetsType = 'long_term_only';
      potentialTaxSaved = unrealizedLoss * LTCG_TAX_RATE;
    }

    // Check wash sale risk: did we buy this stock within the last 30 days?
    const recentBuys = trades.filter(t =>
      t.symbol === h.symbol && t.type === 'buy' &&
      daysBetween(t.timestamp, now.toISOString()) <= WASH_SALE_WINDOW_DAYS
    );
    const washSaleRisk = recentBuys.length > 0;

    // Priority score: combination of loss size, tax saved, and urgency
    const lossFactor = Math.min(unrealizedLoss / 50000, 1);
    const taxFactor = Math.min(potentialTaxSaved / 10000, 1);
    const urgencyFactor = recommendation === 'harvest_now' ? 1 : 0;
    const washPenalty = washSaleRisk ? 0.3 : 0;
    const priorityScore = Math.round(
      (lossFactor * 40 + taxFactor * 35 + urgencyFactor * 25) * (1 - washPenalty),
    );

    opportunities.push({
      id: `ho_${h.id}`,
      symbol: h.symbol,
      name: h.name,
      unrealizedLoss: Math.round(unrealizedLoss * 100) / 100,
      lossPercent: Math.round(lossPercent * 100) / 100,
      quantity: h.quantity,
      buyPrice: h.buyPrice,
      currentPrice: h.currentPrice,
      daysToLongTerm: daysToLT,
      holdingDays,
      potentialTaxSaved: Math.round(potentialTaxSaved * 100) / 100,
      offsetsType,
      washSaleRisk,
      recommendation,
      priorityScore,
      sector: inferSector(h.name),
    });
  }

  return opportunities.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Compute comprehensive tax year summary with harvesting insights.
 */
export function computeTaxYearSummary(
  holdings: Holding[],
  trades: Trade[],
): TaxYearSummary {
  const opportunities = findHarvestOpportunities(holdings, trades);
  const realizedLosses = computeRealizedLosses(trades);

  // Compute current-year realized gains from sell trades
  const sellTrades = trades.filter(t => t.type === 'sell');
  let shortTermGains = 0;
  let longTermGains = 0;

  for (const sell of sellTrades) {
    const buyTrade = trades.find(t => t.symbol === sell.symbol && t.type === 'buy');
    if (!buyTrade) continue;
    const holdDays = daysBetween(buyTrade.timestamp, sell.timestamp);
    const avgBuyPrice = buyTrade.price;
    const pnl = sell.quantity * (sell.price - avgBuyPrice);

    if (holdDays <= LONG_TERM_THRESHOLD_DAYS) {
      shortTermGains += pnl;
    } else {
      longTermGains += pnl;
    }
  }

  // Total realized losses
  const totalRealizedLosses = realizedLosses.reduce((s, r) => s + r.loss, 0);

  // Calculate potential tax savings from harvesting opportunities
  const harvestableOpportunities = opportunities.filter(o => o.recommendation === 'harvest_now');
  const totalHarvestableLoss = harvestableOpportunities.reduce((s, o) => s + o.unrealizedLoss, 0);
  const totalEstimatedTaxSavings = harvestableOpportunities.reduce((s, o) => s + o.potentialTaxSaved, 0);

  // Apply losses: ST losses offset gains first, then LT losses
  const stLosses = realizedLosses.filter(r => r.holdingType === 'short_term')
    .reduce((s, r) => s + r.loss, 0);
  const ltLosses = realizedLosses.filter(r => r.holdingType === 'long_term')
    .reduce((s, r) => s + r.loss, 0);

  // ST losses can offset any gains; LT losses only offset LTCG
  const remainingStGains = Math.max(0, shortTermGains - stLosses);
  const remainingLtGainsBeforeLtLoss = Math.max(0, longTermGains - ltLosses);

  // Still remaining LTCG? Apply ₹1L exemption
  const taxableLtcg = Math.max(0, remainingLtGainsBeforeLtLoss - LTCG_EXEMPTION);
  const remainingStLoss = Math.max(0, stLosses - shortTermGains);
  const remainingLtLoss = Math.max(0, ltLosses - longTermGains);

  // Tax liability after harvesting
  const stcgTax = Math.max(0, remainingStGains) * STCG_TAX_RATE;
  const ltcgTax = taxableLtcg * LTCG_TAX_RATE;
  const estimatedTaxLiability = Math.round((stcgTax + ltcgTax) * 100) / 100;

  // Generate insights
  const insights: string[] = [];

  if (totalHarvestableLoss > 0) {
    insights.push(
      `You have ${harvestableOpportunities.length} tax-harvesting opportunities worth ₹${(totalHarvestableLoss / 1000).toFixed(1)}K in unrealized losses.`,
    );
  }

  if (stLosses > 0) {
    insights.push(
      `₹${(stLosses / 1000).toFixed(1)}K in short-term losses can offset both STCG and LTCG — maximum flexibility.`,
    );
  }

  if (ltLosses > 0) {
    insights.push(
      `₹${(ltLosses / 1000).toFixed(1)}K in long-term losses can offset LTCG only.`,
    );
  }

  if (shortTermGains > 0 && totalHarvestableLoss > 0) {
    insights.push(
      `Harvesting all candidate losses could reduce your tax bill by ₹${(totalEstimatedTaxSavings / 1000).toFixed(1)}K.`,
    );
  }

  if (remainingStLoss > 0) {
    insights.push(
      `₹${(remainingStLoss / 1000).toFixed(1)}K in unutilized short-term losses can be carried forward for up to 8 years.`,
    );
  }

  if (remainingLtLoss > 0) {
    insights.push(
      `₹${(remainingLtLoss / 1000).toFixed(1)}K in unutilized long-term losses can be carried forward for up to 8 years (LTCG offset only).`,
    );
  }

  if (longTermGains > 0 && longTermGains <= LTCG_EXEMPTION) {
    insights.push(
      `Your LTCG (₹${(longTermGains / 1000).toFixed(1)}K) is within the ₹1L exemption — no tax due!`,
    );
  }

  if (taxableLtcg <= 0 && remainingStGains <= 0 && totalHarvestableLoss > 0) {
    insights.push(
      `Your realized gains are fully offset by losses. Consider harvesting additional losses for carry-forward.`,
    );
  }

  // Check if any holdings are approaching the 1-year boundary
  const nearLT = opportunities.filter(o => o.daysToLongTerm > 0 && o.daysToLongTerm <= 90);
  if (nearLT.length > 0 && totalHarvestableLoss > 0) {
    insights.push(
      `${nearLT.length} holding(s) approaching the 1-year LTCG boundary. Consider harvesting before they become long-term for maximum flexibility.`,
    );
  }

  // Wash sale warnings
  const washSales = opportunities.filter(o => o.washSaleRisk);
  if (washSales.length > 0) {
    insights.push(
      `${washSales.length} opportunity(ies) flagged for wash sale risk — you've bought these stocks in the last 30 days. Wait 31 days to harvest.`,
    );
  }

  return {
    fiscalYear: getCurrentFiscalYear(),
    shortTermGains,
    longTermGains,
    totalRealizedLosses: Math.round(totalRealizedLosses * 100) / 100,
    taxableLtcg: Math.round(taxableLtcg * 100) / 100,
    estimatedTaxSavings: Math.round(totalEstimatedTaxSavings * 100) / 100,
    estimatedTaxLiability,
    realizedLosses,
    opportunities,
    insights,
  };
}

/** Get the current Indian financial year string (e.g. "FY 2025-26") */
export function getCurrentFiscalYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  // Indian FY: April to March
  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `FY ${fyStart}-${fyEnd.toString().slice(2)}`;
}

/**
 * Generate mock trade data for demo/empty state.
 */
export function generateMockTrades(): Trade[] {
  const now = Date.now();
  const DAY = 86400000;

  return [
    { id: 't1', stockId: 's1', symbol: 'RELIANCE', name: 'Reliance Industries', type: 'buy', quantity: 50, price: 2850, total: 142500, timestamp: new Date(now - 400 * DAY).toISOString() },
    { id: 't2', stockId: 's1', symbol: 'RELIANCE', name: 'Reliance Industries', type: 'sell', quantity: 20, price: 2690, total: 53800, timestamp: new Date(now - 100 * DAY).toISOString() },
    { id: 't3', stockId: 's2', symbol: 'TCS', name: 'Tata Consultancy Services', type: 'buy', quantity: 30, price: 3850, total: 115500, timestamp: new Date(now - 500 * DAY).toISOString() },
    { id: 't4', stockId: 's2', symbol: 'TCS', name: 'Tata Consultancy Services', type: 'sell', quantity: 15, price: 4050, total: 60750, timestamp: new Date(now - 50 * DAY).toISOString() },
    { id: 't5', stockId: 's3', symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'buy', quantity: 100, price: 1650, total: 165000, timestamp: new Date(now - 300 * DAY).toISOString() },
    { id: 't6', stockId: 's3', symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'sell', quantity: 40, price: 1580, total: 63200, timestamp: new Date(now - 60 * DAY).toISOString() },
    { id: 't7', stockId: 's4', symbol: 'INFY', name: 'Infosys', type: 'buy', quantity: 80, price: 1520, total: 121600, timestamp: new Date(now - 600 * DAY).toISOString() },
    { id: 't8', stockId: 's4', symbol: 'INFY', name: 'Infosys', type: 'sell', quantity: 30, price: 1680, total: 50400, timestamp: new Date(now - 30 * DAY).toISOString() },
    { id: 't9', stockId: 's5', symbol: 'WIPRO', name: 'Wipro', type: 'buy', quantity: 200, price: 520, total: 104000, timestamp: new Date(now - 90 * DAY).toISOString() },
    { id: 't10', stockId: 's6', symbol: 'ITC', name: 'ITC', type: 'buy', quantity: 150, price: 480, total: 72000, timestamp: new Date(now - 200 * DAY).toISOString() },
    { id: 't11', stockId: 's6', symbol: 'ITC', name: 'ITC', type: 'sell', quantity: 50, price: 445, total: 22250, timestamp: new Date(now - 10 * DAY).toISOString() },
    { id: 't12', stockId: 's7', symbol: 'BHARTIARTL', name: 'Bharti Airtel', type: 'buy', quantity: 60, price: 890, total: 53400, timestamp: new Date(now - 30 * DAY).toISOString() },
    { id: 't13', stockId: 's5', symbol: 'WIPRO', name: 'Wipro', type: 'sell', quantity: 80, price: 490, total: 39200, timestamp: new Date(now - 10 * DAY).toISOString() },
    { id: 't14', stockId: 's8', symbol: 'MARUTI', name: 'Maruti Suzuki', type: 'buy', quantity: 25, price: 10400, total: 260000, timestamp: new Date(now - 450 * DAY).toISOString() },
    { id: 't15', stockId: 's8', symbol: 'MARUTI', name: 'Maruti Suzuki', type: 'sell', quantity: 10, price: 9850, total: 98500, timestamp: new Date(now - 20 * DAY).toISOString() },
  ];
}

/**
 * Generate mock holdings for demo/empty state.
 */
export function generateMockHoldings(): Holding[] {
  const now = Date.now();
  const DAY = 86400000;

  return [
    { id: 'h1', stockId: 's1', symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 30, buyPrice: 2850, currentPrice: 2690, totalInvested: 85500, currentValue: 80700, pnl: -4800, pnlPercent: -5.61, dayChange: -120, dayChangePercent: -0.15 },
    { id: 'h2', stockId: 's2', symbol: 'TCS', name: 'Tata Consultancy Services', quantity: 15, buyPrice: 3850, currentPrice: 4050, totalInvested: 57750, currentValue: 60750, pnl: 3000, pnlPercent: 5.19, dayChange: 85, dayChangePercent: 0.14 },
    { id: 'h3', stockId: 's3', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 60, buyPrice: 1650, currentPrice: 1580, totalInvested: 99000, currentValue: 94800, pnl: -4200, pnlPercent: -4.24, dayChange: -95, dayChangePercent: -0.10 },
    { id: 'h4', stockId: 's4', symbol: 'INFY', name: 'Infosys', quantity: 50, buyPrice: 1520, currentPrice: 1680, totalInvested: 76000, currentValue: 84000, pnl: 8000, pnlPercent: 10.53, dayChange: 120, dayChangePercent: 0.14 },
    { id: 'h5', stockId: 's5', symbol: 'WIPRO', name: 'Wipro', quantity: 120, buyPrice: 520, currentPrice: 490, totalInvested: 62400, currentValue: 58800, pnl: -3600, pnlPercent: -5.77, dayChange: -45, dayChangePercent: -0.09 },
    { id: 'h6', stockId: 's6', symbol: 'ITC', name: 'ITC', quantity: 100, buyPrice: 480, currentPrice: 445, totalInvested: 48000, currentValue: 44500, pnl: -3500, pnlPercent: -7.29, dayChange: -30, dayChangePercent: -0.07 },
    { id: 'h7', stockId: 's7', symbol: 'BHARTIARTL', name: 'Bharti Airtel', quantity: 60, buyPrice: 890, currentPrice: 955, totalInvested: 53400, currentValue: 57300, pnl: 3900, pnlPercent: 7.30, dayChange: 55, dayChangePercent: 0.06 },
    { id: 'h8', stockId: 's8', symbol: 'MARUTI', name: 'Maruti Suzuki', quantity: 15, buyPrice: 10400, currentPrice: 9850, totalInvested: 156000, currentValue: 147750, pnl: -8250, pnlPercent: -5.29, dayChange: -180, dayChangePercent: -0.18 },
  ];
}
