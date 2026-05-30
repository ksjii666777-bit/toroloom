/**
 * WebSocket Service Registry
 *
 * Provides a single `getActiveWS()` resolver so stores and hooks can
 * consume whichever WebSocket implementation is currently configured
 * without importing a concrete class directly.
 *
 * Usage:
 *   import { getActiveWS } from '../services/wsRegistry';
 *   getActiveWS().connect();
 */

import type { WebSocketService } from './wsService';
import { log } from '../utils/logger';
import { mockWebSocket } from './mockWebSocketService';
import { RealWebSocketService } from './realWebSocketService';

// ── Active Service ───────────────────────────────────────────────────────────

type WSMode = 'mock' | 'real';

/**
 * The currently active WebSocket mode.
 * - 'mock' → in-process price simulation (no backend needed)
 * - 'real' → connects to the backend /ws endpoint
 *
 * The host app can switch this at any time (e.g. based on backend availability).
 */
let _mode: WSMode = 'mock';

// Lazy-loaded instance so RealWebSocketService constructor isn't called on import.
let _realInstance: WebSocketService | null = null;

function getRealInstance(): WebSocketService {
  if (!_realInstance) {
    _realInstance = new RealWebSocketService();
  }
  return _realInstance;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get the currently active WebSocket service instance. */
export function getActiveWS(): WebSocketService {
  if (_mode === 'real') {
    return getRealInstance();
  }
  return mockWebSocket;
}

/** Switch the active service.  Returns the instance for chaining. */
export function setWSMode(mode: WSMode): WebSocketService {
  _mode = mode;
  log.info(`[WSRegistry] Switched to ${mode} WebSocket service`);
  return getActiveWS();
}

/** Get the current mode without resolving the instance. */
export function getWSMode(): WSMode {
  return _mode;
}
