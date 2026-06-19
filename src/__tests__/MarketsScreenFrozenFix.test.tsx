/**
 * ============================================================================
 * Toroloom — MarketsScreen Frozen Navigation Object Regression Tests
 * ============================================================================
 *
 * Verifies that MarketsScreen does NOT crash with the error:
 *   "You attempted to set the key 'current' with the value 'undefined' on
 *    an object that is meant to be immutable and has been frozen."
 *
 * Fix: Switched MarketsScreen's sector chips and stock list from react-native's
 * Animated.View to reanimated's Animated.View, while keeping the search
 * container, suggestion dashboard, and backdrop overlay as react-native's
 * Animated.View since they use Animated.Value.interpolate() outputs.
 *
 * These tests simulate React Navigation v7 dev-mode behaviour by passing
 * Object.freeze()-d navigation objects into MarketsScreen.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockStocks, mockIndices } from '../constants/mockData';

// ==================== Mocks ====================

const mockNavigate = vi.fn();
const mockSetSearchQuery = vi.fn();

let currentSearchQuery = '';
let currentSearchResults: any[] = [];
let currentStocks: any[] = [];

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', success: '#00C853', danger: '#FF1744',
      marketUp: '#00C853', marketDown: '#FF1744', text: '#FFFFFF',
      textSecondary: '#B0B0D0', textMuted: '#6E6E9A', white: '#FFFFFF',
      bg: '#0D0D2B', bgSecondary: '#1A1A3E', bgCard: '#222255',
      bgCardLight: '#2A2A5E', bgInput: '#1E1E4A', bgDark: '#070720',
      border: '#2A2A5E', borderLight: '#3A3A7E', divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/marketStore', () => ({
  useMarketStore: () => ({
    indices: mockIndices,
    stocks: currentStocks.length > 0 ? currentStocks : mockStocks,
    searchQuery: currentSearchQuery,
    searchResults: currentSearchResults,
    setSearchQuery: mockSetSearchQuery,
  }),
}));

// Must be imported AFTER mocks
import MarketsScreen from '../screens/tabs/MarketsScreen';

// ==================== Helpers ====================

function renderWithTimeTravel(jsx: React.ReactElement) {
  vi.useFakeTimers();
  const result = render(jsx);
  act(() => { vi.advanceTimersByTime(500); });
  return { ...result, cleanup: () => { result.unmount(); vi.useRealTimers(); } };
}

function createFrozenNavigation() {
  return Object.freeze({
    navigate: mockNavigate,
    canGoBack: true,
    goBack: vi.fn(),
    getId: () => 'Markets',
    getState: () =>
      Object.freeze({
        key: 'Markets',
        name: 'Markets',
        params: {},
        routes: [],
        index: 0,
        stale: false,
        type: 'tab',
      }),
  });
}

// Reset mutable store state between tests
function resetStoreState() {
  currentSearchQuery = '';
  currentSearchResults = [];
  currentStocks = [];
}

// ==================== Tests ====================

describe('MarketsScreen — Frozen Navigation Object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('render resilience with frozen navigation', () => {
    it('renders without crashing when navigation is a frozen object', () => {
      const frozenNav = createFrozenNavigation();
      const { toJSON, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders without crashing when navigation state is deeply frozen', () => {
      const state = Object.freeze({
        key: 'Markets',
        name: 'Markets',
        params: Object.freeze({}),
        routes: Object.freeze([]),
      });
      const frozenNav = Object.freeze({
        navigate: mockNavigate,
        getState: () => state,
        getId: () => 'Markets',
      });
      const { toJSON, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders full content with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Markets')).toBeDefined();
      expect(getByText('Real-time stock market data')).toBeDefined();
      cleanup();
    });

    it('renders market indices with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(getByText('NIFTY')).toBeDefined();
      expect(getByText('SENSEX')).toBeDefined();
      expect(getByText('BANKNIFTY')).toBeDefined();
      cleanup();
    });

    it('renders sector chips with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(getByText('All')).toBeDefined();
      expect(getByText('Technology')).toBeDefined();
      expect(getByText('Finance')).toBeDefined();
      expect(getByText('Energy')).toBeDefined();
      cleanup();
    });

    it('renders stock list with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(getByText('RELIANCE')).toBeDefined();
      expect(getByText('HDFCBANK')).toBeDefined();
      expect(getByText('TCS')).toBeDefined();
      cleanup();
    });

    it('renders Gainers / Losers section with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Top Gainers')).toBeDefined();
      expect(getByText('Top Losers')).toBeDefined();
      cleanup();
    });

    it('renders Sector Performance heatmap with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Sector Performance')).toBeDefined();
      expect(getByText('Technology')).toBeDefined();
      expect(getByText('Finance')).toBeDefined();
      cleanup();
    });
  });

  describe('frozen object mutation detection', () => {
    it('does NOT attempt to set properties on frozen navigation during mount', () => {
      const frozenNav = createFrozenNavigation();
      expect(() => {
        renderWithTimeTravel(<MarketsScreen navigation={frozenNav as any} />);
      }).not.toThrow();
    });

    it('does NOT mutate frozen navigation after re-render', () => {
      const frozenNav = createFrozenNavigation();
      const { update, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(() => {
        update(<MarketsScreen navigation={frozenNav as any} />);
      }).not.toThrow();
      cleanup();
    });

    it('handles mount with frozen navigation then unmounts gracefully', () => {
      const frozenNav = createFrozenNavigation();
      const { unmount } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(() => { unmount(); }).not.toThrow();
    });
  });

  describe('navigation still works through frozen object', () => {
    it('navigates to StockDetail when a stock is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('RELIANCE'));
      expect(mockNavigate).toHaveBeenCalledWith('StockDetail', {
        stockId: 'RELIANCE',
        symbol: 'RELIANCE',
      });
      cleanup();
    });

    it('navigates to StockScreener when screener button is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Screener'));
      expect(mockNavigate).toHaveBeenCalledWith('StockScreener');
      cleanup();
    });

    it('does not navigate without explicit interaction', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MarketsScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Markets')).toBeDefined();
      expect(mockNavigate).not.toHaveBeenCalled();
      cleanup();
    });
  });
});
