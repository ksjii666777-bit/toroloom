import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Alert, RefreshControl, TextInput, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAuthStore } from '../../store/authStore';
import { useGamificationStore } from '../../store/gamificationStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS, IS_SMALL_DEVICE } from '../../constants/theme';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';
import SyncStatusIndicator from '../../components/ui/SyncStatusIndicator';

const { width } = Dimensions.get('window');
const BADGE_DISPLAY_COUNT = 8;

// ── Category chips (searchable filter) ────────────────────────────────────
type CategoryKey = 'trading' | 'portfolio' | 'analytics' | 'markets' | 'learn' | 'account';

const CATEGORIES: { key: CategoryKey | 'all'; labelKey: string }[] = [
  { key: 'all', labelKey: 'profile.tabAll' },
  { key: 'trading', labelKey: 'profile.tabTrading' },
  { key: 'portfolio', labelKey: 'profile.tabPortfolio' },
  { key: 'analytics', labelKey: 'profile.tabAnalytics' },
  { key: 'markets', labelKey: 'profile.tabMarkets' },
  { key: 'learn', labelKey: 'profile.tabLearn' },
  { key: 'account', labelKey: 'profile.tabAccount' },
];

// ── Menu label → profile.* key mapping ────────────────────────────────────
const MENU_LABEL_KEYS: Record<string, string> = {
  // Trading
  'F&O Trading': 'profile.fnoTrading',
  'Open Orders': 'profile.openOrders',
  'Trade History': 'profile.tradeHistory',
  'Op. Strategies': 'profile.opStrategies',
  'Strategy Perf.': 'profile.strategyPerf',
  'US Trade': 'profile.usTrade',
  'Crypto Trading': 'profile.cryptoTrading',
  'Futures Curve': 'profile.futuresCurve',
  'Trading Journal': 'profile.tradingJournal',
  'Iron Lock Trade': 'profile.ironLockTrade',
  // Portfolio & Wealth
  'Fund Dashboard': 'profile.fundDashboard',
  'Mutual Funds': 'profile.mutualFunds',
  'My SIPs': 'profile.mySips',
  'Holdings': 'profile.holdings',
  'US Portfolio': 'profile.usPortfolio',
  'Bonds': 'profile.bonds',
  'Dividends': 'profile.dividends',
  'Wealth Dashboard': 'profile.wealthDashboard',
  'Rebalance': 'profile.rebalance',
  'Tax Harvesting': 'profile.taxHarvesting',
  // Analytics
  'Reports': 'profile.reports',
  'Monte Carlo': 'profile.monteCarlo',
  'Correlation': 'profile.correlation',
  'Factor Analysis': 'profile.factorAnalysis',
  'NFO Dashboard': 'profile.nfoDashboard',
  'Economic Calendar': 'profile.economicCalendar',
  'IPO Calendar': 'profile.ipoCalendar',
  'AI Insights': 'profile.aiInsights',
  // Markets & News
  'Market News': 'profile.marketNews',
  'US Markets': 'profile.usMarkets',
  'Global Markets': 'profile.globalMarkets',
  'Currency Markets': 'profile.currencyMarkets',
  'Commodities': 'profile.commodities',
  'Financial Glossary': 'profile.financialGlossary',
  'Earnings Calls': 'profile.earningsCalls',
  // Learn & Grow
  'Courses': 'profile.courses',
  'Community': 'profile.community',
  'Community Polls': 'profile.communityPolls',
  'Messages': 'profile.messages',
  'AI Assistant': 'profile.aiAssistant',
  'Trading Psychology': 'profile.tradingPsychology',
  'Achievements': 'profile.achievements',
  'Revenue': 'profile.revenue',
  // Account & Settings
  'Profile & KYC': 'profile.profileKyc',
  'Connect Broker': 'profile.connectBroker',
  'Payment History': 'profile.paymentHistory',
  'Notifications': 'profile.notifications',
  'Portfolio Alerts': 'profile.portfolioAlerts',
  'Risk Settings': 'profile.riskSettings',
  'Security': 'profile.security',
  'Help & Support': 'profile.help',
  'AI Settings': 'profile.aiSettings',
  'Telegram Alerts': 'profile.telegramAlerts',
  'Voice Settings': 'profile.voiceSettings',
  'Webhooks': 'profile.webhooks',
  'API Keys': 'profile.apiKeys',
  'Feature Flags': 'profile.featureFlags',
  'Accessibility': 'profile.accessibility',
  'Refer & Earn': 'profile.referral',
  'Go Premium': 'profile.goPremium',
  'Home Widget': 'profile.homeWidget',
  'Replay Tour': 'profile.replayTour',
  'Tenant Config': 'profile.tenantConfig',
  'A/B Tests': 'profile.abTests',
  'Image Opt.': 'profile.imageOpt',
  'Landscape': 'profile.landscape',
  'Coupon Manager': 'profile.couponManager',
  'Course Reviews': 'profile.courseReviews',
};

interface MenuItem {
  icon: string;
  label: string;
  color: string;
  screen: string;
  adminOnly?: true;
  /** Unique testID override — use when two tiles share the same screen */
  testID?: string;
}

interface MenuSection {
  key: CategoryKey;
  titleKey: string;
  items: MenuItem[];
}

const menuItems: MenuSection[] = [
  {
    key: 'trading',
    titleKey: 'profile.sectionTrading',
    items: [
      { icon: 'options', label: 'F&O Trading', color: '#FF6B00', screen: 'FnOOptionsChain' },
      { icon: 'clipboard', label: 'Open Orders', color: '#FF9800', screen: 'OpenOrders' },
      { icon: 'document-text', label: 'Trade History', color: '#FFC107', screen: 'TradeHistory' },
      { icon: 'shuffle', label: 'Op. Strategies', color: '#8B5CF6', screen: 'StrategyBuilder' },
      { icon: 'trending-up', label: 'Strategy Perf.', color: '#00C853', screen: 'StrategyPerformance' },
      { icon: 'swap-horizontal', label: 'US Trade', color: '#00C853', screen: 'USStocksTrading' },
      { icon: 'logo-bitcoin', label: 'Crypto Trading', color: '#F7931A', screen: 'CryptoTrading' },
      { icon: 'pulse', label: 'Futures Curve', color: '#6C63FF', screen: 'FuturesCurve' },
      { icon: 'journal', label: 'Trading Journal', color: '#8B5CF6', screen: 'BehavioralJournal' },
      { icon: 'lock-closed', label: 'Iron Lock Trade', color: '#EF4444', screen: 'FnOOptionsChain', testID: 'menu-iron-lock' },
    ],
  },
  {
    key: 'portfolio',
    titleKey: 'profile.sectionPortfolioAndWealth',
    items: [
      { icon: 'wallet', label: 'Fund Dashboard', color: '#00C853', screen: 'FundsDashboard' },
      { icon: 'pie-chart', label: 'Mutual Funds', color: '#6C63FF', screen: 'MutualFunds' },
      { icon: 'calendar', label: 'My SIPs', color: '#00D2FF', screen: 'SIPs' },
      { icon: 'briefcase', label: 'Holdings', color: '#10B981', screen: 'Portfolio', testID: 'menu-holdings' },
      { icon: 'briefcase', label: 'US Portfolio', color: '#10B981', screen: 'SnapTradePortfolio' },
      { icon: 'pricetags', label: 'Bonds', color: '#00E676', screen: 'BondDashboard' },
      { icon: 'cash', label: 'Dividends', color: '#00E676', screen: 'DividendTracker' },
      { icon: 'diamond', label: 'Wealth Dashboard', color: '#6C63FF', screen: 'WealthDashboard' },
      { icon: 'shuffle', label: 'Rebalance', color: '#FF6B00', screen: 'PortfolioRebalancing' },
      { icon: 'leaf', label: 'Tax Harvesting', color: '#00E676', screen: 'TaxHarvesting' },
    ],
  },
  {
    key: 'analytics',
    titleKey: 'profile.sectionAnalytics',
    items: [
      { icon: 'analytics', label: 'Reports', color: '#FF6B6B', screen: 'Reports' },
      { icon: 'flask', label: 'Monte Carlo', color: '#6C63FF', screen: 'MonteCarlo' },
      { icon: 'grid', label: 'Correlation', color: '#8B5CF6', screen: 'CorrelationMatrix' },
      { icon: 'analytics', label: 'Factor Analysis', color: '#FFC107', screen: 'FactorAnalysis' },
      { icon: 'leaf', label: 'NFO Dashboard', color: '#00E676', screen: 'NFODashboard' },
      { icon: 'calendar', label: 'Economic Calendar', color: '#00D2FF', screen: 'EconomicCalendar' },
      { icon: 'rocket', label: 'IPO Calendar', color: '#FF6B6B', screen: 'IPOCalendar' },
      { icon: 'bulb', label: 'AI Insights', color: '#FFC107', screen: 'AIInsights' },
    ],
  },
  {
    key: 'markets',
    titleKey: 'profile.sectionMarketsAndNews',
    items: [
      { icon: 'newspaper', label: 'Market News', color: '#00D2FF', screen: 'NewsFeed' },
      { icon: 'globe', label: 'US Markets', color: '#3B82F6', screen: 'USMarkets' },
      { icon: 'globe', label: 'Global Markets', color: '#3B82F6', screen: 'USMarkets', testID: 'menu-global-markets' },
      { icon: 'cash', label: 'Currency Markets', color: '#0052CC', screen: 'CurrencyMarkets' },
      { icon: 'flame', label: 'Commodities', color: '#FF6B00', screen: 'CommodityMarkets' },
      { icon: 'book', label: 'Financial Glossary', color: '#06B6D4', screen: 'Glossary' },
      { icon: 'phone-portrait', label: 'Earnings Calls', color: '#8B5CF6', screen: 'EarningsCall' },
    ],
  },
  {
    key: 'learn',
    titleKey: 'profile.sectionLearnAndGrow',
    items: [
      { icon: 'school', label: 'Courses', color: '#00C853', screen: 'Learn' },
      { icon: 'chatbubbles', label: 'Community', color: '#6C63FF', screen: 'Community' },
      { icon: 'bar-chart', label: 'Community Polls', color: '#8B5CF6', screen: 'Polls' },
      { icon: 'chatbox-ellipses', label: 'Messages', color: '#10B981', screen: 'ChatList' },
      { icon: 'chatbubble-ellipses', label: 'AI Assistant', color: '#3B82F6', screen: 'AIChat' },
      { icon: 'sparkles', label: 'Trading Psychology', color: '#8B5CF6', screen: 'BehavioralJournal', testID: 'menu-trading-psychology' },
      { icon: 'trophy', label: 'Achievements', color: '#FF6B6B', screen: 'Achievements' },
      { icon: 'wallet', label: 'Revenue', color: '#FFC107', screen: 'RevenueDashboard' },
    ],
  },
  {
    key: 'account',
    titleKey: 'profile.sectionAccountAndSettings',
    items: [
      { icon: 'person', label: 'Profile & KYC', color: '#00D2FF', screen: 'Profile' },
      { icon: 'link', label: 'Connect Broker', color: '#FF6B00', screen: 'BrokerConnect' },
      { icon: 'receipt', label: 'Payment History', color: '#6C63FF', screen: 'PaymentHistory' },
      { icon: 'notifications', label: 'Notifications', color: '#FF6B6B', screen: 'Notifications' },
      { icon: 'notifications', label: 'Portfolio Alerts', color: '#FFC107', screen: 'PortfolioAlerts' },
      { icon: 'settings', label: 'Risk Settings', color: '#6E6E9A', screen: 'Settings' },
      { icon: 'shield-checkmark', label: 'Security', color: '#FF6B6B', screen: 'SecuritySettings' },
      { icon: 'help-circle', label: 'Help & Support', color: '#00C853', screen: 'Help' },
      { icon: 'cog', label: 'AI Settings', color: '#8B5CF6', screen: 'AISettings' },
      { icon: 'paper-plane', label: 'Telegram Alerts', color: '#0088CC', screen: 'TelegramConnect' },
      { icon: 'volume-high', label: 'Voice Settings', color: '#00D2FF', screen: 'VoiceSettings' },
      { icon: 'link', label: 'Webhooks', color: '#10B981', screen: 'Webhooks' },
      { icon: 'key', label: 'API Keys', color: '#3B82F6', screen: 'ApiKeys' },
      { icon: 'flask', label: 'Feature Flags', color: '#8B5CF6', screen: 'FeatureFlags' },
      { icon: 'accessibility', label: 'Accessibility', color: '#8B5CF6', screen: 'Accessibility' },
      { icon: 'gift', label: 'Refer & Earn', color: '#6C63FF', screen: 'Referral' },
      { icon: 'diamond', label: 'Go Premium', color: '#10B981', screen: 'Subscription' },
      { icon: 'grid', label: 'Home Widget', color: '#3B82F6', screen: 'WidgetSettings' },
      { icon: 'compass', label: 'Replay Tour', color: '#8B5CF6', screen: '__onboarding' },
      { icon: 'settings', label: 'Tenant Config', color: '#8B5CF6', screen: 'TenantConfig' },
      { icon: 'flask', label: 'A/B Tests', color: '#FF6B6B', screen: 'ABTestRunner' },
      { icon: 'image', label: 'Image Opt.', color: '#8B5CF6', screen: 'CDNOptimization' },
      { icon: 'phone-landscape', label: 'Landscape', color: '#06B6D4', screen: 'LandscapeMode' },
      { icon: 'pricetags', label: 'Coupon Manager', color: '#8B5CF6', screen: 'AdminCouponManager', adminOnly: true as const },
      { icon: 'school', label: 'Course Reviews', color: '#00C9A7', screen: 'AdminCourseReview', adminOnly: true as const },
    ],
  },
];

export default function MoreScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, logout, isAdmin } = useAuthStore();
  const { userLevel, badges } = useGamificationStore();
  const resetOnboarding = useOnboardingStore(s => s.resetOnboarding);
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Search + category filter ────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryKey | 'all'>('all');

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const qaActions = useMemo(() => [
    { icon: 'add-circle', label: t('funds.addFunds'), gradient: GRADIENTS.success, screen: 'AddFunds' },
    { icon: 'arrow-up-circle', label: t('profile.withdraw'), gradient: GRADIENTS.danger, screen: 'Withdraw' },
    { icon: 'swap-horizontal', label: t('funds.transfer'), gradient: GRADIENTS.primary, screen: 'Transfer' },
    { icon: 'qr-code', label: t('funds.upi'), gradient: GRADIENTS.accent, screen: 'UPI' },
    { icon: 'moon', label: t('darkMode.dark'), gradient: ['#3B82F6', '#1D4ED8'] as const, screen: 'DarkMode' },
  ], [t]);
  const { animatedStyles: qaStyles } = useStaggeredAnimation(qaActions.length, {
    initialDelay: 100,
    staggerDelay: 80,
    duration: 400,
  });

  // Filter out admin-only items if user is not admin
  const visibleMenuItems = useMemo(
    () => menuItems.map(section => ({
      ...section,
      items: section.items.filter((item: MenuItem) => !item.adminOnly || isAdmin),
    })).filter(section => section.items.length > 0),
    [isAdmin],
  );

  // Search + category filtering
  const filteredSections = useMemo(() => {
    let sections = visibleMenuItems;
    if (activeCategory !== 'all') {
      sections = sections.filter(s => s.key === activeCategory);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      sections = sections
        .map(section => ({
          ...section,
          items: section.items.filter(item => {
            const label = t(MENU_LABEL_KEYS[item.label] || item.label).toLowerCase();
            return label.includes(q) || item.label.toLowerCase().includes(q);
          }),
        }))
        .filter(section => section.items.length > 0);
    }
    return sections;
  }, [visibleMenuItems, activeCategory, searchQuery, t]);

  const { animatedStyles: menuSectionStyles } = useStaggeredAnimation(visibleMenuItems.length, {
    initialDelay: 150,
    staggerDelay: 100,
    duration: 400,
  });

  const { animatedStyles: badgeStyles } = useStaggeredAnimation(BADGE_DISPLAY_COUNT, {
    initialDelay: 200,
    staggerDelay: 40,
    duration: 300,
  });

  const handleQuickAction = (screen: string, label: string) => {
    switch (screen) {
      case 'AddFunds':
        navigation.navigate('AddFunds');
        break;
      case 'Withdraw':
        navigation.navigate('Withdraw');
        break;
      case 'Transfer':
        navigation.navigate('Transfer');
        break;
      case 'UPI':
        navigation.navigate('UPI');
        break;
      case 'DarkMode':
        navigation.navigate('DarkMode');
        break;
      default:
        Alert.alert(
          label,
          t('app.comingSoon'),
          [{ text: t('app.ok') }]
        );
    }
  };

  const handleMenuPress = (item: MenuItem) => {
    if (item.screen === '__onboarding') {
      Alert.alert(
        t('profile.replayTour'),
        t('profile.replayTourConfirm'),
        [
          { text: t('app.cancel'), style: 'cancel' as const },
          {
            text: t('profile.startTour'),
            onPress: () => {
              triggerHaptic(ImpactFeedbackStyle.Medium);
              resetOnboarding();
            },
          },
        ]
      );
    } else {
      navigation.navigate(item.screen);
    }
  };

  // Responsive grid — 4 columns mobile, 3 columns small screens
  const columns = IS_SMALL_DEVICE ? 3 : 4;
  const tileSize = (width - SPACING.xl * 2 - SPACING.lg * 2 - (columns - 1) * SPACING.md) / columns;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <SkeletonBlock width="30%" height={28} />
          </View>
          <View style={{ paddingHorizontal: SPACING.xl }}>
            <SkeletonBlock width="100%" height={48} borderRadius={BORDER_RADIUS.md} />
            <View style={{ height: SPACING.md }} />
            <SkeletonBlock width="70%" height={36} borderRadius={BORDER_RADIUS.full} />
            <View style={{ height: SPACING.lg }} />
            <SkeletonBlock width="100%" height={100} borderRadius={BORDER_RADIUS.xl} />
            <View style={{ height: SPACING.lg }} />
            {[1, 2, 3].map(i => (
              <View key={`skel_more_${i}`}>
                <SkeletonBlock width="25%" height={12} />
                <View style={{ height: SPACING.md }} />
                <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                  {[1, 2, 3, 4].map(j => (
                    <View key={j} style={{ alignItems: 'center', gap: 4 }}>
                      <SkeletonBlock width={48} height={48} borderRadius={14} />
                      <SkeletonBlock width={40} height={10} />
                    </View>
                  ))}
                </View>
                <View style={{ height: SPACING.xl }} />
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
        keyboardShouldPersistTaps="handled"
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
          <View style={styles.headerRow}>
            <Text style={styles.title} testID="more-title">{t('profile.more')}</Text>
            <SyncStatusIndicator variant="inline" />
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            testID="more-search-input"
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('profile.searchTools')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                testID={`more-cat-${cat.key}`}
                onPress={() => setActiveCategory(cat.key)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isActive ? colors.primary : colors.bgCard,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
              >
                <Text style={[styles.chipText, { color: isActive ? colors.white : colors.textSecondary }]}>
                  {t(cat.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Profile Card */}
        <AnimatedPressable onPress={() => navigation.navigate('Profile')} haptic="medium" scaleTo={0.97} testID="more-profile-card">
          <View style={styles.glassProfileCard}>
            <View style={styles.glassBg} />
            <View style={styles.profileRow}>
              <View style={styles.profileAvatar}>
                <Text style={styles.avatarText}>{user?.name?.[0] || 'R'}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.name || 'Rahul Sharma'}</Text>
                <Text style={styles.profileEmail}>{user?.email || 'rahul@email.com'}</Text>
                <View style={styles.profileBadges}>
                  <Badge label={`Level ${userLevel.level}`} variant="primary" />
                  <View style={styles.kycVerifiedBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#00D2FF" />
                    <Text style={styles.kycVerifiedText}>{t('profile.kycVerified')}</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
            </View>
          </View>
        </AnimatedPressable>

        {/* Quick Actions — Glass Pillars */}
        <View style={styles.quickActionsRow}>
          {qaActions.map((action, i) => (
            <Animated.View key={`qa_${i}`} style={qaStyles[i]}>
              <AnimatedPressable onPress={() => handleQuickAction(action.screen, action.label)} haptic="light" scaleTo={0.92}>
                <View style={styles.qaCard}>
                  <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={20} color={action.gradient[0]} />
                  <Text style={styles.qaLabel}>{action.label}</Text>
                </View>
              </AnimatedPressable>
            </Animated.View>
          ))}
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>{t('profile.availableBalance')}</Text>
              <Text style={styles.balanceValue}>₹{((user?.balance || 2500000) / 100000).toFixed(1)}L</Text>
            </View>
            <View style={styles.balanceActions}>
              <AnimatedPressable onPress={() => navigation.navigate('AddFunds')} haptic="light" scaleTo={0.95}>
                <View style={styles.balanceBtn}>
                  <Text style={styles.balanceBtnText}>{t('profile.add')}</Text>
                </View>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => navigation.navigate('Withdraw')} haptic="light" scaleTo={0.95}>
                <View style={[styles.balanceBtn, styles.balanceBtnOutline]}>
                  <Text style={styles.balanceBtnOutlineText}>{t('profile.withdraw')}</Text>
                </View>
              </AnimatedPressable>
            </View>
          </View>
        </Card>

        {/* Menu Sections (filtered) */}
        {filteredSections.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.bgCard }]}>
              <Ionicons name="search" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>{t('profile.noToolsFound')}</Text>
            <Text style={styles.emptyHint}>{t('profile.noToolsHint')}</Text>
          </View>
        ) : (
          filteredSections.map((section, idx) => (
            <Animated.View
              key={`${activeCategory}_${section.key}`}
              entering={FadeInDown.duration(280).delay(Math.min(idx, 5) * 45)}
              style={[styles.menuCardSection, menuSectionStyles[idx]]}
            >
              <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.menuSectionTitle}>{t(section.titleKey)}</Text>
                <View style={styles.menuGrid}>
                  {section.items.map((item, i) => (
                    <AnimatedPressable
                      key={`mi_${section.key}_${i}`}
                      onPress={() => handleMenuPress(item)}
                      haptic="selection"
                      scaleTo={0.97}
                      testID={item.testID || `menu-${item.screen}`}
                      accessibilityLabel={t(MENU_LABEL_KEYS[item.label] || item.label)}
                    >
                      <View style={[styles.menuItem, { width: tileSize }]}>
                        <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={item.color} />
                        </View>
                        <Text style={styles.menuLabel} numberOfLines={2}>
                          {t(MENU_LABEL_KEYS[item.label] || item.label)}
                        </Text>
                      </View>
                    </AnimatedPressable>
                  ))}
                </View>
              </View>
            </Animated.View>
          ))
        )}

        {/* Achievements Preview */}
        <AnimatedPressable onPress={() => navigation.navigate('Achievements')} haptic="light" scaleTo={0.98}>
          <Card title={t('profile.achievements')} subtitle={`${unlockedCount}/${badges.length} ${t('gamification.unlocked', { count: unlockedCount })}`}>
            <View style={styles.badgesGrid}>
              {badges.slice(0, BADGE_DISPLAY_COUNT).map((badge, i) => (
                <Animated.View key={badge.id} style={badgeStyles[i]}>
                  <View style={[styles.badgeItem, !badge.unlocked && styles.badgeLocked]}>
                    <Text style={styles.badgeIcon}>{badge.icon}</Text>
                    {!badge.unlocked && (
                      <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                </Animated.View>
              ))}
            </View>
          </Card>
        </AnimatedPressable>

        {/* Logout */}
        <AnimatedPressable onPress={logout} haptic="warning" scaleTo={0.97} testID="more-logout-btn">
          <View style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>{t('profile.logout')}</Text>
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
    paddingHorizontal: SPACING.xl,
  },
  header: {
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  // ── Search ──
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 0,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  searchInput: {
    flex: 1,
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    paddingVertical: 0,
  },
  // ── Chips ──
  chipsScroll: {
    marginBottom: SPACING.lg,
    marginHorizontal: -SPACING.xl,
  },
  chipsRow: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  glassProfileCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  glassBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: BORDER_RADIUS.xl,
  },
  kycVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,210,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.25)',
  },
  kycVerifiedText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: '#00D2FF',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.white,
  },
  profileInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  profileName: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
  },
  profileEmail: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  profileBadges: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  qaCard: {
    width: 72,
    height: 72,
    backgroundColor: '#161922',
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  qaLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.text,
    textAlign: 'center',
  },
  balanceCard: {
    marginBottom: SPACING.xxl,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  balanceValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
    marginTop: 4,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  balanceBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  balanceBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.white,
  },
  balanceBtnOutline: {
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  balanceBtnOutlineText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  menuCardSection: {
    marginBottom: SPACING.lg,
  },
  menuCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  menuSectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  menuItem: {
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 76,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.text,
    textAlign: 'center',
  },
  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.huge,
    gap: SPACING.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  emptyHint: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
  },
  badgeItem: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeIcon: {
    fontSize: 20,
  },
  badgeLocked: {
    opacity: 0.4,
  },
  lockOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.bgCard,
    borderRadius: 6,
    padding: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  logoutText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.danger,
  },
});
