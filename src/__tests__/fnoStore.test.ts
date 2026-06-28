/**
 * ============================================================================
 * Toroloom — F&O Store Unit Tests
 * ============================================================================
 *
 * Tests the fnoStore: initial state, symbol/expiry selection, fetch actions
 * (with API failure fallback), strategy leg management, and order modal state.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/fnoStore.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFnoStore } from '../store/fnoStore';
import type { OptionContract, StrategyLeg } from '../types';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const { mockFnoApi } = vi.hoisted(() => {
  const mockExpiries = {
    symbol: 'NIFTY',
    expiries: [
      { id: 'weekly_1', date: '2026-07-02T00:00:00.000Z', type: 'weekly', daysToExpiry: 5, isMonthly: false },
      { id: 'weekly_2', date: '2026-07-09T00:00:00.000Z', type: 'weekly', daysToExpiry: 12, isMonthly: false },
      { id: 'monthly_1', date: '2026-07-30T00:00:00.000Z', type: 'monthly', daysToExpiry: 33, isMonthly: true },
    ],
  };

  const mockChain = {
    underlying: 'NIFTY', underlyingPrice: 23456.80, spotPrice: 23456.80,
    expiry: '2026-07-02T00:00:00.000Z', expiryDate: '2026-07-02T00:00:00.000Z',
    rows: [
      {
        strike: 23450,
        ce: { strike: 23450, type: 'CE', ltp: 185.50, bid: 184, ask: 187, change: 5.20, changePercent: 2.88, iv: 14.5, delta: 0.55, gamma: 0.0025, theta: -0.85, vega: 0.15, rho: 0.02, volume: 50000, openInterest: 200000, oiChange: 5000, moneyness: 'ATM', intrinsicValue: 0, timeValue: 185.50 } as OptionContract,
        pe: { strike: 23450, type: 'PE', ltp: 172.30, bid: 171, ask: 174, change: -3.10, changePercent: -1.77, iv: 15.2, delta: -0.45, gamma: 0.0025, theta: -0.78, vega: 0.14, rho: -0.02, volume: 45000, openInterest: 180000, oiChange: -2000, moneyness: 'ATM', intrinsicValue: 0, timeValue: 172.30 } as OptionContract,
      },
    ],
    totalCEOi: 200000, totalPEOi: 180000, totalCEVolume: 50000, totalPEVolume: 45000,
    maxPain: 23450, pcr: 1.11,
  };

  const mockFutures = {
    symbol: 'NIFTY', spotPrice: 23456.80,
    futures: [
      { symbol: 'NIFTYW1', underlying: 'NIFTY', expiry: '2026-07-02T00:00:00.000Z', expiryDate: '2026-07-02T00:00:00.000Z', lotSize: 50, price: 23500.50, change: 44.20, changePercent: 0.19, openInterest: 500000, oiChange: 10000, oiChangePercent: 2.04, volume: 200000, basis: 43.70, basisPercent: 0.19 },
    ],
  };

  const mockPositions = [
    { id: 'fno_pos_1', symbol: 'NIFTY', type: 'CE', strike: 23500, expiry: '2026-07-02T00:00:00.000Z', action: 'buy', quantity: 1, lotSize: 50, entryPrice: 185.50, currentPrice: 210.30, premium: 185.50, pnl: 1240, pnlPercent: 13.37, timestamp: new Date().toISOString() },
  ];

  const mockSpotPrices = { NIFTY: 23456.80, BANKNIFTY: 49234.10, RELIANCE: 2890.50 };

  const mockAnalyzeResult = {
    spotPrice: 23456, maxProfit: 5000, maxLoss: -2000, maxProfitPercent: 21.31, maxLossPercent: -8.53,
    breakevenPoints: [23685], isBullish: true, isBearish: false, isNeutral: false, totalLegs: 1,
    pnlChart: [{ underlyingPrice: 22000, pnl: -5000, legPnls: [-5000] }],
  };

  const mockStrategies = [
    { id: 'long_call', name: 'Long Call', description: 'Buy a call', riskCategory: 'moderate', isBullish: true, isBearish: false, isNeutral: false, legs: [{ type: 'CE', action: 'buy', count: 1 }] },
  ];

  const mockPlaceOrderResult = {
    success: true, orderId: 'FNO_123', message: 'Order placed', type: 'CE', action: 'buy',
    symbol: 'NIFTY', strike: 23500, quantity: 1, lotSize: 50, price: 185.50,
    timestamp: new Date().toISOString(), status: 'confirmed',
  };

  return {
    mockFnoApi: {
      getExpiries: vi.fn().mockResolvedValue(mockExpiries),
      getOptionChain: vi.fn().mockResolvedValue(mockChain),
      getFutures: vi.fn().mockResolvedValue(mockFutures),
      getSpotPrices: vi.fn().mockResolvedValue(mockSpotPrices),
      getMarketStatus: vi.fn().mockResolvedValue({ isOpen: true, status: 'open', message: 'Open', currentTime: new Date().toISOString() }),
      placeOrder: vi.fn().mockResolvedValue(mockPlaceOrderResult),
      analyzeStrategy: vi.fn().mockResolvedValue(mockAnalyzeResult),
      getPrebuiltStrategies: vi.fn().mockResolvedValue(mockStrategies),
      getPositions: vi.fn().mockResolvedValue(mockPositions),
    },
    mockExpiries,
    mockChain,
    mockFutures,
    mockPositions,
    mockSpotPrices,
    mockAnalyzeResult,
  };
});

vi.mock('../services/api/fno', () => ({
  fnoApi: mockFnoApi,
}));

describe('F&O Store — Initial State', () => {
  beforeEach(() => {
    useFnoStore.setState({
      selectedSymbol: 'NIFTY',
      selectedExpiry: null,
      view: 'option-chain',
      chainSide: 'both',
      expiries: [],
      optionChain: null,
      futures: [],
      positions: [],
      spotPrices: {},
      strategyLegs: [],
      strategyResult: null,
      prebuiltStrategies: [],
      selectedStrategyName: 'Custom Strategy',
      chainLoading: false,
      futuresLoading: false,
      positionsLoading: false,
      strategyLoading: false,
      spotPricesLoading: false,
      showOrderModal: false,
      selectedContract: null,
      orderType: 'buy',
      orderQuantity: 1,
    });
    vi.clearAllMocks();
  });

  it('starts with default values', () => {
    const state = useFnoStore.getState();
    expect(state.selectedSymbol).toBe('NIFTY');
    expect(state.view).toBe('option-chain');
    expect(state.chainSide).toBe('both');
    expect(state.expiries).toEqual([]);
    expect(state.optionChain).toBeNull();
    expect(state.strategyLegs).toEqual([]);
    expect(state.showOrderModal).toBe(false);
  });
});

describe('F&O Store — Symbol & Expiry Selection', () => {
  beforeEach(() => {
    useFnoStore.setState({
      selectedSymbol: 'NIFTY',
      selectedExpiry: null,
      expiries: [],
      optionChain: null,
      futures: [],
    });
    vi.clearAllMocks();
  });

  it('setSelectedSymbol updates symbol and fetches expiries', async () => {
    useFnoStore.getState().setSelectedSymbol('BANKNIFTY');

    expect(useFnoStore.getState().selectedSymbol).toBe('BANKNIFTY');
    expect(useFnoStore.getState().optionChain).toBeNull();
    expect(mockFnoApi.getExpiries).toHaveBeenCalledWith('BANKNIFTY');
  });

  it('setSelectedExpiry updates expiry and fetches option chain', async () => {
    const expiry = { id: 'weekly_1', date: '2026-07-02T00:00:00.000Z', type: 'weekly' as const, daysToExpiry: 5, isMonthly: false };
    useFnoStore.getState().setSelectedExpiry(expiry);

    expect(useFnoStore.getState().selectedExpiry).toEqual(expiry);
    expect(mockFnoApi.getOptionChain).toHaveBeenCalledWith('NIFTY', expiry.date);
  });

  it('setView changes view tab', () => {
    useFnoStore.getState().setView('futures');
    expect(useFnoStore.getState().view).toBe('futures');

    useFnoStore.getState().setView('positions');
    expect(useFnoStore.getState().view).toBe('positions');
  });

  it('setChainSide changes side filter', () => {
    useFnoStore.getState().setChainSide('CE');
    expect(useFnoStore.getState().chainSide).toBe('CE');

    useFnoStore.getState().setChainSide('both');
    expect(useFnoStore.getState().chainSide).toBe('both');
  });
});

describe('F&O Store — fetchExpiries (API success)', () => {
  beforeEach(() => {
    useFnoStore.setState({ expiries: [], selectedExpiry: null, optionChain: null });
    vi.clearAllMocks();
  });

  it('fetches and stores expiries', async () => {
    await useFnoStore.getState().fetchExpiries('NIFTY');

    const state = useFnoStore.getState();
    expect(state.expiries).toHaveLength(3);
    expect(state.expiries[0].id).toBe('weekly_1');
  });

  it('auto-selects first expiry and fetches option chain', async () => {
    await useFnoStore.getState().fetchExpiries('NIFTY');

    const state = useFnoStore.getState();
    expect(state.selectedExpiry).toBeDefined();
    expect(state.selectedExpiry!.id).toBe('weekly_1');
    expect(mockFnoApi.getOptionChain).toHaveBeenCalledWith('NIFTY', '2026-07-02T00:00:00.000Z');
  });

  it('handles API failure gracefully', async () => {
    mockFnoApi.getExpiries.mockRejectedValueOnce(new Error('Network error'));

    await useFnoStore.getState().fetchExpiries('NIFTY');

    const state = useFnoStore.getState();
    expect(state.expiries).toEqual([]); // state unchanged on fail
  });
});

describe('F&O Store — fetchOptionChain (API success)', () => {
  beforeEach(() => {
    useFnoStore.setState({ optionChain: null, chainLoading: false });
    vi.clearAllMocks();
  });

  it('sets loading state and fetches option chain', async () => {
    const promise = useFnoStore.getState().fetchOptionChain('NIFTY');
    expect(useFnoStore.getState().chainLoading).toBe(true);

    await promise;
    const state = useFnoStore.getState();
    expect(state.chainLoading).toBe(false);
    expect(state.optionChain).toBeDefined();
    expect(state.optionChain!.underlying).toBe('NIFTY');
    expect(state.optionChain!.rows).toHaveLength(1);
  });

  it('handles API failure gracefully', async () => {
    mockFnoApi.getOptionChain.mockRejectedValueOnce(new Error('Network error'));

    await useFnoStore.getState().fetchOptionChain('NIFTY');

    const state = useFnoStore.getState();
    expect(state.chainLoading).toBe(false);
    expect(state.optionChain).toBeNull();
  });
});

describe('F&O Store — fetchFutures', () => {
  beforeEach(() => {
    useFnoStore.setState({ futures: [], futuresLoading: false });
    vi.clearAllMocks();
  });

  it('fetches and stores futures contracts', async () => {
    await useFnoStore.getState().fetchFutures('NIFTY');

    const state = useFnoStore.getState();
    expect(state.futuresLoading).toBe(false);
    expect(state.futures).toHaveLength(1);
    expect(state.futures[0].lotSize).toBe(50);
  });

  it('handles API failure gracefully', async () => {
    mockFnoApi.getFutures.mockRejectedValueOnce(new Error('Network error'));

    await useFnoStore.getState().fetchFutures('NIFTY');

    expect(useFnoStore.getState().futuresLoading).toBe(false);
    expect(useFnoStore.getState().futures).toEqual([]);
  });
});

describe('F&O Store — fetchPositions', () => {
  beforeEach(() => {
    useFnoStore.setState({ positions: [], positionsLoading: false });
    vi.clearAllMocks();
  });

  it('fetches and stores positions', async () => {
    await useFnoStore.getState().fetchPositions();

    const state = useFnoStore.getState();
    expect(state.positionsLoading).toBe(false);
    expect(state.positions).toHaveLength(1);
    expect(state.positions[0].symbol).toBe('NIFTY');
  });
});

describe('F&O Store — fetchSpotPrices', () => {
  beforeEach(() => {
    useFnoStore.setState({ spotPrices: {}, spotPricesLoading: false });
    vi.clearAllMocks();
  });

  it('fetches and stores spot prices', async () => {
    await useFnoStore.getState().fetchSpotPrices();

    const state = useFnoStore.getState();
    expect(state.spotPricesLoading).toBe(false);
    expect(state.spotPrices.NIFTY).toBe(23456.80);
  });
});

describe('F&O Store — Strategy Leg Management', () => {
  beforeEach(() => {
    useFnoStore.setState({ strategyLegs: [], strategyResult: null, selectedStrategyName: 'Custom Strategy' });
    vi.clearAllMocks();
  });

  it('addStrategyLeg adds a leg', () => {
    const leg: StrategyLeg = {
      id: 'leg_1', action: 'buy', type: 'CE', strike: 23500,
      expiry: '2026-07-02T00:00:00.000Z', quantity: 1, premium: 185, lotSize: 50,
    };
    useFnoStore.getState().addStrategyLeg(leg);

    expect(useFnoStore.getState().strategyLegs).toHaveLength(1);
    expect(useFnoStore.getState().strategyLegs[0].id).toBe('leg_1');
  });

  it('removeStrategyLeg removes a specific leg', () => {
    const leg1: StrategyLeg = { id: 'leg_1', action: 'buy', type: 'CE', strike: 23500, expiry: '2026-07-02', quantity: 1, premium: 185, lotSize: 50 };
    const leg2: StrategyLeg = { id: 'leg_2', action: 'sell', type: 'PE', strike: 23400, expiry: '2026-07-02', quantity: 1, premium: 120, lotSize: 50 };
    useFnoStore.getState().addStrategyLeg(leg1);
    useFnoStore.getState().addStrategyLeg(leg2);
    useFnoStore.setState({ strategyResult: { spotPrice: 23456, maxProfit: 5000, maxLoss: -2000, maxProfitPercent: 10, maxLossPercent: -5, breakevenPoints: [], isBullish: false, isBearish: false, isNeutral: true, totalLegs: 2, pnlChart: [] } });

    useFnoStore.getState().removeStrategyLeg('leg_1');

    expect(useFnoStore.getState().strategyLegs).toHaveLength(1);
    expect(useFnoStore.getState().strategyResult).toBeDefined(); // result preserved when legs remain
  });

  it('removeStrategyLeg clears strategyResult when last leg is removed', () => {
    const leg: StrategyLeg = { id: 'leg_1', action: 'buy', type: 'CE', strike: 23500, expiry: '2026-07-02', quantity: 1, premium: 185, lotSize: 50 };
    useFnoStore.getState().addStrategyLeg(leg);
    useFnoStore.setState({ strategyResult: { spotPrice: 23456, maxProfit: 5000, maxLoss: -2000, maxProfitPercent: 10, maxLossPercent: -5, breakevenPoints: [], isBullish: false, isBearish: false, isNeutral: true, totalLegs: 1, pnlChart: [] } });

    useFnoStore.getState().removeStrategyLeg('leg_1');

    expect(useFnoStore.getState().strategyLegs).toHaveLength(0);
    expect(useFnoStore.getState().strategyResult).toBeNull();
  })

  it('updateStrategyLeg updates leg fields', () => {
    const leg: StrategyLeg = { id: 'leg_1', action: 'buy', type: 'CE', strike: 23500, expiry: '2026-07-02', quantity: 1, premium: 185, lotSize: 50 };
    useFnoStore.getState().addStrategyLeg(leg);

    useFnoStore.getState().updateStrategyLeg('leg_1', { strike: 23600, premium: 200 });

    expect(useFnoStore.getState().strategyLegs[0].strike).toBe(23600);
    expect(useFnoStore.getState().strategyLegs[0].premium).toBe(200);
  });

  it('clearStrategyLegs clears legs and result', () => {
    const leg: StrategyLeg = { id: 'leg_1', action: 'buy', type: 'CE', strike: 23500, expiry: '2026-07-02', quantity: 1, premium: 185, lotSize: 50 };
    useFnoStore.getState().addStrategyLeg(leg);
    useFnoStore.getState().clearStrategyLegs();

    expect(useFnoStore.getState().strategyLegs).toEqual([]);
    expect(useFnoStore.getState().strategyResult).toBeNull();
  });

  it('setSelectedStrategyName updates name', () => {
    useFnoStore.getState().setSelectedStrategyName('Iron Condor');
    expect(useFnoStore.getState().selectedStrategyName).toBe('Iron Condor');
  });

  it('analyzeStrategy calls API with legs and stores result', async () => {
    const leg: StrategyLeg = { id: 'leg_1', action: 'buy', type: 'CE', strike: 23500, expiry: '2026-07-02', quantity: 1, premium: 185, lotSize: 50 };
    useFnoStore.getState().addStrategyLeg(leg);

    await useFnoStore.getState().analyzeStrategy(23456);

    expect(mockFnoApi.analyzeStrategy).toHaveBeenCalledWith({
      legs: [{ type: 'CE', strike: 23500, action: 'buy', premium: 185, quantity: 1 }],
      spotPrice: 23456,
    });
    const state = useFnoStore.getState();
    expect(state.strategyLoading).toBe(false);
    expect(state.strategyResult).toBeDefined();
    expect(state.strategyResult!.maxProfit).toBe(5000);
  });

  it('does not analyze with no legs', async () => {
    await useFnoStore.getState().analyzeStrategy(23456);
    expect(mockFnoApi.analyzeStrategy).not.toHaveBeenCalled();
  });
});

describe('F&O Store — Order Modal', () => {
  beforeEach(() => {
    useFnoStore.setState({
      showOrderModal: false, selectedContract: null, orderType: 'buy', orderQuantity: 1,
    });
    vi.clearAllMocks();
  });

  it('openOrderModal sets contract and type', () => {
    const contract: OptionContract = {
      strike: 23500, expiry: '2026-07-02', type: 'CE', ltp: 185.50, bid: 184, ask: 187,
      change: 0, changePercent: 0, iv: 14.5, delta: 0.55, gamma: 0.0025, theta: -0.85,
      vega: 0.15, rho: 0.02, volume: 50000, openInterest: 200000, oiChange: 0,
      moneyness: 'ATM', intrinsicValue: 0, timeValue: 185.50,
    };

    useFnoStore.getState().openOrderModal(contract, 'buy');

    const state = useFnoStore.getState();
    expect(state.showOrderModal).toBe(true);
    expect(state.selectedContract).toEqual(contract);
    expect(state.orderType).toBe('buy');
    expect(state.orderQuantity).toBe(1);
  });

  it('closeOrderModal resets modal state', () => {
    const contract: OptionContract = {
      strike: 23500, expiry: '2026-07-02', type: 'CE', ltp: 185.50, bid: 184, ask: 187,
      change: 0, changePercent: 0, iv: 14.5, delta: 0.55, gamma: 0.0025, theta: -0.85,
      vega: 0.15, rho: 0.02, volume: 50000, openInterest: 200000, oiChange: 0,
      moneyness: 'ATM', intrinsicValue: 0, timeValue: 185.50,
    };
    useFnoStore.getState().openOrderModal(contract, 'buy');
    useFnoStore.getState().closeOrderModal();

    const state = useFnoStore.getState();
    expect(state.showOrderModal).toBe(false);
    expect(state.selectedContract).toBeNull();
    expect(state.orderQuantity).toBe(1);
  });

  it('setOrderQuantity sets quantity (min 1)', () => {
    useFnoStore.getState().setOrderQuantity(5);
    expect(useFnoStore.getState().orderQuantity).toBe(5);

    useFnoStore.getState().setOrderQuantity(0);
    expect(useFnoStore.getState().orderQuantity).toBe(1); // min 1

    useFnoStore.getState().setOrderQuantity(-1);
    expect(useFnoStore.getState().orderQuantity).toBe(1); // min 1
  });

  it('placeOrder calls API and closes modal', async () => {
    const contract: OptionContract = {
      strike: 23500, expiry: '2026-07-02', type: 'CE', ltp: 185.50, bid: 184, ask: 187,
      change: 0, changePercent: 0, iv: 14.5, delta: 0.55, gamma: 0.0025, theta: -0.85,
      vega: 0.15, rho: 0.02, volume: 50000, openInterest: 200000, oiChange: 0,
      moneyness: 'ATM', intrinsicValue: 0, timeValue: 185.50,
    };
    useFnoStore.getState().openOrderModal(contract, 'buy');
    useFnoStore.getState().setSelectedExpiry({ id: 'w1', date: '2026-07-02T00:00:00.000Z', type: 'weekly', daysToExpiry: 5, isMonthly: false });

    await useFnoStore.getState().placeOrder();

    expect(mockFnoApi.placeOrder).toHaveBeenCalledWith({
      symbol: 'NIFTY',
      type: 'CE',
      action: 'buy',
      strike: 23500,
      expiry: '2026-07-02T00:00:00.000Z',
      quantity: 1,
      price: 185.50,
    });
    const state = useFnoStore.getState();
    expect(state.showOrderModal).toBe(false);
    expect(state.selectedContract).toBeNull();
  });

  it('placeOrder does nothing with no selectedContract', async () => {
    await useFnoStore.getState().placeOrder();
    expect(mockFnoApi.placeOrder).not.toHaveBeenCalled();
  });
});
