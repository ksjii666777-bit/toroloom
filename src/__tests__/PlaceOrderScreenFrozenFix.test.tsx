/**
 * ============================================================================
 * Toroloom — PlaceOrderScreen Frozen Navigation Object Regression Tests
 * ============================================================================
 *
 * Verifies that PlaceOrderScreen does NOT crash with the error:
 *   "You attempted to set the key 'current' with the value 'undefined' on
 *    an object that is meant to be immutable and has been frozen."
 *
 * Root cause: React Navigation v7 in dev mode deeply freezes navigation
 * descriptors.  react-native's Animated.View tried to set internal '.current'
 * properties on frozen style objects when processing reanimated
 * useAnimatedStyle output.
 *
 * Fix: Switched PlaceOrderScreen from react-native's Animated.View to
 * reanimated's Animated.View, which properly handles reanimated style objects
 * without attempting to navigate through or mutate frozen descriptors.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-test-renderer';
import { render, fireEvent } from './testUtils';
import { mockStocks, mockHoldings } from '../constants/mockData';

// ==================== Mocks ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockBuyStock = vi.fn(() => Promise.resolve());
const mockSellStock = vi.fn(() => Promise.resolve());

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', primaryLight: '#8B83FF', primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B', secondaryGradient: ['#FF6B6B', '#EE5A24'] as const,
      success: '#00C853', successGradient: ['#00C853', '#009624'] as const,
      danger: '#FF1744', warning: '#FFC107',
      marketUp: '#00C853', marketDown: '#FF1744', marketNeutral: '#FFC107',
      text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
      white: '#FFFFFF', bg: '#0D0D2B', bgSecondary: '#1A1A3E',
      bgCard: '#222255', bgCardLight: '#2A2A5E', bgInput: '#1E1E4A',
      bgDark: '#070720', bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E', borderLight: '#3A3A7E', divider: '#1E1E4A',
      transparent: 'transparent',
    }, isDark: true,
  }),
}));

vi.mock('../store/marketStore', () => ({
  useMarketStore: () => ({ stocks: mockStocks }),
}));

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: () => ({
    buyStock: mockBuyStock,
    sellStock: mockSellStock,
    holdings: mockHoldings,
  }),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user_1', name: 'Rahul Sharma', email: 'rahul.sharma@email.com', balance: 2500000 },
  }),
}));

// Must be imported AFTER mocks
import PlaceOrderScreen from '../screens/trade/PlaceOrderScreen';

// ==================== Helpers ====================

const defaultRoute = {
  params: { stockId: 'RELIANCE', symbol: 'RELIANCE', tradeType: 'buy' },
};

function renderWithTimeTravel(jsx: React.ReactElement) {
  vi.useFakeTimers();
  const result = render(jsx);
  act(() => { vi.advanceTimersByTime(500); });
  return { ...result, cleanup: () => { result.unmount(); vi.useRealTimers(); } };
}

/**
 * Create a frozen navigation object that simulates React Navigation v7
 * dev-mode behaviour where navigation descriptors are deeply frozen.
 */
function createFrozenNavigation() {
  return Object.freeze({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: true,
    getId: () => 'PlaceOrder',
    getState: () =>
      Object.freeze({
        key: 'PlaceOrder',
        name: 'PlaceOrder',
        params: Object.freeze({ stockId: 'RELIANCE', symbol: 'RELIANCE', tradeType: 'buy' }),
        routes: [],
        index: 0,
        stale: false,
        type: 'stack',
      }),
  });
}

// ==================== Tests ====================

describe('PlaceOrderScreen — Frozen Navigation Object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Render resilience ───────────────────────────────────

  describe('render resilience with frozen navigation', () => {
    it('renders without crashing when navigation is a frozen object', () => {
      const frozenNav = createFrozenNavigation();
      const { toJSON, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders without crashing when navigation state is deeply frozen', () => {
      const state = Object.freeze({
        key: 'PlaceOrder', name: 'PlaceOrder',
        params: Object.freeze({}), routes: Object.freeze([]),
      });
      const frozenNav = Object.freeze({
        navigate: mockNavigate, goBack: mockGoBack, getState: () => state, getId: () => 'PlaceOrder',
      });
      const { toJSON, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders full content with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      expect(getByText('RELIANCE')).toBeDefined();
      expect(getByText('Reliance Industries Ltd.')).toBeDefined();
      expect(getByText('Buy')).toBeDefined();
      expect(getByText('Sell')).toBeDefined();
      expect(getByText('Order Type')).toBeDefined();
      expect(getByText('Product Type')).toBeDefined();
      expect(getByText('Quantity')).toBeDefined();
      expect(getByText('Available Balance')).toBeDefined();
      cleanup();
    });

    it('renders order type chips with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getAllByText, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      expect(getAllByText('MARKET')[0]).toBeDefined();
      expect(getAllByText('LIMIT')[0]).toBeDefined();
      expect(getAllByText('SL')[0]).toBeDefined();
      expect(getAllByText('SL-M')[0]).toBeDefined();
      cleanup();
    });

    it('renders product type chips with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getAllByText, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      expect(getAllByText('CNC')[0]).toBeDefined();
      expect(getAllByText('MIS')[0]).toBeDefined();
      expect(getAllByText('NRML')[0]).toBeDefined();
      cleanup();
    });

    it('renders quantity presets with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      expect(getByText('10')).toBeDefined();
      expect(getByText('50')).toBeDefined();
      expect(getByText('100')).toBeDefined();
      expect(getByText('Max')).toBeDefined();
      cleanup();
    });

    it('renders order summary card when quantity is entered with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByTestId, getByText, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      act(() => { fireEvent.press(getByTestId('quickQty_10')); });
      expect(getByText('Order Summary')).toBeDefined();
      expect(getByText('Estimated Total')).toBeDefined();
      expect(getByText('Grand Total')).toBeDefined();
      cleanup();
    });
  });

  // ── Mutation detection ─────────────────────────────────

  describe('frozen object mutation detection', () => {
    it('does NOT attempt to set properties on frozen navigation during mount', () => {
      const frozenNav = createFrozenNavigation();
      expect(() => {
        renderWithTimeTravel(
          <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
        );
      }).not.toThrow();
    });

    it('does NOT mutate frozen navigation after re-render', () => {
      const frozenNav = createFrozenNavigation();
      const { update, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      expect(() => {
        update(<PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />);
      }).not.toThrow();
      cleanup();
    });

    it('handles mount with frozen navigation then unmounts gracefully', () => {
      const frozenNav = createFrozenNavigation();
      const { unmount } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      expect(() => { unmount(); }).not.toThrow();
    });

    it('preserves frozen status of navigation after render', () => {
      const frozenNav = createFrozenNavigation();
      const { cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      expect(() => { (frozenNav as any).newProp = 'test'; }).toThrow();
      cleanup();
    });
  });

  // ── Navigation functionality ───────────────────────────

  describe('navigation still works through frozen object', () => {
    it('calls goBack when close button is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByTestId, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      act(() => { fireEvent.press(getByTestId('backBtn')); });
      expect(mockGoBack).toHaveBeenCalled();
      cleanup();
    });

    it('toggles between Buy and Sell with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByTestId, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      // Toggle to Sell
      act(() => { fireEvent.press(getByTestId('sellToggle')); });
      // Toggle back to Buy
      act(() => { fireEvent.press(getByTestId('buyToggle')); });
      expect(mockNavigate).not.toHaveBeenCalled(); // No navigation on toggle
      cleanup();
    });

    it('selects order type LIMIT showing price fields with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByTestId, getByText, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      act(() => { fireEvent.press(getByTestId('orderType_LIMIT')); });
      expect(getByText('Limit Price (₹)')).toBeDefined();
      expect(mockNavigate).not.toHaveBeenCalled();
      cleanup();
    });

    it('selects product type MIS with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByTestId, getByText, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      act(() => { fireEvent.press(getByTestId('productType_MIS')); });
      expect(getByText(/Intraday/)).toBeDefined();
      expect(mockNavigate).not.toHaveBeenCalled();
      cleanup();
    });

    it('selects quick quantity preset with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByTestId, getByText, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      act(() => { fireEvent.press(getByTestId('quickQty_50')); });
      expect(getByText('50 shares')).toBeDefined();
      expect(mockNavigate).not.toHaveBeenCalled();
      cleanup();
    });

    it('can navigate back after interacting with order form', () => {
      const frozenNav = createFrozenNavigation();
      const { getByTestId, cleanup } = renderWithTimeTravel(
        <PlaceOrderScreen route={defaultRoute} navigation={frozenNav as any} />,
      );
      // Interact with the form
      act(() => { fireEvent.press(getByTestId('quickQty_10')); });
      act(() => { fireEvent.press(getByTestId('orderType_LIMIT')); });
      // Then navigate back
      act(() => { fireEvent.press(getByTestId('backBtn')); });
      expect(mockGoBack).toHaveBeenCalled();
      cleanup();
    });
  });
});
