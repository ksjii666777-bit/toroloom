import * as Sentry from '@sentry/node';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { env, validateRequiredEnv } from './config/env';
import { BRAND } from './config/brandConfig';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, authLimiter, writeLimiter, readLimiter, adminLimiter } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/auth';
import { requireSubscription, configureSubscriptionGating } from './middleware/subscriptionGate';
import { inputSanitizer, bodySizeLimiter } from './middleware/inputSanitizer';
import { replayProtection } from './middleware/replayProtection';
import { setupWebSocket } from './websocket/handler';
import { getStorage, getStorageIfInitialized } from './services/storage';
import { auditTrail } from './services/auditTrail';
import { riskEngine } from './services/riskEngine/RiskEngine';
import { configureBrokerPersistence, loadBrokerStateFromStorage } from './services/broker';
import { configureSnapTradePersistence } from './services/snapTradePersistence';
import { configureTelegramPersistence } from './services/telegramPersistence';
import { configureKycPersistence } from './services/kyc';
import { configureNotificationPersistence } from './services/notifications';
import { configureCommunityPersistence } from './services/community';
import { configurePortfolioAlertStorage, configureBadgeCountPersistence } from './services/portfolioAlerts';
import { configureStockAlertPersistence } from './services/stockAlertService';
import { startStockAlertPoller } from './services/queue';

// Services
import { configureMarketStack } from './services/marketstack';
import { configureCommodityApi } from './services/commodityService';
import { configureBondApi } from './services/bondService';
import { configureTelegramBot, hydrateUserLinksFromStorage } from './services/telegramBot';

// Routes
import authRoutes from './routes/auth';
import marketRoutes from './routes/market';
import portfolioRoutes from './routes/portfolio';
import watchlistRoutes from './routes/watchlist';
import mutualFundsRoutes from './routes/mutualFunds';
import educationRoutes from './routes/education';
import communityRoutes from './routes/community';
import aiInsightsRoutes from './routes/aiInsights';
import notificationsRoutes from './routes/notifications';
import riskRoutes from './routes/risk';
import supportRoutes from './routes/support';
import fundsRoutes from './routes/funds';
import ordersRoutes from './routes/orders';
import brokerRoutes from './routes/broker';
import brokerLinkRoutes from './routes/brokerLink';
import snapTradeRoutes from './routes/snaptrade';
import systemRoutes from './routes/system';
import wsStatusRoutes from './routes/wsStatus';
import ironLockRoutes from './routes/ironLock';
import metricsRoutes from './routes/metrics';
import paymentsRoutes from './routes/payments';
import subscriptionRoutes, { webhookRouter, configureSubscriptionPersistence, setWebhookSecret } from './routes/subscriptions';
import subscriptionAnalyticsRoutes, { configureSubscriptionAnalyticsStore } from './routes/subscriptionAnalytics';
import webhookHealthRoutes from './routes/webhookHealth';
import couponRoutes, { configureCouponPersistence } from './routes/coupons';
import pushNotificationsRoutes from './routes/pushNotifications';
import contractNoteRoutes from './routes/contractNote';
import fnoRoutes from './routes/fno';
import newsRoutes from './routes/news';
import telegramRoutes from './routes/telegram';
import dividendRoutes from './routes/dividends';
import fundamentalsRoutes from './routes/fundamentals';
import brokerProxyRoutes from './routes/brokerProxy';
import socialRoutes from './routes/social';
import kycRoutes from './routes/kyc';
import twoFactorRoutes from './routes/twoFactor';
import analyticsRoutes from './routes/analytics';
import syncRoutes from './services/syncService';
import globalStocksRoutes from './routes/globalStocks';
import forexRoutes from './routes/forex';
import commoditiesRoutes from './routes/commodities';
import bondsRoutes from './routes/bonds';
import { setWSS, getFailureCount, SEND_FAILURE_THRESHOLD } from './services/syncInvalidationBridge';

// ============ Sentry Initialization ============

if (env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    tracesSampleRate: env.isDev ? 0.1 : 0.5,
    integrations: [Sentry.expressIntegration()],
  });
}

const app = express();
const server = http.createServer(app);

// ============ Middleware ============

// ── Security Headers (Helmet) — guards against XSS, clickjacking, MIME sniffing, etc.
app.use(helmet({
  contentSecurityPolicy: env.isDev ? false : undefined,
  crossOriginEmbedderPolicy: false,
}));

// ── CORS — restrict in production via CORS_ORIGIN env var (comma-separated domains)
// Default '*' is safe for dev but MUST be locked down in production.
const corsOrigins = env.corsOrigin === '*' ? '*' : env.corsOrigin.split(',').map(s => s.trim());
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Security: Body size limiter (guards against LPDOS & body bombs) ────
// Mounted BEFORE express.json() to abort early on oversized bodies.
// Default: 100 KB for regular endpoints, webhook route uses its own.
app.use(bodySizeLimiter(100_000));

// ── Webhook route MUST use raw body for Razorpay signature verification ──
// Mounted BEFORE express.json() to prevent body consumption by JSON parser.
// Razorpay sends application/json with HMAC-SHA256 over the raw body bytes.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), webhookRouter);

app.use(express.json({ limit: '100kb' }));

// ── Security: Global input sanitizer (SSTI, NoSQL, SQL injection, clipboard) ──
// ** MUST be mounted AFTER express.json() ** so req.body is already parsed.
// Sanitizes body fields, query params, and URL params for all incoming requests.
app.use(inputSanitizer);

app.use('/api', apiLimiter);

// ── Security: Replay attack protection on payment routes ────────────────
// Parent catch-all covers all /api/payments/* sub-paths.
// Backward-compatible: passes through if no nonce/timestamp present.
app.use('/api/payments', replayProtection);

// Per-route rate limiters applied below:
//   authLimiter  → auth routes (login/signup) — strictest
//   readLimiter  → reads: market, portfolio, education, community
//   writeLimiter → writes: orders, payments, funds, broker
//   adminLimiter → system, metrics, health

// Serve .well-known files for Universal Links / Android App Links verification
app.use('/.well-known', express.static(path.join(__dirname, '../public/.well-known'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('apple-app-site-association')) {
      res.setHeader('Content-Type', 'application/json');
    }
  },
}));

// ============ Prometheus Metrics ============

app.use('/metrics', metricsRoutes);

// ============ Health Check (liveness) ============

app.get('/health', async (_req, res) => {
  const storage = getStorageIfInitialized();
  let storageHealthy = false;
  if (storage) {
    try { storageHealthy = await storage.isHealthy(); } catch { /* not healthy */ }
  }

  const syncBridgeFailures = getFailureCount();

  res.json({
    status: storageHealthy ? 'ok' : 'degraded',
    broker: env.broker,
    dataSource: env.dataSource,
    storageBackend: env.storageBackend,
    storageHealthy,
    syncBridge: {
      consecutiveSendFailures: syncBridgeFailures,
      circuitOpen: syncBridgeFailures >= SEND_FAILURE_THRESHOLD,
      failureThreshold: SEND_FAILURE_THRESHOLD,
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ============ Readiness Check ============
// Separate from /health (liveness). Railway's healthcheckPath points here.
// Returns 503 when a real storage backend (postgres/mongodb) is configured
// but the DB is unreachable — so a degraded DB surfaces as an unhealthy
// deployment instead of a misleading 200 (memory backend is always 'healthy').
// With STORAGE_BACKEND=postgres and a down DB this makes Railway restart the
// container (restartPolicyType: ON_FAILURE, up to restartPolicyMaxRetries).
app.get('/ready', async (_req, res) => {
  const storage = getStorageIfInitialized();
  let storageHealthy = false;
  if (storage) {
    try { storageHealthy = await storage.isHealthy(); } catch { /* not healthy */ }
  }

  const notReady = env.storageBackend !== 'memory' && !storageHealthy;

  res.status(notReady ? 503 : 200).json({
    status: notReady ? 'not_ready' : 'ready',
    storageBackend: env.storageBackend,
    storageHealthy,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ============ API Routes (with per-group rate limiters) ============

// ── Auth — strictest limiter (10 req / 15 min) ────────────────────────
app.use('/api/auth', authLimiter, authRoutes);

// ── Reads — 200 req / min ────────────────────────────────────────────
app.use('/api/market', readLimiter, marketRoutes);
app.use('/api/market/fundamentals', authMiddleware, fundamentalsRoutes);
app.use('/api/portfolio', readLimiter, portfolioRoutes);
app.use('/api/watchlist', readLimiter, watchlistRoutes);
app.use('/api/mutual-funds', readLimiter, mutualFundsRoutes);
app.use('/api/education', readLimiter, educationRoutes);
app.use('/api/community', readLimiter, communityRoutes);
app.use('/api/ai', readLimiter, authMiddleware, requireSubscription('pro'), aiInsightsRoutes);
app.use('/api/notifications', readLimiter, notificationsRoutes);
app.use('/api/notifications', readLimiter, pushNotificationsRoutes);
app.use('/api/risk', readLimiter, riskRoutes);
app.use('/api/support', readLimiter, supportRoutes);
app.use('/api/system', readLimiter, systemRoutes);
app.use('/api/system', readLimiter, wsStatusRoutes);

// ── Writes — 50 req / min ────────────────────────────────────────────
// Replay protection ensures idempotency for fund transfers and order placement
app.use('/api/funds', writeLimiter, replayProtection, fundsRoutes);
app.use('/api/orders', writeLimiter, replayProtection, ordersRoutes);
app.use('/api/broker', writeLimiter, brokerRoutes);
app.use('/api/broker-link', writeLimiter, authMiddleware, requireSubscription('pro'), brokerLinkRoutes);

// ── SnapTrade Broker OAuth — 50 req / min ──────────────────────────────
app.use('/api/snaptrade', writeLimiter, authMiddleware, snapTradeRoutes);
app.use('/api/iron-lock', writeLimiter, authMiddleware, requireSubscription('elite'), ironLockRoutes);
app.use('/api/payments', writeLimiter, paymentsRoutes);
// Protected subscription routes (authMiddleware applied inside router)
app.use('/api/subscriptions', writeLimiter, subscriptionRoutes);

// Subscription analytics (admin only)
app.use('/api/subscription-analytics', writeLimiter, authMiddleware, subscriptionAnalyticsRoutes);

// Razorpay webhook health & monitoring
app.use('/api/webhooks', readLimiter, webhookHealthRoutes);
app.use('/api/contract-note', writeLimiter, authMiddleware, requireSubscription('pro'), contractNoteRoutes);

// ── F&O — 100 req / min (data reads), 50 req / min (writes) ────────────
app.use('/api/fno', readLimiter, fnoRoutes);

// ── Social — 200 req / min (rates apply in production) ────────────────────
app.use('/api/social', readLimiter, authMiddleware, requireSubscription('elite'), socialRoutes);

// ── Coupons — 50 req / min ──────────────────────────────────────────────
app.use('/api/coupons', writeLimiter, couponRoutes);

// ── KYC — 50 req / min (writes), auth required ────────────────────────
app.use('/api/kyc', writeLimiter, authMiddleware, replayProtection, kycRoutes);

// ── 2FA — auth required, moderate rate ──────────────────────────────────
// Replay protection prevents reuse of intercepted 2FA setup/verify requests
app.use('/api/auth/2fa', writeLimiter, authMiddleware, replayProtection, twoFactorRoutes);

// ── News — 100 req / min ──────────────────────────────────────────
app.use('/api/news', readLimiter, newsRoutes);

// ── Dividends — 100 req / min ───────────────────────────────────────
app.use('/api/dividends', readLimiter, dividendRoutes);

// ── Telegram — 50 req / min ────────────────────────────────────────
app.use('/api/telegram', writeLimiter, telegramRoutes);

// ── Broker Proxy — 100 req / min (auth required) ────────────────────
app.use('/api/broker-proxy', writeLimiter, brokerProxyRoutes);

app.use('/api/sync', writeLimiter, authMiddleware, syncRoutes);

// ── Global Stocks (Europe + Asia-Pacific) — 200 req / min ──────────
app.use('/api/global-stocks', readLimiter, globalStocksRoutes);

// ── Advanced Markets (Forex, Commodities, Bonds) — 200 req / min ──
app.use('/api/forex', readLimiter, forexRoutes);
app.use('/api/commodities', readLimiter, commoditiesRoutes);
app.use('/api/bonds', readLimiter, bondsRoutes);

// ── Analytics — 200 req / min — Redis-cached endpoints ─────────────────────
app.use('/api/analytics', readLimiter, authMiddleware, requireSubscription('pro'), analyticsRoutes);

// ── Admin — 20 req / min ─────────────────────────────────────────────
app.use('/metrics', adminLimiter, metricsRoutes);

// ============ Sentry Error Handler (must be before custom error handler) ============

if (env.sentryDsn) {
  Sentry.setupExpressErrorHandler(app);
}

// ============ Error Handler ============

app.use(errorHandler);

// ============ WebSocket ============

const wss = setupWebSocket(server);

// Wire the sync invalidation bridge so data mutations push
// cache_invalidate events to connected WebSocket clients.
setWSS(wss);

// ============ Storage Initialization ============

async function initializeStorage(): Promise<void> {
  try {
    const storage = await getStorage();
    if (process.env.NODE_ENV !== 'test') {
      console.log(`   Storage:    ${env.storageBackend.toUpperCase()}`);
    }

    // ── PostgreSQL: auto-apply pending SQL migrations on startup ──
    // Only for the postgres backend. Uses a short-lived pool so the main
    // storage pool is untouched; every migration is idempotent (CREATE TABLE
    // /INDEX IF NOT EXISTS + _migrations tracking table), so this is safe to
    // run on every boot and also picks up future numbered SQL files.
    if (env.storageBackend === 'postgres' && env.databaseUrl) {
      const { Pool } = await import('pg');
      const { runMigrations } = await import('./services/migrationRunner');
      const migrationPool = new Pool({ connectionString: env.databaseUrl });
      try {
        const result = await runMigrations(migrationPool, {
          dir: path.join(__dirname, '../migrations'),
          silent: process.env.NODE_ENV === 'test',
        });
        if (process.env.NODE_ENV !== 'test') {
          console.log(`   Migrations: ${result.applied} applied, ${result.skipped} skipped`);
        }
      } catch (err) {
        console.error('   ⚠ Migration runner failed:', err);
      } finally {
        await migrationPool.end();
      }

      // Wire stock alerts to the real PostgreSQL pool (persistent) and start
      // the poller. The pool is exposed by PostgreSQLStorage for direct-SQL
      // services that aren't part of the StorageEngine interface.
      if (process.env.NODE_ENV !== 'test') {
        const pgPool = (storage as unknown as { getPool?: () => import('pg').Pool | null })?.getPool?.() ?? null;
        configureStockAlertPersistence(pgPool);
        startStockAlertPoller();
      }
    }

    // Wire storage into the AuditTrail singleton
    await auditTrail.configureStorage(storage);

    // Wire storage into the RiskEngine for profile persistence
    riskEngine.configureStorage(storage);

    // Wire storage into the Broker factory for state persistence
    configureBrokerPersistence(storage);

    // Wire storage into the Notification service for persistence
    await configureNotificationPersistence(storage);

    // Wire storage into the Community service for persistence
    await configureCommunityPersistence(storage);

    // Wire storage into the Portfolio Alert service for persistence
    configurePortfolioAlertStorage(storage);

    // Wire storage into the Badge Count service for persistence
    configureBadgeCountPersistence(storage);

    // Wire storage into the KYC service for persistence
    await configureKycPersistence(storage);

    // Wire storage into the Subscription service for persistence
    configureSubscriptionPersistence(storage);

    // Wire storage into the Coupon service for persistence
    configureCouponPersistence(storage);

    // Wire storage into the SnapTrade persistence layer
    configureSnapTradePersistence(storage);

    // Wire storage into the Telegram persistence layer
    configureTelegramPersistence(storage);

    // Hydrate Telegram bot's in-memory cache from persisted links
    // so previously-linked users don't need to re-link after restart
    await hydrateUserLinksFromStorage();

    // Wire storage into the Subscription Gate middleware
    configureSubscriptionGating(storage);
    if (env.razorpayWebhookSecret) {
      setWebhookSecret(env.razorpayWebhookSecret);
    }

    // Wire storage into the Subscription Analytics module
    configureSubscriptionAnalyticsStore(storage);

    // Load persisted broker state (type + dedup cache)
    await loadBrokerStateFromStorage();

    if (process.env.NODE_ENV !== 'test') {
      console.log(`   Profile persistence: enabled`);
    }
  } catch (error) {
    console.error('   ⚠ Storage initialization failed — falling back to in-memory:', error);
  }
}

// ============ Start Server ============

async function start(): Promise<http.Server> {
  // ── Validate required environment variables ─────────────────────
  // Fails fast in production if JWT_SECRET or DATABASE_URL are missing.
  // Prints warnings in development for missing optional config.
  // ── Configure external API services ────────────────────────────
  configureMarketStack({ marketstackKey: env.marketstackKey });
  configureCommodityApi({ commodityApiKey: env.commodityApiKey });
  configureBondApi({ fredApiKey: env.fredApiKey });
  configureTelegramBot({ token: env.telegramBotToken });

  const missingVars = validateRequiredEnv();
  if (missingVars.length > 0) {
    const isProduction = env.nodeEnv === 'production' || !env.isMock;
    if (isProduction) {
      console.error('[env] MISSING REQUIRED ENVIRONMENT VARIABLES:');
      for (const v of missingVars) {
        console.error('[env]   - ' + v);
      }
      console.error('[env]');
      console.error('[env] Set them in:');
      console.error('[env]   Production: Railway Dashboard - Variables');
      console.error('[env]   Local:       backend/.env');
      console.error('[env]   K8s:         kubectl create secret generic toroloom-secrets');
      console.error('[env] Server cannot start without required variables. Exiting.');
      process.exit(1);
    } else {
      console.warn('[env] WARNING: Missing optional env vars: ' + missingVars.join(', '));
    }
  }

  await initializeStorage();

  return new Promise((resolve) => {
    server.listen(env.port, () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`\n🚀 ${BRAND.appName} Backend Server`);
        console.log(`   Brand:      ${BRAND.appName}`);
        console.log(`   Mode:       ${env.broker.toUpperCase()} (${env.dataSource})`);
        console.log(`   REST API:   http://localhost:${env.port}/api`);
        console.log(`   WebSocket:  ws://localhost:${env.port}/ws`);
        console.log(`   Health:     http://localhost:${env.port}/health\n`);
      }
      resolve(server);
    });
  });
}

export { app, server, start, wss, initializeStorage };
