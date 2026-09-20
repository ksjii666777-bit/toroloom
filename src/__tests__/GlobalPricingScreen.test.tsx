/**
 * ============================================================================
 * Toroloom — GlobalPricingScreen Tests
 * ============================================================================
 *
 * Renders the REAL screen with the REAL geoPricingStore + REAL price book
 * (only platform/theme/i18n mocked). Covers the geo-pricing journey:
 *   - India default: ₹ prices, Razorpay upgrade CTA, auto-detected badge
 *   - Region chip override: US → $ prices, Stripe waitlist CTA
 *   - Billing toggle: yearly shows the savings pill and yearly totals
 *   - Override reaches the store (persisted state)
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { paymentsApi } from '../services/api/payments';

vi.mock('../utils/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

vi.mock('../services/api/payments', () => ({
  paymentsApi: {
    createStripeCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_123' })),
    createStripePortalSession: vi.fn(),
  },
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', danger: '#FF5252', warning: '#FFAB40',
      success: '#00E676', text: '#FFFFFF', textSecondary: '#9CA3AF',
      textMuted: '#6B7280', background: '#0B0F1A', surface: '#111827',
      border: '#1F2937',
    },
  }),
}));

const pricingMap: Record<string, string> = {
  'globalPricing.title': 'Global Pricing',
  'globalPricing.subtitle': 'Same product, fair local prices',
  'globalPricing.chooseRegion': 'Choose your region',
  'globalPricing.autoDetected': 'Auto',
  'globalPricing.regionIndia': 'India',
  'globalPricing.regionUs': 'United States',
  'globalPricing.regionEu': 'Europe',
  'globalPricing.billingMonthly': 'Monthly',
  'globalPricing.billingYearly': 'Yearly',
  'globalPricing.savePct': 'Save {{pct}}%',
  'globalPricing.perMonth': '/mo',
  'globalPricing.perYear': '/yr',
  'globalPricing.billedYearly': 'Billed {{price}} yearly',
  'globalPricing.ctaUpgradeIn': 'Upgrade — UPI / Card',
  'globalPricing.ctaCheckout': 'Subscribe — Card',
  'globalPricing.ctaWaitlist': 'Join the waitlist',
  'globalPricing.ctaCurrentPlan': 'Your current plan',
  'globalPricing.checkoutFailedTitle': 'Checkout unavailable',
  'globalPricing.checkoutFailedBody': 'We could not start the payment session. You have been added to our list and we will reach out shortly.',
  'globalPricing.waitlistNote': 'Payments are processed securely by Stripe. Local taxes (VAT/GST) are calculated at checkout.',
  'globalPricing.waitlistSuccess': 'Thanks! We will notify you when international checkout goes live.',
  'globalPricing.badgePopular': 'POPULAR',
  'globalPricing.badgeBestValue': 'BEST VALUE',
  'globalPricing.regionNoteIn': 'Prices in Indian Rupees. Charged in INR via Razorpay. GST as applicable is added at checkout.',
  'globalPricing.regionNoteGlobal': 'Prices in {{currency}}. Local taxes (VAT/GST) are added at checkout where applicable.',
  'globalPricing.fxNote': 'Prices are set per region — they are not live currency conversions, so local value stays fair.',
  'globalPricing.a11yRegionChip': 'Pricing region {{region}}',
  'globalPricing.a11yBillingToggle': 'Switch billing period',
  'globalPricing.a11yPlanCard': '{{plan}} plan, {{price}} per {{period}}',
};

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      let text = pricingMap[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return text;
    },
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

import GlobalPricingScreen from '../screens/settings/GlobalPricingScreen';
import { useGeoPricingStore } from '../store/geoPricingStore';

function renderScreen() {
  return render(<GlobalPricingScreen />);
}

describe('GlobalPricingScreen — geo-priced tiers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  });

  it('auto-detects India, shows ₹ prices and the Razorpay upgrade CTA', async () => {
    await useGeoPricingStore.getState().initialize('Asia/Kolkata');
    const { getByText } = renderScreen();

    expect(getByText('India')).toBeDefined();
    expect(getByText('₹399')).toBeDefined();
    expect(getByText('₹999')).toBeDefined();
    expect(getByText('Upgrade — UPI / Card')).toBeDefined();
    expect(getByText('Prices in Indian Rupees. Charged in INR via Razorpay. GST as applicable is added at checkout.')).toBeDefined();
    // Auto-detected badge on the active chip
    expect(getByText('Auto')).toBeDefined();
  });

  it('switches to the US region on chip tap: $ prices, Stripe checkout CTA, USD footnote', async () => {
    await useGeoPricingStore.getState().initialize('Asia/Kolkata');
    const { getByText, queryByText } = renderScreen();

    fireEvent.press(getByText('United States'));

    expect(useGeoPricingStore.getState().regionOverride).toBe('us');
    expect(getByText('$29')).toBeDefined();
    expect(getByText('$79')).toBeDefined();
    expect(getByText('Subscribe — Card')).toBeDefined();
    expect(queryByText('Upgrade — UPI / Card')).toBeNull();
    expect(getByText('Prices in USD. Local taxes (VAT/GST) are added at checkout where applicable.')).toBeDefined();
    expect(getByText('Payments are processed securely by Stripe. Local taxes (VAT/GST) are calculated at checkout.')).toBeDefined();
  });

  it('US checkout CTA opens the Stripe session URL with the pressed plan and region', async () => {
    await useGeoPricingStore.getState().initialize('America/New_York');
    const { getAllByText } = renderScreen();

    // Press the FIRST paid plan's checkout CTA (elite card renders first) — deepest Text match
    const ctas = getAllByText('Subscribe — Card');
    fireEvent.press(ctas[ctas.length - 1]);
    // The checkout handler is async — flush microtasks before asserting
    await new Promise(r => setTimeout(r, 0));

    expect(paymentsApi.createStripeCheckoutSession).toHaveBeenCalledWith('plan_elite', 'monthly', 'us');
    expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_123');
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('falls back to the waitlist alert + mailto when the checkout session fails', async () => {
    await useGeoPricingStore.getState().initialize('America/New_York');
    const { getAllByText } = renderScreen();

    (paymentsApi.createStripeCheckoutSession as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('503'));

    const ctas = getAllByText('Subscribe — Card');
    fireEvent.press(ctas[ctas.length - 1]);
    await new Promise(r => setTimeout(r, 0));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Checkout unavailable',
      'We could not start the payment session. You have been added to our list and we will reach out shortly.',
    );
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('mailto:support@toroloom.com'),
    );
  });

  it('billing toggle to yearly shows the savings pill and yearly totals', async () => {
    await useGeoPricingStore.getState().initialize('Asia/Kolkata');
    const { getByText } = renderScreen();

    fireEvent.press(getByText('Yearly'));

    // Pill shows the BEST saving across paid tiers: pro 16%, elite 17%.
    expect(getByText('Save 17%')).toBeDefined();
    expect(getByText('₹3,999')).toBeDefined();
    expect(getByText('₹9,999')).toBeDefined();
    expect(getByText('Billed ₹3,999 yearly')).toBeDefined();
  });

  it('shows the free tier with a current-plan label instead of a purchase CTA', async () => {
    await useGeoPricingStore.getState().initialize('Asia/Kolkata');
    const { getByText } = renderScreen();

    expect(getByText('Free')).toBeDefined();
    expect(getByText('Your current plan')).toBeDefined();
  });
});
