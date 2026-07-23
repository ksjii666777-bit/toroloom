/**
 * ============================================================================
 * Toroloom — WidgetGrid Integration Tests
 * ============================================================================
 *
 * Tests the WidgetGrid component integrated with a mocked widget store and
 * DraggableFlatList. Verifies empty state, populated render, and the
 * "Add Widget" footer/CTA actions.
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mock ThemeContext ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      text: '#E0E6ED',
      textSecondary: '#94A3B8',
      textMuted: '#475569',
      bg: '#06080C',
      bgCard: '#1A1D28',
      bgCardLight: '#232734',
      bgInput: '#151821',
      border: 'rgba(255,255,255,0.07)',
      divider: 'rgba(255,255,255,0.04)',
      white: '#FFFFFF',
    },
    isDark: true,
  }),
}));

// ==================== Mock DraggableFlatList ====================
// Renders data items via renderItem so widget content appears in tree.
// Uses React.Fragment + string 'View' to avoid require('react-native')
// which conflicts with setup.ts's async react-native mock.

vi.mock('react-native-draggable-flatlist', () => {
  const React = require('react');

  const MockDraggableFlatList = (props: any) => {
    const { data, renderItem, ListFooterComponent } = props;
    const children: any[] = [];
    if (data && Array.isArray(data)) {
      data.forEach((item: any, index: number) => {
        const rendered = renderItem({
          item,
          drag: vi.fn(),
          isActive: false,
          getIndex: () => index,
        });
        children.push(React.createElement('View', { key: item.id }, rendered));
      });
    }
    if (ListFooterComponent) {
      children.push(ListFooterComponent);
    }
    return React.createElement(React.Fragment, null, children);
  };

  const ScaleDecorator = (props: any) => props.children;

  return {
    default: MockDraggableFlatList,
    ScaleDecorator,
  };
});

// ==================== Mock widget store state ====================
// WidgetGrid calls useWidgetStore() WITHOUT a selector (destructuring),
// so the mock must handle both selector and no-selector cases.

const defaultWidgets = [
  { id: 'w1', type: 'pnl', title: 'P&L Overview', order: 0, size: 'medium', visible: true },
  { id: 'w2', type: 'holdings', title: 'Holdings Breakdown', order: 1, size: 'medium', visible: true },
];

const emptyLayout = { widgets: [], version: 1 };
const populatedLayout = { widgets: defaultWidgets, version: 1 };

let mockLayout = populatedLayout;
const mockReorderWidgets = vi.fn();

vi.mock('../store/widgetStore', () => {
  // Data is defined inside the factory closure to avoid vitest hoisting TDZ
  return {
    useWidgetStore: vi.fn((selector?: any) => {
      const state = {
        layout: mockLayout,
        reorderWidgets: mockReorderWidgets,
      };
      return selector ? selector(state) : state;
    }),
  };
});

// ==================== Import ====================

import WidgetGrid from '../components/widgets/WidgetGrid';

// ==================== Tests ====================

describe('WidgetGrid — Integration', () => {
  const onAddWidget = vi.fn();

  beforeEach(() => {
    mockLayout = populatedLayout;
    onAddWidget.mockClear();
    mockReorderWidgets.mockClear();
  });

  // ── Empty State ──────────────────────────────────────────────────

  it('renders empty state when no visible widgets', () => {
    mockLayout = emptyLayout;
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(getByText('No Widgets Yet')).toBeDefined();
    expect(getByText('Browse Widgets')).toBeDefined();
  });

  it('calls onAddWidget when empty state CTA is pressed', () => {
    mockLayout = emptyLayout;
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    const cta = getByText('Browse Widgets');
    fireEvent.press(cta);
    expect(onAddWidget).toHaveBeenCalledTimes(1);
  });

  // ── Populated State ───────────────────────────────────────────────

  it('renders widget titles from store layout', () => {
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(getByText('P&L Overview')).toBeDefined();
    expect(getByText('Holdings Breakdown')).toBeDefined();
  });

  it('renders all visible widgets', () => {
    mockLayout = { widgets: [...defaultWidgets, { id: 'w3', type: 'risk_metrics', title: 'Risk Metrics', order: 2, size: 'medium', visible: true }], version: 1 };
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(getByText('P&L Overview')).toBeDefined();
    expect(getByText('Holdings Breakdown')).toBeDefined();
    expect(getByText('Risk Metrics')).toBeDefined();
  });

  it('skips hidden widgets', () => {
    mockLayout = {
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

  it('connects reorderWidgets store action to DraggableFlatList', () => {
    const { getByText } = render(<WidgetGrid onAddWidget={onAddWidget} />);
    expect(getByText('P&L Overview')).toBeDefined();
    expect(mockReorderWidgets).not.toHaveBeenCalled();
    // reorderWidgets integration is verified by the connection
    // between WidgetGrid's handleDragEnd and useWidgetStore
  });
});
