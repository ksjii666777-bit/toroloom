/**
 * Toroloom — Prop-Firm Challenge i18n (English)
 *
 * FTMO-style challenge mode: presets, drawdown dashboard, pre-trade checker.
 * Keys must stay in exact parity with locales/hi/propFirm.ts.
 */

export default {
  propFirm: {
    title: 'Prop Challenge',

    setup: {
      heading: 'Rehearse a funded challenge',
      sub: 'Pick a rule set, trade it on your journal, and let Toroloom enforce the limits before a real fee is at stake.',
      choosePreset: 'Choose a rule set',
      custom: 'Custom',
      accountSize: 'Account size',
      dailyLoss: 'Max daily loss (%)',
      overallLoss: 'Max overall loss (%)',
      minDays: 'Min trading days',
      consistency: 'Consistency rule — max share of total profit for one day (%)',
      consistencyOff: 'Off',
      trailing: 'Trailing drawdown (floor follows peak equity)',
      start: 'Start challenge',
      invalidInput: 'Enter valid numbers first',
    },

    presets: {
      ftmo: 'Static 10% / 5% targets, 5% daily, 10% overall — the classic two-phase evaluation.',
      topstep: 'Trailing drawdown with a 45% consistency rule — futures-style rules.',
      the5ers: 'Compact account, tighter limits — 6% overall drawdown.',
    },

    dashboard: {
      phase: 'Phase {{n}}',
      funded: 'Funded rules',
      active: 'Active',
      passed: 'Phase passed 🎉',
      failed: 'Challenge breached',
      abandoned: 'Abandoned',
      equity: 'Equity',
      peak: 'Peak equity',
      floor: 'Loss floor',
      totalPnl: 'Total P&L',
      profitTarget: 'Profit target',
      dailyLoss: 'Daily loss budget',
      maxLoss: 'Overall loss budget',
      tradingDays: 'Trading days',
      daysMet: '{{n}} / {{m}} days',
      consistencyOk: 'Consistency: largest day {{pct}}% of profit',
      consistencyBad: 'Consistency rule violated — one day is {{pct}}% of total profit',
      used: '{{pct}}% used',
      remaining: '{{amount}} remaining',
      floorHint: 'Static floor',
      floorHintTrailing: 'Trailing floor',
      advance: 'Advance to phase {{n}}',
      newChallenge: 'Start a new challenge',
      riskOk: 'Risk levels healthy',
      riskWarning: 'Approaching a limit',
      riskDanger: 'One bad trade from a breach',
      riskBreached: 'Limit breached — challenge failed',
    },

    check: {
      heading: 'Pre-trade check',
      sub: 'Enter the risk (stop distance × quantity) and planned reward of your next trade — Toroloom simulates the stop-out against your remaining budgets.',
      riskAmount: 'Planned risk amount',
      rewardAmount: 'Planned reward amount (optional)',
      run: 'Check trade',
      challengeFailed: 'Challenge already breached — restart before trading.',
      exceedsDaily: 'A full stop-out would exceed the daily loss budget.',
      exceedsOverall: 'A full stop-out would breach the overall drawdown floor.',
      halfDaily: 'This trade risks over half of the remaining daily budget.',
      halfOverall: 'This trade risks over half of the remaining overall budget.',
      rrBelowCommitment: 'Planned R:R is below your committed ratio.',
      verdictOk: 'Safe to take — worst case stays inside every limit.',
      verdictWarn: 'Risky — review before entering.',
      verdictBlock: 'Do not take this trade — it can breach a limit.',
    },
  },
};
