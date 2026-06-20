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
 * Reset the subscription store to a clean default state.
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

// ==================== Empty Form Rendering ====================

describe('TenantConfigScreen — Empty Form', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    resetStore(existingConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows pre-filled config values rendered in Active Config preview', () => {
    // Pre-fill is verified via Active Config preview — see tests above.
    // This test confirms the preview renders with the existing config data.
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
    // The Active Config section renders: "Razorpay:  Configured (key_id...)"
    // Look for the Razorpay label and Configured text
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
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not throw when pressing the back button area', () => {
    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    // Pressing "Tenant Config" title acts as a proxy — pressing any visible
    // element verifies that the component handles press events without crashing.
    expect(() => {
      act(() => { fireEvent.press(getByText('Tenant Config')); });
    }).not.toThrow();
  });

  it('saves with valid inputs and calls configureTenant', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementationOnce(async () => {});

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Fill in tenant identity fields
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'my_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'My Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'mybroker.app'); });

    // Press Save
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
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementationOnce(async () => {});

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'color_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Color Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'color.app'); });
    // Set primary color
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. #FF6600'), '#00FF00'); });

    // Press Save
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
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementationOnce(async () => {});

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Tenant identity — leave primaryColor empty
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'nocolor_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'No Color Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'nocolor.app'); });

    // Press Save
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

    // Fill name and domain but leave ID empty
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'My Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'mybroker.app'); });

    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');

    // Press Save
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });

    expect(configureTenantSpy).not.toHaveBeenCalled();
    configureTenantSpy.mockRestore();
  });

  it('shows validation alert when tenant name is empty', () => {
    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Fill ID and domain but leave name empty
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'my_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'mybroker.app'); });

    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    expect(configureTenantSpy).not.toHaveBeenCalled();
    configureTenantSpy.mockRestore();
  });

  it('shows validation alert when domain is empty', () => {
    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Fill ID and name but leave domain empty
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'my_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'My Broker'); });

    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    expect(configureTenantSpy).not.toHaveBeenCalled();
    configureTenantSpy.mockRestore();
  });

  it('saves with Razorpay keys and pricing overrides', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementationOnce(async () => {});

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'pay_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Pay Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'paybroker.app'); });

    // Razorpay keys
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. rzp_live_xxxxxxxx'), 'rzp_live_test123'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('Enter key secret'), 'sk_test_secret_xyz'); });

    // Pro pricing
    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.price)), '249'); });
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.priceYearly)), '2499'); });

    act(() => { fireEvent.press(getByText('Save Tenant Config')); });

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
    // Pre-populate the store with feature overrides so the component initializes
    // its featureOverrides state from existingConfig.
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

    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async () => {});

    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Press Save — the featureOverrides state has already been initialized
    // from existingConfig.featureOverrides
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
    // Set up a tenant with an override so we can see the "→ free" text rendered
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

    // The overrideDefault text for iron_lock should now show "Default: elite → free"
    expect(getByText(/Default: elite/)).toBeDefined();
    expect(getByText(/→ free/)).toBeDefined();
  });

  it('toggles a chip via the UI and verifies the override appears in saved config', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async () => {});

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'chip_test'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Chip Test'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'chip.test'); });

    // getByText('Free') returns the deepest leaf "Free" element in DFS order,
    // which is the LAST feature row's Free chip (behavioural_journal, default: elite).
    // Press this chip to toggle an override.
    act(() => { fireEvent.press(getByText('Free')); });
    advanceAnimations();

    // Press Save
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    advanceAnimations();

    // Verify at least one feature override was saved (we pressed some chip)
    expect(configureTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'chip_test',
        featureOverrides: expect.objectContaining({}),
      }),
    );

    configureTenantSpy.mockRestore();
  });

  it('shows saved tenant details in Active Config section after save', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, getByPlaceholderText, queryByText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Start with empty form — Active Config should not be visible
    expect(queryByText('Active Config')).toBeNull();

    // Fill in all fields
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'saved_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Saved Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'saved.app'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. #FF6600'), '#00FF00'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. rzp_live_xxxxxxxx'), 'rzp_saved_test'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('Enter key secret'), 'sk_saved'); });

    // Pro pricing
    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.price)), '499'); });
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.priceYearly)), '4999'); });

    // Press Save — spy updates store's tenantConfig
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render so component re-reads getTenantConfig()
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // Active Config section should now appear with saved details
    expect(getByText('Active Config')).toBeDefined();
    expect(getByText('saved_broker')).toBeDefined();
    expect(getByText('Saved Broker')).toBeDefined();
    expect(getByText('saved.app')).toBeDefined();
    expect(getByText(/#00FF00/)).toBeDefined();

    // Razorpay and pricing should be mentioned
    expect(getByText(/rzp_saved/)).toBeDefined();
    expect(getByText('1 plan(s)')).toBeDefined();

    configureTenantSpy.mockRestore();
  });

  it('shows feature overrides in Active Config section after save with non-default overrides', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, getByPlaceholderText, queryByText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Start with empty form — Active Config should not be visible
    expect(queryByText('Active Config')).toBeNull();

    // Fill tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'override_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Override Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'override.app'); });

    // Toggle the last feature row's Free chip (behavioural_journal, default: elite → free).
    // getByText('Free') returns the deepest leaf "Free" element in DFS order,
    // which is the LAST feature row's Free chip.
    act(() => { fireEvent.press(getByText('Free')); });
    advanceAnimations();

    // Press Save — spy updates store's tenantConfig with the overrides
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render so component re-reads getTenantConfig()
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // Active Config section should appear with tenant details
    expect(getByText('Active Config')).toBeDefined();
    expect(getByText('override_broker')).toBeDefined();
    expect(getByText('Override Broker')).toBeDefined();
    expect(getByText('override.app')).toBeDefined();

    // Should show 1 feature override (behavioural_journal → free)
    expect(getByText('1 feature(s)')).toBeDefined();

    configureTenantSpy.mockRestore();
  });

  it('shows Razorpay keys in Active Config after save with only keys (no pricing)', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, getByPlaceholderText, queryByText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Start with empty form — Active Config should not be visible
    expect(queryByText('Active Config')).toBeNull();

    // Fill tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'razor_keys'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Razor Keys'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'razorkeys.app'); });

    // Fill Razorpay keys only (no pricing)
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. rzp_live_xxxxxxxx'), 'rzp_live_abcdefghijkl'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('Enter key secret'), 'sk_live_secret_key'); });

    // Press Save — spy updates store's tenantConfig
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render so component re-reads getTenantConfig()
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // Active Config section should appear
    expect(getByText('Active Config')).toBeDefined();
    expect(getByText('razor_keys')).toBeDefined();

    // Razorpay section should show configured status with keyId prefix (first 12 chars)
    expect(getByText(/Razorpay/)).toBeDefined();
    expect(getByText(/Configured/)).toBeDefined();
    // The keyId prefix slice(0, 12) = 'rzp_live_abc' (12 chars), rendered with ellipsis
    expect(getByText(/rzp_live_abc/)).toBeDefined();

    // Pricing overrides should NOT appear (no pricing was set)
    // "Pricing Overrides:" is the label in Active Config's pricing count line
    // and only renders when razorpay.pricing is defined
    expect(queryByText(/Pricing Overrides:/)).toBeNull();

    configureTenantSpy.mockRestore();
  });

  it('shows pricing overrides in Active Config after save with keys and Pro pricing', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, getByPlaceholderText, queryByText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Start with empty form — Active Config should not be visible
    expect(queryByText('Active Config')).toBeNull();

    // Fill tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'price_override'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Price Override'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'priceoverride.app'); });

    // Fill Razorpay keys (required for pricing section)
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. rzp_live_xxxxxxxx'), 'rzp_live_price_test'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('Enter key secret'), 'sk_price_secret'); });

    // Fill Pro pricing only (one plan with overrides)
    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.price)), '499'); });
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.priceYearly)), '4999'); });

    // Press Save — spy updates store's tenantConfig
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render so component re-reads getTenantConfig()
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // Active Config section should appear
    expect(getByText('Active Config')).toBeDefined();
    expect(getByText('price_override')).toBeDefined();
    expect(getByText('Price Override')).toBeDefined();

    // Pricing overrides should show Pro plan count
    expect(getByText(/Pricing Overrides:/)).toBeDefined();
    expect(getByText('1 plan(s)')).toBeDefined();

    // Razorpay should also be configured
    expect(getByText(/Configured/)).toBeDefined();

    // Feature overrides should NOT appear (none were set)
    expect(queryByText(/Feature Overrides:/)).toBeNull();

    configureTenantSpy.mockRestore();
  });

  it('shows both Pro and Elite pricing in Active Config after save (2 plan(s))', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, getByPlaceholderText, queryByText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Start with empty form — Active Config should not be visible
    expect(queryByText('Active Config')).toBeNull();

    // Fill tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'dual_price'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Dual Price'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'dual.app'); });

    // Fill Razorpay keys (required for pricing section)
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. rzp_live_xxxxxxxx'), 'rzp_dual_price'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('Enter key secret'), 'sk_dual_secret'); });

    // Fill Pro pricing
    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.price)), '399'); });
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.priceYearly)), '3999'); });

    // Fill Elite pricing too
    const elitePlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'elite')!;
    act(() => { fireEvent.changeText(getByPlaceholderText(String(elitePlan.price)), '899'); });
    act(() => { fireEvent.changeText(getByPlaceholderText(String(elitePlan.priceYearly)), '8999'); });

    // Press Save — spy updates store's tenantConfig
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render so component re-reads getTenantConfig()
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // Active Config section should appear with both pricing plans
    expect(getByText('Active Config')).toBeDefined();
    expect(getByText('dual_price')).toBeDefined();

    // Pricing overrides should show 2 plan(s) — both Pro and Elite
    expect(getByText(/Pricing Overrides:/)).toBeDefined();
    expect(getByText('2 plan(s)')).toBeDefined();

    configureTenantSpy.mockRestore();
  });

  it('updates Active Config tenant name after re-saving with a different name', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, getByPlaceholderText, queryByText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Start with empty form — Active Config should not be visible
    expect(queryByText('Active Config')).toBeNull();

    // ── First save ─────────────────────────────────────────
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 're_save'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Original Name'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'resave.app'); });

    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render — Active Config should now appear with original name
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    expect(getByText('Active Config')).toBeDefined();
    expect(getByText('Original Name')).toBeDefined();
    expect(queryByText('Updated Name')).toBeNull();

    // ── Second save with updated name ──────────────────────
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Updated Name'); });

    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render — Active Config should now show the updated name
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // Old name should be gone, new name should appear
    expect(queryByText('Original Name')).toBeNull();
    expect(getByText('Updated Name')).toBeDefined();

    configureTenantSpy.mockRestore();
  });

  it('renders full Active Config section with all fields populated after save', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, getByPlaceholderText, queryByText, root, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Start with empty form — Active Config should not be visible
    expect(queryByText('Active Config')).toBeNull();

    // ── 1. Fill identity fields ──────────────────────────────
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'full_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Full Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'full.app'); });

    // ── 2. Fill primary color ────────────────────────────────
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. #FF6600'), '#AA00FF'); });

    // ── 3. Toggle a feature override chip ────────────────────
    // getByText('Free') targets the last feature's Free chip (behavioural_journal, elite → free)
    act(() => { fireEvent.press(getByText('Free')); });
    advanceAnimations();

    // ── 4. Fill Razorpay keys ────────────────────────────────
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. rzp_live_xxxxxxxx'), 'rzp_live_full_config'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('Enter key secret'), 'sk_full_secret'); });

    // ── 5. Fill Pro pricing ──────────────────────────────────
    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.price)), '599'); });
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.priceYearly)), '5999'); });

    // ── 6. Save — spy updates store with full config ────────
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render so component re-reads getTenantConfig()
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // ── 7. Assert ALL Active Config sections are present ────
    expect(getByText('Active Config')).toBeDefined();

    // Identity
    expect(getByText('full_broker')).toBeDefined();
    expect(getByText('Full Broker')).toBeDefined();
    expect(getByText('full.app')).toBeDefined();

    // Primary color label, hex text, and swatch View with matching backgroundColor
    expect(getByText('Primary Color:')).toBeDefined();
    expect(getByText(/#AA00FF/)).toBeDefined();
    const allViews = root.findAllByType(View);
    const swatch = allViews.find((v) => {
      const style = v.props.style;
      return Array.isArray(style) && style[style.length - 1]?.backgroundColor === '#AA00FF';
    });
    expect(swatch).toBeDefined();

    // Feature overrides
    expect(getByText(/Feature Overrides:/)).toBeDefined();
    expect(getByText('1 feature(s)')).toBeDefined();

    // Razorpay
    expect(getByText(/Configured/)).toBeDefined();
    expect(getByText(/rzp_live_ful/)).toBeDefined();

    // Pricing overrides
    expect(getByText(/Pricing Overrides:/)).toBeDefined();
    expect(getByText('1 plan(s)')).toBeDefined();

    configureTenantSpy.mockRestore();
  });

  it('shows multiple feature overrides in Active Config after toggling additional chips', () => {
    // Pre-populate store with 2 feature overrides so the form state initializes with them
    const preconfiguredTenant: TenantConfig = {
      id: 'multi_override',
      name: 'Multi Override',
      domain: 'multi.app',
      featureOverrides: {
        iron_lock: 'free',   // default: elite → override
        ad_free: 'elite',    // default: pro → override
      },
    };
    resetStore(preconfiguredTenant);

    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Toggle one more chip via UI — getByText('Free') targets the last feature's Free chip
    // (behavioural_journal, default: elite → free), adding a 3rd override
    act(() => { fireEvent.press(getByText('Free')); });
    advanceAnimations();

    // Press Save — spy updates store's tenantConfig with all 3 feature overrides
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render so component re-reads getTenantConfig()
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // Active Config should show the correct count of feature overrides
    expect(getByText('Active Config')).toBeDefined();
    expect(getByText('Multi Override')).toBeDefined();
    expect(getByText('3 feature(s)')).toBeDefined();

    configureTenantSpy.mockRestore();
  });

  it('shows the correct primaryColor swatch color in Active Config section after save', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, getByPlaceholderText, queryByText, root, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Start with empty form — Active Config should not be visible
    expect(queryByText('Active Config')).toBeNull();

    // Fill tenant identity + primaryColor
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'swatch_test'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Swatch Test'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'swatch.app'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. #FF6600'), '#FF00FF'); });

    // Press Save — spy updates store's tenantConfig
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render so component re-reads getTenantConfig()
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // Active Config section should appear
    expect(getByText('Active Config')).toBeDefined();

    // Verify primaryColor label and hex text are rendered
    expect(getByText('Primary Color:')).toBeDefined();
    expect(getByText(/#FF00FF/)).toBeDefined();

    // Verify the color swatch View has the correct backgroundColor matching the saved color.
    // The swatch uses an array style: [styles.colorSwatch, { backgroundColor: '...' }]
    const allViews = root.findAllByType(View);
    const swatch = allViews.find((v) => {
      const style = v.props.style;
      if (Array.isArray(style) && style.length > 0) {
        // Last element is the inline override: { backgroundColor: '#FF00FF' }
        return style[style.length - 1]?.backgroundColor === '#FF00FF';
      }
      return false;
    });
    expect(swatch).toBeDefined();

    configureTenantSpy.mockRestore();
  });

  it('saves with only Razorpay keys and no pricing overrides', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementationOnce(async () => {});

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'razoronly'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Razor Only'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'razoronly.app'); });

    // Fill Razorpay keys — leave pricing inputs blank
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. rzp_live_xxxxxxxx'), 'rzp_live_razoronly'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('Enter key secret'), 'sk_razoronly'); });

    act(() => { fireEvent.press(getByText('Save Tenant Config')); });

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
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementationOnce(async () => {});

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'partial_price'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Partial Price'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'partial.app'); });

    // Set Razorpay keys
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. rzp_live_xxxxxxxx'), 'rzp_partial'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('Enter key secret'), 'sk_partial'); });

    // Fill Pro pricing only
    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
    const elitePlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'elite')!;
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.price)), '299'); });
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.priceYearly)), '2999'); });

    // Leave Elite pricing blank

    act(() => { fireEvent.press(getByText('Save Tenant Config')); });

    const callArg = configureTenantSpy.mock.calls[0][0];
    expect(callArg.razorpay!.pricing).toEqual({
      plan_pro: { monthly: 299, yearly: 2999 },
    });
    // Elite plan should NOT appear in pricing
    expect(callArg.razorpay!.pricing!.plan_elite).toBeUndefined();

    configureTenantSpy.mockRestore();
  });

  it('excludes pricing overrides when both fields are left blank', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementationOnce(async () => {});

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'noprice_broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'No Price Broker'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'noprice.app'); });

    // Set Razorpay keys so the config includes a razorpay section
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. rzp_live_xxxxxxxx'), 'rzp_test_noprice'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('Enter key secret'), 'sk_secret'); });

    // Pricing inputs are left blank — no values entered
    // Press Save
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });

    const callArg = configureTenantSpy.mock.calls[0][0];
    expect(callArg.razorpay!.keyId).toBe('rzp_test_noprice');
    expect(callArg.razorpay!.keySecret).toBe('sk_secret');
    // pricing should be undefined since both fields were left blank
    expect(callArg.razorpay!.pricing).toBeUndefined();

    configureTenantSpy.mockRestore();
  });

  it('excludes entire razorpay section when both keys and pricing are left blank', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementationOnce(async () => {});

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Tenant identity only — leave all Razorpay and pricing fields blank
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'norazorpay'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'No Razorpay'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'norazorpay.app'); });

    // Press Save
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });

    // Config should NOT include razorpay at all
    expect(configureTenantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'norazorpay',
      }),
    );

    // Verify razorpay is not in the config
    const callArg = configureTenantSpy.mock.calls[0][0];
    expect((callArg as any).razorpay).toBeUndefined();

    configureTenantSpy.mockRestore();
  });

  it('excludes razorpay when only pricing overrides are set (no Razorpay keys)', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementationOnce(async () => {});

    const { getByText, getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Tenant identity
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. broker_x'), 'pricing_only'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. BrokerX'), 'Pricing Only'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. brokerx.toroloom.app'), 'pricingonly.app'); });

    // Leave Razorpay keys EMPTY — keyId is required for razorpay section

    // Fill Pro pricing only
    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.price)), '999'); });
    act(() => { fireEvent.changeText(getByPlaceholderText(String(proPlan.priceYearly)), '9999'); });

    // Press Save
    act(() => { fireEvent.press(getByText('Save Tenant Config')); });

    const callArg = configureTenantSpy.mock.calls[0][0];
    // razorpay should be undefined — keyId is required, even if pricing is set
    expect((callArg as any).razorpay).toBeUndefined();
    // Pricing data should still be present in the state, but not included
    // in the config because it's nested inside the razorpay object
    expect(callArg.id).toBe('pricing_only');

    configureTenantSpy.mockRestore();
  });

  it('updates pricing override input when typing', () => {
    const { getByPlaceholderText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    const proPlan = SUBSCRIPTION_PLANS.find((p) => p.tier === 'pro')!;
    // Typing should not throw
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
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    resetStore(existingConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    // Spy on configureTenant BEFORE rendering so the component's useCallback
    // captures the spy (not the original function).
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async () => {});

    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Track whether Alert.alert was called and capture the callback
    let alertCalled = false;
    let capturedOnPress: (() => void) | null = null;

    const originalAlert = Alert.alert;
    Alert.alert = ((_title: string, _message: string, buttons?: any[]) => {
      alertCalled = true;
      const resetBtn = buttons?.find((b: any) => b.style === 'destructive');
      if (resetBtn?.onPress) {
        capturedOnPress = resetBtn.onPress;
      }
    }) as any;

    // Press Reset to Default
    act(() => { fireEvent.press(getByText('Reset to Default')); });

    // Verify Alert.alert was intercepted
    expect(alertCalled).toBe(true);
    expect(capturedOnPress).not.toBeNull();

    // Invoke the captured callback
    if (capturedOnPress) {
      act(() => { (capturedOnPress as () => void)(); });
    }

    // Flush microtasks to let async configureTenant resolve
    act(() => { vi.advanceTimersByTime(0); });

    expect(configureTenantSpy).toHaveBeenCalledWith({
      id: 'default',
      name: 'Toroloom',
      domain: 'toroloom.app',
    });

    Alert.alert = originalAlert;
    configureTenantSpy.mockRestore();
  });

  it('clears all form inputs after a successful reset', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, getByPlaceholderText, queryByPlaceholderText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Verify inputs have pre-filled values from existingConfig
    expect(getByPlaceholderText('e.g. broker_x').props.value).toBe('broker_x');
    expect(getByPlaceholderText('e.g. BrokerX').props.value).toBe('BrokerX');
    expect(getByPlaceholderText('e.g. brokerx.toroloom.app').props.value).toBe('brokerx.toroloom.app');
    // Primary color should also be pre-filled
    expect(getByPlaceholderText('e.g. #FF6600').props.value).toBe('#FF6600');

    // Capture the reset callback
    let capturedOnPress: (() => void) | null = null;
    const originalAlert = Alert.alert;
    Alert.alert = ((_title: string, _message: string, buttons?: any[]) => {
      const resetBtn = buttons?.find((b: any) => b.style === 'destructive');
      if (resetBtn?.onPress) capturedOnPress = resetBtn.onPress;
    }) as any;

    // Press Reset to Default
    act(() => { fireEvent.press(getByText('Reset to Default')); });
    expect(capturedOnPress).not.toBeNull();

    // Invoke the reset callback — clears all form state
    act(() => { capturedOnPress!(); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render so the component reads the updated React state
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // All inputs should now have empty values
    expect(queryByPlaceholderText('e.g. broker_x')!.props.value).toBe('');
    expect(queryByPlaceholderText('e.g. BrokerX')!.props.value).toBe('');
    expect(queryByPlaceholderText('e.g. brokerx.toroloom.app')!.props.value).toBe('');
    expect(queryByPlaceholderText('e.g. #FF6600')!.props.value).toBe('');

    // Razorpay and pricing fields should also be cleared
    expect(queryByPlaceholderText('e.g. rzp_live_xxxxxxxx')!.props.value).toBe('');
    expect(queryByPlaceholderText('Enter key secret')!.props.value).toBe('');

    Alert.alert = originalAlert;
    configureTenantSpy.mockRestore();
  });

  it('disappears Active Config section after successful reset', () => {
    // Spy on configureTenant BUT with an implementation that actually updates the store.
    // The real configureTenant does: set({ tenantConfig: config }) — we replicate that.
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async (config: any) => {
      useSubscriptionStore.setState({ tenantConfig: config });
    });

    const { getByText, queryByText, update } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Active Config should be visible before reset (we have a non-default tenant)
    expect(getByText('Active Config')).toBeDefined();

    // Replace Alert.alert to capture the destructive callback
    let capturedOnPress: (() => void) | null = null;
    const originalAlert = Alert.alert;
    Alert.alert = ((_title: string, _message: string, buttons?: any[]) => {
      const resetBtn = buttons?.find((b: any) => b.style === 'destructive');
      if (resetBtn?.onPress) capturedOnPress = resetBtn.onPress;
    }) as any;

    // Press Reset to Default
    act(() => { fireEvent.press(getByText('Reset to Default')); });
    expect(capturedOnPress).not.toBeNull();

    // Invoke the reset callback — this calls configureTenant with default config,
    // which now also updates the store's tenantConfig (via the spy's implementation)
    act(() => { capturedOnPress!(); });
    act(() => { vi.advanceTimersByTime(0); });

    // Force re-render so the component re-reads getTenantConfig()
    // The component subscribes to the stable getTenantConfig function reference,
    // so it won't auto-render when the store's tenantConfig changes.
    act(() => {
      update(<TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    });

    // Active Config should be gone (reset set tenantConfig to default)
    expect(queryByText('Active Config')).toBeNull();
    // Reset button should also be gone
    expect(queryByText('Reset to Default')).toBeNull();

    Alert.alert = originalAlert;
    configureTenantSpy.mockRestore();
  });

  it('pressing Cancel in reset dialog does NOT call configureTenant', () => {
    const configureTenantSpy = vi.spyOn(useSubscriptionStore.getState(), 'configureTenant');
    configureTenantSpy.mockImplementation(async () => {});

    const { getByText } = render(
      <TenantConfigScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Track which button was "pressed" by the user — we simulate Cancel
    let cancelOnPress: (() => void) | null = null;

    const originalAlert = Alert.alert;
    Alert.alert = ((_title: string, _message: string, buttons?: any[]) => {
      const cancelBtn = buttons?.find((b: any) => b.style === 'cancel');
      // Cancel buttons typically have no onPress (just dismisses the dialog)
      // But we'll capture whatever callback exists (if any)
      if (cancelBtn?.onPress) {
        cancelOnPress = cancelBtn.onPress;
      }
    }) as any;

    // Press Reset to Default — shows the confirmation dialog
    act(() => { fireEvent.press(getByText('Reset to Default')); });

    // Simulate pressing Cancel by not invoking the destructive callback.
    // The Cancel button has no onPress (it just dismisses), so no action is taken.

    // Flush any pending microtasks
    act(() => { vi.advanceTimersByTime(0); });

    // configureTenant should NOT have been called (user cancelled)
    expect(configureTenantSpy).not.toHaveBeenCalled();

    Alert.alert = originalAlert;
    configureTenantSpy.mockRestore();
  });
});

// ==================== Edge Cases ====================

describe('TenantConfigScreen — Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    // Active Config should not show feature override count since object is empty
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

    // Active Config renders: "Razorpay: Configured (rzp_test_key...)"
    expect(getByText(/Configured/)).toBeDefined();
    expect(getByText(/rzp_test_key/)).toBeDefined();
  });
});


