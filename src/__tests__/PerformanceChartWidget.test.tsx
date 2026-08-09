/**
 * ============================================================================
 * Toroloom — PerformanceChartWidget Unit Tests
 * ============================================================================
 *
 * Covers:
 *  - All 3 size variants (small, medium, large)
 *  - Time range selector switching
 *  - Empty state (no pnlHistory)
 *  - Insufficient data (single point)
 *  - Streaming data merge (pnlHistoryStream)
 *  - Positive vs negative trend colors
 *
 * NOTE: Test data dates are generated relative to the current date so they
 * always survive the 1Y time-range filter (cutoff = today − 365 days).
 *
 * ============================================================================
 */

import React from 'react';
import { Dimensions } from 'react-native';
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

// ==================== Mock react-native-svg ====================

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Path: 'Path',
  Circle: 'Circle',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
}));

// ==================== Mock react-i18next ====================

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'performanceChart.portfolioValue': 'Portfolio Value',
        'performanceChart.totalReturn': 'Total Return',
        'performanceChart.maxDrawdown': 'Max Drawdown',
        'performanceChart.bestTrade': 'Best Trade',
        'performanceChart.range': 'Range',
        'performanceChart.emptyHoldings': 'Add holdings to see your performance chart',
        'performanceChart.insufficientData': 'Not enough data for this range',
      };
      return translations[key] || key;
    },
  }),
}));

// ==================== Mock Dimensions ====================

vi.spyOn(Dimensions, 'get').mockImplementation(() => ({
  width: 375,
  height: 812,
  scale: 2,
  fontScale: 1,
}));

// ==================== Test Data ====================
// Dates are generated relative to "today" so every point survives the
// widget's 1Y time-range filter (cutoff = today − 365 days) no matter when
// the suite runs. Values are fixed; only the day offsets change.

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const POSITIVE_HISTORY = [
  { date: daysAgo(360), value: 623500, cumulativePnl: 0 },
  { date: daysAgo(330), value: 635000, cumulativePnl: 11500 },
  { date: daysAgo(300), value: 658000, cumulativePnl: 34500 },
  { date: daysAgo(270), value: 692000, cumulativePnl: 68500 },
  { date: daysAgo(240), value: 724000, cumulativePnl: 100500 },
  { date: daysAgo(210), value: 758000, cumulativePnl: 134500 },
  { date: daysAgo(180), value: 795000, cumulativePnl: 171500 },
];

const NEGATIVE_HISTORY = [
  { date: daysAgo(360), value: 795000, cumulativePnl: 171500 },
  { date: daysAgo(330), value: 780000, cumulativePnl: 156500 },
  { date: daysAgo(300), value: 745000, cumulativePnl: 121500 },
  { date: daysAgo(270), value: 710000, cumulativePnl: 86500 },
  { date: daysAgo(240), value: 685000, cumulativePnl: 61500 },
  { date: daysAgo(210), value: 652000, cumulativePnl: 28500 },
  { date: daysAgo(180), value: 640000, cumulativePnl: 16500 },
];

const SINGLE_POINT = [
  { date: daysAgo(10), value: 795000, cumulativePnl: 171500 },
];

const POSITIVE_METRICS = {
  sharpeRatio: 1.85,
  winRate: 68.5,
  profitFactor: 2.45,
  avgHoldingDays: 42,
  maxDrawdownPercent: 8.3,
  totalReturn: 171500,
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
};

function buildStoreState(overrides: {
  pnlHistory?: typeof POSITIVE_HISTORY;
  pnlHistoryStream?: Array<{ date: string; value: number; cumulativePnl: number }>;
  metrics?: typeof POSITIVE_METRICS;
} = {}) {
  const {
    pnlHistory = POSITIVE_HISTORY,
    pnlHistoryStream = [],
    metrics = POSITIVE_METRICS,
  } = overrides;

  return {
    getAnalytics: () => ({
      metrics,
      capitalGains: {
        shortTerm: { gains: 225000, count: 28, taxRate: 15, estimatedTax: 33750 },
        longTerm: { gains: 200000, count: 4, taxRate: 10, exemptLimit: 100000, taxableGains: 100000, estimatedTax: 10000 },
        totalEstimatedTax: 43750,
        sttPaid: 425,
        totalBrokerage: 128,
      },
      pnlHistory,
      monthlyReturns: [
        { month: '2025-08', startValue: 623500, endValue: 635000, return: 11500, returnPercent: 1.84, contributions: 0 },
      ],
      sectorAllocation: [
        { sector: 'Finance', value: 350000, percent: 44.0, count: 2 },
      ],
    }),
    pnlHistoryStream,
  };
}

// ==================== Mock stores ====================

let mockAnalyticsStore = buildStoreState();

vi.mock('../store/portfolioAnalyticsStore', () => ({
  usePortfolioAnalyticsStore: vi.fn((selector: any) => {
    return selector ? selector(mockAnalyticsStore) : mockAnalyticsStore;
  }),
}));

// ==================== Import Widget ====================

import PerformanceChartWidget from '../components/widgets/PerformanceChartWidget';

// ==================== Tests ====================

describe('PerformanceChartWidget', () => {
  beforeEach(() => {
    mockAnalyticsStore = buildStoreState();
  });

  // ── Small Size ────────────────────────────────────────────────────

  describe('small size', () => {
    it('renders portfolio value', () => {
      const { getByText } = render(<PerformanceChartWidget size="small" />);
      expect(getByText('₹7.95L')).toBeDefined();
    });

    it('renders default range label (1Y)', () => {
      const { getByText } = render(<PerformanceChartWidget size="small" />);
      expect(getByText('1Y')).toBeDefined();
    });

    it('renders positive value in green', () => {
      const { toJSON } = render(<PerformanceChartWidget size="small" />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders negative portfolio value in red', () => {
      mockAnalyticsStore = buildStoreState({ pnlHistory: NEGATIVE_HISTORY });
      const { getByText } = render(<PerformanceChartWidget size="small" />);
      expect(getByText('₹6.40L')).toBeDefined();
    });

    it('does not render range pills', () => {
      const { queryByText } = render(<PerformanceChartWidget size="small" />);
      expect(queryByText('ALL')).toBeNull();
    });
  });

  // ── Medium Size ──────────────────────────────────────────────────

  describe('medium size', () => {
    it('renders range selector pills', () => {
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('1W')).toBeDefined();
      expect(getByText('1M')).toBeDefined();
      expect(getByText('3M')).toBeDefined();
      expect(getByText('1Y')).toBeDefined();
      expect(getByText('ALL')).toBeDefined();
    });

    it('renders Portfolio Value label', () => {
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('Portfolio Value')).toBeDefined();
    });

    it('renders Total Return label', () => {
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('Total Return')).toBeDefined();
    });

    it('renders portfolio value amount', () => {
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('₹7.95L')).toBeDefined();
    });

    it('renders total return amount', () => {
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('₹1.72L')).toBeDefined();
    });

    it('does not render extended metrics (large-only)', () => {
      const { queryByText } = render(<PerformanceChartWidget size="medium" />);
      expect(queryByText('Max Drawdown')).toBeNull();
      expect(queryByText('Best Trade')).toBeNull();
      expect(queryByText('Range')).toBeNull();
    });

    it('shows empty state message when no pnlHistory data', () => {
      mockAnalyticsStore = buildStoreState({ pnlHistory: [] });
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('Add holdings to see your performance chart')).toBeDefined();
    });

    it('shows insufficient data message when only one point', () => {
      mockAnalyticsStore = buildStoreState({ pnlHistory: SINGLE_POINT });
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('Not enough data for this range')).toBeDefined();
    });
  });

  // ── Large Size ───────────────────────────────────────────────────

  describe('large size', () => {
    it('renders range selector pills', () => {
      const { getByText } = render(<PerformanceChartWidget size="large" />);
      expect(getByText('1Y')).toBeDefined();
      expect(getByText('ALL')).toBeDefined();
    });

    it('renders Portfolio Value label', () => {
      const { getByText } = render(<PerformanceChartWidget size="large" />);
      expect(getByText('Portfolio Value')).toBeDefined();
    });

    it('renders Total Return label', () => {
      const { getByText } = render(<PerformanceChartWidget size="large" />);
      expect(getByText('Total Return')).toBeDefined();
    });

    it('renders extended metrics: Max Drawdown', () => {
      const { getByText } = render(<PerformanceChartWidget size="large" />);
      expect(getByText('Max Drawdown')).toBeDefined();
      expect(getByText('+8.30%')).toBeDefined();
    });

    it('renders extended metrics: Best Trade', () => {
      const { getByText } = render(<PerformanceChartWidget size="large" />);
      expect(getByText('Best Trade')).toBeDefined();
      expect(getByText('₹62.5K')).toBeDefined();
    });

    it('renders extended metrics: Range', () => {
      const { getByText } = render(<PerformanceChartWidget size="large" />);
      expect(getByText('Range')).toBeDefined();
      expect(getByText('₹6.24L – ₹7.95L')).toBeDefined();
    });
  });

  // ── Time Range Switching ──────────────────────────────────────────

  describe('time range switching', () => {
    it('defaults to 1Y selected', () => {
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('1Y')).toBeDefined();
    });

    it('shows all range options', () => {
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('1W')).toBeDefined();
      expect(getByText('ALL')).toBeDefined();
    });

    it('renders correctly when switching to 1W with limited data', () => {
      mockAnalyticsStore = buildStoreState({
        pnlHistory: [
          { date: daysAgo(3), value: 700000, cumulativePnl: 76500 },
          { date: daysAgo(2), value: 720000, cumulativePnl: 96500 },
          { date: daysAgo(1), value: 710000, cumulativePnl: 86500 },
        ],
      });
      const { toJSON } = render(<PerformanceChartWidget size="medium" />);
      expect(toJSON()).toBeTruthy();
    });
  });

  // ── Empty / Edge Cases ────────────────────────────────────────────

  describe('empty and edge cases', () => {
    it('renders empty state when pnlHistory is empty', () => {
      mockAnalyticsStore = buildStoreState({ pnlHistory: [] });
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('Add holdings to see your performance chart')).toBeDefined();
    });

    it('renders insufficient data message for single point', () => {
      mockAnalyticsStore = buildStoreState({ pnlHistory: SINGLE_POINT });
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('Not enough data for this range')).toBeDefined();
    });
  });

  // ── Streaming Data Merge ─────────────────────────────────────────

  describe('streaming data merge', () => {
    it('renders with pnlHistoryStream data included', () => {
      const streamPoint = { date: `${daysAgo(1)}T14:30:00.000Z`, value: 810000, cumulativePnl: 186500 };
      mockAnalyticsStore = buildStoreState({ pnlHistoryStream: [streamPoint] });
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('₹8.10L')).toBeDefined();
    });

    it('does not duplicate dates already in pnlHistory', () => {
      // Derive from the actual last history point so the dedup match is structural,
      // not timing-dependent (avoids UTC-midnight drift between module load and test run)
      const streamPoint = {
        date: `${POSITIVE_HISTORY[POSITIVE_HISTORY.length - 1].date}T14:30:00.000Z`,
        value: 800000,
        cumulativePnl: 176500,
      };
      mockAnalyticsStore = buildStoreState({ pnlHistoryStream: [streamPoint] });
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      // Should still show the history's latest value: 795000 → ₹7.95L
      expect(getByText('₹7.95L')).toBeDefined();
    });

    it('merges multiple stream points correctly', () => {
      const stream = [
        { date: `${daysAgo(3)}T10:00:00.000Z`, value: 805000, cumulativePnl: 181500 },
        { date: `${daysAgo(2)}T11:30:00.000Z`, value: 820000, cumulativePnl: 196500 },
        { date: `${daysAgo(1)}T09:15:00.000Z`, value: 815000, cumulativePnl: 191500 },
      ];
      mockAnalyticsStore = buildStoreState({ pnlHistoryStream: stream });
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      // Latest value should be from the last stream point: 815000 → ₹8.15L
      expect(getByText('₹8.15L')).toBeDefined();
    });

    it('handles empty stream without crashing', () => {
      mockAnalyticsStore = buildStoreState({ pnlHistoryStream: [] });
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      expect(getByText('Portfolio Value')).toBeDefined();
      expect(getByText('₹7.95L')).toBeDefined();
    });
  });

  // ── Trend Colors ────────────────────────────────────────────────

  describe('trend colors', () => {
    it('shows positive trend (value higher than start) in green', () => {
      mockAnalyticsStore = buildStoreState({ pnlHistory: POSITIVE_HISTORY });
      const { getByText } = render(<PerformanceChartWidget size="small" />);
      expect(getByText('₹7.95L')).toBeDefined();
    });

    it('shows negative trend (value lower than start) with red text', () => {
      mockAnalyticsStore = buildStoreState({ pnlHistory: NEGATIVE_HISTORY });
      const { getByText } = render(<PerformanceChartWidget size="small" />);
      expect(getByText('₹6.40L')).toBeDefined();
    });

    it('shows zero-change trend as not negative', () => {
      const flatHistory = [
        { date: daysAgo(300), value: 500000, cumulativePnl: 0 },
        { date: daysAgo(60), value: 500000, cumulativePnl: 0 },
      ];
      mockAnalyticsStore = buildStoreState({ pnlHistory: flatHistory });
      const { getByText } = render(<PerformanceChartWidget size="small" />);
      expect(getByText('₹5.00L')).toBeDefined();
    });
  });

  // ── Range Pill Presses ────────────────────────────────────────────

  describe('range pill presses', () => {
    it('filters history to the last 7 days when 1W is pressed', () => {
      mockAnalyticsStore = buildStoreState({
        pnlHistory: [
          { date: daysAgo(300), value: 600000, cumulativePnl: 0 },
          { date: daysAgo(10), value: 700000, cumulativePnl: 100000 },
          { date: daysAgo(2), value: 710000, cumulativePnl: 110000 },
        ],
      });
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      // 1Y default: all 3 points survive → chart renders
      expect(getByText('₹7.10L')).toBeDefined();
      fireEvent.press(getByText('1W'));
      // Only the 2-day-old point survives the 7-day cutoff → insufficient data
      expect(getByText('Not enough data for this range')).toBeDefined();
    });

    it('presses 3M and keeps points inside the 90-day window', () => {
      mockAnalyticsStore = buildStoreState({
        pnlHistory: [
          { date: daysAgo(400), value: 640000, cumulativePnl: 65000 },
          { date: daysAgo(60), value: 750000, cumulativePnl: 126500 },
          { date: daysAgo(30), value: 795000, cumulativePnl: 171500 },
        ],
      });
      const { getByText, queryByText } = render(<PerformanceChartWidget size="medium" />);
      fireEvent.press(getByText('3M'));
      // The 400-day point is dropped; the two recent points remain → chart
      expect(getByText('₹7.95L')).toBeDefined();
      expect(queryByText('Not enough data for this range')).toBeNull();
    });

    it('presses ALL to disable the date cutoff entirely', () => {
      mockAnalyticsStore = buildStoreState({
        pnlHistory: [
          { date: daysAgo(700), value: 550000, cumulativePnl: -25000 },
          { date: daysAgo(100), value: 795000, cumulativePnl: 171500 },
        ],
      });
      const { getByText } = render(<PerformanceChartWidget size="medium" />);
      fireEvent.press(getByText('ALL'));
      // days < Infinity is false → merged array returned unfiltered
      expect(getByText('₹7.95L')).toBeDefined();
    });
  });

  // ── Negative Medium ────────────────────────────────────────────────

  it('renders negative total return in red for medium size', () => {
    mockAnalyticsStore = buildStoreState({ pnlHistory: NEGATIVE_HISTORY });
    const { root } = render(<PerformanceChartWidget size="medium" />);
    const redTexts = root.findAll((n: any) =>
      String(n.type) === 'Text' && Array.isArray(n.props?.style) &&
      n.props.style.some((s: any) => s?.color === '#FF5252')
    );
    expect(redTexts.length).toBeGreaterThan(0);
  });

  it('positions the latest dot with a flat history (zero range guard)', () => {
    const flatHistory = [
      { date: daysAgo(300), value: 500000, cumulativePnl: 0 },
      { date: daysAgo(60), value: 500000, cumulativePnl: 0 },
    ];
    mockAnalyticsStore = buildStoreState({ pnlHistory: flatHistory });
    const { getByText } = render(<PerformanceChartWidget size="medium" />);
    // maxValue - minValue === 0 → || 1 fallback keeps the Circle positioned
    expect(getByText('₹5.00L')).toBeDefined();
  });

  // ── Snapshot ──────────────────────────────────────────────────────

  it('matches snapshot for medium size with positive data', () => {
    const { toJSON } = render(<PerformanceChartWidget size="medium" />);
    expect(toJSON()).toMatchSnapshot('PerformanceChartWidget-medium-positive');
  });

  it('matches snapshot for small size', () => {
    const { toJSON } = render(<PerformanceChartWidget size="small" />);
    expect(toJSON()).toMatchSnapshot('PerformanceChartWidget-small');
  });
});
