/**
 * ============================================================================
 * Toroloom Coupon Routes — Discount Code Management
 * ============================================================================
 *
 *   GET    /api/coupons              — List all coupons (admin)
 *   POST   /api/coupons              — Create a new coupon (admin)
 *   GET    /api/coupons/:code        — Get a single coupon
 *   PUT    /api/coupons/:code        — Update a coupon (admin)
 *   DELETE /api/coupons/:code        — Delete a coupon (admin)
 *   POST   /api/coupons/validate     — Validate & apply a coupon for current user
 *   POST   /api/coupons/seed         — Seed default coupons (admin, dev only)
 *
 * Storage:
 *   Coupons are persisted via the StorageEngine coupons table.
 *   Usage tracking prevents the same user from reusing a coupon.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { getStorage, getStorageIfInitialized } from '../services/storage';
import type { CouponData, CouponUsageData } from '../services/storage/types';

const router = Router();

// ──── In-memory store (fallback when Postgres not available) ──────────────

let _couponStore: {
  loadCoupon(code: string): Promise<CouponData | null>;
  saveCoupon(coupon: CouponData): Promise<void>;
  deleteCoupon(code: string): Promise<void>;
  loadAllCoupons(): Promise<CouponData[]>;
  incrementCouponUsage(code: string): Promise<void>;
  recordCouponUsage(usage: CouponUsageData): Promise<void>;
  hasUserUsedCoupon(code: string, userId: string): Promise<boolean>;
  loadUserCouponUsages(userId: string): Promise<CouponUsageData[]>;
  loadAllCouponUsages(): Promise<CouponUsageData[]>;
} | null = null;

/**
 * In-memory fallback store when database is not available.
 */
class InMemoryCouponStore {
  private coupons = new Map<string, CouponData>();
  private usages: CouponUsageData[] = [];

  async loadCoupon(code: string): Promise<CouponData | null> {
    return this.coupons.get(code.toUpperCase()) || null;
  }

  async saveCoupon(coupon: CouponData): Promise<void> {
    this.coupons.set(coupon.code.toUpperCase(), coupon);
  }

  async deleteCoupon(code: string): Promise<void> {
    this.coupons.delete(code.toUpperCase());
    this.usages = this.usages.filter(u => u.code.toUpperCase() !== code.toUpperCase());
  }

  async loadAllCoupons(): Promise<CouponData[]> {
    return Array.from(this.coupons.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async incrementCouponUsage(code: string): Promise<void> {
    const coupon = this.coupons.get(code.toUpperCase());
    if (coupon) {
      coupon.currentUses++;
      coupon.updatedAt = new Date().toISOString();
    }
  }

  async recordCouponUsage(usage: CouponUsageData): Promise<void> {
    this.usages.push(usage);
  }

  async hasUserUsedCoupon(code: string, userId: string): Promise<boolean> {
    return this.usages.some(
      u => u.code.toUpperCase() === code.toUpperCase() && u.userId === userId
    );
  }

  async loadUserCouponUsages(userId: string): Promise<CouponUsageData[]> {
    return this.usages
      .filter(u => u.userId === userId)
      .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime());
  }

  async loadAllCouponUsages(): Promise<CouponUsageData[]> {
    return [...this.usages].sort(
      (a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()
    );
  }
}

const memoryStore = new InMemoryCouponStore();

// ──── Seed default coupons (dev only) ─────────────────────────────────────

const DEFAULT_COUPONS: CouponData[] = [
  {
    code: 'SAVE20',
    type: 'percentage',
    value: 20,
    minPlanTier: 'pro',
    maxUses: 1000,
    currentUses: 0,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    description: '20% off any Pro or Elite plan',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    code: 'ELITE100',
    type: 'fixed',
    value: 100,
    minPlanTier: 'elite',
    maxUses: 500,
    currentUses: 0,
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    description: '₹100 off Elite plan monthly billing',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    code: 'TRYPRO',
    type: 'free_trial',
    value: 0,
    trialDays: 7,
    minPlanTier: 'pro',
    maxUses: 50,
    currentUses: 0,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    description: '7-day free trial of Pro plan',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    code: 'WELCOME10',
    type: 'percentage',
    value: 10,
    maxUses: 5000,
    currentUses: 0,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    description: '10% off your first subscription',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ──── Helper: get the active coupon store ────────────────────────────────

function getStore() {
  if (_couponStore) return _couponStore;
  return memoryStore;
}

/**
 * Configure the coupon module with the storage engine.
 * Called during server initialization.
 */
export function configureCouponPersistence(storage: {
  loadCoupon(code: string): Promise<CouponData | null>;
  saveCoupon(coupon: CouponData): Promise<void>;
  deleteCoupon(code: string): Promise<void>;
  loadAllCoupons(): Promise<CouponData[]>;
  incrementCouponUsage(code: string): Promise<void>;
  recordCouponUsage(usage: CouponUsageData): Promise<void>;
  hasUserUsedCoupon(code: string, userId: string): Promise<boolean>;
  loadUserCouponUsages(userId: string): Promise<CouponUsageData[]>;
  loadAllCouponUsages(): Promise<CouponUsageData[]>;
}): void {
  _couponStore = storage;
}

// ──── Tier ranking for validation ────────────────────────────────────────

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, elite: 2 };

// ──── POST /api/coupons/validate ─────────────────────────────────────────

router.post('/validate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { code, planTier, price } = req.body;

    if (!code) {
      res.status(400).json({ code: '', valid: false, message: 'Coupon code is required.' });
      return;
    }

    const store = getStore();
    const coupon = await store.loadCoupon(code.toUpperCase());

    if (!coupon) {
      res.json({
        code: code.toUpperCase(),
        valid: false,
        type: 'percentage' as const,
        discountAmount: 0,
        originalPrice: price || 0,
        finalPrice: price || 0,
        message: 'Invalid or expired coupon code.',
      });
      return;
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      res.json({
        code: coupon.code,
        valid: false,
        type: coupon.type,
        discountAmount: 0,
        originalPrice: price || 0,
        finalPrice: price || 0,
        message: 'This coupon is no longer active.',
      });
      return;
    }

    // Check expiry
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      res.json({
        code: coupon.code,
        valid: false,
        type: coupon.type,
        discountAmount: 0,
        originalPrice: price || 0,
        finalPrice: price || 0,
        message: 'This coupon has expired.',
      });
      return;
    }

    // Check max uses
    if (coupon.maxUses > 0 && coupon.currentUses >= coupon.maxUses) {
      res.json({
        code: coupon.code,
        valid: false,
        type: coupon.type,
        discountAmount: 0,
        originalPrice: price || 0,
        finalPrice: price || 0,
        message: 'This coupon has reached its usage limit.',
      });
      return;
    }

    // Check min plan tier
    if (coupon.minPlanTier && planTier) {
      if (TIER_RANK[planTier] < TIER_RANK[coupon.minPlanTier]) {
        res.json({
          code: coupon.code,
          valid: false,
          type: coupon.type,
          discountAmount: 0,
          originalPrice: price || 0,
          finalPrice: price || 0,
          message: `This coupon requires at least the ${coupon.minPlanTier} plan.`,
        });
        return;
      }
    }

    // Check if user already used this coupon
    const alreadyUsed = await store.hasUserUsedCoupon(coupon.code, userId);
    if (alreadyUsed) {
      res.json({
        code: coupon.code,
        valid: false,
        type: coupon.type,
        discountAmount: 0,
        originalPrice: price || 0,
        finalPrice: price || 0,
        message: 'You have already used this coupon.',
      });
      return;
    }

    // Calculate discount
    let discountAmount = 0;
    const originalPrice = price || 0;
    if (coupon.type === 'percentage') {
      discountAmount = Math.round(originalPrice * (coupon.value / 100));
    } else if (coupon.type === 'fixed') {
      discountAmount = Math.min(coupon.value, originalPrice);
    }

    const finalPrice = Math.max(0, originalPrice - discountAmount);

    res.json({
      code: coupon.code,
      valid: true,
      type: coupon.type,
      discountAmount,
      originalPrice,
      finalPrice,
      trialDays: coupon.trialDays,
      message: coupon.type === 'free_trial'
        ? `${coupon.trialDays}-day free trial applied!`
        : `Coupon applied! You save ₹${discountAmount.toLocaleString('en-IN')}`,
    });
  } catch (error: unknown) {
    console.error('[Coupons] /validate error:', error);
    res.status(500).json({
      code: '',
      valid: false,
      message: 'Failed to validate coupon. Please try again.',
    });
  }
});

// ──── POST /api/coupons/apply ───────────────────────────────────────────
// Apply a coupon and record usage (called after successful payment)

router.post('/apply', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { code, planId, discountAmount, originalPrice, finalPrice } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Coupon code is required.' });
      return;
    }

    const store = getStore();
    const coupon = await store.loadCoupon(code.toUpperCase());

    if (!coupon) {
      res.status(404).json({ error: 'Coupon not found.' });
      return;
    }

    // Record usage
    await store.incrementCouponUsage(coupon.code);
    await store.recordCouponUsage({
      id: `cu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      code: coupon.code,
      userId,
      planId: planId || '',
      discountAmount: discountAmount || 0,
      originalPrice: originalPrice || 0,
      finalPrice: finalPrice || 0,
      usedAt: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Coupon applied successfully.' });
  } catch (error: unknown) {
    console.error('[Coupons] /apply error:', error);
    res.status(500).json({ error: 'Failed to apply coupon.' });
  }
});

// ──── GET /api/coupons/usage ─────────────────────────────────────────────
// Get coupon usage history for the current user
// IMPORTANT: Must be defined BEFORE /:code to avoid Express matching "usage" as :code

router.get('/usage', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const store = getStore();
    const usages = await store.loadUserCouponUsages(userId);
    res.json({ usages });
  } catch (error: unknown) {
    console.error('[Coupons] GET /usage error:', error);
    res.status(500).json({ error: 'Failed to load coupon usage history.' });
  }
});

// ──── GET /api/coupons/usage/all ────────────────────────────────────────
// Get ALL coupon usages across all users (admin only)
// IMPORTANT: Must be defined BEFORE /:code to avoid Express matching "usage" as :code

router.get('/usage/all', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const store = getStore();
    const usages = await store.loadAllCouponUsages();

    // Compute summary stats
    const totalUsages = usages.length;
    const totalDiscountAmount = usages.reduce((sum, u) => sum + u.discountAmount, 0);
    const totalOriginalPrice = usages.reduce((sum, u) => sum + u.originalPrice, 0);
    const uniqueUsers = new Set(usages.map(u => u.userId)).size;
    const uniqueCoupons = new Set(usages.map(u => u.code)).size;

    // Per-coupon breakdown
    const couponBreakdown: Record<string, { count: number; totalDiscount: number; uniqueUsers: number }> = {};
    const seenUsersPerCode: Record<string, Set<string>> = {};
    for (const u of usages) {
      if (!couponBreakdown[u.code]) {
        couponBreakdown[u.code] = { count: 0, totalDiscount: 0, uniqueUsers: 0 };
        seenUsersPerCode[u.code] = new Set();
      }
      couponBreakdown[u.code].count++;
      couponBreakdown[u.code].totalDiscount += u.discountAmount;
      seenUsersPerCode[u.code].add(u.userId);
    }
    for (const code of Object.keys(couponBreakdown)) {
      couponBreakdown[code].uniqueUsers = seenUsersPerCode[code].size;
    }

    res.json({
      usages,
      summary: {
        totalUsages,
        totalDiscountAmount,
        totalOriginalPrice,
        uniqueUsers,
        uniqueCoupons,
        couponBreakdown,
      },
    });
  } catch (error: unknown) {
    console.error('[Coupons] GET /usage/all error:', error);
    res.status(500).json({ error: 'Failed to load coupon usage data.' });
  }
});

// ──── GET /api/coupons ──────────────────────────────────────────────────
// List all coupons (admin only)

router.get('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const store = getStore();
    const coupons = await store.loadAllCoupons();
    res.json({ coupons });
  } catch (error: unknown) {
    console.error('[Coupons] GET / error:', error);
    res.status(500).json({ error: 'Failed to load coupons.' });
  }
});

// ──── POST /api/coupons ─────────────────────────────────────────────────
// Create a new coupon (admin only)

router.post('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, type, value, trialDays, minPlanTier, maxUses, expiresAt, description } = req.body;

    if (!code || !type || value === undefined || !description) {
      res.status(400).json({ error: 'Missing required fields: code, type, value, description' });
      return;
    }

    if (!['percentage', 'fixed', 'free_trial'].includes(type)) {
      res.status(400).json({ error: 'Invalid type. Must be: percentage, fixed, or free_trial' });
      return;
    }

    const store = getStore();
    const existing = await store.loadCoupon(code.toUpperCase());
    if (existing) {
      res.status(409).json({ error: `Coupon ${code.toUpperCase()} already exists.` });
      return;
    }

    const now = new Date().toISOString();
    const coupon: CouponData = {
      code: code.toUpperCase(),
      type,
      value,
      trialDays: trialDays || undefined,
      minPlanTier: minPlanTier || undefined,
      maxUses: maxUses || 0,
      currentUses: 0,
      expiresAt: expiresAt || null,
      isActive: true,
      description,
      createdBy: 'admin',
      createdAt: now,
      updatedAt: now,
    };

    await store.saveCoupon(coupon);
    res.status(201).json({ success: true, coupon });
  } catch (error: unknown) {
    console.error('[Coupons] POST / error:', error);
    res.status(500).json({ error: 'Failed to create coupon.' });
  }
});

// ──── GET /api/coupons/:code ────────────────────────────────────────────

router.get('/:code', authMiddleware, async (req: Request, res: Response) => {
  try {
    const store = getStore();
    const code = req.params.code as string;
    const coupon = await store.loadCoupon(code.toUpperCase());

    if (!coupon) {
      res.status(404).json({ error: 'Coupon not found.' });
      return;
    }

    res.json({ coupon });
  } catch (error: unknown) {
    console.error('[Coupons] GET /:code error:', error);
    res.status(500).json({ error: 'Failed to load coupon.' });
  }
});

// ──── PUT /api/coupons/:code ────────────────────────────────────────────
// Update a coupon (admin only)

router.put('/:code', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const store = getStore();
    const code = req.params.code as string;
    const existing = await store.loadCoupon(code.toUpperCase());

    if (!existing) {
      res.status(404).json({ error: 'Coupon not found.' });
      return;
    }

    const { type, value, trialDays, minPlanTier, maxUses, expiresAt, isActive, description } = req.body;

    const updated: CouponData = {
      ...existing,
      type: type || existing.type,
      value: value !== undefined ? value : existing.value,
      trialDays: trialDays !== undefined ? trialDays : existing.trialDays,
      minPlanTier: minPlanTier !== undefined ? minPlanTier : existing.minPlanTier,
      maxUses: maxUses !== undefined ? maxUses : existing.maxUses,
      expiresAt: expiresAt !== undefined ? expiresAt : existing.expiresAt,
      isActive: isActive !== undefined ? isActive : existing.isActive,
      description: description || existing.description,
      updatedAt: new Date().toISOString(),
    };

    await store.saveCoupon(updated);
    res.json({ success: true, coupon: updated });
  } catch (error: unknown) {
    console.error('[Coupons] PUT /:code error:', error);
    res.status(500).json({ error: 'Failed to update coupon.' });
  }
});

// ──── DELETE /api/coupons/:code ─────────────────────────────────────────
// Delete a coupon (admin only)

router.delete('/:code', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const store = getStore();
    const code = req.params.code as string;
    const existing = await store.loadCoupon(code.toUpperCase());

    if (!existing) {
      res.status(404).json({ error: 'Coupon not found.' });
      return;
    }

    await store.deleteCoupon(code.toUpperCase());
    res.json({ success: true });
  } catch (error: unknown) {
    console.error('[Coupons] DELETE /:code error:', error);
    res.status(500).json({ error: 'Failed to delete coupon.' });
  }
});

// ──── POST /api/coupons/seed ────────────────────────────────────────────
// Seed default coupons (admin only)

router.post('/seed', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const store = getStore();
    let seededCount = 0;

    for (const coupon of DEFAULT_COUPONS) {
      const existing = await store.loadCoupon(coupon.code);
      if (!existing) {
        await store.saveCoupon({
          ...coupon,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        seededCount++;
      }
    }

    res.json({ success: true, seeded: seededCount });
  } catch (error: unknown) {
    console.error('[Coupons] /seed error:', error);
    res.status(500).json({ error: 'Failed to seed coupons.' });
  }
});

export default router;
