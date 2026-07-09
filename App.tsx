import React, { useEffect } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import './src/i18n'; // Initialize i18n
import { setupChannels } from './src/services/notificationService';
import { configureApi } from './src/services/api';
import { useAuthStore, useRiskStore, useSubscriptionStore, useOnboardingStore, usePortfolioStore, useWatchlistStore, useMarketStore, useEducationStore, useFnoStore, useCommunityStore, useAIStore } from './src/store';
import { useUpgradePromptStore } from './src/store/subscriptionUIStore';
import { onPaymentRequired } from './src/services/api/client';
import Sentry, { isSentryEnabled } from './src/services/sentry';
import useLoadFonts from './src/hooks/useLoadFonts';
import BiometricUnlockOverlay from './src/components/BiometricUnlockOverlay';
import './src/utils/debugTextError'; // Debug: catches Text error with component stack

import { seedAllBrokerSessions, seedE2EBrokerSession } from './src/services/gateway/seedE2ESession';

// Initialize notification channels on app launch
// notificationService uses lazy imports internally, so this won't crash if native modules aren't available
setupChannels().catch(() => {});

// Configure API client to read auth token from store + point to Railway backend
configureApi({
  baseUrl: 'https://toroloom-production.up.railway.app/api',
  getToken: () => useAuthStore.getState().token,
});

// Wire up the 402 Payment Required interceptor → upgrade prompt modal
onPaymentRequired((body) => {
  const userSubscription = useSubscriptionStore.getState().subscription;
  const requiredTier = (body.requiredTier ?? 'pro') as 'free' | 'pro' | 'elite';

  // Derive a user-friendly feature name from the required tier
  const featureName =
    requiredTier === 'elite'
      ? 'Iron Lock & Elite Features'
      : requiredTier === 'pro'
        ? 'Pro Features'
        : 'This feature';

  useUpgradePromptStore.getState().show({
    featureName,
    featureIcon: requiredTier === 'elite' ? 'shield' : 'diamond',
    requiredTier,
    currentTier: (body.currentTier ?? userSubscription.tier ?? 'free') as 'free' | 'pro' | 'elite',
  });
});

function FontLoadingGate({ children }: { children: React.ReactNode }) {
  const { fontsLoaded, fontError } = useLoadFonts();

  if (fontError) {
    // Font failed to load — app still works with system fallback
    return <>{children}</>;
  }

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F19', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return <>{children}</>;
}

function AppContent() {
  const { isDark } = useTheme();
  const loadStoredAuth = useAuthStore(s => s.loadStoredAuth);
  const loadSubscription = useSubscriptionStore(s => s.loadSubscription);
  const loadOnboarding = useOnboardingStore(s => s.loadOnboardingState);
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);

  useEffect(() => {
    // Load persisted auth session on mount
    loadStoredAuth();
    // Restore subscription state from AsyncStorage
    loadSubscription();
    // Restore onboarding state from AsyncStorage
    loadOnboarding();

  }, []);

  // Load cached data once auth is restored
  // (cached market & education are also loaded for logged-out users for instant display)
  useEffect(() => {
    useMarketStore.getState().loadCachedMarket();
    useEducationStore.getState().loadCachedCourses();
    useFnoStore.getState().loadCachedFno();
    useCommunityStore.getState().loadCachedCommunity();
    useAIStore.getState().loadCachedInsights();

    if (isLoggedIn) {
      usePortfolioStore.getState().loadCachedPortfolio();
      useWatchlistStore.getState().loadCachedWatchlists();
    }
  }, [isLoggedIn]);

  // Wire up the risk store to the WebSocket risk bridge whenever
  // the user is authenticated.  This enables real-time lockdown
  // enforcement without polling /risk/state.
  useEffect(() => {
    if (isLoggedIn) {
      useRiskStore.getState().listenToWS();
    }

    return () => {
      useRiskStore.getState().stopListeningToWS();
    };
  }, [isLoggedIn]);

  // ── E2E Deep Link Handler (dev-only) ─────────────────────
  // Handles toroloom://e2e/seed-broker to pre-seed the keychain
  // with mock broker sessions for Maestro E2E testing.
  useEffect(() => {
    if (!__DEV__) return;

    async function handleE2EDeepLink(url: string | null) {
      if (!url) return;
      try {
        const parsed = new URL(url);
        if (parsed.pathname === '/e2e/seed-broker' || parsed.hostname === 'e2e') {
          const broker = parsed.searchParams.get('broker') || 'zerodha';
          const results = broker === 'all'
            ? await seedAllBrokerSessions()
            : [await seedE2EBrokerSession(broker as any)];
          const allOk = results.every(Boolean);
          if (allOk) {
            console.log('[E2E] Broker session(s) seeded successfully.');
          } else {
            console.warn('[E2E] One or more broker sessions failed to seed.');
          }
        }
      } catch {
        // Invalid URL — ignore
      }
    }

    // Check cold start
    Linking.getInitialURL().then(handleE2EDeepLink);
    // Listen for warm starts
    const sub = Linking.addEventListener('url', (event) => {
      handleE2EDeepLink(event.url);
    });

    return () => sub.remove();
  }, [isLoggedIn]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
      <BiometricUnlockOverlay />
    </>
  );
}

function AppRoot() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <FontLoadingGate>
            <AppContent />
          </FontLoadingGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default isSentryEnabled ? Sentry.wrap(AppRoot) : AppRoot;
