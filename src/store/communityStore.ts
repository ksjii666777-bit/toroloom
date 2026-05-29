import { create } from 'zustand';
import { CommunityPost } from '../types';
import { mockPosts } from '../constants/mockData';
import { communityApi } from '../services/api';

interface CommunityState {
  posts: CommunityPost[];
  isLoading: boolean;
  totalPages: number;
  currentPage: number;
  fetchPosts: (page?: number, tag?: string) => Promise<void>;
  addPost: (content: string, tags: string[]) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: mockPosts,
  isLoading: false,
  totalPages: 1,
  currentPage: 1,

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
    } catch {
      // Backend unavailable — keep existing mock data
      set({ isLoading: false });
    }
  },

  addPost: async (content, tags) => {
    try {
      const created = await communityApi.createPost(content, tags);
      set(state => ({
        posts: [created, ...state.posts],
      }));
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
  },

  likePost: async (postId) => {
    try {
      await communityApi.likePost(postId);
    } catch {
      // Backend unavailable — execute locally
    }

    set(state => ({
      posts: state.posts.map(p =>
        p.id === postId ? { ...p, likes: p.likes + 1 } : p
      ),
    }));
  },
}));
