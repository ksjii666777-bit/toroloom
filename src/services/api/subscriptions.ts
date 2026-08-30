/**
 * ============================================================================
 * Toroloom Subscriptions API Client
 * ============================================================================
 *
 * Communicates with the backend /api/subscriptions endpoints for
 * subscription management after payment verification.
 *
 *   getCurrent()                    → GET  /api/subscriptions/current
 *   upgrade(planId, billingPeriod)  → POST /api/subscriptions/upgrade
 *   cancel()                        → POST /api/subscriptions/cancel
 *   checkFeature(feature)           → POST /api/subscriptions/check-feature
 * ============================================================================
 */

import { api } from './client';
import type { UserSubscription } from '../../types';

const BASE = '/subscriptions';

export interface SubscriptionResponse {
  success: boolean;
  subscription: UserSubscription;
  message: string;
}

export interface FeatureCheckResponse {
  feature: string;
  userTier: string;
  minTier: string;
  hasAccess: boolean;
}

export const subscriptionsApi = {
  /**
   * Get the current user's subscription from the backend.
   */
  getCurrent: async (): Promise<UserSubscription> => {
    return api.get<UserSubscription>(`${BASE}/current`);
  },

  /**
   * Record a plan upgrade on the backend (called after successful Razorpay payment).
   */
  upgrade: async (
    planId: string,
    billingPeriod: 'monthly' | 'yearly' = 'monthly',
    razorpayOrderId?: string,
    tenantId?: string,
  ): Promise<SubscriptionResponse> => {
    return api.post<SubscriptionResponse>(`${BASE}/upgrade`, {
      planId,
      billingPeriod,
      razorpayOrderId,
      tenantId,
    });
  },

  /**
   * Cancel auto-renewal on the backend.
   */
  cancel: async (): Promise<SubscriptionResponse> => {
    return api.post<SubscriptionResponse>(`${BASE}/cancel`, {});
  },

  /**
   * Check if the user has access to a specific feature.
   */
  checkFeature: async (feature: string): Promise<FeatureCheckResponse> => {
    return api.post<FeatureCheckResponse>(`${BASE}/check-feature`, { feature });
  },
};
