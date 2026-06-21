/**
 * ============================================================================
 * Toroloom — Secure Session Storage (Keychain Pipeline)
 * ============================================================================
 *
 * Hardware-backed encrypted storage for broker session credentials using
 * react-native-keychain. Stores extracted cookies, access tokens, and
 * session artifacts inside iOS Keychain / Android Keystore under the
 * designated service identifier 'toroloom_secure_auth_vault'.
 *
 * Usage:
 *   import { storeBrokerSession, getBrokerSession, clearBrokerSession } from
 *     '../../services/gateway/sessionStorage';
 *
 *   await storeBrokerSession('zerodha', { enctoken: '...', cookies: '...' });
 *   const session = await getBrokerSession('zerodha');
 *   await clearBrokerSession('zerodha');
 *
 * ============================================================================
 */

import * as Keychain from 'react-native-keychain';
import type { BrokerSession, SessionPayload } from '../../types';

// ─── Constants ─────────────────────────────────────────────────────────────

const KEYCHAIN_SERVICE = 'toroloom_secure_auth_vault';

/**
 * Prefix for broker-specific storage keys within the keychain record.
 * Each broker gets its own key so sessions don't collide.
 */
function storageKey(brokerType: string): string {
  return `broker_session_${brokerType.toLowerCase()}`;
}

// ─── Extract structured BrokerSession from a raw SessionPayload ──────────

/**
 * Parse a raw SessionPayload (from SecureSessionSync WebView extraction)
 * and build a structured BrokerSession object by scanning cookie chains
 * and storage keys for known high-value tokens.
 */
export function parseSessionPayload(
  payload: SessionPayload,
): BrokerSession {
  const cookies = payload.cookies;
  const ls = payload.localStorage;
  const ss = payload.sessionStorage;
  const allStorage = { ...ls, ...ss };

  // Token extraction via targeted key matching
  const enctoken =
    extractCookie(cookies, 'enctoken') ||
    allStorage['enctoken'] ||
    undefined;

  const jwt =
    extractCookie(cookies, 'jwt') ||
    extractCookie(cookies, 'JWT') ||
    allStorage['jwt'] ||
    allStorage['access_jwt'] ||
    undefined;

  const accessToken =
    extractCookie(cookies, 'access_token') ||
    extractCookie(cookies, 'public_token') ||
    allStorage['access_token'] ||
    allStorage['public_token'] ||
    undefined;

  const publicToken =
    extractCookie(cookies, 'public_token') ||
    allStorage['public_token'] ||
    undefined;

  const refreshToken =
    extractCookie(cookies, 'refresh_token') ||
    allStorage['refresh_token'] ||
    undefined;

  const userId =
    extractCookie(cookies, 'user_id') ||
    extractCookie(cookies, 'client_id') ||
    extractCookie(cookies, 'userId') ||
    allStorage['user_id'] ||
    allStorage['clientId'] ||
    allStorage['client_id'] ||
    undefined;

  // Estimate expiry from common cookie expiry patterns
  const expiryAt = estimateExpiry(cookies);

  return {
    brokerType: payload.brokerType,
    enctoken,
    jwt,
    accessToken,
    publicToken,
    refreshToken,
    userId,
    cookies,
    capturedAt: payload.capturedAt,
    expiryAt,
  };
}

/**
 * Extract a named cookie value from a raw cookie string.
 */
function extractCookie(cookieStr: string, name: string): string | null {
  const regex = new RegExp(
    `(?:^|;\\s*)${escapeRegex(name)}\\s*=\\s*([^;]+)`,
  );
  const match = cookieStr.match(regex);
  return match ? match[1].trim() : null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Estimate token expiry from max-age or expires cookie attributes.
 */
function estimateExpiry(cookies: string): string | undefined {
  const maxAgeMatch = cookies.match(/max-age=(\d+)/i);
  if (maxAgeMatch) {
    const expiryMs = Date.now() + parseInt(maxAgeMatch[1], 10) * 1000;
    return new Date(expiryMs).toISOString();
  }

  const expiresMatch = cookies.match(
    /expires=([a-zA-Z]{3},\s*\d{2}\s*[a-zA-Z]{3}\s*\d{4}\s*\d{2}:\d{2}:\d{2}\s*GMT)/i,
  );
  if (expiresMatch) {
    const parsed = new Date(expiresMatch[1]);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return undefined;
}

// ─── Keychain Operations ──────────────────────────────────────────────────

/**
 * Store a parsed BrokerSession in the hardware-backed keychain.
 * The data is encrypted at rest using the device's secure enclave.
 */
export async function storeBrokerSession(
  brokerType: string,
  session: BrokerSession,
): Promise<boolean> {
  try {
    const key = storageKey(brokerType);
    const json = JSON.stringify(session);

    await Keychain.setGenericPassword(key, json, {
      service: KEYCHAIN_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    return true;
  } catch (error) {
    console.error('[SessionStorage] Failed to store broker session:', error);
    return false;
  }
}

/**
 * Retrieve a previously stored BrokerSession from the keychain.
 * Returns null if no session exists or if the keychain is inaccessible.
 */
export async function getBrokerSession(
  brokerType: string,
): Promise<BrokerSession | null> {
  try {
    const key = storageKey(brokerType);
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });

    if (!credentials || credentials.username !== key) {
      return null;
    }

    return JSON.parse(credentials.password) as BrokerSession;
  } catch (error) {
    console.error('[SessionStorage] Failed to retrieve broker session:', error);
    return null;
  }
}

/**
 * Check whether a stored session exists and is still within its expiry window.
 */
export async function hasValidSession(brokerType: string): Promise<boolean> {
  const session = await getBrokerSession(brokerType);
  if (!session) return false;

  if (session.expiryAt) {
    return new Date(session.expiryAt).getTime() > Date.now();
  }

  // No expiry metadata — assume valid for 24 hours
  const capturedMs = new Date(session.capturedAt).getTime();
  return Date.now() - capturedMs < 24 * 60 * 60 * 1000;
}

/**
 * Delete a stored broker session from the keychain.
 */
export async function clearBrokerSession(
  brokerType: string,
): Promise<boolean> {
  try {
    await Keychain.resetGenericPassword({
      service: KEYCHAIN_SERVICE,
    });
    return true;
  } catch (error) {
    console.error('[SessionStorage] Failed to clear broker session:', error);
    return false;
  }
}

/**
 * List all broker types that have stored sessions.
 */
export async function listStoredSessions(): Promise<string[]> {
  try {
    // react-native-keychain does not provide a list-all API directly.
    // We attempt to read known broker keys as a workaround.
    const knownBrokers = ['angel', 'zerodha', 'groww'];
    const results = await Promise.all(
      knownBrokers.map(async (b) => {
        const session = await getBrokerSession(b);
        return session ? b : null;
      }),
    );
    return results.filter((b): b is string => b !== null);
  } catch {
    return [];
  }
}
