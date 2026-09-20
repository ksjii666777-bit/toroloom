/**
 * Toroloom — Global Pricing i18n (Hindi)
 *
 * Geo-priced tiers: India (INR/Razorpay) vs US / EU (USD/EUR, Stripe soon).
 * Keys must stay in exact parity with locales/en/globalPricing.ts.
 */

export default {
  globalPricing: {
    title: 'ग्लोबल प्राइसिंग',
    subtitle: 'एक ही प्रोडक्ट, हर देश के हिसाब से सही कीमत',

    // Region picker
    chooseRegion: 'अपना क्षेत्र चुनें',
    autoDetected: 'ऑटो',
    regionIndia: 'भारत',
    regionUs: 'संयुक्त राज्य अमेरिका',
    regionEu: 'यूरोप',

    // Billing toggle
    billingMonthly: 'मासिक',
    billingYearly: 'वार्षिक',
    savePct: '{{pct}}% बचत',

    // Price labels
    perMonth: '/माह',
    perYear: '/वर्ष',
    billedYearly: 'वार्षिक {{price}} बिल होगा',

    // Plan CTAs
    ctaUpgradeIn: 'अपग्रेड करें — UPI / कार्ड',
    ctaCheckout: 'सब्सक्राइब करें — कार्ड',
    ctaWaitlist: 'वेटलिस्ट में जुड़ें',
    ctaCurrentPlan: 'आपका मौजूदा प्लान',
    waitlistNote: 'भुगतान सुरक्षित रूप से Stripe द्वारा संसाधित होते हैं। स्थानीय कर (VAT/GST) चेकआउट पर जुड़े जाते हैं।',
    waitlistSuccess: 'धन्यवाद! अंतरराष्ट्रीय चेकआउट लाइव होने पर हम सूचित करेंगे।',
    checkoutFailedTitle: 'चेकआउट उपलब्ध नहीं',
    checkoutFailedBody: 'भुगतान सत्र शुरू नहीं हो सका। आप हमारी सूची में जुड़ गए हैं — हम जल्द संपर्क करेंगे।',

    // Badges (map plan.badge to localised text)
    badgePopular: 'लोकप्रिय',
    badgeBestValue: 'सर्वोत्तम मूल्य',

    // Footnotes
    regionNoteIn: 'कीमतें भारतीय रुपये में हैं। Razorpay से INR में भुगतान। लागू GST चेकआउट पर जुड़ेगा।',
    regionNoteGlobal: 'कीमतें {{currency}} में हैं। जहाँ लागू हो, स्थानीय कर (VAT/GST) चेकआउट पर जुड़ेगा।',
    fxNote: 'कीमतें हर क्षेत्र के लिए अलग तय हैं — ये लाइव करेंसी कन्वर्ज़न नहीं हैं, ताकि हर जगह कीमत सही रहे।',

    // Accessibility
    a11yRegionChip: 'प्राइसिंग क्षेत्र {{region}}',
    a11yBillingToggle: 'बिलिंग अवधि बदलें',
    a11yPlanCard: '{{plan}} प्लान, प्रति {{period}} {{price}}',
  },
};
