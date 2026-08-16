/**
 * ============================================================================
 * Toroloom — Economic Calendar Service Unit Tests
 * ============================================================================
 *
 * Tests the FMP event mapping (mapFmpEvent) and the mock fallback behavior
 * of economicCalendarService when no FMP_API_KEY is configured.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/economicCalendarService.test.ts
 * ============================================================================
 */

import { describe, it, expect, vi, afterAll } from 'vitest';

vi.stubEnv('FMP_API_KEY', '');

import { mapFmpEvent, economicCalendarService } from '../services/economicCalendarService';

// ──── Fixtures ────────────────────────────────────────────────────────────

const fmpEventUpcoming = {
  date: '2026-09-15 14:30:00',
  country: 'US',
  event: 'Consumer Price Index (CPI) YoY',
  currency: 'USD',
  previous: 2.6,
  estimate: 2.7,
  actual: null,
  change: null,
  impact: 'High',
  changePercentage: null,
};

const fmpEventReleased = {
  date: '2026-08-15 10:00:00',
  country: 'IN',
  event: 'RBI Interest Rate Decision',
  currency: 'INR',
  previous: 6.5,
  estimate: 6.5,
  actual: 6.25,
  change: -0.25,
  impact: 'High',
  changePercentage: -3.85,
};

// ──── Tests ───────────────────────────────────────────────────────────────

describe('mapFmpEvent', () => {
  it('maps an upcoming FMP event to the Toroloom shape', () => {
    const mapped = mapFmpEvent(fmpEventUpcoming as any, 0);

    expect(mapped.id).toBe('fmp_US_20260915143000_0');
    expect(mapped.title).toBe('Consumer Price Index (CPI) YoY');
    expect(mapped.date).toBe('2026-09-15');
    expect(mapped.time).toBe('14:30');
    expect(mapped.timezone).toBe('UTC');
    expect(mapped.countryCode).toBe('US');
    expect(mapped.country).toBe('United States');
    expect(mapped.category).toBe('inflation');
    expect(mapped.importance).toBe('high');
    expect(mapped.previous).toBe('2.6');
    expect(mapped.forecast).toBe('2.7');
    expect(mapped.actual).toBeUndefined();
    expect(mapped.isCompleted).toBe(false);
    expect(mapped.source).toBe('FMP');
  });

  it('maps a released event with actual value as completed', () => {
    const mapped = mapFmpEvent(fmpEventReleased as any, 1);

    expect(mapped.isCompleted).toBe(true);
    expect(mapped.actual).toBe('6.25');
    expect(mapped.category).toBe('central_bank');
    expect(mapped.countryCode).toBe('IN');
    expect(mapped.country).toBe('India');
  });

  it('falls back to "other" category for unknown event titles', () => {
    const mapped = mapFmpEvent({ ...fmpEventUpcoming, event: 'Zelensky Speech' } as any, 2);
    expect(mapped.category).toBe('other');
  });

  it('normalizes impact to lowercase importance', () => {
    const low = mapFmpEvent({ ...fmpEventUpcoming, impact: 'Low' } as any, 3);
    const medium = mapFmpEvent({ ...fmpEventUpcoming, impact: 'Medium' } as any, 4);
    expect(low.importance).toBe('low');
    expect(medium.importance).toBe('medium');
  });
});

describe('economicCalendarService', () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('returns mock data with source=mock when FMP_API_KEY is not configured', async () => {
    const result = await economicCalendarService.getUpcoming(30);
    expect(result.source).toBe('mock');
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.fetchedAt).toBeDefined();
  });

  it('events from the mock fallback are sorted by date', async () => {
    const result = await economicCalendarService.getUpcoming(30);
    const dates = result.events.map(e => e.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('getAll reuses the same mock dataset', async () => {
    const all = await economicCalendarService.getAll();
    const upcoming = await economicCalendarService.getUpcoming(90);
    expect(all.source).toBe('mock');
    expect(all.events.length).toBe(upcoming.events.length);
  });

  it('clamps the days window to the FMP 90-day max', async () => {
    const result = await economicCalendarService.getUpcoming(500);
    expect(result.events.length).toBeGreaterThan(0);
  });
});
