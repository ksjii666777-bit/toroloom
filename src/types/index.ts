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
  type: 'price_alert' | 'trade' | 'news' | 'system' | 'educational' | 'portfolio_alert' | 'sentiment_alert';
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

// ============ Navigation Types ============
// ============ 2FA / TOTP Types ============

/** Response from 2FA setup endpoint */
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
