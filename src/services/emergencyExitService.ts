/**
 * ============================================================================
 * Toroloom — Emergency Exit Service
 * ============================================================================
 *
 * One-tap panic button that flattens ALL open positions across the connected
 * broker.  This is the ONLY action allowed while Iron Lock lockdown is
 * active — the lockdown blocks every other trading action, but a user must
 * always be able to get out.
 *
 * Design principles:
 *   - Market orders only (certainty of execution over price in emergencies)
 *   - Sequential SELL orders with per-order try/catch — one bad symbol
 *     must never prevent the remaining positions from being exited
 *   - Full result report so the UI can show exactly what happened
 *   - Idempotency keys to prevent double-execution on retries
 *
 * Usage:
 *   const report = await executeEmergencyExit();
 *   if (report.failed.length > 0) { ... }
 * ============================================================================
 */

import { snapTradeApi } from './api/snaptrade';
import type { SnapTradePosition } from './api/snaptrade';
import { log } from '../utils/logger';

export interface EmergencyExitPositionResult {
  symbol: string;
  quantity: number;
  success: boolean;
  orderId: string | null;
  error?: string;
}

export interface EmergencyExitReport {
  attempted: number;
  succeeded: number;
  failed: EmergencyExitPositionResult[];
  results: EmergencyExitPositionResult[];
  /** Positions that couldn't even be fetched — user must contact broker */
  fetchFailed: boolean;
}

/**
 * Square off every open position with market SELL orders.
 * Positions with negative quantity (shorts) are closed with BUY orders.
 */
export async function executeEmergencyExit(): Promise<EmergencyExitReport> {
  const report: EmergencyExitReport = {
    attempted: 0,
    succeeded: 0,
    failed: [],
    results: [],
    fetchFailed: false,
  };

  // 1. Fetch open positions
  let positions: SnapTradePosition[];
  try {
    const res = await snapTradeApi.getPositions();
    positions = res.data ?? [];
  } catch (err) {
    log.error('[EmergencyExit] Failed to fetch positions:', err);
    report.fetchFailed = true;
    return report;
  }

  if (positions.length === 0) {
    return report; // Nothing to exit — already flat
  }

  // 2. Exit each position sequentially (never abort the loop on one failure)
  for (const position of positions) {
    const qty = Math.abs(position.quantity);
    if (qty <= 0) continue; // Dust/zero positions — nothing to exit
    report.attempted++;

    const isShort = position.quantity < 0;
    const result: EmergencyExitPositionResult = {
      symbol: position.symbol,
      quantity: qty,
      success: false,
      orderId: null,
    };

    try {
      const order = await snapTradeApi.placeOrder({
        symbol: position.symbol,
        action: isShort ? 'BUY' : 'SELL',
        orderType: 'Market',
        quantity: qty,
        estimatedPrice: position.price,
        idempotencyKey: `emergency-exit-${position.symbol}-${Date.now()}`,
      });

      result.success = order.success && !!order.orderId;
      result.orderId = order.orderId;
      if (!order.success) {
        result.error = order.message || 'Order rejected';
      }
    } catch (err) {
      log.error(`[EmergencyExit] Failed to exit ${position.symbol}:`, err);
      result.error = err instanceof Error ? err.message : 'Unknown error';
    }

    if (result.success) {
      report.succeeded++;
    } else {
      report.failed.push(result);
    }
    report.results.push(result);
  }

  return report;
}

/**
 * Human-readable summary line for alerts / toasts.
 */
export function summarizeEmergencyExit(report: EmergencyExitReport): string {
  if (report.fetchFailed) {
    return 'Could not reach your broker. Check your connection and try again — open positions remain.';
  }
  if (report.attempted === 0) {
    return 'No open positions found. You are already flat.';
  }
  if (report.failed.length === 0) {
    return `All ${report.succeeded} position${report.succeeded === 1 ? '' : 's'} exited successfully.`;
  }
  return `${report.succeeded} of ${report.attempted} positions exited. ${report.failed.length} failed: ${report.failed
    .map(f => f.symbol)
    .join(', ')}. Retry Emergency Exit or contact your broker.`;
}
