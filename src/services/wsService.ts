/**
 * WebSocket Service Interface
 *
 * Shared contract that both the mock (in-process simulation) and real
 * (backend /ws endpoint) WebSocket clients implement.  The rest of the
 * app (stores, hooks) consumes whichever implementation is active via
 * the `getActiveWS()` resolver in wsRegistry.ts.
 *
 * Message protocol (backend ws://localhost:3000/ws):
 *
 *   Server ──► { type: "connected", … }
 *   Client ──► { type: "auth", token: "<JWT>" }
 *   Server ──► { type: "pnl_update", data: { realizedPnL, unrealizedPnL, totalPnL } }
 *   Server ──► { type: "authenticated", userId, positionsCount }
 *   Client ──► { type: "subscribe", symbols: ["RELIANCE", …] }
 *   Server ──► { type: "subscribed", symbols, count }
 *   Server ──► { type: "tick", data: { symbol, lastPrice, change, changePercent, timestamp } }
 *   Server ──► { type: "lockdown", data: { status, triggeredAt, … } }
 */

import type { StockHistoryPoint } from '../types';

// ── Callback Signatures ──────────────────────────────────────────────────────

export type PriceUpdateCallback = (data: {
  stockId: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}) => void;

export type CandleUpdateCallback = (data: {
  stockId: string;
  candle: StockHistoryPoint;
}) => void;

export type ConnectionCallback = (connected: boolean) => void;

export type PnLUpdateCallback = (data: {
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
}) => void;

export type LockdownCallback = (data: {
  status: 'none' | 'active' | 'cooldown';
  triggeredAt: string | null;
  liftsAt: string | null;
  triggerLoss: number | null;
  breachedLimit: 'daily_loss' | 'daily_loss_percent' | null;
}) => void;

export type CacheInvalidationCallback = (data: {
  /** The entities that changed on the server */
  entities: { entityType: string; entityId: string }[];
  /** Cache namespace hints for batch clearing */
  namespaces: string[];
  /** When the invalidation was triggered */
  timestamp: string;
}) => void;

// ── Interface ────────────────────────────────────────────────────────────────

export interface WebSocketService {
  connect(): Promise<void>;
  disconnect(): void;

  /** Subscribe to real-time price + candle updates for a symbol. */
  subscribe(
    stockId: string,
    onPrice: PriceUpdateCallback,
    onCandle: CandleUpdateCallback,
  ): void;

  /** Unsubscribe from a symbol (stops price/candle forwarding). */
  unsubscribe(stockId: string): void;

  /** Register a connection-state callback. */
  onConnectionChangeCallback(cb: ConnectionCallback): void;

  /** Register a P&L update callback (called on every tick). */
  onPnLUpdateCallback(cb: PnLUpdateCallback): void;

  /** Register a lockdown event callback (trigger / lift). */
  onLockdownCallback(cb: LockdownCallback): void;

  /** Register a cache invalidation callback (push-based invalidation). */
  onCacheInvalidationCallback(cb: CacheInvalidationCallback): void;

  /** Set the daily loss limit used for lockdown simulation. */
  setLossLimit(limit: number): void;

  /** Get the latest cached price for a symbol (or fallback). */
  getCurrentPrice(stockId: string): number;

  /** Get cached candle history for a symbol. */
  getCachedCandles(stockId: string): StockHistoryPoint[];

  /** Whether the service has completed the auth handshake. */
  getIsAuthenticated(): boolean;
}
