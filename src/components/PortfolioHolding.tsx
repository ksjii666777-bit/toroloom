import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Holding } from '../types';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import AnimatedPressable from './ui/AnimatedPressable';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface PortfolioHoldingProps {
  holding: Holding;
  onPress?: (holding: Holding) => void;
}

export default function PortfolioHolding({ holding, onPress }: PortfolioHoldingProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const pnlColor = holding.pnl >= 0 ? colors.marketUp : colors.marketDown;
  const dayColor = holding.dayChange >= 0 ? colors.marketUp : colors.marketDown;

  return (
    <AnimatedPressable onPress={() => onPress?.(holding)} haptic="selection" scaleTo={0.98}>
      <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.symbolRow}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>{holding.symbol[0]}</Text>
          </View>
          <View>
            <Text style={styles.symbol}>{holding.symbol}</Text>
            <Text style={styles.qty}>{holding.quantity} shares</Text>
          </View>
        </View>
        <View style={styles.pnlContainer}>
          <Text style={[styles.pnl, { color: pnlColor }]}>
            {holding.pnl >= 0 ? '+' : ''}{formatCurrency(holding.pnl)}
          </Text>
          <Text style={[styles.pnlPercent, { color: pnlColor }]}>
            {formatPercent(holding.pnlPercent)}
          </Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Avg Cost</Text>
          <Text style={styles.detailValue}>{formatCurrency(holding.buyPrice)}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>LTP</Text>
          <Text style={styles.detailValue}>{formatCurrency(holding.currentPrice)}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Invested</Text>
          <Text style={styles.detailValue}>{formatCurrency(holding.totalInvested, true)}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Current</Text>
          <Text style={styles.detailValue}>{formatCurrency(holding.currentValue, true)}</Text>
        </View>
      </View>

      <View style={styles.dayChange}>
        <Ionicons
          name={holding.dayChange >= 0 ? 'caret-up' : 'caret-down'}
          size={14}
          color={dayColor}
        />
        <Text style={[styles.dayChangeText, { color: dayColor }]}>
          Day: {formatPercent(holding.dayChangePercent)}
        </Text>
      </View>
      </View>
    </AnimatedPressable>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.primary,
  },
  symbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  qty: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  pnlContainer: {
    alignItems: 'flex-end',
  },
  pnl: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  pnlPercent: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  detail: {
    alignItems: 'center',
  },
  detailLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  dayChange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: 2,
  },
  dayChangeText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
});
