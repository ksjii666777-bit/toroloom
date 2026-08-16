/**
 * ============================================================================
 * Economic Calendar Service — FMP Live API + Mock Fallback
 * ============================================================================
 *
 * Fetches upcoming economic events (RBI, CPI, GDP, PMI, rate decisions, etc.)
 * from the Financial Modeling Prep (FMP) Economic Calendar API.
 *
 * API: https://financialmodelingprep.com/stable/economic-calendar
 * Docs: https://site.financialmodelingprep.com/developer/docs/stable/economics-calendar
 * Free tier: 250 requests/day (https://financialmodelingprep.com)
 *
 * Fallback chain:
 *   1. FMP_API_KEY configured + API reachable → live events (source: 'fmp')
 *   2. Any failure (no key, 402/403, network, empty) → curated mock events (source: 'mock')
 *
 * Note: FMP retired the legacy `api/v3/economic_calendar` endpoint on
 * 2025-08-31 (now returns 403) — we only use the `/stable/economic-calendar`
 * endpoint.
 *
 * Usage:
 *   import { economicCalendarService, isEconomicCalendarApiConfigured } from '../services/economicCalendarService';
 *   const { events, source } = await economicCalendarService.getUpcoming(30);
 *
 * ============================================================================
 */

import https from 'https';
import { marketCache, CACHE_TTL } from './cache';
import { economicCalendarEvents, EconomicEvent } from '../data/economicCalendarData';

const BASE_URL = 'https://financialmodelingprep.com';
const TIMEOUT_MS = 10_000;

interface EconomicCalendarConfig {
  apiKey: string;
}

const config: EconomicCalendarConfig = {
  apiKey: process.env.FMP_API_KEY || '',
};

/**
 * Update the FMP API configuration (called on startup from env).
 */
export function configureEconomicCalendarApi(envConfig: { fmpApiKey?: string }): void {
  if (envConfig.fmpApiKey) {
    config.apiKey = envConfig.fmpApiKey;
  }
}

/**
 * Check if the FMP economic calendar API is configured with an API key.
 */
export function isEconomicCalendarApiConfigured(): boolean {
  return config.apiKey.length > 0;
}

// ──── FMP API types ──────────────────────────────────────────────────────

interface FmpEconomicEvent {
  date: string;          // '2026-08-15 14:30:00' (UTC)
  country: string;       // 'US'
  event: string;         // 'Consumer Price Index (CPI) YoY'
  currency: string;      // 'USD'
  previous: number | null;
  estimate: number | null;
  actual: number | null;
  change: number | null;
  impact: 'High' | 'Medium' | 'Low';
  changePercentage: number | null;
}

interface FmpEconomicCalendarResponse {
  economicCalendar: FmpEconomicEvent[];
}

// ──── Country helpers ────────────────────────────────────────────────────

/** Map FMP country codes to full names for display. */
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  IN: 'India',
  EU: 'Eurozone',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  JP: 'Japan',
  CN: 'China',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  BR: 'Brazil',
  MX: 'Mexico',
  RU: 'Russia',
  ZA: 'South Africa',
  TR: 'Türkiye',
  CH: 'Switzerland',
  NZ: 'New Zealand',
  KR: 'South Korea',
  SG: 'Singapore',
  HK: 'Hong Kong',
  ID: 'Indonesia',
  MY: 'Malaysia',
  TH: 'Thailand',
  PH: 'Philippines',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  PL: 'Poland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  NL: 'Netherlands',
  BE: 'Belgium',
  AT: 'Austria',
  IE: 'Ireland',
  PT: 'Portugal',
  GR: 'Greece',
};

function countryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

// ──── Category mapping (from event title keywords) ───────────────────────

interface CategoryRule {
  category: EconomicEvent['category'];
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'central_bank',
    keywords: ['rate decision', 'interest rate', 'monetary policy', 'fed', 'fomc', 'ecb', 'boj', 'boe', 'rbi', 'reserve bank', 'cbr', 'cpi yoy', 'policy meeting', 'loan prime', 'benchmark rate'],
  },
  {
    category: 'inflation',
    keywords: ['cpi', 'ppi', 'inflation', 'core cpi', 'price index', 'm2 money'],
  },
  {
    category: 'gdp',
    keywords: ['gdp', 'gross domestic', 'economic growth', 'national accounts'],
  },
  {
    category: 'employment',
    keywords: ['payroll', 'unemployment', 'jobless', 'employment', 'labor', 'labour', 'wage', 'nonfarm', 'non-farm', 'jobs'],
  },
  {
    category: 'trade',
    keywords: ['trade balance', 'trade deficit', 'exports', 'imports', 'current account', 'balance of trade'],
  },
  {
    category: 'fiscal',
    keywords: ['budget', 'fiscal', 'debt', 'treasury', 'government bond', 'auction'],
  },
  {
    category: 'industry',
    keywords: ['pmi', 'industrial production', 'manufacturing', 'factory', 'capacity utilization', 'business sentiment', 'ifo'],
  },
  {
    category: 'consumer',
    keywords: ['retail sales', 'consumer confidence', 'consumer sentiment', 'household', 'spending', 'personal income'],
  },
  {
    category: 'housing',
    keywords: ['housing', 'home sales', 'building permits', 'mortgage', 'house price', 'new home', 'existing home'],
  },
];

function mapCategory(title: string): EconomicEvent['category'] {
  const lower = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return rule.category;
    }
  }
  return 'other';
}

// ──── Mapping: FMP event → Toroloom EconomicEvent ────────────────────────

/**
 * Map an FMP economic calendar event to the Toroloom EconomicEvent shape.
 * Exported for unit tests.
 */
export function mapFmpEvent(raw: FmpEconomicEvent, index: number): EconomicEvent {
  // FMP returns 'YYYY-MM-DD HH:MM:SS' in UTC
  const [datePart, timePart] = raw.date.split(' ');
  const time = timePart ? timePart.slice(0, 5) : '00:00';

  const isCompleted = raw.actual !== null && raw.actual !== undefined;

  return {
    id: `fmp_${raw.country}_${raw.date.replace(/[^0-9]/g, '')}_${index}`,
    title: raw.event,
    description: `${raw.event} scheduled release${isCompleted ? ' — released' : ''}. Source: FMP Economic Calendar.`,
    date: datePart,
    time,
    timezone: 'UTC',
    category: mapCategory(raw.event),
    country: countryName(raw.country),
    countryCode: raw.country,
    importance: (raw.impact || 'Medium').toLowerCase() as EconomicEvent['importance'],
    previous: raw.previous !== null && raw.previous !== undefined ? String(raw.previous) : '',
    forecast: raw.estimate !== null && raw.estimate !== undefined ? String(raw.estimate) : '',
    actual: isCompleted ? String(raw.actual) : undefined,
    isCompleted,
    impact: 'unknown',
    affectedAssets: [],
    source: 'FMP',
  };
}

// ──── Internal fetch helper ──────────────────────────────────────────────

function fetchFmpEconomicCalendar(from: string, to: string): Promise<FmpEconomicEvent[]> {
  if (!config.apiKey) {
    return Promise.reject(new Error('FMP API key not configured. Set FMP_API_KEY env var.'));
  }

  const url = `${BASE_URL}/stable/economic-calendar?from=${from}&to=${to}&apikey=${config.apiKey}`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        // 402 = endpoint not included in current FMP tier; 403 = legacy/denied
        if (res.statusCode === 402 || res.statusCode === 403) {
          reject(new Error(`FMP economic calendar endpoint not available (HTTP ${res.statusCode}) — requires a tier that includes it.`));
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`FMP API error (HTTP ${res.statusCode})`));
          return;
        }
        try {
          const parsed = JSON.parse(body) as FmpEconomicCalendarResponse;
          // The stable endpoint returns { economicCalendar: [...] }
          const events = Array.isArray(parsed.economicCalendar) ? parsed.economicCalendar : [];
          resolve(events);
        } catch (e) {
          reject(new Error(`Failed to parse FMP response: ${(e as Error).message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('FMP request timed out')); });
  });
}

// ──── Date helpers ───────────────────────────────────────────────────────

function dateString(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().split('T')[0];
}

function sortByDate(events: EconomicEvent[]): EconomicEvent[] {
  return [...events].sort((a, b) => {
    const diff = a.date.localeCompare(b.date);
    return diff !== 0 ? diff : a.time.localeCompare(b.time);
  });
}

// ──── Public API ─────────────────────────────────────────────────────────

export interface EconomicCalendarResult {
  events: EconomicEvent[];
  source: 'fmp' | 'mock';
  fetchedAt: string;
}

export const economicCalendarService = {
  /**
   * Get all events in the next `days` days (default 90 — FMP max range).
   * Uses live FMP data when configured; falls back to mock events.
   * Cached for 30 minutes (economic calendars change slowly).
   */
  async getUpcoming(days = 90): Promise<EconomicCalendarResult> {
    const range = Math.min(Math.max(days, 1), 90);
    const cacheKey = `econ-calendar:upcoming:${range}`;

    return marketCache.getOrSet(
      cacheKey,
      async () => {
        const from = dateString(0);
        const to = dateString(range);

        if (isEconomicCalendarApiConfigured()) {
          try {
            const rawEvents = await fetchFmpEconomicCalendar(from, to);
            if (rawEvents.length > 0) {
              const events = sortByDate(rawEvents.map(mapFmpEvent));
              return {
                events,
                source: 'fmp' as const,
                fetchedAt: new Date().toISOString(),
              };
            }
            // Empty response from a valid range → fall through to mock
          } catch {
            // Network / tier error → fall through to mock
          }
        }

        return {
          events: sortByDate(economicCalendarEvents),
          source: 'mock' as const,
          fetchedAt: new Date().toISOString(),
        };
      },
      CACHE_TTL.ECONOMIC_CALENDAR,
    );
  },

  /**
   * Get all available events (mock dataset) — used by /summary and the
   * unfiltered listing when no live API is configured.
   */
  async getAll(): Promise<EconomicCalendarResult> {
    // Reuse the cached upcoming fetch (covers the full 90-day window of
    // the mock dataset + any live data) so we never double-call FMP.
    return this.getUpcoming(90);
  },

  /**
   * Get the raw mock events (no cache, no API) — useful for tests.
   */
  getMockEvents(): EconomicEvent[] {
    return economicCalendarEvents;
  },
};
