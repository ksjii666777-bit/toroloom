/**
 * ============================================================================
 * Toroloom Subscription Gate — Unit Tests
 * ============================================================================
 *
 * Tests the requireSubscription() middleware factory and all guard paths:
 *
 *   1. Feature flag disabled → pass through
 *   2. No auth (no req.user) → 401
 *   3. Free-tier route → pass through (no storage needed)
 *   4. Pro route, free user → 402 Payment Required
 *   5. Pro route, pro user → pass through
 *   6. Pro route, elite user → pass through (higher tier)
 *   7. Elite route, pro user → 402
 *   8. Elite route, elite user → pass through
 *   9. Storage failure → fallback to free → 402
 *  10. Expired subscription → fallback to free → 402
 *  11. x-subscription-tier header set correctly
 *  12. configureSubscriptionGating / resetSubscriptionGating
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/subscriptionGate.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { UserSubscriptionData } from '../services/storage/types';

// ──── Mock env BEFORE importing the module under test ──────────────────────

vi.mock('../config/env', () => ({
  env: {
    subscriptionGatingEnabled: true,
    get isDev() { return true; },
    get isMock() { return true; },
  },
}));

// ──── Module under test ────────────────────────────────────────────────────

import { env } from '../config/env';
import {
  requireSubscription,
  configureSubscriptionGating,
  resetSubscriptionGating,
} from '../middleware/subscriptionGate';
import type { SubscriptionTier } from '../middleware/subscriptionGate';

// ──── Storage mock ─────────────────────────────────────────────────────────

function createMockStorage(sub?: UserSubscriptionData | null) {
  return {
    loadSubscription: vi.fn<[string], Promise<UserSubscriptionData | null>>().mockResolvedValue(sub ?? null),
  };
}

// ──── Express mocks ────────────────────────────────────────────────────────

function createMocks(user?: { userId: string; email: string }) {
  const headers: Record<string, string> = {};
  const req = {
    user: user ?? undefined,
    headers,
  } as unknown as Request;

  const statusCode: { value?: number } = {};
  const res = {
    status: vi.fn((code: number) => {
      statusCode.value = code;
      return res;
    }),
    json: vi.fn(),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next, statusCode };
}

// ──── Mock subscription data ───────────────────────────────────────────────

function freeSubscription(userId: string): UserSubscriptionData {
  return {
    userId,
    tier: 'free',
    planId: 'plan_free',
    status: 'active',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
    autoRenew: false,
    updatedAt: new Date().toISOString(),
  };
}

function proSubscription(userId: string): UserSubscriptionData {
  return {
    userId,
    tier: 'pro',
    planId: 'plan_pro',
    status: 'active',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    autoRenew: true,
    paymentMethod: 'razorpay',
    updatedAt: new Date().toISOString(),
  };
}

function eliteSubscription(userId: string): UserSubscriptionData {
  return {
    userId,
    tier: 'elite',
    planId: 'plan_elite',
    status: 'active',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
    autoRenew: true,
    paymentMethod: 'razorpay',
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Subscription Gate — requireSubscription()', () => {
  const userId = 'test-user-001';
  const userEmail = 'test@toroloom.app';

  beforeEach(() => {
    vi.clearAllMocks();
    env.subscriptionGatingEnabled = true; // Reset to default for each test
  });

  afterEach(() => {
    resetSubscriptionGating();
    env.subscriptionGatingEnabled = true; // Ensure env is restored even on failure
  });

  // ──────────────── 1. Feature Flag Disabled ────────────────

  it('should pass through when subscriptionGatingEnabled is false', async () => {
    env.subscriptionGatingEnabled = false;

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('elite');

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  // ──────────────── 2. No Auth ────────────────

  it('should return 401 when user is not authenticated', async () => {
    const { req, res, next } = createMocks(); // No user
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication required for subscription gating',
      code: 'AUTH_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // ──────────────── 3. Free Tier Route ────────────────

  it('should pass through for free-tier routes without loading storage', async () => {
    const storage = createMockStorage();
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('free');

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(storage.loadSubscription).not.toHaveBeenCalled(); // Free tier skips storage
  });

  // ──────────────── 4. Pro Route, Free User ────────────────

  it('should return 402 when free user accesses a pro route', async () => {
    const storage = createMockStorage(freeSubscription(userId));
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This feature requires a pro subscription. Please upgrade to access it.',
      code: 'SUBSCRIPTION_REQUIRED',
      requiredTier: 'pro',
      currentTier: 'free',
      upgradeUrl: '/api/subscriptions/upgrade',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // ──────────────── 5. Pro Route, Pro User ────────────────

  it('should pass through when pro user accesses a pro route', async () => {
    const storage = createMockStorage(proSubscription(userId));
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  // ──────────────── 6. Pro Route, Elite User ────────────────

  it('should pass through when elite user accesses a pro route (higher tier allowed)', async () => {
    const storage = createMockStorage(eliteSubscription(userId));
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  // ──────────────── 7. Elite Route, Pro User ────────────────

  it('should return 402 when pro user accesses an elite route', async () => {
    const storage = createMockStorage(proSubscription(userId));
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('elite');

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This feature requires a elite subscription. Please upgrade to access it.',
      code: 'SUBSCRIPTION_REQUIRED',
      requiredTier: 'elite',
      currentTier: 'pro',
      upgradeUrl: '/api/subscriptions/upgrade',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // ──────────────── 8. Elite Route, Elite User ────────────────

  it('should pass through when elite user accesses an elite route', async () => {
    const storage = createMockStorage(eliteSubscription(userId));
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('elite');

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  // ──────────────── 9. Storage Failure ────────────────

  it('should fall back to free tier when storage throws and return 402 for pro route', async () => {
    const storage = {
      loadSubscription: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    };
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    // Falls back to free → 402
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it('should fall back to free tier when storage is not configured (null store)', async () => {
    // Don't configure storage — _subscriptionStore is null
    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    // No storage → free tier → 402
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  // ──────────────── 10. Expired Subscription ────────────────

  it('should treat expired subscription as free and return 402 for pro route', async () => {
    const expiredSub: UserSubscriptionData = {
      ...proSubscription(userId),
      status: 'expired',
      endDate: new Date(Date.now() - 86400000).toISOString(),
    };
    const storage = createMockStorage(expiredSub);
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    // Expired → falls back to free → 402
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it('should treat cancelled subscription as free and return 402 for pro route', async () => {
    const cancelledSub: UserSubscriptionData = {
      ...proSubscription(userId),
      status: 'cancelled',
    };
    const storage = createMockStorage(cancelledSub);
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  // ──────────────── 11. x-subscription-tier Header ────────────────

  it('should set x-subscription-tier header to free for free users', async () => {
    const storage = createMockStorage(freeSubscription(userId));
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });

    // Use 'elite' min tier so the gate checks storage (free-tier routes skip header)
    const middleware = requireSubscription('elite');

    await middleware(req, res, next);

    // Also verify header was set before the 402 response
    expect(res.setHeader).toHaveBeenCalledWith('x-subscription-tier', 'free');
  });

  it('should set x-subscription-tier header to pro for pro users', async () => {
    const storage = createMockStorage(proSubscription(userId));
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('elite');

    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-subscription-tier', 'pro');
  });

  it('should set x-subscription-tier header to elite for elite users', async () => {
    const storage = createMockStorage(eliteSubscription(userId));
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('elite');

    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-subscription-tier', 'elite');
  });

  // ──────────────── 12. configureSubscriptionGating / resetSubscriptionGating ────

  it('should use storage configured via configureSubscriptionGating', async () => {
    const storage = createMockStorage(proSubscription(userId));
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    expect(storage.loadSubscription).toHaveBeenCalledWith(userId);
    expect(next).toHaveBeenCalledOnce(); // Pro user → pass
  });

  it('should clear storage after resetSubscriptionGating', async () => {
    const storage = createMockStorage(proSubscription(userId));
    configureSubscriptionGating(storage);
    resetSubscriptionGating(); // Clear storage

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    // No storage → free tier → 402
    expect(res.status).toHaveBeenCalledWith(402);
  });

  // ──────────────── 13. No subscription record in storage ────────────────

  it('should treat missing subscription record as free and return 402 for pro route', async () => {
    // Storage exists but returns null (no subscription record found)
    const storage = createMockStorage(null);
    configureSubscriptionGating(storage);

    const { req, res, next } = createMocks({ userId, email: userEmail });
    const middleware = requireSubscription('pro');

    await middleware(req, res, next);

    expect(storage.loadSubscription).toHaveBeenCalledWith(userId);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });
});
