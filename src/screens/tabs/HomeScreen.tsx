import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { useMarketStore } from '../../store/marketStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useGamificationStore } from '../../store/gamificationStore';
import { useNotificationStore } from '../../store/notificationStore';
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
  const { holdings } = usePortfolioStore();
  const { userLevel, badges } = useGamificationStore();
  const { notifications } = useNotificationStore();

  const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
  const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalPnl = currentValue - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const unreadCount = notifications.filter(n => !n.read).length;

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

  const sectionCount = 6;
  const { getAnimatedStyle: getSectionStyle } = useStaggeredAnimation(sectionCount, {
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
        Animated.timing(portfolioGlow, { toValue: 1, duration: 2500, useNativeDriver: false }),
        Animated.timing(portfolioGlow, { toValue: 0, duration: 2500, useNativeDriver: false }),
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
              <Text style={styles.greeting}>Good Morning,</Text>
              <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'Investor'} 👋</Text>
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

        {/* Market Indices */}
        <Animated.View style={[styles.section, getSectionStyle(0)]}>
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
        </Animated.View>

        {/* Level & XP */}
        <Animated.View style={[styles.section, getSectionStyle(1)]}>
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
        </Animated.View>

        {/* Top Gainers */}
        <Animated.View style={[styles.section, getSectionStyle(2)]}>
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
        </Animated.View>

        {/* Top Losers */}
        <Animated.View style={[styles.section, getSectionStyle(3)]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Losers 📉</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Markets')}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {topLosers.map(stock => (
            <StockItem
              key={stock.id}
              stock={stock}
              onPress={(s) => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
            />
          ))}
        </Animated.View>

        {/* Watchlist Preview */}
        <Animated.View style={[styles.section, getSectionStyle(4)]}>
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
        </Animated.View>

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
  userName: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
    marginTop: 2,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
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
});
