/**
 * Dividend API Client
 *
 * Fetches dividend data from the backend API (/api/dividends).
 * The backend tries MarketStack for real data, then falls back to
 * estimation using stock yields from the broker.
 *
 * If the backend is unreachable, the caller should use the local
 * dividendService estimation as a fallback.
 */

import { api, ApiError } from './client';
import type { DividendTrackerState, Holding } from '../../types';
import { computeDividendState } from '../../services/dividendService';

interface DividendApiResponse {
  upcoming: {
    symbol: string;
    name: string;
    exDate: string;
    payDate: string;
    amountPerShare: number;
    quantity: number;
    totalAmount: number;
    yieldPercent: number;
    frequency: string;
    confidence: 'confirmed' | 'estimated' | 'paid';
    sector: string;
  }[];
  history: {
    symbol: string;
    name: string;
    exDate: string;
    payDate: string;
    amountPerShare: number;
    quantity: number;
    totalAmount: number;
    yieldPercent: number;
    frequency: string;
    confidence: 'confirmed' | 'estimated' | 'paid';
    sector: string;
  }[];
  source: 'marketstack' | 'broker' | 'estimated';
  cachedAt: string;
}

export type DividendDataSource = 'api' | 'local';

/**
 * Fetch dividend data — tries the backend API first, falls back to
 * local estimation if the backend is unavailable or returns an error.
 *
 * Returns the dividend state AND the data source indicator so the UI
 * can show whether data is live or estimated.
 */
export async function fetchDividendData(
  holdings: Holding[],
  stocks: { id: string; symbol: string; name: string; price: number; dividend: number; sector: string }[],
): Promise<{ state: DividendTrackerState; source: DividendDataSource }> {
  try {
    const response = await api.post<DividendApiResponse>('/dividends', { holdings: mapHoldingsForApi(holdings, stocks) });

    // Convert API response to local DividendTrackerState format
    const state = convertApiResponse(response, holdings, stocks);
    return { state, source: 'api' };
  } catch {
    // Backend unavailable — use local estimation
    const state = computeDividendState(holdings, stocks);
    return { state, source: 'local' };
  }
}

/**
 * Fetch dividend data with a "best effort" approach.
 * Returns the state and source — never throws.
 */
export async function fetchDividendDataSafe(
  holdings: Holding[],
  stocks: { id: string; symbol: string; name: string; price: number; dividend: number; sector: string }[],
): Promise<{ state: DividendTrackerState; source: DividendDataSource }> {
  return api.withFallback(
    () => fetchDividendData(holdings, stocks),
    { state: computeDividendState(holdings, stocks), source: 'local' as DividendDataSource },
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapHoldingsForApi(
  holdings: Holding[],
  stocks: { id: string; symbol: string; name: string; price: number; dividend: number; sector: string }[],
): any[] {
  return holdings.map(h => {
    const stock = stocks.find(s => s.id === h.stockId);
    return {
      symbol: h.symbol,
      name: h.name,
      price: h.currentPrice || stock?.price || 0,
      dividend: stock?.dividend || 0,
      sector: stock?.sector || 'Unknown',
      quantity: h.quantity,
    };
  });
}

function convertApiResponse(
  response: DividendApiResponse,
  holdings: Holding[],
  stocks: { id: string; symbol: string; name: string; price: number; dividend: number; sector: string }[],
): DividendTrackerState {
  const totalPortfolioCost = holdings.reduce((s, h) => s + h.totalInvested, 0);
  const totalPortfolioValue = holdings.reduce((s, h) => s + h.currentValue, 0);

  // Monthly grouping
  const monthMap = new Map<string, any[]>();
  for (const event of [...response.upcoming, ...response.history]) {
    const date = new Date(event.payDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key) || [];
    existing.push(event);
    monthMap.set(key, existing);
  }

  const monthlyHistory = Array.from(monthMap.entries())
    .map(([key, evts]) => {
      const [yearStr, monthStr] = key.split('-');
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1;
      return {
        month: key,
        label: new Date(year, monthIdx, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        totalAmount: evts.reduce((s, e: any) => s + e.totalAmount, 0),
        events: evts as any,
        count: evts.length,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  // Annual summaries
  const yearMap = new Map<number, any[]>();
  for (const month of monthlyHistory) {
    const year = parseInt(month.month.split('-')[0], 10);
    const existing = yearMap.get(year) || [];
    existing.push(month);
    yearMap.set(year, existing);
  }

  const annualSummaries = Array.from(yearMap.entries())
    .map(([year, months]) => {
      const totalIncome = months.reduce((s, m: any) => s + m.totalAmount, 0);
      const payerMap = new Map<string, { name: string; totalAmount: number }>();
      for (const month of months) {
        for (const event of (month as any).events) {
          const existing = payerMap.get(event.symbol) || { name: event.name, totalAmount: 0 };
          existing.totalAmount += event.totalAmount;
          payerMap.set(event.symbol, existing);
        }
      }
      return {
        year,
        totalIncome,
        monthlyAverage: totalIncome / 12,
        months: months as any,
        topPayers: Array.from(payerMap.entries())
          .map(([symbol, data]) => ({ symbol, ...data }))
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .slice(0, 5),
      };
    })
    .sort((a, b) => b.year - a.year);

  // Current year projection
  const currentYear = new Date().getFullYear();
  const currentYearEvents = [...response.upcoming, ...response.history.filter(e => new Date(e.payDate).getFullYear() === currentYear)];
  const uniqueEvents = currentYearEvents.filter((e, i, arr) => arr.findIndex(x => x.symbol === e.symbol && x.exDate === e.exDate) === i);
  const totalEstimated = uniqueEvents.reduce((s, e) => s + e.totalAmount, 0);

  const payerMap = new Map<string, { name: string; totalAmount: number; yieldPercent: number }>();
  for (const event of uniqueEvents) {
    const existing = payerMap.get(event.symbol) || { name: event.name, totalAmount: 0, yieldPercent: event.yieldPercent };
    existing.totalAmount += event.totalAmount;
    payerMap.set(event.symbol, existing);
  }

  const currentYearProjection = {
    totalEstimated,
    monthlyAverage: totalEstimated / 12,
    yieldOnCost: totalPortfolioCost > 0 ? (totalEstimated / totalPortfolioCost) * 100 : 0,
    portfolioYield: totalPortfolioValue > 0 ? (totalEstimated / totalPortfolioValue) * 100 : 0,
    topPayers: Array.from(payerMap.entries())
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5),
  };

  const lifetimeIncome = response.history.reduce((s, e) => s + e.totalAmount, 0);

  return {
    upcoming: response.upcoming as any,
    history: response.history as any,
    monthlyHistory,
    annualSummaries,
    currentYearProjection: {
      totalEstimated: Math.round(currentYearProjection.totalEstimated * 100) / 100,
      monthlyAverage: Math.round(currentYearProjection.monthlyAverage * 100) / 100,
      yieldOnCost: Math.round(currentYearProjection.yieldOnCost * 100) / 100,
      portfolioYield: Math.round(currentYearProjection.portfolioYield * 100) / 100,
      topPayers: currentYearProjection.topPayers.map(p => ({
        ...p,
        totalAmount: Math.round(p.totalAmount * 100) / 100,
        yieldPercent: Math.round(p.yieldPercent * 100) / 100,
      })),
    },
    lifetimeIncome: Math.round(lifetimeIncome * 100) / 100,
    totalPayments: response.history.length,
  };
}
