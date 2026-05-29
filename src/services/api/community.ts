import { api } from './client';
import type { CommunityPost, Comment } from '../../types';

export interface PaginatedPosts {
  posts: CommunityPost[];
  total: number;
  page: number;
  totalPages: number;
}

export const communityApi = {
  getPosts: (page = 1, limit = 10, tag?: string) => {
    let path = `/community/posts?page=${page}&limit=${limit}`;
    if (tag) path += `&tag=${encodeURIComponent(tag)}`;
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
};
