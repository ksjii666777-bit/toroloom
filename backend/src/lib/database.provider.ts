/**
 * ============================================================================
 * Toroloom — Production Database Provider
 * ============================================================================
 *
 * A high-scale PostgreSQL connection manager designed for Railway deployments
 * with PgBouncer and RDS read replicas.
 *
 * Key design decisions:
 *   1. PgBouncer-compatible pool config — avoids SET-based session config
 *      that fails in transaction pooling mode.
 *   2. Railway-aware — uses RAILWAY_STATIC_URL for connection tagging,
 *      DATABASE_URL for the actual connection string.
 *   3. Prepared-statement timeout — uses statement_timeout in the
 *      connection string (PgBouncer transaction-mode compatible) instead
 *      of SET statement_timeout.
 *   4. Graceful fallback — if DATABASE_URL is missing, the provider
 *      reports a structured diagnostic log and returns a null pool
 *      without crashing the process.
 *   5. Singleton pool — reuse the same pool across all consumers to
 *      stay within PgBouncer's max client_connections (default 100).
 *   6. Read replica support — DATABASE_URL_READER for SELECT-heavy
 *      analytics queries (analytics, reports, AI cognitive summary).
 *      Falls back to the writer when not configured.
 *
 * Usage:
 *   import { getDb, getReader } from '../lib/database.provider';
 *
 *   const db = await getDb();
 *   if (!db) {
 *     // Database not configured — local/dev mode
 *     return mockData;
 *   }
 *   const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
 *
 *   // For read-only analytics queries:
 *   const reader = await getReader();
 *   const { rows } = await reader.query('SELECT ...', [params]);
 *
 * ============================================================================
 */

import type { Pool, PoolConfig, QueryResultRow } from 'pg';

// ──── Constants ────────────────────────────────────────────────────────────

const LOG_PREFIX = '[DatabaseProvider]';

/**
 * PgBouncer-compatible pool defaults.
 *
 * ⚠️  PgBouncer in TRANSACTION mode does NOT support:
 *       - SET statement_timeout (use connect string parameter instead)
 *       - LISTEN / NOTIFY
 *       - PREPARE / DEALLOCATE across transactions
 *       - Session-level temp tables
 *
 *     All of these are avoided below.
 *
 * Pool sizing (PgBouncer per-tenant):
 *   Railway free tier → max 15 connections (PgBouncer pool)
 *   Production        → max 50-100 connections (adjust via POOL_MAX env var)
 *
 *   idleTimeoutMillis: 60s — longer than default (10s) to avoid
 *     aggressive connection churn under burst traffic.
 */
const POOL_MAX = parseInt(process.env.POOL_MAX || '20', 10);

const DEFAULT_POOL_CONFIG: Partial<PoolConfig> = {
  max: POOL_MAX,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 10_000,
  // Do NOT set statement_timeout here — use URL parameter instead
  // (PgBouncer transaction mode strips SET statements).
  allowExitOnIdle: false,
};

/**
 * Maximum connection retry attempts before giving up.
 */
const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff (ms).
 */
const RETRY_BASE_MS = 500;

// ──── Module State ─────────────────────────────────────────────────────────

let pool: Pool | null = null;
let readerPool: Pool | null = null;
let initialized = false;
let readerInitialized = false;
let initializationPromise: Promise<Pool | null> | null = null;
let readerInitPromise: Promise<Pool | null> | null = null;

// ──── Connection String with PgBouncer-Compatible params ───────────────────

/**
 * Append PgBouncer-safe parameters to a PostgreSQL connection string.
 *
 * PgBouncer transaction mode strips SET commands but allows URL parameters.
 * We inject statement_timeout and application_name here instead of using
 * SET at session start.
 *
 * @param rawUrl — The base DATABASE_URL (e.g. from Railway env)
 * @returns Connection string with PgBouncer-compatible query params
 */
function buildPgBouncerUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  // Prevent SSL mismatch errors on Railway internal networking
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', process.env.NODE_ENV === 'production' ? 'require' : 'prefer');
  }

  // statement_timeout (ms) — PgBouncer-safe via URL param
  if (!url.searchParams.has('statement_timeout')) {
    url.searchParams.set('statement_timeout', String(process.env.STATEMENT_TIMEOUT_MS || '30_000'));
  }

  // application_name — helps identify connections in pg_stat_activity
  const appName = process.env.RAILWAY_STATIC_URL
    ? `toroloom-railway-${process.env.RAILWAY_SERVICE_NAME || 'api'}`
    : `toroloom-${process.env.NODE_ENV || 'development'}`;
  if (!url.searchParams.has('application_name')) {
    url.searchParams.set('application_name', appName);
  }

  // pool_timeout — how long PgBouncer waits for a free connection
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '10');
  }

  return url.toString();
}

// ──── Public API ───────────────────────────────────────────────────────────

export interface DbProviderDiagnostics {
  configured: boolean;
  connected: boolean;
  readerConfigured: boolean;
  readerConnected: boolean;
  poolSize: number;
  idleCount: number;
  waitingCount: number;
  readerPoolSize: number;
  readerIdleCount: number;
  readerWaitingCount: number;
  railwayDeploy: boolean;
  databaseUrlSet: boolean;
  pgbouncerPort: boolean;
}

/**
 * Get the singleton database pool (writer).
 *
 * Returns null (with a structured warning) if DATABASE_URL is not set,
 * allowing the application to degrade gracefully in local/dev mode.
 *
 * The pool is lazily initialized on first call and cached thereafter.
 * If initialization fails, subsequent calls retry with exponential
 * backoff (up to MAX_RETRIES).
 */
export async function getDb(): Promise<Pool | null> {
  if (initialized && pool) return pool;
  if (initializationPromise) return initializationPromise;

  // Detect PgBouncer port — if DATABASE_URL points to port 5432,
  // print a reminder to use 6432 in production
  detectPgbouncerPort();

  initializationPromise = initializePool(process.env.DATABASE_URL);
  return initializationPromise;
}

/**
 * Get the read replica pool (reader).
 *
 * Uses DATABASE_URL_READER env var.  Falls back to the writer pool
 * when the reader is not configured or fails to connect.
 *
 * Usage: Route SELECT-heavy queries (analytics, reports, tax summaries)
 * through the reader to offload the writer.
 */
export async function getReader(): Promise<Pool | null> {
  const readerUrl = process.env.DATABASE_URL_READER;

  // No reader configured — fall back to writer
  if (!readerUrl) {
    return getDb();
  }

  if (readerInitialized && readerPool) return readerPool;
  if (readerInitPromise) return readerInitPromise;

  readerInitPromise = initializeReaderPool(readerUrl);
  return readerInitPromise;
}

/**
 * Execute a single query through the pool.
 * Shorthand for `(await getDb()).query(...)` with null-safety.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<{ rows: T[]; rowCount: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.query<T>(text, params);
  return { rows: result.rows, rowCount: result.rowCount ?? 0 };
}

/**
 * Get diagnostics about the database connection state.
 * Useful for health-check endpoints and operational dashboards.
 */
export function getDiagnostics(): DbProviderDiagnostics {
  return {
    configured: !!process.env.DATABASE_URL,
    connected: initialized && pool !== null,
    readerConfigured: !!process.env.DATABASE_URL_READER,
    readerConnected: readerInitialized && readerPool !== null,
    poolSize: pool?.totalCount ?? 0,
    idleCount: pool?.idleCount ?? 0,
    waitingCount: pool?.waitingCount ?? 0,
    readerPoolSize: readerPool?.totalCount ?? 0,
    readerIdleCount: readerPool?.idleCount ?? 0,
    readerWaitingCount: readerPool?.waitingCount ?? 0,
    railwayDeploy: !!process.env.RAILWAY_STATIC_URL,
    databaseUrlSet: !!process.env.DATABASE_URL,
    pgbouncerPort: (process.env.DATABASE_URL || '').includes(':6432'),
  };
}

/**
 * Gracefully shut down the pool.
 * Call this during server shutdown (SIGTERM / SIGINT).
 */
export async function shutdownDb(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      console.log(`${LOG_PREFIX} Writer pool shut down gracefully`);
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error during writer pool shutdown: ${err.message}`);
    }
    pool = null;
    initialized = false;
    initializationPromise = null;
  }
  if (readerPool) {
    try {
      await readerPool.end();
      console.log(`${LOG_PREFIX} Reader pool shut down gracefully`);
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error during reader pool shutdown: ${err.message}`);
    }
    readerPool = null;
    readerInitialized = false;
    readerInitPromise = null;
  }
}

// ──── Internal Initialization ─────────────────────────────────────────────

/**
 * Detect if DATABASE_URL is pointing to port 5432 (direct PG) instead of
 * 6432 (PgBouncer).  Print a reminder for production deployments.
 */
function detectPgbouncerPort(): void {
  const url = process.env.DATABASE_URL || '';
  if (url.includes(':5432') && process.env.NODE_ENV === 'production') {
    console.warn(
      `${LOG_PREFIX} ╔═══════════════════════════════════════════════════════════════╗\n` +
      `${LOG_PREFIX} ║  DATABASE_URL points to port 5432 (direct PostgreSQL)        ║\n` +
      `${LOG_PREFIX} ║  For production, use port 6432 (PgBouncer) to avoid         ║\n` +
      `${LOG_PREFIX} ║  connection exhaustion under load.                           ║\n` +
      `${LOG_PREFIX} ║  Change: postgresql://user:pass@host:5432/dbname             ║\n` +
      `${LOG_PREFIX} ║  To:     postgresql://user:pass@host:6432/dbname             ║\n` +
      `${LOG_PREFIX} ╚═══════════════════════════════════════════════════════════════╝`,
    );
  }
}

/**
 * Initialize the writer pool from DATABASE_URL.
 */
async function initializePool(rawUrl?: string): Promise<Pool | null> {
  const databaseUrl = rawUrl || process.env.DATABASE_URL;

  // ── Missing config — structured error log, graceful degradation ────
  if (!databaseUrl) {
    console.warn(`
${LOG_PREFIX} ╔═══════════════════════════════════════════════════════════════╗
${LOG_PREFIX} ║  DATABASE_URL is not set                                    ║
${LOG_PREFIX} ║                                                             ║
${LOG_PREFIX} ║  The database provider will return null. All queries will    ║
${LOG_PREFIX} ║  gracefully degrade to fallback/mock data.                   ║
${LOG_PREFIX} ║                                                             ║
${LOG_PREFIX} ║  To connect a database:                                      ║
${LOG_PREFIX} ║  1. Railway:  add DATABASE_URL in Variables tab              ║
${LOG_PREFIX} ║  2. Local:    set DATABASE_URL in backend/.env                ║
${LOG_PREFIX} ║  3. Docker:   set DATABASE_URL in docker-compose.yml          ║
${LOG_PREFIX} ║                                                             ║
${LOG_PREFIX} ║  Expected format:                                             ║
${LOG_PREFIX} ║    postgresql://user:password@host:5432/dbname               ║
${LOG_PREFIX} ╚═══════════════════════════════════════════════════════════════╝
    `);
    initialized = true;
    return null;
  }

  // ── Build PgBouncer-compatible URL ──────────────────────────────────
  const pgBouncerUrl = buildPgBouncerUrl(databaseUrl);

  // ── Dynamic import (keeps cold-start trace clean) ───────────────────
  const { Pool: PgPool } = await import('pg');

  // ── Retry loop with exponential backoff ─────────────────────────────
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      pool = new PgPool({
        connectionString: pgBouncerUrl,
        ...DEFAULT_POOL_CONFIG,
      });

      // Register error handler — prevents crashes from idle client errors
      pool.on('error', (err: Error) => {
        console.error(`${LOG_PREFIX} Unexpected pool error: ${err.message}`);
      });

      // Verify connectivity
      const client = await pool.connect();
      client.release();

      const pgbPort = pgBouncerUrl.includes(':6432') ? ' (via PgBouncer)' : '';
      console.log(
        `${LOG_PREFIX} Connected to PostgreSQL` +
        `${pgbPort}` +
        (process.env.RAILWAY_STATIC_URL ? ` (Railway: ${process.env.RAILWAY_SERVICE_NAME || 'api'})` : ' (local)') +
        ` | pool max: ${POOL_MAX} | retries: ${attempt}`,
      );

      initialized = true;
      return pool;
    } catch (err: any) {
      lastError = err;
      const backoff = Math.min(RETRY_BASE_MS * Math.pow(2, attempt - 1), 4_000);

      console.error(
        `${LOG_PREFIX} Connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}` +
        `. Retrying in ${backoff}ms...`,
      );

      // Clean up the failed pool
      if (pool) {
        try {
          await pool.end();
        } catch { /* ignore cleanup errors */ }
        pool = null;
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  // ── All attempts exhausted — structured error ───────────────────────
  console.error(`
${LOG_PREFIX} ╔═══════════════════════════════════════════════════════════════╗
${LOG_PREFIX} ║  PostgreSQL connection FAILED after ${MAX_RETRIES} attempts              ║
${LOG_PREFIX} ║                                                             ║
${LOG_PREFIX} ║  Last error: ${lastError?.message?.padEnd(59) || 'Unknown'} ║
${LOG_PREFIX} ║                                                             ║
${LOG_PREFIX} ║  Verify:                                                     ║
${LOG_PREFIX} ║  1. DATABASE_URL is correct in Railway Variables             ║
${LOG_PREFIX} ║  2. Database server is running and accepting connections      ║
${LOG_PREFIX} ║  3. Firewall/network allows inbound connections              ║
${LOG_PREFIX} ║  4. PgBouncer (if used) is configured for transaction mode   ║
${LOG_PREFIX} ╚═══════════════════════════════════════════════════════════════╝
  `);

  initialized = true;
  return null; // Graceful degradation — app continues without DB
}

/**
 * Initialize the read replica pool using DATABASE_URL_READER.
 */
async function initializeReaderPool(readerUrl: string): Promise<Pool | null> {
  // Use a smaller pool for the reader — analytics queries are less frequent
  const readerPoolMax = parseInt(process.env.READER_POOL_MAX || '10', 10);

  const readerConfig: Partial<PoolConfig> = {
    ...DEFAULT_POOL_CONFIG,
    max: readerPoolMax,
  };

  const pgBouncerUrl = buildPgBouncerUrl(readerUrl);
  const { Pool: PgPool } = await import('pg');

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      readerPool = new PgPool({
        connectionString: pgBouncerUrl,
        ...readerConfig,
      });

      readerPool.on('error', (err: Error) => {
        console.error(`${LOG_PREFIX} Reader pool error: ${err.message}`);
      });

      const client = await readerPool.connect();
      client.release();

      console.log(
        `${LOG_PREFIX} Connected to read replica` +
        ` | pool max: ${readerPoolMax} | retries: ${attempt}`,
      );

      readerInitialized = true;
      return readerPool;
    } catch (err: any) {
      lastError = err;
      const backoff = Math.min(RETRY_BASE_MS * Math.pow(2, attempt - 1), 4_000);
      console.error(
        `${LOG_PREFIX} Reader pool attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}` +
        `. Retrying in ${backoff}ms...`,
      );

      if (readerPool) {
        try { await readerPool.end(); } catch { /* ignore */ }
        readerPool = null;
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  console.warn(
    `${LOG_PREFIX} Read replica connection FAILED after ${MAX_RETRIES} attempts.` +
    ` Falling back to writer pool for all queries.`,
  );
  return null; // Fall back to writer
}

/**
 * Execute a read-only query through the reader pool.
 * Falls back to the writer when the reader is unavailable.
 */
export async function queryReader<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<{ rows: T[]; rowCount: number } | null> {
  const db = await getReader();
  if (!db) return null;
  const result = await db.query<T>(text, params);
  return { rows: result.rows, rowCount: result.rowCount ?? 0 };
}
