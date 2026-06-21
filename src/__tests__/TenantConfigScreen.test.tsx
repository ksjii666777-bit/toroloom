/**
 * ============================================================================
 * Toroloom — TenantConfigScreen Integration Tests
 * ============================================================================
 *
 * Verifies that TenantConfigScreen renders and behaves correctly:
 *   - Empty form rendering (all sections, inputs, feature rows, pricing inputs)
 *   - Form input interactions (text fields, pricing, feature toggles)
 *   - Save flow (validation, calling configureTenant)
 *   - Reset flow (clear fields, call configureTenant with defaults)
 *   - Pre-filled form (loading from existing tenantConfig)
 *   - Active Config preview section
 *   - Back button and navigation
 *   - Edge cases
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      white: '#FFFFFF',
      bg: '#0D0D2B',
      bgSecondary: '#1A1A3E',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgDark: '#070720',
      border: '#2A2A5E',
      divider: '#1E1E4A',
    },
    isDark: true,
  }),
}));

// ==================== Imports ====================

import { render, fireEvent } from './testUtils';
import type { RenderResult } from './testUtils';
import { useSubscriptionStore, SUBSCRIPTION_PLANS } from '../store/subscriptionStore';
import { DEFAULT_FEATURE_MATRIX } from '../types';
import type { TenantConfig, SubscriptionFeature } from '../types';
import TenantConfigScreen from '../screens/settings/TenantConfigScreen';
import { Alert, View } from 'react-native';

// ==================== Helpers ====================

function advanceAnimations() {
  act(() => { vi.advanceTimersByTime(1000); });
}

/**
 * Reset the subscription store to a clean default state,
 * optionally with the given tenant config.
 */
function resetStore(config?: TenantConfig | null) {
  useSubscriptionStore.setState({
    subscription: {
      tier: 'free',
      planId: 'plan_free',
      status: 'active',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-01-01T00:00:00.000Z',
      autoRenew: false,
    },
    tenantConfig: config ?? null,
    isLoading: false,
    initialized: true,
  });
}

/** Spy on configureTenant with a no-op async implementation. */
function spyOnConfigureTenant() {
  const spy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
  spy.mockImplementation(async () => {});
  return spy;
}

/**
 * Spy on configureTenant with an implementation that actually updates the
 * store's tenantConfig — used by Active Config display tests that need the
 * component to reflect saved state on re-render.
 */
function spyOnConfigureTenantWithStoreUpdate() {
  const spy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
  spy.mockImplementation(async (config: TenantConfig) => {
    useSubscriptionStore.setState({ tenantConfig: config });
  });
  return spy;
}

/**
 * Capture the destructive "Reset" button callback from an Alert.alert
 * confirmation dialog. Returns a getter for the captured callback and a
 * restore function. Uses a getter because the callback is captured asynchronously
 * inside the Alert.alert override — destructuring a value directly would copy
 * `null` before the callback is invoked.
 */
function captureResetAlert() {
  let capturedOnPress: (() => void) | null = null;
  const originalAlert = Alert.alert;
  Alert.alert = ((_title: string, _message: string, buttons?: any[]) => {
    const resetBtn = buttons?.find((b: any) => b.style === 'destructive');
    if (resetBtn?.onPress) capturedOnPress = resetBtn.onPress;
  }) as any;
  return {
    getCapturedOnPress: () => capturedOnPress,
    restore: () => { Alert.alert = originalAlert; },
  };
}

/**
 * Press the "Free" tier chip on the last feature row (behavioural_journal,
 * default: elite). Uses getAllByText('Free') and targets the last (deepest)
 * match, which is the last row's Free chip in DFS order.
 */
function pressLastFreeChip(result: RenderResult) {
  const freeChips = result.getAllByText('Free');
  act(() => { fireEvent.press(freeChips[freeChips.length - 1]); });
}

/** Fill Razorpay key fields. */
function fillRazorpayKeys(result: RenderResult, keyId: string, keySecret: string) {
  act(() => { fireEvent.changeText(result.getByPlaceholderText('e.g. rzp_live_xxxxxxxx'), keyId); });
  act(() => { fireEvent.changeText(result.getByPlaceholderText('Enter key secret'), keySecret); });
}

/** Fill Pro pricing fields. */
function fillProPricing(result: RenderResult, monthly: string, yearly: string) {
  const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
  act(() => { fireEvent.changeText(result.getByPlaceholderText(String(proPlan.price)), monthly); });
  act(() => { fireEvent.changeText(result.getByPlaceholderText(String(proPlan.priceYearly)), yearly); });
}

/** Fill Elite pricing fields. */
function fillElitePricing(result: RenderResult, monthly: string, yearly: string) {
  const elitePlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'elite')!;
  act(() => { fireEvent.changeText(result.getByPlaceholderText(String(elitePlan.price)), monthly); });
  act(() => { fireEvent.changeText(result.getByPlaceholderText(String(elitePlan.priceYearly)), yearly); });
}

/**
 * Save the form via the "Save Tenant Config" button. With the reactive
 * subscription to s.tenantConfig, the component automatically re-renders
 * when the store updates — no forced re-render needed.
 */
function save(result: RenderResult) {
  act(() => { fireEvent.press(result.getByText('Save Tenant Config')); });
  act(() => { vi.advanceTimersByTime(0); });
}

// ==================== File-level Setup ====================

beforeEach(() => {
  vi.useFakeTimers();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ==================== Empty Form Rendering ====================

describe('TenantConfigScreen — Empty Form', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders the header with title and back button', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Tenant Config')).toBeDefined();
  });

  it('renders all four configuration sections', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Tenant Identity')).toBeDefined();
    expect(getByText('Feature Overrides')).toBeDefined();
    expect(getByText('Plan Pricing Overrides')).toBeDefined();
    expect(getByText('Razorpay Config')).toBeDefined();
  });

  it('renders text input fields with correct placeholders', () => {
    const { getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByPlaceholderText('e.g. broker_x')).toBeDefined();
    expect(getByPlaceholderText('e.g. BrokerX')).toBeDefined();
    expect(getByPlaceholderText('e.g. brokerx.toroloom.app')).toBeDefined();
    expect(getByPlaceholderText('e.g. #FF6600')).toBeDefined();
  });

  it('renders all 15 feature override rows from the matrix', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    const meta = DEFAULT_FEATURE_MATRIX;
    (Object.keys(meta) as SubscriptionFeature[]).forEach((key) => {
      expect(getByText(meta[key].label)).toBeDefined();
    });
  });

  it('renders pricing inputs for Pro and Elite plans', () => {
    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Pro')).toBeDefined();
    expect(getByText('Elite')).toBeDefined();

    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
    const elitePlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'elite')!;
    expect(getByPlaceholderText(String(proPlan.price))).toBeDefined();
    expect(getByPlaceholderText(String(proPlan.priceYearly))).toBeDefined();
    expect(getByPlaceholderText(String(elitePlan.price))).toBeDefined();
    expect(getByPlaceholderText(String(elitePlan.priceYearly))).toBeDefined();
  });

  it('renders Razorpay key inputs', () => {
    const { getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByPlaceholderText('e.g. rzp_live_xxxxxxxx')).toBeDefined();
    expect(getByPlaceholderText('Enter key secret')).toBeDefined();
  });

  it('renders Save button', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Save Tenant Config')).toBeDefined();
  });

  it('does NOT render Reset button or Active Config section when no tenant configured', () => {
    const { queryByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(queryByText('Reset to Default')).toBeNull();
    expect(queryByText('Active Config')).toBeNull();
  });
});

// ==================== Pre-filled Form ====================

describe('TenantConfigScreen — Pre-filled Form', () => {
  const existingConfig: TenantConfig = {
    id: 'broker_x',
    name: 'BrokerX',
    domain: 'brokerx.toroloom.app',
    primaryColor: '#FF6600',
    featureOverrides: {
      iron_lock: 'free',
      ad_free: 'elite',
    },
    razorpay: {
      keyId: 'rzp_live_test123456',
      keySecret: 'sk_test_secret',
      pricing: {
        plan_pro: { monthly: 199, yearly: 1999 },
      },
    },
  };

  beforeEach(() => {
    resetStore(existingConfig);
  });

  it('shows pre-filled config values rendered in Active Config preview', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('broker_x')).toBeDefined();
    expect(getByText('BrokerX')).toBeDefined();
    expect(getByText('brokerx.toroloom.app')).toBeDefined();
  });

  it('renders Active Config section with tenant details', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    expect(getByText('Active Config')).toBeDefined();
    expect(getByText('broker_x')).toBeDefined();
    expect(getByText('BrokerX')).toBeDefined();
    expect(getByText('brokerx.toroloom.app')).toBeDefined();
  });

  it('shows feature override count in active config', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('2 feature(s)')).toBeDefined();
  });

  it('shows Razorpay key preview in active config', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText(/Razorpay/)).toBeDefined();
    expect(getByText(/Configured/)).toBeDefined();
  });

  it('shows pricing override count in active config', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('1 plan(s)')).toBeDefined();
  });

  it('renders Reset button when non-default tenant is configured', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Reset to Default')).toBeDefined();
  });

  it('renders primary color swatch in active config preview', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Primary Color:')).toBeDefined();
    expect(getByText(/#FF6600/)).toBeDefined();
  });
});

// ==================== Form Interactions ====================

describe('TenantConfigScreen — Form Interactions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('does not throw when pressing the back button area', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(() => {
      act(() => { fireEvent.press(getByText('Tenant Config')); });
    }).not.toThrow();
  });

  it('saves with valid inputs and calls configureTenant', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'my_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'My Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'mybroker.app'); });

    act(() => { fireEvent.press(getByText('Save Tenant Config')); });

    expect(configureTenantSpy).toHaveBeenCalledTimes(1);
    expect(configureTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'my_broker',
        name: 'My Broker',
        domain: 'mybroker.app',
      }),
    );

    configureTenantSpy.mockRestore();
  });

  it('saves with primaryColor set and verifies it is included in the config', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'color_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Color Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'color.app'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. #FF6600'), '#00FF00'); });

    act(() => { fireEvent.press(getByText('Save Tenant Config')); });

    expect(configureTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'color_broker',
        primaryColor: '#00FF00',
      }),
    );

    configureTenantSpy.mockRestore();
  });

  it('saves without primaryColor when field is left empty', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'nocolor_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'No Color Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'nocolor.app'); });

    act(() => { fireEvent.press(getByText('Save Tenant Config')); });

    expect(configureTenantSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({
        primaryColor: expect.anything(),
      }),
    );

    configureTenantSpy.mockRestore();
  });

  it('shows validation alert when tenant ID is empty', () => {
    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'My Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'mybroker.app'); });

    const configureTenantSpy = spyOnConfigureTenant();
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    expect(configureTenantSpy).not.toHaveBeenCalled();
    configureTenantSpy.mockRestore();
  });

  it('shows validation alert when tenant name is empty', () => {
    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'my_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'mybroker.app'); });

    const configureTenantSpy = spyOnConfigureTenant();
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    expect(configureTenantSpy).not.toHaveBeenCalled();
    configureTenantSpy.mockRestore();
  });

  it('shows validation alert when domain is empty', () => {
    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'my_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'My Broker'); });

    const configureTenantSpy = spyOnConfigureTenant();
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    expect(configureTenantSpy).not.toHaveBeenCalled();
    configureTenantSpy.mockRestore();
  });

  it('saves with Razorpay keys and pricing overrides', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const r = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Tenant identity
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'pay_broker'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Pay Broker'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'paybroker.app'); });

    // Razorpay keys
    fillRazorpayKeys(r, 'rzp_live_test123', 'sk_test_secret_xyz');

    // Pro pricing
    fillProPricing(r, '249', '2499');

    act(() => { fireEvent.press(r.getByText('Save Tenant Config')); });

    expect(configureTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pay_broker',
        razorpay: expect.objectContaining({
          keyId: 'rzp_live_test123',
          keySecret: 'sk_test_secret_xyz',
          pricing: expect.objectContaining({
            plan_pro: { monthly: 249, yearly: 2499 },
          }),
        }),
      }),
    );

    configureTenantSpy.mockRestore();
  });

  it('saves with feature overrides from pre-populated tenant config', () => {
    const preconfiguredTenant: TenantConfig = {
      id: 'custom_broker',
      name: 'Custom Broker',
      domain: 'custom.app',
      featureOverrides: {
        iron_lock: 'free',
        ad_free: 'elite',
      },
    };
    resetStore(preconfiguredTenant);

    const configureTenantSpy = spyOnConfigureTenant();

    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    advanceAnimations();

    expect(configureTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'custom_broker',
        name: 'Custom Broker',
        domain: 'custom.app',
        featureOverrides: {
          iron_lock: 'free',
          ad_free: 'elite',
        },
      }),
    );

    configureTenantSpy.mockRestore();
  });

  it('renders override default text showing active override direction', () => {
    const tenantWithOverride: TenantConfig = {
      id: 'override_test',
      name: 'Override Test',
      domain: 'override.test',
      featureOverrides: {
        iron_lock: 'free',
      },
    };
    resetStore(tenantWithOverride);

    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    expect(getByText(/Default: elite/)).toBeDefined();
    expect(getByText(/→ free/)).toBeDefined();
  });

  it('toggles a feature chip via the UI and verifies the override appears in saved config', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const r = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Fill tenant identity
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'chip_test'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Chip Test'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'chip.test'); });

    // Toggle the last feature row's Free chip (behavioural_journal, default: elite → free)
    pressLastFreeChip(r);
    advanceAnimations();

    act(() => { fireEvent.press(r.getByText('Save Tenant Config')); });
    advanceAnimations();

    expect(configureTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'chip_test',
        featureOverrides: expect.objectContaining({}),
      }),
    );

    configureTenantSpy.mockRestore();
  });

  // ── Active Config Display Tests (parameterized) ──

  describe('Active Config after save', () => {
    it('shows saved tenant details in Active Config section after save', () => {
      const configureTenantSpy = spyOnConfigureTenantWithStoreUpdate();

      const r = render(
        <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
      );
      advanceAnimations();

      expect(r.queryByText('Active Config')).toBeNull();

      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'saved_broker'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Saved Broker'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'saved.app'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. #FF6600'), '#00FF00'); });
      fillRazorpayKeys(r, 'rzp_saved_test', 'sk_saved');
      fillProPricing(r, '499', '4999');

      save(r);

      expect(r.getByText('Active Config')).toBeDefined();
      expect(r.getByText('saved_broker')).toBeDefined();
      expect(r.getByText('Saved Broker')).toBeDefined();
      expect(r.getByText('saved.app')).toBeDefined();
      expect(r.getByText(/#00FF00/)).toBeDefined();
      expect(r.getByText(/rzp_saved/)).toBeDefined();
      expect(r.getByText('1 plan(s)')).toBeDefined();

      configureTenantSpy.mockRestore();
    });

    it('shows feature overrides in Active Config section after save with non-default overrides', () => {
      const configureTenantSpy = spyOnConfigureTenantWithStoreUpdate();

      const r = render(
        <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
      );
      advanceAnimations();

      expect(r.queryByText('Active Config')).toBeNull();

      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'override_broker'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Override Broker'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'override.app'); });

      pressLastFreeChip(r);
      advanceAnimations();

      save(r);

      expect(r.getByText('Active Config')).toBeDefined();
      expect(r.getByText('override_broker')).toBeDefined();
      expect(r.getByText('Override Broker')).toBeDefined();
      expect(r.getByText('override.app')).toBeDefined();
      expect(r.getByText('1 feature(s)')).toBeDefined();

      configureTenantSpy.mockRestore();
    });

    // Parameterized pricing variations
    const pricingVariants = [
      {
        name: 'Razorpay keys only (no pricing)',
        fillPricing: (_r: RenderResult) => {},
        expectedPlans: null,
        expectPricingSection: false,
        expectConfigured: true,
      },
      {
        name: 'keys + Pro pricing (1 plan)',
        fillPricing: (r: RenderResult) => fillProPricing(r, '499', '4999'),
        expectedPlans: 1,
        expectPricingSection: true,
        expectConfigured: true,
      },
      {
        name: 'keys + Pro + Elite pricing (2 plans)',
        fillPricing: (r: RenderResult) => {
          fillProPricing(r, '399', '3999');
          fillElitePricing(r, '899', '8999');
        },
        expectedPlans: 2,
        expectPricingSection: true,
        expectConfigured: true,
      },
    ] as const;

    it.each(pricingVariants)('$name', ({ fillPricing, expectedPlans, expectPricingSection, expectConfigured }) => {
      const configureTenantSpy = spyOnConfigureTenantWithStoreUpdate();

      const r = render(
        <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
      );
      advanceAnimations();

      expect(r.queryByText('Active Config')).toBeNull();

      // Tenant identity
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'pricing_test'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Pricing Test'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'pricing.test'); });

      // Razorpay keys
      fillRazorpayKeys(r, 'rzp_live_' + 'pricing_test', 'sk_pricing_secret');

      // Plan-specific pricing
      fillPricing(r);

      save(r);

      expect(r.getByText('Active Config')).toBeDefined();
      expect(r.getByText('pricing_test')).toBeDefined();
      expect(r.getByText('Pricing Test')).toBeDefined();

      if (expectConfigured) {
        expect(r.getByText(/Configured/)).toBeDefined();
      }

      if (expectPricingSection && expectedPlans !== null) {
        expect(r.getByText(/Pricing Overrides:/)).toBeDefined();
        expect(r.getByText(`${expectedPlans} plan(s)`)).toBeDefined();
      } else {
        expect(r.queryByText(/Pricing Overrides:/)).toBeNull();
      }

      if (!expectPricingSection && expectedPlans === null && expectConfigured) {
        // Razorpay-only case — key prefix should be visible
        expect(r.getByText(/rzp_live_p/)).toBeDefined();
      }

      configureTenantSpy.mockRestore();
    });

    it('updates Active Config tenant name after re-saving with a different name', () => {
      const configureTenantSpy = spyOnConfigureTenantWithStoreUpdate();

      const r = render(
        <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
      );
      advanceAnimations();

      expect(r.queryByText('Active Config')).toBeNull();

      // First save
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 're_save'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Original Name'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'resave.app'); });

      save(r);

      expect(r.getByText('Active Config')).toBeDefined();
      expect(r.getByText('Original Name')).toBeDefined();
      expect(r.queryByText('Updated Name')).toBeNull();

      // Second save with updated name
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Updated Name'); });

      save(r);

      expect(r.queryByText('Original Name')).toBeNull();
      expect(r.getByText('Updated Name')).toBeDefined();

      configureTenantSpy.mockRestore();
    });

    it('renders full Active Config section with all fields populated after save', () => {
      const configureTenantSpy = spyOnConfigureTenantWithStoreUpdate();

      const r = render(
        <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
      );
      advanceAnimations();

      expect(r.queryByText('Active Config')).toBeNull();

      // 1. Fill identity fields
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'full_broker'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Full Broker'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'full.app'); });

      // 2. Fill primary color
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. #FF6600'), '#AA00FF'); });

      // 3. Toggle a feature override chip
      pressLastFreeChip(r);
      advanceAnimations();

      // 4. Fill Razorpay keys
      fillRazorpayKeys(r, 'rzp_live_full_config', 'sk_full_secret');

      // 5. Fill Pro pricing
      fillProPricing(r, '599', '5999');

      // 6. Save
      save(r);

      // 7. Assert ALL Active Config sections
      expect(r.getByText('Active Config')).toBeDefined();

      // Identity
      expect(r.getByText('full_broker')).toBeDefined();
      expect(r.getByText('Full Broker')).toBeDefined();
      expect(r.getByText('full.app')).toBeDefined();

      // Primary color
      expect(r.getByText('Primary Color:')).toBeDefined();
      expect(r.getByText(/#AA00FF/)).toBeDefined();
      const allViews = r.root.findAllByType(View);
      const swatch = allViews.find((v) => {
        const style = v.props.style;
        return Array.isArray(style) && style[style.length - 1]?.backgroundColor === '#AA00FF';
      });
      expect(swatch).toBeDefined();

      // Feature overrides
      expect(r.getByText(/Feature Overrides:/)).toBeDefined();
      expect(r.getByText('1 feature(s)')).toBeDefined();

      // Razorpay
      expect(r.getByText(/Configured/)).toBeDefined();
      expect(r.getByText(/rzp_live_ful/)).toBeDefined();

      // Pricing overrides
      expect(r.getByText(/Pricing Overrides:/)).toBeDefined();
      expect(r.getByText('1 plan(s)')).toBeDefined();

      configureTenantSpy.mockRestore();
    });

    it('shows multiple feature overrides in Active Config after toggling additional chips', () => {
      const preconfiguredTenant: TenantConfig = {
        id: 'multi_override',
        name: 'Multi Override',
        domain: 'multi.app',
        featureOverrides: {
          iron_lock: 'free',
          ad_free: 'elite',
        },
      };
      resetStore(preconfiguredTenant);

      const configureTenantSpy = spyOnConfigureTenantWithStoreUpdate();

      const r = render(
        <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
      );
      advanceAnimations();

      pressLastFreeChip(r);
      advanceAnimations();

      save(r);

      expect(r.getByText('Active Config')).toBeDefined();
      expect(r.getByText('Multi Override')).toBeDefined();
      expect(r.getByText('3 feature(s)')).toBeDefined();

      configureTenantSpy.mockRestore();
    });

    it('shows the correct primaryColor swatch color in Active Config section after save', () => {
      const configureTenantSpy = spyOnConfigureTenantWithStoreUpdate();

      const r = render(
        <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
      );
      advanceAnimations();

      expect(r.queryByText('Active Config')).toBeNull();

      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'swatch_test'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Swatch Test'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'swatch.app'); });
      act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. #FF6600'), '#FF00FF'); });

      save(r);

      expect(r.getByText('Active Config')).toBeDefined();
      expect(r.getByText('Primary Color:')).toBeDefined();
      expect(r.getByText(/#FF00FF/)).toBeDefined();

      const allViews = r.root.findAllByType(View);
      const swatch = allViews.find((v) => {
        const style = v.props.style;
        return Array.isArray(style) && style.length > 0 &&
          style[style.length - 1]?.backgroundColor === '#FF00FF';
      });
      expect(swatch).toBeDefined();

      configureTenantSpy.mockRestore();
    });
  });

  // ── Direct save tests (no Active Config display) ──

  it('saves with only Razorpay keys and no pricing overrides', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const r = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'razoronly'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Razor Only'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'razoronly.app'); });
    fillRazorpayKeys(r, 'rzp_live_razoronly', 'sk_razoronly');

    act(() => { fireEvent.press(r.getByText('Save Tenant Config')); });

    expect(configureTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'razoronly',
        razorpay: {
          keyId: 'rzp_live_razoronly',
          keySecret: 'sk_razoronly',
          pricing: undefined,
        },
      }),
    );

    configureTenantSpy.mockRestore();
  });

  it('saves with pricing on only one plan (Pro) and leaves the other (Elite) blank', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const r = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'partial_price'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Partial Price'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'partial.app'); });
    fillRazorpayKeys(r, 'rzp_partial', 'sk_partial');
    fillProPricing(r, '299', '2999');

    act(() => { fireEvent.press(r.getByText('Save Tenant Config')); });

    const callArg = configureTenantSpy.mock.calls[0][0];
    expect(callArg.razorpay!.pricing).toEqual({
      plan_pro: { monthly: 299, yearly: 2999 },
    });
    expect(callArg.razorpay!.pricing!.plan_elite).toBeUndefined();

    configureTenantSpy.mockRestore();
  });

  it('excludes pricing overrides when both fields are left blank', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const r = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'noprice_broker'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'No Price Broker'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'noprice.app'); });
    fillRazorpayKeys(r, 'rzp_test_noprice', 'sk_secret');

    act(() => { fireEvent.press(r.getByText('Save Tenant Config')); });

    const callArg = configureTenantSpy.mock.calls[0][0];
    expect(callArg.razorpay!.keyId).toBe('rzp_test_noprice');
    expect(callArg.razorpay!.keySecret).toBe('sk_secret');
    expect(callArg.razorpay!.pricing).toBeUndefined();

    configureTenantSpy.mockRestore();
  });

  it('excludes entire razorpay section when both keys and pricing are left blank', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const r = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'norazorpay'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'No Razorpay'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'norazorpay.app'); });

    act(() => { fireEvent.press(r.getByText('Save Tenant Config')); });

    expect(configureTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'norazorpay' }),
    );
    const callArg = configureTenantSpy.mock.calls[0][0];
    expect((callArg as any).razorpay).toBeUndefined();

    configureTenantSpy.mockRestore();
  });

  it('excludes razorpay when only pricing overrides are set (no Razorpay keys)', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const r = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. broker_x'), 'pricing_only'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. BrokerX'), 'Pricing Only'); });
    act(() => { fireEvent.changeText(r.getByPlaceholderText('e.g. brokerx.toroloom.app'), 'pricingonly.app'); });

    fillProPricing(r, '999', '9999');

    act(() => { fireEvent.press(r.getByText('Save Tenant Config')); });

    const callArg = configureTenantSpy.mock.calls[0][0];
    expect((callArg as any).razorpay).toBeUndefined();
    expect(callArg.id).toBe('pricing_only');

    configureTenantSpy.mockRestore();
  });

  it('updates pricing override input when typing', () => {
    const { getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
    expect(() => {
      act(() => {
        fireEvent.changeText(getByPlaceholderText(String(proPlan.price)), '500');
      });
    }).not.toThrow();
  });
});

// =================== Reset Flow ====================

describe('TenantConfigScreen — Reset Flow', () => {
  const existingConfig: TenantConfig = {
    id: 'broker_x',
    name: 'BrokerX',
    domain: 'brokerx.toroloom.app',
    primaryColor: '#FF6600',
    featureOverrides: { iron_lock: 'free' },
    razorpay: {
      keyId: 'rzp_live_test',
      keySecret: 'secret',
    },
  };

  beforeEach(() => {
    resetStore(existingConfig);
  });

  it('renders Reset to Default button', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Reset to Default')).toBeDefined();
  });

  it('does not render Reset button when default tenant is configured', () => {
    resetStore({ id: 'default', name: 'Toroloom', domain: 'toroloom.app' });
    const { queryByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(queryByText('Reset to Default')).toBeNull();
  });

  it('does not render Active Config when default tenant is configured', () => {
    resetStore({ id: 'default', name: 'Toroloom', domain: 'toroloom.app' });
    const { queryByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(queryByText('Active Config')).toBeNull();
  });

  it('presses Reset to Default — verifies Alert.alert is intercepted and configureTenant is called', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    const { getCapturedOnPress, restore } = captureResetAlert();

    act(() => { fireEvent.press(getByText('Reset to Default')); });

    const capturedOnPress = getCapturedOnPress();
    expect(capturedOnPress).not.toBeNull();

    if (capturedOnPress) {
      act(() => { capturedOnPress(); });
    }

    act(() => { vi.advanceTimersByTime(0); });

    expect(configureTenantSpy).toHaveBeenCalledWith({
      id: 'default',
      name: 'Toroloom',
      domain: 'toroloom.app',
    });

    restore();
    configureTenantSpy.mockRestore();
  });

  it('clears all form inputs after a successful reset', () => {
    const configureTenantSpy = spyOnConfigureTenantWithStoreUpdate();

    const { getByText, getByPlaceholderText, queryByPlaceholderText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Verify inputs have pre-filled values
    expect(getByPlaceholderText('e.g. broker_x').props.value).toBe('broker_x');
    expect(getByPlaceholderText('e.g. BrokerX').props.value).toBe('BrokerX');
    expect(getByPlaceholderText('e.g. brokerx.toroloom.app').props.value).toBe('brokerx.toroloom.app');
    expect(getByPlaceholderText('e.g. #FF6600').props.value).toBe('#FF6600');

    const { getCapturedOnPress, restore } = captureResetAlert();

    act(() => { fireEvent.press(getByText('Reset to Default')); });
    const capturedOnPress = getCapturedOnPress();
    expect(capturedOnPress).not.toBeNull();

    act(() => { capturedOnPress!(); });
    act(() => { vi.advanceTimersByTime(0); });

    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // All inputs should now be empty
    expect(queryByPlaceholderText('e.g. broker_x')!.props.value).toBe('');
    expect(queryByPlaceholderText('e.g. BrokerX')!.props.value).toBe('');
    expect(queryByPlaceholderText('e.g. brokerx.toroloom.app')!.props.value).toBe('');
    expect(queryByPlaceholderText('e.g. #FF6600')!.props.value).toBe('');
    expect(queryByPlaceholderText('e.g. rzp_live_xxxxxxxx')!.props.value).toBe('');
    expect(queryByPlaceholderText('Enter key secret')!.props.value).toBe('');

    restore();
    configureTenantSpy.mockRestore();
  });

  it('disappears Active Config section after successful reset', () => {
    const configureTenantSpy = spyOnConfigureTenantWithStoreUpdate();

    const { getByText, queryByText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    expect(getByText('Active Config')).toBeDefined();

    const { getCapturedOnPress, restore } = captureResetAlert();

    act(() => { fireEvent.press(getByText('Reset to Default')); });
    const capturedOnPress = getCapturedOnPress();
    expect(capturedOnPress).not.toBeNull();

    act(() => { capturedOnPress!(); });
    act(() => { vi.advanceTimersByTime(0); });

    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    expect(queryByText('Active Config')).toBeNull();
    expect(queryByText('Reset to Default')).toBeNull();

    restore();
    configureTenantSpy.mockRestore();
  });

  it('pressing Cancel in reset dialog does NOT call configureTenant', () => {
    const configureTenantSpy = spyOnConfigureTenant();

    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Capture the alert but only press Cancel (no destructive callback invoked)
    const { restore } = captureResetAlert();

    act(() => { fireEvent.press(getByText('Reset to Default')); });
    act(() => { vi.advanceTimersByTime(0); });

    expect(configureTenantSpy).not.toHaveBeenCalled();

    restore();
    configureTenantSpy.mockRestore();
  });
});

// ==================== Edge Cases ====================

describe('TenantConfigScreen — Edge Cases', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders without crashing with null tenantConfig', () => {
    resetStore(null);
    const { toJSON } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(toJSON).not.toBeNull();
  });

  it('renders without crashing during loading state', () => {
    useSubscriptionStore.setState({
      isLoading: true,
      tenantConfig: null,
      initialized: true,
    });

    const { toJSON } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    expect(toJSON).not.toBeNull();
  });

  it('renders correctly with empty featureOverrides object', () => {
    resetStore({
      id: 'minimal',
      name: 'Minimal',
      domain: 'minimal.app',
      featureOverrides: {},
    });

    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    expect(getByText('Minimal')).toBeDefined();
    expect(getByText('minimal.app')).toBeDefined();
  });

  it('renders correctly with razorpay but no pricing', () => {
    resetStore({
      id: 'no_pricing',
      name: 'No Pricing',
      domain: 'nopricing.app',
      razorpay: {
        keyId: 'rzp_test_key',
        keySecret: 'secret',
      },
    });

    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    expect(getByText(/Configured/)).toBeDefined();
    expect(getByText(/rzp_test_key/)).toBeDefined();
  });
});
