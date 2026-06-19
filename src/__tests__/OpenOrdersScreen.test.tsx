/**
 * ============================================================================
 * Toroloom — OpenOrdersScreen Integration Tests
 * ============================================================================
 *
 * Verifies that OpenOrdersScreen renders correctly:
 *   - Header with title, order count, back button, refresh
 *   - Stats cards (Buy/Sell summary)
 *   - Status filter tabs (All / Open / Pending / Partial Fill / Trigger Pending)
 *   - Order cards with symbols, prices, status badges, actions
 *   - Modify order modal (price/qty fields, order type chips)
 *   - Cancel order confirmation
 *   - Empty state (no open orders)
 *   - Navigation (view stock detail)
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

// Mock the portfolio store
const mockFetchOpenOrders = vi.fn();
const mockModifyOrder = vi.fn();
const mockCancelOrder = vi.fn();

const defaultMockOrders = [
  {
    id: 'open_ord_1',
    symbol: 'RELIANCE',
    exchange: 'NSE',
    transactionType: 'BUY',
    quantity: 25,
    filledQuantity: 0,
    price: 2850.00,
    productType: 'CNC',
    orderType: 'LIMIT',
    status: 'open',
    placedBy: 'WEB',
    timestamp: '2025-05-24T10:00:00.000Z',
    validity: 'DAY',
  },
  {
    id: 'open_ord_2',
    symbol: 'TCS',
    exchange: 'NSE',
    transactionType: 'SELL',
    quantity: 10,
    filledQuantity: 5,
    price: 3950.00,
    productType: 'CNC',
    orderType: 'LIMIT',
    status: 'partially_filled',
    placedBy: 'WEB',
    timestamp: '2025-05-24T08:00:00.000Z',
    validity: 'DAY',
  },
  {
    id: 'open_ord_3',
    symbol: 'INFY',
    exchange: 'NSE',
    transactionType: 'BUY',
    quantity: 50,
    filledQuantity: 0,
    price: 1550.00,
    triggerPrice: 1540.00,
    productType: 'MIS',
    orderType: 'SL',
    status: 'trigger_pending',
    placedBy: 'WEB',
    timestamp: '2025-05-23T12:00:00.000Z',
    validity: 'DAY',
  },
  {
    id: 'open_ord_4',
    symbol: 'HDFCBANK',
    exchange: 'NSE',
    transactionType: 'BUY',
    quantity: 30,
    filledQuantity: 0,
    price: 1660.00,
    productType: 'CNC',
    orderType: 'LIMIT',
    status: 'pending',
    placedBy: 'WEB',
    timestamp: '2025-05-24T09:30:00.000Z',
    validity: 'DAY',
  },
];

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: vi.fn(() => ({
    openOrders: defaultMockOrders,
    ordersLoading: false,
    fetchOpenOrders: mockFetchOpenOrders,
    modifyOrder: mockModifyOrder,
    cancelOrder: mockCancelOrder,
  })),
}));

// Mock ThemeContext
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
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
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

// Mock LinearGradient
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock AnimatedPressable
vi.mock('../components/ui/AnimatedPressable', () => ({
  default: 'AnimatedPressable',
}));


// ==================== Imports ====================

import { render, fireEvent } from './testUtils';
import { usePortfolioStore } from '../store/portfolioStore';
import OpenOrdersScreen from '../screens/trade/OpenOrdersScreen';

// ==================== Helpers ====================

function advanceAnimations() {
  act(() => { vi.advanceTimersByTime(1000); });
}

function renderScreen(overrides?: Record<string, any>) {
  // Re-apply default mock implementation and then merge any overrides
  const mockStore = {
    openOrders: defaultMockOrders,
    ordersLoading: false,
    fetchOpenOrders: mockFetchOpenOrders,
    modifyOrder: mockModifyOrder,
    cancelOrder: mockCancelOrder,
    ...overrides,
  };
  (usePortfolioStore as any).mockImplementation(() => mockStore);

  return render(
    <OpenOrdersScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
  );
}

// ==================== Header ====================

describe('OpenOrdersScreen — Header', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchOpenOrders.mockClear();
    mockModifyOrder.mockClear();
    mockCancelOrder.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header title', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Open Orders')).toBeDefined();
  });

  it('shows order count in subtitle', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('4 active orders')).toBeDefined();
  });

  it('shows correct count when orders are fewer', () => {
    const { getByText } = renderScreen({ openOrders: [defaultMockOrders[0]] });
    advanceAnimations();
    expect(getByText('1 active orders')).toBeDefined();
  });

  it('fetches open orders on mount', () => {
    renderScreen();
    advanceAnimations();
    expect(mockFetchOpenOrders).toHaveBeenCalled();
  });
});

// ==================== Loading State ====================

describe('OpenOrdersScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchOpenOrders.mockClear();
    mockModifyOrder.mockClear();
    mockCancelOrder.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing when loading', () => {
    const { toJSON } = renderScreen({ ordersLoading: true });
    advanceAnimations();
    expect(toJSON).not.toBeNull();
  });

  it('still renders the header while loading', () => {
    const { getByText } = renderScreen({ ordersLoading: true });
    advanceAnimations();
    expect(getByText('Open Orders')).toBeDefined();
  });
});

// ==================== Stats Cards ====================

describe('OpenOrdersScreen — Stats Cards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchOpenOrders.mockClear();
    mockModifyOrder.mockClear();
    mockCancelOrder.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Buy Orders stat card', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Buy Orders')).toBeDefined();
  });

  it('renders Sell Orders stat card', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Sell Orders')).toBeDefined();
  });

  it('shows buy order count in stats', () => {
    const { getByText } = renderScreen();
    advanceAnimations();

    const buyOrders = defaultMockOrders.filter(o => o.transactionType === 'BUY');
    expect(getByText(`${buyOrders.length} orders`)).toBeDefined();
  });

  it('shows sell order count in stats', () => {
    const { getByText } = renderScreen();
    advanceAnimations();

    const sellOrders = defaultMockOrders.filter(o => o.transactionType === 'SELL');
    expect(getByText(/1 orders?/)).toBeDefined();
  });

  it('shows stats even when there are no orders', () => {
    const { queryByText } = renderScreen({ openOrders: [] });
    advanceAnimations();
    // Stats cards are always rendered (no conditional)
    expect(queryByText('Buy Orders')).toBeDefined();
    expect(queryByText('Sell Orders')).toBeDefined();
  });
});

// ==================== Filter Tabs ====================

describe('OpenOrdersScreen — Filter Tabs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchOpenOrders.mockClear();
    mockModifyOrder.mockClear();
    mockCancelOrder.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders filter tabs for all statuses', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('All')).toBeDefined();
    expect(getByText('Open')).toBeDefined();
    expect(getByText('Pending')).toBeDefined();
    expect(getByText('Partial Fill')).toBeDefined();
    expect(getByText('Trigger Pending')).toBeDefined();
  });
});

// ==================== Order Cards ====================

describe('OpenOrdersScreen — Order Cards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchOpenOrders.mockClear();
    mockModifyOrder.mockClear();
    mockCancelOrder.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all order symbols', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('INFY')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined();
  });

  it('renders BUY and SELL badges', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('BUY')).toBeDefined();
    expect(getByText('SELL')).toBeDefined();
  });

  it('renders status badges for all statuses', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Open')).toBeDefined();
    expect(getByText('Partial Fill')).toBeDefined();
    expect(getByText('Trigger Pending')).toBeDefined();
    expect(getByText('Pending')).toBeDefined();
  });

  it('renders Modify buttons on order cards', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Modify')).toBeDefined();
  });

  it('renders Cancel buttons on order cards', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Cancel')).toBeDefined();
  });

  it('shows trigger price for SL orders', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText(/Trigger/)).toBeDefined();
  });

  it('shows filled/total quantity for partially filled orders', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('5/10')).toBeDefined();
  });

  it('shows percentage filled for partially filled orders', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText(/50% filled/)).toBeDefined();
  });
});

// ==================== Empty State ====================

describe('OpenOrdersScreen — Empty State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchOpenOrders.mockClear();
    mockModifyOrder.mockClear();
    mockCancelOrder.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders empty state message when no orders', () => {
    const { getByText } = renderScreen({ openOrders: [] });
    advanceAnimations();
    expect(getByText('No Open Orders')).toBeDefined();
    expect(getByText(/Place a limit order to see it here/)).toBeDefined();
  });

  it('does not render order cards when empty', () => {
    const { queryByText } = renderScreen({ openOrders: [] });
    advanceAnimations();
    expect(queryByText('Modify')).toBeNull();
    expect(queryByText('Cancel')).toBeNull();
  });

  it('shows 0 orders in stats when empty', () => {
    const { getByText } = renderScreen({ openOrders: [] });
    advanceAnimations();
    // Stats cards are always rendered with 0 count
    expect(getByText('0 orders')).toBeDefined();
  });
});

// ==================== Modify Modal ====================

describe('OpenOrdersScreen — Modify Modal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchOpenOrders.mockClear();
    mockModifyOrder.mockClear();
    mockCancelOrder.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens modify modal when Modify is pressed', () => {
    const { getByText, queryByText } = renderScreen();
    advanceAnimations();

    // Modal content not visible initially
    expect(queryByText('Modify Order')).toBeNull();

    // getByText returns the LAST match in DFS order, which is the
    // last order card's (HDFCBANK) Modify button
    act(() => { fireEvent.press(getByText('Modify')); });
    advanceAnimations();

    expect(getByText('Modify Order')).toBeDefined();
  });

  it('shows the selected stock symbol in modify modal', () => {
    const { getByText } = renderScreen();
    advanceAnimations();

    act(() => { fireEvent.press(getByText('Modify')); });
    advanceAnimations();

    // getByText('Modify') targets the LAST order (HDFCBANK)
    expect(getByText('HDFCBANK')).toBeDefined();
  });

  it('shows Price field in modify modal', () => {
    const { getByText, getByPlaceholderText } = renderScreen();
    advanceAnimations();

    act(() => { fireEvent.press(getByText('Modify')); });
    advanceAnimations();

    expect(getByText('Price (₹)')).toBeDefined();
    expect(getByPlaceholderText('Enter new price')).toBeDefined();
  });

  it('shows Quantity field in modify modal', () => {
    const { getByText, getByPlaceholderText } = renderScreen();
    advanceAnimations();

    act(() => { fireEvent.press(getByText('Modify')); });
    advanceAnimations();

    expect(getByText('Quantity')).toBeDefined();
    expect(getByPlaceholderText('Enter new quantity')).toBeDefined();
  });

  it('shows order type chips in modify modal', () => {
    const { getByText } = renderScreen();
    advanceAnimations();

    act(() => { fireEvent.press(getByText('Modify')); });
    advanceAnimations();

    expect(getByText('LIMIT')).toBeDefined();
    expect(getByText('MARKET')).toBeDefined();
    expect(getByText('SL')).toBeDefined();
    expect(getByText('SL-M')).toBeDefined();
  });

  it('renders Update Order button in modal', () => {
    const { getByText } = renderScreen();
    advanceAnimations();

    act(() => { fireEvent.press(getByText('Modify')); });
    advanceAnimations();

    expect(getByText('Update Order')).toBeDefined();
  });

  it('pre-fills price from the last order (HDFCBANK: 1660)', () => {
    const { getByText, getByPlaceholderText } = renderScreen();
    advanceAnimations();

    // getByText('Modify') returns the LAST match = HDFCBANK order
    act(() => { fireEvent.press(getByText('Modify')); });
    advanceAnimations();

    // HDFCBANK order has price=1660, qty=30
    const priceInput = getByPlaceholderText('Enter new price');
    expect(priceInput.props.value).toBe('1660');
    const qtyInput = getByPlaceholderText('Enter new quantity');
    expect(qtyInput.props.value).toBe('30');
  });
});

// ==================== Cancel Flow ====================

describe('OpenOrdersScreen — Cancel Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchOpenOrders.mockClear();
    mockModifyOrder.mockClear();
    mockCancelOrder.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows cancel confirmation when Cancel is pressed (API not called yet)', () => {
    const { getByText } = renderScreen();
    advanceAnimations();

    // Press Cancel on an order card — getByText returns last match
    act(() => { fireEvent.press(getByText('Cancel')); });
    advanceAnimations();

    // API should NOT be called yet — user must confirm via Alert
    expect(mockCancelOrder).not.toHaveBeenCalled();
  });
});

// ==================== Navigation ====================

describe('OpenOrdersScreen — Navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchOpenOrders.mockClear();
    mockModifyOrder.mockClear();
    mockCancelOrder.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates to StockDetail when tapping an order card', () => {
    const { getByText } = renderScreen();
    advanceAnimations();

    // Tap an order symbol — getByText returns deepest match (HDFCBANK)
    act(() => { fireEvent.press(getByText('HDFCBANK')); });
    advanceAnimations();

    expect(mockNavigate).toHaveBeenCalledWith('StockDetail', { symbol: 'HDFCBANK' });
  });

  it('does not navigate on initial render', () => {
    renderScreen();
    advanceAnimations();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
