/**
 * ============================================================================
 * Toroloom — Legal i18n Translations (English)
 * ============================================================================
 *
 * In-app Privacy Policy, Terms of Service and SEBI disclaimer screen.
 * Flat keys rendered by LegalScreen (route param selects the section).
 * Body strings support \n for paragraph breaks.
 *
 * ⚠️ TEMPLATE CONTENT — have a lawyer review before public launch.
 * Contact placeholders (grievance officer, email, address) MUST be replaced
 * with real values before store submission.
 * ============================================================================
 */

const legal = {
    title: 'Legal & Disclosures',
    subtitle: 'Policies, terms and regulatory disclosures',
    updated: 'Last updated: September 2026',
    contactIntro: 'Questions about this document? Write to us:',
    contactEmail: 'legal@toroloom.com',

    // Section picker
    navToc: 'Terms of Service',
    navPrivacy: 'Privacy Policy',
    navSebi: 'SEBI Disclaimer',
    openSection: 'Open',

    // ── Terms of Service ──────────────────────────────────────────────
    tocTitle: 'Terms of Service',
    tocIntro:
        'These Terms of Service ("Terms") govern your use of the Toroloom mobile application and related services. By creating an account or using the app, you agree to be bound by these Terms.',
    tocAccept: 'Acceptance of Terms',
    tocAcceptBody:
        'By accessing or using Toroloom, you confirm that you have read, understood and accepted these Terms, our Privacy Policy and all applicable regulatory disclosures. If you do not agree, you must stop using the app.',
    tocEligibility: 'Eligibility',
    tocEligibilityBody:
        'You must be at least 18 years old, a resident of India, and legally capable of entering into binding contracts. Trading and investment accounts can only be opened after completing KYC as required by SEBI, PMLA and applicable exchange rules.',
    tocAccount: 'Your Account',
    tocAccountBody:
        'You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. Notify us immediately of any unauthorised use. Providing false information during onboarding may lead to account suspension and reporting to authorities.',
    tocTradingRisk: 'Trading & Investment Risk',
    tocTradingRiskBody:
        'Trading in securities, derivatives and other instruments involves substantial risk of loss. Past performance is not indicative of future results. Toroloom provides tools, analytics and educational content — none of it is investment advice. All trade decisions are yours alone.',
    tocFees: 'Fees & Charges',
    tocFeesBody:
        'Applicable brokerage, statutory levies, taxes (including GST) and payment gateway charges are disclosed before you confirm a transaction and in your contract notes. Fees may change with prior notice as per regulatory requirements.',
    tocConduct: 'Acceptable Use',
    tocConductBody:
        'You agree not to misuse the platform: no market manipulation, no unauthorised automated access, no reverse engineering, and no use of the service for any unlawful purpose. Violations may result in immediate termination.',
    tocTermination: 'Suspension & Termination',
    tocTerminationBody:
        'We may suspend or terminate your access for breach of these Terms, regulatory requirements, or suspicious activity as required under PMLA. You may close your account at any time; statutory records will be retained as required by law.',
    tocLiability: 'Limitation of Liability',
    tocLiabilityBody:
        'To the maximum extent permitted by law, Toroloom is not liable for indirect, incidental or consequential losses, loss of profits, or trading losses arising from market movements, system outages, broker execution failures or internet connectivity issues.',
    tocChanges: 'Changes to These Terms',
    tocChangesBody:
        'We may update these Terms to reflect legal, regulatory or product changes. Material changes will be communicated in-app before taking effect. Continued use after the effective date constitutes acceptance.',

    // ── Privacy Policy ────────────────────────────────────────────────
    ppTitle: 'Privacy Policy',
    ppIntro:
        'This Privacy Policy explains what personal data Toroloom collects, why we collect it, and the rights you have over your data. We are committed to protecting your privacy and complying with the Digital Personal Data Protection Act, 2023.',
    ppCollect: 'Data We Collect',
    ppCollectBody:
        '• Identity & KYC data: name, PAN, date of birth, address and documents you submit.\n• Contact data: email address and phone number.\n• Financial data: bank details, broker connections and transaction history you choose to import.\n• Usage data: app interactions, device identifiers, crash and performance logs.\n• Trading journal data: notes, plans and reflections you record in the app.',
    ppUse: 'How We Use Your Data',
    ppUseBody:
        'We use your data to operate the app, verify your identity, connect to your broker with your consent, calculate tax estimates, generate your personal discipline reports, provide support, prevent fraud, and meet legal obligations. We do not sell your personal data.',
    ppShare: 'Sharing & Disclosure',
    ppShareBody:
        'Your data is shared only with: service providers who help us run the app (hosting, payments, notifications, crash reporting) under strict confidentiality; your connected broker, only for actions you authorise; and regulators or law-enforcement where legally required.',
    ppStorage: 'Storage & Security',
    ppStorageBody:
        'Data is encrypted in transit (TLS) and at rest. Access to personal data is restricted to personnel who need it. We retain data only as long as needed for the purposes above and as required by SEBI/exchange record-keeping rules.',
    ppRights: 'Your Rights',
    ppRightsBody:
        'You may access, correct or export your data, withdraw broker connections, and delete your account with full data erasure from in-app Settings. Certain records we are legally required to keep may be retained in an isolated, access-restricted form after deletion.',

    // ── SEBI Disclaimer ───────────────────────────────────────────────
    sebiTitle: 'SEBI Disclaimer & Risk Disclosures',
    sebiIntro:
        'Toroloom is a technology platform offering portfolio tracking, analytics, journaling and educational content. Toroloom is not a stockbroker, investment adviser or research analyst, and does not execute trades.',
    sebiNotAdvice: 'No Investment Advice',
    sebiNotAdviceBody:
        'Nothing in this app — including AI insights, screeners, news analysis or discipline reports — constitutes investment advice, a research report, or a recommendation to buy or sell any security under the SEBI (Investment Advisers) Regulations, 2013 or SEBI (Research Analysts) Regulations, 2014. Consult a SEBI-registered investment adviser before making financial decisions.',
    sebiMarketRisk: 'Market Risk Disclosure',
    sebiMarketRiskBody:
        'Investments in securities markets are subject to market risks. Read all related documents carefully before investing. Derivatives (F&O) are particularly risky — 9 out of 10 individual traders in equity F&O lose money, per SEBI studies. Trade only with capital you can afford to lose.',
    sebiBrokerage: 'Broker Relationship',
    sebiBrokerageBody:
        'All order execution, margin, settlement and custody services are provided by your SEBI-registered broker, connected through your explicit authorisation. Toroloom does not hold client funds or securities. Your rights and protections come from your broker agreement and exchange rules.',
    sebiGrievance: 'Grievance Redressal',
    sebiGrievanceBody:
        'For complaints: contact our support team first (in-app Help). Unresolved grievances may be escalated to SEBI SCORES (scores.gov.in) or the relevant exchange. We acknowledge complaints within 24 hours and aim to resolve them within 21 days, per SEBI guidelines.',

    // ── ToS re-acceptance overlay (shown when the accepted version is outdated) ──
    reacceptanceTitle: 'Our terms have changed',
    reacceptanceBody:
        'We have updated our Terms of Service and Privacy Policy. Please review the changes and accept the updated terms to continue using Toroloom.',
    reacceptanceReview: 'Review updated terms',
    reacceptanceAccept: 'Accept updated terms',
};

export default legal;
