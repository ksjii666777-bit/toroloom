/**
 * ============================================================================
 * Toroloom — API Client Tests
 * ============================================================================
 *
 * Tests the client.ts utility functions: configureApi, getBaseUrl,
 * ApiError class, isNetworkError, withFallback, and HTTP method helpers
 * with edge cases for skipAuth, 204 responses, and JSON parse failures.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

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

  it('allows overriding only baseUrl without affecting token', () => {
    configureApi({ getToken: () => 'existing-token' });
    configureApi({ baseUrl: 'https://new-url.com/api' });
    expect(getBaseUrl()).toBe('https://new-url.com/api');
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

  it('prefers error field over message field in body', () => {
    const err = new ApiError(400, { error: 'Auth failed', message: 'Bad request' });
    expect(err.message).toBe('Auth failed');
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

  it('returns false for TypeError with non-network message', () => {
    const err = new TypeError('Some other type error');
    expect(api.isNetworkError(err)).toBe(false);
  });

  it('returns false for plain objects', () => {
    expect(api.isNetworkError({ code: 'ECONNREFUSED' })).toBe(false);
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

  it('returns null fallback when call fails with null as fallback', async () => {
    const result = await api.withFallback(
      () => Promise.reject(new Error('fail')),
      null,
    );
    expect(result).toBeNull();
  });
});

describe('ApiClient — HTTP method helpers', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    configureApi({ baseUrl: 'http://localhost:3000/api', getToken: () => null });
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

    configureApi({ getToken: () => 'bearer-token' });

    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
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

  it('does NOT attach auth token when skipAuth is true', async () => {
    let capturedHeaders: any = null;

    configureApi({ getToken: () => 'bearer-token' });

    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      };
    });

    await api.get('/public', { skipAuth: true });
    expect(capturedHeaders['Authorization']).toBeUndefined();
  });

  it('does not attach token when getToken returns null', async () => {
    let capturedHeaders: any = null;

    configureApi({ getToken: () => null });

    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      };
    });

    await api.get('/no-auth');
    expect(capturedHeaders['Authorization']).toBeUndefined();
  });

  it('returns undefined for 204 No Content response', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('No content')),
    });

    // 204 short-circuits json parsing
    const result = await api.delete('/resource/1');
    expect(result).toBeUndefined();
  });

  it('throws ApiError when JSON parse fails on error response', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    await expect(api.get('/bad-gateway')).rejects.toThrow('HTTP 502');
  });

  it('uses correct HTTP method GET', async () => {
    let capturedMethod = '';
    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve({}) };
    });

    await api.get('/items');
    expect(capturedMethod).toBe('GET');
  });

  it('uses correct HTTP method POST', async () => {
    let capturedMethod = '';
    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve({}) };
    });

    await api.post('/items', { x: 1 });
    expect(capturedMethod).toBe('POST');
  });

  it('uses correct HTTP method PUT', async () => {
    let capturedMethod = '';
    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve({}) };
    });

    await api.put('/items/1', { x: 2 });
    expect(capturedMethod).toBe('PUT');
  });

  it('uses correct HTTP method DELETE', async () => {
    let capturedMethod = '';
    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      capturedMethod = opts.method;
      return { ok: true, status: 204, json: () => Promise.resolve(null) };
    });

    await api.delete('/items/1');
    expect(capturedMethod).toBe('DELETE');
  });

  it('sends request body as JSON string for POST', async () => {
    let capturedBody = '';
    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({}) };
    });

    await api.post('/items', { name: 'test', value: 42 });
    expect(JSON.parse(capturedBody)).toEqual({ name: 'test', value: 42 });
  });

  it('sends no body for GET and DELETE', async () => {
    let capturedBody: any = 'not_undefined';
    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({}) };
    });

    await api.get('/items');
    expect(capturedBody).toBeUndefined();

    await api.delete('/items/1');
    expect(capturedBody).toBeUndefined();
  });

  it('constructs correct URL from baseUrl and path', async () => {
    let capturedUrl = '';
    (globalThis.fetch as any).mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve({}) };
    });

    await api.get('/test-path');
    expect(capturedUrl).toBe('http://localhost:3000/api/test-path');
  });

  it('sets Content-Type to application/json', async () => {
    let capturedHeaders: any = null;
    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve({}) };
    });

    await api.get('/items');
    expect(capturedHeaders['Content-Type']).toBe('application/json');
  });
});
