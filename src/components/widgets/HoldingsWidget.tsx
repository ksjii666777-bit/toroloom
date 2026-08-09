/**
 * Toroloom — Holdings Breakdown Widget
 * Shows portfolio holdings with value, P&L, and weight allocation.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { usePortfolioStore } from '../../store/portfolioStore';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { openExitOrder } from '../../utils/orderExit';
import PositionLevelsOverlay from '../PositionLevelsOverlay';

import type { WidgetSize } from '../../types/widgets';

interface HoldingsWidgetProps {
  size: WidgetSize;
}

export default function HoldingsWidget({ size }: HoldingsWidgetProps) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { t } = useT();
  const { holdings } = usePortfolioStore();

  const sorted = useMemo(() => {
    return [...holdings].sort((a, b) => b.currentValue - a.currentValue);
  }, [holdings]);

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const displayCount = size === 'large' ? sorted.length : size === 'medium' ? 5 : 3;

  if (holdings.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('components.widgets.holdingsEmpty')}</Text>
      </View>
    );
  }

  if (size === 'small') {
    return (
      <View style={styles.container}>
        <Text style={[styles.totalValue, { color: colors.text }]}>
          {formatCurrency(totalValue, true)}
        </Text>
        <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
          {t('components.widgets.holdingCount', { count: holdings.length })}
        </Text>
        {sorted.slice(0, 2).map(h => (
          <View key={h.id} style={styles.miniRow}>
            <Text style={[styles.miniSymbol, { color: colors.text }]}>{h.symbol}</Text>
            <Text style={[styles.miniPnl, { color: h.pnl >= 0 ? '#00E676' : '#FF5252' }]}>
              {formatPercent(h.pnlPercent)}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.totalValue, { color: colors.text }]}>
          {formatCurrency(totalValue, true)}
        </Text>
        <Text style={[styles.countLabel, { color: colors.textMuted }]}>
          {t('components.widgets.holdingsCount', { count: holdings.length })}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 4 }}
      >
        {sorted.slice(0, displayCount).map(h => {
          const weight = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
          return (
            <View key={h.id} style={[styles.holdingRow, { borderBottomColor: colors.divider }]}>
              <View style={styles.holdingRowMain}>
                <View style={styles.holdingInfo}>
                  <View style={[styles.weightBar, { width: `${Math.min(weight, 100)}%`, backgroundColor: '#3B82F620' }]} />
                  <Text style={[styles.symbol, { color: colors.text }]}>{h.symbol}</Text>
                  <Text style={[styles.weightText, { color: colors.textMuted }]}>
                    {weight.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.holdingValues}>
                  <Text style={[styles.holdingValue, { color: colors.text }]}>
                    {formatCurrency(h.currentValue, true)}
                  </Text>
                  <Text style={[styles.holdingPnl, { color: h.pnl >= 0 ? '#00E676' : '#FF5252' }]}>
                    {formatPercent(h.pnlPercent)}
                  </Text>
                </View>
              </View>

              {/* Live position tag — same inline overlay as the portfolio
                  rows, driven by the local holding (no SnapTrade fetch) with
                  INR prices. STOP / TARGET pre-fill the PlaceOrder exit. */}
              <PositionLevelsOverlay
                symbol={h.symbol}
                position={{
                  symbol: h.symbol,
                  quantity: h.quantity,
                  avgCost: h.buyPrice,
                  price: h.currentPrice,
                  pnl: h.pnl,
                  pnlPercent: h.pnlPercent,
                }}
                currency="INR"
                inline
                onApplyStop={(p) => openExitOrder(
                  navigation,
                  {
                    symbol: h.symbol,
                    exchange: 'NSE',
                    name: h.name,
                    price: h.currentPrice,
                    stockId: h.stockId,
                  },
                  'SL',
                  p,
                )}
                onApplyTarget={(p) => openExitOrder(
                  navigation,
                  {
                    symbol: h.symbol,
                    exchange: 'NSE',
                    name: h.name,
                    price: h.currentPrice,
                    stockId: h.stockId,
                  },
                  'LIMIT',
                  p,
                )}
              />
            </View>
          );
        })}
        {sorted.length > displayCount && (
          <Text style={[styles.moreText, { color: colors.textMuted }]}>
            {t('components.widgets.moreHoldings', { count: sorted.length - displayCount })}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
  emptyText: { fontFamily: 'System', fontSize: 13, fontWeight: '500' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalValue: { fontFamily: 'System', fontSize: 16, fontWeight: '800' },
  totalLabel: { fontFamily: 'System', fontSize: 10, fontWeight: '500', marginTop: 2 },
  countLabel: { fontFamily: 'System', fontSize: 10, fontWeight: '500' },
  list: { flex: 1 },
  holdingRow: {
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    position: 'relative',
  },
  holdingRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  holdingInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, position: 'relative' },
  weightBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  symbol: { fontFamily: 'System', fontSize: 11, fontWeight: '700', zIndex: 1 },
  weightText: { fontFamily: 'System', fontSize: 9, fontWeight: '500', zIndex: 1 },
  holdingValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  holdingValue: { fontFamily: 'System', fontSize: 11, fontWeight: '600' },
  holdingPnl: { fontFamily: 'System', fontSize: 10, fontWeight: '600', minWidth: 50, textAlign: 'right' },
  miniRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  miniSymbol: { fontFamily: 'System', fontSize: 11, fontWeight: '600' },
  miniPnl: { fontFamily: 'System', fontSize: 10, fontWeight: '600' },
  moreText: { fontFamily: 'System', fontSize: 10, fontWeight: '500', marginTop: 6, textAlign: 'center' },
});
