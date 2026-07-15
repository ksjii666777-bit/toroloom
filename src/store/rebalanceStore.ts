/**
 * ============================================================================
 * Toroloom — Portfolio Rebalancing Store
 * ============================================================================
 *
 * Analyzes current portfolio allocation vs target, generates suggested trades
 * with tax-aware logic, and supports multiple allocation profiles.
 * ============================================================================
 */

import { create } from 'zustand';
import {
  AllocationTarget, AllocationProfile, RebalanceTrade, RebalanceAnalysis,
} from '../types';

// ─── Mock Holdings (current portfolio) ────────────────────────────────────

const MOCK_PORTFOLIO_VALUE = 1250000;

const mockCurrentAllocation: AllocationTarget[] = [
  { label: 'Banking',      icon: '🏦', currentPercent: 28, currentValue: 350000, targetPercent: 20, color: '#3B82F6' },
  { label: 'IT',            icon: '💻', currentPercent: 22, currentValue: 275000, targetPercent: 20, color: '#6C63FF' },
  { label: 'Auto',          icon: '🚗', currentPercent: 15, currentValue: 187500, targetPercent: 15, color: '#FF9800' },
  { label: 'Pharma',        icon: '💊', currentPercent: 12, currentValue: 150000, targetPercent: 15, color: '#00C853' },
  { label: 'FMCG',          icon: '🛒', currentPercent: 10, currentValue: 125000, targetPercent: 15, color: '#FF6B6B' },
  { label: 'Energy',        icon: '⚡', currentPercent: 8,  currentValue: 100000, targetPercent: 10, color: '#FFC107' },
  { label: 'Real Estate',   icon: '🏗️', currentPercent: 5,  currentValue:  62500, targetPercent: 5,  color: '#06B6D4' },
];

// ─── Target Allocation Profiles ───────────────────────────────────────────

const profiles: AllocationProfile[] = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Capital preservation with moderate growth. Higher allocation to defensive sectors.',
    riskLevel: 'conservative',
    targets: [
      { label: 'Banking',    icon: '🏦', percent: 15, color: '#3B82F6' },
      { label: 'IT',          icon: '💻', percent: 15, color: '#6C63FF' },
      { label: 'Auto',        icon: '🚗', percent: 10, color: '#FF9800' },
      { label: 'Pharma',      icon: '💊', percent: 18, color: '#00C853' },
      { label: 'FMCG',        icon: '🛒', percent: 20, color: '#FF6B6B' },
      { label: 'Energy',      icon: '⚡', percent: 12, color: '#FFC107' },
      { label: 'Real Estate', icon: '🏗️', percent: 10, color: '#06B6D4' },
    ],
  },
  {
    id: 'moderate',
    name: 'Moderate',
    description: 'Balanced growth with controlled risk. Equal weight across growth and defensive sectors.',
    riskLevel: 'moderate',
    targets: [
      { label: 'Banking',    icon: '🏦', percent: 20, color: '#3B82F6' },
      { label: 'IT',          icon: '💻', percent: 20, color: '#6C63FF' },
      { label: 'Auto',        icon: '🚗', percent: 15, color: '#FF9800' },
      { label: 'Pharma',      icon: '💊', percent: 15, color: '#00C853' },
      { label: 'FMCG',        icon: '🛒', percent: 15, color: '#FF6B6B' },
      { label: 'Energy',      icon: '⚡', percent: 10, color: '#FFC107' },
      { label: 'Real Estate', icon: '🏗️', percent: 5,  color: '#06B6D4' },
    ],
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Maximum growth potential. Higher allocation to cyclical and high-beta sectors.',
    riskLevel: 'aggressive',
    targets: [
      { label: 'Banking',    icon: '🏦', percent: 25, color: '#3B82F6' },
      { label: 'IT',          icon: '💻', percent: 25, color: '#6C63FF' },
      { label: 'Auto',        icon: '🚗', percent: 20, color: '#FF9800' },
      { label: 'Pharma',      icon: '💊', percent: 10, color: '#00C853' },
      { label: 'FMCG',        icon: '🛒', percent: 5,  color: '#FF6B6B' },
      { label: 'Energy',      icon: '⚡', percent: 10, color: '#FFC107' },
      { label: 'Real Estate', icon: '🏗️', percent: 5,  color: '#06B6D4' },
    ],
  },
];

// ─── Generate Suggested Trades ───────────────────────────────────────────

function generateTrades(
  current: AllocationTarget[],
  targets: { label: string; icon: string; percent: number; color: string }[],
  portfolioValue: number,
): RebalanceTrade[] {
  const trades: RebalanceTrade[] = [];

  for (const cur of current) {
    const target = targets.find(t => t.label === cur.label);
    if (!target) continue;

    const diff = target.percent - cur.currentPercent;
    const diffAbs = Math.abs(diff);
    if (diffAbs < 1) continue; // Ignore <1% deviations

    const amount = Math.round((diffAbs / 100) * portfolioValue);
    const isOverweight = diff < 0;

    trades.push({
      id: `trade_${cur.label.toLowerCase().replace(/\s+/g, '_')}`,
      label: cur.label,
      action: isOverweight ? 'sell' : 'buy',
      currentPercent: cur.currentPercent,
      targetPercent: target.percent,
      difference: diff,
      amount,
      reason: isOverweight
        ? `${cur.label} is ${diffAbs.toFixed(1)}% overweight. Reduce exposure to match target.`
        : `${cur.label} is ${diffAbs.toFixed(1)}% underweight. Increase allocation to target.`,
      hasTaxImplication: isOverweight && diffAbs > 3,
      estimatedTaxCost: isOverweight && diffAbs > 3 ? Math.round(amount * 0.15) : undefined,
      priority: Math.round(diffAbs * 10),
      color: cur.color,
    });
  }

  return trades.sort((a, b) => b.priority - a.priority);
}

// ─── Store ─────────────────────────────────────────────────────────────────

interface RebalanceStoreState {
  /** Current portfolio value */
  portfolioValue: number;
  /** Current allocation (as percentages of portfolio) */
  currentAllocation: AllocationTarget[];
  /** Available allocation profiles */
  profiles: AllocationProfile[];
  /** Currently selected profile */
  selectedProfileId: string;
  /** Generated analysis */
  analysis: RebalanceAnalysis | null;
  /** Whether analysis is being computed */
  isAnalyzing: boolean;

  /** Select a profile and recompute */
  selectProfile: (profileId: string) => void;
  /** Run rebalancing analysis */
  runAnalysis: () => void;
  /** Update current allocation (e.g. custom editing) */
  updateCurrentAllocation: (allocation: AllocationTarget[]) => void;
  /** Set portfolio value */
  setPortfolioValue: (value: number) => void;
  /** Reset to defaults */
  resetToDefaults: () => void;
}

function computeAnalysis(
  current: AllocationTarget[],
  targets: { label: string; icon: string; percent: number; color: string }[],
  portfolioValue: number,
): RebalanceAnalysis {
  const trades = generateTrades(current, targets, portfolioValue);

  const deviationCount = trades.length;
  const avgDeviation = trades.length > 0
    ? Math.round((trades.reduce((s, t) => s + Math.abs(t.difference), 0) / trades.length) * 10) / 10
    : 0;
  const totalTradeAmount = trades.reduce((s, t) => s + t.amount, 0);
  const estimatedTaxImpact = trades.reduce((s, t) => s + (t.estimatedTaxCost || 0), 0);

  return {
    portfolioValue,
    deviationCount,
    avgDeviation,
    tradeCount: trades.length,
    totalTradeAmount,
    estimatedTaxImpact,
    currentAllocation: current,
    suggestedTrades: trades,
  };
}

export const useRebalanceStore = create<RebalanceStoreState>((set, get) => ({
  portfolioValue: MOCK_PORTFOLIO_VALUE,
  currentAllocation: mockCurrentAllocation,
  profiles,
  selectedProfileId: 'moderate',
  analysis: null,
  isAnalyzing: false,

  selectProfile: (profileId) => {
    set({ selectedProfileId: profileId });
    get().runAnalysis();
  },

  runAnalysis: () => {
    set({ isAnalyzing: true });
    const { currentAllocation, profiles, selectedProfileId, portfolioValue } = get();
    const profile = profiles.find(p => p.id === selectedProfileId) || profiles[1];

    // Simulate async computation
    setTimeout(() => {
      const analysis = computeAnalysis(currentAllocation, profile.targets, portfolioValue);
      set({ analysis, isAnalyzing: false });
    }, 300);
  },

  updateCurrentAllocation: (allocation) => {
    set({ currentAllocation: allocation });
    get().runAnalysis();
  },

  setPortfolioValue: (value) => {
    set({ portfolioValue: value });
    get().runAnalysis();
  },

  resetToDefaults: () => {
    set({
      portfolioValue: MOCK_PORTFOLIO_VALUE,
      currentAllocation: mockCurrentAllocation,
      selectedProfileId: 'moderate',
    });
    get().runAnalysis();
  },
}));
