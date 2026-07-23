/**
 * ============================================================================
 * Toroloom — Widget Data Service
 * ============================================================================
 *
 * Writes portfolio snapshot data to AsyncStorage and a shared container (App
 * Group) so that native iOS WidgetKit and Android App Widget extensions can
 * read it without loading the full React Native runtime.
 *
 * Flow:
 *   1. PortfolioStore updates → calls widgetService.updateSnapshot()
 *   2. widgetService writes to AsyncStorage (for the config plugin bridge)
 *   3. On iOS, a local Expo module writes the same data to App Group
 *      UserDefaults using the @bacons/apple-targets config plugin.
 *   4. The widget reads from UserDefaults / SharedPreferences and renders.
 *
 * Usage:
 *   import { widgetService } from '../services/widgetService';
 *   await widgetService.updateSnapshot();
 *
 * Widget data format (JSON):
 *   {
 *     "version": 1,
 *     "updatedAt": "2025-01-01T12:00:00.000Z",
 *     "totalInvested": 1250000,
 *     "currentValue": 1450000,
 *     "pnl": 200000,
 *     "pnlPercent": 16.0,
 *     "topHoldings": [
 *       { "symbol": "RELIANCE", "name": "Reliance Industries", ... }
 *     ],
 *     "marketStatus": "open" | "closed",
 *     "theme": "dark" | "light",
 *     "showPnL": true,
 *     "widgetSize": "small" | "medium" | "large"
 *   }
 *
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePortfolioStore } from '../store/portfolioStore';
import { log } from '../utils/logger';

// ──── Constants ────────────────────────────────────────────────────────────

const WIDGET_CACHE_KEY = 'toroloom_widget_data';
const WIDGET_PREFS_KEY = 'toroloom_widget_preferences';
const WIDGET_CACHE_VERSION = 1;

// ──── Types ────────────────────────────────────────────────────────────────

/** Shape of the data the native widget extensions will read */
export interface WidgetPortfolioSnapshot {
  version: number;
  updatedAt: string;
  totalInvested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  topHoldings: WidgetHolding[];
  totalHoldingCount: number;
  marketStatus: 'open' | 'closed';
  theme: 'dark' | 'light';
  showPnL: boolean;
  widgetSize: 'small' | 'medium' | 'large';
}

export interface WidgetHolding {
  symbol: string;
  name: string;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  quantity: number;
}

export interface WidgetPreferences {
  /** Whether to show P&L amount on the widget */
  showPnL: boolean;
  /** Which theme the widget should use */
  theme: 'dark' | 'light';
  /** Preferred widget size (used as default when adding widget) */
  defaultSize: 'small' | 'medium' | 'large';
  /** Which portfolio metrics to highlight on the widget */
  highlightedMetric: 'totalValue' | 'pnl' | 'pnlPercent' | 'topHolding';
  /** List of symbols to exclude from the widget (privacy) */
  hiddenSymbols: string[];
  /** Whether to show the widget on the home screen */
  widgetEnabled: boolean;
}

const DEFAULT_PREFERENCES: WidgetPreferences = {
  showPnL: true,
  theme: 'dark',
  defaultSize: 'medium',
  highlightedMetric: 'totalValue',
  hiddenSymbols: [],
  widgetEnabled: true,
};

// ──── Service ──────────────────────────────────────────────────────────────

/** Maps to the native module that writes to App Group UserDefaults on iOS */
let nativeWidgetBridge: {
  updateWidgetData: (json: string) => Promise<void>;
  reloadWidgetTimelines: () => Promise<void>;
  getWidgetData: () => Promise<string | null>;
} | null = null;

/**
 * Try to load the native widget bridge (iOS only — provided by the custom
 * Expo config plugin via a local module). On Android, data is read from
 * SharedPreferences by the Java/Kotlin AppWidgetProvider directly, so no
 * native bridge is needed for write — AsyncStorage → file bridge suffices.
 */
async function getNativeBridge() {
  if (nativeWidgetBridge) return nativeWidgetBridge;
  try {
    // Dynamic import of local Expo module (created by config plugin)
    const bridge = require('../../modules/toroloom-widget-bridge');
    if (bridge?.updateWidgetData) {
      nativeWidgetBridge = bridge;
      log.info('[WidgetService] Native bridge loaded');
    }
  } catch {
    // Native bridge not available (development / missing module) — silent
  }
  return nativeWidgetBridge;
}

// ──── Public API ───────────────────────────────────────────────────────────

export const widgetService = {
  /**
   * Build the latest portfolio snapshot and persist it for widgets.
   * Call this whenever portfolio data changes (after buy/sell/refresh).
   */
  async updateSnapshot(): Promise<void> {
    try {
      const portfolioState = usePortfolioStore.getState();
      const { holdings } = portfolioState;

      // Get preferences (needed before top holdings to filter hidden symbols)
      const prefs = await widgetService.getPreferences();

      // Calculate totals
      const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
      const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
      const pnl = currentValue - totalInvested;
      const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

      // Top 5 holdings by value (filter out hidden symbols for privacy)
      const hiddenSet = new Set(prefs.hiddenSymbols);
      const topHoldings: WidgetHolding[] = [...holdings]
        .filter(h => !hiddenSet.has(h.symbol))
        .sort((a, b) => b.currentValue - a.currentValue)
        .slice(0, 5)
        .map(h => ({
          symbol: h.symbol,
          name: h.name,
          currentValue: h.currentValue,
          pnl: h.pnl,
          pnlPercent: h.pnlPercent,
          quantity: h.quantity,
        }));

      // Check market status
      const day = new Date().getDay();
      const hour = new Date().getHours();
      const min = new Date().getMinutes();
      const isMarketOpen = day >= 1 && day <= 5 &&
        ((hour > 9 || (hour === 9 && min >= 15)) && (hour < 15 || (hour === 15 && min <= 30)));

      const snapshot: WidgetPortfolioSnapshot = {
        version: WIDGET_CACHE_VERSION,
        updatedAt: new Date().toISOString(),
        totalInvested,
        currentValue,
        pnl: prefs.showPnL ? pnl : 0,
        pnlPercent: prefs.showPnL ? pnlPercent : 0,
        topHoldings,
        totalHoldingCount: holdings.length,
        marketStatus: isMarketOpen ? 'open' : 'closed',
        theme: prefs.theme,
        showPnL: prefs.showPnL,
        widgetSize: prefs.defaultSize,
      };

      // 1. Write to AsyncStorage (primary — works on both platforms)
      const json = JSON.stringify(snapshot);
      await AsyncStorage.setItem(WIDGET_CACHE_KEY, json);

      // 2. On iOS, push to App Group UserDefaults via native bridge
      const bridge = await getNativeBridge();
      if (bridge) {
        await bridge.updateWidgetData(json);
        await bridge.reloadWidgetTimelines();
      }

      // 3. On Android, trigger widget update via broadcast (handled by local module)
      //    The AsyncStorage write acts as the trigger — Android Widget checks
      //    for updates on its periodic refresh cycle.

      if (__DEV__) {
        console.log('[WidgetService] Snapshot updated:', {
          totalInvested, currentValue, pnl, holdingsCount: holdings.length,
        });
      }
    } catch (error) {
      log.warn(`[WidgetService] Failed to update snapshot: ${error}`);
    }
  },

  /**
   * Get the current widget snapshot (for display in the widget settings screen).
   */
  async getSnapshot(): Promise<WidgetPortfolioSnapshot | null> {
    try {
      const raw = await AsyncStorage.getItem(WIDGET_CACHE_KEY);
      if (!raw) return null;
      const data: WidgetPortfolioSnapshot = JSON.parse(raw);
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Get widget user preferences.
   */
  async getPreferences(): Promise<WidgetPreferences> {
    try {
      const raw = await AsyncStorage.getItem(WIDGET_PREFS_KEY);
      if (!raw) return { ...DEFAULT_PREFERENCES };
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  },

  /**
   * Save widget user preferences.
   */
  async savePreferences(prefs: Partial<WidgetPreferences>): Promise<void> {
    try {
      const current = await widgetService.getPreferences();
      const merged = { ...current, ...prefs };
      await AsyncStorage.setItem(WIDGET_PREFS_KEY, JSON.stringify(merged));

      // Refresh snapshot so the widget picks up the changes (e.g., theme toggle)
      await widgetService.updateSnapshot();

      log.info('[WidgetService] Preferences saved');
    } catch (error) {
      log.warn(`[WidgetService] Failed to save preferences: ${error}`);
    }
  },

  /**
   * Format a currency value for widget display (short format).
   * e.g. 1,250,000 → "₹12.5L"
   */
  formatForWidget(value: number): string {
    if (value >= 10_000_000) {
      return `₹${(value / 10_000_000).toFixed(2)}Cr`;
    }
    if (value >= 100_000) {
      return `₹${(value / 100_000).toFixed(1)}L`;
    }
    if (value >= 1_000) {
      return `₹${(value / 1_000).toFixed(1)}K`;
    }
    return `₹${value.toFixed(0)}`;
  },

  /**
   * Format P&L percent for widget display.
   */
  formatPnLPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  },

  /**
   * Reload widget timelines on iOS (forces widget to re-render with new data).
   * On Android, the periodic update interval handles this.
   */
  async reloadWidget(): Promise<void> {
    const bridge = await getNativeBridge();
    if (bridge) {
      await bridge.reloadWidgetTimelines();
    }
  },
};

// ──── Auto-update on portfolio changes ─────────────────────────────────────

let subscribed = false;

/**
 * Subscribe to portfolio store changes so the widget snapshot is always fresh.
 * Call once at app startup (e.g., in App.tsx or AppNavigator).
 */
export function startWidgetAutoUpdate(): void {
  if (subscribed) return;
  subscribed = true;

  // Update on portfolio refresh
  usePortfolioStore.subscribe(() => {
    widgetService.updateSnapshot();
  });

  // Initial update
  setTimeout(() => {
    widgetService.updateSnapshot();
  }, 3000); // 3s delay to let portfolio load

  log.info('[WidgetService] Auto-update started');
}
