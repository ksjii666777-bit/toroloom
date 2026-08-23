/**
 * ============================================================================
 * Earnings API Service
 * ============================================================================
 *
 * Fetches earnings data from the Toroloom backend API.
 * Falls back to mock data if the backend is unavailable.
 *
 * Endpoints:
 *   GET /api/earnings              — All company earnings summaries
 *   GET /api/earnings/:symbol      — Single company earnings summary
 *   GET /api/earnings/upcoming     — Upcoming earnings calendar
 *
 * ============================================================================
 */

import { api } from './client';
import { mockEarningsData } from '../../constants/mockData';
import type { EarningsSummary } from '../../types';

// ──── Types ─────────────────────────────────────────────────────────────

interface EarningsApiResponse {
  success: boolean;
  source: string;
  count: number;
  data: EarningsSummary[];
}

interface SingleEarningsApiResponse {
  success: boolean;
  source: string;
  data: EarningsSummary;
}

interface UpcomingEarningsResponse {
  success: boolean;
  count: number;
  data: { symbol: string; date: string; quarter: string }[];
}

// ──── API Methods ───────────────────────────────────────────────────────

/**
 * Fetch earnings summaries for all supported companies.
 * Falls back to mock data if backend is unreachable.
 */
export async function getEarningsSummaries(): Promise<{
  data: EarningsSummary[];
  source: string;
}> {
  try {
    const response = await api.get<EarningsApiResponse>('/earnings');
    if (response.success && response.data?.length > 0) {
      return { data: response.data, source: response.source };
    }
  } catch (err) {
    console.warn('[EarningsAPI] Backend unavailable, using mock data:', (err as Error).message);
  }

  // Fallback to mock data
  return { data: mockEarningsData, source: 'mock' };
}

/**
 * Fetch earnings summary for a single company.
 * Falls back to mock data if backend is unreachable.
 */
export async function getEarningsSummary(symbol: string): Promise<{
  data: EarningsSummary | null;
  source: string;
}> {
  try {
    const response = await api.get<SingleEarningsApiResponse>(`/earnings/${symbol.toUpperCase()}`);
    if (response.success && response.data) {
      return { data: response.data, source: response.source };
    }
  } catch (err) {
    console.warn(`[EarningsAPI] Backend unavailable for ${symbol}, using mock data:`, (err as Error).message);
  }

  // Fallback to mock data
  const mock = mockEarningsData.find(e => e.symbol === symbol.toUpperCase());
  return { data: mock || null, source: 'mock' };
}

/**
 * Fetch upcoming earnings calendar.
 */
export async function getUpcomingEarnings(): Promise<{
  data: { symbol: string; date: string; quarter: string }[];
  source: string;
}> {
  try {
    const response = await api.get<UpcomingEarningsResponse>('/earnings/upcoming');
    if (response.success && response.data) {
      return { data: response.data, source: 'backend' };
    }
  } catch (err) {
    console.warn('[EarningsAPI] Backend unavailable for upcoming earnings:', (err as Error).message);
  }

  // Fallback
  return {
    data: [
      { symbol: 'RELIANCE', date: '2026-04-15', quarter: 'Q4 FY26' },
      { symbol: 'TCS', date: '2026-04-11', quarter: 'Q4 FY26' },
      { symbol: 'HDFCBANK', date: '2026-04-18', quarter: 'Q4 FY26' },
      { symbol: 'INFY', date: '2026-04-17', quarter: 'Q4 FY26' },
      { symbol: 'ICICIBANK', date: '2026-04-25', quarter: 'Q4 FY26' },
      { symbol: 'SBIN', date: '2026-05-09', quarter: 'Q4 FY26' },
    ],
    source: 'mock',
  };
}

// ──── Named export (convenience) ────────────────────────────────────────

export const earningsApi = {
  getEarningsSummaries,
  getEarningsSummary,
  getUpcomingEarnings,
};
