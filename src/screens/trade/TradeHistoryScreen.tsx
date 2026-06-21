import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioStore } from '../../store/portfolioStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, formatDate} from '../../utils/formatters';
import { Trade } from '../../types';

const { width } = Dimensions.get('window');

type FilterType = 'all' | 'buy' | 'sell';

export default function TradeHistoryScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { trades } = usePortfolioStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTrades = useMemo(() => {
    let result = trades;
    if (filter !== 'all') {
      result = result.filter(t => t.type === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toUpperCase();
      result = result.filter(t =>
        t.symbol.includes(q) || t.name.toUpperCase().includes(q)
      );
    }
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [trades, filter, searchQuery]);

  // Group trades by date
  const groupedTrades = useMemo(() => {
    const groups: { [key: string]: Trade[] } = {};
    filteredTrades.forEach(trade => {
      const dateKey = formatDate(trade.timestamp, 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(trade);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTrades]);

  const totalBuyValue = trades.filter(t => t.type === 'buy').reduce((s, t) => s + t.total, 0);
  const totalSellValue = trades.filter(t => t.type === 'sell').reduce((s, t) => s + t.total, 0);
  const totalTrades = trades.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Trade History</Text>
          <Text style={styles.subtitle}>{totalTrades} total trades</Text>
        </View>
        <TouchableOpacity
          style={styles.openOrdersBtn}
          onPress={() => navigation.navigate('OpenOrders')}
        >
          <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
          <Text style={styles.openOrdersBtnText}>Open</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCard}>
          <Text style={styles.statCardLabel}>Total Buys</Text>
          <Text style={styles.statCardValue}>{formatCurrency(totalBuyValue, true)}</Text>
          <Text style={styles.statCardSub}>{trades.filter(t => t.type === 'buy').length} orders</Text>
        </LinearGradient>
        <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCard}>
          <Text style={styles.statCardLabel}>Total Sells</Text>
          <Text style={styles.statCardValue}>{formatCurrency(totalSellValue, true)}</Text>
          <Text style={styles.statCardSub}>{trades.filter(t => t.type === 'sell').length} orders</Text>
        </LinearGradient>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by symbol or name..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'buy', 'sell'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <View style={[styles.filterDot, {
              backgroundColor: f === 'all' ? colors.primary : f === 'buy' ? colors.marketUp : colors.marketDown,
              opacity: filter === f ? 1 : 0.5,
            }]} />
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'buy' ? 'Buy' : 'Sell'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Trade List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {groupedTrades.length > 0 ? (
          groupedTrades.map(([dateKey, dateTrades]) => {
            const dayPnl = dateTrades.reduce((sum, t) =>
              sum + (t.type === 'sell' ? t.total : -t.total), 0
            );
            const displayDate = new Date(dateKey).toDateString() === new Date().toDateString()
              ? 'Today'
              : new Date(dateKey).toDateString() === new Date(Date.now() - 86400000).toDateString()
              ? 'Yesterday'
              : formatDate(dateKey, 'dd MMM yyyy');

            return (
              <View key={dateKey} style={styles.dateGroup}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateTitle}>{displayDate}</Text>
                  <Text style={[styles.datePnl, { color: dayPnl >= 0 ? colors.marketUp : colors.marketDown }]}>
                    {dayPnl >= 0 ? '+' : ''}{formatCurrency(dayPnl, true)}
                  </Text>
                </View>
                {dateTrades.map(trade => (
                  <TouchableOpacity
                    key={trade.id}
                    style={styles.tradeItem}
                    onPress={() => navigation.navigate('StockDetail', { stockId: trade.stockId, symbol: trade.symbol })}
                  >
                    <View style={styles.tradeLeft}>
                      <View style={[styles.tradeTypeBadge, {
                        backgroundColor: trade.type === 'buy' ? '#00C85320' : '#FF174420',
                      }]}>
                        <Ionicons
                          name={trade.type === 'buy' ? 'arrow-down' : 'arrow-up'}
                          size={16}
                          color={trade.type === 'buy' ? colors.marketUp : colors.marketDown}
                        />
                      </View>
                      <View>
                        <Text style={styles.tradeSymbol}>{trade.symbol}</Text>
                        <Text style={styles.tradeName} numberOfLines={1}>{trade.name}</Text>
                      </View>
                    </View>
                    <View style={styles.tradeRight}>
                      <Text style={styles.tradeQty}>{trade.quantity} @ {formatCurrency(trade.price)}</Text>
                      <Text style={[styles.tradeTotal, {
                        color: trade.type === 'buy' ? colors.textSecondary : colors.marketUp,
                      }]}>
                        {trade.type === 'buy' ? '-' : '+'}{formatCurrency(trade.total, true)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Trades Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'Start trading to see your history here'}
            </Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  openOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  openOrdersBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  statCardLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  statCardValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
    marginTop: 4,
  },
  statCardSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    marginHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 44,
    marginBottom: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.text,
    height: '100%',
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  dateGroup: {
    marginBottom: SPACING.lg,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  dateTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  datePnl: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  tradeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  tradeTypeBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  tradeName: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    maxWidth: width * 0.3,
  },
  tradeRight: {
    alignItems: 'flex-end',
  },
  tradeQty: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  tradeTotal: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: SPACING.sm,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 250,
  },
});
