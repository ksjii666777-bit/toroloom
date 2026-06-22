import { useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import { log } from '../utils/logger';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  setupNotificationResponseListener,
  registerPortfolioAlertBackgroundTask,
  evaluatePortfolioAlertsInBackground,
} from '../services/notificationService';
import { notificationApi } from '../services/api/notifications';
import { useNotificationStore } from '../store/notificationStore';

export function useNotificationSetup() {
  const navigation = useNavigation<any>();
  const notificationListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);

  const onNavigate = useCallback(
    (screen: string, params?: any) => {
      switch (screen) {
        case 'StockDetail':
          navigation.navigate('StockDetail', { stockId: params?.symbol, symbol: params?.symbol });
          break;
        case 'Portfolio':
          navigation.navigate('MainTabs', { screen: 'Portfolio' });
          break;
        case 'Learn':
          navigation.navigate('Learn');
          break;
        case 'Profile':
          navigation.navigate('More');
          break;
        case 'Notifications':
        case 'PortfolioAlerts':
          navigation.navigate('Notifications');
          break;
        default:
          navigation.navigate('MainTabs', { screen: 'Home' });
      }
    },
    [navigation],
  );

  useEffect(() => {
    // Skip notification setup on web — push notifications require native APIs
    if (Platform.OS === 'web') return;

    // Register for push notifications
    registerForPushNotifications().then(token => {
      if (token) {
        log.info('[Notifications] Push token:', token);
        // Send the push token to the backend for server-side push notifications
        notificationApi.registerPushToken(token).catch(() => {
          // Backend may be unavailable — silently ignore
        });
      }
    });

    // Sync the app icon badge with the backend badge count
    // This ensures the badge persists across app restarts — the backend tracks
    // the count server-side and returns it here so the local store and app
    // icon badge are accurate even after the app was killed.
    useNotificationStore.getState().syncBadgeCountFromBackend();

    // Register background fetch task for periodic portfolio alert evaluation
    registerPortfolioAlertBackgroundTask();

    // Listen for notifications while app is foregrounded
    notificationListenerRef.current = Notifications.addNotificationReceivedListener(notification => {
      log.info('[Notifications] Received:', notification.request.content.title);
    });

    // Listen for notification taps (user opens notification)
    responseListenerRef.current = setupNotificationResponseListener(onNavigate);

    // ── AppState listener — re-evaluate portfolio alerts on foreground ──
    // Captures alerts that would have fired while the app was backgrounded
    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        // Small delay to ensure stores have rehydrated from persistence
        setTimeout(() => {
          evaluatePortfolioAlertsInBackground();
        }, 500);
      }
    });

    return () => {
      notificationListenerRef.current?.remove();
      responseListenerRef.current?.remove();
      appStateSubscription.remove();
    };
  }, [onNavigate]);
}
