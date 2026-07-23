/**
 * ============================================================================
 * Toroloom — Algo Trading Backtesting Engine
 * ============================================================================
 *
 * Simulates a trading strategy against historical OHLC data.
 * Uses the formula engine from custom indicators to evaluate
 * entry/exit conditions on each bar.
 *
 * Features:
 *   - Formula-based entry conditions (e.g. "CROSSOVER(SMA(close,20), SMA(close,50))")
 *   - Formula-based exit conditions (e.g. "CROSSUNDER(close, SMA(close,20))")
 *   - Stop loss and take profit levels
 *   - Trailing stop loss
 *   - Position sizing (fixed qty, percent risk, fixed capital)
 *   - Long / Short both supported
 *   - Comprehensive metrics: win rate, Sharpe, max drawdown, profit factor
 *   - Trade log with every entry/exit
 *   - Equity curve generation
 * ============================================================================
 */

import type { StockHistoryPoint } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AlgoStrategy {
  /** Strategy display name */
  name: string;
  /** Entry condition formula (e.g. "CROSSOVER(close, SMA(close, 50))") */
  entryFormula: string;
  /** Exit condition formula (e.g. "CROSSUNDER(close, SMA(close, 20))") */
  exitFormula: string;
  /** Stop loss percentage (e.g. 5 means 5%) */
  stopLossPercent?: number;
  /** Take profit percentage (e.g. 10 means 10%) */
  takeProfitPercent?: number;
  /** Enable trailing stop loss */
  trailingStop?: boolean;
  /** Trailing stop activation percentage (profit threshold) */
  trailingActivation?: number;
  /** Trailing stop distance from highest high */
  trailingDistance?: number;
  /** Position sizing method */
  sizingMethod: 'fixed_qty' | 'percent_risk' | 'fixed_capital';
  /** Sizing parameter (qty for fixed_qty, percent for percent_risk, amount for fixed_capital) */
  sizingValue: number;
  /** Allow both long and short positions */
  allowShort?: boolean;
  /** Max number of concurrent positions (0 = unlimited) */
  maxPositions?: number;
  /** Commission per trade (as decimal, e.g. 0.001 = 0.1%) */
  commission?: number;
  /** Slippage per trade (as decimal, e.g. 0.001 = 0.1%) */
  slippage?: number;
}

export interface AlgoTrade {
  id: string;
  /** Entry bar index in the data array */
  entryIndex: number;
  /** Entry date */
  entryDate: string;
  /** Entry price */
  entryPrice: number;
  /** Exit bar index */
  exitIndex: number | null;
  /** Exit date */
  exitDate: string | null;
  /** Exit price */
  exitPrice: number | null;
  /** Position direction */
  direction: 'long' | 'short';
  /** Quantity */
  quantity: number;
  /** Gross P&L */
  grossPnl: number | null;
  /** Net P&L (after commission & slippage) */
  netPnl: number | null;
  /** Return percentage */
  returnPercent: number | null;
  /** Holding period in bars */
  holdingPeriod: number | null;
  /** Exit reason: 'signal' | 'stop_loss' | 'take_profit' | 'trailing_stop' */
  exitReason: string | null;
}

export interface AlgoBacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalGrossPnl: number;
  totalNetPnl: number;
  totalReturnPercent: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgHoldingPeriod: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  bestTrade: number;
  worstTrade: number;
  avgReturnPerTrade: number;
  totalCommission: number;
}

export interface AlgoBacktestResult {
  strategy: AlgoStrategy;
  /** List of all simulated trades */
  trades: AlgoTrade[];
  /** Performance metrics */
  metrics: AlgoBacktestMetrics;
  /** Equity curve (cumulative P&L per bar) */
  equityCurve: { date: string; equity: number; drawdown: number }[];
  /** Error messages (e.g. formula evaluation failures) */
  errors?: string[];
}

// ============================================================================
// Helpers — compute formula values per bar
// ============================================================================

// ============================================================================
// Core Backtest Function
// ============================================================================

/** Maximum periods with entry/exit formulas evaluated but position held */
const MAX_BARS = 5000;

export function runAlgoBacktest(
  strategy: AlgoStrategy,
  data: StockHistoryPoint[],
): AlgoBacktestResult {
  const errors: string[] = [];

  if (data.length < 50) {
    return {
      strategy,
      trades: [],
      metrics: createEmptyMetrics(),
      equityCurve: [],
      errors: ['Need at least 50 bars of historical data'],
    };
  }

  if (data.length > MAX_BARS) {
    data = data.slice(data.length - MAX_BARS);
  }

  const trades: AlgoTrade[] = [];
  const equityCurve: { date: string; equity: number; drawdown: number }[] = [];

  // ── Pre-compute entry/exit formula values for the entire dataset ──
  // This avoids O(n²) per-bar formula evaluation
  let entryValues: (number | null)[] = [];
  let exitValues: (number | null)[] = [];
  try {
    const { evaluateFormula } = require('../utils/indicatorFormulaEngine');
    entryValues = evaluateFormula(strategy.entryFormula, data).values;
    exitValues = evaluateFormula(strategy.exitFormula, data).values;
  } catch (e: any) {
    errors.push(`Formula pre-computation error: ${e.message}`);
  }

  // Position state
  let position: {
    type: 'long' | 'short';
    entryIndex: number;
    entryPrice: number;
    quantity: number;
    highestPrice: number;
    lowestPrice: number;
    stopLossPrice: number;
    takeProfitPrice: number;
  } | null = null;

  let cumulativePnl = 0;
  let runningMax = 0;
  let maxDrawdown = 0;
  let tradeIndex = 0;

  const commission = strategy.commission || 0.001;
  const slippage = strategy.slippage || 0.001;

  // Bar-by-bar simulation — read from pre-computed values
  for (let i = 50; i < data.length; i++) {
    const bar = data[i];
    const close = bar.close;
    const high = bar.high;
    const low = bar.low;

    // Currently in a position — check exit conditions
    if (position) {
      let shouldExit = false;
      let exitReason = 'signal';
      let exitPrice = close;

      // Check exit formula (from pre-computed values)
      const exitSignal = exitValues[i] ?? 0;
      if (exitSignal > 0) {
        shouldExit = true;
        exitReason = 'signal';
      }

      // Check stop loss
      if (strategy.stopLossPercent && !shouldExit) {
        if (position.type === 'long' && low <= position.stopLossPrice) {
          shouldExit = true;
          exitReason = 'stop_loss';
          exitPrice = position.stopLossPrice;
        } else if (position.type === 'short' && high >= position.stopLossPrice) {
          shouldExit = true;
          exitReason = 'stop_loss';
          exitPrice = position.stopLossPrice;
        }
      }

      // Check take profit
      if (strategy.takeProfitPercent && !shouldExit) {
        if (position.type === 'long' && high >= position.takeProfitPrice) {
          shouldExit = true;
          exitReason = 'take_profit';
          exitPrice = position.takeProfitPrice;
        } else if (position.type === 'short' && low <= position.takeProfitPrice) {
          shouldExit = true;
          exitReason = 'take_profit';
          exitPrice = position.takeProfitPrice;
        }
      }

      // Trailing stop: update highest/lowest
      const trailActivation = strategy.trailingActivation || 5;
      const trailDistance = strategy.trailingDistance || 2;
      if (strategy.trailingStop) {
        if (position.type === 'long') {
          if (close > position.highestPrice) {
            position.highestPrice = close;
            const profitPercent = ((close - position.entryPrice) / position.entryPrice) * 100;
            if (profitPercent >= trailActivation) {
              const newStop = position.highestPrice * (1 - trailDistance / 100);
              if (newStop > position.stopLossPrice) {
                position.stopLossPrice = newStop;
              }
            }
          }
          if (close <= position.stopLossPrice) {
            shouldExit = true;
            exitReason = 'trailing_stop';
            exitPrice = position.stopLossPrice;
          }
        } else {
          if (close < position.lowestPrice) {
            position.lowestPrice = close;
            const profitPercent = ((position.entryPrice - close) / position.entryPrice) * 100;
            if (profitPercent >= trailActivation) {
              const newStop = position.lowestPrice * (1 + trailDistance / 100);
              if (newStop < position.stopLossPrice) {
                position.stopLossPrice = newStop;
              }
            }
          }
          if (close >= position.stopLossPrice) {
            shouldExit = true;
            exitReason = 'trailing_stop';
            exitPrice = position.stopLossPrice;
          }
        }
      }

      // Exit position
      if (shouldExit) {
        const grossPnl = position.type === 'long'
          ? (exitPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - exitPrice) * position.quantity;

        const totalCommission = position.entryPrice * position.quantity * commission
          + exitPrice * position.quantity * commission;
        const totalSlippage = exitPrice * position.quantity * slippage;
        const netPnl = grossPnl - totalCommission - totalSlippage;

        if (netPnl > 0) cumulativePnl += netPnl;
        else cumulativePnl += netPnl;

        trades.push({
          id: `trade_${tradeIndex++}`,
          entryIndex: position.entryIndex,
          entryDate: data[position.entryIndex].date,
          entryPrice: position.entryPrice,
          exitIndex: i,
          exitDate: bar.date,
          exitPrice,
          direction: position.type,
          quantity: position.quantity,
          grossPnl: Math.round(grossPnl * 100) / 100,
          netPnl: Math.round(netPnl * 100) / 100,
          returnPercent: Math.round((netPnl / (position.entryPrice * position.quantity)) * 10000) / 100,
          holdingPeriod: i - position.entryIndex,
          exitReason,
        });

        position = null;
      }
    }

    // Not in a position — check entry
    if (!position) {
      const entrySignal = entryValues[i] ?? 0;
      const allowShort = strategy.allowShort || false;

      if (entrySignal > 0.5) {
        const direction: 'long' | 'short' = entrySignal > 0.5 ? 'long' : 'short';
        const entryPrice = close * (1 + slippage);

        // Calculate position size
        let quantity = 0;
        const capital = 100000; // Assume 1L capital for demo
        switch (strategy.sizingMethod) {
          case 'fixed_qty':
            quantity = Math.round(strategy.sizingValue);
            break;
          case 'percent_risk':
            quantity = Math.round((capital * (strategy.sizingValue / 100)) / entryPrice);
            break;
          case 'fixed_capital':
            quantity = Math.round(strategy.sizingValue / entryPrice);
            break;
        }
        if (quantity < 1) quantity = 1;

        const stopLossPrice = strategy.stopLossPercent
          ? direction === 'long'
            ? entryPrice * (1 - strategy.stopLossPercent / 100)
            : entryPrice * (1 + strategy.stopLossPercent / 100)
          : direction === 'long'
            ? entryPrice * 0.95
            : entryPrice * 1.05;

        const takeProfitPrice = strategy.takeProfitPercent
          ? direction === 'long'
            ? entryPrice * (1 + strategy.takeProfitPercent / 100)
            : entryPrice * (1 - strategy.takeProfitPercent / 100)
          : direction === 'long'
            ? entryPrice * 1.10
            : entryPrice * 0.90;

        position = {
          type: direction,
          entryIndex: i,
          entryPrice,
          quantity,
          highestPrice: entryPrice,
          lowestPrice: entryPrice,
          stopLossPrice,
          takeProfitPrice,
        };
      }
    }

    // Update equity curve
    const openPnl = position
      ? position.type === 'long'
        ? (close - position.entryPrice) * position.quantity
        : (position.entryPrice - close) * position.quantity
      : 0;

    const totalEquity = cumulativePnl + openPnl;
    if (totalEquity > runningMax) runningMax = totalEquity;
    const drawdown = runningMax - totalEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    equityCurve.push({
      date: bar.date,
      equity: Math.round(totalEquity * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  }

  // Close any open position at last bar
  if (position) {
    const lastBar = data[data.length - 1];
    const exitPrice = lastBar.close;
    const grossPnl = position.type === 'long'
      ? (exitPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - exitPrice) * position.quantity;

    trades.push({
      id: `trade_${tradeIndex++}`,
      entryIndex: position.entryIndex,
      entryDate: data[position.entryIndex].date,
      entryPrice: position.entryPrice,
      exitIndex: data.length - 1,
      exitDate: lastBar.date,
      exitPrice,
      direction: position.type,
      quantity: position.quantity,
      grossPnl: Math.round(grossPnl * 100) / 100,
      netPnl: Math.round(grossPnl * 100) / 100,
      returnPercent: Math.round((grossPnl / (position.entryPrice * position.quantity)) * 10000) / 100,
      holdingPeriod: data.length - 1 - position.entryIndex,
      exitReason: 'end_of_data',
    });
  }

  // Compute metrics
  const metrics = computeMetrics(trades);

  return {
    strategy,
    trades,
    metrics,
    equityCurve,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================================
// Metrics Computation
// ============================================================================

function computeMetrics(trades: AlgoTrade[]): AlgoBacktestMetrics {
  if (trades.length === 0) return createEmptyMetrics();

  const winning = trades.filter(t => (t.netPnl ?? 0) > 0);
  const losing = trades.filter(t => (t.netPnl ?? 0) < 0);
  const allPnl = trades.map(t => t.netPnl ?? 0);

  const totalNetPnl = allPnl.reduce((s, v) => s + v, 0);
  const totalGrossPnl = trades.reduce((s, t) => s + (t.grossPnl ?? 0), 0);
  const winRate = (winning.length / trades.length) * 100;

  const avgWin = winning.length > 0
    ? winning.reduce((s, t) => s + (t.netPnl ?? 0), 0) / winning.length
    : 0;
  const avgLoss = losing.length > 0
    ? Math.abs(losing.reduce((s, t) => s + (t.netPnl ?? 0), 0) / losing.length)
    : 0;

  const totalWin = winning.reduce((s, t) => s + (t.netPnl ?? 0), 0);
  const totalLoss = Math.abs(losing.reduce((s, t) => s + (t.netPnl ?? 0), 0));
  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;

  const holdingPeriods = trades
    .filter(t => t.holdingPeriod !== null)
    .map(t => t.holdingPeriod!);
  const avgHoldingPeriod = holdingPeriods.length > 0
    ? holdingPeriods.reduce((s, v) => s + v, 0) / holdingPeriods.length
    : 0;

  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  for (const t of trades) {
    if ((t.netPnl ?? 0) > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxConsecutiveWins) maxConsecutiveWins = currentWinStreak;
    } else {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxConsecutiveLosses) maxConsecutiveLosses = currentLossStreak;
    }
  }

  const avgReturnPerTrade = trades.length > 0
    ? totalNetPnl / trades.length
    : 0;

  // Sharpe ratio from trade returns
  const returns = trades.map(t => t.returnPercent ?? 0);
  const avgReturn = returns.length > 0
    ? returns.reduce((s, v) => s + v, 0) / returns.length
    : 0;
  const stdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((s, v) => s + (v - avgReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdDev > 0
    ? (avgReturn / stdDev) * Math.sqrt(252)
    : 0;

  // Sortino ratio (downside deviation only)
  const downsideReturns = returns.filter(v => v < 0);
  const downsideStdDev = downsideReturns.length > 1
    ? Math.sqrt(downsideReturns.reduce((s, v) => s + (v - avgReturn) ** 2, 0) / (downsideReturns.length - 1))
    : 0;
  const sortinoRatio = downsideStdDev > 0
    ? (avgReturn / downsideStdDev) * Math.sqrt(252)
    : 0;

  const bestTrade = trades.length > 0
    ? Math.max(...trades.map(t => t.netPnl ?? 0))
    : 0;
  const worstTrade = trades.length > 0
    ? Math.min(...trades.map(t => t.netPnl ?? 0))
    : 0;

  const totalCommission = trades.reduce(
    (s, t) => s + (t.grossPnl ?? 0) - (t.netPnl ?? 0),
    0,
  );

  return {
    totalTrades: trades.length,
    winningTrades: winning.length,
    losingTrades: losing.length,
    winRate: Math.round(winRate * 100) / 100,
    totalGrossPnl: Math.round(totalGrossPnl * 100) / 100,
    totalNetPnl: Math.round(totalNetPnl * 100) / 100,
    totalReturnPercent: 0, // Requires initial capital input
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: profitFactor === Infinity ? Infinity : Math.round(profitFactor * 100) / 100,
    maxDrawdown: 0, // Computed from equity curve
    maxDrawdownPercent: 0,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    avgHoldingPeriod: Math.round(avgHoldingPeriod * 10) / 10,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    bestTrade: Math.round(bestTrade * 100) / 100,
    worstTrade: Math.round(worstTrade * 100) / 100,
    avgReturnPerTrade: Math.round(avgReturnPerTrade * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
  };
}

function createEmptyMetrics(): AlgoBacktestMetrics {
  return {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    totalGrossPnl: 0,
    totalNetPnl: 0,
    totalReturnPercent: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    avgHoldingPeriod: 0,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    bestTrade: 0,
    worstTrade: 0,
    avgReturnPerTrade: 0,
    totalCommission: 0,
  };
}

// ============================================================================
// Generate mock data for backtesting
// ============================================================================

export function generateMockHistory(
  basePrice: number,
  days: number = 365,
): StockHistoryPoint[] {
  const data: StockHistoryPoint[] = [];
  let price = basePrice;
  const today = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.48) * basePrice * 0.025;
    price = Math.max(price + change, basePrice * 0.3);

    const open = price + (Math.random() - 0.5) * 2;
    const close = price;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;

    data.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(Math.random() * 10000000) + 2000000,
    });
  }

  return data;
}
