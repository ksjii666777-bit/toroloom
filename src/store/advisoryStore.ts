import { create } from 'zustand';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Advisor, AdvisorReview, Consultation } from '../types';
import { mockAdvisors, mockAdvisorReviews, mockConsultations } from '../constants/mockData';
import { advisoryApi } from '../services/api/advisory';
import { paymentsApi } from '../services/api/payments';
import { log } from '../utils/logger';

export interface AdvisorFilters {
  q?: string;
  type?: 'RIA' | 'RA';
  specialty?: string;
  minRating?: number;
}

interface AdvisoryState {
  advisors: Advisor[];
  filters: AdvisorFilters;
  selectedAdvisor: Advisor | null;
  reviews: AdvisorReview[];
  myConsultations: Consultation[];
  isLoading: boolean;
  error: string | null;
  // Admin
  allAdvisors: Advisor[];
  loadAdvisors: (filters?: AdvisorFilters) => Promise<void>;
  loadAdvisor: (id: string) => Promise<void>;
  loadReviews: (id: string) => Promise<void>;
  loadMyConsultations: () => Promise<void>;
  bookConsultation: (advisorId: string, slotId: string) => Promise<boolean>;
  confirmConsultation: (id: string) => Promise<boolean>;
  cancelConsultation: (id: string) => Promise<boolean>;
  completeConsultation: (id: string) => Promise<boolean>;
  submitReview: (advisorId: string, rating: number, comment: string) => Promise<boolean>;
  // Admin actions
  loadAllAdvisors: () => Promise<void>;
  setAdvisorStatus: (id: string, status: string) => Promise<void>;
  clearError: () => void;
}

export const useAdvisoryStore = create<AdvisoryState>((set, get) => ({
  advisors: [],
  filters: {},
  selectedAdvisor: null,
  reviews: [],
  myConsultations: [],
  isLoading: false,
  error: null,
  allAdvisors: [],

  loadAdvisors: async (filters?: AdvisorFilters) => {
    set({ isLoading: true, error: null });
    // Callers (AdvisorListScreen) always pass the FULL filter state derived from
    // the active chip + search query, so replace — merging would keep stale
    // filters (e.g. tapping "All" after "RA" would keep type=RA applied).
    const nextFilters = filters ?? get().filters;
    set({ filters: nextFilters });
    try {
      const data = await advisoryApi.listAdvisors(nextFilters);
      set({ advisors: data.advisors, isLoading: false });
    } catch {
      // Backend unavailable — filter mock data client-side
      let list = [...mockAdvisors].filter(a => a.status === 'approved');
      const { q, type, specialty, minRating } = nextFilters;
      if (q) {
        const query = q.toLowerCase();
        list = list.filter(a =>
          a.name.toLowerCase().includes(query) ||
          (a.firmName || '').toLowerCase().includes(query) ||
          a.specialties.some(s => s.toLowerCase().includes(query)),
        );
      }
      if (type) list = list.filter(a => a.type === type);
      if (specialty) list = list.filter(a => a.specialties.some(s => s.toLowerCase() === specialty.toLowerCase()));
      if (minRating != null) list = list.filter(a => a.rating >= minRating);
      set({ advisors: list, isLoading: false });
    }
  },

  loadAdvisor: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await advisoryApi.getAdvisor(id);
      set({ selectedAdvisor: data.advisor, isLoading: false });
    } catch {
      const advisor = mockAdvisors.find(a => a.id === id) || null;
      set({ selectedAdvisor: advisor, isLoading: false });
    }
  },

  loadReviews: async (id: string) => {
    try {
      const data = await advisoryApi.getReviews(id);
      set({ reviews: data.reviews });
    } catch {
      set({ reviews: mockAdvisorReviews.filter(r => r.advisorId === id) });
    }
  },

  loadMyConsultations: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await advisoryApi.myConsultations();
      set({ myConsultations: data.consultations, isLoading: false });
    } catch {
      set({ myConsultations: mockConsultations, isLoading: false });
    }
  },

  bookConsultation: async (advisorId: string, slotId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Step 1: Lock the slot server-side (creates a pending consultation)
      const result = await advisoryApi.bookConsultation(advisorId, slotId);
      const consultationId = result.consultation.id;

      // Step 2: Get the advisor to know the fee
      const advisor = get().selectedAdvisor;
      const fee = advisor?.consultationFee ?? 0;

      if (fee > 0) {
        // Step 3: Create a Razorpay order for the consultation fee
        const order = await paymentsApi.createConsultationOrder({
          consultationId,
          amount: fee,
          advisorName: advisor?.name,
        });

        // Step 4: Try to open Razorpay Checkout
        try {
          const RazorpayCheckoutModule = await import('react-native-razorpay');
          const RazorpayCheckout = RazorpayCheckoutModule.default;

          const options = {
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            order_id: order.orderId,
            name: 'Toroloom',
            description: `Consultation with ${advisor?.name || 'Advisor'}`,
            image: 'https://toroloom.dev/assets/logo.png',
            prefill: { email: '', contact: '' },
            theme: { color: '#6C63FF' },
            modal: {
              confirm_close: true,
              ondismiss: () => {
                set({ isLoading: false });
              },
            },
          };

          const data = await RazorpayCheckout.open(options);

          // Step 5: Verify payment on backend
          await paymentsApi.verifyPayment({
            razorpayPaymentId: data.razorpay_payment_id,
            razorpayOrderId: data.razorpay_order_id,
            razorpaySignature: data.razorpay_signature,
            type: 'consultation',
            consultationId,
          });

          // Step 6: Confirm the consultation after payment
          await advisoryApi.confirmConsultation(consultationId);

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            'Booking Confirmed! 🎉',
            `Your consultation with ${advisor?.name || 'the advisor'} has been booked successfully.`,
          );
        } catch {
          // Razorpay native module not available (Expo Go / dev) — confirm anyway
          try {
            await advisoryApi.confirmConsultation(consultationId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            // Confirm failed — slot is still locked, user can retry from My Consultations
            log.warn('[AdvisoryStore] confirmConsultation failed after Razorpay fallback');
          }
        }
      } else {
        // Free consultation — confirm directly
        await advisoryApi.confirmConsultation(consultationId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await get().loadMyConsultations();
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Booking failed', isLoading: false });
      return false;
    }
  },

  confirmConsultation: async (id: string) => {
    try {
      await advisoryApi.confirmConsultation(id);
      await get().loadMyConsultations();
      return true;
    } catch {
      return false;
    }
  },

  cancelConsultation: async (id: string) => {
    try {
      await advisoryApi.cancelConsultation(id);
      await get().loadMyConsultations();
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Cancellation failed' });
      return false;
    }
  },

  completeConsultation: async (id: string) => {
    try {
      await advisoryApi.completeConsultation(id);
      await get().loadMyConsultations();
      return true;
    } catch {
      return false;
    }
  },

  submitReview: async (advisorId: string, rating: number, comment: string) => {
    try {
      await advisoryApi.submitReview(advisorId, rating, comment);
      await get().loadReviews(advisorId);
      await get().loadAdvisor(advisorId);
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to submit review' });
      return false;
    }
  },

  loadAllAdvisors: async () => {
    try {
      const data = await advisoryApi.listAllAdvisors();
      set({ allAdvisors: data.advisors });
    } catch {
      set({ allAdvisors: mockAdvisors });
    }
  },

  setAdvisorStatus: async (id: string, status: string) => {
    try {
      await advisoryApi.setAdvisorStatus(id, status);
      await get().loadAllAdvisors();
    } catch {
      // Fallback: update locally so the UI still works without backend
      set({
        allAdvisors: get().allAdvisors.map(a =>
          a.id === id ? { ...a, status: status as Advisor['status'], isVerified: status === 'approved' ? true : a.isVerified } : a,
        ),
      });
    }
  },

  clearError: () => set({ error: null }),
}));
