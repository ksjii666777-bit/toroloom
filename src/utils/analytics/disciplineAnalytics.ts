/**
 * ============================================================================
 * Toroloom — R:R Discipline Analytics
 * ============================================================================
 *
 * Flags trades whose realized risk-reward fell below the user's COMMITTED
 * ratio (set at broker connect, e.g. 1:3). A trade "has R:R data" only when
 * the journal entry records the planned stop-loss — without a planned stop
 * there is no risk unit, so no honest R:R can be computed.
 *
 * Definitions (per closed trade):
 *   riskPerUnit   = |entryPrice − plannedStop|
 *   realizedRR    = |realizedPnlPerUnit| / riskPerUnit   (long and short alike)
 *   breach        = realizedRR < committedRatio          (with epsilon guard)
 *
 * Pure functions only — no store or navigation imports — so the weekly
 * report, the PDF export and the tests can all share one source of truth.
 * ============================================================================
 */

import type { JournalEntry } from '../../types';

/** Realized R:R for one journaled trade, or null when no planned stop exists */
export interface TradeRR {
  entryId: string;
  symbol: string;
  date: string;
  pnl: number;
  /** |entry − plannedStop| per unit */
  riskPerUnit: number;
  /** realized reward per unit of risk (e.g. 2.4 = trade achieved 1:2.4) */
  realizedRR: number;
  /** committed ratio this trade was measured against (e.g. 3 for 1:3) */
  committedRatio: number;
  /** true when realizedRR < committedRatio */
  breached: boolean;
}

/** Aggregate discipline picture for a period */
export interface DisciplineSummary {
  /** trades that recorded a planned stop (measurable ones) */
  measured: number;
  /** of the measured, how many fell below the commitment */
  breaches: number;
  /** breaches / measured (0 when measured === 0) */
  breachRate: number;
  /** average realized R:R across measured trades (0 when none) */
  avgRealizedRR: number;
  /** total ₹ lost to below-commitment trades (negative pnl only) */
  lossFromBreaches: number;
  /** per-trade detail, most-breach first */
  flagged: TradeRR[];
}

/**
 * Tolerance so float noise (e.g. 1.9899999…) and round-off still count as
 * honouring the commitment. Commitments are coarse (1:2, 1:3), so 0.05 is
 * far below any meaningful shortfall.
 */
const RR_EPSILON = 0.05;

/**
 * Compute realized R:R for a single journal entry against a committed ratio.
 * Returns null when the entry has no planned stop (risk unit unknown) or the
 * risk is zero (degenerate stop placement, e.g. stop === entry).
 */
export function computeTradeRR(entry: JournalEntry, committedRatio: number): TradeRR | null {
  if (committedRatio <= 0) return null;
  if (entry.plannedStop == null || !isFinite(entry.plannedStop)) return null;

  const riskPerUnit = Math.abs(entry.entryPrice - entry.plannedStop);
  if (riskPerUnit <= 0) return null;

  const rewardPerUnit = entry.pnl / entry.quantity;
  const realizedRR = Math.abs(rewardPerUnit) / riskPerUnit;

  return {
    entryId: entry.id,
    symbol: entry.symbol,
    date: entry.date,
    pnl: entry.pnl,
    riskPerUnit,
    realizedRR,
    committedRatio,
    breached: realizedRR < committedRatio - RR_EPSILON,
  };
}

/** Empty summary helper */
export function emptyDisciplineSummary(committedRatio: number | null): DisciplineSummary {
  return {
    measured: 0,
    breaches: 0,
    breachRate: 0,
    avgRealizedRR: 0,
    lossFromBreaches: 0,
    flagged: [],
    ...(committedRatio === null ? {} : {}),
  };
}

/**
 * Build the full discipline summary for a set of journaled trades.
 *
 * @param entries        journal entries (any order) — only those with a
 *                       plannedStop contribute
 * @param committedRatio user's committed R:R reward multiple (e.g. 3 = 1:3).
 *                       Pass null when no commitment exists — the summary
 *                       then reports measured=0 and the UI should prompt the
 *                       user to commit.
 */
export function computeDisciplineSummary(
  entries: JournalEntry[],
  committedRatio: number | null,
): DisciplineSummary {
  if (committedRatio == null || committedRatio <= 0) {
    return emptyDisciplineSummary(committedRatio);
  }

  const measured: TradeRR[] = [];
  for (const e of entries) {
    const rr = computeTradeRR(e, committedRatio);
    if (rr) measured.push(rr);
  }

  const breaches = measured.filter(t => t.breached);
  const totalRR = measured.reduce((s, t) => s + t.realizedRR, 0);
  const lossFromBreaches = breaches
    .filter(t => t.pnl < 0)
    .reduce((s, t) => s + t.pnl, 0);

  // Most-breach first, then by date descending
  const flagged = [...breaches].sort((a, b) => {
    if (a.realizedRR !== b.realizedRR) return a.realizedRR - b.realizedRR;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return {
    measured: measured.length,
    breaches: breaches.length,
    breachRate: measured.length > 0 ? breaches.length / measured.length : 0,
    avgRealizedRR: measured.length > 0 ? totalRR / measured.length : 0,
    lossFromBreaches,
    flagged,
  };
}

/** True when the summary is worth showing in the report */
export function hasDisciplineData(summary: DisciplineSummary): boolean {
  return summary.measured > 0;
}

// ──── Week-scoped discipline + streak ────────────────────────────────────────

/** ISO calendar-week key ("2026-W37") for a journal entry's date. */
export function weekKeyForEntry(entry: JournalEntry): string {
  const d = new Date(entry.date);
  if (!isFinite(d.getTime())) return '';
  // Monday-start ISO week: getWeekNumber returns (weekNumber, thursdayOfThatWeek).
  const ms = d.getTime();
  const thu = new Date(ms + (3 - ((d.getDay() + 6) % 7)) * 86400000);
  const jan1 = new Date(thu.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 - thu.getDay() + 1) / 7);
  return `${thu.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** One clean/active week in the streak accounting. */
export interface DisciplineWeek {
  /** ISO week key, e.g. "2026-W37" */
  week: string;
  /** ISO start-of-week timestamp (Monday 00:00 local) for display/navigation */
  weekStartMs: number;
  /** measurable trades in that week (planned-stop entries) */
  measured: number;
  /** breaches in that week against the committed ratio */
  breaches: number;
  /** clean if measured > 0 and breaches === 0 */
  clean: boolean;
  /** active if measured > 0 (whether clean or breached) — only active weeks count toward the streak */
  active: boolean;
}

/** Build per-calendar-week discipline snapshots from journal entries. */
export function computeDisciplineWeeks(
  entries: JournalEntry[],
  committedRatio: number | null,
): DisciplineWeek[] {
  if (committedRatio == null || committedRatio <= 0) return [];

  const byWeek = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const key = weekKeyForEntry(e);
    if (!key) continue;
    const arr = byWeek.get(key);
    if (arr) arr.push(e);
    else byWeek.set(key, [e]);
  }

  const weeks: DisciplineWeek[] = [];
  for (const [key, weekEntries] of byWeek.entries()) {
    const summary = computeDisciplineSummary(weekEntries, committedRatio);
    if (summary.measured === 0) continue; // no measurable trades this week → skip (neither clean nor breach)
    const d = new Date();
    const thu = new Date(
      d.getFullYear(), 0, 1 + ((parseInt(key.split('-W')[1], 10) - 1) * 7) + (1 - (d.getDay() + 6) % 7),
    );
    weeks.push({
      week: key,
      weekStartMs: thu.getTime(),
      measured: summary.measured,
      breaches: summary.breaches,
      clean: summary.breaches === 0,
      active: true,
    });
  }

  // Chronological (oldest → newest) for streak walking.
  weeks.sort((a, b) => a.weekStartMs - b.weekStartMs);
  return weeks;
}

/** Consecutive clean weeks (most-recent-first walk), counting only weeks that had
 * at least one measurable trade. Weeks with zero measurable trades do NOT break the
 * streak — they're simply invisible to it.
 *
 * A streak of N means: the last N *active* weeks each had breakdowns > 0 and breaches === 0.
 * Returns 0 when there are no active weeks at all (no measurable trades ever, or no
 * commitment).
 */
export function computeDisciplineStreak(
  entries: JournalEntry[],
  committedRatio: number | null,
): number {
  const weeks = computeDisciplineWeeks(entries, committedRatio);
  if (weeks.length === 0) return 0;

  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].clean) {
      streak++;
    } else {
      // First breached active week breaks the chain.
      break;
    }
  }
  return streak;
}

/**
 * The streak that was alive immediately BEFORE the current week broke it —
 * i.e. consecutive clean weeks ending at the last clean active week, when
 * the current (most-recent) active week has a breach.
 *
 * This is the number the UI decays from in the "streak broken" moment:
 * the user had N clean weeks and this week just ended the chain.
 *
 * Returns 0 when the current week is clean (nothing broke — the ordinary
 * computeDisciplineStreak already tells that story), when there are no
 * active weeks, or when there is no commitment.
 */
export function computeBrokenStreak(
  entries: JournalEntry[],
  committedRatio: number | null,
): number {
  const weeks = computeDisciplineWeeks(entries, committedRatio);
  if (weeks.length === 0) return 0;

  const latest = weeks[weeks.length - 1];
  if (latest.breaches === 0) return 0; // nothing broke this week

  // Walk backwards from the week BEFORE the breached one.
  let streak = 0;
  for (let i = weeks.length - 2; i >= 0; i--) {
    if (weeks[i].clean) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * True when the user just completed their FIRST clean week after a break:
 * the current (most-recent active) week is clean AND the active week before
 * it was breached. This is the "streak rebuilt" moment — the mirror of the
 * broken-streak moment, celebrated with a green flourish instead of the
 * red decay.
 *
 * Note: a rebuilt week starts a NEW streak of 1 (computeDisciplineStreak
 * already reports 1 in that situation) — this helper is purely about the
 * one-time moment, not the running count.
 */
export function isRebuiltWeek(
  entries: JournalEntry[],
  committedRatio: number | null,
): boolean {
  const weeks = computeDisciplineWeeks(entries, committedRatio);
  if (weeks.length < 2) return false;

  const latest = weeks[weeks.length - 1];
  const previous = weeks[weeks.length - 2];
  return latest.clean && previous.breaches > 0;
}

// ──── Discipline Score ──────────────────────────────────────────────────

/** Grade bands for the discipline score */
export type DisciplineGrade = 'excellent' | 'good' | 'fair' | 'poor';

export interface DisciplineScore {
  /** 0-100 (100 = every measured trade honoured the commitment) */
  score: number;
  grade: DisciplineGrade;
  /** Measurable trades backing this score (0 = no data) */
  measured: number;
}

/**
 * Turn a discipline summary into a 0-100 score.
 *
 *   score = (clean trades / measured) × 100
 *
 * Grades: ≥90 excellent · ≥75 good · ≥50 fair · <50 poor.
 * Fewer than 3 measured trades is statistically thin — the score is
 * reported but `grade` degrades one band so the UI can show a low-sample
 * caution instead of a confident label.
 *
 * Pass a summary with measured === 0 (or null) when there is no data —
 * the score is 0 with grade 'poor' and the widget should show its
 * no-data state instead.
 */
export function computeDisciplineScore(
  summary: DisciplineSummary | null,
): DisciplineScore {
  if (!summary || summary.measured === 0) {
    return { score: 0, grade: 'poor', measured: 0 };
  }

  const clean = summary.measured - summary.breaches;
  const score = Math.round((clean / summary.measured) * 100);

  let grade: DisciplineGrade =
    score >= 90 ? 'excellent' :
    score >= 75 ? 'good' :
    score >= 50 ? 'fair' : 'poor';

  // Thin sample: degrade one band so the UI can add a low-sample caution
  if (summary.measured < 3 && grade !== 'poor') {
    grade = grade === 'excellent' ? 'good' : grade === 'good' ? 'fair' : 'poor';
  }

  return { score, grade, measured: summary.measured };
}
