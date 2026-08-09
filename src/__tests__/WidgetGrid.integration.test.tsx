/**
 * ============================================================================
 * Toroloom — WidgetGrid Integration Tests
 * ============================================================================
 *
 * Tests the WidgetGrid component integrated with a mocked widget store and
 * DraggableFlatList. Verifies empty state, populated render, and the
 * "Add Widget" footer/CTA actions.
 *
 * Shared mocks (navigation, services, theme, stores) come from the
 * ./helpers/widgetTestMocks module — imported FIRST so the mocks register
 * before the component module graph is evaluated.
 *
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, expectTextOrder } from './testUtils';
import { getWidgetMocks, resetWidgetMocks, defaultLayoutWidgets, defaultAnalyticsState, defaultPortfolioState } from './helpers/widgetTestMocks';

// Shared hoisted mock state (nav, services, theme, stores) — same object the
// mock factories use, so per-test configuration + assertions stay in sync.
const widgetMocks = getWidgetMocks();

// ==================== Fixtures ====================
// portfolioStore + portfolioAnalyticsStore data come from the shared
// defaults in ./helpers/widgetTestMocks (defaultPortfolioState =
// realSeedHoldings; defaultAnalyticsState = full metrics/gains/history) so
// both widget suites render identical store state.

// widgetStore layout fixtures. The 3-widget subset is derived from the shared
// defaultLayoutWidgets (P&L, Holdings, Performance Chart — the same types the
// grid test always rendered) so titles/types stay in lockstep with the
// dashboard suite without duplicating the widget definitions.
const defaultWidgets = defaultLayoutWidgets.filter((w) =>
  ['pnl', 'holdings', 'performance_chart'].includes(w.type)
);

const emptyLayout = { widgets: [], version: 1 };

// ==================== Import ====================

import WidgetGrid, { DraggableWidgetRow } from '../components/widgets/WidgetGrid';

// ==================== Tests ====================

describe('WidgetGrid — Integration', () => {
  const onAddWidget = vi.fn();

  beforeEach(() => {
    resetWidgetMocks();
    // Fresh copy each test — the reorder mock now splices the layout, so a
    // shared fixture would be permanently mutated by drag tests.
    widgetMocks.layoutState = { widgets: [...defaultWidgets], version: 1 };
    widgetMocks.analyticsState = defaultAnalyticsState;
    widgetMocks.portfolioState = defaultPortfolioState;
    onAddWidget.mockClear();

    // Wire the store's reorder action to actually move the widget in the
    // layout (mirrors the real store's splice-based reorder). This makes the
    // grid reflect drags, so tests can assert the rendered order CHANGES — not
    // just that reorderWidgets was called.
    widgetMocks.mockReorderWidgets.mockImplementation((from: number, to: number) => {
      const widgets = widgetMocks.layoutState.widgets as any[];
      if (from !== to && from >= 0 && from < widgets.length && to < widgets.length) {
        const [moved] = widgets.splice(from, 1);
        widgets.splice(to, 0, moved);
      }
    });
  });

  // ── Empty State ──────────────────────────────────────────────────

  it('renders empty state when no visible widgets', () => {
    widgetMocks.layoutState = emptyLayout;
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(getByText('No Widgets Yet')).toBeDefined();
    expect(getByText('Browse Widgets')).toBeDefined();
  });

  it('calls onAddWidget when empty state CTA is pressed', () => {
    widgetMocks.layoutState = emptyLayout;
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    const cta = getByText('Browse Widgets');
    fireEvent.press(cta);
    expect(onAddWidget).toHaveBeenCalledTimes(1);
  });

  it('applies pressed opacity styling on the empty-state CTA', () => {
    widgetMocks.layoutState = emptyLayout;
    const { root } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    // The RN test mock never invokes Pressable style functions, so the
    // inline ({ pressed }) => [...] callbacks would otherwise never run.
    const cta = root.findAll(n => String(n.type) === 'Pressable' && typeof n.props.style === 'function')[0];
    expect(cta).toBeDefined();
    expect(cta.props.style({ pressed: true })[1].opacity).toBe(0.8);
    expect(cta.props.style({ pressed: false })[1].opacity).toBe(1);
  });

  // ── Populated State ───────────────────────────────────────────────

  it('renders widget titles from store layout', () => {
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(getByText('P&L Overview')).toBeDefined();
    expect(getByText('Holdings Breakdown')).toBeDefined();
  });

  it('renders all visible widgets', () => {
    widgetMocks.layoutState = { widgets: [...defaultWidgets, { id: 'w3', type: 'risk_metrics', title: 'Risk Metrics', order: 2, size: 'medium', visible: true }], version: 1 };
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(getByText('P&L Overview')).toBeDefined();
    expect(getByText('Holdings Breakdown')).toBeDefined();
    expect(getByText('Risk Metrics')).toBeDefined();
  });

  it('skips hidden widgets', () => {
    widgetMocks.layoutState = {
      widgets: [
        { id: 'w1', type: 'pnl', title: 'Visible Widget', order: 0, size: 'medium', visible: true },
        { id: 'w2', type: 'holdings', title: 'Hidden Widget', order: 1, size: 'medium', visible: false },
      ],
      version: 1,
    };
    const { queryByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(queryByText('Visible Widget')).not.toBeNull();
    expect(queryByText('Hidden Widget')).toBeNull();
  });

  // ── Footer / Add Widget Button ────────────────────────────────────

  it('renders Add Widget footer button when widgets exist', () => {
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(getByText('Add Widget')).toBeDefined();
  });

  it('calls onAddWidget when footer Add Widget button is pressed', () => {
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    const btn = getByText('Add Widget');
    fireEvent.press(btn);
    expect(onAddWidget).toHaveBeenCalledTimes(1);
  });

  it('applies pressed opacity styling on the footer Add Widget button', () => {
    const { root } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    // Only the footer's Pressable uses a function style — every BaseWidget
    // Pressable uses a plain style array.
    const footer = root.findAll(n => String(n.type) === 'Pressable' && typeof n.props.style === 'function')[0];
    expect(footer).toBeDefined();
    expect(footer.props.style({ pressed: true })[1].opacity).toBe(0.7);
    expect(footer.props.style({ pressed: false })[1].opacity).toBe(1);
  });

  // ── Snapshot ───────────────────────────────────────────────────────

  it('matches snapshot with populated widget grid', () => {
    const { toJSON } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    const snapshot = JSON.stringify(toJSON(), (key, value) => {
      // Replace non-serializable reanimated animation entries
      if (key === 'entering' || key === 'exiting' || key === 'layout') {
        return '[Animation]';
      }
      // Replace SVG path data and geometry that varies across runs
      if (key === 'd' || key === 'points') {
        return '[Path]';
      }
      return value;
    }, 2);
    expect(snapshot).toMatchSnapshot('WidgetGrid-populated');
  });

  // ── Drag Reorder (Store Integration) ──────────────────────────────

  it('renders nothing for a hidden widget row (defensive visible guard)', () => {
    // The grid pre-filters visibleWidgets, so this guard is unreachable via
    // WidgetGrid's public API — render the exported row directly to cover it.
    const { toJSON } = render(
      <DraggableWidgetRow
        item={{ id: 'w_hidden', type: 'pnl', title: 'Hidden', order: 0, size: 'medium', visible: false } as any}
        drag={vi.fn() as any}
        isActive={false}
        getIndex={() => 0}
      />
    );
    expect(toJSON()).toBeNull();
  });

  it('extracts keys by widget id via keyExtractor', () => {
    const { root } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    // The DraggableFlatList mock renders items but never calls keyExtractor —
    // invoke it directly to exercise the callback.
    const list = root.findAll(n => n.props && typeof n.props.keyExtractor === 'function')[0];
    expect(list).toBeDefined();
    expect(list.props.keyExtractor({ id: 'w_pnl' } as any)).toBe('w_pnl');
  });

  it('passes onDragEnd handler to DraggableFlatList', () => {
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(getByText('P&L Overview')).toBeDefined();
    expect(widgetMocks.mockOnDragEnd.current).toBeTypeOf('function');
  });

  it('calls reorderWidgets when a widget is dragged to a different position', () => {
    render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(widgetMocks.mockReorderWidgets).not.toHaveBeenCalled();
    act(() => {
      widgetMocks.mockOnDragEnd.current?.({ from: 0, to: 1 });
    });
    expect(widgetMocks.mockReorderWidgets).toHaveBeenCalledTimes(1);
    expect(widgetMocks.mockReorderWidgets).toHaveBeenCalledWith(0, 1);
  });

  it('does not call reorderWidgets when a drag ends at the same position', () => {
    render(<WidgetGrid onAddWidget={onAddWidget} />);
    act(() => {
      widgetMocks.mockOnDragEnd.current?.({ from: 1, to: 1 });
    });
    expect(widgetMocks.mockReorderWidgets).not.toHaveBeenCalled();
  });

  it('renders active-row styling while a widget is being dragged', () => {
    // Simulate the dragged row: real DraggableFlatList passes isActive=true to
    // the row currently being dragged (mockActiveItem controls which).
    widgetMocks.mockActiveItem = 'w_pnl';
    const { root } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    // RTR can reach a pass-through wrapper's (ScaleDecorator) output via two
    // paths, so the same row may match twice — ≥1 is the correct assertion.
    const activeRows = root.findAll((n: any) => {
      const style = n.props?.style;
      return Array.isArray(style) && style.some((s: any) => s && s.borderColor === '#3B82F660');
    });
    expect(activeRows.length).toBeGreaterThanOrEqual(1);
    const style = activeRows[0].props.style as any[];
    expect(style[1].shadowOpacity).toBe(0.3);
    expect(style[1].elevation).toBe(8);
  });

  it('does not apply active-row styling when nothing is being dragged', () => {
    const { root } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    const activeRows = root.findAll((n: any) => {
      const style = n.props?.style;
      return Array.isArray(style) && style.some((s: any) => s && s.borderColor === '#3B82F660');
    });
    expect(activeRows.length).toBe(0);
  });

  it('changes the grid order when a widget is dragged', () => {
    const result = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expectTextOrder(result, ['P&L Overview', 'Holdings Breakdown', 'Performance Chart']);

    // Drag P&L Overview (index 0) to position 1.
    act(() => {
      widgetMocks.mockOnDragEnd.current?.({ from: 0, to: 1 });
    });
    expect(widgetMocks.mockReorderWidgets).toHaveBeenCalledWith(0, 1);

    // Re-render so WidgetGrid picks up the mutated layout — the store mock
    // returns the same layout object reference, so a fresh render reads the
    // reordered array.
    act(() => {
      result.update(<WidgetGrid onAddWidget={onAddWidget} />);
    });
    expectTextOrder(result, ['Holdings Breakdown', 'P&L Overview', 'Performance Chart']);
  });
});
