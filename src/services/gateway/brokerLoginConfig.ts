/**
 * ============================================================================
 * Toroloom — Global Broker Login Configuration Registry
 * ============================================================================
 *
 * Maps every supported broker (worldwide) to its:
 *   - Login URL(s) for WebView session extraction
 *   - Dashboard URL patterns that indicate login success
 *   - Auth token patterns in URL query strings
 *   - MFA / TOTP challenge URL patterns
 *   - Authentication modes (password, OAuth, social login, QR code, magic link)
 *   - Supported regions
 *   - Extraction strategy (session, cookie, token-based, hybrid)
 *
 * Adding a new broker: simply add an entry to BROKER_LOGIN_CONFIGS.
 * No component changes needed — SecureSessionSync reads from this registry.
 *
 * ============================================================================
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type AuthMode = 'password' | 'oauth' | 'social_google' | 'social_apple' | 'qr_scan' | 'magic_link' | 'biometric';
export type ExtractionStrategy = 'cookie_session' | 'local_storage' | 'token_param' | 'hybrid';

export interface BrokerLoginConfig {
  /** Primary login page URL */
  loginUrl: string;
  /** Alternative login URLs (e.g., region-specific, app store redirects) */
  altLoginUrls?: string[];
  /** URL substrings that indicate successful login (dashboard) */
  dashboardPatterns: string[];
  /** Parameters in URL that carry auth tokens after OAuth redirect */
  tokenParams: string[];
  /** URL substrings that indicate MFA/TOTP challenge */
  mfaPatterns?: string[];
  /** How this broker authenticates users */
  authModes: AuthMode[];
  /** Region code(s) for this broker */
  regions: string[];
  /** How to extract session tokens */
  extractionStrategy: ExtractionStrategy;
  /** Whether this broker is known to block WebView access */
  blocksWebView?: boolean;
  /** Known internal API base URL for proxy requests */
  apiBaseUrl?: string;
  /** User agent hint for proxy requests (mobile/desktop) */
  userAgentHint?: 'mobile' | 'desktop';
}

// ─── Registry ──────────────────────────────────────────────────────────────

export const BROKER_LOGIN_CONFIGS: Record<string, BrokerLoginConfig> = {

  // ═════════════════════════════════════════════════════════════════════════
  // INDIA
  // ═════════════════════════════════════════════════════════════════════════

  zerodha: {
    loginUrl: 'https://kite.zerodha.com/',
    dashboardPatterns: ['kite.zerodha.com/', 'kite.zerodha.com/dashboard'],
    tokenParams: ['request_token=', 'status=success'],
    mfaPatterns: ['totp', 'two-factor', '2fa'],
    authModes: ['password', 'oauth'],
    regions: ['india'],
    extractionStrategy: 'hybrid',
    apiBaseUrl: 'https://kite.zerodha.com',
    userAgentHint: 'mobile',
  },

  angel: {
    loginUrl: 'https://smartapi.angelbroking.com/',
    dashboardPatterns: ['smartapi.angelbroking.com/', 'smartapi.angelbroking.com/dashboard'],
    tokenParams: ['jwt=', 'access_token=', 'status=success'],
    mfaPatterns: ['totp', 'otp', 'mfa', 'two-factor'],
    authModes: ['password'],
    regions: ['india'],
    extractionStrategy: 'hybrid',
    apiBaseUrl: 'https://smartapi.angelbroking.com',
    userAgentHint: 'mobile',
  },

  groww: {
    loginUrl: 'https://groww.in/login',
    dashboardPatterns: ['groww.in/dashboard', 'groww.in/stocks', 'groww.in/account'],
    tokenParams: ['access_token=', 'status=success'],
    authModes: ['password', 'social_google'],
    regions: ['india'],
    extractionStrategy: 'hybrid',
    apiBaseUrl: 'https://api.groww.in',
    userAgentHint: 'mobile',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // UNITED STATES
  // ═════════════════════════════════════════════════════════════════════════

  robinhood: {
    loginUrl: 'https://robinhood.com/login',
    altLoginUrls: ['https://app.robinhood.com/login'],
    dashboardPatterns: ['robinhood.com/account', 'app.robinhood.com'],
    tokenParams: ['token=', 'bearer=', 'authorization_code='],
    mfaPatterns: ['two-factor', '2fa', 'verify', 'security-code'],
    authModes: ['password', 'biometric'],
    regions: ['us'],
    extractionStrategy: 'token_param',
    blocksWebView: true,
    apiBaseUrl: 'https://api.robinhood.com',
    userAgentHint: 'mobile',
  },

  schwab: {
    loginUrl: 'https://www.schwab.com/login',
    altLoginUrls: ['https://client.schwab.com/login'],
    dashboardPatterns: ['client.schwab.com', 'schwab.com/client'],
    tokenParams: ['session=', 'token='],
    mfaPatterns: ['two-factor', 'verify', 'security', 'otp', 'token'],
    authModes: ['password'],
    regions: ['us'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://api.schwab.com',
    userAgentHint: 'desktop',
  },

  etrade: {
    loginUrl: 'https://us.etrade.com/etx/pxy/login',
    dashboardPatterns: ['pw.etrade.com', 'etrade.com/wol'],
    tokenParams: ['token=', 'auth='],
    mfaPatterns: ['otp', 'security', 'verify', 'two-factor'],
    authModes: ['password'],
    regions: ['us'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://api.etrade.com',
    userAgentHint: 'desktop',
  },

  webull: {
    loginUrl: 'https://www.webull.com/login',
    altLoginUrls: ['https://app.webull.com/login'],
    dashboardPatterns: ['webull.com/account', 'app.webull.com'],
    tokenParams: ['token=', 'access_token=', 'auth='],
    mfaPatterns: ['two-factor', 'verify', 'otp', 'security'],
    authModes: ['password', 'social_google'],
    regions: ['us'],
    extractionStrategy: 'token_param',
    apiBaseUrl: 'https://api.webull.com',
    userAgentHint: 'mobile',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // EUROPE
  // ═════════════════════════════════════════════════════════════════════════

  degiro: {
    loginUrl: 'https://trader.degiro.nl/login',
    altLoginUrls: ['https://www.degiro.nl/login'],
    dashboardPatterns: ['trader.degiro.nl', 'degiro.nl/trader'],
    tokenParams: ['jsessionid=', 'token='],
    mfaPatterns: ['two-factor', 'otp', 'verification'],
    authModes: ['password', 'biometric'],
    regions: ['europe'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://trader.degiro.nl',
    userAgentHint: 'desktop',
  },

  trading212: {
    loginUrl: 'https://live.trading212.com/',
    altLoginUrls: ['https://app.trading212.com/login'],
    dashboardPatterns: ['trading212.com/trading', 'live.trading212.com'],
    tokenParams: ['token=', 'session='],
    mfaPatterns: ['two-factor', '2fa', 'otp', 'verification'],
    authModes: ['password', 'social_google', 'social_apple'],
    regions: ['europe', 'uk'],
    extractionStrategy: 'hybrid',
    apiBaseUrl: 'https://api.trading212.com',
    userAgentHint: 'mobile',
  },

  etoro: {
    loginUrl: 'https://www.etoro.com/login',
    dashboardPatterns: ['etoro.com/portfolio', 'etoro.com/markets', 'etoro.com/home'],
    tokenParams: ['token=', 'authorization='],
    mfaPatterns: ['two-factor', '2fa', 'verify'],
    authModes: ['password', 'social_google', 'social_apple'],
    regions: ['europe', 'us', 'australia', 'uk'],
    extractionStrategy: 'token_param',
    apiBaseUrl: 'https://api.etoro.com',
    userAgentHint: 'desktop',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // UNITED KINGDOM
  // ═════════════════════════════════════════════════════════════════════════

  freetrade: {
    loginUrl: 'https://freetrade.io/login',
    dashboardPatterns: ['freetrade.io/app', 'freetrade.io/portfolio'],
    tokenParams: ['token=', 'access_token='],
    mfaPatterns: ['two-factor', 'verify', 'passcode'],
    authModes: ['password', 'magic_link'],
    regions: ['uk'],
    extractionStrategy: 'token_param',
    apiBaseUrl: 'https://api.freetrade.io',
    userAgentHint: 'mobile',
  },

  hargreaves: {
    loginUrl: 'https://www.hl.co.uk/login',
    dashboardPatterns: ['online.hl.co.uk', 'hl.co.uk/my-account'],
    tokenParams: ['session=', 'token='],
    mfaPatterns: ['two-factor', 'security', 'memorable-word', 'verification'],
    authModes: ['password'],
    regions: ['uk'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://online.hl.co.uk',
    userAgentHint: 'desktop',
  },

  interactive_investor: {
    loginUrl: 'https://www.ii.co.uk/login',
    dashboardPatterns: ['secure.ii.co.uk', 'ii.co.uk/my-account'],
    tokenParams: ['session=', 'token='],
    mfaPatterns: ['two-factor', 'security', 'otp'],
    authModes: ['password'],
    regions: ['uk'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://secure.ii.co.uk',
    userAgentHint: 'desktop',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // AUSTRALIA
  // ═════════════════════════════════════════════════════════════════════════

  commsec: {
    loginUrl: 'https://www.commsec.com.au/login',
    dashboardPatterns: ['www2.commsec.com.au', 'commsec.com.au/portfolio'],
    tokenParams: ['token=', 'session=', 'auth='],
    mfaPatterns: ['two-factor', 'sms', 'security', 'verify'],
    authModes: ['password'],
    regions: ['australia'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://api.commsec.com.au',
    userAgentHint: 'desktop',
  },

  selfwealth: {
    loginUrl: 'https://secure.selfwealth.com.au/login',
    dashboardPatterns: ['secure.selfwealth.com.au', 'selfwealth.com.au/dashboard'],
    tokenParams: ['token=', 'session='],
    mfaPatterns: ['two-factor', 'otp', 'verify'],
    authModes: ['password'],
    regions: ['australia'],
    extractionStrategy: 'hybrid',
    apiBaseUrl: 'https://api.selfwealth.com.au',
    userAgentHint: 'mobile',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // CANADA
  // ═════════════════════════════════════════════════════════════════════════

  wealthsimple: {
    loginUrl: 'https://www.wealthsimple.com/login',
    altLoginUrls: ['https://trade.wealthsimple.com/login'],
    dashboardPatterns: ['wealthsimple.com/account', 'trade.wealthsimple.com'],
    tokenParams: ['token=', 'access_token='],
    mfaPatterns: ['two-factor', '2fa', 'verify', 'passcode'],
    authModes: ['password', 'social_google', 'social_apple', 'biometric'],
    regions: ['canada', 'uk', 'us'],
    extractionStrategy: 'token_param',
    apiBaseUrl: 'https://api.wealthsimple.com',
    userAgentHint: 'mobile',
  },

  questrade: {
    loginUrl: 'https://my.questrade.com/login',
    dashboardPatterns: ['my.questrade.com', 'edge.questrade.com'],
    tokenParams: ['token=', 'auth='],
    mfaPatterns: ['two-factor', 'security', 'verify'],
    authModes: ['password'],
    regions: ['canada'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://api.questrade.com',
    userAgentHint: 'desktop',
  },

  td_direct: {
    loginUrl: 'https://www.td.com/ca/en/investing/direct-investing',
    dashboardPatterns: ['webbroker.td.com', 'td.com/webbroker'],
    tokenParams: ['session=', 'token='],
    mfaPatterns: ['two-factor', 'security', 'verify', 'otp'],
    authModes: ['password'],
    regions: ['canada'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://webbroker.td.com',
    userAgentHint: 'desktop',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // SINGAPORE
  // ═════════════════════════════════════════════════════════════════════════

  tiger_brokers: {
    loginUrl: 'https://www.itiger.com/sg/login',
    altLoginUrls: ['https://trade.itiger.com/login'],
    dashboardPatterns: ['trade.itiger.com', 'itiger.com/portfolio'],
    tokenParams: ['token=', 'session='],
    mfaPatterns: ['two-factor', 'otp', 'verify', 'security'],
    authModes: ['password', 'qr_scan'],
    regions: ['singapore', 'us', 'china'],
    extractionStrategy: 'hybrid',
    apiBaseUrl: 'https://api.itiger.com',
    userAgentHint: 'mobile',
  },

  moomoo: {
    loginUrl: 'https://www.moomoo.com/sg/login',
    altLoginUrls: ['https://www.moomoo.com/sg-en/login'],
    dashboardPatterns: ['moomoo.com/account', 'moomoo.com/portfolio'],
    tokenParams: ['token=', 'session='],
    mfaPatterns: ['two-factor', 'otp', 'sms', 'verify'],
    authModes: ['password', 'qr_scan'],
    regions: ['singapore', 'us', 'australia', 'japan', 'canada'],
    extractionStrategy: 'hybrid',
    apiBaseUrl: 'https://api.moomoo.com',
    userAgentHint: 'mobile',
  },

  dbs_vickers: {
    loginUrl: 'https://www.dbsvonline.com/login',
    dashboardPatterns: ['dbsvonline.com', 'dbsvonline.com/portfolio'],
    tokenParams: ['session=', 'token='],
    mfaPatterns: ['two-factor', 'otp', 'sms', 'security'],
    authModes: ['password'],
    regions: ['singapore'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://www.dbsvonline.com',
    userAgentHint: 'desktop',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // UAE
  // ═════════════════════════════════════════════════════════════════════════

  sarwa: {
    loginUrl: 'https://www.sarwa.co/login',
    dashboardPatterns: ['app.sarwa.co', 'sarwa.co/dashboard'],
    tokenParams: ['token=', 'access_token='],
    mfaPatterns: ['two-factor', 'otp', 'verify'],
    authModes: ['password', 'social_google', 'social_apple'],
    regions: ['uae'],
    extractionStrategy: 'token_param',
    apiBaseUrl: 'https://api.sarwa.co',
    userAgentHint: 'mobile',
  },

  baraka: {
    loginUrl: 'https://www.getbaraka.com/login',
    dashboardPatterns: ['getbaraka.com/app', 'getbaraka.com/portfolio'],
    tokenParams: ['token=', 'auth='],
    mfaPatterns: ['two-factor', 'otp', 'verify'],
    authModes: ['password', 'social_google', 'social_apple'],
    regions: ['uae'],
    extractionStrategy: 'token_param',
    apiBaseUrl: 'https://api.getbaraka.com',
    userAgentHint: 'mobile',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // JAPAN
  // ═════════════════════════════════════════════════════════════════════════

  rakuten: {
    loginUrl: 'https://www.rakuten-sec.co.jp/login',
    dashboardPatterns: ['rakuten-sec.co.jp/member', 'rakuten-sec.co.jp/portfolio'],
    tokenParams: ['session=', 'token='],
    mfaPatterns: ['two-factor', 'otp', 'sms', 'security'],
    authModes: ['password'],
    regions: ['japan'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://api.rakuten-sec.co.jp',
    userAgentHint: 'desktop',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // BRAZIL
  // ═════════════════════════════════════════════════════════════════════════

  clear: {
    loginUrl: 'https://www.clear.com.br/login',
    dashboardPatterns: ['clear.com.br/area-do-cliente', 'clear.com.br/portfolio'],
    tokenParams: ['token=', 'session='],
    mfaPatterns: ['two-factor', 'otp', 'sms', 'seguranca'],
    authModes: ['password'],
    regions: ['brazil'],
    extractionStrategy: 'cookie_session',
    apiBaseUrl: 'https://api.clear.com.br',
    userAgentHint: 'desktop',
  },
};

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Get the login configuration for a broker type.
 * Returns undefined if the broker is not in the registry.
 */
export function getBrokerLoginConfig(brokerType: string): BrokerLoginConfig | undefined {
  return BROKER_LOGIN_CONFIGS[brokerType];
}

/**
 * Get the primary login URL for a broker type.
 * Falls back to a generic search if the broker is unknown.
 */
export function getBrokerLoginUrl(brokerType: string): string | undefined {
  return BROKER_LOGIN_CONFIGS[brokerType]?.loginUrl;
}

/**
 * Get all dashboard URL patterns for a broker type.
 * Returns defaults for unknown brokers.
 */
export function getBrokerDashboardPatterns(brokerType: string): string[] {
  return BROKER_LOGIN_CONFIGS[brokerType]?.dashboardPatterns ?? [];
}

/**
 * Get all auth token parameter patterns for a broker type.
 */
export function getBrokerTokenParams(brokerType: string): string[] {
  return BROKER_LOGIN_CONFIGS[brokerType]?.tokenParams ?? [];
}

/**
 * Get MFA detection patterns for a broker type.
 */
export function getBrokerMfaPatterns(brokerType: string): string[] {
  return BROKER_LOGIN_CONFIGS[brokerType]?.mfaPatterns ?? [];
}

/**
 * Get the extraction strategy for a broker type.
 */
export function getBrokerExtractionStrategy(brokerType: string): ExtractionStrategy {
  return BROKER_LOGIN_CONFIGS[brokerType]?.extractionStrategy ?? 'hybrid';
}

/**
 * Check if a broker is known to block WebView access.
 */
export function brokerBlocksWebView(brokerType: string): boolean {
  return BROKER_LOGIN_CONFIGS[brokerType]?.blocksWebView ?? false;
}

/**
 * Get all brokers for a specific region.
 */
export function getBrokersByRegion(region: string): string[] {
  return Object.entries(BROKER_LOGIN_CONFIGS)
    .filter(([_, config]) => config.regions.includes(region))
    .map(([type, _]) => type);
}

/**
 * Get all registered broker types.
 */
export function getAllBrokerTypes(): string[] {
  return Object.keys(BROKER_LOGIN_CONFIGS);
}

/**
 * Get the region display name for a broker.
 */
export function getBrokerRegionLabel(brokerType: string): string {
  const regions = BROKER_LOGIN_CONFIGS[brokerType]?.regions ?? [];
  const regionLabels: Record<string, string> = {
    india: '🇮🇳 India',
    us: '🇺🇸 US',
    uk: '🇬🇧 UK',
    europe: '🇪🇺 Europe',
    australia: '🇦🇺 Australia',
    canada: '🇨🇦 Canada',
    singapore: '🇸🇬 Singapore',
    uae: '🇦🇪 UAE',
    japan: '🇯🇵 Japan',
    brazil: '🇧🇷 Brazil',
    china: '🇨🇳 China',
  };
  return regions.map(r => regionLabels[r] || r).join(', ');
}
