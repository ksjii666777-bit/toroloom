// ──── Strategy Performance Tracker Types ───────────────────────────────────

/** A single P&L update data point for tracking over time */
export interface PnLUpdate {
  /** ISO date string */
  date: string;
  /** Period P&L (change since last update) */
  pnl: number;
  /** Running cumulative P&L */
  cumulativePnl: number;
}

/** Status of an executed strategy */
export type StrategyPerformanceStatus = 'active' | 'closed' | 'partial';

/** A strategy that has been executed and is being tracked */
export interface ExecutedStrategy {
  /** Unique identifier */
  id: string;
  /** Strategy name */
  name: string;
  /** Trading symbol (e.g. NIFTY, BANKNIFTY) */
  symbol: string;
  /** Number of legs in the strategy */
  legCount: number;
  /** Total legs attempted for execution */
  totalLegs: number;
  /** Legs placed successfully */
  successfulLegs: number;
  /** Legs that failed */
  failedLegs: number;
  /** Total premium value of all legs */
  totalValue: number;
  /** ISO timestamp when strategy was executed */
  executedAt: string;

  // ── P&L Tracking ──
  /** Historical P&L updates over time */
  pnlUpdates: PnLUpdate[];
  /** Current running P&L (latest cumulativePnl from updates) */
  currentPnl: number;
  /** Current return percentage */
  currentPnlPercent: number;

  // ── Backtest Reference ──
  /** Target P&L from backtest (max profit estimate) */
  targetPnl: number;
  /** Target return % from backtest */
  targetReturnPercent: number;
  /** Win rate from backtest */
  backtestWinRate: number;
  /** Sharpe ratio from backtest */
  backtestSharpe: number;
  /** Probability of Profit from backtest */
  backtestPop: number;

  // ── Status ──
  /** Current tracking status */
  status: StrategyPerformanceStatus;

  // ── Notes ──
  /** User notes for this strategy */
  notes: string;
}

/** Aggregated performance stats computed from all tracked strategies */
export interface StrategyPerformanceStats {
  /** Total strategies executed */
  totalExecuted: number;
  /** Currently active strategies */
  activeCount: number;
  /** Closed strategies */
  closedCount: number;
  /** Strategies with partial execution */
  partialCount: number;
  /** Aggregate P&L across all strategies */
  totalPnl: number;
  /** Strategies with positive P&L */
  winningCount: number;
  /** Strategies with negative P&L */
  losingCount: number;
  /** Overall win rate */
  winRate: number;
  /** Best performing strategy name */
  bestStrategy: string;
  /** Best performing strategy P&L */
  bestPnl: number;
  /** Worst performing strategy name */
  worstStrategy: string;
  /** Worst performing strategy P&L */
  worstPnl: number;
  /** Total premium deployed */
  totalDeployed: number;
}

/** Shape for creating a new executed strategy record */
export interface NewExecutedStrategy {
  name: string;
  symbol: string;
  legCount: number;
  totalLegs: number;
  successfulLegs: number;
  failedLegs: number;
  totalValue: number;
  targetPnl: number;
  targetReturnPercent: number;
  backtestWinRate: number;
  backtestSharpe: number;
  backtestPop: number;
}
