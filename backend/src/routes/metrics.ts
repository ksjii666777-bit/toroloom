/**
 * ============================================================================
 * Toroloom Prometheus Metrics Endpoint
 * ============================================================================
 *
 * Exposes a GET /metrics endpoint in the standard Prometheus text format
 * so monitoring infrastructure (Prometheus, Grafana Agent, VictoriaMetrics)
 * can scrape connection-level metrics at a regular interval.
 *
 * The metrics themselves are maintained by the `updateMetrics()` function
 * in services/metrics.ts, which is called whenever WebSocket state changes
 * (auth, disconnect).  This route simply reads the registry and flushes it.
 *
 * Endpoint:
 *   GET    /metrics   — Prometheus text/plain; charset=utf-8
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { getMetricsRegistry } from '../services/metrics';

const router = Router();

/**
 * GET /metrics
 *
 * Returns all registered Prometheus metrics as text/plain in the
 * OpenMetrics exposition format, suitable for scraping.
 *
 * Example response (truncated):
 *   # HELP toroloom_ws_total_connections Total number ...
 *   # TYPE toroloom_ws_total_connections gauge
 *   toroloom_ws_total_connections 12
 *   toroloom_ws_user_connections{user_id="user-abc"} 3
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', getMetricsRegistry().contentType);
    const metrics = await getMetricsRegistry().metrics();
    res.end(metrics);
  } catch (error: unknown) {
    res.status(500).setHeader('Content-Type', 'text/plain');
    res.end(`# Error collecting metrics: ${(error as Error).message}\n`);
  }
});

export default router;
