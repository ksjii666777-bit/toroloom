import { v4 as uuid } from 'uuid';

// ============ User ============
export const mockUser = {
  id: 'user_1',
  name: 'Rahul Sharma',
  email: 'rahul.sharma@email.com',
  phone: '+91 98765 43210',
  panNumber: 'ABCDE1234F',
  avatar: undefined as string | undefined,
  kycStatus: 'verified' as const,
  balance: 2500000,
  createdAt: '2024-01-15',
};

// ============ Mutual Funds ============
export const mockMutualFunds = [
  { id: 'mf1', name: 'Parag Parikh Flexi Cap Fund', category: 'Flexi Cap', nav: 67.45, dayChange: 0.89, dayChangePercent: 1.34, oneYearReturn: 28.5, threeYearReturn: 72.3, fiveYearReturn: 125.6, riskLevel: 'high' as const, minInvestment: 1000, fundSize: '₹45,678 Cr', rating: 5 },
  { id: 'mf2', name: 'HDFC Mid-Cap Opportunities Fund', category: 'Mid Cap', nav: 156.30, dayChange: 1.23, dayChangePercent: 0.79, oneYearReturn: 35.2, threeYearReturn: 85.6, fiveYearReturn: 145.8, riskLevel: 'high' as const, minInvestment: 500, fundSize: '₹32,456 Cr', rating: 4 },
  { id: 'mf3', name: 'SBI Bluechip Fund', category: 'Large Cap', nav: 89.20, dayChange: -0.45, dayChangePercent: -0.50, oneYearReturn: 22.1, threeYearReturn: 58.4, fiveYearReturn: 98.2, riskLevel: 'moderate' as const, minInvestment: 500, fundSize: '₹28,912 Cr', rating: 4 },
  { id: 'mf4', name: 'Axis Small Cap Fund', category: 'Small Cap', nav: 112.80, dayChange: 2.15, dayChangePercent: 1.94, oneYearReturn: 42.3, threeYearReturn: 95.7, fiveYearReturn: 168.4, riskLevel: 'high' as const, minInvestment: 500, fundSize: '₹18,567 Cr', rating: 5 },
  { id: 'mf5', name: 'ICICI Prudential Value Discovery Fund', category: 'Value', nav: 178.60, dayChange: 1.56, dayChangePercent: 0.88, oneYearReturn: 25.8, threeYearReturn: 62.1, fiveYearReturn: 110.5, riskLevel: 'moderate' as const, minInvestment: 1000, fundSize: '₹22,345 Cr', rating: 4 },
  { id: 'mf6', name: 'Kotak Corporate Bond Fund', category: 'Debt', nav: 45.90, dayChange: 0.12, dayChangePercent: 0.26, oneYearReturn: 8.2, threeYearReturn: 22.5, fiveYearReturn: 38.7, riskLevel: 'low' as const, minInvestment: 1000, fundSize: '₹15,234 Cr', rating: 3 },
];

export const mockSIPs = [
  { id: 'sip1', fundId: 'mf1', fundName: 'Parag Parikh Flexi Cap Fund', amount: 5000, frequency: 'monthly' as const, nextDate: '2025-06-01', totalInvested: 60000, currentValue: 68450, returns: 8450 },
  { id: 'sip2', fundId: 'mf3', fundName: 'SBI Bluechip Fund', amount: 3000, frequency: 'monthly' as const, nextDate: '2025-06-05', totalInvested: 36000, currentValue: 39120, returns: 3120 },
];

// ============ Education ============
// Content loaded from separate courseContent file to keep this file manageable
export { realCourses as mockCourses, realLessons as mockLessons } from './courseContent';

// ============ Community ============
export const mockPosts = Array.from({ length: 10 }, (_, i) => ({
  id: `p${i + 1}`,
  userId: `u${i + 2}`,
  userName: ['Priya Patel', 'Arun Kumar', 'Neha Singh', 'Vikram Reddy', 'Sneha Kapoor', 'Rohit Mehra', 'Ananya Gupta', 'Karan Joshi', 'Deepika Sharma', 'Akash Verma'][i],
  content: [
    'Just made my first 1 lakh profit on RELIANCE calls! 🚀 The technical setup was perfect with the breakout above 2850.',
    'Anyone else looking at ITC? The valuation looks attractive at current levels. 4% dividend yield is a bonus! 📊',
    'Started my first SIP today! ₹5000/month in Parag Parikh Flexi Cap Fund. Better late than never! 💪 #StartSmall',
    'Market outlook this week: Nifty facing resistance at 23500. If it breaks, we could see 23800. Support at 23100. Trade carefully! 🎯',
    'Just completed the Technical Analysis course on this app! Amazing content. Highly recommend it for beginners who want to learn chart patterns. 📚',
    'Gold vs Equities: Where should you invest in 2025? Here is my analysis based on historical data and current market conditions...',
    'Does anyone have experience with F&O trading? Looking for tips on risk management strategies for options selling.',
    'RELIANCE Q4 results were amazing! Revenue up 15% YoY, EBITDA margins expanding. Long-term hold for sure! 📈',
    'Built a small case study on how SIP investing in mid-cap funds outperformed lump sum over 5 years. Data inside! 🧵',
    'Today I learned about the importance of asset allocation. 60% equity, 30% debt, 10% gold — working well for me so far!',
  ][i],
  likes: Math.floor(Math.random() * 300) + 20,
  comments: Math.floor(Math.random() * 50) + 5,
  timestamp: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  tags: [['RELIANCE', 'Options', 'Profit'], ['ITC', 'ValueInvesting', 'Dividend'], ['SIP', 'MutualFunds', 'Beginner'], ['Nifty', 'MarketOutlook', 'Analysis'], ['Learning', 'TechnicalAnalysis', 'Review'], ['Gold', 'Equities', 'Investment'], ['F&O', 'RiskManagement', 'Options'], ['RELIANCE', 'Results', 'Earnings'], ['SIP', 'MidCap', 'MutualFunds'], ['AssetAllocation', 'Portfolio', 'Strategy']][i],
}));

// ============ AI Insights ============
export const mockAIInsights = [
  { id: 'ai1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', type: 'bullish' as const, confidence: 85, summary: 'Strong breakout above resistance with high volume', analysis: 'RELIANCE has broken above the key resistance level of ₹2,850 with significantly higher volumes than the 20-day average. The RSI is at 62, indicating room for further upside.', targets: [{ target: 2950, probability: 75 }, { target: 3020, probability: 45 }, { target: 3100, probability: 25 }], timestamp: new Date().toISOString() },
  { id: 'ai2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', type: 'bearish' as const, confidence: 72, summary: 'Forming lower highs; weak momentum', analysis: 'TCS is showing signs of weakness with a series of lower highs on the daily chart. The MACD has given a sell signal.', targets: [{ target: 3800, probability: 60 }, { target: 3650, probability: 35 }, { target: 3500, probability: 15 }], timestamp: new Date().toISOString() },
  { id: 'ai3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'neutral' as const, confidence: 65, summary: 'Consolidating in a range; wait for breakout', analysis: 'HDFC Bank is consolidating between ₹1,650 and ₹1,720. The stock needs to break above ₹1,720 for a bullish move.', targets: [{ target: 1720, probability: 55 }, { target: 1800, probability: 35 }, { target: 1600, probability: 20 }], timestamp: new Date().toISOString() },
  { id: 'ai4', stockId: 'SBIN', symbol: 'SBIN', name: 'State Bank of India', type: 'bullish' as const, confidence: 88, summary: 'Strong uptrend with high institutional interest', analysis: 'SBI is in a strong uptrend. The PSU banking sector is seeing strong momentum with improving asset quality.', targets: [{ target: 820, probability: 80 }, { target: 850, probability: 55 }, { target: 900, probability: 30 }], timestamp: new Date().toISOString() },
];

// ============ Notifications ============
export const mockNotifications = [
  { id: 'n1', type: 'price_alert' as const, title: 'Price Alert: RELIANCE', message: 'RELIANCE crossed ₹2,890. Target 1 achieved! 🎯', read: false, timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'n2', type: 'trade' as const, title: 'Trade Executed', message: 'Buy order for 50 RELIANCE @ ₹2,890 executed successfully.', read: false, timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: 'n3', type: 'educational' as const, title: 'New Lesson Available', message: 'Next lesson "Advanced Chart Patterns" is ready for you!', read: true, timestamp: new Date(Date.now() - 86400000).toISOString() },
  { id: 'n4', type: 'news' as const, title: 'Market News: RBI Policy', message: 'RBI keeps repo rate unchanged at 6.50%. Markets react positively.', read: true, timestamp: new Date(Date.now() - 172800000).toISOString() },
  { id: 'n5', type: 'system' as const, title: 'KYC Update', message: 'Your KYC documents have been verified successfully! ✅', read: true, timestamp: new Date(Date.now() - 259200000).toISOString() },
];

// ============ Gamification ============
export const mockBadges = [
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

export const mockUserLevel = { level: 12, title: 'Trading Pro', xp: 4500, xpToNext: 5000, totalXp: 24500 };
