/**
 * ============================================================================
 * Toroloom — Notification Store Tests
 * ============================================================================
 *
 * Tests the notification store: notification CRUD, preferences, and
 * price alert rule checking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNotificationStore, NotificationPreferences, isInQuietHours } from '../store/notificationStore';
import { AppNotification } from '../types';
import { notificationApi } from '../services/api/notifications';
import * as notificationService from '../services/notificationService';

// Make sendLocalNotification synchronous so checkPriceAlerts' async
// addNotification call completes immediately in the same tick
vi.mock('../services/notificationService', () => ({
  sendPriceAlert: vi.fn(),
  sendTradeConfirmation: vi.fn(),
  sendEducationalReminder: vi.fn(),
  sendLocalNotification: vi.fn(() => 'mock-scheduled-id'),
  sendPortfolioAlert: vi.fn(),
  cancelNotification: vi.fn(),
  cancelAllNotifications: vi.fn(),
  setupChannels: vi.fn(),
  updateAppIconBadge: vi.fn(() => Promise.resolve()),
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
  sentimentAlerts: true,
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

describe('NotificationStore — Fetch Notifications', () => {
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

  it('maintains existing mock data when the API call fails', async () => {
    const existingNotifications: AppNotification[] = [
      { id: 'local_1', type: 'price_alert', title: 'Existing Alert', message: 'Kept on failure', read: false, timestamp: '2025-06-01T00:00:00' },
      { id: 'local_2', type: 'trade', title: 'Existing Trade', message: 'Should persist', read: true, timestamp: '2025-06-01T01:00:00' },
    ];
    useNotificationStore.setState({ notifications: existingNotifications });
    vi.mocked(notificationApi.getAll).mockRejectedValueOnce(new Error('Network error'));

    await useNotificationStore.getState().fetchNotifications();

    // Notifications should remain unchanged — the catch block preserves existing data
    expect(useNotificationStore.getState().notifications).toEqual(existingNotifications);
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

// ============================================================================
// Tests — syncBadgeCountFromBackend
// ============================================================================

describe('NotificationStore — syncBadgeCountFromBackend', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      portfolioAlertBadgeCount: 0,
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
    vi.clearAllMocks();
  });

  it('updates store and app icon badge when backend returns badgeCount > 0', async () => {
    vi.mocked(notificationApi.getBadgeCount).mockResolvedValueOnce({ badgeCount: 5 });

    await useNotificationStore.getState().syncBadgeCountFromBackend();

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertBadgeCount).toBe(5);
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(5);
  });

  it('does nothing when backend returns badgeCount = 0', async () => {
    vi.mocked(notificationApi.getBadgeCount).mockResolvedValueOnce({ badgeCount: 0 });

    await useNotificationStore.getState().syncBadgeCountFromBackend();

    const state = useNotificationStore.getState();
    // State should still be 0 (default from beforeEach)
    expect(state.portfolioAlertBadgeCount).toBe(0);
    expect(notificationService.updateAppIconBadge).not.toHaveBeenCalled();
  });

  it('does not overwrite local badge when backend returns 0 and local has a value', async () => {
    // Simulate a local badge count that was set before backend sync
    useNotificationStore.setState({ portfolioAlertBadgeCount: 3 });
    vi.mocked(notificationApi.getBadgeCount).mockResolvedValueOnce({ badgeCount: 0 });

    await useNotificationStore.getState().syncBadgeCountFromBackend();

    // Local count should remain 3 because the code only overwrites when badgeCount > 0
    const state = useNotificationStore.getState();
    expect(state.portfolioAlertBadgeCount).toBe(3);
    expect(notificationService.updateAppIconBadge).not.toHaveBeenCalled();
  });

  it('handles API failure gracefully — keeps local count unchanged', async () => {
    vi.mocked(notificationApi.getBadgeCount).mockRejectedValueOnce(new Error('Network error'));

    // Should not throw
    await expect(
      useNotificationStore.getState().syncBadgeCountFromBackend()
    ).resolves.not.toThrow();

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertBadgeCount).toBe(0);
    expect(notificationService.updateAppIconBadge).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tests — evaluateOnBackend
// ============================================================================

describe('NotificationStore — evaluateOnBackend', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      portfolioAlertBadgeCount: 0,
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
    vi.clearAllMocks();
  });

  it('passes current badge count to the API when calling evaluateOnBackend', async () => {
    // Set a non-zero badge count in the store
    useNotificationStore.setState({ portfolioAlertBadgeCount: 3 });

    vi.mocked(notificationApi.evaluatePortfolioAlerts).mockResolvedValueOnce({
      evaluated: true,
      rulesFired: 1,
      badgeCount: 4,
      fired: [{
        ruleId: 'test-rule',
        ruleLabel: 'Test',
        kind: 'portfolio_pnl_pct',
        title: 'Alert',
        message: 'Test message',
        value: -6,
      }],
    });

    await useNotificationStore.getState().evaluateOnBackend({ totalReturnPercent: -10 });

    expect(notificationApi.evaluatePortfolioAlerts).toHaveBeenCalledWith(
      { totalReturnPercent: -10 },
      3,
    );
  });

  it('passes badgeCount 0 when no alerts have fired (called without args)', async () => {
    vi.mocked(notificationApi.evaluatePortfolioAlerts).mockResolvedValueOnce({
      evaluated: true,
      rulesFired: 0,
      badgeCount: 0,
      fired: [],
    });

    await useNotificationStore.getState().evaluateOnBackend();

    expect(notificationApi.evaluatePortfolioAlerts).toHaveBeenCalledWith(
      undefined,
      0,
    );
  });

  it('handles API failure gracefully without throwing', async () => {
    useNotificationStore.setState({ portfolioAlertBadgeCount: 2 });
    vi.mocked(notificationApi.evaluatePortfolioAlerts).mockRejectedValueOnce(
      new Error('Network error'),
    );

    await expect(
      useNotificationStore.getState().evaluateOnBackend({ totalReturnPercent: -5 })
    ).resolves.not.toThrow();

    expect(notificationApi.evaluatePortfolioAlerts).toHaveBeenCalledWith(
      { totalReturnPercent: -5 },
      2,
    );
  });

  it('updates store badge count and app icon from the response badgeCount', async () => {
    useNotificationStore.setState({ portfolioAlertBadgeCount: 1 });

    vi.mocked(notificationApi.evaluatePortfolioAlerts).mockResolvedValueOnce({
      evaluated: true,
      rulesFired: 2,
      badgeCount: 3,
      fired: [
        { ruleId: 'r1', ruleLabel: 'P&L', kind: 'portfolio_pnl_pct', title: 'Alert', message: 'Test', value: -10 },
        { ruleId: 'r2', ruleLabel: 'Drawdown', kind: 'portfolio_peak_drawdown', title: 'Alert', message: 'Test', value: 5 },
      ],
    });

    await useNotificationStore.getState().evaluateOnBackend({ totalReturnPercent: -10 });

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertBadgeCount).toBe(3);
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(3);
  });

  it('does not overwrite store badge count when response badgeCount is 0', async () => {
    useNotificationStore.setState({ portfolioAlertBadgeCount: 2 });

    vi.mocked(notificationApi.evaluatePortfolioAlerts).mockResolvedValueOnce({
      evaluated: true,
      rulesFired: 0,
      badgeCount: 0,
      fired: [],
    });

    await useNotificationStore.getState().evaluateOnBackend();

    const state = useNotificationStore.getState();
    // Local count of 2 should remain since response badgeCount is 0 (guarded by > 0)
    expect(state.portfolioAlertBadgeCount).toBe(2);
    expect(notificationService.updateAppIconBadge).not.toHaveBeenCalled();
  });

  it('never overwrites with a null or undefined response badgeCount', async () => {
    useNotificationStore.setState({ portfolioAlertBadgeCount: 2 });

    vi.mocked(notificationApi.evaluatePortfolioAlerts).mockResolvedValueOnce({
      evaluated: true,
      rulesFired: 0,
      badgeCount: null as any,
      fired: [],
    });

    await useNotificationStore.getState().evaluateOnBackend();

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertBadgeCount).toBe(2);
    expect(notificationService.updateAppIconBadge).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tests — addPortfolioAlertRule
// ============================================================================

describe('NotificationStore — addPortfolioAlertRule', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      portfolioAlertRules: [],
      portfolioAlertBadgeCount: 0,
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
  });

  it('adds a portfolio alert rule with auto-generated fields', () => {
    useNotificationStore.getState().addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'P&L <-10%',
      threshold: -10,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    const rules = useNotificationStore.getState().portfolioAlertRules;
    expect(rules).toHaveLength(1);

    const rule = rules[0];
    expect(rule.kind).toBe('portfolio_pnl_pct');
    expect(rule.label).toBe('P&L <-10%');
    expect(rule.threshold).toBe(-10);
    expect(rule.direction).toBe('below');
    expect(rule.enabled).toBe(true);
    expect(rule.badge).toBe(true);
    expect(rule.triggered).toBe(false);
    expect(rule.id).toMatch(/^par_\d+$/);
    expect(rule.createdAt).toBeDefined();
    expect(() => new Date(rule.createdAt)).not.toThrow();
  });

  it('appends new rules to the existing list', () => {
    useNotificationStore.getState().addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'First Rule',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    useNotificationStore.getState().addPortfolioAlertRule({
      kind: 'portfolio_peak_drawdown',
      label: 'Second Rule',
      threshold: 3,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    const rules = useNotificationStore.getState().portfolioAlertRules;
    expect(rules).toHaveLength(2);
    // New rule is appended to the end via [...existing, newRule]
    expect(rules[0].label).toBe('First Rule');
    expect(rules[1].label).toBe('Second Rule');
  });

  it('adds a rule with optional stockIds and symbols', () => {
    useNotificationStore.getState().addPortfolioAlertRule({
      kind: 'holding_day_gain_pct',
      label: 'RELIANCE Day Gain >10%',
      threshold: 10,
      direction: 'above',
      enabled: true,
      badge: true,
      stockIds: ['stock_reliance'],
      symbols: ['RELIANCE'],
    });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.stockIds).toEqual(['stock_reliance']);
    expect(rule.symbols).toEqual(['RELIANCE']);
    expect(rule.kind).toBe('holding_day_gain_pct');
  });

  it('adds a rule with badge = false', () => {
    useNotificationStore.getState().addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'No Badge Rule',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: false,
    });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.badge).toBe(false);
  });

  it('adds a rule with kind = consecutive_loss_days', () => {
    useNotificationStore.getState().addPortfolioAlertRule({
      kind: 'consecutive_loss_days',
      label: '3 Loss Days',
      threshold: 3,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.kind).toBe('consecutive_loss_days');
    expect(rule.threshold).toBe(3);
  });

  it('adds a disabled rule', () => {
    useNotificationStore.getState().addPortfolioAlertRule({
      kind: 'portfolio_pnl_abs',
      label: 'Disabled P&L',
      threshold: 10000,
      direction: 'below',
      enabled: false,
      badge: true,
    });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.enabled).toBe(false);
    expect(rule.kind).toBe('portfolio_pnl_abs');
  });
});

// ============================================================================
// Tests — removePortfolioAlertRule
// ============================================================================

describe('NotificationStore — removePortfolioAlertRule', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      portfolioAlertRules: [],
      portfolioAlertBadgeCount: 0,
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
  });

  it('removes an existing rule by ID', () => {
    useNotificationStore.getState().addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Test Rule',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    const ruleId = useNotificationStore.getState().portfolioAlertRules[0].id;
    useNotificationStore.getState().removePortfolioAlertRule(ruleId);

    expect(useNotificationStore.getState().portfolioAlertRules).toHaveLength(0);
  });

  it('does nothing when the rule ID does not exist', () => {
    useNotificationStore.getState().addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Only Rule',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    useNotificationStore.getState().removePortfolioAlertRule('nonexistent-id');

    const rules = useNotificationStore.getState().portfolioAlertRules;
    expect(rules).toHaveLength(1);
    expect(rules[0].label).toBe('Only Rule');
  });

  it('removes only the specified rule when multiple exist', () => {
    // Use explicit IDs to avoid Date.now() colliding across rapid sequential calls
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_a',
          kind: 'portfolio_pnl_pct',
          label: 'Rule A',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: new Date().toISOString(),
          enabled: true,
          badge: true,
        },
        {
          id: 'rule_b',
          kind: 'portfolio_peak_drawdown',
          label: 'Rule B',
          threshold: 3,
          direction: 'below',
          triggered: false,
          createdAt: new Date().toISOString(),
          enabled: true,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().removePortfolioAlertRule('rule_a');

    const rules = useNotificationStore.getState().portfolioAlertRules;
    expect(rules).toHaveLength(1);
    expect(rules[0].label).toBe('Rule B');
  });

  it('does not remove price alert rules (portfolio scope only)', () => {
    // Add both a portfolio alert rule and a price alert rule
    useNotificationStore.getState().addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Portfolio Rule',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });
    useNotificationStore.getState().addPriceAlertRule('RELIANCE', 'Reliance', 3000, 'above');

    const portfolioRuleId = useNotificationStore.getState().portfolioAlertRules[0].id;
    useNotificationStore.getState().removePortfolioAlertRule(portfolioRuleId);

    // Portfolio rules should be empty, price alert rules should remain
    expect(useNotificationStore.getState().portfolioAlertRules).toHaveLength(0);
    expect(useNotificationStore.getState().priceAlertRules).toHaveLength(1);
  });
});

// ============================================================================
// Tests — updatePortfolioAlertRule
// ============================================================================

describe('NotificationStore — updatePortfolioAlertRule', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'test_rule_1',
          kind: 'portfolio_pnl_pct',
          label: 'Test Rule',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
      portfolioAlertBadgeCount: 0,
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
  });

  it('updates a single field on the matching rule', () => {
    useNotificationStore.getState().updatePortfolioAlertRule('test_rule_1', { threshold: -10 });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.threshold).toBe(-10);
    // Other fields remain unchanged
    expect(rule.label).toBe('Test Rule');
    expect(rule.enabled).toBe(true);
  });

  it('updates multiple fields at once', () => {
    useNotificationStore.getState().updatePortfolioAlertRule('test_rule_1', {
      label: 'Updated Label',
      threshold: -15,
      enabled: false,
    });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.label).toBe('Updated Label');
    expect(rule.threshold).toBe(-15);
    expect(rule.enabled).toBe(false);
    // Untouched fields preserved
    expect(rule.direction).toBe('below');
    expect(rule.kind).toBe('portfolio_pnl_pct');
  });

  it('does nothing when the rule ID does not exist', () => {
    useNotificationStore.getState().updatePortfolioAlertRule('nonexistent', { threshold: -10 });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.threshold).toBe(-5); // unchanged
    expect(useNotificationStore.getState().portfolioAlertRules).toHaveLength(1);
  });

  it('only updates the specified rule when multiple exist', () => {
    useNotificationStore.setState(state => ({
      portfolioAlertRules: [
        ...state.portfolioAlertRules,
        {
          id: 'test_rule_2',
          kind: 'portfolio_peak_drawdown',
          label: 'Second Rule',
          threshold: 3,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    }));

    useNotificationStore.getState().updatePortfolioAlertRule('test_rule_1', { enabled: false });

    const rules = useNotificationStore.getState().portfolioAlertRules;
    expect(rules).toHaveLength(2);
    expect(rules[0].enabled).toBe(false); // updated
    expect(rules[1].enabled).toBe(true);  // untouched
  });

  it('marks a rule as triggered', () => {
    useNotificationStore.getState().updatePortfolioAlertRule('test_rule_1', { triggered: true });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.triggered).toBe(true);
  });

  it('resets a triggered rule back to untriggered', () => {
    // First mark as triggered
    useNotificationStore.getState().updatePortfolioAlertRule('test_rule_1', { triggered: true });
    // Then reset
    useNotificationStore.getState().updatePortfolioAlertRule('test_rule_1', { triggered: false });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.triggered).toBe(false);
  });

  it('passing empty updates does not change the rule', () => {
    useNotificationStore.getState().updatePortfolioAlertRule('test_rule_1', {});

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.threshold).toBe(-5);
    expect(rule.label).toBe('Test Rule');
    expect(rule.triggered).toBe(false);
    expect(rule.enabled).toBe(true);
  });
});

// ============================================================================
// Tests — resetPortfolioAlertTriggers
// ============================================================================

describe('NotificationStore — resetPortfolioAlertTriggers', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_1',
          kind: 'portfolio_pnl_pct',
          label: 'Rule 1',
          threshold: -5,
          direction: 'below',
          triggered: true,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
        {
          id: 'rule_2',
          kind: 'portfolio_peak_drawdown',
          label: 'Rule 2',
          threshold: 3,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
      portfolioAlertBadgeCount: 0,
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
  });

  it('resets all triggered rules to untriggered', () => {
    useNotificationStore.getState().resetPortfolioAlertTriggers();

    const rules = useNotificationStore.getState().portfolioAlertRules;
    expect(rules[0].triggered).toBe(false);
    expect(rules[1].triggered).toBe(false);
  });

  it('leaves other fields intact on the reset rules', () => {
    useNotificationStore.getState().resetPortfolioAlertTriggers();

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    expect(rule.label).toBe('Rule 1');
    expect(rule.threshold).toBe(-5);
    expect(rule.kind).toBe('portfolio_pnl_pct');
    expect(rule.enabled).toBe(true);
    expect(rule.badge).toBe(true);
    expect(rule.id).toBe('rule_1');
  });

  it('keeps already-untriggered rules at false', () => {
    useNotificationStore.getState().resetPortfolioAlertTriggers();

    const rule = useNotificationStore.getState().portfolioAlertRules[1];
    expect(rule.triggered).toBe(false);
  });

  it('preserves the rule count', () => {
    useNotificationStore.getState().resetPortfolioAlertTriggers();

    expect(useNotificationStore.getState().portfolioAlertRules).toHaveLength(2);
  });

  it('does not affect price alert rules', () => {
    useNotificationStore.setState({
      priceAlertRules: [
        {
          id: 'p_rule_1',
          symbol: 'RELIANCE',
          stockName: 'Reliance',
          targetPrice: 3000,
          direction: 'above',
          triggered: true,
          createdAt: '2025-06-01T00:00:00',
        },
      ],
    });

    useNotificationStore.getState().resetPortfolioAlertTriggers();

    const priceRules = useNotificationStore.getState().priceAlertRules;
    expect(priceRules[0].triggered).toBe(true); // untouched
  });

  it('handles empty portfolio alert rules gracefully', () => {
    useNotificationStore.setState({ portfolioAlertRules: [] });

    expect(() => {
      useNotificationStore.getState().resetPortfolioAlertTriggers();
    }).not.toThrow();

    expect(useNotificationStore.getState().portfolioAlertRules).toEqual([]);
  });
});

// ============================================================================
// Tests — clearPortfolioAlertBadge
// ============================================================================

describe('NotificationStore — clearPortfolioAlertBadge', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      portfolioAlertBadgeCount: 3,
      portfolioAlertRules: [],
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
    vi.clearAllMocks();
  });

  it('resets badge count to 0', () => {
    useNotificationStore.getState().clearPortfolioAlertBadge();

    expect(useNotificationStore.getState().portfolioAlertBadgeCount).toBe(0);
  });

  it('calls updateAppIconBadge with 0 to clear the OS-level badge', () => {
    useNotificationStore.getState().clearPortfolioAlertBadge();

    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(0);
  });

  it('keeps badge count at 0 when already 0', () => {
    useNotificationStore.setState({ portfolioAlertBadgeCount: 0 });
    vi.clearAllMocks();

    useNotificationStore.getState().clearPortfolioAlertBadge();

    expect(useNotificationStore.getState().portfolioAlertBadgeCount).toBe(0);
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(0);
  });

  it('does not affect portfolio alert rules', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_1',
          kind: 'portfolio_pnl_pct',
          label: 'Test',
          threshold: -5,
          direction: 'below',
          triggered: true,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().clearPortfolioAlertBadge();

    const rules = useNotificationStore.getState().portfolioAlertRules;
    expect(rules).toHaveLength(1);
    expect(rules[0].triggered).toBe(true); // untouched
  });
});

// ============================================================================
// Tests — clearAlertTriggerHistory
// ============================================================================

describe('NotificationStore — clearAlertTriggerHistory', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      alertTriggerHistory: [
        { ruleId: 'r1', ruleLabel: 'Test', kind: 'portfolio_pnl_pct', value: -10, threshold: -5, timestamp: '2025-06-01T00:00:00', summary: 'P&L dropped' },
        { ruleId: 'r2', ruleLabel: 'Drawdown', kind: 'portfolio_peak_drawdown', value: 5, threshold: 3, timestamp: '2025-06-01T00:00:00', summary: 'Drawdown alert' },
      ],
      portfolioAlertBadgeCount: 0,
      portfolioAlertRules: [],
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
  });

  it('clears all entries from the alert trigger history', () => {
    useNotificationStore.getState().clearAlertTriggerHistory();

    expect(useNotificationStore.getState().alertTriggerHistory).toEqual([]);
  });

  it('keeps history empty when already empty', () => {
    useNotificationStore.setState({ alertTriggerHistory: [] });

    useNotificationStore.getState().clearAlertTriggerHistory();

    expect(useNotificationStore.getState().alertTriggerHistory).toEqual([]);
  });

  it('does not affect other store state', () => {
    useNotificationStore.setState({
      portfolioAlertBadgeCount: 3,
      portfolioAlertRules: [
        {
          id: 'rule_1',
          kind: 'portfolio_pnl_pct',
          label: 'Test',
          threshold: -5,
          direction: 'below',
          triggered: true,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
      notifications: [{ id: 'n1', type: 'price_alert', title: 'Alert', message: 'Test', read: false, timestamp: '2025-06-01T00:00:00' }],
    });

    useNotificationStore.getState().clearAlertTriggerHistory();

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertBadgeCount).toBe(3);   // untouched
    expect(state.portfolioAlertRules).toHaveLength(1); // untouched
    expect(state.notifications).toHaveLength(1);       // untouched
  });
});

// ============================================================================
// Tests — setQuickAddThreshold
// ============================================================================

describe('NotificationStore — setQuickAddThreshold', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      quickAddDayGainThreshold: 10,
      quickAddPnLThreshold: 20,
    });
  });

  it('updates quickAddDayGainThreshold when kind is day_gain', () => {
    useNotificationStore.getState().setQuickAddThreshold('day_gain', 15);

    const state = useNotificationStore.getState();
    expect(state.quickAddDayGainThreshold).toBe(15);
    expect(state.quickAddPnLThreshold).toBe(20); // unchanged
  });

  it('updates quickAddPnLThreshold when kind is pnl', () => {
    useNotificationStore.getState().setQuickAddThreshold('pnl', 25);

    const state = useNotificationStore.getState();
    expect(state.quickAddPnLThreshold).toBe(25);
    expect(state.quickAddDayGainThreshold).toBe(10); // unchanged
  });

  it('accepts zero as a valid threshold', () => {
    useNotificationStore.getState().setQuickAddThreshold('day_gain', 0);

    expect(useNotificationStore.getState().quickAddDayGainThreshold).toBe(0);
  });

  it('accepts negative values', () => {
    useNotificationStore.getState().setQuickAddThreshold('pnl', -10);

    expect(useNotificationStore.getState().quickAddPnLThreshold).toBe(-10);
  });

  it('does not affect portfolio alert state', () => {
    useNotificationStore.setState({
      portfolioAlertBadgeCount: 5,
      portfolioAlertRules: [
        {
          id: 'rule_1',
          kind: 'portfolio_pnl_pct',
          label: 'Test',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().setQuickAddThreshold('day_gain', 50);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertBadgeCount).toBe(5);   // untouched
    expect(state.portfolioAlertRules).toHaveLength(1); // untouched
  });
});

// ============================================================================
// Tests — evaluatePortfolioAlerts (client-side evaluation)
// ============================================================================

describe('NotificationStore — evaluatePortfolioAlerts', () => {
  const basePortfolioData = {
    totalReturnPercent: -10,
    totalReturn: -50000,
    totalInvested: 500000,
    currentValue: 450000,
    peakValue: 550000,
    holdings: [
      { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 10, buyPrice: 2800, currentPrice: 3000, totalInvested: 28000, currentValue: 30000, pnl: 2000, pnlPercent: 7.14, dayChange: 500, dayChangePercent: 5.0 },
      { id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy', quantity: 5, buyPrice: 3800, currentPrice: 3600, totalInvested: 19000, currentValue: 18000, pnl: -1000, pnlPercent: -5.26, dayChange: -200, dayChangePercent: -2.0 },
    ],
    consecutiveLossDays: 5,
  };

  beforeEach(() => {
    useNotificationStore.setState({
      portfolioAlertRules: [],
      portfolioAlertBadgeCount: 0,
      notifications: [],
      alertTriggerHistory: [],
      preferences: { ...defaultPrefs, priceAlerts: true },
      priceAlertRules: [],
      scheduledIds: {},
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Basic P&L breach ─────────────────────────────────────────────────

  it('triggers a portfolio_pnl_pct rule and increments badge on breach', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_pnl',
          kind: 'portfolio_pnl_pct',
          label: 'P&L <-5%',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.portfolioAlertBadgeCount).toBe(1);
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].type).toBe('portfolio_alert');
    expect(state.notifications[0].title).toContain('P&L Threshold Breached');
    expect(state.alertTriggerHistory).toHaveLength(1);
    expect(state.alertTriggerHistory[0].ruleId).toBe('rule_pnl');
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(1);
    expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
  });

  it('does not trigger when threshold is not breached', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_no_breach',
          kind: 'portfolio_pnl_pct',
          label: 'P&L <-15%',
          threshold: -15,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(false);
    expect(state.portfolioAlertBadgeCount).toBe(0);
    expect(state.notifications).toHaveLength(0);
  });

  it('skips disabled rules', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_disabled',
          kind: 'portfolio_pnl_pct',
          label: 'Disabled Rule',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: false,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(false);
    expect(state.portfolioAlertBadgeCount).toBe(0);
  });

  it('skips already-triggered rules', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_triggered',
          kind: 'portfolio_pnl_pct',
          label: 'Already Triggered',
          threshold: -5,
          direction: 'below',
          triggered: true,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    // Should stay triggered (not re-trigger) — no new notification, no badge increment
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.portfolioAlertBadgeCount).toBe(0);
    expect(state.notifications).toHaveLength(0);
  });

  it('returns early when priceAlerts preference is disabled', () => {
    useNotificationStore.setState({
      preferences: { ...defaultPrefs, priceAlerts: false },
      portfolioAlertRules: [
        {
          id: 'rule_pref_disabled',
          kind: 'portfolio_pnl_pct',
          label: 'Pref Disabled',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(false);
    expect(state.portfolioAlertBadgeCount).toBe(0);
  });

  // ── Multiple rules ──────────────────────────────────────────────────

  it('triggers multiple rules and increments badge by the count', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_a',
          kind: 'portfolio_pnl_pct',
          label: 'P&L <-5%',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
        {
          id: 'rule_b',
          kind: 'portfolio_peak_drawdown',
          label: 'Drawdown >3%',
          threshold: 3,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.portfolioAlertRules[1].triggered).toBe(true);
    expect(state.portfolioAlertBadgeCount).toBe(2);
    expect(state.notifications).toHaveLength(2);
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(2);
  });

  // ── portfolio_peak_drawdown ─────────────────────────────────────────

  it('triggers portfolio_peak_drawdown when drawdown exceeds threshold', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_drawdown',
          kind: 'portfolio_peak_drawdown',
          label: 'Drawdown >3%',
          threshold: 3,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    // peakValue=550000, currentValue=450000 → drawdown = (550000-450000)/550000*100 = ~18.2%
    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.alertTriggerHistory[0].value).toBeGreaterThan(3);
    expect(state.notifications[0].title).toContain('Drawdown Alert');
  });

  // ── portfolio_pnl_abs ───────────────────────────────────────────────

  it('triggers portfolio_pnl_abs when absolute loss exceeds threshold', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_abs',
          kind: 'portfolio_pnl_abs',
          label: 'Loss >₹20,000',
          threshold: 20000,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    // totalReturn = -50000, |totalReturn| = 50000 >= 20000 ✓
    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.notifications[0].title).toContain('Loss Threshold Breached');
  });

  it('does not trigger portfolio_pnl_abs when totalReturn is positive', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_abs_pos',
          kind: 'portfolio_pnl_abs',
          label: 'Loss >₹10,000',
          threshold: 10000,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    // totalReturn = +20000 (positive) → condition requires totalReturn < 0
    useNotificationStore.getState().evaluatePortfolioAlerts({
      ...basePortfolioData,
      totalReturn: 20000,
    });

    expect(useNotificationStore.getState().portfolioAlertRules[0].triggered).toBe(false);
  });

  // ── consecutive_loss_days ───────────────────────────────────────────

  it('triggers consecutive_loss_days when loss days exceed threshold', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_loss_days',
          kind: 'consecutive_loss_days',
          label: '3+ Loss Days',
          threshold: 3,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    // consecutiveLossDays = 5 >= 3 ✓
    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.notifications[0].title).toContain('Consecutive Loss Days');
  });

  // ── badge opt-out ───────────────────────────────────────────────────

  it('does not increment badge or call updateAppIconBadge when rule has badge=false', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_no_badge',
          kind: 'portfolio_pnl_pct',
          label: 'No Badge',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: false,
        },
      ],
    });

    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    // Rule fired, notification added, but badge not incremented
    expect(state.notifications).toHaveLength(1);
    expect(state.portfolioAlertBadgeCount).toBe(0);
    expect(notificationService.updateAppIconBadge).not.toHaveBeenCalled();
  });

  // ── holding_day_gain_pct ────────────────────────────────────────────

  it('triggers holding_day_gain_pct when a holding day gain breaches threshold', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_day_gain',
          kind: 'holding_day_gain_pct',
          label: 'Day Gain >3%',
          threshold: 3,
          direction: 'above',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    // RELIANCE has dayChangePercent = 5.0 → |5.0| = 5.0 >= 3 ✓
    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.notifications[0].title).toContain('Day Gain Alert');
  });

  // ── holding_day_gain_pct with stockIds filter ───────────────────────

  it('filters holding_day_gain_pct by stockIds when set', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_filtered',
          kind: 'holding_day_gain_pct',
          label: 'TCS Only Day Gain',
          threshold: 1,
          direction: 'above',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
          stockIds: ['TCS'], // only check TCS
        },
      ],
    });

    // TCS has dayChangePercent = -2.0 → |-2.0| = 2.0 >= 1 ✓
    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.notifications[0].title).toContain('TCS');
  });

  it('does not trigger holding_day_gain_pct when filtered stockIds have no match', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_no_match',
          kind: 'holding_day_gain_pct',
          label: 'Missing Stock',
          threshold: 1,
          direction: 'above',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
          stockIds: ['NONEXISTENT'],
        },
      ],
    });

    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    // No holdings match 'NONEXISTENT' → no breaching holding found
    expect(useNotificationStore.getState().portfolioAlertRules[0].triggered).toBe(false);
  });

  // ── holding_pnl_pct (above & below) ─────────────────────────────────

  it('triggers holding_pnl_pct above threshold', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_pnl_above',
          kind: 'holding_pnl_pct',
          label: 'P&L Gain >5%',
          threshold: 5,
          direction: 'above',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    // RELIANCE has pnlPercent = 7.14 >= 5 ✓
    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.notifications[0].title).toContain('P&L Alert');
  });

  it('triggers holding_pnl_pct below threshold', () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'rule_pnl_below',
          kind: 'holding_pnl_pct',
          label: 'P&L Loss >-5%',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    // TCS has pnlPercent = -5.26 <= -5 ✓
    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.notifications[0].title).toContain('P&L Alert');
  });

  // ── Quiet hours ────────────────────────────────────────────────────

  it('does not call sendPortfolioAlert during quiet hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T14:00:00')); // 2:00 PM

    useNotificationStore.setState({
      preferences: {
        ...defaultPrefs,
        priceAlerts: true,
        quietHoursStart: '1:00 PM',
        quietHoursEnd: '3:00 PM',
      },
      portfolioAlertRules: [
        {
          id: 'rule_quiet',
          kind: 'portfolio_pnl_pct',
          label: 'Quiet Hours Test',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    const state = useNotificationStore.getState();
    // Rule still triggers, in-app notification and badge still update
    expect(state.portfolioAlertRules[0].triggered).toBe(true);
    expect(state.notifications).toHaveLength(1);
    expect(state.portfolioAlertBadgeCount).toBe(1);
    // But the local push notification is suppressed during quiet hours
    expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('calls sendPortfolioAlert outside of quiet hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T10:00:00')); // 10:00 AM (outside 1-3 PM)

    useNotificationStore.setState({
      preferences: {
        ...defaultPrefs,
        priceAlerts: true,
        quietHoursStart: '1:00 PM',
        quietHoursEnd: '3:00 PM',
      },
      portfolioAlertRules: [
        {
          id: 'rule_not_quiet',
          kind: 'portfolio_pnl_pct',
          label: 'Not Quiet',
          threshold: -5,
          direction: 'below',
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });

    useNotificationStore.getState().evaluatePortfolioAlerts(basePortfolioData);

    expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();

    vi.useRealTimers();
  });
});

// ============================================================================
// Tests — isInQuietHours (pure helper)
// ============================================================================

describe('isInQuietHours', () => {
  const makePrefs = (start: string | null, end: string | null): NotificationPreferences => ({
    ...defaultPrefs,
    quietHoursStart: start,
    quietHoursEnd: end,
  });

  it('returns false when quiet hours are not configured', () => {
    expect(isInQuietHours(makePrefs(null, '10:00 PM'))).toBe(false);
    expect(isInQuietHours(makePrefs('10:00 PM', null))).toBe(false);
    expect(isInQuietHours(makePrefs(null, null))).toBe(false);
  });

  it('returns true during a same-day quiet hours range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T09:30:00')); // 9:30 AM within 9 AM - 5 PM

    expect(isInQuietHours(makePrefs('9:00 AM', '5:00 PM'))).toBe(true);

    vi.useRealTimers();
  });

  it('returns false outside a same-day quiet hours range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T20:00:00')); // 8:00 PM outside 9 AM - 5 PM

    expect(isInQuietHours(makePrefs('9:00 AM', '5:00 PM'))).toBe(false);

    vi.useRealTimers();
  });

  it('returns true at the start boundary of a same-day range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T09:00:00')); // exactly 9:00 AM (inclusive)

    expect(isInQuietHours(makePrefs('9:00 AM', '5:00 PM'))).toBe(true);

    vi.useRealTimers();
  });

  it('returns false at the end boundary of a same-day range (exclusive)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T17:00:00')); // exactly 5:00 PM (exclusive)

    expect(isInQuietHours(makePrefs('9:00 AM', '5:00 PM'))).toBe(false);

    vi.useRealTimers();
  });

  // ── Overnight ranges (start > end) ─────────────────────────────────

  it('returns true during an overnight quiet hours range (after start)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T23:00:00')); // 11:00 PM within 10 PM - 7 AM

    expect(isInQuietHours(makePrefs('10:00 PM', '7:00 AM'))).toBe(true);

    vi.useRealTimers();
  });

  it('returns true during an overnight quiet hours range (before end)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-02T05:00:00')); // 5:00 AM within 10 PM - 7 AM

    expect(isInQuietHours(makePrefs('10:00 PM', '7:00 AM'))).toBe(true);

    vi.useRealTimers();
  });

  it('returns false outside an overnight quiet hours range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T14:00:00')); // 2:00 PM outside 10 PM - 7 AM

    expect(isInQuietHours(makePrefs('10:00 PM', '7:00 AM'))).toBe(false);

    vi.useRealTimers();
  });

  it('returns true at the start boundary of an overnight range (inclusive)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T22:00:00')); // exactly 10:00 PM

    expect(isInQuietHours(makePrefs('10:00 PM', '7:00 AM'))).toBe(true);

    vi.useRealTimers();
  });

  it('returns false at the end boundary of an overnight range (exclusive)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-02T07:00:00')); // exactly 7:00 AM

    expect(isInQuietHours(makePrefs('10:00 PM', '7:00 AM'))).toBe(false);

    vi.useRealTimers();
  });

  it('parses noon and midnight correctly', () => {
    vi.useFakeTimers();

    // 12:00 PM (noon) — within 12:00 PM - 1:00 PM
    vi.setSystemTime(new Date('2025-06-01T12:00:00'));
    expect(isInQuietHours(makePrefs('12:00 PM', '1:00 PM'))).toBe(true);

    // 12:00 AM (midnight) — within 12:00 AM - 6:00 AM
    vi.setSystemTime(new Date('2025-06-01T00:00:00'));
    expect(isInQuietHours(makePrefs('12:00 AM', '6:00 AM'))).toBe(true);

    // 12:00 PM (noon) — outside 1:00 PM - 3:00 PM overnight (actually same-day)
    vi.setSystemTime(new Date('2025-06-01T12:00:00'));
    expect(isInQuietHours(makePrefs('1:00 PM', '3:00 PM'))).toBe(false);

    vi.useRealTimers();
  });

  // ── Edge cases: near midnight ───────────────────────────────────────

  it('returns true at 11:59 PM during an overnight range (10 PM - 7 AM)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T23:59:00')); // 11:59 PM — just before midnight

    expect(isInQuietHours(makePrefs('10:00 PM', '7:00 AM'))).toBe(true);

    vi.useRealTimers();
  });

  it('returns true at 12:01 AM during an overnight range (10 PM - 7 AM)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-02T00:01:00')); // 12:01 AM — just after midnight

    expect(isInQuietHours(makePrefs('10:00 PM', '7:00 AM'))).toBe(true);

    vi.useRealTimers();
  });

  it('returns false at 12:01 AM for a same-day range (9 AM - 5 PM)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T00:01:00')); // 12:01 AM — late night, outside 9 AM - 5 PM

    expect(isInQuietHours(makePrefs('9:00 AM', '5:00 PM'))).toBe(false);

    vi.useRealTimers();
  });

  it('returns true at 11:59 PM for a range ending at midnight (10 PM - 12 AM)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T23:59:00')); // 11:59 PM within 10 PM - 12 AM

    expect(isInQuietHours(makePrefs('10:00 PM', '12:00 AM'))).toBe(true);

    vi.useRealTimers();
  });

  it('returns true at 12:01 AM for a range starting at midnight (12 AM - 6 AM)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T00:01:00')); // 12:01 AM within 12 AM - 6 AM

    expect(isInQuietHours(makePrefs('12:00 AM', '6:00 AM'))).toBe(true);

    vi.useRealTimers();
  });

  it('uses the isInQuietHours import correctly', () => {
    // Verify the import resolves to the actual exported function
    expect(isInQuietHours).toBeDefined();
    expect(typeof isInQuietHours).toBe('function');
  });
});

// ============================================================================
// Tests — syncPortfolioAlertRules
// ============================================================================

describe('NotificationStore — syncPortfolioAlertRules', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      portfolioAlertRules: [],
      portfolioAlertBadgeCount: 0,
      notifications: [],
      preferences: defaultPrefs,
      priceAlertRules: [],
      scheduledIds: {},
    });
    vi.clearAllMocks();
  });

  it('sends all rules to the API', async () => {
    const rules = [
      {
        id: 'r1',
        kind: 'portfolio_pnl_pct' as const,
        label: 'P&L <-5%',
        threshold: -5,
        direction: 'below' as const,
        triggered: false,
        createdAt: '2025-06-01T00:00:00',
        enabled: true,
        badge: true,
      },
      {
        id: 'r2',
        kind: 'portfolio_peak_drawdown' as const,
        label: 'Drawdown >3%',
        threshold: 3,
        direction: 'below' as const,
        triggered: false,
        createdAt: '2025-06-01T00:00:00',
        enabled: false,
        badge: true,
      },
    ];
    useNotificationStore.setState({ portfolioAlertRules: rules });

    await useNotificationStore.getState().syncPortfolioAlertRules();

    expect(notificationApi.syncPortfolioAlertRules).toHaveBeenCalledWith(rules);
  });

  it('sends an empty array when no rules exist', async () => {
    await useNotificationStore.getState().syncPortfolioAlertRules();

    expect(notificationApi.syncPortfolioAlertRules).toHaveBeenCalledWith([]);
  });

  it('handles API failure gracefully without throwing', async () => {
    useNotificationStore.setState({
      portfolioAlertRules: [
        {
          id: 'r1',
          kind: 'portfolio_pnl_pct' as const,
          label: 'P&L <-5%',
          threshold: -5,
          direction: 'below' as const,
          triggered: false,
          createdAt: '2025-06-01T00:00:00',
          enabled: true,
          badge: true,
        },
      ],
    });
    vi.mocked(notificationApi.syncPortfolioAlertRules).mockRejectedValueOnce(
      new Error('Network error'),
    );

    await expect(
      useNotificationStore.getState().syncPortfolioAlertRules()
    ).resolves.not.toThrow();

    expect(notificationApi.syncPortfolioAlertRules).toHaveBeenCalled();
  });
});
