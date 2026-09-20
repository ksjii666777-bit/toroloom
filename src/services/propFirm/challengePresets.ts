/**
 * ============================================================================
 * Toroloom — Prop-Firm Challenge Presets & Types
 * ============================================================================
 *
 * FTMO-style evaluation accounts: the user risks a challenge fee, trades a
 * simulated account, and must hit a profit target WITHOUT breaching loss
 * limits. Toroloom's prop mode mirrors those rules so traders can rehearse
 * and enforce discipline BEFORE risking a real fee.
 *
 * Rule vocabulary (matching the big three firms):
 *   - Max daily loss       — worst allowed single-day loss (FTMO: 5%)
 *   - Max overall loss     — worst allowed total drawdown (FTMO: 10% static,
 *                            Topstep-style trailing uses peak equity instead)
 *   - Profit target        — % gain required to pass a phase (FTMO: 10% / 5%)
 *   - Min trading days     — days with ≥1 closed trade required to pass
 *   - Consistency rule     — no single day may exceed X% of total profit
 *                            (common on funded accounts, e.g. 45%)
 *
 * Pure data + small helpers only. All maths lives in drawdownEngine.ts.
 * ============================================================================
 */

export type PropProvider = 'ftmo' | 'topstep' | 'the5ers' | 'custom';

export type CurrencyCode = 'INR' | 'USD';

/** One evaluation phase (FTMO has 2; funded = no target, just rules) */
export interface ChallengePhase {
  /** Phase number: 1 = evaluation, 2 = verification, 3+ = funded-style */
  number: number;
  /** % of initial account that must be gained to pass (null = funded, no target) */
  profitTargetPercent: number | null;
}

export interface ChallengeConfig {
  /** Provider this rule set came from (or 'custom') */
  provider: PropProvider;
  /** Starting balance of the challenge account */
  accountSize: number;
  currency: CurrencyCode;
  /** Max loss in ONE day, as % of the initial account size (FTMO: 5) */
  maxDailyLossPercent: number;
  /** Max total drawdown, as % of the initial account size (FTMO: 10) */
  maxOverallLossPercent: number;
  /**
   * Trailing drawdown (Topstep-style): the overall-loss floor trails the
   * peak equity instead of sitting at a fixed initial-balance level.
   */
  trailingDrawdown: boolean;
  /** Ordered phases — last one with a null target is "funded" */
  phases: ChallengePhase[];
  /** Minimum distinct days with ≥1 closed trade before a phase can pass */
  minTradingDays: number;
  /** Optional consistency rule: no single day > this % of total profit */
  consistencyRulePercent: number | null;
}

export interface ChallengePreset {
  id: PropProvider;
  label: string;
  /** Short marketing-neutral description of whose rules these approximate */
  descriptionKey: string;
  configs: ChallengeConfig[];
}

// ── Presets (publicly documented rule sets, approximated) ──────────────────

const FTMO_PHASES: ChallengePhase[] = [
  { number: 1, profitTargetPercent: 10 },
  { number: 2, profitTargetPercent: 5 },
  { number: 3, profitTargetPercent: null }, // funded
];

const TOPSTEP_PHASES: ChallengePhase[] = [
  { number: 1, profitTargetPercent: 6 },
  { number: 2, profitTargetPercent: null }, // funded (trailing rules continue)
];

export const CHALLENGE_PRESETS: ChallengePreset[] = [
  {
    id: 'ftmo',
    label: 'FTMO-style',
    descriptionKey: 'propFirm.presets.ftmo',
    configs: [
      { provider: 'ftmo', accountSize: 100000, currency: 'USD', maxDailyLossPercent: 5, maxOverallLossPercent: 10, trailingDrawdown: false, phases: FTMO_PHASES, minTradingDays: 4, consistencyRulePercent: null },
      { provider: 'ftmo', accountSize: 50000, currency: 'USD', maxDailyLossPercent: 5, maxOverallLossPercent: 10, trailingDrawdown: false, phases: FTMO_PHASES, minTradingDays: 4, consistencyRulePercent: null },
    ],
  },
  {
    id: 'topstep',
    label: 'Topstep-style',
    descriptionKey: 'propFirm.presets.topstep',
    configs: [
      { provider: 'topstep', accountSize: 50000, currency: 'USD', maxDailyLossPercent: 4, maxOverallLossPercent: 6, trailingDrawdown: true, phases: TOPSTEP_PHASES, minTradingDays: 1, consistencyRulePercent: 45 },
      { provider: 'topstep', accountSize: 100000, currency: 'USD', maxDailyLossPercent: 4, maxOverallLossPercent: 6, trailingDrawdown: true, phases: TOPSTEP_PHASES, minTradingDays: 1, consistencyRulePercent: 45 },
    ],
  },
  {
    id: 'the5ers',
    label: 'The5ers-style',
    descriptionKey: 'propFirm.presets.the5ers',
    configs: [
      { provider: 'the5ers', accountSize: 5000, currency: 'USD', maxDailyLossPercent: 4, maxOverallLossPercent: 6, trailingDrawdown: false, phases: FTMO_PHASES, minTradingDays: 3, consistencyRulePercent: null },
    ],
  },
];

/** Build a custom config with FTMO-like defaults the user can edit */
export function makeCustomConfig(overrides?: Partial<ChallengeConfig>): ChallengeConfig {
  return {
    provider: 'custom',
    accountSize: 1000000, // ₹10 lakh default for Indian traders
    currency: 'INR',
    maxDailyLossPercent: 5,
    maxOverallLossPercent: 10,
    trailingDrawdown: false,
    phases: FTMO_PHASES.map(p => ({ ...p })),
    minTradingDays: 4,
    consistencyRulePercent: null,
    ...overrides,
  };
}

/** Absolute ₹/$ amounts derived from the percentages — used everywhere downstream */
export function deriveLimits(config: ChallengeConfig): {
  maxDailyLossAmount: number;
  maxOverallLossAmount: number;
  profitTargetAmount: number;
} {
  const maxDailyLossAmount = (config.accountSize * config.maxDailyLossPercent) / 100;
  const maxOverallLossAmount = (config.accountSize * config.maxOverallLossPercent) / 100;
  const phase = config.phases[0];
  const profitTargetAmount = phase.profitTargetPercent != null
    ? (config.accountSize * phase.profitTargetPercent) / 100
    : 0;
  return { maxDailyLossAmount, maxOverallLossAmount, profitTargetAmount };
}

/** Format a challenge-money amount with the account's own currency */
export function formatChallengeMoney(amount: number, currency: CurrencyCode): string {
  const symbol = currency === 'INR' ? '₹' : '$';
  return `${symbol}${Math.round(amount).toLocaleString('en-IN')}`;
}
