// Push notification service for Toroloom app
// Handles expo-notifications setup, permissions, local scheduling, and response handling
//
// NOTE: All expo native modules (expo-notifications, expo-device, expo-task-manager,
// expo-background-fetch) use LAZY DYNAMIC IMPORTS so they don't crash in environments
// where the native module is unavailable (e.g., Expo Go SDK 53+).

import { Platform } from 'react-native';
import { AppNotification } from '../types';
import { log } from '../utils/logger';

// =============================================================================
// =============================================================================
// Lazy module helpers — native modules loaded on first use, not at import time
// =============================================================================

// Each lazy getter stores its cache in a dedicated object so that
// __resetTestState() can clear all caches for test isolation.
const _notifCache: { value: any } = { value: null };
const _deviceCache: { value: any } = { value: null };
const _taskMgrCache: { value: any } = { value: null };
const _bgFetchCache: { value: any } = { value: null };

// The global key under which tests inject vitest mock objects so the lazy
// getter can find them even when loaded via vi.importActual (which does
// NOT intercept require() for transitive dependencies through vitest's
// mock system). Tests set this in beforeEach.
const TEST_GLOBAL_KEY = '__TOROLOOM_LAZY_MODULES__';

// NOTE: Every use of require() below MUST have a string literal argument
// because the Metro bundler cannot statically analyze variable references.

function getNotifications(): any {
  const entry = _notifCache;
  if (entry.value) return entry.value;

  // Check for test-injected mock first (vitest globalThis bridge).
  const testModules: Record<string, any> | undefined =
    (globalThis as Record<string, any>)[TEST_GLOBAL_KEY];
  if (testModules && testModules['expo-notifications']) {
    entry.value = testModules['expo-notifications'];
    return entry.value;
  }

  try {
    entry.value = require('expo-notifications');
    return entry.value;
  } catch {
    // Final fallback: Proxy that re-reads globalThis live on each access
    return new Proxy({} as any, {
      get(_2, prop: string | symbol) {
        if (!entry.value) {
          try {
            entry.value = require('expo-notifications');
          } catch {
            const currentTestModules = (globalThis as Record<string, any>)[TEST_GLOBAL_KEY];
            if (currentTestModules && currentTestModules['expo-notifications']) {
              entry.value = currentTestModules['expo-notifications'];
            }
            if (!entry.value) return undefined;
          }
        }
        return Reflect.get(entry.value, prop);
      },
    });
  }
}

function getDevice(): any {
  const entry = _deviceCache;
  if (entry.value) return entry.value;

  const testModules = (globalThis as Record<string, any>)[TEST_GLOBAL_KEY];
  if (testModules && testModules['expo-device']) {
    entry.value = testModules['expo-device'];
    return entry.value;
  }

  try {
    entry.value = require('expo-device');
    return entry.value;
  } catch {
    return new Proxy({} as any, {
      get(_2, prop: string | symbol) {
        if (!entry.value) {
          try {
            entry.value = require('expo-device');
          } catch {
            const currentTestModules = (globalThis as Record<string, any>)[TEST_GLOBAL_KEY];
            if (currentTestModules && currentTestModules['expo-device']) {
              entry.value = currentTestModules['expo-device'];
            }
            if (!entry.value) return undefined;
          }
        }
        return Reflect.get(entry.value, prop);
      },
    });
  }
}

function getTaskManager(): any {
  const entry = _taskMgrCache;
  if (entry.value) return entry.value;

  const testModules = (globalThis as Record<string, any>)[TEST_GLOBAL_KEY];
  if (testModules && testModules['expo-task-manager']) {
    entry.value = testModules['expo-task-manager'];
    return entry.value;
  }

  try {
    entry.value = require('expo-task-manager');
    return entry.value;
  } catch {
    return new Proxy({} as any, {
      get(_2, prop: string | symbol) {
        if (!entry.value) {
          try {
            entry.value = require('expo-task-manager');
          } catch {
            const currentTestModules = (globalThis as Record<string, any>)[TEST_GLOBAL_KEY];
            if (currentTestModules && currentTestModules['expo-task-manager']) {
              entry.value = currentTestModules['expo-task-manager'];
            }
            if (!entry.value) return undefined;
          }
        }
        return Reflect.get(entry.value, prop);
      },
    });
  }
}

function getBackgroundFetch(): any {
  const entry = _bgFetchCache;
  if (entry.value) return entry.value;

  const testModules = (globalThis as Record<string, any>)[TEST_GLOBAL_KEY];
  if (testModules && testModules['expo-background-fetch']) {
    entry.value = testModules['expo-background-fetch'];
    return entry.value;
  }

  try {
    entry.value = require('expo-background-fetch');
    return entry.value;
  } catch {
    return new Proxy({} as any, {
      get(_2, prop: string | symbol) {
        if (!entry.value) {
          try {
            entry.value = require('expo-background-fetch');
          } catch {
            const currentTestModules = (globalThis as Record<string, any>)[TEST_GLOBAL_KEY];
            if (currentTestModules && currentTestModules['expo-background-fetch']) {
              entry.value = currentTestModules['expo-background-fetch'];
            }
            if (!entry.value) return undefined;
          }
        }
        return Reflect.get(entry.value, prop);
      },
    });
  }
}

/**
 * For testing — resets all lazy module caches so the next call re-resolves
 * via require().  Call this in beforeEach when testing notificationService
 * with mocked native modules, or whenever you need fresh module references.
 */
export function __resetTestState(): void {
  _notifCache.value = null;
  _deviceCache.value = null;
  _taskMgrCache.value = null;
  _bgFetchCache.value = null;
}

// Configure notification handler — lazily initialized so it's safe in Expo Go
if (Platform.OS !== 'web') {
  const N = getNotifications();
  if (N.setNotificationHandler) {
    try {
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      // Silently ignore — notifications unavailable in Expo Go
    }
  }
}

// =============================================================================
// Notification Channels (Android)
// =============================================================================

// Derive AndroidImportance from the live module when available, falling back to
// hardcoded integers when running outside a native environment (e.g. Expo Go).
// The lazy module getter ensures vitest mocks resolve correctly during tests.
function getImportanceValue(key: 'HIGH' | 'DEFAULT'): number | string {
  const N = getNotifications();
  const ai = N.AndroidImportance;
  if (ai && ai[key] !== undefined) return ai[key];
  const fallbacks: Record<string, number | string> = { HIGH: 5, DEFAULT: 3 };
  return fallbacks[key];
}

const CHANNELS = {
  PRICE_ALERTS: {
    id: 'price_alerts',
    name: 'Price Alerts',
    description: 'Real-time price movement alerts for your watchlist stocks',
    get importance() { return getImportanceValue('HIGH'); },
  },
  TRADE_CONFIRMATIONS: {
    id: 'trade_confirmations',
    name: 'Trade Confirmations',
    description: 'Buy/sell order execution confirmations and trade summaries',
    get importance() { return getImportanceValue('HIGH'); },
  },
  EDUCATIONAL: {
    id: 'educational_reminders',
    name: 'Learning Reminders',
    description: 'Course recommendations, lesson reminders, and quiz nudges',
    get importance() { return getImportanceValue('DEFAULT'); },
  },
  SYSTEM: {
    id: 'system_notifications',
    name: 'System Updates',
    description: 'KYC status, app updates, and account notifications',
    get importance() { return getImportanceValue('DEFAULT'); },
  },
  PORTFOLIO_ALERTS: {
    id: 'portfolio_alerts',
    name: 'Portfolio Alerts',
    description: 'Real-time portfolio P&L, holding movement, and drawdown alerts',
    get importance() { return getImportanceValue('HIGH'); },
  },
  SENTIMENT_ALERTS: {
    id: 'sentiment_alerts',
    name: 'Sentiment Alerts',
    description: 'Real-time sentiment shift alerts for your watchlist stocks',
    get importance() { return getImportanceValue('HIGH'); },
  },
  COURSE_REVIEW: {
    id: 'course_review',
    name: 'Course Reviews',
    description: 'Notifications when your submitted course is approved or rejected',
    get importance() { return getImportanceValue('HIGH'); },
  },
};

async function setupChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    const N = getNotifications();
    if (N.setNotificationChannelAsync) {
      await N.setNotificationChannelAsync(CHANNELS.PRICE_ALERTS.id, CHANNELS.PRICE_ALERTS);
      await N.setNotificationChannelAsync(CHANNELS.TRADE_CONFIRMATIONS.id, CHANNELS.TRADE_CONFIRMATIONS);
      await N.setNotificationChannelAsync(CHANNELS.EDUCATIONAL.id, CHANNELS.EDUCATIONAL);
      await N.setNotificationChannelAsync(CHANNELS.SYSTEM.id, CHANNELS.SYSTEM);
      await N.setNotificationChannelAsync(CHANNELS.PORTFOLIO_ALERTS.id, CHANNELS.PORTFOLIO_ALERTS);
      await N.setNotificationChannelAsync(CHANNELS.SENTIMENT_ALERTS.id, CHANNELS.SENTIMENT_ALERTS);
      await N.setNotificationChannelAsync(CHANNELS.COURSE_REVIEW.id, CHANNELS.COURSE_REVIEW);
    }
  }
}

// =============================================================================
// Permission & Token
// =============================================================================

export async function registerForPushNotifications(): Promise<string | null> {
  const N = getNotifications();
  if (!N.getPermissionsAsync) {
    log.warn('[Notifications] expo-notifications not available');
    return null;
  }

  await setupChannels();

  const { status: existingStatus } = await N.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await N.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    log.warn('[Notifications] Permission not granted');
    return null;
  }

  const D = getDevice();
  if (D.isDevice) {
    try {
      const tokenData = await N.getExpoPushTokenAsync();
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

// =============================================================================
// Local Notification Scheduling
// =============================================================================

export async function sendLocalNotification(
  notification: AppNotification,
): Promise<string | undefined> {
  const N = getNotifications();
  if (!N.scheduleNotificationAsync) return undefined;

  const channelId = getChannelForType(notification.type);
  const identifier = await N.scheduleNotificationAsync({
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
  trigger: any, // Notifications.TimeIntervalTriggerInput | Notifications.CalendarTriggerInput
): Promise<string | undefined> {
  const N = getNotifications();
  if (!N.scheduleNotificationAsync) return undefined;

  const channelId = getChannelForType(notification.type);
  const identifier = await N.scheduleNotificationAsync({
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
  const N = getNotifications();
  if (N.cancelScheduledNotificationAsync) {
    await N.cancelScheduledNotificationAsync(identifier);
  }
}

export async function cancelAllNotifications(): Promise<void> {
  const N = getNotifications();
  if (N.cancelAllScheduledNotificationsAsync) {
    await N.cancelAllScheduledNotificationsAsync();
  }
}

// =============================================================================
// Helper Mappings
// =============================================================================

function getChannelForType(type: AppNotification['type']): string | undefined {
  switch (type) {
    case 'price_alert': return CHANNELS.PRICE_ALERTS.id;
    case 'trade': return CHANNELS.TRADE_CONFIRMATIONS.id;
    case 'educational': return CHANNELS.EDUCATIONAL.id;
    case 'portfolio_alert': return CHANNELS.PORTFOLIO_ALERTS.id;
    case 'sentiment_alert': return CHANNELS.SENTIMENT_ALERTS.id;
    case 'course_review': return CHANNELS.COURSE_REVIEW.id;
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
    case 'portfolio_alert': return 'Portfolio';
    case 'sentiment_alert': return 'SentimentAnalysis';
    case 'course_review': return 'MyCourses';
    default: return 'Home';
  }
}

// =============================================================================
// Response Handling
// =============================================================================

export function setupNotificationResponseListener(
  onNavigate: (screen: string, params?: any) => void,
): any /* Notifications.EventSubscription */ {
  const N = getNotifications();
  if (!N.addNotificationResponseReceivedListener) return { remove: () => {} };

  const subscription = N.addNotificationResponseReceivedListener((response: any) => {
    const { data } = response.notification.request.content as { screen?: string; [key: string]: any };
    const screen = data?.screen || 'Home';
    onNavigate(screen, data || {});
  });
  return subscription;
}

// =============================================================================
// Convenience Schedulers
// =============================================================================

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

export async function sendPortfolioAlert(
  title: string,
  message: string,
  data?: any,
): Promise<string | undefined> {
  return sendLocalNotification({
    id: `pal_${Date.now()}`,
    type: 'portfolio_alert',
    title,
    message,
    read: false,
    timestamp: new Date().toISOString(),
    data,
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

// =============================================================================
// Background Fetch — Portfolio Alerts
// =============================================================================

const BACKGROUND_FETCH_TASK = 'portfolio-alert-evaluation';

// Define the background fetch task lazily
(() => {
  try {
    const TM = getTaskManager();
    const BF = getBackgroundFetch();
    if (TM.defineTask && BF.BackgroundFetchResult) {
      TM.defineTask(BACKGROUND_FETCH_TASK, async () => {
        try {
          await evaluatePortfolioAlertsInBackground();
          return BF.BackgroundFetchResult.NewData;
        } catch (err) {
          log.warn('[BackgroundFetch] Task failed', err);
          return BF.BackgroundFetchResult.Failed;
        }
      });
    }
  } catch {
    // Background fetch not available
  }
})();

/**
 * Register a periodic background fetch task that re-evaluates
 * portfolio alert rules against the latest portfolio state.
 * This allows alerts to fire even when the app is in the background.
 */
export function registerPortfolioAlertBackgroundTask(): void {
  if (Platform.OS === 'web') return;

  const BF = getBackgroundFetch();
  if (BF.registerTaskAsync) {
    BF.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (iOS minimum)
      stopOnTerminate: false,
      startOnBoot: true,
    }).catch((err: any) => {
      log.warn('[BackgroundFetch] Task registration failed', err);
    });
  }
}

/**
 * Unregister the background fetch task.
 */
export async function unregisterPortfolioAlertBackgroundTask(): Promise<void> {
  if (Platform.OS === 'web') return;
  const BF = getBackgroundFetch();
  if (BF.unregisterTaskAsync) {
    try {
      await BF.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    } catch {
      // Ignore if not registered
    }
  }
}

/**
 * Evaluate portfolio alerts from the background fetch task.
 * Reads the latest state from the notification store and re-evaluates
 * rules by creating a fresh PortfolioAlertData snapshot.
 */
export async function evaluatePortfolioAlertsInBackground(): Promise<void> {
  const { useNotificationStore, usePortfolioStore, usePortfolioAnalyticsStore } = await import('../store');

  const { holdings } = usePortfolioStore.getState();
  const analytics = usePortfolioAnalyticsStore.getState().getAnalytics();
  const m = analytics.metrics;

  const portfolioValue = holdings.reduce((s: number, h: any) => s + h.currentValue, 0);

  useNotificationStore.getState().evaluatePortfolioAlerts({
    totalReturnPercent: m.totalReturnPercent,
    totalReturn: m.totalReturn,
    totalInvested: holdings.reduce((s: number, h: any) => s + h.totalInvested, 0),
    currentValue: portfolioValue,
    peakValue: Math.max(portfolioValue, m.totalReturn > 0 ? portfolioValue - m.totalReturn : portfolioValue),
    holdings,
    consecutiveLossDays: m.consecutiveLosses || 0,
  });
}

// =============================================================================
// App Icon Badge
// =============================================================================

/**
 * Update the iOS/Android app icon badge count.
 * Setting to 0 removes the badge entirely.
 * Uses expo-notifications setBadgeCountAsync under the hood.
 */
export async function updateAppIconBadge(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  const N = getNotifications();
  if (N.setBadgeCountAsync) {
    try {
      await N.setBadgeCountAsync(count);
    } catch {
      // Silently ignore — badge setting is a best-effort UX enhancement
    }
  }
}

/**
 * Clear the app icon badge (set to 0).
 */
export async function clearAppIconBadge(): Promise<void> {
  await updateAppIconBadge(0);
}

// ─── Sentiment Alert Convenience Scheduler ────────────────

export async function sendSentimentAlert(
  title: string,
  message: string,
  data?: any,
): Promise<string | undefined> {
  return sendLocalNotification({
    id: `sa_${Date.now()}`,
    type: 'sentiment_alert',
    title,
    message,
    read: false,
    timestamp: new Date().toISOString(),
    data,
  });
}

export { CHANNELS, setupChannels, BACKGROUND_FETCH_TASK };
export type NotificationChannel = keyof typeof CHANNELS;
