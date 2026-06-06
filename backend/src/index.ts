/**
 * Toroloom Backend — Cluster Entry Point
 *
 * Behaviour controlled by env vars:
 *   CLUSTER_MODE  = "1" (default in production) — enables multi-core forking
 *   CLUSTER_WORKERS = <number> — worker count (default: CPU cores)
 *
 * In development (CLUSTER_MODE=0 or NODE_ENV !== production),
 * the server runs in single-process mode (no clustering).
 */

import cluster from 'cluster';
import os from 'os';
import { env } from './config/env';
import { getStorageIfInitialized } from './services/storage';
import { startPrimaryIPC, startWorkerIPC } from './services/clusterIPC';

const isProduction = process.env.NODE_ENV === 'production' || env.dataSource !== 'mock';
// Cluster enabled when:
// - CLUSTER_MODE=1 explicitly (for local testing), OR
// - Not explicitly disabled (CLUSTER_MODE !== '0') AND is production
const clusterEnabled = process.env.CLUSTER_MODE === '1' ||
  (process.env.CLUSTER_MODE !== '0' && isProduction);
const workerCount = Math.min(
  parseInt(process.env.CLUSTER_WORKERS || '', 10) || os.cpus().length,
  16, // hard cap to avoid resource exhaustion
);

if (cluster.isPrimary && clusterEnabled) {
  // ──── Primary Process — Fork Workers ──────────────────────────────────
  console.log(`\n🚀 Toroloom Backend Cluster — Primary [PID ${process.pid}]`);
  console.log(`   Workers:    ${workerCount} (of ${os.cpus().length} CPU cores)`);
  console.log(`   Mode:       ${env.broker.toUpperCase()} (${env.dataSource})`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);

  const workers = new Set<cluster.Worker>();
  let workerSlotCounter = 0;
  // Track restarts per slot (not per PID — PID changes on restart)
  const workerRestarts = new Map<number, number>();

  function forkWorker(): cluster.Worker {
    const slot = workerSlotCounter++;
    const w = cluster.fork();
    (w as any).__slot = slot;
    workerRestarts.set(slot, 0);
    workers.add(w);
    console.log(`   [+] Worker ${w.process.pid} started (slot ${slot}, ${workers.size}/${workerCount})`);
    return w;
  }

  // Fork initial workers
  for (let i = 0; i < workerCount; i++) {
    forkWorker();
  }

  // Start the IPC bridge to aggregate cross-worker state
  startPrimaryIPC().catch(err => {
    console.error('   [IPC] Failed to start primary IPC bridge:', err);
  });

  // Graceful shutdown on primary signals
  function shutdownPrimary() {
    console.log('\n   ⏳ Shutting down cluster gracefully...');
    for (const w of workers) {
      w.kill('SIGTERM');
    }
    setTimeout(() => process.exit(0), 5000);
  }

  process.on('SIGTERM', shutdownPrimary);
  process.on('SIGINT', shutdownPrimary);

  // Auto-restart workers on crash (up to 3 restarts per slot)
  cluster.on('exit', (worker, code, signal) => {
    workers.delete(worker);
    const slot = (worker as any).__slot ?? 0;
    const restarts = workerRestarts.get(slot) ?? 0;
    const pid = worker.process.pid!;

    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      if (restarts < 3) {
        console.log(`   [!] Worker ${pid} (slot ${slot}) exited (code: ${code}). Restarting... (attempt ${restarts + 1}/3)`);
        workerRestarts.set(slot, restarts + 1);
        forkWorker();
      } else {
        console.error(`   [X] Worker ${pid} (slot ${slot}) exited ${restarts} times. No more restarts.`);
      }
    } else {
      console.log(`   [-] Worker ${pid} (slot ${slot}) stopped gracefully.`);
    }
  });

  cluster.on('online', (worker) => {
    console.log(`   [✓] Worker ${worker.process.pid} is online`);
  });
} else {
  // ──── Worker Process — Run Server ────────────────────────────────────
  // (also runs when cluster is disabled — single-process mode)

  if (cluster.isWorker) {
    console.log(`   ▶ Worker [PID ${process.pid}] initializing...`);
    // Start IPC listener for cross-worker state sync
    startWorkerIPC().catch(err => {
      console.error('   [IPC] Failed to start worker IPC:', err);
    });
  }

  // Dynamic require — safe because tsconfig compiles to CommonJS
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { start, server, wss } = require('./server');

  async function gracefulShutdown(signal: string): Promise<void> {
    console.log(`\n   ⏳ ${signal} received. Shutting down gracefully...`);

    // Close WebSocket connections first
    wss.close();

    // Close HTTP server (stops accepting new connections)
    server.close(async () => {
      // Disconnect storage (flush pending writes to PostgreSQL/MongoDB)
      try {
        const storage = getStorageIfInitialized();
        if (storage) {
          await storage.disconnect();
        }
      } catch (err) {
        console.error('   ⚠ Storage disconnect error:', err);
      }
      process.exit(0);
    });

    // Force exit after 5s if graceful shutdown hangs
    setTimeout(() => process.exit(1), 5000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  if (!cluster.isWorker) {
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  start().catch((err: Error) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
