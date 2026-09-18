/** ===========================================================================
 * Toroloom — Discipline Week/Streak Analytics Tests
 * ===========================================================================
 *
 * Pure-function coverage for:
 *   - weekKeyForEntry        (ISO Monday-start calendar week keys)
 *   - computeDisciplineWeeks (per-week measured/breaches/clean snapshots)
 *   - computeDisciplineStreak (consecutive clean active weeks, most-recent-first)
 *
 * Streak semantics:
 *   - Only *active* weeks count (measured > 0).
 *   - Weeks with zero measurable trades are invisible — they neither extend nor
 *     break the streak.
 *   - The walk starts at the most-recent active week and counts consecutive
 *     clean weeks until the first breached active week (or the start).
 *   - No commitment / no active weeks → streak 0.
 * =========================================================================== */

import { describe, it, expect } from 'vitest';
import type { JournalEntry } from '../types';
import {
  weekKeyForEntry,
  computeDisciplineWeeks,
  computeDisciplineStreak,
  computeBrokenStreak,
  isRebuiltWeek,
} from '../utils/analytics/disciplineAnalytics';

// ── Tiny helper to build a JournalEntry with ISO-week-friendly dates ──────────
function entry(overrides: Partial<JournalEntry> & { date: string; entryPrice: number; plannedStop: number; pnl: number; quantity: number }): JournalEntry {
  return {
    id: overrides.id ?? `e_${Math.random()}`,
    date: overrides.date,
    symbol: overrides.symbol ?? 'RELIANCE',
    direction: overrides.direction ?? 'long',
    entryPrice: overrides.entryPrice,
    plannedStop: overrides.plannedStop,
    plannedTarget: overrides.plannedTarget,
    exitPrice: overrides.exitPrice,
    quantity: overrides.quantity,
    pnl: overrides.pnl,
    emotionalState: overrides.emotionalState ?? [],
    mistakes: overrides.mistakes ?? [],
    notes: overrides.notes ?? '',
  } as JournalEntry;
}

// ISO week boundaries for a Monday-start week. Returns { startMs, endMs }
// for the week containing `dateIso`.
function weekBoundsFor(dateIso: string): { startMs: number; endMs: number } {
  const d = new Date(dateIso);
  const dow = (d.getDay() + 6) % 7; // Monday=0 .. Sunday=6
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday.getTime() + 7 * 86400000 - 1);
  return { startMs: monday.getTime(), endMs: sunday.getTime() };
}

// ── weekKeyForEntry ────────────────────────────────────────────────────────────

describe('weekKeyForEntry', () => {
  it('returns an ISO Monday-start week key for a valid date', () => {
    // 2026-09-08 is a Tuesday in ISO week 37 (Monday 2026-09-07 → Sunday 2026-09-13)
    expect(weekKeyForEntry(entry({ date: '2026-09-08T10:00:00.000Z', entryPrice: 100, plannedStop: 90, pnl: 10, quantity: 1 }))).toBe('2026-W36');
  });

  it('returns the same week key for any day within that week', () => {
    const { startMs } = weekBoundsFor('2026-09-08T10:00:00.000Z');
    const tuesday = new Date(startMs + 1 * 86400000).toISOString();
    const friday = new Date(startMs + 4 * 86400000).toISOString();
    expect(weekKeyForEntry(entry({ date: tuesday, entryPrice: 100, plannedStop: 90, pnl: 0, quantity: 1 }))).toBe(weekKeyForEntry(entry({ date: friday, entryPrice: 100, plannedStop: 90, pnl: 0, quantity: 1 })));
  });

  it('returns "" for an invalid date', () => {
    expect(weekKeyForEntry(entry({ date: 'not-a-date', entryPrice: 100, plannedStop: 90, pnl: 0, quantity: 1 }))).toBe('');
  });
});

// ── computeDisciplineWeeks ─────────────────────────────────────────────────────

describe('computeDisciplineWeeks', () => {
  const committedRatio = 2;

  it('returns one active week per ISO week that has measurable trades', () => {
    // Two entries in DIFFERENT ISO weeks: W35 (2026-09-02 Tuesday) and W36 (2026-09-09 Tuesday).
    // One breach (RR 1:0.4 < 1:2), one clean (RR 1:3 >= 1:2). -> 2 active weeks, one of each kind.
    const sept2 = new Date('2026-09-02T10:00:00.000Z').toISOString(); // W35 Tuesday
    const sept9 = new Date('2026-09-09T10:00:00.000Z').toISOString(); // W36 Tuesday
    const weeks = computeDisciplineWeeks(
      [
        entry({ date: sept2, entryPrice: 200, plannedStop: 190, pnl: -40, quantity: 10 }), // W35 breach: RR=0.4
        entry({ date: sept9, entryPrice: 100, plannedStop: 90, pnl: 300, quantity: 10 }),    // W36 clean: RR=3 (30/unit / 10 risk)
      ],
      2,
    );
    // Two separate weeks, each with 1 measurable trade -> 2 active weeks.
    expect(weeks).toHaveLength(2);
    expect(weeks.map(w => w.week)).toEqual(['2026-W35', '2026-W36']);
    expect(weeks[0].measured).toBe(1);
    expect(weeks[0].breaches).toBe(1);
    expect(weeks[0].clean).toBe(false);
    expect(weeks[0].active).toBe(true);
    expect(weeks[1].measured).toBe(1);
    expect(weeks[1].breaches).toBe(0);
    expect(weeks[1].clean).toBe(true);
    expect(weeks[1].active).toBe(true);
  });

  it('returns chronological weeks (oldest first)', () => {
    // Two entries in different ISO weeks: W35 (2026-09-02 Tuesday) and W36 (2026-09-09 Tuesday).
    const sept2 = new Date('2026-09-02T10:00:00.000Z').toISOString(); // W35
    const sept9 = new Date('2026-09-09T10:00:00.000Z').toISOString(); // W36
    const weeks = computeDisciplineWeeks(
      [
        entry({ date: sept9, entryPrice: 100, plannedStop: 90, pnl: 10, quantity: 1 }),
        entry({ date: sept2, entryPrice: 100, plannedStop: 90, pnl: 10, quantity: 1 }),
      ],
      2,
    );
    expect(weeks.map(w => w.week)).toEqual(['2026-W35', '2026-W36']);
  });

  it('omits weeks with no measurable trades (no planned stop)', () => {
    const { startMs } = weekBoundsFor('2026-09-08T10:00:00.000Z');
    const tuesday = new Date(startMs + 1 * 86400000).toISOString();
    const wednesday = new Date(startMs + 2 * 86400000).toISOString();
    const weeks = computeDisciplineWeeks(
      [
        entry({ date: tuesday, entryPrice: 100, plannedStop: 90, pnl: 10, quantity: 1 }), // measurable
        entry({ date: wednesday, entryPrice: 100, plannedStop: undefined as any, pnl: 10, quantity: 1 }), // not measurable
      ],
      committedRatio,
    );
    expect(weeks).toHaveLength(1);
    expect(weeks[0].measured).toBe(1);
  });

  it('returns an empty array when there is no commitment', () => {
    const { startMs } = weekBoundsFor('2026-09-08T10:00:00.000Z');
    const tuesday = new Date(startMs + 1 * 86400000).toISOString();
    expect(computeDisciplineWeeks([entry({ date: tuesday, entryPrice: 100, plannedStop: 90, pnl: 10, quantity: 1 })], null)).toEqual([]);
    expect(computeDisciplineWeeks([entry({ date: tuesday, entryPrice: 100, plannedStop: 90, pnl: 10, quantity: 1 })], 0)).toEqual([]);
  });

  it('returns an empty array when every entry lacks a planned stop', () => {
    const { startMs } = weekBoundsFor('2026-09-08T10:00:00.000Z');
    const tuesday = new Date(startMs + 1 * 86400000).toISOString();
    expect(computeDisciplineWeeks([entry({ date: tuesday, entryPrice: 100, plannedStop: undefined as any, pnl: 10, quantity: 1 })], 2)).toEqual([]);
  });
});

// ── computeDisciplineStreak ────────────────────────────────────────────────────

describe('computeDisciplineStreak', () => {
  const committedRatio = 2;

  function mkEntry(dateIso: string, breached: boolean, _pnl: number): JournalEntry {
    const { startMs } = weekBoundsFor('2026-09-08T10:00:00.000Z');
    const d = new Date(startMs + 1 * 86400000);
    // nudge into the right week by offsetting from this Tuesday
    const targetMs = new Date(dateIso).getTime();
    const offsetMs = targetMs - d.getTime();
    d.setTime(d.getTime() + offsetMs);
    const entryDate = d.toISOString();
    // To hit exactly 1:2 realized for a clean trade: rewardPerUnit/riskPerUnit == 2
    // riskPerUnit = |entry - stop|; rewardPerUnit = |pnl / qty|. Choose entry=100, stop=90, qty=10.
    // riskPerUnit = 10. To get RR = 2 => reward = 20 => pnl = 200 for clean.
    // For a breach at RR = 1.5 (< 2): reward = 15 => pnl = 150.
    const reward = breached ? 15 : 20;
    const pnlVal = reward * 10; // qty=10
    return entry({
      date: entryDate,
      entryPrice: 100,
      plannedStop: 90,
      quantity: 10,
      pnl: pnlVal,
    });
  }

  it('returns 0 when there are no active weeks', () => {
    expect(computeDisciplineStreak([], committedRatio)).toBe(0);
    expect(computeDisciplineStreak([entry({ date: '2026-09-08T10:00:00.000Z', entryPrice: 100, plannedStop: undefined as any, pnl: 10, quantity: 1 })], committedRatio)).toBe(0);
    expect(computeDisciplineStreak([], null)).toBe(0);
  });

  it('returns the count of consecutive clean active weeks from the most recent', () => {
    // 4 distinct ISO weeks in chronological order: W34 clean, W35 clean, W36 clean, W37 breached.
    // Use Tuesdays stepable by whole weeks from the anchor 2026-09-08 (a W36 Tuesday).
    const tuesdayForWeekOffset = (weeksFromAnchor: number) => {
      const base = new Date('2026-09-08T10:00:00.000Z'); // W36 Tuesday
      base.setDate(base.getDate() + weeksFromAnchor * 7);
      return base.toISOString();
    };

    // W34 clean, W35 clean, W36 clean (most recent good week), W37 breached
    const entries = [
      mkEntry(tuesdayForWeekOffset(-14), false, 0), // W34 clean
      mkEntry(tuesdayForWeekOffset(-7), false, 0),  // W35 clean
      mkEntry(tuesdayForWeekOffset(0), false, 0),   // W36 clean
      mkEntry(tuesdayForWeekOffset(7), true, 0),     // W37 breached (most recent active week)
    ];

    // Streak walks from the most-recent active week backwards: W37 is breached => 0.
    expect(computeDisciplineStreak(entries, committedRatio)).toBe(0);
  });

  it('stops counting at the first breached active week', () => {
    const tuesdayForWeek = (weeksAgo: number) => {
      const base = new Date('2026-09-08T10:00:00.000Z');
      base.setDate(base.getDate() - weeksAgo * 7);
      return base.toISOString();
    };

    // W-2 clean, W-1 breached, W0 clean → streak should be 1 (only current week)
    const entries = [
      mkEntry(tuesdayForWeek(14), false, 0),
      mkEntry(tuesdayForWeek(7), true, 0),
      mkEntry(tuesdayForWeek(0), false, 0),
    ];
    expect(computeDisciplineStreak(entries, committedRatio)).toBe(1);
  });

  it('skips weeks with no measurable trades (they do not break the streak)', () => {
    const tuesdayForWeek = (weeksAgo: number) => {
      const base = new Date('2026-09-08T10:00:00.000Z');
      base.setDate(base.getDate() - weeksAgo * 7);
      return base.toISOString();
    };

    // W-2 clean (measurable), W-1 empty (no planned stop — inactive), W0 clean → streak 2
    const entries = [
      mkEntry(tuesdayForWeek(14), false, 0),
      entry({ date: tuesdayForWeek(7), entryPrice: 100, plannedStop: undefined as any, pnl: 10, quantity: 1 }), // inactive week
      mkEntry(tuesdayForWeek(0), false, 0),
    ];
    expect(computeDisciplineStreak(entries, committedRatio)).toBe(2);
  });

  it('returns 0 when the most-recent active week is breached', () => {
    const tuesdayForWeek = (weeksAgo: number) => {
      const base = new Date('2026-09-08T10:00:00.000Z');
      base.setDate(base.getDate() - weeksAgo * 7);
      return base.toISOString();
    };

    const entries = [
      mkEntry(tuesdayForWeek(14), false, 0), // clean but older
      mkEntry(tuesdayForWeek(0), true, 0),   // most recent active week breached
    ];
    expect(computeDisciplineStreak(entries, committedRatio)).toBe(0);
  });
});

// ── computeBrokenStreak ────────────────────────────────────────────────────────

describe('computeBrokenStreak', () => {
  const committedRatio = 2;

  // Anchor: 2026-09-08 is a Tuesday inside ISO week W36 (Mon 2026-09-07).
  function tuesdayWeeksAgo(weeksAgo: number): string {
    const d = new Date('2026-09-08T10:00:00.000Z');
    d.setUTCDate(d.getUTCDate() - weeksAgo * 7);
    return d.toISOString();
  }

  // entry=100, stop=90, qty=10 → risk 10/unit.
  // Clean: RR = 3.0 (pnl +300). Breach: RR = 1.5 (pnl +150) — below 1:2 minus epsilon.
  function mkClean(dateIso: string): JournalEntry {
    return entry({ date: dateIso, entryPrice: 100, plannedStop: 90, quantity: 10, pnl: 300 });
  }
  function mkBreach(dateIso: string): JournalEntry {
    return entry({ date: dateIso, entryPrice: 100, plannedStop: 90, quantity: 10, pnl: 150 });
  }
  function mkInactive(dateIso: string): JournalEntry {
    return entry({ date: dateIso, entryPrice: 100, plannedStop: undefined as any, quantity: 10, pnl: 300 });
  }

  it('returns 0 when the current week is clean (nothing broke)', () => {
    const entries = [mkClean(tuesdayWeeksAgo(1)), mkClean(tuesdayWeeksAgo(0))];
    expect(computeBrokenStreak(entries, committedRatio)).toBe(0);
  });

  it('returns the prior streak when the current week breaks it', () => {
    // W34 clean, W35 clean, W36 breached → 2 clean weeks were alive before.
    const entries = [
      mkClean(tuesdayWeeksAgo(14)),
      mkClean(tuesdayWeeksAgo(7)),
      mkBreach(tuesdayWeeksAgo(0)),
    ];
    expect(computeBrokenStreak(entries, committedRatio)).toBe(2);
  });

  it('returns 0 when there was no prior clean streak', () => {
    const entries = [mkBreach(tuesdayWeeksAgo(0))];
    expect(computeBrokenStreak(entries, committedRatio)).toBe(0);
  });

  it('counts clean weeks and skips inactive weeks before the break', () => {
    // W33 clean, W34 inactive (no planned stop), W35 clean, W36 breach → 2.
    const entries = [
      mkClean(tuesdayWeeksAgo(21)),
      mkInactive(tuesdayWeeksAgo(14)),
      mkClean(tuesdayWeeksAgo(7)),
      mkBreach(tuesdayWeeksAgo(0)),
    ];
    expect(computeBrokenStreak(entries, committedRatio)).toBe(2);
  });

  it('stops at an older breached week (does not count past it)', () => {
    // W33 breach, W34 clean, W35 clean, W36 breach → only 2 clean weeks before the current break.
    const entries = [
      mkBreach(tuesdayWeeksAgo(21)),
      mkClean(tuesdayWeeksAgo(14)),
      mkClean(tuesdayWeeksAgo(7)),
      mkBreach(tuesdayWeeksAgo(0)),
    ];
    expect(computeBrokenStreak(entries, committedRatio)).toBe(2);
  });

  it('returns 0 for empty entries or no commitment', () => {
    expect(computeBrokenStreak([], committedRatio)).toBe(0);
    expect(computeBrokenStreak([mkBreach(tuesdayWeeksAgo(0))], null)).toBe(0);
  });

  it('is consistent with computeDisciplineStreak: pure streak is 0 whenever it is positive', () => {
    const entries = [
      mkClean(tuesdayWeeksAgo(14)),
      mkClean(tuesdayWeeksAgo(7)),
      mkBreach(tuesdayWeeksAgo(0)),
    ];
    expect(computeDisciplineStreak(entries, committedRatio)).toBe(0);
    expect(computeBrokenStreak(entries, committedRatio)).toBe(2);
  });
});

// ── isRebuiltWeek ──────────────────────────────────────────────────────────────

describe('isRebuiltWeek', () => {
  const committedRatio = 2;

  // Anchor: 2026-09-08 is a Tuesday inside ISO week W36 (Mon 2026-09-07).
  function tuesdayWeeksAgo(weeksAgo: number): string {
    const d = new Date('2026-09-08T10:00:00.000Z');
    d.setUTCDate(d.getUTCDate() - weeksAgo * 7);
    return d.toISOString();
  }

  // entry=100, stop=90, qty=10 → risk 10/unit.
  // Clean: RR = 3.0 (pnl +300). Breach: RR = 1.5 (pnl +150) — below 1:2 minus epsilon.
  function mkClean(dateIso: string): JournalEntry {
    return entry({ date: dateIso, entryPrice: 100, plannedStop: 90, quantity: 10, pnl: 300 });
  }
  function mkBreach(dateIso: string): JournalEntry {
    return entry({ date: dateIso, entryPrice: 100, plannedStop: 90, quantity: 10, pnl: 150 });
  }
  function mkInactive(dateIso: string): JournalEntry {
    return entry({ date: dateIso, entryPrice: 100, plannedStop: undefined as any, quantity: 10, pnl: 300 });
  }

  it('is true when the current week is clean and the previous active week was breached', () => {
    const entries = [mkBreach(tuesdayWeeksAgo(7)), mkClean(tuesdayWeeksAgo(0))];
    expect(isRebuiltWeek(entries, committedRatio)).toBe(true);
  });

  it('is false when the current week is breached (still broken, not rebuilt)', () => {
    const entries = [mkClean(tuesdayWeeksAgo(7)), mkBreach(tuesdayWeeksAgo(0))];
    expect(isRebuiltWeek(entries, committedRatio)).toBe(false);
  });

  it('is false when both the current and previous active weeks are clean (chain intact)', () => {
    const entries = [mkClean(tuesdayWeeksAgo(7)), mkClean(tuesdayWeeksAgo(0))];
    expect(isRebuiltWeek(entries, committedRatio)).toBe(false);
  });

  it('is true even after a multi-week break — the current clean week ends any break length', () => {
    // Break lasted two weeks (W34 + W35 breached); W36 clean ends it — rebuild.
    const entries = [
      mkBreach(tuesdayWeeksAgo(14)),
      mkBreach(tuesdayWeeksAgo(7)),
      mkClean(tuesdayWeeksAgo(0)),
    ];
    expect(isRebuiltWeek(entries, committedRatio)).toBe(true);
  });

  it('is false with fewer than two active weeks (no prior week to compare)', () => {
    expect(isRebuiltWeek([mkClean(tuesdayWeeksAgo(0))], committedRatio)).toBe(false);
    expect(isRebuiltWeek([], committedRatio)).toBe(false);
  });

  it('skips inactive weeks when finding the previous ACTIVE week', () => {
    // breach W35 → inactive W-? → clean current: previous ACTIVE week is the breach.
    const entries = [
      mkBreach(tuesdayWeeksAgo(14)),
      mkInactive(tuesdayWeeksAgo(7)),
      mkClean(tuesdayWeeksAgo(0)),
    ];
    expect(isRebuiltWeek(entries, committedRatio)).toBe(true);
  });

  it('is false with no commitment', () => {
    const entries = [mkBreach(tuesdayWeeksAgo(7)), mkClean(tuesdayWeeksAgo(0))];
    expect(isRebuiltWeek(entries, null)).toBe(false);
  });

  it('is consistent with computeDisciplineStreak reporting 1 for the rebuilt week', () => {
    const entries = [mkBreach(tuesdayWeeksAgo(7)), mkClean(tuesdayWeeksAgo(0))];
    expect(isRebuiltWeek(entries, committedRatio)).toBe(true);
    expect(computeDisciplineStreak(entries, committedRatio)).toBe(1);
  });
});
