/**
 * ============================================================================
 * Toroloom — Shared Test Database Configuration
 * ============================================================================
 *
 * ACQUISITION COMPLIANCE:
 *   Every integration test previously contained a hardcoded fallback
 *   connection string. This single source of truth replaces all of them.
 *
 *   The acquiring organization can point all tests at a new database by
 *   changing DATABASE_URL / MONGODB_URI in CI env vars — no test file
 *   changes required.
 *
 * USAGE:
 *   import { TEST_DATABASE_URL, TEST_MONGODB_URI, TEST_MONGODB_DB } from './testConfig';
 *
 *   const storage = new PostgreSQLStorage(TEST_DATABASE_URL);
 *   const mongo = new MongoDBStorage(TEST_MONGODB_URI, TEST_MONGODB_DB);
 *
 * CI (GitHub Actions, etc.):
 *   env:
 *     DATABASE_URL: postgresql://ci-user:pass@ci-host:5432/toroloom_test
 *     MONGODB_URI: mongodb://ci-user:pass@ci-mongo:27017
 *     MONGODB_DB_NAME: toroloom_ci
 *
 * ============================================================================
 */

import { env } from '../config/env';

/**
 * PostgreSQL connection string for integration tests.
 *
 * Priority:
 *   1. CI / explicit DATABASE_URL env var
 *   2. Falls back to empty string — tests auto-skip if DB unavailable
 */
export const TEST_DATABASE_URL: string =
  process.env.DATABASE_URL ||
  '';

/**
 * MongoDB URI for integration tests.
 *
 * Priority:
 *   1. CI / explicit MONGODB_URI env var
 *   2. Empty string — tests auto-skip if DB unavailable
 */
export const TEST_MONGODB_URI: string =
  process.env.MONGODB_URI ||
  '';

/**
 * MongoDB database name for integration tests.
 */
export const TEST_MONGODB_DB: string =
  process.env.MONGODB_DB_NAME ||
  'toroloom_test';

/**
 * Check if PostgreSQL is configured for testing.
 */
export const hasTestPostgres = TEST_DATABASE_URL.length > 0;

/**
 * Check if MongoDB is configured for testing.
 */
export const hasTestMongo = TEST_MONGODB_URI.length > 0;
