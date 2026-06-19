/**
 * ============================================================================
 * Toroloom — Firebase Analytics Service
 * ============================================================================
 *
 * Type-safe wrapper around @react-native-firebase/analytics using the
 * modular (v22+) API to avoid deprecated namespaced-API warnings.
 *
 * Usage:
 *   import { analytics } from '../services/analytics';
 *   await analytics.logEvent('login', { method: 'email' });
 *   await analytics.logScreenView('Home', 'HomeScreen');
 *
 * In tests, on web, or when Firebase is unavailable, all calls are no-ops.
 * ============================================================================
 */

import { Platform } from 'react-native';
import { log } from '../utils/logger';

// Store the analytics instance and the module reference separately so we
// can call standalone modular functions (logEvent, setUserProperty, etc.)
// without the deprecated namespaced-API warning.
let analyticsInstance: any = null;
let analyticsModule: any = null;

async function getAnalytics() {
  if (analyticsInstance) return { instance: analyticsInstance, mod: analyticsModule };
  try {
    const mod = await import('@react-native-firebase/analytics');
    analyticsModule = mod;
    // Use the modular API getAnalytics() instead of the namespaced default()
    // to suppress the "getApp() is deprecated" warning.
    analyticsInstance = mod.getAnalytics();
    return { instance: analyticsInstance, mod: analyticsModule };
  } catch {
    // Firebase not available (web, test, or missing native module)
    return null;
  }
}

// ============ Event Definitions ============

export interface AnalyticsEvents {
  login: { method: 'email' | 'google' | 'apple' };
  signup: { method: 'email' | 'google' | 'apple' };
  logout: {};
  stock_view: { symbol: string; name: string; sector?: string };
  stock_add_to_watchlist: { symbol: string };
  stock_remove_from_watchlist: { symbol: string };
  order_placed: { symbol: string; type: 'buy' | 'sell'; quantity: number; value: number };
  order_executed: { symbol: string; type: 'buy' | 'sell'; quantity: number; value: number };
  portfolio_view: {};
  course_started: { courseId: string; courseName: string };
  lesson_completed: { courseId: string; lessonId: string };
  ai_insight_viewed: { symbol: string };
  community_post_created: {};
  community_post_liked: {};
  notification_opened: { type: string };
  onboarding_completed: { completed: boolean; skipped?: boolean; replay?: boolean };
  onboarding_started: { source: string; variant: 'default' | 'referral' };
  funds_added: { amount: number; method: string };
  funds_withdrawn: { amount: number };
  error_occurred: { code: string; message: string; screen?: string };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

// ============ Public API ============

export const analytics = {
  /**
   * Log a custom event with type-safe parameters.
   * No-ops if Firebase is not available.
   */
  async logEvent<T extends AnalyticsEventName>(
    name: T,
    params: AnalyticsEvents[T],
  ): Promise<void> {
    try {
      const fa = await getAnalytics();
      if (fa) {
        await fa.mod.logEvent(fa.instance, name, params as Record<string, any>);
      }
    } catch (err) {
      log.debug('[Analytics] Failed to log event:', name, err);
    }
  },

  /**
   * Log a screen view (automatically called by the navigation listener).
   * No-ops if Firebase is not available.
   *
   * Uses logEvent('screen_view', ...) instead of the deprecated logScreenView().
   */
  async logScreenView(
    screenName: string,
    screenClass?: string,
  ): Promise<void> {
    try {
      const fa = await getAnalytics();
      if (fa) {
        await fa.mod.logEvent(fa.instance, 'screen_view', {
          screen_name: screenName,
          screen_class: screenClass || screenName,
        });
      }
    } catch (err) {
      log.debug('[Analytics] Failed to log screen view:', screenName, err);
    }
  },

  /**
   * Set user-level properties (e.g., kyc_status, plan_tier).
   * These persist across sessions in Firebase.
   */
  async setUserProperty(
    name: string,
    value: string | null,
  ): Promise<void> {
    try {
      const fa = await getAnalytics();
      if (fa) {
        await fa.mod.setUserProperty(fa.instance, name, value);
      }
    } catch (err) {
      log.debug('[Analytics] Failed to set user property:', name, err);
    }
  },

  /**
   * Set user ID for cross-session analysis.
   * Use the Toroloom user ID (not PII like email).
   */
  async setUserId(userId: string | null): Promise<void> {
    try {
      const fa = await getAnalytics();
      if (fa) {
        await fa.mod.setUserId(fa.instance, userId);
      }
    } catch (err) {
      log.debug('[Analytics] Failed to set user ID:', err);
    }
  },

  /**
   * Reset analytics state (call on logout).
   */
  async reset(): Promise<void> {
    try {
      const fa = await getAnalytics();
      if (fa) {
        await fa.mod.resetAnalyticsData(fa.instance);
      }
    } catch (err) {
      log.debug('[Analytics] Failed to reset:', err);
    }
  },
};

export default analytics;
