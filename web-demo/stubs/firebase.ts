/**
 * Web stub for `@react-native-firebase/app` and `@react-native-firebase/analytics`.
 *
 * `services/analytics.ts` lazy-imports `@react-native-firebase/analytics`; the
 * real packages deep-import react-native internals that don't exist in
 * react-native-web. The demo never calls analytics, so no-ops are fine.
 */

const noop = async (): Promise<void> => undefined;

const createAnalytics = () => ({
  logEvent: noop,
  setUserId: noop,
  setUserProperties: noop,
  setCurrentScreen: noop,
  logLogin: noop,
  logSignUp: noop,
  logScreenView: noop,
  logPurchase: noop,
  logAddToCart: noop,
  logEcommercePurchase: noop,
  setAnalyticsCollectionEnabled: noop,
  setSessionTimeoutDuration: noop,
});

const app = {
  initializeApp: noop,
  deleteApp: noop,
  apps: [] as unknown[],
  app: () => undefined,
  utils: { getApp: () => undefined },
  messaging: () => undefined,
};

/** Callable default export — analytics.ts calls `mod.default().logEvent(...)`. */
export default createAnalytics;
export { createAnalytics as analytics, app as firebase, noop as initializeApp };
