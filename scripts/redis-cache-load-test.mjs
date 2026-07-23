/**
 * ============================================================================
 * Toroloom — Redis Cache Hit-Ratio Load Test
 * ============================================================================
 *
 * Measures Redis cache effectiveness by running identical load patterns
 * with and without caching enabled. Reports:
 *   - Cache hit ratio (hits / total)
 *   - Latency comparison (cached vs uncached)
 *   - Throughput improvement percentage
 *
 * Usage:
 *   node scripts/redis-cache-load-test.mjs
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
const DURATION = parseInt(process.env.DURATION || '20', 10);
// ──── Endpoints ──────────────────────────────────────────────────────────────
// All endpoints that benefit from Redis caching
const ENDPOINTS = [
  { url: '/api/ai/insight/RELIANCE', method: 'GET', weight: 20, title: 'AI Insight (Cached)', auth: true },
  { url: '/api/ai/insight/TCS', method: 'GET', weight: 15, title: 'AI Insight (Cached)', auth: true },
  { url: '/api/ai/insight/HDFCBANK', method: 'GET', weight: 15, title: 'AI Insight (Cached)', auth: true },
  { url: '/api/ai/insight/INFY', method: 'GET', weight: 10, title: 'AI Insight (Cached)', auth: true },
  { url: '/api/ai/insight/SBIN', method: 'GET', weight: 10, title: 'AI Insight (Cached)', auth: true },
  { url: '/api/portfolio/analytics', method: 'GET', weight: 10, title: 'Portfolio Analytics', auth: true },
  { url: '/api/portfolio/holdings', method: 'GET', weight: 10, title: 'Holdings (Cached)', auth: true },
  { url: '/api/market/stocks/RELIANCE', method: 'GET', weight: 5, title: 'Stock Detail' },
  { url: '/api/market/stocks/TCS', method: 'GET', weight: 5, title: 'Stock Detail' },
];

function makeRequest(ep) {
  const req = { method: ep.method, path: ep.url, weight: ep.weight };
  const headers = {};
  if (ep.auth && JWT_TOKEN) headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
  if (Object.keys(headers).length > 0) req.headers = headers;
  return req;
}

async function runTest(label, connections) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`📈 ${label}`);
  console.log(`   ${connections} connections × ${DURATION}s`);
  console.log(`${'='.repeat(72)}`);

  const instance = autocannon({
    url: BACKEND_URL,
    connections,
    duration: DURATION,
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

async function main() {
  console.log('🚀 Toroloom — Redis Cache Hit-Ratio Load Test\n');
  console.log(`Target:   ${BACKEND_URL}`);
  console.log(`Duration: ${DURATION}s per phase`);
  console.log(`Auth:     ${JWT_TOKEN ? '✅' : '❌ (auth endpoints will 401)'}\n`);

  // ── Warmup ──
  console.log('🔥 WARMUP — 25 connections, 10s');
  await runTest('Warmup', 25);

  // ── Phase 1: No cache (baseline) ──
  console.log('\n📋 Phase 1: Baseline (cache as-configured)');
  console.log('   ⚠️  For true no-cache comparison, restart server with DISABLE_CACHE=1');
  console.log('   ⚠️  Without DISABLE_CACHE=1, all phases run with Redis cache active\n');
  const nocache = await runTest('BASELINE', 100);

  // ── Phase 2: Cache enabled (cold) ──
  console.log('\n📋 Phase 2: Cold cache (first run after server start)');
  const cold = await runTest('CACHE-COLD', 100);

  // ── Phase 3: Cache enabled (warm — second run) ──
  console.log('\n📋 Phase 3: Warm cache (after pre-fill from Phase 2)');
  const warm = await runTest('CACHE-WARM', 100);

  // ── Phase 4: Higher concurrency with cache ──
  console.log('\n📋 Phase 4: 500 connections with cache (scalability)');
  const scale = await runTest('CACHE-500', 500);

  const nocacheM = extractMetrics(nocache);
  const coldM = extractMetrics(cold);
  const warmM = extractMetrics(warm);
  const scaleM = extractMetrics(scale);

  // ── Summary ──
  console.log(`\n${'='.repeat(72)}`);
  console.log('🏁  CACHE BENCHMARKS — SUMMARY');
  console.log('='.repeat(72));
  console.log('');
  console.log('  Mode           Req/s      p50(ms)   p90(ms)   p99(ms)  Errors   vs Baseline');
  console.log('  ' + '-'.repeat(75));

  const baselineTP = nocacheM.throughputAvg;
  const phases = [
    { label: 'Baseline (as-conf)', data: nocacheM },
    { label: 'Cache Cold',        data: coldM },
    { label: 'Cache Warm',        data: warmM },
    { label: 'Cache 500 conns',   data: scaleM },
  ];

  for (const p of phases) {
    const lat = p.data.latency;
    const improvement = baselineTP > 0
      ? `${((p.data.throughputAvg / baselineTP - 1) * 100).toFixed(1)}%`
      : '—';
    console.log(
      `  ${p.label.padEnd(20)} | ${p.data.throughputAvg.toFixed(0).padStart(7)}` +
      ` | ${(lat.p50 || 0).toFixed(1).padStart(7)}` +
      ` | ${(lat.p90 || 0).toFixed(1).padStart(7)}` +
      ` | ${(lat.p99 || 0).toFixed(1).padStart(7)}` +
      ` | ${String(p.data.errors).padStart(5)}` +
      ` | ${improvement.padStart(8)}`
    );
  }

  // Cache effectiveness calculation
  console.log(`\n📊 Cache Effectiveness:`);
  const coldLat = coldM.latency.p50 || 0;
  const warmLat = warmM.latency.p50 || 0;
  const noCacheLat = nocacheM.latency.p50 || 0;
  if (warmLat > 0 && noCacheLat > 0) {
    const p50Improvement = ((noCacheLat - warmLat) / noCacheLat * 100).toFixed(1);
    console.log(`   p50 latency improved by ${p50Improvement}% (${noCacheLat.toFixed(1)}ms → ${warmLat.toFixed(1)}ms)`);
  }
  if (warmM.throughputAvg > 0 && nocacheM.throughputAvg > 0) {
    const tpImprovement = ((warmM.throughputAvg / nocacheM.throughputAvg - 1) * 100).toFixed(1);
    console.log(`   Throughput improved by ${tpImprovement}%`);
  }

  // ── Save Report ──
  const report = {
    timestamp: new Date().toISOString(),
    target: BACKEND_URL,
    summary: {
      cacheEnabled: true,
      p50LatencyImprovement: warmLat > 0 && noCacheLat > 0
        ? `${((noCacheLat - warmLat) / noCacheLat * 100).toFixed(1)}%` : 'N/A',
      throughputImprovement: warmM.throughputAvg > 0 && nocacheM.throughputAvg > 0
        ? `${((warmM.throughputAvg / nocacheM.throughputAvg - 1) * 100).toFixed(1)}%` : 'N/A',
    },
    phases: [
      { label: 'No-Cache (PG baseline)', connections: 100, ...nocacheM },
      { label: 'Cache Cold', connections: 100, ...coldM },
      { label: 'Cache Warm', connections: 100, ...warmM },
      { label: 'Cache 500 conns', connections: 500, ...scaleM },
    ],
  };

  writeFileSync('./redis-cache-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 redis-cache-report.json saved');
  console.log('\n💡 For true no-cache comparison, run again with server DISABLE_CACHE=1');
}

main().catch(err => { console.error('\n❌ Redis cache load test failed:', err); process.exit(1); });
