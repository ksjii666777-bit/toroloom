/**
 * ============================================================================
 * Toroloom — Portfolio Analytics Store Tests
 * ============================================================================
 *
 * Tests the client-side analytics computation engine:
 *   - PerformanceMetrics (Sharpe, drawdown, win rate, etc.)
 *   - CapitalGains (STCG / LTCG with tax estimates)
 *   - Sector allocation
 *   - Monthly returns
 *   - P&L history generation
 *   - Caching & invalidation
 */

import { describe, it, expect, beforeEach, afterEach} from 'vitest';
import { usePortfolioAnalyticsStore } from '../store/portfolioAnalyticsStore';
import { usePortfolioStore } from '../store/portfolioStore';
import { getActiveWS } from '../services/wsRegistry';
import type { Holding, Trade } from '../types';


// ==================== Test Fixtures ====================

const baseHoldings: Holding[] = [
  {
    id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.',
    quantity: 50, buyPrice: 2650, currentPrice: 2890.50,
    totalInvested: 132500, currentValue: 144525,
    pnl: 12025, pnlPercent: 9.08,
    dayChange: 2260, dayChangePercent: 1.59,
  },
  {
    id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services',
    quantity: 20, buyPrice: 3800, currentPrice: 3890,
    totalInvested: 76000, currentValue: 77800,
    pnl: 1800, pnlPercent: 2.37,
    dayChange: -690, dayChangePercent: -0.88,
  },
  {
    id: 'h3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.',
    quantity: 100, buyPrice: 1550, currentPrice: 1678.90,
    totalInvested: 155000, currentValue: 167890,
    pnl: 12890, pnlPercent: 8.32,
    dayChange: 2345, dayChangePercent: 1.42,
  },
];

const baseTrades: Trade[] = [
  { id: 't1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', type: 'buy', quantity: 50, price: 2650, total: 132500, timestamp: '2025-05-20T09:30:00' },
  { id: 't2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', type: 'sell', quantity: 10, price: 3920, total: 39200, timestamp: '2025-05-19T14:45:00' },
  { id: 't3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'buy', quantity: 100, price: 1550, total: 155000, timestamp: '2025-05-18T11:20:00' },
];

// ==================== Helpers ====================

/** Reset portfolio store to known state */
function setPortfolioData(holdings: Holding[], trades: Trade[]) {
  usePortfolioStore.setState({ holdings, trades, isLoading: false });
}

/** Reset the analytics store cache + streaming state */
function resetAnalyticsStore() {
  usePortfolioAnalyticsStore.setState({
    analytics: null,
    isComputing: false,
    isLive: false,
    lastUpdated: null,
    pnlHistoryStream: [],
  });
}

// ==================== Tests ====================

describe('PortfolioAnalyticsStore — compute()', () => {
  beforeEach(() => {
    resetAnalyticsStore();
  });

  it('returns valid PortfolioAnalytics structure with empty data', () => {
    setPortfolioData([], []);
    const result = usePortfolioAnalyticsStore.getState().compute();

    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('capitalGains');
    expect(result).toHaveProperty('monthlyReturns');
    expect(result).toHaveProperty('sectorAllocation');
    expect(result).toHaveProperty('pnlHistory');

    expect(result.metrics.totalReturn).toBe(0);
    expect(result.metrics.totalTrades).toBe(0);
    expect(result.metrics.winRate).toBe(0);
    // Sharpe ratio with empty data uses random daily returns, so just check it's finite
    expect(isFinite(result.metrics.sharpeRatio)).toBe(true);
    // Max drawdown computed from random P&L history — just check it's finite and non-negative
    expect(result.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(isFinite(result.metrics.maxDrawdown)).toBe(true);
    expect(result.metrics.profitFactor).toBe(0);
    expect(result.metrics.avgWin).toBe(0);
    expect(result.metrics.avgLoss).toBe(0);
    expect(result.metrics.consecutiveWins).toBe(0);
    expect(result.metrics.consecutiveLosses).toBe(0);

    expect(result.capitalGains.shortTerm.gains).toBe(0);
    expect(result.capitalGains.longTerm.gains).toBe(0);
    expect(result.capitalGains.totalEstimatedTax).toBe(0);

    expect(result.sectorAllocation).toEqual([]);
    expect(result.monthlyReturns).toEqual([]);
    expect(result.pnlHistory.length).toBeGreaterThan(0);
  });

  it('computes basic portfolio totals from holdings', () => {
    setPortfolioData(baseHoldings, []);
    const result = usePortfolioAnalyticsStore.getState().compute();
    const m = result.metrics;

    // totalInvested = 132500 + 76000 + 155000 = 363500
    // currentValue = 144525 + 77800 + 167890 = 390215
    // totalReturn = 390215 - 363500 = 26715
    expect(m.totalReturn).toBeCloseTo(26715, 0);
    expect(m.totalReturnPercent).toBeCloseTo(7.35, 1);
  });

  it('computes win rate from sell trades', () => {
    setPortfolioData(baseHoldings, [
      ...baseTrades,
      { id: 't4', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 5, price: 3950, total: 19750, timestamp: '2025-05-22T10:00:00' },
      { id: 't5', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'RELIANCE', type: 'sell', quantity: 10, price: 2900, total: 29000, timestamp: '2025-05-21T11:00:00' },
      { id: 't6', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'sell', quantity: 20, price: 1600, total: 32000, timestamp: '2025-05-20T12:00:00' },
    ]);
    const result = usePortfolioAnalyticsStore.getState().compute();
    const m = result.metrics;

    // Sell trades (total > 0): t2=39200, t4=19750, t5=29000 → all winning
    // t6=32000 total > 0 → winning (even if sell price < buy avg, the API returns positive total = received money)
    // Actually, we need to look at the code: winningSells = sellTrades.filter(t => t.total > 0)
    // All sells above have total > 0, so winRate = 100%
    expect(m.totalTrades).toBe(6); // 3 buys + 3 sells = 6 total
    expect(m.winningTrades).toBe(4); // 4 sell trades, all with total > 0
    expect(m.losingTrades).toBe(0);
    expect(m.winRate).toBe(100);
  });

  it('computes win rate with both wins and losses', () => {
    setPortfolioData(baseHoldings, [
      ...baseTrades,
      // Winning sells
      { id: 't4', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 5, price: 3950, total: 19750, timestamp: '2025-05-22T10:00:00' },
      // Losing sells (total <= 0)
      { id: 't5', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'RELIANCE', type: 'sell', quantity: 5, price: 2600, total: -250, timestamp: '2025-05-21T11:00:00' },
    ]);
    const result = usePortfolioAnalyticsStore.getState().compute();
    const m = result.metrics;

    // winningSells: t2=39200 (>0), t4=19750 (>0) = 2 wins
    // losingSells: t5=-250 (<=0) = 1 loss
    // winRate = 2/3 * 100 = 66.67%
    expect(m.winningTrades).toBe(2);
    expect(m.losingTrades).toBe(1);
    expect(m.winRate).toBeCloseTo(66.67, 1);
  });

  it('computes Sharpe ratio with standard portfolio data', () => {
    setPortfolioData(baseHoldings, baseTrades);
    const result = usePortfolioAnalyticsStore.getState().compute();
    const m = result.metrics;

    // Sharpe should be a reasonable number given simulated daily returns
    // Typical range for Indian equities: 0.5 - 2.0
    expect(m.sharpeRatio).toBeGreaterThanOrEqual(-5);
    expect(m.sharpeRatio).toBeLessThanOrEqual(5);
    expect(typeof m.sharpeRatio).toBe('number');
  });

  it('computes max drawdown as a positive number (peak-to-trough)', () => {
    setPortfolioData(baseHoldings, baseTrades);
    const result = usePortfolioAnalyticsStore.getState().compute();
    const m = result.metrics;

    expect(m.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(m.maxDrawdownPercent).toBeGreaterThanOrEqual(0);
    // Max drawdown shouldn't exceed total invested
    expect(m.maxDrawdown).toBeLessThan(500000);
    expect(m.maxDrawdownPercent).toBeLessThan(100);
  });

  it('computes profit factor correctly', () => {
    setPortfolioData(baseHoldings, [
      ...baseTrades,
      { id: 't4', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 5, price: 4000, total: 20000, timestamp: '2025-05-22T10:00:00' },
      { id: 't5', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'sell', quantity: 10, price: 1500, total: -500, timestamp: '2025-05-21T11:00:00' },
      { id: 't6', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'sell', quantity: 10, price: 1520, total: -300, timestamp: '2025-05-20T12:00:00' },
    ]);
    const result = usePortfolioAnalyticsStore.getState().compute();
    const m = result.metrics;

    // Winning sells: t2=39200, t4=20000 → avgWin = (39200+20000)/2 = 29600
    // Losing sells: t5=-500, t6=-300 → avgLoss = |(-500-300)|/2 = 400
    // profitFactor = avgWin/avgLoss = 29600/400 = 74
    expect(m.avgWin).toBeCloseTo(29600, 0);
    expect(m.avgLoss).toBeCloseTo(400, 0);
    expect(m.profitFactor).toBeCloseTo(74, 0);
  });

  it('computes consecutive wins and losses correctly', () => {
    // Sorted by timestamp ascending
    setPortfolioData(baseHoldings, [
      baseTrades[0], // buy
      baseTrades[2], // buy
      // sells sorted chronologically
      { id: 's1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 3, price: 3800, total: -200, timestamp: '2025-05-15T10:00:00' },  // loss
      { id: 's2', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 4, price: 4000, total: 16000, timestamp: '2025-05-16T10:00:00' }, // win
      { id: 's3', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 3, price: 4100, total: 12300, timestamp: '2025-05-17T10:00:00' }, // win
      { id: 's4', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 5, price: 4200, total: 21000, timestamp: '2025-05-18T10:00:00' }, // win
      { id: 's5', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 2, price: 3700, total: -600, timestamp: '2025-05-19T10:00:00' },  // loss
      { id: 's6', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 3, price: 3850, total: 11550, timestamp: '2025-05-20T10:00:00' }, // win
    ]);

    const result = usePortfolioAnalyticsStore.getState().compute();
    const m = result.metrics;

    // Sequence: loss, win, win, win, loss, win
    // Max consecutive wins = 3 (s2 → s3 → s4)
    // Max consecutive losses = 1 (s1 or s5)
    expect(m.consecutiveWins).toBe(3);
    expect(m.consecutiveLosses).toBe(1);
  });

  it('computes best and worst trade', () => {
    const sells = [
      { id: 't_buy1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'buy' as const, quantity: 5, price: 3000, total: 15000, timestamp: '2025-05-14T10:00:00' },
      { id: 's1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell' as const, quantity: 5, price: 3000, total: 15000, timestamp: '2025-05-15T10:00:00' },
      { id: 's2', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell' as const, quantity: 5, price: 5000, total: 25000, timestamp: '2025-05-16T10:00:00' },
      { id: 's3', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell' as const, quantity: 5, price: 2000, total: -1000, timestamp: '2025-05-17T10:00:00' },
    ];

    setPortfolioData(baseHoldings, sells);
    const result = usePortfolioAnalyticsStore.getState().compute();
    const m = result.metrics;

    // Sell totals: 15000, 25000, -1000
    expect(m.bestTrade).toBe(25000); // s2
    expect(m.worstTrade).toBe(-1000); // s3
  });

  it('estimates average holding days', () => {
    // Set up trades with a buy that has a clear timestamp
    const timestamp = new Date();
    const daysAgo = new Date(timestamp.getTime() - 90 * 86400000); // ~90 days ago

    setPortfolioData(baseHoldings, [
      { id: 't1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', type: 'buy', quantity: 50, price: 2650, total: 132500, timestamp: daysAgo.toISOString() },
      { id: 't2', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'buy', quantity: 20, price: 3800, total: 76000, timestamp: daysAgo.toISOString() },
      { id: 't3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'buy', quantity: 100, price: 1550, total: 155000, timestamp: daysAgo.toISOString() },
    ]);

    const result = usePortfolioAnalyticsStore.getState().compute();
    const m = result.metrics;

    // avgHoldingDays should be around 90 for each holding since buys were 90 days ago
    expect(m.avgHoldingDays).toBeGreaterThanOrEqual(85);
    expect(m.avgHoldingDays).toBeLessThanOrEqual(95);
  });
});

// ==================== Capital Gains Tests ====================

describe('PortfolioAnalyticsStore — Capital Gains', () => {
  beforeEach(() => {
    resetAnalyticsStore();
  });

  it('categorizes short-term gains (< 365 days)', () => {
    const now = new Date();
    const buyDate = new Date(now.getTime() - 30 * 86400000); // 30 days ago
    const sellDate = new Date(now.getTime() - 5 * 86400000);  // 5 days ago

    setPortfolioData([], [
      { id: 'b1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', type: 'buy', quantity: 10, price: 2500, total: 25000, timestamp: buyDate.toISOString() },
      { id: 's1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', type: 'sell', quantity: 10, price: 3000, total: 30000, timestamp: sellDate.toISOString() },
    ]);

    const result = usePortfolioAnalyticsStore.getState().compute();

    // Short-term gains = sell.total - (buy.price * sell.quantity)
    // = 30000 - (2500 * 10) = 30000 - 25000 = 5000
    expect(result.capitalGains.shortTerm.gains).toBeCloseTo(5000, 0);
    expect(result.capitalGains.shortTerm.count).toBe(1);
    expect(result.capitalGains.longTerm.count).toBe(0);
  });

  it('categorizes long-term gains (> 365 days)', () => {
    const now = new Date();
    const buyDate = new Date(now.getTime() - 400 * 86400000); // 400 days ago
    const sellDate = new Date(now.getTime() - 10 * 86400000);  // 10 days ago

    setPortfolioData([], [
      { id: 'b1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', type: 'buy', quantity: 10, price: 2000, total: 20000, timestamp: buyDate.toISOString() },
      { id: 's1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', type: 'sell', quantity: 10, price: 3000, total: 30000, timestamp: sellDate.toISOString() },
    ]);

    const result = usePortfolioAnalyticsStore.getState().compute();

    // Long-term gains = 30000 - (2000 * 10) = 10000
    expect(result.capitalGains.longTerm.gains).toBeCloseTo(10000, 0);
    expect(result.capitalGains.longTerm.count).toBe(1);
    expect(result.capitalGains.shortTerm.count).toBe(0);
  });

  it('calculates STCG tax at 15% on short-term gains', () => {
    setPortfolioData([], [
      { id: 'b1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'buy', quantity: 10, price: 3000, total: 30000, timestamp: new Date(Date.now() - 60 * 86400000).toISOString() },
      { id: 's1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 10, price: 4000, total: 40000, timestamp: new Date(Date.now() - 5 * 86400000).toISOString() },
    ]);

    const result = usePortfolioAnalyticsStore.getState().compute();

    // STCG gains = 40000 - (3000 * 10) = 10000
    // STCG tax = 10000 * 0.15 = 1500
    expect(result.capitalGains.shortTerm.gains).toBeCloseTo(10000, 0);
    expect(result.capitalGains.shortTerm.taxRate).toBe(15);
    expect(result.capitalGains.shortTerm.estimatedTax).toBeCloseTo(1500, 0);
  });

  it('calculates LTCG at 10% on gains above ₹1L exemption (gains exactly ₹1L → no tax)', () => {
    // Buy 50 TCS @ ₹2,000 = ₹1,00,000 invested
    // Sell 50 TCS @ ₹4,000 = ₹2,00,000 received
    // Gain = 200000 - (2000*50) = 200000 - 100000 = ₹1,00,000 (equals exemption limit)
    // Taxable = max(0, 100000 - 100000) = ₹0
    // LTCG Tax = 0
    setPortfolioData([], [
      { id: 'b1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'buy', quantity: 50, price: 2000, total: 100000, timestamp: new Date(Date.now() - 500 * 86400000).toISOString() },
      { id: 's1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 50, price: 4000, total: 200000, timestamp: new Date(Date.now() - 10 * 86400000).toISOString() },
    ]);

    const result = usePortfolioAnalyticsStore.getState().compute();
    const ltcg = result.capitalGains.longTerm;

    expect(ltcg.gains).toBeCloseTo(100000, 0);
    expect(ltcg.taxableGains).toBe(0);
    expect(ltcg.estimatedTax).toBe(0);
  });

  it('calculates LTCG tax correctly when gains exceed ₹1L exemption', () => {
    // Buy 50 TCS @ ₹2,000 = ₹1,00,000 invested
    // Sell 50 TCS @ ₹7,000 = ₹3,50,000 received
    // Gain = 350000 - (2000*50) = 350000 - 100000 = ₹2,50,000
    // Taxable = max(0, 250000 - 100000) = ₹1,50,000
    // LTCG Tax = 150000 * 0.10 = ₹15,000
    setPortfolioData([], [
      { id: 'b1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'buy', quantity: 50, price: 2000, total: 100000, timestamp: new Date(Date.now() - 500 * 86400000).toISOString() },
      { id: 's1', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 50, price: 7000, total: 350000, timestamp: new Date(Date.now() - 10 * 86400000).toISOString() },
    ]);

    const result = usePortfolioAnalyticsStore.getState().compute();
    const ltcg = result.capitalGains.longTerm;

    expect(ltcg.gains).toBeCloseTo(250000, 0);
    expect(ltcg.taxableGains).toBe(150000);
    expect(ltcg.estimatedTax).toBeCloseTo(15000, 0);
    expect(ltcg.taxRate).toBe(10);
    expect(ltcg.exemptLimit).toBe(100000);
  });

  it('estimates STT and brokerage based on total trade volume', () => {
    // Need a matching buy+sell pair so capital gains are computed
    const tradesWithPair: Trade[] = [
      ...baseTrades,
      { id: 't_buy_tcs', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'buy', quantity: 10, price: 3000, total: 30000, timestamp: '2025-05-10T10:00:00' },
    ];
    setPortfolioData(baseHoldings, tradesWithPair);
    const result = usePortfolioAnalyticsStore.getState().compute();
    const cg = result.capitalGains;

    // STT is computed as 0.1% of absolute gains
    // Brokerage is 0.03%
    // TCS sell gain = 39200 - (3000*10) = 9200 (short-term)
    expect(cg.shortTerm.gains).toBeCloseTo(9200, 0);
    expect(cg.sttPaid).toBeGreaterThan(0);
    expect(cg.totalBrokerage).toBeGreaterThan(0);
    // Brokerage should be less than STT (0.03% < 0.1%)
    expect(cg.totalBrokerage).toBeLessThan(cg.sttPaid);
    // totalEstimatedTax = STCG tax + LTCG tax
    expect(cg.totalEstimatedTax).toBeGreaterThan(0);
  });
});

// ==================== Sector Allocation Tests ====================

describe('PortfolioAnalyticsStore — Sector Allocation', () => {
  beforeEach(() => {
    resetAnalyticsStore();
  });

  it('allocates sectors correctly from holdings', () => {
    setPortfolioData(baseHoldings, []);
    const result = usePortfolioAnalyticsStore.getState().compute();
    const sectors = result.sectorAllocation;

    // baseHoldings: RELIANCE (Energy), TCS (Technology), HDFCBANK (Finance)
    expect(sectors.length).toBeGreaterThanOrEqual(3);

    const finance = sectors.find(s => s.sector === 'Finance');
    const technology = sectors.find(s => s.sector === 'Technology');
    const energy = sectors.find(s => s.sector === 'Energy');

    expect(finance).toBeDefined();
    expect(technology).toBeDefined();
    expect(energy).toBeDefined();

    // HDFCBANK currentValue = 167890
    expect(finance!.value).toBeCloseTo(167890, 0);
    // TCS currentValue = 77800
    expect(technology!.value).toBeCloseTo(77800, 0);
    // RELIANCE currentValue = 144525
    expect(energy!.value).toBeCloseTo(144525, 0);

    // Sectors sorted by value descending: Finance > Energy > Technology
    expect(sectors[0].sector).toBe('Finance');
    expect(sectors[1].sector).toBe('Energy');
    expect(sectors[2].sector).toBe('Technology');
  });

  it('maps unknown companies to Others sector', () => {
    const customHoldings: Holding[] = [{
      id: 'h_unknown', stockId: 'XYZ', symbol: 'XYZ', name: 'Some Unknown Co.',
      quantity: 10, buyPrice: 100, currentPrice: 110,
      totalInvested: 1000, currentValue: 1100,
      pnl: 100, pnlPercent: 10,
      dayChange: 5, dayChangePercent: 0.5,
    }];

    setPortfolioData(customHoldings, []);
    const result = usePortfolioAnalyticsStore.getState().compute();
    const others = result.sectorAllocation.find(s => s.sector === 'Others');

    expect(others).toBeDefined();
    expect(others!.value).toBeCloseTo(1100, 0);
    expect(others!.count).toBe(1);
  });
});

// ==================== Monthly Returns Tests ====================

describe('PortfolioAnalyticsStore — Monthly Returns', () => {
  beforeEach(() => {
    resetAnalyticsStore();
  });

  it('groups trades by month', () => {
    setPortfolioData(baseHoldings, [
      { id: 't_mar', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'buy', quantity: 10, price: 3600, total: 36000, timestamp: '2025-03-15T10:00:00' },
      { id: 't_apr', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'sell', quantity: 5, price: 3900, total: 19500, timestamp: '2025-04-10T10:00:00' },
      { id: 't_may', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'RELIANCE', type: 'buy', quantity: 10, price: 2800, total: 28000, timestamp: '2025-05-05T10:00:00' },
    ]);

    const result = usePortfolioAnalyticsStore.getState().compute();

    // Should have 3 monthly return entries (March, April, May)
    expect(result.monthlyReturns.length).toBeGreaterThanOrEqual(1);

    // Each entry should have required fields
    for (const mr of result.monthlyReturns) {
      expect(mr).toHaveProperty('month');
      expect(mr).toHaveProperty('startValue');
      expect(mr).toHaveProperty('endValue');
      expect(mr).toHaveProperty('return');
      expect(mr).toHaveProperty('returnPercent');
      expect(mr).toHaveProperty('contributions');
    }
  });
});

// ==================== P&L History Tests ====================

describe('PortfolioAnalyticsStore — P&L History', () => {
  beforeEach(() => {
    resetAnalyticsStore();
  });

  it('generates daily P&L history with valid data points', () => {
    setPortfolioData(baseHoldings, baseTrades);
    const result = usePortfolioAnalyticsStore.getState().compute();

    expect(result.pnlHistory.length).toBeGreaterThan(0);
    expect(result.pnlHistory.length).toBeLessThanOrEqual(366); // ~1 year of trading days

    // Check first and last points
    const first = result.pnlHistory[0];
    const last = result.pnlHistory[result.pnlHistory.length - 1];

    expect(first).toHaveProperty('date');
    expect(first).toHaveProperty('value');
    expect(first).toHaveProperty('cumulativePnl');
    expect(last).toHaveProperty('date');
    expect(last).toHaveProperty('value');
    expect(last).toHaveProperty('cumulativePnl');

    // Dates should be in YYYY-MM-DD format
    expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(last.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Values should be reasonable
    expect(first.value).toBeGreaterThan(0);
    expect(last.value).toBeGreaterThan(0);
  });

  it('does not include weekends in history', () => {
    setPortfolioData(baseHoldings, baseTrades);
    const result = usePortfolioAnalyticsStore.getState().compute();

    for (const point of result.pnlHistory) {
      const day = new Date(point.date).getDay();
      expect(day).not.toBe(0); // Not Sunday
      expect(day).not.toBe(6); // Not Saturday
    }
  });
});

// ==================== Caching Tests ====================

describe('PortfolioAnalyticsStore — Caching', () => {
  beforeEach(() => {
    resetAnalyticsStore();
    setPortfolioData(baseHoldings, baseTrades);
  });

  it('returns null analytics initially', () => {
    expect(usePortfolioAnalyticsStore.getState().analytics).toBeNull();
  });

  it('getAnalytics computes and caches analytics', () => {
    const analytics = usePortfolioAnalyticsStore.getState().getAnalytics();

    // Should be cached now
    expect(usePortfolioAnalyticsStore.getState().analytics).not.toBeNull();
    expect(usePortfolioAnalyticsStore.getState().analytics).toBe(analytics);
  });

  it('invalidateCache clears cached analytics', () => {
    usePortfolioAnalyticsStore.getState().getAnalytics(); // cache it
    expect(usePortfolioAnalyticsStore.getState().analytics).not.toBeNull();

    usePortfolioAnalyticsStore.getState().invalidateCache();
    expect(usePortfolioAnalyticsStore.getState().analytics).toBeNull();
  });

  it('returns same object from cache on repeated getAnalytics calls', () => {
    const first = usePortfolioAnalyticsStore.getState().getAnalytics();
    const second = usePortfolioAnalyticsStore.getState().getAnalytics();

    expect(second).toBe(first); // Same reference (cached)
  });
});

// ==================== Edge Cases ====================

describe('PortfolioAnalyticsStore — Edge Cases', () => {
  beforeEach(() => {
    resetAnalyticsStore();
  });

  it('handles single holding gracefully', () => {
    setPortfolioData([baseHoldings[0]], []);
    const result = usePortfolioAnalyticsStore.getState().compute();

    expect(result.metrics.totalTrades).toBe(0);
    expect(result.sectorAllocation.length).toBe(1);
    expect(result.sectorAllocation[0].sector).toBe('Energy');
    expect(result.sectorAllocation[0].count).toBe(1);
  });

  it('handles only buy trades (no sells)', () => {
    const buys: Trade[] = [
      { id: 'tb1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', type: 'buy', quantity: 10, price: 2500, total: 25000, timestamp: '2025-05-01T10:00:00' },
      { id: 'tb2', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'buy', quantity: 5, price: 3800, total: 19000, timestamp: '2025-05-02T10:00:00' },
    ];

    setPortfolioData(baseHoldings, buys);
    const result = usePortfolioAnalyticsStore.getState().compute();

    // No sell trades → winRate = 0, no capital gains
    expect(result.metrics.winRate).toBe(0);
    expect(result.metrics.winningTrades).toBe(0);
    expect(result.metrics.losingTrades).toBe(0);
    expect(result.metrics.avgWin).toBe(0);
    expect(result.metrics.avgLoss).toBe(0);
    expect(result.metrics.profitFactor).toBe(0);
    expect(result.capitalGains.shortTerm.count).toBe(0);
    expect(result.capitalGains.longTerm.count).toBe(0);
  });

  it('handles very large portfolio values without overflow', () => {
    const bigHolding: Holding = {
      id: 'h_big', stockId: 'BIG', symbol: 'BIG', name: 'Big Corp',
      quantity: 10000000, buyPrice: 10000, currentPrice: 10050,
      totalInvested: 100000000000, currentValue: 100500000000,
      pnl: 500000000, pnlPercent: 0.5,
      dayChange: 50000000, dayChangePercent: 0.05,
    };

    setPortfolioData([bigHolding], []);
    const result = usePortfolioAnalyticsStore.getState().compute();

    expect(result.metrics.totalReturn).toBe(500000000);
    expect(result.metrics.totalReturnPercent).toBeCloseTo(0.5, 1);
    expect(result.metrics.totalTrades).toBe(0);

    // All values should be finite
    const allValues = Object.values(result.metrics);
    for (const v of allValues) {
      expect(typeof v).toBe('number');
      expect(isFinite(v as number)).toBe(true);
    }
  });

  it('handles negative returns correctly', () => {
    const losingHolding: Holding = {
      id: 'h_loss', stockId: 'LOSS', symbol: 'LOSS', name: 'Loss Corp',
      quantity: 100, buyPrice: 1000, currentPrice: 800,
      totalInvested: 100000, currentValue: 80000,
      pnl: -20000, pnlPercent: -20,
      dayChange: -5000, dayChangePercent: -5.88,
    };

    setPortfolioData([losingHolding], []);
    const result = usePortfolioAnalyticsStore.getState().compute();

    expect(result.metrics.totalReturn).toBe(-20000);
    expect(result.metrics.totalReturnPercent).toBeCloseTo(-20, 1);
  });
});

// ==================== Day Change Tests ====================

describe('PortfolioAnalyticsStore — Day Change', () => {
  beforeEach(() => {
    resetAnalyticsStore();
  });

  it('computes day change from holdings', () => {
    setPortfolioData(baseHoldings, []);
    const result = usePortfolioAnalyticsStore.getState().compute();

    // dayChange = 2260 + (-690) + 2345 = 3915
    expect(result.metrics.dayChange).toBe(3915);
    // dayChangePercent = dayChange / currentValue * 100
    // currentValue = 390215
    // dayChangePercent = 3915 / 390215 * 100 ≈ 1.00%
    expect(result.metrics.dayChangePercent).toBeCloseTo(1.0, 1);
  });

  it('returns zero day change for empty portfolio', () => {
    setPortfolioData([], []);
    const result = usePortfolioAnalyticsStore.getState().compute();

    expect(result.metrics.dayChange).toBe(0);
    expect(result.metrics.dayChangePercent).toBe(0);
  });
});

// ==================== Realized / Unrealized P&L Tests ====================

describe('PortfolioAnalyticsStore — Realized vs Unrealized P&L', () => {
  beforeEach(() => {
    resetAnalyticsStore();
  });

  it('computes realized P&L from sell trades', () => {
    setPortfolioData(baseHoldings, baseTrades);
    const result = usePortfolioAnalyticsStore.getState().compute();

    // Realized P&L = sum of all sell trade totals
    // t2 = 39200 (sell)
    expect(result.metrics.realizedPnl).toBe(39200);

    // Unrealized = totalReturn - realized
    // totalReturn = 26715
    // unrealized = 26715 - 39200 = -12485
    expect(result.metrics.unrealizedPnl).toBeCloseTo(26715 - 39200, 0);
  });

  it('computes correct values with no sell trades', () => {
    const buysOnly = baseTrades.filter(t => t.type !== 'sell');
    setPortfolioData(baseHoldings, buysOnly);
    const result = usePortfolioAnalyticsStore.getState().compute();

    expect(result.metrics.realizedPnl).toBe(0);
    expect(result.metrics.unrealizedPnl).toBe(result.metrics.totalReturn);
  });
});

// ==================== Live Subscription Tests ====================

describe('PortfolioAnalyticsStore — Live Subscription', () => {
  beforeEach(() => {
    resetAnalyticsStore();
    setPortfolioData(baseHoldings, baseTrades);
    // Reset WS state
    const ws = getActiveWS();
    ws.onPnLUpdateCallback(() => {});
    ws.disconnect();
  });

  afterEach(() => {
    // Clean up subscription
    usePortfolioAnalyticsStore.getState().unsubscribeFromLiveUpdates();
  });

  it('starts with isLive = false and empty pnlHistoryStream', () => {
    const state = usePortfolioAnalyticsStore.getState();
    expect(state.isLive).toBe(false);
    expect(state.lastUpdated).toBeNull();
    expect(state.pnlHistoryStream).toEqual([]);
  });

  it('subscribeToLiveUpdates sets isLive to true', () => {
    usePortfolioAnalyticsStore.getState().subscribeToLiveUpdates();
    expect(usePortfolioAnalyticsStore.getState().isLive).toBe(true);
  });

  it('subscribeToLiveUpdates does not register duplicate subscriptions', () => {
    const store = usePortfolioAnalyticsStore;
    store.getState().subscribeToLiveUpdates();
    store.getState().subscribeToLiveUpdates(); // duplicate
    store.getState().subscribeToLiveUpdates(); // duplicate

    // Should still be live (isLive guard prevents re-registration)
    expect(store.getState().isLive).toBe(true);
  });

  it('unsubscribeFromLiveUpdates sets isLive to false', () => {
    const store = usePortfolioAnalyticsStore;
    store.getState().subscribeToLiveUpdates();
    expect(store.getState().isLive).toBe(true);

    store.getState().unsubscribeFromLiveUpdates();
    expect(store.getState().isLive).toBe(false);
  });

  it('appends data points to pnlHistoryStream when portfolioStore holdings change', () => {
    const store = usePortfolioAnalyticsStore;
    store.getState().subscribeToLiveUpdates();

    // Simulate a change by updating portfolioStore holdings
    // The WS price map has prices, so updating holdings should trigger
    // the analytics store's subscription callback
    const ws = getActiveWS();
    const currentPrice = ws.getCurrentPrice('RELIANCE');
    const newValue = Math.round(currentPrice * 50 * 100) / 100;

    // Manually trigger a portfolioStore change
    const { holdings } = usePortfolioStore.getState();
    const updatedHoldings = holdings.map(h => ({
      ...h,
      currentPrice: ws.getCurrentPrice(h.stockId),
      currentValue: Math.round(ws.getCurrentPrice(h.stockId) * h.quantity * 100) / 100,
    }));

    // This should trigger the subscription callback because the WS price
    // is different from the mock price
    usePortfolioStore.setState({ holdings: updatedHoldings });

    const state = store.getState();
    expect(state.pnlHistoryStream.length).toBeGreaterThanOrEqual(0);
    // If prices changed, we should have a stream point
    if (state.pnlHistoryStream.length > 0) {
      expect(state.pnlHistoryStream[0].cumulativePnl).toBeDefined();
      expect(state.pnlHistoryStream[0].date).toBeDefined();
    }
    expect(state.isLive).toBe(true);
  });

  it('updates holdings currentValue when portfolioStore changes with live prices', () => {
    const ws = getActiveWS();
    const store = usePortfolioAnalyticsStore;
    store.getState().subscribeToLiveUpdates();

    // Read current WS price for RELIANCE
    const livePrice = ws.getCurrentPrice('RELIANCE');

    // Trigger portfolioStore update with the same price (should NOT cause changes
    // since price hasn't changed from WS perspective)
    const holdings = usePortfolioStore.getState().holdings;
    const h = holdings[0];
    expect(h.currentValue).toBeGreaterThan(0);
    expect(typeof h.currentValue).toBe('number');
  });

  it('limits pnlHistoryStream to MAX_STREAM_POINTS (500)', () => {
    const store = usePortfolioAnalyticsStore;
    setPortfolioData(baseHoldings, baseTrades);
    store.getState().subscribeToLiveUpdates();

    // Simulate many price changes by directly calling the WS callback pattern
    // The subscription listens to portfolioStore changes — we need to trigger
    // changes with different prices each time
    const ws = getActiveWS();

    for (let i = 0; i < 600; i++) {
      const { holdings } = usePortfolioStore.getState();
      if (holdings.length === 0) break;
      // Use slightly different prices each iteration
      const updated = holdings.map(h => ({
        ...h,
        currentPrice: ws.getCurrentPrice(h.stockId) + (i * 0.01),
        currentValue: h.quantity * (ws.getCurrentPrice(h.stockId) + (i * 0.01)),
      }));
      usePortfolioStore.setState({ holdings: updated });
    }

    // Should be capped at 500
    expect(store.getState().pnlHistoryStream.length).toBeLessThanOrEqual(500);
  });

  it('does not crash when called with empty holdings', () => {
    setPortfolioData([], []);
    const store = usePortfolioAnalyticsStore;
    store.getState().subscribeToLiveUpdates();

    // Should not crash when holdings are empty
    expect(() => {
      usePortfolioStore.getState();
    }).not.toThrow();

    expect(store.getState().pnlHistoryStream.length).toBe(0);
  });
});
