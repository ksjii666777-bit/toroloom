/**
 * ============================================================================
 * Toroloom — Notifications API Tests
 * ============================================================================
 *
 * Tests the notificationApi module: getAll, markRead, markAllRead,
 * getUnreadCount, createPriceAlert. Each test mocks globalThis.fetch
 * to verify correct URL construction, HTTP methods, and request bodies.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.unmock('../services/api/notifications');

import { configureApi } from '../services/api/client';
import { notificationApi } from '../services/api/notifications';
import type { Mock } from 'vitest';

const API_BASE = 'http://localhost:3000/api';
const originalFetch = globalThis.fetch;

// ============================================================================
// notificationApi — getAll
// ============================================================================

describe('notificationApi — getAll', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /notifications without unread filter', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockNotifications = [
      { id: 'n1', type: 'price_alert', title: 'Price Alert', message: 'TCS up 5%', read: false, timestamp: '2025-06-01T10:00:00Z' },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockNotifications) };
    });

    const result = await notificationApi.getAll();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/notifications`);
    expect(result).toEqual(mockNotifications);
  });

  it('sends GET to /notifications?unread=true when unreadOnly is true', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await notificationApi.getAll(true);
    expect(capturedUrl).toBe(`${API_BASE}/notifications?unread=true`);
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await notificationApi.getAll();
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('returns empty array when no notifications', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await notificationApi.getAll();
    expect(result).toEqual([]);
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to fetch notifications' }),
    });
    await expect(notificationApi.getAll()).rejects.toThrow('Failed to fetch notifications');
  });
});

// ============================================================================
// notificationApi — markRead
// ============================================================================

describe('notificationApi — markRead', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends PUT to /notifications/{id}/read', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody: any = 'not_undefined';
    const mockNotification = { id: 'n1', type: 'price_alert', title: 'Price Alert', message: 'TCS up 5%', read: true, timestamp: '2025-06-01T10:00:00Z' };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockNotification) };
    });

    const result = await notificationApi.markRead('n1');

    expect(capturedMethod).toBe('PUT');
    expect(capturedUrl).toBe(`${API_BASE}/notifications/n1/read`);
    expect(capturedBody).toBeUndefined();
    expect(result).toEqual(mockNotification);
  });

  it('returns notification with read=true on success', async () => {
    const readNotification = { id: 'n1', type: 'price_alert', title: 'Alert', message: 'Test', read: true, timestamp: '2025-06-01T10:00:00Z' };
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(readNotification),
    });

    const result = await notificationApi.markRead('n1');
    expect(result.read).toBe(true);
  });

  it('throws on 404 for unknown notification', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Notification not found' }),
    });
    await expect(notificationApi.markRead('invalid')).rejects.toThrow('Notification not found');
  });
});

// ============================================================================
// notificationApi — markAllRead
// ============================================================================

describe('notificationApi — markAllRead', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends PUT to /notifications/read-all', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody: any = 'not_undefined';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ success: true }) };
    });

    const result = await notificationApi.markAllRead();

    expect(capturedMethod).toBe('PUT');
    expect(capturedUrl).toBe(`${API_BASE}/notifications/read-all`);
    expect(capturedBody).toBeUndefined();
    expect(result).toEqual({ success: true });
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to mark all as read' }),
    });
    await expect(notificationApi.markAllRead()).rejects.toThrow('Failed to mark all as read');
  });
});

// ============================================================================
// notificationApi — getUnreadCount
// ============================================================================

describe('notificationApi — getUnreadCount', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /notifications/unread-count', async () => {
    let capturedUrl = '', capturedMethod = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve({ count: 3 }) };
    });

    const result = await notificationApi.getUnreadCount();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/notifications/unread-count`);
    expect(result).toEqual({ count: 3 });
  });

  it('returns zero count when all read', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ count: 0 }),
    });

    const result = await notificationApi.getUnreadCount();
    expect(result.count).toBe(0);
  });
});

// ============================================================================
// notificationApi — createPriceAlert
// ============================================================================

describe('notificationApi — createPriceAlert', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /notifications/price-alert with symbol and targetPrice', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    const mockNotification = { id: 'n_alert', type: 'price_alert', title: 'Price Alert Set', message: 'Alert set for RELIANCE at ₹3,000', read: false, timestamp: '2025-06-01T10:00:00Z' };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockNotification) };
    });

    const result = await notificationApi.createPriceAlert('RELIANCE', 3000);

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/notifications/price-alert`);
    expect(JSON.parse(capturedBody)).toEqual({ symbol: 'RELIANCE', targetPrice: 3000 });
    expect(result).toEqual(mockNotification);
  });

  it('handles zero target price', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ id: 'n2', type: 'price_alert', title: 'Alert', message: 'Alert', read: false, timestamp: '2025-06-01T10:00:00Z' }) };
    });

    await notificationApi.createPriceAlert('TCS', 0);
    expect(JSON.parse(capturedBody)).toEqual({ symbol: 'TCS', targetPrice: 0 });
  });

  it('throws on validation error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 400, json: () => Promise.resolve({ error: 'Invalid target price' }),
    });
    await expect(notificationApi.createPriceAlert('RELIANCE', -100)).rejects.toThrow('Invalid target price');
  });

  it('throws on network error', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(notificationApi.createPriceAlert('TCS', 4000)).rejects.toThrow('Failed to fetch');
  });
});
