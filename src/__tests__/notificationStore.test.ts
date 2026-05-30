/**
 * ============================================================================
 * Toroloom — Notification Store Tests
 * ============================================================================
 *
 * Tests the notification store: notification CRUD, preferences, and
 * price alert rule checking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNotificationStore, NotificationPreferences } from '../store/notificationStore';
import { AppNotification } from '../types';
import { notificationApi } from '../services/api/notifications';

// Make sendLocalNotification synchronous so checkPriceAlerts' async
// addNotification call completes immediately in the same tick
vi.mock('../services/notificationService', () => ({
  sendPriceAlert: vi.fn(),
  sendTradeConfirmation: vi.fn(),
  sendEducationalReminder: vi.fn(),
  sendLocalNotification: vi.fn(() => 'mock-scheduled-id'),
  cancelNotification: vi.fn(),
  cancelAllNotifications: vi.fn(),
  setupChannels: vi.fn(),
}));

const mockNotification: AppNotification = {
  id: 'n1',
  type: 'price_alert',
  title: 'Price Alert: RELIANCE',
  message: 'RELIANCE crossed ₹2,890',
  read: false,
  timestamp: '2025-05-24T10:00:00',
};

const mockEducationalNotif: AppNotification = {
  id: 'n2',
  type: 'educational',
  title: 'New Lesson',
  message: 'Next lesson is ready!',
  read: false,
  timestamp: '2025-05-24T12:00:00',
};

const defaultPrefs: NotificationPreferences = {
  priceAlerts: true,
  tradeConfirmations: true,
  educationalReminders: true,
  systemUpdates: true,
  soundEnabled: true,
  vibrationEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  priceAlertThreshold: 2.0,
};

describe('NotificationStore — Initial State', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
  });

  it('starts with empty notifications when reset', () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.preferences).toEqual(defaultPrefs);
    expect(state.priceAlertRules).toEqual([]);
  });
});

describe('NotificationStore — Notification CRUD', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [mockNotification],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
  });

  it('marks a notification as read', async () => {
    await useNotificationStore.getState().markAsRead('n1');
    const notif = useNotificationStore.getState().notifications[0];
    expect(notif.read).toBe(true);
  });

  it('marks all notifications as read', async () => {
    useNotificationStore.setState({
      notifications: [
        mockNotification,
        { ...mockEducationalNotif, id: 'n2' },
      ],
    });

    await useNotificationStore.getState().markAllAsRead();
    const state = useNotificationStore.getState();
    expect(state.notifications.every(n => n.read)).toBe(true);
  });

  it('adds a notification to the list', async () => {
    useNotificationStore.setState({ notifications: [] });
    const newNotif = { ...mockNotification, id: 'n3' };
    await useNotificationStore.getState().addNotification(newNotif);
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].id).toBe('n3');
  });

  it('prepends new notifications', async () => {
    const newNotif1 = { ...mockNotification, id: 'n_new1' };
    const newNotif2 = { ...mockNotification, id: 'n_new2' };
    await useNotificationStore.getState().addNotification(newNotif1);
    await useNotificationStore.getState().addNotification(newNotif2);
    const state = useNotificationStore.getState();
    expect(state.notifications[0].id).toBe('n_new2');
  });

  it('removes a notification', async () => {
    useNotificationStore.setState({
      notifications: [
        { ...mockNotification, id: 'n1' },
        { ...mockNotification, id: 'n2' },
      ],
    });
    useNotificationStore.getState().removeNotification('n1');
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].id).toBe('n2');
  });

  it('clears all notifications', () => {
    useNotificationStore.setState({
      notifications: [mockNotification, mockEducationalNotif],
    });
    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });
});

describe('NotificationStore — Preferences', () => {
  beforeEach(() => {
    useNotificationStore.setState({ preferences: defaultPrefs });
  });

  it('updates a preference', () => {
    useNotificationStore.getState().updatePreference('priceAlerts', false);
    expect(useNotificationStore.getState().preferences.priceAlerts).toBe(false);
  });

  it('updates alert threshold', () => {
    useNotificationStore.getState().updatePreference('priceAlertThreshold', 5.0);
    expect(useNotificationStore.getState().preferences.priceAlertThreshold).toBe(5.0);
  });

  it('resets all preferences to defaults', () => {
    useNotificationStore.getState().updatePreference('priceAlerts', false);
    useNotificationStore.getState().updatePreference('soundEnabled', false);
    useNotificationStore.getState().resetPreferences();
    expect(useNotificationStore.getState().preferences).toEqual(defaultPrefs);
  });
});

describe('NotificationStore — Price Alert Rules', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      priceAlertRules: [],
      notifications: [],
      preferences: defaultPrefs,
      scheduledIds: {},
    });
  });

  it('adds a price alert rule', () => {
    useNotificationStore.getState().addPriceAlertRule('RELIANCE', 'Reliance Industries', 3000, 'above');
    const rules = useNotificationStore.getState().priceAlertRules;
    expect(rules).toHaveLength(1);
    expect(rules[0].symbol).toBe('RELIANCE');
    expect(rules[0].targetPrice).toBe(3000);
    expect(rules[0].direction).toBe('above');
    expect(rules[0].triggered).toBe(false);
  });

  it('removes a price alert rule', () => {
    useNotificationStore.getState().addPriceAlertRule('RELIANCE', 'Reliance Industries', 3000, 'above');
    const ruleId = useNotificationStore.getState().priceAlertRules[0].id;
    useNotificationStore.getState().removePriceAlertRule(ruleId);
    expect(useNotificationStore.getState().priceAlertRules).toEqual([]);
  });

  it('triggers rule when price crosses target (above)', () => {
    useNotificationStore.getState().addPriceAlertRule('RELIANCE', 'Reliance Industries', 2890, 'above');
    useNotificationStore.getState().checkPriceAlerts({ RELIANCE: 2900 });
    
    // Check that the rule was marked as triggered
    const rule = useNotificationStore.getState().priceAlertRules[0];
    expect(rule.triggered).toBe(true);
  });

  it('triggers rule when price crosses target (below)', () => {
    useNotificationStore.getState().addPriceAlertRule('TCS', 'Tata Consultancy', 3800, 'below');
    useNotificationStore.getState().checkPriceAlerts({ TCS: 3750 });
    const rule = useNotificationStore.getState().priceAlertRules[0];
    expect(rule.triggered).toBe(true);
  });

  it('does not trigger rule if price has not crossed target', () => {
    useNotificationStore.getState().addPriceAlertRule('RELIANCE', 'Reliance Industries', 3000, 'above');
    useNotificationStore.getState().checkPriceAlerts({ RELIANCE: 2890 });
    const rule = useNotificationStore.getState().priceAlertRules[0];
    expect(rule.triggered).toBe(false);
  });

  it('does not trigger already-triggered rules', () => {
    useNotificationStore.getState().addPriceAlertRule('RELIANCE', 'Reliance Industries', 2890, 'above');
    useNotificationStore.setState(state => ({
      priceAlertRules: state.priceAlertRules.map(r => ({ ...r, triggered: true })),
    }));
    useNotificationStore.getState().checkPriceAlerts({ RELIANCE: 3000 });
    // Should not re-trigger - rule stays triggered, no new notifications
    expect(useNotificationStore.getState().priceAlertRules[0].triggered).toBe(true);
    // No notification should be added because addNotification is async without await
    // But more importantly the rule state is correct
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('skips rule when stock price is not in the current prices object', () => {
    useNotificationStore.getState().addPriceAlertRule('MISSING_SYMBOL', 'Missing Stock', 100, 'above');
    useNotificationStore.getState().checkPriceAlerts({ RELIANCE: 2000 });
    const rule = useNotificationStore.getState().priceAlertRules[0];
    expect(rule.triggered).toBe(false);
  });

  it('triggers alert when price exactly equals target (above)', () => {
    useNotificationStore.getState().addPriceAlertRule('EQUAL', 'Equal Test', 150, 'above');
    useNotificationStore.getState().checkPriceAlerts({ EQUAL: 150 });
    expect(useNotificationStore.getState().priceAlertRules[0].triggered).toBe(true);
  });

  it('triggers alert when price exactly equals target (below)', () => {
    useNotificationStore.getState().addPriceAlertRule('EQUAL', 'Equal Test', 150, 'below');
    useNotificationStore.getState().checkPriceAlerts({ EQUAL: 150 });
    expect(useNotificationStore.getState().priceAlertRules[0].triggered).toBe(true);
  });
});

describe('NotificationStore — Fetch Notifications Success', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
  });

  it('loads notifications from the backend on success', async () => {
    const apiNotifications = [
      { id: 'api_1', type: 'price_alert', title: 'API Alert', message: 'Backend alert', read: false, timestamp: '2025-06-01T00:00:00' },
      { id: 'api_2', type: 'trade', title: 'Trade Executed', message: 'Bought 10 RELIANCE', read: true, timestamp: '2025-06-01T01:00:00' },
    ];
    vi.mocked(notificationApi.getAll).mockResolvedValueOnce(apiNotifications as any);

    await useNotificationStore.getState().fetchNotifications();

    expect(useNotificationStore.getState().notifications).toEqual(apiNotifications);
  });
});

describe('NotificationStore — Notification Type Filtering', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [],
      preferences: { ...defaultPrefs },
      priceAlertRules: [],
      scheduledIds: {},
    });
  });

  it('adds a trade notification (coverage: trade case in getPreferenceKeyForType)', async () => {
    const tradeNotif: AppNotification = {
      id: 'trade_1', type: 'trade', title: 'Trade', message: 'Bought stock', read: false, timestamp: '2025-06-01T00:00:00',
    };
    await useNotificationStore.getState().addNotification(tradeNotif);
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].type).toBe('trade');
  });

  it('adds a system notification (coverage: system case in getPreferenceKeyForType)', async () => {
    const systemNotif: AppNotification = {
      id: 'sys_1', type: 'system', title: 'System', message: 'App updated', read: false, timestamp: '2025-06-01T00:00:00',
    };
    await useNotificationStore.getState().addNotification(systemNotif);
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].type).toBe('system');
  });

  it('adds a news notification (coverage: news case in getPreferenceKeyForType, same branch as system)', async () => {
    const newsNotif: AppNotification = {
      id: 'news_1', type: 'news', title: 'News', message: 'Market news', read: false, timestamp: '2025-06-01T00:00:00',
    };
    await useNotificationStore.getState().addNotification(newsNotif);
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].type).toBe('news');
  });

  it('adds an unknown type notification (coverage: default case in getPreferenceKeyForType)', async () => {
    const unknownNotif = {
      id: 'unk_1', type: 'unknown_type', title: 'Unknown', message: 'Something', read: false, timestamp: '2025-06-01T00:00:00',
    } as unknown as AppNotification;
    await useNotificationStore.getState().addNotification(unknownNotif);
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].type).toBe('unknown_type');
  });

  it('does not add notification when its preference type is disabled', async () => {
    useNotificationStore.getState().updatePreference('priceAlerts', false);

    const alertNotif: AppNotification = {
      id: 'blocked_1', type: 'price_alert', title: 'Blocked', message: 'Should not appear', read: false, timestamp: '2025-06-01T00:00:00',
    };
    const result = await useNotificationStore.getState().addNotification(alertNotif);

    expect(result).toBeUndefined();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });
});
