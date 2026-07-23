/**
 * ============================================================================
 * Toroloom — A/B Test Runner Store
 * ============================================================================
 *
 * Manages in-app A/B experiments: create, update, start/pause/complete,
 * variant assignment, and metric computation.
 * ============================================================================
 */

import { create } from 'zustand';
import { ABExperiment, ABVariant, ABTestStatus, ABMetricSnapshot } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function uid(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function computeConversionRate(conversions: number, users: number): number {
  if (users === 0) return 0;
  return Math.round((conversions / users) * 1000) / 10;
}

function computeConfidence(conversionsA: number, usersA: number, conversionsB: number, usersB: number): number {
  // Simplified confidence: higher when sample size and difference are larger
  const rateA = usersA > 0 ? conversionsA / usersA : 0;
  const rateB = usersB > 0 ? conversionsB / usersB : 0;
  const diff = Math.abs(rateA - rateB);
  const totalUsers = usersA + usersB;
  if (totalUsers < 50) return Math.round(Math.min(diff * 200, 60));
  if (totalUsers < 200) return Math.round(Math.min(60 + diff * 100, 85));
  return Math.round(Math.min(85 + diff * 50, 99));
}

// ─── Mock Experiments ─────────────────────────────────────────────────────

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();
const daysFromNow = (d: number) => new Date(now + d * 86400000).toISOString();

const mockExperiments: ABExperiment[] = [
  {
    id: 'exp_1',
    name: 'Home Screen Layout',
    description: 'Test new card-based layout vs existing list layout on the home screen.',
    featureKey: 'home_layout',
    status: 'running',
    variants: [
      { id: 'exp_1_var_1', name: 'Control (List)', description: 'Existing list layout', trafficPercent: 50, assignedUsers: 2450, conversions: 320, conversionRate: 13.1, confidence: 0, isControl: true, color: '#6C63FF' },
      { id: 'exp_1_var_2', name: 'Variant (Cards)', description: 'New card-based layout with widgets', trafficPercent: 50, assignedUsers: 2480, conversions: 415, conversionRate: 16.7, confidence: 89, isControl: false, color: '#00C853' },
    ],
    totalUsers: 4930,
    startedAt: daysAgo(14),
    endedAt: null,
    createdAt: daysAgo(16),
    hasWinner: false,
    tags: ['home', 'layout', 'ui'],
    owner: 'Product Team',
  },
  {
    id: 'exp_2',
    name: 'Portfolio Chart Style',
    description: 'Compare filled area chart vs line chart for portfolio performance.',
    featureKey: 'portfolio_chart',
    status: 'running',
    variants: [
      { id: 'exp_2_var_1', name: 'Control (Line)', description: 'Existing line chart', trafficPercent: 50, assignedUsers: 1200, conversions: 180, conversionRate: 15.0, confidence: 0, isControl: true, color: '#3B82F6' },
      { id: 'exp_2_var_2', name: 'Variant (Area)', description: 'Filled area chart with gradient', trafficPercent: 50, assignedUsers: 1180, conversions: 210, conversionRate: 17.8, confidence: 72, isControl: false, color: '#FF9800' },
    ],
    totalUsers: 2380,
    startedAt: daysAgo(10),
    endedAt: null,
    createdAt: daysAgo(12),
    hasWinner: false,
    tags: ['portfolio', 'chart', 'visualization'],
    owner: 'Product Team',
  },
  {
    id: 'exp_3',
    name: 'Onboarding Flow',
    description: 'Test simplified 3-step onboarding vs current 5-step flow.',
    featureKey: 'onboarding',
    status: 'completed',
    variants: [
      { id: 'exp_3_var_1', name: 'Control (5-step)', description: 'Current 5-step onboarding', trafficPercent: 50, assignedUsers: 3500, conversions: 2100, conversionRate: 60.0, confidence: 0, isControl: true, color: '#6C63FF' },
      { id: 'exp_3_var_2', name: 'Variant A (3-step)', description: 'Simplified 3-step flow with progress', trafficPercent: 30, assignedUsers: 2100, conversions: 1512, conversionRate: 72.0, confidence: 98, isControl: false, color: '#00C853' },
      { id: 'exp_3_var_3', name: 'Variant B (1-step)', description: 'Single-step onboarding', trafficPercent: 20, assignedUsers: 1400, conversions: 840, conversionRate: 60.0, confidence: 45, isControl: false, color: '#FF6B6B' },
    ],
    totalUsers: 7000,
    startedAt: daysAgo(30),
    endedAt: daysAgo(2),
    createdAt: daysAgo(32),
    hasWinner: true,
    winnerVariantId: 'exp_3_var_2',
    tags: ['onboarding', 'conversion', 'ux'],
    owner: 'Growth Team',
  },
  {
    id: 'exp_4',
    name: 'Notification Timing',
    description: 'Test morning vs evening notification timing for market alerts.',
    featureKey: 'notif_timing',
    status: 'draft',
    variants: [
      { id: 'exp_4_var_1', name: 'Control (Morning)', description: 'Notifications at 9 AM', trafficPercent: 50, assignedUsers: 0, conversions: 0, conversionRate: 0, confidence: 0, isControl: true, color: '#6C63FF' },
      { id: 'exp_4_var_2', name: 'Variant (Evening)', description: 'Notifications at 6 PM', trafficPercent: 50, assignedUsers: 0, conversions: 0, conversionRate: 0, confidence: 0, isControl: false, color: '#8B5CF6' },
    ],
    totalUsers: 0,
    startedAt: null,
    endedAt: null,
    createdAt: daysAgo(5),
    hasWinner: false,
    tags: ['notifications', 'timing', 'engagement'],
    owner: 'Growth Team',
  },
  {
    id: 'exp_5',
    name: 'Search Bar Placement',
    description: 'Test search bar at top vs middle of markets screen.',
    featureKey: 'search_placement',
    status: 'paused',
    variants: [
      { id: 'exp_5_var_1', name: 'Control (Top)', description: 'Search at screen top', trafficPercent: 50, assignedUsers: 890, conversions: 98, conversionRate: 11.0, confidence: 0, isControl: true, color: '#6C63FF' },
      { id: 'exp_5_var_2', name: 'Variant (Middle)', description: 'Search below market indices', trafficPercent: 50, assignedUsers: 875, conversions: 112, conversionRate: 12.8, confidence: 45, isControl: false, color: '#FFC107' },
    ],
    totalUsers: 1765,
    startedAt: daysAgo(7),
    endedAt: null,
    createdAt: daysAgo(8),
    hasWinner: false,
    tags: ['search', 'markets', 'ui'],
    owner: 'Product Team',
  },
];

// ─── Store ─────────────────────────────────────────────────────────────────

interface ABTestStoreState {
  experiments: ABExperiment[];
  selectedExperimentId: string | null;

  /** CRUD operations */
  createExperiment: (name: string, description: string, featureKey: string, tags: string[], variants: Omit<ABVariant, 'id' | 'assignedUsers' | 'conversions' | 'conversionRate' | 'confidence'>[]) => string;
  updateExperiment: (id: string, updates: Partial<ABExperiment>) => void;
  deleteExperiment: (id: string) => void;

  /** Status transitions */
  startExperiment: (id: string) => void;
  pauseExperiment: (id: string) => void;
  resumeExperiment: (id: string) => void;
  completeExperiment: (id: string) => void;
  archiveExperiment: (id: string) => void;

  /** Variant management */
  addVariant: (experimentId: string, name: string, description: string, trafficPercent: number, color: string) => void;
  removeVariant: (experimentId: string, variantId: string) => void;

  /** Metric simulation */
  simulateMetrics: (experimentId: string) => void;

  /** Selection */
  selectExperiment: (id: string | null) => void;

  /** Computed */
  getExperimentById: (id: string) => ABExperiment | undefined;
  getMetricSnapshot: (experimentId: string) => ABMetricSnapshot;
  getFilteredExperiments: (status: ABTestStatus | 'all') => ABExperiment[];
}

export const useABTestStore = create<ABTestStoreState>((set, get) => ({
  experiments: mockExperiments,
  selectedExperimentId: null,

  createExperiment: (name, description, featureKey, tags, variantsData) => {
    const id = uid();
    const now = new Date().toISOString();
    const variants: ABVariant[] = variantsData.map((v, i) => ({
      id: `${id}_var_${i}`,
      name: v.name,
      description: v.description,
      trafficPercent: v.trafficPercent,
      assignedUsers: 0,
      conversions: 0,
      conversionRate: 0,
      confidence: 0,
      isControl: i === 0,
      color: v.color,
    }));

    const newExp: ABExperiment = {
      id,
      name,
      description,
      featureKey,
      status: 'draft',
      variants,
      totalUsers: 0,
      startedAt: null,
      endedAt: null,
      createdAt: now,
      hasWinner: false,
      tags,
      owner: 'You',
    };

    set(s => ({ experiments: [newExp, ...s.experiments], selectedExperimentId: id }));
    return id;
  },

  updateExperiment: (id, updates) => {
    set(s => ({
      experiments: s.experiments.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  },

  deleteExperiment: (id) => {
    set(s => ({
      experiments: s.experiments.filter(e => e.id !== id),
      selectedExperimentId: s.selectedExperimentId === id ? null : s.selectedExperimentId,
    }));
  },

  startExperiment: (id) => {
    const exp = get().experiments.find(e => e.id === id);
    if (!exp || exp.status !== 'draft') return;

    // Assign users (simulated)
    const totalUsers = randomInt(500, 3000);
    const variants = exp.variants.map(v => {
      const users = Math.round(totalUsers * (v.trafficPercent / 100));
      const conversions = randomInt(Math.round(users * 0.05), Math.round(users * 0.25));
      return {
        ...v,
        assignedUsers: users,
        conversions,
        conversionRate: computeConversionRate(conversions, users),
      };
    });

    // Compute confidence for non-control variants
    const control = variants.find(v => v.isControl);
    const updatedVariants = variants.map(v => {
      if (v.isControl || !control) return v;
      return {
        ...v,
        confidence: computeConfidence(control.conversions, control.assignedUsers, v.conversions, v.assignedUsers),
      };
    });

    set(s => ({
      experiments: s.experiments.map(e =>
        e.id === id
          ? {
              ...e,
              status: 'running' as ABTestStatus,
              variants: updatedVariants,
              totalUsers: updatedVariants.reduce((s, v) => s + v.assignedUsers, 0),
              startedAt: new Date().toISOString(),
            }
          : e
      ),
    }));
  },

  pauseExperiment: (id) => {
    set(s => ({
      experiments: s.experiments.map(e =>
        e.id === id && e.status === 'running'
          ? { ...e, status: 'paused' as ABTestStatus }
          : e
      ),
    }));
  },

  resumeExperiment: (id) => {
    set(s => ({
      experiments: s.experiments.map(e =>
        e.id === id && e.status === 'paused'
          ? { ...e, status: 'running' as ABTestStatus }
          : e
      ),
    }));
  },

  completeExperiment: (id) => {
    const exp = get().experiments.find(e => e.id === id);
    if (!exp || (exp.status !== 'running' && exp.status !== 'paused')) return;

    const nonControl = exp.variants.filter(v => !v.isControl);
    const bestVariant = nonControl.length > 0
      ? nonControl.reduce((best, v) => v.conversionRate > best.conversionRate ? v : best)
      : null;

    const hasWinner = bestVariant !== null && bestVariant.confidence >= 80;

    set(s => ({
      experiments: s.experiments.map(e =>
        e.id === id
          ? {
              ...e,
              status: 'completed' as ABTestStatus,
              endedAt: new Date().toISOString(),
              hasWinner: !!hasWinner,
              winnerVariantId: hasWinner ? bestVariant?.id : undefined,
            }
          : e
      ),
    }));
  },

  archiveExperiment: (id) => {
    set(s => ({
      experiments: s.experiments.map(e =>
        e.id === id
          ? { ...e, status: 'archived' as ABTestStatus }
          : e
      ),
    }));
  },

  addVariant: (experimentId, name, description, trafficPercent, color) => {
    const exp = get().experiments.find(e => e.id === experimentId);
    if (!exp || exp.status !== 'draft') return;

    const newId = `${experimentId}_var_${exp.variants.length}`;
    const newVariant: ABVariant = {
      id: newId,
      name,
      description,
      trafficPercent,
      assignedUsers: 0,
      conversions: 0,
      conversionRate: 0,
      confidence: 0,
      isControl: false,
      color,
    };

    set(s => ({
      experiments: s.experiments.map(e =>
        e.id === experimentId
          ? { ...e, variants: [...e.variants, newVariant] }
          : e
      ),
    }));
  },

  removeVariant: (experimentId, variantId) => {
    set(s => ({
      experiments: s.experiments.map(e =>
        e.id === experimentId
          ? {
              ...e,
              variants: e.variants.filter(v => v.id !== variantId || v.isControl),
            }
          : e
      ),
    }));
  },

  simulateMetrics: (experimentId) => {
    const exp = get().experiments.find(e => e.id === experimentId);
    if (!exp || exp.status !== 'running') return;

    // Add random traffic and conversions
    const newUsers = randomInt(50, 300);
    const newConversions = randomInt(Math.round(newUsers * 0.05), Math.round(newUsers * 0.3));

    set(s => ({
      experiments: s.experiments.map(e => {
        if (e.id !== experimentId) return e;

        // Distribute new users across variants proportionally
        const updatedVariants = e.variants.map(v => {
          const additionalUsers = Math.round(newUsers * (v.trafficPercent / 100));
          const additionalConversions = randomInt(0, Math.round(additionalUsers * 0.3));
          const totalUsers = v.assignedUsers + additionalUsers;
          const totalConversions = v.conversions + additionalConversions;
          return {
            ...v,
            assignedUsers: totalUsers,
            conversions: totalConversions,
            conversionRate: computeConversionRate(totalConversions, totalUsers),
          };
        });

        // Recompute confidence
        const control = updatedVariants.find(v => v.isControl);
        const variantsWithConfidence = updatedVariants.map(v => {
          if (v.isControl || !control) return v;
          return {
            ...v,
            confidence: computeConfidence(control.conversions, control.assignedUsers, v.conversions, v.assignedUsers),
          };
        });

        return {
          ...e,
          variants: variantsWithConfidence,
          totalUsers: variantsWithConfidence.reduce((s, v) => s + v.assignedUsers, 0),
        };
      }),
    }));
  },

  selectExperiment: (id) => set({ selectedExperimentId: id }),

  getExperimentById: (id) => get().experiments.find(e => e.id === id),

  getMetricSnapshot: (experimentId) => {
    const exp = get().experiments.find(e => e.id === experimentId);
    if (!exp) {
      return { experimentId, totalExposed: 0, totalConversions: 0, overallConversionRate: 0, liftOverControl: 0, computedAt: new Date().toISOString() };
    }

    const totalExposed = exp.totalUsers;
    const totalConversions = exp.variants.reduce((s, v) => s + v.conversions, 0);
    const overallConversionRate = totalExposed > 0 ? Math.round((totalConversions / totalExposed) * 1000) / 10 : 0;

    const control = exp.variants.find(v => v.isControl);
    const liftOverControl = control && control.assignedUsers > 0
      ? Math.round(((overallConversionRate - control.conversionRate) / control.conversionRate) * 100)
      : 0;

    return {
      experimentId,
      totalExposed,
      totalConversions,
      overallConversionRate,
      liftOverControl,
      computedAt: new Date().toISOString(),
    };
  },

  getFilteredExperiments: (status) => {
    const { experiments } = get();
    if (status === 'all') return experiments;
    return experiments.filter(e => e.status === status);
  },
}));
