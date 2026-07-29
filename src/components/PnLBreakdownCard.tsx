/**
 * ============================================================================
 * Toroloom — P&L Breakdown Card (Realized + Unrealized)
 * ============================================================================
 *
 * Side-by-side cards showing realized and unrealized P&L for the period.
 * Always renders (no empty state — parent controls visibility).
 *
 * Props:
 *   realizedPnl     — Sum of closed trade P&L
 *   unrealizedPnl   — Mark-to-market P&L on open holdings
 *
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';

// ──── Props ─────────────────────────────────────────────────────────────────

interface PnLBreakdownCardProps {
  realizedPnl: number;
  unrealizedPnl: number;
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function PnLBreakdownCard({ realizedPnl, unrealizedPnl }: PnLBreakdownCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(100)}>
      <View style={styles.pnlRow}>
        {/* Realized P&L Card */}
        <View style={styles.pnlCard}>
          <View style={[styles.pnlCardIcon, { backgroundColor: colors.marketUp + '20' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.marketUp} />
          </View>
          <Text style={styles.pnlCardLabel}>{t('periodReport.realizedPnl')}</Text>
          <Text
            style={[
              styles.pnlCardValue,
              { color: realizedPnl >= 0 ? colors.marketUp : colors.marketDown },
            ]}
          >
            {realizedPnl >= 0 ? '+' : ''}{formatCurrency(realizedPnl, true)}
          </Text>
        </View>

        {/* Unrealized P&L Card */}
        <View style={styles.pnlCard}>
          <View style={[styles.pnlCardIcon, { backgroundColor: colors.warning + '20' }]}>
            <Ionicons name="trending-up" size={20} color={colors.warning} />
          </View>
          <Text style={styles.pnlCardLabel}>{t('periodReport.unrealizedPnl')}</Text>
          <Text
            style={[
              styles.pnlCardValue,
              { color: unrealizedPnl >= 0 ? colors.marketUp : colors.marketDown },
            ]}
          >
            {unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(unrealizedPnl, true)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  pnlRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  pnlCard: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pnlCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  pnlCardLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  pnlCardValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    marginTop: 4,
  },
});
