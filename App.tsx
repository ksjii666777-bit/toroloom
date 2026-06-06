import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { setupChannels } from './src/services/notificationService';
import { configureApi } from './src/services/api';
import { useAuthStore, useRiskStore } from './src/store';
import Sentry from './src/services/sentry';

// Initialize notification channels on app launch
setupChannels();

// Configure API client to read auth token from store
configureApi({
  getToken: () => useAuthStore.getState().token,
});

function AppContent() {
  const { isDark } = useTheme();
  const loadStoredAuth = useAuthStore(s => s.loadStoredAuth);
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);

  useEffect(() => {
    // Load persisted auth session on mount
    loadStoredAuth();
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
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(AppRoot);
