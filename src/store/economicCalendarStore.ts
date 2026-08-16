/**
 * ============================================================================
 * Toroloom — Economic Calendar Store
 * ============================================================================
 *
 * Manages economic events (RBI, inflation, GDP, PMI, etc.), loading state,
 * and client-side filters (importance / category / country).
 *
 * Usage:
 *   import { useEconomicCalendarStore } from '../store/economicCalendarStore';
 *   const { events, fetchEvents } = useEconomicCalendarStore();
 *
 * ============================================================================
 */

import { create } from 'zustand';
import type { EconomicEvent } from '../types';
import { economicCalendarApi, EconomicCalendarDataSource } from '../services/api/economicCalendar';

export type EconomicImportanceFilter = 'all' | 'high' | 'medium' | 'low';

interface EconomicCalendarState {
  /** All events (sorted by date) */
  events: EconomicEvent[];
  /** Summary stats */
  summary: {
    total: number;
    upcoming: number;
    released: number;
    byCategory: Record<string, number>;
    byImportance: Record<string, number>;
    byCountry: Record<string, number>;
  } | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message (if fetch failed) */
  error: string | null;
  /** Active importance filter */
  importanceFilter: EconomicImportanceFilter;
  /** Active category filter (null = all) */
  categoryFilter: string | null;
  /** Last fetch timestamp (ISO string) */
  lastFetchedAt: string | null;
  /** Data source: 'fmp' = live API, 'mock' = fallback */
  dataSource: EconomicCalendarDataSource | null;

  // ── Actions ──

  /** Fetch events + summary from the backend (falls back to mock data) */
  fetchEvents: () => Promise<void>;
  /** Set the importance filter */
  setImportanceFilter: (filter: EconomicImportanceFilter) => void;
  /** Set the category filter (null = all) */
  setCategoryFilter: (category: string | null) => void;
  /** Clear filters */
  clearFilters: () => void;
  /** Get filtered events based on active filters */
  getFilteredEvents: () => EconomicEvent[];
  /** Reset store to initial state (for tests) */
  reset: () => void;
}

const initialState = {
  events: [],
  summary: null,
  isLoading: false,
  error: null,
  importanceFilter: 'all' as EconomicImportanceFilter,
  categoryFilter: null,
  lastFetchedAt: null,
  dataSource: null as EconomicCalendarDataSource | null,
};

export const useEconomicCalendarStore = create<EconomicCalendarState>((set, get) => ({
  ...initialState,

  fetchEvents: async () => {
    set({ isLoading: true, error: null });
    try {
      const [eventsResult, summary] = await Promise.all([
        economicCalendarApi.getEvents(),
        economicCalendarApi.getSummary(),
      ]);
      set({
        events: eventsResult.events,
        summary,
        isLoading: false,
        lastFetchedAt: new Date().toISOString(),
        dataSource: eventsResult.source,
      });
    } catch {
      // API client already falls back to mock data, but guard anyway
      set({
        isLoading: false,
        error: 'Failed to load economic calendar',
      });
    }
  },

  setImportanceFilter: (filter) => set({ importanceFilter: filter }),

  setCategoryFilter: (category) => set({ categoryFilter: category }),

  clearFilters: () => set({ importanceFilter: 'all', categoryFilter: null }),

  getFilteredEvents: () => {
    const { events, importanceFilter, categoryFilter } = get();
    return events.filter((e) => {
      if (importanceFilter !== 'all' && e.importance !== importanceFilter) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      return true;
    });
  },

  reset: () => set({ ...initialState }),
}));
