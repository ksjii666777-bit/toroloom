/**
 * ============================================================================
 * Toroloom Advisory Marketplace Service
 * ============================================================================
 *
 * Manages SEBI-registered advisors (RIA/RA), consultation slots, bookings,
 * and reviews. Follows the social service pattern: in-memory state with a
 * pluggable StorageEngine for future persistence.
 *
 * Booking safety:
 *   - Slots are locked atomically (booked=true) at booking time
 *   - A pending booking claim (userId → slotId) prevents double-booking
 *     while the payment is being processed
 *   - Stale pending claims are auto-released after 10 minutes (SLOT_LOCK_MS)
 *   - Payment failure → cancelConsultation() releases the slot
 *
 * ============================================================================
 */

import type { StorageEngine } from '../storage/types';

// ==================== Types ====================

export type AdvisorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type AdvisorType = 'RIA' | 'RA';

export interface AdvisorSlotData {
  id: string;
  advisorId: string;
  startTime: string;
  endTime: string;
  booked: boolean;
}

export interface AdvisorData {
  id: string;
  name: string;
  photoUrl?: string;
  type: AdvisorType;
  sebiRegNo: string;
  firmName?: string;
  bio: string;
  specialties: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
  consultationFee: number;
  availableSlots: AdvisorSlotData[];
  isVerified: boolean;
  status: AdvisorStatus;
  createdAt: string;
}

export type ConsultationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded';

export interface ConsultationData {
  id: string;
  advisorId: string;
  advisorName: string;
  advisorPhotoUrl?: string;
  advisorType: AdvisorType;
  userId: string;
  slotId: string;
  startTime: string;
  endTime: string;
  amount: number;
  status: ConsultationStatus;
  meetingLink?: string;
  notes?: string;
  createdAt: string;
}

export interface AdvisorReviewData {
  id: string;
  advisorId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// ==================== Internal State ====================

let _advisorsStorage: StorageEngine | null = null;

/** Pending booking claims: slotId → { userId, claimedAt } — prevents double-booking */
const pendingBookings = new Map<string, { userId: string; claimedAt: number }>();
/** 10-minute stale lock release window */
const SLOT_LOCK_MS = 10 * 60 * 1000;

const consultations: ConsultationData[] = [];
const reviews: AdvisorReviewData[] = [];
let consultationSeq = 1;

// ==================== Mock Data ====================

function slotFor(advisorId: string, dayOffset: number, hour: number, minute: number = 0): AdvisorSlotData {
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + 45 * 60 * 1000);
  return {
    id: `${advisorId}_slot_${dayOffset}_${hour}_${minute}`,
    advisorId,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    booked: false,
  };
}

const mockAdvisors: AdvisorData[] = [
  {
    id: 'advisor_1', name: 'Dr. Rajesh Khanna', photoUrl: 'https://i.pravatar.cc/150?img=12',
    type: 'RIA', sebiRegNo: 'INA000001234', firmName: 'Khanna Wealth Advisors',
    bio: 'Certified Financial Planner with 15+ years of experience in wealth management, retirement planning, and tax-efficient investing. Former wealth head at a leading private bank.',
    specialties: ['Wealth Management', 'Retirement Planning', 'Tax Planning'],
    experienceYears: 15, rating: 4.8, reviewCount: 127, consultationFee: 1500,
    availableSlots: [slotFor('advisor_1', 1, 10), slotFor('advisor_1', 2, 11, 30), slotFor('advisor_1', 3, 16)],
    isVerified: true, status: 'approved', createdAt: '2025-11-02T09:00:00.000Z',
  },
  {
    id: 'advisor_2', name: 'Priya Sharma', photoUrl: 'https://i.pravatar.cc/150?img=47',
    type: 'RIA', sebiRegNo: 'INA000005678', firmName: 'Sharma Financial Solutions',
    bio: 'SEBI-registered investment advisor specialising in mutual fund portfolios, goal-based investing, and NRI taxation. Known for clear, jargon-free advice.',
    specialties: ['Mutual Funds', 'Goal Planning', 'NRI Taxation'],
    experienceYears: 9, rating: 4.7, reviewCount: 89, consultationFee: 1200,
    availableSlots: [slotFor('advisor_2', 1, 12), slotFor('advisor_2', 2, 15), slotFor('advisor_2', 4, 10, 30)],
    isVerified: true, status: 'approved', createdAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: 'advisor_3', name: 'Amit Verma', photoUrl: 'https://i.pravatar.cc/150?img=33',
    type: 'RA', sebiRegNo: 'INH000009876', firmName: 'Verma Research Desk',
    bio: 'Research analyst covering Indian equities and derivatives. Publishes detailed stock research with entry/exit levels, risk management, and portfolio construction.',
    specialties: ['Equity Research', 'Technical Analysis', 'Derivatives'],
    experienceYears: 11, rating: 4.5, reviewCount: 156, consultationFee: 999,
    availableSlots: [slotFor('advisor_3', 1, 14), slotFor('advisor_3', 2, 12, 30), slotFor('advisor_3', 3, 11)],
    isVerified: true, status: 'approved', createdAt: '2025-08-20T09:00:00.000Z',
  },
  {
    id: 'advisor_4', name: 'Neha Gupta', photoUrl: 'https://i.pravatar.cc/150?img=32',
    type: 'RIA', sebiRegNo: 'INA000003456', firmName: 'Gupta & Co. Advisors',
    bio: 'Family wealth advisor focusing on estate planning, insurance review, and behavioural finance. 7+ years helping first-generation investors build disciplined habits.',
    specialties: ['Estate Planning', 'Insurance', 'Behavioural Finance'],
    experienceYears: 7, rating: 4.6, reviewCount: 64, consultationFee: 800,
    availableSlots: [slotFor('advisor_4', 2, 10), slotFor('advisor_4', 3, 15, 30)],
    isVerified: true, status: 'approved', createdAt: '2026-02-10T09:00:00.000Z',
  },
  {
    id: 'advisor_5', name: 'Suresh Iyer', photoUrl: 'https://i.pravatar.cc/150?img=59',
    type: 'RA', sebiRegNo: 'INH000007890', firmName: 'Iyer Market Insights',
    bio: 'SEBI-registered research analyst with a focus on small-caps and turnaround stories. Combines fundamental deep-dives with catalyst-based investing.',
    specialties: ['Small Caps', 'Value Investing', 'Equity Research'],
    experienceYears: 13, rating: 4.4, reviewCount: 203, consultationFee: 1100,
    availableSlots: [slotFor('advisor_5', 1, 9, 30), slotFor('advisor_5', 3, 14)],
    isVerified: true, status: 'approved', createdAt: '2025-06-01T09:00:00.000Z',
  },
  {
    id: 'advisor_6', name: 'Kavita Nair', photoUrl: 'https://i.pravatar.cc/150?img=20',
    type: 'RIA', sebiRegNo: 'INA000002345', firmName: 'Nair Financial Planning',
    bio: 'Fee-only advisor helping young professionals with first salaries, ESOPs, and salary structuring. Avid educator with a growing online following.',
    specialties: ['First Job Investing', 'ESOPs', 'Salary Structuring'],
    experienceYears: 6, rating: 4.9, reviewCount: 42, consultationFee: 700,
    availableSlots: [slotFor('advisor_6', 1, 13), slotFor('advisor_6', 2, 16, 30)],
    isVerified: false, status: 'pending', createdAt: '2026-07-01T09:00:00.000Z',
  },
];

// ==================== Public API ====================

/** Shallow-clone an advisor (deep-clones slots) so test resets get fresh state. */
function cloneAdvisor(a: AdvisorData): AdvisorData {
  return { ...a, availableSlots: a.availableSlots.map(s => ({ ...s })) };
}

/** Snapshot of the initial mock state, used by resetAdvisorsService(). */
const initialMockAdvisors: AdvisorData[] = mockAdvisors.map(cloneAdvisor);

export async function configureAdvisorsPersistence(storage: StorageEngine): Promise<void> {
  _advisorsStorage = storage;
}

/** Release any pending slot claims that have expired (10 min). */
function releaseStaleClaims(): void {
  const now = Date.now();
  for (const [slotId, claim] of pendingBookings) {
    if (now - claim.claimedAt > SLOT_LOCK_MS) {
      pendingBookings.delete(slotId);
      const advisor = mockAdvisors.find(a => a.availableSlots.some(s => s.id === slotId));
      const slot = advisor?.availableSlots.find(s => s.id === slotId);
      if (slot) slot.booked = false;
    }
  }
}

/** Get approved advisors with search + filter + pagination. */
export async function getAdvisors(
  query: string = '',
  filters: { type?: string; specialty?: string; minRating?: number } = {},
  page: number = 1,
  limit: number = 20,
): Promise<{ advisors: AdvisorData[]; total: number; page: number; totalPages: number }> {
  let list = mockAdvisors.filter(a => a.status === 'approved');

  const q = (query || '').toLowerCase().trim();
  if (q) {
    list = list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.firmName?.toLowerCase().includes(q) ||
      a.specialties.some(s => s.toLowerCase().includes(q)),
    );
  }
  if (filters.type) {
    list = list.filter(a => a.type === filters.type);
  }
  if (filters.specialty) {
    list = list.filter(a => a.specialties.some(s => s.toLowerCase() === (filters.specialty as string).toLowerCase()));
  }
  if (filters.minRating != null) {
    list = list.filter(a => a.rating >= (filters.minRating as number));
  }

  const start = (page - 1) * limit;
  const paginated = list.slice(start, start + limit);
  return {
    advisors: paginated,
    total: list.length,
    page,
    totalPages: Math.ceil(list.length / limit),
  };
}

/** Get a single advisor (any status — used by admin detail too). */
export async function getAdvisor(advisorId: string): Promise<AdvisorData | null> {
  return mockAdvisors.find(a => a.id === advisorId) ?? null;
}

/** Get reviews for an advisor. */
export async function getAdvisorReviews(advisorId: string): Promise<AdvisorReviewData[]> {
  return reviews.filter(r => r.advisorId === advisorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Submit a review — only allowed after a completed consultation with the advisor. */
export async function submitReview(
  userId: string,
  userName: string,
  advisorId: string,
  rating: number,
  comment: string,
): Promise<AdvisorReviewData> {
  if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');
  if (!comment || !comment.trim()) throw new Error('Comment is required');

  const advisor = mockAdvisors.find(a => a.id === advisorId);
  if (!advisor) throw new Error('Advisor not found');

  const completed = consultations.find(c =>
    c.userId === userId && c.advisorId === advisorId && c.status === 'completed',
  );
  if (!completed) {
    throw new Error('You can only review an advisor after a completed consultation');
  }
  if (reviews.some(r => r.userId === userId && r.advisorId === advisorId)) {
    throw new Error('You have already reviewed this advisor');
  }

  const review: AdvisorReviewData = {
    id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    advisorId,
    userId,
    userName: userName || 'Toroloom User',
    rating,
    comment: comment.trim(),
    createdAt: new Date().toISOString(),
  };
  reviews.push(review);

  // Recompute advisor aggregate rating
  const advisorReviews = reviews.filter(r => r.advisorId === advisorId);
  advisor.rating = Math.round((advisorReviews.reduce((sum, r) => sum + r.rating, 0) / advisorReviews.length) * 10) / 10;
  advisor.reviewCount = advisorReviews.length;
  return review;
}

/** Get available (non-booked, future) slots for an advisor. */
export async function getAvailableSlots(advisorId: string): Promise<AdvisorSlotData[]> {
  releaseStaleClaims();
  const advisor = mockAdvisors.find(a => a.id === advisorId);
  if (!advisor) return [];
  const now = Date.now();
  return advisor.availableSlots.filter(s => !s.booked && new Date(s.startTime).getTime() > now);
}

/**
 * Book a consultation — atomically locks the slot and creates a pending
 * consultation. The payment flow then verifies & confirms, or cancels &
 * releases the slot.
 */
export async function bookConsultation(
  userId: string,
  advisorId: string,
  slotId: string,
  notes?: string,
): Promise<ConsultationData> {
  releaseStaleClaims();

  const advisor = mockAdvisors.find(a => a.id === advisorId);
  if (!advisor) throw new Error('Advisor not found');
  if (advisor.status !== 'approved') throw new Error('Advisor is not available for booking');

  const slot = advisor.availableSlots.find(s => s.id === slotId);
  if (!slot) throw new Error('Slot not found');

  // ── Slot lock / double-booking guard ────────────────────────────────
  if (slot.booked) throw new Error('Slot is already booked');
  if (pendingBookings.has(slotId)) throw new Error('Slot is being booked by another user');

  slot.booked = true;
  pendingBookings.set(slotId, { userId, claimedAt: Date.now() });

  const consultation: ConsultationData = {
    id: `consult_${Date.now()}_${consultationSeq++}`,
    advisorId,
    advisorName: advisor.name,
    advisorPhotoUrl: advisor.photoUrl,
    advisorType: advisor.type,
    userId,
    slotId,
    startTime: slot.startTime,
    endTime: slot.endTime,
    amount: advisor.consultationFee,
    status: 'pending',
    notes,
    createdAt: new Date().toISOString(),
  };
  consultations.push(consultation);
  return consultation;
}

/** Get the current user's consultations (upcoming first). */
export async function getMyConsultations(userId: string): Promise<ConsultationData[]> {
  return consultations
    .filter(c => c.userId === userId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Get a single consultation (owner or admin only). */
export async function getConsultation(userId: string, consultationId: string): Promise<ConsultationData | null> {
  return consultations.find(c => c.id === consultationId && c.userId === userId) ?? null;
}

/** Confirm a consultation after payment verification. */
export async function confirmConsultation(userId: string, consultationId: string): Promise<ConsultationData | null> {
  const consultation = await getConsultation(userId, consultationId);
  if (!consultation) return null;
  if (consultation.status !== 'pending') return consultation;
  consultation.status = 'confirmed';
  pendingBookings.delete(consultation.slotId);
  return consultation;
}

/** Cancel a consultation and release the slot (refund happens via payments). */
export async function cancelConsultation(
  userId: string,
  consultationId: string,
): Promise<ConsultationData | null> {
  const consultation = await getConsultation(userId, consultationId);
  if (!consultation) return null;
  if (consultation.status !== 'pending' && consultation.status !== 'confirmed') {
    throw new Error('Only pending or confirmed consultations can be cancelled');
  }
  consultation.status = 'cancelled';
  pendingBookings.delete(consultation.slotId);
  releaseSlot(consultation.slotId);
  return consultation;
}

/** Mark a consultation as completed (advisor or user). */
export async function completeConsultation(
  userId: string,
  consultationId: string,
): Promise<ConsultationData | null> {
  const consultation = await getConsultation(userId, consultationId);
  if (!consultation) return null;
  if (consultation.status !== 'confirmed') {
    throw new Error('Only confirmed consultations can be marked complete');
  }
  consultation.status = 'completed';
  return consultation;
}

function releaseSlot(slotId: string): void {
  for (const advisor of mockAdvisors) {
    const slot = advisor.availableSlots.find(s => s.id === slotId);
    if (slot) slot.booked = false;
  }
}

// ==================== Admin ====================

/** Get all advisors including pending (admin panel). */
export async function getAllAdvisors(): Promise<AdvisorData[]> {
  return [...mockAdvisors].sort((a, b) => {
    const rank: Record<AdvisorStatus, number> = { pending: 0, approved: 1, suspended: 2, rejected: 3 };
    return rank[a.status] - rank[b.status];
  });
}

/** Approve / reject / suspend an advisor. */
export async function setAdvisorStatus(advisorId: string, status: AdvisorStatus): Promise<AdvisorData | null> {
  const advisor = mockAdvisors.find(a => a.id === advisorId);
  if (!advisor) return null;
  advisor.status = status;
  if (status === 'approved') advisor.isVerified = true;
  return advisor;
}

/** Admin adds or edits an advisor. */
export async function upsertAdvisor(input: Partial<AdvisorData>): Promise<AdvisorData> {
  if (!input.id) {
    const advisor: AdvisorData = {
      id: `advisor_${Date.now()}`,
      name: input.name || 'Unnamed Advisor',
      photoUrl: input.photoUrl,
      type: input.type || 'RIA',
      sebiRegNo: input.sebiRegNo || '',
      firmName: input.firmName,
      bio: input.bio || '',
      specialties: input.specialties || [],
      experienceYears: input.experienceYears || 0,
      rating: input.rating ?? 0,
      reviewCount: 0,
      consultationFee: input.consultationFee ?? 0,
      availableSlots: input.availableSlots || [],
      isVerified: false,
      status: input.status || 'pending',
      createdAt: new Date().toISOString(),
    };
    mockAdvisors.push(advisor);
    return advisor;
  }

  const existing = mockAdvisors.find(a => a.id === input.id);
  if (!existing) throw new Error('Advisor not found');
  Object.assign(existing, input);
  return existing;
}

/** Reset for testing — restores the full initial mock state. */
export function resetAdvisorsService(): void {
  _advisorsStorage = null;
  pendingBookings.clear();
  consultations.length = 0;
  reviews.length = 0;
  consultationSeq = 1;
  // Restore advisors (status, isVerified, rating, reviewCount, slots) and drop
  // any advisors added via upsertAdvisor() during tests.
  mockAdvisors.length = 0;
  for (const advisor of initialMockAdvisors) {
    mockAdvisors.push(cloneAdvisor(advisor));
  }
}
