import { api } from './client';
import type { MutualFund, SIPPlan } from '../../types';

export interface CreateSIPRequest {
  fundId: string;
  amount: number;
  frequency: SIPPlan['frequency'];
}

export interface ModifySIPRequest {
  sipId: string;
  amount?: number;
  frequency?: SIPPlan['frequency'];
}

export const mutualFundApi = {
  getFunds: () => api.get<MutualFund[]>('/mutual-funds'),

  getFund: (fundId: string) =>
    api.get<MutualFund>(`/mutual-funds/${fundId}`),

  getSIPs: () => api.get<SIPPlan[]>('/mutual-funds/sips/list'),

  createSIP: (data: CreateSIPRequest) =>
    api.post<SIPPlan>('/mutual-funds/sips', data),

  modifySIP: (data: ModifySIPRequest) =>
    api.put<SIPPlan>('/mutual-funds/sips', data),

  pauseSIP: (sipId: string) =>
    api.post<{ success: boolean }>('/mutual-funds/sips/pause', { sipId }),

  resumeSIP: (sipId: string) =>
    api.post<{ success: boolean }>('/mutual-funds/sips/resume', { sipId }),

  deleteSIP: (sipId: string) =>
    api.post<{ success: boolean }>('/mutual-funds/sips/delete', { sipId }),
};
