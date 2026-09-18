/**
 * ============================================================================
 * Toroloom — Streak Rebuild Nudge Notification
 * ============================================================================
 *
 * Sends a one-shot local notification when the user is ONE clean trade away
 * from rebuilding their discipline streak — i.e. the current (most-recent
 * active) week has a breach, but the clean weeks before it formed a streak
 * of at least one week (computeBrokenStreak > 0).
 *
 * WHY computeBrokenStreak is the whole gate:
 * The R:R is measured per journaled trade. As soon as the user journals a
 * clean trade in the breached week, that trade becomes part of the most
 * recent active week — which turns the week clean and the broken streak
 * becomes an ordinary rebuilt streak (brokenStreak → 0, the widget's green
 * celebration fires instead). Until then the nudge condition keeps holding,
 * so a foreground check is all that's needed.
 *
 * Delivery mirrors weeklyDisciplineNotification.ts: a foreground AppState
 * check in useNotificationSetup with a 7-day AsyncStorage throttle — the
 * nudge can fire at most once per 7 days, and the throttle is written only
 * after a successful send.
 *
 * The notification deep-links to the Behavioral Journal so the user can act
 * immediately (journal the trade that will rebuild the streak).
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { log } from '../utils/logger';
import { useTradingPrefsStore } from '../store/tradingPrefsStore';
import { useBehaviorJournalStore } from '../store/behavioralJournalStore';
import { useNotificationStore } from '../store/notificationStore';
import { computeBrokenStreak } from '../utils/analytics/disciplineAnalytics';

const THROTTLE_KEY = 'toroloom_streak_rebuild_nudge_last_sent';
const THROTTLE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check whether the user is one clean trade away from rebuilding their
 * streak, and if so send the nudge. Returns the notification id when sent,
 * null otherwise.
 *
 * Skipped (no send, no throttle update) when:
 *   - the store's weeklyDisciplineReport preference is off (one discipline
 *     switch governs both the weekly digest and this nudge)
 *   - no committed R:R ratio (no commitment = no streak to rebuild)
 *   - there is no broken streak to rebuild (nothing broke, or the streak
 *     was never alive)
 *   - the last nudge was sent less than 7 days ago
 */
export async function maybeSendStreakRebuildNudge(): Promise<string | null> {
  try {
    // 1. User preference gate — shared with the weekly digest
    const prefsEnabled = useNotificationStore.getState().preferences.weeklyDisciplineReport;
    if (!prefsEnabled) return null;

    // 2. Throttle gate — at most one nudge per 7 days
    const lastSent = await AsyncStorage.getItem(THROTTLE_KEY);
    if (lastSent) {
      const elapsed = Date.now() - Number(lastSent);
      if (Number.isFinite(elapsed) && elapsed < THROTTLE_MS) return null;
    }

    // 3. Data gates — commitment + a broken streak alive before the current week
    const committedRatio = useTradingPrefsStore.getState().rewardRiskRatio;
    if (!committedRatio) return null;

    const entries = useBehaviorJournalStore.getState().entries;
    const brokenStreak = computeBrokenStreak(entries, committedRatio);
    if (brokenStreak <= 0) return null;

    // 4. Compose + deliver through the store (respects addNotification prefs path)
    const title = i18n.t('notifications.streakRebuildTitle');
    const body = i18n.t('notifications.streakRebuildBody', { weeks: brokenStreak });
    const id = await useNotificationStore.getState().addNotification({
      id: `srn_${Date.now()}`,
      type: 'system',
      title,
      message: body,
      read: false,
      timestamp: new Date().toISOString(),
      // Deep link: the journal is where the user journals the rebuild trade.
      data: {
        screen: 'BehavioralJournal',
        brokenStreakWeeks: brokenStreak,
      },
    });

    // 5. Mark the throttle only after a successful send
    await AsyncStorage.setItem(THROTTLE_KEY, String(Date.now()));
    log.info('[StreakRebuildNudge] Nudge sent:', { brokenStreakWeeks: brokenStreak });
    return id ?? `srn_${Date.now()}`;
  } catch (err) {
    log.warn('[StreakRebuildNudge] Failed to evaluate rebuild nudge', err);
    return null;
  }
}

/** For testing — clears the 7-day throttle window. */
export async function resetStreakRebuildNudgeThrottle(): Promise<void> {
  await AsyncStorage.removeItem(THROTTLE_KEY);
}
