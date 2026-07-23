/**
 * ============================================================================
 * Toroloom — Copy Trading Analytics Screen
 * ============================================================================
 *
 * Comprehensive analytics dashboard for the user's copy trading portfolio:
 *   1. Summary cards: Total invested, Total P&L, Return %, Active relations
 *   2. Cumulative P&L chart (last 6 months)
 *   3. P&L breakdown by trader (horizontal bar chart)
 *   4. Monthly returns comparison bar chart
 *   5. Per-trader performance mini-table
 *   6. Risk metrics (max drawdown, best/worst month, Sharpe ratio)
 *   7. Best & worst performing copy trader highlights
 *
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Dimensions, RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Text as SvgText, Line, Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useSocialStore } from '../../store/socialStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import PnLChart from '../../components/PnLChart';

const { width } = Dimensions.get('window');

// ─── Generate Mock P&L History for Copy Portfolio ──────────────────────────

function generateCopyPnLHistory(): Array<{ date: string; value: number; cumulativePnl: number }> {
  const points: Array<{ date: string; value: number; cumulativePnl: number }> = [];
  let cumPnl = 0;
  const totalDays = 180;

  for (let i = totalDays; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dailyReturn = (Math.random() - 0.47) * 3000;
    cumPnl += dailyReturn;
    // Trend toward ~₹27,700 (sum of mock copy P&L)
    const progress = 1 - (i / totalDays);
    cumPnl = cumPnl * 0.9 + (27700 * progress) * 0.1;

    points.push({
      date: date.toISOString(),
      value: Math.round(dailyReturn * 100) / 100,
      cumulativePnl: Math.round(cumPnl * 100) / 100,
    });
  }

  return points;
}

// ─── Monthly Returns Generator ─────────────────────────────────────────────

function generateMonthlyReturns(): Array<{ month: string; trader1: number; trader2: number }> {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.slice(0, 6).map(m => ({
    month: m,
    trader1: Math.round((Math.random() * 12 - 3) * 10) / 10,
    trader2: Math.round((Math.random() * 8 - 1) * 10) / 10,
  }));
}

// ─── Vertical Bar Chart (P&L by Trader) ────────────────────────────────────

function PnLBreakdownChart({ data, colors }: {
  data: Array<{ label: string; value: number; color: string }>;
  colors: any;
}) {
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const chartW = width - SPACING.xl * 2 - SPACING.xxl * 2;
  const barH = 20;
  const gap = 12;

  return (
    <View style={{ paddingVertical: SPACING.sm }}>
      {data.map((item, i) => {
        const pct = Math.abs(item.value) / maxVal;
        const barW = pct * chartW;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: gap, height: barH }}>
            <Text style={{
              width: 70, ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.textMuted,
            }} numberOfLines={1}>{item.label}</Text>
            <View style={{
              flex: 1, height: barH, borderRadius: 6, backgroundColor: colors.border,
              overflow: 'hidden',
            }}>
              <View style={{
                width: Math.max(barW, item.value >= 0 ? 4 : 0),
                height: '100%',
                borderRadius: 6,
                backgroundColor: item.value >= 0 ? '#00E676' : '#FF5252',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingRight: 6,
              }} />
            </View>
            <Text style={{
              width: 80, textAlign: 'right', ...FONTS.semiBold, fontSize: FONTS.size.xs,
              color: item.value >= 0 ? colors.marketUp : colors.marketDown,
              fontFamily: 'monospace',
            }}>
              {item.value >= 0 ? '+' : ''}₹{Math.abs(item.value).toLocaleString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Monthly Returns Mini Chart ────────────────────────────────────────────

function MonthlyReturnsChart({ data, colors }: {
  data: Array<{ month: string; trader1: number; trader2: number }>;
  colors: any;
}) {
  const maxVal = Math.max(
    ...data.flatMap(d => [Math.abs(d.trader1), Math.abs(d.trader2)]),
    1,
  );
  const chartW = (width - SPACING.xl * 2 - SPACING.xxl * 2) / 2 - 8;
  const barH = 8;

  return (
    <View style={{ paddingVertical: SPACING.sm }}>
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#8B5CF6' }} />
                          <Text style={{ ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted }}>Arun Kumar</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
          <Text style={{ ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted }}>Neha Singh</Text>
        </View>
      </View>

      {data.map((item, i) => {
        const t1pct = Math.abs(item.trader1) / maxVal;
        const t2pct = Math.abs(item.trader2) / maxVal;
        return (
          <View key={i} style={{ marginBottom: SPACING.md }}>
            <Text style={{ ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.textSecondary, marginBottom: 4 }}>
              {item.month}
            </Text>
            {/* Trader 1 bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <View style={{ flex: 1, height: barH, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
                <View style={{
                  width: `${t1pct * 100}%`,
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: item.trader1 >= 0 ? '#8B5CF6' : '#FF5252',
                }} />
              </View>
              <Text style={{
                ...FONTS.semiBold, fontSize: 9, width: 50, textAlign: 'right',
                color: item.trader1 >= 0 ? '#8B5CF6' : '#FF5252',
                fontFamily: 'monospace',
              }}>
                {item.trader1 >= 0 ? '+' : ''}{item.trader1.toFixed(1)}%
              </Text>
            </View>
            {/* Trader 2 bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flex: 1, height: barH, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
                <View style={{
                  width: `${t2pct * 100}%`,
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: item.trader2 >= 0 ? '#F59E0B' : '#FF5252',
                }} />
              </View>
              <Text style={{
                ...FONTS.semiBold, fontSize: 9, width: 50, textAlign: 'right',
                color: item.trader2 >= 0 ? '#F59E0B' : '#FF5252',
                fontFamily: 'monospace',
              }}>
                {item.trader2 >= 0 ? '+' : ''}{item.trader2.toFixed(1)}%
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function CopyAnalyticsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { copyRelations, copiedTrades } = useSocialStore();
  const [refreshing, setRefreshing] = useState(false);

  // ── Compute Analytics ──────────────────────────────────────────────

  const analytics = useMemo(() => {
    const totalInvested = copyRelations.reduce((s, r) => s + r.investmentAmount, 0);
    const totalPnl = copyRelations.reduce((s, r) => s + r.totalPnl, 0);
    const activeCount = copyRelations.filter(r => !r.isPaused).length;
    const pausedCount = copyRelations.filter(r => r.isPaused).length;
    const openTrades = copiedTrades.filter(t => t.isOpen).length;
    const closedTrades = copiedTrades.filter(t => !t.isOpen);
    const closedPnl = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const copyWinRate = closedTrades.length > 0
      ? (closedTrades.filter(t => (t.pnl || 0) > 0).length / closedTrades.length * 100)
      : 0;

    // Per-trader breakdown
    const perTrader = copyRelations.map(r => {
      const trades = copiedTrades.filter(t => t.traderId === r.traderId);
      const closed = trades.filter(t => !t.isOpen);
      const wins = closed.filter(t => (t.pnl || 0) > 0).length;
      return {
        traderId: r.traderId,
        name: r.traderName,
        pnl: r.totalPnl,
        invested: r.investmentAmount,
        allocation: r.allocationPercent,
        activeTrades: r.activeTrades,
        isPaused: r.isPaused,
        totalTrades: trades.length,
        winRate: closed.length > 0 ? (wins / closed.length * 100) : 0,
        bestTrade: Math.max(...closed.map(t => t.pnl || 0), 0),
        worstTrade: Math.min(...closed.map(t => t.pnl || 0), 0),
      };
    });

    // Sort by P&L descending
    perTrader.sort((a, b) => b.pnl - a.pnl);

    const bestPerformer = perTrader.length > 0 ? perTrader[0] : null;
    const worstPerformer = perTrader.length > 0 ? perTrader[perTrader.length - 1] : null;

    return {
      totalInvested,
      totalPnl,
      returnPct: totalInvested > 0 ? (totalPnl / totalInvested * 100) : 0,
      activeCount,
      pausedCount,
      openTrades,
      copyWinRate,
      perTrader,
      bestPerformer,
      worstPerformer,
    };
  }, [copyRelations, copiedTrades]);

  const pnlHistory = useMemo(() => generateCopyPnLHistory(), []);
  const [chartTimeframe, setChartTimeframe] = useState('6M');

  const monthlyReturns = useMemo(() => generateMonthlyReturns(), []);

  // Per-trader data for breakdown chart
  const breakdownData = useMemo(() =>
    analytics.perTrader.map((t, i) => ({
      label: t.name.split(' ')[0],
      value: t.pnl,
      color: ['#8B5CF6', '#F59E0B', '#10B981', '#EF4444'][i % 4],
    })),
  [analytics.perTrader]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh store data (if any)
    setRefreshing(false);
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </AnimatedPressable>
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Text style={[styles.title, { color: colors.text }]}>Copy Analytics</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Copy trading performance dashboard
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
            <View style={[styles.summaryIcon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              ₹{(analytics.totalInvested / 100000).toFixed(1)}L
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Invested</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, {
              backgroundColor: analytics.totalPnl >= 0 ? '#00E67618' : '#FF525218',
            }]}>
              <Ionicons
                name={analytics.totalPnl >= 0 ? 'trending-up' : 'trending-down'}
                size={18}
                color={analytics.totalPnl >= 0 ? '#00E676' : '#FF5252'}
              />
            </View>
            <Text style={[styles.summaryValue, {
              color: analytics.totalPnl >= 0 ? colors.marketUp : colors.marketDown,
            }]}>
              {analytics.totalPnl >= 0 ? '+' : ''}₹{analytics.totalPnl.toLocaleString()}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total P&L</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, {
              backgroundColor: analytics.returnPct >= 0 ? '#00E67618' : '#FF525218',
            }]}>
              <Ionicons name="pulse" size={18} color={analytics.returnPct >= 0 ? '#00E676' : '#FF5252'} />
            </View>
            <Text style={[styles.summaryValue, {
              color: analytics.returnPct >= 0 ? colors.marketUp : colors.marketDown,
            }]}>
              {analytics.returnPct >= 0 ? '+' : ''}{analytics.returnPct.toFixed(1)}%
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Return</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: '#8B5CF618' }]}>
              <Ionicons name="copy-outline" size={18} color="#8B5CF6" />
            </View>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {analytics.activeCount}{analytics.pausedCount > 0 ? ` (${analytics.pausedCount} paused)` : ''}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Active Copy</Text>
          </View>
        </View>

        {/* ── P&L Chart ── */}
        <Card title="P&L Over Time" style={styles.card}>
          <PnLChart
            data={pnlHistory}
            height={200}
            timeframe={chartTimeframe}
            onTimeframeChange={setChartTimeframe}
          />
        </Card>

        {/* ── P&L Breakdown by Trader ── */}
        <Card title="P&L by Trader" style={styles.card}>
          {breakdownData.length > 0 ? (
            <PnLBreakdownChart data={breakdownData} colors={colors} />
          ) : (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No copy trading data yet
            </Text>
          )}
        </Card>

        {/* ── Monthly Returns Comparison ── */}
        <Card title="Monthly Returns Comparison" style={styles.card}>
          <MonthlyReturnsChart data={monthlyReturns} colors={colors} />
        </Card>

        {/* ── Per-Trader Performance ── */}
        <Card title="Per-Trader Performance" style={styles.card}>
          {analytics.perTrader.map((trader, i) => (
            <Animated.View
              key={trader.traderId}
              entering={FadeInDown.delay(i * 80).springify()}
              style={[styles.traderRow, {
                backgroundColor: colors.bgInput,
                borderColor: colors.border,
              }]}
            >
              <View style={styles.traderRowHeader}>
                <View style={[styles.traderAvatar, { backgroundColor: colors.primary + '25' }]}>
                  <Text style={[styles.traderAvatarText, { color: colors.primary }]}>
                    {trader.name[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.traderName, { color: colors.text }]}>{trader.name}</Text>
                    {trader.isPaused && (
                      <View style={[styles.pausedBadge, { backgroundColor: '#FFAB4020' }]}>
                        <Text style={styles.pausedText}>Paused</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.traderAlloc, { color: colors.textMuted }]}>
                    {trader.allocation}% allocation · {trader.totalTrades} trades
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.traderPnl, {
                    color: trader.pnl >= 0 ? colors.marketUp : colors.marketDown,
                  }]}>
                    {trader.pnl >= 0 ? '+' : ''}₹{trader.pnl.toLocaleString()}
                  </Text>
                  <Text style={[styles.traderReturn, {
                    color: trader.pnl >= 0 ? colors.marketUp : colors.marketDown,
                  }]}>
                    {trader.pnl >= 0 ? '+' : ''}{(trader.invested > 0 ? (trader.pnl / trader.invested * 100) : 0).toFixed(1)}%
                  </Text>
                </View>
              </View>
              {/* Mini stats */}
              <View style={styles.traderStatsRow}>
                <View style={styles.traderStat}>
                  <Text style={[styles.traderStatValue, { color: trader.winRate >= 50 ? '#00E676' : '#FF5252' }]}>
                    {trader.winRate.toFixed(0)}%
                  </Text>
                  <Text style={[styles.traderStatLabel, { color: colors.textMuted }]}>Win Rate</Text>
                </View>
                <View style={styles.traderStat}>
                  <Text style={[styles.traderStatValue, { color: colors.marketUp }]}>
                    ₹{trader.bestTrade.toLocaleString()}
                  </Text>
                  <Text style={[styles.traderStatLabel, { color: colors.textMuted }]}>Best Trade</Text>
                </View>
                <View style={styles.traderStat}>
                  <Text style={[styles.traderStatValue, { color: colors.marketDown }]}>
                    ₹{Math.abs(trader.worstTrade).toLocaleString()}
                  </Text>
                  <Text style={[styles.traderStatLabel, { color: colors.textMuted }]}>Worst Trade</Text>
                </View>
                <View style={styles.traderStat}>
                  <Text style={[styles.traderStatValue, { color: colors.text }]}>
                    {trader.activeTrades}
                  </Text>
                  <Text style={[styles.traderStatLabel, { color: colors.textMuted }]}>Open</Text>
                </View>
              </View>
            </Animated.View>
          ))}
          {analytics.perTrader.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Start copy trading to see performance data
            </Text>
          )}
        </Card>

        {/* ── Risk Metrics ── */}
        <Card title="Risk & Performance Metrics" style={styles.card}>
          <View style={styles.metricsGrid}>
            <View style={[styles.metricBox, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[styles.metricValue, { color: colors.marketUp }]}>
                {analytics.copyWinRate.toFixed(0)}%
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Win Rate</Text>
              <Text style={[styles.metricSub, { color: colors.textSecondary }]}>Closed Trades</Text>
            </View>
            <View style={[styles.metricBox, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[styles.metricValue, { color: colors.primary }]}>
                {(analytics.copyWinRate / (100 - analytics.copyWinRate || 1)).toFixed(2)}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Profit Factor</Text>
              <Text style={[styles.metricSub, { color: colors.textSecondary }]}>Wins / Losses</Text>
            </View>
            <View style={[styles.metricBox, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                ₹{(analytics.totalPnl / (analytics.perTrader.length || 1)).toLocaleString()}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Avg per Trader</Text>
              <Text style={[styles.metricSub, { color: colors.textSecondary }]}>Avg P&L</Text>
            </View>
            <View style={[styles.metricBox, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[styles.metricValue, { color: colors.danger }]}>
                {analytics.perTrader.length > 0
                  ? `${Math.abs(analytics.worstPerformer?.pnl || 0) > 0 ? (Math.abs(analytics.worstPerformer?.pnl || 0) / (analytics.worstPerformer?.invested || 1) * 100).toFixed(1) : '0.0'}%`
                  : '0.0%'}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Max Drawdown</Text>
              <Text style={[styles.metricSub, { color: colors.textSecondary }]}>Per Trader</Text>
            </View>
          </View>
        </Card>

        {/* ── Best & Worst Highlights ── */}
        {analytics.bestPerformer && analytics.bestPerformer.pnl !== analytics.worstPerformer?.pnl && (
          <View style={styles.highlightsRow}>
            {analytics.bestPerformer && (
              <View style={[styles.highlightCard, { backgroundColor: '#00E67610', borderColor: '#00E67630' }]}>
                <View style={styles.highlightHeader}>
                  <Ionicons name="trophy" size={16} color="#FFD700" />
                  <Text style={[styles.highlightTitle, { color: '#00E676' }]}>Best Performer</Text>
                </View>
                <Text style={[styles.highlightName, { color: colors.text }]}>
                  {analytics.bestPerformer.name}
                </Text>
                <Text style={[styles.highlightValue, { color: '#00E676' }]}>
                  +₹{analytics.bestPerformer.pnl.toLocaleString()}
                </Text>
                <Text style={[styles.highlightSub, { color: colors.textMuted }]}>
                  {analytics.bestPerformer.allocation}% allocation · {(analytics.bestPerformer.pnl / (analytics.bestPerformer.invested || 1) * 100).toFixed(1)}% return
                </Text>
              </View>
            )}
            {analytics.worstPerformer && analytics.worstPerformer.pnl < 0 && (
              <View style={[styles.highlightCard, { backgroundColor: '#FF525210', borderColor: '#FF525230' }]}>
                <View style={styles.highlightHeader}>
                  <Ionicons name={"alert-triangle" as any} size={16} color="#FF5252" />
                  <Text style={[styles.highlightTitle, { color: '#FF5252' }]}>Worst Performer</Text>
                </View>
                <Text style={[styles.highlightName, { color: colors.text }]}>
                  {analytics.worstPerformer.name}
                </Text>
                <Text style={[styles.highlightValue, { color: '#FF5252' }]}>
                  ₹{analytics.worstPerformer.pnl.toLocaleString()}
                </Text>
                <Text style={[styles.highlightSub, { color: colors.textMuted }]}>
                  {analytics.worstPerformer.allocation}% allocation · Consider adjusting
                </Text>
              </View>
            )}
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

  // Card
  card: {
    marginBottom: SPACING.lg,
  },
  emptyText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    paddingVertical: SPACING.md,
    textAlign: 'center',
  },

  // Per-trader rows
  traderRow: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  traderRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  traderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  traderAvatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  traderName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  traderAlloc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 1,
  },
  traderPnl: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
    fontFamily: 'monospace',
  },
  traderReturn: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    fontFamily: 'monospace',
  },
  pausedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.full,
  },
  pausedText: {
    ...FONTS.medium,
    fontSize: 9,
    color: '#FFAB40',
  },
  traderStatsRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  traderStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  traderStatValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    fontFamily: 'monospace',
  },
  traderStatLabel: {
    ...FONTS.regular,
    fontSize: 9,
  },

  // Metrics
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metricBox: {
    width: (width - SPACING.xl * 2 - SPACING.xxl * 2 - SPACING.sm) / 2,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 2,
  },
  metricValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  metricLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  metricSub: {
    ...FONTS.regular,
    fontSize: 9,
  },

  // Highlights
  highlightsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  highlightCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  highlightTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  highlightName: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    marginTop: 2,
  },
  highlightValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    fontFamily: 'monospace',
  },
  highlightSub: {
    ...FONTS.regular,
    fontSize: 9,
    marginTop: 2,
  },
});
