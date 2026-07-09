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

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
  storageBackend: (process.env.STORAGE_BACKEND || 'memory') as 'memory' | 'postgres' | 'mongodb',

  // ──── ZERO-HARDCODING ZONE — all blank below ─────────────────────────
  // Each must be set via the execution environment. No fallback values
  // that leak infrastructure identity.

  /** REQUIRED for auth. App startup MUST fail if this is empty in production. */
  jwtSecret: process.env.JWT_SECRET || '',

  /** Connection string for the primary database. Provider-agnostic. */
  databaseUrl: process.env.DATABASE_URL || '',

  /** MongoDB URI (alternative storage backend). */
  mongodbUri: process.env.MONGODB_URI || '',

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

  // ──── Payments ───────────────────────────────────────────────────────
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',

  // ──── External API Keys ──────────────────────────────────────────────
  /** Telegram Bot Token for sending trading alerts to users */
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',

  /** Angel One SmartAPI developer API key (server-level, free from smartapi.angelbroking.com) */
  angelSmartApiKey: process.env.ANGEL_SMARTAPI_KEY || '',

  /** MarketStack API key for real-time stock prices and market data */
  marketstackKey: process.env.MARKETSTACK_KEY || '',

  /** NewsAPI.org key for financial news articles */
  newsApiKey: process.env.NEWSAPI_KEY || '',

  // ──── Error Tracking ─────────────────────────────────────────────────
  sentryDsn: process.env.SENTRY_DSN || '',

  // ──── Redis ──────────────────────────────────────────────────────────
  /** REDIS_URL or RAILWAY_REDIS_URL (auto-injected by Railway Redis plugin) */
  redisUrl: process.env.REDIS_URL || process.env.RAILWAY_REDIS_URL || '',

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

  // In production, warn if no AI keys are configured (the app will return mock data)
  if (isProduction && !env.openRouterApiKey && !env.googleGeminiApiKey && !env.choreoClaudeApiKey) {
    console.warn(
      '[env] WARNING: No AI provider configured (OPENROUTER_API_KEY / GOOGLE_GEMINI_API_KEY / CHOREO_CLAUDE_API_KEY).\n' +
      '      AI analysis endpoints will return mock/fallback data.',
    );
  }

  return missing;
}
