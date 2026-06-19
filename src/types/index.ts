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
  type: 'price_alert' | 'trade' | 'news' | 'system' | 'educational' | 'portfolio_alert';
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

// ============ Navigation Types ============
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  StockDetail: { stockId: string; symbol: string };
  CourseDetail: { courseId: string };
  LessonView: { lessonId: string; courseId: string };
  AIInsight: { stockId?: string };
  CommunityPost: { postId: string };
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: { ref?: string } | undefined;
  ForgotPassword: undefined;
};
