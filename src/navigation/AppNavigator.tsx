import React, { useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useRiskStore } from '../store/riskStore';
import { useTheme } from '../context/ThemeContext';
import { FONTS } from '../constants/theme';

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
import AIInsightsScreen from '../screens/ai/AIInsightsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

// New Screens
import ProfileScreen from '../screens/profile/ProfileScreen';
import MutualFundsScreen from '../screens/mutual-funds/MutualFundsScreen';
import RiskSettingsScreen from '../screens/settings/RiskSettingsScreen';
import CourseDetailScreen from '../screens/education/CourseDetailScreen';
import LessonViewScreen from '../screens/education/LessonViewScreen';
import TradeHistoryScreen from '../screens/trade/TradeHistoryScreen';
import PlaceOrderScreen from '../screens/trade/PlaceOrderScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
import HelpScreen from '../screens/support/HelpScreen';
import AchievementsScreen from '../screens/achievements/AchievementsScreen';
import NotificationPreferencesScreen from '../screens/settings/NotificationPreferencesScreen';
import AddFundsScreen from '../screens/funds/AddFundsScreen';
import WithdrawScreen from '../screens/funds/WithdrawScreen';
import TransactionHistoryScreen from '../screens/funds/TransactionHistoryScreen';
import TransferScreen from '../screens/funds/TransferScreen';
import UPIScreen from '../screens/funds/UPIScreen';
import FundsDashboardScreen from '../screens/funds/FundsDashboardScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.85)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1 : 0.85,
      useNativeDriver: true,
      speed: 12,
      bounciness: 6,
    }).start();
  }, [focused, scaleAnim]);

  return (
    <Animated.View style={[tabStyles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
      <Ionicons name={name as any} size={24} color={color} />
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
});

function MainTabs() {
  const { colors } = useTheme();
  const wsLockdownCount = useRiskStore(s => s.wsLockdownCount);
  const clearLockdownAlert = useRiskStore(s => s.clearLockdownAlert);

  return (
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
          return <TabIcon name={iconName} focused={focused} color={color} />;
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
        tabBarBadge: route.name === 'More' && wsLockdownCount > 0 ? wsLockdownCount : undefined,
        tabBarBadgeStyle: route.name === 'More' && wsLockdownCount > 0
          ? { backgroundColor: '#FF3B30', fontSize: 11, minWidth: 18, height: 18, borderRadius: 9 }
          : undefined,
      })}
    >
      <Tab.Screen
        name="More"
        component={MoreScreen}
        listeners={{
          tabPress: () => {
            if (wsLockdownCount > 0) {
              clearLockdownAlert();
            }
          },
        }}
      />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Markets" component={MarketsScreen} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoggedIn } = useAuthStore();
  const { colors } = useTheme();

  return (
    <NavigationContainer>
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
        ) : (
          // Main App Screens
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="StockDetail" component={StockDetailScreen} />
            <Stack.Screen name="Learn" component={LearnScreen} />
            <Stack.Screen name="Community" component={CommunityScreen} />
            <Stack.Screen name="AIInsights" component={AIInsightsScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="MutualFunds" component={MutualFundsScreen} />
            <Stack.Screen name="SIPs" component={MutualFundsScreen} />
            <Stack.Screen name="TradeHistory" component={TradeHistoryScreen} />
            <Stack.Screen name="PlaceOrder" component={PlaceOrderScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} />
            <Stack.Screen name="Settings" component={RiskSettingsScreen} />
            <Stack.Screen name="Help" component={HelpScreen} />
            <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
            <Stack.Screen name="LessonView" component={LessonViewScreen} />
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
            <Stack.Screen name="AddFunds" component={AddFundsScreen} />
            <Stack.Screen name="Withdraw" component={WithdrawScreen} />
            <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
            <Stack.Screen name="Transfer" component={TransferScreen} />
            <Stack.Screen name="UPI" component={UPIScreen} />
            <Stack.Screen name="FundsDashboard" component={FundsDashboardScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
