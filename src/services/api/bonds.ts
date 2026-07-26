/**
 * ============================================================================
 * Toroloom — Bond Dashboard API Client
 * ============================================================================
 *
 * Connects to the backend /api/bonds endpoints with fallback data.
 * Uses api.withFallback() pattern.
 * ============================================================================
 */

import { api } from './client';
import type { Bond } from '../../types';
import { mockBonds } from '../../constants/mockData';

// ─── API Response Types ──────────────────────────────────────────────────

interface BondApiResponse {
  success: boolean;
  count: number;
  bonds: Bond[];
}

interface BondSummaryResponse {
  success: boolean;
  data: {
    total: number;
    government: { count: number; avgYTM: number; avgCoupon: number };
    corporate: { count: number; avgYTM: number; avgCoupon: number };
    state: { count: number; avgYTM: number; avgCoupon: number };
    yieldCurve: { label: string; count: number; avgYield: number; avgCoupon: number }[];
    updatedAt: string;
  };
}

// ─── API Client ──────────────────────────────────────────────────────────

export const bondsApi = {
  /** Get all bonds with fallback to mock data from constants */
  getAll: (): Promise<Bond[]> =>
    api.withFallback(
      () => api.get<BondApiResponse>('/bonds').then(res => res.bonds),
      mockBonds,
    ),

  /** Get bonds by category with fallback */
  getByCategory: (cat: string): Promise<Bond[]> =>
    api.withFallback(
      () => api.get<{ success: boolean; bonds: Bond[] }>(`/bonds/category/${cat}`)
        .then(res => res.bonds),
      mockBonds.filter(b => b.category === cat),
    ),

  /** Get a single bond by ID */
  getById: (id: string): Promise<Bond | null> =>
    api.withFallback(
      () => api.get<{ success: boolean; bond: Bond }>(`/bonds/${id}`)
        .then(res => res.bond),
      mockBonds.find(b => b.id === id) ?? null,
    ),

  /** Get bond market summary statistics */
  getSummary: (): Promise<BondSummaryResponse['data'] | null> =>
    api.withFallback(
      () => api.get<BondSummaryResponse>('/bonds/summary').then(res => res.data),
      null,
    ),
};
