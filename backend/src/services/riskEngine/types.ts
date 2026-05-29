/**
 * ============================================================================
 * Toroloom Risk Engine — Type Definitions
 * ============================================================================
 *
 * This is the shared contract between the frontend UI risk store and the
 * backend risk enforcement engine. Every type here is critical to the
 * "Financial Bodyguard" protocol.
 *
 * Architecture:
 *   Frontend (riskStore.ts)  <──>  Backend API (/api/risk)  <──>  RiskEngine
 *                                                                     │
 *                                                          OrderExecutionPipeline
 *                                                                     │
 *                                                          Broker (Mock/Zerodha/Angel)
 */

// ==================== Risk Limit Configuration ====================

export interface RiskLimits {
  /** Maximum daily loss in absolute Rupees (e.g., 50000 = ₹50,000) */
  dailyLossLimit: number;

  /** Maximum daily loss as percentage of portfolio value (e.g., 5 = 5%) */
  dailyLossPercentLimit: number;

  /** Maximum position size as percentage of portfolio (e.g., 20 = 20%) */
  maxPositionSizePercent: number;

  /** Maximum leverage ratio (e.g., 2 = 2x) */
  maxLeverage: number;

  /** Whether to allow intraday (MIS) trades */
  allowIntraday: boolean;

  /** Whether to allow F&O trading */
  allowFNO: boolean;
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  dailyLossLimit: 50000,
  dailyLossPercentLimit: 5,
  maxPositionSizePercent: 20,
  maxLeverage: 2,
  allowIntraday: true,
  allowFNO: false,
};

// ==================== Lockdown State ====================

export enum LockdownStatus {
  /** No lockdown — normal trading allowed */
  NONE = 'none',

  /** Lockdown active — only SQUARE_OFF/EXIT actions allowed */
  ACTIVE = 'active',

  /** Lockdown previously triggered but still in 24hr cooldown */
  COOLDOWN = 'cooldown',
}

export interface LockdownState {
  /** Current lockdown status */
  status: LockdownStatus;

  /** ISO timestamp when lockdown was triggered */
  triggeredAt: string | null;

  /** ISO timestamp when lockdown will automatically lift (24h after trigger) */
  liftsAt: string | null;

  /** The MTM loss value that triggered the lockdown */
  triggerLoss: number | null;

  /** The loss limit that was breached */
  breachedLimit: 'daily_loss' | 'daily_loss_percent' | null;
}

// ==================== Daily MTM Tracking ====================

export interface DailyMTM {
  /** Date in YYYY-MM-DD format */
  date: string;

  /** Total realized P&L for the day */
  realizedPnL: number;

  /** Total unrealized P&L for the day */
  unrealizedPnL: number;

  /** Peak portfolio value during the day */
  peakValue: number;

  /** Total brokerage and taxes paid */
  totalCharges: number;

  /** Number of trades executed today */
  tradeCount: number;
}

// ==================== Risk Profile (Per-User) ====================

export interface RiskProfile {
  /** User ID */
  userId: string;

  /** Current risk limits (can be user-customized or defaults) */
  limits: RiskLimits;

  /** Current lockdown state */
  lockdown: LockdownState;

  /** Today's MTM tracking */
  today: DailyMTM;

  /** Portfolio value at market open today */
  portfolioValueAtOpen: number;

  /** Whether risk settings are frozen (true during lockdown + 24h) */
  settingsFrozen: boolean;

  /** ISO timestamp when settings freeze ends */
  settingsFrozenUntil: string | null;

  /** Last updated ISO timestamp */
  updatedAt: string;
}

// ==================== Risk Evaluation Result ====================

export interface RiskEvaluation {
  /** Whether the action is allowed */
  allowed: boolean;

  /** The risk engine decision */
  decision: RiskDecision;

  /** Human-readable message for the user */
  message: string;

  /** Current risk state at evaluation time */
  currentState: {
    lockdown: LockdownStatus;
    dailyLoss: number;
    dailyLossPercent: number;
    settingsFrozen: boolean;
  };
}

export enum RiskDecision {
  /** Action allowed — proceed */
  ALLOWED = 'allowed',

  /** Action blocked by lockdown */
  BLOCKED_LOCKDOWN = 'blocked_lockdown',

  /** Action would breach daily loss limit */
  BLOCKED_LOSS_LIMIT = 'blocked_loss_limit',

  /** Action would breach position size limit */
  BLOCKED_POSITION_SIZE = 'blocked_position_size',

  /** Action not allowed (general) */
  BLOCKED_GENERAL = 'blocked_general',

  /** Action is an exit/square-off — always allowed even in lockdown */
  EXIT_ALLOWED = 'exit_allowed',
}

// ==================== Order Types for Risk Evaluation ====================

export enum OrderActionType {
  /** Standard buy order */
  BUY = 'BUY',

  /** Standard sell order */
  SELL = 'SELL',

  /** Square-off / exit position (always allowed in lockdown) */
  SQUARE_OFF = 'SQUARE_OFF',

  /** Modify an existing order */
  MODIFY = 'MODIFY',

  /** Cancel an existing order */
  CANCEL = 'CANCEL',
}

export interface OrderRiskContext {
  /** The action being evaluated */
  actionType: OrderActionType;

  /** Symbol being traded */
  symbol?: string;

  /** Quantity involved */
  quantity?: number;

  /** Estimated/limit price */
  price?: number;

  /** Product type */
  productType?: 'CNC' | 'MIS' | 'NRML';

  /** Current portfolio value (for percent calculations) */
  portfolioValue: number;

  /** Current positions for this symbol */
  currentPosition?: {
    quantity: number;
    avgPrice: number;
  };
}
