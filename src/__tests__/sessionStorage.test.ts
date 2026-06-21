/**
 * ============================================================================
 * Toroloom — Secure Session Storage Unit Tests
 * ============================================================================
 *
 * Tests for sessionStorage.ts covering:
 *   - parseSessionPayload (cookie extraction, token parsing, expiry)
 *   - storeBrokerSession / getBrokerSession / clearBrokerSession
 *   - hasValidSession (expiry, 24h default)
 *   - listStoredSessions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionPayload, BrokerSession } from '../types';

// ── Mock react-native-keychain ──────────────────────────────
const mockSetGenericPassword = vi.fn();
const mockGetGenericPassword = vi.fn();
const mockResetGenericPassword = vi.fn();

vi.mock('react-native-keychain', () => ({
  default: {
    setGenericPassword: (...args: any[]) => mockSetGenericPassword(...args),
    getGenericPassword: (...args: any[]) => mockGetGenericPassword(...args),
    resetGenericPassword: (...args: any[]) => mockResetGenericPassword(...args),
    ACCESS_CONTROL: { BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE: 'biometry' },
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when_unlocked' },
  },
  setGenericPassword: (...args: any[]) => mockSetGenericPassword(...args),
  getGenericPassword: (...args: any[]) => mockGetGenericPassword(...args),
  resetGenericPassword: (...args: any[]) => mockResetGenericPassword(...args),
  ACCESS_CONTROL: { BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE: 'biometry' },
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when_unlocked' },
}));

import {
  parseSessionPayload,
  storeBrokerSession,
  getBrokerSession,
  clearBrokerSession,
  hasValidSession,
  listStoredSessions,
} from '../services/gateway/sessionStorage';

// ─── Test Fixtures ─────────────────────────────────────────

const mockAngelPayload: SessionPayload = {
  brokerType: 'angel',
  cookies: 'enctoken=abc123; jwt=eyJhbGciOiJIUzI1NiJ9.dGVzdA; access_token=test_token; user_id=user_123; max-age=3600',
  localStorage: { enctoken: 'ls_token', clientId: 'A12345' },
  sessionStorage: {},
  capturedAt: '2026-06-20T10:00:00.000Z',
  url: 'https://smartapi.angelbroking.com/dashboard',
};

const mockZerodhaPayload: SessionPayload = {
  brokerType: 'zerodha',
  cookies: 'enctoken=zerodha_enc_main; public_token=pub_abc; KF=session_key;',
  localStorage: { user_id: 'ZD1234' },
  sessionStorage: { access_jwt: 'jwt_active' },
  capturedAt: '2026-06-20T10:00:00.000Z',
  url: 'https://kite.zerodha.com/',
};

const mockZerodhaSession: BrokerSession = {
  brokerType: 'zerodha',
  enctoken: 'zerodha_enc_main',
  jwt: 'jwt_active',
  accessToken: undefined,
  publicToken: 'pub_abc',
  refreshToken: undefined,
  userId: 'ZD1234',
  cookies: 'enctoken=zerodha_enc_main; public_token=pub_abc; KF=session_key;',
  capturedAt: '2026-06-20T10:00:00.000Z',
  expiryAt: undefined,
};

// ====================================================================
// parseSessionPayload
// ====================================================================

describe('parseSessionPayload', () => {
  it('extracts enctoken from cookie string', () => {
    const session = parseSessionPayload(mockAngelPayload);
    expect(session.enctoken).toBe('abc123');
  });

  it('extracts JWT from cookie (fallback to localStorage/sessionStorage)', () => {
    const session = parseSessionPayload(mockAngelPayload);
    expect(session.jwt).toBe('eyJhbGciOiJIUzI1NiJ9.dGVzdA');
  });

  it('extracts JWT from sessionStorage when not in cookies', () => {
    const session = parseSessionPayload(mockZerodhaPayload);
    expect(session.jwt).toBe('jwt_active');
  });

  it('extracts accessToken from cookie', () => {
    const session = parseSessionPayload(mockAngelPayload);
    expect(session.accessToken).toBe('test_token');
  });

  it('extracts publicToken from cookie', () => {
    const session = parseSessionPayload(mockZerodhaPayload);
    expect(session.publicToken).toBe('pub_abc');
  });

  it('extracts userId from cookies with fallback to storage', () => {
    const session = parseSessionPayload(mockZerodhaPayload);
    expect(session.userId).toBe('ZD1234');
  });

  it('sets brokerType from payload', () => {
    const session = parseSessionPayload(mockAngelPayload);
    expect(session.brokerType).toBe('angel');
  });

  it('sets capturedAt from payload', () => {
    const session = parseSessionPayload(mockAngelPayload);
    expect(session.capturedAt).toBe('2026-06-20T10:00:00.000Z');
  });

  it('returns undefined for missing tokens as undefined', () => {
    const emptyPayload: SessionPayload = {
      brokerType: 'unknown',
      cookies: '',
      localStorage: {},
      sessionStorage: {},
      capturedAt: '2026-06-20T10:00:00.000Z',
      url: 'https://example.com',
    };
    const session = parseSessionPayload(emptyPayload);
    expect(session.enctoken).toBeUndefined();
    expect(session.jwt).toBeUndefined();
    expect(session.accessToken).toBeUndefined();
    expect(session.publicToken).toBeUndefined();
    expect(session.refreshToken).toBeUndefined();
    expect(session.userId).toBeUndefined();
  });

  it('estimates expiry from max-age cookie attribute', () => {
    const session = parseSessionPayload(mockAngelPayload);
    expect(session.expiryAt).toBeDefined();
    const expiryMs = new Date(session.expiryAt!).getTime();
    const now = Date.now();
    // max-age=3600 = 1 hour from now
    expect(expiryMs - now).toBeGreaterThan(3500 * 1000); // ~3599s
    expect(expiryMs - now).toBeLessThan(3601 * 1000);
  });

  it('returns undefined expiry when no max-age or expires', () => {
    const session = parseSessionPayload(mockZerodhaPayload);
    expect(session.expiryAt).toBeUndefined();
  });
});

// ====================================================================
// storeBrokerSession
// ====================================================================

describe('storeBrokerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores a session in the keychain and returns true', async () => {
    mockSetGenericPassword.mockResolvedValue({ service: 'test', storage: 'test' });

    const result = await storeBrokerSession('zerodha', mockZerodhaSession);

    expect(result).toBe(true);
    expect(mockSetGenericPassword).toHaveBeenCalledTimes(1);
    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'broker_session_zerodha',
      JSON.stringify(mockZerodhaSession),
      expect.objectContaining({
        service: 'toroloom_secure_auth_vault',
        accessControl: 'biometry',
      }),
    );
  });

  it('returns false when keychain throws', async () => {
    mockSetGenericPassword.mockRejectedValue(new Error('Keychain locked'));

    const result = await storeBrokerSession('zerodha', mockZerodhaSession);
    expect(result).toBe(false);
  });
});

// ====================================================================
// getBrokerSession
// ====================================================================

describe('getBrokerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves a stored session from the keychain', async () => {
    mockGetGenericPassword.mockResolvedValue({
      username: 'broker_session_zerodha',
      password: JSON.stringify(mockZerodhaSession),
    });

    const session = await getBrokerSession('zerodha');

    expect(session).toEqual(mockZerodhaSession);
    expect(mockGetGenericPassword).toHaveBeenCalledWith({
      service: 'toroloom_secure_auth_vault',
    });
  });

  it('returns null when username does not match', async () => {
    mockGetGenericPassword.mockResolvedValue({
      username: 'wrong_key',
      password: '{}',
    });

    const session = await getBrokerSession('zerodha');
    expect(session).toBeNull();
  });

  it('returns null when no credentials found', async () => {
    mockGetGenericPassword.mockResolvedValue(false);

    const session = await getBrokerSession('zerodha');
    expect(session).toBeNull();
  });

  it('returns null when keychain throws', async () => {
    mockGetGenericPassword.mockRejectedValue(new Error('Biometry failed'));

    const session = await getBrokerSession('zerodha');
    expect(session).toBeNull();
  });
});

// ====================================================================
// clearBrokerSession
// ====================================================================

describe('clearBrokerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears a stored session and returns true', async () => {
    mockResetGenericPassword.mockResolvedValue(true);

    const result = await clearBrokerSession('zerodha');
    expect(result).toBe(true);
    expect(mockResetGenericPassword).toHaveBeenCalledWith({
      service: 'toroloom_secure_auth_vault',
    });
  });

  it('returns false when reset fails', async () => {
    mockResetGenericPassword.mockRejectedValue(new Error('Reset failed'));

    const result = await clearBrokerSession('zerodha');
    expect(result).toBe(false);
  });
});

// ====================================================================
// hasValidSession
// ====================================================================

describe('hasValidSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when no session exists', async () => {
    mockGetGenericPassword.mockResolvedValue(false);

    const valid = await hasValidSession('zerodha');
    expect(valid).toBe(false);
  });

  it('returns true when session has future expiry', async () => {
    const futureSession = {
      ...mockZerodhaSession,
      expiryAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    };
    mockGetGenericPassword.mockResolvedValue({
      username: 'broker_session_zerodha',
      password: JSON.stringify(futureSession),
    });

    const valid = await hasValidSession('zerodha');
    expect(valid).toBe(true);
  });

  it('returns false when session has past expiry', async () => {
    const expiredSession = {
      ...mockZerodhaSession,
      expiryAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };
    mockGetGenericPassword.mockResolvedValue({
      username: 'broker_session_zerodha',
      password: JSON.stringify(expiredSession),
    });

    const valid = await hasValidSession('zerodha');
    expect(valid).toBe(false);
  });

  it('returns true for session within 24h when no expiry set', async () => {
    const recentSession = {
      ...mockZerodhaSession,
      expiryAt: undefined,
      capturedAt: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
    };
    mockGetGenericPassword.mockResolvedValue({
      username: 'broker_session_zerodha',
      password: JSON.stringify(recentSession),
    });

    const valid = await hasValidSession('zerodha');
    expect(valid).toBe(true);
  });

  it('returns false for session older than 24h when no expiry set', async () => {
    const oldSession = {
      ...mockZerodhaSession,
      expiryAt: undefined,
      capturedAt: new Date(Date.now() - 25 * 3600000).toISOString(), // 25 hours ago
    };
    mockGetGenericPassword.mockResolvedValue({
      username: 'broker_session_zerodha',
      password: JSON.stringify(oldSession),
    });

    const valid = await hasValidSession('zerodha');
    expect(valid).toBe(false);
  });
});

// ====================================================================
// listStoredSessions
// ====================================================================

describe('listStoredSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns list of brokers with stored sessions', async () => {
    // Only zerodha has a session
    mockGetGenericPassword
      .mockResolvedValueOnce(null) // angel (no session)
      .mockResolvedValueOnce({
        username: 'broker_session_zerodha',
        password: JSON.stringify(mockZerodhaSession),
      }) // zerodha (has session)
      .mockResolvedValueOnce(null); // groww (no session)

    const brokers = await listStoredSessions();
    expect(brokers).toEqual(['zerodha']);
  });

  it('returns empty array when no sessions exist', async () => {
    mockGetGenericPassword.mockResolvedValue(null);

    const brokers = await listStoredSessions();
    expect(brokers).toEqual([]);
  });
});
