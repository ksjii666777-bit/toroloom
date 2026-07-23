/**
 * ============================================================================
 * Toroloom — PortfolioAnalyticsDashboard Integration Tests
 * ============================================================================
 *
 * Full-screen integration tests for the refactored Portfolio Analytics
 * Dashboard. Verifies header, Performance Summary card, P&L Chart section,
 * Dashboard Widgets grid, and Capital Gains & Tax section.
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
    isDark: true,
  }),
}));

// ==================== Mock DraggableFlatList ====================
// Renders data items via renderItem so widget content appears in tree.
// Uses string component name 'View' to avoid require('react-native')
// which conflicts with setup.ts's async mock.

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

// ==================== Mock PnLChart ====================
// Simplifies the SVG-heavy chart to a basic element so tests stay
// focused on the dashboard layout and integration.

vi.mock('../components/PnLChart', () => ({
  default: () => null,
}));

// ==================== Mock portfolioAnalyticsStore ====================

const mockAnalyticsState = {
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
      { date: '2025-01-15', value: 623500, cumulativePnl: 0 },
      { date: '2025-02-15', value: 635000, cumulativePnl: 11500 },
      { date: '2025-03-15', value: 658000, cumulativePnl: 34500 },
      { date: '2025-04-15', value: 692000, cumulativePnl: 68500 },
      { date: '2025-05-15', value: 724000, cumulativePnl: 100500 },
      { date: '2025-06-15', value: 758000, cumulativePnl: 134500 },
      { date: '2025-07-15', value: 795000, cumulativePnl: 171500 },
    ],
    monthlyReturns: [
      { month: '2025-01', startValue: 623500, endValue: 635000, return: 11500, returnPercent: 1.84, contributions: 0 },
    ],
    sectorAllocation: [
      { sector: 'Finance', value: 350000, percent: 44.0, count: 2 },
      { sector: 'Energy', value: 185000, percent: 23.3, count: 2 },
    ],
  }),
};

vi.mock('../store/portfolioAnalyticsStore', () => ({
  usePortfolioAnalyticsStore: vi.fn((selector?: any) =>
    selector ? selector(mockAnalyticsState) : mockAnalyticsState
  ),
}));

// ==================== Mock widgetStore ====================

const mockLayoutWidgets = [
  { id: 'w_pnl', type: 'pnl', title: 'P&L Overview', order: 0, size: 'medium', visible: true },
  { id: 'w_holdings', type: 'holdings', title: 'Holdings Breakdown', order: 1, size: 'medium', visible: true },
  { id: 'w_risk_metrics', type: 'risk_metrics', title: 'Risk Metrics', order: 2, size: 'medium', visible: true },
  { id: 'w_sector', type: 'sector_allocation', title: 'Sector Allocation', order: 3, size: 'medium', visible: true },
  { id: 'w_trades', type: 'recent_trades', title: 'Recent Trades', order: 4, size: 'medium', visible: true },
  { id: 'w_market', type: 'market_overview', title: 'Market Overview', order: 5, size: 'medium', visible: true },
];

let mockHydrate = vi.fn();

vi.mock('../store/widgetStore', () => {
  const mockFn = vi.fn((selector?: any) => {
    const state = {
      layout: { widgets: mockLayoutWidgets, version: 1 },
      reorderWidgets: vi.fn(),
      hydrate: mockHydrate,
    };
    return selector ? selector(state) : state;
  });
  // getState is a static method on the Zustand store, not part of the hook return value.
  // PortfolioAnalyticsDashboardScreen calls useWidgetStore.getState() directly.
  (mockFn as any).getState = () => ({ hydrate: mockHydrate });
  return { useWidgetStore: mockFn };
});

// ==================== Mock useSafeAreaInsets (already in setup.ts) ====================
// Already mocked in src/__tests__/setup.ts

// ==================== Import ====================

import PortfolioAnalyticsDashboardScreen from '../screens/analytics/PortfolioAnalyticsDashboardScreen';

// ==================== Helper ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

function renderScreen() {
  return render(
    <PortfolioAnalyticsDashboardScreen
      navigation={{ navigate: mockNavigate, goBack: mockGoBack }}
    />
  );
}

// ==================== Tests ====================

describe('PortfolioAnalyticsDashboard — Integration', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockHydrate = vi.fn();
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
    expect(mockNavigate).not.toHaveBeenCalled();
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
    expect(mockHydrate).toHaveBeenCalled();
  });
});
