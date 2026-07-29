/**
 * ============================================================================
 * Toroloom — Period Tabs
 * ============================================================================
 *
 * Tab bar for selecting report period: Weekly / Monthly / Yearly.
 *
 * Props:
 *   periodType  — Currently selected period ('weekly' | 'monthly' | 'yearly')
 *   onSelect    — Callback fired when user taps a tab
 *
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import type { PeriodType } from '../utils/analytics/periodAnalytics';

// ──── Props ─────────────────────────────────────────────────────────────────

interface PeriodTabsProps {
  periodType: PeriodType;
  onSelect: (period: PeriodType) => void;
}

const PERIODS: PeriodType[] = ['weekly', 'monthly', 'yearly'];

// ──── Component ─────────────────────────────────────────────────────────────

export default function PeriodTabs({ periodType, onSelect }: PeriodTabsProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  return (
    <View style={styles.periodTabs}>
      {PERIODS.map(pt => (
        <TouchableOpacity
          key={pt}
          style={[styles.periodTab, periodType === pt && styles.periodTabActive]}
          onPress={() => onSelect(pt)}
          activeOpacity={0.7}
        >
          <Text style={[styles.periodTabText, periodType === pt && styles.periodTabTextActive]}>
            {pt === 'weekly' ? t('periodReport.weekly') :
             pt === 'monthly' ? t('periodReport.monthly') :
             t('periodReport.yearly')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  periodTabs: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  periodTab: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodTabActive: {
    backgroundColor: colors.primary + '18',
    borderColor: colors.primary,
  },
  periodTabText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  periodTabTextActive: {
    color: colors.primary,
    ...FONTS.semiBold,
  },
});
