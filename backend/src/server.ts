import * as Sentry from '@sentry/node';
import path from 'path';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { env, validateRequiredEnv } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import { setupWebSocket } from './websocket/handler';
import { getStorage, getStorageIfInitialized } from './services/storage';
import { auditTrail } from './services/auditTrail';
import { riskEngine } from './services/riskEngine';
import { configureBrokerPersistence, loadBrokerStateFromStorage } from './services/broker';
import { configureNotificationPersistence } from './services/notifications';
import { configureCommunityPersistence } from './services/community';
import { configurePortfolioAlertStorage, configureBadgeCountPersistence } from './services/portfolioAlerts';

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
import systemRoutes from './routes/system';
import wsStatusRoutes from './routes/wsStatus';
import ironLockRoutes from './routes/ironLock';
import metricsRoutes from './routes/metrics';
import paymentsRoutes from './routes/payments';
import pushNotificationsRoutes from './routes/pushNotifications';
import contractNoteRoutes from './routes/contractNote';

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

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter);

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

// ============ Health Check ============

app.get('/health', async (_req, res) => {
  const storage = getStorageIfInitialized();
  let storageHealthy = false;
  if (storage) {
    try { storageHealthy = await storage.isHealthy(); } catch { /* not healthy */ }
  }

  res.json({
    status: storageHealthy ? 'ok' : 'degraded',
    broker: env.broker,
    dataSource: env.dataSource,
    storageBackend: env.storageBackend,
    storageHealthy,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ============ API Routes ============

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/mutual-funds', mutualFundsRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/ai', aiInsightsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/notifications', pushNotificationsRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/funds', fundsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/broker-link', brokerLinkRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/system', wsStatusRoutes);
app.use('/api/iron-lock', ironLockRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/contract-note', contractNoteRoutes);

// ============ Sentry Error Handler (must be before custom error handler) ============

if (env.sentryDsn) {
  Sentry.setupExpressErrorHandler(app);
}

// ============ Error Handler ============

app.use(errorHandler);

// ============ WebSocket ============

const wss = setupWebSocket(server);

// ============ Storage Initialization ============

async function initializeStorage(): Promise<void> {
  try {
    const storage = await getStorage();
    if (process.env.NODE_ENV !== 'test') {
      console.log(`   Storage:    ${env.storageBackend.toUpperCase()}`);
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
        console.log(`\n🚀 Toroloom Backend Server`);
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
