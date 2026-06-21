import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { AppNotification, Holding } from '../types';
import { mockNotifications } from '../constants/mockData';
import { notificationApi } from '../services/api';
import { sendLocalNotification, cancelNotification, cancelAllNotifications, sendPortfolioAlert, updateAppIconBadge } from '../services/notificationService';

// ============ Notification Preferences ============

export interface NotificationPreferences {
  priceAlerts: boolean;
  tradeConfirmations: boolean;
  educationalReminders: boolean;
  systemUpdates: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  priceAlertThreshold: number;
}

const defaultPreferences: NotificationPreferences = {
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

// ============ Portfolio Alert Rule ============

/**
 * Threshold-based portfolio-level alert rule.
 * All conditions are evaluated client-side on every real-time P&L tick.
 */
export type PortfolioAlertKind = 'portfolio_pnl_pct' | 'portfolio_pnl_abs' | 'holding_day_gain_pct' | 'holding_pnl_pct' | 'portfolio_peak_drawdown' | 'consecutive_loss_days';

export interface PortfolioAlertRule {
  id: string;
  /** Which metric to watch */
  kind: PortfolioAlertKind;
  /** Human-readable label (e.g., "Portfolio P&L") */
  label: string;
  /** Threshold value. Meaning depends on kind:
   *  - portfolio_pnl_pct: percent (e.g. -5 means -5%)
   *  - portfolio_pnl_abs: absolute INR (e.g. 10000)
   *  - holding_day_gain_pct: percent (e.g. 10 means +10% day gain)
   *  - holding_pnl_pct: percent (e.g. 20 means +20% total P&L)
   *  - portfolio_peak_drawdown: percent from peak (e.g. 3 means -3%)
   *  - consecutive_loss_days: count (e.g. 3 means 3 days in a row)
   */
  threshold: number;
  /** Direction: 'above' | 'below'. For most alerts, 'below' is used for loss, 'above' for gain */
  direction: 'above' | 'below';
  /** Optional stockId(s) to filter (only for holding-specific rules). Single stock or multi-select. */
  stockIds?: string[];
  /** Optional holding symbol(s) (only for holding-specific rules) */
  symbols?: string[];
  /** Whether this rule has already triggered (avoids duplicate alerts) */
  triggered: boolean;
  /** When the rule was created */
  createdAt: string;
  /** Whether the rule is enabled */
  enabled: boolean;
  /** Whether this rule increments the app icon badge when it fires. Defaults to true. */
  badge: boolean;
}

// ============ Alert Trigger History ============

export interface AlertTriggerEntry {
  /** Which rule fired */
  ruleId: string;
  /** Human-readable rule label at time of firing */
  ruleLabel: string;
  /** Alert kind */
  kind: PortfolioAlertKind;
  /** The value that triggered the alert (actual P&L%, share count, etc.) */
  value: number;
  /** The rule's threshold at time of firing */
  threshold: number;
  /** ISO timestamp when the alert fired */
  timestamp: string;
  /** Short summary like 'P&L dropped to -6.2%' or 'RELIANCE day gain 12.5%' */
  summary: string;
}

// ============ Price Alert Rule ============

export interface PriceAlertRule {
  id: string;
  symbol: string;
  stockName: string;
  targetPrice: number;
  direction: 'above' | 'below';
  triggered: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  preferences: NotificationPreferences;
  priceAlertRules: PriceAlertRule[];
  portfolioAlertRules: PortfolioAlertRule[];
  scheduledIds: Record<string, string[]>;
  /** Running count of portfolio alerts that have fired today — shown as badge on More tab */
  portfolioAlertBadgeCount: number;
  /** Chronological log of every portfolio alert trigger (newest first) */
  alertTriggerHistory: AlertTriggerEntry[];

  // Backend sync
  fetchNotifications: () => Promise<void>;

  // Notification CRUD
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: AppNotification) => Promise<string | undefined>;
  removeNotification: (notificationId: string) => void;
  clearAll: () => void;

  // Preferences
  updatePreference: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => void;
  resetPreferences: () => void;

  // Price Alert Rules
  addPriceAlertRule: (symbol: string, stockName: string, targetPrice: number, direction: 'above' | 'below') => void;
  removePriceAlertRule: (ruleId: string) => void;
  checkPriceAlerts: (currentPrices: Record<string, number>) => void;

  // Portfolio Alert Rules
  addPortfolioAlertRule: (rule: Omit<PortfolioAlertRule, 'id' | 'triggered' | 'createdAt'>) => void;
  removePortfolioAlertRule: (ruleId: string) => void;
  updatePortfolioAlertRule: (ruleId: string, updates: Partial<PortfolioAlertRule>) => void;
  /** Evaluate all portfolio alert rules against current portfolio state */
  evaluatePortfolioAlerts: (data: PortfolioAlertData) => void;
  /** Reset all portfolio alert rule triggers (for new trading day) */
  resetPortfolioAlertTriggers: () => void;
  /** Clear the badge counter on the More tab (user has seen the alerts) */
  clearPortfolioAlertBadge: () => void;
  /** Clear the alert trigger history log */
  clearAlertTriggerHistory: () => void;

  /** Default threshold for long-press quick-add day gain alert (ReportsScreen) */
  quickAddDayGainThreshold: number;
  /** Default threshold for long-press quick-add P&L alert (ReportsScreen) */
  quickAddPnLThreshold: number;
  /** Update one of the quick-add default thresholds */
  setQuickAddThreshold: (kind: 'day_gain' | 'pnl', value: number) => void;

  /** Sync all portfolio alert rules to the backend for server-side push evaluation */
  syncPortfolioAlertRules: () => Promise<void>;

  /** Trigger a server-side evaluation of portfolio alerts */
  evaluateOnBackend: (portfolioData?: Record<string, any>) => Promise<void>;

  /** Fetch the badge count from the backend and sync the local store and app icon. */
  syncBadgeCountFromBackend: () => Promise<void>;
}

/** Data passed to evaluatePortfolioAlerts on each real-time update */
export interface PortfolioAlertData {
  /** Portfolio-level total return (%) */
  totalReturnPercent: number;
  /** Portfolio-level total return (₹) */
  totalReturn: number;
  /** Total invested */
  totalInvested: number;
  /** Current portfolio value */
  currentValue: number;
  /** Peak portfolio value seen (for drawdown) */
  peakValue: number;
  /** All holdings with live data */
  holdings: Holding[];
  /** Consecutive days of negative P&L */
  consecutiveLossDays: number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: mockNotifications,
  preferences: defaultPreferences,
  priceAlertRules: [],
  portfolioAlertRules: [
    // Default portfolio alerts — enabled by default
    {
      id: 'par_default_1',
      kind: 'portfolio_pnl_pct',
      label: 'Portfolio P&L <-5%',
      threshold: -5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
      badge: true,
    },
    {
      id: 'par_default_2',
      kind: 'holding_day_gain_pct',
      label: 'Holding day gain >10%',
      threshold: 10,
      direction: 'above',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
      badge: true,
    },
    {
      id: 'par_default_3',
      kind: 'portfolio_peak_drawdown',
      label: 'Portfolio drawdown >3%',
      threshold: 3,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: false,
      badge: true,
    },
  ],
  scheduledIds: {},
  portfolioAlertBadgeCount: 0,
  alertTriggerHistory: [],
  quickAddDayGainThreshold: 10,
  quickAddPnLThreshold: 20,

  fetchNotifications: async () => {
    try {
      const notifications = await notificationApi.getAll();
      set({ notifications });
    } catch {
      // Backend unavailable — keep existing mock data
    }
  },

  // ===== Notification CRUD =====

  markAsRead: async (notificationId) => {
    try {
      await notificationApi.markRead(notificationId);
    } catch {
      // Backend unavailable — execute locally
    }
    set(state => ({
      notifications: state.notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
    }));
  },

  markAllAsRead: async () => {
    try {
      await notificationApi.markAllRead();
    } catch {
      // Backend unavailable — execute locally
    }
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
    }));
  },

  addNotification: async (notification) => {
    const { preferences } = get();
    const typeKey = getPreferenceKeyForType(notification.type);
    if (typeKey && !preferences[typeKey]) {
      return undefined;
    }
    const scheduledId = await sendLocalNotification(notification);
    set(state => {
      const newScheduledIds = scheduledId
        ? { ...state.scheduledIds, [notification.id]: [scheduledId] }
        : state.scheduledIds;
      return {
        notifications: [notification, ...state.notifications],
        scheduledIds: newScheduledIds,
      };
    });
    return scheduledId;
  },

  removeNotification: (notificationId) => {
    const state = get();
    const ids = state.scheduledIds[notificationId];
    if (ids) ids.forEach(id => cancelNotification(id));
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== notificationId),
      scheduledIds: Object.fromEntries(
        Object.entries(state.scheduledIds).filter(([key]) => key !== notificationId)
      ),
    }));
  },

  clearAll: () => {
    cancelAllNotifications();
    set({ notifications: [], scheduledIds: {} });
  },

  // ===== Preferences =====

  updatePreference: (key, value) => {
    set(state => ({
      preferences: { ...state.preferences, [key]: value },
    }));
  },

  resetPreferences: () => {
    set({ preferences: defaultPreferences });
  },

  // ===== Price Alert Rules =====

  addPriceAlertRule: (symbol, stockName, targetPrice, direction) => {
    set(state => ({
      priceAlertRules: [
        ...state.priceAlertRules,
        {
          id: `par_${Date.now()}`,
          symbol,
          stockName,
          targetPrice,
          direction,
          triggered: false,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  },

  removePriceAlertRule: (ruleId) => {
    set(state => ({
      priceAlertRules: state.priceAlertRules.filter(r => r.id !== ruleId),
    }));
  },

  // ===== Portfolio Alert Rules =====

  addPortfolioAlertRule: (rule) => {
    set(state => ({
      portfolioAlertRules: [
        ...state.portfolioAlertRules,
        {
          ...rule,
          id: `par_${Date.now()}`,
          triggered: false,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  },

  removePortfolioAlertRule: (ruleId) => {
    set(state => ({
      portfolioAlertRules: state.portfolioAlertRules.filter(r => r.id !== ruleId),
    }));
  },

  updatePortfolioAlertRule: (ruleId, updates) => {
    set(state => ({
      portfolioAlertRules: state.portfolioAlertRules.map(r =>
        r.id === ruleId ? { ...r, ...updates } : r
      ),
    }));
  },

  evaluatePortfolioAlerts: (data) => {
    const state = get();
    if (!state.preferences.priceAlerts) return;

    const { portfolioAlertRules, preferences } = state;
    const inQuiet = isInQuietHours(preferences);

    for (const rule of portfolioAlertRules) {
      if (!rule.enabled || rule.triggered) continue;

      let hit = false;
      let alertTitle = '';
      let alertMessage = '';
      let alertData: any = {};

      switch (rule.kind) {
        case 'portfolio_pnl_pct': {
          // rule.threshold is negative (e.g. -5)
          if (data.totalReturnPercent <= rule.threshold) {
            hit = true;
            alertTitle = '⚠️ Portfolio Alert: P&L Threshold Breached';
            alertMessage = `Your portfolio P&L is ${data.totalReturnPercent.toFixed(1)}% (₹${Math.abs(data.totalReturn).toLocaleString('en-IN')}). Triggered at ${rule.threshold}% loss threshold.`;
            alertData = { kind: 'portfolio_pnl_pct', value: data.totalReturnPercent, threshold: rule.threshold };
          }
          break;
        }
        case 'portfolio_pnl_abs': {
          // rule.threshold is positive INR (e.g. 10000 for -₹10,000)
          const lossAbs = Math.abs(data.totalReturn);
          if (data.totalReturn < 0 && lossAbs >= rule.threshold) {
            hit = true;
            alertTitle = '⚠️ Portfolio Alert: Loss Threshold Breached';
            alertMessage = `Your portfolio loss is ₹${lossAbs.toLocaleString('en-IN')}. Triggered at ₹${rule.threshold.toLocaleString('en-IN')} loss limit.`;
            alertData = { kind: 'portfolio_pnl_abs', value: lossAbs, threshold: rule.threshold };
          }
          break;
        }
        case 'holding_day_gain_pct': {
          // Check each holding's dayChangePercent — filter by stockIds if set
          const targets = rule.stockIds && rule.stockIds.length > 0
            ? data.holdings.filter(h => rule.stockIds!.includes(h.stockId))
            : data.holdings;
          for (const h of targets) {
            const dayGain = Math.abs(h.dayChangePercent);
            if (dayGain >= rule.threshold) {
              hit = true;
              alertTitle = `📈 ${h.symbol} Day Gain Alert`;
              alertMessage = `${h.name} moved ${h.dayChangePercent >= 0 ? '+' : ''}${h.dayChangePercent.toFixed(1)}% today (₹${Math.abs(h.dayChange).toLocaleString('en-IN')}). Threshold: ${rule.threshold}% daily move.`;
              alertData = { kind: 'holding_day_gain_pct', symbol: h.symbol, stockId: h.stockId, value: h.dayChangePercent, threshold: rule.threshold };
              break;
            }
          }
          break;
        }
        case 'holding_pnl_pct': {
          // Check each holding's total P&L percent — filter by stockIds if set
          const targets = rule.stockIds && rule.stockIds.length > 0
            ? data.holdings.filter(h => rule.stockIds!.includes(h.stockId))
            : data.holdings;
          for (const h of targets) {
            if (rule.direction === 'above' && h.pnlPercent >= rule.threshold) {
              hit = true;
              alertTitle = `💰 ${h.symbol} P&L Alert`;
              alertMessage = `${h.name} P&L is +${h.pnlPercent.toFixed(1)}% (₹${Math.abs(h.pnl).toLocaleString('en-IN')}). Threshold: ${rule.threshold}% gain.`;
              alertData = { kind: 'holding_pnl_pct', symbol: h.symbol, stockId: h.stockId, value: h.pnlPercent, threshold: rule.threshold };
              break;
            }
            if (rule.direction === 'below' && h.pnlPercent <= rule.threshold) {
              hit = true;
              alertTitle = `📉 ${h.symbol} P&L Alert`;
              alertMessage = `${h.name} P&L is ${h.pnlPercent.toFixed(1)}% (${h.pnl >= 0 ? '+' : ''}₹${Math.abs(h.pnl).toLocaleString('en-IN')}). Threshold: ${rule.threshold}% loss.`;
              alertData = { kind: 'holding_pnl_pct', symbol: h.symbol, stockId: h.stockId, value: h.pnlPercent, threshold: rule.threshold };
              break;
            }
          }
          break;
        }
        case 'portfolio_peak_drawdown': {
          // Drawdown from peak: (peakValue - currentValue) / peakValue * 100
          if (data.peakValue > 0) {
            const drawdown = ((data.peakValue - data.currentValue) / data.peakValue) * 100;
            if (drawdown >= rule.threshold) {
              hit = true;
              alertTitle = '📉 Portfolio Drawdown Alert';
              alertMessage = `Portfolio is down ${drawdown.toFixed(1)}% from its peak of ₹${data.peakValue.toLocaleString('en-IN')}. Threshold: ${rule.threshold}% drawdown.`;
              alertData = { kind: 'portfolio_peak_drawdown', value: drawdown, threshold: rule.threshold };
            }
          }
          break;
        }
        case 'consecutive_loss_days': {
          if (data.consecutiveLossDays >= rule.threshold) {
            hit = true;
            alertTitle = '🔴 Consecutive Loss Days Alert';
            alertMessage = `Portfolio has ${data.consecutiveLossDays} consecutive days of negative P&L. Threshold: ${rule.threshold} days. Consider reviewing your strategy.`;
            alertData = { kind: 'consecutive_loss_days', value: data.consecutiveLossDays, threshold: rule.threshold };
          }
          break;
        }
      }

      if (hit) {
        // Fire local notification (fire-and-forget — async is fine for push)
        // Skip during quiet hours to avoid intrusive heads-up notifications
        if (!inQuiet) {
          sendPortfolioAlert(alertTitle, alertMessage, alertData);
        }

        // Add to in-app notification list (sync — avoids async race in tests)
        const notif: AppNotification = {
          id: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'portfolio_alert',
          title: alertTitle,
          message: alertMessage,
          read: false,
          timestamp: new Date().toISOString(),
          data: alertData,
        };

        const historyEntry: AlertTriggerEntry = {
          ruleId: rule.id,
          ruleLabel: rule.label,
          kind: rule.kind,
          value: alertData.value ?? 0,
          threshold: rule.threshold,
          timestamp: new Date().toISOString(),
          summary: alertTitle.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim().split('.')[0],
        };

        // Only increment badge count if the rule hasn't opted out
        if (rule.badge !== false) {
          const newBadgeCount = get().portfolioAlertBadgeCount + 1;
          set(state => ({
            notifications: [notif, ...state.notifications],
            portfolioAlertBadgeCount: newBadgeCount,
            alertTriggerHistory: [historyEntry, ...state.alertTriggerHistory],
            portfolioAlertRules: state.portfolioAlertRules.map(r =>
              r.id === rule.id ? { ...r, triggered: true } : r
            ),
          }));
          updateAppIconBadge(newBadgeCount);
          // Haptic feedback for new alert badge
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        } else {
          set(state => ({
            notifications: [notif, ...state.notifications],
            alertTriggerHistory: [historyEntry, ...state.alertTriggerHistory],
            portfolioAlertRules: state.portfolioAlertRules.map(r =>
              r.id === rule.id ? { ...r, triggered: true } : r
            ),
          }));
        }
      }
    }
  },

  /** Clear the badge counter on the More tab (user has seen the alerts) */
  clearPortfolioAlertBadge: () => {
    set({ portfolioAlertBadgeCount: 0 });
    // Clear the iOS/Android app icon badge
    updateAppIconBadge(0);
  },

  /** Clear the alert trigger history log */
  clearAlertTriggerHistory: () => {
    set({ alertTriggerHistory: [] });
  },

  setQuickAddThreshold: (kind, value) => {
    set(kind === 'day_gain'
      ? { quickAddDayGainThreshold: value }
      : { quickAddPnLThreshold: value }
    );
  },

  /** Sync all portfolio alert rules to the backend for server-side evaluation. */
  syncPortfolioAlertRules: async () => {
    const { portfolioAlertRules } = get();
    try {
      await notificationApi.syncPortfolioAlertRules(portfolioAlertRules);
    } catch {
      // Backend unavailable — rules will be evaluated client-side
    }
  },

  /** Trigger a server-side evaluation of portfolio alerts on the backend. */
  evaluateOnBackend: async (portfolioData) => {
    try {
      const badgeCount = get().portfolioAlertBadgeCount;
      const response = await notificationApi.evaluatePortfolioAlerts(portfolioData, badgeCount);
      // Sync the server-side badge count back to the store (the server may have
      // incremented it when rules fired during evaluation)
      if (response?.badgeCount != null && response.badgeCount > 0) {
        set({ portfolioAlertBadgeCount: response.badgeCount });
        updateAppIconBadge(response.badgeCount);
      }
    } catch {
      // Backend unavailable — evaluation happens client-side
    }
  },

  /** Fetch the badge count from the backend and sync the local store and app icon. */
  syncBadgeCountFromBackend: async () => {
    try {
      const { badgeCount } = await notificationApi.getBadgeCount();
      if (badgeCount > 0) {
        set({ portfolioAlertBadgeCount: badgeCount });
        updateAppIconBadge(badgeCount);
      }
    } catch {
      // Backend unavailable — keep local count
    }
  },

  /** Reset all portfolio alert rules to untriggered (e.g., at start of a new day) */
  resetPortfolioAlertTriggers: () => {
    set(state => ({
      portfolioAlertRules: state.portfolioAlertRules.map(r => ({ ...r, triggered: false })),
    }));
  },

  checkPriceAlerts: (currentPrices) => {
    const state = get();
    const { priceAlertRules } = state;

    priceAlertRules
      .filter(rule => !rule.triggered)
      .forEach(rule => {
        const currentPrice = currentPrices[rule.symbol];
        if (!currentPrice) return;
        let hit = false;
        if (rule.direction === 'above' && currentPrice >= rule.targetPrice) hit = true;
        else if (rule.direction === 'below' && currentPrice <= rule.targetPrice) hit = true;

        if (hit) {
          get().addNotification({
            id: `pa_${Date.now()}`,
            type: 'price_alert',
            title: `🎯 Price Alert: ${rule.symbol}`,
            message: `${rule.stockName} ${rule.direction === 'above' ? 'rose to' : 'dropped to'} ₹${currentPrice.toFixed(2)} (target: ₹${rule.targetPrice.toFixed(2)})`,
            read: false,
            timestamp: new Date().toISOString(),
            data: { symbol: rule.symbol, stockName: rule.stockName, price: currentPrice },
          });
          set(state => ({
            priceAlertRules: state.priceAlertRules.map(r =>
              r.id === rule.id ? { ...r, triggered: true } : r
            ),
          }));
        }
      });
  },
}));

// ============ Quiet Hours Helper ============

/**
 * Parse a 12-hour time string (e.g., "10:00 PM", "7:00 AM") into minutes since midnight.
 */
function parseTimeToMinutes(str: string): number {
  const [timePart, period] = str.split(' ');
  let [h, m] = timePart.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + (m || 0);
}

/**
 * Check whether the current time falls within the user's configured quiet hours.
 * Supports both same-day ranges (e.g., 9:00 AM → 5:00 PM) and overnight
 * ranges (e.g., 10:00 PM → 7:00 AM).
 */
export function isInQuietHours(preferences: NotificationPreferences): boolean {
  if (!preferences.quietHoursStart || !preferences.quietHoursEnd) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTimeToMinutes(preferences.quietHoursStart);
  const endMinutes = parseTimeToMinutes(preferences.quietHoursEnd);

  if (startMinutes <= endMinutes) {
    // Same-day range (e.g., 9:00 AM to 5:00 PM)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range (e.g., 10:00 PM to 7:00 AM)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

function getPreferenceKeyForType(type: AppNotification['type']): keyof NotificationPreferences | null {
  switch (type) {
    case 'price_alert': return 'priceAlerts';
    case 'trade': return 'tradeConfirmations';
    case 'educational': return 'educationalReminders';
    case 'system':
    case 'news':
      return 'systemUpdates';
    default:
      return null;
  }
}
