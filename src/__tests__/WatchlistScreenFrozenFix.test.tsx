/**
 * ============================================================================
 * Toroloom — WatchlistScreen Frozen Navigation Object Regression Tests
 * ============================================================================
 *
 * Verifies that WatchlistScreen does NOT crash with the error:
 *   "You attempted to set the key 'current' with the value 'undefined' on
 *    an object that is meant to be immutable and has been frozen."
 *
 * Root cause: React Navigation v7 in dev mode deeply freezes navigation
 * descriptors.  react-native's Animated.View tried to set internal '.current'
 * properties on frozen style objects when processing reanimated
 * useAnimatedStyle output.
 *
 * Fix: Switched WatchlistScreen from react-native's Animated.View to
 * reanimated's Animated.View, which properly handles reanimated style objects
 * without attempting to navigate through or mutate frozen descriptors.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-test-renderer';
import { render, fireEvent } from './testUtils';
import { mockStocks } from '../constants/mockData';

// ==================== Mocks ====================

const mockNavigate = vi.fn();
const mockCreateWatchlist = vi.fn();
const mockAddToWatchlist = vi.fn();
const mockRemoveFromWatchlist = vi.fn();
const mockAddPriceAlertRule = vi.fn();

const defaultWatchlists = [
  {
    id: 'w1',
    name: 'My Watchlist',
    stocks: [mockStocks[0], mockStocks[3], mockStocks[7], mockStocks[9]],
    createdAt: '2025-01-10',
  },
];

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', secondary: '#FF6B6B', success: '#00C853', danger: '#FF1744',
      marketUp: '#00C853', marketDown: '#FF1744',
      text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
      white: '#FFFFFF', bg: '#0D0D2B', bgSecondary: '#1A1A3E',
      bgCard: '#222255', bgCardLight: '#2A2A5E', bgInput: '#1E1E4A',
      bgDark: '#070720', border: '#2A2A5E', borderLight: '#3A3A7E',
      divider: '#1E1E4A', transparent: 'transparent',
    }, isDark: true,
  }),
}));

vi.mock('../store/watchlistStore', () => ({
  useWatchlistStore: () => ({
    watchlists: defaultWatchlists,
    createWatchlist: mockCreateWatchlist,
    addToWatchlist: mockAddToWatchlist,
    removeFromWatchlist: mockRemoveFromWatchlist,
  }),
}));

vi.mock('../store/marketStore', () => ({
  useMarketStore: () => ({ stocks: mockStocks }),
}));

vi.mock('../store/notificationStore', () => ({
  useNotificationStore: () => ({
    priceAlertRules: [],
    addPriceAlertRule: mockAddPriceAlertRule,
  }),
}));

// Must be imported AFTER mocks
import WatchlistScreen from '../screens/tabs/WatchlistScreen';

// ==================== Helpers ====================

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
    canGoBack: true,
    goBack: vi.fn(),
    getId: () => 'Watchlist',
    getState: () =>
      Object.freeze({
        key: 'Watchlist',
        name: 'Watchlist',
        params: {},
        routes: [],
        index: 0,
        stale: false,
        type: 'tab',
      }),
  });
}

// ==================== Tests ====================

describe('WatchlistScreen — Frozen Navigation Object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Render resilience ───────────────────────────────────

  describe('render resilience with frozen navigation', () => {
    it('renders without crashing when navigation is a frozen object', () => {
      const frozenNav = createFrozenNavigation();
      const { toJSON, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders without crashing when navigation state is deeply frozen', () => {
      const state = Object.freeze({
        key: 'Watchlist', name: 'Watchlist',
        params: Object.freeze({}), routes: Object.freeze([]),
      });
      const frozenNav = Object.freeze({
        navigate: mockNavigate, getState: () => state, getId: () => 'Watchlist',
      });
      const { toJSON, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders full content with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Watchlist')).toBeDefined();
      expect(getByText('Monitor your favorite stocks')).toBeDefined();
      cleanup();
    });

    it('renders suggested stocks section with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Suggested Stocks')).toBeDefined();
      expect(getByText('HDFCBANK')).toBeDefined(); // Stock not in watchlist
      cleanup();
    });

    it('renders sort indicator with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      expect(getByText(/Sorted by:/)).toBeDefined();
      cleanup();
    });

    it('renders Alert button for watchlist stocks with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getAllByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      const alertBtns = getAllByText('Alert');
      expect(alertBtns.length).toBeGreaterThanOrEqual(1);
      cleanup();
    });

    it('renders "No alerts set" text with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getAllByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      const noAlertTexts = getAllByText('No alerts set');
      expect(noAlertTexts.length).toBeGreaterThanOrEqual(1);
      cleanup();
    });

    it('renders stock items with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      expect(getByText('RELIANCE')).toBeDefined();
      expect(getByText('SBIN')).toBeDefined();
      expect(getByText('BAJFINANCE')).toBeDefined();
      cleanup();
    });
  });

  // ── Mutation detection ─────────────────────────────────

  describe('frozen object mutation detection', () => {
    it('does NOT attempt to set properties on frozen navigation during mount', () => {
      const frozenNav = createFrozenNavigation();
      expect(() => {
        renderWithTimeTravel(<WatchlistScreen navigation={frozenNav as any} />);
      }).not.toThrow();
    });

    it('does NOT mutate frozen navigation after re-render', () => {
      const frozenNav = createFrozenNavigation();
      const { update, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      expect(() => {
        update(<WatchlistScreen navigation={frozenNav as any} />);
      }).not.toThrow();
      cleanup();
    });

    it('handles mount with frozen navigation then unmounts gracefully', () => {
      const frozenNav = createFrozenNavigation();
      const { unmount } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      expect(() => { unmount(); }).not.toThrow();
    });

    it('preserves frozen status of navigation after render', () => {
      const frozenNav = createFrozenNavigation();
      const { cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      expect(() => { (frozenNav as any).newProp = 'test'; }).toThrow();
      cleanup();
    });
  });

  // ── Navigation functionality ───────────────────────────

  describe('navigation still works through frozen object', () => {
    it('navigates to StockDetail when a stock item is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('RELIANCE'));
      expect(mockNavigate).toHaveBeenCalledWith('StockDetail', {
        stockId: mockStocks[0].id,
        symbol: mockStocks[0].symbol,
      });
      cleanup();
    });

    it('opens price alert modal on long-press with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      fireEvent.trigger(getByText('RELIANCE'), 'onLongPress');
      expect(getByText('Current Price')).toBeDefined();
      expect(getByText('Set Price Alert')).toBeDefined();
      cleanup();
    });

    it('toggles sort direction without navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      // Tap the sort direction toggle (click on sort indicator)
      // The sort button with funnel icon is rendered
      fireEvent.press(getByText(/Sorted by:/));
      // No navigation should occur — sorting is local state
      expect(mockNavigate).not.toHaveBeenCalled();
      cleanup();
    });

    it('sets alert modal direction buttons with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      // Open alert modal via long-press
      fireEvent.trigger(getByText('RELIANCE'), 'onLongPress');
      expect(getByText('Above')).toBeDefined();
      expect(getByText('Below')).toBeDefined();
      expect(mockNavigate).not.toHaveBeenCalled();
      cleanup();
    });

    it('navigates to StockDetail after interacting with filters', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <WatchlistScreen navigation={frozenNav as any} />,
      );
      // Interact with sort indicator first
      fireEvent.press(getByText(/Sorted by:/));
      // Then navigate to a stock
      fireEvent.press(getByText('RELIANCE'));
      expect(mockNavigate).toHaveBeenCalledWith('StockDetail', {
        stockId: mockStocks[0].id,
        symbol: mockStocks[0].symbol,
      });
      cleanup();
    });
  });
});
