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
  Signup: undefined;
  ForgotPassword: undefined;
};
