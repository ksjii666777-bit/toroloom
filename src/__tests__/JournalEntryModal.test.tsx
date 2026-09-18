/**
 * ============================================================================
 * Toroloom — JournalEntryModal Tests
 * ============================================================================
 *
 * The discipline-critical add-entry flow:
 *   1. Hidden when showEntryModal is false; FAB-visible via store flag
 *   2. Validation blocks save without symbol/prices/quantity
 *   3. Planned stop + target produce a live planned-R:R preview
 *      colour-coded against the user's committed ratio
 *   4. Stop-only (no target) still previews risk and saves plannedStop
 *   5. Saving persists plannedStop/plannedTarget into the journal entry —
 *      making the trade measurable by disciplineAnalytics
 *   6. Exit reason inferred from how close the exit was to stop/target
 * ============================================================================
 */

import React, { act } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAddEntry } = vi.hoisted(() => ({ mockAddEntry: vi.fn() }));

vi.mock('../store/behavioralJournalStore', async () => {
  const actual = await vi.importActual<typeof import('../store/behavioralJournalStore')>(
    '../store/behavioralJournalStore',
  );
  // Keep the REAL store (setState/getState work) but wrap the hook so the
  // component sees the spied addEntry.
  const realStore = actual.useBehaviorJournalStore;
  // Cast: the test hook intentionally mimics (not extends) the store's call signatures
  const hookedStore: any = Object.assign(
    vi.fn((selector: any) => {
      const state = {
        ...realStore.getState(),
        addEntry: mockAddEntry,
      };
      return selector ? selector(state) : state;
    }),
    {
      setState: realStore.setState.bind(realStore),
      getState: realStore.getState.bind(realStore),
      subscribe: realStore.subscribe.bind(realStore),
    },
  );
  return {
    ...actual,
    useBehaviorJournalStore: hookedStore,
  };
});

// Committed ratio defaults to 2 (1:2) — overridable per test
let mockCommittedRatio: number | null = 2;
vi.mock('../store/tradingPrefsStore', () => ({
  useTradingPrefsStore: vi.fn((selector: any) =>
    selector ? selector({ rewardRiskRatio: mockCommittedRatio }) : { rewardRiskRatio: mockCommittedRatio },
  ),
}));

// Broker trade history for prefill (empty unless a test overrides it)
let mockTrades: any[] = [];
vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: vi.fn((selector: any) => {
    const state = { holdings: [], trades: mockTrades };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', primaryDim: 'rgba(108,99,255,0.14)',
      danger: '#FF5252', dangerDim: 'rgba(255,82,82,0.14)',
      warning: '#FFAB40', warningDim: 'rgba(255,171,64,0.14)',
      success: '#00E676', successDim: 'rgba(0,230,118,0.14)',
      text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      bgSecondary: '#0E121D', bgCard: 'rgba(255,255,255,0.03)',
      bgInput: '#0F131E', border: 'rgba(255,255,255,0.07)',
    },
  }),
}));

const journalMap: Record<string, string> = {
  'journal.entryTitle': 'Add Journal Entry',
  'journal.entrySymbol': 'Symbol',
  'journal.entryLong': 'LONG',
  'journal.entryShort': 'SHORT',
  'journal.entryPriceLabel': 'Entry Price',
  'journal.exitPriceLabel': 'Exit Price',
  'journal.quantityLabel': 'Quantity',
  'journal.planBeforeTrade': 'Your plan before this trade',
  'journal.planHint': 'Recording the stop and target you committed to BEFORE entering is what makes R:R discipline measurable.',
  'journal.plannedStopLabel': 'Planned Stop-Loss',
  'journal.plannedTargetLabel': 'Planned Target',
  'journal.plannedRisk': 'Risk',
  'journal.plannedReward': 'Reward',
  'journal.plannedRR': 'Planned R:R',
  'journal.rrMeetsCommitment': 'honours your committed 1:{{ratio}}',
  'journal.rrBelowCommitment': 'below your committed 1:{{ratio}}',
  'journal.emotionLabel': 'Emotional State',
  'journal.mistakesLabel': 'Mistakes',
  'journal.notesLabel': 'Notes',
  'journal.pnlPreview': 'Realized P&L',
  'journal.cancel': 'Cancel',
  'journal.saveEntry': 'Save Entry',
  'journal.errSymbol': 'Symbol is required',
  'journal.prefillFromJournal': 'Prefilled from your last {{symbol}} journal entry',
  'journal.prefillFromTrades': 'Prefilled from your last {{symbol}} trade',
};

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      let text = journalMap[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return text;
    },
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

import { render, fireEvent } from './testUtils';
import JournalEntryModal from '../components/journal/JournalEntryModal';
import { useBehaviorJournalStore } from '../store/behavioralJournalStore';

// ──── Helpers ───────────────────────────────────────────────────────────────

/** Minimal store-shaped journal entry for prefill fixtures */
function makeStoreEntry(overrides: Record<string, any> = {}): any {
  return {
    id: 'je_fixture',
    date: '2026-09-10T10:00:00.000Z',
    symbol: 'TCS',
    direction: 'long',
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    pnl: 100,
    pnlPercent: 10,
    holdingPeriod: '2h',
    emotionalState: 'calm',
    mistakes: [],
    planCompliance: 100,
    notes: '',
    setupType: 'breakout',
    exitReason: 'target',
    tags: [],
    ...overrides,
  };
}

/** Minimal store-shaped broker trade for prefill fixtures */
function makeStoreTrade(overrides: Record<string, any> = {}) {
  return {
    id: `t_${Math.random().toString(36).slice(2, 7)}`,
    stockId: 's1',
    symbol: 'TCS',
    name: 'TCS Ltd',
    quantity: 10,
    price: 100,
    total: 1000,
    timestamp: '2026-09-10T10:00:00.000Z',
    ...overrides,
  };
}

/** Text-input state updates must be wrapped in act() to re-render */
function type(input: ReactTestInstance, text: string) {
  act(() => {
    fireEvent.changeText(input, text);
  });
}

function openModal() {
  act(() => {
    useBehaviorJournalStore.getState().setShowEntryModal(true);
  });
  return render(<JournalEntryModal />);
}

/** Fill the required core fields */
function fillCore(screen: ReturnType<typeof render>) {
  type(screen.getByTestId('journal-symbol-input'), 'RELIANCE');
  type(screen.getByTestId('journal-entry-input'), '100');
  type(screen.getByTestId('journal-exit-input'), '110');
  type(screen.getByTestId('journal-qty-input'), '10');
}

// ──── Tests ─────────────────────────────────────────────────────────────────

describe('JournalEntryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommittedRatio = 2;
    useBehaviorJournalStore.setState({ showEntryModal: false });
  });

  it('renders nothing when the store flag is false', () => {
    const { queryByTestId } = render(<JournalEntryModal />);
    expect(queryByTestId('journal-entry-modal')).toBeNull();
  });

  it('appears when showEntryModal is set and shows the plan section', () => {
    const { getByTestId, getByText } = openModal();
    expect(getByTestId('journal-entry-modal')).toBeDefined();
    expect(getByText('Add Journal Entry')).toBeDefined();
    expect(getByText('Your plan before this trade')).toBeDefined();
    expect(getByTestId('journal-stop-input')).toBeDefined();
    expect(getByTestId('journal-target-input')).toBeDefined();
  });

  it('blocks save when required fields are missing', () => {
    const { getByTestId } = openModal();
    fireEvent.press(getByTestId('journal-save'));
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  it('shows the error message after an attempted save without symbol', () => {
    const screen = openModal();
    type(screen.getByTestId('journal-entry-input'), '100');
    type(screen.getByTestId('journal-exit-input'), '110');
    type(screen.getByTestId('journal-qty-input'), '10');
    fireEvent.press(screen.getByTestId('journal-save'));
    expect(screen.getByText('Symbol is required')).toBeDefined();
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  it('previews planned R:R live and honours the committed ratio (long 100/stop 95/target 115 = 1:3 vs 1:2)', () => {
    const screen = openModal();
    fillCore(screen);
    type(screen.getByTestId('journal-stop-input'), '95');
    type(screen.getByTestId('journal-target-input'), '115');

    // risk 5 × 10 = ₹50 · reward 15 × 10 = ₹150 · R:R 1:3 ≥ 1:2 → honoured
    expect(screen.getByTestId('journal-rr-preview')).toBeDefined();
    expect(screen.getByText(/Risk: ₹50/)).toBeDefined();
    expect(screen.getByText(/Reward: ₹150/)).toBeDefined();
    expect(screen.getByText(/Planned R:R 1:3\.00/)).toBeDefined();
    expect(screen.getByText('honours your committed 1:2')).toBeDefined();
  });

  it('warns when the planned R:R falls below the commitment', () => {
    const screen = openModal();
    fillCore(screen);
    type(screen.getByTestId('journal-stop-input'), '90'); // risk 10
    type(screen.getByTestId('journal-target-input'), '115'); // reward 15 → 1:1.5

    expect(screen.getByText(/Planned R:R 1:1\.50/)).toBeDefined();
    expect(screen.getByText('below your committed 1:2')).toBeDefined();
  });

  it('adapts stop-only entries: risk preview with no reward, and saves plannedStop', () => {
    const screen = openModal();
    fillCore(screen);
    type(screen.getByTestId('journal-stop-input'), '95');

    // Risk shown, no reward/RR line
    expect(screen.getByText(/Risk: ₹50/)).toBeDefined();
    expect(screen.queryByText(/Reward:/)).toBeNull();

    fireEvent.press(screen.getByTestId('journal-save'));

    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    const saved = mockAddEntry.mock.calls[0][0];
    expect(saved.plannedStop).toBe(95);
    expect(saved.plannedTarget).toBeUndefined();
    expect(saved.symbol).toBe('RELIANCE');
    expect(saved.pnl).toBe(100); // (110−100)×10
  });

  it('saves plannedStop and plannedTarget with the entry (R:R becomes measurable)', () => {
    const screen = openModal();
    fillCore(screen);
    type(screen.getByTestId('journal-stop-input'), '95');
    type(screen.getByTestId('journal-target-input'), '115');
    fireEvent.press(screen.getByTestId('journal-save'));

    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    const saved = mockAddEntry.mock.calls[0][0];
    expect(saved.plannedStop).toBe(95);
    expect(saved.plannedTarget).toBe(115);
    expect(saved.exitReason).toBe('manual'); // exit 110 is neither 95 nor 115
  });

  it('infers stop_loss when the exit lands on the planned stop', () => {
    const screen = openModal();
    type(screen.getByTestId('journal-symbol-input'), 'TCS');
    type(screen.getByTestId('journal-entry-input'), '100');
    type(screen.getByTestId('journal-exit-input'), '95.05'); // within 0.5% of 95
    type(screen.getByTestId('journal-qty-input'), '10');
    type(screen.getByTestId('journal-stop-input'), '95');
    type(screen.getByTestId('journal-target-input'), '115');
    fireEvent.press(screen.getByTestId('journal-save'));

    const saved = mockAddEntry.mock.calls[0][0];
    expect(saved.exitReason).toBe('stop_loss');
    expect(saved.pnl).toBeLessThan(0);
  });

  it('infers target when the exit lands on the planned target', () => {
    const screen = openModal();
    type(screen.getByTestId('journal-symbol-input'), 'INFY');
    type(screen.getByTestId('journal-entry-input'), '100');
    type(screen.getByTestId('journal-exit-input'), '114.8'); // within 0.5% of 115
    type(screen.getByTestId('journal-qty-input'), '10');
    type(screen.getByTestId('journal-stop-input'), '95');
    type(screen.getByTestId('journal-target-input'), '115');
    fireEvent.press(screen.getByTestId('journal-save'));

    const saved = mockAddEntry.mock.calls[0][0];
    expect(saved.exitReason).toBe('target');
  });

  it('computes negative P&L and direction-aware pnlPercent for a short', () => {
    const screen = openModal();
    type(screen.getByTestId('journal-symbol-input'), 'INFY');
    fireEvent.press(screen.getByTestId('journal-direction-short'));
    type(screen.getByTestId('journal-entry-input'), '100');
    type(screen.getByTestId('journal-exit-input'), '105'); // short loses when price rises
    type(screen.getByTestId('journal-qty-input'), '10');
    fireEvent.press(screen.getByTestId('journal-save'));

    const saved = mockAddEntry.mock.calls[0][0];
    expect(saved.direction).toBe('short');
    expect(saved.pnl).toBe(-50);
    expect(saved.pnlPercent).toBe(-5);
  });

  it('no preview and no plannedStop saved when stop input is left empty', () => {
    const screen = openModal();
    fillCore(screen);
    expect(screen.queryByTestId('journal-rr-preview')).toBeNull();
    fireEvent.press(screen.getByTestId('journal-save'));

    const saved = mockAddEntry.mock.calls[0][0];
    expect(saved.plannedStop).toBeUndefined();
    expect(saved.plannedTarget).toBeUndefined();
  });

  it('cancel closes the modal without saving', () => {
    const screen = openModal();
    fireEvent.press(screen.getByTestId('journal-cancel'));
    expect(mockAddEntry).not.toHaveBeenCalled();
    expect(useBehaviorJournalStore.getState().showEntryModal).toBe(false);
  });

  // ── Prefill from the symbol's last closed trade ──────────────

  describe('symbol prefill', () => {
    function commitSymbol(screen: ReturnType<typeof render>, symbol: string) {
      type(screen.getByTestId('journal-symbol-input'), symbol);
      // Blur/commit triggers the prefill lookup
      fireEvent.trigger(screen.getByTestId('journal-symbol-input'), 'onBlur');
    }

    beforeEach(() => {
      mockTrades = [];
    });

    it('prefills quantity + planned stop/target from the last journal entry for the symbol', () => {
      useBehaviorJournalStore.setState({
        entries: [
          makeStoreEntry({ id: 'x1', symbol: 'TCS', quantity: 20, plannedStop: 95, plannedTarget: 115 }),
        ],
      });

      const screen = openModal();
      commitSymbol(screen, 'TCS');

      expect((screen.getByTestId('journal-qty-input').props as any).value).toBe('20');
      expect((screen.getByTestId('journal-stop-input').props as any).value).toBe('95');
      expect((screen.getByTestId('journal-target-input').props as any).value).toBe('115');
      // Entry price deliberately NOT prefilled — it's a NEW trade
      expect((screen.getByTestId('journal-entry-input').props as any).value).toBe('');
      // Source hint names the journal
      expect(screen.getByTestId('journal-prefill-hint')).toBeDefined();
      expect(screen.getByText('Prefilled from your last TCS journal entry')).toBeDefined();
    });

    it('falls back to broker trade round trip when no journal entry exists', () => {
      // Empty the store's seed entries so the journal source has no TCS entry
      useBehaviorJournalStore.setState({ entries: [] });
      mockTrades = [
        makeStoreTrade({ type: 'buy', price: 100, quantity: 10, timestamp: '2026-09-01T10:00:00.000Z' }),
        makeStoreTrade({ type: 'sell', price: 110, quantity: 10, timestamp: '2026-09-05T10:00:00.000Z' }),
      ];

      const screen = openModal();
      commitSymbol(screen, 'TCS');
      expect((screen.getByTestId('journal-entry-input').props as any).value).toBe('100');
      expect((screen.getByTestId('journal-exit-input').props as any).value).toBe('110');
      expect((screen.getByTestId('journal-qty-input').props as any).value).toBe('10');
      expect(screen.getByText('Prefilled from your last TCS trade')).toBeDefined();
    });

    it('does not prefill for a symbol with no history', () => {
      const screen = openModal();
      commitSymbol(screen, 'ZZZZ');
      expect(screen.queryByTestId('journal-prefill-hint')).toBeNull();
      expect((screen.getByTestId('journal-qty-input').props as any).value).toBe('');
    });

    it('never clobbers fields the user already filled', () => {
      useBehaviorJournalStore.setState({
        entries: [
          makeStoreEntry({ id: 'x1', symbol: 'TCS', quantity: 20, plannedStop: 95, plannedTarget: 115 }),
        ],
      });

      const screen = openModal();
      type(screen.getByTestId('journal-qty-input'), '3');
      type(screen.getByTestId('journal-stop-input'), '90');
      commitSymbol(screen, 'TCS');

      expect((screen.getByTestId('journal-qty-input').props as any).value).toBe('3');
      expect((screen.getByTestId('journal-stop-input').props as any).value).toBe('90');
      // Untouched planned-target still prefilled
      expect((screen.getByTestId('journal-target-input').props as any).value).toBe('115');
    });

    it('fires only once per symbol per open (retyping does not reset user edits)', () => {
      useBehaviorJournalStore.setState({
        entries: [
          makeStoreEntry({ id: 'x1', symbol: 'TCS', quantity: 20, plannedStop: 95 }),
        ],
      });

      const screen = openModal();
      commitSymbol(screen, 'TCS');
      expect((screen.getByTestId('journal-qty-input').props as any).value).toBe('20');

      // User edits, then blurs again with the same symbol
      type(screen.getByTestId('journal-qty-input'), '7');
      fireEvent.trigger(screen.getByTestId('journal-symbol-input'), 'onBlur');
      expect((screen.getByTestId('journal-qty-input').props as any).value).toBe('7');
    });
  });

  // ── One-tap prefill intent (streak-rebuild banner flow) ──────

  describe('one-tap prefill intent', () => {
    beforeEach(() => {
      mockTrades = [];
    });

    it('auto-prefills from the most recent closed trade on open and clears the intent', () => {
      useBehaviorJournalStore.setState({
        entries: [
          makeStoreEntry({ id: 'x1', symbol: 'TCS', quantity: 20, plannedStop: 95, plannedTarget: 115 }),
        ],
        pendingOneTapPrefill: true,
      });

      const screen = openModal();

      expect((screen.getByTestId('journal-symbol-input').props as any).value).toBe('TCS');
      expect((screen.getByTestId('journal-qty-input').props as any).value).toBe('20');
      expect((screen.getByTestId('journal-stop-input').props as any).value).toBe('95');
      expect((screen.getByTestId('journal-target-input').props as any).value).toBe('115');
      // Intent consumed immediately — a plain manual open next is untouched
      expect(useBehaviorJournalStore.getState().pendingOneTapPrefill).toBe(false);
    });

    it('falls back to the last broker round trip when the journal is empty', () => {
      useBehaviorJournalStore.setState({ entries: [], pendingOneTapPrefill: true });
      mockTrades = [
        makeStoreTrade({ symbol: 'INFY', type: 'buy', price: 500, quantity: 4, timestamp: '2026-09-06T10:00:00.000Z' }),
        makeStoreTrade({ symbol: 'INFY', type: 'sell', price: 550, quantity: 4, timestamp: '2026-09-08T10:00:00.000Z' }),
      ];

      const screen = openModal();

      expect((screen.getByTestId('journal-symbol-input').props as any).value).toBe('INFY');
      expect((screen.getByTestId('journal-entry-input').props as any).value).toBe('500');
      expect((screen.getByTestId('journal-exit-input').props as any).value).toBe('550');
    });

    it('leaves a plain manual open untouched (no intent, no prefill)', () => {
      useBehaviorJournalStore.setState({
        entries: [makeStoreEntry({ id: 'x1', symbol: 'TCS', quantity: 20 })],
      });

      const screen = openModal();

      expect((screen.getByTestId('journal-symbol-input').props as any).value).toBe('');
      expect((screen.getByTestId('journal-qty-input').props as any).value).toBe('');
      expect(screen.queryByTestId('journal-prefill-hint')).toBeNull();
    });

    it('re-applying the intent never clobbers fields the user already filled', () => {
      useBehaviorJournalStore.setState({
        entries: [
          makeStoreEntry({ id: 'x1', symbol: 'TCS', quantity: 20, plannedStop: 95, plannedTarget: 115 }),
        ],
        pendingOneTapPrefill: true,
      });

      const screen = openModal();
      expect((screen.getByTestId('journal-qty-input').props as any).value).toBe('20');

      // User edits quantity, then the intent somehow fires again
      type(screen.getByTestId('journal-qty-input'), '3');
      act(() => {
        useBehaviorJournalStore.setState({ pendingOneTapPrefill: true });
      });

      expect((screen.getByTestId('journal-qty-input').props as any).value).toBe('3');
    });
  });
});
