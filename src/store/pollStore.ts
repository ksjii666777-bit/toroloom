/**
 * ============================================================================
 * Toroloom — Social Polls & Voting Store
 * ============================================================================
 *
 * Manages community polls: create, vote, close, like, filter by category/status.
 * All operations fall back to local state when the backend is unavailable.
 * ============================================================================
 */

import { create } from 'zustand';
import { Poll, PollOption, PollCategory, PollStatus, PollDuration } from '../types';
import { offlineCache } from '../services/offlineCache';

// ─── Mock Polls ─────────────────────────────────────────────────────────────

const now = Date.now();
const hoursFromNow = (h: number) => new Date(now + h * 3600000).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString();

const mockPolls: Poll[] = [
  {
    id: 'poll_1',
    question: 'Where do you see NIFTY by end of this month?',
    options: [
      { id: 'poll_1_opt_1', text: 'Above 25,000 🚀', votes: 234 },
      { id: 'poll_1_opt_2', text: '24,500 - 25,000', votes: 156 },
      { id: 'poll_1_opt_3', text: '24,000 - 24,500', votes: 89 },
      { id: 'poll_1_opt_4', text: 'Below 24,000 📉', votes: 45 },
    ],
    totalVotes: 524,
    createdAt: hoursAgo(12),
    expiresAt: hoursFromNow(60),
    status: 'active',
    category: 'market_outlook',
    creatorId: 'u1',
    creatorName: 'Arun Kumar',
    creatorAvatar: undefined,
    likes: 128,
    likedByUser: false,
    userVote: null,
    tags: ['nifty', 'outlook'],
  },
  {
    id: 'poll_2',
    question: 'Which sector will outperform this quarter?',
    options: [
      { id: 'poll_2_opt_1', text: 'Banking & Finance 🏦', votes: 312 },
      { id: 'poll_2_opt_2', text: 'IT & Tech 💻', votes: 198 },
      { id: 'poll_2_opt_3', text: 'Pharma & Healthcare 💊', votes: 145 },
      { id: 'poll_2_opt_4', text: 'Auto & Manufacturing 🚗', votes: 97 },
      { id: 'poll_2_opt_5', text: 'FMCG 🛒', votes: 67 },
      { id: 'poll_2_opt_6', text: 'Real Estate 🏗️', votes: 43 },
    ],
    totalVotes: 862,
    createdAt: hoursAgo(36),
    expiresAt: hoursFromNow(36),
    status: 'active',
    category: 'stocks',
    creatorId: 'u2',
    creatorName: 'Priya Patel',
    creatorAvatar: undefined,
    likes: 89,
    likedByUser: true,
    userVote: 'poll_2_opt_1',
    tags: ['sectors', 'outperform'],
  },
  {
    id: 'poll_3',
    question: 'Best investment strategy for a volatile market?',
    options: [
      { id: 'poll_3_opt_1', text: 'SIP in index funds 📊', votes: 445 },
      { id: 'poll_3_opt_2', text: 'Value investing in bluechips 💎', votes: 267 },
      { id: 'poll_3_opt_3', text: 'Options selling for income 💰', votes: 189 },
      { id: 'poll_3_opt_4', text: 'Stay in cash / FDs 🏦', votes: 78 },
    ],
    totalVotes: 979,
    createdAt: hoursAgo(48),
    expiresAt: hoursFromNow(24),
    status: 'active',
    category: 'strategy',
    creatorId: 'u3',
    creatorName: 'Vikram Reddy',
    creatorAvatar: undefined,
    likes: 210,
    likedByUser: false,
    userVote: 'poll_3_opt_1',
    tags: ['strategy', 'volatility'],
  },
  {
    id: 'poll_4',
    question: 'Is the current bull run sustainable?',
    options: [
      { id: 'poll_4_opt_1', text: 'Yes — fundamentals are strong 📈', votes: 156 },
      { id: 'poll_4_opt_2', text: 'No — correction is due soon 📉', votes: 234 },
      { id: 'poll_4_opt_3', text: 'Sideways for next 3 months ↔️', votes: 98 },
    ],
    totalVotes: 488,
    createdAt: hoursAgo(96),
    expiresAt: hoursAgo(24),
    status: 'closed',
    category: 'market_outlook',
    creatorId: 'u4',
    creatorName: 'Neha Singh',
    creatorAvatar: undefined,
    likes: 67,
    likedByUser: false,
    userVote: null,
    tags: ['bull-run', 'market-outlook'],
  },
  {
    id: 'poll_5',
    question: 'Best IPO to apply for this month?',
    options: [
      { id: 'poll_5_opt_1', text: 'Tata Technologies 🔧', votes: 345 },
      { id: 'poll_5_opt_2', text: 'Jio Financial 📱', votes: 267 },
      { id: 'poll_5_opt_3', text: 'LIC Housing Finance 🏠', votes: 123 },
    ],
    totalVotes: 735,
    createdAt: hoursAgo(72),
    expiresAt: hoursAgo(6),
    status: 'closed',
    category: 'ipo',
    creatorId: 'u5',
    creatorName: 'Rohit Mehra',
    creatorAvatar: undefined,
    likes: 92,
    likedByUser: true,
    userVote: 'poll_5_opt_1',
    tags: ['ipo', 'subscription'],
  },
  {
    id: 'poll_6',
    question: 'What is your outlook on Bitcoin for 2026?',
    options: [
      { id: 'poll_6_opt_1', text: 'New ATH above $150K 🚀', votes: 178 },
      { id: 'poll_6_opt_2', text: 'Rangebound $80K-$120K ↔️', votes: 234 },
      { id: 'poll_6_opt_3', text: 'Correction below $60K 📉', votes: 89 },
      { id: 'poll_6_opt_4', text: 'Don\'t follow crypto 🤷', votes: 56 },
    ],
    totalVotes: 557,
    createdAt: hoursAgo(24),
    expiresAt: hoursFromNow(48),
    status: 'active',
    category: 'crypto',
    creatorId: 'u6',
    creatorName: 'Ananya Gupta',
    creatorAvatar: undefined,
    likes: 45,
    likedByUser: false,
    userVote: null,
    tags: ['bitcoin', 'crypto', 'outlook'],
  },
  {
    id: 'poll_7',
    question: 'Will RBI cut repo rate in the next policy meet?',
    options: [
      { id: 'poll_7_opt_1', text: 'Yes — 25 bps cut ✅', votes: 312 },
      { id: 'poll_7_opt_2', text: 'Yes — 50 bps cut ✅✅', votes: 98 },
      { id: 'poll_7_opt_3', text: 'No — hold rates ❌', votes: 201 },
      { id: 'poll_7_opt_4', text: 'No — hike rates ⬆️', votes: 23 },
    ],
    totalVotes: 634,
    createdAt: hoursAgo(18),
    expiresAt: hoursFromNow(150),
    status: 'active',
    category: 'economy',
    creatorId: 'u7',
    creatorName: 'Karan Joshi',
    creatorAvatar: undefined,
    likes: 156,
    likedByUser: false,
    userVote: 'poll_7_opt_1',
    tags: ['rbi', 'repo-rate', 'monetary-policy'],
  },
  {
    id: 'poll_8',
    question: 'Which stock will give the best returns this year?',
    options: [
      { id: 'poll_8_opt_1', text: 'RELIANCE ⚡', votes: 256 },
      { id: 'poll_8_opt_2', text: 'HDFC Bank 🏦', votes: 198 },
      { id: 'poll_8_opt_3', text: 'TCS 💻', votes: 145 },
      { id: 'poll_8_opt_4', text: 'ICICI Bank 🏛️', votes: 123 },
    ],
    totalVotes: 722,
    createdAt: hoursAgo(120),
    expiresAt: hoursAgo(48),
    status: 'closed',
    category: 'stocks',
    creatorId: 'u1',
    creatorName: 'Arun Kumar',
    creatorAvatar: undefined,
    likes: 189,
    likedByUser: true,
    userVote: 'poll_8_opt_1',
    tags: ['stocks', 'returns'],
  },
];

// ─── Store ──────────────────────────────────────────────────────────────────

interface PollStoreState {
  /** All polls */
  polls: Poll[];
  /** Current filter category (null = all) */
  activeCategory: PollCategory | null;
  /** Current filter status */
  activeStatus: PollStatus | 'all';
  /** Loading state */
  isLoading: boolean;
  /** Whether user is creating a new poll */
  isCreating: boolean;

  // Actions
  loadFromCache: () => Promise<void>;
  setActiveCategory: (category: PollCategory | null) => void;
  setActiveStatus: (status: PollStatus | 'all') => void;

  createPoll: (
    question: string,
    options: string[],
    category: PollCategory,
    duration: PollDuration,
    tags: string[],
  ) => Promise<string>;

  voteOnPoll: (pollId: string, optionId: string) => void;
  toggleLikePoll: (pollId: string) => void;
  closePoll: (pollId: string) => void;
  deletePoll: (pollId: string) => void;

  /** Get filtered and sorted polls */
  getFilteredPolls: () => Poll[];

  /** Get polls created by current user */
  getMyPolls: () => Poll[];
}

function getCurrentUserId(): string {
  return 'user_1';
}

function getCurrentUserName(): string {
  return 'Rahul Sharma';
}

/** Generate a unique ID */
function uid(): string {
  return `poll_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const usePollStore = create<PollStoreState>((set, get) => ({
  polls: mockPolls,
  activeCategory: null,
  activeStatus: 'all',
  isLoading: false,
  isCreating: false,

  loadFromCache: async () => {
    const cached = await offlineCache.load<{ polls: Poll[] }>('polls');
    if (cached) {
      set({ polls: cached.data.polls });
    }
  },

  setActiveCategory: (category) => set({ activeCategory: category }),
  setActiveStatus: (status) => set({ activeStatus: status }),

  createPoll: async (question, optionsText, category, duration, tags) => {
    const pollId = uid();
    const now = new Date().toISOString();

    const newPoll: Poll = {
      id: pollId,
      question,
      options: optionsText.map((text, i) => ({
        id: `${pollId}_opt_${i}`,
        text,
        votes: 0,
      })),
      totalVotes: 0,
      createdAt: now,
      expiresAt: new Date(Date.now() + duration * 3600000).toISOString(),
      status: 'active',
      category,
      creatorId: getCurrentUserId(),
      creatorName: getCurrentUserName(),
      likes: 0,
      likedByUser: false,
      userVote: null,
      tags,
    };

    set(s => ({ polls: [newPoll, ...s.polls], isCreating: false }));
    await offlineCache.save('polls', { polls: get().polls });
    return pollId;
  },

  voteOnPoll: (pollId, optionId) => {
    const { polls } = get();
    const poll = polls.find(p => p.id === pollId);
    if (!poll || poll.status === 'closed' || poll.userVote) return;

    set(s => ({
      polls: s.polls.map(p => {
        if (p.id !== pollId) return p;
        return {
          ...p,
          userVote: optionId,
          totalVotes: p.totalVotes + 1,
          options: p.options.map(o => ({
            ...o,
            votes: o.id === optionId ? o.votes + 1 : o.votes,
          })),
        };
      }),
    }));

    offlineCache.save('polls', { polls: get().polls });
  },

  toggleLikePoll: (pollId) => {
    set(s => ({
      polls: s.polls.map(p => {
        if (p.id !== pollId) return p;
        return {
          ...p,
          likes: p.likedByUser ? p.likes - 1 : p.likes + 1,
          likedByUser: !p.likedByUser,
        };
      }),
    }));

    offlineCache.save('polls', { polls: get().polls });
  },

  closePoll: (pollId) => {
    set(s => ({
      polls: s.polls.map(p => {
        if (p.id !== pollId) return p;
        return { ...p, status: 'closed' };
      }),
    }));

    offlineCache.save('polls', { polls: get().polls });
  },

  deletePoll: (pollId) => {
    set(s => ({
      polls: s.polls.filter(p => p.id !== pollId),
    }));

    offlineCache.save('polls', { polls: get().polls });
  },

  getFilteredPolls: () => {
    const { polls, activeCategory, activeStatus } = get();
    return polls.filter(p => {
      if (activeStatus !== 'all' && p.status !== activeStatus) return false;
      if (activeCategory && p.category !== activeCategory) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getMyPolls: () => {
    const userId = getCurrentUserId();
    return get().polls.filter(p => p.creatorId === userId);
  },
}));
