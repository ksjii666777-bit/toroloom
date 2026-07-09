/**
 * ============================================================================
 * Toroloom Social Trading Service
 * ============================================================================
 *
 * Manages leaderboard data, trader follow/copy relationships, and
 * copy-trade execution state via a pluggable StorageEngine.
 *
 * ============================================================================
 */

import type { StorageEngine } from '../storage/types';

// ==================== Types ====================

export interface TraderStats {
  totalPnl: number;
  totalPnlPercent: number;
  monthlyReturn: number;
  winRate: number;
  totalTrades: number;
  followers: number;
  copyTraders: number;
}

export interface SocialTraderData {
  id: string;
  name: string;
  avatar?: string;
  bio: string;
  strategy: string;
  experienceYears: number;
  stats: TraderStats;
  verified: boolean;
  joinedAt: string;
  topStocks: string[];
  badges: string[];
}

export interface CopyRelationData {
  userId: string;
  traderId: string;
  allocationPercent: number;
  investmentAmount: number;
  totalPnl: number;
  activeTrades: number;
  startedAt: string;
  isPaused: boolean;
}

export interface FollowRelationData {
  userId: string;
  traderId: string;
  followedAt: string;
}

// ==================== Internal State ====================

let socialStorage: StorageEngine | null = null;

// Mock top traders data (same as frontend mock)
const mockTraders: SocialTraderData[] = [
  {
    id: 'trader_1', name: 'Arun Kumar', bio: 'Swing trader focused on Nifty and Bank Nifty. 8 years of experience in derivatives.',
    strategy: 'swing_trading', experienceYears: 8, verified: true, joinedAt: '2022-03-15',
    topStocks: ['NIFTY', 'BANKNIFTY', 'RELIANCE'], badges: ['Top Trader', 'Verified', 'Consistent'],
    stats: { totalPnl: 2850000, totalPnlPercent: 142.5, monthlyReturn: 6.8, winRate: 78.5, totalTrades: 1240, followers: 15230, copyTraders: 845 },
  },
  {
    id: 'trader_2', name: 'Priya Patel', bio: 'Value investor. Long-term positions in quality stocks. CAGR of 24% over 5 years.',
    strategy: 'value_investing', experienceYears: 12, verified: true, joinedAt: '2021-08-01',
    topStocks: ['HDFCBANK', 'TCS', 'RELIANCE'], badges: ['Top Trader', 'Verified', 'Safe Hands'],
    stats: { totalPnl: 4200000, totalPnlPercent: 186.7, monthlyReturn: 4.2, winRate: 82.1, totalTrades: 680, followers: 23450, copyTraders: 1230 },
  },
  {
    id: 'trader_3', name: 'Vikram Reddy', bio: 'Momentum trader. High volume, high reward. Specialises in breakout strategies.',
    strategy: 'momentum', experienceYears: 5, verified: true, joinedAt: '2023-01-20',
    topStocks: ['TATAMOTORS', 'SBIN', 'INFY'], badges: ['Verified', 'High Risk'],
    stats: { totalPnl: 1850000, totalPnlPercent: 98.3, monthlyReturn: 9.5, winRate: 64.2, totalTrades: 2100, followers: 8970, copyTraders: 512 },
  },
  {
    id: 'trader_4', name: 'Neha Singh', bio: 'Options seller. Consistent monthly income using iron condors and credit spreads.',
    strategy: 'options_selling', experienceYears: 6, verified: true, joinedAt: '2022-06-10',
    topStocks: ['NIFTY', 'BANKNIFTY'], badges: ['Top Trader', 'Options Expert'],
    stats: { totalPnl: 1350000, totalPnlPercent: 112.8, monthlyReturn: 5.1, winRate: 85.3, totalTrades: 890, followers: 12450, copyTraders: 678 },
  },
  {
    id: 'trader_5', name: 'Rohit Mehra', bio: 'Intraday scalper. 200+ trades per month with strict risk management.',
    strategy: 'intraday', experienceYears: 4, verified: false, joinedAt: '2023-11-05',
    topStocks: ['RELIANCE', 'ICICIBANK', 'HDFCBANK'], badges: ['High Volume'],
    stats: { totalPnl: 980000, totalPnlPercent: 65.4, monthlyReturn: 7.2, winRate: 71.8, totalTrades: 3200, followers: 5670, copyTraders: 310 },
  },
  {
    id: 'trader_6', name: 'Ananya Gupta', bio: 'Long-term investor with focus on dividend growth and compounding. Portfolio: ₹2.5Cr.',
    strategy: 'long_term', experienceYears: 15, verified: true, joinedAt: '2020-05-01',
    topStocks: ['HINDUNILVR', 'ITC', 'HDFCBANK', 'TCS'], badges: ['Top Trader', 'Verified', 'Dividend King'],
    stats: { totalPnl: 5600000, totalPnlPercent: 224.0, monthlyReturn: 3.1, winRate: 90.5, totalTrades: 340, followers: 31200, copyTraders: 1890 },
  },
  {
    id: 'trader_7', name: 'Karan Joshi', bio: 'Futures trader specialising in crude oil and metals. Technical analysis driven.',
    strategy: 'futures', experienceYears: 7, verified: true, joinedAt: '2022-09-12',
    topStocks: ['CRUDEOIL', 'GOLD', 'COPPER'], badges: ['Verified', 'Commodities Pro'],
    stats: { totalPnl: 2100000, totalPnlPercent: 88.9, monthlyReturn: 5.8, winRate: 68.4, totalTrades: 1560, followers: 7890, copyTraders: 420 },
  },
  {
    id: 'trader_8', name: 'Deepika Sharma', bio: 'Swing + momentum hybrid. Uses quantitative screening to find breakout candidates.',
    strategy: 'swing_trading', experienceYears: 3, verified: false, joinedAt: '2024-02-01',
    topStocks: ['WIPRO', 'ITC', 'BAJFINANCE'], badges: ['Rising Star'],
    stats: { totalPnl: 650000, totalPnlPercent: 54.2, monthlyReturn: 8.3, winRate: 66.7, totalTrades: 980, followers: 3450, copyTraders: 185 },
  },
];

// In-memory follow/copy relations (in production, use database)
const followRelations = new Map<string, Set<string>>(); // userId → Set<traderId>
const copyRelations = new Map<string, CopyRelationData[]>(); // userId → CopyRelationData[]

// ==================== Public API ====================

export async function configureSocialPersistence(storage: StorageEngine): Promise<void> {
  socialStorage = storage;
}

/** Get leaderboard with sort and pagination */
export async function getLeaderboard(
  sort: string = 'pnl',
  _period: string = 'ALL',
  page: number = 1,
  limit: number = 20,
): Promise<{ entries: SocialTraderData[]; total: number; page: number; totalPages: number }> {
  const sorted = [...mockTraders];
  switch (sort) {
    case 'pnl': sorted.sort((a, b) => b.stats.totalPnl - a.stats.totalPnl); break;
    case 'winRate': sorted.sort((a, b) => b.stats.winRate - a.stats.winRate); break;
    case 'followers': sorted.sort((a, b) => b.stats.followers - a.stats.followers); break;
    case 'returns': sorted.sort((a, b) => b.stats.totalPnlPercent - a.stats.totalPnlPercent); break;
    case 'trades': sorted.sort((a, b) => b.stats.totalTrades - a.stats.totalTrades); break;
  }

  const start = (page - 1) * limit;
  const paginated = sorted.slice(start, start + limit);

  return {
    entries: paginated,
    total: sorted.length,
    page,
    totalPages: Math.ceil(sorted.length / limit),
  };
}

/** Search traders by name, strategy, or stock */
export async function searchTraders(query: string): Promise<SocialTraderData[]> {
  const q = query.toLowerCase();
  return mockTraders.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.strategy.toLowerCase().includes(q) ||
    t.topStocks.some(s => s.toLowerCase().includes(q)),
  );
}

/** Get a single trader's profile */
export async function getTraderProfile(traderId: string): Promise<SocialTraderData | null> {
  return mockTraders.find(t => t.id === traderId) ?? null;
}

/** Follow a trader */
export async function followTrader(userId: string, traderId: string): Promise<number> {
  const trader = mockTraders.find(t => t.id === traderId);
  if (!trader) throw new Error('Trader not found');

  if (!followRelations.has(userId)) {
    followRelations.set(userId, new Set());
  }
  followRelations.get(userId)!.add(traderId);
  trader.stats.followers += 1;
  return trader.stats.followers;
}

/** Unfollow a trader */
export async function unfollowTrader(userId: string, traderId: string): Promise<number> {
  const trader = mockTraders.find(t => t.id === traderId);
  if (!trader) throw new Error('Trader not found');

  followRelations.get(userId)?.delete(traderId);
  trader.stats.followers = Math.max(0, trader.stats.followers - 1);
  return trader.stats.followers;
}

/** Start copy trading a trader */
export async function startCopyTrading(
  userId: string,
  traderId: string,
  allocationPercent: number,
  investmentAmount: number,
): Promise<CopyRelationData> {
  const trader = mockTraders.find(t => t.id === traderId);
  if (!trader) throw new Error('Trader not found');

  const relation: CopyRelationData = {
    userId, traderId, allocationPercent, investmentAmount,
    totalPnl: 0, activeTrades: 0, startedAt: new Date().toISOString(), isPaused: false,
  };

  const existing = copyRelations.get(userId) || [];
  existing.push(relation);
  copyRelations.set(userId, existing);

  trader.stats.copyTraders += 1;
  return relation;
}

/** Stop copy trading a trader */
export async function stopCopyTrading(userId: string, traderId: string): Promise<void> {
  const existing = copyRelations.get(userId) || [];
  copyRelations.set(userId, existing.filter(r => r.traderId !== traderId));

  const trader = mockTraders.find(t => t.id === traderId);
  if (trader) trader.stats.copyTraders = Math.max(0, trader.stats.copyTraders - 1);
}

/** Toggle pause/resume copy trading */
export async function toggleCopyPause(userId: string, traderId: string): Promise<boolean> {
  const existing = copyRelations.get(userId) || [];
  const relation = existing.find(r => r.traderId === traderId);
  if (!relation) throw new Error('Copy relation not found');
  relation.isPaused = !relation.isPaused;
  return relation.isPaused;
}

/** Update allocation percent for an existing copy relation */
export async function updateCopyAllocation(
  userId: string,
  traderId: string,
  allocationPercent: number,
): Promise<CopyRelationData> {
  const existing = copyRelations.get(userId) || [];
  const relation = existing.find(r => r.traderId === traderId);
  if (!relation) {
    throw new Error('Copy relation not found. Start copy trading first.');
  }
  relation.allocationPercent = allocationPercent;
  return relation;
}

/** Get user's copy trading relations */
export async function getMyCopyTrades(userId: string): Promise<CopyRelationData[]> {
  return copyRelations.get(userId) || [];
}

/** Get user's followed traders */
export async function getMyFollowedTraders(userId: string): Promise<SocialTraderData[]> {
  const followedIds = followRelations.get(userId);
  if (!followedIds || followedIds.size === 0) return [];
  return mockTraders.filter(t => followedIds.has(t.id));
}

/** Reset for testing */
export function resetSocialService(): void {
  socialStorage = null;
  followRelations.clear();
  copyRelations.clear();
}
