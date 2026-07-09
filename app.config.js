// ============================================================================
// Toroloom — App Configuration (Dynamic)
// ============================================================================
// Reads base config from app.json and overrides with environment-specific
// values for EAS Build (development, preview, production).
//
// Environment variables (set in eas.json or via CLI):
//   EXPO_PUBLIC_API_URL     — Backend API base URL
//   EXPO_PUBLIC_SENTRY_DSN  — Sentry DSN for error tracking
//   APP_VARIANT             — 'development' | 'preview' | 'production'
// ============================================================================

const baseConfig = require('./app.json');

const APP_VARIANT = process.env.APP_VARIANT || 'production';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://toroloom-production.up.railway.app/api';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

// Variant-specific config
const variants = {
  development: {
    name: 'Toroloom (Dev)',
    ios: { bundleIdentifier: 'com.toroloom.app.dev' },
    android: { package: 'com.toroloom.app.dev' },
  },
  preview: {
    name: 'Toroloom (Preview)',
    ios: { bundleIdentifier: 'com.toroloom.app.preview' },
    android: { package: 'com.toroloom.app.preview' },
  },
  production: {
    name: 'Toroloom',
    ios: { bundleIdentifier: 'com.toroloom.app' },
    android: { package: 'com.toroloom.app' },
  },
};

const variant = variants[APP_VARIANT] || variants.production;

module.exports = ({ config }) => ({
  ...config,
  ...baseConfig.expo,
  name: variant.name,
  extra: {
    ...baseConfig.expo.extra,
    apiUrl: API_URL,
    sentryDsn: SENTRY_DSN,
    appVariant: APP_VARIANT,
  },
  ios: {
    ...config.ios,
    ...variant.ios,
  },
  android: {
    ...config.android,
    ...variant.android,
  },
  plugins: [
    ...(baseConfig.expo.plugins || []),
    'expo-video',
  ],
});
