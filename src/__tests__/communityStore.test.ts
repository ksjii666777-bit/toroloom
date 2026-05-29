/**
 * ============================================================================
 * Toroloom — Community Store Tests
 * ============================================================================
 *
 * Tests the community store: initial state, fetchPosts, addPost (local
 * fallback when API fails), and likePost with local increment.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCommunityStore } from '../store/communityStore';

// Mock the community API module so every call rejects, forcing the store into
// its fallback / catch behaviour.
vi.mock('../services/api/community', () => ({
  communityApi: {
    getPosts: vi.fn().mockRejectedValue(new Error('Network error')),
    createPost: vi.fn().mockRejectedValue(new Error('Network error')),
    likePost: vi.fn().mockRejectedValue(new Error('Network error')),
  },
}));

describe('CommunityStore — Initial State', () => {
  beforeEach(() => {
    useCommunityStore.setState({
      posts: [],
      isLoading: false,
      totalPages: 1,
      currentPage: 1,
    });
  });

  it('starts with empty posts when reset', () => {
    const state = useCommunityStore.getState();
    expect(state.posts).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.totalPages).toBe(1);
    expect(state.currentPage).toBe(1);
  });
});

describe('CommunityStore — fetchPosts (API failure fallback)', () => {
  beforeEach(() => {
    useCommunityStore.setState({
      posts: [],
      isLoading: false,
      totalPages: 1,
      currentPage: 1,
    });
  });

  it('sets isLoading during fetch and clears it on failure', async () => {
    const promise = useCommunityStore.getState().fetchPosts(1);
    expect(useCommunityStore.getState().isLoading).toBe(true);
    await promise;
    expect(useCommunityStore.getState().isLoading).toBe(false);
  });

  it('preserves existing posts when API fails', async () => {
    const existingPost = {
      id: 'p_existing', userId: 'u1', userName: 'Test User',
      content: 'Existing post', likes: 0, comments: 0,
      timestamp: '2025-01-01', tags: ['test'],
    };

    useCommunityStore.setState({
      posts: [existingPost],
      currentPage: 1,
      totalPages: 1,
    });

    await useCommunityStore.getState().fetchPosts(2);
    const state = useCommunityStore.getState();
    expect(state.posts).toHaveLength(1);
    expect(state.posts[0].id).toBe('p_existing');
    // totalPages and currentPage should remain unchanged on failure
    expect(state.totalPages).toBe(1);
    expect(state.currentPage).toBe(1);
  });

  it('handles fetch with tag filter', async () => {
    useCommunityStore.setState({
      posts: [{ id: 'p1', userId: 'u1', userName: 'User', content: 'Test', likes: 0, comments: 0, timestamp: '2025-01-01', tags: ['RELIANCE'] }],
    });

    await useCommunityStore.getState().fetchPosts(1, 'RELIANCE');
    const state = useCommunityStore.getState();
    expect(state.posts).toHaveLength(1);
  });
});

describe('CommunityStore — addPost', () => {
  beforeEach(() => {
    useCommunityStore.setState({
      posts: [],
      isLoading: false,
      totalPages: 1,
      currentPage: 1,
    });
  });

  it('creates a post locally when API fails', async () => {
    await useCommunityStore.getState().addPost('My new post!', ['test', 'learning']);
    const state = useCommunityStore.getState();
    expect(state.posts).toHaveLength(1);
    expect(state.posts[0].content).toBe('My new post!');
    expect(state.posts[0].tags).toEqual(['test', 'learning']);
    expect(state.posts[0].userId).toBe('user_1');
    expect(state.posts[0].userName).toBe('Rahul Sharma');
    expect(state.posts[0].likes).toBe(0);
    expect(state.posts[0].id).toMatch(/^p_\d+$/);
  });

  it('prepends new post to the beginning of the list', async () => {
    useCommunityStore.setState({
      posts: [{ id: 'p_old', userId: 'u1', userName: 'Old', content: 'Old post', likes: 0, comments: 0, timestamp: '2025-01-01', tags: [] }],
    });

    await useCommunityStore.getState().addPost('New post', ['new']);
    const state = useCommunityStore.getState();
    expect(state.posts).toHaveLength(2);
    expect(state.posts[0].content).toBe('New post');
    expect(state.posts[1].content).toBe('Old post');
  });

  it('handles empty tags', async () => {
    await useCommunityStore.getState().addPost('Just a thought', []);
    const state = useCommunityStore.getState();
    expect(state.posts).toHaveLength(1);
    expect(state.posts[0].tags).toEqual([]);
  });

  it('handles empty content gracefully', async () => {
    await expect(
      useCommunityStore.getState().addPost('', ['tag'])
    ).resolves.not.toThrow();
    const state = useCommunityStore.getState();
    expect(state.posts).toHaveLength(1);
    expect(state.posts[0].content).toBe('');
  });
});

describe('CommunityStore — likePost', () => {
  const basePosts = [
    { id: 'p1', userId: 'u1', userName: 'Alice', content: 'Post 1', likes: 5, comments: 2, timestamp: '2025-01-01', tags: ['a'] },
    { id: 'p2', userId: 'u2', userName: 'Bob', content: 'Post 2', likes: 10, comments: 3, timestamp: '2025-01-02', tags: ['b'] },
  ];

  beforeEach(() => {
    useCommunityStore.setState({
      posts: basePosts,
      isLoading: false,
      totalPages: 1,
      currentPage: 1,
    });
  });

  it('increments likes on the target post', async () => {
    await useCommunityStore.getState().likePost('p1');
    const state = useCommunityStore.getState();
    const liked = state.posts.find(p => p.id === 'p1');
    expect(liked?.likes).toBe(6);
  });

  it('does not affect other posts', async () => {
    await useCommunityStore.getState().likePost('p1');
    const state = useCommunityStore.getState();
    const unchanged = state.posts.find(p => p.id === 'p2');
    expect(unchanged?.likes).toBe(10);
  });

  it('handles liking a non-existent post gracefully', async () => {
    await expect(
      useCommunityStore.getState().likePost('non_existent')
    ).resolves.not.toThrow();
    expect(useCommunityStore.getState().posts).toHaveLength(2);
  });

  it('can like the same post multiple times', async () => {
    await useCommunityStore.getState().likePost('p1');
    await useCommunityStore.getState().likePost('p1');
    await useCommunityStore.getState().likePost('p1');
    const state = useCommunityStore.getState();
    expect(state.posts.find(p => p.id === 'p1')?.likes).toBe(8); // 5 + 3
  });
});
