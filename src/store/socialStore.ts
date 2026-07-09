/**
 * ============================================================================
 * Toroloom — Social Trading Store
 * ============================================================================
 *
 * Manages leaderboard data, trader profiles, follow/copy relationships,
 * and copy-trade execution state.
 *
 * All operations fall back to local mock data when the backend is unavailable.
 * ============================================================================
 */

import { create } from 'zustand';
import {
  TraderProfile, LeaderboardEntry, LeaderboardSort, LeaderboardPeriod,
  CopyTradeRelation, CopiedTrade,
} from '../types';
import { socialApi } from '../services/api/social';

// ─── Mock Top Traders ───────────────────────────────────────────────────────

const mockTraders: TraderProfile[] = [
  {
    id: 'trader_1', name: 'Arun Kumar', bio: 'Swing trader focused on Nifty and Bank Nifty. 8 years of experience in derivatives.',
    strategy: 'swing_trading', experienceYears: 8, totalPnl: 2850000, totalPnlPercent: 142.5,
    monthlyReturn: 6.8, winRate: 78.5, totalTrades: 1240, followers: 15230, copyTraders: 845,
    avgHoldingDays: 5.2, maxDrawdown: 12.3, riskScore: 'moderate', verified: true,
    joinedAt: '2022-03-15', topStocks: ['NIFTY', 'BANKNIFTY', 'RELIANCE'], badges: ['Top Trader', 'Verified', 'Consistent'],
  },
  {
    id: 'trader_2', name: 'Priya Patel', bio: 'Value investor. Long-term positions in quality stocks. CAGR of 24% over 5 years.',
    strategy: 'value_investing', experienceYears: 12, totalPnl: 4200000, totalPnlPercent: 186.7,
    monthlyReturn: 4.2, winRate: 82.1, totalTrades: 680, followers: 23450, copyTraders: 1230,
    avgHoldingDays: 45.8, maxDrawdown: 8.1, riskScore: 'low', verified: true,
    joinedAt: '2021-08-01', topStocks: ['HDFCBANK', 'TCS', 'RELIANCE'], badges: ['Top Trader', 'Verified', 'Safe Hands'],
  },
  {
    id: 'trader_3', name: 'Vikram Reddy', bio: 'Momentum trader. High volume, high reward. Specialises in breakout strategies.',
    strategy: 'momentum', experienceYears: 5, totalPnl: 1850000, totalPnlPercent: 98.3,
    monthlyReturn: 9.5, winRate: 64.2, totalTrades: 2100, followers: 8970, copyTraders: 512,
    avgHoldingDays: 1.8, maxDrawdown: 22.5, riskScore: 'high', verified: true,
    joinedAt: '2023-01-20', topStocks: ['TATAMOTORS', 'SBIN', 'INFY'], badges: ['Verified', 'High Risk'],
  },
  {
    id: 'trader_4', name: 'Neha Singh', bio: 'Options seller. Consistent monthly income using iron condors and credit spreads.',
    strategy: 'options_selling', experienceYears: 6, totalPnl: 1350000, totalPnlPercent: 112.8,
    monthlyReturn: 5.1, winRate: 85.3, totalTrades: 890, followers: 12450, copyTraders: 678,
    avgHoldingDays: 3.5, maxDrawdown: 9.8, riskScore: 'moderate', verified: true,
    joinedAt: '2022-06-10', topStocks: ['NIFTY', 'BANKNIFTY'], badges: ['Top Trader', 'Options Expert'],
  },
  {
    id: 'trader_5', name: 'Rohit Mehra', bio: 'Intraday scalper. 200+ trades per month with strict risk management.',
    strategy: 'intraday', experienceYears: 4, totalPnl: 980000, totalPnlPercent: 65.4,
    monthlyReturn: 7.2, winRate: 71.8, totalTrades: 3200, followers: 5670, copyTraders: 310,
    avgHoldingDays: 0.1, maxDrawdown: 15.2, riskScore: 'high', verified: false,
    joinedAt: '2023-11-05', topStocks: ['RELIANCE', 'ICICIBANK', 'HDFCBANK'], badges: ['High Volume'],
  },
  {
    id: 'trader_6', name: 'Ananya Gupta', bio: 'Long-term investor with focus on dividend growth and compounding. Portfolio: ₹2.5Cr.',
    strategy: 'long_term', experienceYears: 15, totalPnl: 5600000, totalPnlPercent: 224.0,
    monthlyReturn: 3.1, winRate: 90.5, totalTrades: 340, followers: 31200, copyTraders: 1890,
    avgHoldingDays: 180.5, maxDrawdown: 5.5, riskScore: 'low', verified: true,
    joinedAt: '2020-05-01', topStocks: ['HINDUNILVR', 'ITC', 'HDFCBANK', 'TCS'], badges: ['Top Trader', 'Verified', 'Dividend King'],
  },
  {
    id: 'trader_7', name: 'Karan Joshi', bio: 'Futures trader specialising in crude oil and metals. Technical analysis driven.',
    strategy: 'futures', experienceYears: 7, totalPnl: 2100000, totalPnlPercent: 88.9,
    monthlyReturn: 5.8, winRate: 68.4, totalTrades: 1560, followers: 7890, copyTraders: 420,
    avgHoldingDays: 2.1, maxDrawdown: 18.7, riskScore: 'high', verified: true,
    joinedAt: '2022-09-12', topStocks: ['CRUDEOIL', 'GOLD', 'COPPER'], badges: ['Verified', 'Commodities Pro'],
  },
  {
    id: 'trader_8', name: 'Deepika Sharma', bio: 'Swing + momentum hybrid. Uses quantitative screening to find breakout candidates.',
    strategy: 'swing_trading', experienceYears: 3, totalPnl: 650000, totalPnlPercent: 54.2,
    monthlyReturn: 8.3, winRate: 66.7, totalTrades: 980, followers: 3450, copyTraders: 185,
    avgHoldingDays: 3.2, maxDrawdown: 16.1, riskScore: 'moderate', verified: false,
    joinedAt: '2024-02-01', topStocks: ['WIPRO', 'ITC', 'BAJFINANCE'], badges: ['Rising Star'],
  },
];

// ─── Store ──────────────────────────────────────────────────────────────────

interface SocialState {
  // Leaderboard
  leaderboard: LeaderboardEntry[];
  leaderboardSort: LeaderboardSort;
  leaderboardPeriod: LeaderboardPeriod;
  isLoadingLeaderboard: boolean;

  // Following
  followedTraderIds: string[];

  // Copy Trading
  copyRelations: CopyTradeRelation[];
  copiedTrades: CopiedTrade[];

  // Search
  searchQuery: string;
  searchResults: TraderProfile[];

  // Actions
  fetchLeaderboard: (sort?: LeaderboardSort, period?: LeaderboardPeriod) => Promise<void>;
  setLeaderboardSort: (sort: LeaderboardSort) => void;
  setLeaderboardPeriod: (period: LeaderboardPeriod) => void;

  followTrader: (traderId: string) => Promise<void>;
  unfollowTrader: (traderId: string) => Promise<void>;

  startCopyTrading: (traderId: string, allocationPercent: number, investmentAmount: number) => Promise<void>;
  stopCopyTrading: (traderId: string) => Promise<void>;
  toggleCopyPause: (traderId: string) => Promise<void>;

  searchTraders: (query: string) => Promise<void>;
  clearSearch: () => void;

  followingTraders: TraderProfile[];

  isFollowing: (traderId: string) => boolean;
  isCopying: (traderId: string) => boolean;
}

function buildLeaderboard(traders: TraderProfile[], sort: LeaderboardSort, _period: LeaderboardPeriod): LeaderboardEntry[] {
  const sorted = [...traders];
  switch (sort) {
    case 'pnl':
      sorted.sort((a, b) => b.totalPnl - a.totalPnl);
      break;
    case 'winRate':
      sorted.sort((a, b) => b.winRate - a.winRate);
      break;
    case 'followers':
      sorted.sort((a, b) => b.followers - a.followers);
      break;
    case 'returns':
      sorted.sort((a, b) => b.totalPnlPercent - a.totalPnlPercent);
      break;
    case 'trades':
      sorted.sort((a, b) => b.totalTrades - a.totalTrades);
      break;
  }
  return sorted.map((t, i) => ({
    ...t,
    rank: i + 1,
    change: 'same' as const,
    rankChange: 0,
  }));
}

export const useSocialStore = create<SocialState>((set, get) => ({
  leaderboard: buildLeaderboard(mockTraders, 'pnl', 'ALL'),
  leaderboardSort: 'pnl',
  leaderboardPeriod: 'ALL',
  isLoadingLeaderboard: false,

  followedTraderIds: ['trader_1', 'trader_4'],
  copyRelations: [
    {
      traderId: 'trader_1', traderName: 'Arun Kumar', allocationPercent: 50,
      investmentAmount: 250000, totalPnl: 18500, activeTrades: 3,
      startedAt: '2025-02-15T00:00:00Z', isPaused: false,
    },
    {
      traderId: 'trader_4', traderName: 'Neha Singh', allocationPercent: 30,
      investmentAmount: 150000, totalPnl: 9200, activeTrades: 2,
      startedAt: '2025-03-01T00:00:00Z', isPaused: false,
    },
  ],
  copiedTrades: [
    { id: 'ct_1', traderId: 'trader_1', traderName: 'Arun Kumar', symbol: 'NIFTY', action: 'buy', quantity: 50, price: 23450, executedAt: new Date(Date.now() - 86400000).toISOString(), pnl: 1250, pnlPercent: 1.07, isOpen: true, allocationPercent: 50 },
    { id: 'ct_2', traderId: 'trader_1', traderName: 'Arun Kumar', symbol: 'BANKNIFTY', action: 'sell', quantity: 25, price: 49200, executedAt: new Date(Date.now() - 172800000).toISOString(), pnl: 3400, pnlPercent: 2.76, isOpen: false, allocationPercent: 50 },
    { id: 'ct_3', traderId: 'trader_4', traderName: 'Neha Singh', symbol: 'NIFTY', action: 'sell', quantity: 75, price: 23380, executedAt: new Date(Date.now() - 43200000).toISOString(), pnl: 1800, pnlPercent: 1.03, isOpen: true, allocationPercent: 30 },
  ],

  searchQuery: '',
  searchResults: [],

  followingTraders: mockTraders.filter(t => ['trader_1', 'trader_4'].includes(t.id)),

  fetchLeaderboard: async (sort, period) => {
    const currentSort = sort || get().leaderboardSort;
    const currentPeriod = period || get().leaderboardPeriod;
    set({ isLoadingLeaderboard: true, leaderboardSort: currentSort, leaderboardPeriod: currentPeriod });

    try {
      const data = await socialApi.getLeaderboard(currentSort, currentPeriod);
      set({ leaderboard: data.entries, isLoadingLeaderboard: false });
    } catch {
      // Local sort of mock data
      set({
        leaderboard: buildLeaderboard(mockTraders, currentSort, currentPeriod),
        isLoadingLeaderboard: false,
      });
    }
  },

  setLeaderboardSort: (sort) => {
    set({ leaderboardSort: sort });
    get().fetchLeaderboard(sort, get().leaderboardPeriod);
  },

  setLeaderboardPeriod: (period) => {
    set({ leaderboardPeriod: period });
    get().fetchLeaderboard(get().leaderboardSort, period);
  },

  followTrader: async (traderId) => {
    const trader = mockTraders.find(t => t.id === traderId);
    if (!trader) return;
    set(s => ({
      followedTraderIds: [...s.followedTraderIds, traderId],
      followingTraders: [...s.followingTraders, trader],
    }));
    try {
      await socialApi.followTrader(traderId);
    } catch {
      // Local only
    }
  },

  unfollowTrader: async (traderId) => {
    set(s => ({
      followedTraderIds: s.followedTraderIds.filter(id => id !== traderId),
      followingTraders: s.followingTraders.filter(t => t.id !== traderId),
    }));
    try {
      await socialApi.unfollowTrader(traderId);
    } catch {
      // Local only
    }
  },

  startCopyTrading: async (traderId, allocationPercent, investmentAmount) => {
    const trader = mockTraders.find(t => t.id === traderId);
    if (!trader) return;

    const newRelation: CopyTradeRelation = {
      traderId, traderName: trader.name, traderAvatar: trader.avatar,
      allocationPercent, investmentAmount, totalPnl: 0, activeTrades: 0,
      startedAt: new Date().toISOString(), isPaused: false,
    };

    set(s => ({ copyRelations: [...s.copyRelations, newRelation] }));

    try {
      await socialApi.startCopyTrading(traderId, allocationPercent, investmentAmount);
    } catch {
      // Local only
    }
  },

  stopCopyTrading: async (traderId) => {
    set(s => ({
      copyRelations: s.copyRelations.filter(r => r.traderId !== traderId),
      copiedTrades: s.copiedTrades.filter(t => t.traderId !== traderId),
    }));
    try {
      await socialApi.stopCopyTrading(traderId);
    } catch {
      // Local only
    }
  },

  toggleCopyPause: async (traderId) => {
    set(s => ({
      copyRelations: s.copyRelations.map(r =>
        r.traderId === traderId ? { ...r, isPaused: !r.isPaused } : r
      ),
    }));
    try {
      await socialApi.toggleCopyPause(traderId);
    } catch {
      // Local only
    }
  },

  searchTraders: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: '' });
      return;
    }
    set({ searchQuery: query });
    try {
      const results = await socialApi.searchTraders(query);
      set({ searchResults: results });
    } catch {
      // Local search
      const q = query.toLowerCase();
      const results = mockTraders.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.strategy.toLowerCase().includes(q) ||
        t.topStocks.some(s => s.toLowerCase().includes(q))
      );
      set({ searchResults: results });
    }
  },

  clearSearch: () => {
    set({ searchResults: [], searchQuery: '' });
  },

  isFollowing: (traderId) => get().followedTraderIds.includes(traderId),
  isCopying: (traderId) => get().copyRelations.some(r => r.traderId === traderId),
}));
