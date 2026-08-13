/**
 * ============================================================================
 * Toroloom — FinanceCard
 * ============================================================================
 *
 * Standard money/datum card: label on top, large tabular-numeral value below,
 * optional change chip and supporting text. Used for balances, metrics, and
 * report summaries so money always renders with the same hierarchy + font.
 *
 * Usage:
 *   <FinanceCard
 *     label={t('profile.availableBalance')}
 *     value="₹25.0L"
 *     change="+1.2%"
 *     changeDirection="up"
 *     footer={t('profile.asOfToday')}
 *   />
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

type FinanceCardProps = {
  label: string;
  value: string;
  /** Signed change string, e.g. "+1.24%" or "-₹320" */
  change?: string;
  /** Positive/negative flips the chip color; omit to infer from the sign */
  changeDirection?: 'up' | 'down' | 'neutral';
  footer?: string;
  testID?: string;
};

function inferDirection(change: string): 'up' | 'down' | 'neutral' {
  const trimmed = change.trim();
  if (trimmed.startsWith('-')) return 'down';
  if (/^[+]/.test(trimmed) || /^\d/.test(trimmed)) return 'up';
  return 'neutral';
}

export function FinanceCard({ label, value, change, changeDirection, footer, testID }: FinanceCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dir = changeDirection ?? (change ? inferDirection(change) : 'neutral');
  const changeColor =
    dir === 'up' ? colors.success : dir === 'down' ? colors.danger : colors.textSecondary;

  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID={testID}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {change ? (
        <View style={styles.changeRow}>
          <Ionicons
            name={dir === 'up' ? 'caret-up' : dir === 'down' ? 'caret-down' : 'remove'}
            size={14}
            color={changeColor}
          />
          <Text style={[styles.changeText, { color: changeColor }]}>{change}</Text>
        </View>
      ) : null}
      {footer ? <Text style={[styles.footer, { color: colors.textMuted }]}>{footer}</Text> : null}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.lg,
      gap: SPACING.xs,
    },
    label: {
      ...FONTS.caption,
    },
    value: {
      ...FONTS.moneySm,
      color: colors.text,
      marginTop: 2,
    },
    changeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    changeText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
    },
    footer: {
      ...FONTS.caption,
      marginTop: SPACING.xs,
    },
  });
