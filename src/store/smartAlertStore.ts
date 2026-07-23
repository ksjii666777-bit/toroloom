/**
 * ============================================================================
 * Smart Alert Store — Multi-Condition Price Alert Management
 * ============================================================================
 *
 * Manages smart price alerts with:
 *   - CRUD for multi-condition alerts
 *   - AsyncStorage persistence via Zustand
 *   - Alert evaluation & trigger management
 *   - 6 preset alert templates for quick setup
 *   - Trigger history log
 * ============================================================================
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SmartAlert,
  SmartAlertCondition,
  SmartAlertTriggerEntry,
  SmartAlertConditionKind,
  ConditionLogic,
} from '../services/smartAlertEngine';
import { sendLocalNotification } from '../services/notificationService';

// ============================================================================
// Types
// ============================================================================

export type NotificationType = 'local' | 'push';

export interface SmartAlertTemplate {
  name: string;
  symbol: string;
  stockName: string;
  conditions: SmartAlertCondition[];
  logic: ConditionLogic;
  cooldownMinutes: number;
  description: string;
  icon: string;
}

export interface SmartAlertState {
  alerts: SmartAlert[];
  triggerHistory: SmartAlertTriggerEntry[];
  alertBadgeCount: number;

  // CRUD
  addAlert: (alert: Omit<SmartAlert, 'id' | 'createdAt' | 'triggered' | 'lastTriggeredAt'>) => string;
  updateAlert: (id: string, updates: Partial<SmartAlert>) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;

  // Triggers
  markTriggered: (alertId: string, price: number) => void;
  resetTrigger: (alertId: string) => void;

  // History
  clearHistory: () => void;
  clearBadge: () => void;

  // Templates
  getTemplates: () => SmartAlertTemplate[];
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `sa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createCondition(
  kind: SmartAlertConditionKind,
  params: SmartAlertCondition['params'] = {},
): SmartAlertCondition {
  return {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    params,
  };
}

// ============================================================================
// Preset Templates
// ============================================================================

export const SMART_ALERT_TEMPLATES: SmartAlertTemplate[] = [
  {
    name: 'RSI Oversold Bounce',
    symbol: 'RELIANCE',
    stockName: 'Reliance Industries',
    icon: '📉',
    description: 'Alert when RSI drops below 30 (oversold)',
    logic: 'AND',
    cooldownMinutes: 60,
    conditions: [
      createCondition('rsi_oversold', { threshold: 30 }),
    ],
  },
  {
    name: 'Volume Spike Breakout',
    symbol: 'HDFCBANK',
    stockName: 'HDFC Bank',
    icon: '🚀',
    description: 'Alert on volume spike + price breakout above 20-bar high',
    logic: 'AND',
    cooldownMinutes: 30,
    conditions: [
      createCondition('volume_spike', { multiplier: 2 }),
      createCondition('breakout_high', { period: 20 }),
    ],
  },
  {
    name: 'Doji Detection',
    symbol: 'TCS',
    stockName: 'Tata Consultancy Services',
    icon: '◻️',
    description: 'Alert when a Doji candle is detected (indecision / potential reversal)',
    logic: 'AND',
    cooldownMinutes: 15,
    conditions: [
      createCondition('candle_pattern', { pattern: 'doji' }),
    ],
  },
  {
    name: 'Golden Cross',
    symbol: 'INFY',
    stockName: 'Infosys',
    icon: '🥇',
    description: '50-SMA crosses above 200-SMA — bullish signal',
    logic: 'AND',
    cooldownMinutes: 1440,
    conditions: [
      createCondition('ma_crossover', { fastPeriod: 50, slowPeriod: 200 }),
    ],
  },
  {
    name: '3 Consecutive Losses',
    symbol: 'ICICIBANK',
    stockName: 'ICICI Bank',
    icon: '🔴',
    description: 'Alert after 3 consecutive down days',
    logic: 'AND',
    cooldownMinutes: 60,
    conditions: [
      createCondition('consecutive_loss', { threshold: 3 }),
    ],
  },
  {
    name: 'Bullish Engulfing + RSI',
    symbol: 'SBIN',
    stockName: 'State Bank of India',
    icon: '🟢',
    description: 'Bullish engulfing candle detected + RSI not overbought',
    logic: 'AND',
    cooldownMinutes: 60,
    conditions: [
      createCondition('candle_pattern', { pattern: 'bullish_engulfing' }),
      createCondition('rsi_oversold', { threshold: 70 }),
    ],
  },
  {
    name: 'Gap Up + Volume Surge',
    symbol: 'BHARTIARTL',
    stockName: 'Bharti Airtel',
    icon: '📈',
    description: 'Alert when stock gaps up more than 2% with above-average volume',
    logic: 'AND',
    cooldownMinutes: 30,
    conditions: [
      createCondition('gap_up', { threshold: 2 }),
      createCondition('volume_spike', { multiplier: 1.5 }),
    ],
  },
  {
    name: 'Breakout or RSI Overbought',
    symbol: 'WIPRO',
    stockName: 'Wipro',
    icon: '⚡',
    description: 'Alert on breakout OR RSI overbought (either condition)',
    logic: 'OR',
    cooldownMinutes: 30,
    conditions: [
      createCondition('breakout_high', { period: 20 }),
      createCondition('rsi_overbought', { threshold: 70 }),
    ],
  },
];

// ============================================================================
// Default conditions for the creation wizard
// ============================================================================

export function createDefaultCondition(): SmartAlertCondition {
  return createCondition('price_cross_above', { threshold: 2000 });
}

// ============================================================================
// Store
// ============================================================================

export const useSmartAlertStore = create<SmartAlertState>()(
  persist(
    (set, get) => ({
      alerts: [],
      triggerHistory: [],
      alertBadgeCount: 0,

      addAlert: (alertData) => {
        const id = generateId();
        const newAlert: SmartAlert = {
          ...alertData,
          id,
          triggered: false,
          lastTriggeredAt: null,
          createdAt: new Date().toISOString(),
        };
        set(state => ({ alerts: [...state.alerts, newAlert] }));
        return id;
      },

      updateAlert: (id, updates) => {
        set(state => ({
          alerts: state.alerts.map(a =>
            a.id === id ? { ...a, ...updates } : a
          ),
        }));
      },

      removeAlert: (id) => {
        set(state => ({
          alerts: state.alerts.filter(a => a.id !== id),
        }));
      },

      toggleAlert: (id) => {
        set(state => ({
          alerts: state.alerts.map(a =>
            a.id === id ? { ...a, enabled: !a.enabled, triggered: false } : a
          ),
        }));
      },

      markTriggered: (alertId, price) => {
        const state = get();
        const alert = state.alerts.find(a => a.id === alertId);
        if (!alert) return;

        const now = new Date().toISOString();

        // Build summary from alert info
        const summary = `${alert.symbol}: ${alert.conditions.map(c => {
          const patterns = ['doji', 'hammer', 'shooting_star', 'bullish_engulfing', 'bearish_engulfing',
            'bullish_harami', 'bearish_harami', 'morning_star', 'evening_star', 'three_white_soldiers',
            'three_black_crows', 'marubozu'];
          if (c.kind === 'candle_pattern' && c.params.pattern) {
            return c.params.pattern.replace(/_/g, ' ');
          }
          if (c.kind === 'rsi_oversold') return 'RSI oversold';
          if (c.kind === 'rsi_overbought') return 'RSI overbought';
          if (c.kind === 'volume_spike') return 'volume spike';
          if (c.kind === 'ma_crossover') return 'golden cross';
          if (c.kind === 'ma_crossunder') return 'death cross';
          if (c.kind === 'breakout_high') return 'breakout';
          if (c.kind === 'breakout_low') return 'breakdown';
          if (c.kind === 'gap_up') return 'gap up';
          if (c.kind === 'gap_down') return 'gap down';
          return c.kind.replace(/_/g, ' ');
        }).join(' + ')}`;

        const entry: SmartAlertTriggerEntry = {
          alertId,
          alertName: alert.name,
          symbol: alert.symbol,
          conditions: alert.conditions,
          logic: alert.logic,
          price,
          timestamp: now,
          summary,
        };

        set(state => ({
          alerts: state.alerts.map(a =>
            a.id === alertId ? { ...a, triggered: true, lastTriggeredAt: now } : a
          ),
          triggerHistory: [entry, ...state.triggerHistory],
          alertBadgeCount: state.alertBadgeCount + 1,
        }));

        // Fire local notification
        sendLocalNotification({
          id: `smart_${Date.now()}`,
          type: 'smart_alert',
          title: `🎯 Smart Alert: ${alert.name}`,
          message: `${alert.symbol} at ₹${price.toFixed(2)} — ${summary}`,
          read: false,
          timestamp: now,
          data: { alertId, symbol: alert.symbol, price, alertName: alert.name },
        });
      },

      resetTrigger: (alertId) => {
        set(state => ({
          alerts: state.alerts.map(a =>
            a.id === alertId ? { ...a, triggered: false } : a
          ),
        }));
      },

      clearHistory: () => {
        set({ triggerHistory: [] });
      },

      clearBadge: () => {
        set({ alertBadgeCount: 0 });
      },

      getTemplates: () => SMART_ALERT_TEMPLATES,
    }),
    {
      name: 'toroloom_smart_alerts',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
