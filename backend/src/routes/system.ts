/**
 * ============================================================================
 * Toroloom System Routes — Monitoring & Observability Endpoints
 * ============================================================================
 *
 * Provides operational insight into the health of downstream dependencies
 * through circuit breaker state inspection.
 *
 * Endpoints:
 *   GET    /api/system/circuit-breakers   — Snapshots of all registered circuit breakers
 *   GET    /api/system/circuit-breakers/:name  — Snapshot of a single circuit breaker
 *
 * These are read-only observability endpoints. No authentication is required
 * so that monitoring infrastructure (Prometheus, Grafana, health dashboards)
 * can poll them freely.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { circuitRegistry } from '../services/circuitBreaker';

const router = Router();

/**
 * GET /api/system/circuit-breakers
 *
 * Returns snapshots of ALL registered circuit breakers in the system.
 * Each snapshot includes the current state (CLOSED / OPEN / HALF_OPEN),
 * failure/success counts, timestamps, and configuration.
 *
 * Response shape:
 * {
 *   circuitBreakers: {
 *     [name: string]: {
 *       name, state, isOpen,
 *       failureCount, successCount,
 *       totalCalls, totalFailures, totalSuccesses,
 *       lastFailureTime, lastSuccessTime, nextAttemptTime,
 *       config: { failureThreshold, successThreshold, timeoutMs, retryCount }
 *     }
 *   },
 *   summary: { total, open, halfOpen, closed, totalFailuresAcrossAll },
 *   timestamp
 * }
 */
router.get('/circuit-breakers', (_req: Request, res: Response) => {
  try {
    const all = circuitRegistry.getAll();
    const circuitBreakers: Record<string, Record<string, unknown>> = {};
    let openCount = 0;
    let halfOpenCount = 0;
    let closedCount = 0;
    let totalFailuresAcrossAll = 0;

    for (const [name, cb] of all) {
      const snap = cb.snapshot();
      const config = cb.getConfig();

      circuitBreakers[name] = {
        name: snap.name,
        state: snap.state,
        isOpen: snap.isOpen,
        failureCount: snap.failureCount,
        successCount: snap.successCount,
        totalCalls: snap.totalCalls,
        totalFailures: snap.totalFailures,
        totalSuccesses: snap.totalSuccesses,
        lastFailureTime: snap.lastFailureTime
          ? new Date(snap.lastFailureTime).toISOString()
          : null,
        lastSuccessTime: snap.lastSuccessTime
          ? new Date(snap.lastSuccessTime).toISOString()
          : null,
        nextAttemptTime: snap.nextAttemptTime
          ? new Date(snap.nextAttemptTime).toISOString()
          : null,
        config: {
          failureThreshold: config.failureThreshold,
          successThreshold: config.successThreshold,
          timeoutMs: config.timeoutMs,
          retryCount: config.retryCount,
        },
      };

      if (snap.state === 'OPEN') openCount++;
      else if (snap.state === 'HALF_OPEN') halfOpenCount++;
      else closedCount++;

      totalFailuresAcrossAll += snap.totalFailures;
    }

    res.json({
      circuitBreakers,
      summary: {
        total: all.size,
        open: openCount,
        halfOpen: halfOpenCount,
        closed: closedCount,
        totalFailuresAcrossAll,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    res.status(500).json({
      error: 'Failed to fetch circuit breaker states',
    });
  }
});

/**
 * GET /api/system/circuit-breakers/:name
 *
 * Returns the snapshot of a SINGLE named circuit breaker.
 * Returns 404 if the circuit breaker name has not been registered yet.
 */
router.get('/circuit-breakers/:name', (req: Request, res: Response) => {
  try {
    const name = req.params.name as string;
    const all = circuitRegistry.getAll();
    const cb = all.get(name);

    if (!cb) {
      res.status(404).json({
        error: 'Circuit breaker not found',
        name,
        hint: 'Circuit breakers are lazily created on first use. Try performing an action that creates one first.',
      });
      return;
    }

    const snap = cb.snapshot();
    const config = cb.getConfig();

    res.json({
      circuitBreaker: {
        name: snap.name,
        state: snap.state,
        isOpen: snap.isOpen,
        failureCount: snap.failureCount,
        successCount: snap.successCount,
        totalCalls: snap.totalCalls,
        totalFailures: snap.totalFailures,
        totalSuccesses: snap.totalSuccesses,
        lastFailureTime: snap.lastFailureTime
          ? new Date(snap.lastFailureTime).toISOString()
          : null,
        lastSuccessTime: snap.lastSuccessTime
          ? new Date(snap.lastSuccessTime).toISOString()
          : null,
        nextAttemptTime: snap.nextAttemptTime
          ? new Date(snap.nextAttemptTime).toISOString()
          : null,
        config: {
          failureThreshold: config.failureThreshold,
          successThreshold: config.successThreshold,
          timeoutMs: config.timeoutMs,
          retryCount: config.retryCount,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    res.status(500).json({
      error: 'Failed to fetch circuit breaker state',
    });
  }
});

export default router;
