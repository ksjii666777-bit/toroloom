/**
 * ============================================================================
 * Toroloom — Advisory Store Unit Tests
 * ============================================================================
 *
 * Tests advisor listing (API + mock fallback + client-side filters), advisor
 * detail loading, reviews, the booking flow, and admin actions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdvisoryStore } from '../store/advisoryStore';
import type { Advisor, Consultation } from '../types';

// ──── Mock advisoryApi ─────────────────────────────────────────────────────

vi.mock('../services/api/advisory', () => ({
  advisoryApi: {
    listAdvisors: vi.fn(),
    getAdvisor: vi.fn(),
    getReviews: vi.fn(),
    getSlots: vi.fn(),
    submitReview: vi.fn(),
    bookConsultation: vi.fn(),
    myConsultations: vi.fn(),
    getConsultation: vi.fn(),
    confirmConsultation: vi.fn(),
    cancelConsultation: vi.fn(),
    completeConsultation: vi.fn(),
    listAllAdvisors: vi.fn(),
    setAdvisorStatus: vi.fn(),
    upsertAdvisor: vi.fn(),
  },
}));

// ──── Fixtures ─────────────────────────────────────────────────────────────

const mockAdvisor: Advisor = {
  id: 'advisor_1',
  name: 'Dr. Rajesh Khanna',
  photoUrl: 'https://i.pravatar.cc/150?img=12',
  type: 'RIA',
  sebiRegNo: 'INA000001234',
  firmName: 'Khanna Wealth Advisors',
  bio: 'Wealth management expert.',
  specialties: ['Wealth Management', 'Retirement Planning'],
  experienceYears: 15,
  rating: 4.8,
  reviewCount: 127,
  consultationFee: 1500,
  availableSlots: [
    { id: 'slot_1', advisorId: 'advisor_1', startTime: '2026-09-01T10:00:00.000Z', endTime: '2026-09-01T10:45:00.000Z', booked: false },
  ],
  isVerified: true,
  status: 'approved',
  createdAt: '2025-11-02T09:00:00.000Z',
};

const mockConsultation: Consultation = {
  id: 'consult_1',
  advisorId: 'advisor_1',
  advisorName: 'Dr. Rajesh Khanna',
  advisorType: 'RIA',
  userId: 'user_me',
  slotId: 'slot_1',
  startTime: '2026-09-01T10:00:00.000Z',
  endTime: '2026-09-01T10:45:00.000Z',
  amount: 1500,
  status: 'confirmed',
  createdAt: '2026-08-10T09:00:00.000Z',
};

const resetStore = () => {
  useAdvisoryStore.setState({
    advisors: [],
    filters: {},
    selectedAdvisor: null,
    reviews: [],
    myConsultations: [],
    isLoading: false,
    error: null,
    allAdvisors: [],
  });
};

// ──── Tests ────────────────────────────────────────────────────────────────

describe('AdvisoryStore — Initial State', () => {
  beforeEach(resetStore);

  it('starts empty', () => {
    const s = useAdvisoryStore.getState();
    expect(s.advisors).toEqual([]);
    expect(s.selectedAdvisor).toBeNull();
    expect(s.myConsultations).toEqual([]);
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
  });
});

describe('AdvisoryStore — loadAdvisors', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('populates advisors from API on success', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.listAdvisors).mockResolvedValue({
      advisors: [mockAdvisor], total: 1, page: 1, totalPages: 1,
    });

    await useAdvisoryStore.getState().loadAdvisors();
    const s = useAdvisoryStore.getState();
    expect(s.advisors).toEqual([mockAdvisor]);
    expect(s.isLoading).toBe(false);
  });

  it('falls back to approved mock advisors when API fails', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.listAdvisors).mockRejectedValue(new Error('Network error'));

    await useAdvisoryStore.getState().loadAdvisors();
    const s = useAdvisoryStore.getState();
    expect(s.advisors.length).toBeGreaterThan(0);
    expect(s.advisors.every(a => a.status === 'approved')).toBe(true);
    expect(s.isLoading).toBe(false);
  });

  it('applies client-side filters on mock fallback', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.listAdvisors).mockRejectedValue(new Error('down'));

    await useAdvisoryStore.getState().loadAdvisors({ type: 'RA' });
    const s = useAdvisoryStore.getState();
    expect(s.advisors.length).toBeGreaterThan(0);
    expect(s.advisors.every(a => a.type === 'RA')).toBe(true);
  });

  it('stores merged filters', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.listAdvisors).mockResolvedValue({
      advisors: [], total: 0, page: 1, totalPages: 0,
    });

    await useAdvisoryStore.getState().loadAdvisors({ q: 'khanna' });
    expect(useAdvisoryStore.getState().filters.q).toBe('khanna');
  });
});

describe('AdvisoryStore — loadAdvisor', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('loads advisor detail from API', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.getAdvisor).mockResolvedValue({ advisor: mockAdvisor });

    await useAdvisoryStore.getState().loadAdvisor('advisor_1');
    expect(useAdvisoryStore.getState().selectedAdvisor?.id).toBe('advisor_1');
  });

  it('falls back to mock advisor when API fails', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.getAdvisor).mockRejectedValue(new Error('down'));

    await useAdvisoryStore.getState().loadAdvisor('advisor_1');
    expect(useAdvisoryStore.getState().selectedAdvisor?.id).toBe('advisor_1');
  });

  it('sets selectedAdvisor to null for unknown id fallback', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.getAdvisor).mockRejectedValue(new Error('down'));

    await useAdvisoryStore.getState().loadAdvisor('unknown_id');
    expect(useAdvisoryStore.getState().selectedAdvisor).toBeNull();
  });
});

describe('AdvisoryStore — loadMyConsultations', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('populates consultations from API', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.myConsultations).mockResolvedValue({ consultations: [mockConsultation] });

    await useAdvisoryStore.getState().loadMyConsultations();
    expect(useAdvisoryStore.getState().myConsultations).toEqual([mockConsultation]);
  });

  it('falls back to mock consultations when API fails', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.myConsultations).mockRejectedValue(new Error('down'));

    await useAdvisoryStore.getState().loadMyConsultations();
    expect(useAdvisoryStore.getState().myConsultations.length).toBeGreaterThan(0);
  });
});

describe('AdvisoryStore — bookConsultation', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('returns true and reloads consultations on success', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.bookConsultation).mockResolvedValue({ consultation: mockConsultation });
    vi.mocked(advisoryApi.myConsultations).mockResolvedValue({ consultations: [mockConsultation] });

    const ok = await useAdvisoryStore.getState().bookConsultation('advisor_1', 'slot_1');
    expect(ok).toBe(true);
    expect(advisoryApi.bookConsultation).toHaveBeenCalledWith('advisor_1', 'slot_1');
    expect(useAdvisoryStore.getState().myConsultations).toEqual([mockConsultation]);
  });

  it('returns false and sets error on failure', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.bookConsultation).mockRejectedValue(new Error('Slot already booked'));

    const ok = await useAdvisoryStore.getState().bookConsultation('advisor_1', 'slot_1');
    expect(ok).toBe(false);
    expect(useAdvisoryStore.getState().error).toContain('Slot already booked');
  });
});

describe('AdvisoryStore — consultation lifecycle', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('confirmConsultation returns true on success', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.confirmConsultation).mockResolvedValue({
      consultation: { ...mockConsultation, status: 'confirmed' as const },
    });
    vi.mocked(advisoryApi.myConsultations).mockResolvedValue({ consultations: [] });

    const ok = await useAdvisoryStore.getState().confirmConsultation('consult_1');
    expect(ok).toBe(true);
  });

  it('cancelConsultation returns true and reloads', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.cancelConsultation).mockResolvedValue({
      consultation: { ...mockConsultation, status: 'cancelled' as const },
    });
    vi.mocked(advisoryApi.myConsultations).mockResolvedValue({ consultations: [] });

    const ok = await useAdvisoryStore.getState().cancelConsultation('consult_1');
    expect(ok).toBe(true);
  });

  it('cancelConsultation sets error on failure', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.cancelConsultation).mockRejectedValue(new Error('Too late to cancel'));

    const ok = await useAdvisoryStore.getState().cancelConsultation('consult_1');
    expect(ok).toBe(false);
    expect(useAdvisoryStore.getState().error).toContain('Too late');
  });

  it('completeConsultation returns true on success', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.completeConsultation).mockResolvedValue({
      consultation: { ...mockConsultation, status: 'completed' as const },
    });
    vi.mocked(advisoryApi.myConsultations).mockResolvedValue({ consultations: [] });

    const ok = await useAdvisoryStore.getState().completeConsultation('consult_1');
    expect(ok).toBe(true);
  });
});

describe('AdvisoryStore — submitReview', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('returns true and refreshes reviews + advisor on success', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.submitReview).mockResolvedValue({
      review: { id: 'r1', advisorId: 'advisor_1', userId: 'u1', userName: 'User', rating: 5, comment: 'Great', createdAt: '2026-08-15' },
    });
    vi.mocked(advisoryApi.getReviews).mockResolvedValue({ reviews: [] });
    vi.mocked(advisoryApi.getAdvisor).mockResolvedValue({ advisor: mockAdvisor });

    const ok = await useAdvisoryStore.getState().submitReview('advisor_1', 5, 'Great');
    expect(ok).toBe(true);
    expect(advisoryApi.submitReview).toHaveBeenCalledWith('advisor_1', 5, 'Great');
  });

  it('returns false and sets error on failure', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.submitReview).mockRejectedValue(new Error('Already reviewed'));

    const ok = await useAdvisoryStore.getState().submitReview('advisor_1', 4, 'Nice');
    expect(ok).toBe(false);
    expect(useAdvisoryStore.getState().error).toContain('Already reviewed');
  });
});

describe('AdvisoryStore — Admin actions', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('loadAllAdvisors populates from API', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.listAllAdvisors).mockResolvedValue({ advisors: [mockAdvisor] });

    await useAdvisoryStore.getState().loadAllAdvisors();
    expect(useAdvisoryStore.getState().allAdvisors).toEqual([mockAdvisor]);
  });

  it('setAdvisorStatus falls back to local update when API fails', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.setAdvisorStatus).mockRejectedValue(new Error('down'));
    useAdvisoryStore.setState({ allAdvisors: [mockAdvisor] });

    await useAdvisoryStore.getState().setAdvisorStatus('advisor_1', 'suspended');
    expect(useAdvisoryStore.getState().allAdvisors[0].status).toBe('suspended');
  });
});
