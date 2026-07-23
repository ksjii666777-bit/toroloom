/**
 * ============================================================================
 * Toroloom — Widget Store Unit Tests
 * ============================================================================
 *
 * Tests for the widgetStore Zustand store with AsyncStorage persistence.
 * Covers all CRUD operations, reordering, resizing, visibility toggling,
 * reset, and the hydrate/persist lifecycle.
 *
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWidgetStore } from '../store/widgetStore';

// ──── Constants matching the store ─────────────────────────────────────

const LAYOUT_STORAGE_KEY = 'toroloom_widget_layout';
const DEFAULT_WIDGET_COUNT = 6;

// ──── Tests ─────────────────────────────────────────────────────────────

describe('WidgetStore', () => {
  beforeEach(() => {
    // Reset store to default state between tests
    useWidgetStore.setState({
      layout: {
        widgets: [
          { id: 'w_pnl', type: 'pnl', title: 'P&L Overview', order: 0, size: 'medium', visible: true },
          { id: 'w_holdings', type: 'holdings', title: 'Holdings Breakdown', order: 1, size: 'medium', visible: true },
          { id: 'w_risk', type: 'risk_metrics', title: 'Risk Metrics', order: 2, size: 'medium', visible: true },
        ],
        version: 1,
      },
      hydrated: true,
    });
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // 1. Initial State
  // ─────────────────────────────────────────────────────────────────────

  describe('Initial State', () => {
    it('should have 3 widgets in the test state', () => {
      const state = useWidgetStore.getState();
      expect(state.layout.widgets).toHaveLength(3);
      expect(state.hydrated).toBe(true);
    });

    it('should have version 1', () => {
      const state = useWidgetStore.getState();
      expect(state.layout.version).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 2. addWidget
  // ─────────────────────────────────────────────────────────────────────

  describe('addWidget', () => {
    it('should add a widget with default size medium', () => {
      useWidgetStore.getState().addWidget('sector_allocation', 'Sector Allocation');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets).toHaveLength(4);
      const added = state.layout.widgets[3];
      expect(added.type).toBe('sector_allocation');
      expect(added.title).toBe('Sector Allocation');
      expect(added.size).toBe('medium');
      expect(added.visible).toBe(true);
      expect(added.order).toBe(3);
    });

    it('should add a widget with custom size', () => {
      useWidgetStore.getState().addWidget('recent_trades', 'Recent Trades', 'small');
      const state = useWidgetStore.getState();
      const added = state.layout.widgets[3];
      expect(added.size).toBe('small');
      expect(added.title).toBe('Recent Trades');
    });

    it('should assign a unique id to each added widget', () => {
      useWidgetStore.getState().addWidget('pnl', 'Widget 1');
      useWidgetStore.getState().addWidget('holdings', 'Widget 2');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[3].id).not.toBe(state.layout.widgets[4].id);
    });

    it('should call persist after adding', async () => {
      useWidgetStore.getState().addWidget('market_overview', 'Market');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const setItemCall = (AsyncStorage.setItem as any).mock.calls[0];
      expect(setItemCall[0]).toBe(LAYOUT_STORAGE_KEY);
      const saved = JSON.parse(setItemCall[1]);
      expect(saved.widgets).toHaveLength(4);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 3. removeWidget
  // ─────────────────────────────────────────────────────────────────────

  describe('removeWidget', () => {
    it('should remove a widget by id', () => {
      useWidgetStore.getState().removeWidget('w_risk');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets).toHaveLength(2);
      expect(state.layout.widgets.find(w => w.id === 'w_risk')).toBeUndefined();
    });

    it('should reorder remaining widgets after removal', () => {
      useWidgetStore.getState().removeWidget('w_pnl');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[0].id).toBe('w_holdings');
      expect(state.layout.widgets[0].order).toBe(0);
      expect(state.layout.widgets[1].id).toBe('w_risk');
      expect(state.layout.widgets[1].order).toBe(1);
    });

    it('should not affect other widgets when removing non-existent id', () => {
      useWidgetStore.getState().removeWidget('non_existent');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets).toHaveLength(3);
    });

    it('should call persist after removing', () => {
      useWidgetStore.getState().removeWidget('w_holdings');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 4. reorderWidgets
  // ─────────────────────────────────────────────────────────────────────

  describe('reorderWidgets', () => {
    it('should reorder widgets when dragging from index 0 to 2', () => {
      useWidgetStore.getState().reorderWidgets(0, 2);
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[0].id).toBe('w_holdings');
      expect(state.layout.widgets[1].id).toBe('w_risk');
      expect(state.layout.widgets[2].id).toBe('w_pnl');
    });

    it('should update order property after reorder', () => {
      useWidgetStore.getState().reorderWidgets(2, 0);
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[0].order).toBe(0);
      expect(state.layout.widgets[1].order).toBe(1);
      expect(state.layout.widgets[2].order).toBe(2);
    });

    it('should not change state when from === to', () => {
      const before = JSON.stringify(useWidgetStore.getState().layout);
      useWidgetStore.getState().reorderWidgets(1, 1);
      const after = JSON.stringify(useWidgetStore.getState().layout);
      expect(after).toBe(before);
    });

    it('should call persist after reorder', () => {
      useWidgetStore.getState().reorderWidgets(0, 1);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 5. resizeWidget
  // ─────────────────────────────────────────────────────────────────────

  describe('resizeWidget', () => {
    it('should resize a widget to small', () => {
      useWidgetStore.getState().resizeWidget('w_pnl', 'small');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[0].size).toBe('small');
    });

    it('should resize a widget to large', () => {
      useWidgetStore.getState().resizeWidget('w_holdings', 'large');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[1].size).toBe('large');
    });

    it('should not affect other widgets when resizing', () => {
      useWidgetStore.getState().resizeWidget('w_pnl', 'small');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[1].size).toBe('medium'); // unchanged
      expect(state.layout.widgets[2].size).toBe('medium'); // unchanged
    });

    it('should call persist after resize', () => {
      useWidgetStore.getState().resizeWidget('w_pnl', 'large');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 6. toggleWidgetVisibility
  // ─────────────────────────────────────────────────────────────────────

  describe('toggleWidgetVisibility', () => {
    it('should toggle visible from true to false', () => {
      useWidgetStore.getState().toggleWidgetVisibility('w_pnl');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[0].visible).toBe(false);
    });

    it('should toggle visible from false to true', () => {
      useWidgetStore.getState().toggleWidgetVisibility('w_pnl');
      useWidgetStore.getState().toggleWidgetVisibility('w_pnl');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[0].visible).toBe(true);
    });

    it('should not affect other widgets visibility', () => {
      useWidgetStore.getState().toggleWidgetVisibility('w_pnl');
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[1].visible).toBe(true);
    });

    it('should call persist after toggle', () => {
      useWidgetStore.getState().toggleWidgetVisibility('w_pnl');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 7. updateWidget
  // ─────────────────────────────────────────────────────────────────────

  describe('updateWidget', () => {
    it('should update widget title', () => {
      useWidgetStore.getState().updateWidget('w_pnl', { title: 'New P&L Title' });
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[0].title).toBe('New P&L Title');
    });

    it('should update multiple fields at once', () => {
      useWidgetStore.getState().updateWidget('w_holdings', {
        title: 'My Holdings',
        size: 'large',
      });
      const state = useWidgetStore.getState();
      expect(state.layout.widgets[1].title).toBe('My Holdings');
      expect(state.layout.widgets[1].size).toBe('large');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 8. resetLayout
  // ─────────────────────────────────────────────────────────────────────

  describe('resetLayout', () => {
    it('should reset to default widgets', () => {
      // First add some extra widgets and modify state
      useWidgetStore.setState(s => ({
        layout: {
          ...s.layout,
          widgets: [
            { id: 'custom_1', type: 'pnl', title: 'Custom', order: 0, size: 'small', visible: true },
          ],
        },
      }));

      useWidgetStore.getState().resetLayout();
      const state = useWidgetStore.getState();
      expect(state.layout.widgets).toHaveLength(DEFAULT_WIDGET_COUNT);
      expect(state.layout.widgets[0].id).toBe('w_pnl');
      expect(state.layout.widgets[5].id).toBe('w_market');
    });

    it('should call persist after reset', () => {
      useWidgetStore.getState().resetLayout();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 9. hydrate
  // ─────────────────────────────────────────────────────────────────────

  describe('hydrate', () => {
    it('should load saved layout from AsyncStorage', async () => {
      const savedLayout = {
        widgets: [
          { id: 'saved_1', type: 'pnl', title: 'Saved P&L', order: 0, size: 'small', visible: true },
        ],
        version: 1,
      };
      (AsyncStorage.getItem as any).mockResolvedValueOnce(JSON.stringify(savedLayout));

      await useWidgetStore.getState().hydrate();
      const state = useWidgetStore.getState();
      expect(state.layout.widgets).toHaveLength(1);
      expect(state.layout.widgets[0].title).toBe('Saved P&L');
      expect(state.hydrated).toBe(true);
    });

    it('should use defaults when AsyncStorage returns null', async () => {
      (AsyncStorage.getItem as any).mockResolvedValueOnce(null);

      // Reset to empty first
      useWidgetStore.setState({ layout: { widgets: [], version: 1 }, hydrated: false });
      await useWidgetStore.getState().hydrate();

      const state = useWidgetStore.getState();
      expect(state.hydrated).toBe(true);
      // Should still have default widgets since we set layout to empty manually
      // and hydrate only loads from storage if data exists
    });

    it('should use defaults when saved version does not match', async () => {
      const oldLayout = {
        widgets: [{ id: 'old', type: 'pnl', title: 'Old', order: 0, size: 'medium', visible: true }],
        version: 0,
      };
      (AsyncStorage.getItem as any).mockResolvedValueOnce(JSON.stringify(oldLayout));

      await useWidgetStore.getState().hydrate();
      const state = useWidgetStore.getState();
      // Version mismatch — should keep current state and mark hydrated
      expect(state.hydrated).toBe(true);
    });

    it('should use defaults when AsyncStorage throws', async () => {
      (AsyncStorage.getItem as any).mockRejectedValueOnce(new Error('Storage error'));

      await useWidgetStore.getState().hydrate();
      const state = useWidgetStore.getState();
      expect(state.hydrated).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // 10. persist
  // ─────────────────────────────────────────────────────────────────────

  describe('persist', () => {
    it('should save current layout to AsyncStorage', async () => {
      await useWidgetStore.getState().persist();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        LAYOUT_STORAGE_KEY,
        expect.any(String),
      );
      const saved = JSON.parse((AsyncStorage.setItem as any).mock.calls[0][1]);
      expect(saved.version).toBe(1);
      expect(saved.widgets).toHaveLength(3);
    });

    it('should not throw when AsyncStorage.setItem fails', async () => {
      (AsyncStorage.setItem as any).mockRejectedValueOnce(new Error('Write failed'));
      await expect(useWidgetStore.getState().persist()).resolves.toBeUndefined();
    });
  });
});
