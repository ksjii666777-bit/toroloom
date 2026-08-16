import { api } from './client';
import type { Advisor, AdvisorSlot, AdvisorReview, Consultation } from '../../types';

export interface AdvisorListResponse {
  advisors: Advisor[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdvisorFilters {
  q?: string;
  type?: 'RIA' | 'RA';
  specialty?: string;
  minRating?: number;
  page?: number;
  limit?: number;
}

export const advisoryApi = {
  /** List approved advisors with search/filter/pagination */
  listAdvisors: (params?: AdvisorFilters) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.type) qs.set('type', params.type);
    if (params?.specialty) qs.set('specialty', params.specialty);
    if (params?.minRating != null) qs.set('minRating', String(params.minRating));
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return api.get<AdvisorListResponse>(`/advisors${query ? `?${query}` : ''}`);
  },

  /** Advisor detail (includes refreshed available slots) */
  getAdvisor: (id: string) => api.get<{ advisor: Advisor }>(`/advisors/${id}`),

  /** Reviews for an advisor */
  getReviews: (id: string) => api.get<{ reviews: AdvisorReview[] }>(`/advisors/${id}/reviews`),

  /** Available slots for an advisor */
  getSlots: (id: string) => api.get<{ slots: AdvisorSlot[] }>(`/advisors/${id}/slots`),

  /** Submit a review (requires a completed consultation) */
  submitReview: (advisorId: string, rating: number, comment: string) =>
    api.post<{ review: AdvisorReview }>(`/advisors/${advisorId}/reviews`, { rating, comment }),

  /** Book a consultation — locks the slot server-side */
  bookConsultation: (advisorId: string, slotId: string, notes?: string) =>
    api.post<{ consultation: Consultation }>('/consultations', { advisorId, slotId, notes }),

  /** My consultations (upcoming/past) */
  myConsultations: () => api.get<{ consultations: Consultation[] }>('/consultations'),

  /** Consultation detail */
  getConsultation: (id: string) => api.get<{ consultation: Consultation }>(`/consultations/${id}`),

  /** Confirm after payment verification */
  confirmConsultation: (id: string) =>
    api.post<{ consultation: Consultation }>(`/consultations/${id}/confirm`),

  /** Cancel + release slot */
  cancelConsultation: (id: string) =>
    api.post<{ consultation: Consultation }>(`/consultations/${id}/cancel`),

  /** Mark a confirmed consultation complete */
  completeConsultation: (id: string) =>
    api.post<{ consultation: Consultation }>(`/consultations/${id}/complete`),

  // ── Admin ──────────────────────────────────────────────────────────────
  listAllAdvisors: () => api.get<{ advisors: Advisor[] }>('/advisors/admin'),

  setAdvisorStatus: (id: string, status: string) =>
    api.post<{ advisor: Advisor }>(`/advisors/admin/${id}/approve`, { status }),

  upsertAdvisor: (body: Partial<Advisor>) => api.post<{ advisor: Advisor }>('/advisors/admin', body),
};
