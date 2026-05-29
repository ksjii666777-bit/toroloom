/**
 * ============================================================================
 * Toroloom WebSocket — Catch-All Error Handler Tests
 * ============================================================================
 *
 * Verifies the outer try/catch in the message handler correctly
 * differentiates between:
 *
 *   1. SyntaxError (JSON.parse failure) → "Invalid message format"
 *   2. Any other error                  → "Internal error: <message>"
 *
 * These tests connect to a real WebSocket server and send deliberately
 * problematic messages to trigger each code path.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/errorHandler.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from '../websocket/handler';
import { createBufferedClient } from './testUtils';

// ──── Server State ──────────────────────────────────────────────────────────
let server: http.Server;
let wss: WebSocketServer;
let port: number;

// ──── Test Suite ────────────────────────────────────────────────────────────

describe('WebSocket Catch-All Error Handler', () => {

  beforeAll(async () => {
    server = http.createServer();
    wss = setupWebSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    wss?.close();
    server?.close();
  });

  // ──────────────── 1. Malformed JSON (SyntaxError) ────────────────

  it('should respond with "Invalid message format" for malformed JSON', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // Send raw bytes that cannot be parsed as JSON
    client.ws.send('definitely-not-valid-json');

    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect(response.message).toBe('Invalid message format');

    client.close();
  });

  // ──────────────── 2. Null message (TypeError → Internal error) ────────────────

  it('should respond with "Internal error" for null (valid JSON, non-object)', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // `null` is valid JSON but accessing `null.type` throws TypeError
    client.ws.send('null');

    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect(response.message).toMatch(/^Internal error:/);
    expect(response.message).toContain("Cannot read properties of null");

    client.close();
  });

  // ──────────────── 3. Array message (valid JSON, no .type property) ───────────

  it('should respond with "Unknown message type" for a JSON array', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // `[1, 2, 3]` is valid JSON; `message.type` is `undefined`,
    // so it hits the `default` case — NOT the catch-all.
    client.ws.send('[1, 2, 3]');

    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    // The default case sends "Unknown message type: undefined"
    expect(response.message).toContain('Unknown message type');

    client.close();
  });

  // ──────────────── 4. Truncated JSON (SyntaxError) ───────────────────

  it('should respond with "Invalid message format" for truncated JSON', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // A partial JSON string that fails to parse
    client.ws.send('{"type": "auth", "token": "abc');

    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect(response.message).toBe('Invalid message format');

    client.close();
  });

  // ──────────────── 5. Empty string (SyntaxError) ──────────────────────

  it('should respond with "Invalid message format" for an empty string', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send('');

    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect(response.message).toBe('Invalid message format');

    client.close();
  });

  // ──────────────── 6. Server still functional after errors ────────────

  it('should still handle valid messages after error messages', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // Send multiple bad messages
    client.ws.send('garbage');
    const err1 = await client.nextMessage();
    expect(err1.type).toBe('error');

    client.ws.send('null');
    const err2 = await client.nextMessage();
    expect(err2.type).toBe('error');

    // Now send a valid message — the server should still respond correctly
    client.ws.send(JSON.stringify({ type: 'ping' }));
    const pong = await client.nextMessage();
    expect(pong.type).toBe('pong');

    client.close();
  });
});
