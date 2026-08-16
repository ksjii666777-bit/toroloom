/**
 * ============================================================================
 * Toroloom Advisory Marketplace Routes
 * ============================================================================
 *
 * Endpoints:
 *   GET    /api/advisors                  — List approved advisors (search/filter/pagination)
 *   GET    /api/advisors/:id              — Advisor detail + next slots
 *   GET    /api/advisors/:id/reviews      — Reviews list (public)
 *   POST   /api/advisors/:id/reviews      — Submit review (auth, after completed consultation)
 *   GET    /api/advisors/:id/slots        — Available slots (public)
 *   GET    /api/advisors/admin            — All advisors incl. pending (admin)
 *   POST   /api/advisors/admin            — Admin add/edit advisor
 *   POST   /api/advisors/admin/:id/approve — Approve / reject / suspend (admin)
 *
 *   POST   /api/consultations             — Book consultation (slot lock) — auth
 *   GET    /api/consultations             — My consultations — auth
 *   GET    /api/consultations/:id         — Consultation detail — auth
 *   POST   /api/consultations/:id/confirm — Confirm after payment verify — auth
 *   POST   /api/consultations/:id/cancel  — Cancel + release slot — auth
 *   POST   /api/consultations/:id/complete — Mark complete — auth
 *
 * Auth: public reads open; writes require authMiddleware; admin requires
 * adminMiddleware (applied per-route, matching the coupons.ts convention).
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware, optionalAuth } from '../middleware/auth';
import {
  getAdvisors,
  getAdvisor,
  getAdvisorReviews,
  submitReview,
  getAvailableSlots,
  bookConsultation,
  getMyConsultations,
  getConsultation,
  confirmConsultation,
  cancelConsultation,
  completeConsultation,
  getAllAdvisors,
  setAdvisorStatus,
  upsertAdvisor,
} from '../services/advisors';

// ============================================================================
// /api/advisors router
// ============================================================================

export const advisorsRoutes = Router();

// ── Admin routes must come BEFORE /:id so 'admin' is not captured as :id ──
advisorsRoutes.get('/admin', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  const advisors = await getAllAdvisors();
  res.json({ advisors });
});

advisorsRoutes.post('/admin', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const advisor = await upsertAdvisor(req.body);
    res.status(201).json({ advisor });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

advisorsRoutes.post('/admin/:id/approve', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const advisor = await setAdvisorStatus(req.params.id as string, status);
  if (!advisor) {
    res.status(404).json({ error: 'Advisor not found' });
    return;
  }
  res.json({ advisor });
});

// ── Public reads (optionalAuth for future personalisation) ──────────────
advisorsRoutes.get('/', optionalAuth, async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const type = (req.query.type as string) || undefined;
  const specialty = (req.query.specialty as string) || undefined;
  const minRating = req.query.minRating ? parseFloat(req.query.minRating as string) : undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const data = await getAdvisors(query, { type, specialty, minRating }, page, limit);
  res.json(data);
});

advisorsRoutes.get('/:id', async (req: Request, res: Response) => {
  const advisor = await getAdvisor(req.params.id as string);
  if (!advisor) {
    res.status(404).json({ error: 'Advisor not found' });
    return;
  }
  const slots = await getAvailableSlots(advisor.id);
  res.json({ advisor: { ...advisor, availableSlots: slots } });
});

advisorsRoutes.get('/:id/reviews', async (req: Request, res: Response) => {
  const reviews = await getAdvisorReviews(req.params.id as string);
  res.json({ reviews });
});

advisorsRoutes.post('/:id/reviews', authMiddleware, async (req: Request, res: Response) => {
  const { rating, comment } = req.body;
  if (rating == null) {
    res.status(400).json({ error: 'rating is required' });
    return;
  }
  try {
    const review = await submitReview(req.user!.userId, req.user!.email, req.params.id as string, Number(rating), String(comment || ''));
    res.status(201).json({ review });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

advisorsRoutes.get('/:id/slots', async (req: Request, res: Response) => {
  const slots = await getAvailableSlots(req.params.id as string);
  res.json({ slots });
});

// ============================================================================
// /api/consultations router
// ============================================================================

export const consultationsRoutes = Router();
consultationsRoutes.use(authMiddleware);

consultationsRoutes.post('/', async (req: Request, res: Response) => {
  const { advisorId, slotId, notes } = req.body;
  if (!advisorId || !slotId) {
    res.status(400).json({ error: 'advisorId and slotId are required' });
    return;
  }
  try {
    const consultation = await bookConsultation(req.user!.userId, advisorId, slotId, notes);
    res.status(201).json({ consultation });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

consultationsRoutes.get('/', async (req: Request, res: Response) => {
  const consultations = await getMyConsultations(req.user!.userId);
  res.json({ consultations });
});

consultationsRoutes.get('/:id', async (req: Request, res: Response) => {
  const consultation = await getConsultation(req.user!.userId, req.params.id as string);
  if (!consultation) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  res.json({ consultation });
});

consultationsRoutes.post('/:id/confirm', async (req: Request, res: Response) => {
  const consultation = await confirmConsultation(req.user!.userId, req.params.id as string);
  if (!consultation) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }
  res.json({ consultation });
});

consultationsRoutes.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const consultation = await cancelConsultation(req.user!.userId, req.params.id as string);
    if (!consultation) {
      res.status(404).json({ error: 'Consultation not found' });
      return;
    }
    res.json({ consultation });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

consultationsRoutes.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const consultation = await completeConsultation(req.user!.userId, req.params.id as string);
    if (!consultation) {
      res.status(404).json({ error: 'Consultation not found' });
      return;
    }
    res.json({ consultation });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
