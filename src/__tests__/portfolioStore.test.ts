/**
 * ============================================================================
 * Toroloom — Portfolio Store Tests
 * ============================================================================
 *
 * Tests the portfolio store: buying and selling stocks, holding
 * management, and trade history.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { usePortfolioStore } from '../store/portfolioStore';
import { Stock } from '../types';

const mockStock: Stock = {
  id: 'RELIANCE',
  symbol: 'RELIANCE',
  name: 'Reliance Industries Ltd.',
  sector: 'Energy',
  price: 2890.50,
  change: 45.20,
  changePercent: 1.59,
  isPositive: true,
  marketCap: '₹19,56,000 Cr',
  volume: '12.5M',
  high52: 3020.00,
  low52: 2200.00,
  pe: 28.5,
  pb: 3.2,
  dividend: 0.85,
};

const mockStock2: Stock = {
  id: 'TCS',
  symbol: 'TCS',
  name: 'Tata Consultancy Services',
  sector: 'Technology',
  price: 3890.00,
  change: -34.50,
  changePercent: -0.88,
  isPositive: false,
  marketCap: '₹14,20,000 Cr',
  volume: '8.2M',
  high52: 4200.00,
  low52: 3300.00,
  pe: 35.2,
  pb: 12.5,
  dividend: 1.20,
};

describe('PortfolioStore — Initial State', () => {
  beforeEach(() => {
    usePortfolioStore.setState({
      holdings: [],
      trades: [],
      isLoading: false,
    });
  });

  it('starts with empty portfolio when reset', () => {
    const state = usePortfolioStore.getState();
    expect(state.holdings).toEqual([]);
    expect(state.trades).toEqual([]);
    expect(state.isLoading).toBe(false);
  });
});

describe('PortfolioStore — Buy Stock', () => {
  beforeEach(() => {
    usePortfolioStore.setState({
      holdings: [],
      trades: [],
      isLoading: false,
    });
  });

  it('adds a new holding on first buy', async () => {
    await usePortfolioStore.getState().buyStock(mockStock, 50, 2650);
    const state = usePortfolioStore.getState();
    expect(state.holdings).toHaveLength(1);
    expect(state.holdings[0].symbol).toBe('RELIANCE');
    expect(state.holdings[0].quantity).toBe(50);
    expect(state.holdings[0].buyPrice).toBe(2650);
    expect(state.holdings[0].totalInvested).toBe(132500); // 50 * 2650
  });

  it('records a trade on buy', async () => {
    await usePortfolioStore.getState().buyStock(mockStock, 50, 2650);
    const state = usePortfolioStore.getState();
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0].type).toBe('buy');
    expect(state.trades[0].quantity).toBe(50);
    expect(state.trades[0].price).toBe(2650);
    expect(state.trades[0].total).toBe(132500);
  });

  it('adds to existing holding on second buy', async () => {
    await usePortfolioStore.getState().buyStock(mockStock, 50, 2650);
    await usePortfolioStore.getState().buyStock(mockStock, 30, 2700);
    const state = usePortfolioStore.getState();
    expect(state.holdings).toHaveLength(1);
    expect(state.holdings[0].quantity).toBe(80);
    // Weighted average price: (50 * 2650 + 30 * 2700) / 80 = (132500 + 81000) / 80 = 2668.75
    expect(state.holdings[0].buyPrice).toBeCloseTo(2668.75, 1);
    expect(state.holdings[0].totalInvested).toBe(213500); // 132500 + 81000
  });

  it('prepends new trades to history', async () => {
    await usePortfolioStore.getState().buyStock(mockStock, 50, 2650);
    await usePortfolioStore.getState().buyStock(mockStock, 30, 2700);
    const state = usePortfolioStore.getState();
    expect(state.trades).toHaveLength(2);
    expect(state.trades[0].quantity).toBe(30); // most recent first
    expect(state.trades[1].quantity).toBe(50);
  });

  it('calculates P&L after buy', async () => {
    await usePortfolioStore.getState().buyStock(mockStock, 50, 2650);
    const state = usePortfolioStore.getState();
    // currentPrice is 2890.50, so P&L = 50 * (2890.50 - 2650) = 50 * 240.50 = 12025
    expect(state.holdings[0].currentValue).toBe(50 * 2890.50);
    expect(state.holdings[0].pnl).toBeCloseTo(12025, 0);
  });
});

describe('PortfolioStore — Sell Stock', () => {
  beforeEach(() => {
    usePortfolioStore.setState({
      holdings: [
        {
          id: 'h1',
          stockId: 'RELIANCE',
          symbol: 'RELIANCE',
          name: 'Reliance Industries Ltd.',
          quantity: 50,
          buyPrice: 2650,
          currentPrice: 2890.50,
          totalInvested: 132500,
          currentValue: 144525,
          pnl: 12025,
          pnlPercent: 9.08,
          dayChange: 2260,
          dayChangePercent: 1.59,
        },
      ],
      trades: [],
      isLoading: false,
    });
  });

  it('reduces holding quantity on partial sell', async () => {
    await usePortfolioStore.getState().sellStock('h1', 20, 2900);
    const state = usePortfolioStore.getState();
    expect(state.holdings).toHaveLength(1);
    expect(state.holdings[0].quantity).toBe(30);
    expect(state.holdings[0].totalInvested).toBeCloseTo(79500, 0); // 132500 * (30/50)
  });

  it('records a trade on sell', async () => {
    await usePortfolioStore.getState().sellStock('h1', 20, 2900);
    const state = usePortfolioStore.getState();
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0].type).toBe('sell');
    expect(state.trades[0].quantity).toBe(20);
    expect(state.trades[0].price).toBe(2900);
    expect(state.trades[0].total).toBe(58000);
  });

  it('removes holding on full sell', async () => {
    await usePortfolioStore.getState().sellStock('h1', 50, 2900);
    const state = usePortfolioStore.getState();
    expect(state.holdings).toHaveLength(0);
  });

  it('records trade on full sell', async () => {
    await usePortfolioStore.getState().sellStock('h1', 50, 2900);
    const state = usePortfolioStore.getState();
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0].type).toBe('sell');
    expect(state.trades[0].quantity).toBe(50);
  });

  it('removes holding if sell quantity >= holding quantity', async () => {
    await usePortfolioStore.getState().sellStock('h1', 100, 2900);
    const state = usePortfolioStore.getState();
    expect(state.holdings).toHaveLength(0);
    // Trade should record the actual held quantity
    expect(state.trades[0].quantity).toBe(50);
  });

  it('does nothing for non-existent holding', async () => {
    await usePortfolioStore.getState().sellStock('non_existent', 10, 2000);
    const state = usePortfolioStore.getState();
    expect(state.holdings).toHaveLength(1); // unchanged
    expect(state.trades).toHaveLength(0);
  });
});

describe('PortfolioStore — Multiple Holdings', () => {
  beforeEach(() => {
    usePortfolioStore.setState({
      holdings: [],
      trades: [],
      isLoading: false,
    });
  });

  it('buys multiple different stocks', async () => {
    await usePortfolioStore.getState().buyStock(mockStock, 50, 2650);
    await usePortfolioStore.getState().buyStock(mockStock2, 20, 3800);
    const state = usePortfolioStore.getState();
    expect(state.holdings).toHaveLength(2);
    expect(state.holdings[0].symbol).toBe('RELIANCE');
    expect(state.holdings[1].symbol).toBe('TCS');
  });

  it('handles buy + sell of different stocks independently', async () => {
    await usePortfolioStore.getState().buyStock(mockStock, 50, 2650);
    await usePortfolioStore.getState().buyStock(mockStock2, 20, 3800);
    await usePortfolioStore.getState().sellStock(
      usePortfolioStore.getState().holdings.find(h => h.symbol === 'RELIANCE')!.id,
      25,
      2900,
    );
    const state = usePortfolioStore.getState();
    expect(state.holdings).toHaveLength(2);
    expect(state.holdings[0].quantity).toBe(25); // 50 - 25
    expect(state.holdings[1].quantity).toBe(20); // unchanged
  });
});
