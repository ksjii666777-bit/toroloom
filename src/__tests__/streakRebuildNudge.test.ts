/**
 * ============================================================================
 * Toroloom — Streak Rebuild Nudge Notification Tests
 * ============================================================================
 *
 * Tests the nudge service with REAL stores, REAL discipline analytics, REAL
 * i18n and the mocked AsyncStorage from setup.ts:
 *   - sends when a broken streak exists (one clean trade away from rebuild)
 *   - the four skip gates (preference off, no commitment, no broken streak,
 *     7-day throttle not elapsed)
 *   - deep-link payload (BehavioralJournal) + brokenStreakWeeks in data
 *   - throttle write happens only on a successful send
 *   - recovery semantics: a journaled clean trade in the breached week turns
 *     the week clean → brokenStreak drops to 0 → no more nudge
 *
 * NOTE: the notification store seeds mock notifications, so all assertions
 * scope to the nudge via its `srn_` id prefix rather than absolute counts.
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
  maybeSendStreakRebuildNudge,
  resetStreakRebuildNudgeThrottle,
} from '../services/streakRebuildNudge';
import { useNotificationStore } from '../store/notificationStore';
import { useTradingPrefsStore } from '../store/tradingPrefsStore';
import { useBehaviorJournalStore } from '../store/behavioralJournalStore';
import { JournalEntry } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const THROTTLE_KEY = 'toroloom_streak_rebuild_nudge_last_sent';

// ==================== Fixtures ====================

/**
 * Clean trade: realizes 1:3 against the committed 1:2 —
 * entry 100, stop 98 (risk ₹2/unit), exit 106 (gain ₹6/unit) → RR 3.0.
 */
function makeClean(over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'c1',
    date: new Date().toISOString(),
    symbol: 'TCS',
    direction: 'long',
    entryPrice: 100,
    exitPrice: 106,
    quantity: 10,
    pnl: 60,
    pnlPercent: 6,
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

/** Breaching trade: risk ₹2/unit, cut early at ₹1/unit gain → RR 0.5 ≪ 1:2. */
function makeBreach(over: Partial<JournalEntry> = {}): JournalEntry {
  return makeClean({
    exitPrice: 101,
    pnl: 10,
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

function getNudge() {
  return useNotificationStore.getState().notifications.find(n => n.id.startsWith('srn_'));
}

// ==================== Tests ====================

describe('streakRebuildNudge — delivery', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();
    // Zustand module state persists across tests in this file — clear the
    // notification list so `srn_`-nudge lookups see only THIS test's send.
    useNotificationStore.setState({ notifications: [], scheduledIds: {} } as any);
    resetStores();
  });

  it('sends the nudge when the user is one clean trade away from rebuilding', async () => {
    // W-1 clean (1-week streak alive), current week breached → brokenStreak = 1.
    resetStores({
      entries: [
        makeClean({ id: 'c_w1', date: new Date(Date.now() - 7 * DAY_MS).toISOString() }),
        makeBreach({ id: 'b_w0', date: new Date().toISOString() }),
      ],
    });

    const id = await maybeSendStreakRebuildNudge();

    expect(id).not.toBeNull();
    const sent = getNudge();
    expect(sent).toBeDefined();
    expect(sent!.type).toBe('system');
    expect(sent!.title).toContain('One clean trade');
    expect(sent!.message).toContain('1-week clean streak');
    // Deep links to the journal
    expect((sent!.data as any).screen).toBe('BehavioralJournal');
    expect((sent!.data as any).brokenStreakWeeks).toBe(1);

    // Throttle written after send
    const lastSent = await AsyncStorage.getItem(THROTTLE_KEY);
    expect(lastSent).not.toBeNull();
    expect(Number(lastSent)).toBeGreaterThan(0);
  });

  it('mentions the full broken streak length in the body', async () => {
    // Three clean weeks then the breach → brokenStreak = 3.
    resetStores({
      entries: [
        makeClean({ id: 'c_w3', date: new Date(Date.now() - 21 * DAY_MS).toISOString() }),
        makeClean({ id: 'c_w2', date: new Date(Date.now() - 14 * DAY_MS).toISOString() }),
        makeClean({ id: 'c_w1', date: new Date(Date.now() - 7 * DAY_MS).toISOString() }),
        makeBreach({ id: 'b_w0', date: new Date().toISOString() }),
      ],
    });

    await maybeSendStreakRebuildNudge();

    const sent = getNudge();
    expect(sent).toBeDefined();
    expect((sent!.data as any).brokenStreakWeeks).toBe(3);
    expect(sent!.message).toContain('3-week clean streak');
  });

  it('does not nudge once the week after the breach is clean (streak rebuilt)', async () => {
    // Breach in the PREVIOUS ISO week (10 days ago), clean trades in the
    // CURRENT week → the most-recent active week is clean → rebuilt moment.
    // brokenStreak = 0, so there is nothing left to rebuild from.
    resetStores({
      entries: [
        makeBreach({ id: 'b_prev_week', date: new Date(Date.now() - 10 * DAY_MS).toISOString() }),
        makeClean({ id: 'c_today', date: new Date().toISOString() }),
      ],
    });

    const id = await maybeSendStreakRebuildNudge();

    expect(id).toBeNull();
    expect(getNudge()).toBeUndefined();
    // No throttle write on a skip
    expect(await AsyncStorage.getItem(THROTTLE_KEY)).toBeNull();
  });
});

describe('streakRebuildNudge — skip gates', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();
    // Zustand module state persists across tests in this file — clear the
    // notification list so `srn_`-nudge lookups see only THIS test's outcome.
    useNotificationStore.setState({ notifications: [], scheduledIds: {} } as any);
    resetStores({
      entries: [
        makeClean({ id: 'c_w1', date: new Date(Date.now() - 7 * DAY_MS).toISOString() }),
        makeBreach({ id: 'b_w0', date: new Date().toISOString() }),
      ],
    });
  });

  it('skips when the weeklyDisciplineReport preference is off', async () => {
    resetStores({ weeklyEnabled: false });

    const id = await maybeSendStreakRebuildNudge();

    expect(id).toBeNull();
    expect(getNudge()).toBeUndefined();
    expect(await AsyncStorage.getItem(THROTTLE_KEY)).toBeNull();
  });

  it('skips when no R:R ratio is committed', async () => {
    resetStores({ committed: null });

    const id = await maybeSendStreakRebuildNudge();

    expect(id).toBeNull();
    expect(getNudge()).toBeUndefined();
  });

  it('skips when there is no broken streak (current week clean)', async () => {
    resetStores({ entries: [makeClean()] });

    const id = await maybeSendStreakRebuildNudge();

    expect(id).toBeNull();
    expect(getNudge()).toBeUndefined();
  });

  it('skips when the streak was never alive (single breached week)', async () => {
    resetStores({ entries: [makeBreach()] });

    const id = await maybeSendStreakRebuildNudge();

    expect(id).toBeNull();
    expect(getNudge()).toBeUndefined();
  });

  it('skips when a nudge was sent less than 7 days ago', async () => {
    await AsyncStorage.setItem(THROTTLE_KEY, String(Date.now() - 2 * DAY_MS));

    const id = await maybeSendStreakRebuildNudge();

    expect(id).toBeNull();
    expect(getNudge()).toBeUndefined();
  });

  it('sends again once the 7-day window has elapsed', async () => {
    await AsyncStorage.setItem(THROTTLE_KEY, String(Date.now() - 8 * DAY_MS));

    const id = await maybeSendStreakRebuildNudge();

    expect(id).not.toBeNull();
    expect(getNudge()).toBeDefined();
  });
});

describe('resetStreakRebuildNudgeThrottle', () => {
  it('clears the throttle window', async () => {
    await AsyncStorage.setItem(THROTTLE_KEY, String(Date.now()));
    await resetStreakRebuildNudgeThrottle();
    expect(await AsyncStorage.getItem(THROTTLE_KEY)).toBeNull();
  });
});
