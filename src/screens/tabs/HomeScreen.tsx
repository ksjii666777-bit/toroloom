import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl, Animated } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { useMarketStore } from '../../store/marketStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useGamificationStore } from '../../store/gamificationStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useAIStore } from '../../store/aiStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import MarketCard from '../../components/MarketCard';
import StockItem from '../../components/StockItem';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';
import { SkeletonBlock, PortfolioSkeleton } from '../../components/ui/SkeletonLoader';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const { indices, stocks } = useMarketStore();
  const { holdings, trades } = usePortfolioStore();
  const { userLevel, badges } = useGamificationStore();
  const { notifications } = useNotificationStore();
  const { insights } = useAIStore();

  const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
  const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalPnl = currentValue - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Dynamic greeting ────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // ── Market status (weekdays 9:15 AM - 3:30 PM) ──
  const day = new Date().getDay();
  const isMarketOpen = day >= 1 && day <= 5 && ((hour > 9 || (hour === 9 && new Date().getMinutes() >= 15)) && (hour < 15 || (hour === 15 && new Date().getMinutes() <= 30)));

  // ── Market Breadth ───────────────────────────────────────────
  const advancing = stocks.filter(s => s.changePercent > 0).length;
  const declining = stocks.filter(s => s.changePercent < 0).length;
  const unchanged = stocks.length - advancing - declining;

  // ── Recent Trades ───────────────────────────────────────────
  const recentTrades = [...trades].slice(0, 3);

  // ── Top Holdings ────────────────────────────────────────────
  const topHoldings = [...holdings]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 3);

  // ── AI Insight ──────────────────────────────────────────────
  const topInsight = insights.length > 0 ? insights[0] : null;

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Count-up animation via setInterval (works with fake timers in tests)
  const [displayProgress, setDisplayProgress] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setDisplayProgress(0);
    const duration = 500;
    const steps = 25;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= steps) {
        setDisplayProgress(1);
        clearInterval(interval);
      } else {
        setDisplayProgress(step / steps);
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [currentValue]);

  // Animated XP bar fill — flex-based proportional width
  const xpProgress = userLevel.xp / userLevel.xpToNext;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const topGainers = [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
  const topLosers = [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);

  const sectionCount = 9;
  const { animatedStyles: sectionStyles } = useStaggeredAnimation(sectionCount, {
    initialDelay: 200,
    staggerDelay: 120,
    duration: 500,
  });

  const displayInvested = totalInvested + (currentValue - totalInvested) * displayProgress;
  const displayPnl = displayInvested - totalInvested;
  const displayPnlPercent = totalInvested > 0 ? (displayPnl / totalInvested) * 100 : 0;

  const formatLargeCurrency = (val: number) => {
    if (val >= 10000000) return `\u20B9${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `\u20B9${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `\u20B9${(val / 1000).toFixed(1)}K`;
    return `\u20B9${val.toFixed(0)}`;
  };

  const portfolioGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(portfolioGlow, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(portfolioGlow, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, [portfolioGlow]);

  const glowOpacity = portfolioGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.5],
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.header, { paddingBottom: SPACING.xl }]}>
            <SkeletonBlock width="40%" height={14} />
            <View style={{ height: 8 }} />
            <SkeletonBlock width="50%" height={28} />
            <View style={{ height: SPACING.lg }} />
            <PortfolioSkeleton />
          </View>
          <View style={{ paddingHorizontal: SPACING.xl }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ marginTop: SPACING.lg }}>
                <SkeletonBlock width="30%" height={18} />
                <View style={{ height: SPACING.md }} />
                <SkeletonBlock width="100%" height={72} borderRadius={12} />
              </View>
            ))}
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
        <LinearGradient colors={GRADIENTS.midnight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{greeting},</Text>
              <View style={styles.greetingRow}>
                <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'Investor'} 👋</Text>
                <View style={[styles.marketStatusBadge, { backgroundColor: isMarketOpen ? '#00C85320' : '#FF174420' }]}>
                  <View style={[styles.marketStatusDot, { backgroundColor: isMarketOpen ? '#00C853' : '#FF1744' }]} />
                  <Text style={[styles.marketStatusText, { color: isMarketOpen ? '#00C853' : '#FF1744' }]}>
                    {isMarketOpen ? 'Open' : 'Closed'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.headerRight}>
              <AnimatedPressable onPress={() => navigation.navigate('Notifications')} haptic="light" scaleTo={0.92}>
                <View style={styles.iconBtn}>
                  <Ionicons name="notifications-outline" size={24} color={colors.text} />
                  {unreadCount > 0 && (
                    <View style={styles.notifBadge}>
                      <Text style={styles.notifCount}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => navigation.navigate('Profile')} haptic="light" scaleTo={0.95}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{user?.name?.[0] || 'R'}</Text>
                </View>
              </AnimatedPressable>
            </View>
          </View>

          {/* Glow effect behind portfolio card */}
          <Animated.View style={[styles.portfolioGlow, { opacity: glowOpacity }]} />

          {/* Portfolio Summary Card */}
          <View style={styles.portfolioCardWrapper}>
            <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.portfolioCard}>
              <Text style={styles.portfolioLabel}>Portfolio Value</Text>
              <Text style={styles.portfolioValue}>{formatLargeCurrency(displayInvested || 1250000)}</Text>
              <View style={styles.portfolioChange}>
                <View style={[styles.changeChip, { backgroundColor: displayPnl >= 0 ? '#00C85330' : '#FF174430' }]}>
                  <Ionicons name={displayPnl >= 0 ? 'caret-up' : 'caret-down'} size={16} color={displayPnl >= 0 ? colors.marketUp : colors.marketDown} />
                  <Text style={[styles.changeText, { color: displayPnl >= 0 ? colors.marketUp : colors.marketDown }]}>
                    {formatPercent(displayPnlPercent || 12.5)}
                  </Text>
                </View>
                <Text style={styles.portfolioSubtext}>Total P&L: {formatCurrency(displayPnl || 150000)}</Text>
              </View>
              <View style={styles.portfolioActions}>
                <AnimatedPressable onPress={() => navigation.navigate('AddFunds')} haptic="light" scaleTo={0.95}>
                  <View style={styles.actionBtn}>
                    <Ionicons name="add-circle" size={20} color={colors.white} />
                    <Text style={styles.actionText}>Add Funds</Text>
                  </View>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => navigation.navigate('Transfer')} haptic="light" scaleTo={0.95}>
                  <View style={styles.actionBtn}>
                    <Ionicons name="swap-horizontal" size={20} color={colors.white} />
                    <Text style={styles.actionText}>Transfer</Text>
                  </View>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => navigation.navigate('FundsDashboard')} haptic="light" scaleTo={0.95}>
                  <View style={styles.actionBtn}>
                    <Ionicons name="wallet" size={20} color={colors.white} />
                    <Text style={styles.actionText}>Balance</Text>
                  </View>
                </AnimatedPressable>
              </View>
            </LinearGradient>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            {[
              { icon: 'trending-up', label: 'Buy', screen: 'Markets', gradient: GRADIENTS.success },
              { icon: 'trending-down', label: 'Sell', screen: 'Portfolio', gradient: GRADIENTS.danger },
              { icon: 'pie-chart', label: 'SIP', screen: 'MutualFunds', gradient: GRADIENTS.primary },
              { icon: 'school', label: 'Learn', screen: 'Learn', gradient: GRADIENTS.warning },
            ].map((item, i) => (
              <AnimatedPressable key={i} onPress={() => navigation.navigate(item.screen)} haptic="light" scaleTo={0.92}>
                <View style={styles.quickAction}>
                  <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickActionIcon}>
                    <Ionicons name={item.icon as any} size={22} color={colors.white} />
                  </LinearGradient>
                  <Text style={styles.quickActionLabel}>{item.label}</Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>
        </LinearGradient>

        {/* Market Breadth */}
        <ReanimatedAnimated.View style={[styles.section, sectionStyles[0]]}>
          <View style={styles.marketBreadthRow}>
            <View style={[styles.breadthCard, { borderColor: colors.border }]}>
              <Ionicons name="arrow-up-circle" size={18} color="#00C853" />
              <Text style={[styles.breadthLabel, { color: colors.textSecondary }]}>Adv</Text>
              <Text style={[styles.breadthValue, { color: '#00C853' }]}>{advancing}</Text>
            </View>
            <View style={[styles.breadthCard, { borderColor: colors.border }]}>
              <Ionicons name="remove-circle" size={18} color={colors.textMuted} />
              <Text style={[styles.breadthLabel, { color: colors.textSecondary }]}>Flat</Text>
              <Text style={[styles.breadthValue, { color: colors.textMuted }]}>{unchanged}</Text>
            </View>
            <View style={[styles.breadthCard, { borderColor: colors.border }]}>
              <Ionicons name="arrow-down-circle" size={18} color="#FF1744" />
              <Text style={[styles.breadthLabel, { color: colors.textSecondary }]}>Dec</Text>
              <Text style={[styles.breadthValue, { color: '#FF1744' }]}>{declining}</Text>
            </View>
            <View style={[styles.breadthCard, { borderColor: colors.border }]}>
              <Ionicons name="stats-chart" size={18} color={advancing > declining ? '#00C853' : '#FF1744'} />
              <Text style={[styles.breadthLabel, { color: colors.textSecondary }]}>Ratio</Text>
              <Text style={[styles.breadthValue, { color: advancing > declining ? '#00C853' : '#FF1744' }]}>
                {declining > 0 ? (advancing / declining).toFixed(1) : '∞'}
              </Text>
            </View>
          </View>
        </ReanimatedAnimated.View>

        {/* Market Indices */}
        <ReanimatedAnimated.View style={[styles.section, sectionStyles[0]]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Market Indices</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Markets')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.indicesScroll}>
            {indices.map((index) => (
              <MarketCard key={index.id} index={index} />
            ))}
          </ScrollView>
        </ReanimatedAnimated.View>

        {/* AI Market Insight */}
        {topInsight && (
          <ReanimatedAnimated.View style={[styles.section, sectionStyles[1]]}>
            <Card animated animationDelay={500}>
              <View style={styles.aiInsightHeader}>
                <View style={styles.aiInsightLeft}>
                  <View style={[styles.aiBadge, { backgroundColor: colors.primaryLight + '20' }]}>
                    <Ionicons name="bulb" size={16} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.aiLabel, { color: colors.textSecondary }]}>AI Market Insight</Text>
                    <Text style={[styles.aiSymbol, { color: colors.text }]}>{topInsight.symbol}</Text>
                  </View>
                </View>
                <View style={[styles.confidenceChip, {
                  backgroundColor: topInsight.type === 'bullish' ? '#00C85320' : topInsight.type === 'bearish' ? '#FF174420' : colors.bgCardLight,
                }]}>
                  <Ionicons name={
                    topInsight.type === 'bullish' ? 'trending-up' :
                    topInsight.type === 'bearish' ? 'trending-down' : 'remove'
                  } size={14} color={
                    topInsight.type === 'bullish' ? '#00C853' :
                    topInsight.type === 'bearish' ? '#FF1744' : colors.textMuted
                  } />
                  <Text style={[styles.confidenceText, {
                    color: topInsight.type === 'bullish' ? '#00C853' :
                    topInsight.type === 'bearish' ? '#FF1744' : colors.textMuted,
                  }]}>{topInsight.confidence}%</Text>
                </View>
              </View>
              <Text style={[styles.aiSummary, { color: colors.textSecondary }]} numberOfLines={2}>
                {topInsight.summary}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('AIInsights')} style={styles.aiCta}>
                <Text style={[styles.aiCtaText, { color: colors.primary }]}>View Full Analysis →</Text>
              </TouchableOpacity>
            </Card>
          </ReanimatedAnimated.View>
        )}

        {/* Level & XP */}
        <ReanimatedAnimated.View style={[styles.section, sectionStyles[2]]}>
          <Card animated animationDelay={400}>
            <View style={styles.levelRow}>
              <View style={styles.levelInfo}>
                <Badge label={`Lvl ${userLevel.level}`} variant="primary" animated />
                <Text style={styles.levelTitle}>{userLevel.title}</Text>
              </View>
              <View style={styles.xpContainer}>
                <Text style={styles.xpText}>{userLevel.xp} / {userLevel.xpToNext} XP</Text>
                <View style={styles.xpBar}>
                  <View style={[styles.xpFill, { flex: xpProgress }]} />
                  {xpProgress < 1 && <View style={{ flex: 1 - xpProgress }} />}
                </View>
              </View>
            </View>
            <View style={styles.badgesRow}>
              {badges.filter(b => b.unlocked).slice(0, 5).map(badge => (
                <View key={badge.id} style={styles.badgeItem}>
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                </View>
              ))}
              <Text style={styles.moreBadges}>+{badges.filter(b => !b.unlocked).length} more</Text>
            </View>
          </Card>
        </ReanimatedAnimated.View>

        {/* Top Holdings */}
        {topHoldings.length > 0 && (
          <ReanimatedAnimated.View style={[styles.section, sectionStyles[3]]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Holdings 📊</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Portfolio')}>
                <Text style={styles.seeAll}>All Holdings</Text>
              </TouchableOpacity>
            </View>
            {topHoldings.map(holding => {
              const isPositive = holding.pnl >= 0;
              return (
                <TouchableOpacity
                  key={holding.id}
                  style={[styles.holdingCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                  onPress={() => navigation.navigate('StockDetail', { stockId: holding.stockId, symbol: holding.symbol })}
                >
                  <View style={styles.holdingLeft}>
                    <View style={[styles.holdingAvatar, { backgroundColor: isPositive ? '#00C85320' : '#FF174420' }]}>
                      <Ionicons name={isPositive ? 'trending-up' : 'trending-down'} size={16} color={isPositive ? '#00C853' : '#FF1744'} />
                    </View>
                    <View>
                      <Text style={[styles.holdingSymbol, { color: colors.text }]}>{holding.symbol}</Text>
                      <Text style={[styles.holdingQty, { color: colors.textMuted }]}>{holding.quantity} shares</Text>
                    </View>
                  </View>
                  <View style={styles.holdingRight}>
                    <Text style={[styles.holdingValue, { color: colors.text }]}>
                      {formatLargeCurrency(holding.currentValue)}
                    </Text>
                    <View style={[styles.holdingPnlChip, { backgroundColor: isPositive ? '#00C85320' : '#FF174420' }]}>
                      <Ionicons name={isPositive ? 'caret-up' : 'caret-down'} size={12} color={isPositive ? '#00C853' : '#FF1744'} />
                      <Text style={[styles.holdingPnlText, { color: isPositive ? '#00C853' : '#FF1744' }]}>
                        {formatPercent(holding.pnlPercent)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ReanimatedAnimated.View>
        )}

        {/* Top Gainers */}
        <ReanimatedAnimated.View style={[styles.section, sectionStyles[4]]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Gainers 🔥</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Markets')}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {topGainers.map(stock => (
            <StockItem
              key={stock.id}
              stock={stock}
              onPress={(s) => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
            />
          ))}
        </ReanimatedAnimated.View>

        {/* Top Losers */}
        <ReanimatedAnimated.View style={[styles.section, sectionStyles[5]]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Losers 📉</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Markets')}>
              <Text style={styles.seeAll}>View Losers</Text>
            </TouchableOpacity>
          </View>
          {topLosers.map(stock => (
            <StockItem
              key={stock.id}
              stock={stock}
              onPress={(s) => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
            />
          ))}
        </ReanimatedAnimated.View>

        {/* Recent Trades */}
        {recentTrades.length > 0 && (
          <ReanimatedAnimated.View style={[styles.section, sectionStyles[6]]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity 📋</Text>
              <TouchableOpacity onPress={() => navigation.navigate('TradeHistory')}>
                <Text style={styles.seeAll}>All Trades</Text>
              </TouchableOpacity>
            </View>
            {recentTrades.map(trade => (
              <View key={trade.id} style={[styles.tradeItem, { borderColor: colors.border }]}>
                <View style={styles.tradeLeft}>
                  <View style={[styles.tradeTypeBadge, {
                    backgroundColor: trade.type === 'buy' ? '#00C85320' : '#FF174420',
                  }]}>
                    <Ionicons name={trade.type === 'buy' ? 'cart' : 'arrow-up'} size={14} color={trade.type === 'buy' ? '#00C853' : '#FF1744'} />
                  </View>
                  <View>
                    <Text style={[styles.tradeSymbol, { color: colors.text }]}>{trade.symbol}</Text>
                    <Text style={[styles.tradeMeta, { color: colors.textMuted }]}>
                      {trade.type === 'buy' ? 'Bought' : 'Sold'} {trade.quantity} @ ₹{trade.price.toFixed(2)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.tradeAmount, {
                  color: trade.type === 'buy' ? colors.text : colors.marketUp,
                }]}>
                  {trade.type === 'buy' ? '-' : '+'}₹{trade.total.toLocaleString()}
                </Text>
              </View>
            ))}
          </ReanimatedAnimated.View>
        )}

        {/* Watchlist Preview */}
        <ReanimatedAnimated.View style={[styles.section, sectionStyles[7]]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Watchlist ⭐</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Watchlist')}>
              <Text style={styles.seeAll}>Manage</Text>
            </TouchableOpacity>
          </View>
          {stocks.slice(0, 3).map(stock => (
            <StockItem
              key={stock.id}
              stock={stock}
              onPress={(s) => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
              showActions
              isInWatchlist
            />
          ))}
        </ReanimatedAnimated.View>

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
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  greeting: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: 2,
  },
  userName: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
  },
  marketStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  marketStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  marketStatusText: {
    ...FONTS.semiBold,
    fontSize: 11,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  portfolioCardWrapper: {
    position: 'relative',
    marginBottom: SPACING.lg,
  },
  portfolioGlow: {
    position: 'absolute',
    top: -15,
    left: -15,
    right: -15,
    bottom: -15,
    borderRadius: BORDER_RADIUS.xl + 15,
    backgroundColor: colors.primary,
    boxShadow: `0px 0px 30px ${colors.primary}66`,
    elevation: 10,
    zIndex: 0,
  },
  iconBtn: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifCount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
  },
  portfolioCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: 0,
    zIndex: 1,
  },
  portfolioLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  portfolioValue: {
    ...FONTS.black,
    fontSize: FONTS.size.hero,
    color: colors.white,
    marginTop: SPACING.xs,
  },
  portfolioChange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.md,
  },
  changeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    gap: 2,
  },
  changeText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  portfolioSubtext: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  portfolioActions: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.xl,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  actionText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.white,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  section: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  seeAll: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  indicesScroll: {
    marginHorizontal: -SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  levelRow: {
    gap: SPACING.md,
  },
  levelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  levelTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  xpContainer: {
    gap: SPACING.xs,
  },
  xpText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  xpBar: {
    height: 6,
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  badgeItem: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeIcon: {
    fontSize: 18,
  },
  moreBadges: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginLeft: SPACING.xs,
  },

  // ── Market Breadth ──
  marketBreadthRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  breadthCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  breadthLabel: {
    ...FONTS.regular,
    fontSize: 10,
  },
  breadthValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    marginLeft: 'auto',
  },

  // ── AI Insight ──
  aiInsightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  aiInsightLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  aiBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiLabel: {
    ...FONTS.regular,
    fontSize: 10,
  },
  aiSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    marginTop: 1,
  },
  confidenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  confidenceText: {
    ...FONTS.semiBold,
    fontSize: 11,
  },
  aiSummary: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
  },
  aiCta: {
    marginTop: SPACING.sm,
  },
  aiCtaText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },

  // ── Top Holdings ──
  holdingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  holdingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  holdingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  holdingSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  holdingQty: {
    ...FONTS.regular,
    fontSize: 11,
    marginTop: 1,
  },
  holdingRight: {
    alignItems: 'flex-end',
  },
  holdingValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  holdingPnlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginTop: 3,
  },
  holdingPnlText: {
    ...FONTS.semiBold,
    fontSize: 10,
  },

  // ── Recent Trades ──
  tradeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  tradeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  tradeTypeBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  tradeMeta: {
    ...FONTS.regular,
    fontSize: 10,
    marginTop: 1,
  },
  tradeAmount: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
});
