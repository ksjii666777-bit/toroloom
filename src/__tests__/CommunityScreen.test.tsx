import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', bgCard: '#1A1A2E',
      bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44',
      bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
    },
  }),
}));

const mockNavigate = vi.fn();
const mockAddPost = vi.fn();
const mockLikePost = vi.fn();
const mockFetchTrending = vi.fn();

const defaultPosts = [
  { id: '1', userId: 'user1', userName: 'TraderJoe', avatar: 'TJ', content: 'Just made my first profitable trade!', likes: 12, comments: 3, timestamp: Date.now() - 3600000, likedByUser: false, tags: ['trading', 'beginner'] },
  { id: '2', userId: 'user2', userName: 'StockGuru', avatar: 'SG', content: 'Nifty 50 analysis for this week: bullish outlook.', likes: 45, comments: 8, timestamp: Date.now() - 7200000, likedByUser: true, tags: ['analysis', 'nifty'] },
];

let mockStoreState: any = {};

vi.mock('../store/communityStore', () => ({
  useCommunityStore: () => mockStoreState,
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user1', userName: 'TraderJoe', avatar: 'TJ' },
  }),
}));

import CommunityScreen from '../screens/community/CommunityScreen';

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState = {
    posts: defaultPosts,
    trendingTopics: [
      { id: 't1', topic: 'Nifty 50', posts: 234 },
      { id: 't2', topic: 'Budget 2024', posts: 189 },
    ],
    likedPostIds: [],
    bookmarkedPostIds: [],
    feedSort: 'latest',
    isRefreshing: false,
    loading: false,
    error: null,
    addPost: mockAddPost,
    likePost: mockLikePost,
    bookmarkPost: vi.fn(),
    fetchTrendingTopics: mockFetchTrending,
    fetchPosts: vi.fn(),
    setFeedSort: vi.fn(),
    refreshPosts: vi.fn(),
  };
});

describe('CommunityScreen', () => {
  it('renders the screen title', () => {
    const { getByText } = render(<CommunityScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Community')).toBeDefined();
  });

  it('renders trending topics section', () => {
    const { getByText } = render(<CommunityScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Trending Topics')).toBeDefined();
  });

  it('renders trending topic names', () => {
    const { getByText } = render(<CommunityScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('#RELIANCE')).toBeDefined();
    expect(getByText('#Budget2025')).toBeDefined();
  });

  it('renders post user names', () => {
    const { getByText } = render(<CommunityScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('TraderJoe')).toBeDefined();
    expect(getByText('StockGuru')).toBeDefined();
  });

  it('renders post content', () => {
    const { getByText } = render(<CommunityScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Just made my first profitable trade!')).toBeDefined();
  });

  it('renders post tags', () => {
    const { getByText } = render(<CommunityScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('trading')).toBeDefined();
    expect(getByText('analysis')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<CommunityScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(toJSON()).toBeTruthy();
  });
});
