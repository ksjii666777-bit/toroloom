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
    console.log('[WS] Client connected');

    // ── Message handling ────────────────────────────────────
    ws.on('message', async (raw: Buffer) => {
      await handleMessage(ws, raw);
    });

    // ── Clean up on disconnect ──────────────────────────────
    ws.on('close', () => {
      const client = clients.get(ws);
      if (client) {
        client.closed = true;
        client.unsubscribe();
        decrementConnectionCount(client.userId);
        console.log(`[WS] User ${client.userId} disconnected (remaining connections: ${userConnectionCount.get(client.userId) ?? 0})`);
        rateLimitMap.delete(ws);
        clients.delete(ws);
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      const client = clients.get(ws);
      if (client) {
        client.closed = true;
        client.unsubscribe();
        decrementConnectionCount(client.userId);
        rateLimitMap.delete(ws);
        clients.delete(ws);
      }
    });

    // ── Welcome message ─────────────────────────────────────
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to Toroloom real-time feed. Send { type: "auth", token: "..." } to authenticate.',
      timestamp: new Date().toISOString(),
    }));
  });

  return wss;
}
