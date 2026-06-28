/**
 * ============================================================================
 * Toroloom — Behavior Journal Store Unit Tests
 * ============================================================================
 *
 * Covers the Zustand store and helper exports:
 *   - Initial state: entries, metrics, reports
 *   - Metrics computation: win rate, avg PnL, streaks, mistake frequency
 *   - Weekly reports: grouping, improvement tips, sorting
 *   - CRUD: addEntry, deleteEntry
 *   - Filtering: getFilteredEntries (all, week, month)
 *   - Modal state: setShowEntryModal, setEditingEntry
 *   - Exported constants: MISTAKE_LABELS, ALL_EMOTIONS, ALL_MISTAKES
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/behavioralJournalStore.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useBehaviorJournalStore, MISTAKE_LABELS, ALL_EMOTIONS, ALL_MISTAKES, mockJournalEntries } from '../store/behavioralJournalStore';

describe('Behavioral Journal Store', () => {
  beforeEach(() => {
    // Fully reset store state to initial mock data for test isolation
    useBehaviorJournalStore.setState({ entries: [...mockJournalEntries], showEntryModal: false, editingEntry: null });
    useBehaviorJournalStore.getState().recompute();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Initial State
  // ─────────────────────────────────────────────────────────────────────────

  describe('Initial State', () => {
    it('should have 10 mock entries', () => {
      const entries = useBehaviorJournalStore.getState().entries;
      expect(entries).toHaveLength(10);
    });

    it('should have computed allMetrics', () => {
      const metrics = useBehaviorJournalStore.getState().allMetrics;
      expect(metrics.totalTrades).toBe(10);
      expect(metrics.winningTrades + metrics.losingTrades).toBe(10);
      expect(metrics.winRate).toBeGreaterThan(0);
      expect(metrics.winRate).toBeLessThanOrEqual(100);
    });

    it('should have generated weekly reports', () => {
      const reports = useBehaviorJournalStore.getState().reports;
      expect(reports.length).toBeGreaterThanOrEqual(1);
      expect(reports[0].weekStart).toBeDefined();
      expect(reports[0].metrics).toBeDefined();
      expect(reports[0].journalEntries.length).toBeGreaterThan(0);
    });

    it('should start with modal closed and no editing entry', () => {
      expect(useBehaviorJournalStore.getState().showEntryModal).toBe(false);
      expect(useBehaviorJournalStore.getState().editingEntry).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Metrics Computation
  // ─────────────────────────────────────────────────────────────────────────

  describe('Metrics Computation', () => {
    it('should compute correct win rate from mock data', () => {
      const metrics = useBehaviorJournalStore.getState().allMetrics;
      // 10 entries: je_1(+2500), je_2(-600), je_3(+450), je_4(+1500), je_5(-1000),
      // je_6(+900), je_7(-900), je_8(+400), je_9(+750), je_10(-500)
      // Wins: 6 (je_1, je_3, je_4, je_6, je_8, je_9)
      // Losses: 4 (je_2, je_5, je_7, je_10)
      expect(metrics.winningTrades).toBe(6);
      expect(metrics.losingTrades).toBe(4);
      expect(metrics.winRate).toBe(60);
    });

    it('should compute total P&L', () => {
      const metrics = useBehaviorJournalStore.getState().allMetrics;
      const totalPnl = mockJournalEntries.reduce((s, e) => s + e.pnl, 0);
      expect(metrics.avgPnl * metrics.totalTrades).toBeCloseTo(totalPnl, 0);
    });

    it('should compute profit factor', () => {
      const metrics = useBehaviorJournalStore.getState().allMetrics;
      // Gross wins: 2500 + 450 + 1500 + 900 + 400 + 750 = 6500
      // Gross losses: |-600 + -1000 + -900 + -500| = 3000
      // Profit factor: 6500/3000 ≈ 2.17
      expect(metrics.profitFactor).toBeGreaterThan(1);
      expect(metrics.profitFactor).toBeLessThan(3);
    });

    it('should have maxConsecutiveWins and maxConsecutiveLosses', () => {
      const metrics = useBehaviorJournalStore.getState().allMetrics;
      expect(metrics.maxConsecutiveWins).toBeGreaterThanOrEqual(0);
      expect(metrics.maxConsecutiveLosses).toBeGreaterThanOrEqual(0);
    });

    it('should track mistake frequency', () => {
      const metrics = useBehaviorJournalStore.getState().allMetrics;
      for (const mistake of ALL_MISTAKES) {
        expect(metrics.mistakeFrequency[mistake]).toBeDefined();
        expect(metrics.mistakeFrequency[mistake]).toBeGreaterThanOrEqual(0);
      }
      // 'held_too_long' occurs in je_2
      expect(metrics.mistakeFrequency.held_too_long).toBeGreaterThanOrEqual(1);
      expect(metrics.mistakeFrequency.impulsive_entry).toBeGreaterThanOrEqual(1);
    });

    it('should track emotional breakdown', () => {
      const metrics = useBehaviorJournalStore.getState().allMetrics;
      for (const emotion of ALL_EMOTIONS) {
        expect(metrics.emotionalBreakdown[emotion]).toBeDefined();
      }
      expect(metrics.emotionalBreakdown.calm).toBeGreaterThanOrEqual(4);
    });

    it('should have non-null bestDay and worstDay', () => {
      const metrics = useBehaviorJournalStore.getState().allMetrics;
      expect(metrics.bestDay).toBeTruthy();
      expect(metrics.worstDay).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Weekly Reports
  // ─────────────────────────────────────────────────────────────────────────

  describe('Weekly Reports', () => {
    it('should generate reports sorted newest first', () => {
      const reports = useBehaviorJournalStore.getState().reports;
      for (let i = 1; i < reports.length; i++) {
        expect(new Date(reports[i - 1].weekStart).getTime())
          .toBeGreaterThanOrEqual(new Date(reports[i].weekStart).getTime());
      }
    });

    it('should have improvementTip for each report', () => {
      const reports = useBehaviorJournalStore.getState().reports;
      for (const report of reports) {
        expect(report.improvementTip).toBeTruthy();
        expect(typeof report.improvementTip).toBe('string');
      }
    });

    it('should have topMistake and dominantEmotion', () => {
      const reports = useBehaviorJournalStore.getState().reports;
      expect(reports[0].topMistake).toBeDefined();
      expect(reports[0].dominantEmotion).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('CRUD — Add Entry', () => {
    it('should add a new entry', () => {
      const store = useBehaviorJournalStore.getState();
      const prevCount = store.entries.length;

      store.addEntry({
        date: new Date().toISOString(),
        symbol: 'TEST',
        direction: 'long',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 10,
        pnl: 100,
        pnlPercent: 1.0,
        holdingPeriod: '1h',
        emotionalState: 'calm',
        mistakes: [],
        planCompliance: 100,
        notes: 'Test entry',
        setupType: 'breakout',
        exitReason: 'target',
        tags: ['TEST'],
      });

      const entries = useBehaviorJournalStore.getState().entries;
      expect(entries).toHaveLength(prevCount + 1);
      expect(entries[0].symbol).toBe('TEST');
      expect(entries[0].id).toContain('je_');
    });

    it('should recalculate metrics after adding entry', () => {
      const store = useBehaviorJournalStore.getState();
      const prevWinRate = store.allMetrics.winRate;

      store.addEntry({
        date: new Date().toISOString(),
        symbol: 'TEST2', direction: 'long',
        entryPrice: 100, exitPrice: 90,
        quantity: 10, pnl: -100, pnlPercent: -1.0,
        holdingPeriod: '1h', emotionalState: 'anxious',
        mistakes: [], planCompliance: 50,
        notes: 'Loss', setupType: 'breakout',
        exitReason: 'stop_loss', tags: [],
      });

      const metrics = useBehaviorJournalStore.getState().allMetrics;
      // Added a loss, so win rate should decrease
      expect(metrics.winningTrades).toBe(6); // still 6 wins
      expect(metrics.losingTrades).toBe(5);  // now 5 losses
    });

    it('should regenerate reports after adding entry', () => {
      const store = useBehaviorJournalStore.getState();
      const prevReports = store.reports.length;

      store.addEntry({
        date: new Date().toISOString(),
        symbol: 'NEW', direction: 'long',
        entryPrice: 100, exitPrice: 110,
        quantity: 1, pnl: 10, pnlPercent: 0.5,
        holdingPeriod: '1h', emotionalState: 'calm',
        mistakes: [], planCompliance: 100,
        notes: '', setupType: 'breakout',
        exitReason: 'target', tags: [],
      });

      const reports = useBehaviorJournalStore.getState().reports;
      expect(reports.length).toBeGreaterThanOrEqual(prevReports);
    });
  });

  describe('CRUD — Delete Entry', () => {
    it('should delete an entry by id', () => {
      const store = useBehaviorJournalStore.getState();
      const prevCount = store.entries.length;

      store.deleteEntry('je_1');

      const entries = useBehaviorJournalStore.getState().entries;
      expect(entries).toHaveLength(prevCount - 1);
      expect(entries.find(e => e.id === 'je_1')).toBeUndefined();
    });

    it('should recalculate metrics after deleting entry', () => {
      const store = useBehaviorJournalStore.getState();

      store.deleteEntry('je_1'); // je_1 has pnl: 2500 (win)

      const metrics = useBehaviorJournalStore.getState().allMetrics;
      expect(metrics.winningTrades).toBe(5); // was 6, deleted 1 win
      expect(metrics.totalTrades).toBe(9);
    });

    it('should do nothing when deleting non-existent id', () => {
      const store = useBehaviorJournalStore.getState();
      const prevCount = store.entries.length;

      store.deleteEntry('non-existent-id');
      expect(useBehaviorJournalStore.getState().entries).toHaveLength(prevCount);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Filtering
  // ─────────────────────────────────────────────────────────────────────────

  describe('Filtering — getFilteredEntries', () => {
    it('should return all entries when period is "all"', () => {
      const all = useBehaviorJournalStore.getState().getFilteredEntries('all');
      expect(all).toHaveLength(10);
    });

    it('should return a subset for "week" period', () => {
      const week = useBehaviorJournalStore.getState().getFilteredEntries('week');
      expect(week.length).toBeGreaterThanOrEqual(0);
      expect(week.length).toBeLessThanOrEqual(10);
    });

    it('should return a subset for "month" period', () => {
      const month = useBehaviorJournalStore.getState().getFilteredEntries('month');
      expect(month.length).toBeGreaterThanOrEqual(0);
      expect(month.length).toBeLessThanOrEqual(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Modal State
  // ─────────────────────────────────────────────────────────────────────────

  describe('Modal State', () => {
    it('should set showEntryModal', () => {
      useBehaviorJournalStore.getState().setShowEntryModal(true);
      expect(useBehaviorJournalStore.getState().showEntryModal).toBe(true);

      useBehaviorJournalStore.getState().setShowEntryModal(false);
      expect(useBehaviorJournalStore.getState().showEntryModal).toBe(false);
    });

    it('should set editingEntry', () => {
      const entry = useBehaviorJournalStore.getState().entries[0];
      useBehaviorJournalStore.getState().setEditingEntry(entry);
      expect(useBehaviorJournalStore.getState().editingEntry?.id).toBe(entry.id);

      useBehaviorJournalStore.getState().setEditingEntry(null);
      expect(useBehaviorJournalStore.getState().editingEntry).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Exported Constants
  // ─────────────────────────────────────────────────────────────────────────

  describe('Exported Constants', () => {
    it('MISTAKE_LABELS should have labels for all mistake types', () => {
      for (const mistake of ALL_MISTAKES) {
        expect(MISTAKE_LABELS[mistake]).toBeTruthy();
        expect(typeof MISTAKE_LABELS[mistake]).toBe('string');
      }
    });

    it('MISTAKE_LABELS should have 11 entries', () => {
      expect(Object.keys(MISTAKE_LABELS)).toHaveLength(ALL_MISTAKES.length);
    });

    it('ALL_EMOTIONS should contain expected emotions', () => {
      expect(ALL_EMOTIONS).toContain('calm');
      expect(ALL_EMOTIONS).toContain('anxious');
      expect(ALL_EMOTIONS).toContain('neutral');
    });

    it('ALL_MISTAKES should contain expected mistakes', () => {
      expect(ALL_MISTAKES).toContain('no_stop_loss');
      expect(ALL_MISTAKES).toContain('fomo_entry');
      expect(ALL_MISTAKES).toContain('revenge_trade');
    });
  });
});
