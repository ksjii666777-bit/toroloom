import { create } from 'zustand';
import { CommunityPost, Comment } from '../types';
import { mockPosts } from '../constants/mockData';
import { communityApi } from '../services/api/community';
import { offlineCache } from '../services/offlineCache';
import { registerCacheWarming } from '../services/cacheWarmingService';
import { log } from '../utils/logger';

export type FeedSort = 'hot' | 'new' | 'top';

interface CommunityState {
  posts: CommunityPost[];
  comments: Record<string, Comment[]>;
  isLoading: boolean;
  isRefreshing: boolean;
  totalPages: number;
  currentPage: number;
  feedSort: FeedSort;
  bookmarkedPostIds: string[];
  likedPostIds: string[];
  
  fetchPosts: (page?: number, tag?: string) => Promise<void>;
  refreshPosts: () => Promise<void>;
  addPost: (content: string, tags: string[]) => Promise<void>;
  /** Load cached community posts at app startup for instant display */
  loadCachedCommunity: () => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  bookmarkPost: (postId: string) => void;
  setFeedSort: (sort: FeedSort) => void;
  fetchComments: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: mockPosts,
  comments: {},
  isLoading: false,
  isRefreshing: false,
  totalPages: 1,
  currentPage: 1,
  feedSort: 'hot',
  bookmarkedPostIds: ['p1', 'p3'],
  likedPostIds: ['p1', 'p4'],

  fetchPosts: async (page = 1, tag?: string) => {
    set({ isLoading: true });
    try {
      const data = await communityApi.getPosts(page, 10, tag);
      set({
        posts: data.posts,
        totalPages: data.totalPages,
        currentPage: data.page,
        isLoading: false,
      });
      // Cache on successful fetch
      await offlineCache.save('community', { posts: get().posts, totalPages: data.totalPages });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<{ posts: CommunityPost[]; totalPages: number }>('community');
      if (cached) {
        set({ posts: cached.data.posts, totalPages: cached.data.totalPages, isLoading: false });
        log.info('[Community] Serving stale cached posts');
        return;
      }
      // Keep existing data
      set({ isLoading: false });
    }
  },

  refreshPosts: async () => {
    set({ isRefreshing: true });
    try {
      const data = await communityApi.getPosts(1, 10);
      set({
        posts: data.posts,
        totalPages: data.totalPages,
        currentPage: 1,
        isRefreshing: false,
      });
      // Cache on successful fetch
      await offlineCache.save('community', { posts: get().posts, totalPages: data.totalPages });
    } catch {
      // Backend unavailable — sort mock data
      const { feedSort } = get();
      const sorted = [...mockPosts];
      if (feedSort === 'top') {
        sorted.sort((a, b) => b.likes - a.likes);
      } else if (feedSort === 'new') {
        sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } else {
        // hot: mix of recency + likes
        sorted.sort((a, b) => (b.likes * 0.6 + b.comments * 0.4) - (a.likes * 0.6 + a.comments * 0.4));
      }
      set({ posts: sorted, isRefreshing: false });
    }
  },

  addPost: async (content, tags) => {
    try {
      const created = await communityApi.createPost(content, tags);
      set(state => ({
        posts: [created, ...state.posts],
      }));
      // Cache after mutation
      await offlineCache.save('community', { posts: get().posts, totalPages: get().totalPages });
      return;
    } catch {
      // Backend unavailable — create locally
    }

    set(state => ({
      posts: [{
        id: `p_${Date.now()}`,
        userId: 'user_1',
        userName: 'Rahul Sharma',
        content,
        likes: 0,
        comments: 0,
        timestamp: new Date().toISOString(),
        tags,
      }, ...state.posts],
    }));
    // Cache after local mutation
    await offlineCache.save('community', { posts: get().posts, totalPages: get().totalPages });
  },

  likePost: async (postId) => {
    const { likedPostIds } = get();
    const isLiked = likedPostIds.includes(postId);

    try {
      await communityApi.likePost(postId);
    } catch {
      // Backend unavailable — execute locally
    }

    // Toggle liked state: increment when liking, decrement when unliking
    set(state => ({
      posts: state.posts.map(p =>
        p.id === postId ? { ...p, likes: Math.max(0, p.likes + (isLiked ? -1 : 1)) } : p
      ),
      likedPostIds: isLiked
        ? state.likedPostIds.filter(id => id !== postId)
        : [...state.likedPostIds, postId],
    }));
    // Cache after mutation
    await offlineCache.save('community', { posts: get().posts, totalPages: get().totalPages });
  },

  bookmarkPost: async (postId) => {
    set(state => ({
      bookmarkedPostIds: state.bookmarkedPostIds.includes(postId)
        ? state.bookmarkedPostIds.filter(id => id !== postId)
        : [...state.bookmarkedPostIds, postId],
    }));
    // Cache after local mutation
    await offlineCache.save('community', { posts: get().posts, totalPages: get().totalPages });
  },

  setFeedSort: (sort) => {
    set({ feedSort: sort });
    // Re-sort posts based on the selected sort
    const { posts } = get();
    const sorted = [...posts];
    if (sort === 'top') {
      sorted.sort((a, b) => b.likes - a.likes);
    } else if (sort === 'new') {
      sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else {
      // hot: mix of recency + engagement
      sorted.sort((a, b) => (b.likes * 0.6 + b.comments * 0.4) - (a.likes * 0.6 + a.comments * 0.4));
    }
    set({ posts: sorted });
  },

  fetchComments: async (postId) => {
    try {
      const comments = await communityApi.getComments(postId);
      set(state => ({
        comments: { ...state.comments, [postId]: comments },
      }));
    } catch {
      // Generate mock comments
      const mockComments: Comment[] = [
        { id: `c_${postId}_1`, postId, userId: 'u2', userName: 'Priya Patel', content: 'Great insight! Thanks for sharing your analysis.', timestamp: new Date(Date.now() - 3600000).toISOString() },
        { id: `c_${postId}_2`, postId, userId: 'u3', userName: 'Arun Kumar', content: 'I agree with this. The technical setup looks promising.', timestamp: new Date(Date.now() - 7200000).toISOString() },
        { id: `c_${postId}_3`, postId, userId: 'u5', userName: 'Vikram Reddy', content: 'Adding this to my watchlist. Thanks for the tip! 🔥', timestamp: new Date(Date.now() - 10800000).toISOString() },
      ];
      set(state => ({
        comments: { ...state.comments, [postId]: mockComments },
      }));
    }
  },

  loadCachedCommunity: async () => {
    const cached = await offlineCache.load<{ posts: CommunityPost[]; totalPages: number }>('community');
    if (cached) {
      set({ posts: cached.data.posts, totalPages: cached.data.totalPages });
    }
  },

  addComment: async (postId, content) => {
    const newComment: Comment = {
      id: `c_${postId}_${Date.now()}`,
      postId,
      userId: 'user_1',
      userName: 'Rahul Sharma',
      content,
      timestamp: new Date().toISOString(),
    };

    set(state => ({
      comments: {
        ...state.comments,
        [postId]: [...(state.comments[postId] || []), newComment],
      },
      posts: state.posts.map(p =>
        p.id === postId ? { ...p, comments: p.comments + 1 } : p
      ),
    }));
  },
}));

// Register for cache warming (priority 4 — stable content)
registerCacheWarming('community', () => useCommunityStore.getState().fetchPosts(), 4);
