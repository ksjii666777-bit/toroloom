import React, { lazy, Suspense, useRef, useCallback, useEffect } from 'react';
import { Text, StyleSheet, Alert, Linking } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useRiskStore } from '../store/riskStore';
import { useNotificationStore } from '../store/notificationStore';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { analytics } from '../services/analytics';
import { authApi } from '../services/api';
import { useFeatureFlagStore } from '../store/featureFlagStore';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

// Tab Screens
import HomeScreen from '../screens/tabs/HomeScreen';
import MarketsScreen from '../screens/tabs/MarketsScreen';
import PortfolioScreen from '../screens/tabs/PortfolioScreen';
import WatchlistScreen from '../screens/tabs/WatchlistScreen';
import MoreScreen from '../screens/tabs/MoreScreen';

// Detail Screens

// New Screens
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import { GoalCreateScreen, GoalDetailScreen } from '../screens/wealth/GoalBasedInvestingScreen';

// Advisory Marketplace Screens

// Calculator Screens
import AvatarWidget from '../components/AvatarWidget';

// KYC Screens
import IronLockOverlay from '../components/IronLockOverlay';
import UpgradePromptModal from '../components/UpgradePromptModal';

// SnapTrade Screens
import OfflineBanner from '../components/ui/OfflineBanner';
import OfflineModal from '../components/ui/OfflineModal';
import SyncConflictModal from '../components/ui/SyncConflictModal';
import { useBackgroundSync } from '../hooks/useBackgroundSync';
import { startCacheWarming } from '../services/cacheWarmingService';
import { useCacheInvalidation } from '../hooks/useCacheInvalidation';
import { offlineCache } from '../services/offlineCache';
import { startWidgetAutoUpdate } from '../services/widgetService';

const LazyNotificationsScreen = lazy(() => import('../screens/NotificationsScreen'));
const LazyAchievementsScreen = lazy(() => import('../screens/achievements/AchievementsScreen'));
const LazyAdminAdvisorScreen = lazy(() => import('../screens/advisory/AdminAdvisorScreen'));
const LazyAdvisorDetailScreen = lazy(() => import('../screens/advisory/AdvisorDetailScreen'));
const LazyAdvisorListScreen = lazy(() => import('../screens/advisory/AdvisorListScreen'));
const LazyConsultationDetailScreen = lazy(() => import('../screens/advisory/ConsultationDetailScreen'));
const LazyMyConsultationsScreen = lazy(() => import('../screens/advisory/MyConsultationsScreen'));
const LazyReviewFormScreen = lazy(() => import('../screens/advisory/ReviewFormScreen'));
const LazyAIChatScreen = lazy(() => import('../screens/ai/AIChatScreen'));
const LazyAIInsightsScreen = lazy(() => import('../screens/ai/AIInsightsScreen'));
const LazyAITradeAssistantScreen = lazy(() => import('../screens/ai/AITradeAssistantScreen'));
const LazyEarningsCallScreen = lazy(() => import('../screens/ai/EarningsCallScreen'));
const LazyLiveFeedScreen = lazy(() => import('../screens/ai/LiveFeedScreen'));
const LazySentimentAlertScreen = lazy(() => import('../screens/ai/SentimentAlertScreen'));
const LazySentimentAnalysisScreen = lazy(() => import('../screens/ai/SentimentAnalysisScreen'));
const LazyCorrelationMatrixScreen = lazy(() => import('../screens/analytics/CorrelationMatrixScreen'));
const LazyDividendTrackerScreen = lazy(() => import('../screens/analytics/DividendTrackerScreen'));
const LazyFactorAnalysisScreen = lazy(() => import('../screens/analytics/FactorAnalysisScreen'));
const LazyMonteCarloSimulationScreen = lazy(() => import('../screens/analytics/MonteCarloSimulationScreen'));
const LazyPortfolioRebalancingScreen = lazy(() => import('../screens/analytics/PortfolioRebalancingScreen'));
const LazyTaxHarvestingCalendarScreen = lazy(() => import('../screens/analytics/TaxHarvestingCalendarScreen'));
const LazyConnectBrokerView = lazy(() => import('../screens/broker/ConnectBrokerView'));
const LazyCurrencyConverterScreen = lazy(() => import('../screens/calculators/CurrencyConverterScreen'));
const LazyEMICalculator = lazy(() => import('../screens/calculators/EMICalculator'));
const LazyLumpsumCalculator = lazy(() => import('../screens/calculators/LumpsumCalculator'));
const LazySIPCalculator = lazy(() => import('../screens/calculators/SIPCalculator'));
const LazyStepUpSipScreen = lazy(() => import('../screens/calculators/StepUpSipScreen'));
const LazyTaxCalculator = lazy(() => import('../screens/calculators/TaxCalculator'));
const LazyChatRoomListScreen = lazy(() => import('../screens/chat/ChatRoomListScreen'));
const LazyChatRoomScreen = lazy(() => import('../screens/chat/ChatRoomScreen'));
const LazyCommunityScreen = lazy(() => import('../screens/community/CommunityScreen'));
const LazyPostDetailScreen = lazy(() => import('../screens/community/PostDetailScreen'));
const LazyCertificateScreen = lazy(() => import('../screens/education/CertificateScreen'));
const LazyCommunityCoursesScreen = lazy(() => import('../screens/education/CommunityCoursesScreen'));
const LazyCourseDetailScreen = lazy(() => import('../screens/education/CourseDetailScreen'));
const LazyCreateCourseScreen = lazy(() => import('../screens/education/CreateCourseScreen'));
const LazyGlossaryScreen = lazy(() => import('../screens/education/GlossaryScreen'));
const LazyLearningPathDetailScreen = lazy(() => import('../screens/education/LearningPathDetailScreen'));
const LazyLearningPathsScreen = lazy(() => import('../screens/education/LearningPathsScreen'));
const LazyLessonViewScreen = lazy(() => import('../screens/education/LessonViewScreen'));
const LazyMyCoursesScreen = lazy(() => import('../screens/education/MyCoursesScreen'));
const LazyAddFundsScreen = lazy(() => import('../screens/funds/AddFundsScreen'));
const LazyFundsDashboardScreen = lazy(() => import('../screens/funds/FundsDashboardScreen'));
const LazyTransactionHistoryScreen = lazy(() => import('../screens/funds/TransactionHistoryScreen'));
const LazyTransferScreen = lazy(() => import('../screens/funds/TransferScreen'));
const LazyUPIScreen = lazy(() => import('../screens/funds/UPIScreen'));
const LazyWithdrawScreen = lazy(() => import('../screens/funds/WithdrawScreen'));
const LazyIPODashboardScreen = lazy(() => import('../screens/ipos/IPODashboardScreen'));
const LazyIPODetailScreen = lazy(() => import('../screens/ipos/IPODetailScreen'));
const LazyBehavioralJournalScreen = lazy(() => import('../screens/journal/BehavioralJournalScreen'));
const LazyAadhaarVerificationScreen = lazy(() => import('../screens/kyc/AadhaarVerificationScreen'));
const LazyBankLinkingScreen = lazy(() => import('../screens/kyc/BankLinkingScreen'));
const LazyDigiLockerScreen = lazy(() => import('../screens/kyc/DigiLockerScreen'));
const LazyPanVerificationScreen = lazy(() => import('../screens/kyc/PanVerificationScreen'));
const LazyBondDashboardScreen = lazy(() => import('../screens/markets/BondDashboardScreen'));
const LazyCommodityMarketsScreen = lazy(() => import('../screens/markets/CommodityMarketsScreen'));
const LazyCurrencyMarketsScreen = lazy(() => import('../screens/markets/CurrencyMarketsScreen'));
const LazyFuturesCurveScreen = lazy(() => import('../screens/markets/FuturesCurveScreen'));
const LazyUSMarketsScreen = lazy(() => import('../screens/markets/USMarketsScreen'));
const LazyMutualFundsScreen = lazy(() => import('../screens/mutual-funds/MutualFundsScreen'));
const LazyEconomicCalendarScreen = lazy(() => import('../screens/news/EconomicCalendarScreen'));
const LazyIPOCalendarScreen = lazy(() => import('../screens/news/IPOCalendarScreen'));
const LazyNewsFeedScreen = lazy(() => import('../screens/news/NewsFeedScreen'));
const LazyNFODashboardScreen = lazy(() => import('../screens/nfo/NFODashboardScreen'));
const LazyNFODetailScreen = lazy(() => import('../screens/nfo/NFODetailScreen'));
const LazyPaymentHistoryScreen = lazy(() => import('../screens/payments/PaymentHistoryScreen'));
const LazyProfileScreen = lazy(() => import('../screens/profile/ProfileScreen'));
const LazyQuizResultScreen = lazy(() => import('../screens/quiz/QuizResultScreen'));
const LazyReferralScreen = lazy(() => import('../screens/referral/ReferralScreen'));
const LazyContractNoteUploadScreen = lazy(() => import('../screens/reports/ContractNoteUploadScreen'));
const LazyPeriodReportScreen = lazy(() => import('../screens/reports/PeriodReportScreen'));
const LazyReportsScreen = lazy(() => import('../screens/reports/ReportsScreen'));
const LazyABTestRunnerScreen = lazy(() => import('../screens/settings/ABTestRunnerScreen'));
const LazyAISettingsScreen = lazy(() => import('../screens/settings/AISettingsScreen'));
const LazyAccessibilitySettingsScreen = lazy(() => import('../screens/settings/AccessibilitySettingsScreen'));
const LazyAdminCouponManagementScreen = lazy(() => import('../screens/settings/AdminCouponManagementScreen'));
const LazyAdminCourseReviewScreen = lazy(() => import('../screens/settings/AdminCourseReviewScreen'));
const LazyApiKeyManagementScreen = lazy(() => import('../screens/settings/ApiKeyManagementScreen'));
const LazyAvailableCouponsScreen = lazy(() => import('../screens/settings/AvailableCouponsScreen'));
const LazyCDNOptimizationScreen = lazy(() => import('../screens/settings/CDNOptimizationScreen'));
const LazyCouponHistoryScreen = lazy(() => import('../screens/settings/CouponHistoryScreen'));
const LazyDarkModeSettingsScreen = lazy(() => import('../screens/settings/DarkModeSettingsScreen'));
const LazyFeatureFlagsScreen = lazy(() => import('../screens/settings/FeatureFlagsScreen'));
const LazyGDPRScreen = lazy(() => import('../screens/settings/GDPRScreen'));
const LazyLandscapeSettingsScreen = lazy(() => import('../screens/settings/LandscapeSettingsScreen'));
const LazyNotificationPreferencesScreen = lazy(() => import('../screens/settings/NotificationPreferencesScreen'));
const LazyPortfolioAlertsScreen = lazy(() => import('../screens/settings/PortfolioAlertsScreen'));
const LazyRiskSettingsScreen = lazy(() => import('../screens/settings/RiskSettingsScreen'));
const LazySecurityAuditLogScreen = lazy(() => import('../screens/settings/SecurityAuditLogScreen'));
const LazySecuritySettingsScreen = lazy(() => import('../screens/settings/SecuritySettingsScreen'));
const LazySubscriptionScreen = lazy(() => import('../screens/settings/SubscriptionScreen'));
const LazyTelegramConnectScreen = lazy(() => import('../screens/settings/TelegramConnectScreen'));
const LazyTenantConfigScreen = lazy(() => import('../screens/settings/TenantConfigScreen'));
const LazyTwoFactorSetupScreen = lazy(() => import('../screens/settings/TwoFactorSetupScreen'));
const LazyVoiceSettingsScreen = lazy(() => import('../screens/settings/VoiceSettingsScreen'));
const LazyWebhookManagementScreen = lazy(() => import('../screens/settings/WebhookManagementScreen'));
const LazyWidgetSettingsScreen = lazy(() => import('../screens/settings/WidgetSettingsScreen'));
const LazySnapTradeConnectScreen = lazy(() => import('../screens/snaptrade/SnapTradeConnectScreen'));
const LazySnapTradeOrderScreen = lazy(() => import('../screens/snaptrade/SnapTradeOrderScreen'));
const LazySnapTradePortfolioScreen = lazy(() => import('../screens/snaptrade/SnapTradePortfolioScreen'));
const LazyCreatePollScreen = lazy(() => import('../screens/social/CreatePollScreen'));
const LazyPollsScreen = lazy(() => import('../screens/social/PollsScreen'));
const LazyRevenueDashboardScreen = lazy(() => import('../screens/social/RevenueDashboardScreen'));
const LazySocialTradingScreen = lazy(() => import('../screens/social/SocialTradingScreen'));
const LazyTraderProfileScreen = lazy(() => import('../screens/social/TraderProfileScreen'));
const LazyCompanyFundamentalsScreen = lazy(() => import('../screens/stock/CompanyFundamentalsScreen'));
const LazyCryptoDetailScreen = lazy(() => import('../screens/stock/CryptoDetailScreen'));
const LazyGlobalStockDetailScreen = lazy(() => import('../screens/stock/GlobalStockDetailScreen'));
const LazyStockDetailScreen = lazy(() => import('../screens/stock/StockDetailScreen'));
const LazyStockScreenerScreen = lazy(() => import('../screens/stock/StockScreenerScreen'));
const LazyUSStockDetailScreen = lazy(() => import('../screens/stock/USStockDetailScreen'));
const LazyHelpScreen = lazy(() => import('../screens/support/HelpScreen'));
const LazyLegalScreen = lazy(() => import('../screens/legal/LegalScreen'));
const LazyLearnScreen = lazy(() => import('../screens/tabs/LearnScreen'));
const LazyCryptoTradingScreen = lazy(() => import('../screens/trade/CryptoTradingScreen'));
const LazyFnOOptionsChainScreen = lazy(() => import('../screens/trade/FnOOptionsChainScreen'));
const LazyOpenOrdersScreen = lazy(() => import('../screens/trade/OpenOrdersScreen'));
const LazyPlaceOrderScreen = lazy(() => import('../screens/trade/PlaceOrderScreen'));
const LazyStrategyBuilderScreen = lazy(() => import('../screens/trade/StrategyBuilderScreen'));
const LazyStrategyPerformanceScreen = lazy(() => import('../screens/trade/StrategyPerformanceScreen'));
const LazyTradeHistoryScreen = lazy(() => import('../screens/trade/TradeHistoryScreen'));
const LazyUSStocksTradingScreen = lazy(() => import('../screens/trade/USStocksTradingScreen'));
const LazyRetirementPlannerScreen = lazy(() => import('../screens/wealth/RetirementPlannerScreen'));
const LazyWealthDashboardScreen = lazy(() => import('../screens/wealth/WealthDashboardScreen'));

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({ name, focused, color, badgeCount }: { name: string; focused: boolean; color: string; badgeCount?: number }) {
  const scaleAnim = useSharedValue(focused ? 1 : 0.85);
  const badgeScale = useSharedValue(1);
  const prevBadgeCount = useRef(badgeCount);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  React.useEffect(() => {
    scaleAnim.value = withSpring(focused ? 1 : 0.85, { stiffness: 120, damping: 12 });
  }, [focused, scaleAnim]);

  // Accent pill: springs to full width when focused, shrinks away otherwise
  const pillWidth = useSharedValue(focused ? 18 : 0);
  React.useEffect(() => {
    pillWidth.value = withSpring(focused ? 18 : 0, { stiffness: 220, damping: 20 });
  }, [focused, pillWidth]);
  const pillStyle = useAnimatedStyle(() => ({
    width: pillWidth.value,
    opacity: pillWidth.value > 2 ? 1 : 0,
  }));

  // Pulse badge when count increases
  React.useEffect(() => {
    if (badgeCount !== undefined && prevBadgeCount.current !== undefined && badgeCount > prevBadgeCount.current) {
      badgeScale.value = 1.5;
      badgeScale.value = withSpring(1, { stiffness: 80, damping: 14 });
    }
    prevBadgeCount.current = badgeCount;
  }, [badgeCount, badgeScale]);

  return (
    <Animated.View style={[tabStyles.iconContainer, iconStyle]}>
      <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={24} color={color} />
      {/* Animated accent pill under the active tab */}
      <Animated.View
        style={[tabStyles.pill, { backgroundColor: color }, pillStyle]}
        testID={`tab-pill-${name}`}
      />
      {badgeCount !== undefined && badgeCount > 0 && (
        <Animated.View style={[tabStyles.badgeOverlay, badgeStyle]}>
          <Text style={tabStyles.badgeText}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pill: {
    position: 'absolute',
    bottom: -7,
    height: 3,
    borderRadius: 2,
  },
  badgeOverlay: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
});

function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const wsLockdownCount = useRiskStore(s => s.wsLockdownCount);
  const clearLockdownAlert = useRiskStore(s => s.clearLockdownAlert);
  const portfolioAlertBadgeCount = useNotificationStore(s => s.portfolioAlertBadgeCount);
  const clearPortfolioAlertBadge = useNotificationStore(s => s.clearPortfolioAlertBadge);
  const totalBadgeCount = wsLockdownCount + portfolioAlertBadgeCount;

  return (
    <>
      <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          switch (route.name) {
            case 'Home': iconName = focused ? 'home' : 'home-outline'; break;
            case 'Markets': iconName = focused ? 'trending-up' : 'trending-up-outline'; break;
            case 'Portfolio': iconName = focused ? 'pie-chart' : 'pie-chart-outline'; break;
            case 'Watchlist': iconName = focused ? 'heart' : 'heart-outline'; break;
            case 'More': iconName = focused ? 'grid' : 'grid-outline'; break;
            default: iconName = 'ellipse';
          }
          return (
            <TabIcon
              name={iconName}
              focused={focused}
              color={color}
              badgeCount={route.name === 'More' ? totalBadgeCount : undefined}
            />
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          // Solid design-system surface with hairline top border
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 6,
          paddingBottom: 8,
          height: 52 + insets.bottom,
          elevation: 12,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.35,
          shadowRadius: 20,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          fontFamily: 'System',
        },

      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarButtonTestID: "tab-home" }} />
      <Tab.Screen name="Markets" component={MarketsScreen} options={{ tabBarButtonTestID: "tab-markets" }} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ tabBarButtonTestID: "tab-portfolio" }} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} options={{ tabBarButtonTestID: "tab-watchlist" }} />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarButtonTestID: "tab-more",
        }}
        listeners={{
          tabPress: () => {
            if (wsLockdownCount > 0) clearLockdownAlert();
            if (portfolioAlertBadgeCount > 0) clearPortfolioAlertBadge();
          },
        }}
      />
    </Tab.Navigator>
      <AvatarWidget />
      <IronLockOverlay />
      <UpgradePromptModal />
      <OfflineBanner />
      <OfflineModal />
      <SyncConflictModal />
    </>
  );
}

export default function AppNavigator() {
  // Start background sync listener for offline mutation queue
  useBackgroundSync();

  // Start cache warming (background pre-fetch of stale caches)
  useEffect(() => {
    startCacheWarming();
    startWidgetAutoUpdate();
  }, []);

  // Push-based cache invalidation via WebSocket
  useCacheInvalidation();

  // Periodic cache analytics logger (every 30 minutes)
  useEffect(() => {
    const interval = setInterval(async () => {
      const cacheAnalytics = offlineCache.getAnalytics();
      const storageStats = await offlineCache.getStorageStats();
      analytics.logEvent('cache_analytics', {
        totalCacheHits: cacheAnalytics.hits,
        totalCacheMisses: cacheAnalytics.misses,
        staleHits: cacheAnalytics.staleHits,
        totalSaves: cacheAnalytics.saves,
        compressionRatio: cacheAnalytics.compressionRatio,
        totalBytesSaved: cacheAnalytics.totalBytesSaved,
        totalBytesUsed: storageStats.totalBytes,
        warmingRuns: 0,
        namespacesWarmed: 0,
      }).catch(() => {});
    }, 30 * 60 * 1000); // 30 min
    return () => clearInterval(interval);
  }, []);

  const { isLoggedIn, user } = useAuthStore();
  const hasCompletedOnboarding = useOnboardingStore(s => s.hasCompletedOnboarding);
  const onboardingInitialized = useOnboardingStore(s => s.initialized);
  const { colors } = useTheme();
  const routeNameRef = useRef<string | null>(null);

  // Set Firebase user ID and properties when auth state changes
  useEffect(() => {
    if (user) {
      analytics.setUserId(user.id);
      analytics.setUserProperty('kyc_status', user.kycStatus);
      // Initialize feature flags with user ID for rollout bucketing
      useFeatureFlagStore.getState().initialize(user.id);
    }
  }, [user]);

  // Handle deep links for logged-in users (Signup screen isn't rendered)
  useEffect(() => {
    if (!isLoggedIn) return;

    function handleDeepLink(url: string | null) {
      if (!url) return;

      try {
        const parsed = new URL(url);
        const path = parsed.pathname.replace(/^\/+/, '') || parsed.hostname;
        const params = Object.fromEntries(parsed.searchParams.entries());

        // Referral link: toroloom://signup?ref=XXX
        const ref = params.ref;
        if (ref && path === 'signup') {
          authApi.recordReferral(ref).then(() => {
            Alert.alert(
              '🎉 Referral Applied',
              `You were referred by ${ref}! Your account has been updated.`,
              [{ text: 'Awesome!' }]
            );
          }).catch(() => {
            useOnboardingStore.getState().setReferralSource(ref);
          });
          return;
        }

        // Stock detail: toroloom://stock/RELIANCE?id=123&symbol=RELIANCE
        if (path.startsWith('stock/')) {
          const symbol = decodeURIComponent(path.replace('stock/', ''));
          if (symbol) {
            // Navigation handled by React Navigation linking config
            analytics.logScreenView('StockDetail');
          }
          return;
        }

        // Community post: toroloom://post/abc123
        if (path.startsWith('post/')) {
          const postId = path.replace('post/', '');
          if (postId) {
            analytics.logScreenView('CommunityPost');
          }
          return;
        }

        // Course: toroloom://course/abc123
        if (path.startsWith('course/')) {
          const courseId = path.replace('course/', '');
          if (courseId) {
            analytics.logScreenView('CourseDetail');
          }
          return;
        }

        // Advisor: toroloom://advisor/abc123
        if (path.startsWith('advisor/')) {
          const advisorId = path.replace('advisor/', '');
          if (advisorId) {
            analytics.logScreenView('AdvisorDetail');
          }
          return;
        }
      } catch {
        // Invalid URL — ignore
      }
    }

    // Check if the app was opened via a deep link (cold start)
    Linking.getInitialURL().then(handleDeepLink);

    // Listen for deep links while the app is running (warm start)
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => subscription.remove();
  }, [isLoggedIn, user]);

  // Deep linking configuration for handling external URLs
  const linking = {
    prefixes: ['toroloom://', 'https://toroloom.com'],
    config: {
      screens: {
        Signup: 'signup',
        BrokerConnect: 'broker-connect',
        StockDetail: {
          path: 'stock/:symbol',
          parse: {
            symbol: (symbol: string) => decodeURIComponent(symbol),
            id: (id: string) => id,
          },
        },
        CommunityPost: {
          path: 'post/:postId',
          parse: {
            postId: (postId: string) => postId,
          },
        },
        CourseDetail: {
          path: 'course/:courseId',
          parse: {
            courseId: (courseId: string) => courseId,
          },
        },
        AdvisorDetail: {
          path: 'advisor/:advisorId',
          parse: {
            advisorId: (advisorId: string) => advisorId,
          },
        },
      },
    },
  };

  // Recursively resolve the active route name from nested navigators
  // (tabs inside stacks, stacks inside drawers, etc.)
  const getActiveRouteName = useCallback((state: any): string | null => {
    if (!state) return null;
    const route = state.routes?.[state.index];
    if (!route) return null;
    // Drill into nested navigator state (tabs within stacks, etc.)
    if (route.state) {
      return getActiveRouteName(route.state);
    }
    return route.name;
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        // Track the initial screen on first render
        if (!isLoggedIn) routeNameRef.current = 'Login';
        else if (!onboardingInitialized) routeNameRef.current = 'Loading';
        else if (!hasCompletedOnboarding) routeNameRef.current = 'Onboarding';
        else routeNameRef.current = 'Home';
      }}
      onStateChange={async (state) => {
        const screenName = getActiveRouteName(state);
        if (screenName && screenName !== routeNameRef.current) {
          routeNameRef.current = screenName;
          await analytics.logScreenView(screenName);
        }
      }}
    >
      {/* Lazy screens (React.lazy below) suspend on first navigation — the
          fallback keeps the current screen mounted with the app background
          instead of throwing "A component suspended while responding to
          synchronous input". Screens are tiny once Metro splits them, so the
          fallback never shows in practice. */}
      <Suspense fallback={null}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        {!isLoggedIn ? (
          // Auth Screens
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : !onboardingInitialized ? (
          // Loading — wait for onboarding state to hydrate from AsyncStorage
          <Stack.Screen name="Loading" component={() => null} />
        ) : !hasCompletedOnboarding ? (
          // Onboarding (first-time users only)
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        ) : (
          // Main App Screens
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="StockDetail" component={LazyStockDetailScreen} />
            <Stack.Screen name="StockScreener" component={LazyStockScreenerScreen} />
            <Stack.Screen name="NewsFeed" component={LazyNewsFeedScreen} />
            <Stack.Screen name="IPOCalendar" component={LazyIPOCalendarScreen} />
            <Stack.Screen name="IPODashboard" component={LazyIPODashboardScreen} />
            <Stack.Screen name="IPODetail" component={LazyIPODetailScreen} />
            <Stack.Screen name="NFODashboard" component={LazyNFODashboardScreen} />
            <Stack.Screen name="NFODetail" component={LazyNFODetailScreen} />
            <Stack.Screen name="EconomicCalendar" component={LazyEconomicCalendarScreen} />
            <Stack.Screen name="ChatList" component={LazyChatRoomListScreen} />
            <Stack.Screen name="ChatRoom" component={LazyChatRoomScreen} />
            <Stack.Screen name="BehavioralJournal" component={LazyBehavioralJournalScreen} />
            <Stack.Screen name="ContractNoteParser" component={LazyContractNoteUploadScreen} />
            <Stack.Screen name="USMarkets" component={LazyUSMarketsScreen} />
            <Stack.Screen name="BondDashboard" component={LazyBondDashboardScreen} />
            <Stack.Screen name="CurrencyMarkets" component={LazyCurrencyMarketsScreen} />
            <Stack.Screen name="TaxHarvesting" component={LazyTaxHarvestingCalendarScreen} />
            <Stack.Screen name="CommodityMarkets" component={LazyCommodityMarketsScreen} />
            <Stack.Screen name="FuturesCurve" component={LazyFuturesCurveScreen} />
            <Stack.Screen name="USStockDetail" component={LazyUSStockDetailScreen} />
            <Stack.Screen name="GlobalStockDetail" component={LazyGlobalStockDetailScreen} />
            <Stack.Screen name="CompanyFundamentals" component={LazyCompanyFundamentalsScreen} />
            <Stack.Screen name="Learn" component={LazyLearnScreen} />
            <Stack.Screen name="Polls" component={LazyPollsScreen} />
            <Stack.Screen name="CreatePoll" component={LazyCreatePollScreen} />
            <Stack.Screen name="RevenueDashboard" component={LazyRevenueDashboardScreen} />
            <Stack.Screen name="SocialTrading" component={LazySocialTradingScreen} />
            <Stack.Screen name="TraderProfile" component={LazyTraderProfileScreen} />
            <Stack.Screen name="Community" component={LazyCommunityScreen} />
            <Stack.Screen name="CommunityPost" component={LazyPostDetailScreen} />
            <Stack.Screen name="AIInsights" component={LazyAIInsightsScreen} />
            <Stack.Screen name="AIChat" component={LazyAIChatScreen} />
            <Stack.Screen name="AITradeAssistant" component={LazyAITradeAssistantScreen} />
            <Stack.Screen name="EarningsCall" component={LazyEarningsCallScreen} />
            <Stack.Screen name="SentimentAnalysis" component={LazySentimentAnalysisScreen} />
            <Stack.Screen name="SentimentAlert" component={LazySentimentAlertScreen} />
            <Stack.Screen name="LiveFeed" component={LazyLiveFeedScreen} />
            <Stack.Screen name="Profile" component={LazyProfileScreen} />
            <Stack.Screen name="MutualFunds" component={LazyMutualFundsScreen} />
            <Stack.Screen name="SIPs" component={LazyMutualFundsScreen} />
            <Stack.Screen name="TradeHistory" component={LazyTradeHistoryScreen} />
            <Stack.Screen name="PlaceOrder" component={LazyPlaceOrderScreen} />
            <Stack.Screen name="OpenOrders" component={LazyOpenOrdersScreen} />
            <Stack.Screen name="Reports" component={LazyReportsScreen} />
            <Stack.Screen name="PeriodReport" component={LazyPeriodReportScreen} />
            <Stack.Screen name="Notifications" component={LazyNotificationsScreen} />
            <Stack.Screen name="Achievements" component={LazyAchievementsScreen} />
            <Stack.Screen name="Settings" component={LazyRiskSettingsScreen} />
            <Stack.Screen name="Help" component={LazyHelpScreen} />
            <Stack.Screen name="Legal" component={LazyLegalScreen} />
            <Stack.Screen name="CourseDetail" component={LazyCourseDetailScreen} />
            <Stack.Screen name="LessonView" component={LazyLessonViewScreen} />
            <Stack.Screen name="QuizResult" component={LazyQuizResultScreen} />
            <Stack.Screen name="Glossary" component={LazyGlossaryScreen} />
            <Stack.Screen name="MyCourses" component={LazyMyCoursesScreen} />
            <Stack.Screen name="CreateCourse" component={LazyCreateCourseScreen} />
            <Stack.Screen name="CommunityCourses" component={LazyCommunityCoursesScreen} />
            <Stack.Screen name="LearningPaths" component={LazyLearningPathsScreen} />
            <Stack.Screen name="LearningPathDetail" component={LazyLearningPathDetailScreen} />
            <Stack.Screen name="Certificate" component={LazyCertificateScreen} />
            <Stack.Screen name="NotificationPreferences" component={LazyNotificationPreferencesScreen} />
            <Stack.Screen name="PortfolioAlerts" component={LazyPortfolioAlertsScreen} />
            <Stack.Screen name="Subscription" component={LazySubscriptionScreen} />
            <Stack.Screen name="AvailableCoupons" component={LazyAvailableCouponsScreen} />
            <Stack.Screen name="CouponHistory" component={LazyCouponHistoryScreen} />
            <Stack.Screen name="AdminCouponManager" component={LazyAdminCouponManagementScreen} />
            <Stack.Screen name="AdminCourseReview" component={LazyAdminCourseReviewScreen} />
            <Stack.Screen name="PaymentHistory" component={LazyPaymentHistoryScreen} />
            <Stack.Screen name="AddFunds" component={LazyAddFundsScreen} />
            <Stack.Screen name="Withdraw" component={LazyWithdrawScreen} />
            <Stack.Screen name="TransactionHistory" component={LazyTransactionHistoryScreen} />
            <Stack.Screen name="Transfer" component={LazyTransferScreen} />
            <Stack.Screen name="UPI" component={LazyUPIScreen} />
            <Stack.Screen name="FundsDashboard" component={LazyFundsDashboardScreen} />
            <Stack.Screen name="BrokerConnect" component={LazyConnectBrokerView} />
            <Stack.Screen name="WidgetSettings" component={LazyWidgetSettingsScreen} />
            <Stack.Screen name="Referral" component={LazyReferralScreen} />
            <Stack.Screen name="TenantConfig" component={LazyTenantConfigScreen} />
            <Stack.Screen name="VoiceSettings" component={LazyVoiceSettingsScreen} />
            <Stack.Screen name="SecuritySettings" component={LazySecuritySettingsScreen} />
            <Stack.Screen name="SecurityAuditLog" component={LazySecurityAuditLogScreen} />
            <Stack.Screen name="ApiKeys" component={LazyApiKeyManagementScreen} />
            <Stack.Screen name="Webhooks" component={LazyWebhookManagementScreen} />
            <Stack.Screen name="TwoFactorSetup" component={LazyTwoFactorSetupScreen} />
            <Stack.Screen name="FeatureFlags" component={LazyFeatureFlagsScreen} />
            <Stack.Screen name="ABTestRunner" component={LazyABTestRunnerScreen} />
            <Stack.Screen name="MonteCarlo" component={LazyMonteCarloSimulationScreen} />
            <Stack.Screen name="PortfolioRebalancing" component={LazyPortfolioRebalancingScreen} />
            <Stack.Screen name="DividendTracker" component={LazyDividendTrackerScreen} />
            <Stack.Screen name="CorrelationMatrix" component={LazyCorrelationMatrixScreen} />
            <Stack.Screen name="FactorAnalysis" component={LazyFactorAnalysisScreen} />
            <Stack.Screen name="TelegramConnect" component={LazyTelegramConnectScreen} />
            <Stack.Screen name="AISettings" component={LazyAISettingsScreen} />
            <Stack.Screen name="DarkMode" component={LazyDarkModeSettingsScreen} />
            <Stack.Screen name="GDPR" component={LazyGDPRScreen} />
            <Stack.Screen name="Accessibility" component={LazyAccessibilitySettingsScreen} />
            <Stack.Screen name="LandscapeMode" component={LazyLandscapeSettingsScreen} />
            <Stack.Screen name="CDNOptimization" component={LazyCDNOptimizationScreen} />
            <Stack.Screen name="CryptoDetail" component={LazyCryptoDetailScreen} />
            <Stack.Screen name="WealthDashboard" component={LazyWealthDashboardScreen} />
            <Stack.Screen name="GoalCreate" component={GoalCreateScreen} />
            <Stack.Screen name="GoalDetail" component={GoalDetailScreen} />
            <Stack.Screen name="RetirementPlanner" component={LazyRetirementPlannerScreen} />
            <Stack.Screen name="USStocksTrading" component={LazyUSStocksTradingScreen} />
            <Stack.Screen name="CryptoTrading" component={LazyCryptoTradingScreen} />
            <Stack.Screen name="FnOOptionsChain" component={LazyFnOOptionsChainScreen} />
            <Stack.Screen name="StrategyBuilder" component={LazyStrategyBuilderScreen} />
            <Stack.Screen name="StrategyPerformance" component={LazyStrategyPerformanceScreen} />
            <Stack.Screen name="SIPCalculator" component={LazySIPCalculator} />
            <Stack.Screen name="StepUpSip" component={LazyStepUpSipScreen} />
            <Stack.Screen name="LumpsumCalculator" component={LazyLumpsumCalculator} />
            <Stack.Screen name="EMICalculator" component={LazyEMICalculator} />
            <Stack.Screen name="TaxCalculator" component={LazyTaxCalculator} />
            <Stack.Screen name="CurrencyConverter" component={LazyCurrencyConverterScreen} />
            <Stack.Screen name="SnapTradeConnect" component={LazySnapTradeConnectScreen} />
            <Stack.Screen name="SnapTradePortfolio" component={LazySnapTradePortfolioScreen} />
            <Stack.Screen name="SnapTradeOrder" component={LazySnapTradeOrderScreen} />
            <Stack.Screen name="PanVerification" component={LazyPanVerificationScreen} />
            <Stack.Screen name="AadhaarVerification" component={LazyAadhaarVerificationScreen} />
            <Stack.Screen name="DigiLocker" component={LazyDigiLockerScreen} />
            <Stack.Screen name="BankLinking" component={LazyBankLinkingScreen} />
            <Stack.Screen name="AdvisorList" component={LazyAdvisorListScreen} />
            <Stack.Screen name="AdvisorDetail" component={LazyAdvisorDetailScreen} />
            <Stack.Screen name="MyConsultations" component={LazyMyConsultationsScreen} />
            <Stack.Screen name="ConsultationDetail" component={LazyConsultationDetailScreen} />
            <Stack.Screen name="ReviewForm" component={LazyReviewFormScreen} />
            <Stack.Screen name="AdminAdvisor" component={LazyAdminAdvisorScreen} />
          </>
        )}
      </Stack.Navigator>
      </Suspense>
    </NavigationContainer>
  );
}
