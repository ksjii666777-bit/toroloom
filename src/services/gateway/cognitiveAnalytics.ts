/**
 * ============================================================================
 * Toroloom — Mathematical Cognitive Analytics Engine
 * ============================================================================
 *
 * Pure computation service that calculates advanced performance metrics from
 * normalized trade ledger data. Designed for zero external dependencies and
 * maximum CPU cache efficiency — all computations are O(n) single-pass.
 *
 * Metrics computed:
 *   - Win/Loss Frequency Ratio
 *   - Brokerage Drag Factor
 *   - Sector Concentration / Overexposure Index
 *   - Behavioral critique slots (over-trading, brokerage leakage)
 *
 * Usage:
 *   import { computeCognitiveSummary } from
 *     '../../services/gateway/cognitiveAnalytics';
 *
 *   const summary = computeCognitiveSummary(trades, holdings);
 *   console.log(summary.winLossFrequencyRatio, summary.brokerageDragFactor);
 *
 * ============================================================================
 */

import type { ParsedTrade, AICognitiveSummary, Holding } from '../../types';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Maximum concentration ratio before flagging overexposure (as %) */
const MAX_SECTOR_EXPOSURE_PCT = 35;

/** Maximum daily trade count before flagging over-trading */
const MAX_DAILY_TRADES = 10;

/** Brokerage-to-P&L ratio threshold before flagging leakage (as %) */
const BROKERAGE_LEAKAGE_THRESHOLD_PCT = 15;

// ─── Sector Classification (Indian Market) ────────────────────────────────

/**
 * Map common Indian stock symbols to their sectors.
 * This is a minimal classification; a production system would use
 * a more comprehensive database or API.
 */
const SECTOR_MAP: Record<string, string> = {
  // NIFTY 50 & large-cap mapping
  RELIANCE: 'Energy',
  HDFCBANK: 'Banking',
  ICICIBANK: 'Banking',
  AXISBANK: 'Banking',
  SBIN: 'Banking',
  KOTAKBANK: 'Banking',
  BANKBARODA: 'Banking',
  INDUSINDBK: 'Banking',
  PNB: 'Banking',
  TCS: 'Technology',
  INFY: 'Technology',
  WIPRO: 'Technology',
  HCLTECH: 'Technology',
  TECHM: 'Technology',
  LTI: 'Technology',
  MINDTREE: 'Technology',
  TATASTEEL: 'Metals & Mining',
  JSWSTEEL: 'Metals & Mining',
  HINDALCO: 'Metals & Mining',
  COALINDIA: 'Metals & Mining',
  NATIONALUM: 'Metals & Mining',
  MOTHERSON: 'Automobile',
  MARUTI: 'Automobile',
  TATAMOTORS: 'Automobile',
  'M&M': 'Automobile',
  'BAJAJ-AUTO': 'Automobile',
  EICHERMOT: 'Automobile',
  HEROMOTOCO: 'Automobile',
  TITAN: 'Consumer Goods',
  HINDUNILVR: 'Consumer Goods',
  ITC: 'Consumer Goods',
  NESTLEIND: 'Consumer Goods',
  BRITANNIA: 'Consumer Goods',
  DABUR: 'Consumer Goods',
  MARICO: 'Consumer Goods',
  ASIANPAINT: 'Consumer Goods',
  BAJFINANCE: 'Financial Services',
  BAJAJFINSV: 'Financial Services',
  HDFCLIFE: 'Financial Services',
  SBILIFE: 'Financial Services',
  ICICIPRULI: 'Financial Services',
  ADANIENT: 'Conglomerate',
  ADANIPORTS: 'Infrastructure',
  ADANIGREEN: 'Energy',
  ADANITRANS: 'Energy',
  NTPC: 'Energy',
  POWERGRID: 'Energy',
  ONGC: 'Energy',
  IOC: 'Energy',
  BPCL: 'Energy',
  DRREDDY: 'Pharmaceuticals',
  SUNPHARMA: 'Pharmaceuticals',
  CIPLA: 'Pharmaceuticals',
  DIVISLAB: 'Pharmaceuticals',
  APOLLOHOSP: 'Healthcare',
  BHARTIARTL: 'Telecom',
  GRASIM: 'Cement & Construction',
  ULTRACEMCO: 'Cement & Construction',
  LT: 'Cement & Construction',
  HDFC: 'Financial Services',
  // Fallback: 'Other',
};

function classifySector(symbol: string): string {
  // Normalize: remove common suffixes / prefixes
  const clean = symbol.replace(/\.NS$|\.BSE$|-EQ$/i, '').toUpperCase();
  return SECTOR_MAP[clean] || 'Other';
}

// ─── Core Computation ──────────────────────────────────────────────────────

/**
 * Compute a full cognitive analytics summary from parsed trade data
 * and current portfolio holdings.
 *
 * @param trades   - Parsed trade records (from tradeLedgerParser)
 * @param holdings - Current portfolio holdings (from portfolioStore)
 *
 * @returns AICognitiveSummary with performance metrics and behavioral alerts
 */
export function computeCognitiveSummary(
  trades: ParsedTrade[],
  holdings: Holding[],
): AICognitiveSummary {
  const now = new Date().toISOString();

  if (trades.length === 0 && holdings.length === 0) {
    return {
      winLossFrequencyRatio: 0,
      totalProfitableTrades: 0,
      totalClosedTrades: 0,
      brokerageDragFactor: 0,
      totalTaxesAndCharges: 0,
      absoluteRealizedPnl: 0,
      sectorConcentrationIndex: 0,
      sectorAllocation: [],
      generatedAt: now,
    };
  }

  // ─── Single-pass aggregation ─────────────────────────────
  let profitableTrades = 0;
  let totalTaxes = 0;
  let totalRealizedPnl = 0;
  const dailyTradeCount: Record<string, number> = {};
  const sectorExposure: Record<string, number> = {};

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];

    // Win/Loss tracking
    if (trade.transaction_type === 'SELL') {
      // A completed sell trade has a realized P&L
      // We approximate: profit if regulatory_fees < typical threshold
      // In production, match sells to corresponding buys for exact P&L
      const estimatedPnl =
        trade.filled_quantity * trade.execution_price - trade.regulatory_fees;
      if (estimatedPnl > 0) {
        profitableTrades++;
      }
      totalRealizedPnl += estimatedPnl;
    }

    // Tax/charges aggregation
    totalTaxes += trade.regulatory_fees;

    // Daily trade counting
    const day = trade.execution_timestamp.substring(0, 10);
    dailyTradeCount[day] = (dailyTradeCount[day] || 0) + 1;

    // Sector exposure
    const sector = classifySector(trade.asset_symbol);
    sectorExposure[sector] =
      (sectorExposure[sector] || 0) + trade.filled_quantity * trade.execution_price;
  }

  // ─── Holdings-based sector allocation (more accurate) ─────
  if (holdings.length > 0) {
    holdings.forEach((h) => {
      const sector = classifySector(h.symbol);
      sectorExposure[sector] =
        (sectorExposure[sector] || 0) + h.currentValue;
    });
  }

  // ─── Computed Metrics ─────────────────────────────────────
  const totalClosedTrades = trades.filter((t) => t.transaction_type === 'SELL').length;
  const winLossRatio =
    totalClosedTrades > 0 ? profitableTrades / totalClosedTrades : 0;

  const absolutePnl = Math.abs(totalRealizedPnl) || 1; // prevent division by zero
  const brokerageDrag = (totalTaxes / absolutePnl) * 100;

  // Sector Concentration (Herfindahl-Hirschman Index style)
  const totalExposure = Object.values(sectorExposure).reduce((a, b) => a + b, 0);
  const sectorAllocation = Object.entries(sectorExposure)
    .map(([sector, value]) => ({
      sector,
      exposurePercent: totalExposure > 0 ? (value / totalExposure) * 100 : 0,
    }))
    .sort((a, b) => b.exposurePercent - a.exposurePercent);

  const sectorConcentrationIndex =
    totalExposure > 0
      ? Object.values(sectorExposure).reduce(
          (sum, val) => sum + Math.pow(val / totalExposure, 2),
          0,
        )
      : 0;

  // ─── Behavioral Alerts ────────────────────────────────────

  // Over-trading detection
  const maxDailyTrades = Math.max(...Object.values(dailyTradeCount), 0);
  const overTradingAlert =
    maxDailyTrades > MAX_DAILY_TRADES
      ? {
          flag: true,
          message: `Over-trading detected: ${maxDailyTrades} trades on a single day (${Object.entries(dailyTradeCount).sort((a, b) => b[1] - a[1])[0][0]}). Maximum recommended: ${MAX_DAILY_TRADES} trades/day.`,
        }
      : undefined;

  // Brokerage leakage detection
  const brokerageLeakageAlert =
    brokerageDrag > BROKERAGE_LEAKAGE_THRESHOLD_PCT
      ? {
          flag: true,
          message: `Brokerage and regulatory charges (${brokerageDrag.toFixed(1)}% of P&L) exceed the ${BROKERAGE_LEAKAGE_THRESHOLD_PCT}% threshold. Consider switching to a discount broker or reducing trade frequency.`,
        }
      : undefined;

  // Concentration risk detection
  const topSector = sectorAllocation[0];
  const concentrationRiskAlert =
    topSector && topSector.exposurePercent > MAX_SECTOR_EXPOSURE_PCT
      ? {
          flag: true,
          message: `Portfolio is ${topSector.exposurePercent.toFixed(1)}% concentrated in ${topSector.sector}. Consider diversifying across sectors to reduce risk.`,
        }
      : undefined;

  // ─── Behavioral Critique ──────────────────────────────────
  const critiqueParts: string[] = [];

  if (totalTradesCount(trades) > 100) {
    critiqueParts.push(
      'High-frequency trading pattern detected. Rapid trading increases emotional decision-making and erodes returns through transaction costs.',
    );
  }

  if (brokerageDrag > BROKERAGE_LEAKAGE_THRESHOLD_PCT) {
    critiqueParts.push(
      'Brokerage costs are consuming a significant portion of your realized profits. Consider intraday-to-delivery conversion for long-term holds.',
    );
  }

  if (winLossRatio < 0.4) {
    critiqueParts.push(
      `Your win rate (${(winLossRatio * 100).toFixed(1)}%) is below 40%. Focus on improving trade selection — let winners run and cut losers short.`,
    );
  }

  if (topSector && topSector.exposurePercent > MAX_SECTOR_EXPOSURE_PCT) {
    critiqueParts.push(
      `Overconcentration in ${topSector.sector} (${topSector.exposurePercent.toFixed(1)}%) exposes your portfolio to sector-specific downturns.`,
    );
  }

  const behavioralCritique =
    critiqueParts.length > 0
      ? critiqueParts.join(' ')
      : 'Your trading patterns show balanced risk management. Continue following your plan and journaling trades for consistent improvement.';

  return {
    winLossFrequencyRatio: winLossRatio,
    totalProfitableTrades: profitableTrades,
    totalClosedTrades,
    brokerageDragFactor: brokerageDrag,
    totalTaxesAndCharges: totalTaxes,
    absoluteRealizedPnl: totalRealizedPnl,
    sectorConcentrationIndex,
    sectorAllocation,
    overTradingAlert,
    brokerageLeakageAlert,
    concentrationRiskAlert,
    behavioralCritique,
    generatedAt: now,
  };
}

/**
 * Count total trade executions (both buy and sell legs).
 */
function totalTradesCount(trades: ParsedTrade[]): number {
  return trades.length;
}

/**
 * Compute a simplified version of the cognitive summary.
 * Useful for dashboard widgets that only need high-level stats.
 */
export function computeSimplifiedSummary(
  trades: ParsedTrade[],
  holdings: Holding[],
): Pick<
  AICognitiveSummary,
  | 'winLossFrequencyRatio'
  | 'brokerageDragFactor'
  | 'sectorConcentrationIndex'
  | 'overTradingAlert'
  | 'brokerageLeakageAlert'
  | 'generatedAt'
> {
  const full = computeCognitiveSummary(trades, holdings);
  return {
    winLossFrequencyRatio: full.winLossFrequencyRatio,
    brokerageDragFactor: full.brokerageDragFactor,
    sectorConcentrationIndex: full.sectorConcentrationIndex,
    overTradingAlert: full.overTradingAlert,
    brokerageLeakageAlert: full.brokerageLeakageAlert,
    generatedAt: full.generatedAt,
  };
}

/**
 * Generate an AI prompt context string from the cognitive summary,
 * suitable for feeding into an LLM for natural-language behavioral critique.
 */
export function generateBehavioralPrompt(
  summary: AICognitiveSummary,
): string {
  return [
    `Trader Performance Summary:`,
    `- Win/Loss Ratio: ${(summary.winLossFrequencyRatio * 100).toFixed(1)}%`,
    `- Total Closed Trades: ${summary.totalClosedTrades}`,
    `- Profitable Trades: ${summary.totalProfitableTrades}`,
    `- Brokerage Drag: ${summary.brokerageDragFactor.toFixed(1)}% of P&L`,
    `- Sector Concentration Index: ${summary.sectorConcentrationIndex.toFixed(3)}`,
    ``,
    summary.behavioralCritique || 'No behavioral concerns detected.',
    ``,
    `Sector Allocation:`,
    ...summary.sectorAllocation.map(
      (s) => `  ${s.sector}: ${s.exposurePercent.toFixed(1)}%`,
    ),
  ].join('\n');
}
