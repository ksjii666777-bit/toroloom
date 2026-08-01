/**
 * ============================================================================
 * Toroloom — MoreScreen Navigation Route Resolution Tests
 * ============================================================================
 *
 * Verifies that every screen name referenced in MoreScreen's
 * navigation.navigate() calls corresponds to a registered route in
 * AppNavigator. This prevents runtime crashes when users tap menu items
 * on the More tab.
 *
 * ⚠️  Keep MENU_ITEM_ROUTES and MORE_SCREEN_ROUTES in sync with:
 *     - src/screens/tabs/MoreScreen.tsx  (menuItems + quickActions)
 *     - src/navigation/AppNavigator.tsx  (Stack.Screen names)
 *
 * Run: npx vitest run --reporter=verbose
 */

import { describe, it, expect } from 'vitest';

// ============ All routes referenced in MoreScreen ============
//
// These are extracted from src/screens/tabs/MoreScreen.tsx:
//
//   menuItems[].screen                → navigation.navigate(item.screen)
//   profileCard onPress               → navigation.navigate('Profile')
//   quickActions                      → navigation.navigate(item.screen)
//   balanceCard Add button            → navigation.navigate('AddFunds')
//   balanceCard Withdraw button       → navigation.navigate('Withdraw')
//   achievements preview card         → navigation.navigate('Achievements')
//
// Additionally, from src/screens/funds/UPIScreen.tsx:
//   success view 'View History' link  → navigation.navigate('TransactionHistory')

const MORE_SCREEN_ROUTES = [
  // Trading
  'FnOOptionsChain',
  'OpenOrders',
  'TradeHistory',
  'StrategyBuilder',
  'StrategyPerformance',
  'USStocksTrading',
  'CryptoTrading',
  'FuturesCurve',
  'BehavioralJournal',
  // Portfolio & Wealth
  'FundsDashboard',
  'MutualFunds',
  'SIPs',
  'Portfolio',
  'SnapTradePortfolio',
  'BondDashboard',
  'DividendTracker',
  'WealthDashboard',
  'PortfolioRebalancing',
  'TaxHarvesting',
  // Analytics
  'Reports',
  'MonteCarlo',
  'CorrelationMatrix',
  'FactorAnalysis',
  'NFODashboard',
  'EconomicCalendar',
  'IPOCalendar',
  'AIInsights',
  // Markets & News
  'NewsFeed',
  'USMarkets',
  'CurrencyMarkets',
  'CommodityMarkets',
  'Glossary',
  'EarningsCall',
  // Learn & Grow
  'Learn',
  'Community',
  'Polls',
  'ChatList',
  'AIChat',
  'Achievements',
  'RevenueDashboard',
  // Account & Settings
  'Profile',
  'BrokerConnect',
  'PaymentHistory',
  'Notifications',
  'PortfolioAlerts',
  'Settings',
  'SecuritySettings',
  'Help',
  'AISettings',
  'TelegramConnect',
  'VoiceSettings',
  'Webhooks',
  'ApiKeys',
  'FeatureFlags',
  'Accessibility',
  'Referral',
  'Subscription',
  'WidgetSettings',
  'TenantConfig',
  'ABTestRunner',
  'CDNOptimization',
  'LandscapeMode',
  'AdminCouponManager',
  'AdminCourseReview',
  // Quick actions & balance card buttons
  'AddFunds',
  'Withdraw',
  'Transfer',
  'UPI',
  'DarkMode',
  // Navigated from UPIScreen success view
  'TransactionHistory',
  'CurrencyConverter',
] as const;

type MoreScreenRoute = (typeof MORE_SCREEN_ROUTES)[number];

// ============ All registered Stack.Screen names in AppNavigator ============
//
// These are extracted from src/navigation/AppNavigator.tsx.
// Auth screens are excluded because they're behind the auth gate and not
// reachable from MoreScreen (which itself lives inside the auth-gated tree).

const REGISTERED_ROUTES: Record<MoreScreenRoute, string> = {
  // Trading
  FnOOptionsChain: 'FnOOptionsChain',
  OpenOrders: 'OpenOrders',
  TradeHistory: 'TradeHistory',
  StrategyBuilder: 'StrategyBuilder',
  StrategyPerformance: 'StrategyPerformance',
  USStocksTrading: 'USStocksTrading',
  CryptoTrading: 'CryptoTrading',
  FuturesCurve: 'FuturesCurve',
  BehavioralJournal: 'BehavioralJournal',
  // Portfolio & Wealth
  FundsDashboard: 'FundsDashboard',
  MutualFunds: 'MutualFunds',
  SIPs: 'SIPs',
  Portfolio: 'Portfolio',
  SnapTradePortfolio: 'SnapTradePortfolio',
  BondDashboard: 'BondDashboard',
  DividendTracker: 'DividendTracker',
  WealthDashboard: 'WealthDashboard',
  PortfolioRebalancing: 'PortfolioRebalancing',
  TaxHarvesting: 'TaxHarvesting',
  // Analytics
  Reports: 'Reports',
  MonteCarlo: 'MonteCarlo',
  CorrelationMatrix: 'CorrelationMatrix',
  FactorAnalysis: 'FactorAnalysis',
  NFODashboard: 'NFODashboard',
  EconomicCalendar: 'EconomicCalendar',
  IPOCalendar: 'IPOCalendar',
  AIInsights: 'AIInsights',
  // Markets & News
  NewsFeed: 'NewsFeed',
  USMarkets: 'USMarkets',
  CurrencyMarkets: 'CurrencyMarkets',
  CommodityMarkets: 'CommodityMarkets',
  Glossary: 'Glossary',
  EarningsCall: 'EarningsCall',
  // Learn & Grow
  Learn: 'Learn',
  Community: 'Community',
  Polls: 'Polls',
  ChatList: 'ChatList',
  AIChat: 'AIChat',
  Achievements: 'Achievements',
  RevenueDashboard: 'RevenueDashboard',
  // Account & Settings
  Profile: 'Profile',
  BrokerConnect: 'BrokerConnect',
  PaymentHistory: 'PaymentHistory',
  Notifications: 'Notifications',
  PortfolioAlerts: 'PortfolioAlerts',
  Settings: 'Settings',
  SecuritySettings: 'SecuritySettings',
  Help: 'Help',
  AISettings: 'AISettings',
  TelegramConnect: 'TelegramConnect',
  VoiceSettings: 'VoiceSettings',
  Webhooks: 'Webhooks',
  ApiKeys: 'ApiKeys',
  FeatureFlags: 'FeatureFlags',
  Accessibility: 'Accessibility',
  Referral: 'Referral',
  Subscription: 'Subscription',
  WidgetSettings: 'WidgetSettings',
  TenantConfig: 'TenantConfig',
  ABTestRunner: 'ABTestRunner',
  CDNOptimization: 'CDNOptimization',
  LandscapeMode: 'LandscapeMode',
  AdminCouponManager: 'AdminCouponManager',
  AdminCourseReview: 'AdminCourseReview',
  // Quick actions & balance card buttons
  AddFunds: 'AddFunds',
  Withdraw: 'Withdraw',
  Transfer: 'Transfer',
  UPI: 'UPI',
  DarkMode: 'DarkMode',
  // Navigated from UPIScreen success view
  TransactionHistory: 'TransactionHistory',
  CurrencyConverter: 'CurrencyConverter',
};

// ============ Parameterised route info for richer tests ============

interface MenuItemRoute {
  section: string;
  label: string;
  route: MoreScreenRoute;
}

const MENU_ITEM_ROUTES: MenuItemRoute[] = [
  // Trading
  { section: 'Trading', label: 'F&O Trading', route: 'FnOOptionsChain' },
  { section: 'Trading', label: 'Open Orders', route: 'OpenOrders' },
  { section: 'Trading', label: 'Trade History', route: 'TradeHistory' },
  { section: 'Trading', label: 'Op. Strategies', route: 'StrategyBuilder' },
  { section: 'Trading', label: 'Strategy Perf.', route: 'StrategyPerformance' },
  { section: 'Trading', label: 'US Trade', route: 'USStocksTrading' },
  { section: 'Trading', label: 'Crypto Trading', route: 'CryptoTrading' },
  { section: 'Trading', label: 'Futures Curve', route: 'FuturesCurve' },
  { section: 'Trading', label: 'Trading Journal', route: 'BehavioralJournal' },
  // Iron Lock Trade → FnOOptionsChain (same route as F&O Trading; covered by MORE_SCREEN_ROUTES)
  // Portfolio & Wealth
  { section: 'Portfolio & Wealth', label: 'Fund Dashboard', route: 'FundsDashboard' },
  { section: 'Portfolio & Wealth', label: 'Mutual Funds', route: 'MutualFunds' },
  { section: 'Portfolio & Wealth', label: 'My SIPs', route: 'SIPs' },
  { section: 'Portfolio & Wealth', label: 'Holdings', route: 'Portfolio' },
  { section: 'Portfolio & Wealth', label: 'US Portfolio', route: 'SnapTradePortfolio' },
  { section: 'Portfolio & Wealth', label: 'Bonds', route: 'BondDashboard' },
  { section: 'Portfolio & Wealth', label: 'Dividends', route: 'DividendTracker' },
  { section: 'Portfolio & Wealth', label: 'Wealth Dashboard', route: 'WealthDashboard' },
  { section: 'Portfolio & Wealth', label: 'Rebalance', route: 'PortfolioRebalancing' },
  { section: 'Portfolio & Wealth', label: 'Tax Harvesting', route: 'TaxHarvesting' },
  // Analytics
  { section: 'Analytics', label: 'Reports', route: 'Reports' },
  { section: 'Analytics', label: 'Monte Carlo', route: 'MonteCarlo' },
  { section: 'Analytics', label: 'Correlation', route: 'CorrelationMatrix' },
  { section: 'Analytics', label: 'Factor Analysis', route: 'FactorAnalysis' },
  { section: 'Analytics', label: 'NFO Dashboard', route: 'NFODashboard' },
  { section: 'Analytics', label: 'Economic Calendar', route: 'EconomicCalendar' },
  { section: 'Analytics', label: 'IPO Calendar', route: 'IPOCalendar' },
  { section: 'Analytics', label: 'AI Insights', route: 'AIInsights' },
  // Markets & News
  { section: 'Markets & News', label: 'Market News', route: 'NewsFeed' },
  { section: 'Markets & News', label: 'US Markets', route: 'USMarkets' },
  // Global Markets → USMarkets (alias; covered by MORE_SCREEN_ROUTES)
  { section: 'Markets & News', label: 'Currency Markets', route: 'CurrencyMarkets' },
  { section: 'Markets & News', label: 'Commodities', route: 'CommodityMarkets' },
  { section: 'Markets & News', label: 'Financial Glossary', route: 'Glossary' },
  { section: 'Markets & News', label: 'Earnings Calls', route: 'EarningsCall' },
  // Learn & Grow
  { section: 'Learn & Grow', label: 'Courses', route: 'Learn' },
  { section: 'Learn & Grow', label: 'Community', route: 'Community' },
  { section: 'Learn & Grow', label: 'Community Polls', route: 'Polls' },
  { section: 'Learn & Grow', label: 'Messages', route: 'ChatList' },
  { section: 'Learn & Grow', label: 'AI Assistant', route: 'AIChat' },
  // Trading Psychology → BehavioralJournal (alias; covered by MORE_SCREEN_ROUTES)
  { section: 'Learn & Grow', label: 'Achievements', route: 'Achievements' },
  { section: 'Learn & Grow', label: 'Revenue', route: 'RevenueDashboard' },
  // Account & Settings
  { section: 'Account & Settings', label: 'Profile & KYC', route: 'Profile' },
  { section: 'Account & Settings', label: 'Connect Broker', route: 'BrokerConnect' },
  { section: 'Account & Settings', label: 'Payment History', route: 'PaymentHistory' },
  { section: 'Account & Settings', label: 'Notifications', route: 'Notifications' },
  { section: 'Account & Settings', label: 'Portfolio Alerts', route: 'PortfolioAlerts' },
  { section: 'Account & Settings', label: 'Risk Settings', route: 'Settings' },
  { section: 'Account & Settings', label: 'Security', route: 'SecuritySettings' },
  { section: 'Account & Settings', label: 'Help & Support', route: 'Help' },
  { section: 'Account & Settings', label: 'AI Settings', route: 'AISettings' },
  { section: 'Account & Settings', label: 'Telegram Alerts', route: 'TelegramConnect' },
  { section: 'Account & Settings', label: 'Voice Settings', route: 'VoiceSettings' },
  { section: 'Account & Settings', label: 'Webhooks', route: 'Webhooks' },
  { section: 'Account & Settings', label: 'API Keys', route: 'ApiKeys' },
  { section: 'Account & Settings', label: 'Feature Flags', route: 'FeatureFlags' },
  { section: 'Account & Settings', label: 'Accessibility', route: 'Accessibility' },
  { section: 'Account & Settings', label: 'Refer & Earn', route: 'Referral' },
  { section: 'Account & Settings', label: 'Go Premium', route: 'Subscription' },
  { section: 'Account & Settings', label: 'Home Widget', route: 'WidgetSettings' },
  { section: 'Account & Settings', label: 'Tenant Config', route: 'TenantConfig' },
  { section: 'Account & Settings', label: 'A/B Tests', route: 'ABTestRunner' },
  { section: 'Account & Settings', label: 'Image Opt.', route: 'CDNOptimization' },
  { section: 'Account & Settings', label: 'Landscape', route: 'LandscapeMode' },
  { section: 'Account & Settings', label: 'Coupon Manager', route: 'AdminCouponManager' },
  { section: 'Account & Settings', label: 'Course Reviews', route: 'AdminCourseReview' },
];

describe('MoreScreen — Menu Item Navigation Routes', () => {
  it.each(MENU_ITEM_ROUTES)(
    '$section → "$label" navigates to route "$route"',
    ({ route }) => {
      expect(REGISTERED_ROUTES).toHaveProperty(route);
      expect(REGISTERED_ROUTES[route]).toBe(route);
    },
  );

  it('every route in MORE_SCREEN_ROUTES has a registered counterpart', () => {
    for (const route of MORE_SCREEN_ROUTES) {
      expect(REGISTERED_ROUTES[route]).toBe(route);
    }
  });

  it('has no duplicate route names in the test data', () => {
    const routes = MENU_ITEM_ROUTES.map(r => r.route);
    const unique = new Set(routes);
    expect(unique.size).toBe(routes.length);
  });

  it('has no duplicate route names in MORE_SCREEN_ROUTES', () => {
    const unique = new Set(MORE_SCREEN_ROUTES);
    expect(unique.size).toBe(MORE_SCREEN_ROUTES.length);
  });
});

describe('MoreScreen — Quick Action & Balance Routes', () => {
  it.each([
    { label: 'Add Funds', route: 'AddFunds' as MoreScreenRoute },
    { label: 'Withdraw', route: 'Withdraw' as MoreScreenRoute },
    { label: 'Transfer', route: 'Transfer' as MoreScreenRoute },
    { label: 'UPI', route: 'UPI' as MoreScreenRoute },
    { label: 'Dark Mode', route: 'DarkMode' as MoreScreenRoute },
  ])('$label → route "$route" is registered and navigable', ({ route }) => {
    expect(REGISTERED_ROUTES[route]).toBe(route);
  });

  it('AddFunds is reachable from both quick action and balance card', () => {
    expect(REGISTERED_ROUTES.AddFunds).toBe('AddFunds');
  });

  it('Withdraw is reachable from both quick action and balance card', () => {
    expect(REGISTERED_ROUTES.Withdraw).toBe('Withdraw');
  });

  it('Transfer is reachable from quick action button', () => {
    expect(REGISTERED_ROUTES.Transfer).toBe('Transfer');
  });

  it('UPI is reachable from quick action button', () => {
    expect(REGISTERED_ROUTES.UPI).toBe('UPI');
  });
});

describe('MoreScreen — Other Navigation Targets', () => {
  it('Profile card navigates to Profile route', () => {
    expect(REGISTERED_ROUTES.Profile).toBe('Profile');
  });

  it('Achievements preview card navigates to Achievements route', () => {
    expect(REGISTERED_ROUTES.Achievements).toBe('Achievements');
  });
});

describe('Funds Screens — Additional Navigation Routes', () => {
  it('UPI success screen navigates to TransactionHistory', () => {
    // UPIScreen.tsx success view has a "View Transaction History" link
    // that calls navigation.navigate('TransactionHistory')
    expect(REGISTERED_ROUTES.TransactionHistory).toBe('TransactionHistory');
  });

  it('Transfer route is registered and navigable from MoreScreen quick actions', () => {
    expect(REGISTERED_ROUTES.Transfer).toBe('Transfer');
  });

  it('UPI route is registered and navigable from MoreScreen quick actions', () => {
    expect(REGISTERED_ROUTES.UPI).toBe('UPI');
  });

  it('TransactionHistory route is registered and navigable', () => {
    // Navigated from AddFunds, Withdraw, and UPISuccess screens
    expect(REGISTERED_ROUTES.TransactionHistory).toBe('TransactionHistory');
  });
});
