/**
 * ============================================================================
 * Toroloom — Widget Components Render Tests
 * ============================================================================
 *
 * Verifies that each portfolio analytics widget component renders the correct
 * labels, metrics, and empty states. Tests all size variants (small, medium,
 * large) where applicable.
 *
 * ============================================================================
 */

import React from 'react';
import { Text } from 'react-native';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

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

// ==================== Mock react-native-svg ====================

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Path: 'Path',
  Line: 'Line',
  Rect: 'Rect',
  Circle: 'Circle',
  G: 'G',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
  Text: 'SvgText',
  ClipPath: 'ClipPath',
}));

// ==================== Mock store data ====================

// ==================== Mock Store Data ====================

const mockPositiveAnalytics = {
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

const mockZeroAnalytics = {
  getAnalytics: () => ({
    metrics: {
      sharpeRatio: 0,
      winRate: 0,
      profitFactor: 0,
      avgHoldingDays: 0,
      maxDrawdownPercent: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      dayChange: 0,
      dayChangePercent: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
    },
    capitalGains: {
      shortTerm: { gains: 0, count: 0, taxRate: 15, estimatedTax: 0 },
      longTerm: { gains: 0, count: 0, taxRate: 10, exemptLimit: 100000, taxableGains: 0, estimatedTax: 0 },
      totalEstimatedTax: 0,
      sttPaid: 0,
      totalBrokerage: 0,
    },
    pnlHistory: [],
    monthlyReturns: [],
    sectorAllocation: [],
  }),
};

// ==================== Mock stores ====================

let mockAnalytics = mockPositiveAnalytics;
vi.mock('../store/portfolioAnalyticsStore', () => ({
  usePortfolioAnalyticsStore: vi.fn((selector: any) => selector(mockAnalytics)),
}));

// portfolioStore is called WITHOUT a selector in HoldingsWidget and RecentTradesWidget.
// Data is defined INSIDE the factory closure to avoid vitest hoisting TDZ issues.
vi.mock('../store/portfolioStore', () => {
  const data = {
    holdings: [
      { id: 'h1', symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 10, currentValue: 295000, currentPrice: 2950, totalInvested: 250000, pnl: 45000, pnlPercent: 18.0, dayChange: 1200, dayChangePercent: 0.41, buyPrice: 2500, stockId: 'rel' },
      { id: 'h2', symbol: 'TCS', name: 'Tata Consultancy', quantity: 5, currentValue: 210000, currentPrice: 4200, totalInvested: 200000, pnl: 10000, pnlPercent: 5.0, dayChange: -500, dayChangePercent: -0.24, buyPrice: 4000, stockId: 'tcs' },
      { id: 'h3', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 15, currentValue: 262500, currentPrice: 1750, totalInvested: 240000, pnl: 22500, pnlPercent: 9.4, dayChange: 750, dayChangePercent: 0.29, buyPrice: 1600, stockId: 'hdfc' },
    ],
    trades: [
      { id: 't1', symbol: 'RELIANCE', type: 'buy', quantity: 10, price: 2500, total: 25000, timestamp: '2025-07-15T09:30:00.000Z', name: 'Reliance', stockId: 'rel' },
      { id: 't2', symbol: 'TCS', type: 'sell', quantity: 2, price: 4150, total: 8300, timestamp: '2025-07-14T14:00:00.000Z', name: 'TCS', stockId: 'tcs' },
    ],
  };
  return {
    usePortfolioStore: vi.fn((selector?: any) =>
      selector ? selector(data) : data
    ),
  };
});

vi.mock('../store/marketStore', () => {
  const data = {
    indices: [
      { id: 'nifty', name: 'NIFTY 50', shortName: 'NIFTY', currentValue: 24861.15, change: 187.45, changePercent: 0.76, isPositive: true, icon: 'trending-up' },
      { id: 'sensex', name: 'SENSEX', shortName: 'SENSEX', currentValue: 81234.50, change: 456.20, changePercent: 0.56, isPositive: true, icon: 'trending-up' },
    ],
    stocks: [],
  };
  return {
    useMarketStore: vi.fn((selector?: any) =>
      selector ? selector(data) : data
    ),
  };
});

// Mock the widget store for BaseWidget tests
vi.mock('../store/widgetStore', () => ({
  useWidgetStore: vi.fn((selector: any) => selector({
    removeWidget: vi.fn(),
    resizeWidget: vi.fn(),
    toggleWidgetVisibility: vi.fn(),
  })),
}));

// ==================== Import Widgets ====================

import PnLWidget from '../components/widgets/PnLWidget';
import HoldingsWidget from '../components/widgets/HoldingsWidget';
import RiskMetricsWidget from '../components/widgets/RiskMetricsWidget';
import SectorAllocationWidget from '../components/widgets/SectorAllocationWidget';
import RecentTradesWidget from '../components/widgets/RecentTradesWidget';
import MarketOverviewWidget from '../components/widgets/MarketOverviewWidget';
import BaseWidget from '../components/widgets/BaseWidget';

// ==================== PnLWidget Tests ====================

describe('PnLWidget', () => {
  beforeEach(() => { mockAnalytics = mockPositiveAnalytics; });

  it('renders Total Return label in medium size', () => {
    const { getByText } = render(<PnLWidget size="medium" />);
    expect(getByText('Total Return')).toBeDefined();
  });

  it('renders Day Change label in medium size', () => {
    const { getByText } = render(<PnLWidget size="medium" />);
    expect(getByText('Day Change')).toBeDefined();
  });

  it('renders positive P&L values in medium size', () => {
    const { getByText } = render(<PnLWidget size="medium" />);
    expect(getByText('₹4.25L')).toBeDefined(); // Total Return (compact)
    expect(getByText('₹12.5K')).toBeDefined(); // Day Change (compact)
  });

  it('renders Daily label in small size', () => {
    const { getByText } = render(<PnLWidget size="small" />);
    expect(getByText('Day')).toBeDefined();
  });

  it('renders compact P&L in small size', () => {
    const { getByText } = render(<PnLWidget size="small" />);
    expect(getByText('₹4.25L')).toBeDefined();
  });

  it('renders Realized and Unrealized breakdown in large size', () => {
    const { getByText } = render(<PnLWidget size="large" />);
    expect(getByText('Realized')).toBeDefined();
    expect(getByText('Unrealized')).toBeDefined();
  });
});

// ==================== HoldingsWidget Tests ====================

describe('HoldingsWidget', () => {
  it('renders holding count', () => {
    const { getByText } = render(<HoldingsWidget size="medium" />);
    expect(getByText('3 holdings')).toBeDefined();
  });

  it('renders stock symbols', () => {
    const { getByText } = render(<HoldingsWidget size="medium" />);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined();
  });

  it('renders weight percentages', () => {
    const { getByText } = render(<HoldingsWidget size="medium" />);
    expect(getByText('38.4%')).toBeDefined(); // RELIANCE: 295000/767500
  });

  it('renders top 2 stock symbols in small size (sorted by value)', () => {
    const { getByText } = render(<HoldingsWidget size="small" />);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined(); // HDFCBANK is #2 by value (262.5K > TCS 210K)
    expect(getByText('3 holdings')).toBeDefined();
  });
});

// ==================== RiskMetricsWidget Tests ====================

describe('RiskMetricsWidget', () => {
  beforeEach(() => { mockAnalytics = mockPositiveAnalytics; });

  it('renders Sharpe Ratio in medium size', () => {
    const { getByText } = render(<RiskMetricsWidget size="medium" />);
    expect(getByText('Sharpe Ratio')).toBeDefined();
    expect(getByText('1.85')).toBeDefined();
  });

  it('renders Win Rate in medium size', () => {
    const { getByText } = render(<RiskMetricsWidget size="medium" />);
    expect(getByText('Win Rate')).toBeDefined();
    expect(getByText('+68.50%')).toBeDefined();
  });

  it('renders Max Drawdown in medium size', () => {
    const { getByText } = render(<RiskMetricsWidget size="medium" />);
    expect(getByText('Max Drawdown')).toBeDefined();
  });

  it('renders Profit Factor in large size', () => {
    const { getByText } = render(<RiskMetricsWidget size="large" />);
    expect(getByText('Profit Factor')).toBeDefined();
    expect(getByText('2.45')).toBeDefined();
  });

  it('renders compact metrics in small size with N/A when zero', () => {
    mockAnalytics = mockZeroAnalytics;
    const { getByText } = render(<RiskMetricsWidget size="small" />);
    expect(getByText('Sharpe')).toBeDefined();
    expect(getByText('N/A')).toBeDefined();
  });
});

// ==================== SectorAllocationWidget Tests ====================

describe('SectorAllocationWidget', () => {
  beforeEach(() => { mockAnalytics = mockPositiveAnalytics; });

  it('renders sector names', () => {
    const { getByText } = render(<SectorAllocationWidget size="medium" />);
    expect(getByText('Finance')).toBeDefined();
    expect(getByText('Energy')).toBeDefined();
  });

  it('renders sector percentages', () => {
    const { getByText } = render(<SectorAllocationWidget size="medium" />);
    expect(getByText('44.0%')).toBeDefined();
    expect(getByText('23.3%')).toBeDefined();
  });

  it('shows sector count in donut center', () => {
    const { getByText } = render(<SectorAllocationWidget size="medium" />);
    expect(getByText('2')).toBeDefined();
  });

  it('shows empty state when no sector data', () => {
    mockAnalytics = mockZeroAnalytics;
    const { getByText } = render(<SectorAllocationWidget size="medium" />);
    expect(getByText('No sector data')).toBeDefined();
  });
});

// ==================== RecentTradesWidget Tests ====================

describe('RecentTradesWidget', () => {
  it('renders trade symbols', () => {
    const { getByText } = render(<RecentTradesWidget size="medium" />);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
  });

  it('renders trade quantities and prices', () => {
    const { getByText } = render(<RecentTradesWidget size="medium" />);
    expect(getByText('10 × ₹2500.0')).toBeDefined();
  });

  it('renders buy/sell type badges', () => {
    const { getByText } = render(<RecentTradesWidget size="medium" />);
    expect(getByText('B')).toBeDefined();
    expect(getByText('S')).toBeDefined();
  });
});

// ==================== BaseWidget Tests ====================

describe('BaseWidget', () => {
  it('renders title prop', () => {
    const { getByText } = render(
      <BaseWidget widgetId="bw-1" type="pnl" title="My Widget" size="medium">
        <Text>Child content</Text>
      </BaseWidget>
    );
    expect(getByText('My Widget')).toBeDefined();
  });

  it('renders children content', () => {
    const { getByText } = render(
      <BaseWidget widgetId="bw-2" type="holdings" title="Holdings" size="medium">
        <Text>Child content</Text>
      </BaseWidget>
    );
    expect(getByText('Child content')).toBeDefined();
  });

  it('renders with onLongPress handler prop', () => {
    const onLongPress = vi.fn();
    const { getByText } = render(
      <BaseWidget widgetId="bw-3" type="risk_metrics" title="Risk" size="large" onLongPress={onLongPress}>
        <Text>Content</Text>
      </BaseWidget>
    );
    expect(getByText('Risk')).toBeDefined();
    expect(getByText('Content')).toBeDefined();
  });
});

// ==================== MarketOverviewWidget Tests ====================

describe('MarketOverviewWidget', () => {
  it('renders index names', () => {
    const { getByText } = render(<MarketOverviewWidget size="medium" />);
    expect(getByText('NIFTY 50')).toBeDefined();
    expect(getByText('SENSEX')).toBeDefined();
  });

  it('renders index values', () => {
    const { getByText } = render(<MarketOverviewWidget size="medium" />);
    expect(getByText('24,861.15')).toBeDefined();
    expect(getByText('81,234.5')).toBeDefined(); // .toLocaleString('en-IN') drops trailing zero
  });

  it('renders change percentages', () => {
    const { getByText } = render(<MarketOverviewWidget size="medium" />);
    expect(getByText('+187.45 (+0.76%)')).toBeDefined();
    expect(getByText('+456.20 (+0.56%)')).toBeDefined();
  });

  it('shows only 2 indices in small size', () => {
    const { queryByText } = render(<MarketOverviewWidget size="small" />);
    // Should show NIFTY and SENSEX in small size
    expect(queryByText('NIFTY 50')).not.toBeNull();
    expect(queryByText('SENSEX')).not.toBeNull();
  });
});
