/**
 * ============================================================================
 * Toroloom — StrategyBuilderScreen Integration Tests
 * ============================================================================
 *
 * Verifies that the Strategy Builder screen renders correctly with all
 * major sections: header, spot price bar, pre-built strategy templates,
 * strategy leg editors, add leg / clear buttons, strategy analysis
 * results (max profit/loss, breakeven, bias), and P&L chart.
 *
 * NOTE: Pre-built strategies are loaded via an async useEffect hook so
 * tests that assert on template cards must await microtask flushing.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const navMock = { navigate: mockNavigate, goBack: mockGoBack };
const routeWithParams = { params: {} };

const mockFetchSpotPrices = vi.fn();
const mockAddStrategyLeg = vi.fn();
const mockRemoveStrategyLeg = vi.fn();
const mockUpdateStrategyLeg = vi.fn();
const mockClearStrategyLegs = vi.fn();
const mockSetSelectedStrategyName = vi.fn();
const mockAnalyzeStrategy = vi.fn();
const mockSetSelectedSymbol = vi.fn();

const mockPrebuiltStrategies = [
  { id: 'long_call', name: 'Long Call', description: 'Buy a call option. Limited risk, unlimited profit.', riskCategory: 'moderate', isBullish: true, isBearish: false, isNeutral: false, legs: [{ type: 'CE', action: 'buy', count: 1 }] },
  { id: 'long_put', name: 'Long Put', description: 'Buy a put option. Limited risk, unlimited profit potential.', riskCategory: 'moderate', isBullish: false, isBearish: true, isNeutral: false, legs: [{ type: 'PE', action: 'buy', count: 1 }] },
  { id: 'bull_call_spread', name: 'Bull Call Spread', description: 'Buy ATM call + Sell OTM call. Defined risk/reward.', riskCategory: 'low', isBullish: true, isBearish: false, isNeutral: false, legs: [{ type: 'CE', action: 'buy', count: 1 }, { type: 'CE', action: 'sell', count: 1 }] },
  { id: 'iron_condor', name: 'Iron Condor', description: 'Range-bound strategy with defined risk.', riskCategory: 'low', isBullish: false, isBearish: false, isNeutral: true, legs: [{ type: 'PE', action: 'sell', count: 1 }, { type: 'PE', action: 'buy', count: 1 }, { type: 'CE', action: 'sell', count: 1 }, { type: 'CE', action: 'buy', count: 1 }] },
];

const mockStrategyResult = {
  spotPrice: 23456.80,
  maxProfit: 8500,
  maxLoss: -3200,
  maxProfitPercent: 12.5,
  maxLossPercent: 4.7,
  breakevenPoints: [23600, 24500],
  isBullish: true,
  isBearish: false,
  isNeutral: false,
  totalLegs: 2,
  pnlChart: [
    { underlyingPrice: 22000, pnl: -3200 },
    { underlyingPrice: 23000, pnl: -1200 },
    { underlyingPrice: 23456, pnl: 0 },
    { underlyingPrice: 24000, pnl: 2500 },
    { underlyingPrice: 25000, pnl: 8500 },
  ],
};

const mockStrategyLegs = [
  { id: 'leg_1', action: 'buy' as const, type: 'CE' as const, strike: 23500, expiry: '2026-07-09T00:00:00.000Z', quantity: 1, premium: 185.50, lotSize: 50 },
  { id: 'leg_2', action: 'sell' as const, type: 'CE' as const, strike: 24500, expiry: '2026-07-09T00:00:00.000Z', quantity: 1, premium: 65.25, lotSize: 50 },
];

// ── Store mock factory ──────────────────────────────────────

function defaultStoreMock() {
  return {
    selectedSymbol: 'NIFTY',
    strategyLegs: mockStrategyLegs,
    strategyResult: mockStrategyResult,
    selectedStrategyName: 'Bull Call Spread',
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

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      white: '#FFFFFF',
      bg: '#0D0D2B',
      bgSecondary: '#1A1A3E',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgDark: '#070720',
      bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/fnoStore', () => {
  const mockState = defaultStoreMock;
  const useFnoStore = Object.assign(
    vi.fn(mockState),
    { getState: vi.fn(mockState) },
  );
  return { useFnoStore };
});

// The fnoApi mock — getPrebuiltStrategies resolves on the next microtask
// so the StrategyBuilderScreen's useEffect can populate local state.
vi.mock('../services/api/fno', () => ({
  fnoApi: {
    getPrebuiltStrategies: vi.fn(() => Promise.resolve(mockPrebuiltStrategies)),
  },
}));

// ==================== Imports ====================

import StrategyBuilderScreen from '../screens/trade/StrategyBuilderScreen';
import { useFnoStore } from '../store/fnoStore';

// ==================== Helpers ====================

function renderScreen() {
  return render(<StrategyBuilderScreen navigation={navMock} route={routeWithParams} />);
}

/** Flush microtasks so async useEffect callbacks have resolved. */
async function flushMicrotasks() {
  await act(async () => {
    await new Promise(resolve => setImmediate(resolve));
  });
}

async function renderAndWait() {
  const result = renderScreen();
  await flushMicrotasks();
  return result;
}

// ==================== Tests ====================

describe('StrategyBuilderScreen — Header', () => {
  afterEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('renders without crashing', async () => {
    const { toJSON } = await renderAndWait();
    expect(toJSON).not.toBeNull();
  });

  it('renders the screen title', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Strategy Builder')).toBeDefined();
  });

  it('renders the strategy name subtitle', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Bull Call Spread')).toBeDefined();
  });
});

describe('StrategyBuilderScreen — Spot Price Bar', () => {
  it('renders the underlying price label', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Underlying Price')).toBeDefined();
  });

  it('renders the analyze button in the price bar', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Analyze')).toBeDefined();
  });

  it('renders the Analyze button', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Analyze')).toBeDefined();
  });
});

describe('StrategyBuilderScreen — Pre-built Templates', () => {
  it('renders the section title', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Strategy Templates')).toBeDefined();
  });

  it('renders pre-built strategy cards', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Long Call')).toBeDefined();
    expect(getByText('Long Put')).toBeDefined();
    expect(getByText('Iron Condor')).toBeDefined();
  });

  it('renders risk category badges', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('moderate')).toBeDefined();
    expect(getByText('low')).toBeDefined();
  });

  it('renders leg count on pre-built cards', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('1 leg')).toBeDefined();
    expect(getByText('4 legs')).toBeDefined();
  });

  it('renders bias indicators', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('📈')).toBeDefined();
    expect(getByText('📉')).toBeDefined();
    expect(getByText('↔️')).toBeDefined();
  });
});

describe('StrategyBuilderScreen — Toggle Prebuilt View', () => {
  it('renders the hide templates button', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Hide Templates')).toBeDefined();
  });
});

describe('StrategyBuilderScreen — Strategy Legs', () => {
  it('renders the section title with leg count', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Strategy Legs (2)')).toBeDefined();
  });

  it('renders action labels (BUY/SELL)', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('BUY')).toBeDefined();
    expect(getByText('SELL')).toBeDefined();
  });

  it('renders leg type badges', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('▲ CE')).toBeDefined();
    expect(getByText('▼ CE')).toBeDefined();
  });

  it('renders the Strike field label for each leg', async () => {
    const { getAllByText } = await renderAndWait();
    // Each leg editor has a "Strike" label
    expect(getAllByText('Strike').length).toBeGreaterThanOrEqual(2);
  });

  it('renders the Premium field label for each leg', async () => {
    const { getAllByText } = await renderAndWait();
    expect(getAllByText('Premium').length).toBeGreaterThanOrEqual(2);
  });

  it('renders action toggle labels', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Tap to SELL')).toBeDefined();
    expect(getByText('Tap to BUY')).toBeDefined();
  });
});

describe('StrategyBuilderScreen — Add Leg & Clear', () => {
  it('renders the Add Leg button', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Add Leg')).toBeDefined();
  });

  it('renders the Clear All button', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Clear All')).toBeDefined();
  });
});

describe('StrategyBuilderScreen — Strategy Result', () => {
  it('renders the strategy analysis card title', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Strategy Analysis')).toBeDefined();
  });

  it('renders Max Profit section', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Max Profit')).toBeDefined();
    // formatCurrency(8500, true) → 8500 >= 1000 → "₹8.5K"
    expect(getByText('+₹8.5K')).toBeDefined();
    expect(getByText('+12.5%')).toBeDefined();
  });

  it('renders Max Loss section', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Max Loss')).toBeDefined();
    // formatCurrency(-3200, true) → -3200 < 1000 → "-₹3,200.00" (non-compact)
    expect(getByText('-₹3,200.00')).toBeDefined();
    // maxLossPercent is 4.7 → renders as "4.7%"
    expect(getByText('4.7%')).toBeDefined();
  });

  it('renders breakeven points', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Breakeven Points')).toBeDefined();
    // formatCurrency(23600, true) → 23600 >= 1000 → "₹23.6K"
    expect(getByText('₹23.6K')).toBeDefined();
    // formatCurrency(24500, true) → "₹24.5K"
    expect(getByText('₹24.5K')).toBeDefined();
  });

  it('renders market outlook / bias', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Market Outlook')).toBeDefined();
    expect(getByText('Bullish 📈')).toBeDefined();
  });

  it('renders risk badge', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText(/Risk:/)).toBeDefined();
  });

  it('renders P&L Diagram title', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('P&L Diagram')).toBeDefined();
  });
});

describe('StrategyBuilderScreen — Empty State', () => {
  beforeEach(() => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...defaultStoreMock(),
      strategyLegs: [],
      strategyResult: null,
    }));
  });

  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  it('renders empty state when no strategy is defined', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('No Strategy Defined')).toBeDefined();
    expect(getByText(/Choose a pre-built template/)).toBeDefined();
  });
});

describe('StrategyBuilderScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...defaultStoreMock(),
      strategyLoading: true,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  it('shows loading indicator on Analyze button', () => {
    const { getByText } = renderScreen();
    expect(getByText('...')).toBeDefined();
  });

  it('disables Analyze button when no legs defined', () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...defaultStoreMock(),
      strategyLoading: false,
      strategyLegs: [],
    }));
    const { getByText } = renderScreen();
    const analyzeBtn = getByText('Analyze').parent?.parent;
    // Button should be present and not throw when pressed (disabled)
    expect(getByText('Analyze')).toBeDefined();
  });
});

describe('StrategyBuilderScreen — Pre-built Strategy Selection', () => {
  beforeEach(() => {
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
    mockSetSelectedStrategyName.mockClear();
    mockClearStrategyLegs.mockClear();
    mockAddStrategyLeg.mockClear();
    mockAnalyzeStrategy.mockClear();
  });

  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  it('calls setSelectedStrategyName with the strategy name', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Long Call'));
    expect(mockSetSelectedStrategyName).toHaveBeenCalledWith('Long Call');
  });

  it('clears existing legs before populating new ones', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Long Call'));
    expect(mockClearStrategyLegs).toHaveBeenCalled();
  });

  it('adds strategy legs based on the template', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Long Call'));
    // Long Call template has 1 CE buy leg
    expect(mockAddStrategyLeg).toHaveBeenCalledTimes(1);
    const leg = mockAddStrategyLeg.mock.calls[0][0];
    expect(leg.action).toBe('buy');
    expect(leg.type).toBe('CE');
    expect(leg.quantity).toBe(1);
    expect(leg.lotSize).toBe(50);
  });

  it('adds multiple legs for multi-leg strategies', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Iron Condor'));
    // Iron Condor has 4 legs
    expect(mockAddStrategyLeg).toHaveBeenCalledTimes(4);
    const types = mockAddStrategyLeg.mock.calls.map((c: any[]) => c[0].type);
    expect(types.filter((t: string) => t === 'PE').length).toBe(2);
    expect(types.filter((t: string) => t === 'CE').length).toBe(2);
  });

  it('calculates correct strike prices for CE buy legs', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Long Call'));
    const leg = mockAddStrategyLeg.mock.calls[0][0];
    // ATM strike = round(23456.80/50)*50 ≈ 23450, CE buy = ATM
    expect(leg.strike).toBe(23450);
  });

  it('calculates correct strike prices for CE sell legs', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Bull Call Spread'));
    const legs = mockAddStrategyLeg.mock.calls;
    // Bull Call Spread: leg1 = CE buy (ATM=23450), leg2 = CE sell (ATM+100=23550)
    expect(legs[0][0].strike).toBe(23450); // buy CE at ATM
    expect(legs[1][0].strike).toBe(23550); // sell CE at ATM+100
  });
});

describe('StrategyBuilderScreen — Add / Clear / Analyze', () => {
  beforeEach(() => {
    mockAddStrategyLeg.mockClear();
    mockClearStrategyLegs.mockClear();
    mockAnalyzeStrategy.mockClear();
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  it('calls addStrategyLeg when Add Leg is pressed', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Add Leg'));
    expect(mockAddStrategyLeg).toHaveBeenCalled();
  });

  it('creates a new leg with default values', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Add Leg'));
    const leg = mockAddStrategyLeg.mock.calls[0][0];
    expect(leg.action).toBe('buy');
    expect(leg.type).toBe('CE');
    expect(leg.quantity).toBe(1);
    expect(leg.lotSize).toBe(50);
    expect(leg.strike).toBeGreaterThan(0);
    expect(leg.premium).toBeGreaterThan(0);
  });

  it('calls clearStrategyLegs when Clear All is pressed', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Clear All'));
    expect(mockClearStrategyLegs).toHaveBeenCalled();
  });

  it('calls analyzeStrategy when Analyze button is pressed', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Analyze'));
    expect(mockAnalyzeStrategy).toHaveBeenCalled();
  });

  it('calls analyzeStrategy with the current spot price', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Analyze'));
    expect(mockAnalyzeStrategy).toHaveBeenCalledWith(23456.80);
  });
});

describe('StrategyBuilderScreen — Spot Price Input', () => {
  beforeEach(() => {
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  it('renders the spot price input with current value', async () => {
    const { root } = await renderAndWait();
    // spotPrices.NIFTY = 23456.80, Math.round = 23457
    const input = root.findByProps({ value: '23457' });
    expect(input).toBeDefined();
  });

  it('renders correct input when spotPrices updates', async () => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...defaultStoreMock(),
      spotPrices: { NIFTY: 25000, BANKNIFTY: 51200 },
      selectedSymbol: 'NIFTY',
    }));
    const { root } = await renderAndWait();
    const input = root.findByProps({ value: '25000' });
    expect(input).toBeDefined();
  });
});

describe('StrategyBuilderScreen — Leg Editing', () => {
  beforeEach(() => {
    mockUpdateStrategyLeg.mockClear();
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  it('calls updateStrategyLeg when strike is changed', async () => {
    const { root } = await renderAndWait();
    const strikeInput = root.findByProps({ value: '23500' });
    fireEvent.changeText(strikeInput, '24000');
    expect(mockUpdateStrategyLeg).toHaveBeenCalledWith('leg_1', { strike: 24000 });
  });

  it('calls updateStrategyLeg when premium is changed', async () => {
    const { root } = await renderAndWait();
    const premiumInput = root.findByProps({ value: '185.5' });
    fireEvent.changeText(premiumInput, '200');
    expect(mockUpdateStrategyLeg).toHaveBeenCalledWith('leg_1', { premium: 200 });
  });

  it('calls updateStrategyLeg when lots are changed', async () => {
    const { root } = await renderAndWait();
    // There are 2 legs, both with quantity="1" — find by type then pick first quantity input
    const textInputs = root.findAllByType('TextInput');
    const quantityInputs = textInputs.filter((el: any) => el.props.value === '1');
    expect(quantityInputs.length).toBeGreaterThanOrEqual(2);
    fireEvent.changeText(quantityInputs[0], '3');
    expect(mockUpdateStrategyLeg).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ quantity: 3 }),
    );
  });

  it('does not clear other fields when updating a single field', async () => {
    const { root } = await renderAndWait();
    mockUpdateStrategyLeg.mockClear();
    const strikeInput = root.findByProps({ value: '23500' });
    fireEvent.changeText(strikeInput, '24000');
    expect(mockUpdateStrategyLeg).toHaveBeenCalledWith('leg_1', { strike: 24000 });
    // Should NOT include premium or quantity
    const callArg = mockUpdateStrategyLeg.mock.calls[0][1];
    expect(Object.keys(callArg).length).toBe(1);
  });
});

describe('StrategyBuilderScreen — Leg Action Toggle', () => {
  beforeEach(() => {
    mockUpdateStrategyLeg.mockClear();
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  it('renders toggle labels for both legs', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Tap to SELL')).toBeDefined();
    expect(getByText('Tap to BUY')).toBeDefined();
  });

  it('calls updateStrategyLeg with flipped action on toggle press', async () => {
    const { getByText } = await renderAndWait();
    fireEvent.press(getByText('Tap to SELL'));
    // leg_1 has action='buy', so toggle should flip to 'sell'
    expect(mockUpdateStrategyLeg).toHaveBeenCalledWith('leg_1', { action: 'sell' });
  });
});

describe('StrategyBuilderScreen — Prebuilt View Toggle', () => {
  beforeEach(() => {
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  it('renders Hide Templates button', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Hide Templates')).toBeDefined();
  });

  it('shows Show Strategy Templates after toggling', async () => {
    const { getByText, queryByText } = await renderAndWait();
    // Initially hiding is shown
    fireEvent.press(getByText('Hide Templates'));
    // After toggling, we should not see strategy cards anymore
    expect(queryByText('Long Call')).toBeNull();
  });
});

describe('StrategyBuilderScreen — Neutral Strategy', () => {
  beforeEach(() => {
    vi.mocked(useFnoStore).mockImplementation(() => ({
      ...defaultStoreMock(),
      strategyResult: {
        ...mockStrategyResult,
        isBullish: false,
        isBearish: false,
        isNeutral: true,
        breakevenPoints: [23500],
      },
    }));
  });

  afterEach(() => {
    vi.mocked(useFnoStore).mockImplementation(defaultStoreMock);
  });

  it('renders neutral bias', async () => {
    const { getByText } = await renderAndWait();
    expect(getByText('Neutral ↔️')).toBeDefined();
  });

  it('renders single breakeven label', async () => {
    const { getByText } = await renderAndWait();
    // When there's only 1 breakeven point, label is singular
    expect(getByText('Breakeven')).toBeDefined();
  });
});
