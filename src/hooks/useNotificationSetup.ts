import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { log } from '../utils/logger';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  setupNotificationResponseListener,
  getScreenForType,
} from '../services/notificationService';

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
          navigation.navigate('Notifications');
          break;
        default:
          navigation.navigate('MainTabs', { screen: 'Home' });
      }
    },
    [navigation],
  );

  useEffect(() => {
    // Register for push notifications
    registerForPushNotifications().then(token => {
      if (token) {
        log.info('[Notifications] Push token:', token);
      }
    });

    // Listen for notifications while app is foregrounded
    notificationListenerRef.current = Notifications.addNotificationReceivedListener(notification => {
      log.info('[Notifications] Received:', notification.request.content.title);
    });

    // Listen for notification taps (user opens notification)
    responseListenerRef.current = setupNotificationResponseListener(onNavigate);

    return () => {
      notificationListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [onNavigate]);
}
