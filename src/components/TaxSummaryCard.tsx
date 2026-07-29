/**
 * ============================================================================
 * Toroloom — Tax Summary Card
 * ============================================================================
 *
 * Standalone card showing STCG / LTCG breakdown, estimated tax liability,
 * and tax-harvesting tip when applicable.
 *
 * Props:
 *   shortTerm — { gains, estimatedTax }
 *   longTerm  — { gains, estimatedTax }
 *   totalEstimatedTax — number
 *
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';
import Card from './ui/Card';

// ──── Types ─────────────────────────────────────────────────────────────────

export interface TaxBucket {
  gains: number;
  estimatedTax: number;
}

export interface TaxSummaryData {
  shortTerm: TaxBucket;
  longTerm: TaxBucket;
  totalEstimatedTax: number;
}

// ──── Props ─────────────────────────────────────────────────────────────────

interface TaxSummaryCardProps {
  cg: TaxSummaryData;
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function TaxSummaryCard({ cg }: TaxSummaryCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(250)}>
      <Card title={t('periodReport.taxSummary')}>
        {/* STCG Row */}
        <View style={styles.taxRow}>
          <View style={styles.taxIconWrap}>
            <Ionicons name="time-outline" size={18} color={colors.warning} />
          </View>
          <Text style={styles.taxLabel}>{t('periodReport.stcgLabel')}</Text>
          <Text
            style={[
              styles.taxValue,
              { color: cg.shortTerm.gains >= 0 ? colors.marketUp : colors.marketDown },
            ]}
          >
            {formatCurrency(cg.shortTerm.gains, true)}
          </Text>
          <Text style={styles.taxEst}>₹{cg.shortTerm.estimatedTax.toLocaleString()}</Text>
        </View>

        <View style={styles.taxDivider} />

        {/* LTCG Row */}
        <View style={styles.taxRow}>
          <View style={styles.taxIconWrap}>
            <Ionicons name="infinite-outline" size={18} color={colors.marketUp} />
          </View>
          <Text style={styles.taxLabel}>{t('periodReport.ltcgLabel')}</Text>
          <Text
            style={[
              styles.taxValue,
              { color: cg.longTerm.gains >= 0 ? colors.marketUp : colors.marketDown },
            ]}
          >
            {formatCurrency(cg.longTerm.gains, true)}
          </Text>
          <Text style={styles.taxEst}>₹{cg.longTerm.estimatedTax.toLocaleString()}</Text>
        </View>

        <View style={styles.taxDivider} />

        {/* Total Estimated Tax */}
        <View style={styles.taxTotalRow}>
          <Text style={styles.taxTotalLabel}>{t('periodReport.estimatedTax')}</Text>
          <Text
            style={[
              styles.taxTotalValue,
              { color: cg.totalEstimatedTax > 0 ? colors.warning : colors.marketUp },
            ]}
          >
            {formatCurrency(cg.totalEstimatedTax, true)}
          </Text>
        </View>

        {/* Tax-harvesting tip */}
        {cg.totalEstimatedTax > 0 && (
          <Text style={styles.taxTip}>
            💡 {t('periodReport.taxHarvestingTip')}
          </Text>
        )}
      </Card>
    </Animated.View>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  taxIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  taxLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
    flex: 1,
    marginLeft: SPACING.sm,
  },
  taxValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    marginRight: SPACING.sm,
  },
  taxEst: {
    ...FONTS.mono,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  taxDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  taxTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  taxTotalLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  taxTotalValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  taxTip: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    marginTop: SPACING.sm,
    lineHeight: 16,
  },
});
