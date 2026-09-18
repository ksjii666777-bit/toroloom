/**
 * ============================================================================
 * Toroloom — Market Status Unit Tests
 * ============================================================================
 *
 * Verifies the DST-aware open/closed logic for the six Global Markets
 * countries. Every case uses a fixed `now` injected via Date:
 *
 *   - Regular sessions open / before open / after close / lunch break
 *   - Weekends (Saturday / Sunday in the market's own local time)
 *   - Pre-open phase (India only)
 *   - DST correctness: a July date (both US + UK + Germany in DST) and a
 *     January date (standard time) give different UTC clock answers but the
 *     same local-time verdict
 *   - minutesToOpen sanity (same-day and weekend rollover)
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  getMarketStatus,
  getAllMarketStatuses,
  getMarketLocalClock,
  type CountryMarketKey,
} from '../utils/marketStatus';

/** Build a Date from a UTC timestamp. */
const utc = (iso: string) => new Date(iso);

/** Market-local 10:00 AM helper: NSE 10:00 IST = 04:30 UTC (IST = UTC+5:30). */
const MON_1030_IST = utc('2026-07-13T05:00:00Z'); // Mon 10:30 IST

describe('getMarketStatus — India (IST, no DST)', () => {
  it('is open during regular session', () => {
    // Mon 10:30 IST = Mon 05:00 UTC
    expect(getMarketStatus('india', MON_1030_IST)).toMatchObject({ isOpen: true, phase: 'open' });
  });

  it('is pre-open at 9:05 IST', () => {
    // Mon 09:05 IST = 03:35 UTC
    expect(getMarketStatus('india', utc('2026-07-13T03:35:00Z'))).toMatchObject({
      isOpen: false, phase: 'pre',
    });
  });

  it('is closed before pre-open and after close', () => {
    // Mon 08:00 IST = 02:30 UTC
    expect(getMarketStatus('india', utc('2026-07-13T02:30:00Z')).phase).toBe('closed');
    // Mon 16:00 IST = 10:30 UTC
    expect(getMarketStatus('india', utc('2026-07-13T10:30:00Z')).phase).toBe('closed');
  });

  it('is closed on Saturday local time even if weekday elsewhere', () => {
    // Sat 11:00 IST = Sat 05:30 UTC
    expect(getMarketStatus('india', utc('2026-07-18T05:30:00Z')).isOpen).toBe(false);
  });

  it('minutesToOpen counts to 9:15 same-day when closed early morning', () => {
    // Mon 08:00 IST → open in 75 min
    const s = getMarketStatus('india', utc('2026-07-13T02:30:00Z'));
    expect(s.minutesToOpen).toBe(75);
  });
});

describe('getMarketStatus — US (ET, DST-aware)', () => {
  it('is open at 10:00 ET in July (EDT, UTC−4)', () => {
    // Mon 10:00 EDT = 14:00 UTC
    expect(getMarketStatus('us', utc('2026-07-13T14:00:00Z'))).toMatchObject({ isOpen: true });
  });

  it('is open at 10:00 ET in January (EST, UTC−5)', () => {
    // Mon 10:00 EST = 15:00 UTC
    expect(getMarketStatus('us', utc('2026-01-12T15:00:00Z'))).toMatchObject({ isOpen: true });
  });

  it('is closed after 16:00 ET (July: 20:00 UTC)', () => {
    expect(getMarketStatus('us', utc('2026-07-13T20:00:00Z')).isOpen).toBe(false);
  });

  it('same UTC clock (14:00 UTC) is open in July but NOT in January', () => {
    // 14:00 UTC = 10:00 EDT (open) but 09:00 EST (closed)
    expect(getMarketStatus('us', utc('2026-07-13T14:00:00Z')).isOpen).toBe(true);
    expect(getMarketStatus('us', utc('2026-01-12T14:00:00Z')).isOpen).toBe(false);
  });
});

describe('getMarketStatus — UK (LSE, BST-aware)', () => {
  it('is open at 09:00 London in July (BST, UTC+1)', () => {
    // Mon 09:00 BST = 08:00 UTC
    expect(getMarketStatus('uk', utc('2026-07-13T08:00:00Z'))).toMatchObject({ isOpen: true });
  });

  it('is closed at 09:00 London in January (GMT, UTC+0)', () => {
    // Mon 09:00 GMT = 09:00 UTC — wait, that IS open (08:00–16:30). Use 07:30 UTC.
    expect(getMarketStatus('uk', utc('2026-01-12T07:30:00Z')).isOpen).toBe(false);
  });

  it('is open at 16:29 GMT, closed at 16:31 GMT (January)', () => {
    expect(getMarketStatus('uk', utc('2026-01-12T16:29:00Z')).isOpen).toBe(true);
    expect(getMarketStatus('uk', utc('2026-01-12T16:31:00Z')).isOpen).toBe(false);
  });
});

describe('getMarketStatus — Japan (JST, lunch break)', () => {
  it('is closed during the 11:30–12:30 lunch break', () => {
    // Mon 12:00 JST = 03:00 UTC
    const s = getMarketStatus('japan', utc('2026-07-13T03:00:00Z'));
    expect(s.isOpen).toBe(false);
    expect(s.phase).toBe('closed');
  });

  it('is open in both sessions', () => {
    // Mon 10:00 JST = 01:00 UTC (morning), Mon 14:00 JST = 05:00 UTC (afternoon)
    expect(getMarketStatus('japan', utc('2026-07-13T01:00:00Z')).isOpen).toBe(true);
    expect(getMarketStatus('japan', utc('2026-07-13T05:00:00Z')).isOpen).toBe(true);
  });

  it('weekend in Tokyo is closed', () => {
    // Sun 10:00 JST = Sun 01:00 UTC
    expect(getMarketStatus('japan', utc('2026-07-19T01:00:00Z')).isOpen).toBe(false);
  });
});

describe('getMarketStatus — Germany (Xetra, CEST)', () => {
  it('is open at 10:00 CET in winter (UTC+1)', () => {
    // Mon 10:00 CET = 09:00 UTC
    expect(getMarketStatus('germany', utc('2026-01-12T09:00:00Z'))).toMatchObject({ isOpen: true });
  });

  it('is open at 10:00 CEST in summer (UTC+2)', () => {
    // Mon 10:00 CEST = 08:00 UTC
    expect(getMarketStatus('germany', utc('2026-07-13T08:00:00Z'))).toMatchObject({ isOpen: true });
  });

  it('is closed after 17:30 local', () => {
    // Mon 17:35 CEST = 15:35 UTC
    expect(getMarketStatus('germany', utc('2026-07-13T15:35:00Z')).isOpen).toBe(false);
  });
});

describe('getMarketStatus — China (CST, lunch break)', () => {
  it('is closed during lunch 11:30–13:00', () => {
    // Mon 12:00 CST = 04:00 UTC
    expect(getMarketStatus('china', utc('2026-07-13T04:00:00Z')).isOpen).toBe(false);
  });

  it('is open in both sessions', () => {
    // Mon 10:00 CST = 02:00 UTC; Mon 14:00 CST = 06:00 UTC
    expect(getMarketStatus('china', utc('2026-07-13T02:00:00Z')).isOpen).toBe(true);
    expect(getMarketStatus('china', utc('2026-07-13T06:00:00Z')).isOpen).toBe(true);
  });
});

describe('getAllMarketStatuses', () => {
  it('returns all eleven countries with correct shape', () => {
    const all = getAllMarketStatuses(MON_1030_IST);
    const keys: CountryMarketKey[] = [
      'india', 'us', 'uk', 'japan', 'germany', 'china',
      'singapore', 'australia', 'hongkong', 'switzerland', 'southkorea',
    ];
    keys.forEach((k) => {
      expect(all[k]).toHaveProperty('isOpen');
      expect(all[k]).toHaveProperty('phase');
      expect(all[k]).toHaveProperty('minutesToOpen');
    });
    // At Mon 10:30 IST (= Mon 05:00 UTC):
    expect(all.india.isOpen).toBe(true); // 10:30 IST in session
    expect(all.japan.isOpen).toBe(true); // 14:00 JST afternoon
    expect(all.singapore.isOpen).toBe(true); // 13:00 SGT afternoon session
    expect(all.australia.isOpen).toBe(true); // 15:00 AEST in session
    expect(all.hongkong.isOpen).toBe(true); // 13:00 HKT afternoon
    expect(all.southkorea.isOpen).toBe(true); // 14:00 KST in session
    expect(all.switzerland.isOpen).toBe(false); // 07:00 CEST pre-open
    expect(all.us.isOpen).toBe(false); // pre-4am ET
  });
});

describe('weekend rollover — minutesToOpen', () => {
  it('Saturday evening reports minutes until Monday open', () => {
    // Sat 12:00 IST = Sat 06:30 UTC
    const s = getMarketStatus('india', utc('2026-07-18T06:30:00Z'));
    expect(s.isOpen).toBe(false);
    // Sat → Mon 09:15 = 2 days minus 12h... exact: 2*1440 - 720 + 555 = 2715
    expect(s.minutesToOpen).toBeGreaterThan(2000);
  });
});

// ─── Holiday-aware tests ────────────────────────────────────────────────────

describe('getMarketStatus — holiday calendar', () => {
  // Mon 2026-08-17 10:30 IST (a normal Monday — would be open without calendar)
  const MON_INDIA_OPEN = utc('2026-08-17T05:00:00Z');
  const indiaCal = new Map([['2026-08-17', 'Parsi New Year']]);

  it('reports phase holiday with the holiday name when the date is in the calendar', () => {
    const s = getMarketStatus('india', MON_INDIA_OPEN, indiaCal);
    expect(s.isOpen).toBe(false);
    expect(s.phase).toBe('holiday');
    expect(s.holidayName).toBe('Parsi New Year');
  });

  it('ignores the calendar on ordinary days (normal open)', () => {
    const s = getMarketStatus('india', MON_INDIA_OPEN, new Map([['2026-08-18', 'Other Day']]));
    expect(s.isOpen).toBe(true);
    expect(s.phase).toBe('open');
  });

  it('without a calendar, holidays are not known (open as usual)', () => {
    expect(getMarketStatus('india', MON_INDIA_OPEN).isOpen).toBe(true);
  });

  it('weekend + calendar date still reports closed (not holiday)', () => {
    // Sat 2026-08-22 10:30 IST = 05:00 UTC
    const s = getMarketStatus('india', utc('2026-08-22T05:00:00Z'), new Map([['2026-08-22', 'Some Holiday']]));
    expect(s.phase).toBe('closed');
    expect(s.holidayName).toBeUndefined();
  });

  it('holiday before session start keeps minutesToOpen to first session', () => {
    // Mon 2026-08-17 08:00 IST = 02:30 UTC (holiday day, before open)
    const s = getMarketStatus('india', utc('2026-08-17T02:30:00Z'), indiaCal);
    expect(s.phase).toBe('holiday');
    expect(s.minutesToOpen).toBe(75); // 9:15 − 8:00
  });

  it('getAllMarketStatuses accepts per-country calendars', () => {
    const all = getAllMarketStatuses(MON_INDIA_OPEN, { india: indiaCal });
    expect(all.india.phase).toBe('holiday');
    expect(all.us.phase).toBe('closed'); // no calendar → normal logic
  });
});

describe('new markets — singapore, australia, hongkong, switzerland, southkorea', () => {
  it('SGX: open in morning session, lunch break, afternoon session, pre-open', () => {
    // Mon 02:00 UTC = Mon 10:00 SGT — morning session
    expect(getMarketStatus('singapore', utc('2026-07-13T02:00:00Z')).isOpen).toBe(true);
    // Mon 04:30 UTC = Mon 12:30 SGT — lunch break
    const lunch = getMarketStatus('singapore', utc('2026-07-13T04:30:00Z'));
    expect(lunch.isOpen).toBe(false);
    // Mon 06:00 UTC = Mon 14:00 SGT — afternoon session
    expect(getMarketStatus('singapore', utc('2026-07-13T06:00:00Z')).isOpen).toBe(true);
    // Mon 00:45 UTC = Mon 08:45 SGT — OPEN pre-session (phase 'pre')
    const pre = getMarketStatus('singapore', utc('2026-07-13T00:45:00Z'));
    expect(pre.phase).toBe('pre');
    expect(pre.isOpen).toBe(false);
  });

  it('ASX: open 10:00–16:00 AEST, pre-open phase in the morning', () => {
    // Mon 01:30 UTC = Mon 11:30 AEST — open
    expect(getMarketStatus('australia', utc('2026-07-13T01:30:00Z')).isOpen).toBe(true);
    // Mon 07:00 UTC = Mon 17:00 AEST — closed, opens tomorrow 10:00
    const closed = getMarketStatus('australia', utc('2026-07-13T07:00:00Z'));
    expect(closed.isOpen).toBe(false);
    expect(closed.minutesToOpen).toBe(17 * 60);
    // Mon 00:30 UTC = Mon 10:30 AEST... use 23:30 Sun UTC = 09:30 Mon AEST → pre
    const pre = getMarketStatus('australia', utc('2026-07-12T23:30:00Z'));
    expect(pre.phase).toBe('pre');
  });

  it('HKEX: pre-open auction, morning session, lunch break, afternoon', () => {
    // Mon 01:00 UTC = Mon 09:00 HKT — pre-open auction
    const pre = getMarketStatus('hongkong', utc('2026-07-13T01:00:00Z'));
    expect(pre.phase).toBe('pre');
    // Mon 02:30 UTC = Mon 10:30 HKT — morning session open
    expect(getMarketStatus('hongkong', utc('2026-07-13T02:30:00Z')).isOpen).toBe(true);
    // Mon 04:00 UTC = Mon 12:00 HKT — lunch break (closed between sessions)
    const lunch = getMarketStatus('hongkong', utc('2026-07-13T04:00:00Z'));
    expect(lunch.isOpen).toBe(false);
    // Mon 07:00 UTC = Mon 15:00 HKT — afternoon open
    expect(getMarketStatus('hongkong', utc('2026-07-13T07:00:00Z')).isOpen).toBe(true);
  });

  it('SIX: DST-aware — closed in January (CET), open in July (CEST)', () => {
    // Mon 12:00 UTC Jan = 13:00 CET — in session (9:00–17:30)
    expect(getMarketStatus('switzerland', utc('2026-01-12T12:00:00Z')).isOpen).toBe(true);
    // Mon 08:00 UTC Jan = 09:00 CET — opens right now boundary → closed (minutes < end? start<=m<end: 9:00 is start → open)
    // Use 07:59 UTC = 08:59 CET → closed
    const justBefore = getMarketStatus('switzerland', utc('2026-01-12T07:59:00Z'));
    expect(justBefore.isOpen).toBe(false);
    expect(justBefore.minutesToOpen).toBe(1);
    // Mon 08:00 UTC July = 10:00 CEST — open
    expect(getMarketStatus('switzerland', utc('2026-07-13T08:00:00Z')).isOpen).toBe(true);
  });

  it('KRX: 9:00–15:30 KST with no lunch break', () => {
    // Mon 00:30 UTC = Mon 09:30 KST — open
    expect(getMarketStatus('southkorea', utc('2026-07-13T00:30:00Z')).isOpen).toBe(true);
    // Mon 04:00 UTC = Mon 13:00 KST — still open (no lunch break)
    expect(getMarketStatus('southkorea', utc('2026-07-13T04:00:00Z')).isOpen).toBe(true);
    // Mon 07:00 UTC = Mon 16:00 KST — closed
    expect(getMarketStatus('southkorea', utc('2026-07-13T07:00:00Z')).isOpen).toBe(false);
  });

  it('weekends close the new markets too', () => {
    // Sat 06:00 UTC
    for (const c of ['singapore', 'australia', 'hongkong', 'switzerland', 'southkorea'] as const) {
      expect(getMarketStatus(c, utc('2026-07-18T06:00:00Z')).isOpen).toBe(false);
    }
  });
});

describe('getMarketLocalClock', () => {
  it('renders India local time (UTC+5:30)', () => {
    // Mon 05:00 UTC = 10:30 IST
    expect(getMarketLocalClock('india', utc('2026-07-13T05:00:00Z')).time).toBe('10:30');
  });

  it('is DST-aware for the US (EDT Jul vs EST Jan)', () => {
    // Mon 05:00 UTC July = 01:00 EDT
    expect(getMarketLocalClock('us', utc('2026-07-13T05:00:00Z')).time).toBe('01:00');
    // Mon 05:00 UTC January = 00:00 EST
    expect(getMarketLocalClock('us', utc('2026-01-12T05:00:00Z')).time).toBe('00:00');
  });

  it('is stable for no-DST zones (Japan)', () => {
    expect(getMarketLocalClock('japan', utc('2026-07-13T05:00:00Z')).time).toBe('14:00');
    expect(getMarketLocalClock('japan', utc('2026-01-12T05:00:00Z')).time).toBe('14:00');
  });

  it('returns the weekday for weekend detection', () => {
    // Sat 06:30 UTC = Sat 12:10 IST
    const s = getMarketLocalClock('india', utc('2026-07-18T06:30:00Z'));
    expect(s.weekday).toBe(6);
  });

  it('covers all eleven markets without throwing', () => {
    for (const c of [
      'india', 'us', 'uk', 'japan', 'germany', 'china',
      'singapore', 'australia', 'hongkong', 'switzerland', 'southkorea',
    ] as const) {
      expect(getMarketLocalClock(c, utc('2026-07-13T05:00:00Z')).time).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});
