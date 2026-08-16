/**
 * ============================================================================
 * Toroloom — Advisory Marketplace Route Unit Tests
 * ============================================================================
 *
 * Tests all endpoints of the advisors + consultations routes using raw
 * http.request (no supertest dependency).
 *
 * Endpoints:
 *   GET    /api/advisors                    — List approved advisors (filters/pagination)
 *   GET    /api/advisors/:id                — Advisor detail + slots
 *   GET    /api/advisors/:id/reviews        — Reviews list
 *   POST   /api/advisors/:id/reviews        — Submit review
 *   GET    /api/advisors/:id/slots          — Available slots
 *   GET    /api/advisors/admin              — Admin list
 *   POST   /api/advisors/admin/:id/approve  — Admin approve/reject/suspend
 *   POST   /api/consultations               — Book (slot lock)
 *   GET    /api/consultations               — My consultations
 *   POST   /api/consultations/:id/confirm   — Confirm
 *   POST   /api/consultations/:id/cancel    — Cancel + release slot
 *   POST   /api/consultations/:id/complete  — Complete
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/advisors.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: () => void) => {
    req.user = { userId: 'test_user', email: 'test@toroloom.com', role: 'admin' };
    next();
  },
  adminMiddleware: (_req: any, _res: any, next: () => void) => next(),
  optionalAuth: (_req: any, _res: any, next: () => void) => next(),
}));

import { advisorsRoutes, consultationsRoutes } from '../routes/advisors';
import { resetAdvisorsService } from '../services/advisors';

// ──── Helpers ───────────────────────────────────────────────────────────────

type ResResult = { status: number; body: any };

function request(
  server: http.Server,
  baseUrl: string,
  opts: { method: string; path: string; body?: any },
): Promise<ResResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: opts.method,
        headers: { 'Content-Type': 'application/json' },
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

// ============================================================================
// Tests
// ============================================================================

describe('Advisory Marketplace Routes', () => {
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
  // GET /api/advisors — list
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/advisors', () => {
    it('returns only approved advisors', async () => {
      const { status, body } = await request(server, baseUrl, { method: 'GET', path: '/api/advisors' });
      expect(status).toBe(200);
      expect(body.advisors.length).toBe(5); // 6 mock advisors, 1 pending
      expect(body.advisors.every((a: any) => a.status === 'approved')).toBe(true);
    });

    it('filters by search query', async () => {
      const { body } = await request(server, baseUrl, { method: 'GET', path: '/api/advisors?q=khanna' });
      expect(body.advisors.length).toBe(1);
      expect(body.advisors[0].name).toContain('Rajesh');
    });

    it('filters by type', async () => {
      const { body } = await request(server, baseUrl, { method: 'GET', path: '/api/advisors?type=RA' });
      expect(body.advisors.every((a: any) => a.type === 'RA')).toBe(true);
      expect(body.advisors.length).toBe(2);
    });

    it('filters by minRating', async () => {
      const { body } = await request(server, baseUrl, { method: 'GET', path: '/api/advisors?minRating=4.7' });
      expect(body.advisors.every((a: any) => a.rating >= 4.7)).toBe(true);
    });

    it('paginates results', async () => {
      const { body } = await request(server, baseUrl, { method: 'GET', path: '/api/advisors?page=2&limit=2' });
      expect(body.page).toBe(2);
      expect(body.totalPages).toBe(3);
      expect(body.advisors.length).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/advisors/:id — detail
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/advisors/:id', () => {
    it('returns advisor detail with available slots', async () => {
      const { status, body } = await request(server, baseUrl, { method: 'GET', path: '/api/advisors/advisor_1' });
      expect(status).toBe(200);
      expect(body.advisor.id).toBe('advisor_1');
      expect(body.advisor.sebiRegNo).toBe('INA000001234');
      expect(Array.isArray(body.advisor.availableSlots)).toBe(true);
      expect(body.advisor.availableSlots.length).toBeGreaterThan(0);
    });

    it('returns 404 for unknown advisor', async () => {
      const { status } = await request(server, baseUrl, { method: 'GET', path: '/api/advisors/nope' });
      expect(status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Reviews
  // ─────────────────────────────────────────────────────────────────────────

  describe('Reviews', () => {
    it('returns empty reviews list for an advisor with none', async () => {
      const { status, body } = await request(server, baseUrl, { method: 'GET', path: '/api/advisors/advisor_2/reviews' });
      expect(status).toBe(200);
      expect(body.reviews).toEqual([]);
    });

    it('rejects a review without a completed consultation', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/advisors/advisor_1/reviews',
        body: { rating: 5, comment: 'Great advisor!' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('completed consultation');
    });

    it('rejects rating out of range', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/advisors/advisor_1/reviews',
        body: { rating: 9, comment: 'Great!' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Rating');
    });

    it('allows a review after a completed consultation and updates rating', async () => {
      // Book → confirm → complete a consultation with advisor_1
      const bookRes = await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_1', slotId: 'advisor_1_slot_1_10_0' },
      });
      expect(bookRes.status).toBe(201);
      const consultId = bookRes.body.consultation.id;

      await request(server, baseUrl, { method: 'POST', path: `/api/consultations/${consultId}/confirm`, body: {} });
      await request(server, baseUrl, { method: 'POST', path: `/api/consultations/${consultId}/complete`, body: {} });

      const reviewRes = await request(server, baseUrl, {
        method: 'POST', path: '/api/advisors/advisor_1/reviews',
        body: { rating: 5, comment: 'Excellent session!' },
      });
      expect(reviewRes.status).toBe(201);
      expect(reviewRes.body.review.rating).toBe(5);

      // Rating aggregate updated
      const detail = await request(server, baseUrl, { method: 'GET', path: '/api/advisors/advisor_1' });
      expect(detail.body.advisor.reviewCount).toBeGreaterThan(0);

      // Duplicate review rejected
      const dup = await request(server, baseUrl, {
        method: 'POST', path: '/api/advisors/advisor_1/reviews',
        body: { rating: 4, comment: 'Again' },
      });
      expect(dup.status).toBe(400);
      expect(dup.body.error).toContain('already reviewed');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Booking + slot lock
  // ─────────────────────────────────────────────────────────────────────────

  describe('Consultations & slot locking', () => {
    it('books a consultation and locks the slot', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_1', slotId: 'advisor_1_slot_1_10_0' },
      });
      expect(status).toBe(201);
      expect(body.consultation.status).toBe('pending');
      expect(body.consultation.amount).toBe(1500);
      expect(body.consultation.advisorName).toBe('Dr. Rajesh Khanna');

      // Slot is now unavailable
      const slots = await request(server, baseUrl, { method: 'GET', path: '/api/advisors/advisor_1/slots' });
      expect(slots.body.slots.some((s: any) => s.id === 'advisor_1_slot_1_10_0')).toBe(false);
    });

    it('rejects double-booking of the same slot', async () => {
      await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_1', slotId: 'advisor_1_slot_1_10_0' },
      });
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_1', slotId: 'advisor_1_slot_1_10_0' },
      });
      expect(status).toBe(400);
      expect(body.error).toMatch(/already|booking/);
    });

    it('requires advisorId and slotId', async () => {
      const { status } = await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_1' },
      });
      expect(status).toBe(400);
    });

    it('lists my consultations', async () => {
      await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_2', slotId: 'advisor_2_slot_1_12_0' },
      });
      const { status, body } = await request(server, baseUrl, { method: 'GET', path: '/api/consultations' });
      expect(status).toBe(200);
      expect(body.consultations.length).toBe(1);
    });

    it('confirms a pending consultation', async () => {
      const book = await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_1', slotId: 'advisor_1_slot_1_10_0' },
      });
      const id = book.body.consultation.id;
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: `/api/consultations/${id}/confirm`, body: {},
      });
      expect(status).toBe(200);
      expect(body.consultation.status).toBe('confirmed');
    });

    it('cancels a consultation and releases the slot', async () => {
      const book = await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_1', slotId: 'advisor_1_slot_1_10_0' },
      });
      const id = book.body.consultation.id;

      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: `/api/consultations/${id}/cancel`, body: {},
      });
      expect(status).toBe(200);
      expect(body.consultation.status).toBe('cancelled');

      // Slot released — can book again
      const rebook = await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_1', slotId: 'advisor_1_slot_1_10_0' },
      });
      expect(rebook.status).toBe(201);
    });

    it('completes a confirmed consultation', async () => {
      const book = await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_1', slotId: 'advisor_1_slot_1_10_0' },
      });
      const id = book.body.consultation.id;
      await request(server, baseUrl, { method: 'POST', path: `/api/consultations/${id}/confirm`, body: {} });
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: `/api/consultations/${id}/complete`, body: {},
      });
      expect(status).toBe(200);
      expect(body.consultation.status).toBe('completed');
    });

    it('cannot complete a pending consultation', async () => {
      const book = await request(server, baseUrl, {
        method: 'POST', path: '/api/consultations',
        body: { advisorId: 'advisor_1', slotId: 'advisor_1_slot_1_10_0' },
      });
      const { status } = await request(server, baseUrl, {
        method: 'POST', path: `/api/consultations/${book.body.consultation.id}/complete`, body: {},
      });
      expect(status).toBe(400);
    });

    it('returns 404 for unknown consultation', async () => {
      const { status } = await request(server, baseUrl, { method: 'GET', path: '/api/consultations/nope' });
      expect(status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Admin
  // ─────────────────────────────────────────────────────────────────────────

  describe('Admin', () => {
    it('lists all advisors including pending', async () => {
      const { status, body } = await request(server, baseUrl, { method: 'GET', path: '/api/advisors/admin' });
      expect(status).toBe(200);
      expect(body.advisors.length).toBe(6);
      expect(body.advisors.some((a: any) => a.status === 'pending')).toBe(true);
    });

    it('approves a pending advisor', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/advisors/admin/advisor_6/approve',
        body: { status: 'approved' },
      });
      expect(status).toBe(200);
      expect(body.advisor.status).toBe('approved');
      expect(body.advisor.isVerified).toBe(true);
    });

    it('rejects invalid status', async () => {
      const { status } = await request(server, baseUrl, {
        method: 'POST', path: '/api/advisors/admin/advisor_6/approve',
        body: { status: 'banana' },
      });
      expect(status).toBe(400);
    });

    it('adds a new advisor via admin', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/advisors/admin',
        body: { name: 'Test Advisor', type: 'RA', sebiRegNo: 'INH000011111', consultationFee: 500 },
      });
      expect(status).toBe(201);
      expect(body.advisor.id).toBeTruthy();
      expect(body.advisor.status).toBe('pending');

      // Now visible in admin list
      const list = await request(server, baseUrl, { method: 'GET', path: '/api/advisors/admin' });
      expect(list.body.advisors.length).toBe(7);
    });
  });
});
