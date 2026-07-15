/**
 * ============================================================================
 * Toroloom — Feature Flag & Experiment Hooks
 * ============================================================================
 *
 * Convenience React hooks for consuming feature flags and A/B experiments
 * from the Zustand store.
 *
 * Usage:
 *   // Simple boolean feature flag
 *   const showNewDashboard = useFlag('new_home_dashboard');
 *   if (showNewDashboard) return <NewDashboard />;
 *
 *   // A/B experiment variant
 *   const variant = useExperiment('onboarding_flow_v2');
 *   if (variant === 'variant_a') return <OnboardingV2 />;
 *
 *   // Get all experiment assignments for analytics
 *   const experiments = useAllExperiments();
 * ============================================================================
 */

import { useFeatureFlagStore } from '../store/featureFlagStore';
import {
  FeatureFlagKey,
  ExperimentId,
  ExperimentVariant,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_EXPERIMENTS,
} from '../types/featureFlags';
import { isFlagEnabled, computeVariant } from '../utils/featureFlagUtils';

// ──── Hooks ───────────────────────────────────────────────────────────────

/**
 * Check if a feature flag is enabled for the current user.
 * Re-renders when the flag's state changes (via override).
 *
 * @example
 *   const showAI = useFlag('ai_recommendations');
 *   {showAI && <AIRecommendations />}
 */
export function useFlag(key: FeatureFlagKey): boolean {
  return useFeatureFlagStore((s) => isFlagEnabled(s.userId, key, s.overrides));
}

/**
 * Get the current user's assigned variant for an A/B experiment.
 * Falls back to 'control' if the experiment is not active.
 *
 * @example
 *   const variant = useExperiment('home_layout_test');
 *   if (variant === 'variant_a') return <LayoutB />;
 */
export function useExperiment(experimentId: ExperimentId): ExperimentVariant {
  return useFeatureFlagStore((s) => {
    // Use persisted assignment if available
    if (experimentId in s.experimentAssignments) {
      return s.experimentAssignments[experimentId]!;
    }
    return computeVariant(s.userId, experimentId);
  });
}

/**
 * Check if a user is enrolled in an active experiment.
 */
export function useIsEnrolled(experimentId: ExperimentId): boolean {
  const variant = useExperiment(experimentId);
  const config = DEFAULT_EXPERIMENTS[experimentId];
  if (!config || !config.isActive) return false;
  return variant !== 'control';
}

/**
 * Get all feature flag states as a flat record (for analytics logging).
 *
 * @example
 *   const flags = useAllFlagsRecord();
 *   analytics.logEvent('page_view', { flags });
 */
export function useAllFlagsRecord(): Record<string, boolean> {
  return useFeatureFlagStore((s) => {
    const result: Record<string, boolean> = {};
    for (const key of Object.keys(DEFAULT_FEATURE_FLAGS)) {
      result[key] = isFlagEnabled(s.userId, key as FeatureFlagKey, s.overrides);
    }
    return result;
  });
}

/**
 * Get all experiment assignments.
 */
export function useAllExperiments(): Array<{ id: string; variant: ExperimentVariant; isActive: boolean }> {
  return useFeatureFlagStore((s) => {
    return Object.keys(DEFAULT_EXPERIMENTS).map((id) => {
      const eid = id as ExperimentId;
      const config = DEFAULT_EXPERIMENTS[eid];
      const variant = eid in s.experimentAssignments
        ? s.experimentAssignments[eid]!
        : computeVariant(s.userId, eid);
      return { id, variant, isActive: config?.isActive ?? false };
    });
  });
}
