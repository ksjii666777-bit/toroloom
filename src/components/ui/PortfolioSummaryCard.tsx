/**
 * ============================================================================
 * Toroloom — PortfolioSummaryCard (hero)
 * ============================================================================
 *
 * The primary hero card on the Home screen. Shows:
 *   - Total portfolio value (tabular numerals, no digit jitter)
 *   - Today's gain/loss (chip with caret)
 *   - Total P&L (supporting line)
 *   - Exactly 3 primary actions: Add Funds · Transfer · Withdraw/Balance
 *
 * Callers pass formatted strings — this component owns layout + hierarchy only.
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

type Action = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  testID?: string;
};

type PortfolioSummaryCardProps = {
  label: string;
  value: string;
  change: string;
  changeDirection: 'up' | 'down';
  pnl: string;
  actions: Action[];
};

export function PortfolioSummaryCard({
  label,
  value,
  change,
  changeDirection,
  pnl,
  actions,
}: PortfolioSummaryCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const changeColor = changeDirection === 'up' ? colors.marketUp : colors.marketDown;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgCard,
          borderColor: changeDirection === 'up' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.textSecondary }]} testID="home-portfolio-label">
        {label}
      </Text>
      <Text style={styles.value} testID="home-portfolio-value">
        {value}
      </Text>

      <View style={styles.statsRow}>
        <View style={[styles.changeChip, { backgroundColor: changeColor + '18' }]}>
          <Ionicons
            name={changeDirection === 'up' ? 'caret-up' : 'caret-down'}
            size={16}
            color={changeColor}
          />
          <Text style={[styles.changeText, { color: changeColor }]}>{change}</Text>
        </View>
        <Text style={[styles.pnlText, { color: colors.textSecondary }]}>{pnl}</Text>
      </View>

      <View style={styles.actionsRow}>
        {actions.slice(0, 3).map(action => (
          <Pressable
            key={action.key}
            testID={action.testID}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [
              styles.actionBtn,
              { borderColor: colors.borderLight },
              pressed && styles.actionPressed,
            ]}
          >
            <Ionicons name={action.icon} size={20} color={action.color} />
            <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      borderRadius: BORDER_RADIUS.xl,
      borderWidth: 1,
      padding: SPACING.xl,
    },
    label: {
      ...FONTS.caption,
    },
    value: {
      ...FONTS.money,
      color: colors.text,
      marginTop: SPACING.xs,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginTop: SPACING.sm,
    },
    changeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.full,
    },
    changeText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
    pnlText: {
      ...FONTS.caption,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.xl,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.full,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.sm,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    actionPressed: {
      opacity: 0.7,
    },
    actionText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      flexShrink: 1,
    },
  });
