/**
 * Toroloom — Global Tax & Charges Education i18n (English)
 *
 * Education module for Indian residents investing in global stocks:
 * LRS, TCS, capital gains, dividend withholding, broker/forex charges
 * and Schedule FA reporting. Rendered by GlobalTaxEducationScreen.
 * Keys must stay in exact parity with locales/hi/taxEducation.ts.
 *
 * ⚠️ EDUCATIONAL CONTENT — rates current as of September 2026 (post-Budget
 * 2024 rules). Not tax advice; users should verify with a qualified CA.
 */

const taxEd = {
    title: 'Global Investing — Taxes & Charges',
    subtitle: 'What it really costs to own US & global stocks from India',
    updated: 'Rates as of September 2026 — verify with a CA before filing',
    disclaimer:
        'This is educational information, not tax advice. Tax rules change — always confirm your personal situation with a qualified chartered accountant.',

    // Section picker
    navLrs: 'LRS — Sending Money Abroad',
    navTcs: 'TCS — The 20% That Comes Back',
    navGains: 'Capital Gains Tax',
    navDividend: 'Dividend Tax',
    navCharges: 'Broker & Forex Charges',
    navFa: 'Schedule FA — Mandatory Reporting',

    // ── LRS ────────────────────────────────────────────────────────────
    lrsWhat: 'What is LRS?',
    lrsWhatBody:
        'The Liberalised Remittance Scheme is the RBI window that lets every Indian resident send money abroad for investments, education or travel. All overseas stock investing from India legally happens through LRS — your broker or platform routes your rupees through an authorised dealer bank under this scheme.',
    lrsLimit: 'How much can you send?',
    lrsLimitBody:
        'Up to USD 250,000 per financial year (April–March) per person. Family members each get their own separate limit, so a family of four can collectively remit up to a million dollars a year. There is no minimum.',
    lrsPurpose: 'What counts as investment?',
    lrsPurposeBody:
        'Buying foreign stocks, ETFs, mutual funds and (within limits) crypto all count as permissible capital-account transactions. You cannot use LRS for margin trading, futures & options abroad, or lotteries — these are explicitly prohibited by RBI.',
    lrsCaution: 'Common mistake to avoid',
    lrsCautionBody:
        'Do not leave remitted money idle in the foreign broker account beyond what RBI allows, and never route money through friends\' accounts or hawala channels — both violate FEMA and can attract heavy penalties. Always remit from your own bank account to your own broker account.',

    // ── TCS ────────────────────────────────────────────────────────────
    tcsWhat: 'What is TCS here?',
    tcsWhatBody:
        'When your bank processes an LRS remittance above the threshold, it must collect Tax Collected at Source before sending the money. This confuses many investors because the amount debited is larger than the amount that lands with the broker.',
    tcsThreshold: 'Current rates',
    tcsThresholdBody:
        '0% on the first ₹7,00,000 remitted in a financial year for investment purposes. Above ₹7,00,000, 20% TCS applies to the excess. Education and medical remittances have separate, softer rules.',
    tcsCredit: 'The good news — you get it back',
    tcsCreditBody:
        'TCS is not an extra cost. It appears in your Form 26AS/AIS against your PAN and is fully adjustable against your income-tax liability or refundable when you file your ITR. Think of it as prepaying tax you may owe anyway — but plan cash flow for it, because the money is blocked until you file.',
    tcsPlan: 'Practical tip',
    tcsPlanBody:
        'If you invest a fixed amount monthly, splitting remittances across family members (spouse, adult children, parents) keeps each person under the ₹7 lakh interest-free zone. Every person must actually own and report the investments in their own name.',

    // ── Capital gains ──────────────────────────────────────────────────
    cgHolding: 'Holding period decides the rate',
    cgHoldingBody:
        'For foreign shares, a holding of 24 months or less is short-term; more than 24 months is long-term. The clock starts the day you buy and ends the day you sell — each purchase lot has its own clock.',
    cgStcg: 'Short-term gains',
    cgStcgBody:
        'STCG on foreign stocks is added to your total income and taxed at your income-slab rate. If you are in the 30% bracket, a quick flip abroad costs you 30% plus cess.',
    cgLtcg: 'Long-term gains',
    cgLtcgBody:
        'LTCG on foreign shares is taxed at a flat 12.5% without indexation (post-Budget 2024 rules). Note: the ₹1.25 lakh exemption you may have heard about applies to listed Indian equity — foreign shares do not get that exemption. Losses on foreign shares can be set off against gains, with the usual carry-forward rules.',
    cgItr: 'Reporting in your ITR',
    cgItrBody:
        'Foreign capital gains go under "Capital Gains" in Schedule CG of your ITR, and every foreign brokerage statement (like the annual account statement from your international broker) should be reconciled before filing. Use the ITR-2 form — ITR-1 does not cover capital gains.',

    // ── Dividend ───────────────────────────────────────────────────────
    divWht: 'US withholding tax',
    divWhtBody:
        'The US automatically withholds tax on dividends paid to Indian residents. Without paperwork the default rate is 30%; with a valid W-8BEN on file, the India–US tax treaty rate of 25% applies. Your broker usually collects the W-8BEN once — check that it is valid.',
    divIndia: 'Taxing it in India',
    divWhtIndiaBody:
        'The dividend is still fully taxable in India at your slab rate. You declare the gross dividend (before US withholding), and claim the 25% US tax as foreign tax credit under the DTAA — using Form 67 filed before your ITR.',
    divW8ben: 'One form, three minutes',
    divW8benBody:
        'The W-8BEN is a simple declaration that you are an Indian tax resident. Submitting it once every few years cuts US dividend withholding from 30% to 25% and keeps your paperwork treaty-clean. Do it the day you open the global broker account.',

    // ── Charges ────────────────────────────────────────────────────────
    chBroker: 'Brokerage & platform fees',
    chBrokerBody:
        'Indian platforms charge either a flat fee per order or a percentage (commonly 0.1%–0.5%). International brokers may charge per-share or per-order fees. Compare on your typical order size — a flat ₹20 fee is cheap for small orders, expensive for very large ones.',
    chFx: 'Forex conversion markup',
    chFxBody:
        'The real recurring cost is currency conversion: banks and platforms typically add a 0.5%–2% markup over the interbank rate on every remittance and every withdrawal. On ₹10 lakh invested and later sold, a 1% markup each way costs you roughly ₹20,000 — more than most brokerage.',
    chGst: 'GST and statutory levies',
    chGstBody:
        '18% GST applies on brokerage and transaction charges (not on the invested amount itself). There is no STT or CTT on foreign stocks — those levies are India-market specific — but stamp duty may apply on some transfers.',
    chHidden: 'Watch the full picture',
    chHiddenBody:
        'Fractional shares, custody fees, inactivity fees and withdrawal charges vary widely between platforms. Before committing, list every recurring fee for your expected holding style — a platform that is cheapest for 10 small orders may be the most expensive for 2 large ones.',

    // ── Schedule FA ────────────────────────────────────────────────────
    faWhat: 'What is Schedule FA?',
    faWhatBody:
        'Schedule FA is the section of the Indian ITR where residents must disclose foreign assets: every foreign bank account, brokerage account, shares, ESOPs, even small foreign mutual fund holdings. It applies to ordinary residents — holding just one US stock makes it mandatory.',
    faWhen: 'When and how',
    faWhenBody:
        'File it every year in ITR-2 (or ITR-3) with details of each account: country, name, peak balance during the year, and closing balance. Even a dormant account with zero transactions must be reported as long as it exists. The schedule reports the calendar year January–December, translated into the financial year.',
    faPenalty: 'Why you should never skip it',
    faPenaltyBody:
        'Non-disclosure under the Black Money Act attracts a flat ₹10 lakh penalty per year of default, independent of tax due. Income-tax notices routinely cross-check AIS data and broker reporting. Disclosing costs nothing; not disclosing can cost more than the entire portfolio.',

    // ── R:R × Post-tax discipline card ─────────────────────────────
    rrCardTitle: 'Your discipline, your post-tax returns',
    rrCardSubtitle: 'What honouring your committed R:R is actually worth',
    rrCommitted: 'Committed R:R',
    rrCardMeasured: '{{measured}} journaled trades measured against your commitment',
    rrActual: 'Actual (journaled)',
    rrDisciplined: 'If you had held to plan',
    rrPostTax: 'Post-tax',
    rrBreachLine: '{{breaches}} shortcut exits · {{undisciplinedLosses}} stop-buster losses (₹{{loss}} ran past your stop)',
    rrGapLine: 'Indiscipline cost you ₹{{gap}} post-tax',
    rrCleanLine: 'Fully disciplined this period — keep holding winners to plan',
    rrCtaCommit: 'Commit your R:R ratio',
    rrCtaJournal: 'Journal your next trade with a planned stop',
    rrDisclaimer: 'Illustrative model: winners re-rated to your committed R:R, stop-buster losses capped at 1R, gains taxed at a flat rate. Not tax advice.',

    // Tax-rate picker (education-grade)
    rrTaxSettings: 'Tax model',
    rrCompareHeading: 'Both models side by side',
    rrCompareLtcgGap: 'LTCG 12.5% gap',
    rrCompareSlabGap: 'Slab {{slabPct}}% gap',
    rrTaxLtcg: 'Long-term (12.5% LTCG)',
    rrTaxSlab: 'Short-term (income slab)',
    rrSlabLabel: 'Your slab rate',
    rrSlab5: '5%',
    rrSlab20: '20%',
    rrSlab30: '30%',

    // Footer
    notAdvice: 'Not investment or tax advice',
    notAdviceBody:
        'Toroloom is an education and discipline platform — it does not execute trades, hold your money, or provide tax advice. Rules summarised here are general and current as of September 2026; verify every number with a qualified chartered accountant before acting.',
    contactIntro: 'Found an error or want this module expanded? Write to us:',
    contactEmail: 'support@toroloom.com',
};

export default taxEd;
