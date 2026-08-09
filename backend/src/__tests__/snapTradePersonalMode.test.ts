/**
 * ============================================================================
 * Toroloom — SnapTrade Personal Mode Tests
 * ============================================================================
 *
 * Verifies the dual-auth-mode support added for personal SnapTrade API keys:
 *
 *   - env.snapTradeMode auto-detects 'personal' from the `PERS-` client ID
 *     prefix (and respects an explicit SNAPTRADE_MODE override)
 *   - In personal mode, registerUser() is a NO-OP (SnapTrade auto-provisions
 *     the user at signup — registerUser is unavailable for personal keys,
 *     SnapTrade error code 1012)
 *   - deleteUser() short-circuits in personal mode (also unavailable)
 *   - The SDK client is constructed with the matching auth mode
 *
 * Uses the REAL env module (process.env + fresh dynamic imports per test)
 * so the auto-detection logic itself is exercised.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/snapTradePersonalMode.test.ts
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ──── Mock the SDK so we can assert constructor args + calls ───────────────

const sdkState = vi.hoisted(() => ({
  ctorArg: null as any,
  calls: [] as string[],
}));

vi.mock('snaptrade-typescript-sdk', () => ({
  Snaptrade: class {
    constructor(arg: any) {
      sdkState.ctorArg = arg;
    }
    get authentication() {
      return {
        registerSnapTradeUser: async (p: any) => {
          sdkState.calls.push(`register(${p.userId})`);
          return { data: { userId: p.userId, userSecret: 'real-secret' } };
        },
        deleteSnapTradeUser: async (p: any) => {
          sdkState.calls.push(`delete(${p.userId})`);
          return { data: {} };
        },
      };
    }
  },
  SnaptradeAuth: {
    personalApiKey: (p: any) => ({ mode: 'personalApiKey', ...p }),
    commercialApiKey: (p: any) => ({ mode: 'commercialApiKey', ...p }),
  },
}));

describe('SnapTrade personal mode', () => {
  beforeEach(() => {
    process.env.SNAPTRADE_CLIENT_ID = 'PERS-AUZ-PERSONAL-TEST-12345';
    process.env.SNAPTRADE_CONSUMER_KEY = 'test-consumer-key';
    delete process.env.SNAPTRADE_MODE;
    sdkState.ctorArg = null;
    sdkState.calls = [];
  });

  afterEach(() => {
    vi.resetModules();
    delete process.env.SNAPTRADE_CLIENT_ID;
    delete process.env.SNAPTRADE_CONSUMER_KEY;
    delete process.env.SNAPTRADE_MODE;
  });

  it('auto-detects personal mode from a PERS- client ID prefix', async () => {
    const { env } = await import('../config/env');
    expect(env.snapTradeMode).toBe('personal');
    const { snapTradeService } = await import('../services/snapTradeService');
    expect(snapTradeService.isPersonalMode()).toBe(true);
  });

  it('treats a non-PERS client ID as commercial mode', async () => {
    process.env.SNAPTRADE_CLIENT_ID = 'PARTNER-12345-COMMERCIAL';
    const { env } = await import('../config/env');
    expect(env.snapTradeMode).toBe('commercial');
    const { snapTradeService } = await import('../services/snapTradeService');
    expect(snapTradeService.isPersonalMode()).toBe(false);
  });

  it('also auto-detects personal mode from a PERS_ client ID (underscore format)', async () => {
    process.env.SNAPTRADE_CLIENT_ID = 'PERS_AUZ_UNDERSCORE_FORMAT';
    const { env } = await import('../config/env');
    expect(env.snapTradeMode).toBe('personal');
  });

  it('respects an explicit SNAPTRADE_MODE=commercial override', async () => {
    process.env.SNAPTRADE_MODE = 'commercial';
    const { env } = await import('../config/env');
    expect(env.snapTradeMode).toBe('commercial');
    const { snapTradeService } = await import('../services/snapTradeService');
    expect(snapTradeService.isPersonalMode()).toBe(false);
  });

  it('registerUser is a no-op in personal mode (no SDK call, sentinel secret)', async () => {
    const { snapTradeService } = await import('../services/snapTradeService');
    const result = await snapTradeService.registerUser('toroloom_user_1');
    expect(result.userSecret).toBe('personal-auto-provisioned');
    expect(sdkState.calls).toEqual([]);
  });

  it('registerUser calls the SDK in commercial mode', async () => {
    process.env.SNAPTRADE_MODE = 'commercial';
    const { snapTradeService } = await import('../services/snapTradeService');
    const result = await snapTradeService.registerUser('toroloom_user_1');
    expect(result.userSecret).toBe('real-secret');
    expect(sdkState.calls).toEqual(['register(toroloom_user_1)']);
  });

  it('deleteUser short-circuits in personal mode', async () => {
    const { snapTradeService } = await import('../services/snapTradeService');
    await snapTradeService.deleteUser('toroloom_user_1');
    expect(sdkState.calls).toEqual([]);
  });

  it('deleteUser calls the SDK in commercial mode', async () => {
    process.env.SNAPTRADE_MODE = 'commercial';
    const { snapTradeService } = await import('../services/snapTradeService');
    await snapTradeService.deleteUser('toroloom_user_1');
    expect(sdkState.calls).toEqual(['delete(toroloom_user_1)']);
  });

  it('builds a personalApiKey auth client in personal mode', async () => {
    // Trigger lazy client construction via a commercial-path call, then
    // verify a fresh personal-mode instance uses personalApiKey auth.
    process.env.SNAPTRADE_MODE = 'commercial';
    const commercial = await import('../services/snapTradeService');
    await commercial.snapTradeService.registerUser('x');
    expect(sdkState.ctorArg.auth.mode).toBe('commercialApiKey');

    // Fresh import (resetModules) → personal mode → personalApiKey auth
    process.env.SNAPTRADE_MODE = 'personal';
    vi.resetModules();
    const personal = await import('../services/snapTradeService');
    // Constructing the personal client requires a real call that uses it;
    // isConfigured() + isPersonalMode() don't. Use a connection call.
    await personal.snapTradeService.getAuthorizations('u', 's').catch(() => {});
    expect(sdkState.ctorArg.auth.mode).toBe('personalApiKey');
  });
});
