/**
 * ============================================================================
 * Toroloom — AI Trade Assistant Engine Tests
 * ============================================================================
 *
 * Tests for the pure computation functions in tradeAssistant.ts.
 * No React rendering needed — pure function tests.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  suggestPositionSize, assessTradeRisk, suggestTradePlan,
  analyzePortfolioImpact, RISK_PROFILES,
} from '../services/ai/tradeAssistant';
import type { Stock, Holding } from '../types';

// ─── Mock Stock ────────────────────────────────────────────────────────────

const mockStock: Stock = {
  id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.',
  sector: 'Energy', price: 2890.50, change: 45.20, changePercent: 1.59,
  isPositive: true, marketCap: '₹19,56,000 Cr', volume: '12.5M',
  high52: 3020.00, low52: 2200.00, pe: 28.5, pb: 3.2, dividend: 0.85,
};

// ─── Mock Holdings ─────────────────────────────────────────────────────────

const mockHoldings: Holding[] = [
  { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 50, buyPrice: 2650, currentPrice: 2890.50, totalInvested: 132500, currentValue: 144525, pnl: 12025, pnlPercent: 9.08, dayChange: 2260, dayChangePercent: 1.59 },
  { id: 'h2', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 100, buyPrice: 1550, currentPrice: 1678.90, totalInvested: 155000, currentValue: 167890, pnl: 12890, pnlPercent: 8.32, dayChange: 2345, dayChangePercent: 1.42 },
];

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('suggestPositionSize', () => {
  it('returns suggested quantity within limits for conservative profile', () => {
    const result = suggestPositionSize({
      stockPrice: 2890,
      availableBalance: 500000,
      totalPortfolioValue: 1000000,
      riskTolerance: 'conservative',
      openPositionsCount: 2,
    });

    expect(result.suggestedQuantity).toBeGreaterThan(0);
    expect(result.totalCost).toBe(result.suggestedQuantity * 2890);
    expect(result.warnings).toHaveLength(0);
    expect(result.withinRiskLimits).toBe(true);
    expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
  });

  it('warns when exceeding max risk per trade', () => {
    const result = suggestPositionSize({
      stockPrice: 500000,
      availableBalance: 500000,
      totalPortfolioValue: 1000000,
      riskTolerance: 'conservative', // max 1% of portfolio = 10,000 risk max
      openPositionsCount: 0,
    });

    // At 500,000 per share, 1 share = 500,000 which is 50% of portfolio
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.withinRiskLimits).toBe(false);
  });

  it('warns when exceeding max open positions', () => {
    const result = suggestPositionSize({
      stockPrice: 100,
      availableBalance: 500000,
      totalPortfolioValue: 1000000,
      riskTolerance: 'aggressive', // max 20 positions
      openPositionsCount: 20, // already at max
    });

    expect(result.warnings.some(w => w.includes('open positions'))).toBe(true);
  });

  it('provides alternative quantities', () => {
    const result = suggestPositionSize({
      stockPrice: 2890,
      availableBalance: 500000,
      totalPortfolioValue: 1000000,
      riskTolerance: 'moderate',
      openPositionsCount: 3,
    });

    expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
    expect(result.alternatives.some(a => a.label === 'Recommended')).toBe(true);
  });

  it('handles edge case with zero balance', () => {
    const result = suggestPositionSize({
      stockPrice: 2890,
      availableBalance: 0,
      totalPortfolioValue: 100000,
      riskTolerance: 'conservative',
      openPositionsCount: 0,
    });

    // Minimum quantity is 1 (Math.max(1, ...))
    expect(result.suggestedQuantity).toBe(1);
    expect(result.warnings.some(w => w.includes('Insufficient'))).toBe(true);
  });
});

describe('assessTradeRisk', () => {
  it('returns low risk for small position in well-balanced portfolio', () => {
    const result = assessTradeRisk({
      stock: mockStock,
      tradeType: 'buy',
      quantity: 10,
      price: 2890,
      holdings: mockHoldings,
      availableBalance: 500000,
      riskTolerance: 'conservative',
    });

    expect(result.riskScore).toBeLessThanOrEqual(50);
    expect(['low', 'moderate']).toContain(result.riskLevel);
    expect(result.factors.length).toBeGreaterThanOrEqual(3);
    expect(result.summary).toBeTruthy();
  });

  it('returns high risk for oversized position', () => {
    const result = assessTradeRisk({
      stock: mockStock,
      tradeType: 'buy',
      quantity: 500,
      price: 2890,
      holdings: [],
      availableBalance: 100000,
      riskTolerance: 'aggressive',
    });

    expect(result.factors.some(f => f.impact === 'negative')).toBe(true);
  });

  it('provides risk factor breakdown', () => {
    const result = assessTradeRisk({
      stock: mockStock,
      tradeType: 'buy',
      quantity: 50,
      price: 2890,
      holdings: mockHoldings,
      availableBalance: 500000,
      riskTolerance: 'moderate',
    });

    expect(result.factors.length).toBeGreaterThan(0);
    result.factors.forEach(f => {
      expect(f.name).toBeTruthy();
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(100);
      expect(['positive', 'negative', 'neutral']).toContain(f.impact);
    });
  });

  it('identifies valuation risk for high P/E stocks', () => {
    const expensiveStock: Stock = { ...mockStock, pe: 85 };
    const result = assessTradeRisk({
      stock: expensiveStock,
      tradeType: 'buy',
      quantity: 10,
      price: 5000,
      holdings: [],
      availableBalance: 200000,
      riskTolerance: 'conservative',
    });

    const peFactor = result.factors.find(f => f.name === 'Valuation (P/E)');
    expect(peFactor).toBeTruthy();
    expect(peFactor?.impact).toBe('negative');
  });

  it('returns suggestions for high risk trades', () => {
    const result = assessTradeRisk({
      stock: { ...mockStock, price: 50000 },
      tradeType: 'buy',
      quantity: 100,
      price: 50000,
      holdings: [],
      availableBalance: 100000,
      riskTolerance: 'conservative',
    });

    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});

describe('suggestTradePlan', () => {
  it('generates stop-loss and targets for buy trade', () => {
    const result = suggestTradePlan({
      stock: mockStock,
      tradeType: 'buy',
      entryPrice: 2890,
      riskTolerance: 'moderate',
    });

    expect(result.stopLoss).toBeTruthy();
    expect(result.stopLoss.stopLossPrice).toBeLessThan(2890);
    expect(result.stopLoss.stopLossPrice).toBeGreaterThan(0);
    expect(result.targets.length).toBeGreaterThan(0);
    expect(result.recommendation).toBeTruthy();
  });

  it('generates targets above entry for buy', () => {
    const result = suggestTradePlan({
      stock: mockStock,
      tradeType: 'buy',
      entryPrice: 2890,
      riskTolerance: 'moderate',
    });

    result.targets.forEach(t => {
      expect(t.targetPrice).toBeGreaterThan(2890);
      expect(t.riskRewardRatio).toBeGreaterThan(0);
    });
  });

  it('generates stop-loss with multiple strategies', () => {
    const result = suggestTradePlan({
      stock: mockStock,
      tradeType: 'sell',
      entryPrice: 2890,
      riskTolerance: 'aggressive',
    });

    expect(['tight', 'moderate', 'wide', 'technical']).toContain(result.stopLoss.strategy);
    expect(result.stopLoss.rationale).toBeTruthy();
  });

  it('returns different targets with varying probabilities', () => {
    const result = suggestTradePlan({
      stock: mockStock,
      tradeType: 'buy',
      entryPrice: 2890,
      riskTolerance: 'moderate',
    });

    const types = result.targets.map(t => t.type);
    expect(types[0]).toBe('conservative');
    if (result.targets.length > 1) expect(types[1]).toBe('moderate');
  });
});

describe('analyzePortfolioImpact', () => {
  it('calculates impact of buying on portfolio', () => {
    const result = analyzePortfolioImpact({
      stockSymbol: 'RELIANCE',
      stockSector: 'Energy',
      tradeType: 'buy',
      quantity: 50,
      price: 2890,
      holdings: mockHoldings,
      availableBalance: 500000,
    });

    expect(result.newPortfolioValue).toBeGreaterThan(0);
    expect(result.newBalance).toBeLessThan(500000);
    expect(result.positionWeight).toBeGreaterThan(0);
    expect(result.sectorExposure.length).toBeGreaterThan(0);
  });

  it('detects insufficient balance', () => {
    const result = analyzePortfolioImpact({
      stockSymbol: 'RELIANCE',
      stockSector: 'Energy',
      tradeType: 'buy',
      quantity: 1000,
      price: 289000, // Very expensive
      holdings: [],
      availableBalance: 1000,
    });

    expect(result.warnings.some(w => w.includes('Insufficient'))).toBe(true);
  });

  it('warns on overconcentration', () => {
    const result = analyzePortfolioImpact({
      stockSymbol: 'RELIANCE',
      stockSector: 'Energy',
      tradeType: 'buy',
      quantity: 100,
      price: 2890,
      holdings: mockHoldings,
      availableBalance: 2000000,
    });

    if (result.positionWeight > 20) {
      expect(result.warnings.some(w => w.includes('20%'))).toBe(true);
    }
  });

  it('calculates diversification score', () => {
    const result = analyzePortfolioImpact({
      stockSymbol: 'RELIANCE',
      stockSector: 'Energy',
      tradeType: 'buy',
      quantity: 10,
      price: 2890,
      holdings: mockHoldings,
      availableBalance: 500000,
    });

    expect(result.diversificationScore).toBeGreaterThanOrEqual(0);
    expect(result.diversificationScore).toBeLessThanOrEqual(100);
  });

  it('handles sell trades correctly', () => {
    const result = analyzePortfolioImpact({
      stockSymbol: 'RELIANCE',
      stockSector: 'Energy',
      tradeType: 'sell',
      quantity: 10,
      price: 2890,
      holdings: mockHoldings,
      availableBalance: 500000,
    });

    // Selling should increase available balance
    expect(result.newBalance).toBeGreaterThanOrEqual(500000);
  });
});

describe('Risk Profiles', () => {
  it('conservative has lowest risk per trade', () => {
    expect(RISK_PROFILES.conservative.maxRiskPerTradePct)
      .toBeLessThan(RISK_PROFILES.moderate.maxRiskPerTradePct);
    expect(RISK_PROFILES.moderate.maxRiskPerTradePct)
      .toBeLessThan(RISK_PROFILES.aggressive.maxRiskPerTradePct);
  });

  it('aggressive has highest position size limit', () => {
    expect(RISK_PROFILES.aggressive.maxPositionSizePct)
      .toBeGreaterThan(RISK_PROFILES.moderate.maxPositionSizePct);
    expect(RISK_PROFILES.moderate.maxPositionSizePct)
      .toBeGreaterThan(RISK_PROFILES.conservative.maxPositionSizePct);
  });
});
