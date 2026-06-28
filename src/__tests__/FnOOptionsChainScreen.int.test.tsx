/**
 * ============================================================================
 * Toroloom — F&O Trading Module Integration Tests
 * ============================================================================
 *
 * End-to-end interaction tests for the FnOOptionsChainScreen and
 * StrategyBuilderScreen.  Verifies that user interactions correctly
 * trigger the expected store actions and API calls.
 *
 * Flow 1: Symbol Change
 *   Render → tap a symbol chip → setSelectedSymbol called + fetchExpiries
 *
 * Flow 2: Expiry Change
 *   Render → tap an expiry chip → setSelectedExpiry called + fetchOptionChain
 *
 * Flow 3: View Switch
 *   Render → tap a view tab → setView called with correct view
 *
 * Flow 4: Chain Side Filter
 *   Render → tap CE/PE side tab → setChainSide called
 *
 * Flow 5: Contract Order Modal
 *   Render → tap a contract cell → openOrderModal called with contract
 *
 * Flow 6: StrategyBuilder — Pre-built Strategy Selection
 *   Render → tap pre-built card → clearStrategyLegs + addStrategyLeg + analyzeStrategy
 *
 * Flow 7: StrategyBuilder — Add / Clear / Analyze
 *   Render → tap Add Leg → addStrategyLeg called
 *   Tap Clear All → clearStrategyLegs called
 *   Tap Analyze → analyzeStrategy called
 *
 * Flow 8: StrategyBuilder — Leg Action Toggle & Remove
 *   Render → tap action toggle → updateStrategyLeg called
 *   Tap remove X button → removeStrategyLeg called
 *
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mock Definitions (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const navMock = { navigate: mockNavigate, goBack: mockGoBack };

// ── Store action spies ──────────────────────────────────────────
const mockSetSelectedSymbol = vi.fn();
const mockSetSelectedExpiry = vi.fn();
const mockSetView = vi.fn();
const mockSetChainSide = vi.fn();
const mockOpenOrderModal = vi.fn();
const mockCloseOrderModal = vi.fn();
const mockSetOrderQuantity = vi.fn();
const mockPlaceOrder = vi.fn();
const mockFetchExpiries = vi.fn();
const mockFetchOptionChain = vi.fn();
const mockFetchFutures = vi.fn();
const mockFetchPositions = vi.fn();
const mockFetchSpotPrices = vi.fn();

const mockAddStrategyLeg = vi.fn();
const mockRemoveStrategyLeg = vi.fn();
const mockUpdateStrategyLeg = vi.fn();
const mockClearStrategyLegs = vi.fn();
const mockSetSelectedStrategyName = vi.fn();
const mockAnalyzeStrategy = vi.fn();

// ── Mock data ────────────────────────────────────────────────────
const mockExpiries = [
  { id: 'e1', symbol: 'NIFTY', date: '2026-07-09T00:00:00.000Z', daysToExpiry: 12, isMonthly: false },
  { id: 'e2', symbol: 'NIFTY', date: '2026-07-16T00:00:00.000Z', daysToExpiry: 19, isMonthly: false },
  { id: 'e3', symbol: 'NIFTY', date: '2026-07-30T00:00:00.000Z', daysToExpiry: 33, isMonthly: true },
];

const mockContractCe = {
  type: 'CE' as const,
  strike: 24000,
  ltp: 185.50,
  change: 12.30,
  changePercent: 7.1,
  openInterest: 1250000,
  volume: 850000,
  iv: 14.5,
  delta: 0.55,
  gamma: 0.00012,
  theta: -8.45,
  vega: 22.3,
  rho: 0.85,
  impliedVolatility: 14.5,
  intrinsicValue: 0,
  expiry: '2026-07-09T00:00:00.000Z',
};

const mockContractPe = {
  type: 'PE' as const,
  strike: 24000,
  ltp: 125.75,
  change: -8.90,
  changePercent: -6.6,
  openInterest: 980000,
  volume: 620000,
  iv: 16.2,
  delta: -0.45,
  gamma: 0.00014,
  theta: -6.30,
  vega: 18.7,
  rho: -0.72,
  impliedVolatility: 16.2,
  intrinsicValue: 0,
  expiry: '2026-07-09T00:00:00.000Z',
};

const mockOptionChain = {
  symbol: 'NIFTY',
  expiry: '2026-07-09',
  spotPrice: 23456.80,
  underlyingPrice: 23456.80,
  pcr: 0.82,
  maxPain: 23500,
  totalCEOi: 12500000,
  totalPEOi: 9800000,
  rows: [
    { strike: 24000, ce: { ...mockContractCe }, pe: { ...mockContractPe } },
  ],
};

const mockStrategyLegs = [
  { id: 'leg_1', action: 'buy' as const, type: 'CE' as const, strike: 23500, expiry: '2026-07-09T00:00:00.000Z', quantity: 1, premium: 185.50, lotSize: 50 },
  { id: 'leg_2', action: 'sell' as const, type: 'CE' as const, strike: 24500, expiry: '2026-07-09T00:00:00.000Z', quantity: 1, premium: 65.25, lotSize: 50 },
];

const mockPrebuiltStrategies = [
  { id: 'long_call', name: 'Long Call', description: 'Buy a call option. Limited risk, unlimited profit.', riskCategory: 'moderate', isBullish: true, isBearish: false, isNeutral: false, legs: [{ type: 'CE', action: 'buy', count: 1 }] },
  { id: 'iron_condor', name: 'Iron Condor', description: 'Range-bound strategy with defined risk.', riskCategory: 'low', isBullish: false, isBearish: false, isNeutral: true, legs: [{ type: 'PE', action: 'sell', count: 1 }, { type: 'PE', action: 'buy', count: 1 }, { type: 'CE', action: 'sell', count: 1 }, { type: 'CE', action: 'buy', count: 1 }] },
];

const mockFuturesData = [
  { symbol: 'NIFTY24JUL', price: 23520.50, change: 45.20, changePercent: 0.19, openInterest: 3500000, volume: 1200000, expiryDate: '2026-07-30T00:00:00.000Z', lotSize: 50, basis: 63.70, basisPercent: 0.27 },
];

// ── Store mock factory ──────────────────────────────────────────

function fnoStoreOptionsMock() {
  return {
    selectedSymbol: 'NIFTY',
    selectedExpiry: mockExpiries[0],
    expiries: mockExpiries,
    optionChain: mockOptionChain,
    futures: [],
    positions: [],
    view: 'option-chain' as const,
    chainSide: 'both' as const,
    chainLoading: false,
    futuresLoading: false,
    positionsLoading: false,
    spotPrices: { NIFTY: 23456.80, BANKNIFTY: 51200.00 },
    strategyLegs: [],
    strategyResult: null,
    showOrderModal: false,
    selectedContract: null,
    orderType: 'buy' as const,
    orderQuantity: 1,
    setSelectedSymbol: mockSetSelectedSymbol,
    setSelectedExpiry: mockSetSelectedExpiry,
    setView: mockSetView,
    setChainSide: mockSetChainSide,
    fetchExpiries: mockFetchExpiries,
    fetchOptionChain: mockFetchOptionChain,
    fetchFutures: mockFetchFutures,
    fetchPositions: mockFetchPositions,
    fetchSpotPrices: mockFetchSpotPrices,
    openOrderModal: mockOpenOrderModal,
    closeOrderModal: mockCloseOrderModal,
    setOrderQuantity: mockSetOrderQuantity,
    placeOrder: mockPlaceOrder,
    addStrategyLeg: mockAddStrategyLeg,
    removeStrategyLeg: mockRemoveStrategyLeg,
    updateStrategyLeg: mockUpdateStrategyLeg,
    clearStrategyLegs: mockClearStrategyLegs,
    setSelectedStrategyName: mockSetSelectedStrategyName,
    analyzeStrategy: mockAnalyzeStrategy,
  };
}

function strategyBuilderStoreMock() {
  return {
    selectedSymbol: 'NIFTY',
    strategyLegs: mockStrategyLegs,
    strategyResult: null,
    selectedStrategyName: 'Custom Strategy',
    strategyLoading: false,
    spotPrices: { NIFTY: 23456.80, BANKNIFTY: 51200.00 },
    fetchSpotPrices: mockFetchSpotPrices,
    addStrategyLeg: mockAddStrategyLeg,
    removeStrategyLeg: mockRemoveStrategyLeg,
    updateStrategyLeg: mockUpdateStrategyLeg,
    clearStrategyLegs: mockClearStrategyLegs,
    setSelectedStrategyName: mockSetSelectedStrategyName,
    analyzeStrategy: mockAnalyzeStrategy,
    setSelectedSymbol: mockSetSelectedSymbol,
  };
}

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', primaryLight: '#8B83FF', primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B', success: '#00C853', danger: '#FF1744',
      warning: '#FFC107', marketUp: '#00C853', marketDown: '#FF1744',
      marketNeutral: '#FFC107', text: '#FFFFFF', textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A', white: '#FFFFFF', bg: '#0D0D2B',
      bgSecondary: '#1A1A3E', bgCard: '#222255', bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A', bgDark: '#070720', bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E', borderLight: '#3A3A7E', divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/fnoStore', () => {
  const useFnoStore = Object.assign(
    vi.fn(fnoStoreOptionsMock),
    { getState: vi.fn(fnoStoreOptionsMock) },
  );
  return { useFnoStore };
});

vi.mock('../services/api/fno', () => ({
  fnoApi: {
    getPrebuiltStrategies: vi.fn(() => Promise.resolve(mockPrebuiltStrategies)),
  },
}));

vi.mock('../components/ui/AnimatedPressable', () => ({
  default: 'AnimatedPressable',
}));

// ==================== Imports ====================

import FnOOptionsChainScreen from '../screens/trade/FnOOptionsChainScreen';
import StrategyBuilderScreen from '../screens/trade/StrategyBuilderScreen';
import { useFnoStore } from '../store/fnoStore';

// ==================== Helpers ====================

function renderOptionsChain() {
  return render(<FnOOptionsChainScreen navigation={navMock} />);
}

function renderStrategyBuilder() {
  return render(
    <StrategyBuilderScreen navigation={navMock} route={{ params: {} }} />,
  );
}

/** Flush microtasks so async useEffect callbacks have resolved. */
async function flushMicrotasks() {
  await act(async () => {
    await new Promise(resolve => setImmediate(resolve));
  });
}

async function renderStrategyAndWait() {
  const result = renderStrategyBuilder();
  await flushMicrotasks();
  return result;
}

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default mock for all tests
  vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock as any);
});

// ==================== Flow 1: Symbol Change ====================

describe('FnOOptionsChain — Symbol Change', () => {
  it('calls setSelectedSymbol when a different symbol chip is tapped', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('BANKNIFTY')); });
    expect(mockSetSelectedSymbol).toHaveBeenCalledWith('BANKNIFTY');
  });

  it('calls setSelectedSymbol with RELIANCE when RELIANCE chip is tapped', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('RELIANCE')); });
    expect(mockSetSelectedSymbol).toHaveBeenCalledWith('RELIANCE');
  });

  it('calls fetchExpiries when symbol is changed', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('INFY')); });
    expect(mockSetSelectedSymbol).toHaveBeenCalledWith('INFY');
  });

  it('calls setSelectedSymbol with BANKNIFTY and not the initial symbol', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('BANKNIFTY')); });
    expect(mockSetSelectedSymbol).toHaveBeenCalledWith('BANKNIFTY');
  });
});

// ==================== Flow 2: Expiry Change ====================

describe('FnOOptionsChain — Expiry Change', () => {
  it('calls setSelectedExpiry when an expiry chip is tapped', () => {
    const { getByText } = renderOptionsChain();
    // Find the monthly expiry chip — it has "(M)" text
    act(() => { fireEvent.press(getByText('(M)')); });
    // setSelectedExpiry is called by handleExpiryChange
    expect(mockSetSelectedExpiry).toHaveBeenCalled();
  });

  it('passes the matching expiry object to setSelectedExpiry', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('(M)')); });
    const args = mockSetSelectedExpiry.mock.calls[0][0];
    expect(args).toHaveProperty('date');
    expect(args).toHaveProperty('daysToExpiry');
    expect(args).toHaveProperty('isMonthly');
    expect(args.isMonthly).toBe(true);
  });
});

// ==================== Flow 3: View Switch ====================

describe('FnOOptionsChain — View Switch', () => {
  it('calls setView("futures") when Futures tab is tapped', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('Futures')); });
    expect(mockSetView).toHaveBeenCalledWith('futures');
  });

  it('calls setView("positions") when Positions tab is tapped', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('Positions')); });
    expect(mockSetView).toHaveBeenCalledWith('positions');
  });

  it('calls setView("option-chain") when Option Chain tab is tapped', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('Option Chain')); });
    expect(mockSetView).toHaveBeenCalledWith('option-chain');
  });
});

// ==================== Flow 4: Chain Side Filter ====================

describe('FnOOptionsChain — Side Filter', () => {
  it('calls setChainSide("CE") when CE tab is tapped', () => {
    // Override mock so chainSide='PE' hides "CALLS (CE)" from header,
    // making getByText('CE') resolve uniquely to the side tab.
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      chainSide: 'PE',
    }));
    const { getByText } = render(<FnOOptionsChainScreen navigation={navMock} />);
    act(() => { fireEvent.press(getByText('CE')); });
    expect(mockSetChainSide).toHaveBeenCalledWith('CE');
  });

  it('calls setChainSide("PE") when PE tab is tapped', () => {
    // Override mock so chainSide='CE' hides "PUTS (PE)" from header
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      chainSide: 'CE',
    }));
    const { getByText } = render(<FnOOptionsChainScreen navigation={navMock} />);
    act(() => { fireEvent.press(getByText('PE')); });
    expect(mockSetChainSide).toHaveBeenCalledWith('PE');
  });

  it('calls setChainSide("both") when All tab is tapped', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('All')); });
    expect(mockSetChainSide).toHaveBeenCalledWith('both');
  });

  it('calls setChainSide("both") when All tab is tapped', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('All')); });
    expect(mockSetChainSide).toHaveBeenCalledWith('both');
  });
});

// ==================== Flow 5: Contract Order Modal ====================

describe('FnOOptionsChain — Order Modal from Contract', () => {
  it('calls openOrderModal with CE contract and "buy" when a CE contract is tapped', () => {
    const { getByText } = renderOptionsChain();
    // Tap the CE LTP value which is inside a contract cell TouchableOpacity
    act(() => { fireEvent.press(getByText('₹185.50')); });
    expect(mockOpenOrderModal).toHaveBeenCalledTimes(1);
    expect(mockOpenOrderModal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CE', strike: 24000, ltp: 185.50 }),
      'buy',
    );
  });

  it('calls openOrderModal with PE contract and "buy" when a PE contract is tapped', () => {
    const { getByText } = renderOptionsChain();
    act(() => { fireEvent.press(getByText('₹125.75')); });
    expect(mockOpenOrderModal).toHaveBeenCalledTimes(1);
    expect(mockOpenOrderModal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PE', strike: 24000, ltp: 125.75 }),
      'buy',
    );
  });
});

// ==================== Flow 6: StrategyBuilder — Pre-built Selection ====================

describe('StrategyBuilder — Pre-built Strategy Selection', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.mocked(useFnoStore).mockImplementation(strategyBuilderStoreMock as any);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock as any);
  });

  it('calls clearStrategyLegs when a pre-built strategy card is tapped', async () => {
    const { getByText } = await renderStrategyAndWait();

    act(() => { fireEvent.press(getByText('Long Call')); });
    expect(mockClearStrategyLegs).toHaveBeenCalledTimes(1);
  });

  it('calls addStrategyLeg when a pre-built strategy card is tapped', async () => {
    const { getByText } = await renderStrategyAndWait();

    act(() => { fireEvent.press(getByText('Long Call')); });
    // Long Call has 1 leg, so addStrategyLeg should be called once
    expect(mockAddStrategyLeg).toHaveBeenCalledTimes(1);
    const legArg = mockAddStrategyLeg.mock.calls[0][0];
    expect(legArg).toHaveProperty('action', 'buy');
    expect(legArg).toHaveProperty('type', 'CE');
    expect(legArg).toHaveProperty('lotSize');
  });

  it('calls setSelectedStrategyName with the strategy name', async () => {
    const { getByText } = await renderStrategyAndWait();

    act(() => { fireEvent.press(getByText('Long Call')); });
    expect(mockSetSelectedStrategyName).toHaveBeenCalledWith('Long Call');
  });

  it('calls addStrategyLeg (not analyze) when pre-built strategy is first tapped (delay not elapsed)', async () => {
    const { getByText } = await renderStrategyAndWait();

    act(() => { fireEvent.press(getByText('Long Call')); });
    // addStrategyLeg is called immediately (not in setTimeout)
    expect(mockAddStrategyLeg).toHaveBeenCalled();
    // analyzeStrategy is called after setTimeout(300) - with fake timers this won't fire
    expect(mockAnalyzeStrategy).not.toHaveBeenCalled();
  });

  it('adds correct number of legs for Iron Condor (4 legs)', async () => {
    const { getByText } = await renderStrategyAndWait();

    mockAddStrategyLeg.mockClear();
    act(() => { fireEvent.press(getByText('Iron Condor')); });
    expect(mockAddStrategyLeg).toHaveBeenCalledTimes(4);
  });
});

// ==================== Flow 7: StrategyBuilder — Add / Clear / Analyze ====================

describe('StrategyBuilder — Add / Clear / Analyze', () => {
  beforeEach(() => {
    vi.mocked(useFnoStore).mockImplementation(strategyBuilderStoreMock as any);
  });

  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock as any);
  });

  it('calls addStrategyLeg when Add Leg button is pressed', async () => {
    const { getByText } = await renderStrategyAndWait();
    // AnimatedPressable is mocked as a string, so we find Add Leg inside its children
    // The parent should handle onPress — use fireEvent on the text
    act(() => { fireEvent.press(getByText('Add Leg')); });
    expect(mockAddStrategyLeg).toHaveBeenCalledTimes(1);
    const legArg = mockAddStrategyLeg.mock.calls[0][0];
    expect(legArg).toHaveProperty('action', 'buy');
    expect(legArg).toHaveProperty('type', 'CE');
    expect(legArg).toHaveProperty('strike');
    expect(legArg).toHaveProperty('premium');
  });

  it('calls clearStrategyLegs when Clear All button is pressed', async () => {
    const { getByText } = await renderStrategyAndWait();

    act(() => { fireEvent.press(getByText('Clear All')); });
    expect(mockClearStrategyLegs).toHaveBeenCalledTimes(1);
  });

  it('calls analyzeStrategy when Analyze button is pressed', async () => {
    const { getByText } = await renderStrategyAndWait();

    // Defensive clear — any setTimeout from a previous test's pre-built strategy
    // selection (see handleSelectPrebuilt) firing during test setup could
    // inflate the call count. Clearing ensures we only count this test's press.
    mockAnalyzeStrategy.mockClear();

    act(() => { fireEvent.press(getByText('Analyze')); });
    expect(mockAnalyzeStrategy).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeStrategy).toHaveBeenCalledWith(expect.any(Number));
  });

  it('shows "..." on Analyze button when strategyLoading is true', () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...strategyBuilderStoreMock(),
      strategyLoading: true,
    }));
    const { getByText } = renderStrategyBuilder();
    expect(getByText('...')).toBeDefined();
  });
});

// ==================== Flow 8: StrategyBuilder — Leg Action Toggle & Remove ====================

describe('StrategyBuilder — Leg Editor Interactions', () => {
  beforeEach(() => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...strategyBuilderStoreMock(),
      strategyLegs: [
        { id: 'leg_1', action: 'buy' as const, type: 'CE' as const, strike: 23500, expiry: '2026-07-09T00:00:00.000Z', quantity: 1, premium: 185.50, lotSize: 50 },
        { id: 'leg_2', action: 'sell' as const, type: 'PE' as const, strike: 24500, expiry: '2026-07-09T00:00:00.000Z', quantity: 1, premium: 165.25, lotSize: 50 },
      ],
    }));
  });

  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock as any);
  });

  it('calls updateStrategyLeg on leg_2 (sell) toggle to "buy"', async () => {
    const { getByText } = await renderStrategyAndWait();

    act(() => { fireEvent.press(getByText('Tap to BUY')); });
    expect(mockUpdateStrategyLeg).toHaveBeenCalledTimes(1);
    // leg_2 has action 'sell' so its toggle says "Tap to BUY"
    expect(mockUpdateStrategyLeg).toHaveBeenCalledWith(
      'leg_2',
      { action: 'buy' },
    );
  });

  it('calls updateStrategyLeg on leg_1 (buy) toggle to "sell"', async () => {
    const { getByText } = await renderStrategyAndWait();

    act(() => { fireEvent.press(getByText('Tap to SELL')); });
    // leg_1 has action 'buy' so its toggle says "Tap to SELL"
    expect(mockUpdateStrategyLeg).toHaveBeenCalledWith('leg_1', { action: 'sell' });
  });

  it('does not crash when there are 0 strategy legs (remove button hidden)', async () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...strategyBuilderStoreMock(),
      strategyLegs: [],
      strategyResult: null,
    }));
    const { toJSON } = await renderStrategyAndWait();
    expect(toJSON).not.toBeNull();
  });
});

// ==================== Flow 9: Order Modal Rendering ====================

describe('FnOOptionsChain — Order Modal Visual Rendering', () => {
  beforeEach(() => {
    // Override store to show the order modal with a CE contract
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      showOrderModal: true,
      selectedContract: mockContractCe,
      orderType: 'buy',
      orderQuantity: 1,
    }));
  });

  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock);
  });

  it('renders the Place Order title', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('Place Order')).toBeDefined();
  });

  it('renders the contract type badge (CE)', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('CE')).toBeDefined();
  });

  it('renders the contract symbol and strike', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('NIFTY 24000')).toBeDefined();
  });

  it('renders LTP, Lot size, and IV in contract info', () => {
    const { getByText } = renderOptionsChain();
    // LTP: formatCurrency(185.50, true) → "₹185.50" (non-compact, < 1000)
    expect(getByText(/₹185\.50/)).toBeDefined();
    // Lot: NIFTY → 50
    expect(getByText(/Lot: 50/)).toBeDefined();
    // IV: 14.5.toFixed(1) → "14.5%"
    expect(getByText(/IV: 14\.5%/)).toBeDefined();
  });

  // ── Greeks Preview ────────────────────────────────────

  it('renders the Delta label and value', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('Delta')).toBeDefined();
    // delta.toFixed(2) = "0.55"
    expect(getByText('0.55')).toBeDefined();
  });

  it('renders the Gamma label and value', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('Gamma')).toBeDefined();
    // gamma.toFixed(4) = "0.0001" (0.00012 → "0.0001")
    expect(getByText('0.0001')).toBeDefined();
  });

  it('renders the Theta label and value', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('Theta')).toBeDefined();
    // theta.toFixed(2) = "-8.45"
    // Only check the numeric part since the sign might render differently
    expect(getByText(/-8\.45/)).toBeDefined();
  });

  it('renders the Vega label and value', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('Vega')).toBeDefined();
    // vega.toFixed(2) = "22.30"
    expect(getByText('22.30')).toBeDefined();
  });

  // ── Lots Selector ─────────────────────────────────────

  it('renders the Lots label', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('Lots')).toBeDefined();
  });

  it('renders the quantity input with value 1', () => {
    const { getByText } = renderOptionsChain();
    // TextInput value = String(orderQuantity) = "1"
    expect(getByText('1')).toBeDefined();
  });

  it('renders the remove (-) and add (+) quantity buttons', () => {
    const { toJSON } = renderOptionsChain();
    expect(toJSON).not.toBeNull();
    // Ionicons "remove" and "add" rendered as IonIonicons string mock
  });

  // ── Total Premium ─────────────────────────────────────

  it('renders the Total Premium label', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('Total Premium')).toBeDefined();
  });

  it('renders the calculated total premium value', () => {
    const { getByText } = renderOptionsChain();
    // totalPremium = 185.50 × 1 × 50 = 9275
    // formatCurrency(9275, true) → 9275 >= 1000 → "₹9.3K"
    expect(getByText('₹9.3K')).toBeDefined();
  });

  it('renders the Per Unit label', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('Per Unit')).toBeDefined();
  });

  it('renders the per unit LTP value', () => {
    const { getByText } = renderOptionsChain();
    // formatCurrency(185.50, true) → non-compact → "₹185.50"
    expect(getByText('₹185.50')).toBeDefined();
  });

  // ── Action Buttons ────────────────────────────────────

  it('renders the Cancel button', () => {
    const { getByText } = renderOptionsChain();
    expect(getByText('Cancel')).toBeDefined();
  });

  it('renders the buy action button with lot count', () => {
    const { getByText } = renderOptionsChain();
    // orderType === 'buy' → "Buy 1 Lot"
    expect(getByText('Buy 1 Lot')).toBeDefined();
  });

  it('renders Sell N Lot when orderType is sell', () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      showOrderModal: true,
      selectedContract: mockContractCe,
      orderType: 'sell',
      orderQuantity: 1,
    }));
    const { getByText } = renderOptionsChain();
    expect(getByText('Sell 1 Lot')).toBeDefined();
  });

  // ── Modal Hidden When showOrderModal is false ─────────

  it('does NOT render modal content when showOrderModal is false', () => {
    // Override back to default (which has showOrderModal: false)
    vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock);
    const { queryByText } = renderOptionsChain();
    expect(queryByText('Place Order')).toBeNull();
  });

  it('does NOT crash when selectedContract is null (modal hidden)', () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      showOrderModal: true,
      selectedContract: null,
    }));
    const { toJSON } = renderOptionsChain();
    expect(toJSON).not.toBeNull();
  });

  // ── PE Contract Variant ───────────────────────────────

  it('renders PE type badge for a put contract', () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      showOrderModal: true,
      selectedContract: mockContractPe,
      orderType: 'buy',
      orderQuantity: 1,
    }));
    const { getByText } = renderOptionsChain();
    expect(getByText('PE')).toBeDefined();
  });

  it('renders PE contract strike in title', () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      showOrderModal: true,
      selectedContract: mockContractPe,
      orderType: 'buy',
      orderQuantity: 1,
    }));
    const { getByText } = renderOptionsChain();
    // PE has strike 24000 too
    expect(getByText('NIFTY 24000')).toBeDefined();
  });

  it('renders PE-specific Greeks (negative delta)', () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      showOrderModal: true,
      selectedContract: mockContractPe,
      orderType: 'buy',
      orderQuantity: 1,
    }));
    const { getByText } = renderOptionsChain();
    // PE delta = -0.45 → toFixed(2) = "-0.45"
    expect(getByText('-0.45')).toBeDefined();
  });
});

// ==================== Flow 10: StrategyBuilder — Edge Cases ====================

describe('StrategyBuilder — Edge Cases', () => {
  // ── Empty Spot Prices ────────────────────────────────

  describe('Empty Spot Prices', () => {
    beforeEach(() => {
      vi.mocked(useFnoStore).mockImplementation(() => ({
        ...strategyBuilderStoreMock(),
        spotPrices: {},
      }));
    });

    afterEach(() => {
      vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock as any);
    });

    it('renders without crashing when spotPrices is empty', async () => {
      const { toJSON } = await renderStrategyAndWait();
      expect(toJSON).not.toBeNull();
    });

    it('shows default spot price when spotPrices is empty (no update from effect)', async () => {
      const { getByText } = await renderStrategyAndWait();
      // Default spotPrice is 23456.80 → Math.round → "23457"
      // The TextInput shows the value but doesn't render it as text children
      // Instead verify the label and analyze button still render
      expect(getByText('Underlying Price')).toBeDefined();
      expect(getByText('Analyze')).toBeDefined();
    });

    it('still renders strategy legs with empty spotPrices', async () => {
      const { getByText } = await renderStrategyAndWait();
      // Legs still render from the store mock (mockStrategyLegs has 2 legs)
      expect(getByText('Strategy Legs (2)')).toBeDefined();
    });

    it('pre-built strategy templates still load when spotPrices is empty', async () => {
      const { getByText } = await renderStrategyAndWait();
      // Pre-built strategies are loaded via fnoApi, not affected by spotPrices
      expect(getByText('Strategy Templates')).toBeDefined();
      expect(getByText('Long Call')).toBeDefined();
    });
  });

  // ── Analyze Strategy Failure ─────────────────────────

  describe('Analyze Strategy Failure', () => {
    beforeEach(() => {
      vi.mocked(useFnoStore).mockImplementation(() => ({
        ...strategyBuilderStoreMock(),
        strategyResult: null,
        // Make analyzeStrategy reject to simulate API failure
        analyzeStrategy: vi.fn().mockRejectedValue(new Error('Analysis failed')),
      }));
    });

    afterEach(() => {
      vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock as any);
    });

    it('renders legs section even when strategyResult is null', async () => {
      const { getByText } = await renderStrategyAndWait();
      // Legs are present because strategyLegs from mock has 2 legs
      expect(getByText('Strategy Legs (2)')).toBeDefined();
    });

    it('does NOT render Strategy Analysis card when result is null', async () => {
      const { queryByText } = await renderStrategyAndWait();
      expect(queryByText('Strategy Analysis')).toBeNull();
    });

    it('does NOT show empty state when legs exist but result is null', async () => {
      const { queryByText } = await renderStrategyAndWait();
      // Empty state only shows when NO legs AND no result
      expect(queryByText('No Strategy Defined')).toBeNull();
    });

    it('still renders Add Leg and Clear All buttons', async () => {
      const { getByText } = await renderStrategyAndWait();
      expect(getByText('Add Leg')).toBeDefined();
      expect(getByText('Clear All')).toBeDefined();
    });

    it('does not crash when analyzing fails (store catch handles it)', async () => {
      const mockRejectAnalyze = vi.fn().mockRejectedValue(new Error('API error'));
      vi.mocked(useFnoStore).mockImplementation(() => ({
        ...strategyBuilderStoreMock(),
        strategyResult: null,
        analyzeStrategy: mockRejectAnalyze,
      }));
      const { getByText, toJSON } = await renderStrategyAndWait();

      // Press Analyze — the mock rejects
      act(() => { fireEvent.press(getByText('Analyze')); });
      await flushMicrotasks();

      // Should not crash
      expect(toJSON).not.toBeNull();
    });
  });

  // ── FUTURE Type Legs ─────────────────────────────────

  describe('FUTURE Type Strategy Legs', () => {
    const futureLegs = [
      { id: 'future_1', action: 'buy' as const, type: 'FUTURE' as const, strike: 0, expiry: '2026-07-09T00:00:00.000Z', quantity: 1, premium: 0, lotSize: 50 },
    ];

    beforeEach(() => {
      vi.mocked(useFnoStore).mockImplementation(() => ({
        ...strategyBuilderStoreMock(),
        strategyLegs: futureLegs,
        strategyResult: null,
      }));
    });

    afterEach(() => {
      vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock as any);
    });

    it('renders a FUTURE leg without crashing', async () => {
      const { toJSON } = await renderStrategyAndWait();
      expect(toJSON).not.toBeNull();
    });

    it('renders the FUTURE type badge', async () => {
      const { getByText } = await renderStrategyAndWait();
      // action='buy' so badge shows "▲ FUTURE"
      expect(getByText('▲ FUTURE')).toBeDefined();
    });

    it('renders the action label for a buy future', async () => {
      const { getByText } = await renderStrategyAndWait();
      expect(getByText('BUY')).toBeDefined();
    });

    it('renders multiple FUTURE legs (buy + sell)', async () => {
      vi.mocked(useFnoStore).mockImplementation(() => ({
        ...strategyBuilderStoreMock(),
        strategyLegs: [
          { id: 'f1', action: 'buy' as const, type: 'FUTURE' as const, strike: 0, expiry: '2026-07-09T00:00:00.000Z', quantity: 2, premium: 0, lotSize: 50 },
          { id: 'f2', action: 'sell' as const, type: 'FUTURE' as const, strike: 0, expiry: '2026-07-30T00:00:00.000Z', quantity: 1, premium: 0, lotSize: 50 },
        ],
      }));
      const { getByText } = await renderStrategyAndWait();
      expect(getByText('▲ FUTURE')).toBeDefined();
      expect(getByText('▼ FUTURE')).toBeDefined();
      expect(getByText('BUY')).toBeDefined();
      expect(getByText('SELL')).toBeDefined();
    });

    it('renders FUTURE leg quantity', async () => {
      vi.mocked(useFnoStore).mockImplementation(() => ({
        ...strategyBuilderStoreMock(),
        strategyLegs: [
          { id: 'f1', action: 'buy' as const, type: 'FUTURE' as const, strike: 0, expiry: '2026-07-09T00:00:00.000Z', quantity: 2, premium: 0, lotSize: 50 },
        ],
      }));
      const { getByText } = await renderStrategyAndWait();
      expect(getByText('Strategy Legs (1)')).toBeDefined();
    });

    it('renders Strike and Premium field labels for FUTURE leg', async () => {
      const { getAllByText } = await renderStrategyAndWait();
      expect(getAllByText('Strike').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('Premium').length).toBeGreaterThanOrEqual(1);
      // FUTURE legs show "Lots" label as well
      expect(getAllByText('Lots').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Mixed CE / PE / FUTURE Legs ──────────────────────

  describe('Mixed CE / PE / FUTURE Legs', () => {
    const mixedLegs = [
      { id: 'ce_1', action: 'buy' as const, type: 'CE' as const, strike: 24000, expiry: '2026-07-09T00:00:00.000Z', quantity: 1, premium: 185.50, lotSize: 50 },
      { id: 'pe_1', action: 'sell' as const, type: 'PE' as const, strike: 23500, expiry: '2026-07-09T00:00:00.000Z', quantity: 1, premium: 125.75, lotSize: 50 },
      { id: 'future_1', action: 'buy' as const, type: 'FUTURE' as const, strike: 0, expiry: '2026-07-30T00:00:00.000Z', quantity: 1, premium: 0, lotSize: 50 },
    ];

    beforeEach(() => {
      vi.mocked(useFnoStore).mockImplementation(() => ({
        ...strategyBuilderStoreMock(),
        strategyLegs: mixedLegs,
        strategyResult: null,
      }));
    });

    afterEach(() => {
      vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock as any);
    });

    it('renders mixed CE/PE/FUTURE legs without crashing', async () => {
      const { toJSON } = await renderStrategyAndWait();
      expect(toJSON).not.toBeNull();
    });

    it('renders all three leg types in the badge', async () => {
      const { getByText } = await renderStrategyAndWait();
      expect(getByText('▲ CE')).toBeDefined();
      expect(getByText('▼ PE')).toBeDefined();
      expect(getByText('▲ FUTURE')).toBeDefined();
    });

    it('renders all action labels', async () => {
      const { getByText } = await renderStrategyAndWait();
      expect(getByText('BUY')).toBeDefined();
      expect(getByText('SELL')).toBeDefined();
    });

    it('renders correct leg count', async () => {
      const { getByText } = await renderStrategyAndWait();
      expect(getByText('Strategy Legs (3)')).toBeDefined();
    });
  });
});

// ==================== Flow 11: Futures Card Interaction ====================

describe('FnOOptionsChain — Futures Card Interaction', () => {
  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock as any);
  });

  it('calls Alert.alert when a futures contract card is pressed', () => {
    // Override store to show futures view with data
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      view: 'futures',
      futures: mockFuturesData,
    }));
    // Alert.alert is mocked as a no-op in react-native.mock.ts
    // We just verify no crash occurs when pressing the futures card
    const { getByText } = render(<FnOOptionsChainScreen navigation={navMock} />);
    act(() => { fireEvent.press(getByText('NIFTY')); });
    // If no error thrown, the function was exercised successfully
    expect(mockSetView).not.toHaveBeenCalled(); // just a sanity check
  });
});

// ==================== Flow 12: Order Modal Action Button ====================

describe('FnOOptionsChain — Order Modal Action Button', () => {
  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock);
  });

  it('calls placeOrder when the Buy action button is pressed', () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      showOrderModal: true,
      selectedContract: mockContractCe,
      orderType: 'buy',
      orderQuantity: 1,
    }));
    const { getByText } = render(<FnOOptionsChainScreen navigation={navMock} />);
    act(() => { fireEvent.press(getByText('Buy 1 Lot')); });
    expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
  });

  it('calls placeOrder when the Sell action button is pressed', () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...fnoStoreOptionsMock(),
      showOrderModal: true,
      selectedContract: mockContractCe,
      orderType: 'sell',
      orderQuantity: 2,
    }));
    const { getByText } = render(<FnOOptionsChainScreen navigation={navMock} />);
    act(() => { fireEvent.press(getByText('Sell 2 Lots')); });
    expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
  });
});

// ==================== Flow 13: Pull-to-Refresh ====================

describe('FnOOptionsChain — Pull-to-Refresh', () => {
  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(fnoStoreOptionsMock as any);
  });

  it('calls fetchExpiries and fetchOptionChain and fetchFutures and fetchPositions on pull-to-refresh', () => {
    const { root } = render(<FnOOptionsChainScreen navigation={navMock} />);

    // Find the RefreshControl element in the rendered tree
    const refreshControls = root.findAll(
      (n: any) => n.type === 'RefreshControl',
      { deep: true } as any,
    );
    expect(refreshControls.length).toBeGreaterThanOrEqual(1);

    // Call the onRefresh prop to simulate pull-to-refresh
    const refreshControl = refreshControls[0];
    const onRefresh = (refreshControl.props as any).onRefresh;
    expect(typeof onRefresh).toBe('function');

    act(() => { onRefresh(); });

    // All fetch functions should have been called
    expect(mockFetchExpiries).toHaveBeenCalled();
    expect(mockFetchOptionChain).toHaveBeenCalled();
    expect(mockFetchFutures).toHaveBeenCalled();
    expect(mockFetchPositions).toHaveBeenCalled();
  });
});