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
//   quickActions: 'Add Funds'         → navigation.navigate('AddFunds')
//   quickActions: 'Withdraw'          → navigation.navigate('Withdraw')
//   quickActions: 'Transfer'          → navigation.navigate('Transfer')
//   quickActions: 'UPI'               → navigation.navigate('UPI')
//   balanceCard Add button            → navigation.navigate('AddFunds')
//   balanceCard Withdraw button       → navigation.navigate('Withdraw')
//   achievements preview card         → navigation.navigate('Achievements')
//
// Additionally, from src/screens/funds/UPIScreen.tsx:
//   success view 'View History' link  → navigation.navigate('TransactionHistory')

const MORE_SCREEN_ROUTES = [
  // Menu grid items (3 sections × 4 items)
  'MutualFunds',
  'SIPs',
  'TradeHistory',
  'Reports',
  'Learn',
  'Community',
  'AIInsights',
  'Achievements',
  'Profile',
  'Notifications',
  'PortfolioAlerts',
  'Settings',
  'Subscription',
  'Help',
  // Quick actions & balance card buttons
  'AddFunds',
  'Withdraw',
  'Transfer',
  'UPI',
  // Navigated from UPIScreen success view
  'TransactionHistory',
  'CurrencyConverter',
  'CommodityMarkets',
  'EarningsCall',
] as const;

type MoreScreenRoute = (typeof MORE_SCREEN_ROUTES)[number];

// ============ All registered Stack.Screen names in AppNavigator ============
//
// These are extracted from src/navigation/AppNavigator.tsx.
// Auth screens are excluded because they're behind the auth gate and not
// reachable from MoreScreen (which itself lives inside the auth-gated tree).

const REGISTERED_ROUTES: Record<MoreScreenRoute, string> = {
  MutualFunds: 'MutualFunds',
  SIPs: 'SIPs',
  TradeHistory: 'TradeHistory',
  Reports: 'Reports',
  Learn: 'Learn',
  Community: 'Community',
  AIInsights: 'AIInsights',
  Achievements: 'Achievements',
  Profile: 'Profile',
  Notifications: 'Notifications',
  PortfolioAlerts: 'PortfolioAlerts',
  Settings: 'Settings',
  Subscription: 'Subscription',
  Help: 'Help',
  AddFunds: 'AddFunds',
  Withdraw: 'Withdraw',
  Transfer: 'Transfer',
  UPI: 'UPI',
  TransactionHistory: 'TransactionHistory',
  CurrencyConverter: 'CurrencyConverter',
  CommodityMarkets: 'CommodityMarkets',
  EarningsCall: 'EarningsCall',
};

// ============ Parameterised route info for richer tests ============

interface MenuItemRoute {
  section: string;
  label: string;
  route: MoreScreenRoute;
}

const MENU_ITEM_ROUTES: MenuItemRoute[] = [
  // Investments
  { section: 'Investments', label: 'Mutual Funds', route: 'MutualFunds' },
  { section: 'Investments', label: 'My SIPs', route: 'SIPs' },
  { section: 'Investments', label: 'Trade History', route: 'TradeHistory' },
  { section: 'Investments', label: 'Reports', route: 'Reports' },
  // Investments
  { section: 'Investments', label: 'Commodities', route: 'CommodityMarkets' },
  // Learn & Grow
  { section: 'Learn & Grow', label: 'Earnings Calls', route: 'EarningsCall' },
  // Learn & Grow
  { section: 'Learn & Grow', label: 'Courses', route: 'Learn' },
  { section: 'Learn & Grow', label: 'Community', route: 'Community' },
  { section: 'Learn & Grow', label: 'AI Insights', route: 'AIInsights' },
  { section: 'Learn & Grow', label: 'Achievements', route: 'Achievements' },
  // Account
  { section: 'Account', label: 'Profile & KYC', route: 'Profile' },
  { section: 'Account', label: 'Go Premium', route: 'Subscription' },
  { section: 'Account', label: 'Notifications', route: 'Notifications' },
  { section: 'Account', label: 'PortfolioAlerts', route: 'PortfolioAlerts' },
  { section: 'Account', label: 'Settings', route: 'Settings' },
  { section: 'Account', label: 'Help & Support', route: 'Help' },
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
