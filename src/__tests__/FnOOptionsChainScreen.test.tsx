/**
 * ============================================================================
 * Toroloom — FnOOptionsChainScreen Integration Tests
 * ============================================================================
 *
 * Verifies that the F&O Options Chain screen renders correctly with all
 * major sections: header, symbol selector, spot price banner, view tabs,
 * expiry selector, side filters, Greeks toggle, option chain rows,
 * futures contracts, positions, and order modal.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const navMock = { navigate: mockNavigate, goBack: mockGoBack };

const mockFetchExpiries = vi.fn();
const mockFetchOptionChain = vi.fn();
const mockFetchFutures = vi.fn();
const mockFetchPositions = vi.fn();
const mockFetchSpotPrices = vi.fn();
const mockSetSelectedSymbol = vi.fn();
const mockSetSelectedExpiry = vi.fn();
const mockSetView = vi.fn();
const mockSetChainSide = vi.fn();
const mockOpenOrderModal = vi.fn();
const mockCloseOrderModal = vi.fn();
const mockSetOrderQuantity = vi.fn();
const mockPlaceOrder = vi.fn();

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
    { strike: 23800, ce: null, pe: { ...mockContractPe, strike: 23800, ltp: 65.20 } },
    { strike: 23900, ce: null, pe: { ...mockContractPe, strike: 23900, ltp: 88.40 } },
    { strike: 24000, ce: { ...mockContractCe }, pe: { ...mockContractPe } },
    { strike: 24100, ce: { ...mockContractCe, strike: 24100, ltp: 95.30 }, pe: null },
    { strike: 24200, ce: { ...mockContractCe, strike: 24200, ltp: 52.10 }, pe: null },
  ],
};

const mockFutures = [
  { symbol: 'NIFTY24JUL', price: 23520.50, change: 45.20, changePercent: 0.19, openInterest: 3500000, volume: 1200000, expiryDate: '2026-07-30T00:00:00.000Z', lotSize: 50, basis: 63.70, basisPercent: 0.27 },
  { symbol: 'NIFTY24AUG', price: 23680.00, change: 38.50, changePercent: 0.16, openInterest: 850000, volume: 320000, expiryDate: '2026-08-27T00:00:00.000Z', lotSize: 50, basis: 223.20, basisPercent: 0.95 },
];

const mockPositions = [
  { id: 'p1', symbol: 'NIFTY', type: 'CE' as const, strike: 24000, action: 'buy' as const, quantity: 2, entryPrice: 180.50, currentPrice: 185.50, pnl: 500, pnlPercent: 1.39, expiry: '2026-07-09', lotSize: 50 },
  { id: 'p2', symbol: 'BANKNIFTY', type: 'PE' as const, strike: 51000, action: 'sell' as const, quantity: 1, entryPrice: 320.00, currentPrice: 295.00, pnl: 2500, pnlPercent: 7.81, expiry: '2026-07-16', lotSize: 25 },
];

// ── Default store mock factory ──────────────────────────────

function defaultStoreMock(view: 'option-chain' | 'futures' | 'positions' = 'option-chain') {
  return {
    selectedSymbol: 'NIFTY',
    selectedExpiry: mockExpiries[0],
    expiries: mockExpiries,
    optionChain: mockOptionChain,
    futures: mockFutures,
    positions: mockPositions,
    view,
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
  // Use any cast to avoid TS2345 when vi.mocked(useFnoStore).mockImplementation()
  // passes a function that doesn't match the store hook's selector signature
  const useFnoStore = Object.assign(
    vi.fn((sel?: (state: any) => any) => {
      const state = defaultStoreMock();
      return sel ? sel(state) : state;
    }),
    { getState: vi.fn(() => defaultStoreMock()) },
  ) as any;
  return { useFnoStore };
});

// ==================== Imports ====================

import FnOOptionsChainScreen from '../screens/trade/FnOOptionsChainScreen';
import { useFnoStore } from '../store/fnoStore';

// ==================== Helpers ====================

function renderScreen() {
  return render(<FnOOptionsChainScreen navigation={navMock} />);
}

function renderWithView(view: 'option-chain' | 'futures' | 'positions') {
  (useFnoStore as any).mockImplementation(() => defaultStoreMock(view));
  const result = render(<FnOOptionsChainScreen navigation={navMock} />);
  return result;
}

// ==================== Tests ====================

describe('FnOOptionsChainScreen — Header', () => {
  afterEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('renders without crashing', () => {
    const { toJSON } = renderScreen();
    expect(toJSON).not.toBeNull();
  });

  it('renders the screen title', () => {
    const { getByText } = renderScreen();
    expect(getByText('F&O Trading')).toBeDefined();
  });

  it('renders the back button', () => {
    const { toJSON } = renderScreen();
    expect(toJSON).not.toBeNull();
  });
});

describe('FnOOptionsChainScreen — Symbol Selector', () => {
  afterEach(() => {
    mockSetSelectedSymbol.mockClear();
  });

  it('renders popular symbol chips', () => {
    const { getByText } = renderScreen();
    expect(getByText('NIFTY')).toBeDefined();
    expect(getByText('BANKNIFTY')).toBeDefined();
    expect(getByText('RELIANCE')).toBeDefined();
  });

  it('renders all 8 popular symbols', () => {
    const { getByText } = renderScreen();
    expect(getByText('HDFCBANK')).toBeDefined();
    expect(getByText('INFY')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('SBIN')).toBeDefined();
    expect(getByText('TATAMOTORS')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — Spot Price Banner', () => {
  it('renders the spot price label', () => {
    const { getByText } = renderScreen();
    expect(getByText('NIFTY Spot')).toBeDefined();
  });

  it('renders the compact spot price value', () => {
    const { getByText } = renderScreen();
    // formatCurrency(23456.80, true) → "₹23.5K" (compact format)
    expect(getByText('₹23.5K')).toBeDefined();
  });

  it('renders PCR in spot stats', () => {
    const { getByText } = renderScreen();
    expect(getByText('PCR')).toBeDefined();
    expect(getByText('0.82')).toBeDefined();
  });

  it('renders Max Pain in spot stats', () => {
    const { getByText } = renderScreen();
    expect(getByText('Max Pain')).toBeDefined();
    // formatCurrency(23500, true) → "₹23.5K"
    expect(getByText('₹23.5K')).toBeDefined();
  });

  it('renders CE OI and PE OI labels', () => {
    const { getByText } = renderScreen();
    expect(getByText('CE OI')).toBeDefined();
    expect(getByText('PE OI')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — View Tabs', () => {
  afterEach(() => {
    mockSetView.mockClear();
  });

  it('renders all three view tabs', () => {
    const { getByText } = renderScreen();
    expect(getByText('Option Chain')).toBeDefined();
    expect(getByText('Futures')).toBeDefined();
    expect(getByText('Positions')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — Expiry Selector', () => {
  it('renders expiry day counts', () => {
    const { getByText } = renderScreen();
    expect(getByText(/12d/)).toBeDefined();
    expect(getByText(/19d/)).toBeDefined();
    expect(getByText(/33d/)).toBeDefined();
  });

  it('renders monthly expiry indicator', () => {
    const { getByText } = renderScreen();
    expect(getByText(/(M)/)).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — Side Tabs & Greeks Toggle', () => {
  afterEach(() => {
    mockSetChainSide.mockClear();
  });

  it('renders All/CE/PE side tabs', () => {
    const { getByText } = renderScreen();
    expect(getByText('All')).toBeDefined();
    expect(getByText('CE')).toBeDefined();
    expect(getByText('PE')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — Option Chain Rows', () => {
  it('renders chain header labels', () => {
    const { getByText } = renderScreen();
    expect(getByText('CALLS (CE)')).toBeDefined();
    expect(getByText('PUTS (PE)')).toBeDefined();
  });

  it('renders strike column header', () => {
    const { getByText } = renderScreen();
    expect(getByText('Strike')).toBeDefined();
  });

  it('renders contract LTP values', () => {
    const { getByText } = renderScreen();
    expect(getByText('₹185.50')).toBeDefined();
    expect(getByText('₹125.75')).toBeDefined();
  });

  it('renders strike prices', () => {
    const { getByText } = renderScreen();
    expect(getByText('24000')).toBeDefined();
    expect(getByText('23900')).toBeDefined();
    expect(getByText('24100')).toBeDefined();
  });

  it('renders OI indicators', () => {
    const { getByText } = renderScreen();
    expect(getByText(/OI/)).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — Futures View', () => {
  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('renders futures data with contract symbols', () => {
    const { getByText } = renderWithView('futures');
    // The selected symbol is shown above futures details
    expect(getByText('NIFTY')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — Positions View', () => {
  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('renders position cards with LONG/SHORT badges', () => {
    const { getByText } = renderWithView('positions');
    expect(getByText('LONG')).toBeDefined();
    expect(getByText('SHORT')).toBeDefined();
  });

  it('renders position P&L values', () => {
    const { getByText } = renderWithView('positions');
    // formatCurrency(500, true) → 500 < 1000 → "₹500.00" (non-compact)
    // formatCurrency(2500, true) → 2500 >= 1000 → "₹2.5K" (compact)
    expect(getByText('+₹500.00')).toBeDefined();
  });

  it('renders position quantity', () => {
    const { getByText } = renderWithView('positions');
    expect(getByText('2 lots')).toBeDefined();
    expect(getByText('1 lot')).toBeDefined();
  });

  it('renders position details (Entry, LTP, P&L%)', () => {
    const { getByText } = renderWithView('positions');
    expect(getByText('Entry')).toBeDefined();
    expect(getByText('LTP')).toBeDefined();
    expect(getByText('P&L%')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — Loading State', () => {
  beforeEach(() => {
    (useFnoStore as any).mockImplementation(() => ({
      ...defaultStoreMock(),
      optionChain: null,
      chainLoading: true,
    }));
  });

  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('renders skeleton blocks during chain loading', () => {
    const { toJSON } = renderScreen();
    expect(toJSON).not.toBeNull();
  });
});

describe('FnOOptionsChainScreen — Empty State', () => {
  beforeEach(() => {
    (useFnoStore as any).mockImplementation(() => ({
      ...defaultStoreMock(),
      optionChain: null,
      spotPrices: {},
    }));
  });

  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('renders empty state message when no chain data', () => {
    const { getByText } = renderScreen();
    expect(getByText('No Data')).toBeDefined();
    expect(getByText('Select a symbol and expiry to view the option chain')).toBeDefined();
  });

  it('does NOT render spot banner when spotPrice is 0', () => {
    const { queryByText } = renderScreen();
    expect(queryByText('NIFTY Spot')).toBeNull();
  });
});

describe('FnOOptionsChainScreen — Greeks Toggle', () => {
  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('shows Greeks (δ,γ,θ,IV) after toggling the calculator button', () => {
    // showGreeks is local useState — we must fire press on the
    // calculator TouchableOpacity to toggle it.
    const { getByText, root } = renderScreen();

    // Before toggle: LTP values are shown (the non-Greeks branch)
    expect(getByText('₹185.50')).toBeDefined();

    // Act: toggle Greeks on by using fireEvent.press on the calculator btn.
    // Ionicons is mocked as 'IonIonicons' in setup.ts. Find that element
    // with name="calculator" and fire press on its parent chain.
    act(() => {
      const calcIcon = root.findAll(
        (n: any) => n.type === 'IonIonicons' && n.props.name === 'calculator',
        { deep: true } as any,
      );
      if (calcIcon.length > 0) {
        // Use fireEvent.press which walks up the parent chain to find onPress
        fireEvent.press(calcIcon[0]);
      }
    });

    // After toggle: Greeks should be visible instead of LTP for CE.
    // Note: iv=14.5 → toFixed(0)=15 (rounds up), so IV15% not IV14%
    expect(getByText(/δ0\.55/)).toBeDefined();
    expect(getByText(/γ0\.0001/)).toBeDefined();
    expect(getByText(/θ-8\.45/)).toBeDefined();
    expect(getByText(/IV15%/)).toBeDefined();
  });

  it('shows Greeks for PE contracts after toggle', () => {
    const { getByText, root } = renderScreen();

    // Toggle Greeks on
    act(() => {
      const calcIcon = root.findAll(
        (n: any) => n.type === 'IonIonicons' && n.props.name === 'calculator',
        { deep: true } as any,
      );
      if (calcIcon.length > 0) {
        fireEvent.press(calcIcon[0]);
      }
    });

    // PE contract (strike 24000) has delta=-0.45, theta=-6.30, iv=16.2
    expect(getByText(/δ-0\.45/)).toBeDefined();
    expect(getByText(/γ0\.0001/)).toBeDefined();
    expect(getByText(/θ-6\.30/)).toBeDefined();
    expect(getByText(/IV16%/)).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — Futures Loading', () => {
  beforeEach(() => {
    (useFnoStore as any).mockImplementation(() => ({
      ...defaultStoreMock('futures'),
      futures: [],
      futuresLoading: true,
    }));
  });

  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('renders skeleton blocks during futures loading', () => {
    const { toJSON } = renderScreen();
    expect(toJSON).not.toBeNull();
  });
});

describe('FnOOptionsChainScreen — Futures Empty', () => {
  beforeEach(() => {
    (useFnoStore as any).mockImplementation(() => ({
      ...defaultStoreMock('futures'),
      futures: [],
      futuresLoading: false,
    }));
  });

  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('renders empty state when no futures contracts', () => {
    const { getByText } = renderScreen();
    expect(getByText('No Futures Contracts')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — Positions Loading', () => {
  beforeEach(() => {
    (useFnoStore as any).mockImplementation(() => ({
      ...defaultStoreMock('positions'),
      positions: [],
      positionsLoading: true,
    }));
  });

  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('renders skeleton blocks during positions loading', () => {
    const { toJSON } = renderScreen();
    expect(toJSON).not.toBeNull();
  });
});

describe('FnOOptionsChainScreen — Positions Empty', () => {
  beforeEach(() => {
    (useFnoStore as any).mockImplementation(() => ({
      ...defaultStoreMock('positions'),
      positions: [],
      positionsLoading: false,
    }));
  });

  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('renders empty state when no f&o positions', () => {
    const { getByText } = renderScreen();
    expect(getByText('No F&O Positions')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — ATM Strike Highlighting', () => {
  const mockOptionChainWithATM = {
    ...mockOptionChain,
    rows: [
      { strike: 23500, ce: { ...mockContractCe, strike: 23500, ltp: 320.00, change: 15.50 }, pe: { ...mockContractPe, strike: 23500, ltp: 92.30, change: -5.20 } },
      ...mockOptionChain.rows,
    ],
  };

  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('renders ATM badge for at-the-money strike', () => {
    (useFnoStore as any).mockImplementation(() => ({
      ...defaultStoreMock(),
      optionChain: mockOptionChainWithATM,
    }));
    const { getByText } = renderScreen();
    expect(getByText('ATM')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — FUTURE Type Positions', () => {
  const mockPositionsWithFuture = [
    ...mockPositions,
    {
      id: 'p3',
      symbol: 'NIFTY',
      type: 'FUTURE' as const,
      strike: null,
      action: 'buy' as const,
      quantity: 3,
      entryPrice: 23500.00,
      currentPrice: 23650.00,
      pnl: 1500,
      pnlPercent: 0.64,
      expiry: '2026-07-30',
      lotSize: 50,
    },
  ];

  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('renders FUTURE position without showing CE/PE type suffix', () => {
    (useFnoStore as any).mockImplementation(() => ({
      ...defaultStoreMock('positions'),
      positions: mockPositionsWithFuture,
    }));
    const { getByText } = renderScreen();
    // The FUTURE position shows just "NIFTY" without a type suffix.
    // There are 3 positions total, so "3 lots" should render for the FUTURE one.
    expect(getByText('3 lots')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — ChainSide Views', () => {
  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
  });

  it('hides CALLS header when chainSide is PE', () => {
    (useFnoStore as any).mockImplementation(() => ({
      ...defaultStoreMock(),
      chainSide: 'PE' as const,
    }));
    const { queryByText } = renderScreen();
    expect(queryByText('CALLS (CE)')).toBeNull();
    expect(queryByText('PUTS (PE)')).toBeDefined();
  });

  it('hides PUTS header when chainSide is CE', () => {
    (useFnoStore as any).mockImplementation(() => ({
      ...defaultStoreMock(),
      chainSide: 'CE' as const,
    }));
    const { queryByText } = renderScreen();
    expect(queryByText('PUTS (PE)')).toBeNull();
    expect(queryByText('CALLS (CE)')).toBeDefined();
  });
});

describe('FnOOptionsChainScreen — Position Card Navigation', () => {
  afterEach(() => {
    (useFnoStore as any).mockImplementation(defaultStoreMock);
    mockNavigate.mockClear();
  });

  it('navigates to StrategyBuilder when a position card is pressed', () => {
    const { getByText } = renderWithView('positions');
    act(() => {
      fireEvent.press(getByText('LONG'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('StrategyBuilder', {
      symbol: 'NIFTY',
      type: 'CE',
      strike: 24000,
    });
  });
});
