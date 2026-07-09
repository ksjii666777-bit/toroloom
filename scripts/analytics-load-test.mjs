/**
 * ============================================================================
 * Toroloom — Analytics Endpoint Load Test (Redis Cache Comparison)
 * ============================================================================
 *
 * Tests ONLY the analytics endpoints that use cacheService (Redis L2 cache):
 *   - POST /api/ai/analyze       — Single-symbol AI insight (L1→L2→L3 chain)
 *   - POST /api/ai/analyze/batch — Batch AI insights (multi-L2 lookups)
 *   - GET  /api/ai/insights      — AI insights list (in-memory cache)
 *
 * Runs two iterations:
 *   1. DISABLE_CACHE=1 — PostgreSQL only, no Redis (baseline)
 *   2. Redis enabled + pre-warmed — end-to-end caching benefit
 *
 * Usage:
 *   JWT_TOKEN=<token> node scripts/analytics-load-test.mjs
 *
 * Environment:
 *   BACKEND_URL  — Base URL (default: http://localhost:3457)
 *   JWT_TOKEN    — Auth token for authenticated endpoints
 * ============================================================================
 */

import autocannon from 'autocannon';
import { writeFileSync } from 'fs';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3457';
const JWT_TOKEN = process.env.JWT_TOKEN || '';
const DURATION = parseInt(process.env.DURATION || '30', 10);

const AUTH_HEADER = JWT_TOKEN ? { 'Authorization': `Bearer ${JWT_TOKEN}` } : {};
const JSON_HEADER = { 'Content-Type': 'application/json' };

// ──── Endpoint Definitions ─────────────────────────────────────────────────
// All endpoints below use cacheService (Redis L2) or query analytics data
const ENDPOINTS = [
  // Single-symbol AI analysis — L1→L2→L3 chain with Redis cache
  {
    url: '/api/ai/analyze',
    method: 'POST',
    weight: 30,
    title: 'AI Analyze (Single)',
    body: { symbol: 'RELIANCE' },
    auth: true,
  },
  {
    url: '/api/ai/analyze',
    method: 'POST',
    weight: 20,
    title: 'AI Analyze (Single)',
    body: { symbol: 'TCS' },
    auth: true,
  },
  {
    url: '/api/ai/analyze',
    method: 'POST',
    weight: 15,
    title: 'AI Analyze (Single)',
    body: { symbol: 'HDFCBANK' },
    auth: true,
  },
  {
    url: '/api/ai/analyze',
    method: 'POST',
    weight: 10,
    title: 'AI Analyze (Single)',
    body: { symbol: 'INFY' },
    auth: true,
  },
  {
    url: '/api/ai/analyze',
    method: 'POST',
    weight: 5,
    title: 'AI Analyze (Single)',
    body: { symbol: 'SBIN' },
    auth: true,
  },
  // Batch analysis — multi-symbol Redis lookups in parallel
  {
    url: '/api/ai/analyze/batch',
    method: 'POST',
    weight: 10,
    title: 'AI Analyze (Batch)',
    body: { symbols: ['RELIANCE', 'TCS', 'HDFCBANK'] },
    auth: true,
  },
  {
    url: '/api/ai/analyze/batch',
    method: 'POST',
    weight: 5,
    title: 'AI Analyze (Batch)',
    body: { symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN', 'ITC', 'WIPRO'] },
    auth: true,
  },
  // Insights list (in-memory cached)
  {
    url: '/api/ai/insights',
    method: 'GET',
    weight: 5,
    title: 'AI Insights List',
    auth: true,
  },
];

// ──── Helpers ──────────────────────────────────────────────────────────────

function makeRequest(endpoint) {
  const req = { method: endpoint.method, path: endpoint.url, weight: endpoint.weight };
  const headers = {};
  if (endpoint.body) {
    req.body = JSON.stringify(endpoint.body);
    headers['Content-Type'] = 'application/json';
  }
  if (endpoint.auth && JWT_TOKEN) {
    headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
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
    connectionRate: Math.min(connections, 200),
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

function printPhase(r, label) {
  const reqs = r.requests?.total || r.requests?.sent || 0;
  const dur = r.duration || DURATION;
  const lat = r.latency || {};
  console.log(`\n  ${label} Results:`);
  console.log(`  Total requests: ${reqs.toLocaleString()} | Throughput: ${(reqs / dur).toFixed(0)} req/s`);
  console.log(`  Latency: p50=${(lat.p50 || 0).toFixed(1)}ms  p90=${(lat.p90 || 0).toFixed(1)}ms  p99=${(lat.p99 || 0).toFixed(1)}ms  max=${(lat.max || 0).toFixed(0)}ms`);
  console.log(`  Errors: ${r.errors || 0} | Timeouts: ${r.timeouts || 0} | Non-2xx: ${r.non2xx || 0}`);
}

// ──── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Toroloom — Analytics Endpoint Load Test (Redis Cache Comparison)');
  console.log(`\n📍 Target:   ${BACKEND_URL}`);
  console.log(`   Duration: ${DURATION}s per phase`);
  console.log(`   Auth:     ${JWT_TOKEN ? '✅ Token set' : '❌ No token — auth endpoints will 401'}`);
  console.log(`   Cache:    ${process.env.DISABLE_CACHE === '1' ? '🚫 DISABLED (PG only)' : '✅ Redis enabled'}`);
  console.log(`\n   Endpoints (${ENDPOINTS.length} total):`);
  for (const ep of ENDPOINTS) {
    console.log(`     ${ep.method.padEnd(5)} ${ep.url}${ep.body ? ' ' + JSON.stringify(ep.body) : ''} [weight: ${ep.weight}]`);
  }

  // WARMUP
  console.log(`\n🔥 WARMUP — 25 connections, 10s`);
  await runPhase('Warmup (25)', 25, 10);

  // Phase 1: 100 connections (focused analytic load)
  const p1 = await runPhase('Phase 1 — 100 connections (focused)', 100, DURATION);
  printPhase(p1, '100 conns');

  // Phase 2: 500 connections (higher analytic load)
  const p2 = await runPhase('Phase 2 — 500 connections (moderate)', 500, DURATION);
  printPhase(p2, '500 conns');

  // Phase 3: 1000 connections (stress)
  const p3 = await runPhase('Phase 3 — 1,000 connections (stress)', 1000, DURATION);
  printPhase(p3, '1,000 conns');

  // ── Summary Table ──
  const phases = [
    { label: '100 conns', data: p1 },
    { label: '500 conns', data: p2 },
    { label: '1,000 conns', data: p3 },
  ];

  console.log(`\n${'='.repeat(72)}`);
  console.log('🏁  ANALYTICS BENCHMARKS — SUMMARY');
  console.log('='.repeat(72));
  console.log('');
  console.log('  Connections    Req/s      Errors    p50(ms)   p75(ms)   p90(ms)   p99(ms)   max(ms)');
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
  const suffix = process.env.DISABLE_CACHE === '1' ? '-nocache' : '-cached';
  const report = {
    timestamp: new Date().toISOString(),
    target: BACKEND_URL,
    cacheEnabled: process.env.DISABLE_CACHE !== '1',
    config: process.env.DISABLE_CACHE === '1' ? 'PG-only (no Redis)' : 'PG + Redis (warmed)',
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

  writeFileSync(`./analytics-report${suffix}.json`, JSON.stringify(report, null, 2));
  console.log(`\n📄 analytics-report${suffix}.json saved`);
}

main().catch(err => {
  console.error('\n❌ Analytics load test failed:', err);
  process.exit(1);
});
