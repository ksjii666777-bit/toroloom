import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import ReanimatedAnimated, { useSharedValue, withTiming, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useMarketStore } from '../../store/marketStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
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
  const { t } = useT();
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
  const { pnlHistory, sectorAllocation, monthlyReturns, capitalGains } = analytics;
  const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false);
  const { stocks } = useMarketStore();
  const portfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0) || 1250000;
  const invested = holdings.reduce((sum, h) => sum + h.totalInvested, 0) || 1100000;
  const pnl = portfolioValue - invested;
  const _pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

  const [chartTimeframe, setChartTimeframe] = useState('1Y');
  const holdingsCount = holdings.length;
  const winningCount = holdings.filter(h => h.pnl > 0).length;
  const { animatedStyles: holdingsStyles } = useStaggeredAnimation(holdingsCount, {
    initialDelay: 200,
    staggerDelay: 70,
    duration: 400,
  });
  const { animatedStyles: tradesStyles } = useStaggeredAnimation(trades.length, {
    initialDelay: 200,
    staggerDelay: 50,
    duration: 350,
  });

  // Reanimated count-up effect for numbers
  const countUpProgress = useSharedValue(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    countUpProgress.value = 0;
    countUpProgress.value = withTiming(1, { duration: 1000 });
  }, [portfolioValue]);

  useAnimatedReaction(
    () => countUpProgress.value,
    (value) => {
      runOnJS(setDisplayProgress)(value);
    },
  );

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
          <Text style={styles.title}>{t('portfolio.title')}</Text>
          <Text style={styles.subtitle}>{t('portfolio.subtitle')}</Text>
        </View>

        {/* Portfolio Summary — Glassmorphic */}
        <View style={styles.paddingHorizontal}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t('portfolio.invested')}</Text>
                <Text style={styles.summaryValue}>{formatCurrency(displayInvested, true)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t('portfolio.currentValue')}</Text>
                <Text style={styles.summaryValue}>{formatCurrency(displayPortfolio, true)}</Text>
              </View>
            </View>

            <View style={styles.pnlContainer}>
              <Text style={styles.pnlLabel}>{t('portfolio.totalReturns')}</Text>
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
                <Text style={styles.statLabel}>{t('portfolio.holdings_short')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{trades.length}</Text>
                <Text style={styles.statLabel}>{t('portfolio.trades')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{winningCount}/{holdingsCount}</Text>
                <Text style={styles.statLabel}>{t('portfolio.winning')}</Text>
              </View>
              {a.sharpeRatio !== 0 && (
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{a.sharpeRatio.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>{t('portfolio.sharpe')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* View Toggle */}
        <View style={[styles.paddingHorizontal, styles.toggleContainer]}>
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, view === 'holdings' && styles.toggleBtnActive]}
              onPress={() => setView('holdings')}
            >
              <Text style={[styles.toggleText, view === 'holdings' && styles.toggleTextActive]}>
{t('portfolio.holdings', { count: holdings.length })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, view === 'trades' && styles.toggleBtnActive]}
              onPress={() => setView('trades')}
            >
              <Text style={[styles.toggleText, view === 'trades' && styles.toggleTextActive]}>
{t('portfolio.recentTrades')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.paddingHorizontal}>
          {view === 'holdings' ? (
            holdings.length > 0 ? (
              holdings.map((holding, i) => (
                <ReanimatedAnimated.View key={holding.id} style={holdingsStyles[i]}>
                  <PortfolioHolding
                    holding={holding}
                    onPress={(h) => navigation.navigate('StockDetail', { stockId: h.stockId, symbol: h.symbol })}
                  />
                </ReanimatedAnimated.View>
              ))
            ) : (
              <Card>
                <View style={styles.emptyState}>
                  <Ionicons name="wallet-outline" size={56} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>{t('portfolio.noHoldingsYet')}</Text>
                  <Text style={styles.emptySubtitle}>{t('portfolio.noHoldingsSubtitle')}</Text>
                  <View style={{ marginTop: SPACING.lg }}>
                    <AnimatedPressable onPress={() => navigation.navigate('Markets')} haptic="medium">
                      <View style={[styles.exploreBtn, { backgroundColor: colors.primary }]}>
                        <Ionicons name="trending-up" size={18} color={colors.white} />
                        <Text style={styles.exploreBtnText}>{t('portfolio.exploreMarkets')}</Text>
                      </View>
                    </AnimatedPressable>
                  </View>
                </View>
              </Card>
            )
          ) : (
            trades.map((trade, i) => (
              <ReanimatedAnimated.View key={trade.id} style={tradesStyles[i]}>
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
              </ReanimatedAnimated.View>
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
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('portfolio.dividendCalendar')}</Text>
                </View>
                <View style={[styles.annualChip, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.annualChipText, { color: colors.primary }]}>₹{totalAnnualDividend.toFixed(0)}{t('portfolio.annualYield')}</Text>
                </View>
              </View>

              {dividendEvents.length > 0 && (
                <View style={styles.dividendTimeline}>
                  <Text style={[styles.timelineLabel, { color: colors.textMuted }]}>{t('portfolio.upcomingEstimates')}</Text>
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
              )}

              {/* Holdings dividend summary */}
              {dividendEvents.length > 0 && (
              <View style={[styles.dividendSummary, { borderColor: colors.border }]}>
                {dividendEvents.map(d => (
                  <View key={d.symbol} style={styles.dividendSummaryRow}>
                    <View style={styles.dividendSummaryLeft}>
                      <Text style={[styles.dividendSummarySymbol, { color: colors.text }]}>{d.symbol}</Text>
                      <Text style={[styles.dividendSummaryYield, { color: colors.textMuted }]}>{d.yield}% {t('portfolio.yield')}</Text>
                    </View>
                    <View style={styles.dividendSummaryRight}>
                      <Text style={[styles.dividendSummaryQty, { color: colors.textSecondary }]}>{d.quantity} {t('portfolio.shares')}</Text>
                      <Text style={[styles.dividendSummaryAmount, { color: colors.marketUp }]}>+₹{d.annualAmount.toFixed(0)}/yr</Text>
                    </View>
                  </View>
                ))}
              </View>
              )}
            </View>
          );
        })()}

        {/* Detailed Analytics Section — Expandable */}
        <View style={[styles.paddingHorizontal, { marginTop: SPACING.lg }]}>
          <AnimatedPressable onPress={() => setShowDetailedAnalytics(!showDetailedAnalytics)} scaleTo={0.98}>
            <View style={[styles.analyticsToggle, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Ionicons name="stats-chart" size={18} color={colors.primary} />
                <Text style={[styles.analyticsToggleText, { color: colors.text }]}>{t('portfolio.detailedAnalytics')}</Text>
              </View>
              <Ionicons name={showDetailedAnalytics ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </View>
          </AnimatedPressable>

          {showDetailedAnalytics && (
            <>
              {/* Sector Allocation */}
              {sectorAllocation.length > 0 && (
                <View style={[styles.analyticsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Text style={[styles.analyticsSectionTitle, { color: colors.text }]}>{t('portfolio.sectorAllocation')}</Text>
                  {sectorAllocation.map((sector) => (
                    <View key={sector.sector} style={styles.sectorRow}>
                      <View style={styles.sectorLeft}>
                        <Text style={[styles.sectorName, { color: colors.text }]}>{sector.sector}</Text>
                        <Text style={[styles.sectorCount, { color: colors.textMuted }]}>{sector.count} {t('portfolio.holdings_short')}</Text>
                      </View>
                      <View style={styles.sectorRight}>
                        <View style={styles.sectorBarContainer}>
                          <View style={[styles.sectorBar, { width: `${sector.percent}%`, backgroundColor: colors.primary }]} />
                        </View>
                        <Text style={[styles.sectorPercent, { color: colors.text }]}>{sector.percent.toFixed(1)}%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Monthly Returns */}
              {monthlyReturns.length > 0 && (
                <View style={[styles.analyticsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Text style={[styles.analyticsSectionTitle, { color: colors.text }]}>{t('portfolio.monthlyReturns')}</Text>
                  {monthlyReturns.slice(-6).map((mr) => {
                    const isPositive = mr.returnPercent >= 0;
                    return (
                      <View key={mr.month} style={styles.monthlyRow}>
                        <Text style={[styles.monthlyLabel, { color: colors.textSecondary }]}>
                          {new Date(mr.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                        </Text>
                        <View style={styles.monthlyBarTrack}>
                          <View style={[styles.monthlyBar, {
                            width: `${Math.min(Math.abs(mr.returnPercent) * 5, 100)}%`,
                            backgroundColor: isPositive ? colors.marketUp : colors.marketDown,
                            alignSelf: isPositive ? 'flex-start' : 'flex-end',
                          }]} />
                        </View>
                        <Text style={[styles.monthlyValue, { color: isPositive ? colors.marketUp : colors.marketDown }]}>
                          {isPositive ? '+' : ''}{mr.returnPercent.toFixed(1)}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Capital Gains Summary */}
              <View style={[styles.analyticsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.analyticsSectionTitle, { color: colors.text }]}>{t('portfolio.capitalGainsTax')}</Text>
                <View style={styles.cgRow}>
                  <Text style={[styles.cgLabel, { color: colors.textSecondary }]}>{t('portfolio.shortTermGains')}</Text>
                  <Text style={[styles.cgValue, { color: capitalGains.shortTerm.gains >= 0 ? colors.marketUp : colors.marketDown }]}>
                    {formatCurrency(capitalGains.shortTerm.gains)}
                  </Text>
                </View>
                <View style={styles.cgRow}>
                  <Text style={[styles.cgLabel, { color: colors.textSecondary }]}>{t('portfolio.longTermGains')}</Text>
                  <Text style={[styles.cgValue, { color: capitalGains.longTerm.gains >= 0 ? colors.marketUp : colors.marketDown }]}>
                    {formatCurrency(capitalGains.longTerm.gains)}
                  </Text>
                </View>
                {a.winRate > 0 && (
                  <View style={styles.cgDivider} />
                )}
                {a.winRate > 0 && (
                  <>
                    <View style={styles.cgRow}>
                      <Text style={[styles.cgLabel, { color: colors.textSecondary }]}>{t('portfolio.winRate')}</Text>
                      <View style={styles.winRateContainer}>
                        <View style={[styles.winRateBar, { width: `${a.winRate}%`, backgroundColor: a.winRate >= 50 ? colors.marketUp : colors.warning }]} />
                      </View>
                      <Text style={[styles.cgValue, { color: a.winRate >= 50 ? colors.marketUp : colors.warning }]}>{a.winRate.toFixed(0)}%</Text>
                    </View>
                    <View style={styles.cgRow}>
                      <Text style={[styles.cgLabel, { color: colors.textSecondary }]}>{t('portfolio.profitFactor')}</Text>
                      <Text style={[styles.cgValue, { color: colors.text }]}>{a.profitFactor > 0 ? a.profitFactor.toFixed(2) : 'N/A'}</Text>
                    </View>
                    <View style={styles.cgRow}>
                      <Text style={[styles.cgLabel, { color: colors.textSecondary }]}>{t('portfolio.avgHold')}</Text>
                      <Text style={[styles.cgValue, { color: colors.text }]}>{a.avgHoldingDays}d</Text>
                    </View>
                    <View style={styles.cgRow}>
                      <Text style={[styles.cgLabel, { color: colors.textSecondary }]}>{t('portfolio.maxDrawdown')}</Text>
                      <Text style={[styles.cgValue, { color: colors.marketDown }]}>{a.maxDrawdownPercent.toFixed(1)}%</Text>
                    </View>
                  </>
                )}
              </View>
            </>
          )}
        </View>

        {/* Analytics CTA — Glassmorphic */}
        <AnimatedPressable onPress={() => navigation.navigate('Reports')} scaleTo={0.97}>
          <View style={[styles.analyticsCta, { backgroundColor: 'rgba(59,130,246,0.06)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.12)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={[styles.analyticsCtaIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Ionicons name="stats-chart" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.analyticsCtaTitle, { color: colors.text }]}>{t('portfolio.advancedAnalytics')}</Text>
                <Text style={[styles.analyticsCtaSub, { color: colors.textSecondary }]}>
                  P&L charts · Sharpe: {a.sharpeRatio.toFixed(1)} · Win rate: {a.winRate.toFixed(0)}% · Tax reports
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </View>
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
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  annualChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  annualChipText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
  },
  dividendTimeline: {
    marginBottom: SPACING.md,
  },
  timelineLabel: {
    ...FONTS.medium,
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
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  dividendAmount: {
    ...FONTS.bold,
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
    ...FONTS.medium,
    fontSize: 10,
  },
  dividendStockAmt: {
    ...FONTS.semiBold,
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
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  dividendSummaryYield: {
    ...FONTS.regular,
    fontSize: 10,
  },
  dividendSummaryRight: {
    alignItems: 'flex-end',
  },
  dividendSummaryQty: {
    ...FONTS.regular,
    fontSize: 10,
  },
  dividendSummaryAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
    marginTop: 1,
  },

  exploreBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.white,
  },

  // ── Detailed Analytics ──
  analyticsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  analyticsToggleText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  analyticsCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  analyticsSectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    marginBottom: SPACING.md,
  },

  // ── Sector Allocation ──
  sectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  sectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minWidth: 100,
  },
  sectorName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  sectorCount: {
    ...FONTS.regular,
    fontSize: 10,
  },
  sectorRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectorBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  sectorBar: {
    height: '100%',
    borderRadius: 3,
  },
  sectorPercent: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    minWidth: 40,
    textAlign: 'right',
  },

  // ── Monthly Returns ──
  monthlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  monthlyLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    width: 50,
  },
  monthlyBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    marginHorizontal: SPACING.sm,
    overflow: 'hidden',
  },
  monthlyBar: {
    height: '100%',
    borderRadius: 3,
  },
  monthlyValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    width: 55,
    textAlign: 'right',
  },

  // ── Capital Gains ──
  cgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  cgLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  cgValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  cgDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: SPACING.xs,
  },
  winRateContainer: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: SPACING.sm,
  },
  winRateBar: {
    height: '100%',
    borderRadius: 3,
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
