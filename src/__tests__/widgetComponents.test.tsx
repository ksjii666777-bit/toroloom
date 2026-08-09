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
import { render, fireEvent } from './testUtils';

// ==================== Mock Navigation ====================

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: vi.fn() }),
}));

// Ticker Provider — spy on selectSymbol (HoldingsWidget pre-selects the
// instrument on STOP/TARGET chip taps, same as every other trade surface).
const { mockSelectSymbol, mockHoldingsData } = vi.hoisted(() => ({
  mockSelectSymbol: vi.fn(),
  // Shared with the portfolioStore mock factory below (avoids hoisting TDZ).
  mockHoldingsData: {
    holdings: [
      { id: 'h1', symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 10, currentValue: 295000, currentPrice: 2950, totalInvested: 250000, pnl: 45000, pnlPercent: 18.0, dayChange: 1200, dayChangePercent: 0.41, buyPrice: 2500, stockId: 'rel' },
      { id: 'h2', symbol: 'TCS', name: 'Tata Consultancy', quantity: 5, currentValue: 210000, currentPrice: 4200, totalInvested: 200000, pnl: 10000, pnlPercent: 5.0, dayChange: -500, dayChangePercent: -0.24, buyPrice: 4000, stockId: 'tcs' },
      { id: 'h3', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 15, currentValue: 262500, currentPrice: 1750, totalInvested: 240000, pnl: 22500, pnlPercent: 9.4, dayChange: 750, dayChangePercent: 0.29, buyPrice: 1600, stockId: 'hdfc' },
    ],
    trades: [
      { id: 't1', symbol: 'RELIANCE', type: 'buy', quantity: 10, price: 2500, total: 25000, timestamp: '2025-07-15T09:30:00.000Z', name: 'Reliance', stockId: 'rel' },
      { id: 't2', symbol: 'TCS', type: 'sell', quantity: 2, price: 4150, total: 8300, timestamp: '2025-07-14T14:00:00.000Z', name: 'TCS', stockId: 'tcs' },
    ],
  },
}));

vi.mock('../services/tickerProvider', () => ({
  tickerProvider: {
    selectSymbol: (...args: unknown[]) => mockSelectSymbol(...args),
  },
  useTicker: () => null,
  useExecutionPrice: () => null,
}));

// snapTradeApi is imported by PositionLevelsOverlay — stub it (direct-position
// mode means getTickerLevels is never called for the Indian flow).
vi.mock('../services/api', () => ({
  snapTradeApi: {
    getTickerLevels: vi.fn(),
  },
}));

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

// ==================== Edge-case analytics fixtures ====================
// (used by the coverage-closing tests below)

// 6 sectors (first > 50%) — exercises donut large-arc, the 3/5/6
// display-count branches, the more-items row, and the large detail row.
const mockManySectorsAnalytics = {
  getAnalytics: () => ({
    ...mockPositiveAnalytics.getAnalytics(),
    sectorAllocation: [
      { sector: 'Finance', value: 550000, percent: 55.0, count: 2 },
      { sector: 'Energy', value: 200000, percent: 20.0, count: 2 },
      { sector: 'IT', value: 100000, percent: 10.0, count: 1 },
      { sector: 'Pharma', value: 70000, percent: 7.0, count: 1 },
      { sector: 'Auto', value: 50000, percent: 5.0, count: 1 },
      { sector: 'Metals', value: 30000, percent: 3.0, count: 1 },
    ],
  }),
};

// All-zero percents — exercises the `reduce(...) || 100` total fallback.
const mockZeroPercentSectorsAnalytics = {
  getAnalytics: () => ({
    ...mockPositiveAnalytics.getAnalytics(),
    sectorAllocation: [
      { sector: 'Finance', value: 0, percent: 0, count: 0 },
    ],
  }),
};

// Negative P&L — exercises the red sign branches in PnLWidget.
const mockNegativePnLAnalytics = {
  getAnalytics: () => ({
    ...mockPositiveAnalytics.getAnalytics(),
    metrics: {
      ...mockPositiveAnalytics.getAnalytics().metrics,
      totalReturn: -425000,
      totalReturnPercent: -18.7,
      dayChange: -12500,
      dayChangePercent: -0.45,
    },
  }),
};

// Flat sparkline history — exercises the `range = max - min || 1` guard.
const mockFlatPnLAnalytics = {
  getAnalytics: () => ({
    ...mockPositiveAnalytics.getAnalytics(),
    pnlHistory: [
      { date: '2025-01-15', value: 100, cumulativePnl: 100 },
      { date: '2025-02-15', value: 100, cumulativePnl: 100 },
    ],
  }),
};

// pnlHistory absent — exercises the `!pnlHistory` early-return guard.
// (: any keeps the spread's pnlHistory array type from rejecting `undefined`.)
const mockUndefinedHistoryAnalytics = {
  getAnalytics: (): any => ({
    ...mockPositiveAnalytics.getAnalytics(),
    pnlHistory: undefined,
  }),
};

// History with drawdowns — lets RiskMetricsWidget compute a real Sortino.
const mockDipHistoryAnalytics = {
  getAnalytics: () => ({
    ...mockPositiveAnalytics.getAnalytics(),
    pnlHistory: [
      { date: '2025-01-15', value: 623500, cumulativePnl: 0 },
      { date: '2025-02-15', value: 630000, cumulativePnl: 6500 },
      { date: '2025-03-15', value: 615000, cumulativePnl: -8500 },
      { date: '2025-04-15', value: 640000, cumulativePnl: 16500 },
      { date: '2025-05-15', value: 655000, cumulativePnl: 31500 },
      { date: '2025-06-15', value: 648000, cumulativePnl: 24500 },
      { date: '2025-07-15', value: 670000, cumulativePnl: 46500 },
    ],
  }),
};

// Mid-range winRate (between ok 45 and good 60) — exercises the yellow
// '#FFC107' branch of getRiskColor.
const mockYellowWinRateAnalytics = {
  getAnalytics: () => ({
    ...mockPositiveAnalytics.getAnalytics(),
    metrics: {
      ...mockPositiveAnalytics.getAnalytics().metrics,
      winRate: 50,
    },
  }),
};

// ==================== Mock stores ====================

let mockAnalytics = mockPositiveAnalytics;
vi.mock('../store/portfolioAnalyticsStore', () => ({
  usePortfolioAnalyticsStore: vi.fn((selector: any) => selector(mockAnalytics)),
}));

// portfolioStore is called WITHOUT a selector in HoldingsWidget and RecentTradesWidget.
// Data comes from the vi.hoisted mockHoldingsData above (avoids TDZ).
vi.mock('../store/portfolioStore', () => {
  return {
    usePortfolioStore: vi.fn((selector?: any) =>
      selector ? selector(mockHoldingsData) : mockHoldingsData
    ),
  };
});

// Mutable per-test market store state (MarketOverviewWidget reads indices).
// Loose typing so per-test index shapes (missing shortName/icon, etc.) are legal.
let mockMarketData: { indices: any[]; stocks: any[] } = {
  indices: [
    { id: 'nifty', name: 'NIFTY 50', shortName: 'NIFTY', currentValue: 24861.15, change: 187.45, changePercent: 0.76, isPositive: true, icon: 'trending-up' },
    { id: 'sensex', name: 'SENSEX', shortName: 'SENSEX', currentValue: 81234.50, change: 456.20, changePercent: 0.56, isPositive: true, icon: 'trending-up' },
  ],
  stocks: [],
};
vi.mock('../store/marketStore', () => ({
  useMarketStore: vi.fn((selector?: any) =>
    selector ? selector(mockMarketData) : mockMarketData
  ),
}));

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
import { usePortfolioStore } from '../store/portfolioStore';

// ── Style probing helper ─────────────────────────────────────────────────
// Returns the `color` found in the Text host node's style array for the
// given exact text, or null. (The RN mock keeps style arrays on the host.)
function findTextColor(root: any, text: string): string | null {
  const node = root.findAll((n: any) =>
    String(n.type) === 'Text' && n.props?.children === text
  )[0];
  if (!node) return null;
  const style = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
  const colorStyle = style.find((s: any) => s && typeof s === 'object' && 'color' in s);
  return colorStyle?.color ?? null;
}

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

  it('renders negative P&L values in red (small)', () => {
    mockAnalytics = mockNegativePnLAnalytics;
    const { root } = render(<PnLWidget size="small" />);
    // totalReturnPercent -18.7 → '-18.70%' with the negative color
    expect(findTextColor(root, '-18.70%')).toBe('#FF5252');
  });

  it('renders negative P&L values in red (medium)', () => {
    mockAnalytics = mockNegativePnLAnalytics;
    const { root } = render(<PnLWidget size="medium" />);
    expect(findTextColor(root, '-18.70%')).toBe('#FF5252');
    // day change percent -0.45 → '-0.45%' also red
    expect(findTextColor(root, '-0.45%')).toBe('#FF5252');
  });

  it('handles a flat sparkline history (zero range guard)', () => {
    mockAnalytics = mockFlatPnLAnalytics;
    const { getByText } = render(<PnLWidget size="medium" />);
    expect(getByText('Total Return')).toBeDefined();
  });

  it('handles missing pnlHistory (early return)', () => {
    mockAnalytics = mockUndefinedHistoryAnalytics;
    const { getByText } = render(<PnLWidget size="medium" />);
    expect(getByText('Total Return')).toBeDefined();
  });

  it('renders without a sparkline for single-point history', () => {
    mockAnalytics = {
      getAnalytics: () => ({
        ...mockPositiveAnalytics.getAnalytics(),
        pnlHistory: [{ date: '2025-01-15', value: 100, cumulativePnl: 0 }],
      }),
    };
    const { getByText } = render(<PnLWidget size="medium" />);
    expect(getByText('Total Return')).toBeDefined();
  });
});

// ==================== HoldingsWidget Tests ====================

describe('HoldingsWidget', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockSelectSymbol.mockClear();
  });

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

  // ── Live position tag (direct position, INR) ──────────────────────

  it('renders the LIVE position tag with AVG BUY in INR on each row', () => {
    const { getByText } = render(<HoldingsWidget size="medium" />);
    // Overlay labels come from the real en locale (trading.* namespace).
    expect(getByText('LIVE')).toBeDefined();
    expect(getByText('AVG BUY')).toBeDefined();
    expect(getByText('STOP')).toBeDefined();
    expect(getByText('TARGET')).toBeDefined();
  });

  it('formats the AVG BUY price in INR from buyPrice', () => {
    const { getByText } = render(<HoldingsWidget size="medium" />);
    // RELIANCE buyPrice 2500 → AVG BUY chip ₹2,500.00
    expect(getByText('₹2,500.00')).toBeDefined();
  });

  it('navigates to PlaceOrder with SL pre-fill when STOP is tapped', () => {
    // Single holding so the STOP/TARGET chip presses are unambiguous.
    const originalImpl = vi.mocked(usePortfolioStore).getMockImplementation();
    vi.mocked(usePortfolioStore).mockImplementation(() => ({
      holdings: [mockHoldingsData.holdings[0]],
      trades: [],
    }));
    try {
      const { getByText } = render(<HoldingsWidget size="medium" />);
      fireEvent.press(getByText('STOP'));
      // RELIANCE buyPrice 2500 × (1 − 5%) = 2375 → SL order with that trigger.
      expect(mockNavigate).toHaveBeenCalledWith('PlaceOrder', {
        stockId: 'rel',
        symbol: 'RELIANCE',
        tradeType: 'sell',
        prefillOrderType: 'SL',
        prefillTrigger: '2375',
      });
    } finally {
      if (originalImpl) vi.mocked(usePortfolioStore).mockImplementation(originalImpl as any);
    }
  });

  it('navigates to PlaceOrder with LIMIT pre-fill when TARGET is tapped', () => {
    const originalImpl = vi.mocked(usePortfolioStore).getMockImplementation();
    vi.mocked(usePortfolioStore).mockImplementation(() => ({
      holdings: [mockHoldingsData.holdings[0]],
      trades: [],
    }));
    try {
      const { getByText } = render(<HoldingsWidget size="medium" />);
      fireEvent.press(getByText('TARGET'));
      // RELIANCE buyPrice 2500 × (1 + 10%) = 2750 → LIMIT order with that price.
      expect(mockNavigate).toHaveBeenCalledWith('PlaceOrder', {
        stockId: 'rel',
        symbol: 'RELIANCE',
        tradeType: 'sell',
        prefillOrderType: 'LIMIT',
        prefillLimit: '2750',
      });
    } finally {
      if (originalImpl) vi.mocked(usePortfolioStore).mockImplementation(originalImpl as any);
    }
  });

  it('pre-selects the holding in the ticker provider when STOP is tapped', () => {
    const originalImpl = vi.mocked(usePortfolioStore).getMockImplementation();
    vi.mocked(usePortfolioStore).mockImplementation(() => ({
      holdings: [mockHoldingsData.holdings[0]],
      trades: [],
    }));
    try {
      const { getByText } = render(<HoldingsWidget size="medium" />);
      fireEvent.press(getByText('STOP'));
      expect(mockSelectSymbol).toHaveBeenCalledWith({
        symbol: 'RELIANCE',
        exchange: 'NSE',
        name: 'Reliance Industries',
        price: 2950,
      });
    } finally {
      if (originalImpl) vi.mocked(usePortfolioStore).mockImplementation(originalImpl as any);
    }
  });

  it('does not navigate before any chip tap', () => {
    render(<HoldingsWidget size="medium" />);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSelectSymbol).not.toHaveBeenCalled();
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

  it('renders compact metric values when positive in small size', () => {
    mockAnalytics = mockPositiveAnalytics;
    const { getByText } = render(<RiskMetricsWidget size="small" />);
    expect(getByText('1.85')).toBeDefined(); // sharpeRatio > 0 → toFixed(2)
    expect(getByText('+68.50%')).toBeDefined();
  });

  it('shows N/A placeholders for zero metrics in medium size', () => {
    mockAnalytics = mockZeroAnalytics;
    const { getAllByText } = render(<RiskMetricsWidget size="medium" />);
    // sharpe + sortino both fall back to N/A; bar values collapse to 0
    expect(getAllByText('N/A').length).toBeGreaterThanOrEqual(2);
  });

  it('shows N/A placeholders for zero metrics in large size', () => {
    mockAnalytics = mockZeroAnalytics;
    const { getAllByText } = render(<RiskMetricsWidget size="large" />);
    // sharpe, sortino, profitFactor all fall back to N/A
    expect(getAllByText('N/A').length).toBeGreaterThanOrEqual(3);
  });

  it('renders the yellow (ok) risk color for mid-range values', () => {
    mockAnalytics = mockYellowWinRateAnalytics;
    const { root } = render(<RiskMetricsWidget size="medium" />);
    // winRate 50 (45 ≤ 50 < 60) → '#FFC107'
    expect(findTextColor(root, '+50.00%')).toBe('#FFC107');
  });

  it('computes a positive Sortino when history has drawdowns', () => {
    mockAnalytics = mockDipHistoryAnalytics;
    const { queryByText } = render(<RiskMetricsWidget size="medium" />);
    // sortinoRatio > 0 → value shown, no N/A anywhere
    expect(queryByText('N/A')).toBeNull();
  });

  it('renders N/A for Sortino when every daily return is non-positive', () => {
    mockAnalytics = {
      getAnalytics: () => ({
        ...mockPositiveAnalytics.getAnalytics(),
        pnlHistory: [
          { date: '2025-01-15', value: 100, cumulativePnl: -700000 },
          { date: '2025-02-15', value: 100, cumulativePnl: -700000 },
          { date: '2025-03-15', value: 100, cumulativePnl: -700000 },
          { date: '2025-04-15', value: 100, cumulativePnl: -700000 },
          { date: '2025-05-15', value: 100, cumulativePnl: -700000 },
          { date: '2025-06-15', value: 100, cumulativePnl: -700000 },
        ],
      }),
    };
    const { getByText } = render(<RiskMetricsWidget size="medium" />);
    // All prevVal ≤ 0 → dailyReturns empty → avgReturn falls back to 0 → N/A
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

  it('renders the compact small layout with a more-items row', () => {
    mockAnalytics = mockManySectorsAnalytics;
    const { getByText, queryByText } = render(<SectorAllocationWidget size="small" />);
    expect(getByText('Finance')).toBeDefined();
    expect(getByText('IT')).toBeDefined(); // 3rd shown (displayCount 3)
    expect(queryByText('Pharma')).toBeNull(); // hidden past displayCount
    expect(getByText('+3 more')).toBeDefined(); // 6 - 3
  });

  it('renders the medium layout with a more-items row for >5 sectors', () => {
    mockAnalytics = mockManySectorsAnalytics;
    const { getByText, queryByText } = render(<SectorAllocationWidget size="medium" />);
    expect(getByText('Auto')).toBeDefined(); // 5th shown (displayCount 5)
    expect(getByText('+1 more')).toBeDefined(); // 6 - 5
    expect(queryByText('Metals')).toBeNull();
  });

  it('renders the large layout with the detail row and every sector', () => {
    mockAnalytics = mockManySectorsAnalytics;
    const { getByText, queryByText } = render(<SectorAllocationWidget size="large" />);
    expect(getByText('Metals')).toBeDefined(); // all 6 shown (displayCount = length)
    expect(getByText('Total invested across')).toBeDefined();
    expect(getByText('6 sectors')).toBeDefined();
    expect(queryByText('+1 more')).toBeNull(); // length > displayCount is false
  });

  it('handles zero-percent sectors (total falls back to 100)', () => {
    mockAnalytics = mockZeroPercentSectorsAnalytics;
    const { getByText } = render(<SectorAllocationWidget size="medium" />);
    expect(getByText('Finance')).toBeDefined();
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
  beforeEach(() => {
    mockMarketData = {
      indices: [
        { id: 'nifty', name: 'NIFTY 50', shortName: 'NIFTY', currentValue: 24861.15, change: 187.45, changePercent: 0.76, isPositive: true, icon: 'trending-up' },
        { id: 'sensex', name: 'SENSEX', shortName: 'SENSEX', currentValue: 81234.50, change: 456.20, changePercent: 0.56, isPositive: true, icon: 'trending-up' },
      ],
      stocks: [],
    };
  });

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

  it('falls back to DEFAULT_INDICES when the store has no indices', () => {
    mockMarketData = { indices: [], stocks: [] };
    const { getByText, getAllByText } = render(<MarketOverviewWidget size="medium" />);
    expect(getByText('BANK NIFTY')).toBeDefined();
    expect(getByText('NIFTY MIDCAP')).toBeDefined();
    // DEFAULT_INDICES carry string `value` (no currentValue) → em-dash fallback
    expect(getAllByText('—').length).toBeGreaterThan(0);
    // Negative index renders the minus-signed change text
    expect(getByText('-124.30 (-0.24%)')).toBeDefined();
  });

  it('renders a negative index row with the down caret and red text', () => {
    mockMarketData = {
      indices: [
        { id: 'banknifty', name: 'BANK NIFTY', currentValue: 52345, change: -124.30, changePercent: -0.24, isPositive: false },
      ],
      stocks: [],
    };
    const { getByText } = render(<MarketOverviewWidget size="medium" />);
    expect(getByText('-124.30 (-0.24%)')).toBeDefined();
  });

  it('uses the change sign when isPositive is falsy but change is positive', () => {
    mockMarketData = {
      indices: [
        { id: 'x', name: 'X', currentValue: 100, change: 5, changePercent: 1, isPositive: false },
      ],
      stocks: [],
    };
    const { getByText } = render(<MarketOverviewWidget size="medium" />);
    // isPositive || change >= 0 → false || true → '+' prefix
    expect(getByText('+5.00 (+1.00%)')).toBeDefined();
  });

  it('defaults to a positive trend when isPositive is missing', () => {
    mockMarketData = {
      indices: [
        { id: 'x', shortName: 'XSHORT', currentValue: 100, change: -5, changePercent: -1 },
      ],
      stocks: [],
    };
    const { getByText } = render(<MarketOverviewWidget size="medium" />);
    // name || shortName fallback
    expect(getByText('XSHORT')).toBeDefined();
    // change < 0 → minus-signed; isPositive ?? true covers the MiniChart color
    expect(getByText('-5.00 (-1.00%)')).toBeDefined();
  });
});
