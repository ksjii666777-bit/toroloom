/**
 * ============================================================================
 * Toroloom — Futures Curve API Client
 * ============================================================================
 *
 * Fetches futures curve data (contango/backwardation, price curve across
 * expiry months) from the backend /api/fno/futures-curve endpoint.
 *
 * Falls back to inline mock data when the API is unreachable.
 *
 * Usage:
 *   import { getFuturesCurve } from '../../services/api/futuresCurve';
 *   const data = await getFuturesCurve('NIFTY');
 *
 * ============================================================================
 */

import { api } from './client';
import type { FuturesCurveData, FuturesCurvePoint } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Data (fallback)
// ═══════════════════════════════════════════════════════════════════════════════

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const MOCK_SPOT_PRICES: Record<string, number> = {
  NIFTY: 23456.80,
  BANKNIFTY: 49234.10,
  FINNIFTY: 21234.50,
  MIDCPNIFTY: 15678.90,
  SENSEX: 77123.45,
};

function generateMockPoints(symbol: string): FuturesCurvePoint[] {
  const spotPrice = MOCK_SPOT_PRICES[symbol] || 10000;
  const monthlySlope = 15;
  const isContango = true;
  const sign = isContango ? 1 : -1;
  const months = 4;
  const points: FuturesCurvePoint[] = [];

  const now = new Date();
  const currentDay = now.getDay();
  const daysToNextThursday = currentDay <= 4 ? 4 - currentDay : 4 + 7 - currentDay;

  const labels = ['Weekly', 'Monthly', '2-Month', '3-Month'];
  const dayOffsets = [daysToNextThursday, 30, 60, 90];

  for (let i = 0; i < months; i++) {
    const days = dayOffsets[i];
    const basis = 35 + sign * monthlySlope * i;
    const price = spotPrice + basis;
    const randomOI = Math.floor(spotPrice * (50 + Math.random() * 100)) * (months - i);
    const oiChange = Math.floor((Math.random() - 0.4) * randomOI * 0.15);
    const volume = Math.floor(spotPrice * (100 + Math.random() * 200));

    points.push({
      expiryLabel: labels[i],
      expiryDate: daysFromNow(days),
      daysToExpiry: days,
      price: Math.round(price * 100) / 100,
      basis: Math.round(basis * 100) / 100,
      basisPercent: Math.round((basis / spotPrice) * 10000) / 100,
      openInterest: randomOI,
      oiChange,
      volume,
    });
  }

  return points;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

export interface FuturesCurveResult {
  data: FuturesCurveData;
  source: 'api' | 'mock';
}

/**
 * Fetch futures curve data for a given symbol.
 * Falls back to inline mock data if the API is unreachable.
 */
export async function getFuturesCurve(symbol: string = 'NIFTY'): Promise<FuturesCurveResult> {
  try {
    const data = await api.get<FuturesCurveData>(`/fno/futures-curve?symbol=${symbol}`);
    return { data, source: 'api' };
  } catch {
    // Fall back to mock data
    const mockPoints = generateMockPoints(symbol);
    const spotPrice = MOCK_SPOT_PRICES[symbol] || 10000;
    const firstPrice = mockPoints[0]?.price || spotPrice;
    const lastPrice = mockPoints[mockPoints.length - 1]?.price || spotPrice;
    const isContango = lastPrice >= firstPrice;
    const monthlySlope = mockPoints.length > 1 ? Math.round((lastPrice - firstPrice) / mockPoints.length) : 0;
    const totalOI = mockPoints.reduce((s, p) => s + p.openInterest, 0);
    const maxOiPoint = mockPoints.reduce((max, p) => (p.openInterest > (max?.openInterest ?? 0) ? p : max), mockPoints[0]);

    return {
      data: {
        symbol: symbol as any,
        spotPrice,
        points: mockPoints,
        isContango,
        slope: monthlySlope,
        totalOpenInterest: totalOI,
        maxOiExpiry: maxOiPoint?.expiryLabel || '',
      },
      source: 'mock',
    };
  }
}
