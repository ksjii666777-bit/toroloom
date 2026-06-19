/**
 * ============================================================================
 * Toroloom — HomeScreen Frozen Navigation Object Regression Tests
 * ============================================================================
 *
 * Verifies that HomeScreen does NOT crash with the error:
 *   "You attempted to set the key 'current' with the value 'undefined' on
 *    an object that is meant to be immutable and has been frozen."
 *
 * Root cause: React Navigation v7 in dev mode deeply freezes navigation
 * descriptors.  react-native's Animated.View tried to set internal '.current'
 * properties on frozen style objects when processing reanimated
 * useAnimatedStyle output.
 *
 * Fix: HomeScreen uses a dual-import pattern:
 *   - ReanimatedAnimated from 'react-native-reanimated' for all sections
 *     using useStaggeredAnimation styles (market breadth, indices, AI insight,
 *     level/XP, holdings, gainers, losers, trades, watchlist)
 *   - Animated from 'react-native' for the portfolio glow animation
 *     (Animated.Value, Animated.timing, Animated.loop, .interpolate())
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-test-renderer';
import { render, fireEvent } from './testUtils';
import {
  mockUser,
  mockIndices,
  mockStocks,
  mockUserLevel,
  mockBadges,
  mockNotifications,
  mockTrades,
  mockAIInsights,
} from '../constants/mockData';

// ==================== Mocks ====================

const mockNavigate = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', primaryLight: '#8B83FF', primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      success: '#00C853', danger: '#FF1744', warning: '#FFC107',
      marketUp: '#00C853', marketDown: '#FF1744',
      text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
      white: '#FFFFFF', bg: '#0D0D2B', bgSecondary: '#1A1A3E',
      bgCard: '#222255', bgCardLight: '#2A2A5E', bgInput: '#1E1E4A',
      bgDark: '#070720', bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E', borderLight: '#3A3A7E', divider: '#1E1E4A',
      transparent: 'transparent', secondary: '#FF6B6B', accent: '#10B981',
    },
    isDark: true,
  }),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

vi.mock('../store/marketStore', () => ({
  useMarketStore: () => ({
    indices: mockIndices,
    stocks: mockStocks,
  }),
}));

// Track mutable holdings/trades
let currentHoldings: any[] = [];
let currentTrades: any[] = [];

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: () => ({
    holdings: currentHoldings,
    trades: currentTrades,
  }),
}));

vi.mock('../store/gamificationStore', () => ({
  useGamificationStore: () => ({
    userLevel: mockUserLevel,
    badges: mockBadges,
  }),
}));

vi.mock('../store/notificationStore', () => ({
  useNotificationStore: () => ({
    notifications: mockNotifications,
  }),
}));

vi.mock('../store/aiStore', () => ({
  useAIStore: () => ({
    insights: mockAIInsights,
  }),
}));

// Must be imported AFTER mocks
import HomeScreen from '../screens/tabs/HomeScreen';

// ==================== Helpers ====================

function renderWithTimeTravel(jsx: React.ReactElement) {
  vi.useFakeTimers();
  const result = render(jsx);
  // Advance past the 600ms loading timeout + staggered animation delays
  act(() => { vi.advanceTimersByTime(1500); });
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
    getId: () => 'Home',
    getState: () =>
      Object.freeze({
        key: 'Home',
        name: 'Home',
        params: {},
        routes: [],
        index: 0,
        stale: false,
        type: 'tab',
      }),
  });
}

// ==================== Tests ====================

describe('HomeScreen — Frozen Navigation Object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default holdings/trades for most tests
    currentTrades = mockTrades;
    currentHoldings = [];
  });

  // ── Render resilience ───────────────────────────────────

  describe('render resilience with frozen navigation', () => {
    it('renders without crashing when navigation is a frozen object', () => {
      const frozenNav = createFrozenNavigation();
      const { toJSON, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders without crashing when navigation state is deeply frozen', () => {
      const state = Object.freeze({
        key: 'Home', name: 'Home',
        params: Object.freeze({}), routes: Object.freeze([]),
      });
      const frozenNav = Object.freeze({
        navigate: mockNavigate, getState: () => state, getId: () => 'Home',
      });
      const { toJSON, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders full content with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      // Header elements
      expect(getByText(/Good (Morning|Afternoon|Evening),/)).toBeDefined();
      expect(getByText(/Rahul/)).toBeDefined();
      // Portfolio card
      expect(getByText('Portfolio Value')).toBeDefined();
      // Quick actions
      expect(getByText('Buy')).toBeDefined();
      expect(getByText('Sell')).toBeDefined();
      expect(getByText('SIP')).toBeDefined();
      expect(getByText('Learn')).toBeDefined();
      cleanup();
    });

    it('renders market indices section with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Market Indices')).toBeDefined();
      expect(getByText('See All')).toBeDefined();
      expect(getByText('NIFTY')).toBeDefined();
      expect(getByText('SENSEX')).toBeDefined();
      expect(getByText('BANKNIFTY')).toBeDefined();
      cleanup();
    });

    it('renders level & XP section with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      expect(getByText(/Lvl 12/)).toBeDefined();
      expect(getByText('Trading Pro')).toBeDefined();
      expect(getByText('4500 / 5000 XP')).toBeDefined();
      cleanup();
    });

    it('renders Top Gainers and Top Losers with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      expect(getByText(/Top Gainers/)).toBeDefined();
      expect(getByText(/Top Losers/)).toBeDefined();
      expect(getByText('View All')).toBeDefined();
      expect(getByText('BHARTIARTL')).toBeDefined();
      cleanup();
    });

    it('renders recent trades and watchlist with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      expect(getByText(/Recent Activity/)).toBeDefined();
      expect(getByText(/My Watchlist/)).toBeDefined();
      expect(getByText('Manage')).toBeDefined();
      cleanup();
    });

    it('renders notification badge and avatar with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      // Notification badge (2 unread)
      expect(getByText(/^2$/)).toBeDefined();
      // Avatar initial
      expect(getByText(/^R$/)).toBeDefined();
      cleanup();
    });
  });

  // ── Mutation detection ─────────────────────────────────

  describe('frozen object mutation detection', () => {
    it('does NOT attempt to set properties on frozen navigation during mount', () => {
      const frozenNav = createFrozenNavigation();
      expect(() => {
        renderWithTimeTravel(<HomeScreen navigation={frozenNav as any} />);
      }).not.toThrow();
    });

    it('does NOT mutate frozen navigation after re-render', () => {
      const frozenNav = createFrozenNavigation();
      const { update, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      expect(() => {
        update(<HomeScreen navigation={frozenNav as any} />);
      }).not.toThrow();
      cleanup();
    });

    it('handles mount with frozen navigation then unmounts gracefully', () => {
      const frozenNav = createFrozenNavigation();
      const { unmount } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      expect(() => { unmount(); }).not.toThrow();
    });

    it('preserves frozen status of navigation after render', () => {
      const frozenNav = createFrozenNavigation();
      const { cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      expect(() => { (frozenNav as any).newProp = 'test'; }).toThrow();
      cleanup();
    });
  });

  // ── Navigation functionality ───────────────────────────

  describe('navigation still works through frozen object', () => {
    it('navigates to Markets when See All is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('See All'));
      expect(mockNavigate).toHaveBeenCalledWith('Markets');
      cleanup();
    });

    it('navigates to Watchlist when Manage is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Manage'));
      expect(mockNavigate).toHaveBeenCalledWith('Watchlist');
      cleanup();
    });

    it('navigates to Notifications when notification badge is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText(/^2$/));
      expect(mockNavigate).toHaveBeenCalledWith('Notifications');
      cleanup();
    });

    it('navigates to Profile when avatar is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText(/^R$/));
      expect(mockNavigate).toHaveBeenCalledWith('Profile');
      cleanup();
    });

    it('navigates via quick actions with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Buy'));
      expect(mockNavigate).toHaveBeenCalledWith('Markets');

      fireEvent.press(getByText('Sell'));
      expect(mockNavigate).toHaveBeenCalledWith('Portfolio');

      fireEvent.press(getByText('SIP'));
      expect(mockNavigate).toHaveBeenCalledWith('MutualFunds');

      fireEvent.press(getByText('Learn'));
      expect(mockNavigate).toHaveBeenCalledWith('Learn');
      cleanup();
    });

    it('navigates via portfolio action buttons with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Add Funds'));
      expect(mockNavigate).toHaveBeenCalledWith('AddFunds');

      fireEvent.press(getByText('Transfer'));
      expect(mockNavigate).toHaveBeenCalledWith('Transfer');

      fireEvent.press(getByText('Balance'));
      expect(mockNavigate).toHaveBeenCalledWith('FundsDashboard');
      cleanup();
    });

    it('navigates to StockDetail when a top gainer stock is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('BHARTIARTL'));
      expect(mockNavigate).toHaveBeenCalledWith('StockDetail', {
        stockId: 'BHARTIARTL',
        symbol: 'BHARTIARTL',
      });
      cleanup();
    });

    it('does not navigate on initial render', () => {
      const frozenNav = createFrozenNavigation();
      const { cleanup } = renderWithTimeTravel(
        <HomeScreen navigation={frozenNav as any} />,
      );
      expect(mockNavigate).not.toHaveBeenCalled();
      cleanup();
    });
  });
});
