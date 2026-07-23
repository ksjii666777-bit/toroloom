/**
 * ============================================================================
 * Toroloom — RDS/pgBouncer Connection Pool Load Test
 * ============================================================================
 *
 * Stress-tests database connection pooling by hitting endpoints that
 * perform PostgreSQL queries (portfolio, positions, analytics).
 *
 * Phases:
 *   1. 50 connections (light pool usage)
 *   2. 200 connections (moderate pool usage)
 *   3. 500 connections (pool saturation — tests pgBouncer queuing)
 *   4. 1000 connections (pool exhaustion — measures degradation)
 *
 * Usage:
 *   JWT_TOKEN=<token> node scripts/rds-pool-load-test.mjs
 *
 * Environment:
 *   BACKEND_URL  — Base URL (default: http://localhost:3457)
 *   JWT_TOKEN    — Auth token
 *   DURATION     — Test duration per phase (default: 30)
 * ============================================================================
 */

import autocannon from 'autocannon';
import { writeFileSync } from 'fs';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3457';
const JWT_TOKEN = process.env.JWT_TOKEN || '';
const DURATION = parseInt(process.env.DURATION || '25', 10);
// ──── Endpoints ──────────────────────────────────────────────────────────────
// All endpoints that hit PostgreSQL directly (portfolio, analytics, orders)
const ENDPOINTS = [
  { url: '/api/portfolio/holdings',  method: 'GET', weight: 20, title: 'Holdings (PG)', auth: true },
  { url: '/api/portfolio/positions', method: 'GET', weight: 15, title: 'Positions (PG)', auth: true },
  { url: '/api/portfolio/analytics', method: 'GET', weight: 15, title: 'Analytics (PG)', auth: true },
  { url: '/api/orders/open',         method: 'GET', weight: 15, title: 'Open Orders (PG)', auth: true },
  { url: '/api/orders/history',      method: 'GET', weight: 10, title: 'Trade History (PG)', auth: true },
  { url: '/api/watchlist',           method: 'GET', weight: 10, title: 'Watchlist (PG)', auth: true },
  { url: '/api/notifications',       method: 'GET', weight: 8,  title: 'Notifications (PG)', auth: true },
  { url: '/api/ai/insight/RELIANCE', method: 'GET', weight: 5,  title: 'AI Insight (PG+Cache)', auth: true },
  { url: '/api/ai/insight/TCS',      method: 'GET', weight: 2,  title: 'AI Insight (PG+Cache)', auth: true },
];

function makeRequest(ep) {
  const req = { method: ep.method, path: ep.url, weight: ep.weight };
  const headers = {};
  if (ep.auth && JWT_TOKEN) headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
  if (Object.keys(headers).length > 0) req.headers = headers;
  return req;
}

async function runPhase(label, connections) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`📈 ${label}`);
  console.log(`   ${connections} connections × ${DURATION}s → ${BACKEND_URL}`);
  console.log(`${'='.repeat(72)}`);

  const instance = autocannon({
    url: BACKEND_URL,
    connections,
    duration: DURATION,
    pipelining: 1,
    connectionRate: Math.min(connections, 300),
    requests: ENDPOINTS.map(makeRequest),
    title: label,
    bailout: 25,
  });

  return new Promise((resolve, reject) => {
    autocannon.track(instance, { renderResultsTable: true });
    instance.on('done', resolve);
    instance.on('error', reject);
  });
}

function extractMetrics(r) {
  return {
    requestsTotal: r.requests?.total || r.requests?.sent || 0,
    throughputAvg: ((r.requests?.total || r.requests?.sent || 0) / (r.duration || DURATION)),
    latency: r.latency ? {
      min: r.latency.min, p50: r.latency.p50, p75: r.latency.p75,
      p90: r.latency.p90, p95: r.latency.p95, p99: r.latency.p99, max: r.latency.max,
    } : {},
    errors: r.errors || 0,
    timeouts: r.timeouts || 0,
    non2xx: r.non2xx || 0,
  };
}

// ──── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Toroloom — RDS/pgBouncer Connection Pool Load Test\n');
  console.log(`Target:   ${BACKEND_URL}`);
  console.log(`Duration: ${DURATION}s per phase`);
  console.log(`Auth:     ${JWT_TOKEN ? '✅ Token set' : '❌ No token — auth endpoints will 401'}`);
  console.log(`DB Pool:  pgBouncer default pool = 25, max = 100\n`);

  // Warmup
  console.log('🔥 WARMUP — 25 connections, 10s');
  await runPhase('Warmup (25)', 25);

  // Phase 1: 50 connections — light pool usage
  const p1 = await runPhase('Phase 1 — 50 connections (light)', 50);
  const m1 = extractMetrics(p1);

  // Phase 2: 200 connections — moderate pool (forces queue)
  const p2 = await runPhase('Phase 2 — 200 connections (moderate)', 200);
  const m2 = extractMetrics(p2);

  // Phase 3: 500 connections — pool saturation
  const p3 = await runPhase('Phase 3 — 500 connections (saturation)', 500);
  const m3 = extractMetrics(p3);

  // Phase 4: 1000 connections — pool exhaustion
  const p4 = await runPhase('Phase 4 — 1,000 connections (exhaustion)', 1000);
  const m4 = extractMetrics(p4);

  // ── Summary ──
  console.log(`\n${'='.repeat(72)}`);
  console.log('🏁  RDS CONNECTION POOL BENCHMARKS — SUMMARY');
  console.log('='.repeat(72));
  console.log('');
  console.log('  Connections    Req/s      Errors    p50(ms)   p90(ms)   p99(ms)   Degradation');
  console.log('  ' + '-'.repeat(80));

  const baseline = m1.throughputAvg;
  const phases = [
    { label: '50 conns (light)',    data: m1 },
    { label: '200 conns (moderate)', data: m2 },
    { label: '500 conns (saturate)', data: m3 },
    { label: '1000 conns (exhaust)', data: m4 },
  ];

  for (const p of phases) {
    const lat = p.data.latency;
    const degradation = baseline > 0
      ? `${((1 - p.data.throughputAvg / baseline) * 100).toFixed(1)}%`
      : '—';
    console.log(
      `  ${p.label.padEnd(23)} | ${p.data.throughputAvg.toFixed(0).padStart(7)}` +
      ` | ${String(p.data.errors).padStart(5)}` +
      ` | ${(lat.p50 || 0).toFixed(1).padStart(7)}` +
      ` | ${(lat.p90 || 0).toFixed(1).padStart(7)}` +
      ` | ${(lat.p99 || 0).toFixed(1).padStart(7)}` +
      ` | ${degradation.padStart(9)}`
    );
  }

  // Pool health assessment
  console.log(`\n📊 Pool Health Assessment:`);
  const p50At50 = m1.latency.p50 || 0;
  const p50At1k = m4.latency.p50 || 0;
  const errIncrease = m4.errors - m1.errors;

  if (p50At50 > 0 && p50At1k > 0) {
    const latencyMultiplier = (p50At1k / p50At50).toFixed(1);
    console.log(`   Latency multiplier (50→1000 conns): ${latencyMultiplier}x`);
    console.log(`   Error increase: ${errIncrease > 0 ? `${errIncrease} new errors at 1000 conns` : 'No additional errors — pool scales well'}`);
    if (parseFloat(latencyMultiplier) > 10) {
      console.log('   ⚠️  Severe degradation detected — consider increasing pgBouncer pool size');
    } else if (parseFloat(latencyMultiplier) > 3) {
      console.log('   ⚠️  Moderate degradation — monitor pool usage');
    } else {
      console.log('   ✅ Pool scales well — pgBouncer configuration is adequate');
    }
  }

  // ── Save Report ──
  const report = {
    timestamp: new Date().toISOString(),
    target: BACKEND_URL,
    assessment: {
      latencyMultiplier50to1k: p50At50 > 0 ? (p50At1k / p50At50).toFixed(1) : 'N/A',
      errorIncrease: errIncrease,
      poolHealth: errIncrease > 100 ? 'critical' : errIncrease > 10 ? 'degraded' : 'healthy',
    },
    phases: [
      { label: '50 conns (light)', connections: 50, ...m1 },
      { label: '200 conns (moderate)', connections: 200, ...m2 },
      { label: '500 conns (saturate)', connections: 500, ...m3 },
      { label: '1000 conns (exhaust)', connections: 1000, ...m4 },
    ],
  };

  writeFileSync('./rds-pool-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 rds-pool-report.json saved');
}

main().catch(err => { console.error('\n❌ RDS pool load test failed:', err); process.exit(1); });
