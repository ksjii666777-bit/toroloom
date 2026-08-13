import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAuthStore } from '../../store/authStore';
import { useGamificationStore } from '../../store/gamificationStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { FeatureGrid } from '../../components/patterns/FeatureGrid';
import AppScreen from '../../components/ui/AppScreen';
import { FinanceCard } from '../../components/ui/FinanceCard';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';
import SyncStatusIndicator from '../../components/ui/SyncStatusIndicator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type {RootStackParamList, TabParamList} from '../../types';


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

// ── Menu item labels resolve via inline labelKey → t(item.labelKey) ──

interface MenuItem {
  icon: string;
  /** English label — NOT rendered directly; used as the English-name search fallback
   *  in the filter so English tile names still match while the app is in Hindi. */
  label: string;
  /** i18n key — resolved through useT for the active locale */
  labelKey: string;
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
      { icon: 'options', label: 'F&O Trading', labelKey: 'profile.fnoTrading', color: '#FF6B00', screen: 'FnOOptionsChain' },
      { icon: 'clipboard', label: 'Open Orders', labelKey: 'profile.openOrders', color: '#FF9800', screen: 'OpenOrders' },
      { icon: 'document-text', label: 'Trade History', labelKey: 'profile.tradeHistory', color: '#FFC107', screen: 'TradeHistory' },
      { icon: 'shuffle', label: 'Op. Strategies', labelKey: 'profile.opStrategies', color: '#8B5CF6', screen: 'StrategyBuilder' },
      { icon: 'trending-up', label: 'Strategy Perf.', labelKey: 'profile.strategyPerf', color: '#00C853', screen: 'StrategyPerformance' },
      { icon: 'swap-horizontal', label: 'US Trade', labelKey: 'profile.usTrade', color: '#00C853', screen: 'USStocksTrading' },
      { icon: 'logo-bitcoin', label: 'Crypto Trading', labelKey: 'profile.cryptoTrading', color: '#F7931A', screen: 'CryptoTrading' },
      { icon: 'pulse', label: 'Futures Curve', labelKey: 'profile.futuresCurve', color: '#6C63FF', screen: 'FuturesCurve' },
      { icon: 'journal', label: 'Trading Journal', labelKey: 'profile.tradingJournal', color: '#8B5CF6', screen: 'BehavioralJournal' },
      { icon: 'lock-closed', label: 'Iron Lock Trade', labelKey: 'profile.ironLockTrade', color: '#EF4444', screen: 'FnOOptionsChain', testID: 'menu-iron-lock' },
    ],
  },
  {
    key: 'portfolio',
    titleKey: 'profile.sectionPortfolioAndWealth',
    items: [
      { icon: 'wallet', label: 'Fund Dashboard', labelKey: 'profile.fundDashboard', color: '#00C853', screen: 'FundsDashboard' },
      { icon: 'pie-chart', label: 'Mutual Funds', labelKey: 'profile.mutualFunds', color: '#6C63FF', screen: 'MutualFunds' },
      { icon: 'calendar', label: 'My SIPs', labelKey: 'profile.mySips', color: '#00D2FF', screen: 'SIPs' },
      { icon: 'briefcase', label: 'Holdings', labelKey: 'profile.holdings', color: '#10B981', screen: 'Portfolio', testID: 'menu-holdings' },
      { icon: 'briefcase', label: 'US Portfolio', labelKey: 'profile.usPortfolio', color: '#10B981', screen: 'SnapTradePortfolio' },
      { icon: 'pricetags', label: 'Bonds', labelKey: 'profile.bonds', color: '#00E676', screen: 'BondDashboard' },
      { icon: 'cash', label: 'Dividends', labelKey: 'profile.dividends', color: '#00E676', screen: 'DividendTracker' },
      { icon: 'diamond', label: 'Wealth Dashboard', labelKey: 'profile.wealthDashboard', color: '#6C63FF', screen: 'WealthDashboard' },
      { icon: 'shuffle', label: 'Rebalance', labelKey: 'profile.rebalance', color: '#FF6B00', screen: 'PortfolioRebalancing' },
      { icon: 'leaf', label: 'Tax Harvesting', labelKey: 'profile.taxHarvesting', color: '#00E676', screen: 'TaxHarvesting' },
    ],
  },
  {
    key: 'analytics',
    titleKey: 'profile.sectionAnalytics',
    items: [
      { icon: 'analytics', label: 'Reports', labelKey: 'profile.reports', color: '#FF6B6B', screen: 'Reports' },
      { icon: 'flask', label: 'Monte Carlo', labelKey: 'profile.monteCarlo', color: '#6C63FF', screen: 'MonteCarlo' },
      { icon: 'grid', label: 'Correlation', labelKey: 'profile.correlation', color: '#8B5CF6', screen: 'CorrelationMatrix' },
      { icon: 'analytics', label: 'Factor Analysis', labelKey: 'profile.factorAnalysis', color: '#FFC107', screen: 'FactorAnalysis' },
      { icon: 'leaf', label: 'NFO Dashboard', labelKey: 'profile.nfoDashboard', color: '#00E676', screen: 'NFODashboard' },
      { icon: 'calendar', label: 'Economic Calendar', labelKey: 'profile.economicCalendar', color: '#00D2FF', screen: 'EconomicCalendar' },
      { icon: 'rocket', label: 'IPO Calendar', labelKey: 'profile.ipoCalendar', color: '#FF6B6B', screen: 'IPOCalendar' },
      { icon: 'bulb', label: 'AI Insights', labelKey: 'profile.aiInsights', color: '#FFC107', screen: 'AIInsights' },
    ],
  },
  {
    key: 'markets',
    titleKey: 'profile.sectionMarketsAndNews',
    items: [
      { icon: 'newspaper', label: 'Market News', labelKey: 'profile.marketNews', color: '#00D2FF', screen: 'NewsFeed' },
      { icon: 'globe', label: 'US Markets', labelKey: 'profile.usMarkets', color: '#3B82F6', screen: 'USMarkets' },
      { icon: 'globe', label: 'Global Markets', labelKey: 'profile.globalMarkets', color: '#3B82F6', screen: 'USMarkets', testID: 'menu-global-markets' },
      { icon: 'cash', label: 'Currency Markets', labelKey: 'profile.currencyMarkets', color: '#0052CC', screen: 'CurrencyMarkets' },
      { icon: 'flame', label: 'Commodities', labelKey: 'profile.commodities', color: '#FF6B00', screen: 'CommodityMarkets' },
      { icon: 'book', label: 'Financial Glossary', labelKey: 'profile.financialGlossary', color: '#06B6D4', screen: 'Glossary' },
      { icon: 'phone-portrait', label: 'Earnings Calls', labelKey: 'profile.earningsCalls', color: '#8B5CF6', screen: 'EarningsCall' },
    ],
  },
  {
    key: 'learn',
    titleKey: 'profile.sectionLearnAndGrow',
    items: [
      { icon: 'school', label: 'Courses', labelKey: 'profile.courses', color: '#00C853', screen: 'Learn' },
      { icon: 'chatbubbles', label: 'Community', labelKey: 'profile.community', color: '#6C63FF', screen: 'Community' },
      { icon: 'bar-chart', label: 'Community Polls', labelKey: 'profile.communityPolls', color: '#8B5CF6', screen: 'Polls' },
      { icon: 'chatbox-ellipses', label: 'Messages', labelKey: 'profile.messages', color: '#10B981', screen: 'ChatList' },
      { icon: 'chatbubble-ellipses', label: 'AI Assistant', labelKey: 'profile.aiAssistant', color: '#3B82F6', screen: 'AIChat' },
      { icon: 'sparkles', label: 'Trading Psychology', labelKey: 'profile.tradingPsychology', color: '#8B5CF6', screen: 'BehavioralJournal', testID: 'menu-trading-psychology' },
      { icon: 'trophy', label: 'Achievements', labelKey: 'profile.achievements', color: '#FF6B6B', screen: 'Achievements' },
      { icon: 'wallet', label: 'Revenue', labelKey: 'profile.revenue', color: '#FFC107', screen: 'RevenueDashboard' },
    ],
  },
  {
    key: 'account',
    titleKey: 'profile.sectionAccountAndSettings',
    items: [
      { icon: 'person', label: 'Profile & KYC', labelKey: 'profile.profileKyc', color: '#00D2FF', screen: 'Profile' },
      { icon: 'link', label: 'Connect Broker', labelKey: 'profile.connectBroker', color: '#FF6B00', screen: 'BrokerConnect' },
      { icon: 'receipt', label: 'Payment History', labelKey: 'profile.paymentHistory', color: '#6C63FF', screen: 'PaymentHistory' },
      { icon: 'notifications', label: 'Notifications', labelKey: 'profile.notifications', color: '#FF6B6B', screen: 'Notifications' },
      { icon: 'notifications', label: 'Portfolio Alerts', labelKey: 'profile.portfolioAlerts', color: '#FFC107', screen: 'PortfolioAlerts' },
      { icon: 'settings', label: 'Risk Settings', labelKey: 'profile.riskSettings', color: '#6E6E9A', screen: 'Settings' },
      { icon: 'shield-checkmark', label: 'Security', labelKey: 'profile.security', color: '#FF6B6B', screen: 'SecuritySettings' },
      { icon: 'help-circle', label: 'Help & Support', labelKey: 'profile.help', color: '#00C853', screen: 'Help' },
      { icon: 'cog', label: 'AI Settings', labelKey: 'profile.aiSettings', color: '#8B5CF6', screen: 'AISettings' },
      { icon: 'paper-plane', label: 'Telegram Alerts', labelKey: 'profile.telegramAlerts', color: '#0088CC', screen: 'TelegramConnect' },
      { icon: 'volume-high', label: 'Voice Settings', labelKey: 'profile.voiceSettings', color: '#00D2FF', screen: 'VoiceSettings' },
      { icon: 'link', label: 'Webhooks', labelKey: 'profile.webhooks', color: '#10B981', screen: 'Webhooks' },
      { icon: 'key', label: 'API Keys', labelKey: 'profile.apiKeys', color: '#3B82F6', screen: 'ApiKeys' },
      { icon: 'flask', label: 'Feature Flags', labelKey: 'profile.featureFlags', color: '#8B5CF6', screen: 'FeatureFlags' },
      { icon: 'accessibility', label: 'Accessibility', labelKey: 'profile.accessibility', color: '#8B5CF6', screen: 'Accessibility' },
      { icon: 'gift', label: 'Refer & Earn', labelKey: 'profile.referral', color: '#6C63FF', screen: 'Referral' },
      { icon: 'diamond', label: 'Go Premium', labelKey: 'profile.goPremium', color: '#10B981', screen: 'Subscription' },
      { icon: 'grid', label: 'Home Widget', labelKey: 'profile.homeWidget', color: '#3B82F6', screen: 'WidgetSettings' },
      { icon: 'compass', label: 'Replay Tour', labelKey: 'profile.replayTour', color: '#8B5CF6', screen: '__onboarding' },
      { icon: 'settings', label: 'Tenant Config', labelKey: 'profile.tenantConfig', color: '#8B5CF6', screen: 'TenantConfig' },
      { icon: 'flask', label: 'A/B Tests', labelKey: 'profile.abTests', color: '#FF6B6B', screen: 'ABTestRunner' },
      { icon: 'image', label: 'Image Opt.', labelKey: 'profile.imageOpt', color: '#8B5CF6', screen: 'CDNOptimization' },
      { icon: 'phone-landscape', label: 'Landscape', labelKey: 'profile.landscape', color: '#06B6D4', screen: 'LandscapeMode' },
      { icon: 'pricetags', label: 'Coupon Manager', labelKey: 'profile.couponManager', color: '#8B5CF6', screen: 'AdminCouponManager', adminOnly: true as const },
      { icon: 'school', label: 'Course Reviews', labelKey: 'profile.courseReviews', color: '#00C9A7', screen: 'AdminCourseReview', adminOnly: true as const },
    ],
  },
];

export default function MoreScreen({ navigation }: CompositeScreenProps<BottomTabScreenProps<TabParamList, 'More'>, NativeStackScreenProps<RootStackParamList>>) {
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
            const label = t(item.labelKey).toLowerCase();
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
      (navigation.navigate as (screenName: string) => void)(item.screen);
    }
  };

  if (isLoading) {
    return (
      <AppScreen hasTabBar padded={false} contentStyle={styles.scrollContent}>
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
      </AppScreen>
    );
  }

  return (
    <AppScreen
      hasTabBar
      padded={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentStyle={styles.scrollContent}
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
                <Text style={styles.avatarText}>{(user?.name || t('home.investor'))[0] || 'R'}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.name || t('home.investor')}</Text>
                {user?.email && (
                  <Text style={styles.profileEmail}>{user?.email}</Text>
                )}
                <View style={styles.profileBadges}>
                  <Badge label={t('gamification.level', { level: userLevel.level })} variant="primary" />
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
        <View style={styles.balanceWrap}>
          <View style={styles.balanceInfo}>
            <FinanceCard
              label={t('profile.availableBalance')}
              value={`₹${((user?.balance || 2500000) / 100000).toFixed(1)}${t('profile.lakh')}`}
            />
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
                <FeatureGrid
                  columns={3}
                  items={section.items.map(item => ({
                    key: item.testID || `menu-${item.screen}`,
                    label: t(item.labelKey),
                    icon: <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={item.color} />,
                    testID: item.testID || `menu-${item.screen}`,
                    onPress: () => handleMenuPress(item),
                  }))}
                />
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

    </AppScreen>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: SPACING.xl,
  },
  header: {
    // AppScreen already pads for the status-bar/safe-area inset
    paddingTop: SPACING.xl,
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
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
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
  balanceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceActions: {
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
