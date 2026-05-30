/**
 * ============================================================================
 * Toroloom Logger — Lightweight Production-Safe Logging
 * ============================================================================
 *
 * Usage:
 *   import { log } from '../utils/logger';
 *   log.info('[RiskStore] Lockdown LIFTED via WebSocket');
 *   log.warn('[Portfolio] Risk engine blocked BUY:', result.message);
 *   log.error('[Auth] Login failed:', err);
 *   log.debug('[Component] Rendered with props:', props);
 *
 * In production builds (`__DEV__ === false`), only `warn` and `error` levels
 * are printed.  `info` and `debug` are suppressed to reduce noise.
 *
 * Each call automatically prefixes `[Toroloom]`.  Callers should provide
 * their own module prefix, e.g. `[RiskStore]`.
 *
 * Level hierarchy (most to least severe):
 *   error  → always printed
 *   warn   → always printed
 *   info   → suppressed in production
 *   debug  → suppressed in production
 */

/**
 * `__DEV__` is a global boolean provided by Expo / React Native that is
 * `true` in development builds and `false` in production builds.  We fall
 * back to `true` for test runners and other environments where `__DEV__`
 * may not be defined.
 */
declare const __DEV__: boolean | undefined;
const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

type LogFn = (message?: unknown, ...optionalParams: unknown[]) => void;

export interface Logger {
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
}

function noop(): void {
  /* no-op in production */
}

export const log: Logger = {
  error: console.error.bind(console, '[Toroloom]'),
  warn: console.warn.bind(console, '[Toroloom]'),
  info: IS_DEV ? console.log.bind(console, '[Toroloom]') : noop,
  debug: IS_DEV ? console.debug.bind(console, '[Toroloom]') : noop,
};
