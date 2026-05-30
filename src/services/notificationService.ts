// Push notification service for WealthWise app
// Handles expo-notifications setup, permissions, local scheduling, and response handling

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AppNotification } from '../types';
import { log } from '../utils/logger';

// Configure notification handler — show foreground notifications as heads-up banners
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============ Notification Channels (Android) ============

const CHANNELS = {
  PRICE_ALERTS: {
    id: 'price_alerts',
    name: 'Price Alerts',
    description: 'Real-time price movement alerts for your watchlist stocks',
    importance: Notifications.AndroidImportance.HIGH,
  },
  TRADE_CONFIRMATIONS: {
    id: 'trade_confirmations',
    name: 'Trade Confirmations',
    description: 'Buy/sell order execution confirmations and trade summaries',
    importance: Notifications.AndroidImportance.HIGH,
  },
  EDUCATIONAL: {
    id: 'educational_reminders',
    name: 'Learning Reminders',
    description: 'Course recommendations, lesson reminders, and quiz nudges',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  SYSTEM: {
    id: 'system_notifications',
    name: 'System Updates',
    description: 'KYC status, app updates, and account notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
};

async function setupChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNELS.PRICE_ALERTS.id, CHANNELS.PRICE_ALERTS);
    await Notifications.setNotificationChannelAsync(CHANNELS.TRADE_CONFIRMATIONS.id, CHANNELS.TRADE_CONFIRMATIONS);
    await Notifications.setNotificationChannelAsync(CHANNELS.EDUCATIONAL.id, CHANNELS.EDUCATIONAL);
    await Notifications.setNotificationChannelAsync(CHANNELS.SYSTEM.id, CHANNELS.SYSTEM);
  }
}

// ============ Permission & Token ============

export async function registerForPushNotifications(): Promise<string | null> {
  await setupChannels();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    log.warn('[Notifications] Permission not granted');
    return null;
  }

  if (Device.isDevice) {
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      return tokenData.data;
    } catch (e) {
      log.warn('[Notifications] Failed to get push token', e);
      return null;
    }
  } else {
    log.warn('[Notifications] Must use physical device for push notifications');
    return 'simulator-device-token';
  }
}

// ============ Local Notification Scheduling ============

export async function sendLocalNotification(
  notification: AppNotification,
): Promise<string | undefined> {
  const channelId = getChannelForType(notification.type);
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.message,
      data: { screen: getScreenForType(notification.type), ...notification.data },
      sound: true,
      ...(channelId ? { channelId } : {}),
    },
    trigger: null as any, // immediate
  });
  return identifier;
}

export async function scheduleNotification(
  notification: AppNotification,
  trigger: Notifications.TimeIntervalTriggerInput | Notifications.CalendarTriggerInput,
): Promise<string | undefined> {
  const channelId = getChannelForType(notification.type);
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.message,
      data: { screen: getScreenForType(notification.type), ...notification.data },
      sound: true,
      ...(channelId ? { channelId } : {}),
    },
    trigger,
  });
  return identifier;
}

export async function cancelNotification(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ============ Helper Mappings ============

function getChannelForType(type: AppNotification['type']): string | undefined {
  switch (type) {
    case 'price_alert': return CHANNELS.PRICE_ALERTS.id;
    case 'trade': return CHANNELS.TRADE_CONFIRMATIONS.id;
    case 'educational': return CHANNELS.EDUCATIONAL.id;
    case 'system':
    case 'news':
      return CHANNELS.SYSTEM.id;
    default:
      return undefined;
  }
}

export function getScreenForType(type: AppNotification['type']): string {
  switch (type) {
    case 'price_alert': return 'StockDetail';
    case 'trade': return 'Portfolio';
    case 'educational': return 'Learn';
    case 'system': return 'Profile';
    case 'news': return 'Home';
    default: return 'Home';
  }
}

// ============ Response Handling ============

export function setupNotificationResponseListener(
  onNavigate: (screen: string, params?: any) => void,
): Notifications.EventSubscription {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const { data } = response.notification.request.content as { screen?: string; [key: string]: any };
    const screen = data?.screen || 'Home';
    onNavigate(screen, data || {});
  });
  return subscription;
}

// ============ Convenience Schedulers ============

export async function sendPriceAlert(
  stockName: string,
  symbol: string,
  currentPrice: number,
  alertType: 'target_hit' | 'drop_alert' | 'movement',
): Promise<string | undefined> {
  let title: string;
  let message: string;

  switch (alertType) {
    case 'target_hit':
      title = `🎯 Price Target Hit: ${symbol}`;
      message = `${stockName} hit ₹${currentPrice.toFixed(2)}! Your target was reached.`;
      break;
    case 'drop_alert':
      title = `⚠️ Price Drop: ${symbol}`;
      message = `${stockName} dropped to ₹${currentPrice.toFixed(2)}. Check the latest trend.`;
      break;
    case 'movement':
      title = `📊 ${symbol} Moving`;
      message = `${stockName} is now at ₹${currentPrice.toFixed(2)}. Significant movement detected.`;
      break;
  }

  return sendLocalNotification({
    id: `pa_${Date.now()}`,
    type: 'price_alert',
    title,
    message,
    read: false,
    timestamp: new Date().toISOString(),
    data: { stockId: symbol, symbol },
  });
}

export async function sendTradeConfirmation(
  type: 'buy' | 'sell',
  symbol: string,
  quantity: number,
  price: number,
  total: number,
): Promise<string | undefined> {
  const action = type === 'buy' ? 'Bought' : 'Sold';
  const formattedPrice = `₹${price.toFixed(2)}`;
  const formattedTotal = `₹${total.toLocaleString('en-IN')}`;

  return sendLocalNotification({
    id: `tr_${Date.now()}`,
    type: 'trade',
    title: type === 'buy' ? '✅ Order Executed' : '✅ Sell Order Executed',
    message: `${action} ${quantity} shares of ${symbol} @ ${formattedPrice}. Total: ${formattedTotal}`,
    read: false,
    timestamp: new Date().toISOString(),
    data: { symbol, type, quantity, price, total },
  });
}

export async function sendEducationalReminder(
  courseName: string,
  lessonTitle: string,
  type: 'new_lesson' | 'quiz_reminder' | 'course_complete' | 'streak',
): Promise<string | undefined> {
  let title: string;
  let message: string;

  switch (type) {
    case 'new_lesson':
      title = '📖 New Lesson Available';
      message = `"${lessonTitle}" is ready in "${courseName}". Continue your learning journey!`;
      break;
    case 'quiz_reminder':
      title = '🧠 Quiz Time!';
      message = `Test your knowledge from "${courseName}" — take the quiz on "${lessonTitle}"!`;
      break;
    case 'course_complete':
      title = '🎉 Course Completed!';
      message = `Congratulations! You finished "${courseName}". Claim your certificate!`;
      break;
    case 'streak':
      title = '🔥 Learning Streak';
      message = `You're on a roll! Complete today's lesson in "${courseName}" to keep your streak alive.`;
      break;
  }

  return sendLocalNotification({
    id: `ed_${Date.now()}`,
    type: 'educational',
    title,
    message,
    read: false,
    timestamp: new Date().toISOString(),
    data: { courseName, lessonTitle },
  });
}

export async function sendSystemNotification(
  title: string,
  message: string,
): Promise<string | undefined> {
  return sendLocalNotification({
    id: `sys_${Date.now()}`,
    type: 'system',
    title,
    message,
    read: false,
    timestamp: new Date().toISOString(),
  });
}

export { CHANNELS, setupChannels };
export type NotificationChannel = keyof typeof CHANNELS;
