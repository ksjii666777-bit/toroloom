/**
 * ============================================================================
 * Toroloom — Portfolio Snapshot Card
 * ============================================================================
 *
 * Standalone card showing a quick P&L summary (total return, return %,
 * trade count, win rate, Sharpe ratio, max drawdown) with visual grid.
 *
 * Props:
 *   metrics  — PortfolioMetrics object from usePortfolioAnalyticsStore
 *
 * Always renders (no empty state — parent controls visibility).
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import { formatCurrency, formatPercent } from '../utils/formatters';

// ──── Types ─────────────────────────────────────────────────────────────────

export interface SnapshotMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdownPercent: number;
}

// ──── Props ─────────────────────────────────────────────────────────────────

interface PortfolioSnapshotCardProps {
  metrics: SnapshotMetrics;
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function PortfolioSnapshotCard({ metrics: m }: PortfolioSnapshotCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  return (
    <Animated.View entering={FadeInUp.duration(400)}>
      <View style={styles.snapshotCard}>
        {/* P&L Summary + Period Return */}
        <View style={styles.snapshotTop}>
          <View>
            <Text style={styles.snapshotLabel}>
              {t('periodReport.pnlSummary')}
            </Text>
            <Text
              style={[
                styles.snapshotValue,
                { color: m.totalReturn >= 0 ? colors.marketUp : colors.marketDown },
              ]}
            >
              {m.totalReturn >= 0 ? '+' : ''}{formatCurrency(m.totalReturn)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.snapshotLabel}>{t('periodReport.periodReturn')}</Text>
            <View style={styles.snapshotReturnRow}>
              <Text
                style={[
                  styles.snapshotReturn,
                  { color: m.totalReturnPercent >= 0 ? colors.marketUp : colors.marketDown },
                ]}
              >
                {formatPercent(m.totalReturnPercent)}
              </Text>
            </View>
          </View>
        </View>

        {/* Metrics Grid */}
        <View style={styles.snapshotGrid}>
          <View style={styles.snapshotItem}>
            <Text style={styles.snapshotItemValue}>{m.totalTrades}</Text>
            <Text style={styles.snapshotItemLabel}>{t('periodReport.totalTrades')}</Text>
          </View>
          <View style={styles.snapshotDivider} />
          <View style={styles.snapshotItem}>
            <Text style={[styles.snapshotItemValue, { color: colors.marketUp }]}>
              {m.winRate.toFixed(0)}%
            </Text>
            <Text style={styles.snapshotItemLabel}>{t('periodReport.winRate')}</Text>
          </View>
          <View style={styles.snapshotDivider} />
          <View style={styles.snapshotItem}>
            <Text
              style={[
                styles.snapshotItemValue,
                { color: m.sharpeRatio >= 1 ? colors.marketUp : colors.warning },
              ]}
            >
              {m.sharpeRatio.toFixed(1)}
            </Text>
            <Text style={styles.snapshotItemLabel}>{t('periodReport.sharpeRatio')}</Text>
          </View>
          <View style={styles.snapshotDivider} />
          <View style={styles.snapshotItem}>
            <Text style={[styles.snapshotItemValue, { color: colors.danger }]}>
              {formatPercent(m.maxDrawdownPercent)}
            </Text>
            <Text style={styles.snapshotItemLabel}>{t('periodReport.maxDrawdown')}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  snapshotCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.md,
    backgroundColor: colors.bgCard,
  },
  snapshotTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  snapshotLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
  },
  snapshotValue: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.xxl,
    marginTop: 4,
  },
  snapshotReturnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 4,
  },
  snapshotReturn: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  snapshotGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  snapshotItem: {
    flex: 1,
    alignItems: 'center',
  },
  snapshotItemValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  snapshotItemLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  snapshotDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.divider,
    alignSelf: 'center',
  },
});
