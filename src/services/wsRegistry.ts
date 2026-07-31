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
import { getBaseUrl } from './api/client';

// ── Active Service ───────────────────────────────────────────────────────────

type WSMode = 'mock' | 'real';

/**
 * The currently active WebSocket mode.
 * - 'mock' → in-process price simulation (no backend needed)
 * - 'real' → connects to the backend /ws endpoint
 *
 * 'real' is the default — the app is deployed with a live backend.  If no
 * API base URL is configured (local dev / offline), getActiveWS() falls back
 * to the in-process mock so screens still show data.
 */
let _mode: WSMode = 'real';

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
    // Real mode needs a configured backend URL.  Without one (local dev or
    // an unset EXPO_PUBLIC_API_URL), fall back to the in-process mock so
    // hooks still receive price data instead of failing to connect.
    if (!getBaseUrl()) {
      log.warn('[WSRegistry] Real mode selected but no API base URL configured — using mock WebSocket');
      return mockWebSocket;
    }
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
