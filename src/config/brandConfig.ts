/**
 * ============================================================================
 * 🏷️ BRAND CONFIGURATION — White-Label Ready
 * ============================================================================
 *
 * To rebrand this app for your business, edit ONLY this file.
 * All user-facing brand references throughout the codebase read from here.
 *
 * HOW TO REBRAND:
 *   1. Change `appName` to your company name
 *   2. Replace `assets/logo.png` and `assets/icon.png` with your logo
 *   3. Update `primaryColor` to your brand color
 *   4. Set `supportEmail` and `website` to your own
 *   5. Run `npx react-native-asset` to link new assets
 *   6. Update app.json: change `name`, `slug`, `bundleIdentifier`, `package`
 *
 * For a full automated rebrand, run:  node scripts/rebrand.mjs
 * ============================================================================
 */

export const BRAND = {
  // ──── Identity ───────────────────────────────────────────────────────
  /** Short app name (used in UI, server banners, certificates) */
  appName: 'Toroloom',

  /** Hindi app name */
  appNameHindi: 'टोरोलूम',

  /** App tagline / subtitle */
  tagline: 'AI-Powered Trading & Investment Platform',

  /** Company / organization name (used in certificates, emails) */
  companyName: 'Toroloom Technologies',

  /** App slug for URL and package naming */
  slug: 'toroloom',

  // ──── Assets ─────────────────────────────────────────────────────────
  /** Path to the main logo component */
  logoComponent: 'ToroloomLogo',

  /** App icon path (static assets) */
  iconPath: require('../../assets/icon.png'),

  /** Splash screen / adaptive icon */
  splashIcon: 'ToroloomSplash',

  // ──── Colors ─────────────────────────────────────────────────────────
  /** Primary brand color (used in gradients, buttons, highlights) */
  primaryColor: '#6C63FF',

  /** Secondary brand color */
  secondaryColor: '#10B981',

  /** Gradient used in login screen and key UI */
  primaryGradient: ['#6C63FF', '#10B981'] as [string, string],

  // ──── Contact & Links ────────────────────────────────────────────────
  /** Support email displayed in settings, error pages, etc. */
  supportEmail: 'support@toroloom.app',

  /** Website URL */
  website: 'https://toroloom.app',

  /** Terms of service URL */
  termsUrl: 'https://toroloom.app/terms',

  /** Privacy policy URL */
  privacyUrl: 'https://toroloom.app/privacy',

  // ──── Legal ──────────────────────────────────────────────────────────
  /** Copyright notice */
  copyright: `© ${new Date().getFullYear()} Toroloom Technologies. All rights reserved.`,

  // ──── Platform Configuration ─────────────────────────────────────────
  /** Package name / bundle identifier prefix */
  packagePrefix: 'com.toroloom',

  /** Default app variant for EAS builds */
  defaultVariant: 'production',

  // ──── Feature Flags ──────────────────────────────────────────────────
  /** Show branding in share messages (e.g. "via Toroloom") */
  showBrandAttribution: true,
} as const;

/**
 * Helper to get the app name with optional variant suffix.
 * Used by app.config.js for EAS build variants.
 */
export function getAppName(variant: 'development' | 'preview' | 'production' = 'production'): string {
  if (variant === 'development') return `${BRAND.appName} (Dev)`;
  if (variant === 'preview') return `${BRAND.appName} (Preview)`;
  return BRAND.appName;
}

/**
 * Get the bundle identifier for a given variant.
 */
export function getBundleIdentifier(variant: 'development' | 'preview' | 'production' = 'production'): string {
  const base = BRAND.packagePrefix;
  if (variant === 'development') return `${base}.app.dev`;
  if (variant === 'preview') return `${base}.app.preview`;
  return `${base}.app`;
}

export default BRAND;
