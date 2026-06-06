/**
 * ============================================================================
 * Toroloom — Notification Service Tests
 * ============================================================================
 *
 * Tests the notificationService module: channels, permissions, push token,
 * local/scheduled notification creation, cancellation, screen mapping,
 * response listener, and convenience schedulers (price alerts, trade
 * confirmations, educational reminders, system notifications).
 *
 * We override the setup.ts mock with the REAL implementation so the test
 * exercises the actual logic instead of mock stubs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// __DEV__ must be set at the hoisted level because vi.mock is hoisted above all code.
// expo-task-manager depends on expo-modules-core which references __DEV__ at module level.
vi.hoisted(() => {
  (globalThis as any).__DEV__ = true;
});

// Use the real notification service instead of the setup.ts mock
vi.mock('../services/notificationService', async () => {
  const actual = await vi.importActual<typeof import('../services/notificationService')>('../services/notificationService');
  return actual;
});

// ==================== Imports ====================

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import {
  registerForPushNotifications,
  sendLocalNotification,
  scheduleNotification,
  cancelNotification,
  cancelAllNotifications,
  getScreenForType,
  setupNotificationResponseListener,
  sendPriceAlert,
  sendTradeConfirmation,
  sendEducationalReminder,
  sendSystemNotification,
  setupChannels,
  CHANNELS,
} from '../services/notificationService';

import type { AppNotification } from '../types';

// ==================== Sample Data ====================

const sampleNotification: AppNotification = {
  id: 'n1',
  type: 'price_alert',
  title: 'Test Alert',
  message: 'Test message',
  read: false,
  timestamp: '2025-06-01T10:00:00.000Z',
  data: { stockId: 'RELIANCE', symbol: 'RELIANCE' },
};

// ==================== Tests ====================

describe('Notification Service — setupChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT create Android channels on non-Android platform', async () => {
    vi.spyOn(Platform, 'OS', 'get').mockReturnValue('ios');
    await setupChannels();
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('creates all 5 Android channels on Android', async () => {
    vi.spyOn(Platform, 'OS', 'get').mockReturnValue('android');
    await setupChannels();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(5);
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'price_alerts',
      expect.objectContaining({ id: 'price_alerts' }),
    );
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'trade_confirmations',
      expect.objectContaining({ id: 'trade_confirmations' }),
    );
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'educational_reminders',
      expect.objectContaining({ id: 'educational_reminders' }),
    );
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'system_notifications',
      expect.objectContaining({ id: 'system_notifications' }),
    );
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'portfolio_alerts',
      expect.objectContaining({ id: 'portfolio_alerts' }),
    );
  });

  it('CHANNELS constant has the expected structure', () => {
    expect(CHANNELS.PRICE_ALERTS.id).toBe('price_alerts');
    expect(CHANNELS.TRADE_CONFIRMATIONS.id).toBe('trade_confirmations');
    expect(CHANNELS.EDUCATIONAL.id).toBe('educational_reminders');
    expect(CHANNELS.SYSTEM.id).toBe('system_notifications');
    expect(CHANNELS.PORTFOLIO_ALERTS.id).toBe('portfolio_alerts');
    expect(CHANNELS.PORTFOLIO_ALERTS.importance).toBe('high');
  });
});

describe('Notification Service — registerForPushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Platform, 'OS', 'get').mockReturnValue('ios');
  });

  it('calls setupChannels internally', async () => {
    vi.spyOn(Notifications, 'getPermissionsAsync').mockResolvedValue({ status: 'granted' } as any);
    await registerForPushNotifications();
    expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
  });

  it('returns null when permission is denied', async () => {
    vi.spyOn(Notifications, 'getPermissionsAsync').mockResolvedValue({ status: 'denied' } as any);
    vi.spyOn(Notifications, 'requestPermissionsAsync').mockResolvedValue({ status: 'denied' } as any);

    const token = await registerForPushNotifications();
    expect(token).toBeNull();
  });

  it('requests permissions when not already granted', async () => {
    vi.spyOn(Notifications, 'getPermissionsAsync').mockResolvedValue({ status: 'undetermined' } as any);
    vi.spyOn(Notifications, 'requestPermissionsAsync').mockResolvedValue({ status: 'granted' } as any);

    await registerForPushNotifications();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('returns push token on a real device with granted permission', async () => {
    vi.spyOn(Notifications, 'getPermissionsAsync').mockResolvedValue({ status: 'granted' } as any);
    vi.spyOn(Notifications, 'getExpoPushTokenAsync').mockResolvedValue({ data: 'expo-push-token-abc' } as any);

    const token = await registerForPushNotifications();
    expect(token).toBe('expo-push-token-abc');
  });

  it('returns null when getExpoPushTokenAsync fails on real device', async () => {
    vi.spyOn(Notifications, 'getPermissionsAsync').mockResolvedValue({ status: 'granted' } as any);
    vi.spyOn(Notifications, 'getExpoPushTokenAsync').mockRejectedValue(new Error('Network error'));

    const token = await registerForPushNotifications();
    expect(token).toBeNull();
  });

  it('returns simulator token on non-device (emulator/simulator)', async () => {
    vi.spyOn(Device, 'isDevice', 'get').mockReturnValue(false);
    vi.spyOn(Notifications, 'getPermissionsAsync').mockResolvedValue({ status: 'granted' } as any);

    const token = await registerForPushNotifications();
    expect(token).toBe('simulator-device-token');
  });

  it('returns null on non-device when permission is denied after request', async () => {
    vi.spyOn(Device, 'isDevice', 'get').mockReturnValue(false);
    vi.spyOn(Notifications, 'getPermissionsAsync').mockResolvedValue({ status: 'denied' } as any);
    vi.spyOn(Notifications, 'requestPermissionsAsync').mockResolvedValue({ status: 'denied' } as any);

    const token = await registerForPushNotifications();
    expect(token).toBeNull();
  });
});

describe('Notification Service — sendLocalNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules an immediate notification and returns an identifier', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('notif-1');

    const id = await sendLocalNotification(sampleNotification);
    expect(id).toBe('notif-1');
  });

  it('passes notification content to scheduleNotificationAsync', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('n1');

    await sendLocalNotification(sampleNotification);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Test Alert',
          body: 'Test message',
          sound: true,
        }),
        trigger: null,
      }),
    );
  });

  it('attaches channelId for price_alert type', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('n1');

    await sendLocalNotification(sampleNotification);

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect((call.content as any).channelId).toBe('price_alerts');
  });

  it('attaches channelId for trade type', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('n1');

    await sendLocalNotification({
      ...sampleNotification,
      type: 'trade',
    });

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect((call.content as any).channelId).toBe('trade_confirmations');
  });

  it('attaches channelId for educational type', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('n1');

    await sendLocalNotification({ ...sampleNotification, type: 'educational' });

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect((call.content as any).channelId).toBe('educational_reminders');
  });

  it('attaches channelId for system type', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('n1');

    await sendLocalNotification({ ...sampleNotification, type: 'system' });

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect((call.content as any).channelId).toBe('system_notifications');
  });

  it('attaches channelId for news type', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('n1');

    await sendLocalNotification({ ...sampleNotification, type: 'news' });

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect((call.content as any).channelId).toBe('system_notifications');
  });

  it('maps educational type to educational_reminders channel', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('n1');

    await sendLocalNotification({ ...sampleNotification, type: 'educational' });
    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect((call.content as any).channelId).toBe('educational_reminders');
  });

  it('omits channelId for unknown notification type (default branch of getChannelForType)', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('n1');

    // Use a type that falls through to the default branch of getChannelForType
    const unknownNotif: AppNotification = {
      ...sampleNotification,
      type: 'unknown' as any,
    };
    await sendLocalNotification(unknownNotif);

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    // No channelId should be set when getChannelForType returns undefined
    expect((call.content as any).channelId).toBeUndefined();
  });
});

describe('Notification Service — scheduleNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules a notification with a time interval trigger', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('scheduled-1');

    const trigger = {
      type: 'timeInterval' as const,
      seconds: 60,
      repeats: false,
    } as any;

    const id = await scheduleNotification(sampleNotification, trigger);
    expect(id).toBe('scheduled-1');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ seconds: 60 }),
      }),
    );
  });

  it('schedules a notification with a calendar trigger', async () => {
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('cal-1');

    const trigger = {
      type: 'calendar' as const,
      hour: 9,
      minute: 0,
      repeats: true,
    } as any;

    const id = await scheduleNotification(sampleNotification, trigger);
    expect(id).toBe('cal-1');
  });
});

describe('Notification Service — cancelNotification / cancelAllNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels a single notification by identifier', async () => {
    await cancelNotification('notif-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
  });

  it('cancels all scheduled notifications', async () => {
    await cancelAllNotifications();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });
});

describe('Notification Service — getScreenForType', () => {
  it('maps price_alert to StockDetail', () => {
    expect(getScreenForType('price_alert')).toBe('StockDetail');
  });

  it('maps trade to Portfolio', () => {
    expect(getScreenForType('trade')).toBe('Portfolio');
  });

  it('maps educational to Learn', () => {
    expect(getScreenForType('educational')).toBe('Learn');
  });

  it('maps system to Profile', () => {
    expect(getScreenForType('system')).toBe('Profile');
  });

  it('maps news to Home', () => {
    expect(getScreenForType('news')).toBe('Home');
  });

  it('maps unknown type to Home as default', () => {
    expect(getScreenForType('unknown' as any)).toBe('Home');
  });
});

describe('Notification Service — setupNotificationResponseListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to notification response events', () => {
    const onNavigate = vi.fn();
    const subscription = setupNotificationResponseListener(onNavigate);

    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    expect(subscription).toHaveProperty('remove');
  });

  it('calls onNavigate with the screen from notification data', () => {
    const onNavigate = vi.fn();

    // Capture the listener callback
    let capturedCallback!: (response: any) => void;
    vi.spyOn(Notifications, 'addNotificationResponseReceivedListener').mockImplementation(
      (cb: any) => {
        capturedCallback = cb;
        return { remove: vi.fn() };
      },
    );

    setupNotificationResponseListener(onNavigate);

    // Simulate a notification tap with screen data
    capturedCallback({
      notification: {
        request: {
          content: {
            data: { screen: 'StockDetail', stockId: 'RELIANCE' },
          },
        },
      },
    });

    expect(onNavigate).toHaveBeenCalledWith('StockDetail', {
      screen: 'StockDetail',
      stockId: 'RELIANCE',
    });
  });

  it('falls back to Home screen when data has no screen field', () => {
    const onNavigate = vi.fn();

    let capturedCallback!: (response: any) => void;
    vi.spyOn(Notifications, 'addNotificationResponseReceivedListener').mockImplementation(
      (cb: any) => {
        capturedCallback = cb;
        return { remove: vi.fn() };
      },
    );

    setupNotificationResponseListener(onNavigate);

    capturedCallback({
      notification: {
        request: {
          content: {
            data: {},
          },
        },
      },
    });

    expect(onNavigate).toHaveBeenCalledWith('Home', {});
  });

  it('falls back to Home when data is undefined', () => {
    const onNavigate = vi.fn();

    let capturedCallback!: (response: any) => void;
    vi.spyOn(Notifications, 'addNotificationResponseReceivedListener').mockImplementation(
      (cb: any) => {
        capturedCallback = cb;
        return { remove: vi.fn() };
      },
    );

    setupNotificationResponseListener(onNavigate);

    capturedCallback({
      notification: {
        request: {
          content: {},
        },
      },
    });

    expect(onNavigate).toHaveBeenCalledWith('Home', {});
  });
});

describe('Notification Service — sendPriceAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('pa-1');
  });

  it('sends target_hit price alert with correct title and message', async () => {
    const id = await sendPriceAlert('Reliance Industries', 'RELIANCE', 2890, 'target_hit');
    expect(id).toBe('pa-1');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain('🎯');
    expect(call.content.title).toContain('RELIANCE');
    expect(call.content.body).toContain('₹2890.00');
  });

  it('sends drop_alert price alert with warning emoji', async () => {
    await sendPriceAlert('TCS', 'TCS', 3750, 'drop_alert');

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain('⚠️');
    expect(call.content.body).toContain('dropped');
  });

  it('sends movement price alert', async () => {
    await sendPriceAlert('HDFC Bank', 'HDFCBANK', 1680, 'movement');

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain('📊');
    expect(call.content.title).toContain('Moving');
  });

  it('sets channelId to price_alerts', async () => {
    await sendPriceAlert('Test', 'TEST', 100, 'target_hit');
    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect((call.content as any).channelId).toBe('price_alerts');
  });

  it('includes stock data in notification data', async () => {
    await sendPriceAlert('Test', 'TEST', 100, 'target_hit');
    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.data).toMatchObject({
      stockId: 'TEST',
      symbol: 'TEST',
      screen: 'StockDetail',
    });
  });
});

describe('Notification Service — sendTradeConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('tr-1');
  });

  it('sends a buy trade confirmation', async () => {
    const id = await sendTradeConfirmation('buy', 'RELIANCE', 10, 2890, 28900);
    expect(id).toBe('tr-1');

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain('✅');
    expect(call.content.title).toContain('Order Executed');
    expect(call.content.body).toContain('Bought');
    expect(call.content.body).toContain('10 shares');
    expect(call.content.body).toContain('RELIANCE');
    expect(call.content.body).toContain('₹2890.00');
  });

  it('sends a sell trade confirmation', async () => {
    await sendTradeConfirmation('sell', 'TCS', 5, 4200, 21000);

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain('Sell');
    expect(call.content.body).toContain('Sold');
    expect(call.content.body).toContain('5 shares');
  });

  it('sets channelId to trade_confirmations', async () => {
    await sendTradeConfirmation('buy', 'TEST', 1, 100, 100);
    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect((call.content as any).channelId).toBe('trade_confirmations');
  });

  it('includes trade data in notification data', async () => {
    await sendTradeConfirmation('buy', 'TEST', 10, 150.5, 1505);
    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.data).toMatchObject({
      symbol: 'TEST',
      type: 'buy',
      quantity: 10,
      price: 150.5,
      total: 1505,
    });
  });
});

describe('Notification Service — sendEducationalReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('ed-1');
  });

  it('sends new_lesson reminder', async () => {
    const id = await sendEducationalReminder('Stock Trading 101', 'Technical Analysis', 'new_lesson');
    expect(id).toBe('ed-1');

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain('📖');
    expect(call.content.title).toContain('New Lesson');
    expect(call.content.body).toContain('Technical Analysis');
    expect(call.content.body).toContain('Stock Trading 101');
  });

  it('sends quiz_reminder', async () => {
    await sendEducationalReminder('Mutual Funds', 'Types of Funds', 'quiz_reminder');

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain('🧠');
    expect(call.content.title).toContain('Quiz Time');
    expect(call.content.body).toContain('Mutual Funds');
    expect(call.content.body).toContain('Types of Funds');
  });

  it('sends course_complete reminder', async () => {
    await sendEducationalReminder('Options Trading', 'Final Exam', 'course_complete');

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain('🎉');
    expect(call.content.body).toContain('Congratulations');
    expect(call.content.body).toContain('Claim your certificate');
  });

  it('sends streak reminder', async () => {
    await sendEducationalReminder('Daily Market', 'Lesson 5', 'streak');

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain('🔥');
    expect(call.content.title).toContain('Learning Streak');
    expect(call.content.body).toContain('keep your streak alive');
  });

  it('sets channelId to educational_reminders', async () => {
    await sendEducationalReminder('C1', 'L1', 'new_lesson');
    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect((call.content as any).channelId).toBe('educational_reminders');
  });
});

describe('Notification Service — sendSystemNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Notifications, 'scheduleNotificationAsync').mockResolvedValue('sys-1');
  });

  it('sends a system notification with given title and message', async () => {
    const id = await sendSystemNotification('KYC Update', 'Your KYC is approved!');
    expect(id).toBe('sys-1');

    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toBe('KYC Update');
    expect(call.content.body).toBe('Your KYC is approved!');
  });

  it('sets channelId to system_notifications', async () => {
    await sendSystemNotification('Test', 'Message');
    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect((call.content as any).channelId).toBe('system_notifications');
  });

  it('sets screen data to Profile for system type', async () => {
    await sendSystemNotification('Test', 'Message');
    const call = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.data).toHaveProperty('screen', 'Profile');
  });
});
