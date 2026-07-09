/**
 * ============================================================================
 * Toroloom — IPO Store
 * ============================================================================
 *
 * Manages IPO applications, allotment tracking, and UPI apply flow.
 *
 * Usage:
 *   import { useIPOStore } from '../store/ipoStore';
 *   const { applications, applyForIPO, fetchIPOs } = useIPOStore();
 *
 * ============================================================================
 */

import { create } from 'zustand';
import { IPOItem, IPOApplication } from '../types';
import { mockIPOs } from '../constants/mockData';
import { log } from '../utils/logger';

// ──── Helpers ──────────────────────────────────────────────────────────────

function generateId(): string {
  return `ipo_app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ──── Seed application for demo purposes ───────────────────────────────────

const seedApplications: IPOApplication[] = [
  {
    id: 'ipo_app_seed_1',
    ipoId: 'ipo_3',
    companyName: 'Vishal Mega Mart',
    logo: 'VM',
    sector: 'Retail',
    bidLots: 3,
    bidQuantity: 120,
    bidPrice: 360,
    totalAmount: 43200,
    upiId: 'rahul.sharma@hdfc',
    status: 'allotted',
    sharesAllotted: 120,
    allotmentDate: daysFromNow(0),
    listingPrice: 432,
    listingGain: 20.0,
    appliedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'ipo_app_seed_2',
    ipoId: 'ipo_5',
    companyName: 'NTPC Green Energy',
    logo: 'NG',
    sector: 'Renewable Energy',
    bidLots: 5,
    bidQuantity: 625,
    bidPrice: 115,
    totalAmount: 71875,
    upiId: 'rahul.sharma@hdfc',
    status: 'not_allotted',
    allotmentDate: daysFromNow(-8),
    appliedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
  {
    id: 'ipo_app_seed_3',
    ipoId: 'ipo_1',
    companyName: 'LG Electronics India',
    logo: 'LG',
    sector: 'Consumer Electronics',
    bidLots: 4,
    bidQuantity: 120,
    bidPrice: 475,
    totalAmount: 57000,
    upiId: 'rahul.sharma@hdfc',
    status: 'submitted',
    appliedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

// ──── Store ────────────────────────────────────────────────────────────────

interface IPOState {
  /** All IPO items (loaded from mock data) */
  ipos: IPOItem[];
  /** User's IPO applications */
  applications: IPOApplication[];
  /** Loading state */
  isLoading: boolean;
  /** Selected IPO for detail modal */
  selectedIPO: IPOItem | null;

  // ── Actions ──

  /** Fetch IPO list */
  fetchIPOs: () => Promise<void>;
  /** Apply for an IPO via UPI */
  applyForIPO: (
    ipo: IPOItem,
    bidLots: number,
    bidPrice: number,
    upiId: string,
  ) => IPOApplication;
  /** Update allotment status for an application */
  updateAllotment: (
    applicationId: string,
    status: 'allotted' | 'not_allotted',
    sharesAllotted?: number,
    listingPrice?: number,
    listingGain?: number,
  ) => void;
  /** Get applications for a specific IPO */
  getApplicationsForIPO: (ipoId: string) => IPOApplication[];
  /** Get application summary stats */
  getApplicationStats: () => {
    total: number;
    submitted: number;
    allotted: number;
    notAllotted: number;
    pending: number;
    totalInvestment: number;
    profitFromAllotted: number;
  };
  /** Clear all seed data (for testing) */
  clearSeedData: () => void;
  /** Set selected IPO for detail view */
  setSelectedIPO: (ipo: IPOItem | null) => void;
  /** Toggle bookmark on an IPO */
  toggleBookmark: (ipoId: string) => void;
}

export const useIPOStore = create<IPOState>((set, get) => ({
  ipos: mockIPOs,
  applications: seedApplications,
  isLoading: false,
  selectedIPO: null,

  fetchIPOs: async () => {
    set({ isLoading: true });
    try {
      // Could fetch from backend via marketApi
      // For now, use mock data with slight variations
      set({ isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  applyForIPO: (ipo, bidLots, bidPrice, upiId) => {
    const bidQuantity = bidLots * ipo.lotSize;
    const totalAmount = bidQuantity * bidPrice;

    const application: IPOApplication = {
      id: generateId(),
      ipoId: ipo.id,
      companyName: ipo.companyName,
      logo: ipo.logo,
      sector: ipo.sector,
      bidLots,
      bidQuantity,
      bidPrice,
      totalAmount,
      upiId,
      status: 'submitted',
      appliedAt: new Date().toISOString(),
    };

    set((state) => ({
      applications: [application, ...state.applications],
    }));

    log.info(`[IPOStore] Applied for ${ipo.companyName}: ${bidLots} lots @ ₹${bidPrice} via ${upiId}`);
    return application;
  },

  updateAllotment: (applicationId, status, sharesAllotted, listingPrice, listingGain) => {
    set((state) => ({
      applications: state.applications.map((app) =>
        app.id === applicationId
          ? {
              ...app,
              status,
              sharesAllotted: sharesAllotted ?? app.sharesAllotted,
              listingPrice: listingPrice ?? app.listingPrice,
              listingGain: listingGain ?? app.listingGain,
              allotmentDate: new Date().toISOString().split('T')[0],
            }
          : app,
      ),
    }));
  },

  getApplicationsForIPO: (ipoId) => {
    return get().applications.filter((app) => app.ipoId === ipoId);
  },

  getApplicationStats: () => {
    const apps = get().applications;
    const stats = {
      total: apps.length,
      submitted: apps.filter((a) => a.status === 'submitted').length,
      allotted: apps.filter((a) => a.status === 'allotted').length,
      notAllotted: apps.filter((a) => a.status === 'not_allotted').length,
      pending: apps.filter((a) => a.status === 'pending' || a.status === 'pending_allotment').length,
      totalInvestment: apps.reduce((sum, a) => sum + a.totalAmount, 0),
      profitFromAllotted: apps
        .filter((a) => a.status === 'allotted' && a.listingPrice && a.bidPrice)
        .reduce((sum, a) => {
          const profitPerShare = (a.listingPrice || 0) - a.bidPrice;
          return sum + profitPerShare * (a.sharesAllotted || 0);
        }, 0),
    };
    return stats;
  },

  clearSeedData: () => {
    set({ applications: [] });
  },

  setSelectedIPO: (ipo) => {
    set({ selectedIPO: ipo });
  },

  toggleBookmark: (ipoId) => {
    set((state) => ({
      ipos: state.ipos.map((ipo) =>
        ipo.id === ipoId ? { ...ipo, isBookmarked: !ipo.isBookmarked } : ipo,
      ),
    }));
  },
}));
