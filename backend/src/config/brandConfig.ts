/**
 * ============================================================================
 * 🏷️ BACKEND BRAND CONFIGURATION — White-Label Ready
 * ============================================================================
 *
 * Central config for backend brand references — server banners,
 * cache prefixes, queue names, and log prefixes.
 *
 * To rebrand: edit ONLY this file, then run the rebrand script for
 * automated search-replace of internal comments and test references.
 *
 * ============================================================================
 */

export const BRAND = {
  // ──── Identity ───────────────────────────────────────────────────────
  appName: 'Toroloom',
  slug: 'toroloom',
  companyName: 'Toroloom Technologies',

  // ──── Server ─────────────────────────────────────────────────────────
  /** Server banner shown at startup */
  serverBanner: '🚀 Toroloom Backend Server',

  /** Cluster primary banner */
  clusterBanner: '🚀 Toroloom Backend Cluster',

  // ──── Cache & Queue Namespaces ────────────────────────────────────
  /** Redis key prefix */
  cachePrefix: 'toroloom:cache:',

  /** Database application name (used in PostgreSQL connection) */
  dbAppName: 'toroloom',

  /** BullMQ queue prefix */
  queuePrefix: 'toroloom',

  // ──── API Key Prefix ─────────────────────────────────────────────
  /** Prefix for generated API keys (e.g. "tol_" + random chars) */
  apiKeyPrefix: 'tol_',

  // ──── Crypto ─────────────────────────────────────────────────────
  /** Salt for encryption key derivation */
  cryptoSalt: 'toroloom-salt',

  /** Dev-only fallback key name */
  devKeyName: 'toroloom-dev-only-key-do-not-use-in-production',

  // ──── Logging ────────────────────────────────────────────────────
  /** Cache service log prefix */
  cacheLogPrefix: '[CacheService]',
} as const;

export default BRAND;
