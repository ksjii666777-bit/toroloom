/**
 * Backward-compatible re-exports — existing callers import `setupWebSocket`
 * from this path.  Contents have been split into:
 *   - ./state       Types, module-level state, pure helpers
 *   - ./handlers    Message routing (auth, subscribe, unsubscribe, ping)
 *   - ./index       Server setup (setupWebSocket)
 *
 * Import from `./index` directly for new code.
 */

export { setupWebSocket } from './index';
