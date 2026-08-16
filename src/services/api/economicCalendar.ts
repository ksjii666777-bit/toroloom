/**
 * ============================================================================
 * Toroloom — Economic Calendar API Client
 * ============================================================================
 *
 * Connects to the backend /api/economic-calendar endpoints with fallback
 * data (mockEconomicEvents) when the backend is unreachable.
 *
 * Uses api.withFallback() pattern: tries backend first, falls back to
 * static mock data on network failure.
 * ============================================================================
 */

import { api } from './client';
import type { EconomicEvent } from '../../types';
import { mockEconomicEvents } from '../../constants/mockData';

// ─── API Response Types ──────────────────────────────────────────────────

interface EconomicCalendarResponse {
  success: boolean;
  count: number;
  events: EconomicEvent[];
  source?: 'fmp' | 'mock';
  fetchedAt?: string;
}

interface EconomicCalendarSummary {
  success: boolean;
  total: number;
  upcoming: number;
  released: number;
  byCategory: Record<string, number>;
  byImportance: Record<string, number>;
  byCountry: Record<string, number>;
  source?: 'fmp' | 'mock';
  fetchedAt?: string;
}

export type EconomicCalendarDataSource = 'fmp' | 'mock';

// ─── Helpers ─────────────────────────────────────────────────────────────

function sortByDate(events: EconomicEvent[]): EconomicEvent[] {
  return [...events].sort((a, b) => {
    const diff = a.date.localeCompare(b.date);
    return diff !== 0 ? diff : a.time.localeCompare(b.time);
  });
}

// ─── API Client ──────────────────────────────────────────────────────────

export const economicCalendarApi = {
  /**
   * Get all economic events with fallback to local mock data.
   * Returns events + the data source ('fmp' = live, 'mock' = fallback).
   */
  getEvents: async (): Promise<{ events: EconomicEvent[]; source: EconomicCalendarDataSource }> => {
    try {
      const res = await api.get<EconomicCalendarResponse>('/economic-calendar');
      return { events: sortByDate(res.events), source: res.source || 'mock' };
    } catch {
      return { events: sortByDate(mockEconomicEvents), source: 'mock' };
    }
  },

  /**
   * Get only upcoming events (next N days).
   */
  getUpcoming: async (days = 30): Promise<{ events: EconomicEvent[]; source: EconomicCalendarDataSource }> => {
    try {
      const res = await api.get<EconomicCalendarResponse>(`/economic-calendar/upcoming?days=${days}`);
      return { events: sortByDate(res.events), source: res.source || 'mock' };
    } catch {
      return { events: sortByDate(mockEconomicEvents.filter(e => !e.isCompleted)), source: 'mock' };
    }
  },

  /**
   * Get summary stats with fallback computed from local mock data.
   */
  getSummary: async (): Promise<EconomicCalendarSummary> => {
    try {
      return await api.get<EconomicCalendarSummary>('/economic-calendar/summary');
    } catch {
      const byCategory: Record<string, number> = {};
      const byImportance: Record<string, number> = {};
      const byCountry: Record<string, number> = {};
      let upcoming = 0;
      for (const e of mockEconomicEvents) {
        byCategory[e.category] = (byCategory[e.category] || 0) + 1;
        byImportance[e.importance] = (byImportance[e.importance] || 0) + 1;
        byCountry[e.countryCode] = (byCountry[e.countryCode] || 0) + 1;
        if (!e.isCompleted) upcoming += 1;
      }
      return {
        success: true,
        total: mockEconomicEvents.length,
        upcoming,
        released: mockEconomicEvents.length - upcoming,
        byCategory,
        byImportance,
        byCountry,
        source: 'mock',
      };
    }
  },

  /**
   * Get the local fallback data (useful for unit tests).
   */
  getFallbackEvents: (): EconomicEvent[] => sortByDate(mockEconomicEvents),
};
