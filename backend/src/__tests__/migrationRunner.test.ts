/**
 * ============================================================================
 * Toroloom — Migration Runner Tests
 * ============================================================================
 *
 * Tests the PostgreSQL migration runner (runMigrations, getMigrationStatus).
 * Uses real temporary directories for migration files and a mocked pg.Pool
 * for database interaction. No real PostgreSQL database is needed.
 *
 * ============================================================================
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

// ── Test utilities ───────────────────────────────────────────────────────

/** Create a temp migration dir with the given SQL files. Returns the dir path. */
function setupMigrationDir(
  files: Array<{ version: string; description: string; sql: string }>,
): string {
  const dir = path.join(
    os.tmpdir(),
    `toroloom-migrate-test-${crypto.randomBytes(4).toString('hex')}`,
  );
  fs.mkdirSync(dir, { recursive: true });

  for (const f of files) {
    const fileName = `${f.version}_${f.description}.sql`;
    fs.writeFileSync(path.join(dir, fileName), f.sql, 'utf-8');
  }

  return dir;
}

/** Clean up a temp migration dir. */
function cleanupMigrationDir(dir: string): void {
  if (fs.existsSync(dir)) {
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
      const fullPath = path.join(dir, e);
      if (fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
      }
    }
    fs.rmdirSync(dir);
  }
}

/**
 * Build a mock Pool + PoolClient that records all query calls.
 *
 * The mock client.query inspects the SQL to determine what to return:
 *   - SELECT from _migrations → returns appliedMigrations from options
 *   - Tracking table CREATE/INSERT → succeeds silently
 *   - BEGIN/COMMIT/ROLLBACK → succeeds silently
 *   - Migration SQL → controlled by options.queryThrows
 */
function createMockPool(options?: {
  /** pool.connect() will throw "Connection refused" instead of returning a client. */
  connectFails?: boolean;
  /** Migrations that are already recorded in the _migrations table. */
  appliedMigrations?: Array<{
    version: string;
    name: string;
    applied_at: string;
    checksum: string;
  }>;
}): {
  pool: Pool;
  client: PoolClient;
  queryCalls: Array<{ sql: string; params?: any[] }>;
} {
  const queryCalls: Array<{ sql: string; params?: any[] }> = [];

  const appliedRows = (options?.appliedMigrations ?? []).map((m) => ({
    version: m.version,
    name: m.name,
    applied_at: m.applied_at,
    checksum: m.checksum,
  }));

  let callCount = 0;

  const clientQuery = vi.fn().mockImplementation((sql: string, params?: any[]) => {
    callCount++;
    queryCalls.push({ sql, params });

    const upper = sql.toUpperCase().trim();

    // Return applied migrations for SELECT from _migrations
    if (upper.startsWith('SELECT') && upper.includes('_MIGRATIONS')) {
      return Promise.resolve({ rows: appliedRows });
    }

    return Promise.resolve({ rows: [] });
  });

  const client: PoolClient = {
    query: clientQuery,
    release: vi.fn(),
  } as unknown as PoolClient;

  let connectCallCount = 0;

  const pool: Pool = {
    connect: vi.fn().mockImplementation(() => {
      connectCallCount++;
      if (options?.connectFails) {
        return Promise.reject(new Error('Connection refused'));
      }
      return Promise.resolve(client);
    }),
    on: vi.fn(),
    end: vi.fn(),
    query: vi.fn(),
  } as unknown as Pool;

  return { pool, client, queryCalls };
}

/**
 * Lazy-import migrationRunner so each test gets a fresh module instance.
 * Using a function avoids hoisting issues with vi.mock.
 */
async function getMigrationRunner() {
  return await import('../services/migrationRunner');
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('migrationRunner', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanupMigrationDir(dir);
    }
    tempDirs.length = 0;
  });

  // ── runMigrations ───────────────────────────────────────────────────────

  describe('runMigrations', () => {
    it('returns {applied:0, skipped:0} when migrations directory is empty', async () => {
      const dir = setupMigrationDir([]);
      tempDirs.push(dir);
      const { pool } = createMockPool();
      const { runMigrations } = await getMigrationRunner();

      const result = await runMigrations(pool, { dir, silent: true });

      expect(result.applied).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.records).toEqual([]);
    });

    it('returns {applied:0, skipped:0} when directory does not exist', async () => {
      const { pool } = createMockPool();
      const { runMigrations } = await getMigrationRunner();

      const result = await runMigrations(pool, {
        dir: '/nonexistent/migrations/dir',
        silent: true,
      });

      expect(result.applied).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.records).toEqual([]);
    });

    it('returns {applied:0, skipped:N} when all migrations are already applied', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'initial_schema', sql: 'CREATE TABLE foo (id INT);' },
        { version: '002', description: 'add_bar', sql: 'CREATE TABLE bar (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({
        appliedMigrations: [
          { version: '001', name: 'initial schema', applied_at: '2025-01-01T00:00:00Z', checksum: 'abc' },
          { version: '002', name: 'add bar', applied_at: '2025-01-02T00:00:00Z', checksum: 'def' },
        ],
      });
      const { runMigrations } = await getMigrationRunner();

      const result = await runMigrations(pool, { dir, silent: true });

      expect(result.applied).toBe(0);
      expect(result.skipped).toBe(2);
      expect(result.records).toHaveLength(2);
      expect(result.records[0].version).toBe('001');
      expect(result.records[1].version).toBe('002');
    });

    it('applies pending migrations in version order', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'initial_schema', sql: 'CREATE TABLE users (id INT);' },
        { version: '002', description: 'add_posts', sql: 'CREATE TABLE posts (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({ appliedMigrations: [] });
      const { runMigrations } = await getMigrationRunner();

      const result = await runMigrations(pool, { dir, silent: true });

      expect(result.applied).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.records).toHaveLength(2);
      expect(result.records[0].version).toBe('001');
      expect(result.records[0].name).toBe('initial schema');
      expect(result.records[0].checksum).toBeTruthy();
      expect(result.records[1].version).toBe('002');
      expect(result.records[1].name).toBe('add posts');
      expect(result.records[1].checksum).toBeTruthy();
    });

    it('applies only pending migrations when some are already applied', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'initial_schema', sql: 'CREATE TABLE users (id INT);' },
        { version: '002', description: 'add_posts', sql: 'CREATE TABLE posts (id INT);' },
        { version: '003', description: 'add_comments', sql: 'CREATE TABLE comments (id INT);' },
      ]);
      tempDirs.push(dir);

      const { pool } = createMockPool({
        appliedMigrations: [
          { version: '001', name: 'initial schema', applied_at: '2025-01-01T00:00:00Z', checksum: 'abc' },
          { version: '002', name: 'add posts', applied_at: '2025-01-02T00:00:00Z', checksum: 'def' },
        ],
      });
      const { runMigrations } = await getMigrationRunner();

      const result = await runMigrations(pool, { dir, silent: true });

      expect(result.applied).toBe(1); // only 003
      expect(result.skipped).toBe(2);
      expect(result.records).toHaveLength(3);
      expect(result.records[0].version).toBe('001');
      expect(result.records[1].version).toBe('002');
      expect(result.records[2].version).toBe('003');
    });

    it('throws and rolls back when a migration SQL fails', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'good_schema', sql: 'CREATE TABLE foo (id INT);' },
        { version: '002', description: 'bad_sql', sql: 'INVALID SQL STATEMENT;' },
      ]);
      tempDirs.push(dir);
      const { pool, client } = createMockPool({ appliedMigrations: [] });

      // Override client.query so the second migration (BAD SQL) fails.
      // The migration runner calls query in sequence:
      //   1. CREATE TABLE IF NOT EXISTS "_migrations" (tracking table)
      //   2. SELECT ... FROM "_migrations" (load applied)
      //   3. BEGIN (for migration 001)
      //   4. 'CREATE TABLE foo (id INT);' (migration 001 SQL)
      //   5. INSERT INTO "_migrations" ... (record 001)
      //   6. COMMIT
      //   7. BEGIN (for migration 002)
      //   8. 'INVALID SQL STATEMENT;' (migration 002 SQL) → FAILS
      //   9. ROLLBACK
      //
      // So the 8th call should throw.
      const mockQuery = vi.fn().mockImplementation((sql: string, params?: any[]) => {
        const upper = sql.toUpperCase().trim();
        // Fail on the BAD SQL
        if (upper.includes('INVALID SQL')) {
          throw new Error('syntax error at or near "INVALID"');
        }
        return Promise.resolve({ rows: [] });
      });
      (client as any).query = mockQuery;

      const { runMigrations } = await getMigrationRunner();

      await expect(
        runMigrations(pool, { dir, silent: true }),
      ).rejects.toThrow('Migration 002 FAILED');

      // Verify ROLLBACK was called after the failure
      const calls = mockQuery.mock.calls.map((c: any[]) => c[0].toUpperCase().trim());
      const rollbackCallIndex = calls.findIndex((s: string) => s === 'ROLLBACK');
      expect(rollbackCallIndex).toBeGreaterThanOrEqual(0);

      // The ROLLBACK should come after the BEGIN for migration 002
      const beginFor002Idx = calls.findIndex(
        (s: string, i: number) => s === 'BEGIN' && i >= 6,
      );
      expect(rollbackCallIndex).toBeGreaterThan(beginFor002Idx);
    });

    it('handles pool.connect() failure gracefully', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'initial_schema', sql: 'CREATE TABLE users (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({ connectFails: true });
      const { runMigrations } = await getMigrationRunner();

      await expect(
        runMigrations(pool, { dir, silent: true }),
      ).rejects.toThrow('Connection refused');
    });
  });

  // ── Logger / Silent mode ─────────────────────────────────────────────

  describe('logger behavior', () => {
    it('uses custom logger when provided', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'initial_schema', sql: 'CREATE TABLE users (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({ appliedMigrations: [] });
      const { runMigrations } = await getMigrationRunner();

      const logMessages: string[] = [];
      const logger = {
        info: (msg: string) => logMessages.push(`INFO: ${msg}`),
        warn: (msg: string) => logMessages.push(`WARN: ${msg}`),
        error: (msg: string) => logMessages.push(`ERR: ${msg}`),
      };

      await runMigrations(pool, { dir, logger });

      expect(logMessages.length).toBeGreaterThan(0);
      expect(logMessages.some((m) => m.includes('001'))).toBe(true);
      expect(logMessages.some((m) => m.includes('Applied'))).toBe(true);
    });

    it('suppresses logging in silent mode even with custom logger', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'initial_schema', sql: 'CREATE TABLE users (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({ appliedMigrations: [] });
      const { runMigrations } = await getMigrationRunner();

      const logMessages: string[] = [];
      const logger = {
        info: (msg: string) => logMessages.push(msg),
        warn: (msg: string) => logMessages.push(msg),
        error: (msg: string) => logMessages.push(msg),
      };

      await runMigrations(pool, { dir, logger, silent: true });

      expect(logMessages.length).toBe(0);
    });

    it('does not log when schema is up-to-date in silent mode', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'test', sql: 'CREATE TABLE foo (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({
        appliedMigrations: [
          { version: '001', name: 'test', applied_at: '2025-01-01T00:00:00Z', checksum: 'abc' },
        ],
      });
      const { runMigrations } = await getMigrationRunner();

      const logMessages: string[] = [];
      const logger = {
        info: (msg: string) => logMessages.push(msg),
        warn: (msg: string) => logMessages.push(msg),
        error: (msg: string) => logMessages.push(msg),
      };

      await runMigrations(pool, { dir, logger, silent: true });

      expect(logMessages.length).toBe(0);
    });

    it('logs schema up-to-date message when not in silent mode', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'test', sql: 'CREATE TABLE foo (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({
        appliedMigrations: [
          { version: '001', name: 'test', applied_at: '2025-01-01T00:00:00Z', checksum: 'abc' },
        ],
      });
      const { runMigrations } = await getMigrationRunner();

      const logMessages: string[] = [];
      const logger = {
        info: (msg: string) => logMessages.push(msg),
        warn: (msg: string) => logMessages.push(msg),
        error: (msg: string) => logMessages.push(msg),
      };

      await runMigrations(pool, { dir, logger, silent: false });

      expect(logMessages.length).toBeGreaterThan(0);
      expect(logMessages.some((m) => m.includes('up-to-date'))).toBe(true);
    });

    it('logs empty dir message when not in silent mode', async () => {
      const dir = setupMigrationDir([]);
      tempDirs.push(dir);
      const { pool } = createMockPool();
      const { runMigrations } = await getMigrationRunner();

      const logMessages: string[] = [];
      const logger = {
        info: (msg: string) => logMessages.push(msg),
        warn: (msg: string) => logMessages.push(msg),
        error: (msg: string) => logMessages.push(msg),
      };

      await runMigrations(pool, { dir, logger, silent: false });

      expect(logMessages.length).toBeGreaterThan(0);
      expect(logMessages.some((m) => m.includes('No migration files'))).toBe(true);
    });
  });

  // ── getMigrationStatus ─────────────────────────────────────────────────

  describe('getMigrationStatus', () => {
    it('returns all migrations as pending when none are applied', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'initial_schema', sql: 'CREATE TABLE foo (id INT);' },
        { version: '002', description: 'add_bar', sql: 'CREATE TABLE bar (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({ appliedMigrations: [] });
      const { getMigrationStatus } = await getMigrationRunner();

      const status = await getMigrationStatus(pool, { dir });

      expect(status.applied).toHaveLength(0);
      expect(status.pending).toHaveLength(2);
      expect(status.pending[0].version).toBe('001');
      expect(status.pending[1].version).toBe('002');
    });

    it('returns partial pending/applied when some migrations are applied', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'initial_schema', sql: 'CREATE TABLE foo (id INT);' },
        { version: '002', description: 'add_bar', sql: 'CREATE TABLE bar (id INT);' },
        { version: '003', description: 'add_baz', sql: 'CREATE TABLE baz (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({
        appliedMigrations: [
          { version: '001', name: 'initial schema', applied_at: '2025-01-01T00:00:00Z', checksum: 'abc' },
        ],
      });
      const { getMigrationStatus } = await getMigrationRunner();

      const status = await getMigrationStatus(pool, { dir });

      expect(status.applied).toHaveLength(1);
      expect(status.applied[0].version).toBe('001');
      expect(status.pending).toHaveLength(2);
      expect(status.pending[0].version).toBe('002');
      expect(status.pending[1].version).toBe('003');
    });

    it('returns all applied when no pending migrations', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'initial_schema', sql: 'CREATE TABLE foo (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({
        appliedMigrations: [
          { version: '001', name: 'initial schema', applied_at: '2025-01-01T00:00:00Z', checksum: 'abc' },
        ],
      });
      const { getMigrationStatus } = await getMigrationRunner();

      const status = await getMigrationStatus(pool, { dir });

      expect(status.applied).toHaveLength(1);
      expect(status.pending).toHaveLength(0);
    });

    it('returns empty arrays when migration directory is empty', async () => {
      const dir = setupMigrationDir([]);
      tempDirs.push(dir);
      const { pool } = createMockPool();
      const { getMigrationStatus } = await getMigrationRunner();

      const status = await getMigrationStatus(pool, { dir });

      expect(status.applied).toHaveLength(0);
      expect(status.pending).toHaveLength(0);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('ignores non-migration files (non-matching pattern)', async () => {
      const dir = setupMigrationDir([]);

      // Manually add files — some valid, some not
      fs.writeFileSync(path.join(dir, '001_initial_schema.sql'), 'CREATE TABLE a (id INT);', 'utf-8');
      fs.writeFileSync(path.join(dir, 'README.md'), '# Docs', 'utf-8');
      fs.writeFileSync(path.join(dir, 'setup.sql'), 'SELECT 1;', 'utf-8');
      fs.writeFileSync(path.join(dir, '02_add_table.sql'), 'CREATE TABLE b (id INT);', 'utf-8'); // only 2 digits
      fs.writeFileSync(path.join(dir, '001_schema.sql'), 'CREATE TABLE c (id INT);', 'utf-8'); // another valid

      tempDirs.push(dir);

      const { pool } = createMockPool({ appliedMigrations: [] });
      const { runMigrations } = await getMigrationRunner();

      const result = await runMigrations(pool, { dir, silent: true });
      // Should only apply 001_initial_schema.sql and 001_schema.sql
      expect(result.applied).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('discovers files sorted by version number, not filesystem order', async () => {
      const dir = setupMigrationDir([
        { version: '003', description: 'zulu', sql: 'CREATE TABLE c (id INT);' },
        { version: '001', description: 'alpha', sql: 'CREATE TABLE a (id INT);' },
        { version: '002', description: 'beta', sql: 'CREATE TABLE b (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({ appliedMigrations: [] });
      const { runMigrations } = await getMigrationRunner();

      const result = await runMigrations(pool, { dir, silent: true });

      expect(result.applied).toBe(3);
      // Must be in version order, not the order they were added
      expect(result.records[0].version).toBe('001');
      expect(result.records[1].version).toBe('002');
      expect(result.records[2].version).toBe('003');
    });

    it('correctly parses description from filename', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'initial_schema', sql: 'CREATE TABLE foo (id INT);' },
        { version: '002', description: 'add_user_preferences', sql: 'CREATE TABLE bar (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({ appliedMigrations: [] });
      const { runMigrations } = await getMigrationRunner();

      const result = await runMigrations(pool, { dir, silent: true });

      // Descriptions should have underscores replaced with spaces
      expect(result.records[0].name).toBe('initial schema');
      expect(result.records[1].name).toBe('add user preferences');
    });

    it('returns applied_at as a valid ISO date string', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'test', sql: 'CREATE TABLE foo (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({ appliedMigrations: [] });
      const { runMigrations } = await getMigrationRunner();

      const result = await runMigrations(pool, { dir, silent: true });

      expect(result.records[0].appliedAt).toBeTruthy();
      expect(() => new Date(result.records[0].appliedAt)).not.toThrow();
      expect(new Date(result.records[0].appliedAt).toISOString()).toBe(result.records[0].appliedAt);
    });

    it('generates different checksums for different SQL content', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'schema_a', sql: 'CREATE TABLE foo (id INT);' },
        { version: '002', description: 'schema_b', sql: 'CREATE TABLE bar (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool } = createMockPool({ appliedMigrations: [] });
      const { runMigrations } = await getMigrationRunner();

      const result = await runMigrations(pool, { dir, silent: true });

      expect(result.records[0].checksum).toBeTruthy();
      expect(result.records[1].checksum).toBeTruthy();
      // Different SQL → different checksums
      expect(result.records[0].checksum).not.toBe(result.records[1].checksum);
    });

    it('releases the client back to the pool after successful migration', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'test', sql: 'CREATE TABLE foo (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool, client } = createMockPool({ appliedMigrations: [] });
      const { runMigrations } = await getMigrationRunner();

      await runMigrations(pool, { dir, silent: true });

      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('releases the client back to the pool after failed migration', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'bad', sql: 'INVALID SQL;' },
      ]);
      tempDirs.push(dir);
      const { pool, client } = createMockPool({ appliedMigrations: [] });

      // Make the migration SQL fail
      const mockQuery = vi.fn().mockImplementation((sql: string) => {
        const upper = sql.toUpperCase().trim();
        if (upper.includes('INVALID SQL')) {
          throw new Error('syntax error');
        }
        return Promise.resolve({ rows: [] });
      });
      (client as any).query = mockQuery;

      const { runMigrations } = await getMigrationRunner();

      await expect(runMigrations(pool, { dir, silent: true })).rejects.toThrow();

      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('does not release client when connect fails (no client obtained)', async () => {
      const dir = setupMigrationDir([
        { version: '001', description: 'test', sql: 'CREATE TABLE foo (id INT);' },
      ]);
      tempDirs.push(dir);
      const { pool, client } = createMockPool({ connectFails: true });
      const { runMigrations } = await getMigrationRunner();

      await expect(runMigrations(pool, { dir, silent: true })).rejects.toThrow();

      expect(client.release).not.toHaveBeenCalled();
    });
  });
});
