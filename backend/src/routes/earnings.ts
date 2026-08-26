/**
 * ============================================================================
 * Earnings Route — AI-Powered Quarterly Earnings Summaries
 * ============================================================================
 *
 * Endpoints:
 *   GET /api/earnings              — All company earnings summaries
 *   GET /api/earnings/:symbol      — Single company earnings summary
 *   GET /api/earnings/upcoming     — Upcoming earnings calendar
 *
 * Data sources (tried in order):
 *   1. Screener.in (scraping)
 *   2. Trendlyne (scraping)
 *   3. Mock data (fallback)
 *
 * All responses are cached for 1 hour.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { earningsService } from '../services/earningsService';

const router = Router();

// ─── GET /api/earnings — All company earnings summaries ─────────────────

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, source } = await earningsService.getEarningsSummaries();
    res.json({
      success: true,
      source,
      count: data.length,
      data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch earnings data';
    console.error('[EarningsRoute] Error fetching all earnings:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ─── GET /api/earnings/upcoming — Upcoming earnings calendar ────────────

router.get('/upcoming', async (_req: Request, res: Response) => {
  try {
    const upcoming = await earningsService.getUpcomingEarnings();
    res.json({
      success: true,
      count: upcoming.length,
      data: upcoming,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch upcoming earnings';
    console.error('[EarningsRoute] Error fetching upcoming earnings:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ─── GET /api/earnings/:symbol — Single company earnings summary ────────

router.get('/:symbol', async (req: Request, res: Response) => {
  try {
    const rawSymbol = req.params.symbol;
    const symbol = (Array.isArray(rawSymbol) ? rawSymbol[0] : rawSymbol)?.toUpperCase().trim();
    if (!symbol) {
      res.status(400).json({ success: false, error: 'Symbol is required' });
      return;
    }

    // Validate symbol format (1-10 uppercase alphanumeric)
    if (!/^[A-Z0-9]{1,10}$/.test(symbol)) {
      res.status(400).json({ success: false, error: 'Invalid symbol format' });
      return;
    }

    const { data, source } = await earningsService.getEarningsSummary(symbol);

    if (!data) {
      res.status(404).json({
        success: false,
        error: `No earnings data found for ${symbol}`,
        symbol,
      });
      return;
    }

    res.json({
      success: true,
      source,
      data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch earnings data';
    console.error(`[EarningsRoute] Error fetching earnings for ${req.params.symbol}:`, message);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
