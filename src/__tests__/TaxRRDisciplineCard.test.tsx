/**
 * ============================================================================
 * Toroloom — TaxRRDisciplineCard Tests
 * ============================================================================
 * Three states of the card, with real component + mocked stores:
 *   1. hidden when showCard=false
 *   2. no commitment → "commit your R:R" prompt
 *   3. committed but no planned-stop trades → "journal with a stop" prompt
 *   4. measured data → comparison rows, post-tax gap, and the clean-week line
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

// ── Store mocks (ratio + entries overridable per test) ──────────────────
let mockCommittedRatio: number | null = null;
let mockTaxMode: 'ltcg' | 'slab' = 'ltcg';
let mockSlabRate = 0.3;
const mockSetTaxMode = vi.fn();
const mockSetSlabRate = vi.fn();
let mockEntries: any[] = [];

vi.mock('../store/tradingPrefsStore', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../store/tradingPrefsStore');
  return {
    ...actual,
    useTradingPrefsStore: vi.fn((selector: any) => {
      const state = {
        rewardRiskRatio: mockCommittedRatio,
        taxMode: mockTaxMode,
        slabRate: mockSlabRate,
        setTaxMode: mockSetTaxMode,
        setSlabRate: mockSetSlabRate,
        resolvedTaxRate: () => (mockTaxMode === 'slab' ? mockSlabRate : 0.125),
      };
      return selector ? selector(state) : state;
    }),
  };
});

vi.mock('../store/behavioralJournalStore', () => ({
  useBehaviorJournalStore: vi.fn((selector: any) =>
    selector ? selector({ entries: mockEntries }) : { entries: mockEntries },
  ),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', bgCard: '#1A1A2E', border: '#2A2A44',
      success: '#22C55E', danger: '#EF4444',
    },
  }),
}));

vi.mock('../../src/hooks/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const strings: Record<string, string> = {
        'taxEducation.rrCardTitle': 'Your discipline, your post-tax returns',
        'taxEducation.rrCardSubtitle': 'What honouring your committed R:R is actually worth',
        'taxEducation.rrCommitted': 'Committed R:R',
        'taxEducation.rrCardMeasured': '{{measured}} journaled trades measured against your commitment',
        'taxEducation.rrActual': 'Actual (journaled)',
        'taxEducation.rrDisciplined': 'If you had held to plan',
        'taxEducation.rrPostTax': 'Post-tax',
        'taxEducation.rrBreachLine': '{{breaches}} shortcut exits · {{undisciplinedLosses}} stop-buster losses (₹{{loss}} ran past your stop)',
        'taxEducation.rrGapLine': 'Indiscipline cost you ₹{{gap}} post-tax',
        'taxEducation.rrCleanLine': 'Fully disciplined this period — keep holding winners to plan',
        'taxEducation.rrCtaCommit': 'Commit your R:R ratio',
        'taxEducation.rrCtaJournal': 'Journal your next trade with a planned stop',
        'taxEducation.rrDisclaimer': 'Illustrative model. Not tax advice.',
        'taxEducation.rrTaxSettings': 'Tax model',
        'taxEducation.rrTaxLtcg': 'Long-term (12.5% LTCG)',
        'taxEducation.rrTaxSlab': 'Short-term (income slab)',
        'taxEducation.rrSlabLabel': 'Your slab rate',
        'taxEducation.rrSlab5': '5%',
        'taxEducation.rrSlab20': '20%',
        'taxEducation.rrSlab30': '30%',
        'taxEducation.rrCompareHeading': 'Both models side by side',
        'taxEducation.rrCompareLtcgGap': 'LTCG 12.5% gap',
        'taxEducation.rrCompareSlabGap': 'Slab {{slabPct}}% gap',
      };
      let out = strings[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return out;
    },
  }),
}));

import { fireEvent } from './testUtils';
import TaxRRDisciplineCard from '../components/tax/TaxRRDisciplineCard';

/** testUtils has no getByLabelText — find by accessibilityLabel ourselves. */
function getByA11yLabel(utils: ReturnType<typeof render>, label: string) {
  return utils.root.find((inst) => inst.props?.accessibilityLabel === label);
}

/** entry 100 / stop 90 → ₹10 risk per unit */
const mk = (id: string, pnl: number, extra: object = {}) => ({
  id, pnl, quantity: 1, entryPrice: 100, plannedStop: 90, ...extra,
});

beforeEach(() => {
  mockCommittedRatio = null;
  mockTaxMode = 'ltcg';
  mockSlabRate = 0.3;
  mockEntries = [];
  vi.clearAllMocks();
});

describe('TaxRRDisciplineCard — R:R × post-tax impact', () => {
  it('renders nothing when showCard is false', () => {
    const utils = render(<TaxRRDisciplineCard showCard={false} />);
    expect(utils.toJSON()).toBeNull();
  });

  it('prompts to commit when no R:R commitment exists', () => {
    const utils = render(<TaxRRDisciplineCard />);

    expect(utils.getByText('What honouring your committed R:R is actually worth')).toBeTruthy();
    expect(utils.getByText('Commit your R:R ratio')).toBeTruthy();
    expect(utils.queryByText(/Post-tax/)).toBeNull();
  });

  it('prompts to journal (not commit) when committed but nothing is measurable', () => {
    mockCommittedRatio = 3;
    mockEntries = [mk('no-stop', 500, { plannedStop: null })];

    const utils = render(<TaxRRDisciplineCard />);

    expect(utils.getByText('Committed R:R 1:3')).toBeTruthy();
    expect(utils.getByText('Journal your next trade with a planned stop')).toBeTruthy();
    expect(utils.queryByText('Commit your R:R ratio')).toBeNull();
  });

  it('shows the measured comparison with the post-tax gap line', () => {
    mockCommittedRatio = 3;
    // Winner cut at 1:1.5 → breach; disciplined-you would keep ₹30 pre-tax.
    mockEntries = [mk('a', 15)];

    const utils = render(<TaxRRDisciplineCard />);

    expect(utils.getByText('1 journaled trades measured against your commitment')).toBeTruthy();
    expect(utils.getByText('Actual (journaled)')).toBeTruthy();
    expect(utils.getByText('If you had held to plan')).toBeTruthy();
    // 30 × 0.875 = 26.25 → "26"; 15 × 0.875 = 13.125 → "13"
    expect(utils.getByText('Post-tax ₹26')).toBeTruthy();
    expect(utils.getByText('Post-tax ₹13')).toBeTruthy();
    expect(utils.getByText('Indiscipline cost you ₹13 post-tax')).toBeTruthy();
  });

  it('shows the clean-period line when discipline held (no gap)', () => {
    mockCommittedRatio = 3;
    mockEntries = [mk('win', 30), mk('loss', -5, { plannedStop: 95 })]; // 1:3 + exact 1R stop-out

    const utils = render(<TaxRRDisciplineCard />);

    expect(utils.getByText('Fully disciplined this period — keep holding winners to plan')).toBeTruthy();
    expect(utils.queryByText(/Indiscipline cost you/)).toBeNull();
  });

  it('flags stop-buster losses with their damage in the breach line', () => {
    mockCommittedRatio = 3;
    mockEntries = [mk('buster', -20)]; // 2R loss on ₹10 planned risk

    const utils = render(<TaxRRDisciplineCard />);

    expect(
      utils.getByText('1 shortcut exits · 1 stop-buster losses (₹20 ran past your stop)'),
    ).toBeTruthy();
  });

  it('renders the tax-model picker with LTCG active by default', () => {
    mockCommittedRatio = 3;
    mockEntries = [mk('a', 15)];

    const utils = render(<TaxRRDisciplineCard />);

    expect(utils.getByText('Tax model')).toBeTruthy();
    expect(getByA11yLabel(utils, 'Long-term (12.5% LTCG)')).toBeTruthy();
    expect(getByA11yLabel(utils, 'Short-term (income slab)')).toBeTruthy();
    // Slab chips hidden while LTCG is active
    expect(utils.queryByText('Your slab rate')).toBeNull();
  });

  it('switching to slab mode recomputes post-tax figures at the slab rate', () => {
    mockCommittedRatio = 3;
    mockTaxMode = 'slab';
    mockSlabRate = 0.3;
    mockEntries = [mk('a', 15)];

    const utils = render(<TaxRRDisciplineCard />);

    // 30 × 0.7 = 21 → "21"; 15 × 0.7 = 10.5 → "11" (rounded)
    expect(utils.getByText('Post-tax ₹21')).toBeTruthy();
    expect(utils.getByText('Post-tax ₹11')).toBeTruthy();
    // Slab chips now visible
    expect(utils.getByText('Your slab rate')).toBeTruthy();
    expect(getByA11yLabel(utils, '30%')).toBeTruthy();
  });

  it('pressing the slab chip calls setTaxMode(slab); pressing 20% calls setSlabRate(0.2)', () => {
    mockCommittedRatio = 3;
    mockTaxMode = 'slab';
    mockEntries = [mk('a', 15)];

    const utils = render(<TaxRRDisciplineCard />);

    fireEvent.press(getByA11yLabel(utils, 'Short-term (income slab)'));
    expect(mockSetTaxMode).toHaveBeenCalledWith('slab');

    fireEvent.press(getByA11yLabel(utils, '20%'));
    expect(mockSetSlabRate).toHaveBeenCalledWith(0.2);
  });

  it('shows both tax models side by side with their respective gaps', () => {
    mockCommittedRatio = 3;
    mockEntries = [mk('a', 15)]; // cut at 1:1.5 → disciplined-you keeps ₹30

    const utils = render(<TaxRRDisciplineCard />);

    expect(utils.getByText('Both models side by side')).toBeTruthy();
    expect(utils.getByText('LTCG 12.5% gap')).toBeTruthy();
    expect(utils.getByText('Slab 30% gap')).toBeTruthy();
    // LTCG gap: (30 − 15) × 0.875 = 13.125 → ₹13; slab gap: 15 × 0.7 = 10.5 → ₹11
    expect(utils.queryByText(/^₹13$/)).not.toBeNull();
    expect(utils.queryByText(/^₹11$/)).not.toBeNull();
  });

  it('comparison row follows the chosen slab rate', () => {
    mockCommittedRatio = 3;
    mockSlabRate = 0.2;
    mockEntries = [mk('a', 15)];

    const utils = render(<TaxRRDisciplineCard />);

    expect(utils.getByText('Slab 20% gap')).toBeTruthy();
    // Slab 20% gap: 15 × 0.8 = 12 → ₹12
    expect(utils.queryByText(/^₹12$/)).not.toBeNull();
  });

  it('shows ₹0 in both cells for a fully disciplined period', () => {
    mockCommittedRatio = 3;
    mockEntries = [mk('win', 30)]; // exactly 1:3 — no gap under any rate

    const utils = render(<TaxRRDisciplineCard />);

    // Both comparison cells show ₹0. The matcher also catches ancestors
    // that recursively contain the same text, so assert on leaf count via
    // a filter on instances that have no Text-children of their own.
    const leafZeroes = utils
      .getAllByText(/^₹0$/)
      .filter((inst) => !inst.children.some((c) => typeof c !== 'string'));
    expect(leafZeroes).toHaveLength(2);
  });
});
