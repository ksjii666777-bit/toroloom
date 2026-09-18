/**
 * ============================================================================
 * Toroloom — Emergency Exit Service Tests
 * ============================================================================
 *
 * Tests the one-tap panic button that flattens all open positions:
 *   - Empty report when already flat
 *   - fetchFailed flag when positions cannot be fetched
 *   - Market SELL orders for longs, BUY orders for shorts
 *   - Per-order failure isolation (one bad symbol never aborts the rest)
 *   - Rejected orders (success: false / no orderId) treated as failures
 *   - Zero-quantity positions skipped and not counted as attempted
 *   - Idempotency key present on every order
 *   - summarizeEmergencyExit human-readable variants
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/api/snaptrade', () => ({
  snapTradeApi: {
    getPositions: vi.fn(),
    placeOrder: vi.fn(),
  },
}));

import { executeEmergencyExit, summarizeEmergencyExit } from '../services/emergencyExitService';
import { snapTradeApi } from '../services/api/snaptrade';
import type { SnapTradePosition } from '../services/api/snaptrade';

const mockGetPositions = vi.mocked(snapTradeApi.getPositions);
const mockPlaceOrder = vi.mocked(snapTradeApi.placeOrder);

function makePosition(overrides: Partial<SnapTradePosition> = {}): SnapTradePosition {
  return {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    quantity: 10,
    price: 2500,
    avgCost: 2400,
    pnl: 1000,
    pnlPercent: 4.17,
    ...overrides,
  };
}

// ==================== executeEmergencyExit ====================

describe('executeEmergencyExit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty report and places no orders when already flat', async () => {
    mockGetPositions.mockResolvedValue({ success: true, data: [], count: 0 });

    const report = await executeEmergencyExit();

    expect(report).toEqual({
      attempted: 0,
      succeeded: 0,
      failed: [],
      results: [],
      fetchFailed: false,
    });
    expect(mockPlaceOrder).not.toHaveBeenCalled();
  });

  it('sets fetchFailed and places no orders when positions cannot be fetched', async () => {
    mockGetPositions.mockRejectedValue(new Error('Network down'));

    const report = await executeEmergencyExit();

    expect(report.fetchFailed).toBe(true);
    expect(report.attempted).toBe(0);
    expect(report.succeeded).toBe(0);
    expect(mockPlaceOrder).not.toHaveBeenCalled();
  });

  it('exits long positions with market SELL orders', async () => {
    mockGetPositions.mockResolvedValue({
      success: true,
      data: [makePosition({ symbol: 'TCS', quantity: 5, price: 4000 })],
      count: 1,
    });
    mockPlaceOrder.mockResolvedValue({ success: true, orderId: 'ord_1', status: 'FILLED' });

    const report = await executeEmergencyExit();

    expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'TCS',
      action: 'SELL',
      orderType: 'Market',
      quantity: 5,
      estimatedPrice: 4000,
    }));
    expect(report.attempted).toBe(1);
    expect(report.succeeded).toBe(1);
    expect(report.failed).toHaveLength(0);
    expect(report.results[0]).toMatchObject({ symbol: 'TCS', success: true, orderId: 'ord_1' });
  });

  it('closes short positions (negative quantity) with BUY orders', async () => {
    mockGetPositions.mockResolvedValue({
      success: true,
      data: [makePosition({ symbol: 'INFY', quantity: -20 })],
      count: 1,
    });
    mockPlaceOrder.mockResolvedValue({ success: true, orderId: 'ord_2', status: 'FILLED' });

    await executeEmergencyExit();

    expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'INFY',
      action: 'BUY',
      quantity: 20,
    }));
  });

  it('continues to the next position when one order throws (failure isolation)', async () => {
    mockGetPositions.mockResolvedValue({
      success: true,
      data: [makePosition({ symbol: 'AAA' }), makePosition({ symbol: 'BBB' }), makePosition({ symbol: 'CCC' })],
      count: 3,
    });
    mockPlaceOrder
      .mockResolvedValueOnce({ success: true, orderId: 'o1', status: 'FILLED' })
      .mockRejectedValueOnce(new Error('Order rejected by broker'))
      .mockResolvedValueOnce({ success: true, orderId: 'o3', status: 'FILLED' });

    const report = await executeEmergencyExit();

    expect(report.attempted).toBe(3);
    expect(report.succeeded).toBe(2);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]).toMatchObject({ symbol: 'BBB', success: false, error: 'Order rejected by broker' });
    // Every position got a result entry, in order
    expect(report.results.map(r => r.symbol)).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('treats broker-rejected orders (success false, no orderId) as failures', async () => {
    mockGetPositions.mockResolvedValue({
      success: true,
      data: [makePosition({ symbol: 'SBIN' })],
      count: 1,
    });
    mockPlaceOrder.mockResolvedValue({ success: false, orderId: null, status: 'REJECTED', message: 'Insufficient margin' });

    const report = await executeEmergencyExit();

    expect(report.succeeded).toBe(0);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]).toMatchObject({ symbol: 'SBIN', error: 'Insufficient margin' });
  });

  it('skips zero-quantity positions without counting them as attempted', async () => {
    mockGetPositions.mockResolvedValue({
      success: true,
      data: [makePosition({ symbol: 'DUST', quantity: 0 }), makePosition({ symbol: 'LIVE', quantity: 5 })],
      count: 2,
    });
    mockPlaceOrder.mockResolvedValue({ success: true, orderId: 'o', status: 'FILLED' });

    const report = await executeEmergencyExit();

    expect(report.attempted).toBe(1);
    expect(report.results.map(r => r.symbol)).toEqual(['LIVE']);
  });

  it('sends an idempotency key per position to prevent double-execution', async () => {
    mockGetPositions.mockResolvedValue({
      success: true,
      data: [makePosition({ symbol: 'HDFCBANK' })],
      count: 1,
    });
    mockPlaceOrder.mockResolvedValue({ success: true, orderId: 'x', status: 'FILLED' });

    await executeEmergencyExit();

    const orderArg = mockPlaceOrder.mock.calls[0][0];
    expect(orderArg.idempotencyKey).toMatch(/^emergency-exit-HDFCBANK-\d+$/);
  });
});

// ==================== summarizeEmergencyExit ====================

describe('summarizeEmergencyExit', () => {
  const emptyReport = { attempted: 0, succeeded: 0, failed: [], results: [], fetchFailed: false };

  it('explains broker unavailability when the fetch failed', () => {
    const summary = summarizeEmergencyExit({ ...emptyReport, fetchFailed: true });
    expect(summary).toContain('Could not reach your broker');
  });

  it('reports already flat when there was nothing to exit', () => {
    const summary = summarizeEmergencyExit(emptyReport);
    expect(summary).toContain('already flat');
  });

  it('reports full success with singular position', () => {
    const summary = summarizeEmergencyExit({ ...emptyReport, attempted: 1, succeeded: 1 });
    expect(summary).toBe('All 1 position exited successfully.');
  });

  it('reports full success with plural positions', () => {
    const summary = summarizeEmergencyExit({ ...emptyReport, attempted: 3, succeeded: 3 });
    expect(summary).toContain('All 3 positions exited successfully');
  });

  it('lists failed symbols on a partial exit', () => {
    const summary = summarizeEmergencyExit({
      ...emptyReport,
      attempted: 2,
      succeeded: 1,
      failed: [{ symbol: 'TATASTEEL', quantity: 10, success: false, orderId: null, error: 'x' }],
    });
    expect(summary).toContain('1 of 2');
    expect(summary).toContain('TATASTEEL');
    expect(summary).toContain('Retry Emergency Exit');
  });
});
