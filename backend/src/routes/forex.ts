/**
 * ============================================================================
 * Toroloom — Forex / Currency Markets API
 * ============================================================================
 *
 * Provides live and mock forex rate data for the Currency Markets screen.
 * Uses the forexService which fetches from Frankfurter API (free, no key).
 *
 * Endpoints:
 *   GET /api/forex              — All forex rates (USD/INR, EUR/INR, etc.)
 *   GET /api/forex/rates        — All forex rates (alias)
 *   GET /api/forex/rates/:pair  — Single currency pair rate
 *   GET /api/forex/summary      — Market summary statistics
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { forexService } from '../services/forexService';

const router = Router();

/**
 * GET /api/forex
 * Returns all forex currency pairs — live from Frankfurter, fallback to mock.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { pairs, source } = await forexService.getAllRates();
    res.json({ success: true, count: pairs.length, pairs, source });
  } catch {
    const pairs = forexService.getFallbackPairs();
    res.json({ success: true, count: pairs.length, pairs, source: 'mock' });
  }
});

/**
 * GET /api/forex/rates
 * Alias for GET /
 */
router.get('/rates', async (_req: Request, res: Response) => {
  try {
    const { pairs, source } = await forexService.getAllRates();
    res.json({ success: true, count: pairs.length, pairs, source });
  } catch {
    const pairs = forexService.getFallbackPairs();
    res.json({ success: true, count: pairs.length, pairs, source: 'mock' });
  }
});

/**
 * GET /api/forex/rates/:pair
 * Returns a single currency pair by ID or pair code.
 */
router.get('/rates/:pair', async (req: Request, res: Response) => {
  try {
    const paramId = req.params.pair as string;
    const { pair, source } = await forexService.getPair(paramId);
    if (!pair) {
      res.status(404).json({ success: false, error: `Currency pair '${req.params.pair}' not found` });
      return;
    }
    res.json({ success: true, pair, source });
  } catch {
    const paramId = req.params.pair as string;
    const pairId = paramId.toLowerCase().replace('/', '');
    const pairs = forexService.getMockPairs();
    const pair = pairs.find(p => p.id === pairId || p.pair.toLowerCase().replace('/', '') === pairId);
    if (!pair) {
      res.status(404).json({ success: false, error: `Currency pair '${req.params.pair}' not found` });
      return;
    }
    res.json({ success: true, pair, source: 'mock' });
  }
});

/**
 * GET /api/forex/summary
 * Returns forex market summary statistics.
 */
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const { pairs } = await forexService.getAllRates();
    const inrPairs = pairs.filter(p => p.quoteCurrency === 'INR');
    const avgChg = inrPairs.length > 0 ? inrPairs.reduce((s, p) => s + p.changePercent, 0) / inrPairs.length : 0;
    const avgVol = inrPairs.length > 0 ? inrPairs.reduce((s, p) => s + p.volatility, 0) / inrPairs.length : 0;

    res.json({
      success: true,
      data: {
        total: pairs.length,
        inrPairs: inrPairs.length,
        rbiRef: pairs.filter(p => p.isRbiReference).length,
        avgInrChange: +(avgChg).toFixed(2),
        avgInrVol: +(avgVol).toFixed(1),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch {
    const pairs = forexService.getFallbackPairs();
    const inrPairs = pairs.filter(p => p.quoteCurrency === 'INR');
    const avgChg = inrPairs.length > 0 ? inrPairs.reduce((s, p) => s + p.changePercent, 0) / inrPairs.length : 0;
    const avgVol = inrPairs.length > 0 ? inrPairs.reduce((s, p) => s + p.volatility, 0) / inrPairs.length : 0;

    res.json({
      success: true,
      data: {
        total: pairs.length,
        inrPairs: inrPairs.length,
        rbiRef: pairs.filter(p => p.isRbiReference).length,
        avgInrChange: +(avgChg).toFixed(2),
        avgInrVol: +(avgVol).toFixed(1),
        updatedAt: new Date().toISOString(),
      },
    });
  }
});

export default router;
