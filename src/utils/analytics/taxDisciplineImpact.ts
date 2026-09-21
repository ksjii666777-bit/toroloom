/**
 * ============================================================================
 * Toroloom — Post-Tax Discipline Impact (pure helper)
 * ============================================================================
 *
 * Answers ONE question for the tax-education module: "what does my R:R
 * discipline actually do to my POST-TAX returns?"
 *
 * Model (deliberately simple, education-grade, no tax engine):
 *   - "Disciplined you" takes the same trades but holds winners to the
 *     committed R:R; losers are stopped at plan (measured trades only).
 *   - Both scenarios pay the same flat capital-gains rate on gains.
 *   - Net losses are NOT taxed this year (carry-forward ignored).
 *
 * Education only — NOT tax advice; rates are parameters, not constants.
 * ============================================================================
 */

/** JournalEntry is structurally typed so tests can pass minimal objects. */
export interface RRJEntry {
  id: string;
  pnl: number;
  quantity: number;
  entryPrice: number;
  plannedStop?: number | null;
}

export interface TaxDisciplineImpact {
  /** trades that recorded a planned stop (measurable) */
  measured: number;
  /** measured trades below the commitment (realized < committed − ε) */
  breaches: number;
  /** of the breaches, how many LOST money (breach + red = undisciplined loss) */
  undisciplinedLosses: number;
  /** sum of losses from undisciplined losing trades (positive number, ₹) */
  lossFromUndisciplinedLosses: number;
  /** flat capital-gains rate both scenarios pay (e.g. 0.3) */
  taxRate: number;
  /** actual journaled P&L across measurable trades (₹) */
  actualPnl: number;
  /** what the same trades would have yielded at the committed R:R (₹) */
  disciplinedPnl: number;
  /** post-tax comparison (₹) */
  postTaxActual: number;
  postTaxDisciplined: number;
  /** extra post-tax money the indiscipline cost (₹, positive = gap) */
  postTaxGap: number;
}

/**
 * Tolerance for counting a breach — mirrors disciplineAnalytics.RR_EPSILON.
 * Commitments are coarse (1:2, 1:3); 0.05 is far below any meaningful miss.
 */
const RR_EPSILON = 0.05;

/**
 * Compare "actual you" with "disciplined you" over the measured trades and
 * express the difference post-tax.
 *
 * Disciplined counterfactual, per measured trade:
 *   - WINNER below the commitment (cut short) → re-rated UP to the committed
 *     multiple of its risk unit (disciplined-you holds to the target)
 *   - LOSS beyond 1R (stop ignored / slipped) → re-rated DOWN to −1R
 *     (disciplined-you honours the stop) — this is the undisciplined loss
 *   - planned 1R stop-outs are HONOURABLE discipline and pass through
 *
 * Post-tax: gains are taxed at `taxRate`, losses reduce the gain pool first;
 * a net-negative scenario pays no tax (carry-forward intentionally ignored).
 *
 * Returns null when there is no commitment or nothing measurable — the card
 * should then hide (or prompt the user to commit / add planned stops).
 */
export function computeTaxDisciplineImpact(
  entries: RRJEntry[],
  committedRatio: number | null,
  taxRate: number,
): TaxDisciplineImpact | null {
  if (committedRatio == null || committedRatio <= 0) return null;
  if (!(taxRate >= 0 && taxRate < 1)) return null;

  let measured = 0;
  let breaches = 0;
  let undisciplinedLosses = 0;
  let lossFromUndisciplinedLosses = 0;
  let actualPnl = 0;
  let disciplinedPnl = 0;

  for (const e of entries) {
    if (e.plannedStop == null || !isFinite(e.plannedStop)) continue;
    const riskPerUnit = Math.abs(e.entryPrice - e.plannedStop);
    if (riskPerUnit <= 0) continue;

    measured += 1;
    actualPnl += e.pnl;

    if (e.pnl > 0) {
      const rewardPerUnit = e.pnl / e.quantity;
      const realizedRR = rewardPerUnit / riskPerUnit;
      if (realizedRR < committedRatio - RR_EPSILON) {
        // Winner cut short of the plan: disciplined-you holds to commitment.
        breaches += 1;
        disciplinedPnl += committedRatio * riskPerUnit * e.quantity;
        continue;
      }
    } else if (e.pnl < 0) {
      const lossPerUnit = Math.abs(e.pnl) / e.quantity;
      if (lossPerUnit > riskPerUnit + RR_EPSILON) {
        // Lost beyond the planned 1R — stop was ignored or slipped.
        // Disciplined-you exits at the stop (−1R exactly).
        breaches += 1;
        undisciplinedLosses += 1;
        lossFromUndisciplinedLosses += Math.abs(e.pnl);
        disciplinedPnl -= riskPerUnit * e.quantity;
        continue;
      }
    }

    disciplinedPnl += e.pnl;
  }

  if (measured === 0) return null;

  const postTaxActual =
    actualPnl > 0 ? actualPnl * (1 - taxRate) : actualPnl;
  const postTaxDisciplined =
    disciplinedPnl > 0 ? disciplinedPnl * (1 - taxRate) : disciplinedPnl;
  // Honest gap: what disciplined-you would have kept vs what you kept.
  // No clamping — a negative actual position is a real cost, not zero.
  const postTaxGap = postTaxDisciplined - postTaxActual;

  return {
    measured,
    breaches,
    undisciplinedLosses,
    lossFromUndisciplinedLosses,
    taxRate,
    actualPnl,
    disciplinedPnl,
    postTaxActual,
    postTaxDisciplined,
    postTaxGap,
  };
}
