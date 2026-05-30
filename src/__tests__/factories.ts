/**
 * ============================================================================
 * Toroloom — Test Data Factories
 * ============================================================================
 *
 * Reusable factory functions for creating mock data in tests. Each factory
 * provides sensible defaults and accepts a Partial<T> overrides argument to
 * customise specific fields.
 *
 * Usage:
 *   import { createStock, createUser, createHolding } from './factories';
 *
 *   const defaultStock = createStock();
 *   const customStock = createStock({ symbol: 'TCS', price: 3890 });
 *   const holdings = [createHolding(), createHolding({ symbol: 'TCS' })];
 *   usePortfolioStore.setState({ holdings });
 *
 * ID generation uses a monotonically increasing counter + Date.now() to
 * avoid collisions when creating multiple objects in the same millisecond.
 */

// ==================== Helpers ====================

let _idCounter = 0;

/** Generate a unique-ish ID for test entities. */
export function generateId(prefix: string = 't'): string {
  return `${prefix}_${Date.now().toString(36)}_${++_idCounter}`;
}

/** Generate an ISO timestamp string for a relative offset (days ago). */
export function generateTimestamp(daysAgo: number = 0): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString();
}

/** Generate a date string (YYYY-MM-DD) for a relative offset. */
export function generateDate(daysAgo: number = 0): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().split('T')[0];
}

/** Pick a random element from an array (useful for varied mock data). */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Create a sequential list of stock price history points. */
export function generateHistoryPoints(count: number = 30, basePrice: number = 2500) {
  let price = basePrice;
  return Array.from({ length: count }, (_, i) => {
    const change = (Math.random() - 0.48) * price * 0.03;
    const open = price;
    const close = Math.max(open + change, open * 0.85);
    const high = Math.max(open, close) * (1 + Math.random() * 0.015);
    const low = Math.min(open, close) * (1 - Math.random() * 0.015);
    price = close;
    return {
      date: generateDate(-i),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(Math.random() * 20000000) + 5000000,
    };
  });
}

// ==================== User & Auth Factories ====================

export interface FactoryUser {
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

export function createUser(overrides?: Partial<FactoryUser>): FactoryUser {
  return {
    id: generateId('u'),
    name: 'Test User',
    email: 'test.user@email.com',
    phone: '+91 98765 43210',
    panNumber: 'ABCDE1234F',
    kycStatus: 'verified' as const,
    balance: 2500000,
    createdAt: generateDate(30),
    ...overrides,
  };
}

export function createLoginCredentials(overrides?: Partial<{ email: string; password: string }>) {
  return {
    email: 'test@email.com',
    password: 'password123',
    ...overrides,
  };
}

export function createSignupData(overrides?: Partial<{ name: string; email: string; phone: string; password: string }>) {
  return {
    name: 'New User',
    email: 'new.user@email.com',
    phone: '+91 98765 43210',
    password: 'securePass1',
    ...overrides,
  };
}

// ==================== Market Data Factories ====================

export interface FactoryMarketIndex {
  id: string;
  name: string;
  shortName: string;
  currentValue: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  icon: string;
}

export function createMarketIndex(overrides?: Partial<FactoryMarketIndex>): FactoryMarketIndex {
  return {
    id: generateId('idx'),
    name: 'Nifty 50',
    shortName: 'NIFTY',
    currentValue: 23456.80,
    change: 345.20,
    changePercent: 1.49,
    isPositive: true,
    icon: 'trending-up',
    ...overrides,
  };
}

export interface FactoryStock {
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

export function createStock(overrides?: Partial<FactoryStock>): FactoryStock {
  return {
    id: generateId('s'),
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    sector: 'Energy',
    price: 2890.50,
    change: 45.20,
    changePercent: 1.59,
    isPositive: true,
    marketCap: '₹19,56,000 Cr',
    volume: '12.5M',
    high52: 3020.00,
    low52: 2200.00,
    pe: 28.5,
    pb: 3.2,
    dividend: 0.85,
    ...overrides,
  };
}

// ==================== Portfolio Factories ====================

export interface FactoryHolding {
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

export function createHolding(overrides?: Partial<FactoryHolding>): FactoryHolding {
  const qty = 50;
  const buyPrice = 2650;
  const currentPrice = 2890.50;
  return {
    id: generateId('h'),
    stockId: 'RELIANCE',
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    quantity: qty,
    buyPrice,
    currentPrice,
    totalInvested: qty * buyPrice,
    currentValue: qty * currentPrice,
    pnl: qty * (currentPrice - buyPrice),
    pnlPercent: ((currentPrice - buyPrice) / buyPrice) * 100,
    dayChange: 2260,
    dayChangePercent: 1.59,
    ...overrides,
  };
}

export interface FactoryTrade {
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

export function createTrade(overrides?: Partial<FactoryTrade>): FactoryTrade {
  return {
    id: generateId('t'),
    stockId: 'RELIANCE',
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    type: 'buy' as const,
    quantity: 50,
    price: 2650,
    total: 132500,
    timestamp: generateTimestamp(1),
    ...overrides,
  };
}

// ==================== Watchlist Factories ====================

export interface FactoryWatchlist {
  id: string;
  name: string;
  stocks: FactoryStock[];
  createdAt: string;
}

export function createWatchlist(overrides?: Partial<FactoryWatchlist>): FactoryWatchlist {
  return {
    id: generateId('w'),
    name: 'My Watchlist',
    stocks: [createStock()],
    createdAt: generateDate(10),
    ...overrides,
  };
}

// ==================== Mutual Fund Factories ====================

export interface FactoryMutualFund {
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

export function createMutualFund(overrides?: Partial<FactoryMutualFund>): FactoryMutualFund {
  return {
    id: generateId('mf'),
    name: 'Test Flexi Cap Fund',
    category: 'Flexi Cap',
    nav: 67.45,
    dayChange: 0.89,
    dayChangePercent: 1.34,
    oneYearReturn: 28.5,
    threeYearReturn: 72.3,
    fiveYearReturn: 125.6,
    riskLevel: 'high' as const,
    minInvestment: 1000,
    fundSize: '₹45,678 Cr',
    rating: 5,
    ...overrides,
  };
}

export interface FactorySIPPlan {
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

export function createSIPPlan(overrides?: Partial<FactorySIPPlan>): FactorySIPPlan {
  return {
    id: generateId('sip'),
    fundId: generateId('mf'),
    fundName: 'Test Flexi Cap Fund',
    amount: 5000,
    frequency: 'monthly' as const,
    nextDate: generateDate(-30),
    totalInvested: 60000,
    currentValue: 68450,
    returns: 8450,
    ...overrides,
  };
}

// ==================== Education Factories ====================

export interface FactoryCourse {
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

export function createCourse(overrides?: Partial<FactoryCourse>): FactoryCourse {
  return {
    id: generateId('c'),
    title: 'Test Course',
    description: 'A comprehensive test course.',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: '2 hours',
    lessons: 10,
    progress: 0,
    level: 'beginner' as const,
    category: 'Stocks',
    rating: 4.5,
    enrolledCount: 1234,
    ...overrides,
  };
}

export interface FactoryLesson {
  id: string;
  courseId: string;
  title: string;
  content: string;
  duration: string;
  completed: boolean;
  quiz?: FactoryQuiz;
}

export function createLesson(overrides?: Partial<FactoryLesson>): FactoryLesson {
  return {
    id: generateId('l'),
    courseId: generateId('c'),
    title: 'Test Lesson',
    content: 'Lesson content goes here.',
    duration: '15 min',
    completed: false,
    ...overrides,
  };
}

export interface FactoryQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export function createQuizQuestion(overrides?: Partial<FactoryQuizQuestion>): FactoryQuizQuestion {
  return {
    id: generateId('q'),
    question: 'What is the answer?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: 0,
    explanation: 'Option A is correct because...',
    ...overrides,
  };
}

export interface FactoryQuiz {
  id: string;
  title: string;
  questions: FactoryQuizQuestion[];
  score: number;
  passed: boolean;
}

export function createQuiz(overrides?: Partial<FactoryQuiz>): FactoryQuiz {
  return {
    id: generateId('qz'),
    title: 'Test Quiz',
    questions: [createQuizQuestion(), createQuizQuestion({ question: 'Second question?', correctAnswer: 2 })],
    score: 50,
    passed: true,
    ...overrides,
  };
}

// ==================== Community Factories ====================

export interface FactoryCommunityPost {
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

export function createCommunityPost(overrides?: Partial<FactoryCommunityPost>): FactoryCommunityPost {
  return {
    id: generateId('p'),
    userId: generateId('u'),
    userName: 'Test User',
    content: 'This is a test post content.',
    likes: 42,
    comments: 7,
    timestamp: generateTimestamp(1),
    tags: ['Test', 'Stocks'],
    ...overrides,
  };
}

export interface FactoryComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: string;
}

export function createComment(overrides?: Partial<FactoryComment>): FactoryComment {
  return {
    id: generateId('c'),
    postId: generateId('p'),
    userId: generateId('u'),
    userName: 'Commenter',
    content: 'Great post! Thanks for sharing.',
    timestamp: generateTimestamp(0),
    ...overrides,
  };
}

// ==================== AI Insights Factories ====================

export interface FactoryAIInsight {
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

export function createAIInsight(overrides?: Partial<FactoryAIInsight>): FactoryAIInsight {
  return {
    id: generateId('ai'),
    stockId: 'RELIANCE',
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    type: 'bullish' as const,
    confidence: 85,
    summary: 'Strong breakout above resistance with high volume',
    analysis: 'The stock shows strong momentum with bullish indicators.',
    targets: [
      { target: 2950, probability: 75 },
      { target: 3020, probability: 45 },
    ],
    timestamp: generateTimestamp(0),
    ...overrides,
  };
}

// ==================== Gamification Factories ====================

export interface FactoryBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export function createBadge(overrides?: Partial<FactoryBadge>): FactoryBadge {
  return {
    id: generateId('b'),
    name: 'Test Badge',
    description: 'A test badge.',
    icon: '🏆',
    requirement: 'Complete a test action',
    unlocked: true,
    unlockedAt: generateTimestamp(5),
    ...overrides,
  };
}

export interface FactoryUserLevel {
  level: number;
  title: string;
  xp: number;
  xpToNext: number;
  totalXp: number;
}

export function createUserLevel(overrides?: Partial<FactoryUserLevel>): FactoryUserLevel {
  return {
    level: 12,
    title: 'Trading Pro',
    xp: 4500,
    xpToNext: 5000,
    totalXp: 24500,
    ...overrides,
  };
}

// ==================== Notification Factories ====================

export interface FactoryAppNotification {
  id: string;
  type: 'price_alert' | 'trade' | 'news' | 'system' | 'educational';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  data?: any;
}

export function createAppNotification(overrides?: Partial<FactoryAppNotification>): FactoryAppNotification {
  return {
    id: generateId('n'),
    type: 'price_alert' as const,
    title: 'Price Alert',
    message: 'Stock price moved by 5%.',
    read: false,
    timestamp: generateTimestamp(0),
    ...overrides,
  };
}

export interface FactoryPriceAlertRule {
  id: string;
  symbol: string;
  stockName: string;
  targetPrice: number;
  direction: 'above' | 'below';
  triggered: boolean;
  createdAt: string;
}

export function createPriceAlertRule(overrides?: Partial<FactoryPriceAlertRule>): FactoryPriceAlertRule {
  return {
    id: generateId('par'),
    symbol: 'RELIANCE',
    stockName: 'Reliance Industries',
    targetPrice: 3000,
    direction: 'above' as const,
    triggered: false,
    createdAt: generateTimestamp(7),
    ...overrides,
  };
}

export interface FactoryNotificationPreferences {
  priceAlerts: boolean;
  tradeConfirmations: boolean;
  educationalReminders: boolean;
  systemUpdates: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  priceAlertThreshold: number;
}

export function createNotificationPreferences(
  overrides?: Partial<FactoryNotificationPreferences>,
): FactoryNotificationPreferences {
  return {
    priceAlerts: true,
    tradeConfirmations: true,
    educationalReminders: true,
    systemUpdates: true,
    soundEnabled: true,
    vibrationEnabled: true,
    quietHoursStart: null,
    quietHoursEnd: null,
    priceAlertThreshold: 2.0,
    ...overrides,
  };
}

// ==================== Fund / Transaction Factories ====================

export interface FactoryFundTransaction {
  id: string;
  type: 'add' | 'withdraw';
  amount: number;
  method: string;
  account?: string;
  status: 'completed' | 'pending' | 'failed';
  transactionId: string;
  timestamp: string;
  dateLabel: string;
}

export function createFundTransaction(overrides?: Partial<FactoryFundTransaction>): FactoryFundTransaction {
  return {
    id: generateId('ft'),
    type: 'add' as const,
    amount: 10000,
    method: 'UPI',
    status: 'completed' as const,
    transactionId: 'TXN' + generateId().toUpperCase(),
    timestamp: generateTimestamp(0),
    dateLabel: 'Today',
    ...overrides,
  };
}

// ==================== Risk Engine Factories ====================

export interface FactoryLockdownState {
  status: 'none' | 'active' | 'cooldown';
  triggeredAt: string | null;
  liftsAt: string | null;
  triggerLoss: number | null;
  breachedLimit: 'daily_loss' | 'daily_loss_percent' | null;
}

export function createLockdownState(overrides?: Partial<FactoryLockdownState>): FactoryLockdownState {
  return {
    status: 'none' as const,
    triggeredAt: null,
    liftsAt: null,
    triggerLoss: null,
    breachedLimit: null,
    ...overrides,
  };
}

export interface FactoryDailyMTM {
  date: string;
  realizedPnL: number;
  unrealizedPnL: number;
  peakValue: number;
  totalCharges: number;
  tradeCount: number;
}

export function createDailyMTM(overrides?: Partial<FactoryDailyMTM>): FactoryDailyMTM {
  return {
    date: generateDate(0),
    realizedPnL: 0,
    unrealizedPnL: 0,
    peakValue: 0,
    totalCharges: 0,
    tradeCount: 0,
    ...overrides,
  };
}

export interface FactoryRiskLimits {
  dailyLossLimit: number;
  dailyLossPercentLimit: number;
  maxPositionSizePercent: number;
  maxLeverage: number;
  allowIntraday: boolean;
  allowFNO: boolean;
}

export function createRiskLimits(overrides?: Partial<FactoryRiskLimits>): FactoryRiskLimits {
  return {
    dailyLossLimit: 50000,
    dailyLossPercentLimit: 5,
    maxPositionSizePercent: 20,
    maxLeverage: 2,
    allowIntraday: true,
    allowFNO: false,
    ...overrides,
  };
}

// ==================== Chart / History Factories ====================

export interface FactoryStockHistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function createStockHistoryPoint(overrides?: Partial<FactoryStockHistoryPoint>): FactoryStockHistoryPoint {
  return {
    date: generateDate(0),
    open: 2800,
    high: 2850,
    low: 2790,
    close: 2830,
    volume: 10000000,
    ...overrides,
  };
}

// ==================== Theme Factory ====================

export function createThemeColors(overrides?: Partial<Record<string, string>>) {
  return {
    bg: '#0D0D1A',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textMuted: '#666680',
    primary: '#6C63FF',
    accent: '#00D2FF',
    marketUp: '#00C853',
    marketDown: '#FF1744',
    bgCard: '#1A1A2E',
    bgCardLight: '#25253D',
    bgInput: '#1E1E32',
    border: '#2A2A44',
    divider: '#2A2A44',
    bgSecondary: '#16162A',
    warning: '#FFC107',
    danger: '#FF1744',
    success: '#00C853',
    ...overrides,
  };
}
