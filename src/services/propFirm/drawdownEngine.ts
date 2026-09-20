/**
 * ============================================================================
 * Toroloom — Prop-Firm Drawdown Engine
 * ============================================================================
 *
 * Pure computation of an FTMO-style challenge state from journaled trades.
 * No store / navigation / Date.now() imports — every "current" value is a
 * parameter, so the dashboard, the pre-trade checker and the tests all share
 * one deterministic source of truth.
 *
 * Model (all amounts in the account's own currency):
 *
 *   equity(t)        = accountSize + Σ pnl of all closed trades ≤ t
 *   peakEquity       = max equity ever reached since the challenge started
 *   static floor     = accountSize − maxOverallLossAmount        (FTMO)
 *   trailing floor   = peakEquity − maxOverallLossAmount           (Topstep)
 *   daily loss       = worst calendar-day realised P&L vs maxDailyLossAmount
 *   phase pass       = equity − startOfPhase ≥ phaseTarget AND
 *                      tradingDays ≥ minTradingDays AND no breach
 *
 * Simplification vs live firms: only CLOSED journaled trades feed the engine
 * (no floating P&L). The pre-trade checker covers the gap by simulating a
 * planned trade's stop-out before the position is opened.
 * ============================================================================
 */

import type { JournalEntry } from '../../types';
import type { ChallengeConfig } from './challengePresets';
import { deriveLimits } from './challengePresets';

// ── Severity ladder ─────────────────────────────────────────────────────────

export type RiskVerdict = 'ok' | 'warning' | 'danger' | 'breached';

const VERDICT_ORDER: Record<RiskVerdict, number> = { ok: 0, warning: 1, danger: 2, breached: 3 };

export function worstVerdict(a: RiskVerdict, b: RiskVerdict): RiskVerdict {
  return VERDICT_ORDER[a] >= VERDICT_ORDER[b] ? a : b;
}

/** Map "fraction of a limit consumed" to a verdict colour */
export function usageToVerdict(fraction: number): RiskVerdict {
  if (fraction >= 1) return 'breached';
  if (fraction >= 0.9) return 'danger';
  if (fraction >= 0.75) return 'warning';
  return 'ok';
}

// ── Day bucketing ───────────────────────────────────────────────────────────

/** Calendar-day key ('YYYY-MM-DD') of an ISO timestamp — local-day semantics */
export function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export interface DayBucket {
  day: string;
  pnl: number;
  trades: number;
}

/** Group closed trades into calendar-day P&L buckets, oldest first */
export function bucketByDay(entries: JournalEntry[]): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const e of entries) {
    const day = dayKey(e.date);
    const bucket = map.get(day) ?? { day, pnl: 0, trades: 0 };
    bucket.pnl += e.pnl;
    bucket.trades += 1;
    map.set(day, bucket);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

// ── Challenge state ─────────────────────────────────────────────────────────

export type PhaseStatus = 'in_progress' | 'passed' | 'failed';

export interface ChallengeState {
  /** Trades that fall inside the challenge window (after startDate) */
  included: JournalEntry[];
  totalPnl: number;
  /** accountSize + totalPnl */
  equity: number;
  peakEquity: number;
  // Daily limit
  worstDayPnl: number;
  worstDay: string | null;
  /** 0..∞ — consumed share of the daily-loss allowance (worst day) */
  dailyLossUsedFraction: number;
  dailyLossRemaining: number;
  dailyVerdict: RiskVerdict;
  // Overall limit
  drawdownFloor: number;
  /** 0..∞ — consumed share of the overall-loss allowance */
  overallLossUsedFraction: number;
  overallLossRemaining: number;
  overallVerdict: RiskVerdict;
  // Phase progress
  phaseNumber: number;
  phaseTargetAmount: number;
  /** 0..∞ — profit progress toward the current phase target */
  profitProgress: number;
  tradingDays: number;
  minDaysMet: boolean;
  // Optional consistency rule
  consistencyViolation: boolean;
  /** Largest day profit as % of total profit (null when no profit yet) */
  largestDayProfitShare: number | null;
  // Outcome
  phaseStatus: PhaseStatus;
  /** The single worst verdict across all rules — drives the header banner */
  overallRisk: RiskVerdict;
}

export interface ChallengeStateOptions {
  /** ISO instant the challenge started — earlier trades are ignored */
  startDate: string;
  /** Current phase number (1-based) — picks the profit target from config */
  phase: number;
  /** 'YYYY-MM-DD' of "today" — needed for the daily-limit view */
  todayKey: string;
}

export function computeChallengeState(
  entries: JournalEntry[],
  config: ChallengeConfig,
  options: ChallengeStateOptions,
): ChallengeState {
  const { maxDailyLossAmount, maxOverallLossAmount } = deriveLimits(config);
  const included = entries.filter(e => e.date >= options.startDate);

  const buckets = bucketByDay(included);
  const totalPnl = included.reduce((s, e) => s + e.pnl, 0);
  const equity = config.accountSize + totalPnl;

  // Peak equity walk (start at accountSize so a losing first day still counts)
  let peakEquity = config.accountSize;
  let running = config.accountSize;
  for (const b of buckets) {
    running += b.pnl;
    if (running > peakEquity) peakEquity = running;
  }

  // Daily rule — worst realised day (realised losses only; floating simulated pre-trade)
  const worst = buckets.reduce<DayBucket | null>(
    (w, b) => (w == null || b.pnl < w.pnl ? b : w), null,
  );
  const worstDayPnl = worst?.pnl ?? 0;
  const dailyLossUsedFraction = worstDayPnl < 0 ? Math.min(1, -worstDayPnl / maxDailyLossAmount) : 0;
  const dailyLossRemaining = Math.max(0, maxDailyLossAmount + Math.min(0, worstDayPnl));
  const dailyVerdict = usageToVerdict(worstDayPnl < 0 ? -worstDayPnl / maxDailyLossAmount : 0);

  // Overall rule — static or trailing floor
  const drawdownFloor = config.trailingDrawdown
    ? peakEquity - maxOverallLossAmount
    : config.accountSize - maxOverallLossAmount;
  const drawdownAmount = Math.max(0, (config.trailingDrawdown ? peakEquity : config.accountSize) - equity);
  const overallLossUsedFraction = Math.min(1, drawdownAmount / maxOverallLossAmount);
  const overallLossRemaining = Math.max(0, equity - drawdownFloor);
  const overallVerdict = usageToVerdict(drawdownAmount / maxOverallLossAmount);

  // Phase progress
  const phaseDef = config.phases.find(p => p.number === options.phase) ?? config.phases[config.phases.length - 1];
  const phaseTargetAmount = phaseDef.profitTargetPercent != null
    ? (config.accountSize * phaseDef.profitTargetPercent) / 100
    : 0;
  const phaseStartEquity = config.accountSize; // phases compound from the initial balance in our model
  const phaseGain = equity - phaseStartEquity;
  const profitProgress = phaseTargetAmount > 0 ? Math.max(0, phaseGain / phaseTargetAmount) : 0;

  const tradingDays = buckets.length;
  const minDaysMet = tradingDays >= config.minTradingDays;

  // Consistency rule — only meaningful when in profit
  const profitDays = buckets.filter(b => b.pnl > 0);
  const largestDayProfit = profitDays.length ? Math.max(...profitDays.map(b => b.pnl)) : 0;
  const largestDayProfitShare = totalPnl > 0 ? largestDayProfit / totalPnl : null;
  const consistencyViolation = config.consistencyRulePercent != null
    && totalPnl > 0
    && largestDayProfitShare != null
    && largestDayProfitShare * 100 > config.consistencyRulePercent;

  // Outcome
  const anyBreach = dailyVerdict === 'breached' || overallVerdict === 'breached';
  const passed = !anyBreach
    && phaseTargetAmount > 0
    && phaseGain >= phaseTargetAmount
    && minDaysMet;
  const phaseStatus: PhaseStatus = anyBreach ? 'failed' : passed ? 'passed' : 'in_progress';

  return {
    included,
    totalPnl,
    equity,
    peakEquity,
    worstDayPnl,
    worstDay: worst?.day ?? null,
    dailyLossUsedFraction,
    dailyLossRemaining,
    dailyVerdict,
    drawdownFloor,
    overallLossUsedFraction,
    overallLossRemaining,
    overallVerdict,
    phaseNumber: options.phase,
    phaseTargetAmount,
    profitProgress,
    tradingDays,
    minDaysMet,
    consistencyViolation,
    largestDayProfitShare,
    phaseStatus,
    overallRisk: worstVerdict(dailyVerdict, overallVerdict),
  };
}

// ── Pre-trade check (R:R + loss-budget enforcement) ─────────────────────────

export type PreTradeVerdict = 'ok' | 'warn' | 'block';

export interface PlannedTradeCheck {
  verdict: PreTradeVerdict;
  /** i18n keys describing why — render verbatim, ordered by severity */
  reasons: string[];
  /** How much of the daily allowance this stop-out would consume (0..∞) */
  dailyFractionIfStopped: number;
  overallFractionIfStopped: number;
  dailyLossRemaining: number;
  overallLossRemaining: number;
}

/**
 * Simulate a planned trade's WORST case (full stop-out) against the remaining
 * loss budgets. Blocks trades that could breach a limit if the stop is hit;
 * warns when the R:R falls below the user's committed ratio (the same rule
 * the discipline report enforces post-trade).
 */
export function checkPlannedTrade(
  state: ChallengeState,
  config: ChallengeConfig,
  plannedRiskAmount: number,
  plannedRewardAmount: number | null,
  committedRatio: number | null,
): PlannedTradeCheck {
  const reasons: string[] = [];
  let verdict: PreTradeVerdict = 'ok';

  if (state.phaseStatus === 'failed') {
    verdict = 'block';
    reasons.push('propFirm.check.challengeFailed');
  }

  if (plannedRiskAmount <= 0 || !isFinite(plannedRiskAmount)) {
    return { verdict, reasons, dailyFractionIfStopped: 0, overallFractionIfStopped: 0, dailyLossRemaining: state.dailyLossRemaining, overallLossRemaining: state.overallLossRemaining };
  }

  // Fraction of the REMAINING daily budget consumed by this one stop-out
  const dailyUse = state.dailyLossRemaining > 0 ? plannedRiskAmount / state.dailyLossRemaining : Infinity;
  const overallUse = state.overallLossRemaining > 0 ? plannedRiskAmount / state.overallLossRemaining : Infinity;

  // Daily and overall are independent rules — report EVERY budget this trade
  // would blow, so the user sees the full picture, not just the first breach.
  if (dailyUse >= 1 || overallUse >= 1) {
    verdict = 'block';
    if (dailyUse >= 1) reasons.push('propFirm.check.exceedsDaily');
    if (overallUse >= 1) reasons.push('propFirm.check.exceedsOverall');
  } else if (dailyUse >= 0.5 || overallUse >= 0.5) {
    if (verdict === 'ok') verdict = 'warn';
    if (dailyUse >= 0.5) reasons.push('propFirm.check.halfDaily');
    if (overallUse >= 0.5) reasons.push('propFirm.check.halfOverall');
  }

  // R:R commitment — same rule as the discipline report, applied pre-trade
  if (committedRatio != null && committedRatio > 0 && plannedRewardAmount != null && plannedRewardAmount > 0) {
    if (plannedRewardAmount / plannedRiskAmount < committedRatio - 0.05) {
      if (verdict === 'ok') verdict = 'warn';
      reasons.push('propFirm.check.rrBelowCommitment');
    }
  }

  return {
    verdict,
    reasons,
    dailyFractionIfStopped: dailyUse,
    overallFractionIfStopped: overallUse,
    dailyLossRemaining: state.dailyLossRemaining,
    overallLossRemaining: state.overallLossRemaining,
  };
}
