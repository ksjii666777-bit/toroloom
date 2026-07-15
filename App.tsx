import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/context/ThemeContext';
import FontLoadingGate from './src/components/FontLoadingGate';
import AppContent from './src/components/AppContent';
import './src/i18n'; // Initialize i18n
import { setupChannels } from './src/services/notificationService';
import { configureApi } from './src/services/api/client';
import { useAuthStore } from './src/store/authStore';
import { useSubscriptionStore } from './src/store/subscriptionStore';
import { useUpgradePromptStore } from './src/store/subscriptionUIStore';
import { onPaymentRequired } from './src/services/api/client';
import Sentry, { isSentryEnabled } from './src/services/sentry';
import './src/utils/debugTextError'; // Debug: catches Text error with component stack

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
