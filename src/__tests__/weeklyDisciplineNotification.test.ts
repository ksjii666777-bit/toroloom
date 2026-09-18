/**
 * ============================================================================
 * Toroloom — Weekly Discipline Notification Tests
 * ============================================================================
 *
 * Tests the weekly R:R digest service with REAL stores, REAL discipline
 * analytics, REAL i18n and the mocked AsyncStorage from setup.ts:
 *   - digest composition (clean week / breach week / breach-with-loss week)
 *   - the four skip gates (preference off, no commitment, no measurable
 *     trades, 7-day throttle not elapsed)
 *   - throttle write happens only on a successful send
 *
 * NOTE: the notification store seeds mock notifications, so all assertions
 * scope to the digest via its `wdn_` id prefix rather than absolute counts.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// The notification store imports notificationService (native module bridge) — mock it.
vi.mock('../services/notificationService', () => ({
  sendLocalNotification: vi.fn(() => Promise.resolve('local-id')),
  cancelNotification: vi.fn(),
  cancelAllNotifications: vi.fn(),
  sendPortfolioAlert: vi.fn(),
  updateAppIconBadge: vi.fn(() => Promise.resolve()),
}));

// ==================== Imports (after mocks) ====================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  maybeSendWeeklyDisciplineNotification,
  composeDisciplineDigest,
  resetWeeklyDisciplineThrottle,
} from '../services/weeklyDisciplineNotification';
import { useNotificationStore } from '../store/notificationStore';
import { useTradingPrefsStore } from '../store/tradingPrefsStore';
import { useBehaviorJournalStore } from '../store/behavioralJournalStore';
import { computeDisciplineSummary } from '../utils/analytics/disciplineAnalytics';
import { JournalEntry } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const THROTTLE_KEY = 'toroloom_weekly_discipline_last_sent';

// ==================== Fixtures ====================

/**
 * Default fixture: a trade that realized EXACTLY the committed 1:2 —
 * entry 100, stop 98 (risk ₹2/unit), exit 104 (gain ₹4/unit) → RR 2.0.
 */
function makeEntry(over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'j1',
    date: new Date().toISOString(),
    symbol: 'TCS',
    direction: 'long',
    entryPrice: 100,
    exitPrice: 104,
    quantity: 10,
    pnl: 40,
    pnlPercent: 4,
    holdingPeriod: '1d',
    emotionalState: 'calm',
    mistakes: [],
    planCompliance: 80,
    plannedStop: 98,
    plannedTarget: 106,
    notes: '',
    setupType: 'breakout',
    exitReason: 'manual',
    tags: [],
    ...over,
  } as JournalEntry;
}

/**
 * A losing breach: risk ₹2/unit (stop 98), but cut the trade at ₹1/unit loss
 * → RR 0.5 ≪ 1:2, with negative P&L. (Under magnitude-based RR a DEEP loss
 * would look like a high multiple — a losing breach is an EARLY small loss.)
 */
function makeLosingBreach(over: Partial<JournalEntry> = {}): JournalEntry {
  return makeEntry({
    exitPrice: 99,
    pnl: -10,
    ...over,
  });
}

function resetStores(opts: {
  committed?: number | null;
  entries?: JournalEntry[];
  weeklyEnabled?: boolean;
} = {}) {
  const { committed = 2, entries = [], weeklyEnabled = true } = opts;
  useTradingPrefsStore.setState({ rewardRiskRatio: committed } as any);
  useBehaviorJournalStore.setState({ entries } as any);
  useNotificationStore.setState({
    preferences: {
      ...useNotificationStore.getState().preferences,
      weeklyDisciplineReport: weeklyEnabled,
    },
  } as any);
}

function getDigest() {
  return useNotificationStore.getState().notifications.find(n => n.id.startsWith('wdn_'));
}

// ==================== Tests ====================

describe('weeklyDisciplineNotification — digest delivery', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();
    // Zustand module state persists across tests in this file — clear the
    // notification list so `wdn_`-digest lookups see only THIS test's send.
    useNotificationStore.setState({ notifications: [], scheduledIds: {} } as any);
    resetStores();
  });

  it('sends the loss digest with breach count, score and ₹ loss', async () => {
    resetStores({ entries: [makeLosingBreach(), makeEntry({ id: 'j2', symbol: 'INFY' })] });

    const id = await maybeSendWeeklyDisciplineNotification();

    expect(id).not.toBeNull();
    const sent = getDigest();
    expect(sent).toBeDefined();
    expect(sent!.type).toBe('system');
    expect(sent!.title).toContain('committed 1:2');
    // 2 measured, 1 breach → score 50; the loser lost ₹10
    expect(sent!.message).toContain('₹10 lost');
    expect(sent!.message).toContain('50/100');
    expect((sent!.data as any).screen).toBe('PeriodReport');

    // Throttle written after send
    const lastSent = await AsyncStorage.getItem(THROTTLE_KEY);
    expect(lastSent).not.toBeNull();
    expect(Number(lastSent)).toBeGreaterThan(0);
  });

  it('sends the clean-week digest when every trade honoured the commitment', async () => {
    resetStores({ entries: [makeEntry({ id: 'j2', symbol: 'INFY' })] });

    await maybeSendWeeklyDisciplineNotification();

    const sent = getDigest();
    expect(sent).toBeDefined();
    expect(sent!.message).toContain('Perfect week');
    expect(sent!.message).toContain('100/100');
  });

  it('does not count trades older than a week', async () => {
    resetStores({
      entries: [makeLosingBreach({ date: new Date(Date.now() - 20 * DAY_MS).toISOString() })],
    });

    const id = await maybeSendWeeklyDisciplineNotification();

    expect(id).toBeNull();
    expect(getDigest()).toBeUndefined();
  });
});

describe('weeklyDisciplineNotification — skip gates', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();
    resetStores();
  });

  it('skips when the weeklyDisciplineReport preference is off', async () => {
    resetStores({ entries: [makeEntry()], weeklyEnabled: false });

    const id = await maybeSendWeeklyDisciplineNotification();

    expect(id).toBeNull();
    expect(getDigest()).toBeUndefined();
    // No throttle write either
    expect(await AsyncStorage.getItem(THROTTLE_KEY)).toBeNull();
  });

  it('skips when no R:R ratio is committed', async () => {
    resetStores({ committed: null, entries: [makeEntry()] });

    const id = await maybeSendWeeklyDisciplineNotification();

    expect(id).toBeNull();
    expect(getDigest()).toBeUndefined();
  });

  it('skips when there are no measurable trades (no planned stop)', async () => {
    const unmeasurable = makeEntry({ plannedStop: undefined, plannedTarget: undefined });
    resetStores({ entries: [unmeasurable] });

    const id = await maybeSendWeeklyDisciplineNotification();

    expect(id).toBeNull();
    expect(getDigest()).toBeUndefined();
  });

  it('skips when a digest was sent less than 7 days ago', async () => {
    resetStores({ entries: [makeEntry()] });
    await AsyncStorage.setItem(THROTTLE_KEY, String(Date.now() - 2 * DAY_MS));

    const id = await maybeSendWeeklyDisciplineNotification();

    expect(id).toBeNull();
    expect(getDigest()).toBeUndefined();
  });

  it('sends again once the 7-day window has elapsed', async () => {
    resetStores({ entries: [makeEntry()] });
    await AsyncStorage.setItem(THROTTLE_KEY, String(Date.now() - 8 * DAY_MS));

    const id = await maybeSendWeeklyDisciplineNotification();

    expect(id).not.toBeNull();
    expect(getDigest()).toBeDefined();
  });
});

describe('composeDisciplineDigest — body variants', () => {
  it('includes the ₹ loss when breach trades lost money', () => {
    const summary = computeDisciplineSummary([makeLosingBreach()], 2)!;
    expect(summary.breaches).toBe(1);

    const body = composeDisciplineDigest(summary);
    expect(body).toContain('₹10 lost');
    expect(body).toContain('0/100');
  });

  it('omits the ₹ loss clause when breach trades were winners (early exit)', () => {
    // Winning breach: exit 101 vs stop 98 → risk ₹2, gain ₹1 → RR 0.5 ≪ 1:2, but +₹ P&L
    const winner = makeEntry({ entryPrice: 100, exitPrice: 101, pnl: 10 });
    const summary = computeDisciplineSummary([winner], 2)!;
    expect(summary.breaches).toBe(1);
    expect(summary.lossFromBreaches).toBe(0);

    const body = composeDisciplineDigest(summary);
    expect(body).not.toContain('lost');
    expect(body).toContain('1 trade(s) fell below');
  });

  it('returns the clean-week body when no breaches', () => {
    const summary = computeDisciplineSummary([makeEntry()], 2)!;
    expect(summary.breaches).toBe(0);

    const body = composeDisciplineDigest(summary);
    expect(body).toContain('Perfect week');
    expect(body).toContain('all 1 trades honoured');
  });
});

describe('resetWeeklyDisciplineThrottle', () => {
  it('clears the throttle window', async () => {
    await AsyncStorage.setItem(THROTTLE_KEY, String(Date.now()));
    await resetWeeklyDisciplineThrottle();
    expect(await AsyncStorage.getItem(THROTTLE_KEY)).toBeNull();
  });
});
