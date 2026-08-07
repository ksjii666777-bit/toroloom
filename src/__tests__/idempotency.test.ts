/**
 * ============================================================================
 * Toroloom — Frontend Idempotency Tests
 * ============================================================================
 *
 * Verifies:
 *   - newIdempotencyKey() produces uuid-v4-shaped unique keys
 *   - Offline BUY/SELL replays send the SAME idempotency key that was
 *     generated at enqueue time (so a replay can never double-execute)
 *
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ──── Mock AsyncStorage (in-memory) ─────────────────────────────────────────

const memStore = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => memStore.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { memStore.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { memStore.delete(key); }),
    clear: vi.fn(async () => { memStore.clear(); }),
  },
}));

// ──── Mock API client ───────────────────────────────────────────────────────

const { apiPostMock } = vi.hoisted(() => ({
  apiPostMock: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../services/api/client', () => ({
  api: {
    post: apiPostMock,
    get: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    isNetworkError: vi.fn(() => false),
  },
}));

// ──── Import AFTER mocks ────────────────────────────────────────────────────

import { newIdempotencyKey } from '../utils/idempotency';
import { offlineMutationQueue } from '../services/offlineMutationQueue';

// ============================================================================
// Tests
// ============================================================================

describe('newIdempotencyKey', () => {
  it('returns a uuid-v4-shaped key', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('returns unique keys on consecutive calls', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
  });
});

describe('offlineMutationQueue — idempotency on replay', () => {
  beforeEach(async () => {
    memStore.clear();
    apiPostMock.mockClear();
  });

  it('replays a queued BUY with the idempotency key generated at enqueue time', async () => {
    await offlineMutationQueue.enqueue('BUY_STOCK', {
      symbol: 'RELIANCE',
      quantity: 5,
      price: 100,
      productType: 'CNC',
      idempotencyKey: 'orig-buy-key-0001',
    });

    const results = await offlineMutationQueue.processAll();

    expect(results[0].success).toBe(true);
    expect(apiPostMock).toHaveBeenCalledWith(
      '/orders/execute',
      expect.objectContaining({ idempotencyKey: 'orig-buy-key-0001' }),
    );
  });

  it('falls back to the mutation id when no explicit key was stored', async () => {
    await offlineMutationQueue.enqueue('SELL_STOCK', {
      symbol: 'TCS',
      quantity: 3,
      price: 4000,
      avgBuyPrice: 3800,
    });

    const results = await offlineMutationQueue.processAll();

    expect(results[0].success).toBe(true);
    const [url, payload] = apiPostMock.mock.calls[0];
    expect(url).toBe('/orders/execute');
    expect(typeof payload.idempotencyKey).toBe('string');
    expect(payload.idempotencyKey.length).toBeGreaterThanOrEqual(8);
  });
});
