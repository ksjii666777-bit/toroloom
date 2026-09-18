/**
 * ============================================================================
 * Toroloom — Market Open/Closed Status
 * ============================================================================
 *
 * Determines whether a country's primary stock market is currently open,
 * using the same windows shown in the Global Markets "Market Hours" cards:
 *
 *   india      — NSE/BSE      Mon–Fri 09:15–15:30 IST   (UTC+5:30, no DST)
 *   us         — NYSE/NASDAQ  Mon–Fri 09:30–16:00 ET    (UTC−5, DST −4)
 *   uk         — LSE          Mon–Fri 08:00–16:30 GMT   (UTC+0, DST +1)
 *   japan      — TSE          Mon–Fri 09:00–11:30, 12:30–15:00 JST (UTC+9, no DST)
 *   germany    — Xetra        Mon–Fri 09:00–17:30 CET   (UTC+1, DST +2)
 *   china      — SSE/SZSE     Mon–Fri 09:30–11:30, 13:00–15:00 CST (UTC+8, no DST)
 *   singapore  — SGX          Mon–Fri 09:00–12:00, 13:00–17:00 SGT (UTC+8, no DST)
 *   australia  — ASX          Mon–Fri 10:00–16:00 AEST  (UTC+10, no DST)
 *   hongkong   — HKEX         Mon–Fri 09:30–12:00, 13:00–16:00 HKT (UTC+8, no DST)
 *   switzerland — SIX         Mon–Fri 09:00–17:30 CET   (UTC+1, DST +2)
 *   southkorea — KRX          Mon–Fri 09:00–15:30 KST   (UTC+9, no DST)
 *
 * All calculations are DST-aware: the helper derives each zone's current
 * UTC offset from its standard offset + month-based DST window (approximate
 * for EU/US rules — accurate enough for a status badge, no deps needed).
 *
 * Note: public holidays are NOT handled (would require a per-country
 * holiday calendar); weekends are handled.
 * ============================================================================
 */

export type CountryMarketKey =
  | 'india'
  | 'us'
  | 'uk'
  | 'japan'
  | 'germany'
  | 'china'
  | 'singapore'
  | 'australia'
  | 'hongkong'
  | 'switzerland'
  | 'southkorea';

export interface MarketStatus {
  isOpen: boolean;
  /** 'pre' = pre-open window, 'open' = regular session, 'closed' otherwise, 'holiday' = public-holiday closure */
  phase: 'pre' | 'open' | 'closed' | 'holiday';
  /** Minutes until next open (only meaningful when closed) */
  minutesToOpen: number | null;
  /** Holiday name when phase === 'holiday' (from the backend calendar) */
  holidayName?: string;
}

interface SessionWindow {
  /** Minutes from local midnight */
  start: number;
  end: number;
}

interface MarketDef {
  /** Base (standard-time) offset from UTC in minutes */
  standardOffsetMinutes: number;
  /** Northern-hemisphere DST (last Sun Mar – last Sun Oct) if the zone observes it */
  hasDST: boolean;
  /** Regular trading sessions in market-local minutes-from-midnight */
  sessions: SessionWindow[];
  /** Optional pre-open window (minutes from local midnight) */
  preOpen?: SessionWindow;
}

const MARKETS: Record<CountryMarketKey, MarketDef> = {
  india: {
    standardOffsetMinutes: 330, // UTC+5:30, no DST
    hasDST: false,
    preOpen: { start: 9 * 60, end: 9 * 60 + 15 },
    sessions: [{ start: 9 * 60 + 15, end: 15 * 60 + 30 }],
  },
  us: {
    standardOffsetMinutes: -300, // EST UTC−5
    hasDST: true, // EDT UTC−4 (Mar–Nov)
    sessions: [{ start: 9 * 60 + 30, end: 16 * 60 }],
  },
  uk: {
    standardOffsetMinutes: 0, // GMT
    hasDST: true, // BST UTC+1 (Mar–Oct)
    sessions: [{ start: 8 * 60, end: 16 * 60 + 30 }],
  },
  japan: {
    standardOffsetMinutes: 540, // UTC+9, no DST
    hasDST: false,
    sessions: [
      { start: 9 * 60, end: 11 * 60 + 30 },
      { start: 12 * 60 + 30, end: 15 * 60 },
    ],
  },
  germany: {
    standardOffsetMinutes: 60, // CET UTC+1
    hasDST: true, // CEST UTC+2 (Mar–Oct)
    sessions: [{ start: 9 * 60, end: 17 * 60 + 30 }],
  },
  china: {
    standardOffsetMinutes: 480, // UTC+8, no DST
    hasDST: false,
    sessions: [
      { start: 9 * 60 + 30, end: 11 * 60 + 30 },
      { start: 13 * 60, end: 15 * 60 },
    ],
  },
  singapore: {
    standardOffsetMinutes: 480, // SGT UTC+8, no DST
    hasDST: false,
    preOpen: { start: 8 * 60 + 30, end: 9 * 60 }, // 8:30–9:00 OPEN session
    sessions: [
      { start: 9 * 60, end: 12 * 60 },
      { start: 13 * 60, end: 17 * 60 },
    ],
  },
  australia: {
    standardOffsetMinutes: 600, // AEST UTC+10 (Sydney's local DST is not applied)
    hasDST: false,
    preOpen: { start: 7 * 60, end: 10 * 60 }, // ASX pre-open / pre-CSPA
    sessions: [{ start: 10 * 60, end: 16 * 60 }],
  },
  hongkong: {
    standardOffsetMinutes: 480, // HKT UTC+8, no DST
    hasDST: false,
    preOpen: { start: 9 * 60, end: 9 * 60 + 30 }, // 9:00–9:30 pre-open auction
    sessions: [
      { start: 9 * 60 + 30, end: 12 * 60 },
      { start: 13 * 60, end: 16 * 60 },
    ],
  },
  switzerland: {
    standardOffsetMinutes: 60, // CET UTC+1
    hasDST: true, // CEST UTC+2 (Mar–Oct)
    sessions: [{ start: 9 * 60, end: 17 * 60 + 30 }],
  },
  southkorea: {
    standardOffsetMinutes: 540, // KST UTC+9, no DST
    hasDST: false,
    sessions: [{ start: 9 * 60, end: 15 * 60 + 30 }], // KRX: no lunch break
  },
};

/** Current UTC offset (minutes) for a zone: standard + DST adjustment. */
function currentOffsetMinutes(def: MarketDef, now: Date): number {
  if (!def.hasDST) return def.standardOffsetMinutes;
  // Approximate northern-hemisphere DST: last Sunday of March → last Sunday of October.
  const month = now.getUTCMonth(); // 0-11
  if (month >= 2 && month <= 9) {
    const day = now.getUTCDate();
    // Rough "in-DST" check: whole months Apr–Sep are definitely DST; edges
    // (late Mar / late Oct) use a day-of-month heuristic (DST starts ~last
    // Sun Mar i.e. day ≥ 25, ends ~last Sun Oct i.e. day ≤ 27 when in Oct).
    if (month >= 3 && month <= 8) return def.standardOffsetMinutes + 60;
    if (month === 2 && day >= 25) return def.standardOffsetMinutes + 60;
    if (month === 9 && day <= 27) return def.standardOffsetMinutes + 60;
  }
  return def.standardOffsetMinutes;
}

/** Get "now" expressed in the market's local time (minutes from midnight + weekday + ISO date). */
function marketLocalTime(def: MarketDef, now: Date): { minutes: number; weekday: number; isoDate: string } {
  const offset = currentOffsetMinutes(def, now);
  const local = new Date(now.getTime() + offset * 60_000);
  return {
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
    weekday: local.getUTCDay(), // 0 = Sun … 6 = Sat
    isoDate: local.toISOString().slice(0, 10),
  };
}

/**
 * Compute the live status for one country's market.
 * @param country one of the six Global Markets countries
 * @param now injectable clock (defaults to real now) — used by tests
 * @param holidays optional date→name map of market holidays for this country
 *   (from the backend calendar via marketHolidayService); when provided,
 *   holiday weekdays report phase 'holiday' with the holiday's name
 */
export function getMarketStatus(
  country: CountryMarketKey,
  now: Date = new Date(),
  holidays?: Map<string, string>,
): MarketStatus {
  const def = MARKETS[country];
  const { minutes, weekday, isoDate } = marketLocalTime(def, now);
  const isWeekday = weekday >= 1 && weekday <= 5;

  // Public-holiday closure takes precedence over the session windows
  if (isWeekday && holidays?.get(isoDate)) {
    return {
      isOpen: false,
      phase: 'holiday',
      minutesToOpen: minutes < def.sessions[0].start ? def.sessions[0].start - minutes : null,
      holidayName: holidays.get(isoDate)!,
    };
  }

  if (isWeekday) {
    if (def.preOpen && minutes >= def.preOpen.start && minutes < def.preOpen.end) {
      return { isOpen: false, phase: 'pre', minutesToOpen: def.sessions[0].start - minutes };
    }
    for (const s of def.sessions) {
      if (minutes >= s.start && minutes < s.end) {
        return { isOpen: true, phase: 'open', minutesToOpen: 0 };
      }
    }
  }

  // Closed: minutes until next weekday open (approximate — skips holidays).
  let minutesToOpen: number | null;
  if (isWeekday) {
    const firstOpen = def.sessions[0].start;
    minutesToOpen = minutes < firstOpen
      ? firstOpen - minutes
      : (24 * 60 - minutes) + firstOpen;
  } else {
    const daysToMonday = weekday === 0 ? 1 : 7 - (weekday - 1);
    minutesToOpen = daysToMonday * 24 * 60 - minutes + def.sessions[0].start;
  }
  return { isOpen: false, phase: 'closed', minutesToOpen };
}

/**
 * Compact human string for minutes-until-open, e.g. "45m", "2h", "2h 15m".
 * Returns '' when already open / zero.
 */
export function formatTimeUntilOpen(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Current wall-clock time in a market's local zone ("HH:MM"), for the
 * Global tab's world-clock strip. Uses the same DST-aware offset logic as
 * the status engine, so the displayed time always matches the badge state.
 */
export function getMarketLocalClock(
  country: CountryMarketKey,
  now: Date = new Date(),
): { time: string; weekday: number } {
  const def = MARKETS[country];
  const { minutes, weekday } = marketLocalTime(def, now);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return { time: `${hh}:${mm}`, weekday };
}

/**
 * All supported statuses in one call (for chip badges).
 * @param now injectable clock
 * @param holidayCalendars optional per-country date→name holiday maps
 *   (from the backend calendar); holiday weekdays report phase 'holiday'
 */
export function getAllMarketStatuses(
  now: Date = new Date(),
  holidayCalendars?: Partial<Record<CountryMarketKey, Map<string, string>>>,
): Record<CountryMarketKey, MarketStatus> {
  const keys: CountryMarketKey[] = [
    'india',
    'us',
    'uk',
    'japan',
    'germany',
    'china',
    'singapore',
    'australia',
    'hongkong',
    'switzerland',
    'southkorea',
  ];
  const out = {} as Record<CountryMarketKey, MarketStatus>;
  for (const k of keys) {
    out[k] = getMarketStatus(k, now, holidayCalendars?.[k]);
  }
  return out;
}
