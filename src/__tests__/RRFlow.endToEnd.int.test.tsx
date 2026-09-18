/**
 * ============================================================================
 * Toroloom — R:R Commitment End-to-End Flow (Integration)
 * ============================================================================
 *
 * Verifies the FULL risk-reward discipline chain across two screens:
 *
 *   Phase 1 — Broker Connect (real ConnectBrokerView):
 *     OAuth deep link → success flash → R:R picker → user commits 1:2
 *     → persisted to tradingPrefsStore AND AsyncStorage
 *
 *   Phase 2 — AI Trade Assistant (real AITradeAssistantScreen):
 *     Banner shows "Your R:R Commitment: 1:2" with a Change link
 *     → Analyze pressed with real inputs
 *     → real suggestTradePlan() generates stop-loss & targets where the
 *       FIRST target is exactly entry + 2 × risk (the 1:2 commitment),
 *       NOT the profile default (2.5 for conservative, 2 for moderate).
 *
 * Only the broker API layer, i18n labels and theme are mocked; the picker,
 * the store, the assistant screen and the trade-assistant math all run for
 * real, with AsyncStorage from setup.ts acting as device storage.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Hoisted API mocks ──────────────────────────────────────────────────────
const { mockSnapTradeStatus, mockHandleCallback, mockNavigate } = vi.hoisted(() => ({
  mockSnapTradeStatus: vi.fn(),
  mockHandleCallback: vi.fn(),
  mockNavigate: vi.fn(),
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
  useAuthStore: vi.fn(() => ({ isLoggedIn: true, user: { balance: 500000 } })),
}));

vi.mock('../store/marketStore', () => ({
  useMarketStore: vi.fn(() => ({
    stocks: [{
      id: 'reliance', symbol: 'RELIANCE', name: 'Reliance Industries',
      sector: 'Energy', price: 2500, pe: 24.5, dividend: 0.4,
      low52: 2100, high52: 2900, isPositive: true,
    }],
  })),
}));

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: vi.fn(() => ({ holdings: [] })),
}));

// ── i18n: same human labels as the en locale ───────────────────────────────
const T_MAP: Record<string, string> = {
  // Broker connect screen
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
  'brokerConnect.connectionFailed': 'Connection Failed',
  'brokerConnect.checkConnection': 'Please check your internet connection and try again.',
  // AI Trade Assistant screen
  'ai.tradeAssistant': 'AI Trade Assistant',
  'ai.tradeAssistantSub': 'Plan your trades',
  'ai.stock': 'Stock',
  'ai.tradeParams': 'Trade Parameters',
  'ai.buy': 'BUY',
  'ai.sell': 'SELL',
  'ai.quantity': 'Quantity',
  'ai.entryPrice': 'Entry Price',
  'ai.positionCost': 'Position Cost',
  'ai.riskProfile': 'Risk Profile',
  'ai.conservative': 'Conservative',
  'ai.moderate': 'Moderate',
  'ai.aggressive': 'Aggressive',
  'ai.maxRiskPerTrade': 'Max risk per trade',
  'ai.pctOfPortfolio': '{{pct}}% of portfolio',
  'ai.maxPositionSize': 'Max position size',
  'ai.minRiskReward': 'Min risk/reward',
  'ai.maxPositions': 'Max positions',
  'ai.analyzeTrade': 'Analyze Trade',
  'ai.tradePlan': 'Trade Plan',
  'ai.stopLoss': 'Stop Loss',
  'ai.rrCommitmentTitle': 'Your R:R Commitment',
  'ai.rrCommitmentUsed': 'Targets & stops are planned around this ratio',
  'ai.rrCommitmentSetTitle': 'No R:R commitment yet',
  'ai.rrCommitmentNone': 'Profile default is being used — commit to a ratio for disciplined planning',
  'ai.rrCommitmentChange': 'Change',
  'ai.rrCommitmentSet': 'Set now',
};

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
      marketUp: '#00E676', marketDown: '#FF5252', warning: '#FFAB40',
    },
  }),
}));

import { render, fireEvent } from './testUtils';
import ConnectBrokerView from '../screens/broker/ConnectBrokerView';
import AITradeAssistantScreen from '../screens/ai/AITradeAssistantScreen';
import { useTradingPrefsStore } from '../store/tradingPrefsStore';

// ──── Helpers ──────────────────────────────────────────────────────────────

const OAUTH_CALLBACK_URL = 'toroloom://snaptrade/callback?authorizationId=auth_123';

async function flushPromises() {
  await act(async () => {
    for (let i = 0; i < 25; i++) {
      await Promise.resolve();
    }
  });
}

async function advancePastSuccessFlash() {
  await act(async () => {
    vi.advanceTimersByTime(2500);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  });
}

async function fireDeepLink() {
  const addListenerCalls = (Linking.addEventListener as any).mock.calls;
  const registered = addListenerCalls.find(([, handler]: any[]) => typeof handler === 'function');
  if (!registered) throw new Error('ConnectBrokerView never registered a Linking listener');
  await act(async () => {
    registered[1]({ url: OAUTH_CALLBACK_URL });
  });
  await flushPromises();
}

/**
 * Phase 1: drive the REAL broker-connect screen until 1:2 is committed.
 * Returns nothing — the side effect is the store + AsyncStorage state.
 */
async function connectAndCommitOneToTwo() {
  const screen = render(
    <ConnectBrokerView navigation={{ goBack: vi.fn() } as any} route={{ params: {} } as any} />,
  );
  await flushPromises();
  await fireDeepLink();
  await advancePastSuccessFlash();

  // Picker visible → commit 1:2
  expect(screen.getByTestId('rr-picker-overlay')).toBeDefined();
  fireEvent.press(screen.getByTestId('rr-option-2'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('rr-confirm'));
  });
  await flushPromises();

  expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(2);
  screen.unmount();
}

const assistantProps = () => ({
  navigation: { navigate: mockNavigate, goBack: vi.fn() },
  route: { params: {} },
}) as any;

// ──── Tests ────────────────────────────────────────────────────────────────

describe('R:R commitment — end-to-end (connect → commit 1:2 → assistant plan)', () => {
  let deepLinkSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    deepLinkSpy = vi.spyOn(Linking, 'addEventListener');

    useTradingPrefsStore.setState({ rewardRiskRatio: null, initialized: false });
    AsyncStorage.clear();

    mockSnapTradeStatus.mockResolvedValue({ connected: false });
    mockHandleCallback.mockResolvedValue({
      success: true,
      connection: { brokerSlug: 'zerodha', brokerName: 'Zerodha' },
    });
  });

  afterEach(() => {
    deepLinkSpy.mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('connect → commit 1:2 → assistant banner shows 1:2 and the plan targets follow it', async () => {
    // ── Phase 1: broker connect commits 1:2 through the real picker ──
    await connectAndCommitOneToTwo();

    // Persisted to device storage too
    const stored = JSON.parse(await AsyncStorage.getItem('toroloom_trading_prefs') ?? '{}');
    expect(stored.rewardRiskRatio).toBe(2);

    // ── Phase 2: fresh mount of the AI Trade Assistant reads it ──
    const screen = render(<AITradeAssistantScreen {...assistantProps()} />);
    const { getByTestId, getByText } = screen;

    // Banner reflects the committed ratio from the REAL store
    expect(getByTestId('rr-commit-banner')).toBeDefined();
    expect(getByText('Your R:R Commitment: 1:2')).toBeDefined();
    expect(getByText('Targets & stops are planned around this ratio')).toBeDefined();
    expect(getByText('Change')).toBeDefined();

    // Analyze the default trade: RELIANCE buy @ ₹2500, qty 100
    fireEvent.press(getByText('Analyze Trade'));

    // Real suggestTradePlan with the 1:2 commitment:
    //   moderate profile stop = 5% of 2500 = 125 risk
    //   T1 = 2500 + 125×2 = 2750 · T2 = 2500 + 187.5 = 2875 · T3 = 2500 + 375 = 3250
    expect(getByText(/₹2,750/)).toBeDefined();
    expect(getByText(/₹2,875/)).toBeDefined();
    expect(getByText(/₹3,250/)).toBeDefined();

    // Stop loss below entry at 2375 (2500 − 5%)
    expect(getByText(/₹2,375/)).toBeDefined();

    // Min risk/reward row shows the commitment (2), not a profile default
    expect(getByText('2:1')).toBeDefined();

    // The banner's Change link routes back to broker connect
    fireEvent.press(getByTestId('rr-commit-link'));
    expect(mockNavigate).toHaveBeenCalledWith('BrokerConnect');

    screen.unmount();
  });

  it('the committed 1:2 beats the conservative profile default (2.5) in the targets', async () => {
    await connectAndCommitOneToTwo();

    const screen = render(<AITradeAssistantScreen {...assistantProps()} />);
    const { getByText } = screen;

    // Switch to Conservative — its default ratio is 2.5, but the 1:2
    // commitment must still win.
    fireEvent.press(getByText('Conservative'));
    fireEvent.press(getByText('Analyze Trade'));

    // T1 = 2500 + (2500×3%)×2 = 2650 — the COMMITTED 2× multiple,
    // not 2687.50 (which a 2.5× profile default would produce)
    expect(getByText(/₹2,650/)).toBeDefined();
    expect(screen.getAllByText(/₹2,687\.5/).length).toBe(0);

    screen.unmount();
  });

  it('changing the commitment to 1:5 moves the banner and the plan targets', async () => {
    await connectAndCommitOneToTwo();

    const screen = render(<AITradeAssistantScreen {...assistantProps()} />);
    const { getByText } = screen;
    fireEvent.press(getByText('Analyze Trade'));

    // Baseline: 1:2 targets (T1 = 2750)
    expect(getByText(/₹2,750/)).toBeDefined();

    // User changes their commitment to 1:5 (via the Change link → picker)
    act(() => {
      useTradingPrefsStore.setState({ rewardRiskRatio: 5 });
    });
    screen.update(<AITradeAssistantScreen {...assistantProps()} />);
    fireEvent.press(getByText('Analyze Trade'));

    // Banner now shows 1:5
    expect(getByText('Your R:R Commitment: 1:5')).toBeDefined();

    // Targets moved to the 5× multiple: T1 = 2500 + 125×5 = 3125
    expect(getByText(/₹3,125/)).toBeDefined();
    expect(screen.getAllByText(/₹2,750/).length).toBe(0);

    screen.unmount();
  });

  it('without a commitment the banner prompts Set now and the profile default drives targets', async () => {
    // Fresh app launch, user skipped the picker (no commitment yet)
    useTradingPrefsStore.setState({ rewardRiskRatio: null, initialized: true });

    const screen = render(<AITradeAssistantScreen {...assistantProps()} />);
    const { getByTestId, getByText } = screen;

    // Set-now prompt instead of a committed ratio
    expect(getByText('No R:R commitment yet')).toBeDefined();
    expect(getByText('Set now')).toBeDefined();

    // Conservative profile default (2.5×) drives the targets
    fireEvent.press(getByText('Conservative'));
    fireEvent.press(getByText('Analyze Trade'));

    // T1 = 2500 + (2500×3%)×2.5 = 2687.50, and Min risk/reward shows 2.5:1
    expect(getByText(/₹2,687\.5/)).toBeDefined();
    expect(getByText('2.5:1')).toBeDefined();

    // No commitment banner title
    expect(getByTestId('rr-commit-banner')).toBeDefined();
    expect(screen.queryByText(/Your R:R Commitment/)).toBeNull();

    screen.unmount();
  });

  it('shows an error alert when the OAuth handshake succeeds but no session is created', async () => {
    // Regression: a success:false callback used to fail silently — the user
    // stared at the connect screen with no feedback at all.
    const alertSpy = vi.spyOn(Alert, 'alert');
    mockHandleCallback.mockResolvedValueOnce({ success: false, error: 'handshake rejected' });

    const screen = render(
      <ConnectBrokerView navigation={{ goBack: vi.fn() } as any} route={{ params: {} } as any} />,
    );
    await flushPromises();
    await fireDeepLink();
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith(
      'Connection Failed',
      'Please check your internet connection and try again.',
    );
    // No success flash, no R:R picker on the failed path
    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBeNull();
    expect(screen.queryByTestId('rr-picker-overlay')).toBeNull();

    alertSpy.mockRestore();
    screen.unmount();
  });
});
