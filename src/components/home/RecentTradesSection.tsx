/**
 * Recent trades list — shows last 3 trades.
 * Extracted from HomeScreen.tsx for better modularity.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

interface Trade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
}

interface RecentTradesSectionProps {
  trades: Trade[];
  colors: any;
}

export function RecentTradesSection({ trades, colors }: RecentTradesSectionProps) {
  const { t } = useT();

  if (trades.length === 0) return null;

  return (
    <View>
      {trades.map(trade => (
        <View key={trade.id} style={[styles.item, { borderColor: colors.border }]}>
          <View style={styles.left}>
            <View style={[styles.typeBadge, {
              backgroundColor: trade.type === 'buy' ? '#00C85320' : '#FF174420',
            }]}>
              <Ionicons name={trade.type === 'buy' ? 'cart' : 'arrow-up'} size={14} color={trade.type === 'buy' ? '#00C853' : '#FF1744'} />
            </View>
            <View>
              <Text style={[styles.symbol, { color: colors.text }]}>{trade.symbol}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {trade.type === 'buy' ? t('home.bought') : t('home.sold')} {trade.quantity} @ ₹{trade.price.toFixed(2)}
              </Text>
            </View>
          </View>
          <Text style={[styles.amount, {
            color: trade.type === 'buy' ? colors.text : colors.marketUp,
          }]}>
            {trade.type === 'buy' ? '-' : '+'}₹{trade.total.toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1 },
  left: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  typeBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  symbol: { ...FONTS.bold, fontSize: FONTS.size.sm },
  meta: { ...FONTS.regular, fontSize: FONTS.size.xs },
  amount: { ...FONTS.bold, fontSize: FONTS.size.sm },
});
