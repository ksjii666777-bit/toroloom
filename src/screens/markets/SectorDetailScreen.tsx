/**
 * ============================================================================
 * Toroloom — Sector Detail Screen
 * ============================================================================
 *
 * Detailed view for a market sector showing:
 *   1. Sector summary (avg change, stock count, gainers/losers count)
 *   2. Top gainers & losers within the sector
 *   3. All stocks sorted by performance (change %)
 *   4. Sector stats card (best/worst performer, total volume, market cap)
 *
 * Navigated to from MarketsScreen heatmap chips.
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, RefreshControl,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useMarketStore } from '../../store/marketStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';

const { width } = Dimensions.get('window');

// ─── Helper: Market cap display ──────────────────────────────────────────

function formatMarketCap(marketCap: string): string {
  const num = parseFloat(marketCap.replace(/[₹,\s]/g, ''));
  if (marketCap.includes('Cr')) {
    if (num >= 100000) return `${(num / 100000).toFixed(1)}L Cr`;
    if (num >= 100) return `${(num / 100).toFixed(1)}K Cr`;
    return `${num.toFixed(0)} Cr`;
  }
  return marketCap;
}

// ─── Main Screen ─────────────────────────────────────────────────────────

export default function SectorDetailScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { sectorName } = route.params || { sectorName: 'All' };

  const { stocks } = useMarketStore();
  const [sortBy, setSortBy] = useState<'change' | 'price' | 'name'>('change');
  const [refreshing, setRefreshing] = useState(false);

  // Filter stocks by sector
  const sectorStocks = useMemo(() => {
    if (!stocks || !Array.isArray(stocks)) return [];
    if (sectorName === 'All') return stocks;
    return stocks.filter(s => (s.sector ?? '').toLowerCase() === sectorName.toLowerCase());
  }, [stocks, sectorName]);

  // Compute sector stats
  const sectorStats = useMemo(() => {
    const gainers = sectorStocks.filter(s => s.changePercent > 0).length;
    const losers = sectorStocks.filter(s => s.changePercent < 0).length;
    const unchanged = sectorStocks.filter(s => s.changePercent === 0).length;
    const avgChange = sectorStocks.length > 0
      ? sectorStocks.reduce((sum, s) => sum + s.changePercent, 0) / sectorStocks.length
      : 0;
    const totalVolume = sectorStocks.reduce((sum, s) => sum + parseFloat(s.volume.replace(/[,\s]/g, '')), 0);

    const sortedByChange = [...sectorStocks].sort((a, b) => b.changePercent - a.changePercent);
    const bestPerformer = sortedByChange[0];
    const worstPerformer = sortedByChange[sortedByChange.length - 1];

    return { gainers, losers, unchanged, avgChange, totalVolume, bestPerformer, worstPerformer };
  }, [sectorStocks]);

  // Sort stocks
  const sortedStocks = useMemo(() => {
    const sorted = [...sectorStocks];
    switch (sortBy) {
      case 'change':
        sorted.sort((a, b) => b.changePercent - a.changePercent);
        break;
      case 'price':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [sectorStocks, sortBy]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const SORT_OPTIONS = [
    { key: 'change' as const, label: 'Change %', icon: 'pulse' },
    { key: 'price' as const, label: 'Price', icon: 'cash' },
    { key: 'name' as const, label: 'Name', icon: 'text' },
  ];

  const avgChangeColor = sectorStats.avgChange >= 0 ? '#00E676' : '#FF5252';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </AnimatedPressable>
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Text style={[styles.title, { color: colors.text }]}>{sectorName}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sector Performance & Stocks
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Summary Cards ── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: avgChangeColor + '18' }]}>
              <Ionicons name="pulse" size={18} color={avgChangeColor} />
            </View>
            <Text style={[styles.summaryValue, { color: avgChangeColor }]}>
              {sectorStats.avgChange >= 0 ? '+' : ''}{sectorStats.avgChange.toFixed(2)}%
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Avg Change</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="business" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {sectorStocks.length}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Stocks</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: '#00E67618' }]}>
              <Ionicons name="arrow-up" size={18} color="#00E676" />
            </View>
            <Text style={[styles.summaryValue, { color: '#00E676' }]}>{sectorStats.gainers}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Gainers</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: '#FF525218' }]}>
              <Ionicons name="arrow-down" size={18} color="#FF5252" />
            </View>
            <Text style={[styles.summaryValue, { color: '#FF5252' }]}>{sectorStats.losers}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Losers</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.textMuted + '18' }]}>
              <Ionicons name="remove" size={18} color={colors.textMuted} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.textMuted }]}>{sectorStats.unchanged}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Flat</Text>
          </View>
        </View>

        {/* ── Best / Worst Performers ── */}
        {sectorStats.bestPerformer && sectorStats.worstPerformer && (
          <View style={styles.performersRow}>
            <View style={[styles.performerCard, { backgroundColor: '#00E67610', borderColor: '#00E67630' }]}>
              <View style={styles.performerHeader}>
                <Ionicons name="trophy" size={14} color="#FFD700" />
                <Text style={[styles.performerTitle, { color: '#00E676' }]}>Best</Text>
              </View>
              <Text style={[styles.performerSymbol, { color: colors.text }]}>
                {sectorStats.bestPerformer.symbol}
              </Text>
              <Text style={[styles.performerChange, { color: '#00E676' }]}>
                +{sectorStats.bestPerformer.changePercent.toFixed(2)}%
              </Text>
            </View>
            <View style={[styles.performerCard, { backgroundColor: '#FF525210', borderColor: '#FF525230' }]}>
              <View style={styles.performerHeader}>
                <Ionicons name={"alert-triangle" as any} size={14} color="#FF5252" />
                <Text style={[styles.performerTitle, { color: '#FF5252' }]}>Worst</Text>
              </View>
              <Text style={[styles.performerSymbol, { color: colors.text }]}>
                {sectorStats.worstPerformer.symbol}
              </Text>
              <Text style={[styles.performerChange, { color: '#FF5252' }]}>
                {sectorStats.worstPerformer.changePercent.toFixed(2)}%
              </Text>
            </View>
          </View>
        )}

        {/* ─── Sort Controls ── */}
        <View style={styles.sortRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>All Stocks</Text>
          <View style={styles.sortChips}>
            {SORT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.sortChip,
                  {
                    backgroundColor: sortBy === opt.key ? colors.primary + '20' : colors.bgInput,
                    borderColor: sortBy === opt.key ? colors.primary + '40' : colors.border,
                  },
                ]}
                onPress={() => setSortBy(opt.key)}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={12}
                  color={sortBy === opt.key ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.sortChipText, {
                  color: sortBy === opt.key ? colors.primary : colors.textMuted,
                }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Stock List ── */}
        {sortedStocks.map((stock, index) => {
          const isPositive = stock.changePercent >= 0;
          return (
            <Animated.View
              key={stock.id}
              entering={FadeInDown.delay(index * 30).springify()}
            >
              <TouchableOpacity
                style={[styles.stockRow, { borderBottomColor: colors.divider }]}
                onPress={() => navigation.navigate('StockDetail', { stockId: stock.id, symbol: stock.symbol })}
                activeOpacity={0.7}
              >
                <View style={styles.stockLeft}>
                  <Text style={[styles.stockRank, { color: colors.textMuted }]}>{index + 1}</Text>
                  <View>
                    <Text style={[styles.stockSymbol, { color: colors.text }]}>{stock.symbol}</Text>
                    <Text style={[styles.stockName, { color: colors.textMuted }]} numberOfLines={1}>
                      {stock.name}
                    </Text>
                  </View>
                </View>
                <View style={styles.stockRight}>
                  <Text style={[styles.stockPrice, { color: colors.text }]}>
                    ₹{stock.price.toLocaleString()}
                  </Text>
                  <View style={[styles.changeBadge, {
                    backgroundColor: isPositive ? '#00E67615' : '#FF525215',
                  }]}>
                    <Ionicons
                      name={isPositive ? 'caret-up' : 'caret-down'}
                      size={10}
                      color={isPositive ? '#00E676' : '#FF5252'}
                    />
                    <Text style={[styles.changeText, {
                      color: isPositive ? '#00E676' : '#FF5252',
                    }]}>
                      {stock.changePercent.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {sortedStocks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No stocks found in this sector
            </Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 60,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  summaryCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    fontFamily: 'monospace',
  },
  summaryLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },

  // Performers
  performersRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  performerCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  performerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  performerTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  performerSymbol: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  performerChange: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    fontFamily: 'monospace',
  },

  // Sort
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
  },
  sortChips: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  sortChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },

  // Stock rows
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stockLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  stockRank: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    width: 24,
  },
  stockSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  stockName: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 1,
  },
  stockRight: {
    alignItems: 'flex-end',
  },
  stockPrice: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    fontFamily: 'monospace',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginTop: 2,
  },
  changeText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    fontFamily: 'monospace',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyText: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
  },
});
