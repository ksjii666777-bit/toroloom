/**
 * ============================================================================
 * Toroloom — Coupon Routes Integration Tests
 * ============================================================================
 *
 * Tests all endpoints in backend/src/routes/coupons.ts:
 *
 *   POST   /api/coupons/validate       — Validate a coupon for the current user
 *   POST   /api/coupons/apply          — Apply a coupon (record usage)
 *   GET    /api/coupons/usage          — Get coupon usage history for current user
 *   GET    /api/coupons                — List all coupons (admin)
 *   POST   /api/coupons                — Create a new coupon (admin)
 *   GET    /api/coupons/:code          — Get a single coupon by code
 *   PUT    /api/coupons/:code          — Update a coupon (admin)
 *   DELETE /api/coupons/:code          — Delete a coupon (admin)
 *   POST   /api/coupons/seed           — Seed default coupons (admin, dev only)
 *
 * ============================================================================
 */

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-for-coupon-tests';
  process.env.NODE_ENV = 'test';
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { generateToken } from '../middleware/auth';

// ──── Route imports ─────────────────────────────────────────────────────────

import couponRoutes, { configureCouponPersistence } from '../routes/coupons';

// ──── Constants ─────────────────────────────────────────────────────────────

const TEST_USER_ID = 'test_user_coupon';
const TEST_ADMIN_ID = 'test_admin_coupon';
const TEST_USER_TOKEN = generateToken({ userId: TEST_USER_ID, email: 'user@coupon.com' });
const TEST_ADMIN_TOKEN = generateToken({ userId: TEST_ADMIN_ID, email: 'admin@coupon.com', role: 'admin' });
const ALTERNATE_USER_ID = 'alternate_user_coupon';
const ALTERNATE_USER_TOKEN = generateToken({ userId: ALTERNATE_USER_ID, email: 'alt@coupon.com' });

// ──── Helpers ───────────────────────────────────────────────────────────────

type ReqOptions = {
  method?: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
};

function request(opts: ReqOptions): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: opts.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...opts.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          let body: any;
          try {
            body = data ? JSON.parse(data) : undefined;
          } catch {
            body = data;
          }
          resolve({ status: res.statusCode!, body });
        });
      },
    );
    req.on('error', reject);

    if (opts.body) {
      req.write(JSON.stringify(opts.body));
    }
    req.end();
  });
}

function get(path: string, headers?: Record<string, string>) {
  return request({ method: 'GET', path, headers });
}

function post(path: string, body?: any, headers?: Record<string, string>) {
  return request({ method: 'POST', path, body, headers });
}

function put(path: string, body?: any, headers?: Record<string, string>) {
  return request({ method: 'PUT', path, body, headers });
}

function del(path: string, headers?: Record<string, string>) {
  return request({ method: 'DELETE', path, headers });
}

function userHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${TEST_USER_TOKEN}` };
}

function adminHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` };
}

function altUserHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${ALTERNATE_USER_TOKEN}` };
}

/** Helper: create a test coupon via the admin route */
async function createCoupon(overrides: Record<string, any> = {}): Promise<{ code: string }> {
  const res = await post('/api/coupons', {
    code: overrides.code || `TEST_${Date.now()}`,
    type: overrides.type || 'percentage',
    value: overrides.value ?? 20,
    description: overrides.description || 'Test coupon',
    ...overrides,
  }, adminHeaders());
  return res.body.coupon || {};
}

/** Helper: seed the default coupons */
async function seedCoupons(): Promise<number> {
  const res = await post('/api/coupons/seed', {}, adminHeaders());
  return res.body.seeded ?? 0;
}

/** Helper: validate and then apply a coupon */
async function validateAndApply(code: string, planTier = 'pro', price = 399, headers = userHeaders()): Promise<void> {
  await post('/api/coupons/validate', { code, planTier, price }, headers);
  await post('/api/coupons/apply', { code, planId: `${planTier}_monthly`, discountAmount: 80, originalPrice: price, finalPrice: price - 80 }, headers);
}

// ──── Server ────────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/coupons', couponRoutes);

  // Do NOT call configureCouponPersistence — the router uses the in-memory
  // fallback (InMemoryCouponStore) by default, which is what we want for tests.

  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as any).port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

// ============================================================================
// POST /api/coupons/seed — Seed default coupons (admin only)
// ============================================================================

describe('POST /api/coupons/seed (admin)', () => {
  it('returns 401 without auth token', async () => {
    const { status } = await post('/api/coupons/seed');
    expect(status).toBe(401);
  });

  it('returns 403 for regular user', async () => {
    const { status, body } = await post('/api/coupons/seed', {}, userHeaders());
    expect(status).toBe(403);
    expect(body.error).toContain('Admin access');
  });

  it('seeds 4 default coupons (SAVE20, ELITE100, TRYPRO, WELCOME10)', async () => {
    const { status, body } = await post('/api/coupons/seed', {}, adminHeaders());
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.seeded).toBe(4);
  });

  it('returns 0 seeded on second call (all already exist)', async () => {
    await post('/api/coupons/seed', {}, adminHeaders());
    const { status, body } = await post('/api/coupons/seed', {}, adminHeaders());
    expect(status).toBe(200);
    expect(body.seeded).toBe(0);
  });
});

// ============================================================================
// POST /api/coupons — Create coupon (admin only)
// ============================================================================

describe('POST /api/coupons (admin create)', () => {
  it('returns 401 without auth token', async () => {
    const { status } = await post('/api/coupons', { code: 'NEW10', type: 'percentage', value: 10, description: 'New coupon' });
    expect(status).toBe(401);
  });

  it('returns 403 for regular user', async () => {
    const { status, body } = await post('/api/coupons', { code: 'NEW10', type: 'percentage', value: 10, description: 'New coupon' }, userHeaders());
    expect(status).toBe(403);
    expect(body.error).toContain('Admin access');
  });

  it('returns 400 when required fields are missing', async () => {
    const { status, body } = await post('/api/coupons', { code: 'NEW10' }, adminHeaders());
    expect(status).toBe(400);
    expect(body.error).toContain('Missing required fields');
  });

  it('returns 400 for invalid coupon type', async () => {
    const { status, body } = await post('/api/coupons', {
      code: 'INVALID', type: 'invalid_type', value: 10, description: 'Bad type',
    }, adminHeaders());
    expect(status).toBe(400);
    expect(body.error).toContain('Invalid type');
  });

  it('creates a percentage coupon successfully', async () => {
    const { status, body } = await post('/api/coupons', {
      code: 'NEW15',
      type: 'percentage',
      value: 15,
      description: '15% off any plan',
      minPlanTier: 'pro',
      maxUses: 200,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }, adminHeaders());

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.coupon.code).toBe('NEW15');
    expect(body.coupon.type).toBe('percentage');
    expect(body.coupon.value).toBe(15);
    expect(body.coupon.description).toBe('15% off any plan');
    expect(body.coupon.minPlanTier).toBe('pro');
    expect(body.coupon.maxUses).toBe(200);
    expect(body.coupon.currentUses).toBe(0);
    expect(body.coupon.isActive).toBe(true);
    expect(body.coupon.createdBy).toBe('admin');
    expect(body.coupon.createdAt).toBeDefined();
    expect(body.coupon.updatedAt).toBeDefined();
  });

  it('creates a fixed discount coupon successfully', async () => {
    const { status, body } = await post('/api/coupons', {
      code: 'FIXED50',
      type: 'fixed',
      value: 50,
      description: '₹50 off any plan',
    }, adminHeaders());

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.coupon.code).toBe('FIXED50');
    expect(body.coupon.type).toBe('fixed');
    expect(body.coupon.value).toBe(50);
  });

  it('creates a free trial coupon successfully', async () => {
    const { status, body } = await post('/api/coupons', {
      code: 'TRIAL14',
      type: 'free_trial',
      value: 0,
      trialDays: 14,
      description: '14-day free trial',
    }, adminHeaders());

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.coupon.type).toBe('free_trial');
    expect(body.coupon.trialDays).toBe(14);
  });

  it('returns 409 when coupon code already exists', async () => {
    const { status, body } = await post('/api/coupons', {
      code: 'NEW15',
      type: 'percentage',
      value: 20,
      description: 'Duplicate',
    }, adminHeaders());

    expect(status).toBe(409);
    expect(body.error).toContain('already exists');
  });

  it('normalizes coupon code to uppercase', async () => {
    const { status, body } = await post('/api/coupons', {
      code: 'lowercase',
      type: 'percentage',
      value: 5,
      description: 'Lowercase code',
    }, adminHeaders());

    expect(status).toBe(201);
    expect(body.coupon.code).toBe('LOWERCASE');
  });
});

// ============================================================================
// POST /api/coupons/validate — Validate a coupon for the current user
// ============================================================================

describe('POST /api/coupons/validate', () => {
  it('returns 401 without auth token', async () => {
    const { status } = await post('/api/coupons/validate', { code: 'SAVE20', planTier: 'pro', price: 399 });
    expect(status).toBe(401);
  });

  it('returns 400 when coupon code is missing', async () => {
    const { status, body } = await post('/api/coupons/validate', {}, userHeaders());
    expect(status).toBe(400);
    expect(body.message).toContain('Coupon code is required');
  });

  it('returns invalid for non-existent coupon', async () => {
    const { status, body } = await post('/api/coupons/validate', {
      code: 'NONEXISTENT',
      planTier: 'pro',
      price: 399,
    }, userHeaders());

    expect(status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.message).toContain('Invalid or expired coupon');
  });

  it('validates SAVE20 (percentage) — 20% off Pro at ₹399', async () => {
    const { status, body } = await post('/api/coupons/validate', {
      code: 'SAVE20',
      planTier: 'pro',
      price: 399,
    }, userHeaders());

    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.code).toBe('SAVE20');
    expect(body.type).toBe('percentage');
    expect(body.discountAmount).toBe(80); // 20% of 399
    expect(body.originalPrice).toBe(399);
    expect(body.finalPrice).toBe(319);
    expect(body.message).toContain('You save');
  });

  it('validates ELITE100 (fixed) — ₹100 off Elite at ₹999', async () => {
    const { status, body } = await post('/api/coupons/validate', {
      code: 'ELITE100',
      planTier: 'elite',
      price: 999,
    }, userHeaders());

    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.code).toBe('ELITE100');
    expect(body.type).toBe('fixed');
    expect(body.discountAmount).toBe(100);
    expect(body.finalPrice).toBe(899);
  });

  it('validates TRYPRO (free_trial) — 7-day trial', async () => {
    const { status, body } = await post('/api/coupons/validate', {
      code: 'TRYPRO',
      planTier: 'pro',
      price: 399,
    }, userHeaders());

    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.code).toBe('TRYPRO');
    expect(body.type).toBe('free_trial');
    expect(body.trialDays).toBe(7);
    expect(body.message).toContain('free trial');
  });

  it('validates WELCOME10 — 10% off at ₹599', async () => {
    const { status, body } = await post('/api/coupons/validate', {
      code: 'WELCOME10',
      planTier: 'free',
      price: 599,
    }, userHeaders());

    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.code).toBe('WELCOME10');
    expect(body.type).toBe('percentage');
    expect(body.discountAmount).toBe(60); // 10% of 599
    expect(body.finalPrice).toBe(539);
  });

  it('handles case-insensitive coupon codes', async () => {
    const { body } = await post('/api/coupons/validate', {
      code: 'save20',
      planTier: 'pro',
      price: 399,
    }, userHeaders());

    expect(body.valid).toBe(true);
    expect(body.code).toBe('SAVE20');
  });

  it('returns invalid when coupon is not active', async () => {
    // Create a coupon, then disable via PUT
    const code = `DISABLED_${Date.now()}`;
    await post('/api/coupons', {
      code, type: 'percentage', value: 10, description: 'Will be disabled',
    }, adminHeaders());

    // Disable the coupon
    await put(`/api/coupons/${code}`, { isActive: false }, adminHeaders());

    // Now validate — should fail
    const { body } = await post('/api/coupons/validate', {
      code, planTier: 'pro', price: 399,
    }, userHeaders());

    expect(body.valid).toBe(false);
    expect(body.message).toContain('no longer active');
  });

  it('returns invalid when coupon has expired', async () => {
    const code = `EXPIRED_${Date.now()}`;
    await post('/api/coupons', {
      code, type: 'percentage', value: 10, description: 'Expired',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      isActive: true,
    }, adminHeaders());

    const { body } = await post('/api/coupons/validate', {
      code, planTier: 'pro', price: 399,
    }, userHeaders());

    expect(body.valid).toBe(false);
    expect(body.message).toContain('expired');
  });

  it('returns invalid when coupon has reached max uses', async () => {
    const code = `MAXED_${Date.now()}`;
    // Create with maxUses=1
    await post('/api/coupons', {
      code, type: 'percentage', value: 5, description: 'Maxed out',
      maxUses: 1, isActive: true,
    }, adminHeaders());

    // Use it once (alt user)
    await validateAndApply(code, 'pro', 399, altUserHeaders());

    // Try again (current user) — should fail
    const { body } = await post('/api/coupons/validate', {
      code, planTier: 'pro', price: 399,
    }, userHeaders());

    expect(body.valid).toBe(false);
    expect(body.message).toContain('usage limit');
  });

  it('returns invalid for insufficient plan tier', async () => {
    const { body } = await post('/api/coupons/validate', {
      code: 'ELITE100',   // minPlanTier: 'elite'
      planTier: 'free',
      price: 399,
    }, userHeaders());

    expect(body.valid).toBe(false);
    expect(body.message).toContain('requires at least the elite plan');
  });

  it('returns invalid when user already used this coupon', async () => {
    const code = `ONETIME_${Date.now()}`;
    await post('/api/coupons', {
      code, type: 'fixed', value: 50, description: 'One-time',
      maxUses: 100, isActive: true,
    }, adminHeaders());

    // First use
    await validateAndApply(code, 'pro', 399, userHeaders());

    // Second use — should detect already used
    const { body } = await post('/api/coupons/validate', {
      code, planTier: 'pro', price: 399,
    }, userHeaders());

    expect(body.valid).toBe(false);
    expect(body.message).toContain('already used this coupon');
  });

  it('does not validate fixed discount above original price', async () => {
    const { body } = await post('/api/coupons/validate', {
      code: 'ELITE100',
      planTier: 'elite',
      price: 50,  // Less than ₹100 discount
    }, userHeaders());

    expect(body.valid).toBe(true);
    expect(body.discountAmount).toBe(50); // Capped at originalPrice
    expect(body.finalPrice).toBe(0);
  });
});

// ============================================================================
// POST /api/coupons/apply — Apply a coupon (record usage)
// ============================================================================

describe('POST /api/coupons/apply', () => {
  it('returns 401 without auth token', async () => {
    const { status } = await post('/api/coupons/apply', { code: 'SAVE20' });
    expect(status).toBe(401);
  });

  it('returns 400 when code is missing', async () => {
    const { status, body } = await post('/api/coupons/apply', {}, userHeaders());
    expect(status).toBe(400);
    expect(body.error).toContain('Coupon code is required');
  });

  it('returns 404 for non-existent coupon code', async () => {
    const { status, body } = await post('/api/coupons/apply', {
      code: 'MISSING',
    }, userHeaders());

    expect(status).toBe(404);
    expect(body.error).toContain('Coupon not found');
  });

  it('applies SAVE20 and records usage', async () => {
    const { status, body } = await post('/api/coupons/apply', {
      code: 'SAVE20',
      planId: 'pro_monthly',
      discountAmount: 80,
      originalPrice: 399,
      finalPrice: 319,
    }, altUserHeaders());

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('applied successfully');

    // Verify usage is recorded — user should not be able to reuse
    const validateRes = await post('/api/coupons/validate', {
      code: 'SAVE20', planTier: 'pro', price: 399,
    }, altUserHeaders());
    expect(validateRes.body.valid).toBe(false);
    expect(validateRes.body.message).toContain('already used');
  });

  it('handles case-insensitive coupon codes in apply', async () => {
    const code = `CASEAPPLY_${Date.now()}`;
    await post('/api/coupons', {
      code, type: 'percentage', value: 10, description: 'Case test',
      maxUses: 100, isActive: true,
    }, adminHeaders());

    // Apply with lowercase
    const { status } = await post('/api/coupons/apply', {
      code: code.toLowerCase(),
      planId: 'pro_monthly',
      discountAmount: 40,
    }, userHeaders());

    expect(status).toBe(200);
  });
});

// ============================================================================
// GET /api/coupons/usage — Get coupon usage history for current user
// ============================================================================

describe('GET /api/coupons/usage', () => {
  it('returns 401 without auth token', async () => {
    const { status } = await get('/api/coupons/usage');
    expect(status).toBe(401);
  });

  it('returns empty usage history for a new user', async () => {
    const newToken = generateToken({ userId: 'fresh_user', email: 'fresh@test.com' });
    const { status, body } = await get('/api/coupons/usage', {
      Authorization: `Bearer ${newToken}`,
    });

    expect(status).toBe(200);
    expect(body.usages).toBeDefined();
    expect(Array.isArray(body.usages)).toBe(true);
    expect(body.usages).toHaveLength(0);
  });

  it('returns usage history after applying a coupon', async () => {
    // altUserHeaders already used SAVE20 in the previous test
    const { body } = await get('/api/coupons/usage', altUserHeaders());

    expect(body.usages).toBeDefined();
    expect(body.usages.length).toBeGreaterThanOrEqual(1);

    const usage = body.usages[0];
    expect(usage.code).toBe('SAVE20');
    expect(usage.userId).toBe(ALTERNATE_USER_ID);
    expect(usage.planId).toBe('pro_monthly');
    expect(usage.discountAmount).toBe(80);
    expect(usage.originalPrice).toBe(399);
    expect(usage.finalPrice).toBe(319);
    expect(usage.usedAt).toBeDefined();
    expect(usage.id).toBeDefined();
  });

  it('returns multiple usages in reverse chronological order', async () => {
    // Create and apply multiple coupons for alt user
    const codes = ['MULTI1', 'MULTI2', 'MULTI3'];
    for (const c of codes) {
      await post('/api/coupons', {
        code: c, type: 'percentage', value: 10, description: `Multi ${c}`,
        maxUses: 100, isActive: true,
      }, adminHeaders());
      await post('/api/coupons/apply', {
        code: c, planId: 'pro_monthly', discountAmount: 40,
      }, altUserHeaders());
    }

    const { body } = await get('/api/coupons/usage', altUserHeaders());

    // Should have at least 4 entries (SAVE20 + MULTI1 + MULTI2 + MULTI3)
    expect(body.usages.length).toBeGreaterThanOrEqual(4);

    // Check reverse chronological order
    for (let i = 1; i < body.usages.length; i++) {
      expect(new Date(body.usages[i - 1].usedAt).getTime())
        .toBeGreaterThanOrEqual(new Date(body.usages[i].usedAt).getTime());
    }
  });
});

// ============================================================================
// GET /api/coupons — List all coupons (admin only)
// ============================================================================

describe('GET /api/coupons (admin list)', () => {
  it('returns 401 without auth token', async () => {
    const { status } = await get('/api/coupons');
    expect(status).toBe(401);
  });

  it('returns 403 for regular user', async () => {
    const { status, body } = await get('/api/coupons', userHeaders());
    expect(status).toBe(403);
    expect(body.error).toContain('Admin access');
  });

  it('returns all seeded and created coupons for admin', async () => {
    const { status, body } = await get('/api/coupons', adminHeaders());

    expect(status).toBe(200);
    expect(body.coupons).toBeDefined();
    expect(Array.isArray(body.coupons)).toBe(true);
    expect(body.coupons.length).toBeGreaterThanOrEqual(4);

    // Verify SAVE20 is in the list
    const save20 = body.coupons.find((c: any) => c.code === 'SAVE20');
    expect(save20).toBeDefined();
    expect(save20.type).toBe('percentage');
    expect(save20.value).toBe(20);

    // Verify ELITE100
    const elite100 = body.coupons.find((c: any) => c.code === 'ELITE100');
    expect(elite100).toBeDefined();
    expect(elite100.type).toBe('fixed');
    expect(elite100.value).toBe(100);
  });

  it('returns coupons sorted by createdAt descending (newest first)', async () => {
    const { body } = await get('/api/coupons', adminHeaders());

    for (let i = 1; i < body.coupons.length; i++) {
      expect(new Date(body.coupons[i - 1].createdAt).getTime())
        .toBeGreaterThanOrEqual(new Date(body.coupons[i].createdAt).getTime());
    }
  });
});

// ============================================================================
// GET /api/coupons/:code — Get a single coupon
// ============================================================================

describe('GET /api/coupons/:code', () => {
  it('returns 401 without auth token', async () => {
    const { status } = await get('/api/coupons/SAVE20');
    expect(status).toBe(401);
  });

  it('returns SAVE20 coupon details', async () => {
    const { status, body } = await get('/api/coupons/SAVE20', userHeaders());

    expect(status).toBe(200);
    expect(body.coupon).toBeDefined();
    expect(body.coupon.code).toBe('SAVE20');
    expect(body.coupon.type).toBe('percentage');
    expect(body.coupon.value).toBe(20);
    expect(body.coupon.description).toBeDefined();
    expect(body.coupon.isActive).toBe(true);
    expect(body.coupon.expiresAt).toBeDefined();
  });

  it('returns 404 for non-existent coupon', async () => {
    const { status, body } = await get('/api/coupons/DOESNOTEXIST', userHeaders());

    expect(status).toBe(404);
    expect(body.error).toContain('Coupon not found');
  });

  it('handles case-insensitive lookup', async () => {
    const { body } = await get('/api/coupons/save20', userHeaders());
    expect(body.coupon.code).toBe('SAVE20');
  });
});

// ============================================================================
// PUT /api/coupons/:code — Update a coupon (admin only)
// ============================================================================

describe('PUT /api/coupons/:code (admin update)', () => {
  it('returns 401 without auth token', async () => {
    const { status } = await put('/api/coupons/NEW15', { description: 'Updated' });
    expect(status).toBe(401);
  });

  it('returns 403 for regular user', async () => {
    const { status, body } = await put('/api/coupons/NEW15', { description: 'Updated' }, userHeaders());
    expect(status).toBe(403);
    expect(body.error).toContain('Admin access');
  });

  it('returns 404 for non-existent coupon', async () => {
    const { status, body } = await put('/api/coupons/DOESNOTEXIST', { description: 'Updated' }, adminHeaders());

    expect(status).toBe(404);
    expect(body.error).toContain('Coupon not found');
  });

  it('updates coupon description', async () => {
    const { status, body } = await put('/api/coupons/NEW15', {
      description: 'Updated description',
    }, adminHeaders());

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.coupon.description).toBe('Updated description');
    expect(body.coupon.updatedAt).not.toBe(body.coupon.createdAt);
  });

  it('updates coupon type, value, maxUses, and isActive', async () => {
    const { body } = await put('/api/coupons/NEW15', {
      type: 'fixed',
      value: 100,
      maxUses: 50,
      isActive: false,
    }, adminHeaders());

    expect(body.coupon.type).toBe('fixed');
    expect(body.coupon.value).toBe(100);
    expect(body.coupon.maxUses).toBe(50);
    expect(body.coupon.isActive).toBe(false);

    // Restore for other tests
    await put('/api/coupons/NEW15', {
      type: 'percentage',
      value: 15,
      maxUses: 200,
      isActive: true,
    }, adminHeaders());
  });

  it('updates only the provided fields (partial update)', async () => {
    const { body } = await put('/api/coupons/FIXED50', {
      description: 'Just description changed',
    }, adminHeaders());

    expect(body.coupon.description).toBe('Just description changed');
    expect(body.coupon.type).toBe('fixed');  // Unchanged
    expect(body.coupon.value).toBe(50);      // Unchanged
  });
});

// ============================================================================
// DELETE /api/coupons/:code — Delete a coupon (admin only)
// ============================================================================

describe('DELETE /api/coupons/:code (admin delete)', () => {
  it('returns 401 without auth token', async () => {
    const { status } = await del('/api/coupons/FIXED50');
    expect(status).toBe(401);
  });

  it('returns 403 for regular user', async () => {
    const { status, body } = await del('/api/coupons/FIXED50', userHeaders());
    expect(status).toBe(403);
    expect(body.error).toContain('Admin access');
  });

  it('returns 404 for non-existent coupon', async () => {
    const { status, body } = await del('/api/coupons/DOESNOTEXIST', adminHeaders());

    expect(status).toBe(404);
    expect(body.error).toContain('Coupon not found');
  });

  it('deletes a coupon successfully', async () => {
    const { status, body } = await del('/api/coupons/FIXED50', adminHeaders());

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    // Verify it's gone
    const getRes = await get('/api/coupons/FIXED50', userHeaders());
    expect(getRes.status).toBe(404);
  });

  it('deletes a coupon created earlier (NEW15)', async () => {
    const { status } = await del('/api/coupons/NEW15', adminHeaders());
    expect(status).toBe(200);

    // Also delete the lower case one (TRIAL14, LOWER, etc.)
    await del('/api/coupons/TRIAL14', adminHeaders());
    await del('/api/coupons/LOWERCASE', adminHeaders());
  });
});

// ============================================================================
// Security & edge case tests
// ============================================================================

describe('Security & edge cases', () => {
  it('returns 401 for expired/invalid JWT tokens', async () => {
    const { status, body } = await get('/api/coupons', {
      Authorization: 'Bearer invalid.jwt.token',
    });
    expect(status).toBe(401);
    expect(body.error).toContain('Invalid or expired');
  });

  it('returns 401 for malformed Authorization header', async () => {
    const { status, body } = await get('/api/coupons', {
      Authorization: 'Basic dXNlcjpwYXNz', // Basic auth, not Bearer
    });
    expect(status).toBe(401);
    expect(body.error).toContain('Missing or invalid');
  });

  it('handles empty request bodies gracefully', async () => {
    const { status } = await post('/api/coupons/validate', null, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TEST_USER_TOKEN}`,
    });
    // Should be 400 (code is required) — not 500
    expect(status).toBe(400);
  });

  it('handles JSON parse errors gracefully', async () => {
    const { status } = await request({
      method: 'POST',
      path: '/api/coupons/validate',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_USER_TOKEN}`,
      },
      body: '{malformed json}', // This will fail at JSON.stringify
    });
    // Express's JSON parser returns 400 for invalid JSON
    expect(status).toBe(400);
  });
});
