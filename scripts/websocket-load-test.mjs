/**
 * ============================================================================
 * Toroloom — WebSocket Load Test
 * ============================================================================
 *
 * Concurrent WebSocket connection stress test with:
 *   - Connection scaling (10→50→100→250→500 concurrent)
 *   - Message throughput (subscribe, ticks received)
 *   - Latency tracking (auth time, subscribe time, tick interval)
 *   - Summary table output
 *
 * Usage:
 *   JWT_TOKEN=<token> node scripts/websocket-load-test.mjs
 *
 * Environment:
 *   WS_URL       — WebSocket URL (default: ws://localhost:3457/ws)
 *   BACKEND_URL  — REST base (default: http://localhost:3457)
 *   JWT_TOKEN    — Auth token (uses mock login if not set)
 * ============================================================================
 */

import WebSocket from 'ws';
import http from 'http';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3457';
const WS_URL = process.env.WS_URL || 'ws://localhost:3457/ws';
const JWT_TOKEN = process.env.JWT_TOKEN || '';
const PHASE_DURATION = parseInt(process.env.PHASE_DURATION || '15', 10); // seconds per phase
const SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'KOTAKBANK', 'ITC', 'WIPRO'];

// ──── Helpers ────────────────────────────────────────────────────────────────

function getToken() {
  if (JWT_TOKEN) return Promise.resolve(JWT_TOKEN);
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'loadtest@test.com', password: 'password123' });
    const req = http.request(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { const p = JSON.parse(body); resolve(p.token); }
        catch { reject(new Error(`Login failed: ${body.substring(0,200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function connectWS(token) {
  return new Promise((resolve) => {
    const start = Date.now();
    const ws = new WebSocket(WS_URL);
    const state = { ws, authTime: 0, subTime: 0, tickCount: 0, connected: false, authenticated: false };
    const timeout = setTimeout(() => resolve(state), 8000);

    ws.on('open', () => {
      state.connected = true;
      ws.send(JSON.stringify({ type: 'auth', token }));
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'authenticated' && !state.authenticated) {
          state.authenticated = true;
          state.authTime = Date.now() - start;
          // Subscribe to symbols
          ws.send(JSON.stringify({ type: 'subscribe', symbols: SYMBOLS.slice(0, 5) }));
        } else if (msg.type === 'subscribed') {
          state.subTime = Date.now() - start;
          clearTimeout(timeout);
          resolve(state);
        } else if (msg.type === 'tick') {
          state.tickCount++;
        }
      } catch {}
    });
    ws.on('error', () => { clearTimeout(timeout); resolve(state); });
    ws.on('close', () => { state.connected = false; });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ──── Phases ─────────────────────────────────────────────────────────────────

const PHASES = [
  { label: '10 connections (baseline)',     count: 10 },
  { label: '50 connections (moderate)',     count: 50 },
  { label: '100 connections (heavy)',       count: 100 },
  { label: '250 connections (stress)',      count: 250 },
  { label: '500 connections (max stress)',  count: 500 },
];

// ──── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Toroloom — WebSocket Load Test\n');
  const token = await getToken();
  console.log(`Target: ${WS_URL}`);
  console.log(`Phase duration: ${PHASE_DURATION}s\n`);

  const results = [];

  for (const phase of PHASES) {
    console.log(`\n${'='.repeat(72)}`);
    console.log(`📈 ${phase.label}`);
    console.log(`${'='.repeat(72)}`);

    // Connect all
    const connPromises = Array.from({ length: phase.count }, () => connectWS(token));
    const clients = await Promise.all(connPromises);

    const authed = clients.filter(c => c.authenticated).length;
    console.log(`  Connected: ${clients.filter(c => c.connected).length}/${phase.count} | Authenticated: ${authed}/${phase.count}`);
    console.log(`  Auth time (avg): ${(clients.reduce((s, c) => s + c.authTime, 0) / Math.max(1, authed)).toFixed(0)}ms`);

    // Wait for data to flow
    await sleep(PHASE_DURATION * 1000);

    // Collect metrics
    const active = clients.filter(c => c.authenticated);
    const totalTicks = active.reduce((s, c) => s + c.tickCount, 0);
    const ticksPerSec = totalTicks / PHASE_DURATION;
    const avgTicksPerConn = totalTicks / Math.max(1, active.length);

    console.log(`  Ticks received: ${totalTicks.toLocaleString()} | ${ticksPerSec.toFixed(0)} ticks/s`);
    console.log(`  Avg ticks/conn: ${avgTicksPerConn.toFixed(0)}`);

    results.push({
      label: phase.label,
      connections: phase.count,
      connected: clients.filter(c => c.connected).length,
      authenticated: authed,
      totalTicks,
      ticksPerSec: Math.round(ticksPerSec),
      avgTicksPerConn: Math.round(avgTicksPerConn),
      avgAuthTimeMs: Math.round(clients.reduce((s, c) => s + c.authTime, 0) / Math.max(1, authed)),
    });

    // Cleanup connections
    console.log('  Disconnecting...');
    for (const c of clients) {
      if (c.ws && c.ws.readyState === WebSocket.OPEN) c.ws.close();
    }
    await sleep(1000);
  }

  // ── Summary Table ──
  console.log(`\n${'='.repeat(72)}`);
  console.log('🏁  WEBSOCKET LOAD TEST — SUMMARY');
  console.log('='.repeat(72));
  console.log('');
  console.log('  Phase                    Conns   Authd   Ticks/s   Tick/Conn   Auth(ms)');
  console.log('  ' + '-'.repeat(75));

  for (const r of results) {
    console.log(
      `  ${r.label.padEnd(25)} | ${String(r.connections).padStart(5)}` +
      ` | ${String(r.authenticated).padStart(5)}` +
      ` | ${String(r.ticksPerSec).padStart(6)}  ` +
      ` | ${String(r.avgTicksPerConn).padStart(7)}` +
      ` | ${String(r.avgAuthTimeMs).padStart(7)}`
    );
  }

  // Save report
  const { writeFileSync } = await import('fs');
  writeFileSync('./ws-load-test-report.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    target: WS_URL,
    phases: results,
  }, null, 2));
  console.log('\n📄 ws-load-test-report.json saved');
}

main().catch(err => { console.error('\n❌ WebSocket load test failed:', err); process.exit(1); });
