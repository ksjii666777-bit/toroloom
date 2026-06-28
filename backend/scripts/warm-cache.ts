/**
 * ============================================================================
 * Toroloom — Redis Cache Warming Script
 * ============================================================================
 *
 * Warms up the Redis cache post-deployment with frequently accessed data,
 * so the first users hitting the app after deploy don't suffer cold-cache
 * latency on expensive AI analysis endpoints.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   # From the backend directory:
 *   npx ts-node scripts/warm-cache.ts --users=user_abc,user_def
 *
 *   # Warm cache for top-N mock users:
 *   npx ts-node scripts/warm-cache.ts --prefix=user_ --limit=10
 *
 *   # Dry run — show what would be warmed without actually setting Redis:
 *   npx ts-node scripts/warm-cache.ts --users=user_abc --dry-run
 *
 *   # Custom Redis URL (defaults to REDIS_URL env var or localhost:6379):
 *   REDIS_URL=redis://localhost:6379 npx ts-node scripts/warm-cache.ts --users=user_abc
 *
 * ── What gets warmed ───────────────────────────────────────────────────────
 *
 *   Key pattern                      | Source           | TTL
 *   ---------------------------------|------------------|-------
 *   toroloom:cache:aiCognitive:*     | AI mock data     | 600s
 *
 * ── Production ─────────────────────────────────────────────────────────────
 *
 *   In production, run as a Railway post-deploy hook or Kubernetes Job:
 *
 *     railway run bash -c "cd backend && npx ts-node scripts/warm-cache.ts --prefix=user_ --limit=100"
 *
 *   Or compile first and run with plain Node:
 *
 *     npx tsc scripts/warm-cache.ts --outDir dist/scripts
 *     node dist/scripts/warm-cache.js --users=user_abc
 *
 * ============================================================================
 */

import Redis from 'ioredis';

// ──── Config ───────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || process.env.RAILWAY_REDIS_URL || '';
const KEY_PREFIX = 'toroloom:cache:';
const LOG_PREFIX = '[WarmCache]';

const TTL = {
  aiCognitive: 600,  // 10 minutes — matches cacheService.ts KEY_TTL.aiCognitive
};

// ──── Mock AI insights for warming ─────────────────────────────────────────

const MOCK_INSIGHTS: Array<{
  symbol: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
}> = [
  { symbol: 'RELIANCE',   type: 'bullish', confidence: 82, summary: 'Strong buying momentum across key sectors' },
  { symbol: 'TCS',        type: 'neutral', confidence: 70, summary: 'Consolidating near resistance levels' },
  { symbol: 'INFY',       type: 'bullish', confidence: 78, summary: 'IT spending outlook remains positive' },
  { symbol: 'HDFCBANK',   type: 'bullish', confidence: 85, summary: 'Banking sector leading the rally' },
  { symbol: 'ICICIBANK',  type: 'bearish', confidence: 65, summary: 'Overbought on daily charts, profit booking likely' },
  { symbol: 'SBIN',       type: 'neutral', confidence: 72, summary: 'Awaiting breakout above key resistance' },
  { symbol: 'BHARTIARTL', type: 'bullish', confidence: 80, summary: 'Telecom tariff hike benefits flowing in' },
  { symbol: 'ITC',        type: 'bullish', confidence: 76, summary: 'FMCG demand recovery underway' },
  { symbol: 'WIPRO',      type: 'bearish', confidence: 62, summary: 'Weak QoQ growth in IT services' },
  { symbol: 'MARUTI',     type: 'neutral', confidence: 68, summary: 'Auto sales mixed, awaiting festive demand' },
  { symbol: 'TATAMOTORS', type: 'bullish', confidence: 84, summary: 'EV transition driving long-term value' },
  { symbol: 'BAJFINANCE', type: 'neutral', confidence: 71, summary: 'Credit growth strong but valuations elevated' },
  { symbol: 'KOTAKBANK',  type: 'neutral', confidence: 69, summary: 'Awaiting clarity on management changes' },
  { symbol: 'NIFTY',      type: 'bullish', confidence: 79, summary: 'Broad-market index in uptrend' },
  { symbol: 'SENSEX',     type: 'bullish', confidence: 81, summary: 'Overall market sentiment positive' },
];

// ──── CLI Parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const parsed: Record<string, string> = {};

for (const arg of args) {
  const [key, value] = arg.replace(/^--/, '').split('=');
  if (key) parsed[key] = value || '';
}

const targetUsers = parsed.users ? parsed.users.split(',').map(s => s.trim()).filter(Boolean) : [];
const prefix = parsed.prefix || '';
const limit = parseInt(parsed.limit || '10', 10);
const dryRun = parsed['dry-run'] === '' || parsed['dry-run'] === 'true';

// ──── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`${LOG_PREFIX} ╔══════════════════════════════════════════════════════╗`);
  console.log(`${LOG_PREFIX} ║  Redis Cache Warming                               ║`);
  console.log(`${LOG_PREFIX} ╠══════════════════════════════════════════════════════╣`);
  console.log(`${LOG_PREFIX} ║  Redis:   ${(REDIS_URL || '⚠ NOT SET').padEnd(36)}║`);
  console.log(`${LOG_PREFIX} ║  Dry run: ${String(dryRun).padEnd(36)}║`);
  console.log(`${LOG_PREFIX} ╚══════════════════════════════════════════════════════╝`);

  // ── 1. Check Redis URL ────────────────────────────────────────────
  if (!REDIS_URL) {
    console.error(`${LOG_PREFIX} ✗ REDIS_URL is not set.`);
    console.error(`   Export REDIS_URL or set it in your environment:`);
    console.error(`     export REDIS_URL="redis://:password@host:6379"`);
    process.exit(1);
  }

  // ── 2. Expand users list ─────────────────────────────────────────────

  if (prefix && targetUsers.length === 0) {
    console.log(`${LOG_PREFIX} Generating ${limit} user IDs with prefix "${prefix}"...`);
    for (let i = 0; i < limit; i++) {
      targetUsers.push(`${prefix}${i}`);
    }
  }

  if (targetUsers.length === 0) {
    console.error(`${LOG_PREFIX} ✗ No users specified. Use --users=id1,id2 or --prefix=user_ --limit=10`);
    process.exit(1);
  }

  console.log(`${LOG_PREFIX} Warming cache for ${targetUsers.length} user(s)...\n`);

  // ── 2. Dry run ───────────────────────────────────────────────────────
  if (dryRun) {
    const totalKeys = targetUsers.length * MOCK_INSIGHTS.length;
    console.log(`${LOG_PREFIX} [DRY RUN] Would warm ${targetUsers.length} users × ${MOCK_INSIGHTS.length} symbols`);
    console.log(`${LOG_PREFIX} [DRY RUN] Total keys: ${totalKeys}`);
    printSummary(targetUsers.length, MOCK_INSIGHTS.length);
    return;
  }

  // ── 3. Connect to Redis ──────────────────────────────────────────────
  let client: Redis;
  try {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2_000);
      },
      connectTimeout: 5_000,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    console.log(`${LOG_PREFIX} Connected to Redis successfully\n`);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} ✗ Failed to connect to Redis at ${REDIS_URL || '(not set)'}`);
    console.error(`   ${err.message}`);
    console.error(`\n   Make sure Redis is running:`);
    console.error(`     docker compose up -d redis`);
    process.exit(1);
  }

  // ── 4. Warm AI Cognitive cache ───────────────────────────────────────
  let totalKeys = 0;
  const now = new Date().toISOString();

  for (const userId of targetUsers) {
    for (const mock of MOCK_INSIGHTS) {
      const key = `${KEY_PREFIX}aiCognitive:${mock.symbol}`;
      const value = JSON.stringify({
        id: `ai_warm_${mock.symbol}_${userId}`,
        stockId: mock.symbol,
        symbol: mock.symbol,
        name: mock.symbol,
        type: mock.type,
        confidence: mock.confidence,
        summary: mock.summary,
        analysis: `Pre-warmed analysis for ${mock.symbol}. The stock is showing ${mock.type} signals based on pre-deployment cache snapshot.`,
        targets: [
          { target: 0, probability: 60 },
          { target: 0, probability: 35 },
          { target: 0, probability: 15 },
        ],
        timestamp: now,
        _source: 'cache-warm',
      });

      await client.setex(key, TTL.aiCognitive, value);
      totalKeys++;

      if (totalKeys % 25 === 0) {
        process.stdout.write('.');
      }
    }
  }
  process.stdout.write('\n');

  // ── 5. Verify ────────────────────────────────────────────────────────
  const sampleKey = `${KEY_PREFIX}aiCognitive:RELIANCE`;
  const sample = await client.get(sampleKey);
  if (sample) {
    console.log(`${LOG_PREFIX} ✓ Verified: ${sampleKey} → ${sample.length} bytes`);
  }

  // ── 6. Stats ─────────────────────────────────────────────────────────
  const dbsize = await client.dbSize();
  console.log(`\n${LOG_PREFIX} ✓ Cache warmed successfully`);
  console.log(`${LOG_PREFIX}   Keys set:    ${totalKeys}`);
  console.log(`${LOG_PREFIX}   Redis total: ${dbsize}`);

  printSummary(targetUsers.length, MOCK_INSIGHTS.length);

  await client.quit();
}

function printSummary(userCount: number, insightCount: number): void {
  const totalKeys = userCount * insightCount;
  console.log(`\n${LOG_PREFIX} ── Warm-up Summary ──────────────────────────────`);
  console.log(`${LOG_PREFIX}   Users:        ${userCount}`);
  console.log(`${LOG_PREFIX}   Symbols/user: ${insightCount}`);
  console.log(`${LOG_PREFIX}   Total keys:   ${totalKeys}`);
  console.log(`${LOG_PREFIX}   Est. size:    ~${((totalKeys * 350) / 1024).toFixed(1)} KB`);
  console.log(`${LOG_PREFIX}   TTL:          ${TTL.aiCognitive}s (AI)`);
  console.log(`${LOG_PREFIX} ───────────────────────────────────────────────────`);
}

main().catch((err: Error) => {
  console.error(`${LOG_PREFIX} ✗ Fatal error:`, err.message);
  process.exit(1);
});
