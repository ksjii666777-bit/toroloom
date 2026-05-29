/**
 * ============================================================================
 * Toroloom — API Client Tests
 * ============================================================================
 *
 * Tests the client.ts utility functions: configureApi, getBaseUrl,
 * ApiError class, isNetworkError, and withFallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Need to import after mocks are set up
import { configureApi, getBaseUrl, api, ApiError } from '../services/api/client';

describe('ApiClient — configureApi / getBaseUrl', () => {
  beforeEach(() => {
    // Reset to defaults
    configureApi({ baseUrl: 'http://localhost:3000/api' });
  });

  it('uses default base URL', () => {
    expect(getBaseUrl()).toBe('http://localhost:3000/api');
  });

  it('allows overriding base URL', () => {
    configureApi({ baseUrl: 'https://api.example.com/v1' });
    expect(getBaseUrl()).toBe('https://api.example.com/v1');
  });

  it('allows setting token getter', () => {
    let token = 'test-token';
    configureApi({ getToken: () => token });
    // Token is used internally in requests
    configureApi({ getToken: () => token });
  });
});

describe('ApiClient — ApiError', () => {
  it('creates error with status and message from body string', () => {
    const err = new ApiError(400, 'Bad request');
    expect(err.status).toBe(400);
    expect(err.message).toBe('Bad request');
    expect(err.body).toBe('Bad request');
  });

  it('creates error with status and message from body object error field', () => {
    const err = new ApiError(401, { error: 'Unauthorized' });
    expect(err.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
  });

  it('creates error with status and message from body object message field', () => {
    const err = new ApiError(500, { message: 'Server error' });
    expect(err.status).toBe(500);
    expect(err.message).toBe('Server error');
  });

  it('falls back to HTTP status text for unknown body shape', () => {
    const err = new ApiError(404, { foo: 'bar' });
    expect(err.status).toBe(404);
    expect(err.message).toBe('HTTP 404');
  });

  it('is an instance of Error', () => {
    const err = new ApiError(400, 'test');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ApiClient — isNetworkError', () => {
  it('returns true for TypeError with Failed to fetch', () => {
    const err = new TypeError('Failed to fetch');
    expect(api.isNetworkError(err)).toBe(true);
  });

  it('returns false for ApiError', () => {
    const err = new ApiError(500, 'Server error');
    expect(api.isNetworkError(err)).toBe(false);
  });

  it('returns false for generic Error', () => {
    const err = new Error('Something went wrong');
    expect(api.isNetworkError(err)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(api.isNetworkError(null)).toBe(false);
    expect(api.isNetworkError(undefined)).toBe(false);
  });
});

describe('ApiClient — withFallback', () => {
  it('returns success value when call succeeds', async () => {
    const result = await api.withFallback(
      () => Promise.resolve(42),
      0,
    );
    expect(result).toBe(42);
  });

  it('returns fallback value when call fails', async () => {
    const result = await api.withFallback(
      () => Promise.reject(new Error('fail')),
      'fallback',
    );
    expect(result).toBe('fallback');
  });

  it('returns fallback when call throws', async () => {
    const result = await api.withFallback(
      () => { throw new Error('crash'); },
      'default',
    );
    expect(result).toBe('default');
  });
});

describe('ApiClient — HTTP method helpers', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    configureApi({ baseUrl: 'http://localhost:3000/api' });
    // Mock fetch globally
    globalThis.fetch = vi.fn();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('api.get makes GET request', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const result = await api.get('/test');
    expect(result).toEqual({ data: 'test' });
  });

  it('api.post makes POST request with body', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 1 }),
    });

    const result = await api.post('/test', { name: 'test' });
    expect(result).toEqual({ id: 1 });
  });

  it('api.put makes PUT request', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ updated: true }),
    });

    const result = await api.put('/test/1', { name: 'updated' });
    expect(result).toEqual({ updated: true });
  });

  it('api.delete makes DELETE request', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    });

    const result = await api.delete('/test/1');
    expect(result).toBeUndefined();
  });

  it('throws ApiError on non-ok response', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(api.get('/secure')).rejects.toThrow('Unauthorized');
  });

  it('attaches auth token when available', async () => {
    let capturedHeaders: any = null;
    let capturedUrl: string = '';

    configureApi({ getToken: () => 'bearer-token' });

    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedHeaders = opts.headers;
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      };
    });

    await api.get('/secure');
    expect(capturedHeaders['Authorization']).toBe('Bearer bearer-token');
  });
});
