/**
 * ============================================================================
 * Toroloom — Full User Journey End-to-End (Integration)
 * ============================================================================
 *
 * The COMPLETE discipline lifecycle in ONE test, through REAL screens and
 * REAL stores (only API boundaries, i18n labels and theme are mocked):
 *
 *   Phase 1 — Broker Connect (real ConnectBrokerView):
 *     OAuth deep link → success flash → R:R picker → commit 1:2
 *     → persisted to tradingPrefsStore AND AsyncStorage.
 *
 *   Phase 2 — AI Trade Assistant (real screen, real suggestTradePlan):
 *     Banner shows the committed 1:2; plan targets follow it (T1 = 2750).
 *
 *   Phase 3 — Behavioral Journal (real screen + real modal):
 *     Journal a RELIANCE trade planned at 1:3 (honours 1:2) but exited at
 *     1:1.5 → a realized breach; journal a TCS trade that honours 1:2.
 *
 *   Phase 4 — Weekly Period Report (real screen + real disciplineAnalytics):
 *     Flags exactly the RELIANCE breach ("realized 1:1.50 vs committed 1:2"),
 *     PDF export carries the same flag.
 *
 *   Phase 5 — GDPR Account Deletion (real screen):
 *     Email-confirmed deletion erases every local remnant — persisted R:R
 *     prefs (AsyncStorage), journal session, in-app notifications — then
 *     logs out (the auth gate swaps to Login).
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Hoisted API mocks ──────────────────────────────────────────────────────
const { mockSnapTradeStatus, mockHandleCallback, mockApiPost, mockNavigate, mockLogout, mockPrintToFileAsync } =
  vi.hoisted(() => ({
    mockSnapTradeStatus: vi.fn(),
    mockHandleCallback: vi.fn(),
    mockApiPost: vi.fn(),
    mockNavigate: vi.fn(),
    mockLogout: vi.fn(() => Promise.resolve()),
    mockPrintToFileAsync: vi.fn(() => Promise.resolve({ uri: 'file://report.pdf' })),
  }));

vi.mock('../services/api', () => ({
  api: { post: (...args: unknown[]) => mockApiPost(...args) },
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

vi.mock('expo-print', () => ({
  printToFileAsync: mockPrintToFileAsync,
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(() => Promise.resolve(true)),
  shareAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/cache/',
  writeAsStringAsync: vi.fn(),
  EncodingType: { UTF8: 'utf8' },
}));

vi.mock('../components/gateway/SecureSessionSync', () => ({ default: 'SecureSessionSync' }));
vi.mock('../components/ui/AnimatedPressable', () => ({ default: 'AnimatedPressable' }));

// Auth store: callable hook (screens) + getState (GDPR erasure calls logout)
vi.mock('../store/authStore', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => ({ isLoggedIn: true, user: { id: 'u_1', email: 'user@toroloom.app', balance: 500000 } })),
    { getState: () => ({ logout: mockLogout }) },
  ),
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
  // Selector-aware: journal modal + prefill read it both ways
  usePortfolioStore: (selector: any) => {
    const state = { holdings: [], trades: [] };
    return selector ? selector(state) : state;
  },
}));

function buildMockAnalytics() {
  return {
    metrics: {
      totalReturn: 5410, totalReturnPercent: 7.07, realizedPnl: 5550,
      unrealizedPnl: -140, dayChange: 830, dayChangePercent: 1.02,
      winRate: 66.67, totalTrades: 3, winningTrades: 2, losingTrades: 1,
      avgWin: 2900, avgLoss: 250, profitFactor: 2.32, maxDrawdown: 5000,
      maxDrawdownPercent: 1.37, sharpeRatio: 1.25, avgHoldingDays: 45,
      bestTrade: 5000, worstTrade: -250, consecutiveWins: 1, consecutiveLosses: 0,
    },
    capitalGains: {
      shortTerm: { gains: 5550, count: 3, taxRate: 20, estimatedTax: 1110 },
      longTerm: { gains: 0, count: 0, taxRate: 12.5, exemptLimit: 125000, taxableGains: 0, estimatedTax: 0 },
      totalEstimatedTax: 1110,
      sttPaid: 6.05,
      totalBrokerage: 1.82,
    },
    monthlyReturns: [],
    sectorAllocation: [],
    pnlHistory: [],
  };
}

vi.mock('../store/portfolioAnalyticsStore', () => ({
  usePortfolioAnalyticsStore: (selector: any) =>
    selector
      ? selector({
          getAnalytics: () => buildMockAnalytics(),
          isLive: false,
          lastUpdated: null,
          pnlHistoryStream: [],
          subscribeToLiveUpdates: vi.fn(),
          unsubscribeFromLiveUpdates: vi.fn(),
        })
      : null,
}));

// ── i18n: human labels for every screen under test ─────────────────────────
const T_MAP: Record<string, string> = {
  // Broker connect
  'brokerConnect.title': 'Connect Broker',
  'brokerConnect.subtitle': '1-tap OAuth — powered by SnapTrade',
  'brokerConnect.rrQuestion': 'What risk-reward ratio will you follow?',
  'brokerConnect.rrSubtitle': '₹1 risked for every ₹{{reward}} potential reward — the AI Assistant will plan your stops & targets around this.',
  'brokerConnect.rrUnit': 'reward',
  'brokerConnect.rrDone': 'Start Trading',
  'brokerConnect.successConnected': 'Connected!',
  'brokerConnect.successStored': 'Your Zerodha session is now securely stored.',
  // AI assistant
  'ai.tradeAssistant': 'AI Trade Assistant',
  'ai.tradeAssistantSub': 'Plan your trades',
  'ai.rrCommitmentTitle': 'Your R:R Commitment',
  'ai.rrCommitmentUsed': 'Targets & stops are planned around this ratio',
  'ai.rrCommitmentChange': 'Change',
  'ai.analyzeTrade': 'Analyze Trade',
  'ai.tradePlan': 'Trade Plan',
  // Journal modal
  'journal.planBeforeTrade': 'Your plan before this trade',
  'journal.plannedRisk': 'Risk',
  'journal.plannedReward': 'Reward',
  'journal.plannedRR': 'Planned R:R',
  'journal.rrMeetsCommitment': 'honours your committed 1:{{ratio}}',
  'journal.rrBelowCommitment': 'below your committed 1:{{ratio}}',
  // Period report discipline card
  'periodReport.disciplineTitle': 'R:R Discipline',
  'periodReport.disciplineCommitment': 'Committed ratio: 1:{{ratio}}',
  'periodReport.disciplineMeasured': 'Measured',
  'periodReport.disciplineBreaches': 'Below Commitment',
  'periodReport.disciplineAvgRR': 'Avg Realized',
  'periodReport.disciplineAllClean': 'Every trade honoured your committed R:R — discipline holding',
  'periodReport.disciplineLossNote': '₹{{loss}} lost to below-commitment trades this period',
  'periodReport.disciplineFlagDetail': 'realized 1:{{realized}} vs committed 1:{{committed}}',
  'periodReport.disciplineNoCommitment': 'No R:R commitment yet',
  'periodReport.disciplineNoData': 'Add a planned stop-loss to journal entries',
  // GDPR
  'gdpr.title': 'GDPR',
  'gdpr.subtitle': 'Your rights',
  'gdpr.dataExport': 'Data Export',
  'gdpr.exportDescription': 'Export description',
  'gdpr.exportMyData': 'Export My Data',
  'gdpr.exporting': 'Exporting…',
  'gdpr.exportInfo': 'Export info',
  'gdpr.dataRetention': 'Data Retention',
  'gdpr.retentionDescription': 'Retention description',
  'gdpr.checkRetentionPolicy': 'Check Retention Policy',
  'gdpr.retainedData': 'Retained',
  'gdpr.retainedRecords': '{{count}} records',
  'gdpr.accountDeletion': 'Account Deletion',
  'gdpr.deletionWarning': 'This cannot be undone',
  'gdpr.deletionDescription': 'Deletion description',
  'gdpr.deleteMyAccount': 'Delete My Account',
  'gdpr.confirmDeletion': 'Confirm Deletion',
  'gdpr.confirmDeletionText': 'Type your email to confirm',
  'gdpr.emailPlaceholder': 'you@example.com',
  'gdpr.emailMismatch': 'Email mismatch',
  'gdpr.emailMismatchMessage': 'The email does not match your account',
  'gdpr.accountDeleted': 'Account deleted',
  'gdpr.accountDeletedMessage': 'Your data has been erased',
  'gdpr.deletionFailed': 'Deletion failed',
  'gdpr.deletionFailedMessage': 'Please try again',
  'gdpr.deleting': 'Deleting…',
  'gdpr.confirmDeletionBtn': 'Delete',
  'gdpr.cancel': 'Cancel',
  'gdpr.yourRights': 'Your Rights',
  'gdpr.rightToAccess': 'Access',
  'gdpr.rightToRectification': 'Rectification',
  'gdpr.rightToErasure': 'Erasure',
  'gdpr.rightToPortability': 'Portability',
};

function translate(key: string, params?: Record<string, any>): string {
  if (key === 'periodReport.disciplineBreachAlert' && params?.count != null) {
    const n = Number(params.count);
    return `${n} trade${n === 1 ? '' : 's'} fell below your committed R:R`;
  }
  let text = T_MAP[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return text;
}

vi.mock('../hooks/useT', () => ({
  useT: () => ({ t: translate, language: 'en', isHindi: false, toggleLanguage: vi.fn() }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      bg: '#0B0F19', bgSecondary: '#0E121D', bgCard: '#111827', bgCardLight: '#1A2235',
      bgInput: '#0F131E', border: '#1F2937', divider: '#1E293B',
      primary: '#3B82F6', primaryDim: 'rgba(59,130,246,0.14)',
      accent: '#22D3EE', success: '#22C55E', successDim: 'rgba(34,197,94,0.14)',
      danger: '#EF4444', dangerDim: 'rgba(239,68,68,0.14)',
      warning: '#F59E0B', warningDim: 'rgba(245,158,11,0.14)',
      text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      marketUp: '#00E676', marketDown: '#FF5252',
    },
  }),
}));

// ── Real modules under test ────────────────────────────────────────────────
import { render, fireEvent } from './testUtils';
import ConnectBrokerView from '../screens/broker/ConnectBrokerView';
import AITradeAssistantScreen from '../screens/ai/AITradeAssistantScreen';
import BehavioralJournalScreen from '../screens/journal/BehavioralJournalScreen';
import PeriodReportScreen from '../screens/reports/PeriodReportScreen';
import GDPRScreen from '../screens/settings/GDPRScreen';
import { useTradingPrefsStore } from '../store/tradingPrefsStore';
import { useBehaviorJournalStore } from '../store/behavioralJournalStore';
import { useNotificationStore } from '../store/notificationStore';

const alertSpy = vi.spyOn(Alert, 'alert');

// ──── Helpers ──────────────────────────────────────────────────────────────

const OAUTH_CALLBACK_URL = 'toroloom://snaptrade/callback?authorizationId=auth_123';
const navProps = {
  navigation: { navigate: mockNavigate, goBack: vi.fn() } as any,
  route: { params: {} } as any,
};

async function flushPromises() {
  await act(async () => {
    for (let i = 0; i < 25; i++) await Promise.resolve();
  });
}

async function advancePastSuccessFlash() {
  await act(async () => {
    vi.advanceTimersByTime(2500);
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

async function fireDeepLink() {
  const calls = (Linking.addEventListener as any).mock.calls;
  const registered = calls.find(([, handler]: any[]) => typeof handler === 'function');
  if (!registered) throw new Error('ConnectBrokerView never registered a Linking listener');
  await act(async () => {
    registered[1]({ url: OAUTH_CALLBACK_URL });
  });
  await flushPromises();
}

/** Phase 1: drive the REAL broker-connect screen until the ratio is committed. */
async function connectAndCommit(ratio: number) {
  const screen = render(<ConnectBrokerView {...navProps} />);
  await flushPromises();
  await fireDeepLink();
  await advancePastSuccessFlash();

  expect(screen.getByTestId('rr-picker-overlay')).toBeDefined();
  fireEvent.press(screen.getByTestId(`rr-option-${ratio}`));
  await act(async () => {
    fireEvent.press(screen.getByTestId('rr-confirm'));
  });
  await flushPromises();

  expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(ratio);
  screen.unmount();
}

function type(screen: ReturnType<typeof render>, testId: string, value: string) {
  act(() => {
    fireEvent.changeText(screen.getByTestId(testId), value);
  });
}

/** Phase 3: journal one trade through the real screen FAB + modal. */
function journalTrade(
  screen: ReturnType<typeof render>,
  trade: { symbol: string; entry: string; exit: string; qty: string; stop: string; target: string },
) {
  const fab = screen.root.find(inst => (inst.props as any)?.accessibilityLabel === 'add');
  act(() => {
    fab.props.onPress();
  });
  expect(screen.getByTestId('journal-entry-modal')).toBeDefined();

  type(screen, 'journal-symbol-input', trade.symbol);
  type(screen, 'journal-entry-input', trade.entry);
  type(screen, 'journal-exit-input', trade.exit);
  type(screen, 'journal-qty-input', trade.qty);
  type(screen, 'journal-stop-input', trade.stop);
  type(screen, 'journal-target-input', trade.target);
}

/** Phase 5: walk the GDPR two-step confirm flow. */
async function confirmDeletion(email: string) {
  const screen = render(<GDPRScreen {...navProps} />);
  act(() => { fireEvent.press(screen.getByText('Delete My Account')); });
  act(() => { fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), email); });
  act(() => { fireEvent.press(screen.getByText('Delete')); });
  await act(async () => {
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
  });
  return screen;
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('Full user journey — connect → commit → plan → journal breach → report flag → deletion', () => {
  let initialEntries: any[];
  let deepLinkSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    initialEntries = useBehaviorJournalStore.getState().entries;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    deepLinkSpy = vi.spyOn(Linking, 'addEventListener');

    useTradingPrefsStore.setState({ rewardRiskRatio: null, initialized: false });
    AsyncStorage.clear();
    useBehaviorJournalStore.setState({
      entries: [...initialEntries],
      showEntryModal: false,
      pendingOneTapPrefill: false,
      editingEntry: null,
    });
    useBehaviorJournalStore.getState().recompute();
    useNotificationStore.setState({
      notifications: [{ id: 'n_seed' } as never],
    });

    mockSnapTradeStatus.mockResolvedValue({ connected: false });
    mockHandleCallback.mockResolvedValue({
      success: true,
      connection: { brokerSlug: 'zerodha', brokerName: 'Zerodha' },
    });
    mockApiPost.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    deepLinkSpy.mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  afterAll(() => {
    useBehaviorJournalStore.setState({ entries: initialEntries, showEntryModal: false });
  });

  it('runs the complete lifecycle end-to-end', async () => {
    // ════ Phase 1: broker connect → commit 1:2 ════
    await connectAndCommit(2);

    const stored = JSON.parse(await AsyncStorage.getItem('toroloom_trading_prefs') ?? '{}');
    expect(stored.rewardRiskRatio).toBe(2);

    // Real timers for the remaining phases (vi.waitFor + async flows)
    vi.useRealTimers();

    // ════ Phase 2: AI assistant plans around the committed 1:2 ════
    const assistant = render(<AITradeAssistantScreen {...navProps} />);
    expect(assistant.getByTestId('rr-commit-banner')).toBeDefined();
    expect(assistant.getByText('Your R:R Commitment: 1:2')).toBeDefined();

    fireEvent.press(assistant.getByText('Analyze Trade'));
    // RELIANCE buy @2500, moderate 5% stop = 125 risk → T1 = 2500 + 125×2
    expect(assistant.getByText(/₹2,750/)).toBeDefined();
    expect(assistant.getByText(/₹2,375/)).toBeDefined();
    assistant.unmount();

    // ════ Phase 3: journal the breach + a clean trade through the real modal ════
    const journal = render(<BehavioralJournalScreen {...navProps} />);

    // Breach: planned 1:3 (stop 98, target 106) honours 1:2 — but exit 103 = 1:1.5
    journalTrade(journal, { symbol: 'RELIANCE', entry: '100', exit: '103', qty: '10', stop: '98', target: '106' });
    expect(journal.getByTestId('journal-rr-preview')).toBeDefined();
    expect(journal.getByText('Risk: ₹20  ·  Reward: ₹60')).toBeDefined();
    expect(journal.getByText('Planned R:R 1:3.00 · honours your committed 1:2')).toBeDefined();
    act(() => { fireEvent.press(journal.getByTestId('journal-save')); });

    // Clean: planned 1:2, realized 1:2 — exit 110 with stop 95 (risk 5 → 2.0)
    journalTrade(journal, { symbol: 'TCS', entry: '100', exit: '110', qty: '10', stop: '95', target: '115' });
    act(() => { fireEvent.press(journal.getByTestId('journal-save')); });

    const entries = useBehaviorJournalStore.getState().entries;
    expect(entries.find(e => e.symbol === 'RELIANCE')).toMatchObject({
      plannedStop: 98, plannedTarget: 106, pnl: 30,
    });
    expect(entries.find(e => e.symbol === 'TCS')).toMatchObject({
      plannedStop: 95, plannedTarget: 115, pnl: 100,
    });
    journal.unmount();

    // ════ Phase 4: weekly report flags exactly the breach ════
    const report = render(<PeriodReportScreen {...navProps} />);
    expect(report.getByText('R:R Discipline')).toBeDefined();
    expect(report.getByText('1 trade fell below your committed R:R')).toBeDefined();
    expect(report.getByText('RELIANCE')).toBeDefined();
    expect(report.getByText('realized 1:1.50 vs committed 1:2')).toBeDefined();
    // The clean TCS trade is NOT flagged
    expect(report.queryByText('realized 1:2.00 vs committed 1:2')).toBeNull();
    expect(report.queryByText('Every trade honoured your committed R:R — discipline holding')).toBeNull();

    // PDF export carries the same flag
    fireEvent.press(report.getByTestId('export-pdf-btn'));
    await vi.waitFor(() => {
      expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
    });
    const html = (mockPrintToFileAsync.mock.calls as any)[0][0].html;
    expect(html).toContain('R:R Discipline (committed 1:2)');
    expect(html).toContain('RELIANCE');
    expect(html).toContain('realized 1:1.50 vs committed 1:2');
    report.unmount();

    // ════ Phase 5: GDPR deletion erases everything and logs out ════
    const gdpr = await confirmDeletion('user@toroloom.app');

    expect(mockApiPost).toHaveBeenCalledWith('/gdpr/delete', expect.objectContaining({
      confirmDeletion: true,
    }));
    // Every local remnant erased
    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBeNull();
    expect(await AsyncStorage.getItem('toroloom_trading_prefs')).toBeNull();
    expect(useBehaviorJournalStore.getState().entries).toHaveLength(0);
    expect(useBehaviorJournalStore.getState().reports).toHaveLength(0);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
    // Session ended last → the auth gate swaps to Login
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Account deleted', 'Your data has been erased', expect.anything());
    gdpr.unmount();
  });
});
