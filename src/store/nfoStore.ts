/**
 * ============================================================================
 * Toroloom — NFO (New Fund Offer) Store
 * ============================================================================
 *
 * Manages NFO investments, scheme tracking, and application flow.
 *
 * Usage:
 *   import { useNFOStore } from '../store/nfoStore';
 *   const { nfos, applications, applyForNFO } = useNFOStore();
 *
 * ============================================================================
 */

import { create } from 'zustand';
import { NFOItem, NFOApplication } from '../types';
import { mockNFOs, mockNFOApplications } from '../constants/mockData';
import { log } from '../utils/logger';

// ──── Helpers ──────────────────────────────────────────────────────────────

function generateId(): string {
  return `nfo_app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// ──── Seed applications for demo purposes ──────────────────────────────────

const seedApplications: NFOApplication[] = mockNFOApplications;

// ──── Store ────────────────────────────────────────────────────────────────

interface NFOState {
  /** All NFO items (loaded from mock data) */
  nfos: NFOItem[];
  /** User's NFO applications/investments */
  applications: NFOApplication[];
  /** Loading state */
  isLoading: boolean;
  /** Selected NFO for detail modal */
  selectedNFO: NFOItem | null;

  // ── Actions ──

  /** Fetch NFO list */
  fetchNFOs: () => Promise<void>;
  /** Apply for an NFO */
  applyForNFO: (
    nfo: NFOItem,
    amount: number,
  ) => NFOApplication;
  /** Update application status */
  updateApplication: (
    applicationId: string,
    updates: Partial<NFOApplication>,
  ) => void;
  /** Get applications for a specific NFO */
  getApplicationsForNFO: (nfoId: string) => NFOApplication[];
  /** Get application summary stats */
  getApplicationStats: () => {
    total: number;
    submitted: number;
    allotted: number;
    inProgress: number;
    matured: number;
    totalInvestment: number;
    totalCurrent: number;
    totalReturn: number;
  };
  /** Clear all seed data (for testing) */
  clearSeedData: () => void;
  /** Set selected NFO for detail view */
  setSelectedNFO: (nfo: NFOItem | null) => void;
  /** Toggle bookmark on an NFO */
  toggleBookmark: (nfoId: string) => void;
}

export const useNFOStore = create<NFOState>((set, get) => ({
  nfos: mockNFOs,
  applications: seedApplications,
  isLoading: false,
  selectedNFO: null,

  fetchNFOs: async () => {
    set({ isLoading: true });
    try {
      // Could fetch from backend via marketApi
      // For now, use mock data with slight variations
      set({ isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  applyForNFO: (nfo, amount) => {
    const application: NFOApplication = {
      id: generateId(),
      nfoId: nfo.id,
      amcName: nfo.amcName,
      logo: nfo.logo,
      schemeName: nfo.schemeName,
      category: nfo.category,
      amount,
      navAtAllotment: 10, // NFO price is typically ₹10/unit
      unitsAllotted: amount / 10,
      currentNav: 10,
      currentValue: amount,
      status: 'submitted',
      appliedAt: new Date().toISOString(),
    };

    set((state) => ({
      applications: [application, ...state.applications],
    }));

    log.info(`[NFOStore] Applied for ${nfo.schemeName}: ₹${amount} via NFO`);
    return application;
  },

  updateApplication: (applicationId, updates) => {
    set((state) => ({
      applications: state.applications.map((app) =>
        app.id === applicationId ? { ...app, ...updates } : app,
      ),
    }));
  },

  getApplicationsForNFO: (nfoId) => {
    return get().applications.filter((app) => app.nfoId === nfoId);
  },

  getApplicationStats: () => {
    const apps = get().applications;
    const stats = {
      total: apps.length,
      submitted: apps.filter((a) => a.status === 'submitted').length,
      allotted: apps.filter((a) => a.status === 'allotted').length,
      inProgress: apps.filter((a) => a.status === 'in_progress').length,
      matured: apps.filter((a) => a.status === 'matured').length,
      totalInvestment: apps.reduce((sum, a) => sum + a.amount, 0),
      totalCurrent: apps.reduce((sum, a) => sum + a.currentValue, 0),
      totalReturn: apps.reduce((sum, a) => sum + (a.currentValue - a.amount), 0),
    };
    return stats;
  },

  clearSeedData: () => {
    set({ applications: [] });
  },

  setSelectedNFO: (nfo) => {
    set({ selectedNFO: nfo });
  },

  toggleBookmark: (nfoId) => {
    set((state) => ({
      nfos: state.nfos.map((nfo) =>
        nfo.id === nfoId ? { ...nfo, isBookmarked: !nfo.isBookmarked } : nfo,
      ),
    }));
  },
}));
