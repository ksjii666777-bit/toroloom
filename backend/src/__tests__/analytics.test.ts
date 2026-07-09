/**
 * ============================================================================
 * Toroloom — Analytics Service Unit Tests
 * ============================================================================
 *
 * Tests the pure computation functions exported from services/analytics.ts:
 *   - computeWinLoss
 *   - computePnL
 *   - computeSectorConcentration
 *
 * These functions are tested by mocking the broker API (getBroker) to return
 * controlled mock data for holdings, trades, and positions.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/analytics.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computeWinLoss,
  computePnL,
  computeSectorConcentration,
  computeTaxSummary,
  computeMonthlyReturns,
} from '../services/analytics';

// ──── Mock Broker ───────────────────────────────────────────────────────────

const { mockBroker, mockHoldings, mockTrades } = vi.hoisted(() => {
  const holdings: any[] = [
    { symbol: 'RELIANCE', quantity: 10, ltp: 3200, unrealizedPnL: 5000, sector: 'ENERGY' },
    { symbol: 'TCS', quantity: 5, ltp: 4100, unrealizedPnL: 2000, sector: 'IT' },
    { symbol: 'INFY', quantity: 20, ltp: 1800, unrealizedPnL: -1000, sector: 'IT' },
    { symbol: 'HDFCBANK', quantity: 8, ltp: 1600, unrealizedPnL: 800, sector: 'FINANCE' },
    { symbol: 'SBIN', quantity: 15, ltp: 850, unrealizedPnL: 300, sector: 'FINANCE' },
  ];

  const trades: any[] = [
    { symbol: 'RELIANCE', pnl: 12000, tradingSymbol: 'RELIANCE', netValue: 35200 },
    { symbol: 'TCS', pnl: -3000, tradingSymbol: 'TCS', netValue: 20500 },
    { symbol: 'INFY', pnl: 8000, tradingSymbol: 'INFY', netValue: 44000 },
    { symbol: 'HDFCBANK', pnl: -1500, tradingSymbol: 'HDFCBANK', netValue: 12800 },
    { symbol: 'SBIN', pnl: 2000, tradingSymbol: 'SBIN', netValue: 12750 },
    { symbol: 'WIPRO', pnl: -500, tradingSymbol: 'WIPRO', netValue: 5100 },
    { symbol: 'ITC', pnl: 4500, tradingSymbol: 'ITC', netValue: 15200 },
    { symbol: 'BHARTIARTL', pnl: -800, tradingSymbol: 'BHARTIARTL', netValue: 9200 },
  ];

  const broker = {
    getHoldings: vi.fn().mockResolvedValue(holdings),
    getTradeHistory: vi.fn().mockResolvedValue(trades),
    getPositions: vi.fn().mockResolvedValue([]),
  };

  return { mockBroker: broker, mockHoldings: holdings, mockTrades: trades };
});

vi.mock('../services/broker', () => ({
  getBroker: vi.fn().mockResolvedValue(mockBroker),
}));

// ──── Tests ─────────────────────────────────────────────────────────────────

describe('computeWinLoss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute win rate from trades', async () => {
    const result = await computeWinLoss('test-user');
    // 8 total trades: 4 winning (12000, 8000, 2000, 4500), 4 losing (-3000, -1500, -500, -800)
    expect(result.totalTrades).toBe(8);
    expect(result.winningTrades).toBe(4);
    expect(result.losingTrades).toBe(4);
    expect(result.winRate).toBe(50);
  });

  it('should compute average win and loss', async () => {
    const result = await computeWinLoss('test-user');
    // Avg win: (12000 + 8000 + 2000 + 4500) / 4 = 6625
    expect(result.avgWin).toBe(6625);
    // Avg loss: (3000 + 1500 + 500 + 800) / 4 = 1450
    expect(result.avgLoss).toBe(1450);
  });

  it('should compute profit factor', async () => {
    const result = await computeWinLoss('test-user');
    // Gross profit: 12000 + 8000 + 2000 + 4500 = 26500
    // Gross loss: 3000 + 1500 + 500 + 800 = 5800
    // Profit factor: 26500 / 5800 = 4.57
    expect(result.profitFactor).toBe(4.57);
  });

  it('should report broker drag factor', async () => {
    const result = await computeWinLoss('test-user');
    expect(result.brokerDragFactor).toBe(0.05);
  });

  it('should handle empty trades gracefully', async () => {
    mockBroker.getTradeHistory.mockResolvedValueOnce([]);
    const result = await computeWinLoss('test-user');
    expect(result.totalTrades).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.profitFactor).toBe(0);
  });

  it('should handle all-winning trades', async () => {
    mockBroker.getTradeHistory.mockResolvedValueOnce([
      { symbol: 'RELIANCE', pnl: 1000, netValue: 1000 },
      { symbol: 'TCS', pnl: 2000, netValue: 2000 },
    ]);
    const result = await computeWinLoss('test-user');
    expect(result.winningTrades).toBe(2);
    expect(result.losingTrades).toBe(0);
    expect(result.winRate).toBe(100);
    // profitFactor should be 999999 when grossLoss === 0 && grossProfit > 0
    expect(result.profitFactor).toBe(999999);
  });

  it('should handle broker failure gracefully', async () => {
    const { getBroker } = await import('../services/broker');
    (getBroker as any).mockRejectedValueOnce(new Error('Broker unavailable'));
    const result = await computeWinLoss('test-user');
    expect(result.totalTrades).toBe(0);
    expect(result.winRate).toBe(0);
  });
});

describe('computePnL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute total realized P&L', async () => {
    const result = await computePnL('test-user');
    // 12000 + (-3000) + 8000 + (-1500) + 2000 + (-500) + 4500 + (-800) = 20700
    expect(result.totalRealizedPnL).toBe(20700);
  });

  it('should compute total unrealized P&L', async () => {
    const result = await computePnL('test-user');
    // 5000 + 2000 + (-1000) + 800 + 300 = 7100
    expect(result.totalUnrealizedPnL).toBe(7100);
  });

  it('should compute derived day/week/month/year P&L', async () => {
    const result = await computePnL('test-user');
    expect(result.dayPnL).toBe(207);      // 20700 * 0.01
    expect(result.weekPnL).toBe(1035);     // 20700 * 0.05
    expect(result.monthPnL).toBe(4140);    // 20700 * 0.20
    expect(result.yearPnL).toBe(20700);    // same as total
  });

  it('should identify best and worst trades', async () => {
    const result = await computePnL('test-user');
    // Best: RELIANCE with pnl 12000
    expect(result.bestTrade).toEqual({ symbol: 'RELIANCE', pnl: 12000 });
    // Worst: TCS with pnl -3000
    expect(result.worstTrade).toEqual({ symbol: 'TCS', pnl: -3000 });
  });

  it('should count total trades', async () => {
    const result = await computePnL('test-user');
    expect(result.tradeCount).toBe(8);
  });

  it('should handle empty holdings and trades', async () => {
    mockBroker.getHoldings.mockResolvedValueOnce([]);
    mockBroker.getTradeHistory.mockResolvedValueOnce([]);
    const result = await computePnL('test-user');
    expect(result.totalRealizedPnL).toBe(0);
    expect(result.totalUnrealizedPnL).toBe(0);
    expect(result.tradeCount).toBe(0);
    expect(result.bestTrade).toBeNull();
    expect(result.worstTrade).toBeNull();
  });
});

describe('computeSectorConcentration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should group holdings by sector', async () => {
    const result = await computeSectorConcentration('test-user');
    const sectorNames = result.sectors.map((s) => s.sector);
    expect(sectorNames).toContain('ENERGY');
    expect(sectorNames).toContain('IT');
    expect(sectorNames).toContain('FINANCE');
    expect(result.sectors.length).toBe(3);
  });

  it('should compute sector exposure correctly', async () => {
    const result = await computeSectorConcentration('test-user');
    // ENERGY: RELIANCE 10 * 3200 = 32000
    // IT: TCS 5 * 4100 = 20500, INFY 20 * 1800 = 36000 → total 56500
    // FINANCE: HDFCBANK 8 * 1600 = 12800, SBIN 15 * 850 = 12750 → total 25550
    // Total exposure: 32000 + 56500 + 25550 = 114050
    const energy = result.sectors.find((s) => s.sector === 'ENERGY')!;
    const it = result.sectors.find((s) => s.sector === 'IT')!;
    const finance = result.sectors.find((s) => s.sector === 'FINANCE')!;

    expect(energy.exposure).toBe(32000);
    expect(it.exposure).toBe(56500);
    expect(finance.exposure).toBe(25550);
    expect(result.totalExposure).toBe(114050);
  });

  it('should compute sector percentages', async () => {
    const result = await computeSectorConcentration('test-user');
    // ENERGY: 32000 / 114050 * 100 = 28.06%
    // IT: 56500 / 114050 * 100 = 49.54%
    // FINANCE: 25550 / 114050 * 100 = 22.40%
    const energy = result.sectors.find((s) => s.sector === 'ENERGY')!;
    const it = result.sectors.find((s) => s.sector === 'IT')!;

    expect(energy.percentage).toBe(28.06);
    expect(it.percentage).toBe(49.54);
  });

  it('should sort sectors by exposure descending', async () => {
    const result = await computeSectorConcentration('test-user');
    // IT (56500) > ENERGY (32000) > FINANCE (25550)
    expect(result.sectors[0].sector).toBe('IT');
    expect(result.sectors[1].sector).toBe('ENERGY');
    expect(result.sectors[2].sector).toBe('FINANCE');
  });

  it('should compute Herfindahl index', async () => {
    const result = await computeSectorConcentration('test-user');
    // HHI = (0.2806)^2 + (0.4954)^2 + (0.2240)^2
    // = 0.07874 + 0.24542 + 0.05018 = 0.37434
    expect(result.herfindahlIndex).toBeGreaterThan(0.3);
    expect(result.herfindahlIndex).toBeLessThan(0.5);
  });

  it('should flag as not diversified when HHI >= 0.25', async () => {
    const result = await computeSectorConcentration('test-user');
    expect(result.diversified).toBe(false);
  });

  it('should flag as diversified when holdings are spread', async () => {
    mockBroker.getHoldings.mockResolvedValueOnce([
      { symbol: 'A', quantity: 1, ltp: 100, sector: 'S1' },
      { symbol: 'B', quantity: 1, ltp: 100, sector: 'S2' },
      { symbol: 'C', quantity: 1, ltp: 100, sector: 'S3' },
      { symbol: 'D', quantity: 1, ltp: 100, sector: 'S4' },
      { symbol: 'E', quantity: 1, ltp: 100, sector: 'S5' },
    ]);
    const result = await computeSectorConcentration('test-user');
    // 5 sectors at 20% each → HHI = 0.04 + 0.04 + 0.04 + 0.04 + 0.04 = 0.20
    expect(result.diversified).toBe(true);
    expect(result.herfindahlIndex).toBeLessThan(0.25);
  });

  it('should handle empty holdings gracefully', async () => {
    mockBroker.getHoldings.mockResolvedValueOnce([]);
    const result = await computeSectorConcentration('test-user');
    expect(result.sectors).toEqual([]);
    expect(result.totalExposure).toBe(0);
    expect(result.herfindahlIndex).toBe(1);
    expect(result.diversified).toBe(false);
  });
});

describe('computeTaxSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute total realized gains from trades', async () => {
    const result = await computeTaxSummary('test-user', '2025-26');
    // 12000 + (-3000) + 8000 + (-1500) + 2000 + (-500) + 4500 + (-800) = 20700
    expect(result.totalRealizedGains).toBe(20700);
    expect(result.fiscalYear).toBe('2025-26');
  });

  it('should compute total unrealized gains from holdings', async () => {
    const result = await computeTaxSummary('test-user', '2025-26');
    // 5000 + 2000 + (-1000) + 800 + 300 = 7100
    expect(result.totalUnrealizedGains).toBe(7100);
  });

  it('should classify trades as STCG or LTCG', async () => {
    const result = await computeTaxSummary('test-user', '2025-26');
    // Heuristic: |pnl| < 2000 → STCG, else LTCG
    // STCG (|pnl| < 2000): HDFCBANK(-1500), WIPRO(-500), BHARTIARTL(-800) → sum = -2800
    // LTCG (|pnl| >= 2000): RELIANCE(12000), TCS(-3000), INFY(8000), SBIN(2000), ITC(4500) → sum = 23500
    expect(result.shortTermGains).toBe(-2800);
    expect(result.longTermGains).toBe(23500);
  });

  it('should compute estimated STCG tax at 15%', async () => {
    const result = await computeTaxSummary('test-user', '2025-26');
    // Positive STCG: max(-2800, 0) = 0 → tax: 0
    expect(result.estimatedTaxSTCG).toBe(0);
  });

  it('should compute estimated LTCG tax at 10% above 1L exemption', async () => {
    const result = await computeTaxSummary('test-user', '2025-26');
    // LTCG: 23500. Exemption: 100000. Taxable: max(23500 - 100000, 0) = 0
    expect(result.estimatedTaxLTCG).toBe(0);
  });

  it('should compute taxable gains for profitable scenarios', async () => {
    mockBroker.getTradeHistory.mockResolvedValueOnce([
      { symbol: 'RELIANCE', pnl: 200000, netValue: 500000 },
      { symbol: 'TCS', pnl: 50000, netValue: 300000 },
    ]);
    const result = await computeTaxSummary('test-user', '2025-26');
    // Both trades >= 2000 → LTCG. Sum: 250000, Taxable: max(250000-100000,0) = 150000
    // Tax: 150000 * 0.10 = 15000
    expect(result.longTermGains).toBe(250000);
    expect(result.estimatedTaxLTCG).toBe(15000);
    expect(result.taxableGains).toBe(150000);
  });

  it('should handle empty trades gracefully', async () => {
    mockBroker.getTradeHistory.mockResolvedValueOnce([]);
    mockBroker.getHoldings.mockResolvedValueOnce([]);
    const result = await computeTaxSummary('test-user', '2025-26');
    expect(result.totalRealizedGains).toBe(0);
    expect(result.totalUnrealizedGains).toBe(0);
    expect(result.tradeCount).toBe(0);
  });

  it('should handle broker failure gracefully', async () => {
    const { getBroker } = await import('../services/broker');
    (getBroker as any).mockRejectedValueOnce(new Error('Broker unavailable'));
    const result = await computeTaxSummary('test-user', '2025-26');
    expect(result.totalRealizedGains).toBe(0);
    expect(result.tradeCount).toBe(0);
  });
});

describe('computeMonthlyReturns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should distribute trades across months', async () => {
    const result = await computeMonthlyReturns('test-user');
    // 8 trades distributed across 6 months using index % 6
    expect(result.totalMonths).toBeGreaterThanOrEqual(3);
    expect(result.totalMonths).toBeLessThanOrEqual(6);
  });

  it('should identify best and worst months', async () => {
    const result = await computeMonthlyReturns('test-user');
    expect(result.bestMonth).not.toBeNull();
    expect(result.worstMonth).not.toBeNull();
    // Best month should have positive P&L
    expect(result.bestMonth!.totalPnL).toBeGreaterThan(0);
    // Worst should be <= best
    expect(result.worstMonth!.totalPnL).toBeLessThanOrEqual(result.bestMonth!.totalPnL);
  });

  it('should compute average monthly return', async () => {
    const result = await computeMonthlyReturns('test-user');
    if (result.totalMonths > 0) {
      expect(typeof result.averageMonthlyReturn).toBe('number');
    }
  });

  it('should include per-month trade counts summing to total', async () => {
    const result = await computeMonthlyReturns('test-user');
    const totalTrades = result.months.reduce((s, m) => s + m.tradeCount, 0);
    expect(totalTrades).toBe(8);
  });

  it('should sort months chronologically', async () => {
    const result = await computeMonthlyReturns('test-user');
    for (let i = 1; i < result.months.length; i++) {
      expect(result.months[i].month.localeCompare(result.months[i - 1].month)).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle empty trades gracefully', async () => {
    mockBroker.getTradeHistory.mockResolvedValueOnce([]);
    const result = await computeMonthlyReturns('test-user');
    expect(result.months).toEqual([]);
    expect(result.bestMonth).toBeNull();
    expect(result.worstMonth).toBeNull();
    expect(result.totalMonths).toBe(0);
  });

  it('should handle broker failure gracefully', async () => {
    const { getBroker } = await import('../services/broker');
    (getBroker as any).mockRejectedValueOnce(new Error('Broker unavailable'));
    const result = await computeMonthlyReturns('test-user');
    expect(result.months).toEqual([]);
    expect(result.totalMonths).toBe(0);
  });
});

describe('analytics error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('all three functions should fail gracefully on broker error', async () => {
    const { getBroker } = await import('../services/broker');
    (getBroker as any).mockRejectedValue(new Error('Connection refused'));

    const winLoss = await computeWinLoss('test-user');
    expect(winLoss.totalTrades).toBe(0);

    const pnl = await computePnL('test-user');
    expect(pnl.tradeCount).toBe(0);

    const sector = await computeSectorConcentration('test-user');
    expect(sector.sectors).toEqual([]);
  });
});
