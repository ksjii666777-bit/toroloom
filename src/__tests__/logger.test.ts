/**
 * ============================================================================
 * Toroloom — Logger Utility Unit Tests
 * ============================================================================
 *
 * Covers:
 *   - All four log levels (error, warn, info, debug)
 *   - [`Toroloom`] prefix prepended to every call
 *   - Argument forwarding (single, multiple, Error objects)
 *   - Production gating (`__DEV__ = false` → `info`/`debug` suppressed)
 *   - Development default (`__DEV__` undefined → fallback to `true`)
 *
 * IMPORTANT: The logger uses `console.X.bind(console, '[Toroloom]')` under
 * the hood, which captures the console method REFERENCE at module-evaluation
 * time.  Therefore console spies MUST be installed BEFORE the dynamic import
 * so the bound functions capture the spy, not the original console.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Logger } from '../utils/logger';

// ──────────────────────────────────────────────
// Default / Development mode
// ──────────────────────────────────────────────

describe('logger (development mode — __DEV__ undefined, IS_DEV = true)', () => {
  let log: Logger;

  beforeAll(async () => {
    // Spy on console BEFORE importing so the .bind() references capture the spy
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    vi.resetModules();
    // In vitest's Node.js environment, __DEV__ is not defined,
    // so the fallback `IS_DEV = true` is used.
    const mod = await import('../utils/logger');
    log = mod.log;
  });

  // Reset call counts between tests without losing the spy implementation
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Level mapping ───────────────────────────

  it('log.error calls console.error with [Toroloom] prefix', () => {
    log.error('something went wrong');
    expect(console.error).toHaveBeenCalledWith('[Toroloom]', 'something went wrong');
  });

  it('log.warn calls console.warn with [Toroloom] prefix', () => {
    log.warn('caution');
    expect(console.warn).toHaveBeenCalledWith('[Toroloom]', 'caution');
  });

  it('log.info calls console.log with [Toroloom] prefix', () => {
    log.info('informational');
    expect(console.log).toHaveBeenCalledWith('[Toroloom]', 'informational');
  });

  it('log.debug calls console.debug with [Toroloom] prefix', () => {
    log.debug('verbose detail');
    expect(console.debug).toHaveBeenCalledWith('[Toroloom]', 'verbose detail');
  });

  // ── Argument forwarding ─────────────────────

  it('passes multiple arguments through', () => {
    const detail = { symbol: 'RELIANCE', price: 2850 };
    log.info('[Portfolio]', 'Updated:', detail, 42);
    expect(console.log).toHaveBeenCalledWith(
      '[Toroloom]',
      '[Portfolio]',
      'Updated:',
      detail,
      42,
    );
  });

  it('forwards Error objects to console.error', () => {
    const err = new Error('connection refused');
    log.error('[Auth] Login failed:', err);
    expect(console.error).toHaveBeenCalledWith(
      '[Toroloom]',
      '[Auth] Login failed:',
      err,
    );
  });

  it('still prepends [Toroloom] even when the first argument starts with bracket', () => {
    log.info('[RiskStore] Lockdown triggered');
    expect(console.log).toHaveBeenCalledWith('[Toroloom]', '[RiskStore] Lockdown triggered');
  });

  // ── Function existence ──────────────────────

  it('exposes all four log level functions', () => {
    expect(typeof log.error).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.debug).toBe('function');
  });

  it('does not call other console methods for a given level', () => {
    log.warn('only warn');
    expect(console.error).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
    // Also verify the correct method WAS called
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────
// Production mode
// ──────────────────────────────────────────────

describe('logger (production mode — __DEV__ = false)', () => {
  let prodLog: Logger;

  beforeAll(async () => {
    // Tell vitest to make __DEV__ globally available as `false`
    vi.stubGlobal('__DEV__', false);

    // Spy BEFORE importing so .bind() captures the spy
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    vi.resetModules();
    const mod = await import('../utils/logger');
    prodLog = mod.log;
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Severity levels always print ────────────

  it('log.error still prints in production', () => {
    prodLog.error('critical failure');
    expect(console.error).toHaveBeenCalledWith('[Toroloom]', 'critical failure');
  });

  it('log.warn still prints in production', () => {
    prodLog.warn('important warning');
    expect(console.warn).toHaveBeenCalledWith('[Toroloom]', 'important warning');
  });

  // ── Info/debug suppressed ───────────────────

  it('log.info is suppressed in production', () => {
    prodLog.info('should not appear');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('log.debug is suppressed in production', () => {
    prodLog.debug('should not appear');
    expect(console.debug).not.toHaveBeenCalled();
  });

  // ── Cross-contamination check ───────────────

  it('suppressed info does not accidentally call other levels', () => {
    prodLog.info('anything');
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
  });
});
