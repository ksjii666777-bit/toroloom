/**
 * ============================================================================
 * Toroloom — ConnectBrokerView Risk-Reward Picker Integration Test
 * ============================================================================
 *
 * End-to-end flow through the real ConnectBrokerView + real
 * tradingPrefsStore, with only the API layer and AsyncStorage mocked:
 *
 *   1. OAuth deep link fires on mount → handleSnapTradeCallback succeeds
 *   2. Success flash shows for 2.5s, then the R:R picker appears
 *   3. No picker when the user already committed a ratio earlier
 *   4. Selecting 1:3 highlights it and updates the subtitle example
 *   5. Confirming persists { rewardRiskRatio: 3 } to AsyncStorage
 *   6. Picker closes after confirmation; store keeps the committed value
 *
 * The real tradingPrefsStore runs against the setup.ts in-memory AsyncStorage
 * mock, so persistence is verified end to end (state → storage → reload).
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Hoisted API mocks ──────────────────────────────────────────────────────
const { mockSnapTradeStatus, mockHandleCallback } = vi.hoisted(() => ({
  mockSnapTradeStatus: vi.fn(),
  mockHandleCallback: vi.fn(),
}));

vi.mock('../services/api', () => ({
  snapTradeApi: {
    status: mockSnapTradeStatus,
    register: vi.fn(() => Promise.resolve({ success: true })),
    getConnectLink: vi.fn(() => Promise.resolve({ oauthUrl: 'https://broker.example/oauth' })),
    handleCallback: mockHandleCallback,
    disconnect: vi.fn(() => Promise.resolve()),
  },
  brokerProxyApi: {
    getHoldings: vi.fn(() => Promise.resolve({ success: true, data: {} })),
  },
}));

vi.mock('../components/gateway/SecureSessionSync', () => ({
  default: 'SecureSessionSync',
}));

vi.mock('../components/ui/AnimatedPressable', () => ({
  default: 'AnimatedPressable',
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ isLoggedIn: true })),
}));

// i18n keys resolve to the same human labels the en locale uses
const T_MAP: Record<string, string> = {
  'brokerConnect.title': 'Connect Broker',
  'brokerConnect.subtitle': '1-tap OAuth — powered by SnapTrade',
  'brokerConnect.oAuth': 'O AUTH 2.0',
  'brokerConnect.brokers': '20+ BROKERS',
  'brokerConnect.secure': 'SECURE',
  'brokerConnect.connected': 'Connected',
  'brokerConnect.secureSessionActive': 'Secure Session Active',
  'brokerConnect.testApi': 'Test API',
  'brokerConnect.disconnect': 'Disconnect',
  'brokerConnect.chooseBroker': 'Choose Your Broker',
  'brokerConnect.switchBroker': 'Switch to a different broker below',
  'brokerConnect.selectBroker': 'Select a broker — no API keys needed',
  'brokerConnect.sessionActive': 'Session Active',
  'brokerConnect.oauthConnect': 'OAuth Connect',
  'brokerConnect.tapToConnect': 'Tap to Connect',
  'brokerConnect.successConnected': 'Connected!',
  'brokerConnect.successStored': 'Your Zerodha session is now securely stored.',
  'brokerConnect.rrQuestion': 'What risk-reward ratio will you follow?',
  'brokerConnect.rrSubtitle': '₹1 risked for every ₹{{reward}} potential reward — the AI Assistant will plan your stops & targets around this.',
  'brokerConnect.rrUnit': 'reward',
  'brokerConnect.rrDone': 'Start Trading',
};

// Simple {{var}} interpolation so the subtitle reflects the pending ratio
function translate(key: string, params?: Record<string, unknown>): string {
  let text = T_MAP[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return text;
}

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: translate,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6', accent: '#00E676', danger: '#FF5252',
      text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      bg: '#07080B', bgSecondary: '#0E121D', bgCard: 'rgba(255,255,255,0.03)',
      bgCardLight: '#1A2235', bgInput: '#0F131E', border: 'rgba(255,255,255,0.07)',
      divider: 'rgba(255,255,255,0.05)',
    },
  }),
}));

import { render, fireEvent } from './testUtils';
import ConnectBrokerView from '../screens/broker/ConnectBrokerView';
import { useTradingPrefsStore } from '../store/tradingPrefsStore';

// ──── Helpers ──────────────────────────────────────────────────────────────

function renderView() {
  return render(<ConnectBrokerView navigation={{ goBack: vi.fn() } as any} route={{ params: {} } as any} />);
}

/**
 * Flush pending promise chains so async effects (status check, callbacks)
 * resolve. IMPORTANT: must never await a faked setTimeout — under fake
 * timers that promise never resolves and the suite hangs. Microtask
 * pumping only.
 */
async function flushPromises() {
  await act(async () => {
    for (let i = 0; i < 25; i++) {
      await Promise.resolve();
    }
  });
}

/** Advance the 2.5s success-flash timer that reveals the R:R picker */
async function advancePastSuccessFlash() {
  await act(async () => {
    vi.advanceTimersByTime(2500);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  });
}

const OAUTH_CALLBACK_URL = 'toroloom://snaptrade/callback?authorizationId=auth_123';

/**
 * Fire the OAuth deep link through the component's Linking listener,
 * exactly as the OS would after the broker OAuth redirect.
 */
async function fireDeepLink() {
  const addListenerCalls = (Linking.addEventListener as any).mock.calls;
  const registered = addListenerCalls.find(([, handler]: any[]) => typeof handler === 'function');
  if (!registered) throw new Error('ConnectBrokerView never registered a Linking listener');
  await act(async () => {
    registered[1]({ url: OAUTH_CALLBACK_URL });
  });
  await flushPromises();
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('ConnectBrokerView — Risk-Reward picker integration', () => {
  let deepLinkSpy: ReturnType<typeof vi.spyOn>;
  let rendered: ReturnType<typeof render> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    // Only the flash timer needs faking; setImmediate/microtasks stay real
    // (faked timers would deadlock act() and vitest's own test timeout).
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });

    // Spy the RN mock's Linking listener registry so tests can fire the
    // OAuth deep link like the OS would.
    deepLinkSpy = vi.spyOn(Linking, 'addEventListener');

    // Fresh store + storage for every test
    useTradingPrefsStore.setState({ rewardRiskRatio: null, initialized: false });

    // Default: disconnected, and the OAuth callback succeeds with Zerodha
    mockSnapTradeStatus.mockResolvedValue({ connected: false });
    mockHandleCallback.mockResolvedValue({
      success: true,
      connection: { brokerSlug: 'zerodha', brokerName: 'Zerodha' },
    });
  });

  afterEach(() => {
    // Unmount so the NEXT test's render starts from a clean React tree —
    // stale components from a previous test keep old state/handlers alive.
    rendered?.unmount();
    rendered = null;
    deepLinkSpy.mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('shows the R:R picker after connect success when no ratio was chosen', async () => {
    rendered = renderView();
    const { getByTestId, getByText, queryByTestId } = rendered;
    await flushPromises();

    // Simulate the OAuth deep link arriving
    await fireDeepLink();

    // Success flash first, picker not yet visible
    expect(getByText('Connected!')).toBeDefined();
    expect(queryByTestId('rr-picker-overlay')).toBeNull();

    // After 2.5s the flash ends and the picker appears
    await advancePastSuccessFlash();
    expect(getByTestId('rr-picker-overlay')).toBeDefined();
    expect(getByText('What risk-reward ratio will you follow?')).toBeDefined();

    // All three options render
    expect(getByTestId('rr-option-2')).toBeDefined();
    expect(getByTestId('rr-option-3')).toBeDefined();
    expect(getByTestId('rr-option-5')).toBeDefined();
  });

  it('selecting 1:3 and confirming persists the ratio to tradingPrefsStore', async () => {
    rendered = renderView();
    const { getByTestId, getByText } = rendered;
    await flushPromises();

    await fireDeepLink();
    await advancePastSuccessFlash();

    // Pick 1:3
    fireEvent.press(getByTestId('rr-option-3'));

    // Subtitle reflects the pending selection (₹3 reward for ₹1 risk)
    expect(getByText('₹1 risked for every ₹3 potential reward — the AI Assistant will plan your stops & targets around this.')).toBeDefined();

    // Confirm → persists to store AND AsyncStorage
    await act(async () => {
      fireEvent.press(getByTestId('rr-confirm'));
    });
    await flushPromises();

    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(3);
    // Persisted via setItem to the trading-prefs key
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'toroloom_trading_prefs',
      JSON.stringify({ rewardRiskRatio: 3 }),
    );
    const stored = JSON.parse(await AsyncStorage.getItem('toroloom_trading_prefs') ?? '{}');
    expect(stored.rewardRiskRatio).toBe(3);
  });

  it('closes the picker after confirmation', async () => {
    rendered = renderView();
    const { getByTestId, queryByTestId } = rendered;
    await flushPromises();

    await fireDeepLink();
    await advancePastSuccessFlash();

    fireEvent.press(getByTestId('rr-option-3'));
    await act(async () => {
      fireEvent.press(getByTestId('rr-confirm'));
    });
    await flushPromises();

    expect(queryByTestId('rr-picker-overlay')).toBeNull();
  });

  it('does NOT show the picker when the user already committed a ratio', async () => {
    // User already chose 1:5 in an earlier session
    useTradingPrefsStore.setState({ rewardRiskRatio: 5, initialized: true });

    rendered = renderView();
    const { queryByTestId, getByText } = rendered;
    await flushPromises();

    await fireDeepLink();

    // Connect succeeded — flash shows while the timer runs
    expect(getByText('Connected!')).toBeDefined();

    await advancePastSuccessFlash();

    // ...but the picker never appears because a ratio is already committed
    expect(queryByTestId('rr-picker-overlay')).toBeNull();
    // Committed value untouched
    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(5);
  });

  it('defaults the pending selection to 1:3 before the user taps anything', async () => {
    rendered = renderView();
    const { getByTestId, getByText } = rendered;
    await flushPromises();

    await fireDeepLink();
    await advancePastSuccessFlash();

    // Default pending = 3 → subtitle shows ₹3 without any tap
    expect(getByText(/₹3 potential reward/)).toBeDefined();

    // Confirm immediately → 3 is what gets committed
    await act(async () => {
      fireEvent.press(getByTestId('rr-confirm'));
    });
    await flushPromises();

    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(3);
  });

  it('no picker appears when the OAuth callback fails', async () => {
    mockHandleCallback.mockResolvedValue({ success: false });

    rendered = renderView();
    const { queryByTestId } = rendered;
    await flushPromises();

    await fireDeepLink();
    await advancePastSuccessFlash();

    expect(queryByTestId('rr-picker-overlay')).toBeNull();
    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBeNull();
  });

  it('no picker and no success flash when no deep link arrives', async () => {
    rendered = renderView();
    const { queryByTestId, queryByText } = rendered;
    await flushPromises();
    await advancePastSuccessFlash();

    expect(queryByText('Connected!')).toBeNull();
    expect(queryByTestId('rr-picker-overlay')).toBeNull();
    expect(mockHandleCallback).not.toHaveBeenCalled();
  });

  it('reloading from storage restores the committed ratio (persistence round-trip)', async () => {
    rendered = renderView();
    const { getByTestId } = rendered;
    await flushPromises();

    await fireDeepLink();
    await advancePastSuccessFlash();

    fireEvent.press(getByTestId('rr-option-5'));
    await act(async () => {
      fireEvent.press(getByTestId('rr-confirm'));
    });
    await flushPromises();

    // Simulate a fresh app launch: reset in-memory state and reload from storage
    useTradingPrefsStore.setState({ rewardRiskRatio: null, initialized: false });
    await useTradingPrefsStore.getState().loadPrefs();

    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(5);
    expect(useTradingPrefsStore.getState().initialized).toBe(true);
  });
});
