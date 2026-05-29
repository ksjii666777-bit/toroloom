import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stock } from '../types';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';
import Badge from './ui/Badge';
import AnimatedPressable from './ui/AnimatedPressable';

interface StockItemProps {
  stock: Stock;
  onPress: (stock: Stock) => void;
  showActions?: boolean;
  isInWatchlist?: boolean;
  onWatchlistToggle?: (stock: Stock) => void;
}

export default function StockItem({ stock, onPress, showActions, isInWatchlist, onWatchlistToggle }: StockItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const changeColor = stock.isPositive ? colors.marketUp : colors.marketDown;
  const changeBg = stock.isPositive ? '#00C85315' : '#FF174415';
  const iconName = stock.isPositive ? 'trending-up' : 'trending-down';

  const handleWatchlistPress = useCallback(() => {
    onWatchlistToggle?.(stock);
  }, [onWatchlistToggle, stock]);

  return (
    <AnimatedPressable onPress={() => onPress(stock)} haptic="selection" scaleTo={0.98}>
      <View style={styles.container}>
        <View style={styles.mainRow}>
          <View style={styles.iconContainer}>
            <Ionicons name={iconName} size={20} color={changeColor} />
          </View>
          <View style={styles.info}>
            <Text style={styles.symbol}>{stock.symbol}</Text>
            <Text style={styles.name} numberOfLines={1}>{stock.name}</Text>
            <View style={styles.tags}>
              <Badge label={stock.sector} variant="neutral" />
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{formatCurrency(stock.price)}</Text>
            <View style={[styles.changeBadge, { backgroundColor: changeBg }]}>
              <Ionicons name={stock.isPositive ? 'caret-up' : 'caret-down'} size={12} color={changeColor} />
              <Text style={[styles.change, { color: changeColor }]}>
                {Math.abs(stock.changePercent).toFixed(2)}%
              </Text>
            </View>
          </View>
          {showActions && (
            <AnimatedPressable onPress={handleWatchlistPress} haptic="light" scaleTo={0.9} style={styles.watchlistBtn}>
              <Ionicons
                name={isInWatchlist ? 'heart' : 'heart-outline'}
                size={22}
                color={isInWatchlist ? colors.secondary : colors.textMuted}
              />
            </AnimatedPressable>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  info: {
    flex: 1,
  },
  symbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  name: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    marginTop: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
    marginLeft: SPACING.sm,
  },
  price: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
    marginTop: 4,
    gap: 2,
  },
  change: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  watchlistBtn: {
    paddingLeft: SPACING.md,
  },
});
