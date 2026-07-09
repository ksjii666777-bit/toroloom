/**
 * ============================================================================
 * Toroloom — Load Test Suite (10k Concurrent Users)
 * ============================================================================
 *
 * Uses autocannon to run HTTP load tests against all major API endpoints.
 * Results are saved to load-test-report.json.
 *
 * Usage:
 *   node scripts/load-test.mjs
 *
 * Environment:
 *   BACKEND_URL   — Base URL (default: http://localhost:3000)
 *   DURATION      — Test duration in seconds (default: 30)
 * ============================================================================
 */

import autocannon from 'autocannon';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const DURATION = parseInt(process.env.DURATION || '20', 10);

// JWT auth header for endpoints requiring authentication
const AUTH_TOKEN = process.env.JWT_TOKEN || '';
const AUTH_HEADER = AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {};

// ──── Endpoint Definitions ─────────────────────────────────────────────────
// Weights reflect realistic API traffic distribution.
// Authenticated (auth) endpoints test PostgreSQL queries with optional Redis caching.
// Unauthenticated endpoints test baseline mock-data performance.

const ENDPOINTS = [
  // ── Unauthenticated (mock data) ──
  { url: '/health',                 method: 'GET',  weight: 5,  title: 'Health Check' },
  { url: '/api/market/indices',     method: 'GET',  weight: 18, title: 'Market Indices' },
  { url: '/api/market/stocks',      method: 'GET',  weight: 16, title: 'All Stocks' },
  { url: '/api/market/stocks/RELIANCE', method:'GET',weight:10, title: 'Stock Detail' },
  { url: '/api/education/courses',  method: 'GET',  weight: 8,  title: 'All Courses' },
  { url: '/api/system/status',      method: 'GET',  weight: 3,  title: 'System Status' },

  // ── PostgreSQL-backed (maybe cached via Redis) ──
  // Portfolio: reads from PostgreSQL storage (if DATA_SOURCE is real) or mock
  { url: '/api/portfolio/holdings', method: 'GET',  weight: 10, title: 'Portfolio Holdings', auth: true },
  { url: '/api/portfolio/positions',method: 'GET',  weight: 8,  title: 'Portfolio Positions', auth: true },
  { url: '/api/watchlist',          method: 'GET',  weight: 8,  title: 'Watchlists',          auth: true },
  { url: '/api/community/posts',    method: 'GET',  weight: 6,  title: 'Community Posts' },
  { url: '/api/notifications',      method: 'GET',  weight: 4,  title: 'Notifications',       auth: true },
  // AI Insights: uses cacheService (L1→L2→L3) with Redis caching
  { url: '/api/ai/insight/RELIANCE',method: 'GET',  weight: 2,  title: 'AI Insight (Cached)', auth: true },
  { url: '/api/ai/batch',          method: 'POST', weight: 2,  title: 'AI Batch (Cached)',    auth: true,
    body: { symbols: ['RELIANCE','TCS','HDFCBANK','INFY','SBIN'] } },
];

// ──── Run Test ────────────────────────────────────────────────────────────

function makeRequest(endpoint) {
  const req = { method: endpoint.method, path: endpoint.url, weight: endpoint.weight };
  const headers = {};
  if (endpoint.body) {
    req.body = JSON.stringify(endpoint.body);
    headers['Content-Type'] = 'application/json';
  }
  if (endpoint.auth && AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  if (Object.keys(headers).length > 0) {
    req.headers = headers;
  }
  return req;
}

async function runPhase(label, connections, duration) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`📈 ${label}`);
  console.log(`   ${connections} connections × ${duration}s → ${BACKEND_URL}`);
  console.log(`${'='.repeat(72)}`);

  const instance = autocannon({
    url: BACKEND_URL,
    connections,
    duration,
    pipelining: 1,
    connectionRate: Math.min(connections, 500),
    requests: ENDPOINTS.map(makeRequest),
    title: label,
    bailout: 20,
  });

  return new Promise((resolve, reject) => {
    autocannon.track(instance, { renderResultsTable: true });
    instance.on('done', resolve);
    instance.on('error', reject);
  });
}

// ──── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Toroloom — Load Test Suite\n');
  console.log(`Target:        ${BACKEND_URL}`);
  console.log(`Duration:      ${DURATION}s per phase\n`);

  // Quick smoke test
  console.log('🔥 WARMUP — 50 connections, 10s');
  const warmup = await runPhase('Warmup (50)', 50, 10);

  // Phase 1: 1,000
  const p1 = await runPhase('Phase 1 — 1,000 connections', 1000, DURATION);
  printPhase(p1, '1,000 conns');

  // Phase 2: 5,000
  const p2 = await runPhase('Phase 2 — 5,000 connections', 5000, DURATION);
  printPhase(p2, '5,000 conns');

  // Phase 3: 10,000 (target)
  const p3 = await runPhase('Phase 3 — 10,000 connections (TARGET)', 10000, DURATION);
  printPhase(p3, '10,000 conns');

  // ── Summary Table ──
  const phases = [
    { label: '1,000 conns', data: p1 },
    { label: '5,000 conns', data: p2 },
    { label: '10,000 conns', data: p3 },
  ];

  console.log(`\n${'='.repeat(72)}`);
  console.log('🏁  BENCHMARKS — SUMMARY');
  console.log('='.repeat(72));
  console.log('');
  console.log('  Connections    Req/s      Errors    p50(ms)   p75(ms)   p90(ms)   p95(ms)   p99(ms)   max(ms)');
  console.log('  ' + '-'.repeat(85));

  for (const p of phases) {
    const r = p.data;
    const reqs = r.requests?.total || r.requests?.sent || 0;
    const dur = r.duration || DURATION;
    const t = reqs / dur;
    const lat = r.latency || {};
    const err = r.errors || 0;
    console.log(`  ${p.label.padEnd(13)} | ${t.toFixed(0).padStart(7)} req/s` +
      `| ${String(err).padStart(5)}   ` +
      `| ${(lat.p50 || 0).toFixed(1).padStart(7)}` +
      `| ${(lat.p75 || 0).toFixed(1).padStart(7)}` +
      `| ${(lat.p90 || 0).toFixed(1).padStart(7)}` +
      `| ${(lat.p95 || 0).toFixed(1).padStart(7)}` +
      `| ${(lat.p99 || 0).toFixed(1).padStart(7)}` +
      `| ${(lat.max || 0).toFixed(0).padStart(8)}`);
  }

  // ── Save Report ──
  const report = {
    timestamp: new Date().toISOString(),
    target: BACKEND_URL,
    phases: phases.map(p => ({
      label: p.label,
      requestsTotal: p.data.requests?.total || p.data.requests?.sent || 0,
      duration: p.data.duration || DURATION,
      throughputAvg: (p.data.requests?.total || p.data.requests?.sent || 0) / (p.data.duration || DURATION),
      latencyMs: p.data.latency ? {
        min: p.data.latency.min,
        p50: p.data.latency.p50,
        p75: p.data.latency.p75,
        p90: p.data.latency.p90,
        p95: p.data.latency.p95,
        p99: p.data.latency.p99,
        max: p.data.latency.max,
      } : {},
      errors: p.data.errors || 0,
      timeouts: p.data.timeouts || 0,
      non2xx: p.data.non2xx || 0,
      throughputMB: ((p.data.throughput?.total || 0) / 1024 / 1024),
    })),
  };

  const { writeFileSync } = await import('fs');
  writeFileSync('./load-test-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 load-test-report.json saved');

  const fs = await import('fs');
  const reportJson = JSON.stringify(report, null, 2);
  writeFileSync('./load-test-report.json', reportJson);
  console.log('\n📄 Full report saved to load-test-report.json');
}

function printPhase(r, label) {
  const reqs = r.requests?.total || r.requests?.sent || 0;
  const dur = r.duration || DURATION;
  const lat = r.latency || {};
  console.log(`\n  ${label} Results:`);
  console.log(`  Total requests: ${reqs.toLocaleString()} | Throughput: ${(reqs / dur).toFixed(0)} req/s`);
  console.log(`  Latency: p50=${(lat.p50 || 0).toFixed(1)}ms  p90=${(lat.p90 || 0).toFixed(1)}ms  p99=${(lat.p99 || 0).toFixed(1)}ms  max=${(lat.max || 0).toFixed(0)}ms`);
  console.log(`  Errors: ${r.errors || 0} | Timeouts: ${r.timeouts || 0} | Non-2xx: ${r.non2xx || 0}`);
}

main().catch(err => {
  console.error('\n❌ Load test failed:', err);
  process.exit(1);
});
