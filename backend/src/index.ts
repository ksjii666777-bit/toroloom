import express from 'express';
import cors from 'cors';
import http from 'http';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import { setupWebSocket } from './websocket/handler';
import { getStorage, getStorageIfInitialized } from './services/storage';
import { auditTrail } from './services/auditTrail';
import { riskEngine } from './services/riskEngine';
import { configureBrokerPersistence, loadBrokerStateFromStorage } from './services/broker';
import { configureNotificationPersistence } from './services/notifications';
import { configureCommunityPersistence } from './services/community';

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
import systemRoutes from './routes/system';
import wsStatusRoutes from './routes/wsStatus';
import metricsRoutes from './routes/metrics';

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
app.use('/api/risk', riskRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/funds', fundsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/system', wsStatusRoutes);

// ============ Error Handler ============

app.use(errorHandler);

// ============ WebSocket ============

const wss = setupWebSocket(server);

// ============ Storage Initialization ============

async function initializeStorage(): Promise<void> {
  try {
    const storage = await getStorage();
    console.log(`   Storage:    ${env.storageBackend.toUpperCase()}`);

    // Wire storage into the AuditTrail singleton
    // (auditTrail defaults to InMemoryStorage — swap to the configured backend)
    // configureStorage migrates any buffered events to the new backend.
    await auditTrail.configureStorage(storage);

    // Wire storage into the RiskEngine for profile persistence
    riskEngine.configureStorage(storage);

    // Wire storage into the Broker factory for state persistence
    configureBrokerPersistence(storage);

    // Wire storage into the Notification service for persistence
    await configureNotificationPersistence(storage);

    // Wire storage into the Community service for persistence
    await configureCommunityPersistence(storage);

    // Load persisted broker state (type + dedup cache)
    await loadBrokerStateFromStorage();

    console.log(`   Profile persistence: enabled`);
  } catch (error) {
    console.error('   ⚠ Storage initialization failed — falling back to in-memory:', error);
  }
}

// ============ Start Server ============

async function start(): Promise<void> {
  await initializeStorage();

  server.listen(env.port, () => {
    console.log(`\n🚀 Toroloom Backend Server`);
    console.log(`   Mode:       ${env.broker.toUpperCase()} (${env.dataSource})`);
    console.log(`   REST API:   http://localhost:${env.port}/api`);
    console.log(`   WebSocket:  ws://localhost:${env.port}/ws`);
    console.log(`   Health:     http://localhost:${env.port}/health\n`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  wss.close();
  const { getStorageIfInitialized } = await import('./services/storage');
  const storage = getStorageIfInitialized();
  if (storage) await storage.disconnect();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  wss.close();
  const { getStorageIfInitialized } = await import('./services/storage');
  const storage = getStorageIfInitialized();
  if (storage) await storage.disconnect();
  server.close(() => process.exit(0));
});

export { app, server };
