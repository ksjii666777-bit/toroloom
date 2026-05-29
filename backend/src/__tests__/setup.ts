/**
 * ============================================================================
 * Toroloom Backend Test Setup
 * ============================================================================
 *
 * This file runs before every backend test suite. Unlike the frontend setup,
 * the backend has no React Native dependencies to mock.
 *
 * Key responsibilities:
 *   1. Set global test timeouts
 *   2. Mock any Node.js native modules that differ across platforms
 *   3. Clear any module-level state that persists across test files
 *
 * ============================================================================
 */

// ──── Global Test Configuration ─────────────────────────────────────────────

// Increase the default hook timeout for beforeAll/afterAll.
// Some tests start HTTP/WS servers or connect to databases.
vi.hoisted(() => {
  // This runs before all imports, ensuring any module-level
  // side effects during import don't interfere with test setup.
});

// ──── Shared Mocks ──────────────────────────────────────────────────────────

// If any backend module tries to read .env directly during import,
// ensure default values are provided so tests don't hang on missing env vars.
// This is handled by env.ts which has fallback defaults.

// ──── Cleanup ───────────────────────────────────────────────────────────────

// Some tests (e.g., WebSocket tests) leave module-level state in
// state.ts or the circuitBreaker registry. We reset these between
// test files via beforeEach in each test file — no global cleanup needed.
