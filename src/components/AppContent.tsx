import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';
import AppNavigator from '../navigation/AppNavigator';
import BiometricUnlockOverlay from './BiometricUnlockOverlay';
import LegalReacceptanceOverlay from './LegalReacceptanceOverlay';
import { useAuthStore } from '../store/authStore';
import { useLegalConsentStore } from '../store/legalConsentStore';
import { useRiskStore } from '../store/riskStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { usePortfolioStore } from '../store/portfolioStore';
import { useWatchlistStore } from '../store/watchlistStore';
import { useMarketStore } from '../store/marketStore';
import { useEducationStore } from '../store/educationStore';
import { useFnoStore } from '../store/fnoStore';
import { log } from '../utils/logger';
import { useCommunityStore } from '../store/communityStore';
import { useAIStore } from '../store/aiStore';
import { seedAllBrokerSessions, seedE2EBrokerSession } from '../services/gateway/seedE2ESession';

function AppContent() {
  const { isDark } = useTheme();
  const loadStoredAuth = useAuthStore(s => s.loadStoredAuth);
  const loadSubscription = useSubscriptionStore(s => s.loadSubscription);
  const loadOnboarding = useOnboardingStore(s => s.loadOnboardingState);
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const loadConsent = useLegalConsentStore(s => s.loadConsent);

  useEffect(() => {
    // Load persisted auth session on mount
    loadStoredAuth();
    // Restore subscription state from AsyncStorage
    loadSubscription();
    // Restore onboarding state from AsyncStorage
    loadOnboarding();
    // Restore the accepted ToS/Privacy version (re-acceptance prompt state)
    loadConsent();
  }, [loadStoredAuth, loadSubscription, loadOnboarding, loadConsent]);

  // ── ToS re-acceptance gate ───────────────────────────────────────────────
  // When the stored acceptance predates LEGAL_DOCUMENT_VERSION, prompt the
  // user once they're in the app. Dev-restore/new users have no stored
  // acceptance and are handled by the signup checkbox instead.
  const consentLoaded = useLegalConsentStore(s => s.isConsentLoaded);
  const needsReacceptance = useLegalConsentStore(s => s.needsReacceptance);
  const showReacceptance = useLegalConsentStore(s => s.showReacceptance);

  useEffect(() => {
    if (isLoggedIn && consentLoaded && needsReacceptance) {
      showReacceptance();
    }
  }, [isLoggedIn, consentLoaded, needsReacceptance, showReacceptance]);

  // Load cached data once auth is restored
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
  }, [isLoggedIn, loadOnboarding, loadStoredAuth, loadSubscription]);

  // ── FIX: Fresh market data on launch + periodic refresh ────────────────
  // Previously the app ONLY loaded AsyncStorage cache at startup and never
  // fetched fresh prices until the user manually pulled-to-refresh on the
  // Markets tab — so prices looked frozen/stale. Now:
  //   1. One fresh fetch shortly after launch (cache still shows instantly)
  //   2. A 60s polling interval keeps lists in sync with the live backend
  //      (the per-stock WebSocket tick feed is unaffected by this)
  // Startup-cost gate: polling only runs for logged-in users. On the
  // Login/Signup screens it was pure wasted work (network chatter, JSON
  // parsing, store fan-out) during the most jank-sensitive launch window.
  // The Markets tab refreshes itself on mount, so data freshness there is
  // unaffected.
  useEffect(() => {
    if (!isLoggedIn) return;

    // Initial fresh fetch — small delay lets the first render use cache first
    const initialTimer = setTimeout(() => {
      useMarketStore.getState().refreshMarket();
    }, 1500);

    // Periodic refresh every 60s
    const interval = setInterval(() => {
      useMarketStore.getState().refreshMarket();
    }, 60_000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isLoggedIn]);

  // Wire up the risk store to the WebSocket risk bridge
  useEffect(() => {
    if (isLoggedIn) {
      useRiskStore.getState().listenToWS();
    }

    return () => {
      useRiskStore.getState().stopListeningToWS();
    };
  }, [isLoggedIn]);

  // E2E Deep Link Handler (dev-only)
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
            log.info('[E2E] Broker session(s) seeded successfully.');
          } else {
            log.warn('[E2E] One or more broker sessions failed to seed.');
          }
        }
      } catch {
        // Invalid URL — ignore
      }
    }

    Linking.getInitialURL().then(handleE2EDeepLink);
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
      <LegalReacceptanceOverlay />
    </>
  );
}

export default AppContent;
