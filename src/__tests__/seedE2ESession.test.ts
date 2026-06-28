/**
 * ============================================================================
 * Toroloom — E2E Session Seed Utility Unit Tests
 * ============================================================================
 *
 * Covers all exported functions:
 *   - createMockZerodhaSession
 *   - createMockAngelSession
 *   - createMockGrowwSession
 *   - seedE2EBrokerSession / seedAllBrokerSessions / clearE2ESessions
 *
 * Depends on sessionStorage (which uses AsyncStorage — mocked via setup.ts).
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/seedE2ESession.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMockZerodhaSession,
  createMockAngelSession,
  createMockGrowwSession,
  seedE2EBrokerSession,
  seedAllBrokerSessions,
  clearE2ESessions,
} from '../services/gateway/seedE2ESession';

// Mock sessionStorage
vi.mock('../services/gateway/sessionStorage', () => ({
  storeBrokerSession: vi.fn().mockResolvedValue(true),
  clearBrokerSession: vi.fn().mockResolvedValue(undefined),
}));

describe('E2E Session Seed Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Functions
  // ─────────────────────────────────────────────────────────────────────────

  describe('createMockZerodhaSession', () => {
    it('should create a Zerodha session with correct broker type', () => {
      const session = createMockZerodhaSession();
      expect(session.brokerType).toBe('zerodha');
    });

    it('should contain Zerodha-specific fields', () => {
      const session = createMockZerodhaSession();
      expect(session.enctoken).toContain('e2e_mock');
      expect(session.accessToken).toContain('e2e_mock');
      expect(session.publicToken).toBeDefined();
    });

    it('should have future expiry date', () => {
      const session = createMockZerodhaSession();
      // expiryAt is always set by the factory function
      const expiry = new Date(session.expiryAt!).getTime();
      expect(expiry).toBeGreaterThan(Date.now());
    });

    it('should have capturedAt set to current time', () => {
      const session = createMockZerodhaSession();
      const captured = new Date(session.capturedAt).getTime();
      expect(Math.abs(captured - Date.now())).toBeLessThan(5000); // within 5 seconds
    });

    it('should have E2E_TEST_USER as userId', () => {
      const session = createMockZerodhaSession();
      expect(session.userId).toBe('E2E_TEST_USER');
    });
  });

  describe('createMockAngelSession', () => {
    it('should create an Angel session with correct broker type', () => {
      const session = createMockAngelSession();
      expect(session.brokerType).toBe('angel');
    });

    it('should contain Angel-specific jwt', () => {
      const session = createMockAngelSession();
      expect(session.jwt).toContain('e2e_mock_jwt');
      expect(session.accessToken).toContain('e2e_mock');
    });

    it('should have E2E_ANGEL_USER as userId', () => {
      const session = createMockAngelSession();
      expect(session.userId).toBe('E2E_ANGEL_USER');
    });

    it('should have future expiry', () => {
      const session = createMockAngelSession();
      // expiryAt is always set by the factory function
      expect(new Date(session.expiryAt!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('createMockGrowwSession', () => {
    it('should create a Groww session with correct broker type', () => {
      const session = createMockGrowwSession();
      expect(session.brokerType).toBe('groww');
    });

    it('should contain Groww-specific fields', () => {
      const session = createMockGrowwSession();
      expect(session.accessToken).toContain('e2e_mock_groww');
    });

    it('should have E2E_GROWW_USER as userId', () => {
      const session = createMockGrowwSession();
      expect(session.userId).toBe('E2E_GROWW_USER');
    });

    it('should have undefined jwt and enctoken', () => {
      const session = createMockGrowwSession();
      expect(session.jwt).toBeUndefined();
      expect(session.enctoken).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Seed / Clear Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('seedE2EBrokerSession', () => {
    it('should seed a Zerodha session by default', async () => {
      const result = await seedE2EBrokerSession();
      expect(result).toBe(true);
    });

    it('should seed an Angel session', async () => {
      const result = await seedE2EBrokerSession('angel');
      expect(result).toBe(true);
    });

    it('should seed a Groww session', async () => {
      const result = await seedE2EBrokerSession('groww');
      expect(result).toBe(true);
    });
  });

  describe('seedAllBrokerSessions', () => {
    it('should seed all three broker sessions', async () => {
      const results = await seedAllBrokerSessions();
      expect(results).toHaveLength(3);
      expect(results.every(r => r === true)).toBe(true);
    });
  });

  describe('clearE2ESessions', () => {
    it('should clear all three broker sessions', async () => {
      await expect(clearE2ESessions()).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('all created sessions should be valid BrokerSession types', () => {
      const sessions = [
        createMockZerodhaSession(),
        createMockAngelSession(),
        createMockGrowwSession(),
      ];

      for (const session of sessions) {
        expect(session.brokerType).toBeDefined();
        expect(session.userId).toBeDefined();
        expect(session.capturedAt).toBeDefined();
        expect(session.expiryAt).toBeDefined();
        expect(session.cookies).toBeDefined();
      }
    });

    it('should create 24-hour future expiry for all sessions', () => {
      const sessions = [
        createMockZerodhaSession(),
        createMockAngelSession(),
        createMockGrowwSession(),
      ];

      for (const session of sessions) {
        // Both fields are always set by the factory functions
        const expiryMs = new Date(session.expiryAt!).getTime() - new Date(session.capturedAt).getTime();
        // Should be 24 hours (86400000 ms) within a small tolerance
        expect(Math.abs(expiryMs - 86400000)).toBeLessThan(100);
      }
    });
  });
});
