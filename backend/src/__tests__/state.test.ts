/**
 * ============================================================================
 * Toroloom WebSocket State — Unit Tests
 * ============================================================================
 *
 * Tests the exported helpers from state.ts in isolation.
 * Module-level maps are reset before each test to prevent bleed.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/state.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { WebSocket } from 'ws';
import { Position } from '../services/broker/interface';
import * as state from '../websocket/state';

// ──── Mock jsonwebtoken for decodeToken tests ───────────────────────────────

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

import jwt from 'jsonwebtoken';
const mockVerify = jwt.verify as Mock;

// ──── Helpers ───────────────────────────────────────────────────────────────

function makeMockWs(): WebSocket {
  // Create a minimal mock that satisfies the WebSocket type
  return { readyState: 1 } as unknown as WebSocket;
}

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    symbol: 'RELIANCE',
    quantity: 50,
    buyPrice: 2650,
    currentPrice: 2700,
    pnl: 2500,
    pnlPercent: 1.89,
    ...overrides,
  };
}

// ──── Suite ─────────────────────────────────────────────────────────────────

describe('WebSocket State Helpers', () => {

  // Reset module-level state before each test to guarantee isolation
  beforeEach(() => {
    state.userConnectionCount.clear();
    state.userPositions.clear();
    state.rateLimitMap.clear();
    state.connectionAlertedUsers.clear();
    vi.clearAllMocks();
  });

  // ──────── decodeToken ──────────────────────────────────────────

  describe('decodeToken', () => {
    const VALID_PAYLOAD = { userId: 'user1', email: 'a@b.com' };

    it('should return the decoded payload for a valid token', () => {
      mockVerify.mockReturnValue(VALID_PAYLOAD);
      expect(state.decodeToken('valid-token')).toEqual(VALID_PAYLOAD);
      expect(mockVerify).toHaveBeenCalledWith('valid-token', expect.any(String));
    });

    it('should return null when jwt.verify throws (invalid token)', () => {
      mockVerify.mockImplementation(() => { throw new Error('jwt malformed'); });
      expect(state.decodeToken('bad-token')).toBeNull();
    });

    it('should return null when jwt.verify throws (expired token)', () => {
      mockVerify.mockImplementation(() => { throw new Error('jwt expired'); });
      expect(state.decodeToken('expired-token')).toBeNull();
    });

    it('should return null for an empty token string', () => {
      mockVerify.mockImplementation(() => { throw new Error('jwt malformed'); });
      expect(state.decodeToken('')).toBeNull();
    });
  });

  // ──────── checkRateLimit ───────────────────────────────────────

  describe('checkRateLimit', () => {
    it('should allow the first message from a connection', () => {
      const ws = makeMockWs();
      expect(state.checkRateLimit(ws)).toBe(true);
    });

    it('should allow up to RATE_LIMIT_MAX_MESSAGES in a window', () => {
      const ws = makeMockWs();
      const max = state.RATE_LIMIT_MAX_MESSAGES;

      for (let i = 0; i < max; i++) {
        expect(state.checkRateLimit(ws)).toBe(true);
      }
    });

    it('should block messages exceeding the limit in the same window', () => {
      const ws = makeMockWs();
      const max = state.RATE_LIMIT_MAX_MESSAGES;

      for (let i = 0; i < max; i++) {
        state.checkRateLimit(ws);
      }

      // The next message should be blocked
      expect(state.checkRateLimit(ws)).toBe(false);
    });

    it('should reset the counter after the window expires', () => {
      const ws = makeMockWs();
      const max = state.RATE_LIMIT_MAX_MESSAGES;

      // Exhaust the limit
      for (let i = 0; i < max; i++) {
        state.checkRateLimit(ws);
      }
      expect(state.checkRateLimit(ws)).toBe(false);

      // Manually expire the window by backdating the state
      const stateEntry = state.rateLimitMap.get(ws)!;
      stateEntry.windowStart -= state.RATE_LIMIT_WINDOW_MS;

      // Should be allowed in the new window
      expect(state.checkRateLimit(ws)).toBe(true);
    });

    it('should track independent rate limits for different connections', () => {
      const ws1 = makeMockWs();
      const ws2 = makeMockWs();
      const max = state.RATE_LIMIT_MAX_MESSAGES;

      // Exhaust ws1
      for (let i = 0; i < max; i++) {
        state.checkRateLimit(ws1);
      }
      expect(state.checkRateLimit(ws1)).toBe(false);

      // ws2 should still have its full budget
      for (let i = 0; i < max; i++) {
        expect(state.checkRateLimit(ws2)).toBe(true);
      }
      expect(state.checkRateLimit(ws2)).toBe(false);
    });
  });

  // ──────── incrementConnectionCount ─────────────────────────────

  describe('incrementConnectionCount', () => {
    it('should set count to 1 for a new user', () => {
      state.incrementConnectionCount('user-a');
      expect(state.userConnectionCount.get('user-a')).toBe(1);
    });

    it('should increment count for an existing user', () => {
      state.incrementConnectionCount('user-a');
      state.incrementConnectionCount('user-a');
      expect(state.userConnectionCount.get('user-a')).toBe(2);
    });

    it('should track separate counts for different users', () => {
      state.incrementConnectionCount('user-a');
      state.incrementConnectionCount('user-a');
      state.incrementConnectionCount('user-b');

      expect(state.userConnectionCount.get('user-a')).toBe(2);
      expect(state.userConnectionCount.get('user-b')).toBe(1);
    });

    it('should add to connectionAlertedUsers when exceeding MAX_CONNECTIONS_PER_USER', () => {
      const max = state.MAX_CONNECTIONS_PER_USER;
      // Increment to exactly MAX — no alert yet
      for (let i = 0; i < max; i++) {
        state.incrementConnectionCount('alert-user');
      }
      expect(state.connectionAlertedUsers.has('alert-user')).toBe(false);

      // One more — exceeds threshold, alert should fire
      state.incrementConnectionCount('alert-user');
      expect(state.connectionAlertedUsers.has('alert-user')).toBe(true);
    });

    it('should not re-add to connectionAlertedUsers if already alerted', () => {
      const max = state.MAX_CONNECTIONS_PER_USER;
      // Exceed threshold
      for (let i = 0; i < max + 1; i++) {
        state.incrementConnectionCount('dup-user');
      }
      expect(state.connectionAlertedUsers.has('dup-user')).toBe(true);

      // Increase further — alert should not be re-added (it's already there)
      state.incrementConnectionCount('dup-user');
      expect(state.connectionAlertedUsers.size).toBe(1);
    });

    it('should not alert when count is at or below the limit', () => {
      const max = state.MAX_CONNECTIONS_PER_USER;
      for (let i = 0; i < max; i++) {
        state.incrementConnectionCount('under-limit');
      }
      expect(state.connectionAlertedUsers.has('under-limit')).toBe(false);
    });
  });

  // ──────── decrementConnectionCount ─────────────────────────────

  describe('decrementConnectionCount', () => {
    it('should delete user state when count drops to zero', () => {
      state.incrementConnectionCount('user-a');
      state.userPositions.set('user-a', new Map([['RELIANCE', makePosition()]]));

      state.decrementConnectionCount('user-a');

      expect(state.userConnectionCount.has('user-a')).toBe(false);
      expect(state.userPositions.has('user-a')).toBe(false);
      expect(state.connectionAlertedUsers.has('user-a')).toBe(false);
    });

    it('should decrement count without deleting positions when count > 1', () => {
      state.incrementConnectionCount('user-a');
      state.incrementConnectionCount('user-a');
      state.userPositions.set('user-a', new Map([['RELIANCE', makePosition()]]));

      state.decrementConnectionCount('user-a');

      expect(state.userConnectionCount.get('user-a')).toBe(1);
      expect(state.userPositions.has('user-a')).toBe(true);
    });

    it('should reset connectionAlertedUsers when count drops to or below the threshold', () => {
      const max = state.MAX_CONNECTIONS_PER_USER;
      // Push past the threshold
      for (let i = 0; i < max + 1; i++) {
        state.incrementConnectionCount('tabby');
      }
      expect(state.connectionAlertedUsers.has('tabby')).toBe(true);

      // Close one tab — count goes from 6 → 5 (at threshold, alert cleared)
      state.decrementConnectionCount('tabby');
      expect(state.userConnectionCount.get('tabby')).toBe(max);
      expect(state.connectionAlertedUsers.has('tabby')).toBe(false);

      // Close another — count goes to 4 (below threshold, still no alert)
      state.decrementConnectionCount('tabby');
      expect(state.userConnectionCount.get('tabby')).toBe(max - 1);
      expect(state.connectionAlertedUsers.has('tabby')).toBe(false);
    });

    it('should handle decrement for an unknown user gracefully', () => {
      // Should not throw
      expect(() => state.decrementConnectionCount('ghost-user')).not.toThrow();
      expect(state.userConnectionCount.has('ghost-user')).toBe(false);
      expect(state.userPositions.has('ghost-user')).toBe(false);
    });

    it('should only delete positions on the final decrement', () => {
      state.incrementConnectionCount('user-a');
      state.incrementConnectionCount('user-a');
      state.incrementConnectionCount('user-a');
      state.userPositions.set('user-a', new Map([['TCS', makePosition()]]));

      // Two decrements — positions should survive
      state.decrementConnectionCount('user-a');
      expect(state.userPositions.has('user-a')).toBe(true);

      state.decrementConnectionCount('user-a');
      expect(state.userPositions.has('user-a')).toBe(true);

      // Final decrement — positions should be removed
      state.decrementConnectionCount('user-a');
      expect(state.userPositions.has('user-a')).toBe(false);
      expect(state.userConnectionCount.has('user-a')).toBe(false);
    });
  });

  // ──────── totalUnrealizedPnL ───────────────────────────────────

  describe('totalUnrealizedPnL', () => {
    it('should return 0 for an empty map', () => {
      expect(state.totalUnrealizedPnL(new Map())).toBe(0);
    });

    it('should return the PnL of a single position', () => {
      const positions = new Map([['RELIANCE', makePosition({ pnl: 5000 })]]);
      expect(state.totalUnrealizedPnL(positions)).toBe(5000);
    });

    it('should sum PnL across multiple positions', () => {
      const positions = new Map([
        ['RELIANCE', makePosition({ symbol: 'RELIANCE', pnl: 2500 })],
        ['HDFCBANK', makePosition({ symbol: 'HDFCBANK', pnl: 1800 })],
        ['TCS', makePosition({ symbol: 'TCS', pnl: 3200 })],
      ]);
      expect(state.totalUnrealizedPnL(positions)).toBe(7500);
    });

    it('should handle negative PnL values correctly', () => {
      const positions = new Map([
        ['RELIANCE', makePosition({ symbol: 'RELIANCE', pnl: 5000 })],
        ['HDFCBANK', makePosition({ symbol: 'HDFCBANK', pnl: -2000 })],
      ]);
      expect(state.totalUnrealizedPnL(positions)).toBe(3000);
    });

    it('should return 0 when all positions have zero PnL', () => {
      const positions = new Map([
        ['A', makePosition({ symbol: 'A', pnl: 0 })],
        ['B', makePosition({ symbol: 'B', pnl: 0 })],
      ]);
      expect(state.totalUnrealizedPnL(positions)).toBe(0);
    });
  });

  // ──────── loadUserPositions ────────────────────────────────────

  describe('loadUserPositions', () => {
    it('should fetch positions from the provided broker and store them', async () => {
      const mockPositions = [
        makePosition({ symbol: 'RELIANCE', pnl: 2500 }),
        makePosition({ symbol: 'TCS', pnl: 1800 }),
      ];
      const mockBroker = {
        getPositions: vi.fn().mockResolvedValue(mockPositions),
      } as any;

      // Reset any pre-existing state
      state.userPositions.delete('user-x');

      const result = await state.loadUserPositions('user-x', mockBroker);

      expect(mockBroker.getPositions).toHaveBeenCalledTimes(1);
      expect(result.size).toBe(2);
      expect(result.get('RELIANCE')!.pnl).toBe(2500);
      expect(result.get('TCS')!.pnl).toBe(1800);

      // Should also be stored in the module-level cache
      expect(state.userPositions.get('user-x')!.get('RELIANCE')!.pnl).toBe(2500);
    });

    it('should not update userPositions cache on broker error', async () => {
      const mockBroker = {
        getPositions: vi.fn().mockRejectedValue(new Error('API down')),
      } as any;

      const result = await state.loadUserPositions('user-y', mockBroker);

      expect(result.size).toBe(0);
      // The catch block returns an empty map but does NOT update
      // the module-level userPositions cache
      expect(state.userPositions.has('user-y')).toBe(false);
    });

    it('should replace existing cached positions on re-auth', async () => {
      const oldPositions = [makePosition({ symbol: 'OLD', pnl: 100 })];
      const newPositions = [makePosition({ symbol: 'NEW', pnl: 200 })];

      const broker1 = { getPositions: vi.fn().mockResolvedValue(oldPositions) } as any;
      const broker2 = { getPositions: vi.fn().mockResolvedValue(newPositions) } as any;

      await state.loadUserPositions('user-z', broker1);
      expect(state.userPositions.get('user-z')!.has('OLD')).toBe(true);

      await state.loadUserPositions('user-z', broker2);
      expect(state.userPositions.get('user-z')!.has('OLD')).toBe(false);
      expect(state.userPositions.get('user-z')!.has('NEW')).toBe(true);
    });

    it('should handle an empty positions array from the broker', async () => {
      const mockBroker = {
        getPositions: vi.fn().mockResolvedValue([]),
      } as any;

      const result = await state.loadUserPositions('user-empty', mockBroker);
      expect(result.size).toBe(0);
      expect(state.userPositions.get('user-empty')!.size).toBe(0);
    });
  });
});
