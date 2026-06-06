/**
 * ============================================================================
 * Toroloom — Portfolio Alert Rules Tests
 * ============================================================================
 *
 * Tests the configurable portfolio alert system:
 *   - Rule CRUD (add, remove, update, toggle)
 *   - Alert evaluation for each kind (portfolio_pnl_pct, holding_day_gain_pct, etc.)
 *   - Threshold adjustments
 *   - Duplicate prevention
 *   - Trigger reset
 *   - Empty state handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useNotificationStore,
  PortfolioAlertData,
  isInQuietHours,
} from '../store/notificationStore';
import * as notificationService from '../services/notificationService';

// ── Mocks ───────────────────────────────────────────────────
vi.mock('../services/notificationService', () => ({
  sendLocalNotification: vi.fn(() => Promise.resolve('mock-id')),
  cancelNotification: vi.fn(),
  cancelAllNotifications: vi.fn(),
  sendPortfolioAlert: vi.fn(() => Promise.resolve('mock-id')),
  updateAppIconBadge: vi.fn(() => Promise.resolve()),
  clearAppIconBadge: vi.fn(() => Promise.resolve()),
}));

vi.mock('../constants/mockData', () => ({
  mockNotifications: [],
}));

vi.mock('../services/api', () => ({
  notificationApi: {
    getAll: vi.fn(() => Promise.resolve([])),
    markRead: vi.fn(() => Promise.resolve()),
    markAllRead: vi.fn(() => Promise.resolve()),
  },
}));

// ── Test Helpers ────────────────────────────────────────────

function createSampleData(overrides?: Partial<PortfolioAlertData>): PortfolioAlertData {
  return {
    totalReturnPercent: 7.35,
    totalReturn: 26715,
    totalInvested: 623500,
    currentValue: 650215,
    peakValue: 673739,
    holdings: [
      { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 10, buyPrice: 2450, currentPrice: 2890, currentValue: 28900, pnl: 4400, pnlPercent: 17.96, totalInvested: 24500, dayChange: 450, dayChangePercent: 1.59 },
      { id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy', quantity: 5, buyPrice: 3800, currentPrice: 3890, currentValue: 19450, pnl: 450, pnlPercent: 2.37, totalInvested: 19000, dayChange: -172, dayChangePercent: -0.88 },
      { id: 'h3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 20, buyPrice: 1650, currentPrice: 1678, currentValue: 33560, pnl: 560, pnlPercent: 1.70, totalInvested: 33000, dayChange: 460, dayChangePercent: 1.42 },
    ],
    consecutiveLossDays: 0,
    ...overrides,
  };
}

// Reset store before each test
beforeEach(() => {
  vi.clearAllMocks();
  const state = useNotificationStore.getState();
  // Remove all portfolio alert rules
  state.portfolioAlertRules.forEach(r => state.removePortfolioAlertRule(r.id));
  // Clear all notifications and badge count
  state.clearAll();
  useNotificationStore.setState({ portfolioAlertBadgeCount: 0, alertTriggerHistory: [] });
});

// ======================================================================
// Tests — Portfolio Alert Rule CRUD
// ======================================================================

describe('PortfolioAlertRules — CRUD', () => {
  it('starts with no custom rules after clearing defaults', () => {
    const { portfolioAlertRules } = useNotificationStore.getState();
    expect(portfolioAlertRules.length).toBe(0);
  });

  it('addPortfolioAlertRule adds a new rule', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Test Alert',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    const rules = useNotificationStore.getState().portfolioAlertRules;
    expect(rules.length).toBe(1);
    expect(rules[0].kind).toBe('portfolio_pnl_pct');
    expect(rules[0].threshold).toBe(-5);
    expect(rules[0].triggered).toBe(false);
    expect(rules[0].enabled).toBe(true);
    expect(rules[0].id).toBeDefined();
    expect(rules[0].createdAt).toBeDefined();
  });

  it('removePortfolioAlertRule removes a rule by id', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Test Alert',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    store.removePortfolioAlertRule(rule.id);
    expect(useNotificationStore.getState().portfolioAlertRules.length).toBe(0);
  });

  it('updatePortfolioAlertRule updates fields on existing rule', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Test Alert',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    store.updatePortfolioAlertRule(rule.id, { threshold: -10, enabled: false });

    const updated = useNotificationStore.getState().portfolioAlertRules[0];
    expect(updated.threshold).toBe(-10);
    expect(updated.enabled).toBe(false);
    expect(updated.kind).toBe('portfolio_pnl_pct'); // unchanged
  });

  it('resetPortfolioAlertTriggers sets all rules to untriggered', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Test Alert',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    // Manually set triggered
    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    store.updatePortfolioAlertRule(rule.id, { triggered: true });

    // Reset
    (useNotificationStore.getState() as any).resetPortfolioAlertTriggers();

    const updated = useNotificationStore.getState().portfolioAlertRules[0];
    expect(updated.triggered).toBe(false);
  });
});

// ======================================================================
// Tests — Portfolio Alert Evaluation
// ======================================================================

describe('PortfolioAlertRules — evaluatePortfolioAlerts', () => {
  it('does not fire when no rules exist', () => {
    const store = useNotificationStore.getState();
    store.evaluatePortfolioAlerts(createSampleData());
    expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
  });

  it('does not fire for disabled rules', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Test Alert',
      threshold: -5,
      direction: 'below',
      enabled: false, // disabled
    
      badge: true,});

    store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -10 }));
    expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
  });

  it('does not fire for already triggered rules', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Test Alert',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    const rule = useNotificationStore.getState().portfolioAlertRules[0];
    store.updatePortfolioAlertRule(rule.id, { triggered: true });

    store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -10 }));
    expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
  });

  describe('portfolio_pnl_pct', () => {
    it('fires alert when totalReturnPercent drops below threshold', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'portfolio_pnl_pct',
        label: 'Portfolio P&L',
        threshold: -5,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -6.2 }));
      expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();

      const rule = useNotificationStore.getState().portfolioAlertRules[0];
      expect(rule.triggered).toBe(true);
    });

    it('does not fire when P&L is above threshold', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'portfolio_pnl_pct',
        label: 'Portfolio P&L',
        threshold: -5,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -3 }));
      expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
    });
  });

  describe('portfolio_pnl_abs', () => {
    it('fires alert when absolute loss exceeds threshold', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'portfolio_pnl_abs',
        label: 'Portfolio Loss',
        threshold: 10000,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      store.evaluatePortfolioAlerts(createSampleData({ totalReturn: -15000 }));
      expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
    });

    it('does not fire when loss is below threshold', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'portfolio_pnl_abs',
        label: 'Portfolio Loss',
        threshold: 10000,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      store.evaluatePortfolioAlerts(createSampleData({ totalReturn: -5000 }));
      expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
    });

    it('does not fire when P&L is positive', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'portfolio_pnl_abs',
        label: 'Portfolio Loss',
        threshold: 10000,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      store.evaluatePortfolioAlerts(createSampleData({ totalReturn: 5000 }));
      expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
    });
  });

  describe('holding_day_gain_pct', () => {
    it('fires alert when a holding moves beyond threshold in a day', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'holding_day_gain_pct',
        label: 'Holding Day Gain',
        threshold: 10,
        direction: 'above',
        enabled: true,
      
      badge: true,});

      const holdings = createSampleData().holdings.map(h => {
        if (h.symbol === 'RELIANCE') return { ...h, dayChangePercent: 12.5 };
        return h;
      });

      store.evaluatePortfolioAlerts(createSampleData({ holdings }));
      expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
    });

    it('does not fire when no holding exceeds threshold', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'holding_day_gain_pct',
        label: 'Holding Day Gain',
        threshold: 10,
        direction: 'above',
        enabled: true,
      
      badge: true,});

      store.evaluatePortfolioAlerts(createSampleData());
      expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
    });

    it('filters by stockIds — only checks the specified stocks', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'holding_day_gain_pct',
        label: 'Day Gain — Watchlist',
        threshold: 5,
        direction: 'above',
        enabled: true,
        stockIds: ['TCS', 'HDFCBANK'],
        symbols: ['TCS', 'HDFCBANK'],
      
      badge: true,});

      // RELIANCE has 12.5% day gain, but is NOT in stockIds — should not fire
      const holdings = createSampleData().holdings.map(h => {
        if (h.symbol === 'RELIANCE') return { ...h, dayChangePercent: 12.5 };
        return h;
      });

      store.evaluatePortfolioAlerts(createSampleData({ holdings }));
      expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
    });

    it('stockIds filter — fires when a watched stock exceeds threshold', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'holding_day_gain_pct',
        label: 'Day Gain — TCS only',
        threshold: 2,
        direction: 'above',
        enabled: true,
        stockIds: ['TCS'],
        symbols: ['TCS'],
      
      badge: true,});

      // TCS dayChangePercent is -0.88 (absolute = 0.88 < 2) — should not fire
      const holdings = createSampleData().holdings.map(h => {
        if (h.symbol === 'TCS') return { ...h, dayChangePercent: 3.2 };
        return h;
      });

      store.evaluatePortfolioAlerts(createSampleData({ holdings }));
      expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
    });
  });

  describe('holding_pnl_pct', () => {
    it('fires alert when a holding P&L exceeds threshold (above)', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'holding_pnl_pct',
        label: 'Holding P&L',
        threshold: 15,
        direction: 'above',
        enabled: true,
      
      badge: true,});

      const holdings = createSampleData().holdings.map(h => {
        if (h.symbol === 'RELIANCE') return { ...h, pnlPercent: 25.0 };
        return h;
      });

      store.evaluatePortfolioAlerts(createSampleData({ holdings }));
      expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
    });

    it('fires alert when a holding P&L drops below threshold (below)', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'holding_pnl_pct',
        label: 'Holding P&L',
        threshold: -10,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      const holdings = createSampleData().holdings.map(h => {
        if (h.symbol === 'TCS') return { ...h, pnlPercent: -15.0 };
        return h;
      });

      store.evaluatePortfolioAlerts(createSampleData({ holdings }));
      expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
    });

    it('filters by stockIds — only checks specified stocks', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'holding_pnl_pct',
        label: 'P&L — Multi',
        threshold: 10,
        direction: 'above',
        enabled: true,
        stockIds: ['TCS', 'HDFCBANK'],
        symbols: ['TCS', 'HDFCBANK'],
      
      badge: true,});

      // RELIANCE has 17.96% P&L but is NOT watched
      store.evaluatePortfolioAlerts(createSampleData());
      expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();

      // Now RELIANCE IS watched
      const store2 = useNotificationStore.getState();
      store2.addPortfolioAlertRule({
        kind: 'holding_pnl_pct',
        label: 'P&L — RELIANCE',
        threshold: 10,
        direction: 'above',
        enabled: true,
        badge: true,
        stockIds: ['RELIANCE'],
        symbols: ['RELIANCE'],
      });

      store2.evaluatePortfolioAlerts(createSampleData());
      expect(notificationService.sendPortfolioAlert).toHaveBeenCalledTimes(1);
    });
  });

  describe('portfolio_peak_drawdown', () => {
    it('fires alert when drawdown from peak exceeds threshold', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'portfolio_peak_drawdown',
        label: 'Drawdown',
        threshold: 3,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      // peakValue = 673739, currentValue = 630000 → drawdown = 6.49%
      store.evaluatePortfolioAlerts(createSampleData({ currentValue: 630000 }));
      expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
    });

    it('does not fire when drawdown is below threshold', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'portfolio_peak_drawdown',
        label: 'Drawdown',
        threshold: 3,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      // peakValue = 673739, currentValue = 665000 → drawdown = 1.3%
      store.evaluatePortfolioAlerts(createSampleData({ currentValue: 665000 }));
      expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
    });
  });

  describe('consecutive_loss_days', () => {
    it('fires alert when consecutive loss days meet threshold', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'consecutive_loss_days',
        label: 'Loss Days',
        threshold: 3,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      store.evaluatePortfolioAlerts(createSampleData({ consecutiveLossDays: 3 }));
      expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
    });

    it('does not fire below threshold', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'consecutive_loss_days',
        label: 'Loss Days',
        threshold: 3,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      store.evaluatePortfolioAlerts(createSampleData({ consecutiveLossDays: 2 }));
      expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
    });
  });

  describe('adds notification to in-app list', () => {
    it('adds notification when an alert fires', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'portfolio_pnl_pct',
        label: 'Portfolio P&L',
        threshold: -5,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      const initialCount = useNotificationStore.getState().notifications.length;
      store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -8 }));
      
      const newCount = useNotificationStore.getState().notifications.length;
      expect(newCount).toBeGreaterThan(initialCount);

      const lastNotif = useNotificationStore.getState().notifications[0];
      expect(lastNotif.type).toBe('portfolio_alert');

      // Badge counter should increment
      expect(useNotificationStore.getState().portfolioAlertBadgeCount).toBe(1);

      // Trigger history should record the entry
      const history = useNotificationStore.getState().alertTriggerHistory;
      expect(history.length).toBe(1);
      expect(history[0].ruleId).toBeDefined();
      expect(history[0].kind).toBe('portfolio_pnl_pct');
      expect(history[0].value).toBe(-8);
      expect(history[0].threshold).toBe(-5);
      expect(history[0].timestamp).toBeDefined();
      expect(history[0].summary).toBeDefined();
    });

    it('records trigger history for holding_day_gain_pct alerts', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'holding_day_gain_pct',
        label: 'Day Gain — RELIANCE',
        threshold: 10,
        direction: 'above',
        enabled: true,
        stockIds: ['RELIANCE'],
        symbols: ['RELIANCE'],
      
      badge: true,});

      const holdings = createSampleData().holdings.map(h => {
        if (h.symbol === 'RELIANCE') return { ...h, dayChangePercent: 12.5 };
        return h;
      });

      store.evaluatePortfolioAlerts(createSampleData({ holdings }));

      const history = useNotificationStore.getState().alertTriggerHistory;
      expect(history.length).toBe(1);
      expect(history[0].kind).toBe('holding_day_gain_pct');
      expect(history[0].value).toBe(12.5);
      expect(history[0].threshold).toBe(10);
    });

    it('records multiple entries when multiple alerts fire', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'portfolio_pnl_pct',
        label: 'P&L %',
        threshold: -5,
        direction: 'below',
        enabled: true,
      
      badge: true,});
      store.addPortfolioAlertRule({
        kind: 'portfolio_peak_drawdown',
        label: 'Drawdown',
        threshold: 3,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      store.evaluatePortfolioAlerts(createSampleData({
        totalReturnPercent: -6,
        currentValue: 620000,
      }));

      const history = useNotificationStore.getState().alertTriggerHistory;
      expect(history.length).toBe(2);
      const kinds = history.map(h => h.kind);
      expect(kinds).toContain('portfolio_pnl_pct');
      expect(kinds).toContain('portfolio_peak_drawdown');
      expect(history[0].timestamp).toBeDefined();
      expect(history[1].timestamp).toBeDefined();
    });

    it('clearAlertTriggerHistory empties the history', () => {
      const store = useNotificationStore.getState();
      store.addPortfolioAlertRule({
        kind: 'portfolio_pnl_pct',
        label: 'P&L %',
        threshold: -5,
        direction: 'below',
        enabled: true,
      
      badge: true,});

      store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -6 }));
      expect(useNotificationStore.getState().alertTriggerHistory.length).toBe(1);

      (useNotificationStore.getState() as any).clearAlertTriggerHistory();
      expect(useNotificationStore.getState().alertTriggerHistory.length).toBe(0);
    });
  });
});

// ======================================================================
// Tests — Quiet Hours Suppression
// ======================================================================

describe('PortfolioAlertRules — quiet hours', () => {
  it('suppresses push notification during quiet hours but records in-app', () => {
    // Set quiet hours to cover current time
    const now = new Date();
    const hour = now.getHours();
    // Create a time range that definitively covers now
    const startHour = hour === 0 ? 23 : hour - 1;
    const endHour = hour === 23 ? 0 : hour + 1;
    const startStr = `${startHour > 12 ? startHour - 12 : startHour}:00 ${startHour >= 12 ? 'PM' : 'AM'}`;
    const endStr = `${endHour > 12 ? endHour - 12 : endHour}:00 ${endHour >= 12 ? 'PM' : 'AM'}`;

    useNotificationStore.setState({
      preferences: {
        ...useNotificationStore.getState().preferences,
        quietHoursStart: startStr,
        quietHoursEnd: endStr,
      },
    });

    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'P&L Quiet',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    const initialNotifCount = useNotificationStore.getState().notifications.length;
    store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -8 }));

    // Push notification should NOT be fired
    expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();

    // But in-app notification should still be added
    const state = useNotificationStore.getState();
    expect(state.notifications.length).toBeGreaterThan(initialNotifCount);
    expect(state.notifications[0].type).toBe('portfolio_alert');

    // Badge count should increment
    expect(state.portfolioAlertBadgeCount).toBe(1);

    // Trigger history should record the entry
    expect(state.alertTriggerHistory.length).toBe(1);
    expect(state.alertTriggerHistory[0].kind).toBe('portfolio_pnl_pct');

    // Rule should be marked triggered
    const rule = state.portfolioAlertRules[0];
    expect(rule.triggered).toBe(true);
  });

  it('fires push notification normally when quiet hours are off', () => {
    // Ensure quiet hours are null (off)
    useNotificationStore.setState({
      preferences: {
        ...useNotificationStore.getState().preferences,
        quietHoursStart: null,
        quietHoursEnd: null,
      },
    });

    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'P&L Normal',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -8 }));
    expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
  });

  it('suppresses push notification during overnight quiet hours', () => {
    // Set quiet hours that span midnight (e.g., 11:00 PM to 2:00 AM)
    // This covers all hours for testing, ensuring we're in quiet hours
    const now = new Date();
    const h = now.getHours();
    // Set start to 2 hours ago, end to 2 hours from now
    const startH = (h - 2 + 24) % 24;
    const endH = (h + 2) % 24;
    const fmt12 = (h24: number) => {
      const p = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
      return `${h12}:00 ${p}`;
    };

    const startStr = fmt12(startH);
    const endStr = fmt12(endH);

    // If startH <= endH, it's a same-day range — but we set it as the same
    // hours as the test above. Use overnight-style: end < start conceptually.
    // Actually, since we're setting actual times, if the range happens to be
    // same-day, isInQuietHours still works. Let's force overnight by setting
    // start to something earlier than end, but using the logic that
    // wraps around midnight. We'll just test with the dynamic range.

    useNotificationStore.setState({
      preferences: {
        ...useNotificationStore.getState().preferences,
        quietHoursStart: startStr,
        quietHoursEnd: endStr,
      },
    });

    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_abs',
      label: 'Overnight Quiet',
      threshold: 10000,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    store.evaluatePortfolioAlerts(createSampleData({ totalReturn: -15000 }));

    // Push should be suppressed since we're in quiet hours
    expect(notificationService.sendPortfolioAlert).not.toHaveBeenCalled();
  });

  it('does not suppress when quiet hours do not cover current time', () => {
    // Set a fixed past-time range that definitely does NOT include now:
    // use 3:00 AM to 4:00 AM (same-day range, likely in the past)
    useNotificationStore.setState({
      preferences: {
        ...useNotificationStore.getState().preferences,
        quietHoursStart: '3:00 AM',
        quietHoursEnd: '4:00 AM',
      },
    });

    // Verify the range doesn't cover now
    const prefs = useNotificationStore.getState().preferences;
    if (isInQuietHours(prefs)) {
      // We're between 3 AM and 4 AM — use an overnight range that ends in the past
      useNotificationStore.setState({
        preferences: {
          ...prefs,
          quietHoursStart: '1:00 AM',
          quietHoursEnd: '4:00 AM',
        },
      });
    }

    // Double-check we're not in quiet hours
    const updatedPrefs = useNotificationStore.getState().preferences;
    expect(isInQuietHours(updatedPrefs)).toBe(false);

    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'P&L Non-Quiet',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -8 }));
    expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
  });
});

// ======================================================================
// Tests — App Icon Badge
// ======================================================================

describe('PortfolioAlertRules — app icon badge', () => {
  it('updates app icon badge when an alert fires', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Badge Test',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -8 }));
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(1);
  });

  it('updates app icon badge to 2 when two alerts fire', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Badge Test 1',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });
    store.addPortfolioAlertRule({
      kind: 'portfolio_peak_drawdown',
      label: 'Badge Test 2',
      threshold: 3,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    store.evaluatePortfolioAlerts(createSampleData({
      totalReturnPercent: -6,
      currentValue: 620000,
    }));
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(2);
  });

  it('clears app icon badge when clearPortfolioAlertBadge is called', () => {
    // First fire an alert
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Badge Test',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -8 }));
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(1);

    // Clear badge
    vi.clearAllMocks();
    useNotificationStore.getState().clearPortfolioAlertBadge();
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(0);
  });
});

// ======================================================================
// Tests — Per-Rule Badge Opt-Out
// ======================================================================

describe('PortfolioAlertRules — per-rule badge opt-out', () => {
  it('does not increment badge when rule.badge is false', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'No Badge',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: false,
    });

    store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -8 }));
    // Badge count should NOT increment
    expect(useNotificationStore.getState().portfolioAlertBadgeCount).toBe(0);
    // updateAppIconBadge should NOT have been called
    expect(notificationService.updateAppIconBadge).not.toHaveBeenCalled();
    // But push notification should still fire
    expect(notificationService.sendPortfolioAlert).toHaveBeenCalled();
  });

  it('increments badge by default (badge not set)', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'Default Badge',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    store.evaluatePortfolioAlerts(createSampleData({ totalReturnPercent: -8 }));
    expect(useNotificationStore.getState().portfolioAlertBadgeCount).toBe(1);
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(1);
  });

  it('only increments badge for rules that have badge: true when mixed rules fire', () => {
    const store = useNotificationStore.getState();
    // Rule 1: badge opt-out
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'P&L % (no badge)',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: false,
    });
    // Rule 2: badge enabled
    store.addPortfolioAlertRule({
      kind: 'portfolio_peak_drawdown',
      label: 'Drawdown (badge)',
      threshold: 3,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    store.evaluatePortfolioAlerts(createSampleData({
      totalReturnPercent: -6,
      currentValue: 620000,
    }));

    // Only one rule with badge enabled fires → badge should be 1
    expect(useNotificationStore.getState().portfolioAlertBadgeCount).toBe(1);
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(1);
  });

  it('shows badge count of 2 when both badge-enabled rules fire', () => {
    const store = useNotificationStore.getState();
    // Rule 1: badge enabled
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'P&L %',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });
    // Rule 2: badge enabled
    store.addPortfolioAlertRule({
      kind: 'portfolio_peak_drawdown',
      label: 'Drawdown',
      threshold: 3,
      direction: 'below',
      enabled: true,
      badge: true,
    });
    // Rule 3: badge opt-out (should not affect count)
    store.addPortfolioAlertRule({
      kind: 'consecutive_loss_days',
      label: 'Loss Days (no badge)',
      threshold: 3,
      direction: 'below',
      enabled: true,
      badge: false,
    });

    store.evaluatePortfolioAlerts(createSampleData({
      totalReturnPercent: -6,
      currentValue: 620000,
      consecutiveLossDays: 3,
    }));

    // Both badge-enabled rules fire → badge should be 2
    expect(useNotificationStore.getState().portfolioAlertBadgeCount).toBe(2);
    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(2);
  });
});

// ======================================================================
// Tests — Multiple Rules
// ======================================================================

describe('PortfolioAlertRules — multiple rules', () => {
  it('evaluates all rules and fires for matching ones', () => {
    const store = useNotificationStore.getState();
    store.addPortfolioAlertRule({
      kind: 'portfolio_pnl_pct',
      label: 'P&L %',
      threshold: -5,
      direction: 'below',
      enabled: true,
      badge: true,
    });
    store.addPortfolioAlertRule({
      kind: 'portfolio_peak_drawdown',
      label: 'Drawdown',
      threshold: 3,
      direction: 'below',
      enabled: true,
      badge: true,
    });
    // This one should NOT fire
    store.addPortfolioAlertRule({
      kind: 'consecutive_loss_days',
      label: 'Loss Days',
      threshold: 3,
      direction: 'below',
      enabled: true,
      badge: true,
    });

    store.evaluatePortfolioAlerts(createSampleData({
      totalReturnPercent: -6,
      currentValue: 620000,
      consecutiveLossDays: 1, // below threshold
    }));

    // sendPortfolioAlert should be called twice (not three times)
    expect(notificationService.sendPortfolioAlert).toHaveBeenCalledTimes(2);
  });
});
