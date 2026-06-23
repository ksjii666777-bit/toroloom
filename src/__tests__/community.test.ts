/**
 * ============================================================================
 * Toroloom — Community API Tests
 * ============================================================================
 *
 * Tests the communityApi module: getPosts, getPost, createPost, likePost,
 * getComments. Each test mocks globalThis.fetch to verify correct URL
 * construction, HTTP methods, and request bodies.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.unmock('../services/api/community');

import { configureApi } from '../services/api/client';
import { communityApi } from '../services/api/community';
import type { Mock } from 'vitest';

import { TEST_API_BASE as API_BASE } from './testConfig';
const originalFetch = globalThis.fetch;

// ============================================================================
// communityApi — getPosts
// ============================================================================

describe('communityApi — getPosts', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /community/posts with page and limit defaults', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockResponse = { posts: [], total: 0, page: 1, totalPages: 0 };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockResponse) };
    });

    const result = await communityApi.getPosts();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/community/posts?page=1&limit=10`);
    expect(result).toEqual(mockResponse);
  });

  it('sends GET with custom page and limit', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve({ posts: [], total: 0, page: 2, totalPages: 5 }) };
    });

    await communityApi.getPosts(2, 20);
    expect(capturedUrl).toBe(`${API_BASE}/community/posts?page=2&limit=20`);
  });

  it('sends GET with tag filter', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve({ posts: [], total: 0, page: 1, totalPages: 0 }) };
    });

    await communityApi.getPosts(1, 10, 'investing');
    expect(capturedUrl).toBe(`${API_BASE}/community/posts?page=1&limit=10&tag=investing`);
  });

  it('encodes special characters in tag', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve({ posts: [], total: 0, page: 1, totalPages: 0 }) };
    });

    await communityApi.getPosts(1, 10, 'tech & finance');
    expect(capturedUrl).toContain('&tag=tech%20%26%20finance');
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve({ posts: [], total: 0, page: 1, totalPages: 0 }) };
    });

    await communityApi.getPosts();
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to fetch posts' }),
    });
    await expect(communityApi.getPosts()).rejects.toThrow('Failed to fetch posts');
  });

  it('returns paginated response on success', async () => {
    const mockPosts = {
      posts: [{ id: 'p1', userId: 'u1', userName: 'Trader1', content: 'Great day!', likes: 5, comments: 2, timestamp: '2025-06-01T00:00:00Z', tags: ['trading'] }],
      total: 1, page: 1, totalPages: 1,
    };
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(mockPosts),
    });

    const result = await communityApi.getPosts();
    expect(result.posts).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

// ============================================================================
// communityApi — getPost
// ============================================================================

describe('communityApi — getPost', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /community/posts/{postId}', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockPost = { id: 'p1', userId: 'u1', userName: 'Trader1', content: 'Post content', likes: 3, comments: 1, timestamp: '2025-06-01T00:00:00Z', tags: ['finance'] };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockPost) };
    });

    const result = await communityApi.getPost('p1');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/community/posts/p1`);
    expect(result).toEqual(mockPost);
  });

  it('throws on 404', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Post not found' }),
    });
    await expect(communityApi.getPost('invalid')).rejects.toThrow('Post not found');
  });
});

// ============================================================================
// communityApi — createPost
// ============================================================================

describe('communityApi — createPost', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /community/posts with content and tags', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    const mockPost = { id: 'p_new', userId: 'u1', userName: 'Trader1', content: 'Hello!', likes: 0, comments: 0, timestamp: '2025-06-01T00:00:00Z', tags: ['introduction'] };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockPost) };
    });

    const result = await communityApi.createPost('Hello!', ['introduction']);

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/community/posts`);
    expect(JSON.parse(capturedBody)).toEqual({ content: 'Hello!', tags: ['introduction'] });
    expect(result).toEqual(mockPost);
  });

  it('handles empty tags array', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ id: 'p2', userId: 'u1', userName: 'Trader1', content: 'No tags', likes: 0, comments: 0, timestamp: '2025-06-01T00:00:00Z', tags: [] }) };
    });

    await communityApi.createPost('No tags', []);
    expect(JSON.parse(capturedBody)).toEqual({ content: 'No tags', tags: [] });
  });

  it('throws on validation error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 400, json: () => Promise.resolve({ error: 'Content is required' }),
    });
    await expect(communityApi.createPost('', [])).rejects.toThrow('Content is required');
  });
});

// ============================================================================
// communityApi — likePost
// ============================================================================

describe('communityApi — likePost', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /community/posts/{postId}/like', async () => {
    let capturedUrl = '', capturedMethod = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve({ likes: 6 }) };
    });

    const result = await communityApi.likePost('p1');

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/community/posts/p1/like`);
    expect(result).toEqual({ likes: 6 });
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to like post' }),
    });
    await expect(communityApi.likePost('p1')).rejects.toThrow('Failed to like post');
  });
});

// ============================================================================
// communityApi — getComments
// ============================================================================

describe('communityApi — getComments', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /community/posts/{postId}/comments', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockComments = [
      { id: 'c1', postId: 'p1', userId: 'u2', userName: 'Analyst1', content: 'Great point!', timestamp: '2025-06-01T00:00:00Z' },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockComments) };
    });

    const result = await communityApi.getComments('p1');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/community/posts/p1/comments`);
    expect(result).toEqual(mockComments);
  });

  it('returns empty array for post with no comments', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await communityApi.getComments('p1');
    expect(result).toEqual([]);
  });

  it('throws on 404', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Post not found' }),
    });
    await expect(communityApi.getComments('invalid')).rejects.toThrow('Post not found');
  });
});
