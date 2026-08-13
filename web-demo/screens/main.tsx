/**
 * ============================================================================
 * Toroloom — Migrated Screens Browser Harness
 * ============================================================================
 *
 * Renders REAL migrated screens (AppScreen-based) against mock/seeded stores
 * so layout regressions from the AppScreen migration can be eyeballed in a
 * browser without booting the full native app.
 *
 * Screens verified: CouponHistory, AvailableCoupons, AdminDashboard,
 * AdminKYC, AdminUserManagement, LiveFeed, NFODashboard, FeatureFlags,
 * BackgroundSyncSettings, SubscriptionAnalytics, SnapTradePortfolio,
 * CryptoDetail, USMarkets, CryptoTrading, USStocksTrading, PostDetail.
 *
 * Run:
 *   npx vite build --config web-demo/screens/vite.config.ts
 *   npx vite preview --config web-demo/screens/vite.config.ts --port 4176
 *   # open http://localhost:4176
 * ============================================================================
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../src/context/ThemeContext';
import { configureApi } from '../../src/services/api/client';
import i18n from '../../src/i18n'; // initialize i18next so useT() returns translated strings
void i18n;

// Point the API client at a dead endpoint so real fetches fail and screens
// fall back to their mock/seeded/cached state (same trick as the i18n demo).
configureApi({ baseUrl: 'http://127.0.0.1:59999/api' });

import CouponHistoryScreen from '../../src/screens/settings/CouponHistoryScreen';
import AvailableCouponsScreen from '../../src/screens/settings/AvailableCouponsScreen';
import AdminDashboardScreen from '../../src/screens/admin/AdminDashboardScreen';
import AdminKYCScreen from '../../src/screens/admin/AdminKYCScreen';
import AdminUserManagementScreen from '../../src/screens/admin/AdminUserManagementScreen';
import LiveFeedScreen from '../../src/screens/ai/LiveFeedScreen';
import NFODashboardScreen from '../../src/screens/nfo/NFODashboardScreen';
import FeatureFlagsScreen from '../../src/screens/settings/FeatureFlagsScreen';
import BackgroundSyncSettingsScreen from '../../src/screens/settings/BackgroundSyncSettingsScreen';
import SubscriptionAnalyticsScreen from '../../src/screens/settings/SubscriptionAnalyticsScreen';
import SnapTradePortfolioScreen from '../../src/screens/snaptrade/SnapTradePortfolioScreen';
import CryptoDetailScreen from '../../src/screens/stock/CryptoDetailScreen';
import USMarketsScreen from '../../src/screens/markets/USMarketsScreen';
import CryptoTradingScreen from '../../src/screens/trade/CryptoTradingScreen';
import USStocksTradingScreen from '../../src/screens/trade/USStocksTradingScreen';
import PostDetailScreen from '../../src/screens/community/PostDetailScreen';

const nav: any = {
  goBack: () => {},
  navigate: () => {},
  push: () => {},
  pop: () => {},
  canGoBack: () => false,
  setParams: () => {},
};

const styles = StyleSheet.create({
  page: { backgroundColor: '#0E111A' },
  banner: {
    padding: 16,
    backgroundColor: '#141824',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  bannerTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  bannerSub: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  section: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sectionLabel: {
    color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: '#0A0D15',
  },
  frame: { height: 560 },
});

function ScreenFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

function HarnessApp() {
  return (
    <View style={styles.page}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Migrated Screens — Visual Harness</Text>
        <Text style={styles.bannerSub}>
          Each frame renders a real AppScreen-based screen. Scroll each to check
          header pinning, safe-area padding, pull-to-refresh and content flow.
        </Text>
      </View>

      <ScreenFrame label="CouponHistoryScreen (scroll + pinned header)">
        <CouponHistoryScreen navigation={nav} route={{ key: 'c', name: 'CouponHistory' } as any} />
      </ScreenFrame>

      <ScreenFrame label="AvailableCouponsScreen (scroll + pinned header)">
        <AvailableCouponsScreen navigation={nav} route={{ key: 'a', name: 'AvailableCoupons' } as any} />
      </ScreenFrame>

      <ScreenFrame label="AdminDashboardScreen (scroll + pinned header)">
        <AdminDashboardScreen navigation={nav} route={{ key: 'd', name: 'AdminDashboard' } as any} />
      </ScreenFrame>

      <ScreenFrame label="AdminKYCScreen (scroll + pinned header + search)">
        <AdminKYCScreen navigation={nav} route={{ key: 'k', name: 'AdminKYC' } as any} />
      </ScreenFrame>

      <ScreenFrame label="AdminUserManagementScreen (scroll + pinned header + search + filter chips)">
        <AdminUserManagementScreen navigation={nav} route={{ key: 'u', name: 'AdminUsers' } as any} />
      </ScreenFrame>

      <ScreenFrame label="LiveFeedScreen (scroll + pinned header + chart + filters)">
        <LiveFeedScreen navigation={nav} route={{ key: 'l', name: 'LiveFeed' } as any} />
      </ScreenFrame>

      <ScreenFrame label="NFODashboardScreen (scroll={false} + pinned header + tabs)">
        <NFODashboardScreen navigation={nav} route={{ key: 'n', name: 'NFODashboard' } as any} />
      </ScreenFrame>

      <ScreenFrame label="FeatureFlagsScreen (scroll + pinned header)">
        <FeatureFlagsScreen navigation={nav} route={{ key: 'f', name: 'FeatureFlags' } as any} />
      </ScreenFrame>

      <ScreenFrame label="BackgroundSyncSettingsScreen (scroll + pinned header)">
        <BackgroundSyncSettingsScreen navigation={nav} route={{ key: 'b', name: 'BackgroundSyncSettings' } as any} />
      </ScreenFrame>

      <ScreenFrame label="SubscriptionAnalyticsScreen (scroll + in-body header)">
        <SubscriptionAnalyticsScreen navigation={nav} route={{ key: 's', name: 'SubscriptionAnalytics' } as any} />
      </ScreenFrame>

      <ScreenFrame label="SnapTradePortfolioScreen (3 states)">
        <SnapTradePortfolioScreen navigation={nav} route={{ key: 'p', name: 'SnapTradePortfolio' } as any} />
      </ScreenFrame>

      <ScreenFrame label="CryptoDetailScreen (loading/error/main states)">
        <CryptoDetailScreen navigation={nav} route={{ key: 'c2', name: 'CryptoDetail', params: { coinId: 'bitcoin', coinSymbol: 'BTC', coinName: 'Bitcoin' } } as any} />
      </ScreenFrame>

      <ScreenFrame label="USMarketsScreen (pinned header + tabs + scroll)">
        <USMarketsScreen />
      </ScreenFrame>

      <ScreenFrame label="CryptoTradingScreen (gradient header + tabs + scroll)">
        <CryptoTradingScreen navigation={nav} route={{ key: 't1', name: 'CryptoTrading' } as any} />
      </ScreenFrame>

      <ScreenFrame label="USStocksTradingScreen (gradient header + tabs + scroll)">
        <USStocksTradingScreen navigation={nav} route={{ key: 't2', name: 'USStocksTrading' } as any} />
      </ScreenFrame>

      <ScreenFrame label="PostDetailScreen (KeyboardAvoidingView + pinned header + footer input)">
        <PostDetailScreen navigation={nav} route={{ key: 'p2', name: 'CommunityPost', params: { postId: 'p1' } } as any} />
      </ScreenFrame>
    </View>
  );
}

createRoot(document.getElementById('root')!).render(
  <SafeAreaProvider>
    <ThemeProvider>
      <HarnessApp />
    </ThemeProvider>
  </SafeAreaProvider>
);
