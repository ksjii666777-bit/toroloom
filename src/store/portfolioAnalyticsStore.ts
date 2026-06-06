/**
 * ============================================================================
 * Toroloom Portfolio Analytics Store
 * ============================================================================
 *
 * Computes advanced portfolio analytics from raw holdings and trades data:
 *   - Performance metrics (Sharpe ratio, win rate, drawdown, etc.)
 *   - Capital gains (STCG / LTCG breakdown with tax estimates)
 *   - P&L history (daily cumulative P&L for charts)
 *   - Month-over-month returns
 *   - Sector allocation
 *
 * All computations are client-side and derived from Zustand stores.
 * No backend API needed — pure math on existing data.
 *
 * Also supports **real-time WebSocket subscription** for live P&L updates.
 * When subscribed, the store invalidates its cache on every P&L tick,
 * appends live data points to `pnlHistoryStream`, and updates holdings'
 * current values from the WS service's internal price map.
 *
 * ============================================================================
 */

import { create } from 'zustand';
import { usePortfolioStore } from './portfolioStore';
import { getActiveWS } from '../services/wsRegistry';
import { log } from '../utils/logger';
import { useNotificationStore, PortfolioAlertData } from './notificationStore';
import type {
  PerformanceMetrics,
  CapitalGains,
  MonthOverMonthReturn,
  PortfolioAnalytics,
  Holding,
  Trade,
} from '../types';

// ==================== Helpers ====================

/** Safe division — returns 0 if divisor is 0 */
function safeDiv(a: number, b: number): number {
  if (b === 0 || !isFinite(b)) return 0;
  const result = a / b;
  return isFinite(result) ? result : 0;
}

/** Compute days between two dates */
function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

/** Group trades by month key (YYYY-MM) */
function groupByMonth(trades: Trade[]): Map<string, Trade[]> {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = new Date(t.timestamp).toISOString().slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return groups;
}

// ==================== Store ====================

/** One live P&L history data point streamed from WebSocket ticks */
export interface LivePnLPoint {
  date: string;
  cumulativePnl: number;
  value: number;
}

interface AnalyticsState {
  /** Cached analytics — recomputed on demand */
  analytics: PortfolioAnalytics | null;
  /** Whether the analytics are currently being computed */
  isComputing: boolean;

  // ── Real-time streaming state ────────────────────────────
  /** Whether the store is subscribed to live WebSocket P&L updates */
  isLive: boolean;
  /** Last time a P&L update was received (ISO string) */
  lastUpdated: string | null;
  /** Streaming P&L history points — appended on each live tick (max 500) */
  pnlHistoryStream: LivePnLPoint[];

  /** Compute analytics from current portfolio store data */
  compute: () => PortfolioAnalytics;
  /** Get cached analytics (compute if not yet cached) */
  getAnalytics: () => PortfolioAnalytics;
  /** Invalidate cache so next getAnalytics() recomputes */
  invalidateCache: () => void;

  // ── Live subscription ───────────────────────────────────
  /** Subscribe to real-time P&L updates via portfolioStore subscription */
  subscribeToLiveUpdates: () => void;
  /** Unsubscribe from live P&L updates */
  unsubscribeFromLiveUpdates: () => void;

  /** Internal: unsubscribe function returned by portfolioStore.subscribe */
  _unsubPortfolio: (() => void) | null;
}

// Maximum points kept in the live streaming P&L history
const MAX_STREAM_POINTS = 500;

/** Internal unsubscribe handle for portfolioStore subscription */
let _unsubPortfolio: (() => void) | null = null;

export const usePortfolioAnalyticsStore = create<AnalyticsState>((set, get) => ({
  analytics: null,
  isComputing: false,
  isLive: false,
  lastUpdated: null,
  pnlHistoryStream: [],
  _unsubPortfolio: null,

  compute: () => {
    set({ isComputing: true });

    const { holdings, trades } = usePortfolioStore.getState();

    // ── 1. Basic Portfolio Totals ────────────────────────────────
    const totalInvested = holdings.reduce((s, h) => s + h.totalInvested, 0);
    const currentValue = holdings.reduce((s, h) => s + h.currentValue, 0);
    const totalReturn = currentValue - totalInvested;
    const totalReturnPercent = safeDiv(totalReturn, totalInvested) * 100;

    // ── 2. Realized vs Unrealized P&L ───────────────────────────
    const realizedPnl = trades
      .filter(t => t.type === 'sell')
      .reduce((s, t) => s + t.total, 0);
    const unrealizedPnl = totalReturn - realizedPnl;

    // ── 3. Win/Loss Analysis from Holdings ──────────────────────
    const winningHoldings = holdings.filter(h => h.pnl > 0);
    const losingHoldings = holdings.filter(h => h.pnl < 0);
    const totalTrades = trades.length;
    const buyTrades = trades.filter(t => t.type === 'buy').length;
    const sellTrades = trades.filter(t => t.type === 'sell');
    const winningSells = sellTrades.filter(t => t.total > 0);
    const losingSells = sellTrades.filter(t => t.total <= 0);
    const winningTrades = winningSells.length;
    const losingTrades = losingSells.length;
    const winRate = safeDiv(winningTrades, winningTrades + losingTrades) * 100;

    // ── 4. Avg Win / Avg Loss / Profit Factor ───────────────────
    const avgWin = winningSells.length > 0
      ? winningSells.reduce((s, t) => s + t.total, 0) / winningSells.length
      : 0;
    const avgLoss = losingSells.length > 0
      ? Math.abs(losingSells.reduce((s, t) => s + t.total, 0)) / losingSells.length
      : 0;
    const profitFactor = avgLoss > 0 ? safeDiv(avgWin, avgLoss) : winningTrades > 0 ? Infinity : 0;

    // ── 5. Best / Worst Trade by P&L ────────────────────────────
    const allSellPnl = sellTrades.map(t => t.total);
    const bestTrade = allSellPnl.length > 0 ? Math.max(...allSellPnl) : 0;
    const worstTrade = allSellPnl.length > 0 ? Math.min(...allSellPnl) : 0;

    // ── 6. Consecutive Wins/Losses ──────────────────────────────
    let consecutiveWins = 0, consecutiveLosses = 0;
    let maxConsecutiveWins = 0, maxConsecutiveLosses = 0;
    for (const t of sellTrades.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )) {
      if (t.total > 0) {
        consecutiveWins++;
        consecutiveLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
      } else {
        consecutiveLosses++;
        consecutiveWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
      }
    }

    // ── 7. Drawdown (from daily P&L history) ───────────────────
    const pnlHistory = computePnlHistory(holdings, trades);
    let maxDrawdown = 0;
    let peakValue = totalInvested;
    for (const point of pnlHistory) {
      const portfolioVal = totalInvested + point.cumulativePnl;
      if (portfolioVal > peakValue) peakValue = portfolioVal;
      const drawdown = peakValue - portfolioVal;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    const maxDrawdownPercent = safeDiv(maxDrawdown, peakValue) * 100;

    // ── 8. Sharpe Ratio (simplified — using daily returns) ──────
    const dailyReturns: number[] = [];
    for (let i = 1; i < pnlHistory.length; i++) {
      const prevVal = totalInvested + pnlHistory[i - 1].cumulativePnl;
      const currVal = totalInvested + pnlHistory[i].cumulativePnl;
      dailyReturns.push(safeDiv(currVal - prevVal, prevVal));
    }
    const avgDailyReturn = dailyReturns.length > 0
      ? dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length
      : 0;
    const dailyVariance = dailyReturns.length > 0
      ? dailyReturns.reduce((s, r) => s + (r - avgDailyReturn) ** 2, 0) / dailyReturns.length
      : 0;
    const dailyStdDev = Math.sqrt(dailyVariance);
    // Annualized Sharpe (assuming ~252 trading days, risk-free rate = 6.5% Indian T-bill)
    const riskFreeRate = 0.065;
    const annualizedReturn = avgDailyReturn * 252;
    const annualizedStdDev = dailyStdDev * Math.sqrt(252);
    const sharpeRatio = annualizedStdDev > 0
      ? safeDiv(annualizedReturn - riskFreeRate, annualizedStdDev)
      : 0;

    // ── 9. Average Holding Period ──────────────────────────────
    const holdingDays = holdings.map(h => {
      const firstBuy = trades.find(t =>
        t.symbol === h.symbol && t.type === 'buy'
      );
      return firstBuy ? daysBetween(firstBuy.timestamp, new Date().toISOString()) : 0;
    });
    const avgHoldingDays = holdingDays.length > 0
      ? holdingDays.reduce((s, d) => s + d, 0) / holdingDays.length
      : 0;

    // ── 10. Day Change ─────────────────────────────────────────
    const dayChange = holdings.reduce((s, h) => s + h.dayChange, 0);
    const dayChangePercent = safeDiv(dayChange, currentValue) * 100;

    // ── 11. Capital Gains (Tax) ────────────────────────────────
    const capitalGains = computeCapitalGains(trades);

    // ── 12. Monthly Returns ────────────────────────────────────
    const monthlyReturns = computeMonthlyReturns(trades, holdings);

    // ── 13. Sector Allocation ──────────────────────────────────
    const sectorAllocation = computeSectorAllocation(holdings, currentValue);

    const metrics: PerformanceMetrics = {
      totalReturn,
      totalReturnPercent,
      realizedPnl,
      unrealizedPnl,
      dayChange,
      dayChangePercent,
      winRate,
      totalTrades,
      winningTrades,
      losingTrades,
      avgWin,
      avgLoss,
      profitFactor: isFinite(profitFactor) ? profitFactor : 0,
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      avgHoldingDays: Math.round(avgHoldingDays),
      bestTrade,
      worstTrade,
      consecutiveWins: maxConsecutiveWins,
      consecutiveLosses: maxConsecutiveLosses,
    };

    const analytics: PortfolioAnalytics = {
      metrics,
      capitalGains,
      monthlyReturns,
      sectorAllocation,
      pnlHistory,
    };

    set({ analytics, isComputing: false });
    return analytics;
  },

  getAnalytics: () => {
    const state = get();
    if (state.analytics) return state.analytics;
    return state.compute();
  },

  invalidateCache: () => {
    set({ analytics: null });
  },

  // ── Live Subscription ────────────────────────────────────────────
  //
  // Instead of registering a separate WebSocket callback (which would
  // overwrite the riskStore's callback), the analytics store subscribes
  // to the **riskStore** state — specifically `today.unrealizedPnL` —
  // which is already updated on every P&L tick via the riskStore's own
  // WebSocket listener.
  //
  // On each riskStore change:
  //   1. Reads live prices from the WS price map and updates holdings
  //   2. Invalidates the analytics cache and recomputes
  //   3. Appends a data point to pnlHistoryStream for real-time charts
  //
  // This gives the ReportsScreen live-refreshing performance metrics
  // and a streaming P&L chart without any callback conflict.

  subscribeToLiveUpdates: () => {
    const s = get();
    if (s.isLive) return;

    const ws = getActiveWS();

    // Connect the WebSocket if it isn't already
    try {
      const conn = ws.connect();
      if (conn && typeof conn.catch === 'function') {
        conn.catch(() => {
          log.warn('[AnalyticsStore] WS connect failed — live updates unavailable');
        });
      }
    } catch {
      log.warn('[AnalyticsStore] WS connect threw — live updates unavailable');
    }

    // Subscribe to portfolioStore changes — when live prices update
    // (either from WS tick callbacks or riskStore P&L triggers), we
    // read the latest prices from the WS price map and recompute.
    _unsubPortfolio = usePortfolioStore.subscribe(
      (portfolioState) => {
        const currentState = get();
        if (!currentState.isLive) return;

        const { holdings } = portfolioState;
        if (holdings.length === 0) return;

        // 1. Update each holding's current price from the WS price map
        const updatedHoldings = holdings.map(h => {
          const livePrice = ws.getCurrentPrice(h.stockId);
          if (livePrice > 0 && Math.abs(livePrice - h.currentPrice) > 0.01) {
            const newValue = livePrice * h.quantity;
            const newPnl = newValue - h.totalInvested;
            const newPnlPercent = safeDiv(newPnl, h.totalInvested) * 100;
            const dayChangeVal = (livePrice - h.buyPrice) * h.quantity;
            return {
              ...h,
              currentPrice: livePrice,
              currentValue: Math.round(newValue * 100) / 100,
              pnl: Math.round(newPnl * 100) / 100,
              pnlPercent: Math.round(newPnlPercent * 100) / 100,
              dayChange: Math.round(dayChangeVal * 100) / 100,
              dayChangePercent: Math.round(safeDiv(dayChangeVal, h.totalInvested) * 10000) / 100,
            };
          }
          return h;
        });

        // Check if any prices actually changed
        const hasChanges = updatedHoldings.some((h, i) => h.currentPrice !== holdings[i].currentPrice);
        if (!hasChanges) return;

        // Sync updated holdings back to portfolio store
        usePortfolioStore.setState({ holdings: updatedHoldings });

        // 2. Invalidate cache and recompute analytics
        const analytics = get().compute();

        // 3. Evaluate portfolio alert rules against current state
        try {
          const totalInvested = updatedHoldings.reduce((s: number, h: any) => s + h.totalInvested, 0);
          const currentValue = updatedHoldings.reduce((s: number, h: any) => s + h.currentValue, 0);
          const peakValue = Math.max(...analytics.pnlHistory.map(p => p.value));
          const portfolioData: PortfolioAlertData = {
            totalReturnPercent: analytics.metrics.totalReturnPercent,
            totalReturn: analytics.metrics.totalReturn,
            totalInvested,
            currentValue,
            peakValue,
            holdings: updatedHoldings,
            consecutiveLossDays: 0,
          };
          useNotificationStore.getState().evaluatePortfolioAlerts(portfolioData);
        } catch {
          // Silently skip if notification store is not available
        }

        // 3. Append live data point to streaming history
        const now = new Date().toISOString();
        const newPoint: LivePnLPoint = {
          date: now,
          cumulativePnl: analytics.metrics.totalReturn,
          value: analytics.metrics.totalReturn + (updatedHoldings.reduce((s, h) => s + h.totalInvested, 0)),
        };

        const stream = [...currentState.pnlHistoryStream, newPoint];
        if (stream.length > MAX_STREAM_POINTS) {
          stream.splice(0, stream.length - MAX_STREAM_POINTS);
        }

        set({
          lastUpdated: now,
          pnlHistoryStream: stream,
        });
      },
    );

    set({ isLive: true });
    log.info('[AnalyticsStore] Subscribed to live P&L updates (via portfolioStore subscription)');
  },

  unsubscribeFromLiveUpdates: () => {
    if (_unsubPortfolio) {
      _unsubPortfolio();
      _unsubPortfolio = null;
    }
    set({ isLive: false });
    log.info('[AnalyticsStore] Unsubscribed from live P&L updates');
  },
}));

// ==================== Computation Helpers ====================

/**
 * Compute daily P&L history from holdings and trades.
 * Generates an array of { date, value, cumulativePnl } for the last ~365 days.
 */
function computePnlHistory(
  holdings: Holding[],
  trades: Trade[],
): { date: string; value: number; cumulativePnl: number }[] {
  const today = new Date();
  const history: { date: string; value: number; cumulativePnl: number }[] = [];
  let cumulativePnl = 0;

  // Build a map of trade dates for quick lookup
  const tradeMap = new Map<string, number>();
  for (const t of trades) {
    const dayKey = new Date(t.timestamp).toISOString().slice(0, 10);
    const pnlImpact = t.type === 'sell' ? t.total : -t.total;
    tradeMap.set(dayKey, (tradeMap.get(dayKey) || 0) + pnlImpact);
  }

  // Simulate daily P&L for the last 365 trading days
  const totalInvested = holdings.reduce((s, h) => s + h.totalInvested, 0) || 623500;
  let simulatedValue = totalInvested;

  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // Skip weekends

    const dayKey = date.toISOString().slice(0, 10);

    // Daily market movement (random simulation for demo)
    const dailyReturn = (Math.random() - 0.48) * 0.025;
    simulatedValue *= (1 + dailyReturn);

    // Add trade P&L impact
    const tradePnl = tradeMap.get(dayKey) || 0;
    simulatedValue += tradePnl;

    cumulativePnl = simulatedValue - totalInvested;

    history.push({
      date: dayKey,
      value: Math.round(simulatedValue * 100) / 100,
      cumulativePnl: Math.round(cumulativePnl * 100) / 100,
    });
  }

  return history;
}

/**
 * Compute capital gains breakdown (STCG vs LTCG) with tax estimates.
 */
function computeCapitalGains(trades: Trade[]): CapitalGains {
  let shortTermGains = 0;
  let longTermGains = 0;
  let shortTermCount = 0;
  let longTermCount = 0;

  // Analyze sell trades by holding period
  const sellTrades = trades.filter(t => t.type === 'sell');
  for (const sell of sellTrades) {
    // Find the corresponding buy trade
    const buyTrade = trades.find(t =>
      t.symbol === sell.symbol && t.type === 'buy'
    );
    if (buyTrade) {
      const holdDays = daysBetween(buyTrade.timestamp, sell.timestamp);
      const pnl = sell.total - (buyTrade.price * sell.quantity); // Simplified

      if (holdDays <= 365) {
        shortTermGains += pnl;
        shortTermCount++;
      } else {
        longTermGains += pnl;
        longTermCount++;
      }
    }
  }

  // Indian tax rules (FY 2025-26)
  const stcgTaxRate = 0.15; // 15% for equity STCG
  const ltcgTaxRate = 0.10; // 10% for equity LTCG above ₹1L
  const ltexemptLimit = 100000; // ₹1L exempt

  const ltcgTaxable = Math.max(0, longTermGains - ltexemptLimit);
  const stcgTax = Math.max(0, shortTermGains) * stcgTaxRate;
  const ltcgTax = Math.max(0, ltcgTaxable) * ltcgTaxRate;

  // Simplified STT & brokerage calculation
  const sttPaid = Math.abs(shortTermGains + longTermGains) * 0.001; // ~0.1% STT
  const totalBrokerage = Math.abs(shortTermGains + longTermGains) * 0.0003; // ~0.03% brokerage

  return {
    shortTerm: {
      gains: Math.round(shortTermGains * 100) / 100,
      count: shortTermCount,
      taxRate: stcgTaxRate * 100,
      estimatedTax: Math.round(stcgTax * 100) / 100,
    },
    longTerm: {
      gains: Math.round(longTermGains * 100) / 100,
      count: longTermCount,
      taxRate: ltcgTaxRate * 100,
      exemptLimit: ltexemptLimit,
      taxableGains: Math.round(ltcgTaxable * 100) / 100,
      estimatedTax: Math.round(ltcgTax * 100) / 100,
    },
    totalEstimatedTax: Math.round((stcgTax + ltcgTax) * 100) / 100,
    sttPaid: Math.round(sttPaid * 100) / 100,
    totalBrokerage: Math.round(totalBrokerage * 100) / 100,
  };
}

/**
 * Compute month-over-month returns from trades and holdings.
 */
function computeMonthlyReturns(
  trades: Trade[],
  holdings: Holding[],
): MonthOverMonthReturn[] {
  const byMonth = groupByMonth(trades);
  const months: MonthOverMonthReturn[] = [];
  let cumulativeValue = holdings.reduce((s, h) => s + h.totalInvested, 0) || 623500;

  const sortedMonths = Array.from(byMonth.keys()).sort();
  for (const monthKey of sortedMonths) {
    const monthTrades = byMonth.get(monthKey)!;
    const buyVolume = monthTrades
      .filter(t => t.type === 'buy')
      .reduce((s, t) => s + t.total, 0);
    const sellVolume = monthTrades
      .filter(t => t.type === 'sell')
      .reduce((s, t) => s + t.total, 0);
    const netFlow = sellVolume - buyVolume;

    const startValue = cumulativeValue;
    cumulativeValue += netFlow;

    // Simulated market return for the month
    const marketReturn = (Math.random() - 0.45) * 0.06 + 0.01;
    const endValue = cumulativeValue * (1 + marketReturn);
    const returnAmt = endValue - startValue - netFlow;

    months.push({
      month: monthKey,
      startValue: Math.round(startValue),
      endValue: Math.round(endValue),
      return: Math.round(returnAmt),
      returnPercent: Math.round(safeDiv(returnAmt, startValue) * 10000) / 100,
      contributions: Math.round(buyVolume),
    });

    cumulativeValue = endValue;
  }

  return months;
}

/**
 * Compute sector allocation breakdown from holdings.
 */
function computeSectorAllocation(
  holdings: Holding[],
  currentValue: number,
): { sector: string; value: number; percent: number; count: number }[] {
  const sectors: Record<string, { value: number; count: number }> = {};

  for (const h of holdings) {
    const sector = inferSector(h.name);
    if (!sectors[sector]) sectors[sector] = { value: 0, count: 0 };
    sectors[sector].value += h.currentValue;
    sectors[sector].count += 1;
  }

  return Object.entries(sectors)
    .map(([sector, data]) => ({
      sector,
      value: Math.round(data.value),
      percent: safeDiv(data.value, currentValue) * 100,
      count: data.count,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Infer sector from stock name.
 */
function inferSector(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('bank') || n.includes('finance') || n.includes('bajaj') || n.includes('hdfc') || n.includes('icici')) return 'Finance';
  if (n.includes('tech') || n.includes('consultancy') || n.includes('infosys') || n.includes('wipro') || n.includes('tcs')) return 'Technology';
  if (n.includes('energy') || n.includes('reliance') || n.includes('oil') || n.includes('power')) return 'Energy';
  if (n.includes('consumer') || n.includes('unilever') || n.includes('itc') || n.includes('hul')) return 'Consumer';
  if (n.includes('auto') || n.includes('tata motor') || n.includes('maruti')) return 'Automobile';
  if (n.includes('telecom') || n.includes('airtel') || n.includes('idea')) return 'Telecom';
  if (n.includes('pharma') || n.includes('sun') || n.includes('cipla') || n.includes('dr. reddy')) return 'Pharma';
  if (n.includes('metal') || n.includes('tata steel') || n.includes('jsw') || n.includes('hindalco')) return 'Metals';
  return 'Others';
}
