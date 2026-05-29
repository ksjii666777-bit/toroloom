/**
 * ============================================================================
 * Toroloom WebSocket Status Route — Connection Monitoring
 * ============================================================================
 *
 * Provides operational insight into active WebSocket connections.
 *
 * Endpoint:
 *   GET    /api/system/ws-status   — Per-user connection counts + symbols
 *
 * No authentication is required so that monitoring infrastructure
 * (Prometheus, Grafana, health dashboards) can poll it freely.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { clients, userConnectionCount, connectionAlertedUsers, MAX_CONNECTIONS_PER_USER } from '../websocket/state';

const router = Router();

/**
 * GET /api/system/ws-status
 *
 * Returns a snapshot of all active WebSocket connections, grouped by user.
 *
 * Response shape:
 * {
 *   totalConnections: number,
 *   authenticatedUsers: number,   *   users: Array<{
   *     userId: string,
   *     connections: number,
   *     subscribedSymbols: string[],
   *     alerted: boolean,
   *   }>,
   *   alertedUsers: number,
   *   maxConnectionsPerUser: number,
   *   timestamp: string,
   * }
   */
router.get('/ws-status', (_req: Request, res: Response) => {
  try {
    // Build per-user details from the clients map
    const userMap = new Map<string, { connections: number; subscribedSymbols: Set<string> }>();

    for (const [, client] of clients) {
      const entry = userMap.get(client.userId);
      if (entry) {
        entry.connections++;
        for (const sym of client.symbols) entry.subscribedSymbols.add(sym);
      } else {
        userMap.set(client.userId, {
          connections: 1,
          subscribedSymbols: new Set(client.symbols),
        });
      }
    }

    // Format response
    const users = Array.from(userMap.entries()).map(([userId, data]) => ({
      userId,
      connections: data.connections,
      subscribedSymbols: Array.from(data.subscribedSymbols).sort(),
      alerted: connectionAlertedUsers.has(userId),
    }));

    // Cross-reference with userConnectionCount for consistency
    const totalConnections = userConnectionCount.size > 0
      ? Array.from(userConnectionCount.values()).reduce((a, b) => a + b, 0)
      : clients.size;

    res.json({
      totalConnections,
      authenticatedUsers: users.length,
      alertedUsers: connectionAlertedUsers.size,
      maxConnectionsPerUser: MAX_CONNECTIONS_PER_USER,
      users,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch WebSocket status',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
