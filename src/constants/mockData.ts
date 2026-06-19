import {
  User, MarketIndex, Stock, Holding, Trade, OpenOrder, Watchlist,
  MutualFund, SIPPlan, Course, Lesson, CommunityPost,
  AIInsight, Badge, UserLevel, AppNotification, MarketNewsItem,
  ChatRoom, ChatMessage
} from '../types';

// ============ User ============
export const mockUser: User = {
  id: 'user_1',
  name: 'Rahul Sharma',
  email: 'rahul.sharma@email.com',
  phone: '+91 98765 43210',
  panNumber: 'ABCDE1234F',
  avatar: undefined,
  kycStatus: 'verified',
  balance: 2500000,
  createdAt: '2024-01-15',
};

// ============ Market Indices ============
export const mockIndices: MarketIndex[] = [
  {
    id: 'nifty50',
    name: 'Nifty 50',
    shortName: 'NIFTY',
    currentValue: 23456.80,
    change: 345.20,
    changePercent: 1.49,
    isPositive: true,
    icon: 'trending-up',
  },
  {
    id: 'sensex',
    name: 'BSE Sensex',
    shortName: 'SENSEX',
    currentValue: 77123.45,
    change: -123.45,
    changePercent: -0.16,
    isPositive: false,
    icon: 'trending-down',
  },
  {
    id: 'banknifty',
    name: 'Bank Nifty',
    shortName: 'BANKNIFTY',
    currentValue: 49234.10,
    change: 567.89,
    changePercent: 1.17,
    isPositive: true,
    icon: 'trending-up',
  },
  {
    id: 'midcap',
    name: 'Nifty Midcap 100',
    shortName: 'MIDCAP',
    currentValue: 15678.90,
    change: 234.56,
    changePercent: 1.52,
    isPositive: true,
    icon: 'trending-up',
  },
];

// ============ Stocks ============
export const mockStocks: Stock[] = [
  {
    id: 'RELIANCE',
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
  },
  {
    id: 'TCS',
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    sector: 'Technology',
    price: 3890.00,
    change: -34.50,
    changePercent: -0.88,
    isPositive: false,
    marketCap: '₹14,20,000 Cr',
    volume: '8.2M',
    high52: 4200.00,
    low52: 3300.00,
    pe: 35.2,
    pb: 12.5,
    dividend: 1.20,
  },
  {
    id: 'HDFCBANK',
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    sector: 'Finance',
    price: 1678.90,
    change: 23.45,
    changePercent: 1.42,
    isPositive: true,
    marketCap: '₹9,35,000 Cr',
    volume: '15.1M',
    high52: 1800.00,
    low52: 1360.00,
    pe: 18.9,
    pb: 2.8,
    dividend: 1.05,
  },
  {
    id: 'INFY',
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    sector: 'Technology',
    price: 1567.80,
    change: 28.90,
    changePercent: 1.88,
    isPositive: true,
    marketCap: '₹6,52,000 Cr',
    volume: '10.8M',
    high52: 1700.00,
    low52: 1350.00,
    pe: 28.1,
    pb: 7.9,
    dividend: 1.80,
  },
  {
    id: 'ICICIBANK',
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    sector: 'Finance',
    price: 1123.45,
    change: -12.30,
    changePercent: -1.08,
    isPositive: false,
    marketCap: '₹7,85,000 Cr',
    volume: '18.5M',
    high52: 1250.00,
    low52: 980.00,
    pe: 16.5,
    pb: 2.3,
    dividend: 0.95,
  },
  {
    id: 'HINDUNILVR',
    symbol: 'HINDUNILVR',
    name: 'Hindustan Unilever Ltd.',
    sector: 'Consumer',
    price: 2567.30,
    change: -15.60,
    changePercent: -0.60,
    isPositive: false,
    marketCap: '₹6,03,000 Cr',
    volume: '5.2M',
    high52: 2800.00,
    low52: 2300.00,
    pe: 55.3,
    pb: 10.8,
    dividend: 1.50,
  },
  {
    id: 'BHARTIARTL',
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd.',
    sector: 'Telecom',
    price: 1345.60,
    change: 34.50,
    changePercent: 2.63,
    isPositive: true,
    marketCap: '₹7,50,000 Cr',
    volume: '9.8M',
    high52: 1450.00,
    low52: 1050.00,
    pe: 42.1,
    pb: 5.6,
    dividend: 0.45,
  },
  {
    id: 'SBIN',
    symbol: 'SBIN',
    name: 'State Bank of India',
    sector: 'Finance',
    price: 789.50,
    change: 15.80,
    changePercent: 2.04,
    isPositive: true,
    marketCap: '₹7,04,000 Cr',
    volume: '22.3M',
    high52: 850.00,
    low52: 640.00,
    pe: 10.2,
    pb: 1.5,
    dividend: 2.15,
  },
  {
    id: 'TATAMOTORS',
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd.',
    sector: 'Automobile',
    price: 945.20,
    change: -8.90,
    changePercent: -0.93,
    isPositive: false,
    marketCap: '₹3,12,000 Cr',
    volume: '14.6M',
    high52: 1100.00,
    low52: 780.00,
    pe: 8.5,
    pb: 2.1,
    dividend: 0.35,
  },
  {
    id: 'BAJFINANCE',
    symbol: 'BAJFINANCE',
    name: 'Bajaj Finance Ltd.',
    sector: 'Finance',
    price: 6789.00,
    change: 123.40,
    changePercent: 1.85,
    isPositive: true,
    marketCap: '₹4,12,000 Cr',
    volume: '6.8M',
    high52: 7500.00,
    low52: 5800.00,
    pe: 32.4,
    pb: 5.2,
    dividend: 0.60,
  },
  {
    id: 'WIPRO',
    symbol: 'WIPRO',
    name: 'Wipro Ltd.',
    sector: 'Technology',
    price: 456.30,
    change: 8.70,
    changePercent: 1.94,
    isPositive: true,
    marketCap: '₹2,40,000 Cr',
    volume: '11.2M',
    high52: 520.00,
    low52: 380.00,
    pe: 24.3,
    pb: 4.1,
    dividend: 0.75,
  },
  {
    id: 'ITC',
    symbol: 'ITC',
    name: 'ITC Ltd.',
    sector: 'Consumer',
    price: 478.90,
    change: -5.60,
    changePercent: -1.16,
    isPositive: false,
    marketCap: '₹5,98,000 Cr',
    volume: '20.5M',
    high52: 510.00,
    low52: 400.00,
    pe: 26.8,
    pb: 6.3,
    dividend: 2.50,
  },
];

// ============ Portfolio Holdings ============
export const mockHoldings: Holding[] = [
  {
    id: 'h1',
    stockId: 'RELIANCE',
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    quantity: 50,
    buyPrice: 2650.00,
    currentPrice: 2890.50,
    totalInvested: 132500,
    currentValue: 144525,
    pnl: 12025,
    pnlPercent: 9.08,
    dayChange: 2260,
    dayChangePercent: 1.59,
  },
  {
    id: 'h2',
    stockId: 'HDFCBANK',
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    quantity: 100,
    buyPrice: 1550.00,
    currentPrice: 1678.90,
    totalInvested: 155000,
    currentValue: 167890,
    pnl: 12890,
    pnlPercent: 8.32,
    dayChange: 2345,
    dayChangePercent: 1.42,
  },
  {
    id: 'h3',
    stockId: 'TCS',
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    quantity: 20,
    buyPrice: 3800.00,
    currentPrice: 3890.00,
    totalInvested: 76000,
    currentValue: 77800,
    pnl: 1800,
    pnlPercent: 2.37,
    dayChange: -690,
    dayChangePercent: -0.88,
  },
  {
    id: 'h4',
    stockId: 'INFY',
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    quantity: 80,
    buyPrice: 1450.00,
    currentPrice: 1567.80,
    totalInvested: 116000,
    currentValue: 125424,
    pnl: 9424,
    pnlPercent: 8.12,
    dayChange: 2312,
    dayChangePercent: 1.88,
  },
  {
    id: 'h5',
    stockId: 'SBIN',
    symbol: 'SBIN',
    name: 'State Bank of India',
    quantity: 200,
    buyPrice: 720.00,
    currentPrice: 789.50,
    totalInvested: 144000,
    currentValue: 157900,
    pnl: 13900,
    pnlPercent: 9.65,
    dayChange: 3160,
    dayChangePercent: 2.04,
  },
];

// ============ Recent Trades ============
export const mockTrades: Trade[] = [
  { id: 't1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', type: 'buy', quantity: 50, price: 2650.00, total: 132500, timestamp: '2025-05-20T09:30:00' },
  { id: 't2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', type: 'sell', quantity: 10, price: 3920.00, total: 39200, timestamp: '2025-05-19T14:45:00' },
  { id: 't3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'buy', quantity: 100, price: 1550.00, total: 155000, timestamp: '2025-05-18T11:20:00' },
  { id: 't4', stockId: 'INFY', symbol: 'INFY', name: 'Infosys', type: 'buy', quantity: 80, price: 1450.00, total: 116000, timestamp: '2025-05-17T10:15:00' },
  { id: 't5', stockId: 'SBIN', symbol: 'SBIN', name: 'State Bank of India', type: 'buy', quantity: 200, price: 720.00, total: 144000, timestamp: '2025-05-16T09:45:00' },
];

// ============ Watchlists ============
export const mockWatchlists: Watchlist[] = [
  {
    id: 'w1',
    name: 'My Watchlist',
    stocks: [mockStocks[0], mockStocks[3], mockStocks[7], mockStocks[9]],
    createdAt: '2025-01-10',
  },
  {
    id: 'w2',
    name: 'Tech Stocks',
    stocks: [mockStocks[1], mockStocks[3], mockStocks[10]],
    createdAt: '2025-02-15',
  },
];

// ============ Mutual Funds ============
export const mockMutualFunds: MutualFund[] = [
  { id: 'mf1', name: 'Parag Parikh Flexi Cap Fund', category: 'Flexi Cap', nav: 67.45, dayChange: 0.89, dayChangePercent: 1.34, oneYearReturn: 28.5, threeYearReturn: 72.3, fiveYearReturn: 125.6, riskLevel: 'high', minInvestment: 1000, fundSize: '₹45,678 Cr', rating: 5 },
  { id: 'mf2', name: 'HDFC Mid-Cap Opportunities Fund', category: 'Mid Cap', nav: 156.30, dayChange: 1.23, dayChangePercent: 0.79, oneYearReturn: 35.2, threeYearReturn: 85.6, fiveYearReturn: 145.8, riskLevel: 'high', minInvestment: 500, fundSize: '₹32,456 Cr', rating: 4 },
  { id: 'mf3', name: 'SBI Bluechip Fund', category: 'Large Cap', nav: 89.20, dayChange: -0.45, dayChangePercent: -0.50, oneYearReturn: 22.1, threeYearReturn: 58.4, fiveYearReturn: 98.2, riskLevel: 'moderate', minInvestment: 500, fundSize: '₹28,912 Cr', rating: 4 },
  { id: 'mf4', name: 'Axis Small Cap Fund', category: 'Small Cap', nav: 112.80, dayChange: 2.15, dayChangePercent: 1.94, oneYearReturn: 42.3, threeYearReturn: 95.7, fiveYearReturn: 168.4, riskLevel: 'high', minInvestment: 500, fundSize: '₹18,567 Cr', rating: 5 },
  { id: 'mf5', name: 'ICICI Prudential Value Discovery Fund', category: 'Value', nav: 178.60, dayChange: 1.56, dayChangePercent: 0.88, oneYearReturn: 25.8, threeYearReturn: 62.1, fiveYearReturn: 110.5, riskLevel: 'moderate', minInvestment: 1000, fundSize: '₹22,345 Cr', rating: 4 },
  { id: 'mf6', name: 'Kotak Corporate Bond Fund', category: 'Debt', nav: 45.90, dayChange: 0.12, dayChangePercent: 0.26, oneYearReturn: 8.2, threeYearReturn: 22.5, fiveYearReturn: 38.7, riskLevel: 'low', minInvestment: 1000, fundSize: '₹15,234 Cr', rating: 3 },
];

export const mockSIPs: SIPPlan[] = [
  { id: 'sip1', fundId: 'mf1', fundName: 'Parag Parikh Flexi Cap Fund', amount: 5000, frequency: 'monthly', nextDate: '2025-06-01', totalInvested: 60000, currentValue: 68450, returns: 8450 },
  { id: 'sip2', fundId: 'mf3', fundName: 'SBI Bluechip Fund', amount: 3000, frequency: 'monthly', nextDate: '2025-06-05', totalInvested: 36000, currentValue: 39120, returns: 3120 },
];

// ============ Education ============
import { realCourses, realLessons } from './courseContent';

// Re-export the real course content
export const mockCourses: Course[] = realCourses;
export const mockLessons: Lesson[] = realLessons;

// ============ Community ============
export const mockPosts: CommunityPost[] = [
  { id: 'p1', userId: 'u2', userName: 'Priya Patel', content: 'Just made my first 1 lakh profit on RELIANCE calls! 🚀 The technical setup was perfect with the breakout above 2850.', likes: 245, comments: 38, timestamp: '2025-05-24T10:30:00', tags: ['RELIANCE', 'Options', 'Profit'] },
  { id: 'p2', userId: 'u3', userName: 'Arun Kumar', content: 'Anyone else looking at ITC? The valuation looks attractive at current levels. 4% dividend yield is a bonus! 📊', likes: 89, comments: 24, timestamp: '2025-05-24T09:15:00', tags: ['ITC', 'ValueInvesting', 'Dividend'] },
  { id: 'p3', userId: 'u4', userName: 'Neha Singh', content: 'Started my first SIP today! ₹5000/month in Parag Parikh Flexi Cap Fund. Better late than never! 💪 #StartSmall', likes: 178, comments: 42, timestamp: '2025-05-23T18:45:00', tags: ['SIP', 'MutualFunds', 'Beginner'] },
  { id: 'p4', userId: 'u5', userName: 'Vikram Reddy', content: 'Market outlook this week: Nifty facing resistance at 23500. If it breaks, we could see 23800. Support at 23100. Trade carefully! 🎯', likes: 312, comments: 56, timestamp: '2025-05-23T08:00:00', tags: ['Nifty', 'MarketOutlook', 'Analysis'] },
  { id: 'p5', userId: 'u6', userName: 'Sneha Kapoor', content: 'Just completed the Technical Analysis course on this app! Amazing content. Highly recommend it for beginners who want to learn chart patterns. 📚', likes: 134, comments: 19, timestamp: '2025-05-22T20:30:00', tags: ['Learning', 'TechnicalAnalysis', 'Review'] },
];

// ============ AI Insights ============
export const mockAIInsights: AIInsight[] = [
  {
    id: 'ai1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', type: 'bullish', confidence: 85,
    summary: 'Strong breakout above resistance with high volume',
    analysis: 'RELIANCE has broken above the key resistance level of ₹2,850 with significantly higher volumes than the 20-day average. The RSI is at 62, indicating room for further upside. The stock is trading above all major moving averages (50, 100, 200 DMA). Strong support from institutional buying observed.',
    targets: [{ target: 2950, probability: 75 }, { target: 3020, probability: 45 }, { target: 3100, probability: 25 }],
    timestamp: '2025-05-24T08:00:00',
  },
  {
    id: 'ai2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', type: 'bearish', confidence: 72,
    summary: 'Forming lower highs; weak momentum',
    analysis: 'TCS is showing signs of weakness with a series of lower highs on the daily chart. The MACD has given a sell signal. The IT sector is facing headwinds from a strong rupee and potential US spending cuts. Key support at ₹3,800 needs to hold.',
    targets: [{ target: 3800, probability: 60 }, { target: 3650, probability: 35 }, { target: 3500, probability: 15 }],
    timestamp: '2025-05-24T08:00:00',
  },
  {
    id: 'ai3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'neutral', confidence: 65,
    summary: 'Consolidating in a range; wait for breakout',
    analysis: 'HDFC Bank is consolidating between ₹1,650 and ₹1,720. The stock needs to break above ₹1,720 for a bullish move or below ₹1,650 for a bearish move. The merger synergies are playing out well, but NIM compression is a near-term concern.',
    targets: [{ target: 1720, probability: 55 }, { target: 1800, probability: 35 }, { target: 1600, probability: 20 }],
    timestamp: '2025-05-24T08:00:00',
  },
  {
    id: 'ai4', stockId: 'SBIN', symbol: 'SBIN', name: 'State Bank of India', type: 'bullish', confidence: 88,
    summary: 'Strong uptrend with high institutional interest',
    analysis: 'SBI is in a strong uptrend, up 9.65% from your buy price. The PSU banking sector is seeing strong momentum. The stock has support at ₹760 and next resistance at ₹820. Strong quarterly results with improving asset quality are driving the rally.',
    targets: [{ target: 820, probability: 80 }, { target: 850, probability: 55 }, { target: 900, probability: 30 }],
    timestamp: '2025-05-24T08:00:00',
  },
];

// ============ Gamification ============
export const mockBadges: Badge[] = [
  { id: 'b1', name: 'First Trade', description: 'Placed your first trade', icon: '🎯', requirement: 'Place your first trade', unlocked: true, unlockedAt: '2025-02-01' },
  { id: 'b2', name: 'Market Explorer', description: 'Explored all sections of the app', icon: '🧭', requirement: 'Visit all app sections', unlocked: true, unlockedAt: '2025-02-05' },
  { id: 'b3', name: 'Profit Hunter', description: 'Made your first profit on a trade', icon: '💰', requirement: 'Book profit on any trade', unlocked: true, unlockedAt: '2025-03-15' },
  { id: 'b4', name: 'Steady Investor', description: 'Maintained a portfolio for 30 days', icon: '🛡️', requirement: 'Hold portfolio for 30 days', unlocked: true, unlockedAt: '2025-03-20' },
  { id: 'b5', name: 'Learner', description: 'Completed 5 lessons', icon: '📚', requirement: 'Complete 5 lessons', unlocked: true, unlockedAt: '2025-04-10' },
  { id: 'b6', name: 'SIP Champion', description: 'Started your first SIP', icon: '🏆', requirement: 'Start a SIP investment', unlocked: true, unlockedAt: '2025-04-15' },
  { id: 'b7', name: 'Diamond Hands', description: 'Held a stock through a market crash', icon: '💎', requirement: 'Hold during 5% market drop', unlocked: false },
  { id: 'b8', name: 'Community Star', description: 'Got 100 likes on your posts', icon: '⭐', requirement: 'Reach 100 total likes', unlocked: false },
  { id: 'b9', name: 'Options Master', description: 'Successfully traded options', icon: '🎓', requirement: 'Place 10 options trades', unlocked: false },
  { id: 'b10', name: 'Wealth Builder', description: 'Reach ₹10L portfolio value', icon: '🏦', requirement: 'Portfolio value exceeds ₹10L', unlocked: false },
  { id: 'b11', name: 'Analyst', description: 'Used AI insights for 5 trades', icon: '🔮', requirement: 'Follow 5 AI recommendations', unlocked: false },
  { id: 'b12', name: 'Quiz Whiz', description: 'Score 100% on any quiz', icon: '🧠', requirement: 'Get full marks in a quiz', unlocked: false },
];

export const mockUserLevel: UserLevel = {
  level: 12,
  title: 'Trading Pro',
  xp: 4500,
  xpToNext: 5000,
  totalXp: 24500,
};

// ============ Notifications ============
export const mockNotifications: AppNotification[] = [
  { id: 'n1', type: 'price_alert', title: 'Price Alert: RELIANCE', message: 'RELIANCE crossed ₹2,890. Target 1 achieved! 🎯', read: false, timestamp: '2025-05-24T10:00:00' },
  { id: 'n2', type: 'trade', title: 'Trade Executed', message: 'Buy order for 50 RELIANCE @ ₹2,890 executed successfully.', read: false, timestamp: '2025-05-24T09:35:00' },
  { id: 'n3', type: 'educational', title: 'New Lesson Available', message: 'Next lesson "Advanced Chart Patterns" is ready for you!', read: true, timestamp: '2025-05-23T12:00:00' },
  { id: 'n4', type: 'news', title: 'Market News: RBI Policy', message: 'RBI keeps repo rate unchanged at 6.50%. Markets react positively.', read: true, timestamp: '2025-05-23T10:00:00' },
  { id: 'n5', type: 'system', title: 'KYC Update', message: 'Your KYC documents have been verified successfully! ✅', read: true, timestamp: '2025-05-20T14:00:00' },
];

// ============ Open Orders (Mock) ============
export const mockOpenOrders: OpenOrder[] = [
  {
    id: 'open_ord_1',
    symbol: 'RELIANCE',
    exchange: 'NSE',
    transactionType: 'BUY',
    quantity: 25,
    filledQuantity: 0,
    price: 2850.00,
    productType: 'CNC',
    orderType: 'LIMIT',
    status: 'open',
    placedBy: 'WEB',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    validity: 'DAY',
  },
  {
    id: 'open_ord_2',
    symbol: 'TCS',
    exchange: 'NSE',
    transactionType: 'SELL',
    quantity: 10,
    filledQuantity: 5,
    price: 3950.00,
    productType: 'CNC',
    orderType: 'LIMIT',
    status: 'partially_filled',
    placedBy: 'WEB',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    validity: 'DAY',
  },
  {
    id: 'open_ord_3',
    symbol: 'INFY',
    exchange: 'NSE',
    transactionType: 'BUY',
    quantity: 50,
    filledQuantity: 0,
    price: 1550.00,
    triggerPrice: 1540.00,
    productType: 'MIS',
    orderType: 'SL',
    status: 'trigger_pending',
    placedBy: 'WEB',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    validity: 'DAY',
  },
  {
    id: 'open_ord_4',
    symbol: 'HDFCBANK',
    exchange: 'NSE',
    transactionType: 'BUY',
    quantity: 30,
    filledQuantity: 0,
    price: 1660.00,
    productType: 'CNC',
    orderType: 'LIMIT',
    status: 'pending',
    placedBy: 'WEB',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    validity: 'DAY',
  },
];

// ============ Market News ============
export const mockNews: MarketNewsItem[] = [
  {
    id: 'news_1',
    title: 'RBI Keeps Repo Rate Unchanged at 6.50% — Markets Rally',
    summary: 'The Reserve Bank of India maintained status quo on key policy rates for the seventh consecutive meeting, highlighting easing inflation but caution on food prices.',
    content: 'The Monetary Policy Committee (MPC) voted 4-2 to keep the repo rate unchanged at 6.50%, in line with market expectations. RBI Governor Shaktikanta Das highlighted that while inflation has moderated, upside risks from food prices remain. The GDP growth forecast for FY26 was maintained at 7.2%. Banking and auto stocks led the rally post-announcement, with Nifty closing 1.5% higher. The RBI also announced measures to boost liquidity in the banking system.',
    source: 'Economic Times',
    category: 'policy',
    sentiment: 'positive',
    publishedAt: '2025-05-28T10:30:00',
    read: false,
    bookmarked: false,
  },
  {
    id: 'news_2',
    title: 'Reliance Industries Q4 Net Profit Rises 12% to ₹21,345 Cr',
    summary: 'Reliance Industries reported a 12% YoY increase in consolidated net profit, driven by strong performance in retail and telecom segments.',
    content: 'Reliance Industries Ltd (RIL) reported a consolidated net profit of ₹21,345 crore for the March quarter, beating analyst estimates. Revenue from operations rose 8% to ₹2.41 lakh crore. The retail segment posted 18% revenue growth, while Jio added 11 million new subscribers. The O2C segment faced margin pressure due to weaker refining margins. RIL announced a dividend of ₹10 per share. Shares of RIL reacted positively, gaining 3% in early trade.',
    source: 'Moneycontrol',
    category: 'corporate',
    symbol: 'RELIANCE',
    sentiment: 'positive',
    publishedAt: '2025-05-27T08:15:00',
    read: false,
    bookmarked: true,
  },
  {
    id: 'news_3',
    title: 'SEBI Proposes Stricter F&O Entry Barriers for Retail Investors',
    summary: 'Market regulator SEBI has proposed higher contract sizes and increased margin requirements for futures and options trading to curb speculative activity.',
    content: 'The Securities and Exchange Board of India (SEBI) released a consultation paper proposing stricter norms for retail participation in the derivatives segment. Key proposals include: increasing the minimum contract size from ₹5 lakh to ₹15 lakh, raising extreme loss margin (ELM) requirements, and introducing additional position limits for index derivatives. Market participants expressed mixed reactions, with some calling it a necessary step to protect retail investors while others warned of reduced liquidity. The F&O segment has seen explosive growth, with notional turnover exceeding ₹500 lakh crore in FY25.',
    source: 'Business Standard',
    category: 'markets',
    sentiment: 'negative',
    publishedAt: '2025-05-26T14:00:00',
    read: true,
    bookmarked: false,
  },
  {
    id: 'news_4',
    title: 'HDFC Bank, ICICI Bank Lead Banking Rally as Nifty Bank Hits Fresh High',
    summary: 'The Nifty Bank index surged to a new all-time high, led by strong gains in HDFC Bank and ICICI Bank after robust Q4 earnings.',
    content: "The banking index rallied 3.5% to hit a fresh record high of 49,567, surpassing its previous peak set in January 2025. HDFC Bank gained 4.2% after reporting its highest-ever quarterly net profit, while ICICI Bank rose 3.8% following strong NII growth. The rally was broad-based with all PSU banks also contributing. Analysts attribute the strength to improving asset quality, healthy credit growth, and stable margins. The RBI's status quo on rates provided additional tailwinds for the sector.",
    source: 'CNBC TV18',
    category: 'markets',
    symbol: 'HDFCBANK',
    sentiment: 'positive',
    publishedAt: '2025-05-26T11:30:00',
    read: true,
    bookmarked: false,
  },
  {
    id: 'news_5',
    title: 'Crude Oil Prices Dip Below $80 on OPEC+ Supply Increase Signals',
    summary: 'Global crude oil prices fell below $80 per barrel after reports that OPEC+ may begin unwinding production cuts from October.',
    content: "Brent crude futures dropped 3.2% to $78.50 per barrel following reports that OPEC+ is considering gradually increasing supply from October 2025. The cartel had been maintaining production cuts of 2.2 million barrels per day. Saudi Arabia's energy minister signalled willingness to bring back supply if market conditions remain stable. The decline in oil prices is positive for oil-importing countries like India, potentially easing inflationary pressures and reducing the import bill.",
    source: 'Reuters',
    category: 'global',
    sentiment: 'neutral',
    publishedAt: '2025-05-25T22:00:00',
    read: true,
    bookmarked: false,
  },
  {
    id: 'news_6',
    title: 'Tata Motors, M&M Lead Auto Sector Surge on Strong April Sales Data',
    summary: 'Automobile stocks rallied after companies reported robust April sales numbers, with passenger vehicles segment posting double-digit growth.',
    content: 'Shares of Tata Motors gained 5.5% while M&M rose 4.8% after both companies reported strong domestic sales figures for April 2025. Tata Motors reported total sales of 89,000 units, up 15% YoY, driven by strong demand for its SUV portfolio. M&M sold 72,000 SUVs, recording 18% growth. Maruti Suzuki also reported a 9% increase in total sales. The auto sector continues to benefit from strong rural demand, new model launches, and stable commodity prices.',
    source: 'Financial Express',
    category: 'corporate',
    symbol: 'TATAMOTORS',
    sentiment: 'positive',
    publishedAt: '2025-05-25T09:45:00',
    read: false,
    bookmarked: false,
  },
  {
    id: 'news_7',
    title: 'IT Stocks Under Pressure as US Client Spending Concerns Mount',
    summary: 'Indian IT stocks faced selling pressure amid concerns over reduced technology spending by US clients due to economic uncertainty.',
    content: 'The Nifty IT index declined 2.8% as major IT stocks came under selling pressure. TCS fell 2.5%, Infosys dropped 3.1%, and Wipro declined 2.8%. Analysts cited concerns over reduced discretionary spending by US clients, potential visa policy changes, and margin pressure from wage hikes. However, most brokerages maintain a positive long-term view on the sector, citing strong deal pipelines and the potential benefit from a weaker rupee. The US accounts for 60-65% of revenue for major Indian IT firms.',
    source: 'Bloomberg Quint',
    category: 'markets',
    symbol: 'TCS',
    sentiment: 'negative',
    publishedAt: '2025-05-24T15:30:00',
    read: false,
    bookmarked: false,
  },
  {
    id: 'news_8',
    title: 'IPO Corner: LG Electronics India Files DRHP for ₹15,000 Cr Issue',
    summary: 'LG Electronics India has filed its draft red herring prospectus with SEBI for an initial public offering worth approximately ₹15,000 crore.',
    content: 'LG Electronics India, the Indian subsidiary of the South Korean conglomerate, has filed its DRHP for an IPO comprising an offer for sale of up to 15 crore shares by the parent company. The issue is expected to raise around ₹15,000 crore, making it one of the largest IPOs in India in 2025. The company plans to use the proceeds for brand building and expansion. LG India is the market leader in consumer durables with a 25% market share in the AC segment and 22% in refrigerators. The IPO is expected to open in Q3 FY26.',
    source: 'Livemint',
    category: 'ipo',
    sentiment: 'positive',
    publishedAt: '2025-05-24T07:00:00',
    read: false,
    bookmarked: false,
  },
  {
    id: 'news_9',
    title: "India's GDP Growth Set to Remain Strong at 7.2%: IMF",
    summary: "The International Monetary Fund has retained India's GDP growth forecast at 7.2% for FY26, making India the fastest-growing major economy.",
    content: "The IMF's latest World Economic Outlook update projects India's GDP growth at 7.2% for FY26 and 7.0% for FY27. The global body highlighted India's robust domestic demand, structural reforms, and digital infrastructure as key growth drivers. However, it cautioned about risks from global trade fragmentation, geopolitical tensions, and climate-related disruptions. India's growth remains well above the global average of 3.2% and China's projected 4.6% growth, cementing its position as the fastest-growing major economy.",
    source: 'The Hindu Business Line',
    category: 'economy',
    sentiment: 'positive',
    publishedAt: '2025-05-23T12:00:00',
    read: true,
    bookmarked: false,
  },
  {
    id: 'news_10',
    title: 'Zomato, Paytm, Nykaa: New-Age Tech Stocks See Profit Booking After Rally',
    summary: 'New-age technology stocks witnessed profit booking after a sharp rally, with Zomato, Paytm, and Nykaa declining 3-5% each.',
    content: 'After a spectacular run-up over the past three months, new-age technology stocks saw significant profit booking. Zomato fell 5.2%, Paytm declined 4.5%, and Nykaa dropped 3.8%. The Nifty New Age Tech index corrected 3.5%. Analysts attribute the sell-off to valuation concerns and profit-taking ahead of the quarterly expiry. Despite the correction, most of these stocks are still trading 20-40% higher than their 52-week lows. Market experts advise investors to focus on fundamentals and not get carried away by the recent rally.',
    source: 'ET Markets',
    category: 'markets',
    sentiment: 'negative',
    publishedAt: '2025-05-23T09:30:00',
    read: false,
    bookmarked: false,
  },
];

// ============ Chart History (Mock) ============

// ============ Chat Rooms & Messages ============
const now = Date.now();
const h = (hours: number) => hours * 60 * 60 * 1000;

export const mockChatRooms: ChatRoom[] = [
  {
    id: 'room_1',
    name: 'Trading Legends',
    type: 'group',
    topic: 'Technical Analysis & Strategies',
    lastMessage: 'Nifty support at 23400, watch for bounce',
    lastMessageTime: new Date(now - h(0.5)).toISOString(),
    lastMessageSender: 'Arun Kumar',
    unreadCount: 3,
    participants: [
      { userId: 'user_2', userName: 'Arun Kumar', isOnline: true },
      { userId: 'user_3', userName: 'Priya Patel', isOnline: true },
      { userId: 'user_4', userName: 'Neha Singh', isOnline: false },
      { userId: 'user_5', userName: 'Vikram Reddy', isOnline: true },
    ],
  },
  {
    id: 'room_2',
    name: 'RELIANCE Discussion',
    type: 'group',
    topic: 'Reliance stock analysis and news',
    stockSymbol: 'RELIANCE',
    lastMessage: 'Q4 results next week, expectations?',
    lastMessageTime: new Date(now - h(2)).toISOString(),
    lastMessageSender: 'Rahul Sharma',
    unreadCount: 0,
    participants: [
      { userId: 'user_6', userName: 'Sneha Kapoor', isOnline: false },
      { userId: 'user_2', userName: 'Arun Kumar', isOnline: true },
    ],
  },
  {
    id: 'room_3',
    name: 'Options Strategies',
    type: 'group',
    topic: 'F&O trading strategies and risk management',
    lastMessage: 'Iron condor on Nifty works best in range-bound markets',
    lastMessageTime: new Date(now - h(5)).toISOString(),
    lastMessageSender: 'Vikram Reddy',
    unreadCount: 1,
    participants: [
      { userId: 'user_3', userName: 'Priya Patel', isOnline: true },
      { userId: 'user_4', userName: 'Neha Singh', isOnline: false },
      { userId: 'user_5', userName: 'Vikram Reddy', isOnline: true },
      { userId: 'user_6', userName: 'Sneha Kapoor', isOnline: true },
    ],
  },
  {
    id: 'room_4',
    name: 'Priya Patel',
    type: 'direct',
    lastMessage: 'Chart pattern is looking bullish for HDFC',
    lastMessageTime: new Date(now - h(8)).toISOString(),
    lastMessageSender: 'Priya Patel',
    unreadCount: 2,
    participants: [
      { userId: 'user_3', userName: 'Priya Patel', isOnline: true },
    ],
  },
  {
    id: 'room_5',
    name: 'Mutual Fund Investors',
    type: 'group',
    topic: 'MF portfolio discussion and reviews',
    lastMessage: 'Parag Parikh Flexi Cap is still the best',
    lastMessageTime: new Date(now - h(24)).toISOString(),
    lastMessageSender: 'Neha Singh',
    unreadCount: 0,
    participants: [
      { userId: 'user_2', userName: 'Arun Kumar', isOnline: true },
      { userId: 'user_4', userName: 'Neha Singh', isOnline: false },
      { userId: 'user_6', userName: 'Sneha Kapoor', isOnline: true },
    ],
  },
  {
    id: 'room_6',
    name: 'Vikram Reddy',
    type: 'direct',
    lastMessage: 'Thanks for the tip on SBIN!',
    lastMessageTime: new Date(now - h(48)).toISOString(),
    lastMessageSender: 'Vikram Reddy',
    unreadCount: 0,
    participants: [
      { userId: 'user_5', userName: 'Vikram Reddy', isOnline: true },
    ],
  },
];

export const mockChatMessages: Record<string, ChatMessage[]> = {
  room_1: [
    {
      id: 'msg_1_1',
      roomId: 'room_1',
      userId: 'user_2',
      userName: 'Arun Kumar',
      content: 'Good morning everyone! Nifty futures gap up opening expected today.',
      timestamp: new Date(now - h(3)).toISOString(),
      type: 'text',
      read: true,
    },
    {
      id: 'msg_1_2',
      roomId: 'room_1',
      userId: 'user_3',
      userName: 'Priya Patel',
      content: 'Yes, tracking 23500 as immediate resistance on the upside.',
      timestamp: new Date(now - h(2.5)).toISOString(),
      type: 'text',
      read: true,
    },
    {
      id: 'msg_1_3',
      roomId: 'room_1',
      userId: 'user_5',
      userName: 'Vikram Reddy',
      content: 'Bank Nifty also looking strong. HDFC Bank results were solid.',
      timestamp: new Date(now - h(2)).toISOString(),
      type: 'text',
      read: true,
    },
    {
      id: 'msg_1_4',
      roomId: 'room_1',
      userId: 'user_1',
      userName: 'Rahul Sharma',
      content: 'I am holding RELIANCE calls, targeting 2950 this week.',
      timestamp: new Date(now - h(1.5)).toISOString(),
      type: 'trade',
      read: true,
    },
    {
      id: 'msg_1_5',
      roomId: 'room_1',
      userId: 'user_2',
      userName: 'Arun Kumar',
      content: 'Nifty support at 23400, watch for bounce before going long.',
      timestamp: new Date(now - h(0.5)).toISOString(),
      type: 'text',
      read: false,
    },
  ],
  room_2: [
    {
      id: 'msg_2_1',
      roomId: 'room_2',
      userId: 'user_6',
      userName: 'Sneha Kapoor',
      content: 'Anyone following Reliance news? Retail expansion plans look promising.',
      timestamp: new Date(now - h(5)).toISOString(),
      type: 'text',
      read: true,
    },
    {
      id: 'msg_2_2',
      roomId: 'room_2',
      userId: 'user_2',
      userName: 'Arun Kumar',
      content: 'Yes, Jio Q4 subscriber additions were strong too. Bullish overall.',
      timestamp: new Date(now - h(4)).toISOString(),
      type: 'text',
      read: true,
    },
    {
      id: 'msg_2_3',
      roomId: 'room_2',
      userId: 'user_1',
      userName: 'Rahul Sharma',
      content: 'Q4 results next week, expectations?',
      timestamp: new Date(now - h(2)).toISOString(),
      type: 'text',
      read: true,
    },
  ],
  room_3: [
    {
      id: 'msg_3_1',
      roomId: 'room_3',
      userId: 'user_5',
      userName: 'Vikram Reddy',
      content: 'Iron condor on Nifty works best in range-bound markets. Setting up one for this week expiry.',
      timestamp: new Date(now - h(5)).toISOString(),
      type: 'text',
      read: false,
    },
  ],
  room_4: [
    {
      id: 'msg_4_1',
      roomId: 'room_4',
      userId: 'user_3',
      userName: 'Priya Patel',
      content: 'Hey! Checked that HDFC chart you recommended.',
      timestamp: new Date(now - h(10)).toISOString(),
      type: 'text',
      read: true,
    },
    {
      id: 'msg_4_2',
      roomId: 'room_4',
      userId: 'user_1',
      userName: 'Rahul Sharma',
      content: 'What did you think? The breakout above 1680 looked clean.',
      timestamp: new Date(now - h(9)).toISOString(),
      type: 'text',
      read: true,
    },
    {
      id: 'msg_4_3',
      roomId: 'room_4',
      userId: 'user_3',
      userName: 'Priya Patel',
      content: 'Chart pattern is looking bullish for HDFC. Entering at current levels.',
      timestamp: new Date(now - h(8)).toISOString(),
      type: 'text',
      read: false,
    },
  ],
  room_5: [
    {
      id: 'msg_5_1',
      roomId: 'room_5',
      userId: 'user_4',
      userName: 'Neha Singh',
      content: 'My SIP portfolio is up 18% this year. Parag Parikh Flexi Cap is still the best.',
      timestamp: new Date(now - h(24)).toISOString(),
      type: 'text',
      read: true,
    },
  ],
  room_6: [
    {
      id: 'msg_6_1',
      roomId: 'room_6',
      userId: 'user_5',
      userName: 'Vikram Reddy',
      content: 'Thanks for the tip on SBIN! Made a nice profit on that trade.',
      timestamp: new Date(now - h(48)).toISOString(),
      type: 'text',
      read: true,
    },
  ],
};
export const generateChartData = (days: number = 365, basePrice: number = 2500) => {
  const data: { date: string; price: number }[] = [];
  let currentPrice = basePrice;
  const today = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    const change = (Math.random() - 0.48) * currentPrice * 0.03;
    currentPrice = Math.max(currentPrice + change, basePrice * 0.7);
    data.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(currentPrice * 100) / 100,
    });
  }
  return data;
};

export const generateStockHistory = (): { date: string; open: number; high: number; low: number; close: number; volume: number }[] => {
  const data: any[] = [];
  let price = 2800;
  const today = new Date();
  
  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    const change = (Math.random() - 0.47) * price * 0.025;
    const open = price;
    const close = Math.max(open + change, open * 0.85);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    price = close;
    
    data.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(Math.random() * 20000000) + 5000000,
    });
  }
  return data;
};
