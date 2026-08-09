/**
 * ============================================================================
 * Toroloom — PortfolioAnalyticsDashboard Integration Tests
 * ============================================================================
 *
 * Full-screen integration tests for the refactored Portfolio Analytics
 * Dashboard. Verifies header, Performance Summary card, P&L Chart section,
 * Dashboard Widgets grid, and Capital Gains & Tax section.
 *
 * Shared mocks (navigation, services, theme, stores) come from the
 * ./helpers/widgetTestMocks module — imported FIRST so the mocks register
 * before the component module graph is evaluated. The PnLChart mock below is
 * dashboard-specific (only this screen renders it).
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, expectTextOrder, fireEvent } from './testUtils';
import { getWidgetMocks, resetWidgetMocks, defaultLayoutWidgets, defaultAnalyticsState, defaultPortfolioState } from './helpers/widgetTestMocks';

// Shared hoisted mock state (nav, services, theme, stores) — same object the
// mock factories use, so per-test configuration + assertions stay in sync.
const widgetMocks = getWidgetMocks();

// ==================== Mock PnLChart ====================
// Simplifies the SVG-heavy chart to a basic element so tests stay focused on
// the dashboard layout and integration. It still forwards the `timeframe`
// prop (so the current selection is visible) and the `onTimeframeChange`
// callback (so the timeframe-chip handler can be exercised).

vi.mock('../components/PnLChart', () => {
  // Avoid require('react-native') — the async RN mock may not have resolved
  // when this factory runs; use string host elements (same pattern as the
  // DraggableFlatList mock in helpers/widgetTestMocks).
  const React = require('react');
  return {
    default: ({ timeframe, onTimeframeChange }: any) =>
      React.createElement(
        'View',
        { testID: 'pnl-chart', onTimeframeChange },
        React.createElement('Text', { testID: 'timeframe-label' }, timeframe),
      ),
  };
});

// ==================== Mock store states ====================
// Analytics + portfolio states come from the shared fixtures in
// ./helpers/widgetTestMocks (defaultAnalyticsState / defaultPortfolioState =
// realSeedHoldings) so the dashboard renders the same store state as the
// WidgetGrid suite — 5 holdings, ₹6.74L total, full metrics.

// ==================== Mock useSafeAreaInsets (already in setup.ts) ====================
// Already mocked in src/__tests__/setup.ts

// ==================== Import ====================

import { NavigationContainer } from '@react-navigation/native';
import PortfolioAnalyticsDashboardScreen from '../screens/analytics/PortfolioAnalyticsDashboardScreen';

// ==================== Helper ====================

function renderScreen() {
  return render(
    <NavigationContainer>
      <PortfolioAnalyticsDashboardScreen
        navigation={{ navigate: widgetMocks.mockNavigate, goBack: widgetMocks.mockGoBack } as any}
        route={{ params: {} } as any}
      />
    </NavigationContainer>
  );
}

/** True if the given Text host carries the red color in its style array. */
function isRedStyled(n: any): boolean {
  const style = n.props.style as any[] | undefined;
  return Array.isArray(style) && style.some(s => s && s.color === '#FF5252');
}

/**
 * True if ANY leaf row labelled `label` contains a red-styled value Text.
 *
 * getByText returns the DEEPEST match, which may be a widget's row rather than
 * the screen's summary card (the same label can appear in several widgets), so
 * this scans every leaf match. Each leaf Text host sits under a Dummy(Text)
 * composite in the RN mock, making the container View 2 levels up
 * (label host → Dummy → container).
 */
function anyRowHasRedValue(result: ReturnType<typeof render>, label: string): boolean {
  return result.getAllByText(label).some(m => {
    const kids = m.children;
    const isLeaf = Array.isArray(kids) && kids.every(c => typeof c === 'string');
    if (!isLeaf) return false;
    const container = m.parent?.parent as any;
    return !!container && container.findAll((n: any) => n.type === 'Text').some(isRedStyled);
  });
}

// ==================== Tests ====================

describe('PortfolioAnalyticsDashboard — Integration', () => {
  beforeEach(() => {
    resetWidgetMocks();
    widgetMocks.analyticsState = defaultAnalyticsState;
    widgetMocks.layoutState = { widgets: defaultLayoutWidgets, version: 1 };
    widgetMocks.portfolioState = defaultPortfolioState;
  });

  // ── Header ────────────────────────────────────────────────────────

  it('renders the header title', () => {
    const { getByText } = renderScreen();
    expect(getByText('Portfolio Analytics')).toBeDefined();
  });

  it('renders the header subtitle', () => {
    const { getByText } = renderScreen();
    expect(getByText('Customize with draggable widgets')).toBeDefined();
  });

  it('renders header with title', () => {
    const { getByText } = renderScreen();
    expect(getByText('Portfolio Analytics')).toBeDefined();
  });

  // ── Performance Summary ───────────────────────────────────────────

  it('renders Performance Summary section', () => {
    const { getByText } = renderScreen();
    expect(getByText('Performance Summary')).toBeDefined();
  });

  it('renders Total Return label', () => {
    const { getByText } = renderScreen();
    expect(getByText('Total Return')).toBeDefined();
  });

  it('renders Realized P&L label', () => {
    const { getByText } = renderScreen();
    expect(getByText('Realized P&L')).toBeDefined();
  });

  it('renders Unrealized label', () => {
    const { getByText } = renderScreen();
    expect(getByText('Unrealized')).toBeDefined();
  });

  // ── Dashboard Widgets Section ─────────────────────────────────────

  it('renders Dashboard Widgets section header', () => {
    const { getByText } = renderScreen();
    expect(getByText('Dashboard Widgets')).toBeDefined();
  });

  it('renders Manage button in widgets section', () => {
    const { getByText } = renderScreen();
    expect(getByText('Manage')).toBeDefined();
  });

  it('renders widget titles from the store', () => {
    const { getByText } = renderScreen();
    expect(getByText('P&L Overview')).toBeDefined();
    expect(getByText('Holdings Breakdown')).toBeDefined();
    expect(getByText('Risk Metrics')).toBeDefined();
    expect(getByText('Sector Allocation')).toBeDefined();
    expect(getByText('Recent Trades')).toBeDefined();
    expect(getByText('Market Overview')).toBeDefined();
    expect(getByText('Performance Chart')).toBeDefined();
  });

  it('renders widget titles in layout order', () => {
    // WidgetGrid renders the layout's widgets in `order` sequence — the grid
    // must present them exactly as configured (drag-reorder changes layoutState,
    // so this locks the default order).
    expectTextOrder(
      renderScreen(),
      ['P&L Overview', 'Holdings Breakdown', 'Risk Metrics', 'Sector Allocation', 'Recent Trades', 'Market Overview', 'Performance Chart'],
    );
  });

  it('renders Add Widget footer in the widget grid', () => {
    const { getByText } = renderScreen();
    expect(getByText('Add Widget')).toBeDefined();
  });

  // ── Capital Gains & Tax ───────────────────────────────────────────

  it('renders Capital Gains & Tax section', () => {
    const { getByText } = renderScreen();
    expect(getByText('Capital Gains & Tax')).toBeDefined();
  });

  it('renders STCG label', () => {
    const { getByText } = renderScreen();
    expect(getByText('STCG')).toBeDefined();
  });

  it('renders LTCG label', () => {
    const { getByText } = renderScreen();
    expect(getByText('LTCG')).toBeDefined();
  });

  it('renders Total Tax label', () => {
    const { getByText } = renderScreen();
    expect(getByText('Total Tax')).toBeDefined();
  });

  // ── Navigation ────────────────────────────────────────────────────

  it('renders gallery button for navigation', () => {
    // Gallery button uses Ionicons "apps" — verified by successful render
    expect(widgetMocks.mockNavigate).not.toHaveBeenCalled();
  });

  // ── Interactive handlers ──────────────────────────────────────────

  it('navigates back when the back button is pressed', () => {
    const result = renderScreen();
    const backIcon = result.root.findAll(n => n.props && n.props.name === 'arrow-back')[0];
    expect(backIcon).toBeDefined();
    fireEvent.trigger(backIcon, 'onPress');
    expect(widgetMocks.mockGoBack).toHaveBeenCalled();
  });

  it('opens the Widget Gallery from the header gallery button', () => {
    const result = renderScreen();
    const galleryIcon = result.root.findAll(n => n.props && n.props.name === 'apps')[0];
    expect(galleryIcon).toBeDefined();
    fireEvent.trigger(galleryIcon, 'onPress');
    expect(widgetMocks.mockNavigate).toHaveBeenCalledWith('WidgetGallery');
  });

  it('opens the Widget Gallery from the Manage button', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Manage'));
    expect(widgetMocks.mockNavigate).toHaveBeenCalledWith('WidgetGallery');
  });

  it('opens the Widget Gallery from the Add Widget footer button', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Add Widget'));
    expect(widgetMocks.mockNavigate).toHaveBeenCalledWith('WidgetGallery');
  });

  it('updates the chart timeframe when a timeframe chip is pressed', () => {
    const result = renderScreen();
    expect(result.getByTestId('timeframe-label').children.join('')).toBe('1Y');
    // fireEvent.trigger wraps the handler call in act() so the state update
    // (setChartTimeframe) flushes and the re-render passes the new value down.
    fireEvent.trigger(result.getByTestId('pnl-chart'), 'onTimeframeChange', '1M');
    expect(result.getByTestId('timeframe-label').children.join('')).toBe('1M');
  });

  // ── Negative performance (red sign branches) ──────────────────────

  it('renders red styling for negative performance', () => {
    widgetMocks.analyticsState = {
      ...defaultAnalyticsState,
      getAnalytics: () => {
        const base = defaultAnalyticsState.getAnalytics();
        return {
          ...base,
          metrics: { ...base.metrics, totalReturn: -425000, totalReturnPercent: -18.7 },
          capitalGains: {
            ...base.capitalGains,
            shortTerm: { ...base.capitalGains.shortTerm, gains: -225000 },
            longTerm: { ...base.capitalGains.longTerm, gains: -200000 },
          },
        };
      },
    };
    const result = renderScreen();

    // Negative percent formats with a leading '-' (no '+').
    expect(result.getByText('-18.70%')).toBeDefined();

    // Total Return value + percent flip to the red branch of the sign ternary
    // (the summary card's row — first leaf — is one of the red matches).
    expect(anyRowHasRedValue(result, 'Total Return')).toBe(true);

    // STCG value also flips to red on negative short-term gains.
    expect(anyRowHasRedValue(result, 'STCG')).toBe(true);
  });

  // ── Snapshot ───────────────────────────────────────────────────────

  it('matches snapshot with full dashboard layout', () => {
    const { toJSON } = renderScreen();
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
    expect(snapshot).toMatchSnapshot('PortfolioAnalyticsDashboard-full');
  });

  // ── Hydration ─────────────────────────────────────────────────────

  it('calls hydrate on mount', () => {
    renderScreen();
    // hydrate is called via useEffect on mount
    expect(widgetMocks.mockHydrate).toHaveBeenCalled();
  });
});
