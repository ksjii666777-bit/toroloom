/**
 * ============================================================================
 * Toroloom — Feature Flags & A/B Testing Store
 * ============================================================================
 *
 * Zustand-powered experiment framework with:
 *   - Feature flags with gradual rollout (% of users)
 *   - A/B experiments with deterministic bucketing (userId → hash)
 *   - Override support for dev/testing
 *   - AsyncStorage persistence for overrides
 *
 * Usage:
 *   import { useFeatureFlagStore } from '../../store';
 *
 *   // Check a feature flag
 *   const isEnabled = useFeatureFlagStore(s => s.isEnabled('new_home_dashboard'));
 *
 *   // Get experiment variant
 *   const variant = useFeatureFlagStore(s => s.getVariant('home_layout_test'));
 *
 *   // Override a flag (dev mode)
 *   useFeatureFlagStore.getState().overrideFlag('new_home_dashboard', true);
 * ============================================================================
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FeatureFlagKey,
  FeatureFlagMeta,
  ExperimentId,
  ExperimentConfig,
  ExperimentVariant,
  ExperimentAssignment,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_EXPERIMENTS,
} from '../types/featureFlags';
import { hashUserId, isFlagEnabled, computeVariant } from '../utils/featureFlagUtils';

// ──── Storage Keys ────────────────────────────────────────────────────────

const STORAGE_KEY_OVERRIDES = 'toroloom_feature_flag_overrides';
const STORAGE_KEY_ASSIGNMENTS = 'toroloom_experiment_assignments';

// ──── Deterministic Bucketing ─────────────────────────────────────────────
// Shared utility functions are in src/utils/featureFlagUtils.ts

// ──── Store Interface ─────────────────────────────────────────────────────

interface FeatureFlagState {
  // ──── State ────────────────────────────────────────────
  /** Feature flag overrides (set manually by dev/admin) */
  overrides: Partial<Record<FeatureFlagKey, boolean>>;
  /** Experiment variant assignments (persisted per user) */
  experimentAssignments: Partial<Record<ExperimentId, ExperimentVariant>>;
  /** Current user ID (set at app init for bucketing) */
  userId: string;
  /** Whether the store has been hydrated from AsyncStorage */
  hydrated: boolean;

  // ──── Actions ──────────────────────────────────────────
  /** Initialize the store (call at app startup) */
  initialize: (userId: string) => Promise<void>;
  /** Check if a feature flag is enabled */
  isEnabled: (key: FeatureFlagKey) => boolean;
  /** Get the experiment variant for the current user */
  getVariant: (experimentId: ExperimentId) => ExperimentVariant;
  /** Get full experiment assignment details */
  getExperiment: (experimentId: ExperimentId) => ExperimentAssignment | null;
  /** Override a feature flag (dev mode) */
  overrideFlag: (key: FeatureFlagKey, enabled: boolean) => Promise<void>;
  /** Override an experiment variant (dev mode) */
  overrideExperiment: (experimentId: ExperimentId, variant: ExperimentVariant) => Promise<void>;
  /** Reset all overrides */
  resetOverrides: () => Promise<void>;
  /** Get all flag states (for debug screen) */
  getAllFlags: () => Array<{ key: FeatureFlagKey; meta: FeatureFlagMeta; enabled: boolean; overridden: boolean }>;
  /** Get all experiment states (for debug screen) */
  getAllExperiments: () => ExperimentAssignment[];
}

// ──── Store ───────────────────────────────────────────────────────────────

export const useFeatureFlagStore = create<FeatureFlagState>((set, get) => ({
  overrides: {},
  experimentAssignments: {},
  userId: 'anonymous',
  hydrated: false,

  // ──── Initialize ───────────────────────────────────────

  initialize: async (userId: string) => {
    try {
      const storedOverrides = await AsyncStorage.getItem(STORAGE_KEY_OVERRIDES);
      const storedAssignments = await AsyncStorage.getItem(STORAGE_KEY_ASSIGNMENTS);

      const overrides: Partial<Record<FeatureFlagKey, boolean>> = storedOverrides
        ? JSON.parse(storedOverrides)
        : {};

      const experimentAssignments: Partial<Record<ExperimentId, ExperimentVariant>> = storedAssignments
        ? JSON.parse(storedAssignments)
        : {};

      set({ overrides, experimentAssignments, userId, hydrated: true });
    } catch {
      set({ userId, hydrated: true });
    }
  },

  // ──── Feature Flags ────────────────────────────────────

  isEnabled: (key: FeatureFlagKey) => {
    const { overrides, userId } = get();
    return isFlagEnabled(userId, key, overrides);
  },

  // ──── Experiments ──────────────────────────────────────

  getVariant: (experimentId: ExperimentId) => {
    const { experimentAssignments, userId } = get();
    const config = DEFAULT_EXPERIMENTS[experimentId];

    if (!config) return 'control';

    // Check persisted assignment first
    if (experimentId in experimentAssignments) {
      return experimentAssignments[experimentId]!;
    }

    // If experiment is not active, return control
    if (!config.isActive) return 'control';

    // Compute deterministic assignment using shared utility
    const variant = computeVariant(userId, experimentId);

    // Persist the assignment
    set((s) => ({
      experimentAssignments: { ...s.experimentAssignments, [experimentId]: variant },
    }));

    return variant;
  },

  getExperiment: (experimentId: ExperimentId) => {
    const config = DEFAULT_EXPERIMENTS[experimentId];
    if (!config) return null;

    const variant = get().getVariant(experimentId);
    const isEnrolled = config.isActive && variant !== 'control';
    const assignedVariant = isEnrolled ? variant : 'control';

    return {
      config,
      assignedVariant,
      isEnrolled,
    };
  },

  // ──── Override Actions ─────────────────────────────────

  overrideFlag: async (key: FeatureFlagKey, enabled: boolean) => {
    const { overrides } = get();
    const updated: Partial<Record<FeatureFlagKey, boolean>> = {
      ...overrides,
      [key]: enabled,
    };

    set({ overrides: updated });

    try {
      await AsyncStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(updated));
    } catch {
      // Non-critical — overrides re-appliable
    }
  },

  overrideExperiment: async (experimentId: ExperimentId, variant: ExperimentVariant) => {
    const { experimentAssignments } = get();
    const updated: Partial<Record<ExperimentId, ExperimentVariant>> = {
      ...experimentAssignments,
      [experimentId]: variant,
    };

    set({ experimentAssignments: updated });

    try {
      await AsyncStorage.setItem(STORAGE_KEY_ASSIGNMENTS, JSON.stringify(updated));
    } catch {
      // Non-critical
    }
  },

  resetOverrides: async () => {
    set({ overrides: {}, experimentAssignments: {} });

    try {
      await AsyncStorage.multiRemove([STORAGE_KEY_OVERRIDES, STORAGE_KEY_ASSIGNMENTS]);
    } catch {
      // Non-critical
    }
  },

  // ──── Debug / Dev Helpers ──────────────────────────────

  getAllFlags: () => {
    const { overrides, userId } = get();
    const entries = Object.entries(DEFAULT_FEATURE_FLAGS) as Array<[FeatureFlagKey, FeatureFlagMeta]>;

    return entries.map(([key, meta]) => {
      const isOverridden = key in overrides;
      let enabled: boolean;

      if (isOverridden) {
        enabled = overrides[key]!;
      } else if (meta.rolloutPercent !== undefined) {
        enabled = hashUserId(userId + '_flag_' + key) < meta.rolloutPercent;
      } else {
        enabled = meta.defaultValue;
      }

      return { key, meta, enabled, overridden: isOverridden };
    });
  },

  getAllExperiments: () => {
    const entries = Object.entries(DEFAULT_EXPERIMENTS) as Array<[ExperimentId, ExperimentConfig]>;
    return entries.map(([id, config]) => {
      const assignment = get().getExperiment(id);
      return assignment || { config, assignedVariant: 'control' as ExperimentVariant, isEnrolled: false };
    });
  },
}));
