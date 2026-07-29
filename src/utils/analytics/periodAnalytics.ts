/**
 * ============================================================================
 * Toroloom — Period Analytics Helpers
 * ============================================================================
 *
 * Pure functions for computing period-based analytics from trades and holdings.
 * Extracted from PeriodReportScreen for independent testing and reuse.
 *
 * Functions:
 *   - groupTradesByPeriod  — Groups sell trades into weekly/monthly/yearly periods
 *   - groupLosersBySector  — Groups losing holdings by their sector
 *   - computeSectorMetrics — Computes per-sector win/loss metrics from trades
 *
 * ============================================================================
 */

import { classifySector } from '../../services/gateway/cognitiveAnalytics';
import type { Holding, Trade } from '../../types';

// ──── Types ─────────────────────────────────────────────────────────────────

export type PeriodType = 'weekly' | 'monthly' | 'yearly';

export interface PeriodSummary {
  label: string;
  startDate: string;
  endDate: string;
  pnl: number;
  trades: number;
  winners: number;
  losers: number;
}

export interface SectorLossGroup {
  sector: string;
  totalLoss: number;
  totalLossPercent: number;
  stocks: Holding[];
}

export interface SectorMetrics {
  sector: string;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  trades: Trade[];
}

// ──── Sector Metrics ────────────────────────────────────────────────────────

export function computeSectorMetrics(trades: Trade[]): SectorMetrics[] {
  const sectorTrades = new Map<string, Trade[]>();

  for (const t of trades) {
    if (t.type !== 'sell') continue;
    const sector = classifySector(t.symbol);
    if (!sectorTrades.has(sector)) sectorTrades.set(sector, []);
    sectorTrades.get(sector)!.push(t);
  }

  return Array.from(sectorTrades.entries())
    .map(([sector, sectorTradeList]) => {
      const wins = sectorTradeList.filter(t => t.total > 0);
      const losses = sectorTradeList.filter(t => t.total <= 0);
      const totalWins = wins.length;
      const totalLosses = losses.length;
      const avgWin = totalWins > 0 ? wins.reduce((s, t) => s + t.total, 0) / totalWins : 0;
      const avgLoss = totalLosses > 0 ? Math.abs(losses.reduce((s, t) => s + t.total, 0) / totalLosses) : 0;
      const profitFactor = avgLoss > 0 && avgWin > 0 ? avgWin / avgLoss : avgWin > 0 ? 99 : 0;
      return { sector, totalTrades: totalWins + totalLosses, totalWins, totalLosses, avgWin, avgLoss, profitFactor, trades: sectorTradeList };
    })
    .sort((a, b) => b.totalTrades - a.totalTrades);
}

// ──── Group Trades into Periods ─────────────────────────────────────────────

export function groupTradesByPeriod(
  trades: Trade[],
  holdings: Holding[],
  period: PeriodType,
): PeriodSummary[] {
  if (trades.length === 0 && holdings.length === 0) return [];

  const now = new Date();
  const periods = new Map<string, Trade[]>();

  // Distribute sell trades into periods
  for (const t of trades) {
    if (t.type !== 'sell') continue;
    const d = new Date(t.timestamp);
    let key: string;

    if (period === 'weekly') {
      // ISO week number
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
      key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    } else if (period === 'monthly') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      key = `${d.getFullYear()}`;
    }

    if (!periods.has(key)) periods.set(key, []);
    periods.get(key)!.push(t);
  }

  // If no sell trades, use holdings current value as single period
  if (periods.size === 0 && holdings.length > 0) {
    const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0);
    const totalTrades = holdings.length;
    return [{
      label: period === 'weekly' ? 'Current' : period === 'monthly' ? now.toLocaleString('en-IN', { month: 'short', year: 'numeric' }) : String(now.getFullYear()),
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      endDate: now.toISOString(),
      pnl: totalPnl,
      trades: totalTrades,
      winners: holdings.filter(h => h.pnl >= 0).length,
      losers: holdings.filter(h => h.pnl < 0).length,
    }];
  }

  // Sort periods by key descending (most recent first)
  const sortedKeys = Array.from(periods.keys()).sort().reverse();

  return sortedKeys.map(key => {
    const periodTrades = periods.get(key)!;
    const pnl = periodTrades.reduce((s, t) => s + t.total, 0);
    const winners = periodTrades.filter(t => t.total > 0).length;
    const losers = periodTrades.filter(t => t.total <= 0).length;

    let label: string;
    let startDate: string;
    let endDate: string;

    if (period === 'weekly') {
      const [year, weekStr] = key.split('-W');
      const weekNum = parseInt(weekStr);
      const firstJan = new Date(parseInt(year), 0, 1);
      const days = (weekNum - 1) * 7;
      const start = new Date(firstJan.getTime() + days * 86400000);
      const end = new Date(start.getTime() + 6 * 86400000);
      label = `W${weekStr}`;
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (period === 'monthly') {
      const [year, month] = key.split('-');
      const m = parseInt(month) - 1;
      label = new Date(parseInt(year), m).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      startDate = new Date(parseInt(year), m, 1).toISOString();
      endDate = new Date(parseInt(year), m + 1, 0).toISOString();
    } else {
      label = key;
      startDate = new Date(parseInt(key), 0, 1).toISOString();
      endDate = new Date(parseInt(key), 11, 31).toISOString();
    }

    return { label, startDate, endDate, pnl, trades: periodTrades.length, winners, losers };
  });
}

// ──── Group Losing Holdings by Sector ───────────────────────────────────────

export function groupLosersBySector(holdings: Holding[]): SectorLossGroup[] {
  const losing = holdings.filter(h => h.pnl < 0);
  if (losing.length === 0) return [];

  const groups = new Map<string, Holding[]>();
  for (const h of losing) {
    const sector = classifySector(h.symbol);
    if (!groups.has(sector)) groups.set(sector, []);
    groups.get(sector)!.push(h);
  }

  return Array.from(groups.entries())
    .map(([sector, stocks]) => {
      const totalLoss = stocks.reduce((s, h) => s + h.pnl, 0);
      const totalInvested = stocks.reduce((s, h) => s + h.totalInvested, 0);
      const totalLossPercent = totalInvested > 0 ? (totalLoss / totalInvested) * 100 : 0;
      return { sector, totalLoss, totalLossPercent, stocks };
    })
    .sort((a, b) => a.totalLoss - b.totalLoss);
}
