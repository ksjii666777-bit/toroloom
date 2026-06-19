import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { setupChannels } from './src/services/notificationService';
import { configureApi } from './src/services/api';
import { useAuthStore, useRiskStore, useSubscriptionStore, useOnboardingStore } from './src/store';
import Sentry, { isSentryEnabled } from './src/services/sentry';
import useLoadFonts from './src/hooks/useLoadFonts';

// Initialize notification channels on app launch
// notificationService uses lazy imports internally, so this won't crash if native modules aren't available
setupChannels().catch(() => {});

// Configure API client to read auth token from store + point to Render backend
configureApi({
  baseUrl: 'https://toroloom-backend.onrender.com/api',
  getToken: () => useAuthStore.getState().token,
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

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
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
