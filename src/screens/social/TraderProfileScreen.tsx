/**
 * ============================================================================
 * Toroloom — Public Trader Profile Screen
 * ============================================================================
 *
 * Dedicated full-screen trader profile showing:
 *   1. Trader header/banner (avatar, name, bio, badges, risk)
 *   2. Stats grid (P&L, Returns, Win Rate, Monthly, Followers, Trades, etc.)
 *   3. P&L chart (6-month cumulative with timeframe toggle)
 *   4. Performance analytics (profit factor, avg win/loss, sharpe, etc.)
 *   5. Trade history (recent trades with entry/exit, holding period, P&L)
 *   6. Top stocks chips
 *   7. Follow / Copy action buttons (sticky bottom)
 *
 * Navigated to from SocialTradingScreen leaderboard cards.
 * ============================================================================
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Alert, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSocialStore } from '../../store/socialStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import PnLChart from '../../components/PnLChart';
import Badge from '../../components/ui/Badge';
import type {
  TraderProfile, TraderPublicTrade, TraderPnLPoint,
} from '../../types';

const { width } = Dimensions.get('window');

// ─── Mock Trade History Generator ───────────────────────────────────────────

function generateMockTrades(trader: TraderProfile): TraderPublicTrade[] {
  const symbols = trader.topStocks.length > 0
    ? [...trader.topStocks, 'NIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK']
    : ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS'];
  const directions: Array<'long' | 'short'> = ['long', 'short'];
  const setupTypes = ['breakout', 'pullback', 'trend_follow', 'reversal', 'momentum', 'gap_fill'];

  const trades: TraderPublicTrade[] = [];
  const total = Math.min(trader.totalTrades, 50);

  for (let i = total; i > 0; i--) {
    const daysAgo = i * (1 + Math.floor(Math.random() * 3));
    const entryDate = new Date(Date.now() - daysAgo * 86400000 * 1.5);
    const holdDays = 1 + Math.floor(Math.random() * (trader.avgHoldingDays * 2 || 5));
    const exitDate = new Date(entryDate.getTime() + holdDays * 86400000);
    const isOpen = i <= 2 && Math.random() > 0.6;

    const direction = directions[Math.floor(Math.random() * directions.length)];
    const basePrice = 500 + Math.random() * 4500;
    const entryPrice = Math.round(basePrice * 100) / 100;
    const pnlPercent = (Math.random() - (1 - trader.winRate / 100)) * 12;
    const exitPrice = direction === 'long'
      ? Math.round((entryPrice * (1 + pnlPercent / 100)) * 100) / 100
      : Math.round((entryPrice * (1 - pnlPercent / 100)) * 100) / 100;

    const qty = 10 + Math.floor(Math.random() * 990);
    const pnl = Math.round((exitPrice - entryPrice) * qty * (direction === 'long' ? 1 : -1) * 100) / 100;

    trades.push({
      id: `t_${trader.id}_${i}`,
      symbol: symbols[i % symbols.length],
      direction,
      entryPrice,
      exitPrice: isOpen ? 0 : exitPrice,
      quantity: qty,
      pnl: isOpen ? 0 : pnl,
      pnlPercent: isOpen ? 0 : Math.round(pnlPercent * 100) / 100,
      holdingPeriod: isOpen ? `${holdDays}d+` : `${holdDays}d`,
      entryDate: entryDate.toISOString(),
      exitDate: isOpen ? '' : exitDate.toISOString(),
      isOpen,
      setupType: setupTypes[Math.floor(Math.random() * setupTypes.length)],
      exitReason: isOpen ? undefined : (['stop_loss', 'target', 'manual', 'trailing_stop'])[Math.floor(Math.random() * 4)],
      tags: direction === 'long' ? ['breakout'] : ['hedge'],
    });
  }

  return trades;
}

// ─── Mock P&L History Generator ─────────────────────────────────────────────

function generateMockPnLHistory(trader: TraderProfile): TraderPnLPoint[] {
  const points: TraderPnLPoint[] = [];
  let cumulativePnl = 0;
  const days = 180; // ~6 months

  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // Skip weekends

    const dailyReturn = (Math.random() - 0.48) * (trader.maxDrawdown / 15 || 2);
    cumulativePnl += dailyReturn * (5000 + Math.random() * 15000);
    // Ensure it trends toward trader's totalPnl over time
    const progress = 1 - (i / days);
    cumulativePnl = cumulativePnl * 0.85 + (trader.totalPnl * progress) * 0.15;

    points.push({
      date: date.toISOString(),
      cumulativePnl: Math.round(cumulativePnl * 100) / 100,
    });
  }

  return points;
}

// ─── Performance Analytics Card ─────────────────────────────────────────────

function PerformanceAnalyticsCard({ trader }: { trader: TraderProfile }) {
  const { colors } = useTheme();

  const metrics = useMemo(() => [
    { label: 'Win Rate', value: `${trader.winRate.toFixed(1)}%`, color: trader.winRate >= 60 ? '#00E676' : trader.winRate >= 45 ? '#FFAB40' : '#FF5252', icon: 'checkmark-circle' as const },
    { label: 'Profit Factor', value: (trader.winRate / (100 - trader.winRate || 1)).toFixed(2), color: colors.primary, icon: 'trending-up' as const },
    { label: 'Avg Win', value: formatCurrency(Math.round(trader.totalPnl / trader.totalTrades * (trader.winRate / 100) * 1.5), true), color: colors.marketUp, icon: 'arrow-up-circle' as const },
    { label: 'Avg Loss', value: formatCurrency(Math.round(trader.totalPnl / trader.totalTrades * ((100 - trader.winRate) / 100) * 0.8), true), color: colors.marketDown, icon: 'arrow-down-circle' as const },
    { label: 'Best Trade', value: formatCurrency(Math.round(trader.totalPnl / trader.totalTrades * 8), true), color: colors.marketUp, icon: 'trophy' as const },
    { label: 'Worst Trade', value: formatCurrency(Math.round(trader.totalPnl / trader.totalTrades * 4), true), color: colors.marketDown, icon: 'alert-circle' as const },
    { label: 'Max Drawdown', value: `${trader.maxDrawdown.toFixed(1)}%`, color: colors.danger, icon: 'trending-down' as const },
    { label: 'Sharpe Ratio', value: ((trader.winRate - 40) / 15).toFixed(2), color: ((trader.winRate - 40) / 15) >= 1 ? '#00E676' : '#FFAB40', icon: 'analytics' as const },
    { label: 'Avg Hold', value: `${trader.avgHoldingDays}d`, color: colors.text, icon: 'time-outline' as const },
    { label: 'Consecutive Wins', value: Math.round(trader.winRate / 8).toString(), color: colors.marketUp, icon: 'flame' as const },
  ], [trader, colors]);

  return (
    <View style={analyticsStyles.container}>
      <View style={analyticsStyles.header}>
        <Ionicons name="analytics" size={18} color={colors.primary} />
        <Text style={[analyticsStyles.title, { color: colors.text }]}>Performance Analytics</Text>
      </View>
      <View style={analyticsStyles.grid}>
        {metrics.map((m, i) => (
          <View key={i} style={[analyticsStyles.metricBox, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <View style={analyticsStyles.metricTop}>
              <Ionicons name={m.icon} size={14} color={m.color} />
              <Text style={[analyticsStyles.metricValue, { color: m.color }]}>{m.value}</Text>
            </View>
            <Text style={[analyticsStyles.metricLabel, { color: colors.textMuted }]}>{m.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const analyticsStyles = StyleSheet.create({
  container: { marginTop: SPACING.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  title: { ...FONTS.semiBold, fontSize: FONTS.size.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  metricBox: {
    width: (width - SPACING.xl * 2 - SPACING.sm) / 2 - 2,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
  },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricValue: { ...FONTS.bold, fontSize: FONTS.size.md },
  metricLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 4 },
});

// ─── Trade History Row ──────────────────────────────────────────────────────

function TradeRow({ trade, colors }: { trade: TraderPublicTrade; colors: any }) {
  const isProfitable = trade.pnl > 0;
  return (
    <View style={[tradeStyles.row, { borderBottomColor: colors.divider }]}>
      <View style={tradeStyles.left}>
        <View style={tradeStyles.symbolRow}>
          <Text style={[tradeStyles.symbol, { color: colors.text }]}>{trade.symbol}</Text>
          <View style={[
            tradeStyles.directionBadge,
            { backgroundColor: trade.direction === 'long' ? '#00E67620' : '#FF525220' },
          ]}>
            <Text style={[
              tradeStyles.directionText,
              { color: trade.direction === 'long' ? '#00E676' : '#FF5252' },
            ]}>
              {trade.direction === 'long' ? 'LONG' : 'SHORT'}
            </Text>
          </View>
          {trade.isOpen && (
            <View style={[tradeStyles.openBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[tradeStyles.openText, { color: colors.primary }]}>OPEN</Text>
            </View>
          )}
        </View>
        <View style={tradeStyles.detailRow}>
          <Text style={[tradeStyles.detail, { color: colors.textMuted }]}>
            {trade.isOpen ? `Entry: ₹${trade.entryPrice.toLocaleString()}` : `₹${trade.entryPrice.toLocaleString()} → ₹${trade.exitPrice.toLocaleString()}`}
          </Text>
          {!trade.isOpen && (
            <Text style={[tradeStyles.detail, { color: colors.textMuted }]}> · {trade.holdingPeriod}</Text>
          )}
        </View>
        {trade.setupType && (
          <View style={[tradeStyles.setupBadge, { backgroundColor: colors.bgInput }]}>
            <Text style={[tradeStyles.setupText, { color: colors.textSecondary }]}>{trade.setupType}</Text>
          </View>
        )}
      </View>
      <View style={tradeStyles.right}>
        {!trade.isOpen && (
          <>
            <Text style={[tradeStyles.pnl, { color: isProfitable ? colors.marketUp : colors.marketDown }]}>
              {isProfitable ? '+' : ''}{formatCurrency(trade.pnl, true)}
            </Text>
            <Text style={[tradeStyles.pnlPercent, { color: isProfitable ? colors.marketUp : colors.marketDown }]}>
              {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
            </Text>
          </>
        )}
        {trade.isOpen && (
          <View style={[tradeStyles.runningBadge, { backgroundColor: '#FFAB4020' }]}>
            <Text style={[tradeStyles.runningText, { color: '#FFAB40' }]}>Running</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const tradeStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.md, borderBottomWidth: 1,
  },
  left: { flex: 1, gap: 4 },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  symbol: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  directionBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  directionText: { ...FONTS.bold, fontSize: 10 },
  openBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  openText: { ...FONTS.bold, fontSize: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detail: { ...FONTS.regular, fontSize: FONTS.size.xs },
  setupBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  setupText: { ...FONTS.regular, fontSize: 9, textTransform: 'capitalize' },
  right: { alignItems: 'flex-end' },
  pnl: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  pnlPercent: { ...FONTS.regular, fontSize: FONTS.size.xs },
  runningBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  runningText: { ...FONTS.medium, fontSize: 10 },
});

// ─── Main Trader Profile Screen ─────────────────────────────────────────────

export default function TraderProfileScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { traderId } = route.params;

  const {
    leaderboard, copyRelations,
    followTrader, unfollowTrader, startCopyTrading, isFollowing,
  } = useSocialStore();

  const { isFeatureAvailable } = useSubscriptionStore();
  const hasSocialAccess = isFeatureAvailable('social_trading');

  // Find trader from leaderboard or mock data
  const trader = useMemo<TraderProfile | null>(() => {
    const found = leaderboard.find(l => l.id === traderId);
    if (found) return found;
    return null;
  }, [leaderboard, traderId]);

  // Generate mock data
  const trades = useMemo(() => trader ? generateMockTrades(trader) : [], [trader]);
  const pnlHistory = useMemo(() => trader ? generateMockPnLHistory(trader) : [], [trader]);
  const [chartTimeframe, setChartTimeframe] = useState('6M');
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const displayedTrades = showAllTrades ? trades : trades.slice(0, 10);

  // ── Follow Handler ──
  const handleFollow = useCallback(async () => {
    if (!trader) return;
    if (isFollowing(trader.id)) {
      await unfollowTrader(trader.id);
    } else {
      await followTrader(trader.id);
    }
  }, [trader, isFollowing, followTrader, unfollowTrader]);

  // ── Copy Trading Start ──
  const handleStartCopy = useCallback(() => {
    if (!trader) return;
    if (!hasSocialAccess) {
      Alert.alert('Premium Feature', 'Social & Copy Trading requires an Elite subscription. Upgrade to follow and copy top traders.');
      return;
    }
    Alert.alert(
      `Copy ${trader.name}`,
      `Set allocation percentage and investment amount to start copying ${trader.name}'s trades.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '50% @ ₹2.5L',
          onPress: () => {
            startCopyTrading(trader.id, 50, 250000);
            setIsCopied(true);
          },
        },
        {
          text: '25% @ ₹1L',
          onPress: () => {
            startCopyTrading(trader.id, 25, 100000);
            setIsCopied(true);
          },
        },
      ],
    );
  }, [trader, hasSocialAccess, startCopyTrading]);

  // ── Share Profile ──
  const handleShare = useCallback(async () => {
    if (!trader) return;
    try {
      await Share.share({
        message: `Check out ${trader.name} on Toroloom — ${trader.bio}. ${trader.totalPnlPercent.toFixed(1)}% returns, ${trader.winRate.toFixed(0)}% win rate!`,
        title: `${trader.name} — Toroloom Trader Profile`,
      });
    } catch { /* ignore */ }
  }, [trader]);

  if (!trader) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="sad-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { marginTop: SPACING.md }]}>Trader not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isFollowed = isFollowing(trader.id);
  const isCopying = copyRelations.some(r => r.traderId === trader.id) || isCopied;
  const totalPnlPositive = trader.totalPnl >= 0;

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{trader.name}</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Trader Banner ─── */}
        <LinearGradient
          colors={GRADIENTS.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerRow}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{trader.name[0]}</Text>
            </View>
            <View style={styles.bannerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{trader.name}</Text>
                {trader.verified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#00E676" />
                    <Text style={styles.verifiedLabel}>Verified</Text>
                  </View>
                )}
              </View>
              <Text style={styles.bio} numberOfLines={2}>{trader.bio}</Text>
              <View style={styles.tagRow}>
                <Badge label={trader.strategy.replace(/_/g, ' · ')} variant="primary" size="medium" />
                <View style={[styles.riskBadge, {
                  backgroundColor: trader.riskScore === 'low' ? '#00E67620' : trader.riskScore === 'moderate' ? '#FFAB4020' : '#FF525220',
                }]}>
                  <Text style={[styles.riskText, {
                    color: trader.riskScore === 'low' ? '#00E676' : trader.riskScore === 'moderate' ? '#FFAB40' : '#FF5252',
                  }]}>
                    {trader.riskScore === 'low' ? 'Low Risk' : trader.riskScore === 'moderate' ? 'Moderate' : 'High Risk'}
                  </Text>
                </View>
                <Text style={styles.expText}>{trader.experienceYears}yr exp</Text>
              </View>
            </View>
          </View>
          {/* Badges */}
          {trader.badges.length > 0 && (
            <View style={styles.badgesRow}>
              {trader.badges.map(b => (
                <View key={b} style={styles.badgeChip}>
                  <Ionicons name="ribbon" size={10} color="#FFD700" />
                  <Text style={styles.badgeChipText}>{b}</Text>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>

        {/* ─── Stats Grid ─── */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Total P&L', value: `${totalPnlPositive ? '+' : ''}₹${(trader.totalPnl / 100000).toFixed(1)}L`, color: totalPnlPositive ? colors.marketUp : colors.marketDown },
            { label: 'Returns', value: `${trader.totalPnlPercent >= 0 ? '+' : ''}${trader.totalPnlPercent.toFixed(1)}%`, color: trader.totalPnlPercent >= 0 ? colors.marketUp : colors.marketDown },
            { label: 'Win Rate', value: `${trader.winRate.toFixed(0)}%`, color: trader.winRate >= 60 ? colors.marketUp : colors.marketDown },
            { label: 'Monthly', value: `${trader.monthlyReturn >= 0 ? '+' : ''}${trader.monthlyReturn.toFixed(1)}%`, color: trader.monthlyReturn >= 0 ? colors.marketUp : colors.marketDown },
            { label: 'Followers', value: trader.followers >= 1000 ? `${(trader.followers / 1000).toFixed(1)}K` : `${trader.followers}`, color: colors.text },
            { label: 'Trades', value: trader.totalTrades.toLocaleString(), color: colors.text },
            { label: 'Max DD', value: `${trader.maxDrawdown.toFixed(1)}%`, color: colors.danger },
            { label: 'Avg Hold', value: `${trader.avgHoldingDays.toFixed(1)}d`, color: colors.text },
            { label: 'Copy Traders', value: trader.copyTraders >= 1000 ? `${(trader.copyTraders / 1000).toFixed(1)}K` : `${trader.copyTraders}`, color: colors.primary },
          ].map((stat, i) => (
            <View key={i} style={[styles.statBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ─── P&L Chart ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pulse" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>P&L History</Text>
          </View>
          <PnLChart
            data={pnlHistory.map(p => ({ date: p.date, value: p.cumulativePnl, cumulativePnl: p.cumulativePnl }))}
            height={200}
            timeframe={chartTimeframe}
            onTimeframeChange={setChartTimeframe}
          />
        </View>

        {/* ─── Performance Analytics ─── */}
        <PerformanceAnalyticsCard trader={trader} />

        {/* ─── Top Stocks ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="business" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Stocks</Text>
          </View>
          <View style={styles.topStocksRow}>
            {trader.topStocks.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.stockChip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                onPress={() => navigation.navigate('StockDetail', { stockId: s, symbol: s })}
              >
                <Text style={[styles.stockChipText, { color: colors.primary }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Trade History ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Trade History</Text>
            <Text style={[styles.tradeCount, { color: colors.textMuted }]}>{trades.length} trades</Text>
          </View>

          {/* Summary row */}
          <View style={[styles.tradeSummary, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <View style={styles.tradeSummaryItem}>
              <Text style={[styles.tradeSummaryValue, { color: colors.marketUp }]}>
                {trades.filter(t => t.pnl > 0 && !t.isOpen).length}
              </Text>
              <Text style={[styles.tradeSummaryLabel, { color: colors.textMuted }]}>Won</Text>
            </View>
            <View style={styles.tradeSummaryItem}>
              <Text style={[styles.tradeSummaryValue, { color: colors.marketDown }]}>
                {trades.filter(t => t.pnl <= 0 && !t.isOpen).length}
              </Text>
              <Text style={[styles.tradeSummaryLabel, { color: colors.textMuted }]}>Lost</Text>
            </View>
            <View style={styles.tradeSummaryItem}>
              <Text style={[styles.tradeSummaryValue, { color: colors.primary }]}>
                {trades.filter(t => t.isOpen).length}
              </Text>
              <Text style={[styles.tradeSummaryLabel, { color: colors.textMuted }]}>Open</Text>
            </View>
            <View style={styles.tradeSummaryItem}>
              <Text style={[styles.tradeSummaryValue, {
                color: trades.filter(t => !t.isOpen).reduce((s, t) => s + t.pnl, 0) >= 0 ? colors.marketUp : colors.marketDown,
              }]}>
                {formatCurrency(trades.filter(t => !t.isOpen).reduce((s, t) => s + t.pnl, 0), true)}
              </Text>
              <Text style={[styles.tradeSummaryLabel, { color: colors.textMuted }]}>Net P&L</Text>
            </View>
          </View>

          {/* Trade list */}
          <View style={styles.tradeList}>
            {displayedTrades.map(trade => (
              <TradeRow key={trade.id} trade={trade} colors={colors} />
            ))}
          </View>

          {trades.length > 10 && !showAllTrades && (
            <TouchableOpacity
              style={[styles.showMoreBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
              onPress={() => setShowAllTrades(true)}
            >
              <Text style={[styles.showMoreText, { color: colors.primary }]}>
                Show All {trades.length} Trades
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
          {showAllTrades && trades.length > 10 && (
            <TouchableOpacity
              style={[styles.showMoreBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
              onPress={() => setShowAllTrades(false)}
            >
              <Text style={[styles.showMoreText, { color: colors.primary }]}>Show Less</Text>
              <Ionicons name="chevron-up" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ─── Sticky Bottom Actions ─── */}
      <LinearGradient
        colors={[colors.bg + '00', colors.bg, colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
        style={styles.bottomActionsWrapper}
      >
        <View style={styles.bottomActions}>
          <AnimatedPressable
            onPress={handleFollow}
            haptic="light"
            scaleTo={0.95}
            style={{ flex: 1 }}
          >
            <View style={[
              styles.followBtn,
              isFollowed && styles.followBtnActive,
            ]}>
              <Ionicons
                name={isFollowed ? 'people' : 'person-add-outline'}
                size={20}
                color={isFollowed ? colors.white : colors.primary}
              />
              <Text style={[
                styles.followBtnText,
                isFollowed && styles.followBtnTextActive,
              ]}>
                {isFollowed ? 'Following' : 'Follow'}
              </Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={handleStartCopy}
            haptic="medium"
            scaleTo={0.95}
            style={{ flex: 1.5 }}
          >
            <LinearGradient
              colors={isCopying ? ['#4CAF50', '#388E3C'] : GRADIENTS.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.copyBtn}
            >
              <Ionicons
                name={isCopying ? 'checkmark-circle' : 'copy-outline'}
                size={20}
                color={colors.white}
              />
              <Text style={styles.copyBtnText}>
                {isCopying ? 'Copying' : 'Copy Trader'}
              </Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </LinearGradient>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    // ── Sticky Header ──
    stickyHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 60, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md,
      backgroundColor: colors.bg,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text, flex: 1, textAlign: 'center' },
    shareBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    backBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md },

    scrollContent: { flex: 1 },
    scrollInner: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

    // ── Banner ──
    banner: { borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.lg },
    bannerRow: { flexDirection: 'row', gap: SPACING.lg },
    avatarLarge: {
      width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { ...FONTS.bold, fontSize: 32, color: colors.white },
    bannerInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    name: { ...FONTS.bold, fontSize: FONTS.size.xxl, color: colors.white },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    verifiedLabel: { ...FONTS.medium, fontSize: 10, color: '#00E676' },
    bio: { ...FONTS.regular, fontSize: FONTS.size.xs, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 16 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.md, alignItems: 'center' },
    riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
    riskText: { ...FONTS.medium, fontSize: 10 },
    expText: { ...FONTS.regular, fontSize: FONTS.size.xs, color: 'rgba(255,255,255,0.6)' },
    badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.md },
    badgeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: BORDER_RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    badgeChipText: { ...FONTS.medium, fontSize: 10, color: 'rgba(255,255,255,0.85)' },

    // ── Stats Grid ──
    statsGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg,
    },
    statBox: {
      width: (width - SPACING.xl * 2 - SPACING.sm * 2) / 3,
      borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center',
      borderWidth: 1,
    },
    statValue: { ...FONTS.bold, fontSize: FONTS.size.md },
    statLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },

    // ── Sections ──
    section: { marginBottom: SPACING.lg },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg },
    tradeCount: { ...FONTS.regular, fontSize: FONTS.size.xs, marginLeft: 'auto' },

    // ── Top Stocks ──
    topStocksRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
    stockChip: {
      paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
    },
    stockChipText: { ...FONTS.medium, fontSize: FONTS.size.xs },

    // ── Trade Summary ──
    tradeSummary: {
      flexDirection: 'row', borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
      borderWidth: 1, marginBottom: SPACING.md,
    },
    tradeSummaryItem: { flex: 1, alignItems: 'center' },
    tradeSummaryValue: { ...FONTS.bold, fontSize: FONTS.size.md },
    tradeSummaryLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },

    // ── Trade List ──
    tradeList: {},
    showMoreBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
      borderWidth: 1, marginTop: SPACING.md,
    },
    showMoreText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

    // ── Bottom Actions ──
    bottomActionsWrapper: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingTop: SPACING.xl, paddingHorizontal: SPACING.xl, paddingBottom: 40,
    },
    bottomActions: { flexDirection: 'row', gap: SPACING.md },
    followBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1.5, borderColor: colors.primary,
    },
    followBtnActive: { backgroundColor: colors.primary },
    followBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.primary },
    followBtnTextActive: { color: colors.white },
    copyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    },
    copyBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.white },

    // ── Empty ──
    emptyText: { ...FONTS.regular, fontSize: FONTS.size.md, color: colors.textMuted },
  });
