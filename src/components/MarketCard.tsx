import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MarketIndex } from '../types';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import AnimatedPressable from './ui/AnimatedPressable';
import { formatCurrency } from '../utils/formatters';

interface MarketCardProps {
  index: MarketIndex;
  onPress?: (index: MarketIndex) => void;
}

export default function MarketCard({ index, onPress }: MarketCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const changeColor = index.isPositive ? colors.marketUp : colors.marketDown;
  const gradientColors: [string, string] = index.isPositive
    ? ['#00C85315', '#00962405']
    : ['#FF174415', '#D5000005'];

  return (
    <AnimatedPressable onPress={() => onPress?.(index)} haptic="selection" scaleTo={0.97}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.header}>
          <Ionicons
            name={index.icon as keyof typeof Ionicons.glyphMap}
            size={16}
            color={changeColor}
          />
          <Text style={styles.shortName}>{index.shortName}</Text>
          <View style={[styles.liveDot, { backgroundColor: colors.marketUp }]} />
        </View>
        
        <Text style={styles.value}>{formatCurrency(index.currentValue, true)}</Text>
        
        <View style={styles.changeRow}>
          <Ionicons
            name={index.isPositive ? 'caret-up' : 'caret-down'}
            size={16}
            color={changeColor}
          />
          <Text style={[styles.change, { color: changeColor }]}>
            {index.isPositive ? '+' : ''}{index.change.toFixed(2)}
          </Text>
          <Text style={[styles.changePercent, { color: changeColor }]}>
            ({index.isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%)
          </Text>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: SPACING.md,
    minWidth: 160,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shortName: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  value: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
    marginTop: SPACING.sm,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: 4,
  },
  change: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  changePercent: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
});
