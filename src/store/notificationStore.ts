import { create } from 'zustand';
import { AppNotification } from '../types';
import { mockNotifications } from '../constants/mockData';
import { notificationApi } from '../services/api';
import { sendLocalNotification, cancelNotification, cancelAllNotifications } from '../services/notificationService';

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
  scheduledIds: Record<string, string[]>;

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
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: mockNotifications,
  preferences: defaultPreferences,
  priceAlertRules: [],
  scheduledIds: {},

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
