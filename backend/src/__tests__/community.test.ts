/**
 * ============================================================================
 * Toroloom — Community Service Unit Tests
 * ============================================================================
 *
 * Tests the community post service with InMemoryStorage backend:
 *   1. Mock data (no storage) — getPosts, getPost, createPost, likePost
 *   2. Storage-backed — configureCommunityPersistence, migration, CRUD
 *   3. Reset service — clears state for testing
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/community.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryStorage } from '../services/storage/inMemory';
import {
  configureCommunityPersistence,
  getPosts,
  getPost,
  createPost,
  likePost,
  resetCommunityService,
  getCommunityStorage,
} from '../services/community';
import type { CommunityPostData } from '../services/storage/types';

describe('Community Service', () => {
  beforeEach(() => {
    resetCommunityService();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Mock Data (No Storage)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Mock Data (No Storage)', () => {
    it('should start with no storage configured', () => {
      expect(getCommunityStorage()).toBeNull();
    });

    it('should return mock posts when no storage is configured', async () => {
      const posts = await getPosts();
      expect(posts.length).toBeGreaterThan(0);
      expect(posts[0]).toHaveProperty('id');
      expect(posts[0]).toHaveProperty('content');
      expect(posts[0]).toHaveProperty('likes');
    });

    it('should sort mock posts by timestamp descending', async () => {
      const posts = await getPosts();
      for (let i = 1; i < posts.length; i++) {
        expect(posts[i - 1].timestamp >= posts[i].timestamp).toBe(true);
      }
    });

    it('should get a single post by id', async () => {
      const post = await getPost('p1');
      expect(post).not.toBeNull();
      expect(post!.id).toBe('p1');
    });

    it('should return null for non-existent post id', async () => {
      const post = await getPost('non_existent');
      expect(post).toBeNull();
    });

    it('should create a new post and prepend it to mock list', async () => {
      const newPost = await createPost('new_id', 'user_1', 'Test User', 'Hello world', ['test']);
      expect(newPost.id).toBe('new_id');
      expect(newPost.content).toBe('Hello world');
      expect(newPost.likes).toBe(0);
      expect(newPost.comments).toBe(0);

      // Should appear first in getPosts
      const posts = await getPosts();
      expect(posts[0].id).toBe('new_id');
    });

    it('should like a post and return updated count', async () => {
      const original = await getPost('p1');
      const originalLikes = original!.likes;

      const newCount = await likePost('p1');
      expect(newCount).toBe(originalLikes + 1);

      const updated = await getPost('p1');
      expect(updated!.likes).toBe(originalLikes + 1);
    });

    it('should return 0 when liking non-existent post', async () => {
      const count = await likePost('ghost_post');
      expect(count).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Storage-Backed Operations
  // ─────────────────────────────────────────────────────────────────────────

  describe('Storage-Backed Operations', () => {
    let storage: InMemoryStorage;

    beforeEach(() => {
      storage = new InMemoryStorage();
    });

    afterEach(() => {
      resetCommunityService();
    });

    it('should configure storage and migrate mock data', async () => {
      await configureCommunityPersistence(storage);
      expect(getCommunityStorage()).toBe(storage);

      const posts = await storage.loadCommunityPosts();
      expect(posts.length).toBeGreaterThan(0);
    });

    it('should not migrate mock data again on repeated configure', async () => {
      // Configure once — migrates 10 mock posts
      await configureCommunityPersistence(storage);
      const countAfterFirst = (await storage.loadCommunityPosts()).length;

      // Re-configure with fresh storage — should NOT migrate again
      const storage2 = new InMemoryStorage();
      await configureCommunityPersistence(storage2);
      const countAfterSecond = (await storage2.loadCommunityPosts()).length;

      // Second storage should have 0 because mockInitialized=true prevents re-migration
      expect(countAfterSecond).toBe(0);
    });

    it('should get posts from storage when configured', async () => {
      await configureCommunityPersistence(storage);
      const posts = await getPosts();

      expect(posts.length).toBeGreaterThan(0);
      // Should be sorted descending by timestamp
      for (let i = 1; i < posts.length; i++) {
        expect(posts[i - 1].timestamp >= posts[i].timestamp).toBe(true);
      }
    });

    it('should get a single post from storage', async () => {
      await configureCommunityPersistence(storage);

      // Get first post to know its id
      const posts = await getPosts();
      const firstId = posts[0].id;

      const post = await getPost(firstId);
      expect(post).not.toBeNull();
      expect(post!.id).toBe(firstId);
    });

    it('should create and persist a post', async () => {
      await configureCommunityPersistence(storage);

      const post = await createPost('custom_1', 'user_new', 'New User', 'My custom post', ['custom']);
      expect(post.id).toBe('custom_1');

      // Verify it's in storage
      const fromStorage = await storage.loadCommunityPost('custom_1');
      expect(fromStorage).not.toBeNull();
      expect(fromStorage!.content).toBe('My custom post');

      // Verify it appears in getPosts (most recent first)
      const allPosts = await getPosts();
      expect(allPosts[0].id).toBe('custom_1');
    });

    it('should like a post and persist the updated count', async () => {
      await configureCommunityPersistence(storage);

      const posts = await getPosts();
      const targetId = posts[0].id;
      const originalLikes = posts[0].likes;

      const newCount = await likePost(targetId);
      expect(newCount).toBe(originalLikes + 1);

      // Verify persistence
      const fromStorage = await storage.loadCommunityPost(targetId);
      expect(fromStorage!.likes).toBe(originalLikes + 1);
    });

    it('should store metadata on posts (userName, userAvatar, tags)', async () => {
      await configureCommunityPersistence(storage);

      const posts = await getPosts();
      const post = posts[0];

      expect(post.userName).toBeDefined();
      expect(post.tags).toBeInstanceOf(Array);
      expect(post.tags.length).toBeGreaterThan(0);
      expect(post.userId).toBeDefined();
      expect(post.timestamp).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Reset Service
  // ─────────────────────────────────────────────────────────────────────────

  describe('Reset Service', () => {
    it('should clear storage reference and restore fallback mock data on reset', async () => {
      const storage = new InMemoryStorage();
      await configureCommunityPersistence(storage);
      expect(getCommunityStorage()).not.toBeNull();

      resetCommunityService();

      // Storage reference cleared
      expect(getCommunityStorage()).toBeNull();
      // Fallback mock data restored (10 default posts)
      const posts = await getPosts();
      expect(posts.length).toBe(10);
      expect(posts[0]).toHaveProperty('id');
      expect(posts[0]).toHaveProperty('content');
    });

    it('should allow re-initialization after reset', async () => {
      const storage = new InMemoryStorage();
      await configureCommunityPersistence(storage);
      resetCommunityService();

      // Re-configure — should migrate mock data again
      await configureCommunityPersistence(storage);
      const posts = await getPosts();
      expect(posts.length).toBeGreaterThan(0);
    });
  });
});
