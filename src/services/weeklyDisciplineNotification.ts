/**
 * ============================================================================
 * Toroloom — Weekly Discipline Notification
 * ============================================================================
 *
 * Sends a weekly local notification summarizing the user's R:R discipline:
 *   - how many trades fell below their committed reward:risk ratio
 *   - the discipline score (0-100)
 *   - ₹ lost to below-commitment trades (when any)
 *
 * WHY a foreground check instead of a native weekly trigger:
 * The digest content (breach count, score) depends on journal data that does
 * not exist a week ahead, so pre-scheduling would freeze stale numbers.
 * Instead the hook below re-checks whenever the app comes to the foreground,
 * with a 7-day AsyncStorage throttle so the user gets AT MOST one digest
 * per week — sent on the first foreground after the new week starts.
 *
 * Mirrors evaluatePortfolioAlertsInBackground() in notificationService.ts.
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { log } from '../utils/logger';
import { useTradingPrefsStore } from '../store/tradingPrefsStore';
import { useBehaviorJournalStore } from '../store/behavioralJournalStore';
import { useNotificationStore } from '../store/notificationStore';
import {
  computeDisciplineSummary,
  computeDisciplineScore,
  DisciplineSummary,
} from '../utils/analytics/disciplineAnalytics';
import { JournalEntry } from '../types';

const THROTTLE_KEY = 'toroloom_weekly_discipline_last_sent';
const THROTTLE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Compose the localized digest body from the computed summary. */
export function composeDisciplineDigest(summary: DisciplineSummary): string {
  const score = computeDisciplineScore(summary);
  const t = i18n.t.bind(i18n);

  if (summary.breaches === 0) {
    return t('notifications.weeklyDisciplineBodyClean', {
      score: score.score,
      measured: summary.measured,
    });
  }

  if (summary.lossFromBreaches < 0) {
    return t('notifications.weeklyDisciplineBodyLoss', {
      breaches: summary.breaches,
      score: score.score,
      loss: Math.abs(summary.lossFromBreaches).toLocaleString('en-IN'),
    });
  }

  return t('notifications.weeklyDisciplineBody', {
    breaches: summary.breaches,
    score: score.score,
  });
}

/**
 * Check whether a weekly discipline digest is due, and if so compose + send it.
 * Returns the notification id when sent, null otherwise.
 *
 * Skipped (no send, no throttle update) when:
 *   - the store already disabled weeklyDisciplineReport
 *   - no committed R:R ratio (no commitment = nothing to be disciplined about)
 *   - no measurable trades this week
 *   - the last digest was sent less than 7 days ago
 */
export async function maybeSendWeeklyDisciplineNotification(): Promise<string | null> {
  try {
    // 1. User preference gate
    const prefsEnabled = useNotificationStore.getState().preferences.weeklyDisciplineReport;
    if (!prefsEnabled) return null;

    // 2. Throttle gate — at most one digest per 7 days
    const lastSent = await AsyncStorage.getItem(THROTTLE_KEY);
    if (lastSent) {
      const elapsed = Date.now() - Number(lastSent);
      if (Number.isFinite(elapsed) && elapsed < THROTTLE_MS) return null;
    }

    // 3. Data gates — commitment + measurable trades
    const committedRatio = useTradingPrefsStore.getState().rewardRiskRatio;
    if (!committedRatio) return null;

    const entries = useBehaviorJournalStore.getState().entries;
    const weekAgo = Date.now() - THROTTLE_MS;
    const weekEntries = entries.filter((e: JournalEntry) => {
      const ts = new Date(e.date).getTime();
      return Number.isFinite(ts) && ts >= weekAgo;
    });
    const summary = computeDisciplineSummary(weekEntries, committedRatio);
    if (!summary || summary.measured === 0) return null;

    // 4. Compose + deliver through the store (respects addNotification prefs path)
    const title = i18n.t('notifications.weeklyDisciplineTitle', { ratio: committedRatio });
    const body = composeDisciplineDigest(summary);
    const id = await useNotificationStore.getState().addNotification({
      id: `wdn_${Date.now()}`,
      type: 'system',
      title,
      message: body,
      read: false,
      timestamp: new Date().toISOString(),
      // Pass the exact weekly window the digest summarized so a tap can pin
      // the PeriodReport to that same window.
      data: {
        screen: 'PeriodReport',
        breaches: summary.breaches,
        score: computeDisciplineScore(summary).score,
        startDate: new Date(Date.now() - THROTTLE_MS).toISOString(),
      },
    });

    // 5. Mark the throttle only after a successful send
    await AsyncStorage.setItem(THROTTLE_KEY, String(Date.now()));
    log.info('[WeeklyDiscipline] Digest sent:', { breaches: summary.breaches });
    return id ?? `wdn_${Date.now()}`;
  } catch (err) {
    log.warn('[WeeklyDiscipline] Failed to evaluate weekly digest', err);
    return null;
  }
}

/** For testing — clears the 7-day throttle window. */
export async function resetWeeklyDisciplineThrottle(): Promise<void> {
  await AsyncStorage.removeItem(THROTTLE_KEY);
}
