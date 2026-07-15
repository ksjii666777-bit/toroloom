import { create } from 'zustand';
import { MutualFund, SIPPlan, StepUpConfig } from '../types';
import { mockMutualFunds, mockSIPs } from '../constants/mockData';
import { mutualFundApi } from '../services/api/mutualFunds';
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
  /** Enable step-up on an existing SIP */
  enableStepUp: (sipId: string, percent: number, frequency: StepUpConfig['frequency']) => Promise<void>;
  /** Modify an existing step-up configuration */
  modifyStepUp: (sipId: string, updates: { percent?: number; frequency?: StepUpConfig['frequency'] }) => Promise<void>;
  /** Disable step-up on a SIP (keep SIP running without auto-increase) */
  disableStepUp: (sipId: string) => Promise<void>;
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

  enableStepUp: async (sipId, percent, frequency) => {
    try {
      await mutualFundApi.enableStepUp(sipId, { percent, frequency });
    } catch {
      // Backend unavailable — update locally
    }

    set(state => ({
      sipPlans: state.sipPlans.map(sip => {
        if (sip.id !== sipId) return sip;
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return {
          ...sip,
          stepUp: {
            enabled: true,
            percent,
            frequency,
            baseAmount: sip.amount,
            currentStep: 0,
            nextStepDate: frequency === 'yearly'
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              : new Date(Date.now() + 182 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            projectedAmount: computeProjectedAmount(sip.amount, percent, frequency, 10),
          },
        };
      }),
    }));
  },

  modifyStepUp: async (sipId, updates) => {
    try {
      await mutualFundApi.modifyStepUp(sipId, updates);
    } catch {
      // Backend unavailable — update locally
    }

    set(state => ({
      sipPlans: state.sipPlans.map(sip => {
        if (sip.id !== sipId || !sip.stepUp) return sip;
        const newPercent = updates.percent ?? sip.stepUp.percent;
        const newFrequency = updates.frequency ?? sip.stepUp.frequency;
        return {
          ...sip,
          stepUp: {
            ...sip.stepUp,
            ...updates,
            projectedAmount: computeProjectedAmount(sip.stepUp.baseAmount, newPercent, newFrequency, 10),
          },
        };
      }),
    }));
  },

  disableStepUp: async (sipId) => {
    try {
      await mutualFundApi.disableStepUp(sipId);
    } catch {
      // Backend unavailable — update locally
    }

    set(state => ({
      sipPlans: state.sipPlans.map(sip =>
        sip.id === sipId ? { ...sip, stepUp: undefined } : sip
      ),
    }));
  },
}));

/** Helper: compute projected SIP amount after N years with step-up */
function computeProjectedAmount(
  baseAmount: number,
  percent: number,
  frequency: StepUpConfig['frequency'],
  years: number
): number {
  let amount = baseAmount;
  const stepsPerYear = frequency === 'yearly' ? 1 : 2;
  const totalSteps = years * stepsPerYear;
  for (let i = 0; i < totalSteps; i++) {
    amount = amount * (1 + percent / 100);
  }
  return Math.round(amount);
}
