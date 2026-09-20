/**
 * Toroloom — Global Pricing i18n (English)
 *
 * Geo-priced tiers: India (INR/Razorpay) vs US / EU (USD/EUR, Stripe soon).
 * Keys must stay in exact parity with locales/hi/globalPricing.ts.
 */

export default {
  globalPricing: {
    title: 'Global Pricing',
    subtitle: 'Same product, fair local prices',

    // Region picker
    chooseRegion: 'Choose your region',
    autoDetected: 'Auto',
    regionIndia: 'India',
    regionUs: 'United States',
    regionEu: 'Europe',

    // Billing toggle
    billingMonthly: 'Monthly',
    billingYearly: 'Yearly',
    savePct: 'Save {{pct}}%',

    // Price labels
    perMonth: '/mo',
    perYear: '/yr',
    billedYearly: 'Billed {{price}} yearly',

    // Plan CTAs
    ctaUpgradeIn: 'Upgrade — UPI / Card',
    ctaCheckout: 'Subscribe — Card',
    ctaWaitlist: 'Join the waitlist',
    ctaCurrentPlan: 'Your current plan',
    waitlistNote: 'Payments are processed securely by Stripe. Local taxes (VAT/GST) are calculated at checkout.',
    waitlistSuccess: 'Thanks! We will notify you when international checkout goes live.',
    checkoutFailedTitle: 'Checkout unavailable',
    checkoutFailedBody: 'We could not start the payment session. You have been added to our list and we will reach out shortly.',

    // Badges (map plan.badge to localised text)
    badgePopular: 'POPULAR',
    badgeBestValue: 'BEST VALUE',

    // Footnotes
    regionNoteIn: 'Prices in Indian Rupees. Charged in INR via Razorpay. GST as applicable is added at checkout.',
    regionNoteGlobal: 'Prices in {{currency}}. Local taxes (VAT/GST) are added at checkout where applicable.',
    fxNote: 'Prices are set per region — they are not live currency conversions, so local value stays fair.',

    // Accessibility
    a11yRegionChip: 'Pricing region {{region}}',
    a11yBillingToggle: 'Switch billing period',
    a11yPlanCard: '{{plan}} plan, {{price}} per {{period}}',
  },
};
