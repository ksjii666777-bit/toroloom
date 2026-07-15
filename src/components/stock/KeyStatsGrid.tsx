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
  isUSStock?: boolean;
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

function formatUSCurrency(amount: number, compact: boolean = false): string {
  if (compact && amount >= 1000) {
    if (amount >= 1_000_000_000_000) return `$${(amount / 1_000_000_000_000).toFixed(2)}T`;
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function KeyStatsGrid({ stats, isUSStock = false }: KeyStatsGridProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const fmt = isUSStock ? formatUSCurrency : formatCurrency;

  const cards: StatCardProps[] = useMemo(() => [
    { label: 'Open', value: fmt(stats.open, true) },
    { label: 'Day High', value: fmt(stats.dayHigh, true), color: colors.marketUp },
    { label: 'Day Low', value: fmt(stats.dayLow, true), color: colors.marketDown },
    { label: 'Volume', value: stats.volume > 0 ? formatCompactNumber(stats.volume) : 'N/A' },
    { label: 'Market Cap', value: stats.marketCap },
    { label: 'P/E Ratio', value: stats.pe.toFixed(1) },
    { label: '52W High', value: fmt(stats.high52), color: colors.marketUp },
    { label: '52W Low', value: fmt(stats.low52), color: colors.marketDown },
  ], [stats, colors, fmt]);

  return (
    <View style={styles.grid}>
      {cards.map((card, _i) => (
        <StatCard key={card.label} {...card} />
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
