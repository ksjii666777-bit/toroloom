/**
 * ============================================================================
 * Toroloom WebSocket — Server Setup
 * ============================================================================
 *
 * Creates and configures the WebSocketServer, wires up the connection
 * lifecycle (message handling, cleanup on close/error), and sends the
 * welcome message.
 *
 * This module is the public API — everything else in `./state` and
 * `./handlers` is internal.
 * ============================================================================
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import {
  clients,
  decrementConnectionCount,
  rateLimitMap,
  userConnectionCount,
} from './state';
import { handleMessage } from './handlers';

// ──────────────────── Constants ────────────────────────────────────────────

/** Maximum concurrent WebSocket connections allowed server-wide. */
const MAX_GLOBAL_CONNECTIONS = 1_000;

/** Interval (ms) between WebSocket pings to detect stale connections.
 *  Stale connections are terminated after 2 missed pings (~60s). */
const KEEPALIVE_INTERVAL_MS = 30_000;

/**
 * WeakMap marking alive connections.  Uses a WeakMap so it doesn't prevent
 * GC of closed sockets, and entries are automatically cleaned up.
 */
const aliveClients = new WeakMap<WebSocket, boolean>();

// ──────────────────── WebSocket Setup ───────────────────────────────────────

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    // ── Per-message compression ──────────────────────────────
    // Enables permessage-deflate (RFC 7692) to reduce bandwidth
    // for repeated tick data (symbol names, JSON structure).
    // Even at 150 bytes per tick, deflate achieves 40-60%
    // compression on JSON — saving ~80 bytes × thousands of
    // ticks per connection per day.
    perMessageDeflate: {
      serverNoContextTakeover: true,  // Reset dictionary per-msg
      clientNoContextTakeover: true,   // (prevents memory growth)
      threshold: 128,                 // Compress ticks (~150 B) +
      zlibDeflateOptions: { level: 6 },
    },
  });

  wss.on('connection', (ws: WebSocket) => {
    // ── Global connection cap ────────────────────────────────
    // wss.clients already includes this new connection.
    if (wss.clients.size > MAX_GLOBAL_CONNECTIONS) {
      console.warn(`[WS] Connection rejected — server at capacity (${wss.clients.size}/${MAX_GLOBAL_CONNECTIONS})`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Server at maximum capacity. Please try again later.',
      }));
      ws.close(1013, 'Server at capacity'); // 1013 = Try Again Later
      return;
    }

    console.log('[WS] Client connected');

    // ── Message handling ────────────────────────────────────
    ws.on('message', async (raw: Buffer) => {
      await handleMessage(ws, raw);
    });

    /**
     * Clean up client state exactly once per WebSocket connection.
     * Both `error` and `close` events fire on network failure — this
     * guard ensures decrementConnectionCount runs only once.
     */
    function cleanupClient(): void {
      const client = clients.get(ws);
      if (!client) return; // already cleaned up (error + close both fire)

      client.closed = true;
      client.unsubscribe();
      decrementConnectionCount(client.userId);
      console.log(`[WS] User ${client.userId} disconnected (remaining connections: ${userConnectionCount.get(client.userId) ?? 0})`);
      rateLimitMap.delete(ws);
      clients.delete(ws);
    }

    // ── Clean up on disconnect ──────────────────────────────
    ws.on('close', cleanupClient);

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      cleanupClient();
    });

    // ── Mark as alive for keepalive tracking ────────────────
    aliveClients.set(ws, true);
    ws.on('pong', () => { aliveClients.set(ws, true); });

    // ── Welcome message ─────────────────────────────────────
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to Toroloom real-time feed. Send { type: "auth", token: "..." } to authenticate.',
      timestamp: new Date().toISOString(),
    }));
  });

  // ── Ping/pong keepalive interval ────────────────────────────
  // Detects stale / half-open TCP connections (e.g. phone sleep,
  // WiFi drop without RST). Terminates unresponsive clients after
  // PONG_TIMEOUT_MS to prevent connection leaks.
  const keepaliveTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;

      const alive = aliveClients.get(ws);
      if (alive === false) {
        // Previous ping was not answered — terminate
        console.log('[WS] Terminating stale connection (no pong)')
        ws.terminate();
        continue;
      }

      // Mark as possibly dead; pong handler will set back to true
      aliveClients.set(ws, false);
      ws.ping();
    }
  }, KEEPALIVE_INTERVAL_MS);

  // ── Clean up the keepalive timer when the server closes ──────
  wss.on('close', () => { clearInterval(keepaliveTimer); });

  return wss;
}
