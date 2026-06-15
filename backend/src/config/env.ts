import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dataSource: (process.env.DATA_SOURCE || 'mock') as 'mock' | 'live',
  broker: (process.env.BROKER || 'mock') as 'mock' | 'zerodha' | 'angel' | 'groww',

  // ──── Storage Backend ────
  // 'memory'   → InMemoryStorage (default, no deps)
  // 'postgres' → PostgreSQLStorage (requires DATABASE_URL)
  // 'mongodb'  → MongoDBStorage (requires MONGODB_URI + MONGODB_DB_NAME)
  storageBackend: (process.env.STORAGE_BACKEND || 'memory') as 'memory' | 'postgres' | 'mongodb',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/toroloom',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  mongodbDbName: process.env.MONGODB_DB_NAME || 'toroloom',

  // ──── Zerodha Kite Connect ────
  // To get credentials: https://kite.trade/connect/login
  zerodha: {
    apiKey: process.env.ZERODHA_API_KEY || '',
    apiSecret: process.env.ZERODHA_API_SECRET || '',
    accessToken: process.env.ZERODHA_ACCESS_TOKEN || '',
    // If you don't have an access_token, provide the request_token
    // from the redirect URL after Kite login:
    requestToken: process.env.ZERODHA_REQUEST_TOKEN || '',
  },

  // ──── Angel One SmartAPI ────
  // To get credentials: https://smartapi.angelbroking.com/
  angel: {
    clientId: process.env.ANGEL_CLIENT_ID || '',
    apiKey: process.env.ANGEL_API_KEY || '',
    accessToken: process.env.ANGEL_ACCESS_TOKEN || '',
    // Required for generateSession (if accessToken not provided):
    password: process.env.ANGEL_PASSWORD || '',
    totp: process.env.ANGEL_TOTP || '',
  },

  // ──── Groww Trade API ────
  // To get credentials: visit https://groww.in/trade-api
  // Required: GROWW_API_KEY and GROWW_ACCESS_TOKEN
  groww: {
    apiKey: process.env.GROWW_API_KEY || '',
    accessToken: process.env.GROWW_ACCESS_TOKEN || '',
  },

  // ──── AI Configuration ────────────────────────────────────────
  // Two providers supported:
  //   1. OpenRouter (https://openrouter.ai/keys) — unified API for many models
  //   2. Google Gemini (https://aistudio.google.com/apikey) — direct Gemini API
  //
  // AI_PROVIDER controls which one is used:
  //   'openrouter' → uses OPENROUTER_API_KEY (default)
  //   'google'     → uses GOOGLE_GEMINI_API_KEY
  //
  // If the primary provider's key is missing, falls back to the other.
  // If neither key is set, isAIConfigured() returns false (mock data).
  aiProvider: (process.env.AI_PROVIDER || 'openrouter') as 'openrouter' | 'google',

  // OpenRouter config
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'google/gemini-3.5-flash',

  // Google Gemini config (direct API, no OpenRouter needed)
  googleGeminiApiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
  googleGeminiModel: process.env.GOOGLE_GEMINI_MODEL || 'gemini-3.5-flash',

  // ──── Sentry (error tracking) ──────────────────────────────
  // DSN for Sentry crash/error reporting.
  // If not set, Sentry is disabled (no events sent).
  sentryDsn: process.env.SENTRY_DSN || '',

  // ──── Redis (pub/sub for cross-worker sync) ────────────────
  // If not provided, falls back to Node.js cluster IPC (single-machine)
  // or local-only mode (single process).
  // Format: redis://[:password@]host[:port][/db]
  redisUrl: process.env.REDIS_URL || '',

  get isDev() {
    return this.nodeEnv === 'development';
  },
  get isMock() {
    return this.dataSource === 'mock';
  },
};
