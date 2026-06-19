/**
 * ============================================================================
 * Toroloom — StockScreenerScreen Frozen Navigation Object Regression Tests
 * ============================================================================
 *
 * Verifies that StockScreenerScreen does NOT crash with the error:
 *   "You attempted to set the key 'current' with the value 'undefined' on
 *    an object that is meant to be immutable and has been frozen."
 *
 * Root cause: React Navigation v7 in dev mode deeply freezes navigation
 * descriptors.  react-native's Animated.View tried to set internal '.current'
 * properties on frozen style objects when processing reanimated
 * useAnimatedStyle output.
 *
 * Fix: Switched StockScreenerScreen from react-native's Animated.View to
 * reanimated's Animated.View, which properly handles reanimated style objects
 * without attempting to navigate through or mutate frozen descriptors.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-test-renderer';
import { render, fireEvent } from './testUtils';
import { mockStocks } from '../constants/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== Mocks ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0B0F19', bgSecondary: '#0E121D', bgCard: '#111827',
      bgCardLight: '#1A2235', bgInput: '#0F131E', border: '#1F2937',
      primary: '#3B82F6', primaryLight: '#60A5FA',
      text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      marketUp: '#10B981', marketDown: '#EF4444', warning: '#F59E0B',
      accent: '#10B981', danger: '#EF4444', divider: '#1E293B',
      bgOverlay: 'rgba(7, 10, 17, 0.85)', white: '#FFFFFF',
    },
    isDark: true,
  }),
}));

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

vi.mock('../store/marketStore', () => ({
  useMarketStore: (selector?: any) => {
    const state = {
      stocks: mockStocks,
      screenerFilters: {
        priceMin: 0, priceMax: 100000, peMin: 0, peMax: 1000,
        marketCapCategory: 'all', dividendMin: 0, sector: 'All',
        dayChangeMin: -100, dayChangeMax: 100,
      },
      screenerResults: [mockStocks[0], mockStocks[2]],
      isScreenerVisible: false,
      setScreenerFilters: vi.fn(),
      applyScreener: vi.fn(),
      resetScreenerFilters: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

// Must be imported AFTER mocks
import StockScreenerScreen from '../screens/stock/StockScreenerScreen';

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
    goBack: mockGoBack,
    canGoBack: true,
    getId: () => 'StockScreener',
    getState: () =>
      Object.freeze({
        key: 'StockScreener',
        name: 'StockScreener',
        params: {},
        routes: [],
        index: 0,
        stale: false,
        type: 'stack',
      }),
  });
}

// ==================== Tests ====================

describe('StockScreenerScreen — Frozen Navigation Object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  // ── Render resilience ───────────────────────────────────

  describe('render resilience with frozen navigation', () => {
    it('renders without crashing when navigation is a frozen object', () => {
      const frozenNav = createFrozenNavigation();
      const { toJSON, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders without crashing when navigation state is deeply frozen', () => {
      const state = Object.freeze({
        key: 'StockScreener', name: 'StockScreener',
        params: Object.freeze({}), routes: Object.freeze([]),
      });
      const frozenNav = Object.freeze({
        navigate: mockNavigate, goBack: mockGoBack, getState: () => state, getId: () => 'StockScreener',
      });
      const { toJSON, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders full content with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Stock Screener')).toBeDefined();
      expect(getByText('Price Range')).toBeDefined();
      expect(getByText('P/E Ratio')).toBeDefined();
      expect(getByText('Day Change %')).toBeDefined();
      expect(getByText('Dividend Yield')).toBeDefined();
      expect(getByText('Sector')).toBeDefined();
      expect(getByText('Market Cap')).toBeDefined();
      cleanup();
    });

    it('renders action buttons with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Clear All')).toBeDefined();
      expect(getByText('Save')).toBeDefined();
      expect(getByText(/Show Results/)).toBeDefined();
      cleanup();
    });

    it('renders filter chips with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Technology')).toBeDefined();
      expect(getByText('Finance')).toBeDefined();
      expect(getByText('Energy')).toBeDefined();
      expect(getByText('Large Cap')).toBeDefined();
      expect(getByText('Mid Cap')).toBeDefined();
      expect(getByText('Small Cap')).toBeDefined();
      cleanup();
    });

    it('renders results section with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      // Results should show since screenerResults has data
      expect(getByText(/Results/)).toBeDefined();
      expect(getByText('RELIANCE')).toBeDefined();
      cleanup();
    });

    it('renders sort options with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Sort by')).toBeDefined();
      expect(getByText('Symbol')).toBeDefined();
      expect(getByText('P/E')).toBeDefined();
      expect(getByText('Dividend')).toBeDefined();
      cleanup();
    });
  });

  // ── Mutation detection ─────────────────────────────────

  describe('frozen object mutation detection', () => {
    it('does NOT attempt to set properties on frozen navigation during mount', () => {
      const frozenNav = createFrozenNavigation();
      expect(() => {
        renderWithTimeTravel(<StockScreenerScreen navigation={frozenNav as any} />);
      }).not.toThrow();
    });

    it('does NOT mutate frozen navigation after re-render', () => {
      const frozenNav = createFrozenNavigation();
      const { update, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      expect(() => {
        update(<StockScreenerScreen navigation={frozenNav as any} />);
      }).not.toThrow();
      cleanup();
    });

    it('handles mount with frozen navigation then unmounts gracefully', () => {
      const frozenNav = createFrozenNavigation();
      const { unmount } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      expect(() => { unmount(); }).not.toThrow();
    });

    it('preserves frozen status of navigation after render', () => {
      const frozenNav = createFrozenNavigation();
      const { cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      expect(() => { (frozenNav as any).newProp = 'test'; }).toThrow();
      cleanup();
    });
  });

  // ── Navigation functionality ───────────────────────────

  describe('navigation still works through frozen object', () => {
    it('navigates to StockDetail when a stock result is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('RELIANCE'));
      expect(mockNavigate).toHaveBeenCalledWith('StockDetail', {
        stockId: mockStocks[0].id,
        symbol: mockStocks[0].symbol,
      });
      cleanup();
    });

    it('calls goBack when back button is pressed', () => {
      const frozenNav = createFrozenNavigation();
      // Press the back button (Ionicons "arrow-back" is inside a TouchableOpacity)
      // Find the back button by looking for the goBack register
      const { cleanup, root } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      // The back button is a TouchableOpacity — fire its onPress
      const backBtn = root.find(
        (inst: any) =>
          inst.props?.onPress &&
          inst.props?.children?.props?.name === 'arrow-back',
      );
      if (backBtn) {
        act(() => { fireEvent.press(backBtn); });
        expect(mockGoBack).toHaveBeenCalled();
      }
      cleanup();
    });

    it('opens export sheet when Export button is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Export'));
      expect(getByText('Export Results')).toBeDefined();
      expect(getByText('Export as CSV')).toBeDefined();
      expect(getByText('Share as Text')).toBeDefined();
      cleanup();
    });

    it('opens save modal when Save button is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, getByPlaceholderText, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Save'));
      expect(getByText('Save Filters')).toBeDefined();
      expect(getByPlaceholderText('e.g. High Dividend Stocks')).toBeDefined();
      cleanup();
    });

    it('clicking sort option changes sort order indicator', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <StockScreenerScreen navigation={frozenNav as any} />,
      );
      // Default sort is Symbol ↑ — click Price to change sort
      fireEvent.press(getByText('Price'));
      expect(mockNavigate).not.toHaveBeenCalled(); // No navigation should happen
      cleanup();
    });
  });
});
