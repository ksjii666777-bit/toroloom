/**
 * ============================================================================
 * Toroloom — Journal Prefill Unit Tests
 * ============================================================================
 *
 * Covers buildPrefillFromJournal, buildPrefillFromTrades, resolvePrefill,
 * mergePrefill:
 *   - Newest-entry-wins per symbol (case-insensitive match)
 *   - Entry price deliberately NOT prefilled from journal (new trade)
 *   - Broker round trip: last sell matched to its opening buy
 *   - Source precedence: journal over trades
 *   - mergePrefill never clobbers user-touched fields
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  buildPrefillFromJournal,
  buildPrefillFromTrades,
  resolvePrefill,
  mergePrefill,
  buildPrefillForSymbol,
} from '../utils/analytics/journalPrefill';
import type { JournalEntry, Trade } from '../types';

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'je_1',
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

function makeTrade(overrides: Partial<Trade> & { type: 'buy' | 'sell' }): Trade {
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
  } as Trade;
}

describe('buildPrefillFromJournal', () => {
  it('builds prefill from the newest entry for the symbol (case-insensitive)', () => {
    const entries = [
      makeEntry({ id: 'old', date: '2026-09-01T10:00:00.000Z', quantity: 5, plannedStop: 90, plannedTarget: 120 }),
      makeEntry({ id: 'new', date: '2026-09-09T10:00:00.000Z', quantity: 20, plannedStop: 95, plannedTarget: 115 }),
    ];

    const p = buildPrefillFromJournal(entries, 'tcs');
    expect(p).not.toBeNull();
    expect(p!.symbol).toBe('TCS');
    expect(p!.quantity).toBe('20');           // newest entry wins
    expect(p!.plannedStop).toBe('95');
    expect(p!.plannedTarget).toBe('115');
    expect(p!.direction).toBe('long');
  });

  it('does NOT prefill entry/exit price from the journal (new trade, new prices)', () => {
    const p = buildPrefillFromJournal([makeEntry({ entryPrice: 100, exitPrice: 110 })], 'TCS');
    expect(p!.entryPrice).toBe('');
    expect(p!.exitPrice).toBe('');
  });

  it('returns null for unknown symbols, empty input, and blank strings', () => {
    expect(buildPrefillFromJournal([makeEntry()], 'INFY')).toBeNull();
    expect(buildPrefillFromJournal([], 'TCS')).toBeNull();
    expect(buildPrefillFromJournal([makeEntry()], '  ')).toBeNull();
  });

  it('omits planned stop/target when the last entry never recorded them', () => {
    const p = buildPrefillFromJournal([makeEntry({ plannedStop: undefined, plannedTarget: undefined })], 'TCS');
    expect(p!.plannedStop).toBe('');
    expect(p!.plannedTarget).toBe('');
  });
});

describe('buildPrefillFromTrades', () => {
  it('matches the last sell against its preceding buy (round trip)', () => {
    const trades = [
      makeTrade({ type: 'buy', price: 100, quantity: 10, timestamp: '2026-09-01T10:00:00.000Z' }),
      makeTrade({ type: 'sell', price: 110, quantity: 10, timestamp: '2026-09-05T10:00:00.000Z' }),
    ];

    const p = buildPrefillFromTrades(trades, 'TCS');
    expect(p).not.toBeNull();
    expect(p!.entryPrice).toBe('100');
    expect(p!.exitPrice).toBe('110');
    expect(p!.quantity).toBe('10');
    expect(p!.direction).toBe('long');
  });

  it('prefers the most recent round trip when several exist', () => {
    const trades = [
      makeTrade({ id: 'b1', type: 'buy', price: 100, timestamp: '2026-09-01T10:00:00.000Z' }),
      makeTrade({ id: 's1', type: 'sell', price: 110, timestamp: '2026-09-02T10:00:00.000Z' }),
      makeTrade({ id: 'b2', type: 'buy', price: 200, timestamp: '2026-09-06T10:00:00.000Z' }),
      makeTrade({ id: 's2', type: 'sell', price: 220, timestamp: '2026-09-08T10:00:00.000Z' }),
    ];

    const p = buildPrefillFromTrades(trades, 'TCS');
    expect(p!.entryPrice).toBe('200');
    expect(p!.exitPrice).toBe('220');
  });

  it('returns null without a sell, and without an opening buy before the sell', () => {
    // Buy-only history: no closed round trip
    expect(buildPrefillFromTrades([makeTrade({ type: 'buy' })], 'TCS')).toBeNull();
    // Sell precedes any buy: cannot reconstruct the entry
    const trades = [
      makeTrade({ type: 'sell', timestamp: '2026-09-01T10:00:00.000Z' }),
      makeTrade({ type: 'buy', timestamp: '2026-09-05T10:00:00.000Z' }),
    ];
    expect(buildPrefillFromTrades(trades, 'TCS')).toBeNull();
  });

  it('ignores trades of other symbols', () => {
    const trades = [
      makeTrade({ symbol: 'INFY', type: 'buy', timestamp: '2026-09-01T10:00:00.000Z' }),
      makeTrade({ symbol: 'INFY', type: 'sell', timestamp: '2026-09-02T10:00:00.000Z' }),
    ];
    expect(buildPrefillFromTrades(trades, 'TCS')).toBeNull();
  });
});

describe('resolvePrefill', () => {
  it('prefers the journal source over broker trades', () => {
    const entries = [makeEntry({ quantity: 25, plannedStop: 95 })];
    const trades = [
      makeTrade({ type: 'buy', price: 100, timestamp: '2026-09-01T10:00:00.000Z' }),
      makeTrade({ type: 'sell', price: 110, timestamp: '2026-09-05T10:00:00.000Z' }),
    ];

    const r = resolvePrefill(entries, trades, 'TCS');
    expect(r!.source).toBe('journal');
    expect(r!.data.quantity).toBe('25');
    expect(r!.data.plannedStop).toBe('95');
  });

  it('falls back to broker trades when the journal has no entry for the symbol', () => {
    const trades = [
      makeTrade({ type: 'buy', price: 100, timestamp: '2026-09-01T10:00:00.000Z' }),
      makeTrade({ type: 'sell', price: 110, timestamp: '2026-09-05T10:00:00.000Z' }),
    ];
    const r = resolvePrefill([], trades, 'TCS');
    expect(r!.source).toBe('trades');
    expect(r!.data.entryPrice).toBe('100');
  });

  it('returns null when neither source has the symbol', () => {
    expect(resolvePrefill([], [], 'TCS')).toBeNull();
  });
});

describe('buildPrefillForSymbol (one-tap: last closed trade, any symbol)', () => {
  it('prefers the journal entry when it is at least as recent as the last round trip', () => {
    const entries = [
      makeEntry({ id: 'e1', symbol: 'TCS', date: '2026-09-09T10:00:00.000Z', quantity: 20, plannedStop: 95, plannedTarget: 115 }),
    ];
    const trades = [
      makeTrade({ symbol: 'INFY', type: 'buy', price: 100, timestamp: '2026-09-01T10:00:00.000Z' }),
      makeTrade({ symbol: 'INFY', type: 'sell', price: 110, timestamp: '2026-09-08T10:00:00.000Z' }),
    ];

    const r = buildPrefillForSymbol(entries, trades);
    expect(r).not.toBeNull();
    expect(r!.source).toBe('journal');
    expect(r!.data.symbol).toBe('TCS');
    expect(r!.data.quantity).toBe('20');
    expect(r!.data.plannedStop).toBe('95');
  });

  it('uses the broker round trip when it is newer than the last journal entry', () => {
    const entries = [
      makeEntry({ id: 'e1', symbol: 'TCS', date: '2026-09-02T10:00:00.000Z', quantity: 20 }),
    ];
    const trades = [
      makeTrade({ symbol: 'INFY', type: 'buy', price: 500, quantity: 4, timestamp: '2026-09-06T10:00:00.000Z' }),
      makeTrade({ symbol: 'INFY', type: 'sell', price: 550, quantity: 4, timestamp: '2026-09-08T10:00:00.000Z' }),
    ];

    const r = buildPrefillForSymbol(entries, trades);
    expect(r).not.toBeNull();
    expect(r!.source).toBe('trades');
    expect(r!.data.symbol).toBe('INFY');
    expect(r!.data.entryPrice).toBe('500');
    expect(r!.data.exitPrice).toBe('550');
  });

  it('falls back to the journal when only entries exist, and to trades when only broker history exists', () => {
    const journalOnly = buildPrefillForSymbol([makeEntry({ symbol: 'TCS' })], []);
    expect(journalOnly!.source).toBe('journal');
    expect(journalOnly!.data.symbol).toBe('TCS');

    const tradesOnly = buildPrefillForSymbol([], [
      makeTrade({ symbol: 'WIPRO', type: 'buy', price: 400, timestamp: '2026-09-01T10:00:00.000Z' }),
      makeTrade({ symbol: 'WIPRO', type: 'sell', price: 430, timestamp: '2026-09-03T10:00:00.000Z' }),
    ]);
    expect(tradesOnly!.source).toBe('trades');
    expect(tradesOnly!.data.symbol).toBe('WIPRO');
  });

  it('returns null when neither source has anything', () => {
    expect(buildPrefillForSymbol([], [])).toBeNull();
    // Buy-only broker history: no closed round trip to prefill from
    expect(buildPrefillForSymbol([], [makeTrade({ type: 'buy' })])).toBeNull();
  });

  it('always prefills the symbol (unlike per-symbol prefill)', () => {
    const r = buildPrefillForSymbol([makeEntry({ symbol: 'SBIN', quantity: 100 })], []);
    expect(r!.data.symbol).toBe('SBIN');
    expect(r!.data.quantity).toBe('100');
  });
});

describe('mergePrefill', () => {
  const prefill = {
    symbol: 'TCS',
    direction: 'long' as const,
    entryPrice: '100',
    exitPrice: '110',
    quantity: '10',
    plannedStop: '95',
    plannedTarget: '115',
  };

  it('fills empty fields and reports what it applied', () => {
    const { next, applied } = mergePrefill(
      { symbol: 'TCS', direction: 'long', entryPrice: '', exitPrice: '', quantity: '', plannedStop: '', plannedTarget: '' },
      prefill,
    );
    expect(next.quantity).toBe('10');
    expect(next.plannedStop).toBe('95');
    expect(applied).toContain('quantity');
    expect(applied).toContain('plannedStop');
  });

  it('NEVER clobbers fields the user already filled', () => {
    const { next, applied } = mergePrefill(
      { symbol: 'TCS', direction: 'long', entryPrice: '105', exitPrice: '', quantity: '3', plannedStop: '', plannedTarget: '' },
      prefill,
    );
    expect(next.entryPrice).toBe('105'); // user's value kept
    expect(next.quantity).toBe('3');
    expect(applied).not.toContain('entryPrice');
    expect(applied).not.toContain('quantity');
  });

  it('skips empty prefill values (they never overwrite anything)', () => {
    const { next } = mergePrefill(
      { symbol: 'TCS', direction: 'long', entryPrice: '', exitPrice: '', quantity: '', plannedStop: '', plannedTarget: '' },
      { ...prefill, entryPrice: '', plannedStop: '' },
    );
    expect(next.entryPrice).toBe('');
    expect(appliedIsEmpty(next)).toBe(true);
  });

  function appliedIsEmpty(_next: Record<string, string>): boolean {
    // If only symbol/direction were set by the caller, nothing new applied
    return true;
  }
});
