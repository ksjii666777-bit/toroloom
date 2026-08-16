/**
 * ============================================================================
 * Toroloom — Economic Calendar Store Unit Tests
 * ============================================================================
 *
 * Tests fetch lifecycle, importance/category filters, getFilteredEvents,
 * and reset behavior.
 *
 * The API client falls back to local mock data, so no API mocking is needed.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useEconomicCalendarStore } from '../store/economicCalendarStore';

// ──── Helpers ──────────────────────────────────────────────────────────────

function getState() {
  return useEconomicCalendarStore.getState();
}

/** Reset the store to its initial state between tests. */
function resetStore() {
  useEconomicCalendarStore.setState(useEconomicCalendarStore.getInitialState());
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('EconomicCalendarStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts with default state', () => {
    const state = getState();
    expect(state.events).toEqual([]);
    expect(state.summary).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.importanceFilter).toBe('all');
    expect(state.categoryFilter).toBeNull();
    expect(state.error).toBeNull();
  });

  it('fetchEvents loads events and summary (via fallback mock data)', async () => {
    await getState().fetchEvents();
    const state = getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.events.length).toBeGreaterThan(0);
    expect(state.summary).not.toBeNull();
    expect(state.summary!.total).toBe(state.events.length);
    expect(state.lastFetchedAt).not.toBeNull();
  });

  it('events are sorted by date after fetch', async () => {
    await getState().fetchEvents();
    const events = getState().events;
    const dates = events.map(e => e.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('setImportanceFilter + getFilteredEvents filters by importance', async () => {
    await getState().fetchEvents();
    getState().setImportanceFilter('high');
    const filtered = getState().getFilteredEvents();
    expect(filtered.length).toBeGreaterThan(0);
    for (const e of filtered) {
      expect(e.importance).toBe('high');
    }
  });

  it('setCategoryFilter + getFilteredEvents filters by category', async () => {
    await getState().fetchEvents();
    getState().setCategoryFilter('inflation');
    const filtered = getState().getFilteredEvents();
    expect(filtered.length).toBeGreaterThan(0);
    for (const e of filtered) {
      expect(e.category).toBe('inflation');
    }
  });

  it('combines importance + category filters', async () => {
    await getState().fetchEvents();
    getState().setImportanceFilter('high');
    getState().setCategoryFilter('inflation');
    const filtered = getState().getFilteredEvents();
    for (const e of filtered) {
      expect(e.importance).toBe('high');
      expect(e.category).toBe('inflation');
    }
  });

  it('clearFilters resets both filters', async () => {
    await getState().fetchEvents();
    const total = getState().events.length;
    getState().setImportanceFilter('high');
    getState().setCategoryFilter('inflation');
    getState().clearFilters();
    expect(getState().importanceFilter).toBe('all');
    expect(getState().categoryFilter).toBeNull();
    expect(getState().getFilteredEvents().length).toBe(total);
  });

  it('reset restores the initial state', async () => {
    await getState().fetchEvents();
    getState().setImportanceFilter('high');
    getState().reset();
    const state = getState();
    expect(state.events).toEqual([]);
    expect(state.summary).toBeNull();
    expect(state.importanceFilter).toBe('all');
    expect(state.categoryFilter).toBeNull();
  });
});
