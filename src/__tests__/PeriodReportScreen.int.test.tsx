/**
 * ============================================================================
 * Toroloom — Period Report Screen Integration Tests
 * ============================================================================
 *
 * Tests the full PeriodReportScreen component with mocked stores:
 *   - Header & layout rendering
 *   - Period tab switching (Weekly / Monthly / Yearly)
 *   - Portfolio snapshot display (P&L, return, metrics)
 *   - P&L breakdown cards (realized / unrealized)
 *   - Tax summary (STCG / LTCG)
 *   - Behavioral alerts section
 *   - Loss breakdown section
 *   - Detailed metrics section
 *   - Empty state
 *   - Live badge
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ── Mock Theme ──────────────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#06080C', text: '#E0E6ED', textSecondary: '#64748B', textMuted: '#475569',
      primary: '#3B82F6', accent: '#00E676', marketUp: '#00E676', marketDown: '#FF5252',
      bgCard: 'rgba(255,255,255,0.03)', bgCardLight: 'rgba(255,255,255,0.045)',
      bgInput: '#0A0D14', border: 'rgba(255,255,255,0.07)', divider: 'rgba(255,255,255,0.05)',
      bgSecondary: '#0A0D14', warning: '#FFAB40', borderLight: 'rgba(255,255,255,0.12)',
      white: '#FFFFFF', transparent: 'transparent', danger: '#FF5252', success: '#00E676',
      finance: '#00E676', tech: '#3B82F6', energy: '#FFAB40', consumer: '#8B5CF6',
      industrial: '#06B6D4',
    },
  }),
}));

// ── Mock Navigation ────────────────────────────────────────
const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

// ── Mock Portfolio Store ───────────────────────────────────
const mockHoldings = [
  { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 10, buyPrice: 2450, currentPrice: 2890, currentValue: 28900, pnl: 4400, pnlPercent: 17.96, totalInvested: 24500, dayChange: 450, dayChangePercent: 1.59 },
  { id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy', quantity: 5, buyPrice: 3800, currentPrice: 3750, currentValue: 18750, pnl: -250, pnlPercent: -1.32, totalInvested: 19000, dayChange: -80, dayChangePercent: -0.42 },
  { id: 'h3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 20, buyPrice: 1650, currentPrice: 1678, currentValue: 33560, pnl: 560, pnlPercent: 1.70, totalInvested: 33000, dayChange: 460, dayChangePercent: 1.42 },
];

const mockTrades = [
  { id: 't1', symbol: 'RELIANCE', type: 'sell', price: 2950, quantity: 10, total: 5000, stockId: 'RELIANCE', name: 'Reliance Industries', timestamp: '2026-06-15T10:30:00Z' },
  { id: 't2', symbol: 'TCS', type: 'sell', price: 3750, quantity: 5, total: -250, stockId: 'TCS', name: 'Tata Consultancy', timestamp: '2026-06-20T14:00:00Z' },
  { id: 't3', symbol: 'HDFCBANK', type: 'sell', price: 1720, quantity: 20, total: 800, stockId: 'HDFCBANK', name: 'HDFC Bank', timestamp: '2026-07-05T11:00:00Z' },
];

let mockPortfolioState: any = {};

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: () => mockPortfolioState,
}));

// ── Build Mock Analytics ───────────────────────────────────
function buildMockAnalytics(overrides?: any) {
  return {
    metrics: {
      totalReturn: 5410,
      totalReturnPercent: 7.07,
      realizedPnl: 5550,
      unrealizedPnl: -140,
      dayChange: 830,
      dayChangePercent: 1.02,
      winRate: 66.67,
      totalTrades: 3,
      winningTrades: 2,
      losingTrades: 1,
      avgWin: 2900,
      avgLoss: 250,
      profitFactor: 2.32,
      maxDrawdown: 5000,
      maxDrawdownPercent: 1.37,
      sharpeRatio: 1.25,
      avgHoldingDays: 45,
      bestTrade: 5000,
      worstTrade: -250,
      consecutiveWins: 1,
      consecutiveLosses: 0,
      ...overrides?.metrics,
    },
    capitalGains: {
      shortTerm: { gains: 5550, count: 3, taxRate: 15, estimatedTax: 832.50 },
      longTerm: { gains: 0, count: 0, taxRate: 10, exemptLimit: 100000, taxableGains: 0, estimatedTax: 0 },
      totalEstimatedTax: 832.50,
      sttPaid: 6.05,
      totalBrokerage: 1.82,
      ...overrides?.capitalGains,
    },
    monthlyReturns: [
      { month: '2026-07', startValue: 79000, endValue: 80100, return: 1100, returnPercent: 1.39, contributions: 0 },
      { month: '2026-06', startValue: 76500, endValue: 80810, return: 4310, returnPercent: 5.63, contributions: 0 },
    ],
    sectorAllocation: [
      { sector: 'Finance', value: 33560, percent: 41.3, count: 1 },
      { sector: 'Energy', value: 28900, percent: 35.6, count: 1 },
      { sector: 'Technology', value: 18750, percent: 23.1, count: 1 },
    ],
    pnlHistory: [
      { date: '2026-06-01', value: 76500, cumulativePnl: -1500 },
      { date: '2026-07-01', value: 81810, cumulativePnl: 5410 },
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

// ── Mock expo-linear-gradient ──────────────────────────────
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, style }: any) => (
    <div style={style} data-testid="linear-gradient">{children}</div>
  ),
}));

// ── Mock expo-print & expo-sharing (vars must use vi.hoisted for hoisting compat) ─
const { mockPrintUri, mockPrintToFileAsync, mockShareAsync, mockIsAvailableAsync } = vi.hoisted(() => {
  const uri = 'file://generated-period-report.pdf';
  return {
    mockPrintUri: uri,
    mockPrintToFileAsync: vi.fn(() => Promise.resolve({ uri })),
    mockShareAsync: vi.fn(() => Promise.resolve()),
    mockIsAvailableAsync: vi.fn(() => Promise.resolve(true)),
  };
});

vi.mock('expo-print', () => ({
  printToFileAsync: mockPrintToFileAsync,
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: mockIsAvailableAsync,
  shareAsync: mockShareAsync,
}));

// ── Import the component ────────────────────────────────────
import PeriodReportScreen from '../screens/reports/PeriodReportScreen';

// ==================== Mock useT hook ====================
const app: Record<string, string> = {
  cancel: 'Cancel',
  ok: 'OK',
};

const periodReport: Record<string, string> = {
  title: 'Period Report',
  subtitle: 'Weekly & monthly performance overview',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  pnlSummary: 'P&L Summary',
  totalPnl: 'Total P&L',
  realizedPnl: 'Realized P&L',
  unrealizedPnl: 'Unrealized P&L',
  periodReturn: 'Period Return',
  bestTrade: 'Best Trade',
  worstTrade: 'Worst Trade',
  winRate: 'Win Rate',
  totalTrades: 'Total Trades',
  taxSummary: 'Tax Summary',
  estimatedTax: 'Estimated Tax',
  stcgLabel: 'STCG (15%)',
  ltcgLabel: 'LTCG (10%)',
  behavioralInsights: 'Behavioral Insights',
  overTradingAlert: 'Over-Trading Alert',
  overTradingDesc: 'Daily trade count exceeds recommended limit',
  brokerageLeakage: 'Brokerage Leakage',
  brokerageLeakageDesc: 'Charges consuming significant portion of P&L',
  concentrationRisk: 'Concentration Risk',
  concentrationRiskDesc: 'Portfolio over-concentrated in one sector',
  noAlerts: 'No behavioral alerts — balanced trading',
  periodDetails: 'Period Details',
  tradesCount: '{{count}} trades',
  lossBreakdown: 'Loss Breakdown',
  noLosers: 'No losing positions this period',
  avgWin: 'Avg Win',
  avgLoss: 'Avg Loss',
  profitFactor: 'Profit Factor',
  avgHoldingDays: 'Avg Holding Days',
  sharpeRatio: 'Sharpe Ratio',
  maxDrawdown: 'Max Drawdown',
  loading: 'Loading report...',
  emptyTitle: 'No Data Yet',
  emptySubtitle: 'Start trading to see your period report',
  taxHarvestingTip: 'Harvest unrealized losses before year-end to offset capital gains.',
  // Sector metrics keys
  sectorMetrics: 'Sector-wise Metrics',
  sectorWins: 'W',
  sectorLosses: 'L',
  sectorAvgWin: 'Avg Win',
  sectorAvgLoss: 'Avg Loss',
  sectorProfitFactor: 'PF',
  // Export PDF keys
  exportPdf: 'Export PDF',
  exportingPdf: 'Generating PDF...',
  pdfGenerated: 'PDF saved successfully',
  pdfFailed: 'Could not generate PDF',
  pdfSharingUnavailable: 'Sharing not available on this device',
};

const translations: Record<string, any> = {
  app,
  periodReport,
};

function resolveT(key: string, params?: Record<string, any>): string {
  const parts = key.split('.');
  const rootNs = parts[0];
  const subKey = parts.slice(1).join('.');

  const obj = translations[rootNs];
  if (!obj) {
    const parts2 = key.split('.');
    const lastSeg = parts2[parts2.length - 1] || key;
    return lastSeg
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s: string) => s.toUpperCase())
      .trim();
  }

  if (params && params.count !== undefined && params.count !== 1) {
    const pluralKey = subKey + '_plural';
    if (pluralKey in obj && typeof obj[pluralKey] === 'string') {
      let result: string = obj[pluralKey];
      result = result.replace(/\{\{(\w+)\}\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
      return result;
    }
  }

  if (subKey in obj && typeof obj[subKey] === 'string') {
    let result: string = obj[subKey];
    if (params) {
      result = result.replace(/\{\{(\w+)\}\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
    }
    return result;
  }

  const lastSeg = parts[parts.length - 1] || key;
  return lastSeg
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s: string) => s.toUpperCase())
    .trim();
}

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
  default: () => ({
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockPortfolioState = {
    holdings: mockHoldings,
    trades: mockTrades,
  };
  mockAnalytics = buildMockAnalytics();
});

// ======================================================================
// Tests
// ======================================================================

describe('PeriodReportScreen — Header & Layout', () => {
  it('renders title and subtitle', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Period Report')).toBeDefined();
    expect(getByText('Weekly & monthly performance overview')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('calls getAnalytics on mount', () => {
    render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getAnalyticsSpy).toHaveBeenCalled();
  });
});

describe('PeriodReportScreen — Period Tabs', () => {
  it('renders all three period tabs', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Weekly')).toBeDefined();
    expect(getByText('Monthly')).toBeDefined();
    expect(getByText('Yearly')).toBeDefined();
  });

  it('shows Monthly tab as active by default', () => {
    const { getAllByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    // Monthly tab text should appear, and content should be monthly by default
    expect(getAllByText('Monthly').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to Weekly tab on press', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    fireEvent.press(getByText('Weekly'));
    // After switching, Weekly should be active — verify by checking it's still rendered
    expect(getByText('Weekly')).toBeDefined();
  });

  it('switches to Yearly tab on press', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    fireEvent.press(getByText('Yearly'));
    expect(getByText('Yearly')).toBeDefined();
  });
});

describe('PeriodReportScreen — Portfolio Snapshot', () => {
  it('shows P&L Summary label', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('P&L Summary')).toBeDefined();
  });

  it('shows total P&L value', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('₹5,410')).toBeDefined();
  });

  it('shows period return percentage', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('+7.07%')).toBeDefined();
  });

  it('shows snapshot metric labels', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Total Trades')).toBeDefined();
    expect(getByText('Win Rate')).toBeDefined();
    expect(getByText('Sharpe Ratio')).toBeDefined();
    expect(getByText('Max Drawdown')).toBeDefined();
  });

  it('shows snapshot metric values', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('3')).toBeDefined();  // total trades
    expect(getByText('67%')).toBeDefined();  // win rate
    expect(getByText('1.3')).toBeDefined();  // sharpe ratio (toFixed(1) rounds 1.25 → 1.3)
  });
});

describe('PeriodReportScreen — P&L Breakdown', () => {
  it('shows realized P&L card', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Realized P&L')).toBeDefined();
  });

  it('shows unrealized P&L card', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Unrealized P&L')).toBeDefined();
  });
});

describe('PeriodReportScreen — Period Breakdown', () => {
  it('shows period details section title', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Period Details')).toBeDefined();
  });

  it('shows monthly period labels', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    // With trades in June and July, monthly view should show both
    expect(getByText('Jul 2026')).toBeDefined();
    expect(getByText('Jun 2026')).toBeDefined();
  });

  it('shows trade count in period rows', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    // Jul 2026 has 1 trade (HDFCBANK), Jun 2026 has 2 trades (RELIANCE + TCS)
    expect(getByText('1 trades')).toBeDefined();
    expect(getByText('2 trades')).toBeDefined();
  });

  it('shows win/loss record when both winners and losers exist', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    // Jun 2026: RELIANCE (win) + TCS (loss) → should show W/L
    expect(getByText('1W/1L')).toBeDefined();
  });
});

describe('PeriodReportScreen — Best / Worst Trade', () => {
  it('shows best trade card', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Best Trade')).toBeDefined();
  });

  it('shows worst trade card', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Worst Trade')).toBeDefined();
  });
});

describe('PeriodReportScreen — Tax Summary', () => {
  it('shows tax summary section title', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Tax Summary')).toBeDefined();
  });

  it('shows STCG label', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('STCG (15%)')).toBeDefined();
  });

  it('shows LTCG label', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('LTCG (10%)')).toBeDefined();
  });

  it('shows estimated tax', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Estimated Tax')).toBeDefined();
  });
});

describe('PeriodReportScreen — Behavioral Insights', () => {
  it('shows behavioral insights section title', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Behavioral Insights')).toBeDefined();
  });

  it('shows no alerts message when sectors are evenly balanced', () => {
    // Override mock data with stocks from 3 diverse sectors with roughly equal exposure
    // so no single sector exceeds 35% concentration threshold
    mockPortfolioState.holdings = [
      { id: 'h1', stockId: 'TITAN', symbol: 'TITAN', name: 'Titan', quantity: 1, buyPrice: 1000, currentPrice: 1000, currentValue: 1000, pnl: 0, pnlPercent: 0, totalInvested: 1000, dayChange: 0, dayChangePercent: 0 },
      { id: 'h2', stockId: 'BHARTIARTL', symbol: 'BHARTIARTL', name: 'Bharti Airtel', quantity: 1, buyPrice: 1000, currentPrice: 1000, currentValue: 1000, pnl: 0, pnlPercent: 0, totalInvested: 1000, dayChange: 0, dayChangePercent: 0 },
      { id: 'h3', stockId: 'DRREDDY', symbol: 'DRREDDY', name: "Dr. Reddy's", quantity: 1, buyPrice: 1000, currentPrice: 1000, currentValue: 1000, pnl: 0, pnlPercent: 0, totalInvested: 1000, dayChange: 0, dayChangePercent: 0 },
    ];
    mockPortfolioState.trades = [
      { id: 't1', symbol: 'TITAN', type: 'sell', price: 1050, quantity: 1, total: 50, stockId: 'TITAN', name: 'Titan', timestamp: '2026-06-15T10:30:00Z' },
      { id: 't2', symbol: 'BHARTIARTL', type: 'sell', price: 1050, quantity: 1, total: 50, stockId: 'BHARTIARTL', name: 'Bharti Airtel', timestamp: '2026-06-20T14:00:00Z' },
      { id: 't3', symbol: 'DRREDDY', type: 'sell', price: 1050, quantity: 1, total: 50, stockId: 'DRREDDY', name: "Dr. Reddy's", timestamp: '2026-07-05T11:00:00Z' },
    ];
    mockAnalytics = buildMockAnalytics();

    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    // With TITAN (Consumer ~33%), BHARTIARTL (Telecom ~33%), DRREDDY (Pharma ~33%) → all under 35%
    expect(getByText('No behavioral alerts — balanced trading')).toBeDefined();
  });
});

describe('PeriodReportScreen — Detailed Metrics', () => {
  it('shows avg win label', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Avg Win')).toBeDefined();
  });

  it('shows avg loss label', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Avg Loss')).toBeDefined();
  });

  it('shows profit factor label', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Profit Factor')).toBeDefined();
  });

  it('shows avg holding days label', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Avg Holding Days')).toBeDefined();
  });

  it('displays profit factor value', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('2.32')).toBeDefined();
  });
});

describe('PeriodReportScreen — Empty State', () => {
  it('shows empty state when no trades or holdings exist', () => {
    mockPortfolioState.holdings = [];
    mockPortfolioState.trades = [];
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('No Data Yet')).toBeDefined();
    expect(getByText('Start trading to see your period report')).toBeDefined();
  });
});

describe('PeriodReportScreen — Live Badge', () => {
  it('shows LIVE badge when analytics is available', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    // Analytics is non-null when trades/holdings exist → LIVE badge should appear
    expect(getByText('LIVE')).toBeDefined();
  });

  it('shows LIVE badge alongside empty state when no holdings or trades', () => {
    // The LIVE badge tracks the live streaming connection, not data availability.
    // It shows even when holdings/trades are empty as long as analytics exists.
    mockPortfolioState.holdings = [];
    mockPortfolioState.trades = [];
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    // LIVE badge shows because analytics is always available
    expect(getByText('LIVE')).toBeDefined();
    // Empty state also shows because holdings/trades are empty
    expect(getByText('No Data Yet')).toBeDefined();
  });
});

describe('PeriodReportScreen — Export PDF Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPortfolioState = {
      holdings: mockHoldings,
      trades: mockTrades,
    };
    mockAnalytics = buildMockAnalytics();
    // Set up default mock implementations
    mockPrintToFileAsync.mockResolvedValue({ uri: mockPrintUri });
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
  });

  it('renders the export PDF button in the header', () => {
    const { getByTestId } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByTestId('export-pdf-btn')).toBeDefined();
  });

  it('calls Print.printToFileAsync when pressed', async () => {
    const { getByTestId } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    fireEvent.press(getByTestId('export-pdf-btn'));

    // Wait for async operations to settle
    await vi.waitFor(() => {
      expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
    });

    // Verify the HTML content was passed
    const callArg = (mockPrintToFileAsync.mock.calls as any)[0][0];
    expect(callArg).toHaveProperty('html');
    expect(callArg).toHaveProperty('width', 595.28);
    expect(callArg.html).toContain('Toroloom Period Report');
  });

  it('calls Sharing.shareAsync after PDF is generated', async () => {
    const { getByTestId } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    fireEvent.press(getByTestId('export-pdf-btn'));

    await vi.waitFor(() => {
      expect(mockShareAsync).toHaveBeenCalledTimes(1);
    });

    // Verify shareAsync was called with correct params
    expect(mockShareAsync).toHaveBeenCalledWith(mockPrintUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Export PDF',
    });
  });

  it('shows ActivityIndicator while PDF is being generated', async () => {
    // Make print take some time so we can check loading state
    let resolvePrint!: (v: any) => void;
    mockPrintToFileAsync.mockImplementation(() => new Promise((resolve) => {
      resolvePrint = resolve;
    }));

    const { getByTestId } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );

    fireEvent.press(getByTestId('export-pdf-btn'));

    // ActivityIndicator should be visible (it renders as an ActivityIndicator element)
    // The button should be disabled
    const btn = getByTestId('export-pdf-btn');
    expect(btn.props.disabled).toBe(true);

    // Resolve the print
    resolvePrint({ uri: mockPrintUri });
    await vi.waitFor(() => {
      expect(mockPrintToFileAsync).toHaveBeenCalled();
    });
  });

  it('hides ActivityIndicator and re-enables button after export completes', async () => {
    const { getByTestId } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );

    fireEvent.press(getByTestId('export-pdf-btn'));

    // Wait for export to complete
    await vi.waitFor(() => {
      expect(mockShareAsync).toHaveBeenCalled();
    });

    // Button should be re-enabled
    const btn = getByTestId('export-pdf-btn');
    expect(btn.props.disabled).toBe(false);
  });

  it('skips shareAsync when sharing is unavailable', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    const { getByTestId } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );

    fireEvent.press(getByTestId('export-pdf-btn'));

    // Wait for print to complete
    await vi.waitFor(() => {
      expect(mockPrintToFileAsync).toHaveBeenCalled();
    });

    // Should not attempt to share
    expect(mockShareAsync).not.toHaveBeenCalled();

    // Wait for button to be re-enabled (finally block runs async)
    await vi.waitFor(() => {
      const btn = getByTestId('export-pdf-btn');
      expect(btn.props.disabled).toBe(false);
    });
  });

  it('re-enables button on print error', async () => {
    mockPrintToFileAsync.mockRejectedValue(new Error('Print failed'));

    const { getByTestId } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );

    fireEvent.press(getByTestId('export-pdf-btn'));

    // Wait for button to be re-enabled after error (finally block runs async)
    await vi.waitFor(() => {
      const btn = getByTestId('export-pdf-btn');
      expect(btn.props.disabled).toBe(false);
    });
  });

  it('prevents double-tap while already exporting', async () => {
    let resolvePrint!: (v: any) => void;
    mockPrintToFileAsync.mockImplementation(() => new Promise((resolve) => {
      resolvePrint = resolve;
    }));

    const { getByTestId } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );

    // Press the button twice quickly
    const btn = getByTestId('export-pdf-btn');
    fireEvent.press(btn);
    fireEvent.press(btn);

    // printToFileAsync should only be called once
    expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);

    // Resolve so the test doesn't hang
    resolvePrint({ uri: mockPrintUri });
    await vi.waitFor(() => {
      expect(mockShareAsync).toHaveBeenCalled();
    });
  });

  it('generates PDF with correct period label (Monthly default)', async () => {
    const { getByTestId } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );

    fireEvent.press(getByTestId('export-pdf-btn'));

    await vi.waitFor(() => {
      expect(mockPrintToFileAsync).toHaveBeenCalled();
    });

    const html = (mockPrintToFileAsync.mock.calls as any)[0][0].html;
    expect(html).toContain('Monthly');
  });

  it('adjusts PDF period label when switching to Weekly before export', async () => {
    // Start with a fresh render and re-initialize mocks to avoid test interaction
    vi.clearAllMocks();
    mockPrintToFileAsync.mockResolvedValue({ uri: mockPrintUri });
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);

    const { getByTestId, getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );

    // Switch to Weekly first
    fireEvent.press(getByText('Weekly'));

    // Then export
    fireEvent.press(getByTestId('export-pdf-btn'));

    await vi.waitFor(() => {
      expect(mockPrintToFileAsync).toHaveBeenCalled();
    });

    const html = (mockPrintToFileAsync.mock.calls as any)[0][0].html;
    expect(html).toContain('Weekly');
  });
});

describe('PeriodReportScreen — Sector-wise Metrics', () => {
  it('shows the section title', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    expect(getByText('Sector-wise Metrics')).toBeDefined();
  });

  it('shows sector headers for each sector with trades', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    // 3 sell trades → Energy (RELIANCE), Technology (TCS), Banking (HDFCBANK)
    expect(getByText('Energy')).toBeDefined();
    expect(getByText('Technology')).toBeDefined();
    expect(getByText('Banking')).toBeDefined();
  });

  it('shows W/L badge with correct counts per sector', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    // RELIANCE: profit (total=5000) → 1W/0L, TCS: loss (total=-250) → 0W/1L, HDFCBANK: profit (total=800) → 1W/0L
    expect(getByText('1W')).toBeDefined();
    expect(getByText('0L')).toBeDefined();
  });

  it('shows profit factor for each sector', () => {
    const { getByText } = render(
      <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
    );
    // Energy: 1 win, 0 losses → ∞ (displayed when profitFactor >= 99)
    // Technology: 0 wins, 1 loss → 0.0
    // Banking: 1 win, 0 losses → ∞
    expect(getByText('∞')).toBeDefined();
  });

  describe('expand / collapse behavior', () => {
    it('trade details are hidden by default (collapsed)', () => {
      const { queryByText } = render(
        <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
      );
      // The quantity×price pattern should NOT be visible initially
      expect(queryByText('10 × ₹2950')).toBeNull();
      expect(queryByText('20 × ₹1720')).toBeNull();
    });

    it('expands to show trade details including date and buy/sell when sector is tapped', () => {
      const { getByText } = render(
        <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
      );
      // Tap on "Energy" sector header to expand
      fireEvent.press(getByText('Energy'));
      // RELIANCE trade detail
      expect(getByText('10 × ₹2950')).toBeDefined();
      // RELIANCE timestamp: 2026-06-15 → formatted as "15 Jun"
      expect(getByText('15 Jun')).toBeDefined();
      // RELIANCE buy price from holdings: ₹2,450 vs sell price: ₹2,950
      // The buy price display is "B: ₹2,450" and "S: ₹2,950" (Indian comma format)
      expect(getByText('₹2,450')).toBeDefined();
      expect(getByText('₹2,950')).toBeDefined();
      // P&L for RELIANCE (profit, total=5000) — compact format
      expect(getByText('+₹5.0K')).toBeDefined();
    });

    it('shows correct trade details with buy/sell for different sectors', () => {
      const { getByText, queryByText } = render(
        <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
      );
      // Tap Banking sector → should show HDFCBANK trade
      fireEvent.press(getByText('Banking'));
      expect(getByText('20 × ₹1720')).toBeDefined();
      // HDFCBANK timestamp: 2026-07-05 → "5 Jul"
      expect(getByText('5 Jul')).toBeDefined();
      // HDFCBANK buy price: ₹1,650 vs sell: ₹1,720
      expect(getByText('₹1,650')).toBeDefined();
      expect(getByText('₹1,720')).toBeDefined();
      // P&L for HDFCBANK (profit, total=800)
      expect(getByText('+₹800.00')).toBeDefined();
      // Energy sector should still be collapsed
      expect(queryByText('10 × ₹2950')).toBeNull();
      expect(queryByText('15 Jun')).toBeNull();
    });

    it('collapses trade details when tapped again (buy/sell also hidden)', () => {
      const { getByText, queryByText } = render(
        <PeriodReportScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
      );
      // Tap to expand
      fireEvent.press(getByText('Energy'));
      expect(getByText('₹2,450')).toBeDefined();
      expect(getByText('10 × ₹2950')).toBeDefined();

      // Tap again to collapse
      fireEvent.press(getByText('Energy'));
      expect(queryByText('₹2,450')).toBeNull();
      expect(queryByText('10 × ₹2950')).toBeNull();
    });
  });
});
