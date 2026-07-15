/**
 * ============================================================================
 * Toroloom — Feature Flag & Experiment Utilities
 * ============================================================================
 *
 * Shared pure functions used by both the feature flag store and hooks.
 * Extracted to avoid code duplication while keeping selectors side-effect-free.
 *
 * ============================================================================
 */

import {
  FeatureFlagKey,
  ExperimentId,
  ExperimentConfig,
  ExperimentVariant,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_EXPERIMENTS,
} from '../types/featureFlags';

/**
 * Deterministic hash of a userId into a bucket (0-99).
 * Same userId → same bucket every time.
 */
export function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Check if a feature flag is enabled for a user, considering overrides,
 * rollout percentages, and default values.
 */
export function isFlagEnabled(
  userId: string,
  key: FeatureFlagKey,
  overrides: Partial<Record<FeatureFlagKey, boolean>>,
): boolean {
  const meta = DEFAULT_FEATURE_FLAGS[key];
  if (!meta) return false;

  // Check override first (dev/admin)
  if (key in overrides) return overrides[key]!;

  // Check rollout percentage
  if (meta.rolloutPercent !== undefined) {
    return hashUserId(userId + '_flag_' + key) < meta.rolloutPercent;
  }

  // Default value
  return meta.defaultValue;
}

/**
 * Compute the deterministic variant assignment for a user.
 * Uses userId + experiment ID as the hash seed for consistency.
 */
export function computeVariant(
  userId: string,
  experimentId: ExperimentId,
): ExperimentVariant {
  const config = DEFAULT_EXPERIMENTS[experimentId];
  if (!config || !config.isActive) return 'control';

  const bucket = hashUserId(userId + '_' + config.id);

  let cumulative = 0;
  for (let i = 0; i < config.variants.length; i++) {
    cumulative += config.weights[i];
    if (bucket < cumulative) return config.variants[i];
  }

  return 'control';
}
