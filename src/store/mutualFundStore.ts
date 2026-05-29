import { create } from 'zustand';
import { MutualFund, SIPPlan } from '../types';
import { mockMutualFunds, mockSIPs } from '../constants/mockData';
import { mutualFundApi } from '../services/api';

interface MutualFundState {
  funds: MutualFund[];
  sipPlans: SIPPlan[];
  isLoading: boolean;
  fetchFunds: () => Promise<void>;
  fetchSIPs: () => Promise<void>;
  investInFund: (fundId: string, amount: number) => Promise<void>;
  startSIP: (fundId: string, amount: number, frequency: SIPPlan['frequency']) => Promise<void>;
}

export const useMutualFundStore = create<MutualFundState>((set) => ({
  funds: mockMutualFunds,
  sipPlans: mockSIPs,
  isLoading: false,

  fetchFunds: async () => {
    set({ isLoading: true });
    try {
      const funds = await mutualFundApi.getFunds();
      set({ funds, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchSIPs: async () => {
    try {
      const sipPlans = await mutualFundApi.getSIPs();
      set({ sipPlans });
    } catch {
      // Backend unavailable — keep mock data
    }
  },

  investInFund: async (fundId, amount) => {
    // Backend doesn't have a lump-sum endpoint yet — just log locally
    console.log(`Invested ₹${amount} in fund ${fundId}`);
  },

  startSIP: async (fundId, amount, frequency) => {
    try {
      const created = await mutualFundApi.createSIP({ fundId, amount, frequency });
      set(state => ({
        sipPlans: [...state.sipPlans, created],
      }));
      return;
    } catch {
      // Backend unavailable — create locally
    }

    const fund = mockMutualFunds.find(f => f.id === fundId);
    if (!fund) return;

    set(state => ({
      sipPlans: [...state.sipPlans, {
        id: `sip_${Date.now()}`,
        fundId,
        fundName: fund.name,
        amount,
        frequency,
        nextDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        totalInvested: amount,
        currentValue: amount,
        returns: 0,
      }],
    }));
  },
}));
