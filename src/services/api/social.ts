import { api } from './client';
import type { LeaderboardEntry, TraderProfile, CopyTradeRelation, CopiedTrade } from '../../types';

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export const socialApi = {
  /** Fetch leaderboard with sort/period/page */
  getLeaderboard: (
    sort?: string,
    period?: string,
    page?: number,
    limit?: number,
  ) => {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (period) params.set('period', period);
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    return api.get<LeaderboardResponse>(`/social/leaderboard?${params.toString()}`);
  },

  /** Search traders by name */
  searchTraders: (query: string) =>
    api.get<TraderProfile[]>(`/social/traders/search?q=${encodeURIComponent(query)}`),

  /** Get a single trader's profile */
  getTraderProfile: (traderId: string) =>
    api.get<TraderProfile>(`/social/traders/${traderId}`),

  /** Get a trader's recent trades (public) */
  getTraderTrades: (traderId: string) =>
    api.get<CopiedTrade[]>(`/social/traders/${traderId}/trades`),

  /** Follow a trader */
  followTrader: (traderId: string) =>
    api.post<{ followers: number }>(`/social/traders/${traderId}/follow`),

  /** Unfollow a trader */
  unfollowTrader: (traderId: string) =>
    api.post<{ followers: number }>(`/social/traders/${traderId}/unfollow`),

  /** Start copy trading a trader */
  startCopyTrading: (traderId: string, allocationPercent: number, investmentAmount: number) =>
    api.post<CopyTradeRelation>('/social/copy/start', { traderId, allocationPercent, investmentAmount }),

  /** Stop copy trading */
  stopCopyTrading: (traderId: string) =>
    api.post<void>(`/social/copy/${traderId}/stop`),

  /** Pause/resume copy trading */
  toggleCopyPause: (traderId: string) =>
    api.post<{ isPaused: boolean }>(`/social/copy/${traderId}/toggle-pause`),

  /** Update allocation percent for a copy trader */
  updateAllocation: (traderId: string, allocationPercent: number) =>
    api.put<CopyTradeRelation>(`/social/copy/${traderId}/allocation`, { allocationPercent }),

  /** Get current user's copy trading relations */
  getMyCopyTrades: () =>
    api.get<CopyTradeRelation[]>('/social/copy/my'),

  /** Get current user's followed traders */
  getMyFollowedTraders: () =>
    api.get<TraderProfile[]>('/social/following'),
};
