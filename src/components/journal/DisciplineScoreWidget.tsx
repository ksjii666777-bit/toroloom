/**
 * ============================================================================
 * Toroloom — Discipline Score Widget (Journal Dashboard)
 * ============================================================================
 *
 * A dashboard card that condenses the user's R:R discipline into one 0-100
 * number with a colour-coded grade ring:
 *
 *   score = clean trades / measured trades × 100
 *
 * States:
 *   - No committed ratio       → prompt to commit
 *   - Measurable trades < 1    → explain the planned-stop requirement
 *   - Thin sample (< 3 trades) → score + low-sample caution
 *   - Normal                   → score ring + grade label + breach count
 *
 * Streak decay animation: when the parent reports a broken streak
 * (`brokenStreakWeeks` > 0 — clean weeks existed, but the current week has a
 * breach), the streak chip flashes red and its count steps down one per beat
 * (N → N-1 → … → 0) while a one-shot toast explains what happened. The
 * animation runs once per mount / per new broken-episode; a re-render with
 * the same episode does not replay it.
 *
 * Streak rebuild celebration (the mirror): when the parent reports
 * `rebuiltWeek` (the current week is the FIRST clean week after a break),
 * the chip pulses green with a light haptic per beat and a one-shot success
 * toast celebrates the rebuilt chain. Also plays once per break.
 *
 * ============================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { DisciplineScore, DisciplineSummary } from '../../utils/analytics/disciplineAnalytics';

// ──── Props ─────────────────────────────────────────────────────────────────

interface DisciplineScoreWidgetProps {
  score: DisciplineScore;
  summary: DisciplineSummary;
  committedRatio: number | null;
  /** Consecutive clean (no-breach) active weeks — shown in the meta area. */
  streakWeeks?: number;
  /**
   * Streak that was alive BEFORE the current week broke it (0 = nothing
   * broke). When > 0 the widget plays the decay animation once: chip flashes
   * red, count steps down brokenStreakWeeks → 0, one-shot toast appears.
   */
  brokenStreakWeeks?: number;
  /**
   * True when the current week is the FIRST clean week after a break — the
   * "streak rebuilt" moment. The widget plays a green celebration once:
   * chip pulses green, light haptics per beat, one-shot success toast.
   */
  rebuiltWeek?: boolean;
  onPress?: () => void;
}

/** How often the chip count ticks down during the decay (ms per step). */
const DECAY_STEP_MS = 700;
/** How long the chip stays red after the last decrement (ms). */
const FLASH_HOLD_MS = 900;
/** How long the one-shot toast stays visible (ms). */
const TOAST_MS = 3200;
/** Green pulse beat during the rebuild celebration (ms per pulse). */
const REBUILD_PULSE_MS = 450;
/** How long the rebuild celebration emphasis lasts (3 pulses). */
const REBUILD_CELEBRATION_MS = 3 * REBUILD_PULSE_MS;
/** How long the rebuild toast stays visible (ms). */
const REBUILD_TOAST_MS = 3200;

// ──── Component ─────────────────────────────────────────────────────────────

export default function DisciplineScoreWidget({
  score,
  summary,
  committedRatio,
  streakWeeks,
  brokenStreakWeeks,
  rebuiltWeek,
  onPress,
}: DisciplineScoreWidgetProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles();

  // ── Streak decay state ─────────────────────────────────────
  const [decayedStreak, setDecayedStreak] = useState<number | null>(null);
  const [chipFlashing, setChipFlashing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  // ── Streak rebuild celebration state ───────────────────────
  const [celebrating, setCelebrating] = useState(false);
  const [celebrationPulse, setCelebrationPulse] = useState(false);
  const [showRebuildToast, setShowRebuildToast] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Episode marker so re-renders with the SAME broken week don't replay. */
  const playedEpisodeRef = useRef<string | null>(null);
  /** Episode marker so the rebuild celebration plays once per break. */
  const playedRebuildRef = useRef<boolean>(false);

  useEffect(() => {
    // Clear any in-flight animation timers whenever inputs change.
    return () => {
      for (const timer of timersRef.current) clearTimeout(timer);
      timersRef.current = [];
    };
  }, [brokenStreakWeeks]);

  useEffect(() => {
    const prior = brokenStreakWeeks ?? 0;

    // Only a genuine broken episode (> 0) triggers the moment. The episode
    // marker uses the number of broken weeks so a new breach after recovery
    // (e.g. user trades badly again in a later week with a different prior
    // streak) replays the animation.
    if (prior <= 0 || committedRatio == null) {
      // Episode over — reset visual state for the next one.
      setDecayedStreak(null);
      setChipFlashing(false);
      setShowToast(false);
      playedEpisodeRef.current = null;
      return;
    }

    const episode = String(prior);
    if (playedEpisodeRef.current === episode) return; // already played
    playedEpisodeRef.current = episode;

    triggerHaptic(ImpactFeedbackStyle.Heavy);
    setChipFlashing(true);
    setDecayedStreak(prior);
    setShowToast(true);

    // Step the displayed count down one per beat: prior → prior-1 → … → 0.
    for (let step = 1; step <= prior; step++) {
      const target = prior - step;
      const at = step * DECAY_STEP_MS;
      timersRef.current.push(
        setTimeout(() => {
          setDecayedStreak(target);
          if (target > 0) triggerHaptic(ImpactFeedbackStyle.Light);
        }, at),
      );
    }

    // Chip stops flashing red after the last decrement + hold.
    timersRef.current.push(
      setTimeout(() => setChipFlashing(false), prior * DECAY_STEP_MS + FLASH_HOLD_MS),
    );
    // One-shot toast auto-dismisses.
    timersRef.current.push(
      setTimeout(() => setShowToast(false), TOAST_MS),
    );
  }, [brokenStreakWeeks, committedRatio]);

  useEffect(() => {
    // Celebration only for a genuine rebuilt moment with a commitment.
    if (!rebuiltWeek || committedRatio == null) {
      setCelebrating(false);
      setCelebrationPulse(false);
      setShowRebuildToast(false);
      playedRebuildRef.current = false;
      return;
    }

    if (playedRebuildRef.current) return; // already celebrated this break
    playedRebuildRef.current = true;

    triggerHaptic(ImpactFeedbackStyle.Medium);
    setCelebrating(true);
    setShowRebuildToast(true);

    // Green pulse beats: tint alternates solid ↔ soft, light haptic per beat.
    for (let beat = 1; beat <= 3; beat++) {
      timersRef.current.push(
        setTimeout(() => {
          setCelebrationPulse(beat % 2 === 1);
          triggerHaptic(ImpactFeedbackStyle.Light);
        }, beat * REBUILD_PULSE_MS),
      );
    }

    // Celebration emphasis ends after the last pulse.
    timersRef.current.push(
      setTimeout(() => {
        setCelebrating(false);
        setCelebrationPulse(false);
      }, REBUILD_CELEBRATION_MS),
    );
    // One-shot toast auto-dismisses.
    timersRef.current.push(
      setTimeout(() => setShowRebuildToast(false), REBUILD_TOAST_MS),
    );
  }, [rebuiltWeek, committedRatio, streakWeeks]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) clearTimeout(timer);
      timersRef.current = [];
    };
  }, []);

  const gradeColor =
    score.grade === 'excellent' ? colors.success :
    score.grade === 'good' ? colors.marketUp :
    score.grade === 'fair' ? colors.warning : colors.danger;

  // Streak is meaningful only when a commitment exists and at least one active week exists.
  const streakColor = (streakWeeks ?? 0) > 0 && committedRatio != null
    ? colors.success
    : colors.textMuted;

  // During the decay the chip is red; during the rebuild celebration it is
  // green; otherwise its normal colour.
  const streakChipTintColor = chipFlashing ? colors.danger : celebrating ? colors.marketUp : streakColor;

  // What the chip shows: the decaying count while the animation runs, else
  // the ordinary current streak.
  const chipStreak = decayedStreak ?? streakWeeks ?? 0;

  // ── No commitment yet ──────────────────────────────────────
  if (committedRatio == null) {
    return (
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Ionicons name="shield-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('journal.disciplineScoreTitle')}</Text>
        </View>
        <Text style={[styles.promptText, { color: colors.textMuted }]}>
          {t('journal.disciplineScoreNoCommitment')}
        </Text>
      </View>
    );
  }

  // ── No measurable trades ───────────────────────────────────
  if (score.measured === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Ionicons name="shield-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('journal.disciplineScoreTitle')}</Text>
        </View>
        <Text style={[styles.promptText, { color: colors.textMuted }]}>
          {t('journal.disciplineScoreNoData')}
        </Text>
      </View>
    );
  }

  const thinSample = score.measured < 3;

  // ── Score display ──────────────────────────────────────────
  return (
    <View
      style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      testID="discipline-score-widget"
    >
      <View style={styles.headerRow}>
        <Ionicons name="shield-checkmark" size={16} color={gradeColor} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('journal.disciplineScoreTitle')}</Text>
      </View>

      <View style={styles.scoreRow}>
        {/* Score ring (simplified circular bar) */}
        <View style={[styles.ring, { borderColor: colors.border }]}>
          <View style={[styles.ringFillWrap, { height: `${score.score}%` as any }]}>
            <View style={[styles.ringFill, { backgroundColor: gradeColor }]} />
          </View>
          <Text style={[styles.scoreNum, { color: gradeColor }]}>{score.score}</Text>
        </View>

        <View style={styles.scoreMeta}>
          <Text style={[styles.gradeLabel, { color: gradeColor }]}>
            {t(`journal.disciplineGrade_${score.grade}`)}
          </Text>
          <Text style={[styles.metaLine, { color: colors.textMuted }]}>
            {t('journal.disciplineScoreMeasured', { count: score.measured })}
          </Text>
          {summary.breaches > 0 && (
            <Text style={[styles.metaLine, { color: colors.danger }]}>
              {t('journal.disciplineScoreBreaches', { count: summary.breaches })}
            </Text>
          )}
          {summary.breaches === 0 && (
            <Text style={[styles.metaLine, { color: colors.success }]}>
              {t('journal.disciplineScoreAllClean')}
            </Text>
          )}
          {chipStreak > 0 && (
            <Text style={[styles.metaLine, { color: streakColor }]}>
              {t('journal.disciplineScoreStreak', { weeks: chipStreak })}
            </Text>
          )}

          {/* Chip shows at >= 2 normally; during decay it stays visible
              down to 1 so the user watches the count fall to zero; during
              the rebuild celebration it shows even at 1 to flourish. */}
          {(chipFlashing ? chipStreak > 0 : chipStreak >= 2 || celebrating) && (
            <View
              style={[
                styles.streakChip,
                { backgroundColor: streakChipTintColor + (celebrationPulse ? '32' : '18') },
                celebrating && { borderWidth: 1, borderColor: streakChipTintColor },
              ]}
              testID="streak-chip"
            >
              <Ionicons name={celebrating ? 'sparkles' : 'flame'} size={14} color={streakChipTintColor} />
              <Text style={[styles.streakChipText, { color: streakChipTintColor }]}>
                {t('journal.disciplineScoreStreakChip', { weeks: chipStreak })}
              </Text>
            </View>
          )}
          {onPress && (
            <Text style={[styles.reportLink, { color: colors.primary }]}>
              {t('journal.disciplineScoreSeeReport')} →
            </Text>
          )}
        </View>
      </View>

      {thinSample && (
        <Text style={[styles.thinNote, { color: colors.warning }]}>
          {t('journal.disciplineScoreThinSample')}
        </Text>
      )}

      {/* One-shot decay toast — appears when the streak just broke */}
      {showToast && (
        <View style={[styles.toast, { backgroundColor: colors.danger + '22', borderColor: colors.danger }]} testID="streak-decay-toast">
          <Ionicons name="trending-down" size={14} color={colors.danger} />
          <Text style={[styles.toastText, { color: colors.danger }]}>
            {t('journal.disciplineStreakBroken', { weeks: brokenStreakWeeks ?? 0 })}
          </Text>
        </View>
      )}

      {/* One-shot rebuild toast — first clean week after a break */}
      {showRebuildToast && (
        <View style={[styles.toast, { backgroundColor: colors.success + '22', borderColor: colors.success }]} testID="streak-rebuilt-toast">
          <Ionicons name="trending-up" size={14} color={colors.success} />
          <Text style={[styles.toastText, { color: colors.success }]}>
            {t('journal.disciplineStreakRebuilt')}
          </Text>
        </View>
      )}
    </View>
  );
}

// ──── Styles ────────────────────────────────────────────────────────────────

const createStyles = () => StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  cardTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  promptText: { ...FONTS.regular, fontSize: FONTS.size.sm, lineHeight: 19 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  ring: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  ringFillWrap: { justifyContent: 'flex-end' },
  ringFill: { flex: 1 },
  scoreNum: {
    ...FONTS.bold,
    fontSize: 22,
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
  },
  scoreMeta: { flex: 1, gap: 2 },
  gradeLabel: { ...FONTS.bold, fontSize: FONTS.size.lg },
  metaLine: { ...FONTS.regular, fontSize: FONTS.size.xs },
  reportLink: { ...FONTS.semiBold, fontSize: FONTS.size.xs, marginTop: 4 },
  thinNote: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: SPACING.md, fontStyle: 'italic' },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  streakChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  toastText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    flex: 1,
  },
});
