/**
 * ============================================================================
 * Cross-File Isolation — WebSocket State — File B
 * ============================================================================
 *
 * File B runs after File A (in the same vitest fork with singleFork=true)
 * and verifies that all WebSocket module-level state maps are clean —
 * proving that File A's afterAll(resetWebSocketState) properly isolated
 * the singleton across test file boundaries.
 *
 * After verifying isolation, File B exercises the same state maps to
 * confirm they work independently for new data.
 *
 * Run with singleFork=true:
 *   npx vitest run --config vitest.cross-file.config.ts \
 *     src/__tests__/wsCrossFileA.test.ts src/__tests__/wsCrossFileB.test.ts
 * ============================================================================
 */

import { describe, it, expect, afterAll } from 'vitest';
import {
  clients,
  userPositions,
  userConnectionCount,
  rateLimitMap,
  connectionAlertedUsers,
  incrementConnectionCount,
  decrementConnectionCount,
  resetWebSocketState,
} from '../websocket/state';

const TEST_USER = 'ws_cross_file_user_b_test';

describe('WebSocket State — File B (Isolation Verification)', () => {

  afterAll(() => {
    resetWebSocketState();
  });

  // ── 1. All state maps should be empty ────────────────────────────

  it('should have empty clients map (File A state cleaned)', () => {
    expect(clients.size).toBe(0);
  });

  it('should have empty userPositions map (File A state cleaned)', () => {
    expect(userPositions.size).toBe(0);
  });

  it('should have empty userConnectionCount map (File A state cleaned)', () => {
    expect(userConnectionCount.size).toBe(0);
  });

  it('should have empty rateLimitMap (File A state cleaned)', () => {
    expect(rateLimitMap.size).toBe(0);
  });

  it('should have empty connectionAlertedUsers set (File A state cleaned)', () => {
    expect(connectionAlertedUsers.size).toBe(0);
  });

  // ── 2. Independent state works ───────────────────────────────────

  it('should independently work with new connection counts', () => {
    incrementConnectionCount(TEST_USER);
    expect(userConnectionCount.get(TEST_USER)).toBe(1);
    expect(userConnectionCount.size).toBe(1);
  });

  it('should independently store positions for a new user', () => {
    const positions = new Map([
      ['TCS', { symbol: 'TCS', quantity: 10, buyPrice: 3500, currentPrice: 3600, pnl: 1000 } as any],
    ]);
    userPositions.set(TEST_USER, positions);
    expect(userPositions.size).toBe(1);
    expect(userPositions.get(TEST_USER)!.size).toBe(1);
    expect(userPositions.get(TEST_USER)!.get('TCS')!.pnl).toBe(1000);
  });

  // ── 3. Decrement works ───────────────────────────────────────────

  it('should properly decrement connection count', () => {
    decrementConnectionCount(TEST_USER);
    expect(userConnectionCount.has(TEST_USER)).toBe(false);
  });

  // ── 4. Final cleanup verification ─────────────────────────────────

  it('should have only our own state (no File A leakage)', () => {
    // Only our test user's data should exist — nothing from File A
    expect(userConnectionCount.has('ws_cross_file_user_a')).toBe(false);
    expect(userConnectionCount.has('ws_cross_file_user_b')).toBe(false);
    expect(userPositions.has('ws_cross_file_user_a')).toBe(false);
    expect(userPositions.has('ws_cross_file_user_b')).toBe(false);
  });
});
