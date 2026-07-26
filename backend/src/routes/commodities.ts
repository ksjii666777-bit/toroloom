/**
 * ============================================================================
 * Toroloom — Commodity Markets API
 * ============================================================================
 *
 * Provides commodity price data for the Commodity Markets screen.
 * Uses commodityService which fetches from API Ninjas (when configured)
 * with mock data fallback.
 *
 * Endpoints:
 *   GET /api/commodities          — All commodities
 *   GET /api/commodities/:id      — Single commodity by ID
 *   GET /api/commodities/category/:cat — Filter by category
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { commodityService } from '../services/commodityService';

const router = Router();

/**
 * GET /api/commodities
 * Returns all commodities with prices — live from API Ninjas, fallback to mock.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { commodities, source } = await commodityService.getAll();
    res.json({ success: true, count: commodities.length, commodities, source });
  } catch {
    const commodities = commodityService.getFallbackData();
    res.json({ success: true, count: commodities.length, commodities, source: 'mock' });
  }
});

/**
 * GET /api/commodities/:id
 * Returns a single commodity by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const paramId = req.params.id as string;
    const { commodity, source } = await commodityService.getById(paramId);
    if (!commodity) {
      res.status(404).json({ success: false, error: `Commodity '${req.params.id}' not found` });
      return;
    }
    res.json({ success: true, commodity, source });
  } catch {
    const paramId = req.params.id as string;
    const commodities = commodityService.getFallbackData();
    const commodity = commodities.find(c => c.id === paramId.toLowerCase());
    if (!commodity) {
      res.status(404).json({ success: false, error: `Commodity '${req.params.id}' not found` });
      return;
    }
    res.json({ success: true, commodity, source: 'mock' });
  }
});

/**
 * GET /api/commodities/category/:cat
 * Filter commodities by category (metals, energy, agriculture).
 */
router.get('/category/:cat', async (req: Request, res: Response) => {
  try {
    const catParam = req.params.cat as string;
    const validCats = ['metals', 'energy', 'agriculture'];
    if (!validCats.includes(catParam)) {
      res.status(400).json({ success: false, error: `Invalid category '${catParam}'. Valid: ${validCats.join(', ')}` });
      return;
    }
    const { commodities, source } = await commodityService.getByCategory(catParam);
    res.json({ success: true, category: catParam, count: commodities.length, commodities, source });
  } catch {
    const catParam = req.params.cat as string;
    const commodities = commodityService.getFallbackData().filter(c => c.category === catParam);
    res.json({ success: true, category: catParam, count: commodities.length, commodities, source: 'mock' });
  }
});

export default router;
