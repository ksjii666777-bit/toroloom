/**
 * ============================================================================
 * Toroloom — ReportsScreen Tests (Analytics UI)
 * ============================================================================
 *
 * Tests the new analytics-driven ReportsScreen with:
 *   - Portfolio snapshot
 *   - 4 tabs: P&L, Performance, Tax, Holdings
 *   - Each tab renders correct content from analytics data
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ── Mock Theme ──────────────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', marketDown: '#FF1744',
      bgCard: '#1A1A2E', bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44',
      divider: '#2A2A44', bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      white: '#FFFFFF', transparent: 'transparent', danger: '#FF1744', success: '#00C853',
      finance: '#6C63FF', tech: '#00D2FF', energy: '#FFC107', consumer: '#FF6B6B',
      industrial: '#FF9800', gold: '#FFD700', purple: '#9C27B0',
    },
  }),
}));

// ── Mock Navigation ────────────────────────────────────────
const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

// ── Mock Portfolio Store ───────────────────────────────────
const mockHoldings = [
  { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 10, buyPrice: 2450, currentPrice: 2890, currentValue: 28900, pnl: 4400, pnlPercent: 17.96, totalInvested: 24500, dayChange: 450, dayChangePercent: 1.59 },
  { id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy', quantity: 5, buyPrice: 3800, currentPrice: 3890, currentValue: 19450, pnl: 450, pnlPercent: 2.37, totalInvested: 19000, dayChange: -172, dayChangePercent: -0.88 },
  { id: 'h3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 20, buyPrice: 1650, currentPrice: 1678, currentValue: 33560, pnl: 560, pnlPercent: 1.70, totalInvested: 33000, dayChange: 460, dayChangePercent: 1.42 },
];

const mockTrades = [
  { id: 't1', symbol: 'RELIANCE', type: 'buy' as const, price: 2450, quantity: 10, total: 24500, stockId: 'RELIANCE', name: 'Reliance Industries', timestamp: new Date().toISOString() },
  { id: 't2', symbol: 'TCS', type: 'sell' as const, price: 3900, quantity: 2, total: 7800, stockId: 'TCS', name: 'Tata Consultancy', timestamp: new Date(Date.now() - 86400000).toISOString() },
];

let mockPortfolioState: any = {};

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: () => mockPortfolioState,
}));

// ── Mock Auth Store ────────────────────────────────────────
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user1', name: 'TraderJoe' },
  }),
}));

// ── Mock PnLChart Component ────────────────────────────────
vi.mock('../components/PnLChart', () => ({
  default: 'PnLChartMock',
}));

// ── Build Mock Analytics ───────────────────────────────────
function buildMockAnalytics(overrides?: any) {
  return {
    metrics: {
      totalReturn: 26715,
      totalReturnPercent: 7.35,
      realizedPnl: 7800,
      unrealizedPnl: 18915,
      dayChange: 738,
      dayChangePercent: 0.9,
      winRate: 100,
      totalTrades: 3,
      winningTrades: 1,
      losingTrades: 0,
      avgWin: 7800,
      avgLoss: 0,
      profitFactor: 0,
      maxDrawdown: 5000,
      maxDrawdownPercent: 1.37,
      sharpeRatio: 1.25,
      avgHoldingDays: 45,
      bestTrade: 7800,
      worstTrade: 0,
      consecutiveWins: 1,
      consecutiveLosses: 0,
      ...overrides?.metrics,
    },
    capitalGains: {
      shortTerm: { gains: 7800, count: 1, taxRate: 15, estimatedTax: 1170 },
      longTerm: { gains: 0, count: 0, taxRate: 10, exemptLimit: 100000, taxableGains: 0, estimatedTax: 0 },
      totalEstimatedTax: 1170,
      sttPaid: 25.50,
      totalBrokerage: 7.65,
      ...overrides?.capitalGains,
    },
    monthlyReturns: [
      { month: '2025-05', startValue: 300000, endValue: 310000, return: 10000, returnPercent: 3.33, contributions: 50000 },
      { month: '2025-04', startValue: 280000, endValue: 300000, return: 15000, returnPercent: 5.36, contributions: 5000 },
    ],
    sectorAllocation: [
      { sector: 'Finance', value: 33560, percent: 41.0, count: 1 },
      { sector: 'Energy', value: 28900, percent: 35.3, count: 1 },
      { sector: 'Technology', value: 19450, percent: 23.7, count: 1 },
    ],
    pnlHistory: [
      { date: '2025-05-01', value: 80000, cumulativePnl: -1500 },
      { date: '2025-06-01', value: 81865, cumulativePnl: 365 },
    ],
    ...overrides,
  };
}

let mockAnalytics: any = buildMockAnalytics();
const getAnalyticsSpy = vi.fn(() => mockAnalytics);
const mockIsLive = false;
const mockLastUpdated: string | null = null;
const mockPnlHistoryStream: any[] = [];
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('../store/portfolioAnalyticsStore', () => ({
  usePortfolioAnalyticsStore: (selector?: any) => {
    const state = {
      getAnalytics: getAnalyticsSpy,
      isLive: mockIsLive,
      lastUpdated: mockLastUpdated,
      pnlHistoryStream: mockPnlHistoryStream,
      subscribeToLiveUpdates: mockSubscribe,
      unsubscribeFromLiveUpdates: mockUnsubscribe,
    };
    return selector ? selector(state) : state;
  },
}));

// ── Import the component ────────────────────────────────────
import ReportsScreen from '../screens/reports/ReportsScreen';

beforeEach(() => {
  vi.clearAllMocks();
  mockPortfolioState = {
    holdings: mockHoldings,
    trades: mockTrades,
  };
  mockAnalytics = buildMockAnalytics();
});

// ======================================================================
// Tests — Default P&L Tab (no tab switching needed)
// ======================================================================

describe('ReportsScreen — Header & Layout', () => {
  it('renders analytics title and subtitle', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText('Analytics')).toBeDefined();
    expect(getByText('Advanced portfolio intelligence')).toBeDefined();
  });

  it('calls getAnalytics on mount', () => {
    render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getAnalyticsSpy).toHaveBeenCalled();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders all five tab labels', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText('P&L')).toBeDefined();
    expect(getByText('Performance')).toBeDefined();
    expect(getByText('Tax')).toBeDefined();
    expect(getByText('Holdings')).toBeDefined();
    expect(getByText('History')).toBeDefined();
  });
});

describe('ReportsScreen — Portfolio Snapshot', () => {
  it('shows portfolio value', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText('₹81,910')).toBeDefined();
  });

  it('shows total return label and percentage', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText('Total Return')).toBeDefined();
    expect(getByText('7.35%')).toBeDefined();
  });

  it('shows snapshot metric labels', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText('Win Rate')).toBeDefined();
    expect(getByText('Sharpe')).toBeDefined();
    expect(getByText('Max DD')).toBeDefined();
    expect(getByText('Holdings')).toBeDefined();
  });
});

describe('ReportsScreen — P&L Tab Content', () => {
  it('shows P&L Over Time section heading', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText('P&L Over Time')).toBeDefined();
  });

  it('shows realized and unrealized P&L cards', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText('Realized P&L')).toBeDefined();
    expect(getByText('Unrealized P&L')).toBeDefined();
  });

  it('shows today\'s performance card', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText("Today's Performance")).toBeDefined();
    expect(getByText('Day Change')).toBeDefined();
    expect(getByText('Day Return')).toBeDefined();
  });

  it('shows monthly returns section', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText('Monthly Returns')).toBeDefined();
  });

  it('formats monthly return labels', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText('May 2025')).toBeDefined();
    expect(getByText('Apr 2025')).toBeDefined();
  });
});

// ======================================================================
// Tests — Tab Switching (using fireEvent.press with act() wrapper)
// ======================================================================

describe('ReportsScreen — Performance Tab', () => {
  it('shows trade statistics after switching to Performance tab', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    // Use exact match regex to avoid matching "Today's Performance" in the P&L tab
    fireEvent.press(getByText(/^Performance$/));
    expect(getByText('Trade Statistics')).toBeDefined();
  });
});

describe('ReportsScreen — Tax Tab', () => {
  it('shows capital gains summary after switching', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    fireEvent.press(getByText('Tax'));
    expect(getByText('Capital Gains Tax Summary')).toBeDefined();
  });

  it('shows STCG and LTCG sections', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    fireEvent.press(getByText('Tax'));
    expect(getByText('Short-Term')).toBeDefined();
    expect(getByText('Long-Term')).toBeDefined();
  });

  it('shows tax rules information section', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    fireEvent.press(getByText('Tax'));
    expect(getByText('Tax Rules (India FY 2025-26)')).toBeDefined();
  });

  it('shows tax saving tips section', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    fireEvent.press(getByText('Tax'));
    expect(getByText('Tax Saving Tips')).toBeDefined();
    expect(getByText('Tax Harvesting')).toBeDefined();
    expect(getByText('Section 80C — ELSS')).toBeDefined();
  });
});

describe('ReportsScreen — Holdings Tab', () => {
  it('shows sector allocation after switching', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    fireEvent.press(getByText('Holdings'));
    expect(getByText('Sector Allocation')).toBeDefined();
  });

  it('shows sector names', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    fireEvent.press(getByText('Holdings'));
    expect(getByText('Finance')).toBeDefined();
    expect(getByText('Technology')).toBeDefined();
    expect(getByText('Energy')).toBeDefined();
  });

  it('shows holdings list with stock symbols', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    fireEvent.press(getByText('Holdings'));
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined();
  });
});

describe('ReportsScreen — Empty State', () => {
  it('shows empty state in Holdings tab when no holdings exist', () => {
    mockPortfolioState.holdings = [];
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    fireEvent.press(getByText('Holdings'));
    expect(getByText('No Holdings')).toBeDefined();
    expect(getByText('Start investing to see your holdings here')).toBeDefined();
  });
});

// ======================================================================
// Tests — Structure (using shallow toJSON snapshot checks)
// ======================================================================

describe('ReportsScreen — Structure', () => {
  it('renders a complex tree with snapshot, tabs, and tab content', () => {
    const { toJSON } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
    expect(typeof tree).toBe('object');
  });

  it('renders quick summary values section', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
    expect(getByText('Portfolio Value')).toBeDefined();
    expect(getByText('Advanced portfolio intelligence')).toBeDefined();
  });
});
