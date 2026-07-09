/**
 * Start a Redis-compatible server (Memurai on Windows) for load testing.
 * Keeps running until killed. Prints the port to stdout.
 *
 * Usage:
 *   node scripts/start-redis.mjs
 *   # In another terminal:
 *   REDIS_URL=redis://127.0.0.1:<port> npm start
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { RedisMemoryServer } = require('redis-memory-server');

async function main() {
  console.log('[Redis] Starting Redis-memory-server...');
  const server = new RedisMemoryServer({
    instance: {
      port: 16379,
    },
  });

  const host = '127.0.0.1';
  const port = await server.getPort();

  console.log(`[Redis] Server running on redis://${host}:${port}`);
  console.log(`[Redis] Use REDIS_URL=redis://${host}:${port} for the backend`);
  console.log('[Redis] Press Ctrl+C to stop\n');

  // Keep running until SIGINT
  process.on('SIGINT', async () => {
    console.log('\n[Redis] Shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Redis] Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(e => {
  console.error('[Redis] Failed to start:', e);
  process.exit(1);
});
