import React, { useRef, useCallback, useEffect } from 'react';
import { Text, StyleSheet, Alert, Linking} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useRiskStore } from '../store/riskStore';
import { useNotificationStore } from '../store/notificationStore';
import { useTheme } from '../context/ThemeContext';

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
import StockDetailScreen from '../screens/stock/StockDetailScreen';
import LearnScreen from '../screens/tabs/LearnScreen';
import CommunityScreen from '../screens/community/CommunityScreen';
import PostDetailScreen from '../screens/community/PostDetailScreen';
import AIInsightsScreen from '../screens/ai/AIInsightsScreen';
import AIChatScreen from '../screens/ai/AIChatScreen';
import AITradeAssistantScreen from '../screens/ai/AITradeAssistantScreen';
import EarningsCallScreen from '../screens/ai/EarningsCallScreen';
import SentimentAnalysisScreen from '../screens/ai/SentimentAnalysisScreen';
import SentimentAlertScreen from '../screens/ai/SentimentAlertScreen';
import LiveFeedScreen from '../screens/ai/LiveFeedScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

// New Screens
import ProfileScreen from '../screens/profile/ProfileScreen';
import MutualFundsScreen from '../screens/mutual-funds/MutualFundsScreen';
import RiskSettingsScreen from '../screens/settings/RiskSettingsScreen';
import CourseDetailScreen from '../screens/education/CourseDetailScreen';
import LessonViewScreen from '../screens/education/LessonViewScreen';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QuizResultScreen: any = require('../screens/quiz/QuizResultScreen').default;
import GlossaryScreen from '../screens/education/GlossaryScreen';
import CertificateScreen from '../screens/education/CertificateScreen';
import LearningPathsScreen from '../screens/education/LearningPathsScreen';
import LearningPathDetailScreen from '../screens/education/LearningPathDetailScreen';
import MyCoursesScreen from '../screens/education/MyCoursesScreen';
import CreateCourseScreen from '../screens/education/CreateCourseScreen';
import TradeHistoryScreen from '../screens/trade/TradeHistoryScreen';
import PlaceOrderScreen from '../screens/trade/PlaceOrderScreen';
import OpenOrdersScreen from '../screens/trade/OpenOrdersScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
import HelpScreen from '../screens/support/HelpScreen';
import AchievementsScreen from '../screens/achievements/AchievementsScreen';
import NotificationPreferencesScreen from '../screens/settings/NotificationPreferencesScreen';
import PortfolioAlertsScreen from '../screens/settings/PortfolioAlertsScreen';
import SubscriptionScreen from '../screens/settings/SubscriptionScreen';
import AvailableCouponsScreen from '../screens/settings/AvailableCouponsScreen';
import CouponHistoryScreen from '../screens/settings/CouponHistoryScreen';
import AdminCouponManagementScreen from '../screens/settings/AdminCouponManagementScreen';
import PaymentHistoryScreen from '../screens/payments/PaymentHistoryScreen';
import AddFundsScreen from '../screens/funds/AddFundsScreen';
import WithdrawScreen from '../screens/funds/WithdrawScreen';
import TransactionHistoryScreen from '../screens/funds/TransactionHistoryScreen';
import TransferScreen from '../screens/funds/TransferScreen';
import UPIScreen from '../screens/funds/UPIScreen';
import FundsDashboardScreen from '../screens/funds/FundsDashboardScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import ConnectBrokerView from '../screens/broker/ConnectBrokerView';
import TenantConfigScreen from '../screens/settings/TenantConfigScreen';
import VoiceSettingsScreen from '../screens/settings/VoiceSettingsScreen';
import WidgetSettingsScreen from '../screens/settings/WidgetSettingsScreen';
import ReferralScreen from '../screens/referral/ReferralScreen';
import FeatureFlagsScreen from '../screens/settings/FeatureFlagsScreen';
import ABTestRunnerScreen from '../screens/settings/ABTestRunnerScreen';
import MonteCarloSimulationScreen from '../screens/analytics/MonteCarloSimulationScreen';
import CorrelationMatrixScreen from '../screens/analytics/CorrelationMatrixScreen';
import FactorAnalysisScreen from '../screens/analytics/FactorAnalysisScreen';
import PortfolioRebalancingScreen from '../screens/analytics/PortfolioRebalancingScreen';
import SecuritySettingsScreen from '../screens/settings/SecuritySettingsScreen';
import SecurityAuditLogScreen from '../screens/settings/SecurityAuditLogScreen';
import ApiKeyManagementScreen from '../screens/settings/ApiKeyManagementScreen';
import WebhookManagementScreen from '../screens/settings/WebhookManagementScreen';
import TwoFactorSetupScreen from '../screens/settings/TwoFactorSetupScreen';
import TelegramConnectScreen from '../screens/settings/TelegramConnectScreen';
import AISettingsScreen from '../screens/settings/AISettingsScreen';
import DarkModeSettingsScreen from '../screens/settings/DarkModeSettingsScreen';
import AccessibilitySettingsScreen from '../screens/settings/AccessibilitySettingsScreen';
import LandscapeSettingsScreen from '../screens/settings/LandscapeSettingsScreen';
import CDNOptimizationScreen from '../screens/settings/CDNOptimizationScreen';
import StockScreenerScreen from '../screens/stock/StockScreenerScreen';
import USStockDetailScreen from '../screens/stock/USStockDetailScreen';
import USMarketsScreen from '../screens/markets/USMarketsScreen';
import BondDashboardScreen from '../screens/markets/BondDashboardScreen';
import CurrencyMarketsScreen from '../screens/markets/CurrencyMarketsScreen';
import TaxHarvestingCalendarScreen from '../screens/analytics/TaxHarvestingCalendarScreen';
import CommodityMarketsScreen from '../screens/markets/CommodityMarketsScreen';
import FuturesCurveScreen from '../screens/markets/FuturesCurveScreen';
import NewsFeedScreen from '../screens/news/NewsFeedScreen';
import IPOCalendarScreen from '../screens/news/IPOCalendarScreen';
import IPODashboardScreen from '../screens/ipos/IPODashboardScreen';
import DividendTrackerScreen from '../screens/analytics/DividendTrackerScreen';
import EconomicCalendarScreen from '../screens/news/EconomicCalendarScreen';
import ChatRoomListScreen from '../screens/chat/ChatRoomListScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import SocialTradingScreen from '../screens/social/SocialTradingScreen';
import TraderProfileScreen from '../screens/social/TraderProfileScreen';
import BehavioralJournalScreen from '../screens/journal/BehavioralJournalScreen';
import ContractNoteUploadScreen from '../screens/reports/ContractNoteUploadScreen';
import PollsScreen from '../screens/social/PollsScreen';
import CreatePollScreen from '../screens/social/CreatePollScreen';
import RevenueDashboardScreen from '../screens/social/RevenueDashboardScreen';
import FnOOptionsChainScreen from '../screens/trade/FnOOptionsChainScreen';
import StrategyBuilderScreen from '../screens/trade/StrategyBuilderScreen';
import StrategyPerformanceScreen from '../screens/trade/StrategyPerformanceScreen';

// Calculator Screens
import SIPCalculator from '../screens/calculators/SIPCalculator';
import StepUpSipScreen from '../screens/calculators/StepUpSipScreen';
import LumpsumCalculator from '../screens/calculators/LumpsumCalculator';
import EMICalculator from '../screens/calculators/EMICalculator';
import TaxCalculator from '../screens/calculators/TaxCalculator';
import AvatarWidget from '../components/AvatarWidget';

// KYC Screens
import PanVerificationScreen from '../screens/kyc/PanVerificationScreen';
import AadhaarVerificationScreen from '../screens/kyc/AadhaarVerificationScreen';
import DigiLockerScreen from '../screens/kyc/DigiLockerScreen';
import BankLinkingScreen from '../screens/kyc/BankLinkingScreen';
import IronLockOverlay from '../components/IronLockOverlay';
import UpgradePromptModal from '../components/UpgradePromptModal';
import OfflineBanner from '../components/ui/OfflineBanner';
import SyncStatusIndicator from '../components/ui/SyncStatusIndicator';
import SyncConflictModal from '../components/ui/SyncConflictModal';
import { useBackgroundSync } from '../hooks/useBackgroundSync';
import { startCacheWarming } from '../services/cacheWarmingService';
import { useCacheInvalidation } from '../hooks/useCacheInvalidation';
import { offlineCache } from '../services/offlineCache';
import { startWidgetAutoUpdate } from '../services/widgetService';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          fontFamily: 'System',
        },

      })}
    >
      <Tab.Screen
        name="More"
        component={MoreScreen}
        listeners={{
          tabPress: () => {
            if (wsLockdownCount > 0) clearLockdownAlert();
            if (portfolioAlertBadgeCount > 0) clearPortfolioAlertBadge();
          },
        }}
      />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Markets" component={MarketsScreen} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} />
    </Tab.Navigator>
      <AvatarWidget />
      <IronLockOverlay />
      <UpgradePromptModal />
      <SyncStatusIndicator />
      <OfflineBanner />
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

      // Parse referral ref from toroloom://signup?ref=XXX or https://toroloom.com/signup?ref=XXX
      // For custom scheme URLs (toroloom://signup), 'signup' is the hostname.
      // For HTTPS universal links (https://toroloom.com/signup), 'signup' is the pathname.
      try {
        const parsed = new URL(url);
        const ref = parsed.searchParams.get('ref');
        const path = parsed.pathname.replace(/^\/+/, '') || parsed.hostname;
        if (ref && path === 'signup') {
          // Record the referral on the user's account
          authApi.recordReferral(ref).then(() => {
            Alert.alert(
              '🎉 Referral Applied',
              `You were referred by ${ref}! Your account has been updated.`,
              [{ text: 'Awesome!' }]
            );
          }).catch(() => {
            // Backend unavailable — store locally as fallback
            useOnboardingStore.getState().setReferralSource(ref);
          });
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
            <Stack.Screen name="StockDetail" component={StockDetailScreen} />
            <Stack.Screen name="StockScreener" component={StockScreenerScreen} />
            <Stack.Screen name="NewsFeed" component={NewsFeedScreen} />
            <Stack.Screen name="IPOCalendar" component={IPOCalendarScreen} />
            <Stack.Screen name="IPODashboard" component={IPODashboardScreen} />
            <Stack.Screen name="EconomicCalendar" component={EconomicCalendarScreen} />
            <Stack.Screen name="ChatList" component={ChatRoomListScreen} />
            <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
            <Stack.Screen name="BehavioralJournal" component={BehavioralJournalScreen} />
            <Stack.Screen name="ContractNoteParser" component={ContractNoteUploadScreen} />
            <Stack.Screen name="USMarkets" component={USMarketsScreen} />
            <Stack.Screen name="BondDashboard" component={BondDashboardScreen} />
            <Stack.Screen name="CurrencyMarkets" component={CurrencyMarketsScreen} />
            <Stack.Screen name="TaxHarvesting" component={TaxHarvestingCalendarScreen} />
            <Stack.Screen name="CommodityMarkets" component={CommodityMarketsScreen} />
            <Stack.Screen name="FuturesCurve" component={FuturesCurveScreen} />
            <Stack.Screen name="USStockDetail" component={USStockDetailScreen} />
            <Stack.Screen name="Learn" component={LearnScreen} />
            <Stack.Screen name="Polls" component={PollsScreen} />
            <Stack.Screen name="CreatePoll" component={CreatePollScreen} />
            <Stack.Screen name="RevenueDashboard" component={RevenueDashboardScreen} />
            <Stack.Screen name="SocialTrading" component={SocialTradingScreen} />
            <Stack.Screen name="TraderProfile" component={TraderProfileScreen} />
            <Stack.Screen name="Community" component={CommunityScreen} />
            <Stack.Screen name="CommunityPost" component={PostDetailScreen} />
            <Stack.Screen name="AIInsights" component={AIInsightsScreen} />
            <Stack.Screen name="AIChat" component={AIChatScreen} />
            <Stack.Screen name="AITradeAssistant" component={AITradeAssistantScreen} />
            <Stack.Screen name="EarningsCall" component={EarningsCallScreen} />
            <Stack.Screen name="SentimentAnalysis" component={SentimentAnalysisScreen} />
            <Stack.Screen name="SentimentAlert" component={SentimentAlertScreen} />
            <Stack.Screen name="LiveFeed" component={LiveFeedScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="MutualFunds" component={MutualFundsScreen} />
            <Stack.Screen name="SIPs" component={MutualFundsScreen} />
            <Stack.Screen name="TradeHistory" component={TradeHistoryScreen} />
            <Stack.Screen name="PlaceOrder" component={PlaceOrderScreen} />
            <Stack.Screen name="OpenOrders" component={OpenOrdersScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} />
            <Stack.Screen name="Settings" component={RiskSettingsScreen} />
            <Stack.Screen name="Help" component={HelpScreen} />
            <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
            <Stack.Screen name="LessonView" component={LessonViewScreen} />
            <Stack.Screen name="QuizResult" component={QuizResultScreen} />
            <Stack.Screen name="Glossary" component={GlossaryScreen} />
            <Stack.Screen name="MyCourses" component={MyCoursesScreen} />
            <Stack.Screen name="CreateCourse" component={CreateCourseScreen} />
            <Stack.Screen name="LearningPaths" component={LearningPathsScreen} />
            <Stack.Screen name="LearningPathDetail" component={LearningPathDetailScreen} />
            <Stack.Screen name="Certificate" component={CertificateScreen} />
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
            <Stack.Screen name="PortfolioAlerts" component={PortfolioAlertsScreen} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} />
            <Stack.Screen name="AvailableCoupons" component={AvailableCouponsScreen} />
            <Stack.Screen name="CouponHistory" component={CouponHistoryScreen} />
            <Stack.Screen name="AdminCouponManager" component={AdminCouponManagementScreen} />
            <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
            <Stack.Screen name="AddFunds" component={AddFundsScreen} />
            <Stack.Screen name="Withdraw" component={WithdrawScreen} />
            <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
            <Stack.Screen name="Transfer" component={TransferScreen} />
            <Stack.Screen name="UPI" component={UPIScreen} />
            <Stack.Screen name="FundsDashboard" component={FundsDashboardScreen} />
            <Stack.Screen name="BrokerConnect" component={ConnectBrokerView} />
            <Stack.Screen name="WidgetSettings" component={WidgetSettingsScreen} />
            <Stack.Screen name="Referral" component={ReferralScreen} />
            <Stack.Screen name="TenantConfig" component={TenantConfigScreen} />
            <Stack.Screen name="VoiceSettings" component={VoiceSettingsScreen} />
            <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
            <Stack.Screen name="SecurityAuditLog" component={SecurityAuditLogScreen} />
            <Stack.Screen name="ApiKeys" component={ApiKeyManagementScreen} />
            <Stack.Screen name="Webhooks" component={WebhookManagementScreen} />
            <Stack.Screen name="TwoFactorSetup" component={TwoFactorSetupScreen} />
            <Stack.Screen name="FeatureFlags" component={FeatureFlagsScreen} />
            <Stack.Screen name="ABTestRunner" component={ABTestRunnerScreen} />
            <Stack.Screen name="MonteCarlo" component={MonteCarloSimulationScreen} />
            <Stack.Screen name="PortfolioRebalancing" component={PortfolioRebalancingScreen} />
            <Stack.Screen name="DividendTracker" component={DividendTrackerScreen} />
            <Stack.Screen name="CorrelationMatrix" component={CorrelationMatrixScreen} />
            <Stack.Screen name="FactorAnalysis" component={FactorAnalysisScreen} />
            <Stack.Screen name="TelegramConnect" component={TelegramConnectScreen} />
            <Stack.Screen name="AISettings" component={AISettingsScreen} />
            <Stack.Screen name="DarkMode" component={DarkModeSettingsScreen} />
            <Stack.Screen name="Accessibility" component={AccessibilitySettingsScreen} />
            <Stack.Screen name="LandscapeMode" component={LandscapeSettingsScreen} />
            <Stack.Screen name="CDNOptimization" component={CDNOptimizationScreen} />
            <Stack.Screen name="FnOOptionsChain" component={FnOOptionsChainScreen} />
            <Stack.Screen name="StrategyBuilder" component={StrategyBuilderScreen} />
            <Stack.Screen name="StrategyPerformance" component={StrategyPerformanceScreen} />
            <Stack.Screen name="SIPCalculator" component={SIPCalculator} />
            <Stack.Screen name="StepUpSip" component={StepUpSipScreen} />
            <Stack.Screen name="LumpsumCalculator" component={LumpsumCalculator} />
            <Stack.Screen name="EMICalculator" component={EMICalculator} />
            <Stack.Screen name="TaxCalculator" component={TaxCalculator} />
            <Stack.Screen name="PanVerification" component={PanVerificationScreen} />
            <Stack.Screen name="AadhaarVerification" component={AadhaarVerificationScreen} />
            <Stack.Screen name="DigiLocker" component={DigiLockerScreen} />
            <Stack.Screen name="BankLinking" component={BankLinkingScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
