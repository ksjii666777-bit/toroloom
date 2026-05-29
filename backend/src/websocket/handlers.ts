/**
 * ============================================================================
 * Toroloom WebSocket — Message Handlers
 * ============================================================================
 *
 * Message routing logic extracted from the monolithic handler.ts.
 * Each message type (auth, subscribe, unsubscribe, ping) has a dedicated
 * handler function.  The `handleMessage()` function is the single entry
 * point called by the WebSocket message event.
 * ============================================================================
 */

import { WebSocket } from 'ws';
import { riskEngine, LockdownStatus } from '../services/riskEngine';
import { getBroker } from '../services/broker';
import { incrementTickCounter } from '../services/metrics';
import {
  clients,
  decodeToken,
  loadUserPositions,
  incrementConnectionCount,
  totalUnrealizedPnL,
  userPositions,
  userConnectionCount,
  checkRateLimit,
} from './state';

// ──────────────────── Lockdown Event Emission ───────────────────────────────

/**
 * Check if lockdown was JUST triggered by comparing the previous status
 * against the current state.  If newly triggered, push a `lockdown` event
 * to the client so the frontend can react in real time (e.g. disable
 * buy buttons, show a banner, freeze risk settings).
 *
 * Also emits a `pnl_update` event so the frontend riskStore can track
 * real-time P&L without polling /risk/state.
 */
function emitRiskEvents(
  ws: WebSocket,
  userId: string,
  previousStatus: LockdownStatus,
): void {
  const profile = riskEngine.getProfile(userId);

  // Always emit the latest P&L so the frontend can track it in real time
  ws.send(JSON.stringify({
    type: 'pnl_update',
    data: {
      realizedPnL: profile.today.realizedPnL,
      unrealizedPnL: profile.today.unrealizedPnL,
      totalPnL: profile.today.realizedPnL + profile.today.unrealizedPnL,
    },
  }));

  const currStatus = profile.lockdown.status;

  if (currStatus !== previousStatus) {
    if (currStatus !== LockdownStatus.NONE && previousStatus === LockdownStatus.NONE) {
      // ── Lockdown JUST triggered ───────────────────────────
      ws.send(JSON.stringify({
        type: 'lockdown',
        data: {
          status: currStatus,
          triggeredAt: profile.lockdown.triggeredAt,
          liftsAt: profile.lockdown.liftsAt,
          triggerLoss: profile.lockdown.triggerLoss,
          breachedLimit: profile.lockdown.breachedLimit,
        },
      }));

      console.log(
        `[WS] Lockdown TRIGGERED for user ${userId} — ` +
        `loss ₹${(profile.lockdown.triggerLoss ?? 0).toLocaleString()}, ` +
        `breached: ${profile.lockdown.breachedLimit}`,
      );
    } else if (currStatus === LockdownStatus.NONE && previousStatus !== LockdownStatus.NONE) {
      // ── Lockdown JUST lifted (P&L recovered above limit) ──
      ws.send(JSON.stringify({
        type: 'lockdown',
        data: {
          status: LockdownStatus.NONE,
          triggeredAt: null,
          liftsAt: null,
          triggerLoss: null,
          breachedLimit: null,
        },
      }));

      console.log(
        `[WS] Lockdown LIFTED for user ${userId} — P&L recovered above limit`,
      );
    }
  }
}

// ──────────────────── Individual Message Handlers ───────────────────────────

export async function handleAuth(ws: WebSocket, message: any): Promise<void> {
  const token = message.token as string;
  if (!token) {
    ws.send(JSON.stringify({ type: 'error', message: 'Token is required' }));
    return;
  }

  const payload = decodeToken(token);
  if (!payload) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid or expired token' }));
    return;
  }

  // Fetch and cache the user's positions on auth
  const positions = await loadUserPositions(payload.userId);

  // Snapshot lockdown status BEFORE seeding the risk engine,
  // so we can detect if position-based P&L triggers lockdown
  // immediately (e.g. if the user is already deep in loss).
  const prevStatus = riskEngine.getProfile(payload.userId).lockdown.status;

  // Seed the risk engine with the initial unrealized P&L
  riskEngine.updateUnrealizedPnL(payload.userId, totalUnrealizedPnL(positions));

  // Emit events if this initial P&L breaches the limit
  emitRiskEvents(ws, payload.userId, prevStatus);

  // Create/update client record
  const existing = clients.get(ws);
  if (existing) {
    existing.userId = payload.userId;
    existing.positions = positions;
    console.log(`[WS] User ${payload.userId} re-authenticated`);
  } else {
    clients.set(ws, {
      ws,
      userId: payload.userId,
      symbols: [],
      positions,
      closed: false,
      unsubscribe: () => {},
    });
    incrementConnectionCount(payload.userId);
    console.log(`[WS] User ${payload.userId} authenticated (connections: ${userConnectionCount.get(payload.userId)})`);
  }

  ws.send(JSON.stringify({
    type: 'authenticated',
    userId: payload.userId,
    positionsCount: positions.size,
  }));
}

export async function handleSubscribe(ws: WebSocket, message: any): Promise<void> {
  const client = clients.get(ws);
  if (!client?.userId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Authenticate first via { type: "auth", token: "..." }',
    }));
    return;
  }

  const symbols: string[] = message.symbols || [];

  // ── Guard stale callbacks immediately ────────────────────────────
  client.closed = true;
  client.unsubscribe();

  // ── Async setup wrapped in try/catch ─────────────────────────────
  try {
    const broker = await getBroker();
    await loadUserPositions(client.userId, broker);
    const unsubscribe = broker.subscribeTicks(symbols, (quote) => {
      if (client.closed || ws.readyState !== WebSocket.OPEN) return;

      ws.send(JSON.stringify({ type: 'tick', data: quote }));
      incrementTickCounter(client.userId);

      const positions = userPositions.get(client.userId);
      if (positions) {
        const pos = positions.get(quote.symbol);
        if (pos) {
          const newPnl = Math.round(
            (quote.lastPrice - pos.buyPrice) * pos.quantity * 100,
          ) / 100;
          pos.pnl = newPnl;
          pos.currentPrice = quote.lastPrice;

          const prevStatus = riskEngine.getProfile(client.userId).lockdown.status;
          riskEngine.updateUnrealizedPnL(client.userId, totalUnrealizedPnL(positions));
          emitRiskEvents(ws, client.userId, prevStatus);
        }
      }
    });

    client.symbols = symbols;
    client.unsubscribe = unsubscribe;
    client.closed = false;

    ws.send(JSON.stringify({
      type: 'subscribed',
      symbols,
      count: symbols.length,
    }));

    console.log(`[WS] User ${client.userId} subscribed to: ${symbols.join(', ')}`);
  } catch (err) {
    client.closed = false;
    console.error(`[WS] Failed to subscribe ${client.userId}:`, (err as Error).message);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to subscribe: ${(err as Error).message}`,
    }));
  }
}

export function handleUnsubscribe(ws: WebSocket): void {
  const client = clients.get(ws);
  if (client) {
    client.closed = true;
    client.unsubscribe();
    client.symbols = [];
    client.unsubscribe = () => {};
  }
  ws.send(JSON.stringify({ type: 'unsubscribed' }));
}

export function handlePing(ws: WebSocket): void {
  ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
}

// ──────────────────── Message Router ────────────────────────────────────────

/**
 * Parse, validate, and route an incoming WebSocket message.
 * This is the single entry point called by the `ws.on('message')` event.
 */
export async function handleMessage(ws: WebSocket, raw: Buffer): Promise<void> {
  try {
    // ── Rate limit check (before parsing heavy work) ───────────────
    if (!checkRateLimit(ws)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded. Please slow down.' }));
      return;
    }

    const message = JSON.parse(raw.toString());

    switch (message.type) {
      case 'auth':
        await handleAuth(ws, message);
        break;
      case 'subscribe':
        await handleSubscribe(ws, message);
        break;
      case 'unsubscribe':
        handleUnsubscribe(ws);
        break;
      case 'ping':
        handlePing(ws);
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${message.type}`,
        }));
    }
  } catch (err) {
    const errorMsg = err instanceof SyntaxError
      ? 'Invalid message format'
      : `Internal error: ${(err as Error).message}`;
    console.error('[WS] Unhandled error in message handler:', (err as Error).message);
    ws.send(JSON.stringify({ type: 'error', message: errorMsg }));
  }
}
