import { create } from 'zustand';
import { MutualFund, SIPPlan } from '../types';
import { mockMutualFunds, mockSIPs } from '../constants/mockData';
import { mutualFundApi } from '../services/api';
import { log } from '../utils/logger';

interface MutualFundState {
  funds: MutualFund[];
  sipPlans: SIPPlan[];
  isLoading: boolean;
  fetchFunds: () => Promise<void>;
  fetchSIPs: () => Promise<void>;
  investInFund: (fundId: string, amount: number) => Promise<void>;
  startSIP: (fundId: string, amount: number, frequency: SIPPlan['frequency']) => Promise<void>;
  modifySIP: (sipId: string, updates: { amount?: number; frequency?: SIPPlan['frequency'] }) => Promise<void>;
  pauseSIP: (sipId: string) => Promise<void>;
  resumeSIP: (sipId: string) => Promise<void>;
  deleteSIP: (sipId: string) => Promise<void>;
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
    log.info(`[MutualFunds] Invested ₹${amount} in fund ${fundId}`);
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

  modifySIP: async (sipId, updates) => {
    try {
      const updated = await mutualFundApi.modifySIP({ sipId, ...updates });
      set(state => ({
        sipPlans: state.sipPlans.map(s => s.id === sipId ? updated : s),
      }));
      return;
    } catch {
      // Backend unavailable — update locally
    }

    set(state => ({
      sipPlans: state.sipPlans.map(s =>
        s.id === sipId
          ? { ...s, ...updates, id: s.id, fundId: s.fundId, fundName: s.fundName }
          : s
      ),
    }));
  },

  pauseSIP: async (sipId) => {
    try {
      await mutualFundApi.pauseSIP(sipId);
    } catch {
      // Backend unavailable — update locally
    }

    set(state => ({
      sipPlans: state.sipPlans.map(s =>
        s.id === sipId ? { ...s, nextDate: 'PAUSED' } : s
      ),
    }));
  },

  resumeSIP: async (sipId) => {
    try {
      await mutualFundApi.resumeSIP(sipId);
    } catch {
      // Backend unavailable — update locally
    }

    const nextMonth = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
    set(state => ({
      sipPlans: state.sipPlans.map(s =>
        s.id === sipId ? { ...s, nextDate: nextMonth } : s
      ),
    }));
  },

  deleteSIP: async (sipId) => {
    try {
      await mutualFundApi.deleteSIP(sipId);
    } catch {
      // Backend unavailable — update locally
    }

    set(state => ({
      sipPlans: state.sipPlans.filter(s => s.id !== sipId),
    }));
  },
}));
