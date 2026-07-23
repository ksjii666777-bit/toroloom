/**
 * ============================================================================
 * Toroloom — Order Processing Queue (BullMQ)
 * ============================================================================
 *
 * BullMQ queue for asynchronous order execution.
 * Uses Redis for persistence and cross-worker coordination.
 *
 * Queue name: "order-processing"
 *
 * This queue is only available when Redis is configured (env.hasRedis).
 * When Redis is not available, orders are executed synchronously via the
 * existing OrderExecutionPipeline (graceful fallback).
 *
 * ============================================================================
 */

import { Queue } from 'bullmq';
import { env } from '../../config/env';
import type { OrderJobData, OrderJobResult } from './types';

const QUEUE_NAME = 'order-processing';

/** Shared queue instance (lazy-initialized) */
let orderQueue: Queue<OrderJobData, OrderJobResult> | null = null;

/**
 * Get or create the order processing queue.
 * Returns null if Redis is not configured (caller must fall back to sync).
 */
export function getOrderQueue(): Queue<OrderJobData, OrderJobResult> | null {
  if (!env.hasRedis) {
    return null;
  }

  if (!orderQueue) {
    const connection = { url: env.redisUrl };
    orderQueue = new Queue<OrderJobData, OrderJobResult>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,               // Retry up to 3 times on failure
        backoff: {
          type: 'exponential',
          delay: 2000,             // 2s, 4s, 8s backoff
        },
        removeOnComplete: {
          age: 3600,               // Keep completed jobs for 1 hour
          count: 100,              // Keep last 100 completed
        },
        removeOnFail: {
          age: 86400,              // Keep failed jobs for 24 hours
        },
      },
    });
  }

  return orderQueue;
}

/**
 * Gracefully close the queue connection.
 * Call during server shutdown.
 */
export async function closeOrderQueue(): Promise<void> {
  if (orderQueue) {
    await orderQueue.close();
    orderQueue = null;
  }
}

export { QUEUE_NAME };
