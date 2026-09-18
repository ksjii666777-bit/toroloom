/**
 * ============================================================================
 * Toroloom — Journal → Discipline Report End-to-End (Integration)
 * ============================================================================
 *
 * The full discipline loop, through REAL components and the REAL
 * behavioralJournalStore shared between them:
 *
 *   Step 1 — BehavioralJournalScreen (real screen):
 *     Press the FAB → JournalEntryModal opens → fill symbol, prices,
 *     quantity and the PLANNED STOP + TARGET → live R:R preview confirms
 *     the plan honours the committed 1:2 → save → entry persisted with
 *     plannedStop/plannedTarget.
 *
 *   Step 2 — PeriodReportScreen (real screen + real disciplineAnalytics):
 *     The journaled trade is now measurable. DisciplineCard flags the
 *     breach (planned 1:3, exited at 1:1.5); the PDF export carries the
 *     same flag into the "R:R Discipline" section.
 *
 * Mocks: only API-boundary stores (portfolio/analytics/prefs), i18n labels,
 * theme and expo-print/sharing. The modal's math, the store mutation and
 * the discipline analytics all run for real.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

// ── Hoisted expo-print/sharing spies ────────────────────────────────────────
const { mockPrintToFileAsync, mockShareAsync, mockIsAvailableAsync } = vi.hoisted(() => ({
  mockPrintToFileAsync: vi.fn(() => Promise.resolve({ uri: 'file://report.pdf' })),
  mockShareAsync: vi.fn(() => Promise.resolve()),
  mockIsAvailableAsync: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('expo-print', () => ({ printToFileAsync: mockPrintToFileAsync }));
vi.mock('expo-sharing', () => ({
  isAvailableAsync: mockIsAvailableAsync,
  shareAsync: mockShareAsync,
}));

// ── API-boundary store mocks ────────────────────────────────────────────────
vi.mock('../store/portfolioStore', () => ({
  // Selector-aware: the journal modal calls it both ways
  usePortfolioStore: (selector: any) => {
    const state = { holdings: [], trades: [] };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../store/tradingPrefsStore', () => ({
  useTradingPrefsStore: (selector: any) =>
    selector ? selector({ rewardRiskRatio: 2, initialized: true }) : { rewardRiskRatio: 2, initialized: true },
}));

function buildMockAnalytics() {
  return {
    metrics: {
      totalReturn: 5410, totalReturnPercent: 7.07, realizedPnl: 5550,
      unrealizedPnl: -140, dayChange: 830, dayChangePercent: 1.02,
      winRate: 66.67, totalTrades: 3, winningTrades: 2, losingTrades: 1,
      avgWin: 2900, avgLoss: 250, profitFactor: 2.32, maxDrawdown: 5000,
      maxDrawdownPercent: 1.37, sharpeRatio: 1.25, avgHoldingDays: 45,
      bestTrade: 5000, worstTrade: -250, consecutiveWins: 1, consecutiveLosses: 0,
    },
    capitalGains: {
      shortTerm: { gains: 5550, count: 3, taxRate: 20, estimatedTax: 1110 },
      longTerm: { gains: 0, count: 0, taxRate: 12.5, exemptLimit: 125000, taxableGains: 0, estimatedTax: 0 },
      totalEstimatedTax: 1110,
      sttPaid: 6.05,
      totalBrokerage: 1.82,
    },
    monthlyReturns: [],
    sectorAllocation: [],
    pnlHistory: [],
  };
}

const mockAnalytics = buildMockAnalytics();

vi.mock('../store/portfolioAnalyticsStore', () => ({
  usePortfolioAnalyticsStore: (selector: any) =>
    selector
      ? selector({
          getAnalytics: () => mockAnalytics,
          isLive: false,
          lastUpdated: null,
          pnlHistoryStream: [],
          subscribeToLiveUpdates: vi.fn(),
          unsubscribeFromLiveUpdates: vi.fn(),
        })
      : null,
}));

// ── i18n: only the strings under assertion resolve; others pass through ────
const T_MAP: Record<string, string> = {
  // Journal entry modal
  'journal.entryTitle': 'Add Journal Entry',
  'journal.planBeforeTrade': 'Your plan before this trade',
  'journal.plannedRisk': 'Risk',
  'journal.plannedReward': 'Reward',
  'journal.plannedRR': 'Planned R:R',
  'journal.rrMeetsCommitment': 'honours your committed 1:{{ratio}}',
  'journal.rrBelowCommitment': 'below your committed 1:{{ratio}}',
  // Discipline card
  'periodReport.disciplineTitle': 'R:R Discipline',
  'periodReport.disciplineCommitment': 'Committed ratio: 1:{{ratio}}',
  'periodReport.disciplineMeasured': 'Measured',
  'periodReport.disciplineBreaches': 'Below Commitment',
  'periodReport.disciplineAvgRR': 'Avg Realized',
  'periodReport.disciplineAllClean': 'Every trade honoured your committed R:R — discipline holding',
  'periodReport.disciplineLossNote': '₹{{loss}} lost to below-commitment trades this period',
  'periodReport.disciplineFlagDetail': 'realized 1:{{realized}} vs committed 1:{{committed}}',
  'periodReport.disciplineNoCommitment': 'No R:R commitment yet',
  'periodReport.disciplineNoData': 'Add a planned stop-loss to journal entries',
};

function translate(key: string, params?: Record<string, any>): string {
  // i18next-style plural for the one pluralized key the card uses
  if (key === 'periodReport.disciplineBreachAlert' && params?.count != null) {
    const n = Number(params.count);
    return `${n} trade${n === 1 ? '' : 's'} fell below your committed R:R`;
  }
  let text = T_MAP[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return text;
}

vi.mock('../hooks/useT', () => ({
  useT: () => ({ t: translate, language: 'en', isHindi: false, toggleLanguage: vi.fn() }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      bg: '#0B0F19', bgSecondary: '#0E121D', bgCard: '#111827', bgCardLight: '#1A2235',
      bgInput: '#0F131E', border: '#1F2937', divider: '#1E293B',
      primary: '#3B82F6', primaryDim: 'rgba(59,130,246,0.14)',
      accent: '#22D3EE', success: '#22C55E', successDim: 'rgba(34,197,94,0.14)',
      danger: '#EF4444', dangerDim: 'rgba(239,68,68,0.14)',
      warning: '#F59E0B', warningDim: 'rgba(245,158,11,0.14)',
      text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      marketUp: '#00E676', marketDown: '#FF5252',
    },
  }),
}));

// ── Real modules under test (no behavioralJournalStore mock!) ───────────────
import { render, fireEvent } from './testUtils';
import BehavioralJournalScreen from '../screens/journal/BehavioralJournalScreen';
import PeriodReportScreen from '../screens/reports/PeriodReportScreen';
import { useBehaviorJournalStore } from '../store/behavioralJournalStore';

// ──── Helpers ───────────────────────────────────────────────────────────────

function type(screen: ReturnType<typeof render>, testId: string, value: string) {
  act(() => {
    fireEvent.changeText(screen.getByTestId(testId), value);
  });
}

const navProps = { navigation: { navigate: vi.fn(), goBack: vi.fn() } as any, route: { params: {} } as any };

/** Press the journal FAB and fill the modal with a full trade plan */
function journalTrade(
  screen: ReturnType<typeof render>,
  trade: { symbol: string; entry: string; exit: string; qty: string; stop: string; target: string; direction?: 'long' | 'short' },
) {
  const fab = screen.root.find(inst => (inst.props as any)?.accessibilityLabel === 'add');
  act(() => {
    fab.props.onPress();
  });

  expect(screen.getByTestId('journal-entry-modal')).toBeDefined();
  if (trade.direction === 'short') {
    act(() => {
      fireEvent.press(screen.getByTestId('journal-direction-short'));
    });
  }
  type(screen, 'journal-symbol-input', trade.symbol);
  type(screen, 'journal-entry-input', trade.entry);
  type(screen, 'journal-exit-input', trade.exit);
  type(screen, 'journal-qty-input', trade.qty);
  type(screen, 'journal-stop-input', trade.stop);
  type(screen, 'journal-target-input', trade.target);
}

// ──── Tests ─────────────────────────────────────────────────────────────────

describe('Journal → Discipline Report end-to-end', () => {
  let initialEntries: any[];

  beforeAll(() => {
    initialEntries = useBehaviorJournalStore.getState().entries;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Fresh journal: original mock set, no modal open
    useBehaviorJournalStore.setState({ entries: [...initialEntries], showEntryModal: false });
    useBehaviorJournalStore.getState().recompute();
  });

  afterAll(() => {
    useBehaviorJournalStore.setState({ entries: initialEntries, showEntryModal: false });
  });

  it('journals a trade with a planned 1:3 stop/target, then the weekly report flags the 1:1.5 exit', async () => {
    // ── Phase 1: journal the trade through the real screen + modal ──
    const journal = render(<BehavioralJournalScreen {...navProps} />);

    journalTrade(journal, {
      symbol: 'TCS', entry: '100', exit: '103', qty: '10', stop: '98', target: '106',
    });

    // Live preview BEFORE saving: risk 2×10=₹20 · reward 6×10=₹60 → planned 1:3, honours 1:2
    expect(journal.getByTestId('journal-rr-preview')).toBeDefined();
    expect(journal.getByText('Risk: ₹20  ·  Reward: ₹60')).toBeDefined();
    expect(journal.getByText('Planned R:R 1:3.00 · honours your committed 1:2')).toBeDefined();

    // Save → real store mutation
    act(() => {
      fireEvent.press(journal.getByTestId('journal-save'));
    });

    const saved = useBehaviorJournalStore.getState().entries[0];
    expect(saved).toMatchObject({
      symbol: 'TCS',
      entryPrice: 100,
      exitPrice: 103,
      quantity: 10,
      pnl: 30,
      plannedStop: 98,
      plannedTarget: 106,
    });
    expect(useBehaviorJournalStore.getState().showEntryModal).toBe(false);
    journal.unmount();

    // ── Phase 2: the weekly discipline report measures and flags it ──
    const report = render(<PeriodReportScreen {...navProps} />);

    // Breach alert: planned 1:3 but exited at (103−100)/2 = 1:1.5 < 1:2
    expect(report.getByText('R:R Discipline')).toBeDefined();
    expect(report.getByText('1 trade fell below your committed R:R')).toBeDefined();
    expect(report.getByText('TCS')).toBeDefined();
    expect(report.getByText('realized 1:1.50 vs committed 1:2')).toBeDefined();
    expect(report.getByText('+₹30')).toBeDefined();

    // Winning breach → no ₹-loss note
    expect(report.queryByText(/lost to below-commitment/)).toBeNull();

    // Stats: avg realized 1:1.5 (string appears in the stat value AND the flag row)
    expect(report.getAllByText(/1:1\.5/).length).toBeGreaterThanOrEqual(2);

    // ── Phase 2b: PDF export carries the same flags ──
    fireEvent.press(report.getByTestId('export-pdf-btn'));
    await vi.waitFor(() => {
      expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
    });

    const html = (mockPrintToFileAsync.mock.calls as any)[0][0].html;
    expect(html).toContain('R:R Discipline (committed 1:2)');
    expect(html).toContain('TCS');
    expect(html).toContain('realized 1:1.50 vs committed 1:2');
    expect(html).not.toContain('Every trade honoured your committed R:R');

    report.unmount();
  });

  it('a trade that honoured the commitment shows all-clean in the card and the PDF', async () => {
    const journal = render(<BehavioralJournalScreen {...navProps} />);
    journalTrade(journal, {
      symbol: 'INFY', entry: '100', exit: '110', qty: '10', stop: '95', target: '115',
    });
    act(() => {
      fireEvent.press(journal.getByTestId('journal-save'));
    });
    // exit 110 = risk 5 → realized 2.0 ≥ committed 2 → clean
    journal.unmount();

    const report = render(<PeriodReportScreen {...navProps} />);
    expect(report.getByText('Every trade honoured your committed R:R — discipline holding')).toBeDefined();
    expect(report.queryByText(/fell below your committed R:R/)).toBeNull();

    fireEvent.press(report.getByTestId('export-pdf-btn'));
    await vi.waitFor(() => {
      expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
    });
    const html = (mockPrintToFileAsync.mock.calls as any)[0][0].html;
    expect(html).toContain('Every trade honoured your committed R:R');
    expect(html).not.toContain('realized 1:');
    report.unmount();
  });

  it('flags a short trade that under-delivered (planned 1:3 short, exited at 1:0.75)', async () => {
    const journal = render(<BehavioralJournalScreen {...navProps} />);
    // Short: entry 100, stop 104 (risk 4), target 90 → planned 1:2.5 honours 1:2.
    // Exit 97 → reward 3 → realized 3/4 = 0.75 < 2 → breach. pnl = (100−97)×10 = 30.
    journalTrade(journal, {
      symbol: 'WIPRO', entry: '100', exit: '97', qty: '10', stop: '104', target: '90',
      direction: 'short',
    });

    // Planned R:R 1:2.50 still honours the commitment at plan time
    expect(journal.getByText('Planned R:R 1:2.50 · honours your committed 1:2')).toBeDefined();

    act(() => {
      fireEvent.press(journal.getByTestId('journal-save'));
    });
    journal.unmount();

    const report = render(<PeriodReportScreen {...navProps} />);
    expect(report.getByText('1 trade fell below your committed R:R')).toBeDefined();
    expect(report.getByText('WIPRO')).toBeDefined();
    expect(report.getByText('realized 1:0.75 vs committed 1:2')).toBeDefined();
    expect(report.getByText('+₹30')).toBeDefined();
    report.unmount();
  });
});
