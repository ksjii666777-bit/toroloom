import { api } from './client';
import type { CommunityPost, Comment } from '../../types';

export interface PaginatedPosts {
  posts: CommunityPost[];
  total: number;
  page: number;
  totalPages: number;
}

export interface UserSearchResult {
  id: string;
  name: string;
  avatar?: string;
  isVerified: boolean;
}

// Mock users for autocomplete (would come from backend in production)
const MOCK_USERS: UserSearchResult[] = [
  { id: 'u1', name: 'Priya Patel', isVerified: true },
  { id: 'u2', name: 'Arun Kumar', isVerified: true },
  { id: 'u3', name: 'Vikram Reddy', isVerified: true },
  { id: 'u4', name: 'Sneha Gupta', isVerified: false },
  { id: 'u5', name: 'Rohan Mehta', isVerified: false },
  { id: 'u6', name: 'Ananya Singh', isVerified: false },
  { id: 'u7', name: 'Karthik Nair', isVerified: false },
  { id: 'u8', name: 'Deepa Joshi', isVerified: false },
];

export const communityApi = {
  getPosts: (page = 1, limit = 10, tag?: string, sort?: 'hot' | 'new' | 'top') => {
    let path = `/community/posts?page=${page}&limit=${limit}`;
    if (tag) path += `&tag=${encodeURIComponent(tag)}`;
    if (sort) path += `&sort=${sort}`;
    return api.get<PaginatedPosts>(path);
  },

  getPost: (postId: string) =>
    api.get<CommunityPost>(`/community/posts/${postId}`),

  createPost: (content: string, tags: string[]) =>
    api.post<CommunityPost>('/community/posts', { content, tags }),

  likePost: (postId: string) =>
    api.post<{ likes: number }>(`/community/posts/${postId}/like`),

  getComments: (postId: string) =>
    api.get<Comment[]>(`/community/posts/${postId}/comments`),

  /** Search users by name for @mention autocomplete */
  searchUsers: async (query: string): Promise<UserSearchResult[]> => {
    try {
      return await api.get<UserSearchResult[]>(`/community/users/search?q=${encodeURIComponent(query)}`);
    } catch {
      // Fallback to mock users
      const lowerQuery = query.toLowerCase();
      return MOCK_USERS.filter(u => u.name.toLowerCase().includes(lowerQuery));
    }
  },
};
