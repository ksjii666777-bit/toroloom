/**
 * ============================================================================
 * Toroloom — Empty Report State
 * ============================================================================
 *
 * Placeholder shown when the user has no trades or holdings yet.
 * Includes an analytics icon and helpful text.
 *
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS } from '../constants/theme';

// ──── Component ─────────────────────────────────────────────────────────────

export default function EmptyReportState() {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  return (
    <View style={styles.emptyState}>
      <Ionicons name="analytics-outline" size={64} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
        {t('periodReport.emptyTitle')}
      </Text>
      <Text style={[styles.emptySub, { color: colors.textMuted }]}>
        {t('periodReport.emptySubtitle')}
      </Text>
    </View>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (_colors: any) => StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.huge * 2,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    marginTop: SPACING.lg,
  },
  emptySub: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: SPACING.sm,
    textAlign: 'center',
    paddingHorizontal: SPACING.xxl,
  },
});
