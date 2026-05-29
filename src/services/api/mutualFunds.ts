import { api } from './client';
import type { MutualFund, SIPPlan } from '../../types';

export interface CreateSIPRequest {
  fundId: string;
  amount: number;
  frequency: SIPPlan['frequency'];
}

export const mutualFundApi = {
  getFunds: () => api.get<MutualFund[]>('/mutual-funds'),

  getFund: (fundId: string) =>
    api.get<MutualFund>(`/mutual-funds/${fundId}`),

  getSIPs: () => api.get<SIPPlan[]>('/mutual-funds/sips/list'),

  createSIP: (data: CreateSIPRequest) =>
    api.post<SIPPlan>('/mutual-funds/sips', data),
};
