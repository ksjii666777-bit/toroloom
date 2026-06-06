import {
  User, MarketIndex, Stock, Holding, Trade, OpenOrder, Watchlist,
  MutualFund, SIPPlan, Course, Lesson, CommunityPost,
  AIInsight, Badge, UserLevel, AppNotification
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

// ============ Chart History (Mock) ============
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
