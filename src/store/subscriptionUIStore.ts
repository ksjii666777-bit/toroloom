/**
 * ============================================================================
 * Toroloom — Subscription Upgrade Prompt UI Store
 * ============================================================================
 *
 * Lightweight store that controls the UpgradePromptModal overlay.
 * Triggered globally when the API client receives a 402 Payment Required
 * response from subscription-gated endpoints.
 *
 * Usage (in API client interceptor):
 *   import { upgradePromptStore } from '../../store/subscriptionUIStore';
 *   upgradePromptStore.getState().show({
 *     featureName: 'AI Insights',
 *     featureIcon: 'bulb',
 *     requiredTier: 'pro',
 *     currentTier: 'free',
 *   });
 *
 * Usage (in component):
 *   const { visible, featureName, requiredTier } = useUpgradePromptStore();
 *   if (visible) return <UpgradePromptModal />;
 *
 * ============================================================================
 */

import { create } from 'zustand';
import type { SubscriptionTier } from '../types';

export interface UpgradePromptState {
  /** Whether the upgrade modal is currently visible */
  visible: boolean;

  /** Human-readable name of the feature the user tried to access */
  featureName: string;

  /** Icon name (Ionicons) for the feature */
  featureIcon: string;

  /** The subscription tier required for this feature */
  requiredTier: SubscriptionTier;

  /** The user's current subscription tier */
  currentTier: SubscriptionTier;

  /** Show the upgrade prompt with the given feature details */
  show: (opts: {
    featureName?: string;
    featureIcon?: string;
    requiredTier: SubscriptionTier;
    currentTier: SubscriptionTier;
  }) => void;

  /** Hide/dismiss the upgrade prompt */
  hide: () => void;
}

export const useUpgradePromptStore = create<UpgradePromptState>((set) => ({
  visible: false,
  featureName: 'This feature',
  featureIcon: 'diamond',
  requiredTier: 'pro',
  currentTier: 'free',

  show: (opts) => {
    set({
      visible: true,
      featureName: opts.featureName ?? 'This feature',
      featureIcon: opts.featureIcon ?? 'diamond',
      requiredTier: opts.requiredTier,
      currentTier: opts.currentTier,
    });
  },

  hide: () => {
    set({ visible: false });
  },
}));
