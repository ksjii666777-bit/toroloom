/**
 * ============================================================================
 * Toroloom — Wealth Management Store
 * ============================================================================
 *
 * Zustand store for goal-based investing, retirement planning, and
 * wealth tracking data. Persisted to AsyncStorage via Zustand persist.
 *
 * ============================================================================
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────

export type GoalCategory = 'retirement' | 'education' | 'house' | 'travel' | 'emergency' | 'wedding' | 'vehicle' | 'custom';

export interface FinancialGoal {
  id: string;
  name: string;
  category: GoalCategory;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate: string; // ISO date
  expectedReturn: number; // p.a. %
  priority: 'low' | 'medium' | 'high';
  notes: string;
  createdAt: string;
}

export interface RetirementPlan {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentRetirementSavings: number;
  monthlyContribution: number;
  expectedReturn: number; // p.a. %
  inflationRate: number; // p.a. %
  expectedMonthlyExpense: number; // in today's rupees
  otherIncome: number; // monthly pension/rental/etc
}

export interface WealthSummary {
  totalNetWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number; // %
}

interface WealthState {
  // Goals
  goals: FinancialGoal[];
  addGoal: (goal: Omit<FinancialGoal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<FinancialGoal>) => void;
  deleteGoal: (id: string) => void;
  contributeToGoal: (id: string, amount: number) => void;

  // Retirement
  retirementPlan: RetirementPlan;
  updateRetirementPlan: (updates: Partial<RetirementPlan>) => void;

  // Wealth Summary
  summary: WealthSummary;
  updateSummary: (updates: Partial<WealthSummary>) => void;

  // Calculations
  getGoalProgress: (goal: FinancialGoal) => number;
  getGoalSIPRequired: (goal: FinancialGoal) => number;
  getRetirementProjection: () => {
    corpusAtRetirement: number;
    monthlyRetirementIncome: number;
    gap: number;
    requiredMonthlySIP: number;
    yearsToRetirement: number;
    yearlyData: { age: number; corpus: number; contributions: number }[];
  };
}

const DEFAULT_GOALS: FinancialGoal[] = [
  {
    id: 'goal_emergency',
    name: 'Emergency Fund',
    category: 'emergency',
    icon: '🛡️',
    color: '#00C853',
    targetAmount: 500000,
    currentAmount: 125000,
    monthlyContribution: 10000,
    targetDate: new Date(Date.now() + 365 * 2 * 86400000).toISOString(),
    expectedReturn: 6,
    priority: 'high',
    notes: '3-6 months of living expenses',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'goal_retirement',
    name: 'Retirement Corpus',
    category: 'retirement',
    icon: '🏖️',
    color: '#6C63FF',
    targetAmount: 50000000,
    currentAmount: 2500000,
    monthlyContribution: 25000,
    targetDate: new Date(Date.now() + 365 * 25 * 86400000).toISOString(),
    expectedReturn: 12,
    priority: 'high',
    notes: 'Target retirement by age 60',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'goal_vacation',
    name: 'Europe Vacation',
    category: 'travel',
    icon: '✈️',
    color: '#3B82F6',
    targetAmount: 800000,
    currentAmount: 200000,
    monthlyContribution: 15000,
    targetDate: new Date(Date.now() + 365 * 3 * 86400000).toISOString(),
    expectedReturn: 8,
    priority: 'medium',
    notes: 'Family trip to Europe',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_RETIREMENT: RetirementPlan = {
  currentAge: 30,
  retirementAge: 60,
  lifeExpectancy: 85,
  currentRetirementSavings: 500000,
  monthlyContribution: 15000,
  expectedReturn: 12,
  inflationRate: 6,
  expectedMonthlyExpense: 50000,
  otherIncome: 0,
};

const DEFAULT_SUMMARY: WealthSummary = {
  totalNetWorth: 4500000,
  totalAssets: 5200000,
  totalLiabilities: 700000,
  monthlyIncome: 120000,
  monthlyExpenses: 65000,
  savingsRate: 45.8,
};

export const useWealthStore = create<WealthState>()(
  persist(
    (set, get) => ({
      goals: DEFAULT_GOALS,
      retirementPlan: DEFAULT_RETIREMENT,
      summary: DEFAULT_SUMMARY,

      addGoal: (goalData) => {
        const goal: FinancialGoal = {
          ...goalData,
          id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
        };
        set(state => ({ goals: [...state.goals, goal] }));
      },

      updateGoal: (id, updates) => {
        set(state => ({
          goals: state.goals.map(g => g.id === id ? { ...g, ...updates } : g),
        }));
      },

      deleteGoal: (id) => {
        set(state => ({ goals: state.goals.filter(g => g.id !== id) }));
      },

      contributeToGoal: (id, amount) => {
        set(state => ({
          goals: state.goals.map(g =>
            g.id === id
              ? { ...g, currentAmount: Math.min(g.targetAmount, g.currentAmount + amount) }
              : g
          ),
        }));
      },

      updateRetirementPlan: (updates) => {
        set(state => ({ retirementPlan: { ...state.retirementPlan, ...updates } }));
      },

      updateSummary: (updates) => {
        set(state => ({ summary: { ...state.summary, ...updates } }));
      },

      getGoalProgress: (goal) => {
        if (goal.targetAmount <= 0) return 0;
        return Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
      },

      getGoalSIPRequired: (goal) => {
        const { targetAmount, currentAmount, targetDate, expectedReturn } = goal;
        const remaining = targetAmount - currentAmount;
        if (remaining <= 0) return 0;

        const now = new Date();
        const target = new Date(targetDate);
        const months = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 +
          (target.getMonth() - now.getMonth()));
        const monthlyRate = expectedReturn / 12 / 100;

        // SIP formula: FV = P × ((1 + r)^n - 1) / r × (1 + r)
        // Solve for P: P = FV / (((1 + r)^n - 1) / r × (1 + r))
        if (monthlyRate === 0) return remaining / months;
        const factor = Math.pow(1 + monthlyRate, months);
        const denominator = ((factor - 1) / monthlyRate) * (1 + monthlyRate);
        return Math.ceil(remaining / denominator);
      },

      getRetirementProjection: () => {
        const plan = get().retirementPlan;
        const yearsToRetirement = plan.retirementAge - plan.currentAge;
        const yearsInRetirement = plan.lifeExpectancy - plan.retirementAge;
        const monthlyReturn = plan.expectedReturn / 12 / 100;
        const inflationMonthly = plan.inflationRate / 12 / 100;

        if (yearsToRetirement <= 0 || yearsInRetirement <= 0) {
          return {
            corpusAtRetirement: plan.currentRetirementSavings,
            monthlyRetirementIncome: 0,
            gap: 0,
            requiredMonthlySIP: 0,
            yearsToRetirement: Math.max(0, yearsToRetirement),
            yearlyData: [],
          };
        }

        const monthsToRetirement = yearsToRetirement * 12;
        const retirementMonths = yearsInRetirement * 12;

        // Future value of current savings
        const fvCurrent = plan.currentRetirementSavings * Math.pow(1 + monthlyReturn, monthsToRetirement);

        // Future value of monthly contributions
        const sipFactor = Math.pow(1 + monthlyReturn, monthsToRetirement);
        const fvSIP = plan.monthlyContribution * ((sipFactor - 1) / monthlyReturn) * (1 + monthlyReturn);
        const corpusAtRetirement = fvCurrent + fvSIP;

        // Inflation-adjusted monthly expense at retirement
        const inflatedExpense = plan.expectedMonthlyExpense * Math.pow(1 + inflationMonthly, monthsToRetirement);

        // Monthly withdrawal from corpus (inverse of SIP formula)
        const withdrawalFactor = Math.pow(1 + monthlyReturn, retirementMonths);
        const monthlyWithdrawal = corpusAtRetirement * monthlyReturn * withdrawalFactor / (withdrawalFactor - 1) / (1 + monthlyReturn);
        const monthlyRetirementIncome = monthlyWithdrawal + plan.otherIncome;

        // Gap
        const gap = Math.max(0, inflatedExpense - monthlyRetirementIncome);

        // Required SIP to close gap
        const deficit = inflatedExpense - plan.otherIncome - monthlyWithdrawal;
        let requiredMonthlySIP = 0;
        if (deficit > 0) {
          const deficitCorpus = deficit * ((Math.pow(1 + monthlyReturn, retirementMonths) - 1) / (monthlyReturn * Math.pow(1 + monthlyReturn, retirementMonths))) * (1 + monthlyReturn);
          requiredMonthlySIP = deficitCorpus * monthlyReturn / ((Math.pow(1 + monthlyReturn, monthsToRetirement) - 1) * (1 + monthlyReturn));
        }

        // Yearly projection
        const yearlyData: { age: number; corpus: number; contributions: number }[] = [];
        let runningCorpus = plan.currentRetirementSavings;
        let totalContributions = plan.currentRetirementSavings;
        for (let year = 1; year <= yearsToRetirement; year++) {
          for (let m = 0; m < 12; m++) {
            runningCorpus = runningCorpus * (1 + monthlyReturn) + plan.monthlyContribution;
            totalContributions += plan.monthlyContribution;
          }
          yearlyData.push({
            age: plan.currentAge + year,
            corpus: Math.round(runningCorpus),
            contributions: Math.round(totalContributions),
          });
        }

        return {
          corpusAtRetirement: Math.round(corpusAtRetirement),
          monthlyRetirementIncome: Math.round(monthlyRetirementIncome),
          gap: Math.round(gap),
          requiredMonthlySIP: Math.round(requiredMonthlySIP),
          yearsToRetirement,
          yearlyData,
        };
      },
    }),
    {
      name: 'toroloom-wealth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        goals: state.goals,
        retirementPlan: state.retirementPlan,
        summary: state.summary,
      }),
    }
  )
);
