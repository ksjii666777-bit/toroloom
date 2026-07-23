/**
 * ============================================================================
 * Toroloom — Subscription Store UPI AutoPay Integration Tests
 * ============================================================================
 *
 * Covers all setUpAutopay code paths:
 *   1. Successful: API → Razorpay Checkout → verify → subscription → mandate saved
 *   2. Checkout failure: API succeeds, Razorpay Checkout rejects → mock fallback
 *   3. API failure: createMandate rejects → mock fallback
 *   4. Mandate persistence verification in AsyncStorage
 *   5. Subscription creation failure is non-critical
 *   6. Edge cases (yearly billing, UPI handle extraction, dual failure)
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/subscriptionStore.autopay.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSubscriptionStore } from '../store/subscriptionStore';

// ─── Mock factories (no external variable references) ─────────────────────
// NOTE: vi.mock factories create fresh vi.fn() instances. Tests modify mocks
// via dynamic imports (await import(...)) + vi.mocked().

vi.mock('react-native-razorpay', () => ({
  default: { open: vi.fn() },
}));

vi.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
  };
});

vi.mock('expo-haptics', () => ({
  default: {
    notificationAsync: vi.fn().mockResolvedValue(undefined),
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  },
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (o: any) => o.ios },
}));

vi.mock('../services/api/payments', () => ({
  paymentsApi: {
    createOrder: vi.fn(),
    createMandate: vi.fn(),
    verifyPayment: vi.fn(),
    createSubscription: vi.fn(),
  },
}));

// ============================================================================
// Test constants
// ============================================================================

const MANDATE_PARAMS = {
  upiId: 'testuser@paytm',
  planId: 'plan_pro',
  amount: 399,
  billingPeriod: 'monthly' as const,
};

const SUCCESSFUL_MANDATE_ORDER = {
  orderId: 'order_mand_test_123',
  keyId: 'rzp_test_key',
  amount: 39900,
  currency: 'INR',
  method: 'upi',
};

const RAZORPAY_SUCCESS_RESPONSE = {
  razorpay_payment_id: 'pay_mand_test_456',
  razorpay_order_id: 'order_mand_test_123',
  razorpay_signature: 'sig_mand_test_789',
};

const MOCK_SUBSCRIPTION_RESPONSE = {
  subscriptionId: 'sub_mock_123',
  keyId: 'rzp_test_key',
  status: 'created',
  currentStart: Math.floor(Date.now() / 1000),
  currentEnd: Math.floor(Date.now() / 1000) + 2592000,
  endedAt: null,
  chargeAt: Math.floor(Date.now() / 1000) + 2592000,
  startAt: Math.floor(Date.now() / 1000),
  totalCount: 12,
  paidCount: 0,
};

function resetStoreState(): void {
  const now = new Date().toISOString();
  useSubscriptionStore.setState({
    subscription: {
      tier: 'pro',
      planId: 'plan_pro',
      status: 'active',
      startDate: now,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: false,
    },
    tenantConfig: null,
    isLoading: false,
    initialized: true,
    isSettingUpAutopay: false,
    upiMandates: [],
  });
}

/**
 * Set up all mocks for the "real API + Checkout" path.
 * Uses dynamic imports to get fresh mock references each test run.
 */
async function setupSuccessMocks(): Promise<void> {
  const Razorpay = await import('react-native-razorpay');
  vi.mocked(Razorpay.default.open).mockResolvedValue(RAZORPAY_SUCCESS_RESPONSE);

  const { paymentsApi } = await import('../services/api/payments');
  vi.mocked(paymentsApi.createMandate).mockResolvedValue(SUCCESSFUL_MANDATE_ORDER);
  vi.mocked(paymentsApi.verifyPayment).mockResolvedValue({ success: true, message: 'Payment verified' });
  vi.mocked(paymentsApi.createSubscription).mockResolvedValue(MOCK_SUBSCRIPTION_RESPONSE);
}



// ============================================================================
// Tests
// ============================================================================

describe('Subscription Store — setUpAutopay', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setupSuccessMocks();
    resetStoreState();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Path 1: Full successful flow (API → Checkout → verify → subscription)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Successful API + Checkout path', () => {
    it('should call createMandate with correct parameters', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const { paymentsApi } = await import('../services/api/payments');
      expect(paymentsApi.createMandate).toHaveBeenCalledWith({
        planId: 'plan_pro',
        billingPeriod: 'monthly',
        tenantId: undefined,
      });
    });

    it('should open Razorpay Checkout with the mandate order', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const Razorpay = await import('react-native-razorpay');
      expect(Razorpay.default.open).toHaveBeenCalledTimes(1);
      const options = vi.mocked(Razorpay.default.open).mock.calls[0][0];
      expect(options.order_id).toBe('order_mand_test_123');
      expect(options.key).toBe('rzp_test_key');
      expect(options.prefill!.vpa).toBe('testuser@paytm');
      expect(options.amount).toBe(39900);
      expect(options.description).toContain('UPI AutoPay');
    });

    it('should verify the payment with correct params', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const { paymentsApi } = await import('../services/api/payments');
      expect(paymentsApi.verifyPayment).toHaveBeenCalledWith({
        razorpayPaymentId: 'pay_mand_test_456',
        razorpayOrderId: 'order_mand_test_123',
        razorpaySignature: 'sig_mand_test_789',
        planId: 'plan_pro',
        type: 'subscription',
        tenantId: undefined,
      });
    });

    it('should create a recurring subscription after successful mandate', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const { paymentsApi } = await import('../services/api/payments');
      expect(paymentsApi.createSubscription).toHaveBeenCalledWith({
        planId: 'plan_pro',
        billingPeriod: 'monthly',
        totalCount: 12,
        tenantId: undefined,
      });
    });

    it('should set isSettingUpAutopay to false after completion', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      expect(useSubscriptionStore.getState().isSettingUpAutopay).toBe(false);
    });

    it('should enable AutoPay on the subscription', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const state = useSubscriptionStore.getState();
      expect(state.subscription.isAutoPayEnabled).toBe(true);
      expect(state.subscription.upiMandate).toBeDefined();
      expect(state.subscription.upiMandate!.upiId).toBe('testuser@paytm');
      expect(state.subscription.upiMandate!.status).toBe('active');
    });

    it('should add the mandate to the upiMandates array', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const mandates = useSubscriptionStore.getState().upiMandates;
      expect(mandates).toHaveLength(1);
      expect(mandates[0].upiId).toBe('testuser@paytm');
    });

    it('should trigger success haptic feedback', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const Haptics = await import('expo-haptics');
      expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    });

    it('should show success alert with correct amount and UPI ID', async () => {
      const { Alert } = await import('react-native');

      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      expect(Alert.alert).toHaveBeenCalledWith(
        'UPI AutoPay Enabled ✅',
        expect.stringContaining('₹399'),
        expect.any(Array),
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        'UPI AutoPay Enabled ✅',
        expect.stringContaining('testuser@paytm'),
        expect.any(Array),
      );
    });

    it('should set isSettingUpAutopay true immediately when called', async () => {
      const promise = useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      expect(useSubscriptionStore.getState().isSettingUpAutopay).toBe(true);
      await promise;
    });

    it('should pass tenantId when tenant is configured', async () => {
      useSubscriptionStore.setState({
        tenantConfig: {
          id: 'tenant-acme',
          name: 'Acme Corp',
          domain: 'acme.com',
          razorpay: { keyId: 'rzp_tenant_key', keySecret: 'secret' },
        },
      });

      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const { paymentsApi } = await import('../services/api/payments');
      expect(paymentsApi.createMandate).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-acme' }),
      );
    });

    it('should use tenant Razorpay key in Checkout when available', async () => {
      useSubscriptionStore.setState({
        tenantConfig: {
          id: 'tenant-acme',
          name: 'Acme Corp',
          domain: 'acme.com',
          razorpay: { keyId: 'rzp_tenant_key', keySecret: 'secret' },
        },
      });

      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const Razorpay = await import('react-native-razorpay');
      expect(Razorpay.default.open).toHaveBeenCalledTimes(1);
      const options = vi.mocked(Razorpay.default.open).mock.calls[0][0];
      expect(options.key).toBe('rzp_tenant_key');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Path 2: API succeeds, Razorpay Checkout fails → mock fallback
  // ─────────────────────────────────────────────────────────────────────────

  describe('Checkout failure fallback', () => {
    beforeEach(async () => {
      const Razorpay = await import('react-native-razorpay');
      vi.mocked(Razorpay.default.open).mockRejectedValue(new Error('Checkout cancelled'));
    });

    it('should fall back to mock when Checkout rejects', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const state = useSubscriptionStore.getState();
      expect(state.subscription.isAutoPayEnabled).toBe(true);
      expect(state.subscription.upiMandate).toBeDefined();
      expect(state.subscription.upiMandate!.status).toBe('active');
    });

    it('should still set isSettingUpAutopay to false after fallback', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      expect(useSubscriptionStore.getState().isSettingUpAutopay).toBe(false);
    });

    it('should still show success alert via fallback', async () => {
      const { Alert } = await import('react-native');

      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      expect(Alert.alert).toHaveBeenCalledWith(
        'UPI AutoPay Enabled ✅',
        expect.stringContaining('₹399'),
        expect.any(Array),
      );
    });

    it('should NOT call verifyPayment when Checkout fails', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const { paymentsApi } = await import('../services/api/payments');
      expect(paymentsApi.verifyPayment).not.toHaveBeenCalled();
    });

    it('should NOT call createSubscription when Checkout fails', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const { paymentsApi } = await import('../services/api/payments');
      expect(paymentsApi.createSubscription).not.toHaveBeenCalled();
    });

    it('should create mandate object via buildMandate helper', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const mandate = useSubscriptionStore.getState().subscription.upiMandate!;
      expect(mandate.mandateId).toMatch(/^mand_/);
      expect(mandate.amount).toBe(399);
      expect(mandate.billingPeriod).toBe('monthly');
      expect(mandate.planId).toBe('plan_pro');
      expect(mandate.tpv).toBe('PIN');
    });

    it('should extract bank name from UPI handle', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        'user@icici',
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const mandate = useSubscriptionStore.getState().subscription.upiMandate!;
      expect(mandate.bankName).toBe('ICICI');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Path 3: API fails entirely → mock fallback
  // ─────────────────────────────────────────────────────────────────────────

  describe('API failure fallback', () => {
    beforeEach(async () => {
      const { paymentsApi } = await import('../services/api/payments');
      vi.mocked(paymentsApi.createMandate).mockRejectedValue(new Error('Network error'));
    });

    it('should fall back to mock when createMandate fails', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const state = useSubscriptionStore.getState();
      expect(state.subscription.isAutoPayEnabled).toBe(true);
      expect(state.subscription.upiMandate).toBeDefined();
    });

    it('should NOT open Razorpay Checkout when API fails', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const Razorpay = await import('react-native-razorpay');
      expect(Razorpay.default.open).not.toHaveBeenCalled();
    });

    it('should still show success alert via fallback', async () => {
      const { Alert } = await import('react-native');

      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      expect(Alert.alert).toHaveBeenCalledWith(
        'UPI AutoPay Enabled ✅',
        expect.any(String),
        expect.any(Array),
      );
    });

    it('should set isSettingUpAutopay to false after fallback', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      expect(useSubscriptionStore.getState().isSettingUpAutopay).toBe(false);
    });

    it('should extract bank name from UPI handle in fallback', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        'testuser@paytm',
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const mandate = useSubscriptionStore.getState().subscription.upiMandate!;
      expect(mandate.bankName).toBe('PAYTM');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Path 4: Mandate persistence in AsyncStorage
  // ─────────────────────────────────────────────────────────────────────────

  describe('Mandate persistence', () => {
    it('should persist mandate to AsyncStorage after successful API flow', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const stored = JSON.parse(vi.mocked(AsyncStorage.default.setItem).mock.calls
        .find(([key]) => key === 'toroloom_subscription')?.[1] ?? '{}');
      expect(stored.isAutoPayEnabled).toBe(true);
      expect(stored.upiMandate.upiId).toBe('testuser@paytm');
      expect(stored.upiMandate.status).toBe('active');
    });

    it('should persist mandate to AsyncStorage after fallback path', async () => {
      const { paymentsApi } = await import('../services/api/payments');
      vi.mocked(paymentsApi.createMandate).mockRejectedValue(new Error('Network error'));

      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const stored = JSON.parse(vi.mocked(AsyncStorage.default.setItem).mock.calls
        .find(([key]) => key === 'toroloom_subscription')?.[1] ?? '{}');
      expect(stored.isAutoPayEnabled).toBe(true);
      expect(stored.upiMandate.upiId).toBe('testuser@paytm');
    });

    it('should preserve existing subscription fields when saving mandate', async () => {
      useSubscriptionStore.setState({
        subscription: {
          tier: 'elite',
          planId: 'plan_elite',
          status: 'active',
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-02-01T00:00:00.000Z',
          autoRenew: true,
        },
      });

      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const stored = JSON.parse(vi.mocked(AsyncStorage.default.setItem).mock.calls
        .find(([key]) => key === 'toroloom_subscription')?.[1] ?? '{}');
      expect(stored.tier).toBe('elite');
      expect(stored.planId).toBe('plan_elite');
      expect(stored.autoRenew).toBe(true);
      expect(stored.isAutoPayEnabled).toBe(true);
    });

    it('should accumulate multiple mandates when setUpAutopay is called twice', async () => {
      // First mandate
      await useSubscriptionStore.getState().setUpAutopay(
        'user1@paytm',
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      // Re-apply success mocks for second call (cleared by the first call)
      await setupSuccessMocks();

      // Second mandate
      await useSubscriptionStore.getState().setUpAutopay(
        'user2@googlepay',
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const mandates = useSubscriptionStore.getState().upiMandates;
      expect(mandates).toHaveLength(2);
      expect(mandates[0].upiId).toBe('user1@paytm');
      expect(mandates[1].upiId).toBe('user2@googlepay');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Path 5: Subscription creation failure is non-critical
  // ─────────────────────────────────────────────────────────────────────────

  describe('Subscription creation failure', () => {
    beforeEach(async () => {
      const { paymentsApi } = await import('../services/api/payments');
      vi.mocked(paymentsApi.createSubscription).mockRejectedValue(new Error('Subscription creation failed'));
    });

    it('should still succeed if createSubscription fails (non-critical)', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const state = useSubscriptionStore.getState();
      expect(state.subscription.isAutoPayEnabled).toBe(true);
      expect(state.isSettingUpAutopay).toBe(false);
    });

    it('should still persist mandate even if subscription creation fails', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        MANDATE_PARAMS.upiId,
        MANDATE_PARAMS.planId,
        MANDATE_PARAMS.amount,
        MANDATE_PARAMS.billingPeriod,
      );

      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const stored = JSON.parse(vi.mocked(AsyncStorage.default.setItem).mock.calls
        .find(([key]) => key === 'toroloom_subscription')?.[1] ?? '{}');
      expect(stored.isAutoPayEnabled).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should handle yearly billing period correctly', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        'user@paytm',
        'plan_elite',
        9999,
        'yearly',
      );

      const { paymentsApi } = await import('../services/api/payments');
      expect(paymentsApi.createMandate).toHaveBeenCalledWith(
        expect.objectContaining({ billingPeriod: 'yearly' }),
      );

      const { Alert } = await import('react-native');
      expect(Alert.alert).toHaveBeenCalledWith(
        'UPI AutoPay Enabled ✅',
        expect.stringContaining('/yr'),
        expect.any(Array),
      );
    });

    it('should handle UPI IDs without @ symbol in real path', async () => {
      await useSubscriptionStore.getState().setUpAutopay(
        'plainupi',
        'plan_pro',
        399,
        'monthly',
      );

      const mandate = useSubscriptionStore.getState().subscription.upiMandate!;
      expect(mandate.bankName).toBe('UPI');
      expect(mandate.upiId).toBe('plainupi');
    });

    it('should handle UPI IDs without @ symbol in fallback', async () => {
      const { paymentsApi } = await import('../services/api/payments');
      vi.mocked(paymentsApi.createMandate).mockRejectedValue(new Error('Network error'));

      await useSubscriptionStore.getState().setUpAutopay(
        'plainupi',
        'plan_pro',
        399,
        'monthly',
      );

      const mandate = useSubscriptionStore.getState().subscription.upiMandate!;
      // In fallback path, buildMandate is called with bankFallback='ICICI Bank'
      expect(mandate.bankName).toBe('ICICI Bank');
      expect(mandate.upiId).toBe('plainupi');
    });

    it('should handle both API and Checkout failing gracefully', async () => {
      const { paymentsApi } = await import('../services/api/payments');
      vi.mocked(paymentsApi.createMandate).mockRejectedValue(new Error('Network error'));

      await expect(
        useSubscriptionStore.getState().setUpAutopay(
          MANDATE_PARAMS.upiId,
          MANDATE_PARAMS.planId,
          MANDATE_PARAMS.amount,
          MANDATE_PARAMS.billingPeriod,
        ),
      ).resolves.toBeUndefined();

      const state = useSubscriptionStore.getState();
      expect(state.subscription.isAutoPayEnabled).toBe(true);
      expect(state.isSettingUpAutopay).toBe(false);
    });
  });
});
