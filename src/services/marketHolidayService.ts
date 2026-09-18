/**
 * ============================================================================
 * Toroloom — Market Holiday Service (frontend)
 * ============================================================================
 *
 * Fetches the per-country market-holiday calendar from the backend
 * (GET /api/global-markets/holidays), caches it in memory for the session,
 * and feeds it into the market-status engine so holiday closures show up on
 * the Global Markets open/closed badges.
 *
 * Behaviour:
 *   - One backend call fetches ALL countries for a year (cheap — static data)
 *   - Session cache: never re-fetches within the same app session
 *   - On failure: resolves to an empty calendar (badges fall back to
 *     weekend/session logic only — the feature degrades gracefully)
 *   - Offline-aware: uses the shared api client (timeouts + offline queue)
 * ============================================================================
 */

import { globalMarketsApi, type MarketHolidayEntry } from './api/globalMarkets';
import type { CountryMarketKey } from '../utils/marketStatus';

export type HolidayCalendar = Record<string, Map<string, string>>;
/** Map<countryKey, Map<'YYYY-MM-DD', holidayName>> */

let sessionCache: HolidayCalendar | null = null;
let inFlight: Promise<HolidayCalendar> | null = null;

/** Build a date-indexed map per country from the API response. */
function toCalendar(
  data: Record<string, { year: number; holidays: MarketHolidayEntry[] }>,
): HolidayCalendar {
  const calendar: HolidayCalendar = {};
  for (const [country, entry] of Object.entries(data)) {
    calendar[country] = new Map(
      entry.holidays.map((h) => [h.date, h.name]),
    );
  }
  return calendar;
}

/**
 * Get the holiday calendar for the given year (defaults to current year).
 * Cached for the whole session; concurrent calls share one request.
 */
export async function getHolidayCalendar(year?: number): Promise<HolidayCalendar> {
  if (sessionCache) return sessionCache;
  if (inFlight) return inFlight;

  inFlight = globalMarketsApi
    .getHolidays(year ? { year } : {})
    .then((res) => {
      const calendar = toCalendar(res?.data ?? {});
      sessionCache = calendar;
      inFlight = null;
      return calendar;
    })
    .catch(() => {
      // Graceful degradation: empty calendar → weekend/session logic only
      inFlight = null;
      return {} as HolidayCalendar;
    });

  return inFlight;
}

/** Test helper: wipe the session cache. */
export function resetHolidayCache(): void {
  sessionCache = null;
  inFlight = null;
}

/**
 * Look up whether a country has a holiday on an ISO date ('YYYY-MM-DD').
 * Returns the holiday name, or null.
 */
export function getHolidayName(
  calendar: HolidayCalendar,
  country: CountryMarketKey,
  isoDate: string,
): string | null {
  return calendar[country]?.get(isoDate) ?? null;
}
