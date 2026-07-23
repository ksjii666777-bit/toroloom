/**
 * Toroloom — Recent Trades Widget
 * Shows the latest buy and sell trades with P&L and timestamps.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioStore } from '../../store/portfolioStore';
import { formatCurrency, formatTimeAgo } from '../../utils/formatters';
import { FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { WidgetSize } from '../../types/widgets';

interface RecentTradesWidgetProps {
  size: WidgetSize;
}

export default function RecentTradesWidget({ size }: RecentTradesWidgetProps) {
  const { colors } = useTheme();
  const { trades } = usePortfolioStore();

  const recentTrades = useMemo(() => {
    return [...trades]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, size === 'large' ? 10 : size === 'medium' ? 6 : 3);
  }, [trades, size]);

  if (trades.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No trades yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 2 }}
      >
        {recentTrades.map(t => (
          <View key={t.id} style={[styles.tradeRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.tradeLeft}>
              <View style={[
                styles.tradeType,
                { backgroundColor: t.type === 'buy' ? '#00E67620' : '#FF525220' },
              ]}>
                <Text style={[
                  styles.tradeTypeText,
                  { color: t.type === 'buy' ? '#00E676' : '#FF5252' },
                ]}>
                  {t.type === 'buy' ? 'B' : 'S'}
                </Text>
              </View>
              <View>
                <Text style={[styles.tradeSymbol, { color: colors.text }]}>{t.symbol}</Text>
                <Text style={[styles.tradeQty, { color: colors.textMuted }]}>
                  {t.quantity} × ₹{t.price.toFixed(1)}
                </Text>
              </View>
            </View>
            <View style={styles.tradeRight}>
              <Text style={[styles.tradeTotal, { color: colors.text }]}>
                {formatCurrency(t.total, true)}
              </Text>
              <Text style={[styles.tradeTime, { color: colors.textMuted }]}>
                {formatTimeAgo(t.timestamp)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
  emptyText: { fontFamily: 'System', fontSize: 13, fontWeight: '500' },
  scroll: { flex: 1 },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 0.5,
  },
  tradeLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tradeType: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeTypeText: { fontFamily: 'System', fontSize: 11, fontWeight: '800' },
  tradeSymbol: { fontFamily: 'System', fontSize: 12, fontWeight: '700' },
  tradeQty: { fontFamily: 'System', fontSize: 9, fontWeight: '500', marginTop: 1 },
  tradeRight: { alignItems: 'flex-end' },
  tradeTotal: { fontFamily: 'System', fontSize: 12, fontWeight: '700' },
  tradeTime: { fontFamily: 'System', fontSize: 9, fontWeight: '500', marginTop: 1 },
});
