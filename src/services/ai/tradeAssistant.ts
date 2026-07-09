/**
 * ============================================================================
 * Toroloom — AI Trade Assistant Engine
 * ============================================================================
 *
 * Pure computation service that provides intelligent trade recommendations:
 *   - Position sizing (based on risk tolerance & account size)
 *   - Risk assessment per trade
 *   - Stop-loss & target price suggestions
 *   - Portfolio impact analysis
 *
 * All functions are pure — no side effects, no external dependencies.
 * Suitable for both UI and backend use.
 *
 * Usage:
 *   import { assessTradeRisk, suggestPositionSize } from
 *     '../../services/ai/tradeAssistant';
 *
 *   const risk = assessTradeRisk(stock, 100, 'buy', portfolio);
 *   const sizing = suggestPositionSize(availableBalance, 0.02, stock.price);
 * ============================================================================
 */

import type { Stock, Holding } from '../../types';

// ─── Risk Tolerance Profiles ───────────────────────────────────────────────

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

export interface RiskProfile {
  /** Max % of portfolio to risk per trade (1-100) */
  maxRiskPerTradePct: number;
  /** Max position size as % of total portfolio */
  maxPositionSizePct: number;
  /** Typical stop-loss % from entry */
  stopLossPct: number;
  /** Risk/reward ratio target */
  minRewardRiskRatio: number;
  /** Max leverage (1 = no leverage) */
  maxLeverage: number;
  /** Max daily loss as % of portfolio */
  maxDailyLossPct: number;
  /** Max number of open positions */
  maxOpenPositions: number;
}

export const RISK_PROFILES: Record<RiskTolerance, RiskProfile> = {
  conservative: {
    maxRiskPerTradePct: 1,
    maxPositionSizePct: 10,
    stopLossPct: 3,
    minRewardRiskRatio: 2.5,
    maxLeverage: 1,
    maxDailyLossPct: 2,
    maxOpenPositions: 8,
  },
  moderate: {
    maxRiskPerTradePct: 2,
    maxPositionSizePct: 20,
    stopLossPct: 5,
    minRewardRiskRatio: 2,
    maxLeverage: 2,
    maxDailyLossPct: 4,
    maxOpenPositions: 12,
  },
  aggressive: {
    maxRiskPerTradePct: 5,
    maxPositionSizePct: 35,
    stopLossPct: 8,
    minRewardRiskRatio: 1.5,
    maxLeverage: 3,
    maxDailyLossPct: 8,
    maxOpenPositions: 20,
  },
};

// ─── Position Sizing ───────────────────────────────────────────────────────

export interface PositionSizingResult {
  /** Recommended number of shares/lots */
  suggestedQuantity: number;
  /** Total cost of the position */
  totalCost: number;
  /** % of available balance used */
  balanceUsagePct: number;
  /** % of total portfolio value */
  portfolioUsagePct: number;
  /** ₹ amount at risk if stop-loss hits */
  riskAmount: number;
  /** % of portfolio at risk */
  portfolioRiskPct: number;
  /** Whether this fits within risk profile */
  withinRiskLimits: boolean;
  /** Warnings if any limits are exceeded */
  warnings: string[];
  /** Alternative suggestions */
  alternatives: { quantity: number; label: string }[];
}

/**
 * Suggest optimal position size given portfolio context and risk tolerance.
 */
export function suggestPositionSize(params: {
  stockPrice: number;
  availableBalance: number;
  totalPortfolioValue: number;
  riskTolerance: RiskTolerance;
  openPositionsCount: number;
  stopLossPercent?: number;
}): PositionSizingResult {
  const {
    stockPrice,
    availableBalance,
    totalPortfolioValue,
    riskTolerance,
    openPositionsCount,
    stopLossPercent,
  } = params;

  const profile = RISK_PROFILES[riskTolerance];
  const warnings: string[] = [];

  // Max by balance
  const maxByBalance = Math.floor(availableBalance / stockPrice);

  // Max by portfolio allocation %
  const maxByAllocation = Math.floor(
    (totalPortfolioValue * (profile.maxPositionSizePct / 100)) / stockPrice,
  );

  // Max by risk (stop-loss %)
  const slPct = stopLossPercent ?? profile.stopLossPct;
  const maxRiskAmount = totalPortfolioValue * (profile.maxRiskPerTradePct / 100);
  const maxByRisk = slPct > 0
    ? Math.floor(maxRiskAmount / (stockPrice * (slPct / 100)))
    : maxByBalance;

  // Suggested quantity = min of all constraints
  const suggestedQuantity = Math.max(1, Math.min(maxByBalance, maxByAllocation, maxByRisk));
  const totalCost = suggestedQuantity * stockPrice;

  // Check limits
  const exceedsAllocation = totalCost > totalPortfolioValue * (profile.maxPositionSizePct / 100);
  const exceedsRisk = (totalCost * (slPct / 100)) > maxRiskAmount;
  const exceedsPositions = openPositionsCount >= profile.maxOpenPositions;
  const withinRiskLimits = !exceedsAllocation && !exceedsRisk && !exceedsPositions;

  if (exceedsAllocation) {
    warnings.push(`Position exceeds max allocation of ${profile.maxPositionSizePct}% of portfolio`);
  }
  if (exceedsRisk) {
    warnings.push(`Risk amount exceeds max ${profile.maxRiskPerTradePct}% risk per trade`);
  }
  if (exceedsPositions) {
    warnings.push(`Already at max ${profile.maxOpenPositions} open positions`);
  }
  if (availableBalance < totalCost) {
    warnings.push('Insufficient available balance');
  }

  // Alternatives
  const alternatives = [
    { quantity: suggestedQuantity, label: 'Recommended' },
  ];
  if (Math.floor(maxByBalance * 0.5) > 0) {
    alternatives.push({ quantity: Math.floor(maxByBalance * 0.5), label: 'Conservative (50%)' });
  }
  if (Math.floor(maxByBalance * 1.5) > suggestedQuantity) {
    alternatives.push({
      quantity: Math.min(Math.floor(maxByBalance * 1.5), maxByBalance),
      label: 'Aggressive (150%)',
    });
  }

  const portfolioUsagePct = totalPortfolioValue > 0
    ? (totalCost / totalPortfolioValue) * 100 : 0;
  const riskAmount = totalCost * (slPct / 100);
  const portfolioRiskPct = totalPortfolioValue > 0
    ? (riskAmount / totalPortfolioValue) * 100 : 0;

  return {
    suggestedQuantity,
    totalCost,
    balanceUsagePct: availableBalance > 0 ? (totalCost / availableBalance) * 100 : 0,
    portfolioUsagePct,
    riskAmount,
    portfolioRiskPct,
    withinRiskLimits,
    warnings,
    alternatives,
  };
}

// ─── Risk Assessment ───────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme';

export interface RiskAssessmentResult {
  /** Overall risk level */
  riskLevel: RiskLevel;
  /** Risk score 0-100 (0 = safest, 100 = riskiest) */
  riskScore: number;
  /** Breakdown of risk factors */
  factors: RiskFactor[];
  /** Overall assessment summary */
  summary: string;
  /** Suggestions to reduce risk */
  suggestions: string[];
}

export interface RiskFactor {
  name: string;
  score: number; // 0-100 where higher = riskier
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

/**
 * Assess the risk of a potential trade given market and portfolio context.
 */
export function assessTradeRisk(params: {
  stock: Stock;
  tradeType: 'buy' | 'sell';
  quantity: number;
  price: number;
  holdings: Holding[];
  availableBalance: number;
  riskTolerance: RiskTolerance;
}): RiskAssessmentResult {
  const { stock, tradeType, quantity, price, holdings, availableBalance, riskTolerance } = params;
  const profile = RISK_PROFILES[riskTolerance];
  const factors: RiskFactor[] = [];
  const suggestions: string[] = [];

  // 1. Position size vs portfolio
  const totalPortfolio = holdings.reduce((s, h) => s + h.currentValue, 0) + availableBalance;
  const positionCost = quantity * price;
  const sizeRatio = totalPortfolio > 0 ? (positionCost / totalPortfolio) * 100 : 0;

  if (sizeRatio > profile.maxPositionSizePct) {
    factors.push({
      name: 'Position Size',
      score: 90,
      impact: 'negative',
      description: `Position (${sizeRatio.toFixed(1)}% of portfolio) exceeds ${profile.maxPositionSizePct}% max allocation`,
    });
    suggestions.push(`Reduce position size to under ${profile.maxPositionSizePct}% of your portfolio`);
  } else if (sizeRatio > profile.maxPositionSizePct * 0.7) {
    factors.push({
      name: 'Position Size',
      score: 60,
      impact: 'negative',
      description: `Position is ${sizeRatio.toFixed(1)}% of portfolio — approaching max limit`,
    });
  } else {
    factors.push({
      name: 'Position Size',
      score: 20,
      impact: 'positive',
      description: `Position is only ${sizeRatio.toFixed(1)}% of portfolio — well within limits`,
    });
  }

  // 2. Stock volatility (using 52-week range as proxy)
  const priceRange = stock.high52 - stock.low52;
  const volatilityPct = stock.low52 > 0 ? (priceRange / stock.low52) * 100 : 30;
  const volScore = Math.min(100, Math.round(volatilityPct * 1.5));

  if (volScore > 70) {
    factors.push({
      name: 'Stock Volatility',
      score: volScore,
      impact: 'negative',
      description: `${stock.symbol} has high volatility (52W range: ${volatilityPct.toFixed(0)}%)`,
    });
    suggestions.push('Use wider stop-loss or reduce position size for high-volatility stocks');
  } else if (volScore > 40) {
    factors.push({
      name: 'Stock Volatility',
      score: volScore,
      impact: 'neutral',
      description: `${stock.symbol} has moderate volatility (52W range: ${volatilityPct.toFixed(0)}%)`,
    });
  } else {
    factors.push({
      name: 'Stock Volatility',
      score: volScore,
      impact: 'positive',
      description: `${stock.symbol} has low volatility (52W range: ${volatilityPct.toFixed(0)}%)`,
    });
  }

  // 3. Sector concentration
  const sectorTotal = holdings
    .filter(h => {
      // Map stockId to sector — use known stocks
      const s = holdings.find(hh => hh.stockId === stock.id) ? stock.sector : '';
      return s === stock.sector;
    })
    .reduce((s, h) => s + h.currentValue, 0);

  const sectorExposurePct = totalPortfolio > 0
    ? ((sectorTotal + (stock.id === stock.id ? positionCost : 0)) / totalPortfolio) * 100
    : sizeRatio;

  if (sectorExposurePct > 35) {
    factors.push({
      name: 'Sector Concentration',
      score: 80,
      impact: 'negative',
      description: `${stock.sector} exposure would be ${sectorExposurePct.toFixed(1)}% — overconcentrated`,
    });
    suggestions.push(`Consider reducing exposure to ${stock.sector} sector to under 35%`);
  } else if (sectorExposurePct > 25) {
    factors.push({
      name: 'Sector Concentration',
      score: 50,
      impact: 'neutral',
      description: `${stock.sector} exposure at ${sectorExposurePct.toFixed(1)}%`,
    });
  } else {
    factors.push({
      name: 'Sector Concentration',
      score: 15,
      impact: 'positive',
      description: `${stock.sector} exposure at ${sectorExposurePct.toFixed(1)}% — well diversified`,
    });
  }

  // 4. Balance sufficiency
  if (tradeType === 'buy') {
    if (positionCost > availableBalance) {
      factors.push({
        name: 'Available Balance',
        score: 95,
        impact: 'negative',
        description: `Need ₹${(positionCost - availableBalance).toLocaleString()} more than available`,
      });
      suggestions.push(`Insufficient balance. Available: ₹${availableBalance.toLocaleString()}`);
    } else if (positionCost > availableBalance * 0.8) {
      factors.push({
        name: 'Available Balance',
        score: 50,
        impact: 'neutral',
        description: `Using ${((positionCost / availableBalance) * 100).toFixed(0)}% of available balance`,
      });
    } else {
      factors.push({
        name: 'Available Balance',
        score: 10,
        impact: 'positive',
        description: `Using only ${((positionCost / availableBalance) * 100).toFixed(0)}% of available balance`,
      });
    }
  }

  // 5. P/E ratio valuation (rough check)
  const industryAvgPE = 25; // Rough Nifty average
  const peDeviation = stock.pe > 0 ? Math.abs((stock.pe - industryAvgPE) / industryAvgPE) * 100 : 50;
  if (stock.pe > 0 && peDeviation > 60) {
    factors.push({
      name: 'Valuation (P/E)',
      score: Math.min(100, Math.round(peDeviation)),
      impact: 'negative',
      description: `${stock.symbol} P/E of ${stock.pe.toFixed(1)} is ${peDeviation.toFixed(0)}% above industry avg`,
    });
  } else if (stock.pe > 0 && peDeviation > 30) {
    factors.push({
      name: 'Valuation (P/E)',
      score: Math.min(70, Math.round(peDeviation)),
      impact: 'neutral',
      description: `${stock.symbol} P/E of ${stock.pe.toFixed(1)} moderately above average`,
    });
  } else if (stock.pe > 0) {
    factors.push({
      name: 'Valuation (P/E)',
      score: 15,
      impact: 'positive',
      description: `${stock.symbol} P/E of ${stock.pe.toFixed(1)} is reasonable`,
    });
  }

  // Calculate overall risk score
  const totalScore = factors.reduce((s, f) => s + f.score, 0);
  const avgScore = factors.length > 0 ? Math.round(totalScore / factors.length) : 50;

  let riskLevel: RiskLevel;
  if (avgScore <= 25) riskLevel = 'low';
  else if (avgScore <= 50) riskLevel = 'moderate';
  else if (avgScore <= 75) riskLevel = 'high';
  else riskLevel = 'extreme';

  const summary = generateRiskSummary(riskLevel, riskTolerance, stock.symbol);

  return {
    riskLevel,
    riskScore: avgScore,
    factors,
    summary,
    suggestions,
  };
}

function generateRiskSummary(
  riskLevel: RiskLevel,
  _tolerance: RiskTolerance,
  symbol: string,
): string {
  switch (riskLevel) {
    case 'low':
      return `✅ ${symbol} trade looks well-calibrated. Risk parameters within safe limits.`;
    case 'moderate':
      return `⚠️ ${symbol} trade has moderate risk. Consider position sizing or stop-loss review.`;
    case 'high':
      return `🔴 ${symbol} trade is high risk. Strongly consider reducing position size or setting tighter stop-loss.`;
    case 'extreme':
      return `🚨 ${symbol} trade carries extreme risk. Review all parameters before proceeding.`;
  }
}

// ─── Stop-Loss & Target Suggestions ────────────────────────────────────────

export interface StopLossSuggestion {
  /** Suggested stop-loss price */
  stopLossPrice: number;
  /** Stop-loss as % below entry */
  stopLossPercent: number;
  /** ₹ amount at risk */
  riskAmount: number;
  /** Type of stop-loss strategy */
  strategy: 'tight' | 'moderate' | 'wide' | 'technical';
  /** Rationale for this suggestion */
  rationale: string;
}

export interface TargetSuggestion {
  /** Target price */
  targetPrice: number;
  /** Return % from entry */
  returnPercent: number;
  /** Risk/Reward ratio */
  riskRewardRatio: number;
  /** Probability estimate (rough) */
  probability: string;
  /** Type of target */
  type: 'conservative' | 'moderate' | 'stretch';
}

export interface TradePlan {
  stopLoss: StopLossSuggestion;
  targets: TargetSuggestion[];
  riskRewardScore: number;
  recommendation: string;
}

/**
 * Generate stop-loss and target suggestions based on stock data.
 */
export function suggestTradePlan(params: {
  stock: Stock;
  tradeType: 'buy' | 'sell';
  entryPrice: number;
  riskTolerance: RiskTolerance;
}): TradePlan {
  const { stock, tradeType, entryPrice, riskTolerance } = params;
  const profile = RISK_PROFILES[riskTolerance];

  // Determine technical levels from 52-week range
  const range = stock.high52 - stock.low52;

  // For buy: SL below entry, targets above
  const isBuy = tradeType === 'buy';

  // Stop-loss strategies
  const slModerate = isBuy
    ? entryPrice * (1 - profile.stopLossPct / 100)
    : entryPrice * (1 + profile.stopLossPct / 100);

  // Technical stop using 52-week low/high
  const slTechnical = isBuy
    ? Math.min(entryPrice * 0.93, stock.low52 * 0.98)
    : Math.max(entryPrice * 1.07, stock.high52 * 1.02);

  const slTight = isBuy
    ? entryPrice * (1 - (profile.stopLossPct * 0.5) / 100)
    : entryPrice * (1 + (profile.stopLossPct * 0.5) / 100);

  const slWide = isBuy
    ? entryPrice * (1 - (profile.stopLossPct * 1.5) / 100)
    : entryPrice * (1 + (profile.stopLossPct * 1.5) / 100);

  // Pick the best stop-loss based on profile
  const stopLossStrategies: StopLossSuggestion[] = [
    {
      stopLossPrice: slTight,
      stopLossPercent: profile.stopLossPct * 0.5,
      riskAmount: Math.abs(entryPrice - slTight),
      strategy: 'tight',
      rationale: 'Conservative stop for capital preservation',
    },
    {
      stopLossPrice: slModerate,
      stopLossPercent: profile.stopLossPct,
      riskAmount: Math.abs(entryPrice - slModerate),
      strategy: 'moderate',
      rationale: `Standard ${profile.stopLossPct}% stop-loss based on ${riskTolerance} profile`,
    },
    {
      stopLossPrice: slWide,
      stopLossPercent: profile.stopLossPct * 1.5,
      riskAmount: Math.abs(entryPrice - slWide),
      strategy: 'wide',
      rationale: 'Wider stop to avoid noise in volatile stocks',
    },
    {
      stopLossPrice: slTechnical,
      stopLossPercent: Math.abs((entryPrice - slTechnical) / entryPrice) * 100,
      riskAmount: Math.abs(entryPrice - slTechnical),
      strategy: 'technical',
      rationale: `Based on 52-week ${isBuy ? 'low' : 'high'} of ₹${isBuy ? stock.low52 : stock.high52}`,
    },
  ];

  // Use moderate as the default
  const defaultSL = stopLossStrategies[1];
  const slAmount = Math.abs(entryPrice - defaultSL.stopLossPrice);

  // Target levels
  const riskReward = profile.minRewardRiskRatio;
  const targets: TargetSuggestion[] = [];

  // Conservative target
  const t1Mult = isBuy ? riskReward : riskReward;
  const t1Price = isBuy
    ? entryPrice + slAmount * t1Mult
    : entryPrice - slAmount * t1Mult;
  if (isBuy ? t1Price > entryPrice : t1Price < entryPrice) {
    targets.push({
      targetPrice: Math.round(t1Price * 100) / 100,
      returnPercent: Math.abs((t1Price - entryPrice) / entryPrice) * 100,
      riskRewardRatio: t1Mult,
      probability: '75%',
      type: 'conservative',
    });
  }

  // Moderate target (2x risk)
  const t2Mult = isBuy ? riskReward * 1.5 : riskReward * 1.5;
  const t2Price = isBuy
    ? entryPrice + slAmount * t2Mult
    : entryPrice - slAmount * t2Mult;
  if (isBuy ? t2Price > entryPrice : t2Price < entryPrice) {
    targets.push({
      targetPrice: Math.round(t2Price * 100) / 100,
      returnPercent: Math.abs((t2Price - entryPrice) / entryPrice) * 100,
      riskRewardRatio: t2Mult,
      probability: '50%',
      type: 'moderate',
    });
  }

  // Stretch target
  const t3Mult = isBuy ? riskReward * 3 : riskReward * 3;
  const t3Price = isBuy
    ? entryPrice + slAmount * t3Mult
    : entryPrice - slAmount * t3Mult;
  if (isBuy ? t3Price > entryPrice : t3Price < entryPrice) {
    targets.push({
      targetPrice: Math.round(t3Price * 100) / 100,
      returnPercent: Math.abs((t3Price - entryPrice) / entryPrice) * 100,
      riskRewardRatio: t3Mult,
      probability: '25%',
      type: 'stretch',
    });
  }

  // Recommendation
  let recommendation: string;
  const bestRR = targets.length > 0 ? targets[0].riskRewardRatio : 0;
  if (bestRR >= profile.minRewardRiskRatio && profile.stopLossPct <= 5) {
    recommendation = `Good risk/reward setup with ${bestRR.toFixed(1)}:1 ratio. Consider placing order with ${isBuy ? 'target' : 'stop-loss'} orders.`;
  } else if (bestRR >= 1) {
    recommendation = `Acceptable risk/reward but consider waiting for better entry to improve ratio above ${profile.minRewardRiskRatio}:1.`;
  } else {
    recommendation = `Risk/reward ratio is below 1:1. Consider skipping this trade or setting a better entry price.`;
  }

  return {
    stopLoss: defaultSL,
    targets,
    riskRewardScore: Math.round(bestRR * 10),
    recommendation,
  };
}

// ─── Portfolio Impact Analysis ─────────────────────────────────────────────

export interface PortfolioImpact {
  /** Estimated portfolio value after trade */
  newPortfolioValue: number;
  /** Change in portfolio allocation % */
  allocationChange: number;
  /** New cash balance */
  newBalance: number;
  /** % of portfolio now in this position */
  positionWeight: number;
  /** Updated sector exposure */
  sectorExposure: { sector: string; percent: number }[];
  /** Diversification score 0-100 */
  diversificationScore: number;
  /** Warnings */
  warnings: string[];
}

/**
 * Analyze how a trade would impact the current portfolio.
 */
export function analyzePortfolioImpact(params: {
  stockSymbol: string;
  stockSector: string;
  tradeType: 'buy' | 'sell';
  quantity: number;
  price: number;
  holdings: Holding[];
  availableBalance: number;
}): PortfolioImpact {
  const { stockSymbol, stockSector, tradeType, quantity, price, holdings, availableBalance } = params;
  const warnings: string[] = [];
  const positionCost = quantity * price;

  // Current portfolio value
  const currentHoldingsValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const currentPortfolioValue = currentHoldingsValue + availableBalance;

  // New values after trade
  let newHoldingValue: number;
  let newBalance: number;
  let newPortfolioValue: number;

  if (tradeType === 'buy') {
    newHoldingValue = currentHoldingsValue + positionCost;
    newBalance = availableBalance - positionCost;
    newPortfolioValue = currentPortfolioValue + positionCost; // adds to portfolio
  } else {
    // Sell — reduce holdings
    const existingHolding = holdings.find(h => h.stockId === stockSymbol);
    const sellingValue = existingHolding
      ? Math.min(positionCost, existingHolding.currentValue)
      : 0;
    newHoldingValue = currentHoldingsValue - sellingValue;
    newBalance = availableBalance + sellingValue;
    newPortfolioValue = currentPortfolioValue;
  }

  // Position weight
  const positionWeight = newPortfolioValue > 0
    ? ((tradeType === 'buy' ? positionCost : 0) / newPortfolioValue) * 100
    : 0;

  // Sector exposure after trade
  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    // Estimate sector — use stockSector since we're trading this stock
    if (h.stockId === stockSymbol) {
      sectorMap.set(stockSector, (sectorMap.get(stockSector) || 0) +
        (tradeType === 'buy' ? h.currentValue + positionCost : h.currentValue - positionCost));
    } else {
      sectorMap.set(stockSector, (sectorMap.get(stockSector) || 0) + h.currentValue);
    }
  }

  // Add the new position's sector
  if (tradeType === 'buy') {
    sectorMap.set(stockSector, (sectorMap.get(stockSector) || 0) + positionCost);
  }

  const sectorExposure = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      percent: newPortfolioValue > 0 ? (value / newPortfolioValue) * 100 : 0,
    }))
    .sort((a, b) => b.percent - a.percent);

  // Diversification score (based on number of sectors and concentration)
  const sectorCount = sectorExposure.length;
  const maxSectorPct = sectorExposure.length > 0 ? sectorExposure[0].percent : 100;
  const diversificationScore = Math.round(
    Math.min(100, Math.max(0,
      (sectorCount / 5) * 50 + (1 - maxSectorPct / 100) * 50,
    )),
  );

  if (positionWeight > 20) {
    warnings.push(`This position would be ${positionWeight.toFixed(1)}% of your portfolio — consider lower allocation`);
  }
  if (newBalance < 0) {
    warnings.push(`Insufficient balance: need ₹${Math.abs(newBalance).toLocaleString()} more`);
  }
  if (tradeType === 'buy' && diversificationScore < 40) {
    warnings.push('Portfolio is concentrated in few sectors — adding more may increase risk');
  }

  return {
    newPortfolioValue,
    allocationChange: positionWeight,
    newBalance,
    positionWeight,
    sectorExposure,
    diversificationScore,
    warnings,
  };
}
