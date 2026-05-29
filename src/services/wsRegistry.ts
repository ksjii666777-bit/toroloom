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
import { mockWebSocket } from './mockWebSocketService';

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

// Lazy-loaded instance so we don't pull in the real WS dependency unless needed.
let _realInstance: WebSocketService | null = null;

function getRealInstance(): WebSocketService {
  if (!_realInstance) {
    // Dynamic import to avoid bundling the real WS logic when not in use.
    // (TypeScript compiles the module either way, but tree-shaking can drop it.)
    const { RealWebSocketService } = require('./realWebSocketService') as typeof import('./realWebSocketService');
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
  console.log(`[WSRegistry] Switched to ${mode} WebSocket service`);
  return getActiveWS();
}

/** Get the current mode without resolving the instance. */
export function getWSMode(): WSMode {
  return _mode;
}
