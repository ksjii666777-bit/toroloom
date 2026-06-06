/**
 * ============================================================================
 * Toroloom — API Client Tests
 * ============================================================================
 *
 * Tests the core API client module:
 *   - api.get, api.post, api.put, api.delete
 *   - api.isNetworkError
 *   - api.withFallback
 *   - ApiError class
 *   - configureApi / getBaseUrl
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== Imports ====================

import { api, configureApi, getBaseUrl, ApiError } from '../services/api/client';

// ==================== Tests ====================

describe('ApiClient — configureApi / getBaseUrl', () => {
  beforeEach(() => {
    // Reset base URL
    configureApi({ baseUrl: 'http://localhost:3000/api' });
  });

  it('getBaseUrl returns default base URL', () => {
    expect(getBaseUrl()).toBe('http://localhost:3000/api');
  });

  it('configureApi updates the base URL', () => {
    configureApi({ baseUrl: 'http://custom:4000/api' });
    expect(getBaseUrl()).toBe('http://custom:4000/api');
  });

  it('configureApi sets token getter', () => {
    const getToken = vi.fn(() => 'test-token');
    configureApi({ getToken });
    // Just verify it doesn't throw
    expect(getToken()).toBe('test-token');
  });
});

describe('ApiClient — isNetworkError', () => {
  it('returns true for TypeError with Failed to fetch message', () => {
    const err = new TypeError('Failed to fetch');
    expect(api.isNetworkError(err)).toBe(true);
  });

  it('returns false for ApiError', () => {
    const err = new ApiError(500, { error: 'Server error' });
    expect(api.isNetworkError(err)).toBe(false);
  });

  it('returns false for generic Error', () => {
    const err = new Error('Something broke');
    expect(api.isNetworkError(err)).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(api.isNetworkError('string error')).toBe(false);
    expect(api.isNetworkError(null)).toBe(false);
    expect(api.isNetworkError(undefined)).toBe(false);
    expect(api.isNetworkError({})).toBe(false);
  });

  it('returns false for TypeError with different message', () => {
    const err = new TypeError('Some other error');
    expect(api.isNetworkError(err)).toBe(false);
  });
});

describe('ApiClient — withFallback', () => {
  it('returns the call result on success', async () => {
    const result = await api.withFallback(
      () => Promise.resolve('success'),
      'fallback',
    );
    expect(result).toBe('success');
  });

  it('returns fallback when the call throws', async () => {
    const result = await api.withFallback(
      () => Promise.reject(new Error('API error')),
      'fallback-value',
    );
    expect(result).toBe('fallback-value');
  });

  it('returns fallback when call network fails', async () => {
    const result = await api.withFallback(
      () => Promise.reject(new TypeError('Failed to fetch')),
      { data: [] },
    );
    expect(result).toEqual({ data: [] });
  });
});

describe('ApiClient — HTTP methods (with mocked fetch)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    configureApi({ baseUrl: 'http://localhost:3000/api' });
  });

  it('api.get makes a GET request and returns parsed JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1, name: 'Test' }),
    } as any);

    const result = await api.get<{ id: number; name: string }>('/test');
    expect(result).toEqual({ id: 1, name: 'Test' });
  });

  it('api.post makes a POST request with body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any);

    const result = await api.post<{ success: boolean }>('/create', { name: 'test' });
    expect(result).toEqual({ success: true });
  });

  it('api.put makes a PUT request with body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ updated: true }),
    } as any);

    const result = await api.put<{ updated: boolean }>('/update/1', { name: 'new' });
    expect(result).toEqual({ updated: true });
  });

  it('api.delete makes a DELETE request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({}),
    } as any);

    const result = await api.delete('/delete/1');
    expect(result).toBeUndefined();
  });

  it('api.get includes Authorization header when token is set', async () => {
    configureApi({ getToken: () => 'my-jwt-token' });

    let capturedHeaders: any;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, opts: any) => {
      capturedHeaders = opts.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as any;
    });

    await api.get('/secure');
    expect(capturedHeaders['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('api.get does not include Authorization header when skipAuth is set', async () => {
    configureApi({ getToken: () => 'my-jwt-token' });

    let capturedHeaders: any;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, opts: any) => {
      capturedHeaders = opts.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as any;
    });

    await api.get('/public', { skipAuth: true });
    expect(capturedHeaders['Authorization']).toBeUndefined();
  });

  it('throws ApiError on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    } as any);

    await expect(api.get('/secure')).rejects.toThrow(ApiError);
  });

  it('throws ApiError with correct status code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    } as any);

    try {
      await api.get('/nonexistent');
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(404);
    }
  });

  it('throws ApiError with message from response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid input' }),
    } as any);

    try {
      await api.post('/create', { invalid: true });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect((err as ApiError).message).toContain('Invalid input');
    }
  });
});

describe('ApiError', () => {
  it('creates an error with status and body', () => {
    const err = new ApiError(500, { error: 'Server error' });
    expect(err.status).toBe(500);
    expect(err.body).toEqual({ error: 'Server error' });
    expect(err.message).toBe('Server error');
  });

  it('creates an error with string body', () => {
    const err = new ApiError(503, 'Service unavailable');
    expect(err.status).toBe(503);
    expect(err.message).toBe('Service unavailable');
  });

  it('creates an error with message property in body', () => {
    const err = new ApiError(429, { message: 'Rate limit exceeded' });
    expect(err.message).toBe('Rate limit exceeded');
  });

  it('falls back to HTTP status text when body has no error or message', () => {
    const err = new ApiError(500, { code: 'UNKNOWN' });
    expect(err.message).toBe('HTTP 500');
  });

  it('is instance of Error', () => {
    const err = new ApiError(500, 'fail');
    expect(err).toBeInstanceOf(Error);
  });
});
