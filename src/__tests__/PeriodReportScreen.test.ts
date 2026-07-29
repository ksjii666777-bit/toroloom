/**
 * ============================================================================
 * Toroloom — Period Report Unit Tests
 * ============================================================================
 *
 * Tests for:
 *   1. groupTradesByPeriod — Period grouping logic (weekly/monthly/yearly)
 *   2. formatCurrency — Edge cases relevant to period reports
 *   3. computeCognitiveSummary — Period-specific behavioral scenarios
 *
 * All three are pure functions with no external dependencies.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import { groupTradesByPeriod, groupLosersBySector } from '../utils/analytics/periodAnalytics';

import { formatCurrency } from '../utils/formatters';
import { computeCognitiveSummary } from '../services/gateway/cognitiveAnalytics';
import type { Trade, Holding, ParsedTrade } from '../types';

// ============================================================================
// 1. groupTradesByPeriod — Period Grouping Logic
// ============================================================================

const _emptyTrades: Trade[] = [];
const _emptyHoldings: Holding[] = [];

const singleBuyTrade: Trade[] = [
  { id: 't1', symbol: 'RELIANCE', type: 'buy', price: 2450, quantity: 10, total: 24500, stockId: 'RELIANCE', name: 'Reliance', timestamp: '2026-06-15T10:30:00Z' },
];

const sellTrades: Trade[] = [
  { id: 't1', symbol: 'RELIANCE', type: 'sell', price: 2950, quantity: 10, total: 5000, stockId: 'RELIANCE', name: 'Reliance', timestamp: '2026-06-15T10:30:00Z' },
  { id: 't2', symbol: 'TCS', type: 'sell', price: 3750, quantity: 5, total: -250, stockId: 'TCS', name: 'TCS', timestamp: '2026-06-20T14:00:00Z' },
  { id: 't3', symbol: 'HDFCBANK', type: 'sell', price: 1720, quantity: 20, total: 800, stockId: 'HDFCBANK', name: 'HDFC Bank', timestamp: '2026-07-05T11:00:00Z' },
];

const multiMonthSells: Trade[] = [
  // June sells
  { id: 't1', symbol: 'RELIANCE', type: 'sell', price: 2950, quantity: 10, total: 5000, stockId: 'RELIANCE', name: 'Reliance', timestamp: '2026-06-15T10:30:00Z' },
  { id: 't2', symbol: 'TCS', type: 'sell', price: 3750, quantity: 5, total: -250, stockId: 'TCS', name: 'TCS', timestamp: '2026-06-20T14:00:00Z' },
  // July sells
  { id: 't3', symbol: 'HDFCBANK', type: 'sell', price: 1720, quantity: 20, total: 800, stockId: 'HDFCBANK', name: 'HDFC Bank', timestamp: '2026-07-05T11:00:00Z' },
  { id: 't4', symbol: 'INFY', type: 'sell', price: 1650, quantity: 15, total: 1200, stockId: 'INFY', name: 'Infosys', timestamp: '2026-07-18T09:15:00Z' },
  // August sells
  { id: 't5', symbol: 'SBIN', type: 'sell', price: 850, quantity: 30, total: -450, stockId: 'SBIN', name: 'SBI', timestamp: '2026-08-10T13:00:00Z' },
];

const mockHoldingsWithPnl: Holding[] = [
  { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', quantity: 10, buyPrice: 2450, currentPrice: 2890, totalInvested: 24500, currentValue: 28900, pnl: 4400, pnlPercent: 17.96, dayChange: 450, dayChangePercent: 1.59 },
  { id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 5, buyPrice: 3800, currentPrice: 3750, totalInvested: 19000, currentValue: 18750, pnl: -250, pnlPercent: -1.32, dayChange: -80, dayChangePercent: -0.42 },
];

describe('groupTradesByPeriod', () => {
  describe('empty and edge cases', () => {
    it('returns empty array when no trades and no holdings', () => {
      const result = groupTradesByPeriod([], [], 'monthly');
      expect(result).toEqual([]);
    });

    it('returns empty array when only buy trades exist (no sells)', () => {
      const result = groupTradesByPeriod(singleBuyTrade, [], 'monthly');
      expect(result).toEqual([]);
    });

    it('returns single period when only holdings exist without sells', () => {
      const result = groupTradesByPeriod([], mockHoldingsWithPnl, 'monthly');
      expect(result.length).toBe(1);
      expect(result[0].pnl).toBe(4150); // 4400 + (-250) = 4150
      expect(result[0].trades).toBe(2); // 2 holdings
      expect(result[0].winners).toBe(1); // RELIANCE positive
      expect(result[0].losers).toBe(1); // TCS negative
    });
  });

  describe('monthly grouping', () => {
    it('groups sell trades by month', () => {
      const result = groupTradesByPeriod(multiMonthSells, [], 'monthly');
      // 3 months: June, July, August
      expect(result.length).toBe(3);
    });

    it('sorts months in descending order (most recent first)', () => {
      const result = groupTradesByPeriod(multiMonthSells, [], 'monthly');
      const months = result.map(p => p.label);
      // August should come first, then July, then June
      expect(months[0]).toContain('Aug');
      expect(months[1]).toContain('Jul');
      expect(months[2]).toContain('Jun');
    });

    it('calculates correct P&L per month', () => {
      const result = groupTradesByPeriod(multiMonthSells, [], 'monthly');

      // June: 5000 + (-250) = 4750
      const june = result.find(p => p.label.includes('Jun'));
      expect(june).toBeDefined();
      expect(june!.pnl).toBe(4750);
      expect(june!.trades).toBe(2);

      // July: 800 + 1200 = 2000
      const july = result.find(p => p.label.includes('Jul'));
      expect(july).toBeDefined();
      expect(july!.pnl).toBe(2000);
      expect(july!.trades).toBe(2);

      // August: -450
      const august = result.find(p => p.label.includes('Aug'));
      expect(august).toBeDefined();
      expect(august!.pnl).toBe(-450);
      expect(august!.trades).toBe(1);
    });

    it('tracks winners and losers correctly', () => {
      const result = groupTradesByPeriod(multiMonthSells, [], 'monthly');

      const june = result.find(p => p.label.includes('Jun'));
      expect(june!.winners).toBe(1); // RELIANCE (profit)
      expect(june!.losers).toBe(1); // TCS (loss)

      const july = result.find(p => p.label.includes('Jul'));
      expect(july!.winners).toBe(2); // HDFCBANK + INFY both profit
      expect(july!.losers).toBe(0);

      const august = result.find(p => p.label.includes('Aug'));
      expect(august!.winners).toBe(0);
      expect(august!.losers).toBe(1); // SBIN (loss)
    });
  });

  describe('weekly grouping', () => {
    it('groups sell trades into weeks', () => {
      const result = groupTradesByPeriod(sellTrades, [], 'weekly');
      // RELIANCE (June 15) and TCS (June 20) should be in same or adjacent weeks
      // HDFCBANK (July 5) in a different week
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('returns all periods when trades span multiple weeks', () => {
      const weeklyTrades: Trade[] = [
        { id: 'w1', symbol: 'RELIANCE', type: 'sell', price: 100, quantity: 10, total: 500, stockId: 'R', name: 'R', timestamp: '2026-06-01T10:00:00Z' },
        { id: 'w2', symbol: 'TCS', type: 'sell', price: 100, quantity: 5, total: -100, stockId: 'T', name: 'T', timestamp: '2026-06-15T10:00:00Z' },
      ];
      const result = groupTradesByPeriod(weeklyTrades, [], 'weekly');
      expect(result.length).toBe(2);
    });
  });

  describe('yearly grouping', () => {
    it('groups trades by year', () => {
      const multiYearTrades: Trade[] = [
        { id: 'y1', symbol: 'RELIANCE', type: 'sell', price: 100, quantity: 10, total: 1000, stockId: 'R', name: 'R', timestamp: '2025-06-15T10:00:00Z' },
        { id: 'y2', symbol: 'TCS', type: 'sell', price: 100, quantity: 5, total: 500, stockId: 'T', name: 'T', timestamp: '2026-06-15T10:00:00Z' },
      ];
      const result = groupTradesByPeriod(multiYearTrades, [], 'yearly');
      expect(result.length).toBe(2);
      expect(result[0].label).toBe('2026'); // most recent first
      expect(result[1].label).toBe('2025');
    });

    it('aggregates all trades within same year', () => {
      const sameYearTrades: Trade[] = [
        { id: 'q1', symbol: 'A', type: 'sell', price: 100, quantity: 10, total: 300, stockId: 'A', name: 'A', timestamp: '2026-03-15T10:00:00Z' },
        { id: 'q2', symbol: 'B', type: 'sell', price: 100, quantity: 5, total: -100, stockId: 'B', name: 'B', timestamp: '2026-06-15T10:00:00Z' },
        { id: 'q3', symbol: 'C', type: 'sell', price: 100, quantity: 20, total: 200, stockId: 'C', name: 'C', timestamp: '2026-09-15T10:00:00Z' },
      ];
      const result = groupTradesByPeriod(sameYearTrades, [], 'yearly');
      expect(result.length).toBe(1);
      expect(result[0].trades).toBe(3);
      expect(result[0].pnl).toBe(400); // 300 + (-100) + 200 = 400
    });
  });
});

// ============================================================================
// 2. formatCurrency — Edge Cases for Period Reports
// ============================================================================

describe('formatCurrency — period report edge cases', () => {
  it('formats large profit values in compact mode', () => {
    const result = formatCurrency(2500000, true);
    expect(result).toBe('₹25.00L');
  });

  it('formats zero profit', () => {
    const result = formatCurrency(0, true);
    expect(result).toBe('₹0.00');
  });

  it('formats small loss in compact mode', () => {
    const result = formatCurrency(-500, true);
    expect(result).toContain('-');
    expect(result).toContain('₹');
  });

  it('formats negative crore values', () => {
    const result = formatCurrency(-15000000, true);
    // formatCurrency wraps negative values with standard format in compact mode
    expect(result).toContain('₹');
    expect(result).toContain('-');
  });

  it('formats exact lakh boundary', () => {
    const result = formatCurrency(100000, true);
    expect(result).toBe('₹1.00L');
  });

  it('formats exact crore boundary', () => {
    const result = formatCurrency(10000000, true);
    expect(result).toBe('₹1.00Cr');
  });

  it('handles very small decimal values', () => {
    const result = formatCurrency(0.5);
    expect(result).toContain('₹');
    expect(result).toContain('0.50');
  });

  it('formats all period P&L values consistently', () => {
    // Common P&L values seen in period reports
    const values = [0, 100, 5000, -5000, 150000, -150000, 5000000];
    for (const v of values) {
      const result = formatCurrency(v, true);
      expect(result).toContain('₹');
      if (v < 0) expect(result).toContain('-');
    }
  });
});

// ============================================================================
// 3. computeCognitiveSummary — Period Behavioral Scenarios
// ============================================================================

describe('computeCognitiveSummary — period scenarios', () => {
  it('detects daily overtrading (10+ trades on same day)', () => {
    // 12 trades ALL on the same day → exceeds 10/day threshold
    const dailyOverTrades: ParsedTrade[] = Array.from({ length: 12 }, (_, i) => ({
      execution_timestamp: '2026-06-15T09:00:00',
      asset_symbol: 'RELIANCE',
      transaction_type: (i % 2 === 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
      filled_quantity: 10,
      execution_price: 100 + i,
      regulatory_fees: 5,
      exchange: 'NSE',
    }));
    const summary = computeCognitiveSummary(dailyOverTrades, []);
    expect(summary.overTradingAlert).toBeDefined();
    expect(summary.overTradingAlert!.flag).toBe(true);
  });

  it('does not flag overtrading when trades are spread across weeks', () => {
    const spreadTrades: ParsedTrade[] = Array.from({ length: 8 }, (_, i) => ({
      execution_timestamp: `2026-0${6 + Math.floor(i / 2)}-${String((i % 28) + 1).padStart(2, '0')}T09:00:00`,
      asset_symbol: 'RELIANCE',
      transaction_type: (i % 2 === 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
      filled_quantity: 10,
      execution_price: 100,
      regulatory_fees: 5,
      exchange: 'NSE',
    }));
    const summary = computeCognitiveSummary(spreadTrades, []);
    // 8 trades spread across months → no single day should exceed 10
    expect(summary.overTradingAlert).toBeUndefined();
  });

  it('generates behavioral critique for low win rate pattern', () => {
    // cognitiveAnalytics computes P&L as: quantity * execution_price - regulatory_fees
    // To create losing trades, fees must exceed sell value: qty * price < fees
    // We use small quantity + normal execution_price + very high fees for losses
    // For wins: set quantity=1 low so sell value ≈ low, but fees even lower
    const losingTrades: ParsedTrade[] = [
      // Win: 1*110 - 5 = 105 > 0 ✓
      { execution_timestamp: '2026-06-15T10:00:00', asset_symbol: 'TCS', transaction_type: 'SELL', filled_quantity: 1, execution_price: 110, regulatory_fees: 5, exchange: 'NSE' },
      // Loss: 1*90 - 200 = -110 < 0 ✓ (fees >> sell value)
      { execution_timestamp: '2026-06-16T10:00:00', asset_symbol: 'RELIANCE', transaction_type: 'SELL', filled_quantity: 1, execution_price: 90, regulatory_fees: 200, exchange: 'NSE' },
      // Loss: 1*85 - 200 = -115 < 0 ✓
      { execution_timestamp: '2026-06-17T10:00:00', asset_symbol: 'HDFCBANK', transaction_type: 'SELL', filled_quantity: 1, execution_price: 85, regulatory_fees: 200, exchange: 'NSE' },
      // Loss: 1*80 - 200 = -120 < 0 ✓
      { execution_timestamp: '2026-06-18T10:00:00', asset_symbol: 'INFY', transaction_type: 'SELL', filled_quantity: 1, execution_price: 80, regulatory_fees: 200, exchange: 'NSE' },
    ];
    const summary = computeCognitiveSummary(losingTrades, []);
    // 4 sells → 1 win + 3 losses → 25% win rate < 40% threshold
    // Sectors: Technology, Energy, Banking, Other → no single sector > 35%
    expect(summary.winLossFrequencyRatio).toBeLessThan(0.4);
    expect(summary.behavioralCritique!.length).toBeGreaterThan(0);
  });

  it('provides balanced critique for well-managed period', () => {
    // Trades across multiple sectors with holdings to diversify further
    const goodTrades: ParsedTrade[] = [
      { execution_timestamp: '2026-06-01T09:00:00', asset_symbol: 'TCS', transaction_type: 'BUY', filled_quantity: 10, execution_price: 100, regulatory_fees: 5, exchange: 'NSE' },
      { execution_timestamp: '2026-06-02T09:00:00', asset_symbol: 'TCS', transaction_type: 'SELL', filled_quantity: 10, execution_price: 110, regulatory_fees: 5, exchange: 'NSE' },
      { execution_timestamp: '2026-06-03T09:00:00', asset_symbol: 'HDFCBANK', transaction_type: 'BUY', filled_quantity: 10, execution_price: 100, regulatory_fees: 5, exchange: 'NSE' },
      { execution_timestamp: '2026-06-04T09:00:00', asset_symbol: 'HDFCBANK', transaction_type: 'SELL', filled_quantity: 10, execution_price: 105, regulatory_fees: 5, exchange: 'NSE' },
      { execution_timestamp: '2026-06-05T09:00:00', asset_symbol: 'ITC', transaction_type: 'BUY', filled_quantity: 20, execution_price: 50, regulatory_fees: 3, exchange: 'NSE' },
      { execution_timestamp: '2026-06-06T09:00:00', asset_symbol: 'ITC', transaction_type: 'SELL', filled_quantity: 20, execution_price: 55, regulatory_fees: 3, exchange: 'NSE' },
    ];
    // Diverse holdings ensure no single sector exceeds 35%
    const diverseHoldings: Holding[] = [
      { id: 'h1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 5, buyPrice: 100, currentPrice: 110, totalInvested: 500, currentValue: 550, pnl: 50, pnlPercent: 10, dayChange: 5, dayChangePercent: 0.5 },
      { id: 'h2', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 5, buyPrice: 100, currentPrice: 105, totalInvested: 500, currentValue: 525, pnl: 25, pnlPercent: 5, dayChange: 3, dayChangePercent: 0.3 },
      { id: 'h3', stockId: 'ITC', symbol: 'ITC', name: 'ITC', quantity: 5, buyPrice: 50, currentPrice: 55, totalInvested: 250, currentValue: 275, pnl: 25, pnlPercent: 10, dayChange: 2, dayChangePercent: 0.4 },
    ];
    const summary = computeCognitiveSummary(goodTrades, diverseHoldings);
    // Win rate = 100%, drag ≈ small, trades < 100, 3 diverse sectors → no alerts
    expect(summary.behavioralCritique).toBeDefined();
    expect(summary.overTradingAlert).toBeUndefined();
    expect(summary.concentrationRiskAlert).toBeUndefined();
    expect(summary.brokerageLeakageAlert).toBeUndefined();
  });

  it('flags concentration risk for single-sector portfolio', () => {
    const singleSectorHoldings: Holding[] = [
      { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', quantity: 100, buyPrice: 100, currentPrice: 110, totalInvested: 10000, currentValue: 11000, pnl: 1000, pnlPercent: 10, dayChange: 50, dayChangePercent: 0.5 },
      { id: 'h2', stockId: 'HINDPETRO', symbol: 'HINDPETRO', name: 'HPCL', quantity: 100, buyPrice: 50, currentPrice: 55, totalInvested: 5000, currentValue: 5500, pnl: 500, pnlPercent: 10, dayChange: 20, dayChangePercent: 0.4 },
      // Both are Energy sector → >35% concentration
    ];
    const summary = computeCognitiveSummary([], singleSectorHoldings);
    expect(summary.concentrationRiskAlert).toBeDefined();
    expect(summary.concentrationRiskAlert!.flag).toBe(true);
    expect(summary.concentrationRiskAlert!.message).toContain('Energy');
  });

  it('calculates sector concentration index correctly', () => {
    const diversifiedHoldings: Holding[] = [
      { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', quantity: 50, buyPrice: 100, currentPrice: 100, totalInvested: 5000, currentValue: 5000, pnl: 0, pnlPercent: 0, dayChange: 0, dayChangePercent: 0 },
      { id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 50, buyPrice: 100, currentPrice: 100, totalInvested: 5000, currentValue: 5000, pnl: 0, pnlPercent: 0, dayChange: 0, dayChangePercent: 0 },
      { id: 'h3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 50, buyPrice: 100, currentPrice: 100, totalInvested: 5000, currentValue: 5000, pnl: 0, pnlPercent: 0, dayChange: 0, dayChangePercent: 0 },
    ];
    const summary = computeCognitiveSummary([], diversifiedHoldings);
    // Energy = 33.3%, Technology = 33.3%, Banking = 33.3%
    // HHI = (0.333)² + (0.333)² + (0.333)² = 0.333
    expect(summary.sectorConcentrationIndex).toBeGreaterThan(0.3);
    expect(summary.sectorConcentrationIndex).toBeLessThan(0.4);
    // All sectors under 35% → no concentration alert
    expect(summary.concentrationRiskAlert).toBeUndefined();
  });
});

// ============================================================================
// 4. groupLosersBySector — Sector-Grouped Loss Breakdown
// ============================================================================

describe('groupLosersBySector', () => {
  const baseHoldings: Holding[] = [
    { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', quantity: 10, buyPrice: 2450, currentPrice: 2400, totalInvested: 24500, currentValue: 24000, pnl: -500, pnlPercent: -2.04, dayChange: -50, dayChangePercent: -0.21 },
    { id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 5, buyPrice: 3800, currentPrice: 3600, totalInvested: 19000, currentValue: 18000, pnl: -1000, pnlPercent: -5.26, dayChange: -100, dayChangePercent: -0.55 },
    { id: 'h3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 20, buyPrice: 1650, currentPrice: 1620, totalInvested: 33000, currentValue: 32400, pnl: -600, pnlPercent: -1.82, dayChange: -30, dayChangePercent: -0.18 },
  ];

  describe('empty and edge cases', () => {
    it('returns empty array when holdings are empty', () => {
      const result = groupLosersBySector([]);
      expect(result).toEqual([]);
    });

    it('returns empty array when no holdings have negative P&L', () => {
      const profitableOnly: Holding[] = [
        { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', quantity: 10, buyPrice: 2450, currentPrice: 2890, totalInvested: 24500, currentValue: 28900, pnl: 4400, pnlPercent: 17.96, dayChange: 450, dayChangePercent: 1.59 },
      ];
      const result = groupLosersBySector(profitableOnly);
      expect(result).toEqual([]);
    });

    it('handles single losing holding', () => {
      const singleLoss: Holding[] = [
        { id: 'h1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 5, buyPrice: 3800, currentPrice: 3600, totalInvested: 19000, currentValue: 18000, pnl: -1000, pnlPercent: -5.26, dayChange: -100, dayChangePercent: -0.55 },
      ];
      const result = groupLosersBySector(singleLoss);
      expect(result.length).toBe(1);
      expect(result[0].sector).toBe('Technology');
      expect(result[0].totalLoss).toBe(-1000);
      expect(result[0].stocks.length).toBe(1);
      expect(result[0].stocks[0].symbol).toBe('TCS');
    });
  });

  describe('single sector grouping', () => {
    it('groups multiple stocks from the same sector together', () => {
      // TCS + INFY + WIPRO = all Technology
      const techOnlyLosses: Holding[] = [
        { id: 'h1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 5, buyPrice: 3800, currentPrice: 3600, totalInvested: 19000, currentValue: 18000, pnl: -1000, pnlPercent: -5.26, dayChange: -100, dayChangePercent: -0.55 },
        { id: 'h2', stockId: 'INFY', symbol: 'INFY', name: 'Infosys', quantity: 10, buyPrice: 1700, currentPrice: 1650, totalInvested: 17000, currentValue: 16500, pnl: -500, pnlPercent: -2.94, dayChange: -30, dayChangePercent: -0.18 },
        { id: 'h3', stockId: 'WIPRO', symbol: 'WIPRO', name: 'Wipro', quantity: 8, buyPrice: 450, currentPrice: 420, totalInvested: 3600, currentValue: 3360, pnl: -240, pnlPercent: -6.67, dayChange: -10, dayChangePercent: -0.24 },
      ];
      const result = groupLosersBySector(techOnlyLosses);
      expect(result.length).toBe(1);
      expect(result[0].sector).toBe('Technology');
      expect(result[0].stocks.length).toBe(3);
      expect(result[0].totalLoss).toBe(-1740); // -1000 + (-500) + (-240) = -1740
    });

    it('calculates totalLossPercent correctly for a sector', () => {
      const techOnlyLosses: Holding[] = [
        { id: 'h1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 5, buyPrice: 3800, currentPrice: 3600, totalInvested: 20000, currentValue: 18000, pnl: -2000, pnlPercent: -10.0, dayChange: -100, dayChangePercent: -0.55 },
        { id: 'h2', stockId: 'INFY', symbol: 'INFY', name: 'Infosys', quantity: 10, buyPrice: 1700, currentPrice: 1650, totalInvested: 17000, currentValue: 16500, pnl: -500, pnlPercent: -2.94, dayChange: -30, dayChangePercent: -0.18 },
      ];
      const result = groupLosersBySector(techOnlyLosses);
      const expectedPct = ((-2000 + -500) / (20000 + 17000)) * 100; // -2500 / 37000 * 100 = -6.76%
      expect(result[0].totalLossPercent).toBeCloseTo(expectedPct, 1);
    });
  });

  describe('multiple sectors', () => {
    it('groups stocks into their respective sectors', () => {
      // RELIANCE → Energy, TCS → Technology, HDFCBANK → Banking
      const result = groupLosersBySector(baseHoldings);
      expect(result.length).toBe(3);

      const sectors = result.map(g => g.sector).sort();
      expect(sectors).toEqual(['Banking', 'Energy', 'Technology']);
    });

    it('assigns correct stocks to each sector group', () => {
      const result = groupLosersBySector(baseHoldings);

      const energy = result.find(g => g.sector === 'Energy');
      expect(energy).toBeDefined();
      expect(energy!.stocks.length).toBe(1);
      expect(energy!.stocks[0].symbol).toBe('RELIANCE');

      const tech = result.find(g => g.sector === 'Technology');
      expect(tech).toBeDefined();
      expect(tech!.stocks.length).toBe(1);
      expect(tech!.stocks[0].symbol).toBe('TCS');

      const banking = result.find(g => g.sector === 'Banking');
      expect(banking).toBeDefined();
      expect(banking!.stocks.length).toBe(1);
      expect(banking!.stocks[0].symbol).toBe('HDFCBANK');
    });
  });

  describe('sorting', () => {
    it('sorts sectors by worst loss first (most negative totalLoss)', () => {
      // Make Energy loss bigger than Technology
      const holdings: Holding[] = [
        { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', quantity: 10, buyPrice: 2500, currentPrice: 2000, totalInvested: 25000, currentValue: 20000, pnl: -5000, pnlPercent: -20.0, dayChange: -100, dayChangePercent: -0.4 },
        { id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 5, buyPrice: 3800, currentPrice: 3600, totalInvested: 19000, currentValue: 18000, pnl: -1000, pnlPercent: -5.26, dayChange: -100, dayChangePercent: -0.55 },
        { id: 'h3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 20, buyPrice: 1650, currentPrice: 1620, totalInvested: 33000, currentValue: 32400, pnl: -600, pnlPercent: -1.82, dayChange: -30, dayChangePercent: -0.18 },
      ];
      const result = groupLosersBySector(holdings);
      // Energy (-5000) should be first, Technology (-1000) second, Banking (-600) third
      expect(result[0].sector).toBe('Energy');
      expect(result[1].sector).toBe('Technology');
      expect(result[2].sector).toBe('Banking');
      expect(result[0].totalLoss).toBe(-5000);
      expect(result[1].totalLoss).toBe(-1000);
      expect(result[2].totalLoss).toBe(-600);
    });

    it('handles sectors with same loss value gracefully', () => {
      // All same loss to test predictable behavior
      const equalLosses: Holding[] = [
        { id: 'h1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 5, buyPrice: 3800, currentPrice: 3600, totalInvested: 19000, currentValue: 18000, pnl: -1000, pnlPercent: -5.26, dayChange: -100, dayChangePercent: -0.55 },
        { id: 'h2', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 20, buyPrice: 1650, currentPrice: 1620, totalInvested: 33000, currentValue: 32400, pnl: -1000, pnlPercent: -1.82, dayChange: -30, dayChangePercent: -0.18 },
      ];
      const result = groupLosersBySector(equalLosses);
      expect(result.length).toBe(2);
      // Both have -1000 loss
      expect(result[0].totalLoss).toBe(-1000);
      expect(result[1].totalLoss).toBe(-1000);
    });
  });

  describe('fallback sector classification', () => {
    it('classifies unknown symbols as "Other"', () => {
      const unknownStock: Holding[] = [
        { id: 'h1', stockId: 'XYZABC', symbol: 'XYZABC', name: 'Unknown Co', quantity: 10, buyPrice: 100, currentPrice: 80, totalInvested: 1000, currentValue: 800, pnl: -200, pnlPercent: -20.0, dayChange: -10, dayChangePercent: -0.1 },
      ];
      const result = groupLosersBySector(unknownStock);
      expect(result.length).toBe(1);
      expect(result[0].sector).toBe('Other');
      expect(result[0].stocks[0].symbol).toBe('XYZABC');
    });

    it('groups multiple unknown stocks under "Other" sector', () => {
      const unknownStocks: Holding[] = [
        { id: 'h1', stockId: 'FOOBAR', symbol: 'FOOBAR', name: 'Foo Bar', quantity: 10, buyPrice: 100, currentPrice: 80, totalInvested: 1000, currentValue: 800, pnl: -200, pnlPercent: -20.0, dayChange: -10, dayChangePercent: -0.1 },
        { id: 'h2', stockId: 'BAZQUX', symbol: 'BAZQUX', name: 'Baz Qux', quantity: 5, buyPrice: 200, currentPrice: 180, totalInvested: 1000, currentValue: 900, pnl: -100, pnlPercent: -10.0, dayChange: -5, dayChangePercent: -0.05 },
      ];
      const result = groupLosersBySector(unknownStocks);
      expect(result.length).toBe(1);
      expect(result[0].sector).toBe('Other');
      expect(result[0].stocks.length).toBe(2);
      expect(result[0].totalLoss).toBe(-300); // -200 + (-100)
    });
  });

  describe('mixed sectors with multiple stocks per sector', () => {
    it('handles multiple stocks in some sectors and single in others', () => {
      // Energy: RELIANCE + ONGC (2 stocks), Technology: TCS (1 stock)
      const mixed: Holding[] = [
        { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', quantity: 10, buyPrice: 2500, currentPrice: 2400, totalInvested: 25000, currentValue: 24000, pnl: -1000, pnlPercent: -4.0, dayChange: -50, dayChangePercent: -0.2 },
        { id: 'h2', stockId: 'ONGC', symbol: 'ONGC', name: 'ONGC', quantity: 20, buyPrice: 300, currentPrice: 280, totalInvested: 6000, currentValue: 5600, pnl: -400, pnlPercent: -6.67, dayChange: -10, dayChangePercent: -0.17 },
        { id: 'h3', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 5, buyPrice: 3800, currentPrice: 3600, totalInvested: 19000, currentValue: 18000, pnl: -1000, pnlPercent: -5.26, dayChange: -100, dayChangePercent: -0.55 },
      ];
      const result = groupLosersBySector(mixed);
      expect(result.length).toBe(2);

      const energy = result.find(g => g.sector === 'Energy');
      expect(energy).toBeDefined();
      expect(energy!.stocks.length).toBe(2);
      expect(energy!.totalLoss).toBe(-1400); // -1000 + (-400)

      const tech = result.find(g => g.sector === 'Technology');
      expect(tech).toBeDefined();
      expect(tech!.stocks.length).toBe(1);
      expect(tech!.totalLoss).toBe(-1000);
    });
  });

  describe('zero totalInvested edge case', () => {
    it('handles holdings with zero totalInvested gracefully', () => {
      const zeroInvested: Holding[] = [
        { id: 'h1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', quantity: 5, buyPrice: 0, currentPrice: 3600, totalInvested: 0, currentValue: 18000, pnl: -1000, pnlPercent: 0, dayChange: -100, dayChangePercent: -0.55 },
      ];
      const result = groupLosersBySector(zeroInvested);
      expect(result.length).toBe(1);
      expect(result[0].totalLossPercent).toBe(0); // totalInvested is 0, so defaults to 0
    });
  });
});
