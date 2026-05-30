/**
 * ============================================================================
 * Toroloom — AppNavigator Tests
 * ============================================================================
 *
 * Tests the root navigation component including auth-gated rendering,
 * tab bar structure, lockdown badge display, and stack registration.
 *
 * We mock all screen components because they each pull in many
 * dependencies and the navigator only needs to verify that the
 * correct screen components are registered — not that they render.
 *
 * Uses react-test-renderer instead of @testing-library/react-native to
 * avoid a transform error with certain native module re-exports.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';

/* ------------------------------------------------------------------ */
/*  Mock all screen modules so imports resolve without side-effects    */
/* ------------------------------------------------------------------ */

function NullComponent() {
  return null;
}

vi.mock('../screens/auth/LoginScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/auth/SignupScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/tabs/HomeScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/tabs/MarketsScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/tabs/PortfolioScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/tabs/WatchlistScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/tabs/MoreScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/tabs/LearnScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/stock/StockDetailScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/community/CommunityScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/ai/AIInsightsScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/NotificationsScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/profile/ProfileScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/mutual-funds/MutualFundsScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/settings/RiskSettingsScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/education/CourseDetailScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/education/LessonViewScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/trade/TradeHistoryScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/reports/ReportsScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/support/HelpScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/achievements/AchievementsScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/settings/NotificationPreferencesScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/funds/AddFundsScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/funds/WithdrawScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/funds/TransactionHistoryScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/funds/TransferScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/funds/UPIScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/funds/FundsDashboardScreen', () => ({
  default: NullComponent,
}));

/* ------------------------------------------------------------------ */
/*  Mock navigation libraries                                          */
/* ------------------------------------------------------------------ */

vi.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }),
}));

vi.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Screen: (props: any) => (
      <>
        {props.name}
        {props.component ? React.createElement(props.component) : null}
      </>
    ),
  }),
}));

vi.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Screen: (props: any) => <>{props.name}</>,
  }),
}));

/* ------------------------------------------------------------------ */
/*  Mock stores and theme                                              */
/* ------------------------------------------------------------------ */

const mockAuthStore = vi.hoisted(() => ({
  useAuthStore: vi.fn(),
}));

const mockRiskStore = vi.hoisted(() => ({
  useRiskStore: vi.fn(),
}));

const mockTheme = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

vi.mock('../store/authStore', () => mockAuthStore);
vi.mock('../store/riskStore', () => mockRiskStore);
vi.mock('../context/ThemeContext', () => mockTheme);

/* ------------------------------------------------------------------ */
/*  Mock expo vector icons (used by TabIcon)                           */
/* ------------------------------------------------------------------ */

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, size, color }: any) => <>{`${name}:${size}:${color}`}</>,
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

import AppNavigator from '../navigation/AppNavigator';

/** Helper: render AppNavigator and return a string-renderering for assertions */
function renderToString() {
  let root: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    root = TestRenderer.create(<AppNavigator />);
  });
  return root!.toJSON();
}

describe('AppNavigator — Auth Gating', () => {
  beforeEach(() => {
    mockTheme.useTheme.mockReturnValue({
      colors: {
        primary: '#6C63FF',
        textMuted: '#9CA3AF',
        bgSecondary: '#1A1A2E',
        border: '#2D2D44',
        bg: '#0F0F23',
      },
    });
    mockRiskStore.useRiskStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { wsLockdownCount: 0, clearLockdownAlert: vi.fn() };
      return sel ? sel(state) : state;
    });
  });

  it('renders Auth screens when user is not logged in', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: false };
      return sel ? sel(state) : state;
    });

    const json = renderToString();
    const str = JSON.stringify(json);

    expect(str).toContain('Login');
    expect(str).toContain('Signup');
    expect(str).not.toContain('MainTabs');
  });

  it('renders MainTabs when user is logged in', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: true };
      return sel ? sel(state) : state;
    });

    const json = renderToString();
    const str = JSON.stringify(json);

    expect(str).not.toContain('Login');
    expect(str).not.toContain('Signup');
    expect(str).toContain('MainTabs');
  });

  it('registers all five tab screens', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: true };
      return sel ? sel(state) : state;
    });

    const json = renderToString();
    const str = JSON.stringify(json);

    expect(str).toContain('More');
    expect(str).toContain('Home');
    expect(str).toContain('Markets');
    expect(str).toContain('Portfolio');
    expect(str).toContain('Watchlist');
  });

  it('registers all detail screens in the stack', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: true };
      return sel ? sel(state) : state;
    });

    const json = renderToString();
    const str = JSON.stringify(json);

    expect(str).toContain('StockDetail');
    expect(str).toContain('Learn');
    expect(str).toContain('Community');
    expect(str).toContain('Notifications');
    expect(str).toContain('Profile');
    expect(str).toContain('MutualFunds');
    expect(str).toContain('SIPs');
    expect(str).toContain('Settings');
    expect(str).toContain('Help');
    expect(str).toContain('AddFunds');
    expect(str).toContain('TransactionHistory');
  });
});

describe('AppNavigator — Risk / Lockdown Badge', () => {
  beforeEach(() => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: true };
      return sel ? sel(state) : state;
    });
    mockTheme.useTheme.mockReturnValue({
      colors: {
        primary: '#6C63FF',
        textMuted: '#9CA3AF',
        bgSecondary: '#1A1A2E',
        border: '#2D2D44',
        bg: '#0F0F23',
      },
    });
  });

  it('renders without crash when wsLockdownCount > 0', () => {
    mockRiskStore.useRiskStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { wsLockdownCount: 3, clearLockdownAlert: vi.fn() };
      return sel ? sel(state) : state;
    });

    const json = renderToString();
    const str = JSON.stringify(json);
    expect(str).toContain('MainTabs');
  });

  it('renders without crash when wsLockdownCount is 0', () => {
    mockRiskStore.useRiskStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { wsLockdownCount: 0, clearLockdownAlert: vi.fn() };
      return sel ? sel(state) : state;
    });

    const json = renderToString();
    const str = JSON.stringify(json);
    expect(str).toContain('MainTabs');
  });

  it('does not call clearLockdownAlert on mount', () => {
    const clearLockdownAlert = vi.fn();
    mockRiskStore.useRiskStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { wsLockdownCount: 3, clearLockdownAlert };
      return sel ? sel(state) : state;
    });

    TestRenderer.act(() => {
      TestRenderer.create(<AppNavigator />);
    });
    expect(clearLockdownAlert).not.toHaveBeenCalled();
  });
});

describe('AppNavigator — Theme Integration', () => {
  it('accepts custom theme colors without crashing', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: true };
      return sel ? sel(state) : state;
    });
    mockRiskStore.useRiskStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { wsLockdownCount: 0, clearLockdownAlert: vi.fn() };
      return sel ? sel(state) : state;
    });
    mockTheme.useTheme.mockReturnValue({
      colors: {
        primary: '#FF0000',
        textMuted: '#999999',
        bgSecondary: '#222222',
        border: '#444444',
        bg: '#111111',
      },
    });

    TestRenderer.act(() => {
      TestRenderer.create(<AppNavigator />);
    });
    expect(mockTheme.useTheme).toHaveBeenCalled();
  });
});
