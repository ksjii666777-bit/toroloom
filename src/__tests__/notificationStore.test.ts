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
});
