/**
 * ============================================================================
 * Toroloom — Economic Calendar Routes
 * ============================================================================
 *
 * Provides economic event data (RBI meetings, inflation, GDP, PMI, etc.)
 *
 * Data source chain (economicCalendarService):
 *   1. FMP live API when FMP_API_KEY is configured → source: 'fmp'
 *   2. Curated mock dataset otherwise → source: 'mock'
 *
 * Endpoints:
 *   GET /api/economic-calendar                 — All events (sorted by date)
 *   GET /api/economic-calendar/upcoming        — Events in the next N days (default 30)
 *   GET /api/economic-calendar/summary         — Category + importance stats
 *
 * Query params (all optional):
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD  — date range filter
 *   ?category=monetary|inflation|...— single category filter
 *   ?importance=high|medium|low     — importance filter
 *   ?country=IN|US|...              — country code filter
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { economicCalendarService } from '../services/economicCalendarService';
import { economicCalendarCategories } from '../data/economicCalendarData';
import type { EconomicEvent } from '../data/economicCalendarData';

const router = Router();

// ──── Helpers ──────────────────────────────────────────────────────────────

function sortByDate(events: EconomicEvent[]): EconomicEvent[] {
  return [...events].sort((a, b) => {
    const diff = a.date.localeCompare(b.date);
    return diff !== 0 ? diff : a.time.localeCompare(b.time);
  });
}

function applyFilters(events: EconomicEvent[], req: Request): EconomicEvent[] {
  const { from, to, category, importance, country } = req.query;
  let filtered = events;

  if (from) filtered = filtered.filter(e => e.date >= String(from));
  if (to) filtered = filtered.filter(e => e.date <= String(to));
  if (category) filtered = filtered.filter(e => e.category === category);
  if (importance) filtered = filtered.filter(e => e.importance === importance);
  if (country) filtered = filtered.filter(e => e.countryCode === String(country).toUpperCase());

  return filtered;
}

// ──── GET /api/economic-calendar — All events ────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { events, source, fetchedAt } = await economicCalendarService.getAll();
    const filtered = applyFilters(events, req);
    res.json({
      success: true,
      count: filtered.length,
      events: sortByDate(filtered),
      categories: economicCalendarCategories,
      source,
      fetchedAt,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to load economic calendar' });
  }
});

// ──── GET /api/economic-calendar/upcoming — Next N days ──────────────────

router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days as string || '30', 10), 1), 90);
    const { events, source, fetchedAt } = await economicCalendarService.getUpcoming(days);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + days);

    const upcoming = events.filter(e => {
      const d = new Date(e.date);
      return d >= today && d <= horizon;
    });

    res.json({
      success: true,
      count: upcoming.length,
      days,
      events: sortByDate(upcoming),
      source,
      fetchedAt,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to load economic calendar' });
  }
});

// ──── GET /api/economic-calendar/summary — Stats ─────────────────────────

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { events, source, fetchedAt } = await economicCalendarService.getAll();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const byCategory: Record<string, number> = {};
    const byImportance: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    let upcomingCount = 0;
    let releasedCount = 0;

    for (const e of events) {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
      byImportance[e.importance] = (byImportance[e.importance] || 0) + 1;
      byCountry[e.countryCode] = (byCountry[e.countryCode] || 0) + 1;
      if (new Date(e.date) >= today) upcomingCount += 1;
      else releasedCount += 1;
    }

    res.json({
      success: true,
      total: events.length,
      upcoming: upcomingCount,
      released: releasedCount,
      byCategory,
      byImportance,
      byCountry,
      source,
      fetchedAt,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to load economic calendar' });
  }
});

export default router;
