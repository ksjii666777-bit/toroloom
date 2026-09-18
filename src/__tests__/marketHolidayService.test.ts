/**
 * ============================================================================
 * Toroloom — Market Holiday Service Tests
 * ============================================================================
 *
 * Verifies the frontend holiday-calendar service:
 *   - Fetches all countries once, builds date-indexed maps per country
 *   - Session cache: second call does NOT re-hit the API
 *   - Concurrent calls share a single in-flight request
 *   - API failure degrades gracefully to an empty calendar
 *   - resetHolidayCache() clears the cache
 *   - getHolidayName() looks up a country/date pair
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetHolidays } = vi.hoisted(() => ({ mockGetHolidays: vi.fn() }));

vi.mock('../services/api/globalMarkets', () => ({
  globalMarketsApi: {
    getHolidays: (...args: unknown[]) => mockGetHolidays(...args),
  },
}));

import {
  getHolidayCalendar,
  getHolidayName,
  resetHolidayCache,
} from '../services/marketHolidayService';

const API_RESPONSE = {
  success: true,
  data: {
    india: {
      year: 2026,
      holidays: [
        { date: '2026-01-26', name: 'Republic Day' },
        { date: '2026-08-15', name: 'Independence Day' },
      ],
    },
    us: { year: 2026, holidays: [{ date: '2026-07-04', name: 'Independence Day' }] },
  },
  fetchedAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  resetHolidayCache();
  mockGetHolidays.mockReset();
});

describe('marketHolidayService', () => {
  it('builds a per-country date→name map from the API response', async () => {
    mockGetHolidays.mockResolvedValue(API_RESPONSE);

    const cal = await getHolidayCalendar();
    expect(cal.india.get('2026-01-26')).toBe('Republic Day');
    expect(cal.india.get('2026-08-15')).toBe('Independence Day');
    expect(cal.us.get('2026-07-04')).toBe('Independence Day');
    expect(mockGetHolidays).toHaveBeenCalledTimes(1);
  });

  it('caches for the session — second call hits no API', async () => {
    mockGetHolidays.mockResolvedValue(API_RESPONSE);
    await getHolidayCalendar();
    await getHolidayCalendar();
    await getHolidayCalendar(2027);
    expect(mockGetHolidays).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request across concurrent callers', async () => {
    mockGetHolidays.mockImplementation(
      () => new Promise((r) => setTimeout(() => r(API_RESPONSE), 10)),
    );
    const [a, b] = await Promise.all([getHolidayCalendar(), getHolidayCalendar()]);
    expect(mockGetHolidays).toHaveBeenCalledTimes(1);
    expect(a.india.get('2026-01-26')).toBe('Republic Day');
    expect(b).toBe(a); // same object → shared result
  });

  it('degrades gracefully on API failure (empty calendar)', async () => {
    mockGetHolidays.mockRejectedValue(new Error('offline'));
    const cal = await getHolidayCalendar();
    expect(cal).toEqual({});
    expect(getHolidayName(cal, 'india', '2026-01-26')).toBeNull();
  });

  it('resetHolidayCache forces a fresh fetch', async () => {
    mockGetHolidays.mockResolvedValue(API_RESPONSE);
    await getHolidayCalendar();

    resetHolidayCache();
    await getHolidayCalendar();
    expect(mockGetHolidays).toHaveBeenCalledTimes(2);
  });

  it('getHolidayName returns null for unknown country/date', async () => {
    mockGetHolidays.mockResolvedValue(API_RESPONSE);
    const cal = await getHolidayCalendar();
    expect(getHolidayName(cal, 'japan', '2026-01-26')).toBeNull();
    expect(getHolidayName(cal, 'india', '2027-01-26')).toBeNull();
  });
});
