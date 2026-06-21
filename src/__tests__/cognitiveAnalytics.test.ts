/**
 * ============================================================================
 * Toroloom — Cognitive Analytics Engine Unit Tests
 * ============================================================================
 *
 * Tests for cognitiveAnalytics.ts covering:
 *   - Empty trades / holdings (default return)
 *   - Win/Loss Frequency Ratio
 *   - Brokerage Drag Factor
 *   - Sector Concentration Index
 *   - Behavioral alerts (over-trading, brokerage leakage, concentration risk)
 *   - Sector classification (Indian stock symbols)
 *   - computeSimplifiedSummary
 *   - generateBehavioralPrompt
 */

import { describe, it, expect } from 'vitest';
import {
  computeCognitiveSummary,
  computeSimplifiedSummary,
  generateBehavioralPrompt,
} from '../services/gateway/cognitiveAnalytics';
import type { ParsedTrade, Holding} from '../types';

// ─── Test Fixtures ─────────────────────────────────────────

const mockTrades: ParsedTrade[] = [
  {
    execution_timestamp: '2026-06-15T10:30:00',
    asset_symbol: 'RELIANCE',
    transaction_type: 'BUY',
    filled_quantity: 50,
    execution_price: 2890.50,
    regulatory_fees: 12.50,
    exchange: 'NSE',
  },
  {
    execution_timestamp: '2026-06-15T14:45:00',
    asset_symbol: 'RELIANCE',
    transaction_type: 'SELL',
    filled_quantity: 50,
    execution_price: 2950.00,
    regulatory_fees: 15.00,
    exchange: 'NSE',
  },
  {
    execution_timestamp: '2026-06-16T09:15:00',
    asset_symbol: 'TCS',
    transaction_type: 'BUY',
    filled_quantity: 20,
    execution_price: 3800.00,
    regulatory_fees: 8.00,
    exchange: 'NSE',
  },
  {
    execution_timestamp: '2026-06-16T11:30:00',
    asset_symbol: 'TCS',
    transaction_type: 'SELL',
    filled_quantity: 20,
    execution_price: 3750.00,
    regulatory_fees: 10.00,
    exchange: 'NSE',
  },
  {
    execution_timestamp: '2026-06-17T09:30:00',
    asset_symbol: 'HDFCBANK',
    transaction_type: 'BUY',
    filled_quantity: 100,
    execution_price: 1680.00,
    regulatory_fees: 5.00,
    exchange: 'NSE',
  },
  {
    execution_timestamp: '2026-06-17T11:00:00',
    asset_symbol: 'HDFCBANK',
    transaction_type: 'SELL',
    filled_quantity: 100,
    execution_price: 1720.00,
    regulatory_fees: 5.00,
    exchange: 'NSE',
  },
  {
    execution_timestamp: '2026-06-17T14:00:00',
    asset_symbol: 'ICICIBANK',
    transaction_type: 'BUY',
    filled_quantity: 50,
    execution_price: 1200.00,
    regulatory_fees: 3.00,
    exchange: 'NSE',
  },
  {
    execution_timestamp: '2026-06-18T09:30:00',
    asset_symbol: 'ITC',
    transaction_type: 'BUY',
    filled_quantity: 200,
    execution_price: 450.00,
    regulatory_fees: 5.00,
    exchange: 'NSE',
  },
  {
    execution_timestamp: '2026-06-18T11:00:00',
    asset_symbol: 'DRREDDY',
    transaction_type: 'BUY',
    filled_quantity: 50,
    execution_price: 5000.00,
    regulatory_fees: 10.00,
    exchange: 'NSE',
  },
];

const mockHoldings: Holding[] = [
  {
    id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries',
    quantity: 10, buyPrice: 2850, currentPrice: 2920,
    totalInvested: 28500, currentValue: 29200,
    pnl: 700, pnlPercent: 2.46,
    dayChange: 150, dayChangePercent: 0.52,
  },
  {
    id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services',
    quantity: 5, buyPrice: 3850, currentPrice: 3780,
    totalInvested: 19250, currentValue: 18900,
    pnl: -350, pnlPercent: -1.82,
    dayChange: -80, dayChangePercent: -0.42,
  },
];

const manyTrades: ParsedTrade[] = Array.from({ length: 150 }, (_, i) => ({
  execution_timestamp: `2026-06-${String((i % 30) + 1).padStart(2, '0')}T09:${String(i % 60).padStart(2, '0')}:00`,
  asset_symbol: i % 3 === 0 ? 'RELIANCE' : i % 3 === 1 ? 'TCS' : 'INFY',
  transaction_type: (i % 2 === 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
  filled_quantity: 10 + (i % 100),
  execution_price: 1000 + (i % 500),
  regulatory_fees: 5 + (i % 20),
  exchange: 'NSE',
}));

const highDragTrades: ParsedTrade[] = [
  {
    execution_timestamp: '2026-06-15T10:30:00',
    asset_symbol: 'RELIANCE',
    transaction_type: 'BUY',
    filled_quantity: 10,
    execution_price: 100.00,
    regulatory_fees: 100.00, // very high relative to profit
    exchange: 'NSE',
  },
  {
    execution_timestamp: '2026-06-15T14:00:00',
    asset_symbol: 'RELIANCE',
    transaction_type: 'SELL',
    filled_quantity: 10,
    execution_price: 110.00,
    regulatory_fees: 100.00, // very high relative to profit
    exchange: 'NSE',
  },
];

const concentratedHoldings: Holding[] = [
  // 95% in Energy (RELIANCE), 5% in Technology (TCS)
  {
    id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance',
    quantity: 950, buyPrice: 100, currentPrice: 100,
    totalInvested: 95000, currentValue: 95000,
    pnl: 0, pnlPercent: 0,
    dayChange: 0, dayChangePercent: 0,
  },
  {
    id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'TCS',
    quantity: 50, buyPrice: 100, currentPrice: 100,
    totalInvested: 5000, currentValue: 5000,
    pnl: 0, pnlPercent: 0,
    dayChange: 0, dayChangePercent: 0,
  },
];

// ====================================================================
// Empty Input
// ====================================================================

describe('empty input', () => {
  it('returns zero metrics when trades array is empty', () => {
    const summary = computeCognitiveSummary([], []);
    expect(summary.winLossFrequencyRatio).toBe(0);
    expect(summary.totalProfitableTrades).toBe(0);
    expect(summary.totalClosedTrades).toBe(0);
    expect(summary.brokerageDragFactor).toBe(0);
    expect(summary.totalTaxesAndCharges).toBe(0);
    expect(summary.absoluteRealizedPnl).toBe(0);
    expect(summary.sectorConcentrationIndex).toBe(0);
    expect(summary.sectorAllocation).toEqual([]);
  });

  it('sets generatedAt to current ISO timestamp', () => {
    const summary = computeCognitiveSummary([], []);
    expect(summary.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ====================================================================
// Win / Loss
// ====================================================================

describe('win/loss frequency ratio', () => {
  it('calculates win rate from SELL trades', () => {
    // RELIANCE SELL: profit (50*2950 - 15 = 147485 > 0) → win
    // TCS SELL: profit (20*3750 - 10 = 74990 > 0) → win
    // HDFCBANK SELL: profit (100*1720 - 5 = 171995 > 0) → win
    // All 3 sells are profitable → 3/3 = 1.0
    const summary = computeCognitiveSummary(mockTrades, []);
    expect(summary.totalClosedTrades).toBe(3);
    expect(summary.totalProfitableTrades).toBe(3);
    expect(summary.winLossFrequencyRatio).toBe(1.0);
  });

  it('calculates win rate = 0 when all sells are losses', () => {
    const losingTrades: ParsedTrade[] = [
      { ...mockTrades[0] }, // BUY RELIANCE
      { ...mockTrades[1], execution_price: 1.00, regulatory_fees: 100 } as ParsedTrade, // SELL at huge loss
    ];
    const summary = computeCognitiveSummary(losingTrades, []);
    expect(summary.winLossFrequencyRatio).toBe(0);
  });
});

// ====================================================================
// Brokerage Drag
// ====================================================================

describe('brokerage drag factor', () => {
  it('calculates brokerage drag percentage', () => {
    const summary = computeCognitiveSummary(mockTrades, []);
    // totalTaxes = 12.50 + 15.00 + 8.00 + 10.00 + 5.00 + 5.00 + 3.00 = 58.50
    // totalRealizedPnl = (50*2950-15) + (20*3750-10) + (100*1720-5) = 147485 + 74990 + 171995 = 394470
    // drag = (58.50 / 394470) * 100 ≈ 0.015%
    expect(summary.brokerageDragFactor).toBeGreaterThan(0);
    expect(summary.brokerageDragFactor).toBeLessThan(1);
  });

  it('flags brokerage leakage when drag exceeds threshold', () => {
    const summary = computeCognitiveSummary(highDragTrades, []);
    // totalTaxes = 100 + 100 = 200
    // totalRealizedPnl = 10*110 - 100 = 1000
    // drag = 200/1000 * 100 = 20% > 15% threshold → flags alert
    expect(summary.brokerageLeakageAlert).toBeDefined();
    expect(summary.brokerageLeakageAlert!.flag).toBe(true);
    expect(summary.brokerageLeakageAlert!.message).toContain('Brokerage');
  });

  it('does not flag brokerage leakage when drag is low', () => {
    const summary = computeCognitiveSummary(mockTrades, []);
    // drag ≈ 0.015% ≪ 15% → no alert
    expect(summary.brokerageLeakageAlert).toBeUndefined();
  });
});

// ====================================================================
// Sector Concentration
// ====================================================================

describe('sector concentration index', () => {
  it('computes non-zero sector allocation from trades', () => {
    const summary = computeCognitiveSummary(mockTrades, []);
    expect(summary.sectorAllocation.length).toBeGreaterThan(0);
  });

  it('classifies RELIANCE as Energy sector', () => {
    const summary = computeCognitiveSummary(mockTrades, []);
    const energy = summary.sectorAllocation.find(s => s.sector === 'Energy');
    expect(energy).toBeDefined();
  });

  it('classifies TCS as Technology sector', () => {
    const summary = computeCognitiveSummary(mockTrades, []);
    const tech = summary.sectorAllocation.find(s => s.sector === 'Technology');
    expect(tech).toBeDefined();
  });

  it('classifies HDFCBANK as Banking sector', () => {
    const summary = computeCognitiveSummary(mockTrades, []);
    const banking = summary.sectorAllocation.find(s => s.sector === 'Banking');
    expect(banking).toBeDefined();
  });

  it('incorporates holdings into sector allocation', () => {
    const summary = computeCognitiveSummary(mockTrades, mockHoldings);
    // Total exposure should include both trade values and holding values
    const totalPct = summary.sectorAllocation.reduce((sum, s) => sum + s.exposurePercent, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });

  it('flags concentration risk when single sector exceeds 35%', () => {
    // Only pass concentratedHoldings (no trades) to isolate the concentration
    const summary = computeCognitiveSummary([], concentratedHoldings);
    expect(summary.concentrationRiskAlert).toBeDefined();
    expect(summary.concentrationRiskAlert!.flag).toBe(true);
    expect(summary.concentrationRiskAlert!.message).toContain('Energy');
  });

  it('classifies unknown symbols as Other sector', () => {
    const unknownTrade: ParsedTrade = {
      execution_timestamp: '2026-06-15T10:30:00',
      asset_symbol: 'ZZZZZ',
      transaction_type: 'BUY',
      filled_quantity: 10,
      execution_price: 100.00,
      regulatory_fees: 5.00,
    };
    const summary = computeCognitiveSummary([unknownTrade], []);
    const other = summary.sectorAllocation.find(s => s.sector === 'Other');
    expect(other).toBeDefined();
    expect(other!.exposurePercent).toBeCloseTo(100, 0);
  });
});

// ====================================================================
// Behavioral Alerts
// ====================================================================

describe('behavioral alerts', () => {
  it('triggers over-trading alert when > 10 trades in one day', () => {
    const sameDayTrades: ParsedTrade[] = Array.from({ length: 15 }, (_, i) => ({
      execution_timestamp: '2026-06-15T09:00:00',
      asset_symbol: 'RELIANCE',
      transaction_type: (i % 2 === 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
      filled_quantity: 10,
      execution_price: 100 + i,
      regulatory_fees: 5,
      exchange: 'NSE',
    }));
    const summary = computeCognitiveSummary(sameDayTrades, []);
    expect(summary.overTradingAlert).toBeDefined();
    expect(summary.overTradingAlert!.flag).toBe(true);
    expect(summary.overTradingAlert!.message).toContain('Over-trading');
  });

  it('does not trigger over-trading alert when trades are spread out', () => {
    const spreadTrades: ParsedTrade[] = Array.from({ length: 10 }, (_, i) => ({
      execution_timestamp: `2026-06-${String(i + 1).padStart(2, '0')}T09:00:00`,
      asset_symbol: 'RELIANCE',
      transaction_type: (i % 2 === 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
      filled_quantity: 10,
      execution_price: 100,
      regulatory_fees: 5,
      exchange: 'NSE',
    }));
    const summary = computeCognitiveSummary(spreadTrades, []);
    expect(summary.overTradingAlert).toBeUndefined();
  });

  it('generates behavioral critique for high-frequency trading', () => {
    const summary = computeCognitiveSummary(manyTrades, []);
    expect(summary.behavioralCritique).toBeDefined();
    // Many trades → should mention high-frequency pattern
    expect(summary.behavioralCritique!.length).toBeGreaterThan(0);
  });

  it('generates balanced critique when no issues', () => {
    const summary = computeCognitiveSummary(mockTrades, []);
    // mockTrades has 3 sectors (Energy, Technology, Banking) with Energy at ~34.6% < 35%
    // No sector exceeds 35% → no concentration risk
    // Win rate = 100% > 40% → no win rate concern
    // Total trades = 7 < 100 → no high-frequency alert
    // Drag ≈ 0.015% < 15% → no brokerage leakage
    expect(summary.behavioralCritique).toContain('balanced');
  });
});

// ====================================================================
// computeSimplifiedSummary
// ====================================================================

describe('computeSimplifiedSummary', () => {
  it('returns a subset of metrics', () => {
    const summary = computeSimplifiedSummary(mockTrades, []);
    expect(summary).toHaveProperty('winLossFrequencyRatio');
    expect(summary).toHaveProperty('brokerageDragFactor');
    expect(summary).toHaveProperty('sectorConcentrationIndex');
    expect(summary).toHaveProperty('generatedAt');

    // Should NOT include full-allocation fields
    expect(summary).not.toHaveProperty('sectorAllocation');
    expect(summary).not.toHaveProperty('behavioralCritique');
  });
});

// ====================================================================
// generateBehavioralPrompt
// ====================================================================

describe('generateBehavioralPrompt', () => {
  it('generates prompt string from summary', () => {
    const summary = computeCognitiveSummary(mockTrades, []);
    const prompt = generateBehavioralPrompt(summary);
    expect(prompt).toContain('Trader Performance Summary');
    expect(prompt).toContain('Win/Loss Ratio');
    expect(prompt).toContain('Brokerage Drag');
    expect(prompt).toContain('Sector Concentration');
    expect(prompt).toContain('Sector Allocation');
  });

  it('includes all sector names in prompt', () => {
    const summary = computeCognitiveSummary(mockTrades, mockHoldings);
    const prompt = generateBehavioralPrompt(summary);
    for (const sector of summary.sectorAllocation) {
      expect(prompt).toContain(sector.sector);
    }
  });
});
