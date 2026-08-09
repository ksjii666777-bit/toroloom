/**
 * ============================================================================
 * Toroloom — Shared Widget Test Mocks
 * ============================================================================
 *
 * Single source of truth for the mocks shared by the widget test suites:
 *   • WidgetGrid.integration.test.tsx
 *   • HoldingsWidget.test.tsx
 *   • PortfolioAnalyticsDashboard.integration.test.tsx
 *
 * Vitest hoisting note: `vi.mock` + `vi.hoisted` calls in THIS module are
 * hoisted by the vitest transform, so importing this module BEFORE the
 * component under test registers every mock before the component module graph
 * is evaluated. The mock factories reference only `vi.hoisted` state, which is
 * what vitest permits. Tests mutate the exported `widgetMocks` state (layout,
 * holdings, analytics) in `beforeEach` to vary per-test behavior, and call
 * `resetWidgetMocks()` to clear the shared vi.fn() instances.
 *
 * ============================================================================
 */

import { vi } from 'vitest';
import type { Holding } from '../../types';

// ===== Shared widget layout fixture =====
// The default dashboard widget layout (full 7-widget set) — single source of
// truth for the widget test suites. The dashboard integration test renders it
// as-is; the WidgetGrid integration test derives its 3-widget subset via
// slice(0, 3). Kept as plain data (not hoisted) so it can be exported.
export const defaultLayoutWidgets = [
  { id: 'w_pnl', type: 'pnl', title: 'P&L Overview', order: 0, size: 'medium', visible: true },
  { id: 'w_holdings', type: 'holdings', title: 'Holdings Breakdown', order: 1, size: 'medium', visible: true },
  { id: 'w_risk_metrics', type: 'risk_metrics', title: 'Risk Metrics', order: 2, size: 'medium', visible: true },
  { id: 'w_sector', type: 'sector_allocation', title: 'Sector Allocation', order: 3, size: 'medium', visible: true },
  { id: 'w_trades', type: 'recent_trades', title: 'Recent Trades', order: 4, size: 'medium', visible: true },
  { id: 'w_market', type: 'market_overview', title: 'Market Overview', order: 5, size: 'medium', visible: true },
  { id: 'w_perf', type: 'performance_chart', title: 'Performance Chart', order: 6, size: 'medium', visible: true },
];

// ===== Real store seed — verbatim from src/constants/mockData.ts =====
// (mockHoldings). Single source of truth shared by the widget suites so the
// dashboard + HoldingsWidget tests render the exact portfolio the app boots
// with. If the app's seed changes, tests asserting these values (₹6.74L total,
// per-symbol weights) break and the seed + expectations must move together.
// Total = 673539 → ₹6.74L; weights sum to 100%.
export const realSeedHoldings: Holding[] = [
  { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', quantity: 50, buyPrice: 2650.0, currentPrice: 2890.5, totalInvested: 132500, currentValue: 144525, pnl: 12025, pnlPercent: 9.08, dayChange: 2260, dayChangePercent: 1.59 },
  { id: 'h2', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', quantity: 100, buyPrice: 1550.0, currentPrice: 1678.9, totalInvested: 155000, currentValue: 167890, pnl: 12890, pnlPercent: 8.32, dayChange: 2345, dayChangePercent: 1.42 },
  { id: 'h3', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', quantity: 20, buyPrice: 3800.0, currentPrice: 3890.0, totalInvested: 76000, currentValue: 77800, pnl: 1800, pnlPercent: 2.37, dayChange: -690, dayChangePercent: -0.88 },
  { id: 'h4', stockId: 'INFY', symbol: 'INFY', name: 'Infosys Ltd.', quantity: 80, buyPrice: 1450.0, currentPrice: 1567.8, totalInvested: 116000, currentValue: 125424, pnl: 9424, pnlPercent: 8.12, dayChange: 2312, dayChangePercent: 1.88 },
  { id: 'h5', stockId: 'SBIN', symbol: 'SBIN', name: 'State Bank of India', quantity: 200, buyPrice: 720.0, currentPrice: 789.5, totalInvested: 144000, currentValue: 157900, pnl: 13900, pnlPercent: 9.65, dayChange: 3160, dayChangePercent: 2.04 },
];

// ===== Shared portfolio state =====
// The dashboard's portfolio (real seed) — used by both the dashboard
// integration test and the WidgetGrid integration test so holdings rendering
// stays in lockstep.
//
// NOTE: this and defaultAnalyticsState are shared BY REFERENCE across suites
// (unlike layoutState, which gets a defensive [...] copy per beforeEach). Tests
// must not mutate them in place — assign a copy to widgetMocks.portfolioState
// / analyticsState to vary per-test behavior.
export const defaultPortfolioState = {
  holdings: realSeedHoldings,
  trades: [],
};

// ===== Shared analytics state =====
// Full analytics fixture (metrics, capital gains, pnl history, monthly
// returns, sector allocation) used by both widget suites. pnlHistory dates are
// in 2026 because PerformanceChartWidget's default range is 1Y (current date
// is Aug 2026) — older dates would be filtered out, leaving an empty chart.
export const defaultAnalyticsState = {
  getAnalytics: () => ({
    metrics: {
      sharpeRatio: 1.85,
      winRate: 68.5,
      profitFactor: 2.45,
      avgHoldingDays: 42,
      maxDrawdownPercent: 8.3,
      totalReturn: 425000,
      totalReturnPercent: 18.7,
      realizedPnl: 185000,
      unrealizedPnl: 240000,
      dayChange: 12500,
      dayChangePercent: 0.45,
      totalTrades: 47,
      winningTrades: 32,
      losingTrades: 15,
      avgWin: 18500,
      avgLoss: 8200,
      bestTrade: 62500,
      worstTrade: -15000,
      consecutiveWins: 8,
      consecutiveLosses: 3,
    },
    capitalGains: {
      shortTerm: { gains: 225000, count: 28, taxRate: 15, estimatedTax: 33750 },
      longTerm: { gains: 200000, count: 4, taxRate: 10, exemptLimit: 100000, taxableGains: 100000, estimatedTax: 10000 },
      totalEstimatedTax: 43750,
      sttPaid: 425,
      totalBrokerage: 128,
    },
    pnlHistory: [
      { date: '2026-01-15', value: 623500, cumulativePnl: 0 },
      { date: '2026-02-15', value: 635000, cumulativePnl: 11500 },
      { date: '2026-03-15', value: 658000, cumulativePnl: 34500 },
      { date: '2026-04-15', value: 692000, cumulativePnl: 68500 },
      { date: '2026-05-15', value: 724000, cumulativePnl: 100500 },
      { date: '2026-06-15', value: 758000, cumulativePnl: 134500 },
      { date: '2026-07-15', value: 795000, cumulativePnl: 171500 },
    ],
    monthlyReturns: [
      { month: '2025-01', startValue: 623500, endValue: 635000, return: 11500, returnPercent: 1.84, contributions: 0 },
    ],
    sectorAllocation: [
      { sector: 'Finance', value: 350000, percent: 44.0, count: 2 },
      { sector: 'Energy', value: 185000, percent: 23.3, count: 2 },
    ],
  }),
  // PerformanceChartWidget reads pnlHistoryStream separately — must be present
  // or `for (const point of undefined)` throws.
  pnlHistoryStream: [],
};

// ── Shared hoisted mock instances + mutable state ───────────────────────────
// Kept INTERNAL (vitest forbids exporting vi.hoisted variables) and exposed
// via getWidgetMocks(). Factories below reference ONLY this object (vitest
// rule: factories can't touch out-of-scope vars).

const widgetMocks = vi.hoisted(() => ({
  // Navigation
  mockNavigate: vi.fn(),
  mockGoBack: vi.fn(),

  // Ticker Provider (orderExit pre-select) + SnapTrade API
  mockSelectSymbol: vi.fn(),

  // Widget store actions
  mockReorderWidgets: vi.fn(),
  mockHydrate: vi.fn(),

  // DraggableFlatList onDragEnd capture (drag-reorder tests)
  mockOnDragEnd: {
    current: undefined as undefined | ((params: { from: number; to: number }) => void),
  },
  // Simulated drag-active item id — the real DraggableFlatList passes
  // isActive=true to the row currently being dragged; this lets tests render
  // a row in the active (dragged) state.
  mockActiveItem: undefined as undefined | string,

  // Theme colors — superset covering every widget's color reads
  themeColors: {
    primary: '#3B82F6',
    marketUp: '#00E676',
    marketDown: '#FF5252',
    warning: '#FFC107',
    text: '#E0E6ED',
    textSecondary: '#94A3B8',
    textMuted: '#475569',
    white: '#FFFFFF',
    bg: '#06080C',
    bgSecondary: '#0E1117',
    bgCard: '#1A1D28',
    bgCardLight: '#232734',
    bgInput: '#151821',
    border: 'rgba(255,255,255,0.07)',
    borderLight: 'rgba(255,255,255,0.04)',
    divider: 'rgba(255,255,255,0.04)',
    transparent: 'transparent',
  },

  // Store state — tests assign these per-test
  portfolioState: { holdings: [] as any[], trades: [] as any[] },
  analyticsState: {} as Record<string, any>,
  layoutState: { widgets: [] as any[], version: 1 } as any,
}));

/**
 * Return the shared hoisted mock state. Test files call this once at module
 * scope (`const widgetMocks = getWidgetMocks()`) so assertions and per-test
 * store-state configuration refer to the exact object the mock factories use.
 */
export function getWidgetMocks() {
  return widgetMocks;
}

/** Clear every shared mock + reset the onDragEnd capture. Call in beforeEach. */
export function resetWidgetMocks() {
  widgetMocks.mockNavigate.mockClear();
  widgetMocks.mockGoBack.mockClear();
  widgetMocks.mockSelectSymbol.mockClear();
  widgetMocks.mockReorderWidgets.mockClear();
  widgetMocks.mockHydrate.mockClear();
  widgetMocks.mockOnDragEnd.current = undefined;
  widgetMocks.mockActiveItem = undefined;
}

// ==================== Mock @react-navigation/native ====================
// Widgets call useNavigation() (STOP/TARGET chips, gallery button). A real
// NavigationContainer would run useDocumentTitle (needs `document`), so the
// container is a passthrough that just renders children.

vi.mock('@react-navigation/native', () => ({
  NavigationContainer: (props: any) => props.children,
  useNavigation: () => ({
    navigate: widgetMocks.mockNavigate,
    goBack: widgetMocks.mockGoBack,
  }),
}));

// ==================== Mock services ====================
// tickerProvider / api — imported through HoldingsWidget's
// PositionLevelsOverlay chain and orderExit; stubbed so widgets render cleanly.

vi.mock('../../services/tickerProvider', () => ({
  tickerProvider: {
    selectSymbol: (...args: unknown[]) => widgetMocks.mockSelectSymbol(...args),
  },
  useTicker: () => null,
  useExecutionPrice: () => null,
}));

vi.mock('../../services/api', () => ({
  snapTradeApi: {
    getTickerLevels: vi.fn(),
  },
}));

// ==================== Mock ThemeContext ====================

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: widgetMocks.themeColors, isDark: true }),
}));

// ==================== Mock DraggableFlatList ====================
// Renders data items via renderItem so widget content appears in tree.
// Uses React.Fragment + string 'View' to avoid require('react-native')
// which conflicts with setup.ts's async react-native mock.

vi.mock('react-native-draggable-flatlist', () => {
  const React = require('react');

  const MockDraggableFlatList = (props: any) => {
    const { data, renderItem, ListFooterComponent, onDragEnd } = props;
    widgetMocks.mockOnDragEnd.current = onDragEnd;
    const children: any[] = [];
    if (data && Array.isArray(data)) {
      data.forEach((item: any, index: number) => {
        const rendered = renderItem({
          item,
          drag: vi.fn(),
          isActive: widgetMocks.mockActiveItem === item.id,
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

// ==================== Mock portfolioStore ====================
// HoldingsWidget reads holdings via usePortfolioStore(). portfolioAnalytics
// store reads usePortfolioStore.getState() when computing analytics, so the
// mock exposes getState too.

vi.mock('../../store/portfolioStore', () => {
  const usePortfolioStore = Object.assign(
    vi.fn((selector?: any) =>
      selector ? selector(widgetMocks.portfolioState) : widgetMocks.portfolioState
    ),
    { getState: vi.fn(() => widgetMocks.portfolioState) },
  );
  return { usePortfolioStore };
});

// ==================== Mock portfolioAnalyticsStore ====================
// PnLWidget / PerformanceChartWidget read metrics + pnlHistory +
// pnlHistoryStream via selectors.

vi.mock('../../store/portfolioAnalyticsStore', () => ({
  usePortfolioAnalyticsStore: vi.fn((selector?: any) =>
    selector ? selector(widgetMocks.analyticsState) : widgetMocks.analyticsState
  ),
}));

// ==================== Mock widgetStore ====================
// WidgetGrid calls useWidgetStore() WITHOUT a selector (destructuring);
// PortfolioAnalyticsDashboardScreen calls useWidgetStore.getState() directly.

vi.mock('../../store/widgetStore', () => {
  const mockFn = vi.fn((selector?: any) => {
    const state = {
      layout: widgetMocks.layoutState,
      reorderWidgets: widgetMocks.mockReorderWidgets,
      hydrate: widgetMocks.mockHydrate,
    };
    return selector ? selector(state) : state;
  });
  (mockFn as any).getState = () => ({ hydrate: widgetMocks.mockHydrate });
  return { useWidgetStore: mockFn };
});
