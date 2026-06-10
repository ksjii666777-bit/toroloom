/**
 * ============================================================================
 * Toroloom Community Persistence — MongoDB Integration
 * ============================================================================
 *
 * Validates the full community post lifecycle against a real MongoDB
 * database, following the brokerFactoryFlow pattern:
 *
 *   1. configureCommunityPersistence() — wire storage into the module
 *   2. createPost() / getPosts() — business logic persists to DB
 *   3. Direct storage read — verify data was persisted
 *
 * Environment:
 *   MONGODB_URI      — defaults to Docker Compose connection string
 *   MONGODB_DB_NAME  — defaults to 'toroloom_test'
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/communityPersistence.mongodb.int.test.ts
 *
 * Skip:
 *   Tests skip automatically if MongoDB is unreachable.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoDBStorage } from '../services/storage/mongodb';
import { CONNECT_TIMEOUT } from './testUtils';
import {
  configureCommunityPersistence,
  getPosts,
  getPost,
  createPost,
  likePost,
  resetCommunityService,
} from '../services/community';
import type { CommunityPostData } from '../services/storage/types';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://toroloom:toroloom_dev@localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'toroloom_test';

describe('Community Persistence — MongoDB', () => {
  let storage: MongoDBStorage;
  let available = true;

  beforeAll(async () => {
    storage = new MongoDBStorage(MONGODB_URI, MONGODB_DB_NAME);
    try {
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`connect timeout (${CONNECT_TIMEOUT}ms)`)), CONNECT_TIMEOUT),
        ),
      ]);
    } catch (err: any) {
      console.warn(
        `⚠ MongoDB not available (${err.message}) — skipping Community Persistence + Mongo tests`,
      );
      available = false;
    }
  }, 10_000);

  afterAll(async () => {
    if (available && storage) {
      await storage.clearForTesting();
      await storage.disconnect();
    }
  });

  beforeEach(async () => {
    if (!available) return;
    await storage.clearForTesting();
    resetCommunityService();
  });

  // ──────────────── 1. Configure + Empty Posts ────────────────

  it('should return an empty list when no posts exist', async () => {
    if (!available) return;

    await configureCommunityPersistence(storage);
    const posts = await getPosts();
    expect(posts).toHaveLength(0);
  });

  // ──────────────── 2. Create + Load Post ────────────────

  it('should create a community post and persist it to the database', async () => {
    if (!available) return;

    await configureCommunityPersistence(storage);

    const created = await createPost(
      'post-test-001',
      'user_a',
      'Alice',
      'Test post content!',
      ['test', 'hello'],
    );

    expect(created.id).toBe('post-test-001');
    expect(created.content).toBe('Test post content!');
    expect(created.likes).toBe(0);
    expect(created.tags).toEqual(['test', 'hello']);

    // Verify via business logic
    const posts = await getPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('post-test-001');

    // Verify directly in the database
    const direct = await storage.loadCommunityPost('post-test-001');
    expect(direct).not.toBeNull();
    expect(direct!.userId).toBe('user_a');
  });

  // ──────────────── 3. Get Single Post ────────────────

  it('should load a single post by ID', async () => {
    if (!available) return;

    await configureCommunityPersistence(storage);

    await createPost('post-single-001', 'user_b', 'Bob', 'Single post', ['test']);

    const loaded = await getPost('post-single-001');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('post-single-001');
    expect(loaded!.userName).toBe('Bob');

    // Non-existent post
    const missing = await getPost('non-existent');
    expect(missing).toBeNull();
  });

  // ──────────────── 4. Like a Post ────────────────

  it('should increment like count on a post and persist it', async () => {
    if (!available) return;

    await configureCommunityPersistence(storage);

    await createPost('post-like-001', 'user_c', 'Charlie', 'Like me!', []);
    expect(await likePost('post-like-001')).toBe(1);
    expect(await likePost('post-like-001')).toBe(2);
    expect(await likePost('post-like-001')).toBe(3);

    // Verify directly in database
    const direct = await storage.loadCommunityPost('post-like-001');
    expect(direct!.likes).toBe(3);
  });

  // ──────────────── 5. Posts Ordered Most Recent First ────────────────

  it('should return posts in reverse chronological order', async () => {
    if (!available) return;

    await configureCommunityPersistence(storage);

    await createPost('post-ord-1', 'user_d', 'D', 'Oldest post', []);
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await createPost('post-ord-2', 'user_d', 'D', 'Middle post', []);
    await new Promise((r) => setTimeout(r, 10));
    await createPost('post-ord-3', 'user_d', 'D', 'Newest post', []);

    const posts = await getPosts();
    expect(posts).toHaveLength(3);
    expect(posts[0].id).toBe('post-ord-3'); // Newest first
    expect(posts[1].id).toBe('post-ord-2');
    expect(posts[2].id).toBe('post-ord-1'); // Oldest last
  });

  // ──────────────── 6. Multiple Users' Posts ────────────────

  it('should return all posts regardless of which user created them', async () => {
    if (!available) return;

    await configureCommunityPersistence(storage);

    await createPost('post-mu-1', 'user_x', 'Xavier', 'Post by X', []);
    await createPost('post-mu-2', 'user_y', 'Yara', 'Post by Y', []);
    await createPost('post-mu-3', 'user_z', 'Zara', 'Post by Z', []);

    const posts = await getPosts();
    expect(posts).toHaveLength(3);
  });

  // ──────────────── 7. Delete Post ────────────────

  it('should delete a post and no longer return it', async () => {
    if (!available) return;

    await configureCommunityPersistence(storage);

    await createPost('post-del-1', 'user_del', 'Delete', 'Delete me', []);

    // Confirm it exists
    expect(await getPosts()).toHaveLength(1);

    await storage.deleteCommunityPost('post-del-1');

    // Verify gone
    expect(await getPosts()).toHaveLength(0);
    expect(await getPost('post-del-1')).toBeNull();
  });
});
