/**
 * ============================================================================
 * Toroloom — Market Holiday Calendar (backend data + rules)
 * ============================================================================
 *
 * Per-country public holidays that close the primary stock market. Consumed
 * by the GET /api/global-markets/holidays endpoint.
 *
 * Three kinds of entries per country:
 *   - fixed:  'MM-DD' — same Gregorian date every year
 *   - rules:  computed per year (Easter computus, nth-weekday rules)
 *   - lunar:  pre-resolved concrete ISO dates per year (CNY week, equinoxes,
 *             Eid, etc.) — maintained annually when exchanges publish their
 *             official calendars
 *
 * getHolidaysForYear() merges + dedupes them into concrete ISO dates for a
 * given year.
 * ============================================================================
 */

export interface HolidayEntry {
  /** ISO date 'YYYY-MM-DD' */
  date: string;
  /** Untranslated English name (frontend may localize) */
  name: string;
}

export type HolidayCountry =
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

interface CountryHolidays {
  /** Fixed 'MM-DD' holidays */
  fixed: Array<{ date: string; name: string }>;
  /** Rule-based: resolve(year) returns an ISO date */
  rules: Array<{ name: string; resolve: (year: number) => string }>;
  /** Pre-resolved concrete dates per year (lunar / annually-confirmed) */
  lunar: Record<number, HolidayEntry[]>;
}

// ─── Rule helpers ───────────────────────────────────────────────────────────

/** Western Easter Sunday (Gregorian computus). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function goodFriday(year: number): string {
  const e = easterSunday(year);
  e.setUTCDate(e.getUTCDate() - 2);
  return iso(e);
}

function easterMonday(year: number): string {
  const e = easterSunday(year);
  e.setUTCDate(e.getUTCDate() + 1);
  return iso(e);
}

function ascensionDay(year: number): string {
  const e = easterSunday(year);
  e.setUTCDate(e.getUTCDate() + 39);
  return iso(e);
}

function whitMonday(year: number): string {
  const e = easterSunday(year);
  e.setUTCDate(e.getUTCDate() + 50);
  return iso(e);
}

/** Nth weekday of a month (weekday: 0=Sun…6=Sat, n is 1-based). */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return iso(new Date(Date.UTC(year, month - 1, 1 + shift + (n - 1) * 7)));
}

function firstMonday(year: number, month: number): string {
  return nthWeekday(year, month, 1, 1);
}

function lastMonday(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day
  const back = (last.getUTCDay() - 1 + 7) % 7;
  last.setUTCDate(last.getUTCDate() - back);
  return iso(last);
}

function fixedDate(year: number, mmdd: string): string {
  return `${year}-${mmdd}`;
}

// ─── Per-country calendars ──────────────────────────────────────────────────

export const MARKET_HOLIDAYS: Record<HolidayCountry, CountryHolidays> = {
  india: {
    fixed: [
      { date: '01-26', name: 'Republic Day' },
      { date: '04-14', name: 'Dr. Ambedkar Jayanti' },
      { date: '05-01', name: 'Maharashtra Day' },
      { date: '08-15', name: 'Independence Day' },
      { date: '10-02', name: 'Gandhi Jayanti' },
      { date: '12-25', name: 'Christmas' },
    ],
    rules: [
      { name: 'Good Friday', resolve: goodFriday },
    ],
    lunar: {
      // NSE 2026 provisional calendar (confirm when NSE publishes final)
      2026: [
        { date: '2026-03-03', name: 'Holi' },
        { date: '2026-03-20', name: 'Id-Ul-Fitr (Eid al-Fitr)' },
        { date: '2026-03-26', name: 'Ram Navami' },
        { date: '2026-03-31', name: 'Mahavir Jayanti' },
        { date: '2026-04-01', name: 'Annual Bank Closing' },
        { date: '2026-11-09', name: 'Diwali Laxmi Pujan (muhurat trading)' },
        { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
      ],
    },
  },

  us: {
    fixed: [
      { date: '01-01', name: "New Year's Day" },
      { date: '07-04', name: 'Independence Day' },
      { date: '12-25', name: 'Christmas Day' },
    ],
    rules: [
      { name: 'MLK Day', resolve: (y) => nthWeekday(y, 1, 1, 3) },
      { name: 'Presidents Day', resolve: (y) => nthWeekday(y, 2, 1, 3) },
      { name: 'Memorial Day', resolve: (y) => lastMonday(y, 5) },
      { name: 'Juneteenth', resolve: (y) => fixedDate(y, '06-19') },
      { name: 'Labor Day', resolve: (y) => firstMonday(y, 9) },
      { name: 'Thanksgiving', resolve: (y) => nthWeekday(y, 11, 4, 4) },
    ],
    lunar: {},
  },

  uk: {
    fixed: [
      { date: '01-01', name: "New Year's Day" },
      { date: '12-25', name: 'Christmas Day' },
    ],
    rules: [
      { name: 'Good Friday', resolve: goodFriday },
      { name: 'Easter Monday', resolve: easterMonday },
      { name: 'Early May Bank Holiday', resolve: (y) => firstMonday(y, 5) },
      { name: 'Spring Bank Holiday', resolve: (y) => lastMonday(y, 5) },
      { name: 'Summer Bank Holiday', resolve: (y) => lastMonday(y, 8) },
      { name: 'Boxing Day', resolve: (y) => fixedDate(y, '12-26') },
    ],
    lunar: {},
  },

  japan: {
    fixed: [
      { date: '01-01', name: "New Year's Day" },
      { date: '02-11', name: 'National Foundation Day' },
      { date: '02-23', name: "Emperor's Birthday" },
      { date: '04-29', name: 'Showa Day' },
      { date: '05-03', name: 'Constitution Day' },
      { date: '05-04', name: 'Greenery Day' },
      { date: '05-05', name: "Children's Day" },
      { date: '08-11', name: 'Mountain Day' },
      { date: '11-03', name: 'Culture Day' },
      { date: '11-23', name: 'Labour Thanksgiving Day' },
    ],
    rules: [
      { name: 'Coming of Age Day', resolve: (y) => nthWeekday(y, 1, 1, 2) },
      { name: 'Marine Day', resolve: (y) => nthWeekday(y, 7, 1, 3) },
      { name: 'Sports Day', resolve: (y) => nthWeekday(y, 10, 1, 2) },
    ],
    lunar: {
      // Equinox dates shift slightly each year (astronomical)
      2026: [
        { date: '2026-03-20', name: 'Vernal Equinox Day' },
        { date: '2026-09-22', name: 'Autumnal Equinox Day' },
      ],
    },
  },

  germany: {
    fixed: [
      { date: '01-01', name: "New Year's Day" },
      { date: '12-25', name: 'Christmas Day' },
      { date: '12-26', name: 'Boxing Day' },
    ],
    rules: [
      { name: 'Good Friday', resolve: goodFriday },
      { name: 'Easter Monday', resolve: easterMonday },
      { name: 'Labour Day', resolve: (y) => fixedDate(y, '05-01') },
      { name: 'Ascension Day', resolve: ascensionDay },
      { name: 'Whit Monday', resolve: whitMonday },
      { name: 'German Unity Day', resolve: (y) => fixedDate(y, '10-03') },
    ],
    lunar: {},
  },

  china: {
    fixed: [
      { date: '01-01', name: "New Year's Day" },
    ],
    rules: [
      { name: 'Qingming Festival', resolve: (y) => fixedDate(y, '04-04') },
      { name: 'Labour Day', resolve: (y) => fixedDate(y, '05-01') },
      { name: 'National Day', resolve: (y) => fixedDate(y, '10-01') },
      { name: 'National Day (Day 2)', resolve: (y) => fixedDate(y, '10-02') },
      { name: 'National Day (Day 3)', resolve: (y) => fixedDate(y, '10-03') },
    ],
    lunar: {
      // Spring Festival closure weeks (CNY Gregorian anchor dates):
      2026: [
        { date: '2026-02-16', name: 'Spring Festival (CNY -1)' },
        { date: '2026-02-17', name: 'Spring Festival (CNY)' },
        { date: '2026-02-18', name: 'Spring Festival (CNY +1)' },
        { date: '2026-02-19', name: 'Spring Festival (CNY +2)' },
        { date: '2026-02-20', name: 'Spring Festival (CNY +3)' },
      ],
      2027: [
        { date: '2027-02-08', name: 'Spring Festival (CNY +2)' },
        { date: '2027-02-09', name: 'Spring Festival (CNY +3)' },
        { date: '2027-02-10', name: 'Spring Festival (CNY +4)' },
        { date: '2027-02-11', name: 'Spring Festival (CNY +5)' },
        { date: '2027-02-12', name: 'Spring Festival (CNY +6)' },
      ],
      2028: [
        { date: '2028-01-26', name: 'Spring Festival (CNY)' },
        { date: '2028-01-27', name: 'Spring Festival (CNY +1)' },
        { date: '2028-01-28', name: 'Spring Festival (CNY +2)' },
        { date: '2028-01-31', name: 'Spring Festival (CNY +5)' },
        { date: '2028-02-01', name: 'Spring Festival (CNY +6)' },
      ],
    },
  },

  singapore: {
    fixed: [
      { date: '01-01', name: "New Year's Day" },
      { date: '05-01', name: 'Labour Day' },
      { date: '08-09', name: 'National Day' },
      { date: '12-25', name: 'Christmas Day' },
    ],
    rules: [
      { name: 'Good Friday', resolve: goodFriday },
      // Lunar-anchored holidays are pre-resolved per year below
    ],
    lunar: {
      2026: [
        { date: '2026-02-17', name: 'Chinese New Year' },
        { date: '2026-02-18', name: 'Chinese New Year (Day 2)' },
        { date: '2026-03-20', name: 'Hari Raya Puasa' },
        { date: '2026-05-27', name: 'Hari Raya Haji' },
        { date: '2026-05-31', name: 'Vesak Day' },
        { date: '2026-11-08', name: 'Deepavali' },
      ],
      2027: [
        { date: '2027-02-06', name: 'Chinese New Year' },
        { date: '2027-02-08', name: 'Chinese New Year (Day 2)' },
        { date: '2027-03-10', name: 'Hari Raya Puasa' },
        { date: '2027-05-17', name: 'Hari Raya Haji' },
        { date: '2027-05-20', name: 'Vesak Day' },
        { date: '2027-10-28', name: 'Deepavali' },
      ],
      2028: [
        { date: '2028-01-26', name: 'Chinese New Year' },
        { date: '2028-01-27', name: 'Chinese New Year (Day 2)' },
        { date: '2028-02-27', name: 'Hari Raya Puasa' },
        { date: '2028-05-05', name: 'Hari Raya Haji' },
        { date: '2028-05-09', name: 'Vesak Day' },
        { date: '2028-10-16', name: 'Deepavali' },
      ],
    },
  },

  australia: {
    fixed: [
      { date: '01-01', name: "New Year's Day" },
      { date: '01-26', name: 'Australia Day' },
      { date: '04-25', name: 'Anzac Day' },
      { date: '12-25', name: 'Christmas Day' },
      { date: '12-26', name: 'Boxing Day' },
    ],
    rules: [
      { name: 'Good Friday', resolve: goodFriday },
      { name: 'Easter Monday', resolve: easterMonday },
      { name: "King's Birthday", resolve: (y) => nthWeekday(y, 6, 1, 2) },
    ],
    lunar: {},
  },

  hongkong: {
    fixed: [
      { date: '01-01', name: "New Year's Day" },
      { date: '05-01', name: 'Labour Day' },
      { date: '07-01', name: 'HKSAR Establishment Day' },
      { date: '10-01', name: 'National Day' },
      { date: '12-25', name: 'Christmas Day' },
    ],
    rules: [
      { name: 'Good Friday', resolve: goodFriday },
      { name: 'Easter Monday', resolve: easterMonday },
    ],
    lunar: {
      2026: [
        { date: '2026-02-17', name: 'Chinese New Year' },
        { date: '2026-02-18', name: 'Chinese New Year (Day 2)' },
        { date: '2026-02-19', name: 'Chinese New Year (Day 3)' },
        { date: '2026-05-24', name: "Buddha's Birthday" },
        { date: '2026-06-19', name: 'Tuen Ng Festival' },
        { date: '2026-09-26', name: 'Day after Mid-Autumn Festival' },
        { date: '2026-10-19', name: 'Chung Yeung Festival' },
      ],
      2027: [
        { date: '2027-02-06', name: 'Chinese New Year' },
        { date: '2027-02-08', name: 'Chinese New Year (Day 2)' },
        { date: '2027-02-09', name: 'Chinese New Year (Day 3)' },
        { date: '2027-05-13', name: "Buddha's Birthday" },
        { date: '2027-06-09', name: 'Tuen Ng Festival' },
        { date: '2027-09-16', name: 'Day after Mid-Autumn Festival' },
        { date: '2027-10-09', name: 'Chung Yeung Festival' },
      ],
      2028: [
        { date: '2028-01-26', name: 'Chinese New Year' },
        { date: '2028-01-27', name: 'Chinese New Year (Day 2)' },
        { date: '2028-01-28', name: 'Chinese New Year (Day 3)' },
        { date: '2028-05-02', name: "Buddha's Birthday" },
        { date: '2028-05-28', name: 'Tuen Ng Festival' },
        { date: '2028-10-04', name: 'Day after Mid-Autumn Festival' },
        { date: '2028-10-27', name: 'Chung Yeung Festival' },
      ],
    },
  },

  switzerland: {
    fixed: [
      { date: '01-01', name: "New Year's Day" },
      { date: '08-01', name: 'Swiss National Day' },
      { date: '12-25', name: 'Christmas Day' },
      { date: '12-26', name: "St Stephen's Day" },
    ],
    rules: [
      { name: 'Good Friday', resolve: goodFriday },
      { name: 'Easter Monday', resolve: easterMonday },
      { name: 'Ascension Day', resolve: ascensionDay },
      { name: 'Whit Monday', resolve: whitMonday },
    ],
    lunar: {},
  },

  southkorea: {
    fixed: [
      { date: '01-01', name: "New Year's Day" },
      { date: '03-01', name: 'Independence Movement Day' },
      { date: '05-05', name: "Children's Day" },
      { date: '06-06', name: 'Memorial Day' },
      { date: '08-15', name: 'Liberation Day' },
      { date: '10-03', name: 'National Foundation Day' },
      { date: '10-09', name: 'Hangeul Day' },
      { date: '12-25', name: 'Christmas Day' },
    ],
    rules: [],
    lunar: {
      2026: [
        { date: '2026-02-16', name: 'Seollal (Day 1)' },
        { date: '2026-02-17', name: 'Seollal' },
        { date: '2026-02-18', name: 'Seollal (Day 3)' },
        { date: '2026-05-24', name: "Buddha's Birthday" },
        { date: '2026-09-24', name: 'Chuseok (Day 1)' },
        { date: '2026-09-25', name: 'Chuseok' },
        { date: '2026-09-26', name: 'Chuseok (Day 3)' },
      ],
      2027: [
        { date: '2027-02-05', name: 'Seollal (Day 1)' },
        { date: '2027-02-06', name: 'Seollal' },
        { date: '2027-02-07', name: 'Seollal (Day 3)' },
        { date: '2027-05-13', name: "Buddha's Birthday" },
        { date: '2027-09-14', name: 'Chuseok (Day 1)' },
        { date: '2027-09-15', name: 'Chuseok' },
        { date: '2027-09-16', name: 'Chuseok (Day 3)' },
      ],
      2028: [
        { date: '2028-01-25', name: 'Seollal (Day 1)' },
        { date: '2028-01-26', name: 'Seollal' },
        { date: '2028-01-27', name: 'Seollal (Day 3)' },
        { date: '2028-05-02', name: "Buddha's Birthday" },
        { date: '2028-10-02', name: 'Chuseok (Day 1)' },
        { date: '2028-10-03', name: 'Chuseok' },
        { date: '2028-10-04', name: 'Chuseok (Day 3)' },
      ],
    },
  },
};

/**
 * All holidays for one country in a given year, merged from fixed + rules +
 * lunar tables, deduped by date (first occurrence wins) and sorted by date.
 */
export function getHolidaysForYear(country: string, year: number): HolidayEntry[] {
  const def = MARKET_HOLIDAYS[country as HolidayCountry];
  if (!def) return [];

  const byDate = new Map<string, string>();

  for (const f of def.fixed) {
    byDate.set(fixedDate(year, f.date), f.name);
  }
  for (const r of def.rules) {
    byDate.set(r.resolve(year), r.name);
  }
  for (const entry of def.lunar[year] ?? []) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, entry.name);
  }

  return [...byDate.entries()]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
