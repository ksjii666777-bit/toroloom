/**
 * ============================================================================
 * Toroloom — Widget Layout Store
 * ============================================================================
 *
 * Manages the layout state for the Portfolio Analytics dashboard widgets:
 *  - Add / remove / reorder widgets
 *  - Resize widgets between small / medium / large
 *  - Persist layout to AsyncStorage so user preferences survive app restarts
 *  - Default layout with sensible defaults
 *
 * ============================================================================
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DashboardWidget, WidgetType, WidgetSize, WidgetLayout } from '../types/widgets';

// ──── Constants ────────────────────────────────────────────────────────────

const LAYOUT_STORAGE_KEY = 'toroloom_widget_layout';
const LAYOUT_VERSION = 1;

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'w_pnl',             type: 'pnl',              title: 'P&L Overview',        order: 0, size: 'medium', visible: true },
  { id: 'w_holdings',        type: 'holdings',          title: 'Holdings Breakdown',  order: 1, size: 'medium', visible: true },
  { id: 'w_risk_metrics',    type: 'risk_metrics',      title: 'Risk Metrics',        order: 2, size: 'medium', visible: true },
  { id: 'w_sector',          type: 'sector_allocation', title: 'Sector Allocation',   order: 3, size: 'medium', visible: true },
  { id: 'w_trades',          type: 'recent_trades',     title: 'Recent Trades',       order: 4, size: 'medium', visible: true },
  { id: 'w_market',          type: 'market_overview',   title: 'Market Overview',     order: 5, size: 'medium', visible: true },
];

// ──── Helpers ──────────────────────────────────────────────────────────────

function uid(): string {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ──── Store ────────────────────────────────────────────────────────────────

interface WidgetStoreState {
  /** Widget layout with all instances */
  layout: WidgetLayout;
  /** Whether the layout has been hydrated from storage */
  hydrated: boolean;

  /** Actions */
  addWidget: (type: WidgetType, title: string, size?: WidgetSize) => void;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, updates: Partial<DashboardWidget>) => void;
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  resizeWidget: (widgetId: string, size: WidgetSize) => void;
  toggleWidgetVisibility: (widgetId: string) => void;
  resetLayout: () => void;

  /** Persistence */
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

export const useWidgetStore = create<WidgetStoreState>((set, get) => ({
  layout: { widgets: DEFAULT_WIDGETS, version: LAYOUT_VERSION },
  hydrated: false,

  addWidget: (type, title, size = 'medium') => {
    const newWidget: DashboardWidget = {
      id: uid(),
      type,
      title,
      order: get().layout.widgets.length,
      size,
      visible: true,
    };
    set(s => ({
      layout: { ...s.layout, widgets: [...s.layout.widgets, newWidget] },
    }));
    get().persist();
  },

  removeWidget: (widgetId) => {
    set(s => ({
      layout: {
        ...s.layout,
        widgets: s.layout.widgets
          .filter(w => w.id !== widgetId)
          .map((w, i) => ({ ...w, order: i })),
      },
    }));
    get().persist();
  },

  updateWidget: (widgetId, updates) => {
    set(s => ({
      layout: {
        ...s.layout,
        widgets: s.layout.widgets.map(w =>
          w.id === widgetId ? { ...w, ...updates } : w
        ),
      },
    }));
    get().persist();
  },

  reorderWidgets: (fromIndex, toIndex) => {
    set(s => {
      const widgets = [...s.layout.widgets];
      const [moved] = widgets.splice(fromIndex, 1);
      widgets.splice(toIndex, 0, moved);
      return {
        layout: {
          ...s.layout,
          widgets: widgets.map((w, i) => ({ ...w, order: i })),
        },
      };
    });
    get().persist();
  },

  resizeWidget: (widgetId, size) => {
    get().updateWidget(widgetId, { size });
  },

  toggleWidgetVisibility: (widgetId) => {
    set(s => ({
      layout: {
        ...s.layout,
        widgets: s.layout.widgets.map(w =>
          w.id === widgetId ? { ...w, visible: !w.visible } : w
        ),
      },
    }));
    get().persist();
  },

  resetLayout: () => {
    set({ layout: { widgets: DEFAULT_WIDGETS, version: LAYOUT_VERSION } });
    get().persist();
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(LAYOUT_STORAGE_KEY);
      if (raw) {
        const saved: WidgetLayout = JSON.parse(raw);
        if (saved.version === LAYOUT_VERSION) {
          set({ layout: saved, hydrated: true });
          return;
        }
      }
    } catch {
      // Storage read failed — use defaults
    }
    set({ hydrated: true });
  },

  persist: async () => {
    try {
      await AsyncStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(get().layout));
    } catch {
      // Storage write failed — layout not persisted but in-memory state is fine
    }
  },
}));
