/**
 * ============================================================================
 * Toroloom — Bond Dashboard API
 * ============================================================================
 *
 * Provides bond market data for the Bond Dashboard screen.
 * Uses bondService with structured mock data (future API ready).
 *
 * Endpoints:
 *   GET /api/bonds               — All bonds
 *   GET /api/bonds/summary       — Market summary + yield curve
 *   GET /api/bonds/:id           — Single bond by ID
 *   GET /api/bonds/category/:cat — Filter by category
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { bondService, BondCategory } from '../services/bondService';

const router = Router();

/**
 * GET /api/bonds
 * Returns all bonds with yield data (FRED-adjusted or mock).
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { bonds, source } = await bondService.getAll();
    res.json({ success: true, count: bonds.length, bonds, source });
  } catch {
    const bonds = bondService.getFallbackBonds();
    res.json({ success: true, count: bonds.length, bonds, source: 'mock' });
  }
});

/**
 * GET /api/bonds/summary
 * Returns bond market summary statistics + yield curve data.
 * IMPORTANT: Must be defined BEFORE /:id to avoid Express route shadowing.
 */
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const data = await bondService.getSummary();
    res.json({ success: true, data });
  } catch {
    const bonds = bondService.getFallbackBonds();
    const govtBonds = bonds.filter(b => b.category === 'government');
    const corpBonds = bonds.filter(b => b.category === 'corporate');
    const stateBonds = bonds.filter(b => b.category === 'state');

    const avg = (arr: any[], key: string) =>
      arr.length > 0 ? arr.reduce((s, b) => s + (b[key] as number), 0) / arr.length : 0;

    const yieldCurve = [
      { label: '<1Y', bonds: bonds.filter(b => b.yearsToMaturity < 1) },
      { label: '1-3Y', bonds: bonds.filter(b => b.yearsToMaturity >= 1 && b.yearsToMaturity < 3) },
      { label: '3-5Y', bonds: bonds.filter(b => b.yearsToMaturity >= 3 && b.yearsToMaturity < 5) },
      { label: '5-10Y', bonds: bonds.filter(b => b.yearsToMaturity >= 5 && b.yearsToMaturity < 10) },
      { label: '10Y+', bonds: bonds.filter(b => b.yearsToMaturity >= 10) },
    ].map(bucket => ({
      label: bucket.label,
      count: bucket.bonds.length,
      avgYield: bucket.bonds.length > 0 ? +(bucket.bonds.reduce((s, b) => s + b.yieldToMaturity, 0) / bucket.bonds.length).toFixed(2) : 0,
      avgCoupon: bucket.bonds.length > 0 ? +(bucket.bonds.reduce((s, b) => s + b.couponRate, 0) / bucket.bonds.length).toFixed(2) : 0,
    }));

    res.json({
      success: true,
      data: {
        total: bonds.length,
        government: { count: govtBonds.length, avgYTM: +avg(govtBonds, 'yieldToMaturity').toFixed(2), avgCoupon: +avg(govtBonds, 'couponRate').toFixed(2) },
        corporate: { count: corpBonds.length, avgYTM: +avg(corpBonds, 'yieldToMaturity').toFixed(2), avgCoupon: +avg(corpBonds, 'couponRate').toFixed(2) },
        state: { count: stateBonds.length, avgYTM: +avg(stateBonds, 'yieldToMaturity').toFixed(2), avgCoupon: +avg(stateBonds, 'couponRate').toFixed(2) },
        yieldCurve,
        updatedAt: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/bonds/:id
 * Returns a single bond by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  const bondId = req.params.id as string;
  try {
    const bond = await bondService.getById(bondId);
    if (!bond) {
      res.status(404).json({ success: false, error: `Bond '${bondId}' not found` });
      return;
    }
    res.json({ success: true, bond });
  } catch {
    const bonds = bondService.getFallbackBonds();
    const bond = bonds.find(b => b.id === bondId);
    if (!bond) {
      res.status(404).json({ success: false, error: `Bond '${bondId}' not found` });
      return;
    }
    res.json({ success: true, bond, source: 'mock' });
  }
});

/**
 * GET /api/bonds/category/:cat
 * Filter bonds by category (government, state, corporate).
 */
router.get('/category/:cat', async (req: Request, res: Response) => {
  try {
    const validCats: BondCategory[] = ['government', 'state', 'corporate', 'municipal'];
    const cat = req.params.cat as BondCategory;
    if (!validCats.includes(cat)) {
      res.status(400).json({ success: false, error: `Invalid category. Valid: ${validCats.join(', ')}` });
      return;
    }
    const { bonds } = await bondService.getAll();
    const filtered = bonds.filter(b => b.category === cat);
    res.json({ success: true, category: cat, count: filtered.length, bonds: filtered });
  } catch {
    const bonds = bondService.getFallbackBonds().filter(b => b.category === req.params.cat);
    res.json({ success: true, category: req.params.cat, count: bonds.length, bonds, source: 'mock' });
  }
});

export default router;
