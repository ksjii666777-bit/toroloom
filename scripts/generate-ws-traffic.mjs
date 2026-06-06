/**
 * ============================================================================
 * Toroloom — Mock WebSocket Traffic Generator
 * ============================================================================
 *
 * Creates multiple simulated WebSocket client connections to populate the
 * Grafana dashboards with live data (connection counts, ticks, subscriptions).
 *
 * Usage:
 *   node scripts/generate-ws-traffic.mjs
 *
 * Press Ctrl+C to stop and disconnect all clients.
 * ============================================================================
 */

import WebSocket from 'ws';
import http from 'http';

// ──── Configuration ──────────────────────────────────────────────────────────
const BACKEND_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';
const NUM_USERS = 5;               // Simulated users
const CONNECTIONS_PER_USER = 2;    // Connections per user (simulates multi-tab)
const SUBSCRIPTIONS_PER_USER = 3;  // Symbols per user
const PING_INTERVAL_MS = 10_000;   // Send ping every 10s to keep alive

// Stock symbols to subscribe to
const SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'KOTAKBANK'];

// ──── State ───────────────────────────────────────────────────────────────────
const clients = [];  // Array of { ws, userId, email }
let keepRunning = true;

// ──── Helpers ─────────────────────────────────────────────────────────────────

function login(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const req = http.request(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.token) resolve(parsed);
          else reject(new Error(`Login failed: ${body}`));
        } catch (e) {
          reject(new Error(`Invalid response: ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function signup(name, email, phone) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ name, email, phone });
    const req = http.request(`${BACKEND_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.token) resolve(parsed);
          else reject(new Error(`Signup failed: ${body}`));
        } catch (e) {
          reject(new Error(`Invalid response: ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function createWSConnection(token, userId, email, connIndex) {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    const client = { ws, userId, email, connIndex, authenticated: false, subscribed: false };

    ws.on('open', () => {
      console.log(`  [${email}] Connection ${connIndex + 1} opened → sending auth...`);
      ws.send(JSON.stringify({ type: 'auth', token }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'authenticated' && !client.authenticated) {
          client.authenticated = true;
          console.log(`  [${email}] Connection ${connIndex + 1} authenticated ✓ (userId: ${msg.userId})`);

          // Pick symbols for this user
          const userSymbols = SYMBOLS.slice(0, SUBSCRIPTIONS_PER_USER);
          ws.send(JSON.stringify({ type: 'subscribe', symbols: userSymbols }));
        } else if (msg.type === 'subscribed' && !client.subscribed) {
          client.subscribed = true;
          console.log(`  [${email}] Connection ${connIndex + 1} subscribed to ${msg.count} symbols ✓`);
          resolve(client);
        } else if (msg.type === 'tick') {
          // Ticks are flowing — silently count them
          if (!client.tickCount) client.tickCount = 0;
          client.tickCount++;
        } else if (msg.type === 'error') {
          console.log(`  [${email}] Connection ${connIndex + 1} error: ${msg.message}`);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    ws.on('close', () => {
      console.log(`  [${email}] Connection ${connIndex + 1} closed`);
    });

    ws.on('error', (err) => {
      console.log(`  [${email}] Connection ${connIndex + 1} error: ${err.message}`);
    });

    // Set a timeout in case auth/subscribe fails
    setTimeout(() => resolve(client), 5000);
  });
}

// ──── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Toroloom — Mock WebSocket Traffic Generator\n');
  console.log(`Creating ${NUM_USERS} users × ${CONNECTIONS_PER_USER} connections = ${NUM_USERS * CONNECTIONS_PER_USER} total WS connections\n`);

  // Generate unique users via signup
  const users = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const email = `traffic_user_${i}_${Date.now()}@test.com`;
    try {
      const result = await signup(`Traffic User ${i}`, email, `999999${String(i).padStart(2, '0')}`);
      users.push({ email, token: result.token, user: result.user });
      console.log(`✓ Created user ${i + 1}: ${email} (userId: ${result.user.id})`);
    } catch (err) {
      // Fall back to login with default mock user
      console.log(`  Signup failed for ${email}: ${err.message}`);
      console.log(`  Falling back to login with mock user...`);
      try {
        const result = await login(`user${i}@test.com`, 'password123');
        users.push({ email: `user${i}@test.com`, token: result.token, user: result.user });
        console.log(`✓ Logged in as: user${i}@test.com (userId: ${result.user.id})`);
      } catch (e) {
        console.error(`  ✗ Failed to authenticate: ${e.message}`);
      }
    }
  }

  if (users.length === 0) {
    console.error('✗ No users could be authenticated. Exiting.');
    process.exit(1);
  }

  console.log(`\n🔌 Opening WebSocket connections...\n`);

  // Create WS connections for each user
  for (const user of users) {
    for (let c = 0; c < CONNECTIONS_PER_USER; c++) {
      const client = await createWSConnection(user.token, user.user.id, user.email, c);
      clients.push(client);
      // Small delay between connections to avoid overwhelming the server
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const connected = clients.filter(c => c.authenticated).length;
  console.log(`\n✅ ${connected}/${clients.length} connections authenticated and subscribed\n`);

  // Start periodic ping to keep connections alive
  const pingInterval = setInterval(() => {
    for (const client of clients) {
      if (client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }
  }, PING_INTERVAL_MS);

  // Print status every 15 seconds
  const statusInterval = setInterval(() => {
    const authd = clients.filter(c => c.authenticated).length;
    const totalTicks = clients.reduce((sum, c) => sum + (c.tickCount || 0), 0);
    console.log(`📊 Status: ${authd} active connections | ${totalTicks} ticks received`);

    // Reset tick counters for next interval
    for (const client of clients) {
      client.tickCount = 0;
    }
  }, 15_000);

  console.log('ℹ️  Press Ctrl+C to disconnect all clients and exit\n');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    keepRunning = false;
    clearInterval(pingInterval);
    clearInterval(statusInterval);

    let closed = 0;
    for (const client of clients) {
      if (client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
        closed++;
      }
    }
    console.log(`🔌 Disconnected ${closed} WebSocket connections`);
    console.log('👋 Done!');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
