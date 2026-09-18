/**
 * ============================================================================
 * Metro resolver stub — Sentry browser-only packages (React Native)
 * ============================================================================
 *
 * `@sentry/browser` unconditionally re-exports session-replay and feedback
 * widget code from `@sentry-internal/replay`, `@sentry-internal/replay-canvas`
 * and `@sentry-internal/feedback`. Because Metro bundles barrel re-exports
 * whole, ~270KB of browser-only (DOM) code ends up in the native bundle even
 * though nothing in the app uses it.
 *
 * metro.config.js redirects those three packages here on native platforms.
 * The exports below keep `@sentry/browser` module evaluation working (they
 * are only re-exported, never called) and throw a clear error if anyone
 * ever tries to enable replay/feedback on native.
 * ============================================================================
 */

export function replayIntegration() {
  throw new Error(
    '[Sentry] replayIntegration is browser-only and is stubbed out in this React Native build.',
  );
}

export function getReplay() {
  return undefined;
}

export function replayCanvasIntegration() {
  throw new Error(
    '[Sentry] replayCanvasIntegration is browser-only and is stubbed out in this React Native build.',
  );
}

export function getFeedback() {
  return undefined;
}

export function sendFeedback() {
  throw new Error(
    '[Sentry] sendFeedback is browser-only and is stubbed out in this React Native build.',
  );
}
