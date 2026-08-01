import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import i18n from '../i18n';

// Regression test — locks Hindi (Devanagari) rendering of locale keys used by
// CurrencyMarketsScreen, MonteCarloSimulationScreen, AIChatScreen,
// TransactionHistoryScreen, ReferralScreen and VoiceSettingsScreen after a
// language toggle. Fails if any key falls back to English / raw-key string.

const CURRENCY_KEYS = [
  'currencyMarkets.title',
  'currencyMarkets.subtitle',
  'currencyMarkets.tabInrPairs',
  'currencyMarkets.tabCrosses',
  'currencyMarkets.filterAll',
  'currencyMarkets.pairCount',
  'currencyMarkets.avgInrChg',
  'currencyMarkets.avgVolatility',
  'currencyMarkets.week52Range',
  'currencyMarkets.converterTitle',
  'currencyMarkets.saveConversion',
  'currencyMarkets.volLabel',
  'currencyMarkets.live',
  'currencyMarkets.mock',
];

const MONTE_CARLO_KEYS = [
  'monteCarlo.title',
  'monteCarlo.portfolioParams',
  'monteCarlo.initialInvestment',
  'monteCarlo.monthlySip',
  'monteCarlo.expectedReturn',
  'monteCarlo.volatility',
  'monteCarlo.timeHorizon',
  'monteCarlo.conservative',
  'monteCarlo.moderate',
  'monteCarlo.aggressive',
  'monteCarlo.runSimulation',
  'monteCarlo.years',
  'monteCarlo.medianValue',
  'monteCarlo.bestCase',
  'monteCarlo.worstCase',
];

const RELATIVE_TIME_KEYS = [
  'time.justNow',
  'time.minutesAgo',
  'time.hoursAgo',
  'time.daysAgo',
  'time.weeksAgo',
  'time.monthsAgo',
  'time.daysLeft',
  'time.monthsLeft',
  'time.never',
  'time.noExpiry',
  'time.expired',
];

const UNIT_KEYS = ['app.shares', 'app.stocks', 'app.trades', 'app.years', 'app.months', 'app.perShare'];

// AIChatScreen — ai.* namespace (chat + quick questions + response templates)
const AICHAT_KEYS = [
  'ai.askPortfolio',
  'ai.chatBestLine',
  'ai.chatBestPerformer',
  'ai.chatHeaderSubtitle',
  'ai.chatHeaderTitle',
  'ai.chatHoldingsSummary',
  'ai.chatInsightsSummary',
  'ai.chatLoss',
  'ai.chatMarketDown',
  'ai.chatMarketMixed',
  'ai.chatMarketOverview',
  'ai.chatMarketUnavailable',
  'ai.chatMarketUp',
  'ai.chatNoHoldingsBest',
  'ai.chatNoHoldingsShort',
  'ai.chatNoInsights',
  'ai.chatNoSips',
  'ai.chatPerformance',
  'ai.chatPortfolioOverview',
  'ai.chatPortfolioWorth',
  'ai.chatProfit',
  'ai.chatSectorAllocation',
  'ai.chatSectorTipExtra',
  'ai.chatSipSummary',
  'ai.chatThinking',
  'ai.chatWelcome',
  'ai.chatWelcomeBack',
  'ai.chatWorstLine',
  'ai.chatWorstPerformer',
  'ai.qPortfolioValue',
  'ai.qBestPerformer',
  'ai.qWorstPerformer',
  'ai.qTotalPnl',
  'ai.qSectorAllocation',
  'ai.qSipStatus',
];

// TransactionHistoryScreen — funds.tx* namespace
const TX_KEYS = [
  'funds.txAccount',
  'funds.txAddFunds',
  'funds.txAdds',
  'funds.txAll',
  'funds.txAmount',
  'funds.txDateTime',
  'funds.txEmptyAll',
  'funds.txEmptyFilter',
  'funds.txEmptyTitle',
  'funds.txFundsAdded',
  'funds.txFundsWithdrawn',
  'funds.txHistoryTitle',
  'funds.txMethod',
  'funds.txNetAddition',
  'funds.txStatus',
  'funds.txTo',
  'funds.txTotalAdded',
  'funds.txTotalWithdrawn',
  'funds.txTransactionId',
  'funds.txTransactions',
  'funds.txVia',
  'funds.txWithdrawals',
];

// ReferralScreen — referral.* namespace (brand names excluded; see REFERRAL_BRAND_KEYS)
const REFERRAL_KEYS = [
  'referral.active',
  'referral.benefit1Desc',
  'referral.benefit1Title',
  'referral.benefit2Desc',
  'referral.benefit2Title',
  'referral.benefit3Desc',
  'referral.benefit3Title',
  'referral.benefit4Desc',
  'referral.benefit4Title',
  'referral.cancel',
  'referral.copiedMsg',
  'referral.copiedTitle',
  'referral.copy',
  'referral.credited',
  'referral.emptyDesc',
  'referral.emptyTitle',
  'referral.expired',
  'referral.heroSubtitle',
  'referral.heroTitle',
  'referral.howItWorks',
  'referral.howItWorksSub',
  'referral.inviteSent',
  'referral.inviteSentMsg',
  'referral.inviteViaPhone',
  'referral.inviteViaPhoneMsg',
  'referral.joinedOn',
  'referral.noRewards',
  'referral.pending',
  'referral.pendingStatus',
  'referral.referEarn',
  'referral.rewardsHistory',
  'referral.rewardsSubtitle',
  'referral.sendInvite',
  'referral.share',
  'referral.shareBtnText',
  'referral.shareMessage',
  'referral.shareTitle',
  'referral.telegramMessage',
  'referral.telegramNotFound',
  'referral.telegramNotFoundMsg',
  'referral.termsNote',
  'referral.totalEarned',
  'referral.totalReferrals',
  'referral.userFallback',
  'referral.whatsappMessage',
  'referral.whatsappNotFound',
  'referral.whatsappNotFoundMsg',
];

// Brand names — intentionally kept in Latin script in BOTH en and hi locales.
const REFERRAL_BRAND_KEYS: Record<string, string> = {
  'referral.whatsapp': 'WhatsApp',
  'referral.telegram': 'Telegram',
  'referral.sms': 'SMS',
};

// VoiceSettingsScreen — voiceSettings.* namespace
const VOICE_KEYS = [
  'voiceSettings.announcementsDesc',
  'voiceSettings.announcementsTitle',
  'voiceSettings.fast',
  'voiceSettings.high',
  'voiceSettings.low',
  'voiceSettings.normal',
  'voiceSettings.prioritySuffix',
  'voiceSettings.slow',
  'voiceSettings.speechRate',
  'voiceSettings.speechRateDesc',
  'voiceSettings.subtitle',
  'voiceSettings.testDailyLoss',
  'voiceSettings.testLockdown',
  'voiceSettings.testProfitTarget',
  'voiceSettings.testStopLoss',
  'voiceSettings.testVoice',
  'voiceSettings.testVoiceDesc2',
  'voiceSettings.testVolatility',
  'voiceSettings.title',
  'voiceSettings.voiceEvents',
  'voiceSettings.voiceEventsDesc',
  'voiceSettings.voiceOff',
  'voiceSettings.voiceOffDesc',
  'voiceSettings.voiceOn',
  'voiceSettings.voiceOnDesc',
  'voiceSettings.voicePitch',
  'voiceSettings.voicePitchDesc',
];

describe('Hi locale render — screens', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('hi');
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('language is hi', () => {
    expect(i18n.language).toBe('hi');
  });

  it.each(CURRENCY_KEYS)('%s renders Devanagari', (key) => {
    const val = i18n.t(key, { count: 5, vol: 1.2 });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(MONTE_CARLO_KEYS)('%s renders Devanagari', (key) => {
    const val = i18n.t(key, { count: 5 });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(RELATIVE_TIME_KEYS)('%s renders Devanagari', (key) => {
    const val = i18n.t(key, { count: 6 });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(UNIT_KEYS)('%s renders Devanagari', (key) => {
    const val = i18n.t(key, { count: 5 });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(AICHAT_KEYS)('ai.%s renders Devanagari', (key) => {
    const val = i18n.t(key, {
      count: 3, value: '₹10,000', invested: '₹8,000', emoji: '📈', sign: '+',
      pnl: '₹2,000', pct: '25.0', result: 'लाभ', name: 'RELIANCE', sector: 'IT',
      extra: '', winners: 2, losers: 1, winRate: '67', status: 'ऊपर', indices: 'NIFTY: 24,000',
      items: '• *RELIANCE*: अच्छा प्रदर्शन', returns: '₹500',
    });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(TX_KEYS)('funds.%s renders Devanagari', (key) => {
    const val = i18n.t(key, {
      count: 3, method: 'UPI', to: 'किसान क्रेडिट कार्ड', via: 'UPI', amount: '₹5,000',
      date: '01-08-2026', time: '10:30', id: 'TXN123', status: 'सफल', net: '₹1,000',
      totalAdded: '₹10,000', totalWithdrawn: '₹2,000',
    });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(REFERRAL_KEYS)('referral.%s renders Devanagari', (key) => {
    const val = i18n.t(key, { count: 3, name: 'राहुल', amount: '₹100', via: 'WhatsApp' });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(VOICE_KEYS)('voiceSettings.%s renders Devanagari', (key) => {
    const val = i18n.t(key, { count: 2 });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(Object.keys(REFERRAL_BRAND_KEYS))('%s stays Latin (intentional brand name)', (key) => {
    const val = i18n.t(key);
    expect(val).toBe(REFERRAL_BRAND_KEYS[key]);
    expect(val).not.toMatch(/[\u0900-\u097F]/);
  });

  // Interpolation checks for the exact strings the screens render
  it('MonteCarlo years unit renders Hindi', () => {
    expect(i18n.t('monteCarlo.years')).toBe('वर्ष');
  });
  it('pairCount plural renders Hindi जोड़े', () => {
    expect(i18n.t('currencyMarkets.pairCount', { count: 5 })).toBe('5 जोड़े');
  });
  it('app.shares 5 renders Hindi', () => {
    expect(i18n.t('app.shares', { count: 5 })).toBe('5 शेयर');
  });

  // Exact-value checks for the newly-converted screens
  it('AIChatScreen quick-question label resolves via ai. namespace', () => {
    expect(i18n.t('ai.qPortfolioValue')).toBe('पोर्टफोलियो वैल्यू?');
    expect(i18n.t('ai.chatHeaderTitle')).toBe('AI असिस्टेंट');
    expect(i18n.t('ai.askPortfolio')).toContain('पूछें');
  });
  it('TransactionHistory exact Hindi strings', () => {
    expect(i18n.t('funds.txHistoryTitle')).toBe('लेनदेन इतिहास');
    expect(i18n.t('funds.txAll')).toBe('सभी');
    expect(i18n.t('funds.txFundsAdded')).toBe('फंड जोड़े गए');
  });
  it('Referral exact Hindi strings', () => {
    expect(i18n.t('referral.referEarn')).toBe('रेफर करें और कमाएँ');
    expect(i18n.t('referral.copy')).toBe('कॉपी');
    expect(i18n.t('referral.heroTitle')).toContain('₹100');
  });
  it('VoiceSettings exact Hindi strings', () => {
    expect(i18n.t('voiceSettings.title')).toBe('आवाज़ सेटिंग्स');
    expect(i18n.t('voiceSettings.testVoice')).toBe('आवाज़ परीक्षण');
    expect(i18n.t('voiceSettings.voiceOn')).toBe('वॉयस चालू है');
    expect(i18n.t('voiceSettings.speechRate')).toBe('भाषण गति');
  });
});
