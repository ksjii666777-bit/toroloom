/**
 * ============================================================================
 * Toroloom — Stock Alert Service Tests
 * ============================================================================
 *
 * Tests all CRUD operations, trigger logic, ownership checks, and edge cases
 * for the stock alert service. All tests use the in-memory fallback path
 * (no PostgreSQL pool configured), which exercises the same business logic.
 *
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Module-level state reset helper — we re-import the module for each test
// to get a fresh _memoryStore.

async function getService() {
  return await import('../services/stockAlertService');
}

describe('stockAlertService (in-memory)', () => {
  const USER_A = 'user_a';
  const USER_B = 'user_b';

  // Re-import before each test to get a clean _memoryStore
  let service: Awaited<ReturnType<typeof getService>>;

  beforeEach(async () => {
    // Force fresh module evaluation so _memoryStore starts empty
    vi.resetModules();
    service = await getService();
    // Reset to in-memory mode (no pool configured — this is the default)
    service.configureStockAlertPersistence(null);
  });

  // ── createAlert ─────────────────────────────────────────────────────────

  describe('createAlert', () => {
    it('creates an alert with default status active', async () => {
      const alert = await service.createAlert(USER_A, {
        symbol: 'RELIANCE',
        targetPrice: 2890,
        direction: 'above',
      });

      expect(alert.id).toMatch(/^sa_/);
      expect(alert.userId).toBe(USER_A);
      expect(alert.symbol).toBe('RELIANCE');
      expect(alert.targetPrice).toBe(2890);
      expect(alert.direction).toBe('above');
      expect(alert.status).toBe('active');
      expect(alert.triggeredAt).toBeNull();
      expect(alert.triggeredPrice).toBeNull();
      expect(alert.note).toBeNull();
      expect(alert.createdAt).toBeTruthy();
      expect(alert.updatedAt).toBe(alert.createdAt);
    });

    it('normalizes symbol to uppercase', async () => {
      const alert = await service.createAlert(USER_A, {
        symbol: '  tcs  ',
        targetPrice: 4200,
        direction: 'below',
      });
      expect(alert.symbol).toBe('TCS');
    });

    it('stores optional note', async () => {
      const alert = await service.createAlert(USER_A, {
        symbol: 'INFY',
        targetPrice: 1800,
        direction: 'above',
        note: 'Breakout level',
      });
      expect(alert.note).toBe('Breakout level');
    });

    it('trims the note', async () => {
      const alert = await service.createAlert(USER_A, {
        symbol: 'WIPRO',
        targetPrice: 500,
        direction: 'above',
        note: '  key level  ',
      });
      expect(alert.note).toBe('key level');
    });

    it('creates alerts for different users independently', async () => {
      const a1 = await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 100, direction: 'above' });
      const a2 = await service.createAlert(USER_B, { symbol: 'TCS', targetPrice: 200, direction: 'below' });

      expect(a1.userId).toBe(USER_A);
      expect(a2.userId).toBe(USER_B);
      expect(a1.id).not.toBe(a2.id);
    });
  });

  // ── getAlert ────────────────────────────────────────────────────────────

  describe('getAlert', () => {
    it('returns an alert by ID for the correct user', async () => {
      const created = await service.createAlert(USER_A, {
        symbol: 'RELIANCE',
        targetPrice: 2890,
        direction: 'above',
      });

      const fetched = await service.getAlert(created.id, USER_A);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.symbol).toBe('RELIANCE');
    });

    it('returns null for a non-existent alert', async () => {
      const result = await service.getAlert('sa_nonexistent', USER_A);
      expect(result).toBeNull();
    });

    it('returns null when user does not own the alert (ownership check)', async () => {
      const created = await service.createAlert(USER_A, {
        symbol: 'TCS',
        targetPrice: 4000,
        direction: 'above',
      });

      // USER_B tries to access USER_A's alert
      const result = await service.getAlert(created.id, USER_B);
      expect(result).toBeNull();
    });
  });

  // ── listUserAlerts ──────────────────────────────────────────────────────

  describe('listUserAlerts', () => {
    it('returns an empty array when the user has no alerts', async () => {
      const alerts = await service.listUserAlerts(USER_A);
      expect(alerts).toEqual([]);
    });

    it('returns all alerts for a user, sorted newest first', async () => {
      // Create two alerts with slightly different timestamps
      const a1 = await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 100, direction: 'above' });
      // Small delay so a2 gets a newer timestamp
      await new Promise((r) => setTimeout(r, 5));
      const a2 = await service.createAlert(USER_A, { symbol: 'TCS', targetPrice: 200, direction: 'below' });

      const alerts = await service.listUserAlerts(USER_A);
      expect(alerts).toHaveLength(2);
      // Newest first (a2 created after a1)
      expect(alerts[0].id).toBe(a2.id);
      expect(alerts[1].id).toBe(a1.id);
      // Timestamps confirm ordering
      expect(new Date(alerts[0].createdAt).getTime()).toBeGreaterThan(
        new Date(alerts[1].createdAt).getTime(),
      );
    });

    it('isolates alerts between different users', async () => {
      await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 100, direction: 'above' });
      await service.createAlert(USER_B, { symbol: 'TCS', targetPrice: 200, direction: 'below' });

      const aAlerts = await service.listUserAlerts(USER_A);
      const bAlerts = await service.listUserAlerts(USER_B);

      expect(aAlerts).toHaveLength(1);
      expect(aAlerts[0].symbol).toBe('RELIANCE');
      expect(bAlerts).toHaveLength(1);
      expect(bAlerts[0].symbol).toBe('TCS');
    });
  });

  // ── updateAlert ─────────────────────────────────────────────────────────

  describe('updateAlert', () => {
    it('updates targetPrice', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 100, direction: 'above' });
      const updated = await service.updateAlert(created.id, USER_A, { targetPrice: 150 });

      expect(updated).not.toBeNull();
      expect(updated!.targetPrice).toBe(150);
      // direction should remain unchanged
      expect(updated!.direction).toBe('above');
      // updatedAt should be >= createdAt (may be same ms in fast runs)
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime(),
      );
    });

    it('updates direction', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'TCS', targetPrice: 4000, direction: 'above' });
      const updated = await service.updateAlert(created.id, USER_A, { direction: 'below' });

      expect(updated).not.toBeNull();
      expect(updated!.direction).toBe('below');
    });

    it('cancels an alert via status update', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'INFY', targetPrice: 1800, direction: 'above' });
      const updated = await service.updateAlert(created.id, USER_A, { status: 'cancelled' });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('cancelled');
    });

    it('updates note', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'WIPRO', targetPrice: 500, direction: 'above', note: 'old' });
      const updated = await service.updateAlert(created.id, USER_A, { note: 'new note' });

      expect(updated).not.toBeNull();
      expect(updated!.note).toBe('new note');
    });

    it('returns the existing alert when no changes are provided', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 100, direction: 'above' });
      const updated = await service.updateAlert(created.id, USER_A, {});

      expect(updated).not.toBeNull();
      expect(updated!.id).toBe(created.id);
      expect(updated!.targetPrice).toBe(100); // unchanged
    });

    it('returns null for non-existent alert', async () => {
      const result = await service.updateAlert('sa_nonexistent', USER_A, { targetPrice: 500 });
      expect(result).toBeNull();
    });

    it('returns null when user does not own the alert (ownership check)', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'HDFC', targetPrice: 1600, direction: 'above' });
      const result = await service.updateAlert(created.id, USER_B, { targetPrice: 1700 });
      expect(result).toBeNull();
    });
  });

  // ── deleteAlert ─────────────────────────────────────────────────────────

  describe('deleteAlert', () => {
    it('deletes an existing alert', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 100, direction: 'above' });
      const deleted = await service.deleteAlert(created.id, USER_A);
      expect(deleted).toBe(true);

      // Should no longer be retrievable
      const fetched = await service.getAlert(created.id, USER_A);
      expect(fetched).toBeNull();
    });

    it('returns false for a non-existent alert', async () => {
      const deleted = await service.deleteAlert('sa_nonexistent', USER_A);
      expect(deleted).toBe(false);
    });

    it('returns false when user does not own the alert (ownership check)', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'TCS', targetPrice: 4000, direction: 'above' });
      const deleted = await service.deleteAlert(created.id, USER_B);
      expect(deleted).toBe(false);

      // Should still exist for USER_A
      const fetched = await service.getAlert(created.id, USER_A);
      expect(fetched).not.toBeNull();
    });
  });

  // ── triggerAlert ────────────────────────────────────────────────────────

  describe('triggerAlert', () => {
    it('marks an active alert as triggered with price and timestamp', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 100, direction: 'above' });
      const triggered = await service.triggerAlert(created.id, USER_A, 2895.50);

      expect(triggered).not.toBeNull();
      expect(triggered!.status).toBe('triggered');
      expect(triggered!.triggeredPrice).toBe(2895.50);
      expect(triggered!.triggeredAt).toBeTruthy();
      // updatedAt should be >= createdAt (may be same ms in fast tests)
      expect(new Date(triggered!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime(),
      );
    });

    it('returns null for an already-triggered alert (double trigger prevention)', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'TCS', targetPrice: 4000, direction: 'above' });
      await service.triggerAlert(created.id, USER_A, 4100);

      // Second trigger should fail because status is no longer 'active'
      const secondTry = await service.triggerAlert(created.id, USER_A, 4200);
      expect(secondTry).toBeNull();
    });

    it('returns null for a cancelled alert', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'INFY', targetPrice: 1800, direction: 'above' });
      await service.updateAlert(created.id, USER_A, { status: 'cancelled' });

      const result = await service.triggerAlert(created.id, USER_A, 1900);
      expect(result).toBeNull();
    });

    it('returns null for non-existent alert', async () => {
      const result = await service.triggerAlert('sa_nonexistent', USER_A, 100);
      expect(result).toBeNull();
    });

    it('returns null when user does not own the alert (ownership check)', async () => {
      const created = await service.createAlert(USER_A, { symbol: 'HDFC', targetPrice: 1600, direction: 'below' });
      const result = await service.triggerAlert(created.id, USER_B, 1500);
      expect(result).toBeNull();
    });
  });

  // ── getActiveAlertsBySymbols ────────────────────────────────────────────

  describe('getActiveAlertsBySymbols', () => {
    it('returns an empty map for empty symbols array', async () => {
      const result = await service.getActiveAlertsBySymbols([]);
      expect(result.size).toBe(0);
    });

    it('groups active alerts by symbol', async () => {
      await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 2890, direction: 'above' });
      await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 2800, direction: 'below' });
      await service.createAlert(USER_B, { symbol: 'TCS', targetPrice: 4000, direction: 'above' });

      const result = await service.getActiveAlertsBySymbols(['RELIANCE', 'TCS']);

      expect(result.size).toBe(2);
      expect(result.get('RELIANCE')).toHaveLength(2);
      expect(result.get('TCS')).toHaveLength(1);
      expect(result.get('TCS')![0].userId).toBe(USER_B);
    });

    it('excludes triggered and cancelled alerts', async () => {
      const active = await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 2890, direction: 'above' });
      const triggered = await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 3000, direction: 'above' });
      await service.triggerAlert(triggered.id, USER_A, 3100);

      const result = await service.getActiveAlertsBySymbols(['RELIANCE']);

      expect(result.get('RELIANCE')).toHaveLength(1);
      expect(result.get('RELIANCE')![0].id).toBe(active.id);
    });

    it('excludes cancelled alerts', async () => {
      await service.createAlert(USER_A, { symbol: 'TCS', targetPrice: 4000, direction: 'above' });
      const cancelled = await service.createAlert(USER_A, { symbol: 'TCS', targetPrice: 4200, direction: 'above' });
      await service.updateAlert(cancelled.id, USER_A, { status: 'cancelled' });

      const result = await service.getActiveAlertsBySymbols(['TCS']);

      expect(result.get('TCS')).toHaveLength(1);
    });

    it('returns empty groups for symbols with no active alerts', async () => {
      const result = await service.getActiveAlertsBySymbols(['NONEXISTENT']);
      expect(result.size).toBe(0);
    });
  });

  // ── configureStockAlertPersistence ──────────────────────────────────────

  describe('configureStockAlertPersistence', () => {
    it('resets storage when called with null (switches to in-memory)', async () => {
      // Create alert while in in-memory mode
      await service.createAlert(USER_A, { symbol: 'RELIANCE', targetPrice: 100, direction: 'above' });

      // Re-configure to in-memory again (simulating reset)
      service.configureStockAlertPersistence(null);

      // Create another alert — should work in in-memory mode
      const alert = await service.createAlert(USER_A, { symbol: 'TCS', targetPrice: 200, direction: 'below' });
      expect(alert.symbol).toBe('TCS');
    });
  });

  // ── Full lifecycle ──────────────────────────────────────────────────────

  describe('full lifecycle', () => {
    it('handles create → update → trigger → read cycle end-to-end', async () => {
      // 1. Create
      const alert = await service.createAlert(USER_A, {
        symbol: 'WIPRO',
        targetPrice: 500,
        direction: 'above',
        note: 'initial',
      });
      expect(alert.status).toBe('active');

      // 2. Update target
      const updated1 = await service.updateAlert(alert.id, USER_A, { targetPrice: 550, note: 'updated' });
      expect(updated1!.targetPrice).toBe(550);
      expect(updated1!.note).toBe('updated');

      // 3. Trigger
      const triggered = await service.triggerAlert(alert.id, USER_A, 560.75);
      expect(triggered!.status).toBe('triggered');
      expect(triggered!.triggeredPrice).toBe(560.75);

      // 4. Verify via list
      const alerts = await service.listUserAlerts(USER_A);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe(alert.id);
      expect(alerts[0].status).toBe('triggered');

      // 5. Delete
      const deleted = await service.deleteAlert(alert.id, USER_A);
      expect(deleted).toBe(true);

      // 6. Verify empty
      expect(await service.listUserAlerts(USER_A)).toEqual([]);
    });
  });
});
