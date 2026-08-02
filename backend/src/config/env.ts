/**
 * ============================================================================
 * Toroloom — Enterprise Environment Configuration
 * ============================================================================
 *
 * ACQUISITION COMPLIANCE MANDATE:
 *   Zero hardcoded credentials, endpoints, or secrets.
 *   Every cloud resource, database, broker API, and service account must be
 *   configured exclusively via runtime environment variables.
 *
 *   The acquiring organization can switch providers (AWS RDS → on-premise
 *   PostgreSQL, Railway → GCP, etc.) by changing DATABASE_URL and related
 *   variables — no code changes required.
 *
 * SAFE DEFAULTS (non-sensitive, infra-agnostic):
 *   PORT, NODE_ENV, JWT_EXPIRES_IN, STORAGE_BACKEND, DATA_SOURCE, BROKER
 *   These are operational defaults, not credentials.
 *
 * EMPTY-STRING DEFAULTS (secrets / endpoints — must be set by operator):
 *   JWT_SECRET, DATABASE_URL, MONGODB_URI, REDIS_URL, all API keys
 *   The application degrades gracefully or refuses to start with a clear
 *   diagnostic message when these are missing.
 *
 * USAGE:
 *   import { env } from '../config/env';
 *   if (!env.jwtSecret) { throw new Error('JWT_SECRET is required'); }
 *
 * ============================================================================
 */

import dotenv from 'dotenv';
import path from 'path';

// Snapshot whether the DB URIs were ALREADY provided by the real execution
// environment (CI / shell) BEFORE dotenv loads backend/.env. dotenv never
// overrides existing env vars, so these booleans tell us which values would
// be coming from backend/.env vs. from the environment itself.
const dbUriPreDotenv = {
  mongodbUri: !!process.env.MONGODB_URI,
  databaseUrl: !!process.env.DATABASE_URL,
};

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Under Vitest, dev/prod DB URIs loaded from backend/.env must NOT leak into
// test runs — they would flip hasTestMongo/hasTestPostgres to true and force
// the Mongo/Postgres integration suites to attempt real connections instead
// of skipping cleanly. Values explicitly provided by the real environment
// (e.g. CI) are preserved. All other .env values (JWT_SECRET, BROKER, etc.)
// still load as before.
if (process.env.VITEST === 'true') {
  if (!dbUriPreDotenv.mongodbUri) delete process.env.MONGODB_URI;
  if (!dbUriPreDotenv.databaseUrl) delete process.env.DATABASE_URL;
}

export const env = {
  // ──── Safe operational defaults (not credentials) ────────────────────────
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  dataSource: (process.env.DATA_SOURCE || 'mock') as 'mock' | 'live',
  broker: (process.env.BROKER || 'mock') as 'mock' | 'zerodha' | 'angel' | 'groww',

  // ──── Storage Backend ────────────────────────────────────────────────
  // 'memory'   → InMemoryStorage (default, no deps)
  // 'postgres' → PostgreSQLStorage (requires DATABASE_URL)
  // 'mongodb'  → MongoDBStorage (requires MONGODB_URI + MONGODB_DB_NAME)
  // Trimmed so dashboard copy-paste whitespace (e.g. "postgres ") doesn't
  // silently fall back to memory — getStorage() matches values exactly.
  storageBackend: (process.env.STORAGE_BACKEND?.trim() || 'memory') as 'memory' | 'postgres' | 'mongodb',

  // ──── ZERO-HARDCODING ZONE — all blank below ─────────────────────────
  // Each must be set via the execution environment. No fallback values
  // that leak infrastructure identity.

  /** REQUIRED for auth. App startup MUST fail if this is empty in production. */
  jwtSecret: process.env.JWT_SECRET || '',

  /** Connection string for the primary database. Provider-agnostic. */
  // Trimmed — dashboard copy-paste whitespace would otherwise break the pg
  // connection string (same risk as STORAGE_BACKEND above).
  databaseUrl: process.env.DATABASE_URL?.trim() || '',

  /** MongoDB URI (alternative storage backend). */
  mongodbUri: process.env.MONGODB_URI?.trim() || '',

  /** MongoDB database name. */
  mongodbDbName: process.env.MONGODB_DB_NAME || '',

  // ──── Broker Credentials — REMOVED per Zero-API Gateway mandate ────
  // All broker connections are handled via WebView session extraction
  // (SecureSessionSync → sessionStorage → proxyClient). No developer
  // API keys, API secrets, trading passwords, or TOTP secrets are
  // stored or managed by the platform backend.
  //
  // The BROKER env var (below) selects only the data mode:
  //   'mock'     → simulated data (default)
  //   'zerodha'  → Zerodha backend plugin (legacy)
  //   'angel'    → Angel One backend plugin (legacy)
  //   'groww'    → Groww backend plugin (legacy)
  //
  // For production, frontend proxyClient.ts handles all broker data
  // requests using encrypted session tokens stored in device keychain.

  // ──── AI Configuration ──────────────────────────────────────────────
  aiProvider: (process.env.AI_PROVIDER || 'openrouter') as 'openrouter' | 'google' | 'choreo',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-001',
  googleGeminiApiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
  googleGeminiModel: process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.0-flash-lite-001',

  /** Choreo API Gateway — Anthropic Claude (via Choreo managed subscription) */
  choreoClaudeApiKey: process.env.CHOREO_CLAUDE_API_KEY || '',
  choreoClaudeEndpoint: process.env.CHOREO_CLAUDE_ENDPOINT || 'https://eg-e521a28e-6678-46f8-806b-9f325829eaaa-dev.e1-us-east-azure.bijiraapis.dev/default/anthropic-claude-api/v1.0',
  choreoClaudeModel: process.env.CHOREO_CLAUDE_MODEL || 'claude-sonnet-4-20250514',

  // ──── SnapTrade (Unified Broker OAuth) ────────────────────────────────
  /** SnapTrade Client ID from https://snaptrade.com/dashboard */
  snapTradeClientId: process.env.SNAPTRADE_CLIENT_ID || '',
  /** SnapTrade Consumer Key from https://snaptrade.com/dashboard */
  snapTradeConsumerKey: process.env.SNAPTRADE_CONSUMER_KEY || '',

  // ──── Payments ───────────────────────────────────────────────────────
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',

  // ──── External API Keys ──────────────────────────────────────────────
  /** Telegram Bot Token for sending trading alerts to users */
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',

  /** Upstox API Client ID for OAuth 2.0 flow */
  upstoxClientId: process.env.UPSTOX_CLIENT_ID || '',

  /** Upstox API Client Secret for OAuth 2.0 flow */
  upstoxClientSecret: process.env.UPSTOX_CLIENT_SECRET || '',

  /** Upstox OAuth Redirect URI */
  upstoxRedirectUri: process.env.UPSTOX_REDIRECT_URI || '',

  /** Angel One SmartAPI developer API key (server-level, free from smartapi.angelbroking.com) */
  angelSmartApiKey: process.env.ANGEL_SMARTAPI_KEY || '',

  /** MarketStack API key for real-time stock prices and market data */
  marketstackKey: process.env.MARKETSTACK_KEY || '',

  /** API Ninjas key for commodity price data (https://api-ninjas.com) */
  commodityApiKey: process.env.COMMODITY_API_KEY || '',

  /** FRED API key for US Treasury yields and bond market data (https://fred.stlouisfed.org) */
  fredApiKey: process.env.FRED_API_KEY || '',

  /** NewsAPI.org key for financial news articles */
  newsApiKey: process.env.NEWSAPI_KEY || '',

  /** CORS allowed origins. Comma-separated list. Default: * (dev only — set in production!) */
  corsOrigin: process.env.CORS_ORIGIN || '*',

  /** Encryption key for SnapTrade userSecrets (REQUIRED in production — app warns on missing) */
  snapTradeEncryptionKey: process.env.SNAPTRADE_ENCRYPTION_KEY || '',

  // ──── Error Tracking ─────────────────────────────────────────────────
  sentryDsn: process.env.SENTRY_DSN || '',

  // ──── Redis ──────────────────────────────────────────────────────────
  /** REDIS_URL or RAILWAY_REDIS_URL (auto-injected by Railway Redis plugin) */
  redisUrl: process.env.REDIS_URL || process.env.RAILWAY_REDIS_URL || '',

  // ──── Cache Configuration ────────────────────────────────────────────
  /** TTL in seconds for backtest historical data cache (default: 3600 = 1 hour) */
  backtestCacheTtl: parseInt(process.env.BACKTEST_CACHE_TTL || '3600', 10),

  /** TTL in seconds for market data cache (default: 600 = 10 min) */
  marketDataCacheTtl: parseInt(process.env.MARKET_DATA_CACHE_TTL || '600', 10),

  /** Max cache entries before eviction (to prevent memory leaks) */
  cacheMaxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '200', 10),

  // ──── Feature Flags ──────────────────────────────────────────────────
  /** Enable subscription feature gating middleware globally */
  subscriptionGatingEnabled: process.env.SUBSCRIPTION_GATING_ENABLED === 'true',

  /** Whether Redis is available (injected by Railway or set manually) */
  get hasRedis(): boolean {
    return !!(process.env.REDIS_URL || process.env.RAILWAY_REDIS_URL);
  },

  get isDev() {
    return this.nodeEnv === 'development';
  },
  get isMock() {
    return this.dataSource === 'mock';
  },
} as const;

/**
 * Validate that REQUIRED secrets are set.
 * Call this at app startup before serving traffic.
 * Returns a list of missing variables; empty array = all good.
 */
export function validateRequiredEnv(): string[] {
  const missing: string[] = [];
  const isProduction = env.nodeEnv === 'production' || !env.isMock;

  if (!env.jwtSecret) {
    missing.push('JWT_SECRET');
  }

  if (env.storageBackend === 'postgres' && !env.databaseUrl) {
    missing.push('DATABASE_URL');
  }

  if (env.storageBackend === 'mongodb' && !env.mongodbUri) {
    missing.push('MONGODB_URI');
  }

  if (isProduction && env.corsOrigin === '*') {
    console.warn(
      '[env] WARNING: CORS_ORIGIN is set to "*" — any website can call your API.\n' +
      '      Set CORS_ORIGIN to your app domain(s) (comma-separated) in production.',
    );
  }

  if (isProduction && !env.snapTradeEncryptionKey) {
    console.warn(
      '[env] WARNING: SNAPTRADE_ENCRYPTION_KEY not set. Broker session tokens will use DEV key.\n' +
      '      Generate a key with: openssl rand -hex 32',
    );
  }

  // In production, warn if no AI keys are configured (the app will return mock data)
  if (isProduction && !env.openRouterApiKey && !env.googleGeminiApiKey && !env.choreoClaudeApiKey) {
    console.warn(
      '[env] WARNING: No AI provider configured (OPENROUTER_API_KEY / GOOGLE_GEMINI_API_KEY / CHOREO_CLAUDE_API_KEY).\n' +
      '      AI analysis endpoints will return mock/fallback data.',
    );
  }

  return missing;
}
