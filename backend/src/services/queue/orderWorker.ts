/**
 * ============================================================================
 * Toroloom — Order Processing Worker (BullMQ)
 * ============================================================================
 *
 * Worker that picks jobs from the "order-processing" queue and executes
 * them through the OrderExecutionPipeline.
 *
 * The worker is only started when Redis is available.  If the worker
 * crashes or is restarted, in-flight jobs are picked up by the next
 * available worker after the visibility timeout.
 *
 * ============================================================================
 */

import { Worker, Job } from 'bullmq';
import { env } from '../../config/env';
import { orderPipeline } from '../orderExecution';
import type { OrderJobData, OrderJobResult } from './types';
import { QUEUE_NAME } from './orderQueue';

/** Shared worker instance (lazy-initialized) */
let orderWorker: Worker<OrderJobData, OrderJobResult> | null = null;

/**
 * Start the order processing worker.
 * Call once during server startup (in server.ts initializeStorage).
 *
 * Does nothing if:
 *   - Redis is not configured (env.hasRedis === false)
 *   - Worker is already running
 */
export function startOrderWorker(): void {
  if (!env.hasRedis) {
    if (process.env.NODE_ENV !== 'test') {
      console.log('   [Queue] Redis unavailable — orders will execute synchronously');
    }
    return;
  }

  if (orderWorker) {
    return; // Already started
  }

  const connection = { url: env.redisUrl };

  orderWorker = new Worker<OrderJobData, OrderJobResult>(
    QUEUE_NAME,
    async (job: Job<OrderJobData>): Promise<OrderJobResult> => {
      const { correlationId, params } = job.data;
      const startedAt = Date.now();

      try {
        // Execute the order through the pipeline
        const result = await orderPipeline.execute(params);

        return {
          correlationId,
          success: result.success,
          result,
          completedAt: new Date().toISOString(),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Log but let BullMQ handle retries via the job options
        console.error(`[Queue] Order ${correlationId} failed (attempt ${job.attemptsMade + 1}): ${message}`);

        throw new Error(message);
      }
    },
    {
      connection,
      concurrency: 5,              // Process up to 5 orders concurrently
      autorun: true,               // Start processing immediately
      lockDuration: 60_000,        // 60s job lock (should be > max execution time)
      stalledInterval: 30_000,     // Check for stalled jobs every 30s
    },
  );

  orderWorker.on('completed', (job: Job, result: OrderJobResult) => {
    console.log(`[Queue] Order ${job.data.correlationId} completed (success: ${result.success})`);
  });

  orderWorker.on('failed', (job: Job | undefined, error: Error) => {
    const jobId = job?.data?.correlationId ?? 'unknown';
    console.error(`[Queue] Order ${jobId} permanently failed after ${job?.attemptsMade ?? 0} attempts: ${error.message}`);
  });

  if (process.env.NODE_ENV !== 'test') {
    console.log('   [Queue] Order processing worker started');
  }
}

/**
 * Gracefully close the worker.
 * Call during server shutdown to allow in-flight jobs to complete.
 */
export async function stopOrderWorker(): Promise<void> {
  if (orderWorker) {
    await orderWorker.close();
    orderWorker = null;
    if (process.env.NODE_ENV !== 'test') {
      console.log('   [Queue] Order processing worker stopped');
    }
  }
}
