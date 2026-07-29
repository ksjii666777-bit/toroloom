/**
 * ============================================================================
 * Toroloom — Best / Worst Trade Card
 * ============================================================================
 *
 * Side-by-side card showing the best and worst trade P&L for the period.
 * Only renders when at least one of bestTrade / worstTrade is non-zero.
 *
 * Props:
 *   bestTrade   — Best single trade P&L (positive number)
 *   worstTrade  — Worst single trade P&L (negative number)
 *
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';
import Card from './ui/Card';

// ──── Props ─────────────────────────────────────────────────────────────────

interface BestWorstTradeCardProps {
  bestTrade: number;
  worstTrade: number;
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function BestWorstTradeCard({ bestTrade, worstTrade }: BestWorstTradeCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  // Only render if at least one trade is non-zero
  if (bestTrade === 0 && worstTrade === 0) return null;

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(200)}>
      <Card>
        <View style={styles.bestWorstRow}>
          {/* Best Trade */}
          <View style={styles.bestWorstItem}>
            <Ionicons name="trophy" size={18} color={colors.marketUp} />
            <Text style={styles.bestWorstLabel}>{t('periodReport.bestTrade')}</Text>
            <Text style={[styles.bestWorstValue, { color: colors.marketUp }]}>
              {formatCurrency(bestTrade, true)}
            </Text>
          </View>

          <View style={styles.bestWorstDivider} />

          {/* Worst Trade */}
          <View style={styles.bestWorstItem}>
            <Ionicons name="warning" size={18} color={colors.marketDown} />
            <Text style={styles.bestWorstLabel}>{t('periodReport.worstTrade')}</Text>
            <Text style={[styles.bestWorstValue, { color: colors.marketDown }]}>
              {formatCurrency(Math.abs(worstTrade), true)}
            </Text>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  bestWorstRow: {
    flexDirection: 'row',
  },
  bestWorstItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  bestWorstLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  bestWorstValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    marginTop: 2,
  },
  bestWorstDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.divider,
    alignSelf: 'center',
  },
});
