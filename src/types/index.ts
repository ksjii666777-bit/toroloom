// ============ User & Auth ============
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  panNumber?: string;
  avatar?: string;
  kycStatus: 'pending' | 'verified' | 'rejected';
  balance: number;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

// ============ Market Data ============
export interface MarketIndex {
  id: string;
  name: string;
  shortName: string;
  currentValue: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  icon: string;
}

export interface Stock {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  marketCap: string;
  volume: string;
  high52: number;
  low52: number;
  pe: number;
  pb: number;
  dividend: number;
}

export interface USStock extends Stock {
  exchange: 'NASDAQ' | 'NYSE' | 'NYSE Arca';
}

export interface USETF {
  id: string;
  symbol: string;
  name: string;
  category: string;
  price: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  expenseRatio: number;
  aum: string;
  dividendYield: number;
  peRatio: number;
  holdings: number;
  exchange: string;
}

/** Cryptocurrency asset data for the Global Markets hub */
export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string;
  volume24h: string;
  icon: string;
  color: string;
}

export interface StockHistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ============ Portfolio ============
export interface Holding {
  id: string;
  stockId: string;
  symbol: string;
  name: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  totalInvested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface Trade {
  id: string;
  stockId: string;
  symbol: string;
  name: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  timestamp: string;
}

// ============ Watchlist ============
export interface Watchlist {
  id: string;
  name: string;
  stocks: Stock[];
  createdAt: string;
}

// ============ Mutual Funds ============
export interface MutualFund {
  id: string;
  name: string;
  category: string;
  nav: number;
  dayChange: number;
  dayChangePercent: number;
  oneYearReturn: number;
  threeYearReturn: number;
  fiveYearReturn: number;
  riskLevel: 'low' | 'moderate' | 'high';
  minInvestment: number;
  fundSize: string;
  rating: number;
}

export interface SIPPlan {
  id: string;
  fundId: string;
  fundName: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  nextDate: string;
  totalInvested: number;
  currentValue: number;
  returns: number;
  /** Step-up configuration (optional — auto-increase SIP amount) */
  stepUp?: StepUpConfig;
}

/** Configuration for auto-increasing SIP amount over time */
export interface StepUpConfig {
  /** Whether step-up is enabled */
  enabled: boolean;
  /** Percentage increase per step (e.g. 10 = 10%) */
  percent: number;
  /** How often the increase applies */
  frequency: 'yearly' | 'half_yearly';
  /** The original starting amount before any step-ups */
  baseAmount: number;
  /** The current step number (0 = first, 1 = after first increase, etc.) */
  currentStep: number;
  /** Next scheduled step-up date */
  nextStepDate: string;
  /** Projected amount after N years (for display) */
  projectedAmount?: number;
}

// ============ Education ============
export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  lessons: number;
  progress: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  rating: number;
  enrolledCount: number;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  content: string;
  duration: string;
  completed: boolean;
  quiz?: Quiz;
  /** Optional video URL for interactive video lessons */
  videoUrl?: string;
  /** Video thumbnail/placeholder image URL */
  videoThumbnail?: string;
  /** Synchronized transcript entries for the video */
  transcript?: TranscriptEntry[];
}

/** A single entry in a video transcript, synchronized with playback time */
export interface TranscriptEntry {
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Transcript text */
  text: string;
  /** Optional speaker name */
  speaker?: string;
}

/** Bookmark for a specific timestamp in a video lesson */
export interface VideoBookmark {
  id: string;
  lessonId: string;
  /** Timestamp in seconds */
  time: number;
  /** User's label/note for this bookmark */
  label: string;
  /** ISO timestamp when bookmark was created */
  createdAt: string;
}

/** Video playback progress for a lesson */
export interface VideoProgress {
  lessonId: string;
  /** Last watched position in seconds */
  lastPosition: number;
  /** Total video duration in seconds */
  duration: number;
  /** Percentage watched (0-100) */
  watchedPercent: number;
  /** Whether the video is fully watched */
  completed: boolean;
  /** Last updated ISO timestamp */
  updatedAt: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  score: number;
  passed: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

// ============ Community ============
export interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  likes: number;
  comments: number;
  timestamp: string;
  tags: string[];
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: string;
}

// ============ AI Insights ============
export interface AIInsight {
  id: string;
  stockId: string;
  symbol: string;
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  analysis: string;
  targets: { target: number; probability: number }[];
  timestamp: string;
}

// ============ Gamification ============
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface UserLevel {
  level: number;
  title: string;
  xp: number;
  xpToNext: number;
  totalXp: number;
}

// ============ Portfolio Analytics ============
export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dayChange: number;
  dayChangePercent: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  avgHoldingDays: number;
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

export interface CapitalGains {
  shortTerm: {
    gains: number;
    count: number;
    taxRate: number;
    estimatedTax: number;
  };
  longTerm: {
    gains: number;
    count: number;
    taxRate: number;
    exemptLimit: number;
    taxableGains: number;
    estimatedTax: number;
  };
  totalEstimatedTax: number;
  sttPaid: number;
  totalBrokerage: number;
}

export interface MonthOverMonthReturn {
  month: string;
  startValue: number;
  endValue: number;
  return: number;
  returnPercent: number;
  contributions: number;
}

export interface PortfolioAnalytics {
  metrics: PerformanceMetrics;
  capitalGains: CapitalGains;
  monthlyReturns: MonthOverMonthReturn[];
  sectorAllocation: { sector: string; value: number; percent: number; count: number }[];
  pnlHistory: { date: string; value: number; cumulativePnl: number }[];
}

// ============ Open Orders ============
export interface OpenOrder {
  id: string;
  symbol: string;
  exchange: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  price: number;
  triggerPrice?: number;
  productType: string;
  orderType: string;
  status: 'open' | 'pending' | 'partially_filled' | 'trigger_pending';
  placedBy: string;
  timestamp: string;
  validity?: string;
}

// ============ Notifications ============
export interface AppNotification {
  id: string;
  type: 'price_alert' | 'trade' | 'news' | 'system' | 'educational' | 'portfolio_alert' | 'sentiment_alert' | 'course_review' | 'smart_alert';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  data?: any;
}

// ============ Subscription & Payments ============
export type SubscriptionTier = 'free' | 'pro' | 'elite';

// ──── Granular Feature Paywall Matrix ─────────────────────────
// Every feature in Toroloom maps to a minimum required tier.
// Tenants can override individual features in their config.

export type SubscriptionFeature =
  | 'basic_portfolio'
  | 'unlimited_watchlist'
  | 'advanced_analytics'
  | 'ai_insights'
  | 'ai_companion'
  | 'iron_lock'
  | 'real_time_data'
  | 'social_trading'
  | 'full_education'
  | 'tax_reports'
  | 'api_access'
  | 'ad_free'
  | 'priority_support'
  | 'dedicated_manager'
  | 'behavioural_journal';

// Default tier requirements for each feature
export const DEFAULT_FEATURE_MATRIX: Record<SubscriptionFeature, {
  minTier: SubscriptionTier;
  label: string;
  description: string;
  icon: string;
  category: 'analytics' | 'trading' | 'ai' | 'education' | 'support';
}> = {
  basic_portfolio:     { minTier: 'free', label: 'Portfolio Tracking',       description: 'Track your holdings and P&L',           icon: 'pie-chart',      category: 'analytics' },
  unlimited_watchlist: { minTier: 'pro',  label: 'Unlimited Watchlists',     description: 'Create unlimited watchlists',          icon: 'heart',          category: 'trading' },
  advanced_analytics:  { minTier: 'pro',  label: 'Advanced Analytics',       description: 'Performance metrics & P&L breakdown',  icon: 'analytics',      category: 'analytics' },
  ai_insights:         { minTier: 'pro',  label: 'AI Insights',              description: 'AI-powered market analysis',          icon: 'bulb',           category: 'ai' },
  ai_companion:        { minTier: 'pro',  label: 'AI Voice Companion',       description: 'Live avatar with voice alerts',       icon: 'happy',          category: 'ai' },
  iron_lock:           { minTier: 'elite',label: 'Iron Lock Engine',         description: 'Server-side loss limit enforcement',  icon: 'shield',         category: 'trading' },
  real_time_data:      { minTier: 'elite',label: 'Real-Time Data',           description: 'Live streaming market data',          icon: 'pulse',          category: 'trading' },
  social_trading:      { minTier: 'elite',label: 'Social & Copy Trading',    description: 'Follow & copy top traders',           icon: 'people',         category: 'trading' },
  full_education:      { minTier: 'pro',  label: 'Full Education Library',   description: 'All courses & lessons',               icon: 'school',         category: 'education' },
  tax_reports:         { minTier: 'elite',label: 'Tax Reports & Export',     description: 'Capital gains & tax reports',         icon: 'document-text',  category: 'analytics' },
  api_access:          { minTier: 'elite',label: 'API Access',               description: 'Automate trading via API',            icon: 'code-slash',     category: 'trading' },
  ad_free:             { minTier: 'pro',  label: 'Ad-Free Experience',       description: 'No advertisements',                   icon: 'eye-off',        category: 'support' },
  priority_support:    { minTier: 'pro',  label: 'Priority Support',         description: 'Fast-track support tickets',          icon: 'chatbubbles',    category: 'support' },
  dedicated_manager:   { minTier: 'elite',label: 'Dedicated Manager',        description: 'Personal account manager',            icon: 'person',         category: 'support' },
  behavioural_journal: { minTier: 'elite',label: 'Behavioural Journal',      description: 'Emotional trading diagnostics',       icon: 'journal',        category: 'ai' },
};

// ──── Tenant-Specific Override ───────────────────────────────
// A tenant can override the tier requirement for any feature.
// e.g. { 'ai_insights': 'free' } makes AI free for that tenant.

export type PaywallOverride = Partial<Record<SubscriptionFeature, SubscriptionTier>>;

// ──── Per-Tenant Razorpay Config ─────────────────────────────
// Each tenant (platform buyer) can configure their own Razorpay
// keys so subscription revenue routes to their account.

export interface TenantRazorpayConfig {
  keyId: string;
  keySecret: string;
  // Optional custom pricing overrides per plan
  pricing?: Partial<Record<string, { monthly: number; yearly: number }>>;
}

// ──── Multi-Tenant Configuration ─────────────────────────────
export interface TenantConfig {
  id: string;
  name: string;
  domain: string;
  logo?: string;
  primaryColor?: string;
  // Feature paywall overrides — allows tenant to make
  // premium features free for their users
  featureOverrides?: PaywallOverride;
  // Custom Razorpay keys for this tenant
  razorpay?: TenantRazorpayConfig;
  // Custom plan display
  planCustomization?: {
    planNames?: Partial<Record<string, string>>;
    planPricing?: Partial<Record<string, { monthly: number; yearly: number }>>;
  };
}

export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionTier;
  name: string;
  tagline: string;
  price: number;             // INR per month
  priceYearly: number;       // INR per year (discounted)
  icon: string;
  gradient: [string, string];
  features: string[];
  highlightedFeature?: string;
  badge?: string;
  popular?: boolean;
  // Which features in the matrix are included in this plan
  includedFeatures?: SubscriptionFeature[];
}

// ──── Coupon / Discount Code Types ──────────────────────────

export interface CouponCode {
  code: string;
  type: 'percentage' | 'fixed' | 'free_trial';
  value: number;                    // Percentage (10 = 10%) or fixed amount in ₹
  trialDays?: number;               // For 'free_trial' type, number of trial days
  minPlanTier?: SubscriptionTier;   // Min tier this coupon applies to
  maxUses?: number;
  currentUses?: number;
  expiresAt?: string;
  isActive: boolean;
  description: string;
}

// ──── Coupon Discount Result ────────────────────────────────

export interface CouponDiscountResult {
  code: string;
  valid: boolean;
  type: 'percentage' | 'fixed' | 'free_trial';
  discountAmount: number;          // Computed discount in ₹
  originalPrice: number;
  finalPrice: number;
  trialDays?: number;
  message: string;
}

// ──── UPI Autopay / Mandate Types ───────────────────────────

export interface UpiMandate {
  mandateId: string;
  upiId: string;
  bankName: string;
  planId: string;
  amount: number;
  billingPeriod: 'monthly' | 'yearly';
  status: 'active' | 'paused' | 'cancelled' | 'failed';
  createdAt: string;
  lastChargedAt?: string;
  nextChargeDate: string;
  tpv: 'MANDATE' | 'PIN';         // Transaction payment verification type
}

// ──── Subscription Payment History ──────────────────────────

export interface SubscriptionPayment {
  id: string;
  planId: string;
  planName: string;
  tier: SubscriptionTier;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  method: 'razorpay' | 'upi_autopay' | 'coupon';
  billingPeriod: 'monthly' | 'yearly';
  timestamp: string;
  transactionId: string;
  receiptUrl?: string;
  discountApplied?: number;
  couponCode?: string;
  invoiceId?: string;
}

export interface UserSubscription {
  tier: SubscriptionTier;
  planId: string;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  paymentMethod?: string;
  razorpayOrderId?: string;
  lastPaymentDate?: string;
  // Tenant attribution
  tenantId?: string;
  
  // ──── Trial Fields ────────────────────────────────────────
  trialStartDate?: string;
  trialEndDate?: string;
  isTrialUsed?: boolean;    // Whether user has already used a trial
  
  // ──── Coupon Fields ───────────────────────────────────────
  appliedCoupon?: {
    code: string;
    type: 'percentage' | 'fixed' | 'free_trial';
    discountAmount: number;
    originalPrice: number;
  };
  
  // ──── UPI Autopay Fields ──────────────────────────────────
  upiMandate?: UpiMandate;
  isAutoPayEnabled?: boolean;

  // ──── Payment History ─────────────────────────────────────
  payments?: SubscriptionPayment[];
}

// ============ Gateway & Session Management ============
export interface SessionPayload {
  cookies: string;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  brokerType: string;
  capturedAt: string;
  url: string;
}

export interface BrokerSession {
  brokerType: string;
  enctoken?: string;
  jwt?: string;
  accessToken?: string;
  publicToken?: string;
  refreshToken?: string;
  userId?: string;
  cookies: string;
  capturedAt: string;
  expiryAt?: string;
}

export interface ParsedTrade {
  execution_timestamp: string;
  asset_symbol: string;
  transaction_type: 'BUY' | 'SELL';
  filled_quantity: number;
  execution_price: number;
  regulatory_fees: number;
  brokerage?: number;
  exchange?: string;
  trade_id?: string;
}

export interface AICognitiveSummary {
  winLossFrequencyRatio: number;
  totalProfitableTrades: number;
  totalClosedTrades: number;
  brokerageDragFactor: number;
  totalTaxesAndCharges: number;
  absoluteRealizedPnl: number;
  sectorConcentrationIndex: number;
  sectorAllocation: { sector: string; exposurePercent: number }[];
  // Behavioral critique slots
  overTradingAlert?: { flag: boolean; message: string };
  brokerageLeakageAlert?: { flag: boolean; message: string };
  concentrationRiskAlert?: { flag: boolean; message: string };
  behavioralCritique?: string;
  generatedAt: string;
}

// ============ Market News ============
export interface MarketNewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  category: 'markets' | 'economy' | 'corporate' | 'ipo' | 'global' | 'policy';
  symbol?: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  imageUrl?: string;
  publishedAt: string;
  read: boolean;
  bookmarked: boolean;
}

// ============ IPO Calendar ============
export interface IPOItem {
  id: string;
  companyName: string;
  logo: string;
  sector: string;
  /** Open, Close, Listing dates */
  openDate: string;
  closeDate: string;
  listingDate: string;
  /** Price band */
  priceBand: { min: number; max: number };
  /** Lot size */
  lotSize: number;
  /** Minimum investment (1 lot) */
  minInvestment: number;
  /** Total issue size in Cr */
  issueSize: number;
  /** Fresh issue + OFS split */
  freshIssue: number;
  offerForSale: number;
  /** Total shares offered */
  totalShares: number;
  /** Bid data */
  totalBids: number;
  totalBidAmount: number;
  subscriptionStatus: 'upcoming' | 'open' | 'closed' | 'listing_today' | 'listed';
  /** Subscription multiples */
  subscriptionQIB: number;
  subscriptionHNI: number;
  subscriptionRetail: number;
  subscriptionTotal: number;
  /** GMP (Grey Market Premium) */
  gmp: number;
  gmpPercent: number;
  /** Expected listing gain */
  expectedListingPrice: number;
  expectedListingGain: number;
  /** Lead managers */
  leadManagers: string[];
  registrar: string;
  /** Rating */
  rating: number; // 1-5
  /** Company financials */
  revenue: number; // Cr
  netProfit: number; // Cr
  peRatio: number;
  roe: number;
  /** About */
  about: string;
  strengths: string[];
  risks: string[];
  /** Application data */
  applications: number;
  sharesApplied: number;
  /** Allotment */
  allotmentDate?: string;
  listingPrice?: number;
  listingGain?: number;
  isBookmarked: boolean;
}

// ============ Economic Calendar ============
export interface EconomicEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  timezone: string;
  category: 'central_bank' | 'gdp' | 'inflation' | 'employment' | 'trade' | 'fiscal' | 'industry' | 'consumer' | 'housing' | 'other';
  country: string;
  countryCode: string;
  importance: 'high' | 'medium' | 'low';
  /** Previous value */
  previous: string;
  /** Forecast/expected value */
  forecast: string;
  /** Actual value (after release) */
  actual?: string;
  /** Whether the event has occurred */
  isCompleted: boolean;
  /** Impact on markets */
  impact: 'positive' | 'negative' | 'neutral' | 'unknown';
  /** Affected assets */
  affectedAssets: string[];
  source: string;
  notes?: string;
}

// ============ Behavioral Journal ============
export type EmotionalState = 'calm' | 'anxious' | 'excited' | 'fearful' | 'frustrated' | 'overconfident' | 'neutral';

export type TradingMistake =
  | 'no_stop_loss'
  | 'fomo_entry'
  | 'revenge_trade'
  | 'over_leveraged'
  | 'deviated_from_plan'
  | 'held_too_long'
  | 'cut_winner_early'
  | 'chased_price'
  | 'averaged_down'
  | 'impulsive_entry';

export interface JournalEntry {
  id: string;
  date: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  holdingPeriod: string;           // e.g., '2h', '3d', '1w'
  emotionalState: EmotionalState;
  mistakes: TradingMistake[];
  planCompliance: number;          // 0-100%
  notes: string;
  setupType: string;               // e.g., 'breakout', 'pullback', 'trend_follow'
  exitReason: string;              // e.g., 'stop_loss', 'target', 'manual'
  tags: string[];
}

export interface BehaviorMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  maxDrawdown: number;
  planComplianceRate: number;
  mistakeFrequency: Record<TradingMistake, number>;
  emotionalBreakdown: Record<EmotionalState, number>;
  bestDay: string | null;
  worstDay: string | null;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  metrics: BehaviorMetrics;
  topMistake: string;
  dominantEmotion: string;
  improvementTip: string;
  journalEntries: string[];        // entry IDs
}

// ============ Chat ============
export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: string;
  type: 'text' | 'trade' | 'alert' | 'system';
  read: boolean;
}

export interface ChatRoom {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageSender?: string;
  unreadCount: number;
  participants: { userId: string; userName: string; isOnline: boolean }[];
  type: 'group' | 'direct';
  topic?: string;
  stockSymbol?: string;
}

// ============ F&O (Futures & Options) Types ============

export type FnOExpiryType = 'weekly' | 'monthly';

export interface FnOExpiry {
  id: string;
  date: string; // ISO date
  type: FnOExpiryType;
  daysToExpiry: number;
  isMonthly: boolean;
}

export interface FutureContract {
  symbol: string;
  underlying: string;
  expiry: string;
  expiryDate: string;
  lotSize: number;
  price: number;
  change: number;
  changePercent: number;
  openInterest: number;
  oiChange: number;
  oiChangePercent: number;
  volume: number;
  basis: number; // futures - spot
  basisPercent: number;
}

export interface OptionContract {
  strike: number;
  expiry: string;
  type: 'CE' | 'PE';
  
  // Pricing
  ltp: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  iv: number; // Implied Volatility (%)
  
  // Greeks
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  
  // Volume & OI
  volume: number;
  openInterest: number;
  oiChange: number;
  
  // Moneyness
  moneyness: 'ITM' | 'ATM' | 'OTM';
  intrinsicValue: number;
  timeValue: number;
}

export interface OptionChainRow {
  strike: number;
  ce: OptionContract | null;
  pe: OptionContract | null;
}

export interface OptionChain {
  underlying: string;
  underlyingPrice: number;
  spotPrice: number;
  expiry: string;
  expiryDate: string;
  rows: OptionChainRow[];
  totalCEOi: number;
  totalPEOi: number;
  totalCEVolume: number;
  totalPEVolume: number;
  maxPain: number;
  pcr: number; // Put-Call Ratio
}

export type StrategyLegAction = 'buy' | 'sell';
export type StrategyLegType = 'CE' | 'PE' | 'FUTURE';

export interface StrategyLeg {
  id: string;
  action: StrategyLegAction;
  type: StrategyLegType;
  strike: number;
  expiry: string;
  quantity: number;
  premium: number; // per unit (lot)
  lotSize: number;
}

export interface FnOStrategy {
  id: string;
  name: string;
  description: string;
  legs: StrategyLeg[];
  maxProfit: number;
  maxLoss: number;
  breakevenPoints: number[];
  isBullish: boolean;
  isBearish: boolean;
  isNeutral: boolean;
  riskCategory: 'low' | 'moderate' | 'high';
}

export interface StrategyPnLPoint {
  underlyingPrice: number;
  pnl: number;
  legPnls?: number[];
}

export interface FnOPosition {
  id: string;
  symbol: string;
  type: 'FUTURE' | 'CE' | 'PE';
  strike?: number;
  expiry: string;
  action: 'buy' | 'sell';
  quantity: number;
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  premium?: number;
  pnl: number;
  pnlPercent: number;
  timestamp: string;
}

// ============ Social Trading ============

export type TraderStrategy =
  | 'swing_trading'
  | 'intraday'
  | 'long_term'
  | 'options_selling'
  | 'futures'
  | 'value_investing'
  | 'momentum';

export interface TraderProfile {
  id: string;
  name: string;
  avatar?: string;
  bio: string;
  strategy: TraderStrategy;
  experienceYears: number;
  totalPnl: number;
  totalPnlPercent: number;
  monthlyReturn: number;
  winRate: number;
  totalTrades: number;
  followers: number;
  copyTraders: number;
  avgHoldingDays: number;
  maxDrawdown: number;
  riskScore: 'low' | 'moderate' | 'high';
  verified: boolean;
  joinedAt: string;
  topStocks: string[];
  badges: string[];
}

export interface CopiedTrade {
  id: string;
  traderId: string;
  traderName: string;
  traderAvatar?: string;
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  executedAt: string;
  pnl?: number;
  pnlPercent?: number;
  isOpen: boolean;
  allocationPercent: number; // % of portfolio allocated
}

export interface CopyTradeRelation {
  traderId: string;
  traderName: string;
  traderAvatar?: string;
  /** 0-100: % of trader's orders to auto-copy */
  allocationPercent: number;
  /** ₹ amount allocated to this copy strategy */
  investmentAmount: number;
  /** Total P&L from copies */
  totalPnl: number;
  activeTrades: number;
  startedAt: string;
  isPaused: boolean;
}

/**
 * A public trade displayed on a trader's profile page.
 * Shows entry/exit, holding period, P&L, and status.
 */
export interface TraderPublicTrade {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  holdingPeriod: string;      // e.g. '2h', '3d', '1w'
  entryDate: string;
  exitDate: string;
  isOpen: boolean;
  setupType?: string;          // e.g. 'breakout', 'pullback'
  exitReason?: string;         // e.g. 'stop_loss', 'target', 'manual'
  tags?: string[];
}

/** Cached PnL data point for trader profile charts */
export interface TraderPnLPoint {
  date: string;
  cumulativePnl: number;
}

export type LeaderboardSort = 'pnl' | 'winRate' | 'followers' | 'returns' | 'trades';
export type LeaderboardPeriod = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface LeaderboardEntry extends TraderProfile {
  rank: number;
  change: 'up' | 'down' | 'same';
  rankChange: number;
}

// ============ KYC Types ============

export type KycStepId = 'pan' | 'aadhaar' | 'bank' | 'signature' | 'risk';
export type KycStatus = 'pending' | 'in_progress' | 'verified' | 'rejected';

/** Individual KYC step tracking */
export interface KycStepStatus {
  stepId: KycStepId;
  label: string;
  status: KycStatus;
  completedAt?: string;
  message?: string;
}

/** PAN verification result */
export interface PanVerificationResult {
  panNumber: string;
  fullName: string;
  isVerified: boolean;
  nameMatch?: boolean;        // Whether name matches user profile
  nameOnPan?: string;         // Name as per PAN database
  category?: string;          // Individual, Company, etc.
  status: string;             // VALID, INVALID, NOT_FOUND
  lastUpdated?: string;
}

/** Aadhaar eKYC verification flow */
export interface AadhaarOtpResponse {
  referenceId: string;
  message: string;
  expiresAt: string;
}

export interface AadhaarVerifyResponse {
  referenceId: string;
  isVerified: boolean;
  lastFourDigits: string;
  name?: string;              // Masked name from UIDAI
  yearOfBirth?: string;
  gender?: string;
  state?: string;
  message: string;
}

/** DigiLocker document fetch */
export interface DigiLockerAuthUrl {
  authUrl: string;
  referenceId: string;
}

export interface DigiLockerDocument {
  id: string;
  name: string;
  issuerId: string;
  issuerName: string;
  documentType: string;
  issuedAt: string;
  uri: string;
}

export interface DigiLockerFetchResponse {
  referenceId: string;
  isVerified: boolean;
  documents: DigiLockerDocument[];
  message: string;
}

// ============ Bank Account Linking ============

/** IFSC code verification result */
export interface IFSCVerificationResult {
  ifsc: string;
  bankName: string;
  branch: string;
  address: string;
  city: string;
  state: string;
  contact: string;
  isValid: boolean;
  micrCode?: string;
}

/** Bank account holder name validation result */
export interface AccountVerificationResult {
  accountNumber: string;
  ifsc: string;
  accountHolderName: string;
  isValid: boolean;
  bankName: string;
  message: string;
  nameMatchScore?: number;
}

/** Linked bank account stored in user profile */
export interface LinkedBankAccount {
  id: string;
  bankName: string;
  accountNumber: string;  // Masked: XXXX1234
  ifsc: string;
  accountHolderName: string;
  accountType: 'savings' | 'current' | 'salary' | 'other';
  isPrimary: boolean;
  linkedAt: string;
  verified: boolean;
}

/** Full KYC state for a user */
export interface KycState {
  status: KycStatus;
  steps: KycStepStatus[];
  panVerification?: PanVerificationResult;
  aadhaarVerified?: boolean;
  digiLockerLinked?: boolean;
  completedAt?: string;
  updatedAt?: string;
}

// ============ IPO Applications ============

export interface IPOApplication {
  id: string;
  ipoId: string;
  companyName: string;
  logo: string;
  sector: string;
  /** Number of lots applied */
  bidLots: number;
  /** Total shares = bidLots * lotSize */
  bidQuantity: number;
  /** Bid price per share */
  bidPrice: number;
  /** Total amount = bidQuantity * bidPrice */
  totalAmount: number;
  /** UPI ID used for application */
  upiId: string;
  status: 'pending' | 'submitted' | 'pending_allotment' | 'allotted' | 'not_allotted';
  /** Shares allotted (if status === 'allotted') */
  sharesAllotted?: number;
  /** Allotment date */
  allotmentDate?: string;
  /** Listing price (if listed) */
  listingPrice?: number;
  /** Listing gain % (if listed) */
  listingGain?: number;
  /** When the application was submitted */
  appliedAt: string;
}

// ============ Certificates ============

export interface CourseCertificate {
  id: string;
  courseId: string;
  courseTitle: string;
  userName: string;
  /** Number of lessons completed / total lessons */
  completedLessons: number;
  totalLessons: number;
  /** Grade: 'A' (≥90%), 'B' (≥75%), 'C' (≥60%) */
  grade: 'A' | 'B' | 'C';
  /** Score earned from quizzes (if applicable) */
  quizScore?: number;
  /** Percentage of quiz questions answered correctly */
  quizPercent?: number;
  /** ISO timestamp when certificate was issued */
  issuedAt: string;
  /** Certificate serial number (unique) */
  serialNumber: string;
  /** File URI if PDF has been generated */
  pdfUri?: string;
}

// ============ Learning Paths ============
/** A curated learning path that groups courses into a sequence */
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  /** Icon/emoji for the path card */
  icon: string;
  /** Gradient colors for the path card */
  gradient: [string, string];
  /** Difficulty level */
  level: 'beginner' | 'intermediate' | 'advanced';
  /** Ordered list of course IDs in this path */
  courseIds: string[];
  /** Number of users enrolled */
  enrolledCount: number;
  /** Estimated total duration */
  totalDuration: string;
  /** Number of lessons across all courses */
  totalLessons: number;
  /** Target audience description */
  targetAudience: string;
  /** Skills you'll gain */
  skillsGained: string[];
}

// ============ Financial Glossary ============
/** A single term in the Financial Glossary */
export interface GlossaryTerm {
  id: string;
  /** The term/word (e.g. "SIP", "Blue Chip", "EBITDA") */
  term: string;
  /** Short one-line definition */
  shortDefinition: string;
  /** Detailed explanation (2-5 paragraphs) */
  detailedDefinition: string;
  /** Category for grouping (e.g. "Equity", "Derivatives", "Mutual Funds", "Tax", "Economy") */
  category: string;
  /** Related term IDs for cross-references */
  relatedTerms?: string[];
  /** Example usage sentence */
  example?: string;
  /** Tags for search */
  tags?: string[];
  /** An icon/emoji representing this term */
  icon?: string;
}

// ============ Earnings Call Summaries ============
/** Key financial metrics from an earnings report */
export interface EarningsMetrics {
  revenue: number;          // Revenue in Cr
  revenueGrowth: number;    // YoY growth %
  netProfit: number;        // Net profit in Cr
  profitGrowth: number;     // YoY growth %
  eps: number;              // Earnings per share
  epsGrowth: number;        // YoY growth %
  operatingMargin: number;  // Operating margin %
  netMargin: number;        // Net margin %
  revenueBeat: number | null;    // % beat vs estimate (+ve = beat)
  profitBeat: number | null;     // % beat vs estimate (+ve = beat)
  ebitda: number;           // EBITDA in Cr
  ebitdaMargin: number;     // EBITDA margin %
}

/** A single quarter's earnings data point for historical comparison */
export interface EarningsQuarter {
  quarter: string;          // e.g. "Q4 FY26"
  date: string;             // ISO date
  revenue: number;
  netProfit: number;
  eps: number;
  margin: number;
}

/** AI-generated earnings call summary */
export interface EarningsSummary {
  id: string;
  symbol: string;
  companyName: string;
  quarter: string;            // e.g. "Q4 FY26"
  fiscalYear: string;         // e.g. "FY26"
  date: string;               // ISO date of earnings release
  
  // Key Metrics
  metrics: EarningsMetrics;
  
  // Peer Comparison
  peerComparison: {
    symbol: string;
    name: string;
    revenue: number;
    profit: number;
    peRatio: number;
    revenueGrowth: number;
    profitGrowth: number;
  }[];
  
  // Historical Trends (last 4 quarters)
  historicalQuarters: EarningsQuarter[];
  
  // Management Commentary
  managementHighlights: string[];
  
  // Growth Drivers
  growthDrivers: string[];
  
  // Risks & Concerns
  riskFactors: string[];
  
  // Analyst Sentiment
  analystConsensus: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  analystTargetPrice: number;
  analystTargetLow: number;
  analystTargetHigh: number;
  
  // AI Summary
  executiveSummary: string;
  keyTakeaways: string[];
  
  // Sentiment
  sentimentScore: number;     // -100 to +100
  sentimentLabel: 'bullish' | 'bearish' | 'neutral';
  confidence: number;         // 0-100
  
  // Market Reaction
  marketReaction: {
    preMarketChange: number;
    dayChange: number;
    volumeSurge: number;      // vs 30-day avg
  };
  
  // Metadata
  source: string;
  transcriptUrl?: string;
  presentationUrl?: string;
}

// ============ Sentiment Analysis ============

/** Source breakdown for sentiment score */
export interface SentimentSourceBreakdown {
  newsScore: number;       // -100 to +100 from news articles
  socialScore: number;      // -100 to +100 from social media
  analystScore: number;     // -100 to +100 from analyst ratings
  aiScore: number;          // -100 to +100 from AI analysis
}

/** A single sentiment data point for a date */
export interface SentimentDataPoint {
  date: string;
  overallScore: number;  // -100 to +100
  sourceBreakdown: SentimentSourceBreakdown;
  articleCount: number;
  mentionCount: number;
}

/** Recent news article with sentiment for the feed */
export interface SentimentArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;         // -100 to +100
  publishedAt: string;
  url?: string;
}

/** Full sentiment state for a stock */
export interface StockSentiment {
  symbol: string;
  name: string;
  sector: string;
  currentScore: number;             // -100 to +100 (current aggregated)
  previousScore: number;            // Score from previous day
  scoreChange: number;              // Change from previous day
  label: 'bullish' | 'bearish' | 'neutral';
  confidence: number;               // 0-100
  sourceBreakdown: SentimentSourceBreakdown;
  history: SentimentDataPoint[];    // Last 30 days of sentiment
  recentArticles: SentimentArticle[];
  topKeywords: string[];
  mentionVolume: number;            // Total mentions today
  mentionChange: number;             // % change in mentions vs yesterday
}

// ============ Sentiment Alert Rules ============

/** Sensitivity level for sentiment shift detection */
export type SentimentAlertSensitivity = 'low' | 'medium' | 'high';

/** Direction of sentiment shift to alert on */
export type SentimentAlertDirection = 'improving' | 'deteriorating' | 'both';

/** A user-configured rule for sentiment shift alerts */
export interface SentimentAlertRule {
  id: string;
  symbol: string;
  stockName: string;
  sector: string;
  /** How sensitive the alert is: low=25pt, medium=15pt, high=10pt shift threshold */
  sensitivity: SentimentAlertSensitivity;
  /** Which direction of shift triggers the alert */
  direction: SentimentAlertDirection;
  /** Whether this rule has already fired (resets when sentiment data refreshes) */
  triggered: boolean;
  /** Whether the rule is active */
  enabled: boolean;
  /** ISO timestamp when the rule was created */
  createdAt: string;
  /** ISO timestamp when the rule last triggered */
  lastTriggeredAt?: string;
}

/** A record of a sentiment alert that was triggered */
export interface SentimentAlertTrigger {
  id: string;
  ruleId: string;
  symbol: string;
  stockName: string;
  /** The shift magnitude at trigger time */
  magnitude: number;
  /** Direction of the shift */
  direction: 'improving' | 'deteriorating';
  /** The current sentiment score */
  score: number;
  /** Previous sentiment score */
  previousScore: number;
  /** Human-readable alert message */
  message: string;
  /** ISO timestamp when triggered */
  timestamp: string;
  /** Whether the user has seen this alert */
  read: boolean;
}

// ============ Referral Program ============

/** A single referral reward record */
export interface ReferralReward {
  id: string;
  /** Referred user's user ID */
  referredUserId: string;
  /** Referred user's display name */
  referredUserName: string;
  /** When the referred user joined */
  joinedAt: string;
  /** Reward amount in ₹ */
  reward: number;
  /** Status of the reward */
  status: 'pending' | 'credited' | 'expired';
  /** When this reward was created */
  createdAt: string;
  /** When the reward was credited */
  creditedAt?: string;
}

/** Referral program statistics for the current user */
export interface ReferralStats {
  /** The user's unique referral code */
  code: string;
  /** Total number of people referred */
  totalReferrals: number;
  /** Number of referred users who are active */
  activeReferrals: number;
  /** Total reward earned in ₹ */
  totalEarned: number;
  /** Pending reward amount in ₹ */
  pendingRewards: number;
  /** Reward amount per successful referral in ₹ */
  rewardPerReferral: number;
  /** Shareable referral link */
  shareLink: string;
  /** Individual reward records */
  rewards: ReferralReward[];
}

// ============ Monte Carlo Simulation ============

/** Parameters for the Monte Carlo portfolio simulation */
export interface MonteCarloParams {
  /** Initial portfolio value in ₹ */
  initialInvestment: number;
  /** Monthly contribution amount in ₹ */
  monthlyContribution: number;
  /** Expected annual return (as decimal, e.g. 0.12 = 12%) */
  annualReturn: number;
  /** Expected annual volatility (as decimal, e.g. 0.18 = 18%) */
  annualVolatility: number;
  /** Investment horizon in years */
  years: number;
  /** Number of simulation runs */
  simulations: number;
}

/** A single percentile value at a given point */
export interface MonteCarloPercentile {
  /** The percentile (5, 25, 50, 75, 95) */
  percentile: number;
  /** Portfolio value at this percentile */
  value: number;
}

/** Simulation result for a single year */
export interface MonteCarloYearResult {
  year: number;
  percentiles: MonteCarloPercentile[];
}

/** Complete Monte Carlo simulation result */
export interface MonteCarloResult {
  /** The input parameters used */
  params: MonteCarloParams;
  /** Median ending portfolio value (50th percentile) */
  medianEndValue: number;
  /** Best-case ending value (95th percentile) */
  bestCaseValue: number;
  /** Worst-case ending value (5th percentile) */
  worstCaseValue: number;
  /** Percentage of simulations that end with positive returns */
  probabilityOfProfit: number;
  /** Result at each year (for charting) */
  yearResults: MonteCarloYearResult[];
  /** Final portfolio values across all simulations (for histogram) */
  finalValues: number[];
  /** All simulation paths (for fan chart) */
  allPaths: number[][];
}

// ============ Correlation Matrix ============

/** A single correlation value between two assets */
export interface CorrelationPair {
  /** First asset symbol */
  asset1: string;
  /** Second asset symbol */
  asset2: string;
  /** Pearson correlation coefficient (-1 to +1) */
  correlation: number;
  /** Number of data points used */
  dataPoints: number;
}

/** Full correlation matrix result */
export interface CorrelationMatrix {
  /** All asset symbols included in the matrix */
  symbols: string[];
  /** All unique asset pairs with their correlation values */
  pairs: CorrelationPair[];
  /** 2D matrix for heatmap rendering: matrix[i][j] = correlation(symbols[i], symbols[j]) */
  matrix: number[][];
  /** Average cross-correlation (lower = better diversification) */
  averageCorrelation: number;
  /** Diversification score (0-100, higher = better diversified) */
  diversificationScore: number;
  /** Pairs that are highly correlated (>0.7) */
  highCorrelationPairs: { asset1: string; asset2: string; correlation: number }[];
  /** Recommendations based on the correlation analysis */
  recommendations: string[];
}

// ============ Currency Markets ============

/** A forex currency pair with real-time rates and daily change */
export interface CurrencyPair {
  id: string;
  /** Currency pair code (e.g. "USD/INR", "EUR/INR") */
  pair: string;
  /** Base currency code (e.g. "USD", "EUR") */
  baseCurrency: string;
  /** Quote currency code (e.g. "INR") */
  quoteCurrency: string;
  /** Full pair name (e.g. "US Dollar / Indian Rupee") */
  name: string;
  /** Current exchange rate (how many quote currency per base) */
  rate: number;
  /** Change in rate from previous close */
  change: number;
  /** Change as percentage */
  changePercent: number;
  /** Day high */
  dayHigh: number;
  /** Day low */
  dayLow: number;
  /** 52-week high */
  week52High: number;
  /** 52-week low */
  week52Low: number;
  /** Reserve Bank of India reference rate status */
  isRbiReference: boolean;
  /** Region category */
  region: 'major' | 'asian' | 'other';
  /** Icon emoji for the currency */
  icon: string;
  /** Color for UI display */
  color: string;
  /** Brief market trend / analysis description */
  trend?: string;
  /** Annualized volatility percentage */
  volatility?: number;
}

// ============ Bond Dashboard ============

/** Category of bond issuer */
export type BondCategory = 'government' | 'corporate' | 'state' | 'municipal';

/** Credit rating category */
export type BondRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D';

/** A bond instrument displayed in the bond dashboard */
export interface Bond {
  id: string;
  /** Short identifier (e.g. "7.18% GS 2033") */
  name: string;
  /** Issuer name (e.g. "Government of India", "Reliance Industries") */
  issuer: string;
  category: BondCategory;
  /** Coupon rate as percentage */
  couponRate: number;
  /** Current yield to maturity as percentage */
  yieldToMaturity: number;
  /** Maturity date in ISO format */
  maturityDate: string;
  /** Years remaining until maturity */
  yearsToMaturity: number;
  /** Face value of the bond */
  faceValue: number;
  /** Current market price (as % of face value) */
  currentPrice: number;
  /** Credit rating */
  rating: BondRating;
  /** Whether interest is taxable */
  isTaxable: boolean;
  /** Whether the bond is listed on an exchange */
  isListed: boolean;
  /** Issue size in ₹ Cr */
  issueSize: number;
  /** Change in yield from previous day (basis points) */
  yieldChangeBps: number;
  /** Sector of corporate bond issuer */
  sector?: string;
  /** Description of the bond */
  description: string;
}

// ============ Factor Analysis ============

/** Names of the supported investment factors */
export type FactorName = 'momentum' | 'value' | 'size' | 'quality' | 'low_volatility';

/** Exposure score for a single factor, normalized 0–100 */
export interface FactorExposure {
  /** Factor name */
  factor: FactorName;
  /** Display label */
  label: string;
  /** Exposure score 0–100 */
  score: number;
  /** Benchmark score (e.g. Nifty average for this factor) */
  benchmark: number;
  /** Whether portfolio is overweight (+), neutral (~), or underweight (-) vs benchmark */
  tilt: 'overweight' | 'neutral' | 'underweight';
  /** Short interpretation of the exposure */
  interpretation: string;
  /** Icon emoji for the factor */
  icon: string;
  /** Color hex for badges/charts */
  color: string;
}

/** Per-stock contribution to each factor */
export interface StockFactorContribution {
  symbol: string;
  name: string;
  /** Portfolio weight % */
  weight: number;
  /** Contribution to each factor (0–1 normalized) */
  contributions: Partial<Record<FactorName, number>>;
}

/** Full factor analysis result */
export interface FactorAnalysisResult {
  /** All factor exposures */
  factors: FactorExposure[];
  /** Per-stock breakdown of factor contributions */
  stockContributions: StockFactorContribution[];
  /** Overall portfolio style label */
  dominantStyle: string;
  /** Key insights / takeaways */
  insights: string[];
  /** Actionable recommendations */
  recommendations: string[];
}

// ============ Tax Harvesting Calendar ============

/** A realized loss from a completed sell trade */
export interface RealizedLoss {
  /** Trade ID that generated this loss */
  tradeId: string;
  /** Stock symbol */
  symbol: string;
  /** Stock name */
  name: string;
  /** Loss amount in INR (positive = loss magnitude) */
  loss: number;
  /** Date the loss was realized */
  date: string;
  /** Holding period category */
  holdingType: 'short_term' | 'long_term';
  /** Number of days held */
  holdingDays: number;
  /** Quantity sold */
  quantity: number;
}

/** A potential tax-loss harvesting opportunity */
export interface TaxHarvestOpportunity {
  id: string;
  /** Stock symbol */
  symbol: string;
  /** Stock name */
  name: string;
  /** Unrealized loss amount in INR */
  unrealizedLoss: number;
  /** Unrealized loss as percentage */
  lossPercent: number;
  /** Current holdings quantity */
  quantity: number;
  /** Average buy price */
  buyPrice: number;
  /** Current market price */
  currentPrice: number;
  /** How many days until the holding becomes long-term (>365 days) */
  daysToLongTerm: number;
  /** Current holding period in days */
  holdingDays: number;
  /** How much tax this loss could offset (INR) */
  potentialTaxSaved: number;
  /** Which type of gains this loss can offset */
  offsetsType: 'long_term_only' | 'both';
  /** Whether selling would trigger a wash sale risk */
  washSaleRisk: boolean;
  /** Recommended action */
  recommendation: 'harvest_now' | 'wait_long_term' | 'avoid';
  /** Priority score (0-100), higher = better opportunity */
  priorityScore: number;
  /** Sector of the stock */
  sector: string;
}

/** A tax year summary */
export interface TaxYearSummary {
  /** Financial year (e.g. "FY 2025-26") */
  fiscalYear: string;
  /** Total short-term realized gains */
  shortTermGains: number;
  /** Total long-term realized gains */
  longTermGains: number;
  /** Total realized losses across all trades */
  totalRealizedLosses: number;
  /** Taxable LTCG after ₹1L exemption */
  taxableLtcg: number;
  /** Total estimated tax savings from harvesting */
  estimatedTaxSavings: number;
  /** Estimated tax liability after harvesting */
  estimatedTaxLiability: number;
  /** All realized losses from the period */
  realizedLosses: RealizedLoss[];
  /** Harvesting opportunities identified */
  opportunities: TaxHarvestOpportunity[];
  /** Key insights */
  insights: string[];
}

// ============ Dividend Tracker ============

/** Frequency of dividend payments */
export type DividendFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'irregular';

/** Confidence level of a dividend event */
export type DividendConfidence = 'estimated' | 'confirmed' | 'paid';

/** A single dividend payment event (upcoming, confirmed, or historical) */
export interface DividendEvent {
  id: string;
  /** Stock symbol */
  symbol: string;
  /** Company name */
  name: string;
  /** Record/ex-dividend date */
  exDate: string;
  /** Payment date */
  payDate: string;
  /** Dividend amount per share in INR */
  amountPerShare: number;
  /** Number of shares held */
  quantity: number;
  /** Total payment = amountPerShare * quantity */
  totalAmount: number;
  /** Dividend yield percentage (annual) */
  yieldPercent: number;
  /** Frequency of payments */
  frequency: DividendFrequency;
  /** Confidence level */
  confidence: DividendConfidence;
  /** Sector of the stock */
  sector: string;
}

/** Monthly dividend income summary */
export interface MonthlyDividend {
  month: string;        // "YYYY-MM" format
  label: string;        // e.g. "Jan 2026"
  totalAmount: number;
  events: DividendEvent[];
  count: number;
}

/** Annual dividend summary */
export interface AnnualDividendSummary {
  year: number;
  totalIncome: number;
  monthlyAverage: number;
  months: MonthlyDividend[];
  topPayers: { symbol: string; name: string; totalAmount: number }[];
}

/** Full dividend tracker state */
export interface DividendTrackerState {
  /** Upcoming dividend events (next 12 months) */
  upcoming: DividendEvent[];
  /** Historical dividend payments */
  history: DividendEvent[];
  /** Monthly breakdown of historical income */
  monthlyHistory: MonthlyDividend[];
  /** Annual summaries */
  annualSummaries: AnnualDividendSummary[];
  /** Current year projection */
  currentYearProjection: {
    totalEstimated: number;
    monthlyAverage: number;
    yieldOnCost: number;  // dividend income / total cost * 100
    portfolioYield: number; // dividend income / portfolio value * 100
    topPayers: { symbol: string; name: string; totalAmount: number; yieldPercent: number }[];
  };
  /** All-time total dividend income */
  lifetimeIncome: number;
  /** Total number of dividend payments received */
  totalPayments: number;
}

// ============ Commodity Markets ============

/** A commodity (precious metal, energy, agricultural) traded on exchanges */
export interface CommodityAsset {
  id: string;
  /** Commodity name (e.g. "Gold", "Crude Oil") */
  name: string;
  /** Symbol/ticker (e.g. "XAUUSD", "CL")" */
  symbol: string;
  /** Category: metals, energy, agriculture */
  category: 'metals' | 'energy' | 'agriculture';
  /** Current price in USD */
  price: number;
  /** Daily change in price */
  change: number;
  /** Daily change percentage */
  changePercent: number;
  /** Day high */
  dayHigh: number;
  /** Day low */
  dayLow: number;
  /** 52-week high */
  week52High: number;
  /** 52-week low */
  week52Low: number;
  /** Unit of measurement (e.g. "oz", "barrel", "bushel") */
  unit: string;
  /** Price change in INR terms (1 unit) */
  inrPrice?: number;
  /** Icon emoji */
  icon: string;
  /** Display color */
  color: string;
  /** Brief market analysis */
  trend?: string;
  /** Annualized volatility % */
  volatility?: number;
  /** Global inventory/production stat */
  stat?: string;
}

// ============ User-Generated Courses ============

/** Publication status of a user-created course */
export type CoursePublishStatus = 'draft' | 'published' | 'archived';

/** Extended Course type for user-generated content with creator info */
export interface UserGeneratedCourse {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  lessonsCount: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  /** Creator information */
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  /** Publication workflow */
  publishStatus: CoursePublishStatus;
  /** Whether the course has been submitted for review */
  submittedForReview: boolean;
  /** Admin review notes (if rejected) */
  reviewNotes?: string;
  /** Whether the course is featured (admin-curated) */
  isFeatured?: boolean;
  /** Course lessons (only populated when editing) */
  lessons?: CourseDraftLesson[];
  /** Enrollment & rating */
  enrolledCount: number;
  rating: number;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  /** Tags for discoverability */
  tags: string[];
}

/** A lesson in a user-generated course (editable version) */
export interface CourseDraftLesson {
  id: string;
  title: string;
  content: string;
  duration: string;
  /** Optional video URL */
  videoUrl?: string;
  /** Optional quiz attached to this lesson */
  quiz?: Quiz;
}

/** Creator dashboard statistics */
export interface CreatorStats {
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  totalEnrollments: number;
  totalLessons: number;
  averageRating: number;
  totalEarnings: number; // ₹ from purchased courses
}

// ============ Company Fundamentals ============

/** A single quarter's financial performance data */
export interface FinancialQuarter {
  /** Quarter label e.g. "Q4 FY26" */
  quarter: string;
  /** ISO date of the quarter end */
  date: string;
  /** Total revenue in Cr */
  revenue: number;
  /** Net profit in Cr */
  netProfit: number;
  /** Earnings per share in INR */
  eps: number;
  /** Net profit margin % */
  margin: number;
}

/** Full company fundamental data including ratios and quarterly results */
export interface CompanyFundamentals {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  
  // Valuation Ratios
  peRatio: number;              // Price-to-Earnings
  pbRatio: number;              // Price-to-Book
  psRatio: number;              // Price-to-Sales
  evEbitda: number;             // Enterprise Value / EBITDA
  
  // Profitability Ratios
  roe: number;                  // Return on Equity (%)
  roa: number;                  // Return on Assets (%)
  roce: number;                 // Return on Capital Employed (%)
  operatingMargin: number;      // Operating margin (%)
  netMargin: number;            // Net profit margin (%)
  
  // Efficiency Ratios
  assetTurnover: number;        // Asset turnover ratio
  inventoryTurnover: number;    // Inventory turnover
  receivablesDays: number;      // Days sales outstanding
  
  // Liquidity Ratios
  currentRatio: number;         // Current ratio
  quickRatio: number;           // Quick ratio
  debtToEquity: number;         // Debt-to-Equity
  interestCoverage: number;     // Interest coverage ratio
  
  // Growth Metrics (YoY %)
  revenueGrowth: number;
  profitGrowth: number;
  epsGrowth: number;
  
  // Cash Flow
  operatingCashFlow: number;    // Operating CF in Cr
  freeCashFlow: number;         // Free CF in Cr
  
  // Dividend
  dividendYield: number;        // Dividend yield (%)
  dividendPayout: number;       // Dividend payout ratio (%)
  
  // Shareholding
  promotersHolding: number;     // Promoter holding (%)
  fiiHolding: number;           // FII holding (%)
  mutualFundHolding: number;    // MF holding (%)
  publicHolding: number;        // Public holding (%)
  
  // Quarterly Results (last 4 quarters)
  quarterlyResults: FinancialQuarter[];
  
  // Annual Results (last 3 years)
  annualResults: FinancialQuarter[];
  
  // Peer Comparison (sector averages)
  sectorAvgPe: number;
  sectorAvgPb: number;
  sectorAvgRoce: number;
  sectorAvgDebtEquity: number;
  
  // Company Info
  website: string;
  about: string;
  strengths: string[];
  risks: string[];
}

// ============ Navigation Types ============
// ============ 2FA / TOTP Types ============

/** Response from 2FA setup endpoint */
// ============ Webhook Management ============

/** Events that can trigger a webhook */
export type WebhookEvent =
  | 'trade:executed'
  | 'order:placed'
  | 'order:filled'
  | 'order:cancelled'
  | 'price:alert_triggered'
  | 'portfolio:change'
  | 'portfolio:threshold'
  | 'watchlist:change'
  | 'market:open'
  | 'market:close'
  | 'sentiment:shift'
  | 'ai:insight_ready'
  | 'subscription:renewal'
  | 'system:error';

/** Metadata for each webhook event type */
export interface WebhookEventMeta {
  event: WebhookEvent;
  label: string;
  description: string;
  icon: string;
  color: string;
  category: 'trading' | 'portfolio' | 'market' | 'system' | 'ai';
}

/** Default webhook event metadata */
export const WEBHOOK_EVENTS: Record<WebhookEvent, WebhookEventMeta> = {
  'trade:executed':       { event: 'trade:executed',       label: 'Trade Executed',      description: 'When a trade is successfully executed',       icon: 'swap-horizontal', color: '#00C853', category: 'trading' },
  'order:placed':         { event: 'order:placed',         label: 'Order Placed',        description: 'When a new order is placed',                icon: 'cart',            color: '#3B82F6', category: 'trading' },
  'order:filled':         { event: 'order:filled',         label: 'Order Filled',        description: 'When an order is fully filled',             icon: 'checkmark-circle',color: '#00E676', category: 'trading' },
  'order:cancelled':      { event: 'order:cancelled',      label: 'Order Cancelled',     description: 'When an order is cancelled',                icon: 'close-circle',    color: '#FF5252', category: 'trading' },
  'price:alert_triggered':{ event: 'price:alert_triggered',label: 'Price Alert',         description: 'When a price alert condition is met',       icon: 'notifications',   color: '#FFC107', category: 'market' },
  'portfolio:change':     { event: 'portfolio:change',     label: 'Portfolio Change',    description: 'When portfolio composition changes',         icon: 'pie-chart',       color: '#8B5CF6', category: 'portfolio' },
  'portfolio:threshold':  { event: 'portfolio:threshold',  label: 'P&L Threshold',      description: 'When P&L crosses a set threshold',          icon: 'trending-up',     color: '#FF6B00', category: 'portfolio' },
  'watchlist:change':     { event: 'watchlist:change',     label: 'Watchlist Change',    description: 'When watchlist items are modified',          icon: 'heart',           color: '#FF5252', category: 'portfolio' },
  'market:open':          { event: 'market:open',          label: 'Market Open',         description: 'When the market opens for trading',         icon: 'sunny',           color: '#06B6D4', category: 'market' },
  'market:close':         { event: 'market:close',         label: 'Market Close',        description: 'When the market closes for trading',         icon: 'moon',            color: '#475569', category: 'market' },
  'sentiment:shift':      { event: 'sentiment:shift',      label: 'Sentiment Shift',     description: 'When stock sentiment changes significantly', icon: 'analytics',       color: '#6C63FF', category: 'ai' },
  'ai:insight_ready':     { event: 'ai:insight_ready',     label: 'AI Insight Ready',    description: 'When new AI analysis is available',          icon: 'bulb',            color: '#FFC107', category: 'ai' },
  'subscription:renewal': { event: 'subscription:renewal', label: 'Subscription Event',  description: 'When subscription is renewed/expires',       icon: 'diamond',         color: '#10B981', category: 'system' },
  'system:error':         { event: 'system:error',         label: 'System Error',        description: 'When a critical error occurs',              icon: 'warning',         color: '#FF5252', category: 'system' },
};

/** A configured webhook endpoint */
export interface WebhookConfig {
  id: string;
  /** Display name for this webhook */
  name: string;
  /** Target URL */
  url: string;
  /** Secret token for signature verification */
  secret: string;
  /** Selected events to send */
  events: WebhookEvent[];
  /** Whether the webhook is active */
  isActive: boolean;
  /** When the webhook was created */
  createdAt: string;
  /** Last time this webhook was triggered */
  lastTriggeredAt: string | null;
  /** Total delivery count */
  deliveryCount: number;
  /** Successful delivery count */
  successCount: number;
  /** Optional description */
  description: string;
}

/** A single delivery attempt log entry */
export interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  /** Which event triggered this delivery */
  event: WebhookEvent;
  /** HTTP status code from the target */
  statusCode: number;
  /** Whether the delivery was successful */
  success: boolean;
  /** Duration in ms */
  duration: number;
  /** Response body (truncated) */
  responseBody: string;
  /** Error message if failed */
  errorMessage: string | null;
  /** When the delivery was attempted */
  timestamp: string;
}

// ============ A/B Test Runner ============

/** Status of an A/B experiment */
export type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

/** A variant in an A/B experiment */
export interface ABVariant {
  id: string;
  /** Display name (e.g. "Control", "Variant A") */
  name: string;
  /** Description of what this variant changes */
  description: string;
  /** Percentage of users assigned to this variant (0-100) */
  trafficPercent: number;
  /** Number of users assigned */
  assignedUsers: number;
  /** Number of conversions */
  conversions: number;
  /** Conversion rate (0-100%) */
  conversionRate: number;
  /** Statistical confidence (0-100%) */
  confidence: number;
  /** Whether this is the control variant */
  isControl: boolean;
  /** Color for UI */
  color: string;
}

/** An A/B experiment */
export interface ABExperiment {
  id: string;
  /** Experiment name */
  name: string;
  /** Description */
  description: string;
  /** Feature being tested */
  featureKey: string;
  /** Current status */
  status: ABTestStatus;
  /** Variants in this experiment */
  variants: ABVariant[];
  /** Total users enrolled */
  totalUsers: number;
  /** Start date */
  startedAt: string | null;
  /** End date */
  endedAt: string | null;
  /** Created date */
  createdAt: string;
  /** Whether a clear winner exists */
  hasWinner: boolean;
  /** Winner variant ID if available */
  winnerVariantId?: string;
  /** Tags for filtering */
  tags: string[];
  /** Owner/creator */
  owner: string;
}

/** Metric snapshot for an experiment */
export interface ABMetricSnapshot {
  experimentId: string;
  /** Total users exposed */
  totalExposed: number;
  /** Total conversions across all variants */
  totalConversions: number;
  /** Overall conversion rate */
  overallConversionRate: number;
  /** Lift over control (%) */
  liftOverControl: number;
  /** When the metrics were computed */
  computedAt: string;
}

// ============ Portfolio Rebalancing ============

/** A single allocation target for a sector or stock */
export interface AllocationTarget {
  /** Category label (e.g. sector name, stock symbol) */
  label: string;
  /** Icon/emoji */
  icon: string;
  /** Target percentage of total portfolio */
  targetPercent: number;
  /** Current actual percentage */
  currentPercent: number;
  /** Current value in INR */
  currentValue: number;
  /** Color for UI */
  color: string;
}

/** Type of rebalance action */
export type RebalanceActionType = 'buy' | 'sell' | 'hold';

/** A suggested trade to rebalance the portfolio */
export interface RebalanceTrade {
  id: string;
  /** Stock/sector label */
  label: string;
  /** Action */
  action: RebalanceActionType;
  /** Current allocation % */
  currentPercent: number;
  /** Target allocation % */
  targetPercent: number;
  /** Difference % */
  difference: number;
  /** Amount to trade in INR */
  amount: number;
  /** Reason for the suggestion */
  reason: string;
  /** Whether this trade has tax implications */
  hasTaxImplication: boolean;
  /** Estimated tax cost if sold */
  estimatedTaxCost?: number;
  /** Priority (higher = more important) */
  priority: number;
  /** Color */
  color: string;
}

/** Predefined allocation profile */
export interface AllocationProfile {
  id: string;
  name: string;
  description: string;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  /** Target allocation by sector/asset */
  targets: { label: string; icon: string; percent: number; color: string }[];
}

/** Full rebalancing analysis result */
export interface RebalanceAnalysis {
  /** Current portfolio value */
  portfolioValue: number;
  /** Number of deviations from target */
  deviationCount: number;
  /** Average deviation magnitude */
  avgDeviation: number;
  /** Number of suggested trades */
  tradeCount: number;
  /** Total amount to trade */
  totalTradeAmount: number;
  /** Estimated tax impact of rebalancing */
  estimatedTaxImpact: number;
  /** Current allocation */
  currentAllocation: AllocationTarget[];
  /** Suggested trades */
  suggestedTrades: RebalanceTrade[];
}

// ============ Revenue Share Dashboard ============

/** Source of creator earnings */
export type RevenueSource = 'courses' | 'referrals' | 'tips' | 'subscriptions' | 'commissions';

/** Status of a payout request */
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** A single revenue transaction record */
export interface RevenueTransaction {
  id: string;
  /** Source of this revenue */
  source: RevenueSource;
  /** Amount in INR */
  amount: number;
  /** Fee/commission deducted (INR) */
  fee: number;
  /** Net amount after fees */
  netAmount: number;
  /** Description of the transaction */
  description: string;
  /** Source reference (e.g. course ID, referral code) */
  reference?: string;
  /** Source display name (e.g. course title, referred user name) */
  referenceName?: string;
  /** Timestamp */
  createdAt: string;
  /** Whether this has been paid out */
  paidOut: boolean;
}

/** A payout / withdrawal request */
export interface PayoutRequest {
  id: string;
  /** Amount requested in INR */
  amount: number;
  /** Status */
  status: PayoutStatus;
  /** Payout method (UPI, bank, etc.) */
  method: string;
  /** Destination identifier (masked) */
  destination: string;
  /** When the payout was requested */
  requestedAt: string;
  /** When the payout was processed/completed */
  processedAt?: string;
  /** Failure reason if failed */
  failureReason?: string;
  /** Transaction reference ID */
  transactionId?: string;
}

/** Monthly earnings summary */
export interface MonthlyEarnings {
  /** Month label (e.g. "Jan 2026") */
  month: string;
  /** ISO month start */
  monthStart: string;
  /** Total earnings this month */
  total: number;
  /** Breakdown by source */
  breakdown: Partial<Record<RevenueSource, number>>;
  /** Number of transactions */
  transactionCount: number;
}

/** Full revenue share dashboard state */
export interface RevenueDashboardState {
  /** All-time total earnings */
  totalEarnings: number;
  /** Total fees deducted */
  totalFees: number;
  /** Net earnings (after fees) */
  netEarnings: number;
  /** Total paid out */
  totalPaidOut: number;
  /** Pending balance (available for payout) */
  pendingBalance: number;
  /** Earnings breakdown by source */
  breakdownBySource: Record<RevenueSource, { amount: number; count: number; label: string; icon: string; color: string }>;
  /** Recent transactions */
  recentTransactions: RevenueTransaction[];
  /** Monthly history for charts */
  monthlyHistory: MonthlyEarnings[];
  /** Payout history */
  payoutHistory: PayoutRequest[];
  /** Whether a payout is in progress */
  isPayoutInProgress: boolean;
}

// ============ Social Polls & Voting ============

/** Category of a community poll */
export type PollCategory =
  | 'stocks'
  | 'market_outlook'
  | 'strategy'
  | 'economy'
  | 'ipo'
  | 'crypto'
  | 'general';

/** Duration option for a poll (in hours) */
export type PollDuration = 24 | 48 | 72 | 168; // 1d, 2d, 3d, 7d

/** Status of a poll */
export type PollStatus = 'active' | 'closed';

/** A single option in a poll */
export interface PollOption {
  id: string;
  /** Option text */
  text: string;
  /** Number of votes received */
  votes: number;
}

/** A community poll */
export interface Poll {
  id: string;
  /** Poll question */
  question: string;
  /** Available options */
  options: PollOption[];
  /** Total votes across all options */
  totalVotes: number;
  /** When the poll was created */
  createdAt: string;
  /** When the poll expires */
  expiresAt: string;
  /** Poll status */
  status: PollStatus;
  /** Category */
  category: PollCategory;
  /** Creator info */
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  /** Likes/bookmarks */
  likes: number;
  likedByUser: boolean;
  /** Which option the current user voted for (null = not voted) */
  userVote: string | null;
  /** Tags for discoverability */
  tags: string[];
}

/** Poll category display metadata */
export interface PollCategoryMeta {
  category: PollCategory;
  label: string;
  icon: string;
  color: string;
}

/** Default poll category metadata */
export const POLL_CATEGORIES: Record<PollCategory, PollCategoryMeta> = {
  'stocks':         { category: 'stocks',         label: 'Stocks',         icon: 'trending-up',    color: '#3B82F6' },
  'market_outlook': { category: 'market_outlook', label: 'Market Outlook', icon: 'eye',            color: '#8B5CF6' },
  'strategy':       { category: 'strategy',       label: 'Strategy',       icon: 'git-branch',     color: '#00C853' },
  'economy':        { category: 'economy',        label: 'Economy',        icon: 'cash',           color: '#FFC107' },
  'ipo':            { category: 'ipo',            label: 'IPO',            icon: 'rocket',         color: '#FF6B6B' },
  'crypto':         { category: 'crypto',         label: 'Crypto',         icon: 'logo-bitcoin',   color: '#F7931A' },
  'general':        { category: 'general',        label: 'General',        icon: 'chatbubbles',    color: '#06B6D4' },
};

// ============ API Keys & Access Tokens ============

/** Available scopes for API access tokens */
export type ApiKeyScope =
  | 'portfolio:read'
  | 'portfolio:write'
  | 'trades:read'
  | 'trades:write'
  | 'watchlist:read'
  | 'watchlist:write'
  | 'orders:read'
  | 'orders:write'
  | 'market:read'
  | 'account:read'
  | 'ai:read';

/** Display metadata for each scope */
export interface ApiKeyScopeMeta {
  scope: ApiKeyScope;
  label: string;
  description: string;
  icon: string;
  color: string;
}

/** Default scope metadata */
export const API_KEY_SCOPES: Record<ApiKeyScope, ApiKeyScopeMeta> = {
  'portfolio:read':  { scope: 'portfolio:read',  label: 'Portfolio Read',  description: 'View portfolio holdings & P&L',          icon: 'pie-chart',     color: '#3B82F6' },
  'portfolio:write': { scope: 'portfolio:write', label: 'Portfolio Write', description: 'Modify portfolio holdings',             icon: 'pie-chart',     color: '#2563EB' },
  'trades:read':     { scope: 'trades:read',     label: 'Trades Read',     description: 'View trade history',                   icon: 'swap-horizontal', color: '#00C853' },
  'trades:write':    { scope: 'trades:write',    label: 'Trades Write',    description: 'Place & modify trades',                icon: 'swap-horizontal', color: '#009624' },
  'watchlist:read':  { scope: 'watchlist:read',  label: 'Watchlist Read',  description: 'View watchlists',                      icon: 'heart',        color: '#FF5252' },
  'watchlist:write': { scope: 'watchlist:write', label: 'Watchlist Write', description: 'Modify watchlists',                    icon: 'heart',        color: '#D50000' },
  'orders:read':     { scope: 'orders:read',     label: 'Orders Read',     description: 'View open orders & status',           icon: 'clipboard',    color: '#FF9800' },
  'orders:write':    { scope: 'orders:write',    label: 'Orders Write',    description: 'Create & cancel orders',               icon: 'clipboard',    color: '#E65100' },
  'market:read':     { scope: 'market:read',     label: 'Market Data',     description: 'Read market quotes & indices',         icon: 'trending-up',  color: '#8B5CF6' },
  'account:read':    { scope: 'account:read',    label: 'Account Info',    description: 'View account balance & profile',       icon: 'person',       color: '#06B6D4' },
  'ai:read':         { scope: 'ai:read',         label: 'AI Access',       description: 'Use AI insights & analysis',           icon: 'bulb',         color: '#FFC107' },
};

/** A single API access token */
export interface ApiKey {
  id: string;
  /** Display label (user-defined) */
  name: string;
  /** Masked key for display (e.g. "tol_...aB3x") */
  maskedKey: string;
  /** The full key — shown only once at creation */
  fullKey?: string;
  /** When the key was created */
  createdAt: string;
  /** When the key expires (null = never) */
  expiresAt: string | null;
  /** Whether the key is active */
  isActive: boolean;
  /** Last time this key was used */
  lastUsedAt: string | null;
  /** Allowed scopes */
  scopes: ApiKeyScope[];
  /** Optional IP restrict prefix for security */
  ipRestrict?: string;
}

// ============ Security & Audit Log ============

/** A single login event recorded in the audit log */
export interface LoginEvent {
  id: string;
  /** Timestamp of login */
  timestamp: string;
  /** Device name (e.g. "iPhone 15 Pro", "Pixel 8") */
  deviceName: string;
  /** Device OS (e.g. "iOS 18.2", "Android 14") */
  deviceOs: string;
  /** Browser or app identifier */
  browser: string;
  /** IP address */
  ipAddress: string;
  /** Approximate location from IP geo */
  location: string;
  /** Whether login was successful */
  success: boolean;
  /** Failure reason (if not successful) */
  failureReason?: string;
  /** Authentication method used */
  authMethod: 'email' | 'google' | 'apple' | 'biometric' | '2fa';
}

/** An active session on a device */
export interface ActiveSession {
  id: string;
  /** Device name */
  deviceName: string;
  /** Device OS */
  deviceOs: string;
  /** Browser or app */
  browser: string;
  /** IP address */
  ipAddress: string;
  /** Location */
  location: string;
  /** When the session was created */
  createdAt: string;
  /** When the session was last active */
  lastActiveAt: string;
  /** Whether this is the current device */
  isCurrentDevice: boolean;
}

export interface TwoFactorSetupData {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

/** Current 2FA status */
export interface TwoFactorStatus {
  enabled: boolean;
  verified: boolean;
  setupAt?: string;
}

/** Backup code with usage status */
export interface BackupCodeEntry {
  code: string;
  used: boolean;
}

/** Response from backup codes endpoint */
export interface BackupCodesResponse {
  codes: BackupCodeEntry[];
  unusedCount: number;
}

/** A single point on the futures curve — expiry, price, and key metrics */
export interface FuturesCurvePoint {
  /** Expiry label (e.g. "25 Jul 26", "29 Aug 26") */
  expiryLabel: string;
  /** ISO date string */
  expiryDate: string;
  /** Days until expiry */
  daysToExpiry: number;
  /** Futures contract price */
  price: number;
  /** Basis = futures price - spot price */
  basis: number;
  /** Basis as % of spot price */
  basisPercent: number;
  /** Open Interest */
  openInterest: number;
  /** Change in OI from previous day */
  oiChange: number;
  /** Volume traded */
  volume: number;
}

/** Full futures curve data for a single underlying symbol */
export interface FuturesCurveData {
  /** Underlying symbol (e.g. "NIFTY", "BANKNIFTY") */
  symbol: string;
  /** Current spot price of the underlying */
  spotPrice: number;
  /** Array of curve points, one per expiry, sorted by expiry */
  points: FuturesCurvePoint[];
  /** Whether the curve is in contango (upward sloping) */
  isContango: boolean;
  /** The slope of the curve (average basis change per month) */
  slope: number;
  /** Total open interest across all contracts */
  totalOpenInterest: number;
  /** Largest open interest expiry */
  maxOiExpiry: string;
}

/** Result of a completed quiz attempt */
export interface QuizResult {
  quizId: string;
  quizTitle: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  score: number;
  percentage: number;
  passed: boolean;
  timeTaken: number;
  answers: Record<string, number>;
  correctAnswerMap: Record<string, number>;
}

// ============ NFO (New Fund Offer) ============

/** NFO subscription status */
export type NFOSubscriptionStatus = 'upcoming' | 'open' | 'closed' | 'matured';

/** Risk level for mutual fund schemes */
export type NFORiskLevel = 'low' | 'moderate' | 'moderately_high' | 'high';

/** A New Fund Offer (NFO) — when an AMC launches a new mutual fund scheme */
export interface NFOItem {
  id: string;
  /** AMC name (e.g. "HDFC Mutual Fund", "Nippon India") */
  amcName: string;
  /** Logo short form */
  logo: string;
  /** Fund scheme name */
  schemeName: string;
  /** Fund category (e.g. "Flexi Cap", "Mid Cap", "Sectoral") */
  category: string;
  /** Sub-category */
  subCategory: string;
  /** NFO open date */
  openDate: string;
  /** NFO close date */
  closeDate: string;
  /** Date when the scheme will be listed/open for redemption */
  maturityDate: string;
  /** Minimum investment amount in \u20B9 */
  minInvestment: number;
  /** Maximum investment amount (0 = unlimited) */
  maxInvestment: number;
  /** Entry load percentage (usually 0 for open-ended) */
  entryLoad: number;
  /** Exit load percentage and period description */
  exitLoad: string;
  /** Expense ratio (estimated) */
  expenseRatio: number;
  /** Total fund size target in Cr */
  targetSize: number;
  /** Current collections so far in Cr */
  collectedAmount: number;
  /** Number of investors so far */
  totalInvestors: number;
  /** Subscription status */
  subscriptionStatus: NFOSubscriptionStatus;
  /** Risk level */
  riskLevel: NFORiskLevel;
  /** Benchmark index name */
  benchmark: string;
  /** Fund manager name(s) */
  fundManagers: string[];
  /** Asset allocation breakdown */
  assetAllocation: { label: string; percent: number; color: string }[];
  /** Top 5 sectors to invest in */
  topSectors: string[];
  /** Investment objective */
  objective: string;
  /** Investment strategy */
  strategy: string;
  /** AMC details */
  amcRating: number;
  amcAum: string;
  amcFundsCount: number;
  /** About the scheme */
  about: string;
  /** Key strengths */
  strengths: string[];
  /** Key risks */
  risks: string[];
  /** Is bookmarked */
  isBookmarked: boolean;
  /** Application counts */
  applications: number;
}

/** User's NFO application/investment */
export interface NFOApplication {
  id: string;
  nfoId: string;
  amcName: string;
  logo: string;
  schemeName: string;
  category: string;
  /** Amount invested */
  amount: number;
  /** NAV at allotment */
  navAtAllotment: number;
  /** Units allotted */
  unitsAllotted: number;
  /** Current estimated NAV */
  currentNav: number;
  /** Current estimated value */
  currentValue: number;
  /** Status of the application */
  status: 'submitted' | 'allotted' | 'in_progress' | 'matured';
  /** Application date */
  appliedAt: string;
  /** Allotment date */
  allotmentDate?: string;
  /** Total return percentage */
  returnPercent?: number;
}

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  StockDetail: { stockId: string; symbol: string };
  CourseDetail: { courseId: string };
  LessonView: { lessonId: string; courseId: string };
  ContractNoteParser: { brokerFormat?: string };
  AIInsight: { stockId?: string };
  CommunityPost: { postId: string };
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: { ref?: string } | undefined;
  ForgotPassword: undefined;
};
