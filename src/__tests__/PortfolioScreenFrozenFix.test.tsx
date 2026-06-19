/**
 * ============================================================================
 * Toroloom — PortfolioScreen Frozen Navigation Object Regression Tests
 * ============================================================================
 *
 * Verifies that PortfolioScreen does NOT crash with the error:
 *   "You attempted to set the key 'current' with the value 'undefined' on
 *    an object that is meant to be immutable and has been frozen."
 *
 * Fix: Switched PortfolioScreen from react-native's Animated.View to
 * reanimated's Animated.View for holdingsStyles[i] and tradesStyles[i].
 *
 * These tests simulate React Navigation v7 dev-mode behaviour by passing
 * Object.freeze()-d navigation objects into PortfolioScreen.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockHoldings, mockTrades } from '../constants/mockData';

// ==================== Mocks ====================

const mockNavigate = vi.fn();

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

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: () => ({
    holdings: mockHoldings,
    trades: mockTrades,
  }),
}));

vi.mock('../store/portfolioAnalyticsStore', () => ({
  usePortfolioAnalyticsStore: (selector?: any) => {
    const state = {
      getAnalytics: () => ({
        metrics: {
          sharpeRatio: 1.5,
          winRate: 65,
          totalReturns: 150000,
          maxDrawdown: 12.5,
          tradesCount: 42,
          volatility: 18.3,
          averageHoldingDays: 45,
          bestTrade: 15000,
          worstTrade: -5000,
          lastUpdated: new Date().toISOString(),
        },
        pnlHistory: [],
      }),
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../store/marketStore', () => ({
  useMarketStore: () => ({
    stocks: mockHoldings.map(h => ({
      id: h.stockId,
      symbol: h.symbol,
      name: h.name,
      price: h.currentValue / h.quantity,
      changePercent: h.pnlPercent,
      sector: 'Technology',
      dividend: 1.5,
    })),
    indices: [],
    searchQuery: '',
    searchResults: [],
    setSearchQuery: vi.fn(),
  }),
}));

// Must be imported AFTER mocks
import PortfolioScreen from '../screens/tabs/PortfolioScreen';

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
    getId: () => 'Portfolio',
    getState: () =>
      Object.freeze({
        key: 'Portfolio',
        name: 'Portfolio',
        params: {},
        routes: [],
        index: 0,
        stale: false,
        type: 'tab',
      }),
  });
}

// ==================== Tests ====================

describe('PortfolioScreen — Frozen Navigation Object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('render resilience with frozen navigation', () => {
    it('renders without crashing when navigation is a frozen object', () => {
      const frozenNav = createFrozenNavigation();
      const { toJSON, cleanup } = renderWithTimeTravel(
        <PortfolioScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders without crashing when navigation state is deeply frozen', () => {
      const state = Object.freeze({
        key: 'Portfolio',
        name: 'Portfolio',
        params: Object.freeze({}),
        routes: Object.freeze([]),
      });
      const frozenNav = Object.freeze({
        navigate: mockNavigate,
        getState: () => state,
        getId: () => 'Portfolio',
      });
      const { toJSON, cleanup } = renderWithTimeTravel(
        <PortfolioScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders full content with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <PortfolioScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Portfolio')).toBeDefined();
      expect(getByText('Track your investments')).toBeDefined();
      expect(getByText(/Holdings/)).toBeDefined();
      expect(getByText('Recent Trades')).toBeDefined();
      cleanup();
    });

    it('renders holdings with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <PortfolioScreen navigation={frozenNav as any} />,
      );
      expect(getByText('RELIANCE')).toBeDefined();
      expect(getByText('HDFCBANK')).toBeDefined();
      expect(getByText('TCS')).toBeDefined();
      cleanup();
    });

    it('renders summary stats with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <PortfolioScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Holdings')).toBeDefined();
      expect(getByText('Trades')).toBeDefined();
      expect(getByText('Winning')).toBeDefined();
      cleanup();
    });
  });

  describe('frozen object mutation detection', () => {
    it('does NOT attempt to set properties on frozen navigation during mount', () => {
      const frozenNav = createFrozenNavigation();
      expect(() => {
        renderWithTimeTravel(<PortfolioScreen navigation={frozenNav as any} />);
      }).not.toThrow();
    });

    it('does NOT mutate frozen navigation after re-render', () => {
      const frozenNav = createFrozenNavigation();
      const { update, cleanup } = renderWithTimeTravel(
        <PortfolioScreen navigation={frozenNav as any} />,
      );
      expect(() => {
        update(<PortfolioScreen navigation={frozenNav as any} />);
      }).not.toThrow();
      cleanup();
    });

    it('handles mount with frozen navigation then unmounts gracefully', () => {
      const frozenNav = createFrozenNavigation();
      const { unmount } = renderWithTimeTravel(
        <PortfolioScreen navigation={frozenNav as any} />,
      );
      expect(() => { unmount(); }).not.toThrow();
    });
  });

  describe('navigation still works through frozen object', () => {
    it('toggle between holdings and trades views with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <PortfolioScreen navigation={frozenNav as any} />,
      );
      // Holdings toggle should be present
      expect(getByText(/Holdings/)).toBeDefined();
      expect(getByText('Recent Trades')).toBeDefined();
      // Navigate should not have been called (no press interaction yet)
      expect(mockNavigate).not.toHaveBeenCalled();
      cleanup();
    });

    it('navigates to Reports when analytics CTA is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <PortfolioScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Advanced Analytics'));
      expect(mockNavigate).toHaveBeenCalledWith('Reports');
      cleanup();
    });

    it('does not navigate without explicit interaction', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <PortfolioScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Portfolio')).toBeDefined();
      expect(mockNavigate).not.toHaveBeenCalled();
      cleanup();
    });
  });
});
