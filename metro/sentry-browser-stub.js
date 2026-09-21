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
 *
 * ⚠️ HISTORY LESSON (do not regress): @sentry/browser's feedbackAsync.js and
 * feedbackSync.js CALL `buildFeedbackIntegration(...)` at MODULE INIT (top
 * level). An earlier version of this stub did not export it →
 * "TypeError: undefined is not a function" at runtime init → the release
 * build died before first paint (E2E: "Login screen never appeared" on every
 * CI run since the stub landed — deterministic, not flaky).
 *
 * Rules for exports in this file:
 *   - Anything @sentry/browser CALLS at module init must return an inert
 *     value here, never throw.
 *   - Anything only re-exported/referenced may throw on CALL (clear error if
 *     someone ever enables replay/feedback on native).
 *
 * `src/__tests__/sentryBrowserStub.test.ts` guards this: it scans
 * @sentry/browser for imports of the stubbed packages and fails if any
 * imported name is missing here (catches SDK version bumps).
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

// ── @sentry-internal/feedback surface ──────────────────────────────────────

/**
 * CALLED AT MODULE INIT by @sentry/browser's feedbackAsync.js and
 * feedbackSync.js. Must return an inert integration — throwing here (or
 * being undefined) kills the runtime before first paint.
 */
export function buildFeedbackIntegration() {
  return { name: 'FeedbackIntegration', setup: () => {} };
}

/** Referenced inside feedbackSync closures; only used if feedback is enabled. */
export function feedbackModalIntegration() {
  throw new Error(
    '[Sentry] feedbackModalIntegration is browser-only and is stubbed out in this React Native build.',
  );
}

/** Referenced inside feedbackSync closures; only used if feedback is enabled. */
export function feedbackScreenshotIntegration() {
  throw new Error(
    '[Sentry] feedbackScreenshotIntegration is browser-only and is stubbed out in this React Native build.',
  );
}
