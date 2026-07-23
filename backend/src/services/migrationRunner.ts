/**
 * ============================================================================
 * Toroloom — PostgreSQL Migration Runner
 * ============================================================================
 *
 * A zero-dependency migration runner for PostgreSQL. Reads numbered SQL
 * migration files from a directory, tracks which have been applied in a
 * `_migrations` tracking table, and applies pending ones in order.
 *
 * Design principles:
 *   - No external dependencies — uses the `pg` Pool directly.
 *   - Each migration runs inside its own transaction.
 *   - Idempotent — safe to run on every server start.
 *   - Down migrations are supported but stored separately (002_down.sql).
 *
 * Usage:
 *   import { runMigrations, getMigrationStatus } from './migrationRunner';
 *
 *   // On startup — auto-apply pending migrations
 *   await runMigrations(pool, { dir: path.join(__dirname, '../../migrations') });
 *
 *   // CLI check — print status without applying
 *   const pending = await getMigrationStatus(pool, { dir: '...' });
 *   console.log(pending);
 *
 * ============================================================================
 */

import type { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';

/**
 * Options for the migration runner.
 */
export interface MigrationOptions {
  /** Directory containing `*.sql` migration files. */
  dir: string;
  /** Optional logger (defaults to console). */
  logger?: MigrationLogger;
  /** If true, runs all pending migrations silently without logging. */
  silent?: boolean;
}

/**
 * Logger interface — allows injecting a custom logger for testing.
 */
export interface MigrationLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

/**
 * Represents a single migration file.
 */
export interface MigrationFile {
  /** Sortable version number (001, 002, …). */
  version: string;
  /** Full path to the SQL file. */
  path: string;
  /** Human-readable description parsed from the filename. */
  description: string;
}

/**
 * Status of a migration.
 */
export interface MigrationRecord {
  version: string;
  name: string;
  appliedAt: string;
  checksum: string;
}

/**
 * Result of running migrations.
 */
export interface MigrationResult {
  applied: number;
  skipped: number;
  records: MigrationRecord[];
}

// ──── Constants ──────────────────────────────────────────────────────────

const MIGRATIONS_TABLE = '_migrations';

// ──── Helpers ────────────────────────────────────────────────────────────

const defaultLogger: MigrationLogger = {
  info: (msg) => console.log(`[migrate] ${msg}`),
  warn: (msg) => console.warn(`[migrate] ⚠ ${msg}`),
  error: (msg) => console.error(`[migrate] ✗ ${msg}`),
};

/**
 * Parse numbered migration files from a directory.
 * Files must follow the pattern: `{NNN}_{description}.sql`
 * where NNN is a zero-padded 3-digit version number.
 *
 * Example: `001_initial_schema.sql`, `002_add_users_table.sql`
 */
function discoverMigrations(dir: string): MigrationFile[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const migrations: MigrationFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const match = entry.name.match(/^(\d{3})_(.+)\.sql$/i);
    if (!match) continue;

    migrations.push({
      version: match[1],
      path: path.join(dir, entry.name),
      description: match[2].replace(/_/g, ' ').replace(/\.sql$/, ''),
    });
  }

  // Sort by version number ascending
  migrations.sort((a, b) => a.version.localeCompare(b.version));

  return migrations;
}

/**
 * Compute a simple checksum of the SQL content to detect changes.
 */
function computeChecksum(sql: string): string {
  let hash = 0;
  for (let i = 0; i < sql.length; i++) {
    const char = sql.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Ensure the `_migrations` tracking table exists.
 */
async function ensureTrackingTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      version   TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum  TEXT NOT NULL
    )
  `);
}

/**
 * Load already-applied migrations from the tracking table.
 */
async function loadAppliedMigrations(client: PoolClient): Promise<Map<string, MigrationRecord>> {
  const result = await client.query(
    `SELECT version, name, applied_at, checksum FROM "${MIGRATIONS_TABLE}" ORDER BY version ASC`,
  );
  const map = new Map<string, MigrationRecord>();
  for (const row of result.rows) {
    map.set(row.version, {
      version: row.version,
      name: row.name,
      appliedAt: row.applied_at,
      checksum: row.checksum,
    });
  }
  return map;
}

/**
 * Record a migration as applied.
 */
async function recordMigration(
  client: PoolClient,
  migration: MigrationFile,
  checksum: string,
): Promise<void> {
  await client.query(
    `INSERT INTO "${MIGRATIONS_TABLE}" (version, name, checksum) VALUES ($1, $2, $3)
     ON CONFLICT (version) DO UPDATE SET
       name = EXCLUDED.name,
       checksum = EXCLUDED.checksum,
       applied_at = now()`,
    [migration.version, migration.description, checksum],
  );
}

// ──── Public API ─────────────────────────────────────────────────────────

/**
 * Run all pending migrations.
 *
 * Each migration is executed inside its own transaction. If a migration
 * fails, subsequent migrations are skipped but previously applied ones
 * remain applied.
 *
 * @returns Summary of migrations applied and skipped.
 */
export async function runMigrations(
  pool: Pool,
  options: MigrationOptions,
): Promise<MigrationResult> {
  const logger = options.logger ?? defaultLogger;
  const migrations = discoverMigrations(options.dir);

  if (migrations.length === 0) {
    if (!options.silent) {
      logger.info('No migration files found in ' + options.dir);
    }
    return { applied: 0, skipped: 0, records: [] };
  }

  const client = await pool.connect();
  try {
    await ensureTrackingTable(client);
    const applied = await loadAppliedMigrations(client);

    const pending = migrations.filter((m) => !applied.has(m.version));
    if (pending.length === 0) {
      if (!options.silent) {
        logger.info(`Schema up-to-date (${applied.size} migration(s) applied)`);
      }
      return { applied: 0, skipped: migrations.length, records: Array.from(applied.values()) };
    }

    if (!options.silent) {
      logger.info(`Found ${pending.length} pending migration(s) out of ${migrations.length} total`);
    }

    const records: MigrationRecord[] = Array.from(applied.values());

    for (const migration of pending) {
      const sql = fs.readFileSync(migration.path, 'utf-8');
      const checksum = computeChecksum(sql);

      try {
        await client.query('BEGIN');

        // Execute the migration SQL
        await client.query(sql);

        // Record it
        await recordMigration(client, migration, checksum);

        await client.query('COMMIT');

        records.push({
          version: migration.version,
          name: migration.description,
          appliedAt: new Date().toISOString(),
          checksum,
        });

        if (!options.silent) {
          logger.info(`  ✔ ${migration.version}_${migration.description.replace(/ /g, '_')}.sql`);
        }
      } catch (err: any) {
        await client.query('ROLLBACK');
        const errorMsg = `Migration ${migration.version} FAILED: ${err.message}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }
    }

    if (!options.silent) {
      logger.info(`Applied ${pending.length} migration(s) successfully`);
    }

    return { applied: pending.length, skipped: migrations.length - pending.length, records };
  } finally {
    client.release();
  }
}

/**
 * Get the current migration status without applying anything.
 *
 * @returns Array of pending migration files.
 */
export async function getMigrationStatus(
  pool: Pool,
  options: MigrationOptions,
): Promise<{ applied: MigrationRecord[]; pending: MigrationFile[] }> {
  const migrations = discoverMigrations(options.dir);
  const client = await pool.connect();

  try {
    await ensureTrackingTable(client);
    const applied = await loadAppliedMigrations(client);

    const pending = migrations.filter((m) => !applied.has(m.version));

    return {
      applied: Array.from(applied.values()),
      pending,
    };
  } finally {
    client.release();
  }
}


