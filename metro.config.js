// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ---------------------------------------------------------------------------
// Sentry bundle slimming: @sentry/browser statically re-exports session-replay
// and feedback-widget code from @sentry-internal/{replay,replay-canvas,feedback}
// (~270KB of DOM-only code) that nothing in the app uses. Metro resolves
// browser packages unconditionally, so we stub them out for NATIVE builds only
// (web still gets the real packages).
// See metro/sentry-browser-stub.js for the stub implementation.
// ---------------------------------------------------------------------------
const originalResolveRequest = config.resolver.resolveRequest;

const SENTRY_BROWSER_ONLY = new Set([
  '@sentry-internal/replay',
  '@sentry-internal/replay-canvas',
  '@sentry-internal/feedback',
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web' && SENTRY_BROWSER_ONLY.has(moduleName)) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'metro/sentry-browser-stub.js'),
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
