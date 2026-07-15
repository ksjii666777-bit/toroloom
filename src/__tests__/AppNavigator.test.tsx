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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { Alert, Linking } from 'react-native';

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
vi.mock('../screens/onboarding/OnboardingScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/trade/PlaceOrderScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/chat/ChatRoomListScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/chat/ChatRoomScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/news/NewsFeedScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/journal/BehavioralJournalScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/settings/SubscriptionScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/broker/ConnectBrokerView', () => ({
  default: NullComponent,
}));
vi.mock('../screens/settings/TenantConfigScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/settings/VoiceSettingsScreen', () => ({
  default: NullComponent,
}));
vi.mock('../screens/stock/StockScreenerScreen', () => ({
  default: NullComponent,
}));

// ==================== Mock remaining AppNavigator screens ====================
vi.mock('../screens/community/PostDetailScreen', () => ({ default: NullComponent }));
vi.mock('../screens/ai/AIChatScreen', () => ({ default: NullComponent }));
vi.mock('../screens/education/GlossaryScreen', () => ({ default: NullComponent }));
vi.mock('../screens/education/CertificateScreen', () => ({ default: NullComponent }));
vi.mock('../screens/settings/PortfolioAlertsScreen', () => ({ default: NullComponent }));
vi.mock('../screens/payments/PaymentHistoryScreen', () => ({ default: NullComponent }));
vi.mock('../screens/settings/SecuritySettingsScreen', () => ({ default: NullComponent }));
vi.mock('../screens/settings/TwoFactorSetupScreen', () => ({ default: NullComponent }));
vi.mock('../screens/trade/FnOOptionsChainScreen', () => ({ default: NullComponent }));
vi.mock('../screens/trade/StrategyBuilderScreen', () => ({ default: NullComponent }));
vi.mock('../screens/calculators/SIPCalculator', () => ({ default: NullComponent }));
vi.mock('../screens/calculators/LumpsumCalculator', () => ({ default: NullComponent }));
vi.mock('../screens/calculators/EMICalculator', () => ({ default: NullComponent }));
vi.mock('../screens/calculators/TaxCalculator', () => ({ default: NullComponent }));
vi.mock('../screens/kyc/PanVerificationScreen', () => ({ default: NullComponent }));
vi.mock('../screens/kyc/AadhaarVerificationScreen', () => ({ default: NullComponent }));
vi.mock('../screens/kyc/DigiLockerScreen', () => ({ default: NullComponent }));
vi.mock('../screens/kyc/BankLinkingScreen', () => ({ default: NullComponent }));

// ==================== Mock MainTabs sub-components ====================
// MainTabs renders these directly; they pull in stores that can cause
// infinite re-render loops if not properly mocked.
vi.mock('../components/AvatarWidget', () => ({ default: NullComponent }));
vi.mock('../components/IronLockOverlay', () => ({ default: NullComponent }));
vi.mock('../components/UpgradePromptModal', () => ({ default: NullComponent }));
vi.mock('../components/ui/OfflineBanner', () => ({ default: NullComponent }));
vi.mock('../components/ui/SyncStatusIndicator', () => ({ default: NullComponent }));
vi.mock('../components/ui/SyncConflictModal', () => ({ default: NullComponent }));

/* ------------------------------------------------------------------ */
/*  Mock navigation libraries                                          */
/* ------------------------------------------------------------------ */

vi.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }),
  useFocusEffect: (cb: any) => cb(),
}));

vi.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Screen: (props: any) => (
      <>
        {props.name}
        {props.component
          ? React.createElement(props.component, {
              // Pass default route / navigation so unmocked screens don't crash
              // (e.g. route.params access would throw with undefined route)
              route: { params: {} },
              navigation: { navigate: vi.fn(), goBack: vi.fn() },
            })
          : null}
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
  selectDailyPnL: (state: any) => (state.today?.realizedPnL ?? 0) + (state.today?.unrealizedPnL ?? 0),
  selectIsLockdownActive: (state: any) => state.lockdown?.status === 'active',
}));

const mockOnboardingStore = vi.hoisted(() => {
  const useOnboardingStore = vi.fn();
  // Zustand hooks also have a static getState() method
  // Share the same vi.fn reference between the property and the named export
  // so tests can set it up via mockOnboardingStore.getState.mockReturnValue(...)
  const getState = vi.fn();
  (useOnboardingStore as any).getState = getState;
  return { useOnboardingStore, getState };
});

const mockTheme = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));



vi.mock('../store/authStore', () => mockAuthStore);
vi.mock('../store/riskStore', () => mockRiskStore);
vi.mock('../store/onboardingStore', () => mockOnboardingStore);
vi.mock('../context/ThemeContext', () => mockTheme);

/* ------------------------------------------------------------------ */
/*  Mock libraries used by unmocked screens                            */
/* ------------------------------------------------------------------ */

// Some screens (e.g. ContractNoteUploadScreen) import react-native-qrcode-svg
// which vitest can't parse. Mock it to prevent module parse errors.
vi.mock('react-native-qrcode-svg', () => ({
  default: 'QRCode',
}));

/* ------------------------------------------------------------------ */
/*  Mock hooks and services used by AppNavigator                       */
/* ------------------------------------------------------------------ */

vi.mock('../hooks/useBackgroundSync', () => ({
  useBackgroundSync: () => {},
}));

vi.mock('../hooks/useCacheInvalidation', () => ({
  useCacheInvalidation: () => {},
}));

vi.mock('../services/cacheWarmingService', () => ({
  startCacheWarming: () => {},
  registerCacheWarming: () => {},
  unregisterCacheWarming: () => {},
  stopCacheWarming: () => {},
}));

vi.mock('../services/offlineCache', () => ({
  offlineCache: {
    load: () => Promise.resolve(null),
    save: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    getDiagnosticEntry: () => Promise.resolve(null),
    getAnalytics: () => ({
      hits: 0, misses: 0, staleHits: 0, saves: 0,
      compressionRatio: 0, totalBytesSaved: 0,
    }),
    getStorageStats: () => Promise.resolve({ totalBytes: 0 }),
  },
}));

vi.mock('../utils/logger', () => ({
  log: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

// Mock wsRegistry so that useCacheInvalidation doesn't crash
vi.mock('../services/wsRegistry', () => ({
  getActiveWS: () => null,
}));

/* ------------------------------------------------------------------ */
/*  Mock expo vector icons (used by TabIcon)                           */
/* ------------------------------------------------------------------ */

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, size, color }: any) => <>{`${name}:${size}:${color}`}</>,
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

import { authApi } from '../services/api/auth';
import AppNavigator from '../navigation/AppNavigator';

/**
 * Render AppNavigator and extract all text from the rendered tree.
 * Uses root.root (ReactTestInstance) instead of root.toJSON() to avoid
 * circular reference issues in React 19 when JSON.stringify is called
 * on the serialized element tree (via _owner → FiberNode).
 */
function getRenderedText(): string {
  let root: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    root = TestRenderer.create(<AppNavigator />);
  });

  const texts: string[] = [];
  function collect(node: TestRenderer.ReactTestInstance) {
    node.children?.forEach(child => {
      if (typeof child === 'string') {
        texts.push(child);
      } else if (child && typeof child !== 'string') {
        collect(child as TestRenderer.ReactTestInstance);
      }
    });
  }
  collect(root!.root);
  return texts.join(' ');
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
      const state = { wsLockdownCount: 0, clearLockdownAlert: vi.fn(), lockdown: { status: 'none' as const } };
      return sel ? sel(state) : state;
    });
  });

  it('renders Auth screens when user is not logged in', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: false };
      return sel ? sel(state) : state;
    });

    const text = getRenderedText();

    expect(text).toContain('Login');
    expect(text).toContain('Signup');
    expect(text).not.toContain('MainTabs');
  });

  it('renders MainTabs when user is logged in', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: true };
      return sel ? sel(state) : state;
    });
    mockOnboardingStore.useOnboardingStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { hasCompletedOnboarding: true, initialized: true };
      return sel ? sel(state) : state;
    });

    const text = getRenderedText();

    expect(text).not.toContain('Login');
    expect(text).not.toContain('Signup');
    expect(text).toContain('MainTabs');
  });

  it('registers all five tab screens', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: true };
      return sel ? sel(state) : state;
    });
    mockOnboardingStore.useOnboardingStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { hasCompletedOnboarding: true, initialized: true };
      return sel ? sel(state) : state;
    });

    const text = getRenderedText();

    expect(text).toContain('More');
    expect(text).toContain('Home');
    expect(text).toContain('Markets');
    expect(text).toContain('Portfolio');
    expect(text).toContain('Watchlist');
  });

  it('registers all detail screens in the stack', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: true };
      return sel ? sel(state) : state;
    });
    mockOnboardingStore.useOnboardingStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { hasCompletedOnboarding: true, initialized: true };
      return sel ? sel(state) : state;
    });

    const text = getRenderedText();

    expect(text).toContain('StockDetail');
    expect(text).toContain('Learn');
    expect(text).toContain('Community');
    expect(text).toContain('Notifications');
    expect(text).toContain('Profile');
    expect(text).toContain('MutualFunds');
    expect(text).toContain('SIPs');
    expect(text).toContain('Settings');
    expect(text).toContain('Help');
    expect(text).toContain('AddFunds');
    expect(text).toContain('TransactionHistory');
    expect(text).toContain('PlaceOrder');
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

  beforeEach(() => {
    mockOnboardingStore.useOnboardingStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { hasCompletedOnboarding: true, initialized: true };
      return sel ? sel(state) : state;
    });
  });

  it('renders without crash when wsLockdownCount > 0', () => {
    mockRiskStore.useRiskStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { wsLockdownCount: 3, clearLockdownAlert: vi.fn(), lockdown: { status: 'none' as const } };
      return sel ? sel(state) : state;
    });

    const text = getRenderedText();
    expect(text).toContain('MainTabs');
  });

  it('renders without crash when wsLockdownCount is 0', () => {
    mockRiskStore.useRiskStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { wsLockdownCount: 0, clearLockdownAlert: vi.fn(), lockdown: { status: 'none' as const } };
      return sel ? sel(state) : state;
    });

    const text = getRenderedText();
    expect(text).toContain('MainTabs');
  });

  it('does not call clearLockdownAlert on mount', () => {
    const clearLockdownAlert = vi.fn();
    mockRiskStore.useRiskStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { wsLockdownCount: 3, clearLockdownAlert, lockdown: { status: 'none' as const } };
      return sel ? sel(state) : state;
    });

    TestRenderer.act(() => {
      TestRenderer.create(<AppNavigator />);
    });
    expect(clearLockdownAlert).not.toHaveBeenCalled();
  });
});

describe('AppNavigator — Deep Link URL Parsing', () => {
  // Tests the URL parsing logic used in AppNavigator's handleDeepLink function.
  // The handleDeepLink function does:
  //   const parsed = new URL(url);
  //   const ref = parsed.searchParams.get('ref');
  //   if (ref && parsed.pathname.replace(/^\/+/, '') === 'signup') { ... }
  // These tests verify the URL parsing logic in isolation without needing
  // to mock Linking, act(), or async useEffect behavior.

  it('parses ref param from toroloom://signup?ref=friend123 (custom scheme)', () => {
    // For toroloom:// URLs, 'signup' is the hostname, not the pathname.
    // The handler uses: const path = pathname.replace(...) || hostname;
    const parsed = new URL('toroloom://signup?ref=friend123');
    const path = parsed.pathname.replace(/^\/+/, '') || parsed.hostname;
    expect(path).toBe('signup');
    expect(parsed.searchParams.get('ref')).toBe('friend123');
  });

  it('parses ref param from https://toroloom.com/signup?ref=partner42 (universal link)', () => {
    const parsed = new URL('https://toroloom.com/signup?ref=partner42');
    const path = parsed.pathname.replace(/^\/+/, '') || parsed.hostname;
    expect(path).toBe('signup');
    expect(parsed.searchParams.get('ref')).toBe('partner42');
  });

  it('returns null for missing ref param on toroloom:// URL', () => {
    const parsed = new URL('toroloom://signup');
    const path = parsed.pathname.replace(/^\/+/, '') || parsed.hostname;
    expect(path).toBe('signup');
    expect(parsed.searchParams.get('ref')).toBeNull();
  });

  it('does not match non-signup paths for https:// URLs', () => {
    const parsed = new URL('https://toroloom.com/home?ref=test');
    const path = parsed.pathname.replace(/^\/+/, '') || parsed.hostname;
    expect(path).toBe('home');
    expect(path).not.toBe('signup');
  });

  it('does not match non-signup hosts for toroloom:// URLs', () => {
    const parsed = new URL('toroloom://home?ref=test');
    const path = parsed.pathname.replace(/^\/+/, '') || parsed.hostname;
    expect(path).toBe('home');
    expect(path).not.toBe('signup');
  });

  it('handles URLs with extra path segments', () => {
    const parsed = new URL('https://toroloom.com/signup/extra?ref=test');
    expect(parsed.pathname.replace(/^\/+/, '')).toBe('signup/extra');
    // The handler checks exact 'signup' match, so this won't trigger
    expect(parsed.pathname.replace(/^\/+/, '')).not.toBe('signup');
  });

  it('falls back to hostname for custom scheme URLs like toroloom://signup/', () => {
    // For toroloom:// URLs, 'signup' is the hostname, not the pathname.
    // The handler uses: const path = pathname.replace(...) || hostname;
    const parsed = new URL('toroloom://signup/?ref=test');
    expect(parsed.pathname.replace(/^\/+/, '')).toBe('');
    const path = parsed.pathname.replace(/^\/+/, '') || parsed.hostname;
    expect(path).toBe('signup');
  });

  it('handles deep links with encoded query params', () => {
    const parsed = new URL('toroloom://signup?ref=friend%20123');
    expect(parsed.searchParams.get('ref')).toBe('friend 123');
  });

  it('returns the ref as a string', () => {
    const parsed = new URL('https://toroloom.com/signup?ref=');
    expect(parsed.searchParams.get('ref')).toBe('');
  });
});

describe('AppNavigator — Warm-Start Deep Links', () => {
  let warmStartHandler: ((event: { url: string }) => void) | undefined;
  let removeSubscription: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Set up logged-in state for the navigator
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: true, user: { id: 'test-user', kycStatus: 'verified' } };
      return sel ? sel(state) : state;
    });
    mockOnboardingStore.useOnboardingStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { hasCompletedOnboarding: true, initialized: true };
      return sel ? sel(state) : state;
    });
    mockRiskStore.useRiskStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { wsLockdownCount: 0, clearLockdownAlert: vi.fn(), lockdown: { status: 'none' as const } };
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

    // Undefined by default - test files that don't use it will leave it undefined
    warmStartHandler = undefined;

    // Capture the warm-start handler passed to addEventListener
    // so we can invoke it later with a URL to simulate a warm-start deep link.
    vi.spyOn(Linking, 'addEventListener').mockImplementation((_event, handler) => {
      warmStartHandler = handler as (event: { url: string }) => void;
      removeSubscription = vi.fn();
      return { remove: removeSubscription } as any;
    });

    // Add recordReferral to the mocked authApi
    (authApi as any).recordReferral = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls recordReferral when a warm-start custom scheme deep link arrives', async () => {
    (authApi as any).recordReferral = vi.fn().mockResolvedValue({ success: true });
    const alertSpy = vi.spyOn(Alert, 'alert').mockImplementation(() => {});

    TestRenderer.act(() => {
      TestRenderer.create(<AppNavigator />);
    });

    // Simulate warm-start: user taps a deep link while the app is already running
    expect(warmStartHandler).toBeDefined();
    TestRenderer.act(() => {
      warmStartHandler!({ url: 'toroloom://signup?ref=friend123' });
    });

    await vi.waitFor(() => {
      expect((authApi as any).recordReferral).toHaveBeenCalledWith('friend123');
    });
    await vi.waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        '🎉 Referral Applied',
        expect.stringContaining('friend123'),
        expect.any(Array)
      );
    });
  });

  it('calls recordReferral when a warm-start universal link arrives', async () => {
    (authApi as any).recordReferral = vi.fn().mockResolvedValue({ success: true });

    TestRenderer.act(() => {
      TestRenderer.create(<AppNavigator />);
    });

    TestRenderer.act(() => {
      warmStartHandler!({ url: 'https://toroloom.com/signup?ref=partner42' });
    });

    await vi.waitFor(() => {
      expect((authApi as any).recordReferral).toHaveBeenCalledWith('partner42');
    });
  });

  it('falls back to setReferralSource when the API call fails', async () => {
    (authApi as any).recordReferral = vi.fn().mockRejectedValue(new Error('Network error'));
    const mockSetReferralSource = vi.fn();
    (mockOnboardingStore.getState as any).mockReturnValue({ setReferralSource: mockSetReferralSource });

    TestRenderer.act(() => {
      TestRenderer.create(<AppNavigator />);
    });

    TestRenderer.act(() => {
      warmStartHandler!({ url: 'toroloom://signup?ref=fallbackUser' });
    });

    await vi.waitFor(() => {
      expect(mockSetReferralSource).toHaveBeenCalledWith('fallbackUser');
    });
  });

  it('ignores non-signup URLs when warm-start handler fires', async () => {
    TestRenderer.act(() => {
      TestRenderer.create(<AppNavigator />);
    });

    TestRenderer.act(() => {
      warmStartHandler!({ url: 'toroloom://home?ref=test' });
    });

    // Flush pending microtasks then verify no API call was made
    await new Promise(resolve => setImmediate(resolve));
    expect((authApi as any).recordReferral).not.toHaveBeenCalled();
  });

  it('cleans up the addEventListener subscription on unmount', async () => {
    let root: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      root = TestRenderer.create(<AppNavigator />);
    });

    TestRenderer.act(() => {
      root!.unmount();
    });

    expect(removeSubscription).toHaveBeenCalled();
  });

  it('does not set up event listener when user is not logged in', async () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: false };
      return sel ? sel(state) : state;
    });

    const addEventListenerSpy = vi.spyOn(Linking, 'addEventListener');

    TestRenderer.act(() => {
      TestRenderer.create(<AppNavigator />);
    });

    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });
});

describe('AppNavigator — Theme Integration', () => {
  it('accepts custom theme colors without crashing', () => {
    mockAuthStore.useAuthStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { isLoggedIn: true };
      return sel ? sel(state) : state;
    });
    mockOnboardingStore.useOnboardingStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { hasCompletedOnboarding: true, initialized: true };
      return sel ? sel(state) : state;
    });
    mockRiskStore.useRiskStore.mockImplementation((sel?: (s: any) => any) => {
      const state = { wsLockdownCount: 0, clearLockdownAlert: vi.fn(), lockdown: { status: 'none' as const } };
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
