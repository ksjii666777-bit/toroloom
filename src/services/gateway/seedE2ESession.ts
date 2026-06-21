/**
 * ============================================================================
 * Toroloom — E2E Test Session Seed Utility
 * ============================================================================
 *
 * Seeds a mock broker session into the hardware-backed keychain so that
 * Maestro E2E tests can verify the connected-state UI without needing to
 * authenticate through a real broker WebView flow.
 *
 * This module is triggered via the deep link `toroloom://e2e/seed-broker`
 * and is only active when `__DEV__` is true. It is tree-shaken out of
 * production builds.
 *
 * Usage (from Maestro flow):
 *   # Trigger the seed deep link
 *   - openLink: toroloom://e2e/seed-broker
 *
 *   # Relaunch and navigate to Connect Broker to see connected state
 *   - tapOn: "Connect Broker"
 *
 * ============================================================================
 */

import { storeBrokerSession, clearBrokerSession } from './sessionStorage';
import type { BrokerSession } from '../../types';

// ─── Mock Session Factories ────────────────────────────────────────────────

/**
 * Create a mock Zerodha BrokerSession with realistic test data.
 * The session expiry is set 24 hours in the future so it validates as "current".
 */
export function createMockZerodhaSession(): BrokerSession {
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    brokerType: 'zerodha',
    enctoken: 'e2e_mock_enctoken_abc123def456',
    jwt: undefined,
    accessToken: 'e2e_mock_access_token_xyz789',
    publicToken: 'e2e_mock_public_token',
    refreshToken: undefined,
    userId: 'E2E_TEST_USER',
    cookies: 'enctoken=e2e_mock_enctoken_abc123def456; public_token=e2e_mock_public_token; user_id=E2E_TEST_USER',
    capturedAt: now.toISOString(),
    expiryAt: future.toISOString(),
  };
}

/**
 * Create a mock Angel One BrokerSession with realistic test data.
 */
export function createMockAngelSession(): BrokerSession {
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    brokerType: 'angel',
    enctoken: undefined,
    jwt: 'e2e_mock_jwt_header.e2e_mock_jwt_payload.e2e_mock_jwt_signature',
    accessToken: 'e2e_mock_private_key',
    publicToken: undefined,
    refreshToken: undefined,
    userId: 'E2E_ANGEL_USER',
    cookies: 'jwt=e2e_mock_jwt_header.e2e_mock_jwt_payload.e2e_mock_jwt_signature;',
    capturedAt: now.toISOString(),
    expiryAt: future.toISOString(),
  };
}

/**
 * Create a mock Groww BrokerSession with realistic test data.
 */
export function createMockGrowwSession(): BrokerSession {
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    brokerType: 'groww',
    enctoken: undefined,
    jwt: undefined,
    accessToken: 'e2e_mock_groww_access_token',
    publicToken: undefined,
    refreshToken: undefined,
    userId: 'E2E_GROWW_USER',
    cookies: 'access_token=e2e_mock_groww_access_token;',
    capturedAt: now.toISOString(),
    expiryAt: future.toISOString(),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Seed a mock broker session for E2E testing.
 * This clears any existing session and stores the mock data.
 *
 * @param brokerType - 'zerodha' | 'angel' | 'groww' (default: 'zerodha')
 * @returns The storeBrokerSession result
 */
export async function seedE2EBrokerSession(
  brokerType: 'zerodha' | 'angel' | 'groww' = 'zerodha',
): Promise<boolean> {
  // Clear any existing session first
  await clearBrokerSession(brokerType);

  // Create and store the mock session
  let session: BrokerSession;

  switch (brokerType) {
    case 'angel':
      session = createMockAngelSession();
      break;
    case 'groww':
      session = createMockGrowwSession();
      break;
    case 'zerodha':
    default:
      session = createMockZerodhaSession();
      break;
  }

  return storeBrokerSession(brokerType, session);
}

/**
 * Seed all three mock broker sessions simultaneously.
 * Useful for testing the multi-broker connected state.
 */
export async function seedAllBrokerSessions(): Promise<boolean[]> {
  return Promise.all([
    seedE2EBrokerSession('zerodha'),
    seedE2EBrokerSession('angel'),
    seedE2EBrokerSession('groww'),
  ]);
}

/**
 * Clear all E2E seeded sessions from the keychain.
 */
export async function clearE2ESessions(): Promise<void> {
  await Promise.all([
    clearBrokerSession('zerodha'),
    clearBrokerSession('angel'),
    clearBrokerSession('groww'),
  ]);
}
