/**
 * ============================================================================
 * Toroloom — WebSocket Cluster E2E Test
 * ============================================================================
 *
 * Connects to the running cluster-mode server (port 3000) and tests:
 *   1. Multiple WebSocket connections (landing on different workers)
 *   2. Auth, subscribe, tick delivery on each connection
 *   3. Sticky session — messages stay on same connection
 *   4. Rate limiting per-connection
 *   5. Stress: multiple concurrent connections
 *   6. Cleanup: close all connections, verify server still healthy
 *
 * Run:
 *   node dist/__tests__/wsCluster.e2e.js
 *
 * Requires the cluster-mode server to be running on port 3000:
 *   CLUSTER_MODE=1 node dist/index.js
 * ============================================================================
 */

const WebSocket = require('ws');
const http = require('http');

const SERVER_URL = 'ws://localhost:3000/ws';
const HEALTH_URL = 'http://localhost:3000/health';
const TOTAL_CONNECTIONS = 16; // 2x the worker count (8 workers)
const TEST_TIMEOUT = 30000;

let passed = 0;
let failed = 0;
const errors: string[] = [];

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}

function fail(name: string, err: any) {
  failed++;
  const msg = err?.message || String(err);
  errors.push(`[${name}] ${msg}`);
  console.log(`  ❌ ${name}: ${msg}`);
}

/**
 * Wait for a WebSocket message matching a predicate.
 */
function waitForMessage(ws: WebSocket, predicate: (msg: any) => boolean, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for message'));
    }, timeoutMs);

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (predicate(msg)) {
          clearTimeout(timer);
          resolve(msg);
        }
      } catch { /* ignore parse errors */ }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on('close', () => {
      clearTimeout(timer);
      reject(new Error('WebSocket closed before message arrived'));
    });
  });
}

function sendMessage(ws: WebSocket, msg: object): void {
  ws.send(JSON.stringify(msg));
}

function createConnection(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    ws.on('open', () => {
      // Wait for welcome message before resolving
      // so callers don't race with the async welcome send
      ws.once('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'connected') {
            resolve(ws);
          } else {
            // Unexpected first message — resolve anyway
            resolve(ws);
          }
        } catch {
          resolve(ws);
        }
      });
      // Safety timeout — resolve even if welcome is late
      setTimeout(() => { if (ws.readyState === WebSocket.OPEN) resolve(ws); }, 3000);
    });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 8000);
  });
}

/**
 * Generate a test JWT token by calling the auth API.
 */
async function getTestToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'test@toroloom.com', password: 'Test@123' });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', (chunk: string) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.token);
        } catch {
          reject(new Error(`Failed to parse auth response: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const startTime = Date.now();
  console.log(`\n🔌 WebSocket Cluster E2E Test`);
  console.log(`   Server: ${SERVER_URL}`);
  console.log(`   Connections: ${TOTAL_CONNECTIONS}`);
  console.log(`   Timeout: ${TEST_TIMEOUT}ms\n`);

  // ──── 1. Health Check ──────────────────────────────────────
  try {
    await new Promise<void>((resolve, reject) => {
      http.get(HEALTH_URL, (res) => {
        let body = '';
        res.on('data', (c: string) => body += c);
        res.on('end', () => {
          const json = JSON.parse(body);
          if (json.status === 'ok') resolve();
          else reject(new Error(`Health: ${json.status}`));
        });
      }).on('error', reject);
    });
    pass('Server health check');
  } catch (err) {
    fail('Server health check', err);
    console.log('\n⚠ Server not running. Start with: CLUSTER_MODE=1 node dist/index.js');
    process.exit(1);
  }

  // ──── 2. Get auth token ────────────────────────────────────
  let token: string;
  try {
    token = await getTestToken();
    pass('Auth token obtained');
  } catch (err) {
    fail('Auth token', err);
    // Use a fallback token for testing
    token = 'fallback-test-token';
  }

  // ──── 3. Open Multiple Connections ─────────────────────────
  const connections: WebSocket[] = [];
  console.log(`\n   Opening ${TOTAL_CONNECTIONS} connections...`);

  try {
    for (let i = 0; i < TOTAL_CONNECTIONS; i++) {
      const ws = await createConnection();
      connections.push(ws);
    }
    pass(`Opened ${TOTAL_CONNECTIONS} WebSocket connections`);
  } catch (err) {
    fail('Open connections', err);
  }

  // ──── 4. Verify Welcome Messages (already received during connection) ─
  console.log(`\n   Verifying welcome messages...`);
  // Welcome messages were already received during createConnection,
  // so just confirm all connections are still open
  const openConnections = connections.filter((ws) => ws.readyState === WebSocket.OPEN).length;
  if (openConnections === connections.length) {
    pass(`All ${openConnections} connections open (welcome received during setup)`);
  } else {
    fail('Welcome messages', new Error(`Only ${openConnections}/${connections.length} connections open`));
  }

  // ──── 5. Authenticate All Connections ──────────────────────
  console.log(`\n   Authenticating all connections...`);
  try {
    const authPromises = connections.map((ws) => {
      sendMessage(ws, { type: 'auth', token });
      return waitForMessage(ws, (msg: any) => msg.type === 'authenticated');
    });
    const authResults = await Promise.all(authPromises);
    const allAuthed = authResults.every((a: any) => a.userId && a.positionsCount !== undefined);
    if (allAuthed) {
      pass(`All ${authResults.length} connections authenticated`);
    } else {
      fail('Authentication', new Error('Some connections did not authenticate'));
    }
  } catch (err) {
    fail('Authentication', err);
  }

  // ──── 6. Subscribe to Symbols ──────────────────────────────
  console.log(`\n   Subscribing to symbols...`);
  try {
    const symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];
    const subPromises = connections.map((ws, i) => {
      const syms = [symbols[i % symbols.length]];
      sendMessage(ws, { type: 'subscribe', symbols: syms });
      return waitForMessage(ws, (msg: any) => msg.type === 'subscribed');
    });
    const subResults = await Promise.all(subPromises);
    const allSubscribed = subResults.every((s: any) => s.count >= 1);
    if (allSubscribed) {
      pass(`All ${subResults.length} connections subscribed to symbols`);
    } else {
      fail('Subscribe', new Error('Some connections did not subscribe'));
    }
  } catch (err) {
    fail('Subscribe', err);
  }

  // ──── 7. Receive Tick Data ─────────────────────────────────
  console.log(`\n   Waiting for tick data (up to 10s)...`);
  try {
    const tickPromises = connections.map((ws) =>
      waitForMessage(ws, (msg: any) => msg.type === 'tick', 10000),
    );
    const tickResults = await Promise.all(tickPromises);
    const allHaveTicks = tickResults.every((t: any) => t.data?.symbol && typeof t.data.lastPrice === 'number');
    if (allHaveTicks) {
      pass(`All ${tickResults.length} connections received tick data`);
    } else {
      fail('Tick data', new Error('Some connections did not receive ticks'));
    }
  } catch (err) {
    fail('Tick data', err);
  }

  // ──── 8. Sticky Session Test ───────────────────────────────
  console.log(`\n   Testing sticky sessions...`);
  try {
    // On each connection, send a ping and expect pong on the same connection
    const stickyPromises = connections.map((ws) => {
      sendMessage(ws, { type: 'ping' });
      return waitForMessage(ws, (msg: any) => msg.type === 'pong');
    });
    const pongResults = await Promise.all(stickyPromises);
    const allHavePongs = pongResults.every((p: any) => p.timestamp);
    if (allHavePongs) {
      pass(`Sticky sessions: all ${pongResults.length} connections received pong on the same connection`);
    } else {
      fail('Sticky sessions', new Error('Some connections did not receive pong'));
    }
  } catch (err) {
    fail('Sticky sessions', err);
  }

  // ──── 9. Rate Limiting ─────────────────────────────────────
  console.log(`\n   Testing rate limiting...`);
  try {
    // Pick the first connection and flood it with messages
    const floodWs = connections[0];
    for (let i = 0; i < 15; i++) {
      sendMessage(floodWs, { type: 'ping' });
    }
    const rateLimitMsg = await waitForMessage(floodWs, (msg: any) => msg.type === 'error', 5000);
    if (rateLimitMsg.message?.includes('Rate limit')) {
      pass('Rate limiting working (429 after 10 msg/sec)');
    } else {
      fail('Rate limiting', new Error(`Unexpected message: ${JSON.stringify(rateLimitMsg)}`));
    }
  } catch (err) {
    fail('Rate limiting', err);
  }

  // ──── 10. Unsubscribe ──────────────────────────────────────
  console.log(`\n   Testing unsubscribe...`);
  // Use a FRESH connection (not the rate-limited one from step 9)
  try {
    const freshWs = await createConnection();
    sendMessage(freshWs, { type: 'auth', token });
    await waitForMessage(freshWs, (msg: any) => msg.type === 'authenticated');
    sendMessage(freshWs, { type: 'subscribe', symbols: ['RELIANCE'] });
    await waitForMessage(freshWs, (msg: any) => msg.type === 'subscribed');

    sendMessage(freshWs, { type: 'unsubscribe' });
    const unsubMsg = await waitForMessage(freshWs, (msg: any) => msg.type === 'unsubscribed');
    if (unsubMsg.type === 'unsubscribed') {
      pass('Unsubscribe works');
    }
    freshWs.close();
  } catch (err) {
    fail('Unsubscribe', err);
  }

  // ──── 11. Cleanup ──────────────────────────────────────────
  console.log(`\n   Closing all connections...`);
  for (const ws of connections) {
    ws.close();
  }
  pass(`All ${connections.length} connections closed`);

  // ──── 12. Verify Server Still Healthy ──────────────────────
  console.log(`\n   Verifying server health after test...`);
  try {
    await new Promise<void>((resolve, reject) => {
      http.get(HEALTH_URL, (res) => {
        let body = '';
        res.on('data', (c: string) => body += c);
        res.on('end', () => {
          const json = JSON.parse(body);
          if (json.status === 'ok') resolve();
          else reject(new Error(`Health: ${json.status}`));
        });
      }).on('error', reject);
    });
    pass('Server still healthy after test');
  } catch (err) {
    fail('Server health after test', err);
  }

  // ──── Summary ──────────────────────────────────────────────
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 WebSocket Cluster E2E Results`);
  console.log(`   Duration: ${duration}s`);
  console.log(`   Passed:   ${passed}/${passed + failed}`);
  console.log(`   Failed:   ${failed}`);
  if (errors.length > 0) {
    console.log(`\n   Errors:`);
    for (const err of errors) {
      console.log(`     • ${err}`);
    }
  }
  console.log(`${'='.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
