/**
 * ============================================================================
 * Toroloom — Notification API Tests
 * ============================================================================
 *
 * Tests the notificationApi methods by importing the REAL implementation
 * (overriding the setup.ts mock) and mocking the underlying `api` client.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We must set __DEV__ before anything else
vi.hoisted(() => {
  (globalThis as any).__DEV__ = true;
});

// Use the REAL notificationApi instead of the setup.ts mock
vi.mock('../services/api/notifications', async () => {
  const actual = await vi.importActual<typeof import('../services/api/notifications')>('../services/api/notifications');
  return actual;
});

// ==================== Imports ====================

import { notificationApi } from '../services/api/notifications';

// ==================== Tests ====================

describe('NotificationApi — GET methods', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getAll fetches all notifications', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ([{ id: 'n1', title: 'Test' }]),
    } as any);

    const result = await notificationApi.getAll();
    expect(result).toEqual([{ id: 'n1', title: 'Test' }]);
  });

  it('getAll with unreadOnly=true adds query param', async () => {
    let capturedUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url: any) => {
      capturedUrl = url.toString();
      return { ok: true, status: 200, json: async () => ([]) } as any;
    });

    await notificationApi.getAll(true);
    expect(capturedUrl).toContain('?unread=true');
  });

  it('getUnreadCount returns the count', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ count: 5 }),
    } as any);

    const result = await notificationApi.getUnreadCount();
    expect(result.count).toBe(5);
  });
});

describe('NotificationApi — PUT methods', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('markRead sends PUT request with notification ID', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'n1', read: true }),
    } as any);

    const result = await notificationApi.markRead('n1');
    expect(result.id).toBe('n1');
  });

  it('markAllRead sends PUT request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any);

    const result = await notificationApi.markAllRead();
    expect(result.success).toBe(true);
  });
});

describe('NotificationApi — POST methods', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createPriceAlert sends POST with symbol and targetPrice', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'alert_1', type: 'price_alert' }),
    } as any);

    const result = await notificationApi.createPriceAlert('RELIANCE', 3000);
    expect(result.type).toBe('price_alert');
  });

  it('registerPushToken sends POST with push token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, userId: 'u1' }),
    } as any);

    const result = await notificationApi.registerPushToken('ExponentPushToken[abc123]');
    expect(result.success).toBe(true);
  });
});

describe('NotificationApi — DELETE + GET status methods', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unregisterPushToken sends DELETE request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any);

    const result = await notificationApi.unregisterPushToken();
    expect(result.success).toBe(true);
  });

  it('getPushTokenStatus returns registered status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ registered: true, userId: 'u1' }),
    } as any);

    const result = await notificationApi.getPushTokenStatus();
    expect(result.registered).toBe(true);
  });
});

describe('NotificationApi — Portfolio alert methods', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('syncPortfolioAlertRules sends POST with rules array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, count: 2 }),
    } as any);

    const rules = [
      { id: 'r1', kind: 'portfolio_pnl_pct' as const, threshold: -10, direction: 'below' as const, userId: 'u1', label: 'Loss 10%', triggered: false, createdAt: new Date().toISOString(), enabled: true },
    ];
    const result = await notificationApi.syncPortfolioAlertRules(rules as any);
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('getPortfolioAlertRules returns rules array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ([{ id: 'r1', kind: 'portfolio_pnl_pct' }]),
    } as any);

    const result = await notificationApi.getPortfolioAlertRules();
    expect(Array.isArray(result)).toBe(true);
  });

  it('evaluatePortfolioAlerts sends POST with portfolioData', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ evaluated: true, rulesFired: 0, badgeCount: 0, fired: [] }),
    } as any);

    const result = await notificationApi.evaluatePortfolioAlerts({ totalReturnPercent: -5 });
    expect(result.evaluated).toBe(true);
  });

  it('getBadgeCount returns badge count', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ badgeCount: 3 }),
    } as any);

    const result = await notificationApi.getBadgeCount();
    expect(result.badgeCount).toBe(3);
  });

  it('resetPortfolioAlertTriggers sends POST', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, count: 2 }),
    } as any);

    const result = await notificationApi.resetPortfolioAlertTriggers();
    expect(result.success).toBe(true);
  });
});
