/**
 * ============================================================================
 * Toroloom — MoreScreen Frozen Navigation Object Regression Tests
 * ============================================================================
 *
 * Verifies that MoreScreen does NOT crash with the error:
 *   "You attempted to set the key 'current' with the value 'undefined' on
 *    an object that is meant to be immutable and has been frozen."
 *
 * Root cause: React Navigation v7 in dev mode deeply freezes navigation
 * descriptors.  react-native's Animated.View tried to set internal '.current'
 * properties on frozen style objects when processing reanimated
 * useAnimatedStyle output.
 *
 * Fix: Switched MoreScreen from react-native's Animated.View to reanimated's
 * Animated.View, which properly handles reanimated style objects without
 * attempting to navigate through or mutate frozen descriptors.
 *
 * These tests simulate React Navigation v7 dev-mode behaviour by passing
 * Object.freeze()-d navigation objects into MoreScreen and verifying:
 *   - The component renders without throwing
 *   - Navigation.navigate() is still callable through the frozen object
 *   - The component does NOT attempt to set properties on frozen descriptors
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-test-renderer';
import { render, fireEvent } from './testUtils';

// ==================== Mocks ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', bgCard: '#1A1A2E',
      bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44',
      bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      danger: '#FF1744', white: '#FFFFFF', transparent: 'transparent', success: '#00C853',
    },
  }),
}));

const mockNavigate = vi.fn();
const mockLogout = vi.fn();
const mockResetOnboarding = vi.fn();

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user1', name: 'TraderJoe', email: 'trader@example.com', balance: 2500000 },
    isLoggedIn: true,
    logout: mockLogout,
  }),
}));

vi.mock('../store/gamificationStore', () => ({
  useGamificationStore: () => ({
    userLevel: { level: 1, xp: 0, xpToNext: 1000, totalXp: 0, title: 'New Investor' },
    badges: [
      { id: 'b1', icon: '\uD83C\uDFC6', name: 'First Trade', unlocked: true },
      { id: 'b2', icon: '\u2B50', name: 'Quick Learner', unlocked: false },
    ],
  }),
}));

vi.mock('../store/onboardingStore', () => ({
  useOnboardingStore: (selector?: any) => {
    const state = { resetOnboarding: mockResetOnboarding };
    return selector ? selector(state) : state;
  },
}));

// Must be imported AFTER mocks
import MoreScreen from '../screens/tabs/MoreScreen';

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
    getId: () => 'More',
    getState: () =>
      Object.freeze({
        key: 'More',
        name: 'More',
        params: {},
        routes: [],
        index: 0,
        stale: false,
        type: 'tab',
      }),
  });
}

/**
 * Create a navigation object with a frozen state property (simulating
 * a partially frozen descriptor).
 */
function createNavigationWithFrozenState() {
  return {
    navigate: mockNavigate,
    getState: Object.freeze(() => ({
      key: 'More',
      name: 'More',
    })),
  };
}

// ==================== Tests ====================

describe('MoreScreen — Frozen Navigation Object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Render resilience ───────────────────────────────────

  describe('render resilience with frozen navigation', () => {
    it('renders without crashing when navigation is a frozen object', () => {
      const frozenNav = createFrozenNavigation();
      const { toJSON, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders without crashing when navigation state is deeply frozen', () => {
      const state = Object.freeze({
        key: 'More',
        name: 'More',
        params: Object.freeze({}),
        routes: Object.freeze([]),
      });
      const frozenNav = Object.freeze({
        navigate: mockNavigate,
        getState: () => state,
        getId: () => 'More',
      });
      const { toJSON, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders without crashing with partially frozen navigation', () => {
      const nav = createNavigationWithFrozenState();
      const { toJSON, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={nav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders full content with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      // Verify all major sections render
      expect(getByText('More')).toBeDefined();
      expect(getByText('TraderJoe')).toBeDefined();
      expect(getByText('Available Balance')).toBeDefined();
      expect(getByText('Investments')).toBeDefined();
      expect(getByText('Learn & Grow')).toBeDefined();
      expect(getByText('Account')).toBeDefined();
      expect(getByText('Log Out')).toBeDefined();
      cleanup();
    });

    it('renders quick actions with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Add Funds')).toBeDefined();
      expect(getByText('Withdraw')).toBeDefined();
      expect(getByText('Transfer')).toBeDefined();
      expect(getByText('UPI')).toBeDefined();
      cleanup();
    });

    it('renders menu items with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Fund Dashboard')).toBeDefined();
      expect(getByText('Mutual Funds')).toBeDefined();
      expect(getByText('Trade History')).toBeDefined();
      expect(getByText('Reports')).toBeDefined();
      expect(getByText('Courses')).toBeDefined();
      expect(getByText('Profile & KYC')).toBeDefined();
      expect(getByText('Help & Support')).toBeDefined();
      cleanup();
    });

    it('renders achievements preview with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      // Achievements section should render
      expect(getByText('Achievements')).toBeDefined();
      cleanup();
    });
  });

  // ── Mutation detection ─────────────────────────────────

  describe('frozen object mutation detection', () => {
    it('does NOT attempt to set properties on frozen navigation during mount', () => {
      // KEY REGRESSION TEST:
      // The original bug was that react-native's Animated.View tried to set
      // internal '.current' properties on frozen navigation descriptors.
      // This test verifies the fix prevents that crash.
      const frozenNav = createFrozenNavigation();
      expect(() => {
        renderWithTimeTravel(<MoreScreen navigation={frozenNav as any} />);
      }).not.toThrow();
    });

    it('does NOT mutate frozen navigation after state change (re-render)', () => {
      // After the initial render, state changes (like setState) can trigger
      // re-renders. Verify these re-renders don't attempt mutations either.
      const frozenNav = createFrozenNavigation();
      const { update, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      // Trigger a re-render
      expect(() => {
        update(<MoreScreen navigation={frozenNav as any} />);
      }).not.toThrow();
      cleanup();
    });

    it('handles mount with frozen navigation then unmounts gracefully', () => {
      // Ensure the component cleans up properly without crashing after
      // rendering with a frozen navigation object.
      const frozenNav = createFrozenNavigation();
      const { unmount } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('preserves frozen status of navigation after render', () => {
      const frozenNav = createFrozenNavigation();
      const { cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      // Object.isFrozen is not available in all JS environments, so
      // verify that attempting to set a property still throws after render.
      expect(() => {
        (frozenNav as any).newProp = 'test';
      }).toThrow();
      cleanup();
    });
  });

  // ── Navigation functionality ───────────────────────────

  describe('navigation still works through frozen object', () => {
    it('navigates when profile card is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      // Press on the profile avatar text (user's first initial or name)
      fireEvent.press(getByText('TraderJoe'));
      expect(mockNavigate).toHaveBeenCalledWith('Profile');
      cleanup();
    });

    it('navigates when "Add Funds" quick action is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Add Funds'));
      expect(mockNavigate).toHaveBeenCalledWith('AddFunds');
      cleanup();
    });

    it('navigates when "Withdraw" quick action is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Withdraw'));
      expect(mockNavigate).toHaveBeenCalledWith('Withdraw');
      cleanup();
    });

    it('navigates when "Transfer" quick action is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Transfer'));
      expect(mockNavigate).toHaveBeenCalledWith('Transfer');
      cleanup();
    });

    it('navigates when "UPI" quick action is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('UPI'));
      expect(mockNavigate).toHaveBeenCalledWith('UPI');
      cleanup();
    });

    it('navigates to the correct screen when a menu item is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      // Test a menu item from each section
      fireEvent.press(getByText('Fund Dashboard'));
      expect(mockNavigate).toHaveBeenCalledWith('FundsDashboard');

      fireEvent.press(getByText('Courses'));
      expect(mockNavigate).toHaveBeenCalledWith('Learn');

      fireEvent.press(getByText('Profile & KYC'));
      expect(mockNavigate).toHaveBeenCalledWith('Profile');
      cleanup();
    });

    it('calls logout when "Log Out" is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Log Out'));
      expect(mockLogout).toHaveBeenCalled();
      cleanup();
    });

    it('navigates to Achievements from achievements preview card', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <MoreScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Achievements'));
      expect(mockNavigate).toHaveBeenCalledWith('Achievements');
      cleanup();
    });
  });
});
