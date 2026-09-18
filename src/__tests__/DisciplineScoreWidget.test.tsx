/**
 * ============================================================================
 * Toroloom — DisciplineScoreWidget Component Tests
 * ============================================================================
 *
 * Covers all widget states:
 *   1. No committed ratio → commit prompt
 *   2. No measurable trades → planned-stop explainer
 *   3. Healthy score → ring number, grade label, all-clean line, report link
 *   4. Breaches → breach count line in danger colour
 *   5. Thin sample → low-sample caution note
 *   6. onPress → tappable report link
 *   7. Streak decay: broken episode → red chip, stepped countdown, one-shot
 *      toast; no replay on same episode; nothing fires on clean weeks.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from './testUtils';
import DisciplineScoreWidget from '../components/journal/DisciplineScoreWidget';
import type { DisciplineScore, DisciplineSummary } from '../utils/analytics/disciplineAnalytics';
import { triggerHaptic, ImpactFeedbackStyle } from '../utils/haptics';

vi.mock('../utils/haptics', () => ({
  triggerHaptic: vi.fn(),
  ImpactFeedbackStyle: { Heavy: 'heavy', Light: 'light', Medium: 'medium' },
}));

vi.mock('react-native-reanimated', () => ({
  default: ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <div style={style as any}>{children}</div>
  ),
  useSharedValue: () => ({ value: 0 }),
  useAnimatedStyle: () => ({}),
  withSequence: () => {},
  withTiming: () => {},
  withDelay: () => {},
  interpolate: () => 0,
}));

// ── Mock Theme ──────────────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', danger: '#FF5252', warning: '#FFAB40',
      marketUp: '#00E676', success: '#00E676',
      text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      bgCard: '#111827', border: '#1F2937',
    },
  }),
}));

// ── Mock useT ───────────────────────────────────────────────
const journalMap: Record<string, string> = {
  'journal.disciplineScoreTitle': 'R:R Discipline Score',
  'journal.disciplineScoreNoCommitment': 'No R:R commitment yet — choose a ratio when connecting your broker to unlock discipline tracking.',
  'journal.disciplineScoreNoData': 'Journal trades with a planned stop-loss to build your discipline score.',
  'journal.disciplineScoreMeasured': '{{count}} trades measured',
  'journal.disciplineScoreBreaches': '{{count}} below your commitment',
  'journal.disciplineScoreAllClean': 'Every trade honoured your commitment',
  'journal.disciplineScoreSeeReport': 'See full report',
  'journal.disciplineScoreThinSample': 'Fewer than 3 measured trades — score will sharpen as you journal more.',
  'journal.disciplineGrade_excellent': 'Excellent',
  'journal.disciplineGrade_good': 'Good',
  'journal.disciplineGrade_fair': 'Fair',
  'journal.disciplineGrade_poor': 'Poor',
  'journal.disciplineScoreStreak': '{{weeks}}-week clean streak',
  'journal.disciplineScoreStreakChip': '{{weeks}}-week streak 🔥',
  'journal.disciplineStreakBroken': 'Streak broken — {{weeks}} clean week(s) ended this week.',
  'journal.disciplineStreakRebuilt': 'Streak rebuilt — a clean week starts a new chain. Keep it burning.',
};

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      let text = journalMap[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return text;
    },
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

// ── Fixtures ────────────────────────────────────────────────

const cleanSummary: DisciplineSummary = {
  measured: 10, breaches: 0, breachRate: 0, avgRealizedRR: 2.4,
  lossFromBreaches: 0, flagged: [],
};

const breachSummary: DisciplineSummary = {
  measured: 10, breaches: 2, breachRate: 0.2, avgRealizedRR: 1.8,
  lossFromBreaches: -1600, flagged: [],
};

function makeScore(overrides: Partial<DisciplineScore> = {}): DisciplineScore {
  return { score: 100, grade: 'excellent', measured: 10, ...overrides };
}

/** Haptic call count so far — lets tests scope assertions without global resets. */
function hapticCallCount(): number {
  return (triggerHaptic as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
}

// ──── Tests ─────────────────────────────────────────────────

describe('DisciplineScoreWidget', () => {
  it('prompts to commit when no ratio is committed', () => {
    const { getByText, queryByTestId } = render(
      <DisciplineScoreWidget score={makeScore({ measured: 0 })} summary={cleanSummary} committedRatio={null} />,
    );
    expect(getByText('R:R Discipline Score')).toBeDefined();
    expect(getByText('No R:R commitment yet — choose a ratio when connecting your broker to unlock discipline tracking.')).toBeDefined();
    expect(queryByTestId('discipline-score-widget')).toBeNull();
  });

  it('explains the planned-stop requirement when nothing is measurable', () => {
    const { getByText, queryByTestId } = render(
      <DisciplineScoreWidget score={makeScore({ score: 0, grade: 'poor', measured: 0 })} summary={cleanSummary} committedRatio={2} />,
    );
    expect(getByText('Journal trades with a planned stop-loss to build your discipline score.')).toBeDefined();
    expect(queryByTestId('discipline-score-widget')).toBeNull();
  });

  it('shows the score, grade and all-clean line for a healthy record', () => {
    const { getByTestId, getByText } = render(
      <DisciplineScoreWidget score={makeScore()} summary={cleanSummary} committedRatio={2} />,
    );
    expect(getByTestId('discipline-score-widget')).toBeDefined();
    expect(getByText('100')).toBeDefined();
    expect(getByText('Excellent')).toBeDefined();
    expect(getByText('10 trades measured')).toBeDefined();
    expect(getByText('Every trade honoured your commitment')).toBeDefined();
  });

  it('shows the breach count line when trades fell below the commitment', () => {
    const { getByText } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 80, grade: 'good' })}
        summary={breachSummary}
        committedRatio={2}
      />,
    );
    expect(getByText('80')).toBeDefined();
    expect(getByText('Good')).toBeDefined();
    expect(getByText('2 below your commitment')).toBeDefined();
  });

  it('shows the low-sample caution for fewer than 3 measured trades', () => {
    const { getByText } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'good', measured: 2 })}
        summary={{ ...cleanSummary, measured: 2 }}
        committedRatio={2}
      />,
    );
    expect(getByText('Fewer than 3 measured trades — score will sharpen as you journal more.')).toBeDefined();
    expect(getByText('2 trades measured')).toBeDefined();
  });

  it('renders the report link only when onPress is provided and fires it on tap', () => {
    const onPress = vi.fn();
    const withLink = render(
      <DisciplineScoreWidget score={makeScore()} summary={cleanSummary} committedRatio={2} onPress={onPress} />,
    );
    expect(withLink.getByText('See full report')).toBeDefined();

    const withoutLink = render(
      <DisciplineScoreWidget score={makeScore()} summary={cleanSummary} committedRatio={2} />,
    );
    expect(withoutLink.queryByText('See full report')).toBeNull();

    fireEvent.press(withLink.getByText('See full report'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the clean-week streak count when positive', () => {
    const { getByText, queryByText } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 6 })}
        summary={{ ...cleanSummary, measured: 6, breaches: 0 }}
        committedRatio={2}
        streakWeeks={3}
      />,
    );
    expect(getByText('3-week clean streak')).toBeDefined();
    expect(getByText('Every trade honoured your commitment')).toBeDefined();
    // Streak chip only renders when streak >= 2
    expect(getByText('3-week streak 🔥')).toBeDefined();
    expect(queryByText('2-week streak 🔥')).toBeNull();
  });

  it('hides the streak when it is zero', () => {
    const { queryByText } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 6 })}
        summary={{ ...cleanSummary, measured: 6, breaches: 0 }}
        committedRatio={2}
        streakWeeks={0}
      />,
    );
    expect(queryByText('0-week clean streak')).toBeNull();
  });

  // ── Streak decay ─────────────────────────────────────────

  it('plays the decay moment once: heavy haptic, red chip, one-shot toast', () => {
    const callsBefore = hapticCallCount();
    const { getByText, getByTestId, unmount } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 6 })}
        summary={{ ...cleanSummary, measured: 6, breaches: 1 }}
        committedRatio={2}
        streakWeeks={0}          // pure streak is 0 — the current week broke it
        brokenStreakWeeks={3}    // but 3 clean weeks were alive before
      />,
    );
    // Decay starts from the broken streak, so the chip shows it immediately.
    expect(getByText('3-week streak 🔥')).toBeDefined();
    // One-shot toast explains what happened.
    expect(getByTestId('streak-decay-toast')).toBeDefined();
    expect(getByText('Streak broken — 3 clean week(s) ended this week.')).toBeDefined();
    // Heavy haptic fired exactly once for the episode start.
    expect(hapticCallCount()).toBe(callsBefore + 1);
    expect(triggerHaptic).toHaveBeenLastCalledWith(ImpactFeedbackStyle.Heavy);
    unmount();
  });

  it('does not fire the decay moment when nothing broke (brokenStreakWeeks = 0)', () => {
    const callsBefore = hapticCallCount();
    const { queryByTestId, unmount } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 6 })}
        summary={{ ...cleanSummary, measured: 6, breaches: 0 }}
        committedRatio={2}
        streakWeeks={3}
        brokenStreakWeeks={0}
      />,
    );
    expect(queryByTestId('streak-decay-toast')).toBeNull();
    expect(hapticCallCount()).toBe(callsBefore);
    unmount();
  });

  it('does not fire the decay moment when no commitment exists', () => {
    const callsBefore = hapticCallCount();
    const { queryByTestId, unmount } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 6 })}
        summary={{ ...cleanSummary, measured: 6, breaches: 1 }}
        committedRatio={null}
        streakWeeks={3}
        brokenStreakWeeks={3}
      />,
    );
    // No commitment → widget renders its commit prompt (no score card, no toast).
    expect(queryByTestId('streak-decay-toast')).toBeNull();
    expect(hapticCallCount()).toBe(callsBefore);
    unmount();
  });

  it('decrements the chip count step-by-step, then hides chip and toast', () => {
    vi.useFakeTimers();
    try {
      const { getByText, queryByText, queryByTestId, unmount } = render(
        <DisciplineScoreWidget
          score={makeScore({ score: 100, grade: 'excellent', measured: 6 })}
          summary={{ ...cleanSummary, measured: 6, breaches: 1 }}
          committedRatio={2}
          streakWeeks={0}
          brokenStreakWeeks={3}
        />,
      );
      expect(getByText('3-week streak 🔥')).toBeDefined();

      act(() => { vi.advanceTimersByTime(700); });
      expect(getByText('2-week streak 🔥')).toBeDefined();

      act(() => { vi.advanceTimersByTime(700); });
      expect(getByText('1-week streak 🔥')).toBeDefined();

      act(() => { vi.advanceTimersByTime(700); });
      // Streak hit 0 — chip hidden (only renders at >= 2), toast still up.
      expect(queryByTestId('streak-chip')).toBeNull();
      expect(queryByText('Streak broken — 3 clean week(s) ended this week.')).toBeDefined();

      act(() => { vi.advanceTimersByTime(1200); });
      // One-shot toast auto-dismissed.
      expect(queryByTestId('streak-decay-toast')).toBeNull();
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not replay the decay when re-rendered with the same broken episode', () => {
    const callsBefore = hapticCallCount();
    const first = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 6 })}
        summary={{ ...cleanSummary, measured: 6, breaches: 1 }}
        committedRatio={2}
        streakWeeks={0}
        brokenStreakWeeks={3}
      />,
    );
    const callsAfterFirst = hapticCallCount();
    expect(callsAfterFirst).toBe(callsBefore + 1);

    // Same episode → no new haptic, toast persists (not re-triggered).
    first.update(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 6 })}
        summary={{ ...cleanSummary, measured: 6, breaches: 1 }}
        committedRatio={2}
        streakWeeks={0}
        brokenStreakWeeks={3}
      />,
    );
    expect(hapticCallCount()).toBe(callsAfterFirst);
    first.unmount();
  });

  // ── Streak rebuild celebration ───────────────────────────

  it('celebrates the rebuild: green chip at streak 1, one-shot success toast, medium haptic', () => {
    const callsBefore = hapticCallCount();
    const { getByText, getByTestId, unmount } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 3 })}
        summary={{ ...cleanSummary, measured: 3, breaches: 0 }}
        committedRatio={2}
        streakWeeks={1}        // the rebuilt week starts a new chain of 1
        rebuiltWeek={true}
      />,
    );
    // Celebration keeps the chip visible even at streak 1 (normally >= 2).
    expect(getByText('1-week streak 🔥')).toBeDefined();
    // One-shot success toast.
    expect(getByTestId('streak-rebuilt-toast')).toBeDefined();
    expect(getByText('Streak rebuilt — a clean week starts a new chain. Keep it burning.')).toBeDefined();
    // Medium haptic fired exactly once for the celebration start.
    expect(hapticCallCount()).toBe(callsBefore + 1);
    expect(triggerHaptic).toHaveBeenLastCalledWith(ImpactFeedbackStyle.Medium);
    unmount();
  });

  it('does not celebrate when rebuiltWeek is false', () => {
    const callsBefore = hapticCallCount();
    const { queryByTestId, queryByText, unmount } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 6 })}
        summary={{ ...cleanSummary, measured: 6, breaches: 0 }}
        committedRatio={2}
        streakWeeks={1}
        rebuiltWeek={false}
      />,
    );
    expect(queryByTestId('streak-rebuilt-toast')).toBeNull();
    expect(queryByText('Streak rebuilt — a clean week starts a new chain. Keep it burning.')).toBeNull();
    expect(hapticCallCount()).toBe(callsBefore);
    unmount();
  });

  it('does not celebrate when no commitment exists', () => {
    const callsBefore = hapticCallCount();
    const { queryByTestId, unmount } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 6 })}
        summary={{ ...cleanSummary, measured: 6, breaches: 0 }}
        committedRatio={null}
        streakWeeks={1}
        rebuiltWeek={true}
      />,
    );
    // No commitment → commit prompt renders; no celebration anywhere.
    expect(queryByTestId('streak-rebuilt-toast')).toBeNull();
    expect(hapticCallCount()).toBe(callsBefore);
    unmount();
  });

  it('does not replay the celebration on re-render with the same rebuilt moment', () => {
    const callsBefore = hapticCallCount();
    const first = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 3 })}
        summary={{ ...cleanSummary, measured: 3, breaches: 0 }}
        committedRatio={2}
        streakWeeks={1}
        rebuiltWeek={true}
      />,
    );
    const callsAfterFirst = hapticCallCount();
    expect(callsAfterFirst).toBe(callsBefore + 1);

    first.update(
      <DisciplineScoreWidget
        score={makeScore({ score: 100, grade: 'excellent', measured: 3 })}
        summary={{ ...cleanSummary, measured: 3, breaches: 0 }}
        committedRatio={2}
        streakWeeks={1}
        rebuiltWeek={true}
      />,
    );
    expect(hapticCallCount()).toBe(callsAfterFirst);
    first.unmount();
  });

  it('celebration ends after the pulse beats: chip returns to normal visibility rules', () => {
    vi.useFakeTimers();
    try {
      const { getByText, queryByTestId, unmount } = render(
        <DisciplineScoreWidget
          score={makeScore({ score: 100, grade: 'excellent', measured: 3 })}
          summary={{ ...cleanSummary, measured: 3, breaches: 0 }}
          committedRatio={2}
          streakWeeks={1}
          rebuiltWeek={true}
        />,
      );
      expect(getByText('1-week streak 🔥')).toBeDefined();

      // After the 3 pulse beats the celebration emphasis ends; a streak of 1
      // no longer satisfies the ordinary (>= 2) chip visibility rule.
      act(() => { vi.advanceTimersByTime(3 * 450 + 50); });
      expect(queryByTestId('streak-chip')).toBeNull();
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('decay and celebration are mutually exclusive: a broken week does not celebrate', () => {
    const callsBefore = hapticCallCount();
    const { queryByTestId, unmount } = render(
      <DisciplineScoreWidget
        score={makeScore({ score: 80, grade: 'good', measured: 6 })}
        summary={{ ...cleanSummary, measured: 6, breaches: 1 }}
        committedRatio={2}
        streakWeeks={0}
        brokenStreakWeeks={3}
        rebuiltWeek={false}
      />,
    );
    expect(queryByTestId('streak-decay-toast')).toBeDefined();
    expect(queryByTestId('streak-rebuilt-toast')).toBeNull();
    expect(hapticCallCount()).toBe(callsBefore + 1); // only the decay heavy haptic
    unmount();
  });
});
