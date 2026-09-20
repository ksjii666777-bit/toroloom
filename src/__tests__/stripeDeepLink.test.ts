/**
 * ============================================================================
 * Toroloom — Stripe Checkout Deep Link Tests
 * ============================================================================
 *
 * The US/EU checkout ends in the system browser; these URLs return to the app:
 *
 *   toroloom://subscription/success?session_id=cs_...  → syncFromServer()
 *   toroloom://subscription/cancelled                  → no-op (logged)
 *   unrelated URLs / SnapTrade callbacks               → ignored entirely
 *
 * The success path re-pulls the authoritative subscription from the backend
 * (syncFromServer) because the Stripe webhook may have upgraded the tier
 * while the user was paying. A per-URL dedupe prevents double refresh when
 * getInitialURL and the event listener both fire.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

vi.mock('react-native', () => ({
  Linking: {
    getInitialURL: vi.fn(async () => null),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    openURL: vi.fn(async () => undefined),
  },
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios' },
}));

vi.mock('../utils/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { handleStripeDeepLink, resetStripeDeepLinkState } from '../services/stripeDeepLink';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { subscriptionsApi } from '../services/api/subscriptions';

// Spy on the real API layer (the store's syncFromServer calls getCurrent)
vi.spyOn(subscriptionsApi, 'getCurrent').mockImplementation(async () => ({
  tier: 'pro',
  planId: 'plan_pro',
  status: 'active',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  autoRenew: true,
  paymentMethod: 'stripe',
}));

const SUCCESS_URL = 'toroloom://subscription/success?session_id=cs_test_123';
const CANCELLED_URL = 'toroloom://subscription/cancelled';

describe('stripeDeepLink — checkout return flow', () => {
  beforeEach(async () => {
    resetStripeDeepLinkState();
    await AsyncStorage.clear();
    useSubscriptionStore.setState({ subscription: undefined, initialized: true });
    vi.clearAllMocks();
    // Re-attach the implementation cleared by clearAllMocks
    (subscriptionsApi.getCurrent as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      tier: 'pro',
      planId: 'plan_pro',
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: true,
      paymentMethod: 'stripe',
    }));
  });

  it('success URL refreshes the subscription from the server', async () => {
    await handleStripeDeepLink(SUCCESS_URL);

    expect(subscriptionsApi.getCurrent).toHaveBeenCalledTimes(1);
    const sub = useSubscriptionStore.getState().subscription;
    expect(sub?.tier).toBe('pro');
    expect(sub?.paymentMethod).toBe('stripe');
  });

  it('the same URL is only handled once (getInitialURL + listener dedupe)', async () => {
    await handleStripeDeepLink(SUCCESS_URL);
    await handleStripeDeepLink(SUCCESS_URL);

    expect(subscriptionsApi.getCurrent).toHaveBeenCalledTimes(1);
  });

  it('different session ids each trigger a refresh', async () => {
    await handleStripeDeepLink('toroloom://subscription/success?session_id=cs_1');
    await handleStripeDeepLink('toroloom://subscription/success?session_id=cs_2');

    expect(subscriptionsApi.getCurrent).toHaveBeenCalledTimes(2);
  });

  it('cancelled URL is a no-op — no server call, state unchanged', async () => {
    await handleStripeDeepLink(CANCELLED_URL);

    expect(subscriptionsApi.getCurrent).not.toHaveBeenCalled();
    expect(useSubscriptionStore.getState().subscription).toBeUndefined();
  });

  it('unrelated deep links (SnapTrade, E2E) are ignored', async () => {
    await handleStripeDeepLink('toroloom://snaptrade/callback?authorizationId=abc');
    await handleStripeDeepLink('toroloom://e2e/seed-broker?broker=zerodha');
    await handleStripeDeepLink(null);

    expect(subscriptionsApi.getCurrent).not.toHaveBeenCalled();
  });

  it('a failed server sync is swallowed — no crash, state stays local', async () => {
    (subscriptionsApi.getCurrent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));

    await expect(handleStripeDeepLink(SUCCESS_URL)).resolves.toBeUndefined();
    expect(useSubscriptionStore.getState().subscription).toBeUndefined();
  });
});
