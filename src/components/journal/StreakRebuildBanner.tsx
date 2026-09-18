/**
 * ============================================================================
 * Toroloom — Streak Rebuild Banner (Journal Dashboard)
 * ============================================================================
 *
 * A subtle, non-alarming banner shown on the journal dashboard while the
 * user's discipline streak is broken (brokenStreakWeeks > 0): the streak
 * that was alive before the current week's breach. It tells the user they
 * are one clean trade away from rebuilding — mirroring the push nudge
 * (streakRebuildNudge.ts) but in-context, where they journal trades.
 *
 * Dismissal: tapping "Maybe later" hides the banner for THE REST OF THE DAY
 * (a date string is persisted to AsyncStorage). Tomorrow — or any later day
 * — the banner reappears while the streak is still broken, so the gentle
 * reminder returns daily rather than nagging within the day.
 *
 * The banner renders nothing when the streak is intact (brokenStreakWeeks
 * <= 0) — the green celebration in DisciplineScoreWidget tells that story.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useT } from '../../hooks/useT';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

const DISMISS_KEY = 'toroloom_streak_rebuild_banner_dismissed_on';

/** Today as a local YYYY-MM-DD string — the dismissal granularity. */
function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface StreakRebuildBannerProps {
  /** Streak alive before the current week broke it (0 = nothing broke). */
  brokenStreakWeeks?: number;
  /**
   * Tap target for the title link — opens the journal entry modal
   * pre-filled from the last closed trade (one-tap rebuild flow).
   */
  onTitlePress?: () => void;
}

export default function StreakRebuildBanner({ brokenStreakWeeks, onTitlePress }: StreakRebuildBannerProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = createStyles();

  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(DISMISS_KEY).then(dismissedOn => {
      if (!mounted) return;
      setDismissed(dismissedOn === todayKey());
      setReady(true);
    }).catch(() => {
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  // Don't flash the banner before the stored dismissal is known.
  if (!ready || !brokenStreakWeeks || brokenStreakWeeks <= 0 || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, todayKey()).catch(() => {
      // Persistence failed — dismissal still holds for this session.
    });
  };

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      testID="streak-rebuild-banner"
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.warning + '20' }]}>
        <Ionicons name="flame-outline" size={16} color={colors.warning} />
      </View>
      <View style={styles.textWrap}>
        <Pressable
          onPress={onTitlePress}
          disabled={!onTitlePress}
          hitSlop={6}
          accessibilityRole={onTitlePress ? 'link' : 'text'}
          accessibilityLabel={t('journal.streakRebuildBannerTitle')}
          testID="streak-rebuild-banner-title"
          style={styles.titleLink}
        >
          <Text style={[styles.title, { color: onTitlePress ? colors.primary : colors.text }]}>
            {t('journal.streakRebuildBannerTitle')}
          </Text>
          {onTitlePress && (
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          )}
        </Pressable>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {t('journal.streakRebuildBannerBody', { weeks: brokenStreakWeeks })}
        </Text>
      </View>
      <Pressable
        onPress={handleDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('journal.streakRebuildBannerDismiss')}
        style={styles.dismissButton}
      >
        <Text style={[styles.dismissText, { color: colors.textMuted }]}>
          {t('journal.streakRebuildBannerDismiss')}
        </Text>
      </Pressable>
    </View>
  );
}

// ──── Styles ────────────────────────────────────────────────────────────────

const createStyles = () => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 1 },
  titleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  title: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  body: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16 },
  dismissButton: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  dismissText: { ...FONTS.medium, fontSize: FONTS.size.xs },
});
