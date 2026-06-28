/**
 * ============================================================================
 * Toroloom — Push Notification Service Unit Tests
 * ============================================================================
 *
 * Covers all exported functions of the pushNotifications service:
 *   - sendExpoPushNotification (validation, API calls, error handling)
 *   - sendBulkExpoPushNotifications (batching, mixed results)
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/pushNotifications.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendExpoPushNotification, sendBulkExpoPushNotifications } from '../services/pushNotifications';

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('Push Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // sendExpoPushNotification — Token Validation
  // ─────────────────────────────────────────────────────────────────────────

  describe('Token Validation', () => {
    it('should reject empty push token', async () => {
      const result = await sendExpoPushNotification('', 'Title', 'Body');
      expect(result.status).toBe('error');
      expect(result.message).toBe('Invalid push token format');
    });

    it('should reject malformed push token', async () => {
      const result = await sendExpoPushNotification('not-a-valid-token', 'Title', 'Body');
      expect(result.status).toBe('error');
      expect(result.message).toBe('Invalid push token format');
    });

    it('should reject token without closing bracket', async () => {
      const result = await sendExpoPushNotification('ExponentPushToken[abc123', 'Title', 'Body');
      expect(result.status).toBe('error');
      expect(result.message).toBe('Invalid push token format');
    });

    it('should accept valid ExponentPushToken', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [{ status: 'ok', id: 'ticket-abc' }] }),
      });

      const result = await sendExpoPushNotification('ExponentPushToken[abc123]', 'Title', 'Body');
      expect(result.status).toBe('ok');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // sendExpoPushNotification — API Calls
  // ─────────────────────────────────────────────────────────────────────────

  describe('API Calls', () => {
    const VALID_TOKEN = 'ExponentPushToken[test-token-001]';

    it('should send correct request to Expo API', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [{ status: 'ok', id: 'ticket-xyz' }] }),
      });

      await sendExpoPushNotification(VALID_TOKEN, 'Test Title', 'Test Body', { key: 'value' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://exp.host/--/api/v2/push/send');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.to).toBe(VALID_TOKEN);
      expect(body.title).toBe('Test Title');
      expect(body.body).toBe('Test Body');
      expect(body.data).toEqual({ key: 'value' });
      expect(body.sound).toBe('default');
      expect(body.priority).toBe('high');
    });

    it('should include badge number when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [{ status: 'ok', id: 'ticket-badge' }] }),
      });

      await sendExpoPushNotification(VALID_TOKEN, 'Title', 'Body', {}, 5);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.badge).toBe(5);
    });

    it('should omit badge when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [{ status: 'ok', id: 'ticket-nobadge' }] }),
      });

      await sendExpoPushNotification(VALID_TOKEN, 'Title', 'Body');

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.badge).toBeUndefined();
    });

    it('should return ok with ticket id on success', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [{ status: 'ok', id: 'ticket-success-1' }] }),
      });

      const result = await sendExpoPushNotification(VALID_TOKEN, 'Title', 'Body');
      expect(result.status).toBe('ok');
      expect(result.id).toBe('ticket-success-1');
    });

    it('should handle Expo API error ticket', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: [{ status: 'error', message: 'DeviceNotRegistered', details: { error: 'invalid' } }],
        }),
      });

      const result = await sendExpoPushNotification(VALID_TOKEN, 'Title', 'Body');
      expect(result.status).toBe('error');
      expect(result.message).toBe('DeviceNotRegistered');
      expect(result.details).toEqual({ error: 'invalid' });
    });

    it('should handle empty response from Expo API', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [] }),
      });

      const result = await sendExpoPushNotification(VALID_TOKEN, 'Title', 'Body');
      expect(result.status).toBe('error');
      expect(result.message).toBe('Empty response from Expo API');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      const result = await sendExpoPushNotification(VALID_TOKEN, 'Title', 'Body');
      expect(result.status).toBe('error');
      expect(result.message).toBe('Network request failed');
    });

    it('should handle non-Error rejects (e.g., string)', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const result = await sendExpoPushNotification(VALID_TOKEN, 'Title', 'Body');
      expect(result.status).toBe('error');
      // Non-Error rejects fall back to 'Network error' since strings lack a .message property
      expect(result.message).toBe('Network error');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // sendBulkExpoPushNotifications
  // ─────────────────────────────────────────────────────────────────────────

  describe('Bulk Sending', () => {
    it('should send single message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [{ status: 'ok', id: 'bulk-1' }] }),
      });

      const results = await sendBulkExpoPushNotifications([
        { pushToken: 'ExponentPushToken[user-1]', title: 'Alert', body: 'Test' },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('ok');
      expect(results[0].id).toBe('bulk-1');
    });

    it('should batch messages in groups of 100', async () => {
      // First batch returns 100 tickets, second batch returns 50 tickets
      mockFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            data: Array.from({ length: 100 }, (_, i) => ({ status: 'ok', id: `ticket-${i}` })),
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            data: Array.from({ length: 50 }, (_, i) => ({ status: 'ok', id: `ticket-b${i}` })),
          }),
        });

      // Send 150 messages — should result in 2 batches
      const messages = Array.from({ length: 150 }, (_, i) => ({
        pushToken: `ExponentPushToken[user-${i}]`,
        title: `Alert ${i}`,
        body: `Body ${i}`,
      }));

      const results = await sendBulkExpoPushNotifications(messages);

      // 100 + 50 = 150 results
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(150);
      expect(results.every(r => r.status === 'ok')).toBe(true);

      // First batch should have 100 items
      const firstBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(firstBody).toHaveLength(100);

      // Second batch should have 50 items
      const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(secondBody).toHaveLength(50);
    });

    it('should handle mixed success and error results', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: [
            { status: 'ok', id: 'ticket-ok-1' },
            { status: 'error', message: 'InvalidPushToken', details: { error: 'bad token' } },
            { status: 'ok', id: 'ticket-ok-2' },
          ],
        }),
      });

      const results = await sendBulkExpoPushNotifications([
        { pushToken: 'ExponentPushToken[good-1]', title: 'A', body: 'B' },
        { pushToken: 'ExponentPushToken[bad-1]', title: 'A', body: 'B' },
        { pushToken: 'ExponentPushToken[good-2]', title: 'A', body: 'B' },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('ok');
      expect(results[1].status).toBe('error');
      expect(results[1].message).toBe('InvalidPushToken');
      expect(results[2].status).toBe('ok');
    });

    it('should handle network error in batch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const results = await sendBulkExpoPushNotifications([
        { pushToken: 'ExponentPushToken[user-1]', title: 'A', body: 'B' },
        { pushToken: 'ExponentPushToken[user-2]', title: 'A', body: 'B' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('error');
      expect(results[0].message).toBe('Timeout');
      expect(results[1].status).toBe('error');
      expect(results[1].message).toBe('Timeout');
    });

    it('should handle empty message array', async () => {
      const results = await sendBulkExpoPushNotifications([]);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
