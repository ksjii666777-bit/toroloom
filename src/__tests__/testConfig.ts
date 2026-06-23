/**
 * ============================================================================
 * Toroloom — Shared Frontend Test Configuration
 * ============================================================================
 *
 * Single source of truth for test environment variables.
 * Acquiring organizations override TEST_API_BASE in CI by setting API_BASE_URL
 * or editing this constant. No test file contains a hardcoded localhost URL.
 *
 * ============================================================================
 */

/** Base URL for the Toroloom API during tests. */
export const TEST_API_BASE: string =
  process.env.API_BASE_URL || 'http://localhost:3000/api';
