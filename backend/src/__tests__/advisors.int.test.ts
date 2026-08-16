/**
 * ============================================================================
 * Toroloom — Advisory Marketplace Integration Tests
 * ============================================================================
 *
 * Route-level integration tests for advisors + consultations with REAL auth
 * middleware (JWT tokens) — unlike advisors.test.ts which mocks auth. Covers:
 *
 *   - Auth guards (401 without token, 403 non-admin on admin routes)
 *   - Admin approval workflow (pending → approved → visible publicly)
 *   - Full booking lifecycle: book → confirm → complete → review
 *   - Slot locking + double-booking prevention across users
 *   - Ownership isolation (user B cannot see/access user A's consultation)
 *   - Cancel + slot release + rebook
 *
 * The advisors service is in-memory (reset between tests), so this suite runs
 * without Docker — same as coupon.routes.int.test.ts.
 *
 * Run: npx vitest run src/__tests__/advisors.int.test.ts
 * ============================================================================
 */

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-for-advisors-int';
  process.env.NODE_ENV = 'test';
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import { generateToken } from '../middleware/auth';
import { advisorsRoutes, consultationsRoutes } from '../routes/advisors';
import { resetAdvisorsService } from '../services/advisors';

// ──── Tokens ────────────────────────────────────────────────────────────────

const USER_A_ID = 'int_user_a';
const USER_B_ID = 'int_user_b';
const ADMIN_ID = 'int_admin';

const USER_A_TOKEN = generateToken({ userId: USER_A_ID, email: 'a@test.com' });
const USER_B_TOKEN = generateToken({ userId: USER_B_ID, email: 'b@test.com' });
const ADMIN_TOKEN = generateToken({ userId: ADMIN_ID, email: 'admin@test.com', role: 'admin' });

// ──── Helpers ───────────────────────────────────────────────────────────────

type ResResult = { status: number; body: any };

function request(
  server: http.Server,
  baseUrl: string,
  opts: { method: string; path: string; body?: any; token?: string },
): Promise<ResResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: opts.method,
        headers: {
          'Content-Type': 'application/json',
          ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          let body: any;
          try { body = data ? JSON.parse(data) : undefined; }
          catch { body = data; }
          resolve({ status: res.statusCode!, body });
        });
      },
    );
    req.on('error', reject);
    if (opts.body !== undefined) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

const get = (server: http.Server, baseUrl: string, path: string, token?: string) =>
  request(server, baseUrl, { method: 'GET', path, token });
const post = (server: http.Server, baseUrl: string, path: string, body?: any, token?: string) =>
  request(server, baseUrl, { method: 'POST', path, body, token });

// Slot IDs come from the service mock data (slotFor naming: {advisor}_{dayOffset}_{hour}_{minute})
const SLOT_A1 = 'advisor_1_slot_1_10_0';

// ============================================================================
// Suite
// ============================================================================

describe('Advisory Marketplace — Integration (real auth)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/advisors', advisorsRoutes);
    app.use('/api/consultations', consultationsRoutes);

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

  beforeEach(() => {
    resetAdvisorsService();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Auth guards
  // ─────────────────────────────────────────────────────────────────────────

  describe('Auth guards', () => {
    it('returns 401 on consultations routes without a token', async () => {
      const res = await get(server, baseUrl, '/api/consultations');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Missing or invalid');
    });

    it('returns 401 on booking without a token', async () => {
      const res = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 });
      expect(res.status).toBe(401);
    });

    it('returns 401 on admin routes without a token', async () => {
      const res = await get(server, baseUrl, '/api/advisors/admin');
      expect(res.status).toBe(401);
    });

    it('returns 403 for a regular user on admin routes', async () => {
      const res = await get(server, baseUrl, '/api/advisors/admin', USER_A_TOKEN);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Admin access required');
    });

    it('returns 403 for a regular user on admin approve', async () => {
      const res = await post(server, baseUrl, '/api/advisors/admin/advisor_6/approve', { status: 'approved' }, USER_A_TOKEN);
      expect(res.status).toBe(403);
    });

    it('allows admin on admin routes', async () => {
      const res = await get(server, baseUrl, '/api/advisors/admin', ADMIN_TOKEN);
      expect(res.status).toBe(200);
      expect(res.body.advisors.length).toBe(6); // includes pending advisor_6
    });

    it('returns 401 on review submission without a token', async () => {
      const res = await post(server, baseUrl, '/api/advisors/advisor_1/reviews', { rating: 5, comment: 'Great' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for an invalid token', async () => {
      const res = await get(server, baseUrl, '/api/consultations', 'not.a.real.token');
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Admin approval workflow
  // ─────────────────────────────────────────────────────────────────────────

  describe('Admin approval workflow', () => {
    it('pending advisor is not in the public list, then appears after approval', async () => {
      // Pending advisor_6 must be hidden from the public list
      const before = await get(server, baseUrl, '/api/advisors');
      expect(before.body.advisors.length).toBe(5);
      expect(before.body.advisors.some((a: any) => a.id === 'advisor_6')).toBe(false);

      // Admin approves
      const approve = await post(server, baseUrl, '/api/advisors/admin/advisor_6/approve', { status: 'approved' }, ADMIN_TOKEN);
      expect(approve.status).toBe(200);
      expect(approve.body.advisor.status).toBe('approved');
      expect(approve.body.advisor.isVerified).toBe(true);

      // Now visible publicly
      const after = await get(server, baseUrl, '/api/advisors');
      expect(after.body.advisors.length).toBe(6);
      expect(after.body.advisors.some((a: any) => a.id === 'advisor_6')).toBe(true);
    });

    it('rejects an invalid status from admin', async () => {
      const res = await post(server, baseUrl, '/api/advisors/admin/advisor_6/approve', { status: 'banana' }, ADMIN_TOKEN);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status');
    });

    it('returns 404 when approving an unknown advisor', async () => {
      const res = await post(server, baseUrl, '/api/advisors/admin/nope/approve', { status: 'approved' }, ADMIN_TOKEN);
      expect(res.status).toBe(404);
    });

    it('admin can suspend an approved advisor', async () => {
      const res = await post(server, baseUrl, '/api/advisors/admin/advisor_1/approve', { status: 'suspended' }, ADMIN_TOKEN);
      expect(res.status).toBe(200);
      expect(res.body.advisor.status).toBe('suspended');

      // Suspended advisors disappear from the public list
      const list = await get(server, baseUrl, '/api/advisors');
      expect(list.body.advisors.some((a: any) => a.id === 'advisor_1')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Booking lifecycle (book → confirm → complete → review)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Booking lifecycle', () => {
    it('books a consultation and locks the slot', async () => {
      const res = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_A_TOKEN);
      expect(res.status).toBe(201);
      expect(res.body.consultation.userId).toBe(USER_A_ID);
      expect(res.body.consultation.status).toBe('pending');
      expect(res.body.consultation.amount).toBe(1500);

      // Slot no longer available
      const slots = await get(server, baseUrl, '/api/advisors/advisor_1/slots');
      expect(slots.body.slots.some((s: any) => s.id === SLOT_A1)).toBe(false);
    });

    it('passes notes through to the consultation', async () => {
      const res = await post(server, baseUrl, '/api/consultations', {
        advisorId: 'advisor_1', slotId: SLOT_A1, notes: 'Want to discuss retirement corpus',
      }, USER_A_TOKEN);
      expect(res.status).toBe(201);
      expect(res.body.consultation.notes).toBe('Want to discuss retirement corpus');
    });

    it('prevents double-booking of the same slot by another user', async () => {
      await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_A_TOKEN);

      const res = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_B_TOKEN);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already|booking/);
    });

    it('cannot book a slot of a non-approved advisor', async () => {
      const res = await post(server, baseUrl, '/api/consultations', {
        advisorId: 'advisor_6', slotId: 'advisor_6_slot_1_13_0',
      }, USER_A_TOKEN);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not available');
    });

    it('runs the full lifecycle: book → confirm → complete → review', async () => {
      // 1. Book
      const book = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_A_TOKEN);
      expect(book.status).toBe(201);
      const id = book.body.consultation.id;

      // 2. Confirm (payment verified)
      const confirm = await post(server, baseUrl, `/api/consultations/${id}/confirm`, {}, USER_A_TOKEN);
      expect(confirm.status).toBe(200);
      expect(confirm.body.consultation.status).toBe('confirmed');

      // 3. Complete
      const complete = await post(server, baseUrl, `/api/consultations/${id}/complete`, {}, USER_A_TOKEN);
      expect(complete.status).toBe(200);
      expect(complete.body.consultation.status).toBe('completed');

      // 4. Review (only allowed after a completed consultation)
      const review = await post(server, baseUrl, '/api/advisors/advisor_1/reviews', { rating: 5, comment: 'Excellent session!' }, USER_A_TOKEN);
      expect(review.status).toBe(201);
      expect(review.body.review.userId).toBe(USER_A_ID);
      expect(review.body.review.rating).toBe(5);

      // Advisor aggregate rating updated
      const detail = await get(server, baseUrl, '/api/advisors/advisor_1');
      expect(detail.body.advisor.reviewCount).toBeGreaterThan(0);

      // 5. Duplicate review rejected
      const dup = await post(server, baseUrl, '/api/advisors/advisor_1/reviews', { rating: 4, comment: 'Again' }, USER_A_TOKEN);
      expect(dup.status).toBe(400);
      expect(dup.body.error).toContain('already reviewed');
    });

    it('rejects a review without a completed consultation', async () => {
      const res = await post(server, baseUrl, '/api/advisors/advisor_1/reviews', { rating: 5, comment: 'Great' }, USER_B_TOKEN);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('completed consultation');
    });

    it('cannot complete a pending consultation', async () => {
      const book = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_A_TOKEN);
      const res = await post(server, baseUrl, `/api/consultations/${book.body.consultation.id}/complete`, {}, USER_A_TOKEN);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Only confirmed');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Ownership isolation
  // ─────────────────────────────────────────────────────────────────────────

  describe('Ownership isolation', () => {
    it('user B cannot see user A consultations in the list', async () => {
      await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_A_TOKEN);

      const mine = await get(server, baseUrl, '/api/consultations', USER_A_TOKEN);
      expect(mine.body.consultations.length).toBe(1);

      const theirs = await get(server, baseUrl, '/api/consultations', USER_B_TOKEN);
      expect(theirs.body.consultations).toEqual([]);
    });

    it('user B cannot access user A consultation by id', async () => {
      const book = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_A_TOKEN);

      const res = await get(server, baseUrl, `/api/consultations/${book.body.consultation.id}`, USER_B_TOKEN);
      expect(res.status).toBe(404);
    });

    it('user B cannot confirm/cancel user A consultation', async () => {
      const book = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_A_TOKEN);
      const id = book.body.consultation.id;

      const confirm = await post(server, baseUrl, `/api/consultations/${id}/confirm`, {}, USER_B_TOKEN);
      expect(confirm.status).toBe(404);

      const cancel = await post(server, baseUrl, `/api/consultations/${id}/cancel`, {}, USER_B_TOKEN);
      expect(cancel.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cancel + slot release
  // ─────────────────────────────────────────────────────────────────────────

  describe('Cancel & slot release', () => {
    it('cancels a pending consultation and releases the slot for rebooking', async () => {
      const book = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_A_TOKEN);
      const id = book.body.consultation.id;

      const cancel = await post(server, baseUrl, `/api/consultations/${id}/cancel`, {}, USER_A_TOKEN);
      expect(cancel.status).toBe(200);
      expect(cancel.body.consultation.status).toBe('cancelled');

      // Slot released — another user can book it now
      const rebook = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_B_TOKEN);
      expect(rebook.status).toBe(201);
      expect(rebook.body.consultation.userId).toBe(USER_B_ID);
    });

    it('cancels a confirmed consultation and releases the slot', async () => {
      const book = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_A_TOKEN);
      const id = book.body.consultation.id;
      await post(server, baseUrl, `/api/consultations/${id}/confirm`, {}, USER_A_TOKEN);

      const cancel = await post(server, baseUrl, `/api/consultations/${id}/cancel`, {}, USER_A_TOKEN);
      expect(cancel.status).toBe(200);
      expect(cancel.body.consultation.status).toBe('cancelled');

      const slots = await get(server, baseUrl, '/api/advisors/advisor_1/slots');
      expect(slots.body.slots.some((s: any) => s.id === SLOT_A1)).toBe(true);
    });

    it('cannot cancel a completed consultation', async () => {
      const book = await post(server, baseUrl, '/api/consultations', { advisorId: 'advisor_1', slotId: SLOT_A1 }, USER_A_TOKEN);
      const id = book.body.consultation.id;
      await post(server, baseUrl, `/api/consultations/${id}/confirm`, {}, USER_A_TOKEN);
      await post(server, baseUrl, `/api/consultations/${id}/complete`, {}, USER_A_TOKEN);

      const cancel = await post(server, baseUrl, `/api/consultations/${id}/cancel`, {}, USER_A_TOKEN);
      expect(cancel.status).toBe(400);
      expect(cancel.body.error).toContain('Only pending or confirmed');
    });
  });
});
