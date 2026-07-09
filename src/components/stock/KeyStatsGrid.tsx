import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency, formatCompactNumber } from '../../utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface KeyStats {
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap: string;
  pe: number;
  high52: number;
  low52: number;
}

interface KeyStatsGridProps {
  stats: KeyStats;
}

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, color ? { color } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

export default function KeyStatsGrid({ stats }: KeyStatsGridProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const cards: StatCardProps[] = useMemo(() => [
    { label: 'Open', value: formatCurrency(stats.open, true) },
    { label: 'Day High', value: formatCurrency(stats.dayHigh, true), color: colors.marketUp },
    { label: 'Day Low', value: formatCurrency(stats.dayLow, true), color: colors.marketDown },
    { label: 'Volume', value: stats.volume > 0 ? formatCompactNumber(stats.volume) : 'N/A' },
    { label: 'Market Cap', value: stats.marketCap },
    { label: 'P/E Ratio', value: stats.pe.toFixed(1) },
    { label: '52W High', value: formatCurrency(stats.high52), color: colors.marketUp },
    { label: '52W Low', value: formatCurrency(stats.low52), color: colors.marketDown },
  ], [stats, colors]);

  return (
    <View style={styles.grid}>
      {cards.map((card, i) => (
        <StatCard key={i} {...card} />
      ))}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    card: {
      width: (SCREEN_WIDTH - 64 - 12) / 4,
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginBottom: 4,
    },
    value: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },
  });
