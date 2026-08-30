/**
 * Top holdings list — shows top 3 holdings with P&L.
 * Extracted from HomeScreen.tsx for better modularity.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatPercent } from '../../utils/formatters';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

interface Holding {
  id: string;
  stockId: string;
  symbol: string;
  quantity: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

interface TopHoldingsSectionProps {
  holdings: Holding[];
  formatLargeCurrency: (val: number) => string;
  navigation: NativeStackNavigationProp<RootStackParamList> | any;
  colors: any;
}

export function TopHoldingsSection({ holdings, formatLargeCurrency, navigation, colors }: TopHoldingsSectionProps) {
  const { t } = useT();

  if (holdings.length === 0) return null;

  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('home.topHoldings')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Portfolio')}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>{t('home.allHoldings')}</Text>
        </TouchableOpacity>
      </View>
      {holdings.map(holding => {
        const isPositive = holding.pnl >= 0;
        return (
          <TouchableOpacity
            key={holding.id}
            style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigation.navigate('StockDetail', { stockId: holding.stockId, symbol: holding.symbol })}
          >
            <View style={styles.left}>
              <View style={[styles.avatar, { backgroundColor: isPositive ? '#00C85320' : '#FF174420' }]}>
                <Ionicons name={isPositive ? 'trending-up' : 'trending-down'} size={16} color={isPositive ? '#00C853' : '#FF1744'} />
              </View>
              <View>
                <Text style={[styles.symbol, { color: colors.text }]}>{holding.symbol}</Text>
                <Text style={[styles.qty, { color: colors.textMuted }]}>{t('home.shares', { count: holding.quantity })}</Text>
              </View>
            </View>
            <View style={styles.right}>
              <Text style={[styles.value, { color: colors.text }]}>
                {formatLargeCurrency(holding.currentValue)}
              </Text>
              <View style={[styles.pnlChip, { backgroundColor: isPositive ? '#00C85320' : '#FF174420' }]}>
                <Ionicons name={isPositive ? 'caret-up' : 'caret-down'} size={12} color={isPositive ? '#00C853' : '#FF1744'} />
                <Text style={[styles.pnlText, { color: isPositive ? '#00C853' : '#FF1744' }]}>
                  {formatPercent(holding.pnlPercent)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  title: { ...FONTS.bold, fontSize: FONTS.size.md },
  seeAll: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.sm },
  left: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  symbol: { ...FONTS.bold, fontSize: FONTS.size.sm },
  qty: { ...FONTS.regular, fontSize: FONTS.size.xs },
  right: { alignItems: 'flex-end', gap: 4 },
  value: { ...FONTS.bold, fontSize: FONTS.size.sm },
  pnlChip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.xs },
  pnlText: { ...FONTS.bold, fontSize: FONTS.size.xs },
});
