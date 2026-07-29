/**
 * ============================================================================
 * Toroloom — Detailed Metrics Card
 * ============================================================================
 *
 * 2×2 grid showing key portfolio metrics:
 *   - Avg Win / Avg Loss
 *   - Profit Factor / Avg Holding Days
 *
 * Color coding:
 *   - Avg Win → marketUp (green)
 *   - Avg Loss → marketDown (red)
 *   - Profit Factor ≥2 → marketUp, ≥1 → warning, <1 → marketDown
 *
 * Always renders (no empty state — parent controls visibility).
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';
import Card from './ui/Card';

const { width } = Dimensions.get('window');

// ──── Props ─────────────────────────────────────────────────────────────────

interface DetailedMetricsCardProps {
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgHoldingDays: number;
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function DetailedMetricsCard({
  avgWin,
  avgLoss,
  profitFactor,
  avgHoldingDays,
}: DetailedMetricsCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  const pfColor =
    profitFactor >= 2
      ? colors.marketUp
      : profitFactor >= 1
        ? colors.warning
        : colors.marketDown;

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(400)}>
      <Card title={t('periodReport.avgWin')}>
        <View style={styles.metricsGrid}>
          {/* Avg Win */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('periodReport.avgWin')}</Text>
            <Text style={[styles.metricValue, { color: colors.marketUp }]}>
              {formatCurrency(avgWin, true)}
            </Text>
          </View>

          {/* Avg Loss */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('periodReport.avgLoss')}</Text>
            <Text style={[styles.metricValue, { color: colors.marketDown }]}>
              {formatCurrency(avgLoss, true)}
            </Text>
          </View>

          {/* Profit Factor */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('periodReport.profitFactor')}</Text>
            <Text style={[styles.metricValue, { color: pfColor }]}>
              {profitFactor.toFixed(2)}
            </Text>
          </View>

          {/* Avg Holding Days */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('periodReport.avgHoldingDays')}</Text>
            <Text style={styles.metricValue}>{avgHoldingDays}d</Text>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  metricItem: {
    width: (width - SPACING.xl * 2 - SPACING.lg * 2 - SPACING.md) / 2,
    paddingVertical: SPACING.sm,
  },
  metricLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  metricValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginTop: 2,
  },
});
