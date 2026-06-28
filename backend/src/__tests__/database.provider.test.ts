/**
 * ============================================================================
 * Toroloom — Database Provider Unit Tests
 * ============================================================================
 *
 * Tests the 469-line database connection provider with mocked pg Pool,
 * retry logic, env-dependent behavior, reader/writer pools, and
 * graceful degradation when DATABASE_URL is missing.
 *
 * Architecture:
 *   - Uses a mockControl object (vi.hoisted) to configure Pool.connect
 *     behavior per test before calling getDb/getReader
 *   - Each describe block gets fresh singleton state via
 *     vi.resetModules() + dynamic import()
 *   - Fake timers for retry backoff advancement
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/database.provider.test.ts
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ──── Mock control object — configurable per test via vi.hoisted ───────────
// vi.hoisted ensures this is available inside the vi.mock factory below.

const { mockControl } = vi.hoisted(() => {
  const connectDefault = vi.fn().mockResolvedValue({ release: vi.fn() });
  return {
    mockControl: {
      /** Override pool.connect behavior per test (e.g. mockRejectedValue). */
      poolConnect: connectDefault,
      /** Instances created — cleared between describe blocks. */
      instances: [] as Array<{
        connect: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
        query: ReturnType<typeof vi.fn>;
        on: ReturnType<typeof vi.fn>;
        totalCount: number;
        idleCount: number;
        waitingCount: number;
      }>,
    },
  };
});

// ──── Mock pg — intercepts both static and dynamic import('pg') ────────────

/** Track Pool constructor arguments for verification. */
const mockPoolConstructorArgs: any[] = [];

vi.mock('pg', () => {
  const connectFn = mockControl.poolConnect;
  const instances = mockControl.instances;
  return {
    Pool: class MockPool {
      connect = connectFn;
      end = vi.fn().mockResolvedValue(undefined);
      query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
      on = vi.fn();
      totalCount = 5;
      idleCount = 2;
      waitingCount = 0;
      constructor(config: any) {
        mockPoolConstructorArgs.push(config);
        instances.push(this);
      }
    },
  };
});

// ============================================================================
// Tests
// ============================================================================

describe('DatabaseProvider — getDb (writer pool)', () => {
  beforeEach(() => {
    vi.resetModules();
    mockControl.instances.length = 0;
    mockPoolConstructorArgs.length = 0;
    // Reset connect to default (success)
    mockControl.poolConnect.mockResolvedValue({ release: vi.fn() });
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Missing DATABASE_URL
  // ─────────────────────────────────────────────────────────────────────

  describe('when DATABASE_URL is not set', () => {
    it('should return null without creating a pool', async () => {
      const { getDb } = await import('../lib/database.provider');
      const db = await getDb();
      expect(db).toBeNull();
      expect(mockControl.instances.length).toBe(0);
    });

    it('should return null on repeated calls (cached)', async () => {
      const { getDb } = await import('../lib/database.provider');
      expect(await getDb()).toBeNull();
      expect(await getDb()).toBeNull();
      expect(mockControl.instances.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Successful connection
  // ─────────────────────────────────────────────────────────────────────

  describe('when connection succeeds', () => {
    beforeEach(() => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/testdb');
    });

    it('should create a Pool and return it', async () => {
      const { getDb } = await import('../lib/database.provider');
      const db = await getDb();
      expect(db).not.toBeNull();
      expect(mockControl.instances.length).toBe(1);
    });

    it('should return the same cached pool on subsequent calls', async () => {
      const { getDb } = await import('../lib/database.provider');
      const first = await getDb();
      const second = await getDb();
      expect(first).toBe(second);
      expect(mockControl.instances.length).toBe(1);
    });

    it('should pass connectionString with PgBouncer-compatible params', async () => {
      const prevLength = mockPoolConstructorArgs.length;

      const { getDb } = await import('../lib/database.provider');
      await getDb();

      // Verify constructor was called with PgBouncer-compatible params
      expect(mockPoolConstructorArgs.length).toBe(prevLength + 1);
      const config = mockPoolConstructorArgs[prevLength];
      expect(config.connectionString).toContain('postgresql://user:pass@localhost:5432/testdb');
      expect(config.connectionString).toContain('sslmode=');
      expect(config.connectionString).toContain('statement_timeout=');
      expect(config.connectionString).toContain('application_name=');
      expect(config.connectionString).toContain('pool_timeout=');
    });

    it('should register an error handler on the pool', async () => {
      const { getDb } = await import('../lib/database.provider');
      await getDb();

      const pool = mockControl.instances[0];
      expect(pool?.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Retry logic
  // ─────────────────────────────────────────────────────────────────────

  describe('retry logic on connection failure', () => {
    beforeEach(() => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/testdb');
    });

    it('should return null after all retries fail', async () => {
      mockControl.poolConnect.mockRejectedValue(new Error('Connection refused'));

      const { getDb } = await import('../lib/database.provider');
      const db = await getDb();

      expect(db).toBeNull();
      // Each retry creates a new Pool instance (3 retries max)
      expect(mockControl.instances.length).toBe(3);
    }, 10_000);

    it('should succeed after transient failure resolves', async () => {
      // First 2 calls fail, 3rd succeeds
      mockControl.poolConnect
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Still failing'))
        .mockResolvedValueOnce({ release: vi.fn() });

      const { getDb } = await import('../lib/database.provider');
      const db = await getDb();

      expect(db).not.toBeNull();
    }, 10_000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // PgBouncer port detection (production mode)
  // ─────────────────────────────────────────────────────────────────────

  describe('PgBouncer port detection', () => {
    it('should warn when DATABASE_URL uses port 5432 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/db');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { getDb } = await import('../lib/database.provider');
      await getDb();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PgBouncer'),
      );
      warnSpy.mockRestore();
    });

    it('should not warn for port 6432 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:6432/db');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { getDb } = await import('../lib/database.provider');
      await getDb();

      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('PgBouncer'),
      );
      warnSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Graceful degradation logging
  // ─────────────────────────────────────────────────────────────────────

  describe('graceful degradation', () => {
    it('should log structured warning when DATABASE_URL is missing', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { getDb } = await import('../lib/database.provider');

      await getDb();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DATABASE_URL is not set'),
      );
      warnSpy.mockRestore();
    });
  });
});

// ============================================================================
// getReader
// ============================================================================

describe('DatabaseProvider — getReader (reader pool)', () => {
  beforeEach(() => {
    vi.resetModules();
    mockControl.instances.length = 0;
    mockControl.poolConnect.mockResolvedValue({ release: vi.fn() });
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('when DATABASE_URL_READER is not set', () => {
    beforeEach(() => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/testdb');
    });

    it('should fall back to writer pool', async () => {
      const { getReader, getDb } = await import('../lib/database.provider');

      const reader = await getReader();
      const writer = await getDb();

      expect(reader).toBe(writer); // Same pool instance
    });
  });

  describe('when DATABASE_URL_READER is set', () => {
    beforeEach(() => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/testdb');
      vi.stubEnv('DATABASE_URL_READER', 'postgresql://user:pass@reader:5432/testdb');
    });

    it('should create a separate reader pool', async () => {
      // getReader with DATABASE_URL_READER set does NOT call getDb() first
      // It only creates the reader pool directly
      const { getReader, getDb } = await import('../lib/database.provider');

      // First create writer pool
      const writer = await getDb();
      expect(writer).not.toBeNull();

      // Then create reader pool
      const reader = await getReader();
      expect(reader).not.toBeNull();

      // Should be separate instances (writer + reader)
      expect(mockControl.instances.length).toBe(2);
      expect(reader).not.toBe(writer);
    });

    it('should return the same cached reader on subsequent calls', async () => {
      const { getReader } = await import('../lib/database.provider');

      const first = await getReader();
      const second = await getReader();

      expect(first).toBe(second);
    });

    it('should return null when reader init fails', async () => {
      // All connect calls fail — reader has no success path
      mockControl.poolConnect.mockRejectedValue(new Error('Reader unavailable'));

      const { getReader } = await import('../lib/database.provider');
      const reader = await getReader();

      // getReader() returns null when reader fails (initializeReaderPool returns null after 3 retries)
      expect(reader).toBeNull();
    }, 10_000);
  });
});

// ============================================================================
// query / queryReader
// ============================================================================

describe('DatabaseProvider — query / queryReader', () => {
  beforeEach(() => {
    vi.resetModules();
    mockControl.instances.length = 0;
    mockControl.poolConnect.mockResolvedValue({ release: vi.fn() });
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('query', () => {
    it('should return null when getDb returns null', async () => {
      // No DATABASE_URL set
      const { query } = await import('../lib/database.provider');
      const result = await query('SELECT 1');
      expect(result).toBeNull();
    });

    it('should delegate to pool.query and return rows + rowCount', async () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/testdb');

      const { query } = await import('../lib/database.provider');

      const result = await query('SELECT * FROM users WHERE id = $1', [1]);

      // Default mock returns empty rows
      expect(result).toEqual({ rows: [], rowCount: 0 });

      // Verify pool.query was called with correct args
      const pool = mockControl.instances[0];
      expect(pool!.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });
  });

  describe('queryReader', () => {
    it('should return null when getReader returns null', async () => {
      const { queryReader } = await import('../lib/database.provider');
      const result = await queryReader('SELECT 1');
      expect(result).toBeNull();
    });

    it('should delegate to reader pool.query', async () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/testdb');
      vi.stubEnv('DATABASE_URL_READER', 'postgresql://user:pass@reader:5432/testdb');

      const { getReader, queryReader } = await import('../lib/database.provider');

      // Need to create reader pool first
      await getReader();

      const result = await queryReader('SELECT count(*) FROM trades');

      // Default mock returns empty rows
      expect(result).toEqual({ rows: [], rowCount: 0 });

      // Verify delegation — queryReader passes undefined params
      const pool = mockControl.instances[0];
      expect(pool!.query).toHaveBeenCalledWith('SELECT count(*) FROM trades', undefined);
    });
  });
});

// ============================================================================
// getDiagnostics
// ============================================================================

describe('DatabaseProvider — getDiagnostics', () => {
  beforeEach(() => {
    vi.resetModules();
    mockControl.instances.length = 0;
    mockControl.poolConnect.mockResolvedValue({ release: vi.fn() });
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should report not configured when DATABASE_URL is missing', async () => {
    const { getDiagnostics } = await import('../lib/database.provider');
    const d = getDiagnostics();
    expect(d.configured).toBe(false);
    expect(d.connected).toBe(false);
    expect(d.databaseUrlSet).toBe(false);
  });

  it('should report configured but not connected after import', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/testdb');
    const { getDiagnostics } = await import('../lib/database.provider');
    const d = getDiagnostics();
    expect(d.configured).toBe(true);
    expect(d.connected).toBe(false);
  });

  it('should report connected after successful getDb', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/testdb');
    const { getDb, getDiagnostics } = await import('../lib/database.provider');

    await getDb();
    const d = getDiagnostics();
    expect(d.configured).toBe(true);
    expect(d.connected).toBe(true);
    expect(d.poolSize).toBe(5);
    expect(d.idleCount).toBe(2);
    expect(d.waitingCount).toBe(0);
  });

  it('should detect Railway deployment', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/testdb');
    vi.stubEnv('RAILWAY_STATIC_URL', 'https://toroloom.railway.app');

    const { getDiagnostics } = await import('../lib/database.provider');
    const d = getDiagnostics();
    expect(d.railwayDeploy).toBe(true);
  });

  it('should detect PgBouncer port (6432)', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:6432/testdb');

    const { getDiagnostics } = await import('../lib/database.provider');
    const d = getDiagnostics();
    expect(d.pgbouncerPort).toBe(true);
  });
});

// ============================================================================
// shutdownDb
// ============================================================================

describe('DatabaseProvider — shutdownDb', () => {
  beforeEach(() => {
    vi.resetModules();
    mockControl.instances.length = 0;
    mockControl.poolConnect.mockResolvedValue({ release: vi.fn() });
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/testdb');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should shut down writer pool gracefully', async () => {
    const { getDb, shutdownDb } = await import('../lib/database.provider');
    await getDb();

    const pool = mockControl.instances[0];

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await shutdownDb();

    expect(pool!.end).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('shut down gracefully'),
    );
    logSpy.mockRestore();
  });

  it('should handle shutdown when no pools are initialized', async () => {
    const { shutdownDb } = await import('../lib/database.provider');
    await expect(shutdownDb()).resolves.not.toThrow();
  });

  it('should handle pool.end errors gracefully', async () => {
    const { getDb, shutdownDb } = await import('../lib/database.provider');
    await getDb();

    const pool = mockControl.instances[0];
    pool!.end.mockRejectedValue(new Error('Connection lost'));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await shutdownDb();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error during writer pool shutdown'),
    );
    errorSpy.mockRestore();
  });
});
