import { api } from './client';
import type { ReferralStats } from '../../types';

export const referralApi = {
  /** Get referral stats for the current user */
  getStats: () => api.get<ReferralStats>('/auth/referral/stats'),

  /** Generate a new referral code for the current user */
  generateCode: () =>
    api.post<{ code: string; shareLink: string }>('/auth/referral/generate'),

  /** Record a referral from a signup link (called by server on signup) */
  recordReferral: (source: string) =>
    api.post<{ success: boolean; message: string }>('/auth/referral', { source }),
};
