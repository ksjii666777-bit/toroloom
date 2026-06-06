/**
 * ============================================================================
 * Toroloom — Sentry Crash Reporting (Frontend)
 * ============================================================================
 *
 * Initialises Sentry for the React Native / Expo app.
 *
 * The DSN is read from `EXPO_PUBLIC_SENTRY_DSN` (Expo SDK 52+ public env var)
 * so it can be set in `.env` locally and in the CI/CD build environment.
 *
 * Usage:
 *   import '../services/sentry';     // side-effect init only
 *   import * as Sentry from '@sentry/react-native';
 *   Sentry.captureException(error);   // manual capture
 *
 * In development, no events are sent unless `SENTRY_DSN` is explicitly set.
 * ============================================================================
 */

import * as Sentry from '@sentry/react-native';

const SENTRY_DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  process.env.SENTRY_DSN ||
  '';

const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Send only warn/error events in dev; all in production
    enabled: true,
    environment: IS_DEV ? 'development' : 'production',
    tracesSampleRate: IS_DEV ? 0.1 : 0.5,
    // Attach screenshots on crash (native only)
    attachScreenshot: true,
  });
}

export default Sentry;
