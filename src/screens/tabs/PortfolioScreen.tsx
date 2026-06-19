import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useMarketStore } from '../../store/marketStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import PortfolioHolding from '../../components/PortfolioHolding';
import PnLChart from '../../components/PnLChart';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';
import { SkeletonBlock, SkeletonCard, PortfolioSkeleton } from '../../components/ui/SkeletonLoader';

const { width } = Dimensions.get('window');

export default function PortfolioScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { holdings, trades } = usePortfolioStore();
  const [view, setView] = useState<'holdings' | 'trades'>('holdings');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const analytics = usePortfolioAnalyticsStore(s => s.getAnalytics());
  const a = analytics.metrics;
  const { pnlHistory } = analytics;
  const { stocks } = useMarketStore();
  const portfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0) || 1250000;
  const invested = holdings.reduce((sum, h) => sum + h.totalInvested, 0) || 1100000;
  const pnl = portfolioValue - invested;
  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

  const [chartTimeframe, setChartTimeframe] = useState('1Y');
  const holdingsCount = holdings.length;
  const winningCount = holdings.filter(h => h.pnl > 0).length;
  const { getAnimatedStyle: getHoldingsStyle } = useStaggeredAnimation(holdingsCount, {
    initialDelay: 200,
    staggerDelay: 70,
    duration: 400,
  });
  const { getAnimatedStyle: getTradesStyle } = useStaggeredAnimation(trades.length, {
    initialDelay: 200,
    staggerDelay: 50,
    duration: 350,
  });

  // Animated count-up effect for numbers
  const countUpAnim = useRef(new Animated.Value(0)).current;
  const [displayProgress, setDisplayProgress] = useState(0);
  useEffect(() => {
    countUpAnim.setValue(0);
    Animated.timing(countUpAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
    const listener = countUpAnim.addListener(({ value }) => {
      setDisplayProgress(value);
    });
    return () => countUpAnim.removeListener(listener);
  }, [portfolioValue, countUpAnim]);

  // Smooth transition values
  const displayInvested = invested;
  const displayPortfolio = invested + (portfolioValue - invested) * displayProgress;
  const displayPnl = displayPortfolio - invested;
  const displayPnlPercent = invested > 0 ? (displayPnl / invested) * 100 : 0;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <SkeletonBlock width="40%" height={28} />
            <View style={{ height: 4 }} />
            <SkeletonBlock width="30%" height={14} />
          </View>
          <View style={styles.paddingHorizontal}>
            <PortfolioSkeleton />
            <SkeletonBlock width="100%" height={40} borderRadius={8} />
            <View style={{ height: SPACING.lg }} />
            {[1, 2, 3].map(i => <SkeletonCard key={i} hasAvatar hasAction={false} />)}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgSecondary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
          <Text style={styles.subtitle}>Track your investments</Text>
        </View>

        {/* Portfolio Summary */}
        <View style={styles.paddingHorizontal}>
          <LinearGradient colors={GRADIENTS.midnight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Invested</Text>
                <Text style={styles.summaryValue}>{formatCurrency(displayInvested, true)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Current Value</Text>
                <Text style={styles.summaryValue}>{formatCurrency(displayPortfolio, true)}</Text>
              </View>
            </View>

            <View style={styles.pnlContainer}>
              <Text style={styles.pnlLabel}>Total Returns</Text>
              <View style={styles.pnlRow}>
                <Text style={[styles.pnlValue, { color: displayPnl >= 0 ? colors.marketUp : colors.marketDown }]}>
                  {displayPnl >= 0 ? '+' : ''}{formatCurrency(displayPnl, true)}
                </Text>
                <View style={[styles.pnlBadge, { backgroundColor: displayPnl >= 0 ? '#00C85320' : '#FF174420' }]}>
                  <Ionicons name={displayPnl >= 0 ? 'caret-up' : 'caret-down'} size={16} color={displayPnl >= 0 ? colors.marketUp : colors.marketDown} />
                  <Text style={[styles.pnlBadgeText, { color: displayPnl >= 0 ? colors.marketUp : colors.marketDown }]}>
                    {formatPercent(displayPnlPercent)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Interactive P&L Chart */}
            <View style={styles.chartContainer}>
              <PnLChart
                data={pnlHistory}
                height={160}
                width={width - SPACING.xl * 4}
                timeframe={chartTimeframe}
                onTimeframeChange={setChartTimeframe}
              />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{holdingsCount}</Text>
                <Text style={styles.statLabel}>Holdings</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{trades.length}</Text>
                <Text style={styles.statLabel}>Trades</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{winningCount}/{holdingsCount}</Text>
                <Text style={styles.statLabel}>Winning</Text>
              </View>
              {a.sharpeRatio !== 0 && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{a.sharpeRatio.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Sharpe</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* View Toggle */}
        <View style={[styles.paddingHorizontal, styles.toggleContainer]}>
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, view === 'holdings' && styles.toggleBtnActive]}
              onPress={() => setView('holdings')}
            >
              <Text style={[styles.toggleText, view === 'holdings' && styles.toggleTextActive]}>
                Holdings ({holdings.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, view === 'trades' && styles.toggleBtnActive]}
              onPress={() => setView('trades')}
            >
              <Text style={[styles.toggleText, view === 'trades' && styles.toggleTextActive]}>
                Recent Trades
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.paddingHorizontal}>
          {view === 'holdings' ? (
            holdings.length > 0 ? (
              holdings.map((holding, i) => (
                <Animated.View key={holding.id} style={getHoldingsStyle(i)}>
                  <PortfolioHolding
                    holding={holding}
                    onPress={(h) => navigation.navigate('StockDetail', { stockId: h.stockId, symbol: h.symbol })}
                  />
                </Animated.View>
              ))
            ) : (
              <Card>
                <View style={styles.emptyState}>
                  <Ionicons name="wallet-outline" size={56} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No Holdings Yet</Text>
                  <Text style={styles.emptySubtitle}>Start investing to build your portfolio</Text>
                  <View style={{ marginTop: SPACING.lg }}>
                    <AnimatedPressable onPress={() => navigation.navigate('Markets')} haptic="medium">
                      <View style={[styles.exploreBtn, { backgroundColor: colors.primary }]}>
                        <Ionicons name="trending-up" size={18} color={colors.white} />
                        <Text style={styles.exploreBtnText}>Explore Markets</Text>
                      </View>
                    </AnimatedPressable>
                  </View>
                </View>
              </Card>
            )
          ) : (
            trades.map((trade, i) => (
              <Animated.View key={trade.id} style={getTradesStyle(i)}>
                <AnimatedPressable
                  onPress={() => navigation.navigate('StockDetail', { stockId: trade.stockId, symbol: trade.symbol })}
                  haptic="selection"
                  scaleTo={0.98}
                >
                  <View style={styles.tradeItem}>
                    <View style={styles.tradeLeft}>
                      <View style={[styles.tradeType, { backgroundColor: trade.type === 'buy' ? '#00C85320' : '#FF174420' }]}>
                        <Ionicons name={trade.type === 'buy' ? 'arrow-down' : 'arrow-up'} size={14} color={trade.type === 'buy' ? colors.marketUp : colors.marketDown} />
                      </View>
                      <View>
                        <Text style={styles.tradeSymbol}>{trade.symbol}</Text>
                        <Text style={styles.tradeName}>{trade.name}</Text>
                      </View>
                    </View>
                    <View style={styles.tradeRight}>
                      <Text style={styles.tradeQty}>{trade.quantity} × {formatCurrency(trade.price)}</Text>
                      <Text style={[styles.tradeTotal, { color: trade.type === 'buy' ? colors.text : colors.marketUp }]}>
                        {trade.type === 'buy' ? '-' : '+'}{formatCurrency(trade.total, true)}
                      </Text>
                    </View>
                  </View>
                </AnimatedPressable>
              </Animated.View>
            ))
          )}
        </View>

        {/* Dividend Calendar */}
        {holdings.length > 0 && (() => {
          // Estimate dividend events from holdings stock data
          const dividendEvents = holdings.map(h => {
            const stock = stocks.find(s => s.id === h.stockId);
            if (!stock || stock.dividend <= 0) return null;
            const annualDividendPerShare = (stock.dividend / 100) * stock.price;
            const estimatedQuarterly = annualDividendPerShare / 4;
            const estimatedAnnual = estimatedQuarterly * h.quantity;
            // Create upcoming dates for next 4 quarters
            const now = new Date();
            const currentQuarter = Math.floor(now.getMonth() / 3);
            const upcoming: { month: string; amount: number }[] = [];
            for (let q = 0; q < 4; q++) {
              const quarterMonth = (currentQuarter + q) % 4 * 3;
              const year = now.getFullYear() + Math.floor((currentQuarter + q) / 4);
              const monthStr = new Date(year, quarterMonth, 15).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
              upcoming.push({ month: monthStr, amount: estimatedQuarterly * h.quantity });
            }
            return { symbol: h.symbol, name: h.name, yield: stock.dividend, annualAmount: estimatedAnnual, upcoming, quantity: h.quantity };
          }).filter(Boolean) as { symbol: string; name: string; yield: number; annualAmount: number; upcoming: { month: string; amount: number }[]; quantity: number }[];

          const totalAnnualDividend = dividendEvents.reduce((s, d) => s + d.annualAmount, 0);

          return (
            <View style={styles.dividendSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Dividend Calendar</Text>
                </View>
                <View style={[styles.annualChip, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.annualChipText, { color: colors.primary }]}>₹{totalAnnualDividend.toFixed(0)}/yr</Text>
                </View>
              </View>

              <View style={styles.dividendTimeline}>
                <Text style={[styles.timelineLabel, { color: colors.textMuted }]}>Upcoming Estimates</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dividendScroll}>
                  {dividendEvents[0]?.upcoming.map((event, ei) => {
                    const totalForMonth = dividendEvents.reduce((s, d) => s + (d.upcoming[ei]?.amount || 0), 0);
                    return (
                      <View key={ei} style={[styles.dividendChip, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.dividendMonth, { color: colors.textSecondary }]}>{event.month}</Text>
                        <Text style={[styles.dividendAmount, { color: colors.marketUp }]}>+₹{totalForMonth.toFixed(0)}</Text>
                        <View style={styles.dividendStocks}>
                          {dividendEvents.map((d, di) => {
                            const amt = d.upcoming[ei]?.amount || 0;
                            if (amt <= 0) return null;
                            return (
                              <View key={di} style={styles.dividendStockRow}>
                                <Text style={[styles.dividendStockSymbol, { color: colors.textMuted }]}>{d.symbol}</Text>
                                <Text style={[styles.dividendStockAmt, { color: colors.textMuted }]}>₹{amt.toFixed(0)}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Holdings dividend summary */}
              <View style={[styles.dividendSummary, { borderColor: colors.border }]}>
                {dividendEvents.map(d => (
                  <View key={d.symbol} style={styles.dividendSummaryRow}>
                    <View style={styles.dividendSummaryLeft}>
                      <Text style={[styles.dividendSummarySymbol, { color: colors.text }]}>{d.symbol}</Text>
                      <Text style={[styles.dividendSummaryYield, { color: colors.textMuted }]}>{d.yield}% yield</Text>
                    </View>
                    <View style={styles.dividendSummaryRight}>
                      <Text style={[styles.dividendSummaryQty, { color: colors.textSecondary }]}>{d.quantity} shares</Text>
                      <Text style={[styles.dividendSummaryAmount, { color: colors.marketUp }]}>+₹{d.annualAmount.toFixed(0)}/yr</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* Analytics CTA */}
        <AnimatedPressable onPress={() => navigation.navigate('Reports')} scaleTo={0.97}>
          <LinearGradient colors={GRADIENTS.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.analyticsCta}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={styles.analyticsCtaIcon}>
                <Ionicons name="stats-chart" size={24} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.analyticsCtaTitle}>Advanced Analytics</Text>
                <Text style={styles.analyticsCtaSub}>
                  P&L charts · Sharpe: {a.sharpeRatio.toFixed(1)} · Win rate: {a.winRate.toFixed(0)}% · Tax reports
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
            </View>
          </LinearGradient>
        </AnimatedPressable>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  paddingHorizontal: {
    paddingHorizontal: SPACING.xl,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
    marginTop: 4,
  },
  summaryCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: SPACING.lg,
  },
  pnlContainer: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  pnlLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  pnlValue: {
    ...FONTS.black,
    fontSize: FONTS.size.xxxl,
  },
  pnlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    gap: 2,
  },
  pnlBadgeText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  chartContainer: {
    marginTop: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.xl,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggleContainer: {
    marginBottom: SPACING.lg,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  // ── Analytics CTA ──
  analyticsCta: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  analyticsCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsCtaTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.white,
  },
  analyticsCtaSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // ── Dividend Calendar ──
  dividendSection: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: FONTS.size.lg,
  },
  annualChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  annualChipText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: FONTS.size.xs,
  },
  dividendTimeline: {
    marginBottom: SPACING.md,
  },
  timelineLabel: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  dividendScroll: {
    marginHorizontal: -SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  dividendChip: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginRight: SPACING.sm,
    minWidth: 140,
  },
  dividendMonth: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: FONTS.size.xs,
  },
  dividendAmount: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: FONTS.size.md,
    marginTop: 4,
  },
  dividendStocks: {
    marginTop: SPACING.sm,
    gap: 3,
  },
  dividendStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dividendStockSymbol: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 10,
  },
  dividendStockAmt: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 10,
  },
  dividendSummary: {
    borderTopWidth: 1,
    paddingTop: SPACING.md,
  },
  dividendSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  dividendSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dividendSummarySymbol: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.sm,
  },
  dividendSummaryYield: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 10,
  },
  dividendSummaryRight: {
    alignItems: 'flex-end',
  },
  dividendSummaryQty: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 10,
  },
  dividendSummaryAmount: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: FONTS.size.sm,
    marginTop: 1,
  },

  exploreBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.white,
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
  },
  tradeType: {
    width: 32,
    height: 32,
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
});
