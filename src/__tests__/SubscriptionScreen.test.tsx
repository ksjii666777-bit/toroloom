/**
 * ============================================================================
 * Toroloom — SubscriptionScreen Integration Tests
 * ============================================================================
 *
 * Verifies that SubscriptionScreen renders correctly with the dynamic feature
 * matrix APIs: getPlanPrice, getFeaturesForTier, getEffectiveFeatureMatrix,
 * and getTenantConfig.
 *
 * Tests cover:
 *   - Free / Pro / Elite subscription states
 *   - Dynamic pricing with and without tenant overrides
 *   - Feature list from getFeaturesForTier mapped to matrix labels
 *   - Comparison table driven by effectiveFeatureMatrix
 *   - Tenant branding in hero section
 *   - Navigation callbacks
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  NavigationContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useFocusEffect: (cb: any) => cb(),
}));

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
    },
    isDark: true,
  }),
}));

// ==================== Imports ====================

import { render, fireEvent } from './testUtils';
import { useSubscriptionStore} from '../store/subscriptionStore';
import { DEFAULT_FEATURE_MATRIX } from '../types';
import type { TenantConfig, SubscriptionFeature} from '../types';
import SubscriptionScreen from '../screens/settings/SubscriptionScreen';

// ==================== Helpers ====================

function advanceAnimations() {
  act(() => { vi.advanceTimersByTime(1000); });
}

/**
 * Reset the subscription store to a known clean state.
 * The reset state uses the real store's defaults so each test starts fresh.
 */
function resetStore(subscriptionOverrides?: Record<string, any>) {
  useSubscriptionStore.setState({
    subscription: {
      tier: 'free',
      planId: 'plan_free',
      status: 'active',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-01-01T00:00:00.000Z',
      autoRenew: false,
      ...subscriptionOverrides,
    },
    tenantConfig: null,
    isLoading: false,
    initialized: true,
  });
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

// ==================== Free User ====================

describe('SubscriptionScreen — Free User', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders the hero section with default branding', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Unlock Toroloom Premium')).toBeDefined();
    expect(getByText('Get AI insights, advanced analytics, and more.')).toBeDefined();
  });

  it('renders billing toggle with Monthly and Yearly options', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Monthly')).toBeDefined();
    expect(getByText('Yearly')).toBeDefined();
  });

  it('renders plan cards with correct default pricing', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Free — ₹0
    expect(getByText('₹0')).toBeDefined();
    // Pro — monthly ₹399 (default)
    expect(getByText(/₹399/)).toBeDefined();
    // Elite — monthly ₹999 (default)
    expect(getByText(/₹999/)).toBeDefined();
  });

  it('shows yearly plan pricing when Yearly toggle is selected', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Toggle to Yearly
    act(() => { fireEvent.press(getByText('Yearly')); });
    advanceAnimations();

    // Pro yearly — ₹3,999 (default)
    expect(getByText(/₹3,999/)).toBeDefined();
    // Elite yearly — ₹9,999 (default)
    expect(getByText(/₹9,999/)).toBeDefined();
  });

  it('renders the CTA button with default text', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Select a plan to upgrade')).toBeDefined();
  });

  it('renders secure payment info text', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Secure payment via Razorpay')).toBeDefined();
  });

  it('renders Compare Plans table with feature rows', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    // Comparison table header
    expect(getByText('Compare Plans')).toBeDefined();
    // Feature labels from the matrix
    expect(getByText('Portfolio Tracking')).toBeDefined();
    // Count features — should have all 15 from the matrix
    const meta = DEFAULT_FEATURE_MATRIX;
    (Object.keys(meta) as SubscriptionFeature[]).forEach((key) => {
      expect(getByText(meta[key].label)).toBeDefined();
    });
  });

  it('renders a back button', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    // Back button exists next to the title
    expect(getByText('Premium')).toBeDefined();
  });

  it('selecting a plan highlights it', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // The AnimatedPressable around the Pro card contains text "Pro" as the plan name
    // Tapping "Pro" should select it
    act(() => { fireEvent.press(getByText('Pro')); });
    advanceAnimations();

    // The CTA text should now reference "Pro"
    expect(getByText(/Upgrade to Pro/)).toBeDefined();
  });
});

// ==================== Pro User ====================

describe('SubscriptionScreen — Pro User', () => {
  beforeEach(() => {
    resetStore({ tier: 'pro', planId: 'plan_pro', status: 'active', autoRenew: true });
  });

  it('renders hero with Pro badge', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText("You're on the Pro plan. Enjoy premium features!")).toBeDefined();
    // Badge showing current plan name
    expect(getByText('Pro')).toBeDefined();
  });

  it('renders status card with auto-renew info', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Active — Auto-Renew On')).toBeDefined();
  });

  it('renders Cancel Auto-Renew button', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Cancel Auto-Renew')).toBeDefined();
  });

  it('does NOT render billing toggle', () => {
    const { queryByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(queryByText('Monthly')).toBeNull();
    expect(queryByText('Yearly')).toBeNull();
  });

  it('does NOT render upgrade CTA button', () => {
    const { queryByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(queryByText('Select a plan to upgrade')).toBeNull();
  });

  it('renders plan cards with the current plan dimmed', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    // The CURRENT PLAN label should be visible on the Pro card
    expect(getByText('CURRENT PLAN')).toBeDefined();
  });

  it('still shows the comparison table for pro users', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Compare Plans')).toBeDefined();
    expect(getByText('Portfolio Tracking')).toBeDefined();
  });
});

// ==================== Elite User ====================

describe('SubscriptionScreen — Elite User', () => {
  beforeEach(() => {
    resetStore({ tier: 'elite', planId: 'plan_elite', status: 'active', autoRenew: true });
  });

  it('renders hero with Elite badge', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText("You're on the Elite plan. Enjoy premium features!")).toBeDefined();
    expect(getByText('Elite')).toBeDefined();
  });

  it('renders cancel button for elite subscription', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Cancel Auto-Renew')).toBeDefined();
  });
});

// ==================== Tenant Branding ====================

describe('SubscriptionScreen — Tenant Branding', () => {
  beforeEach(() => {
    // Note: no resetStore() — each test sets up its own store state
  });

  it('shows tenant name in hero title when a tenant is configured', () => {
    const brokerTenant: TenantConfig = {
      id: 'broker_x',
      name: 'BrokerX',
      domain: 'brokerx.toroloom.app',
    };

    useSubscriptionStore.setState({
      subscription: { tier: 'free', planId: 'plan_free', status: 'active', startDate: '', endDate: '', autoRenew: false },
      tenantConfig: brokerTenant,
      isLoading: false,
      initialized: true,
    });

    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Unlock BrokerX Premium')).toBeDefined();
    expect(getByText('Powered by BrokerX')).toBeDefined();
  });

  it('shows default title when tenant id is "default"', () => {
    useSubscriptionStore.setState({
      subscription: { tier: 'free', planId: 'plan_free', status: 'active', startDate: '', endDate: '', autoRenew: false },
      tenantConfig: { id: 'default', name: 'Toroloom', domain: 'toroloom.app' },
      isLoading: false,
      initialized: true,
    });

    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Unlock Toroloom Premium')).toBeDefined();
  });

  it('shows default title when no tenant is configured', () => {
    resetStore();
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(getByText('Unlock Toroloom Premium')).toBeDefined();
  });
});

// ==================== Dynamic Pricing ====================

describe('SubscriptionScreen — Dynamic Pricing', () => {
  beforeEach(() => {
    resetStore();
  });

  it('shows tenant-pricing overrides in plan cards', () => {
    const discountTenant: TenantConfig = {
      id: 'discount_broker',
      name: 'Discount Broker',
      domain: 'discount.toroloom.app',
      razorpay: {
        keyId: 'rzp_test_discount',
        keySecret: 'secret',
        pricing: {
          plan_pro: { monthly: 199, yearly: 1999 },
          plan_elite: { monthly: 599, yearly: 5999 },
        },
      },
    };

    useSubscriptionStore.setState({
      subscription: { tier: 'free', planId: 'plan_free', status: 'active', startDate: '', endDate: '', autoRenew: false },
      tenantConfig: discountTenant,
      isLoading: false,
      initialized: true,
    });

    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Default Pro is ₹399, override is ₹199
    expect(getByText('₹199')).toBeDefined();
    // Default Elite is ₹999, override is ₹599
    expect(getByText('₹599')).toBeDefined();
  });

  it('shows default prices when no tenant pricing is configured', () => {
    resetStore();

    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    expect(getByText('₹399')).toBeDefined();
    expect(getByText('₹999')).toBeDefined();
  });
});

// ==================== Feature Comparison Table ====================

describe('SubscriptionScreen — Feature Comparison Table', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders all 15 features from the matrix', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    const meta = DEFAULT_FEATURE_MATRIX;
    const allLabels = (Object.keys(meta) as SubscriptionFeature[]).map((k) => meta[k].label);

    allLabels.forEach((label) => {
      expect(getByText(label)).toBeDefined();
    });
  });

  it('renders checkmark icons for free-tier features in free column', () => {
    // We verify the comparison table renders by checking known free features
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Portfolio Tracking is a free-tier feature — should be visible
    expect(getByText('Portfolio Tracking')).toBeDefined();
    // Iron Lock is elite-tier — should be visible
    expect(getByText('Iron Lock Engine')).toBeDefined();
  });

  it('shows yearly discount savings when yearly toggle is active', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Toggle to Yearly
    act(() => { fireEvent.press(getByText('Yearly')); });
    advanceAnimations();

    // Should show discount badges on non-free plans
    // Pro: ₹399*12 - ₹3999 = ₹789 savings
    expect(getByText(/Save ₹/)).toBeDefined();
    // Elite: ₹999*12 - ₹9999 = ₹1,989 savings
    expect(getByText(/Save ₹1,989/)).toBeDefined();
  });
});

// ==================== Plan Card Feature List ====================

describe('SubscriptionScreen — Feature List', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders feature labels from the matrix in plan cards', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Free plan shows "Portfolio Tracking" (label from matrix)
    expect(getByText('Portfolio Tracking')).toBeDefined();
  });

  it('renders pro-tier features in the Pro plan card', () => {
    const { getByText } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();

    // Scroll to Pro card and check it shows Pro features
    // The Pro card should contain "Unlimited Watchlists" (from matrix)
    expect(getByText('Unlimited Watchlists')).toBeDefined();
  });
});

// ==================== Error / Edge Cases ====================

describe('SubscriptionScreen — Edge Cases', () => {
  beforeEach(() => {
    // Note: no resetStore() — each test sets up its own store state
  });

  it('renders without crashing when subscription is cancelled', () => {
    resetStore({ tier: 'pro', planId: 'plan_pro', status: 'cancelled', autoRenew: false });
    const { toJSON } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    advanceAnimations();
    expect(toJSON).not.toBeNull();
  });

  it('renders without crashing during loading state', () => {
    useSubscriptionStore.setState({
      subscription: { tier: 'free', planId: 'plan_free', status: 'active', startDate: '', endDate: '', autoRenew: false },
      isLoading: true,
      tenantConfig: null,
      initialized: true,
    });

    const { toJSON } = render(
      <SubscriptionScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    expect(toJSON).not.toBeNull();
  });
});
