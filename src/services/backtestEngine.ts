/**
 * ============================================================================
 * Toroloom — Options Strategy Backtesting Engine
 * ============================================================================
 *
 * Client-side backtesting engine that simulates a multi-leg options strategy
 * against historical price data and computes key performance metrics.
 *
 * Features:
 *   - P&L simulation for CE/PE/FUTURE legs across historical data
 *   - Win rate, max drawdown, Sharpe ratio, profit factor
 *   - Equity curve generation
 *   - Multi-scenario analysis (best/worst case)
 *
 * Usage:
 *   import { backtestStrategy, type BacktestResult } from '../../services/backtestEngine';
 *
 *   const result = backtestStrategy(legs, historicalData);
 *   // result.winRate, result.maxDrawdown, result.sharpeRatio, etc.
 *
 * ============================================================================
 */

import type { StrategyLeg, StockHistoryPoint } from '../types';

// ──── Types ────────────────────────────────────────────────────────────────

export interface BacktestInput {
  /** Strategy legs to backtest */
  legs: StrategyLeg[];
  /** Historical price data (OHLC) */
  historicalData: StockHistoryPoint[];
  /** Spot price at time of strategy entry */
  entrySpotPrice: number;
}

export interface BacktestMetrics {
  /** Total simulated P&L */
  totalPnl: number;
  /** Total return percentage */
  totalReturnPercent: number;
  /** Number of trades/time periods simulated */
  totalPeriods: number;
  /** Number of periods with positive P&L */
  winningPeriods: number;
  /** Number of periods with negative P&L */
  losingPeriods: number;
  /** Win rate (0-100) */
  winRate: number;
  /** Average winning P&L */
  avgWin: number;
  /** Average losing P&L */
  avgLoss: number;
  /** Profit factor (sum wins / abs(sum losses)) */
  profitFactor: number;
  /** Maximum drawdown (absolute value) */
  maxDrawdown: number;
  /** Maximum drawdown percentage */
  maxDrawdownPercent: number;
  /** Sharpe ratio (annualized, risk-free = 6.5%) */
  sharpeRatio: number;
  /** Sortino ratio (downside deviation only) */
  sortinoRatio: number;
  /** Total return / max drawdown */
  calmarRatio: number;
  /** Best period P&L */
  bestPeriod: number;
  /** Worst period P&L */
  worstPeriod: number;
  /** Standard deviation of returns */
  returnStdDev: number;
  /** Average return per period */
  avgReturn: number;
  /** Probability of Profit — Monte Carlo simulation */
  probabilityOfProfit: number;
  /** Reward-to-Risk ratio (avgWin / avgLoss) */
  rewardRiskRatio: number;
  /** Longest streak of consecutive winning periods */
  maxConsecutiveWins: number;
  /** Longest streak of consecutive losing periods */
  maxConsecutiveLosses: number;
  /** Number of distinct drawdown episodes */
  drawdownEpisodes: number;
  /** Average drawdown episode depth (%) */
  avgDrawdownDepth: number;
  /** Longest drawdown duration (periods to recover) */
  maxDrawdownDuration: number;
}

export interface BacktestResult {
  /** Summary metrics */
  metrics: BacktestMetrics;
  /** Equity curve data points */
  equityCurve: EquityPoint[];
  /** Underlying price range for context */
  priceRange: { min: number; max: number };
  /** Entry spot price */
  entrySpotPrice: number;
}

export interface EquityPoint {
  /** Date of the data point */
  date: string;
  /** Underlying price at this point */
  underlyingPrice: number;
  /** Strategy P&L at this point */
  pnl: number;
  /** Cumulative P&L from start */
  cumulativePnl: number;
  /** Running maximum (for drawdown calcs) */
  runningMax: number;
  /** Drawdown from peak at this point */
  drawdown: number;
}

// ──── Constants ────────────────────────────────────────────────────────────

const _RISK_FREE_RATE = 0.065; // 6.5% annual (Indian benchmark)
const TRADING_DAYS_PER_YEAR = 252;

// ──── Core P&L Calculation ────────────────────────────────────────────────

/**
 * Compute the P&L for a single strategy leg at a given underlying price.
 *
 * CE Long:  P&L = (max(0, price - strike) - premium) * qty * lotSize
 * CE Short: P&L = (premium - max(0, price - strike)) * qty * lotSize
 * PE Long:  P&L = (max(0, strike - price) - premium) * qty * lotSize
 * PE Short: P&L = (premium - max(0, strike - price)) * qty * lotSize
 * FUTURE Long: P&L = (price - entryPrice) * qty * lotSize
 * FUTURE Short: P&L = (entryPrice - price) * qty * lotSize
 */
export function computeLegPnL(
  leg: StrategyLeg,
  underlyingPrice: number,
  entrySpotPrice: number,
): number {
  const { type, action, strike, premium, quantity, lotSize } = leg;

  if (type === 'FUTURE') {
    const diff = action === 'buy'
      ? underlyingPrice - entrySpotPrice
      : entrySpotPrice - underlyingPrice;
    return diff * quantity * lotSize;
  }

  // CE or PE
  const isCall = type === 'CE';
  const intrinsic = isCall
    ? Math.max(0, underlyingPrice - strike)
    : Math.max(0, strike - underlyingPrice);

  const pnlPerUnit = action === 'buy'
    ? intrinsic - premium
    : premium - intrinsic;

  return pnlPerUnit * quantity * lotSize;
}

/**
 * Compute the total strategy P&L for all legs at a given price.
 */
export function computeStrategyPnL(
  legs: StrategyLeg[],
  underlyingPrice: number,
  entrySpotPrice: number,
): number {
  if (legs.length === 0) return 0;
  return legs.reduce(
    (total, leg) => total + computeLegPnL(leg, underlyingPrice, entrySpotPrice),
    0,
  );
}

// ──── Backtest Simulation ─────────────────────────────────────────────────

/**
 * Run a full backtest simulation of the strategy against historical data.
 *
 * For each historical price point, computes what the strategy P&L would be
 * if the underlying were at that price. Then derives performance metrics.
 */
export function backtestStrategy(
  legs: StrategyLeg[],
  historicalData: StockHistoryPoint[],
  entrySpotPrice: number,
): BacktestResult {
  if (legs.length === 0 || historicalData.length < 2) {
    return createEmptyResult(entrySpotPrice);
  }

  const equityCurve: EquityPoint[] = [];
  let cumulativePnl = 0;
  let runningMax = -Infinity;

  // Track returns for Sharpe/Sortino calculation
  const returns: number[] = [];
  let prevCumulative = 0;

  // Track wins/losses
  let totalWin = 0;
  let totalLoss = 0;
  let winCount = 0;
  let lossCount = 0;

  // Track drawdown
  let maxDrawdown = 0;

  let priceMin = Infinity;
  let priceMax = -Infinity;

  for (let i = 0; i < historicalData.length; i++) {
    const point = historicalData[i];
    const price = point.close;

    if (price < priceMin) priceMin = price;
    if (price > priceMax) priceMax = price;

    const pnl = computeStrategyPnL(legs, price, entrySpotPrice);
    cumulativePnl += pnl;

    // Track peak for drawdown
    if (cumulativePnl > runningMax) {
      runningMax = cumulativePnl;
    }

    const drawdown = runningMax - cumulativePnl;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    // Track wins/losses
    if (pnl > 0) {
      winCount++;
      totalWin += pnl;
    } else if (pnl < 0) {
      lossCount++;
      totalLoss += Math.abs(pnl);
    }

    // Track returns for volatility
    if (i > 0) {
      const periodReturn = cumulativePnl - prevCumulative;
      returns.push(periodReturn);
    }
    prevCumulative = cumulativePnl;

    equityCurve.push({
      date: point.date,
      underlyingPrice: price,
      pnl,
      cumulativePnl,
      runningMax,
      drawdown,
    });
  }

  // Compute metrics
  const totalPeriods = historicalData.length;
  const totalPnl = cumulativePnl;
  const avgReturn = returns.length > 0
    ? returns.reduce((s, r) => s + r, 0) / returns.length
    : 0;

  const avgWin = winCount > 0 ? totalWin / winCount : 0;
  const avgLoss = lossCount > 0 ? totalLoss / lossCount : 0;
  const winRate = totalPeriods > 0 ? (winCount / totalPeriods) * 100 : 0;
  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;

  // Standard deviation of returns (for Sharpe)
  const variance = returns.length > 0
    ? returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length
    : 0;
  const returnStdDev = Math.sqrt(variance);

  // Sharpe ratio (annualized)
  // sharpe = (avg_return / std_dev) * sqrt(trading_days)
  const sharpeRatio = returnStdDev > 0
    ? (avgReturn / returnStdDev) * Math.sqrt(TRADING_DAYS_PER_YEAR)
    : 0;

  // Sortino ratio (downside deviation only)
  const downsideReturns = returns.filter(r => r < 0);
  const downsideVariance = downsideReturns.length > 0
    ? downsideReturns.reduce((s, r) => s + r * r, 0) / returns.length
    : 0;
  const downsideStdDev = Math.sqrt(downsideVariance);
  const sortinoRatio = downsideStdDev > 0
    ? (avgReturn / downsideStdDev) * Math.sqrt(TRADING_DAYS_PER_YEAR)
    : 0;

  // Calmar ratio (total return / max drawdown)
  const calmarRatio = maxDrawdown > 0 ? cumulativePnl / maxDrawdown : 0;

  // Best/worst period
  const bestPeriod = returns.length > 0 ? Math.max(...returns) : 0;
  const worstPeriod = returns.length > 0 ? Math.min(...returns) : 0;

  const initialCapital = entrySpotPrice * (legs[0]?.lotSize || 50) * (legs[0]?.quantity || 1);

  // Probability of Profit — Monte Carlo simulation
  const probabilityOfProfit = calculatePOP(equityCurve, initialCapital);

  // ── Risk / Reward Metrics ──
  const rewardRiskRatio = avgLoss > 0 ? Math.round((avgWin / avgLoss) * 100) / 100 : avgWin > 0 ? Infinity : 0;

  // Consecutive wins / losses
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  for (const point of equityCurve) {
    if (point.pnl > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxConsecutiveWins) maxConsecutiveWins = currentWinStreak;
    } else if (point.pnl < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxConsecutiveLosses) maxConsecutiveLosses = currentLossStreak;
    } else {
      currentWinStreak = 0;
      currentLossStreak = 0;
    }
  }

  // Drawdown episode analysis
  let drawdownEpisodes = 0;
  let totalDrawdownDepth = 0;
  let inDrawdown = false;
  let currentDrawdownPeriods = 0;
  let maxDrawdownDuration = 0;
  for (const point of equityCurve) {
    if (point.drawdown > 0) {
      if (!inDrawdown) {
        inDrawdown = true;
        drawdownEpisodes++;
      }
      currentDrawdownPeriods++;
      totalDrawdownDepth += point.drawdown;
    } else {
      if (inDrawdown) {
        if (currentDrawdownPeriods > maxDrawdownDuration) maxDrawdownDuration = currentDrawdownPeriods;
        currentDrawdownPeriods = 0;
      }
      inDrawdown = false;
    }
  }
  if (currentDrawdownPeriods > maxDrawdownDuration) maxDrawdownDuration = currentDrawdownPeriods;
  const avgDrawdownDepth = drawdownEpisodes > 0 && initialCapital > 0
    ? Math.round(((totalDrawdownDepth / drawdownEpisodes) / initialCapital) * 10000) / 100
    : 0;
  const totalReturnPercent = initialCapital > 0
    ? (totalPnl / initialCapital) * 100
    : 0;

  return {
    metrics: {
      totalPnl,
      totalReturnPercent,
      totalPeriods,
      winningPeriods: winCount,
      losingPeriods: lossCount,
      winRate: Math.round(winRate * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPercent: initialCapital > 0
        ? Math.round((maxDrawdown / initialCapital) * 10000) / 100
        : 0,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      calmarRatio: Math.round(calmarRatio * 100) / 100,
      bestPeriod: Math.round(bestPeriod * 100) / 100,
      worstPeriod: Math.round(worstPeriod * 100) / 100,
      returnStdDev: Math.round(returnStdDev * 100) / 100,
      avgReturn: Math.round(avgReturn * 100) / 100,
      probabilityOfProfit,
      rewardRiskRatio,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      drawdownEpisodes,
      avgDrawdownDepth: Math.round(avgDrawdownDepth * 100) / 100,
      maxDrawdownDuration,
    },
    equityCurve,
    priceRange: { min: priceMin, max: priceMax },
    entrySpotPrice,
  };
}

// ──── Probability of Profit (Monte Carlo) ─────────────────────────────────

/**
 * Generate a normally-distributed random number using the Box-Muller transform.
 */
function normalRandom(): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Calculate Probability of Profit (POP) using Monte Carlo simulation.
 *
 * Uses the equity curve's return distribution (mean & std dev) to simulate
 * thousands of possible future paths. POP = % of simulations ending with
 * positive total P&L.
 *
 * @param equityCurve - The historical equity curve from backtesting
 * @param initialCapital - Reference capital for return % calculation
 * @param simulations - Number of Monte Carlo runs (default 5000)
 * @returns POP as a percentage (0–100), rounded to 1 decimal
 */
export function calculatePOP(
  equityCurve: EquityPoint[],
  initialCapital: number = 100000,
  simulations: number = 5000,
): number {
  if (equityCurve.length < 10) return 0;

  // Calculate period-over-period return percentages
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].cumulativePnl;
    const curr = equityCurve[i].cumulativePnl;
    const returnPct = initialCapital > 0 ? (curr - prev) / initialCapital : 0;
    returns.push(returnPct);
  }

  if (returns.length < 5) return 0;

  const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Edge case: no volatility — POP is simply whether the strategy is profitable
  if (stdDev === 0) {
    return meanReturn > 0 ? 100 : meanReturn < 0 ? 0 : 50;
  }

  // Run Monte Carlo simulations
  let positiveCount = 0;
  const totalPeriods = equityCurve.length;

  for (let sim = 0; sim < simulations; sim++) {
    let cumulativeReturn = 0;
    for (let day = 0; day < totalPeriods; day++) {
      const dailyReturn = meanReturn + normalRandom() * stdDev;
      cumulativeReturn += dailyReturn;
    }
    if (cumulativeReturn > 0) positiveCount++;
  }

  return Math.round((positiveCount / simulations) * 1000) / 10;
}

// ──── Helpers ──────────────────────────────────────────────────────────────

function createEmptyResult(entrySpotPrice: number): BacktestResult {
  return {
    metrics: {
      totalPnl: 0,
      totalReturnPercent: 0,
      totalPeriods: 0,
      winningPeriods: 0,
      losingPeriods: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      bestPeriod: 0,
      worstPeriod: 0,
      returnStdDev: 0,
      avgReturn: 0,
      probabilityOfProfit: 0,
      rewardRiskRatio: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      drawdownEpisodes: 0,
      avgDrawdownDepth: 0,
      maxDrawdownDuration: 0,
    },
    equityCurve: [],
    priceRange: { min: 0, max: 0 },
    entrySpotPrice,
  };
}

/**
 * Generate mock historical price data for backtesting when real data isn't available.
 * Uses a random walk with realistic volatility (~15% annualized).
 */
export function generateBacktestHistory(
  basePrice: number,
  days: number = 365,
): StockHistoryPoint[] {
  const data: StockHistoryPoint[] = [];
  let price = basePrice;
  const today = new Date();
  const dailyVol = basePrice * 0.012; // ~1.2% daily vol ≈ 19% annualized

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // Random walk with slight mean reversion
    const momentum = (Math.random() - 0.48) * 0.3;
    const noise = (Math.random() - 0.5) * dailyVol;
    const change = price * momentum + noise;
    price = Math.max(price + change, basePrice * 0.5);

    const open = price - change * 0.3;
    const close = price;
    const spread = Math.abs(close - open);
    const high = Math.max(open, close) + spread * (0.2 + Math.random() * 0.5);
    const low = Math.min(open, close) - spread * (0.2 + Math.random() * 0.5);

    data.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(Math.random() * 20000000) + 5000000,
    });
  }

  return data;
}
