/**
 * ============================================================================
 * Toroloom — PortfolioSummaryCard (hero)
 * ============================================================================
 *
 * The primary hero card on the Home screen. Shows:
 *   - Total portfolio value (count-up animation with green/red tint flash
 *     when the value changes — via AnimatedNumber)
 *   - Today's gain/loss (chip with caret; springs on direction flip)
 *   - Total P&L (supporting line)
 *   - Exactly 3 primary actions: Add Funds · Transfer · Withdraw/Balance
 *     (animated press — scale bounce + haptic)
 *   - One-shot hero entrance on mount (rise + fade, eased)
 *
 * Callers pass formatted strings for change/pnl; the value can be passed as
 * a formatted string (static) OR as numericValue+formatValue (animated).
 * ============================================================================
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from './AnimatedPressable';
import AnimatedNumber from './AnimatedNumber';

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
  /** Static formatted value (used when numericValue is not provided) */
  value: string;
  /** Optional numeric value — enables the count-up + tint flash animation */
  numericValue?: number;
  /** Formatter used with numericValue */
  formatValue?: (v: number) => string;
  change: string;
  changeDirection: 'up' | 'down';
  pnl: string;
  actions: Action[];
};

export function PortfolioSummaryCard({
  label,
  value,
  numericValue,
  formatValue,
  change,
  changeDirection,
  pnl,
  actions,
}: PortfolioSummaryCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const changeColor = changeDirection === 'up' ? colors.marketUp : colors.marketDown;

  // ── One-shot hero entrance: rise + fade ─────────────────────────────────
  const entrance = useSharedValue(0);
  useEffect(() => {
    entrance.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
  }, [entrance]);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 14 }],
  }));

  // ── Change chip spring on direction flip (up↔down) ──────────────────────
  const prevDirection = useRef(changeDirection);
  const chipScale = useSharedValue(1);
  useEffect(() => {
    if (prevDirection.current !== changeDirection) {
      prevDirection.current = changeDirection;
      chipScale.value = 1.25;
      chipScale.value = withSpring(1, { stiffness: 160, damping: 13 });
    }
  }, [changeDirection, chipScale]);
  const chipStyle = useAnimatedStyle(() => ({ transform: [{ scale: chipScale.value }] }));

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgCard,
          borderColor: changeDirection === 'up' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
        },
        entranceStyle,
      ]}
      testID="portfolio-summary-card"
    >
      <Text style={[styles.label, { color: colors.textSecondary }]} testID="home-portfolio-label">
        {label}
      </Text>

      {numericValue !== undefined && formatValue ? (
        <AnimatedNumber
          value={numericValue}
          format={formatValue}
          style={styles.value}
          testID="home-portfolio-value"
        />
      ) : (
        <Text style={styles.value} testID="home-portfolio-value">
          {value}
        </Text>
      )}

      <View style={styles.statsRow}>
        <Animated.View style={[styles.changeChip, { backgroundColor: changeColor + '18' }, chipStyle]}>
          <Ionicons
            name={changeDirection === 'up' ? 'caret-up' : 'caret-down'}
            size={16}
            color={changeColor}
          />
          <Text style={[styles.changeText, { color: changeColor }]}>{change}</Text>
        </Animated.View>
        <Text style={[styles.pnlText, { color: colors.textSecondary }]}>{pnl}</Text>
      </View>

      <View style={styles.actionsRow}>
        {actions.slice(0, 3).map(action => (
          <AnimatedPressable
            key={action.key}
            testID={action.testID}
            onPress={action.onPress}
            accessibilityLabel={action.label}
            haptic="light"
            scaleTo={0.94}
            style={[styles.actionBtn, { borderColor: colors.borderLight }]}
          >
            <Ionicons name={action.icon} size={20} color={action.color} />
            <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={1}>
              {action.label}
            </Text>
          </AnimatedPressable>
        ))}
      </View>
    </Animated.View>
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
    actionText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      flexShrink: 1,
    },
  });
