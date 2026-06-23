/**
 * ============================================================================
 * Toroloom — Auth API Tests
 * ============================================================================
 *
 * Tests the authApi module: login, signup, getProfile, updateProfile.
 * Each test mocks globalThis.fetch to verify URL, method, headers, and body.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Unmock authApi so we test the real implementation (setup.ts mocks it globally)
vi.unmock('../services/api/auth');

import { configureApi } from '../services/api/client';
import { authApi } from '../services/api/auth';
import type { Mock } from 'vitest';

import { TEST_API_BASE as API_BASE } from './testConfig';
const originalFetch = globalThis.fetch;

// ============================================================================
// authApi — login
// ============================================================================

describe('authApi — login', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => null });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /auth/login with credentials', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ token: 'jwt-token', user: { id: 'u1', name: 'Test' } }) };
    });

    const result = await authApi.login('user@example.com', 'password123');

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/auth/login`);
    expect(JSON.parse(capturedBody)).toEqual({ email: 'user@example.com', password: 'password123' });
    expect(result).toEqual({ token: 'jwt-token', user: { id: 'u1', name: 'Test' } });
  });

  it('does not attach Authorization header (skipAuth)', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve({ token: 't', user: { id: 'u1', name: 'T' } }) };
    });

    await authApi.login('a@b.com', 'pwd');
    expect(capturedHeaders['Authorization']).toBeUndefined();
  });

  it('throws ApiError on failure', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 401, json: () => Promise.resolve({ error: 'Invalid credentials' }),
    });
    await expect(authApi.login('bad@user.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });

  it('throws on network error', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(authApi.login('a@b.com', 'pwd')).rejects.toThrow('Failed to fetch');
  });
});

// ============================================================================
// authApi — signup
// ============================================================================

describe('authApi — signup', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => null });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /auth/signup with user data', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ token: 'jwt-token', user: { id: 'u2', name: 'New User' } }) };
    });

    const result = await authApi.signup('New User', 'new@example.com', '9876543210', 'secure123');

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/auth/signup`);
    expect(JSON.parse(capturedBody)).toEqual({ name: 'New User', email: 'new@example.com', phone: '9876543210', password: 'secure123' });
    expect(result).toEqual({ token: 'jwt-token', user: { id: 'u2', name: 'New User' } });
  });

  it('does not attach Authorization header (skipAuth)', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve({ token: 't', user: { id: 'u1', name: 'T' } }) };
    });

    await authApi.signup('N', 'n@b.com', '999', 'pwd');
    expect(capturedHeaders['Authorization']).toBeUndefined();
  });

  it('throws ApiError on duplicate email', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 409, json: () => Promise.resolve({ error: 'Email already registered' }),
    });
    await expect(authApi.signup('Dup', 'dup@example.com', '888', 'pwd')).rejects.toThrow('Email already registered');
  });
});

// ============================================================================
// authApi — getProfile
// ============================================================================

describe('authApi — getProfile', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'valid-token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /auth/profile', async () => {
    let capturedUrl = '', capturedMethod = '', capturedHeaders: Record<string, string> = {};
    const mockUser = { id: 'u1', name: 'Test User', email: 'test@example.com', phone: '1234567890', kycStatus: 'verified', balance: 50000, createdAt: '2025-01-01' };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve(mockUser) };
    });

    const result = await authApi.getProfile();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/auth/profile`);
    expect(capturedHeaders['Authorization']).toBe('Bearer valid-token');
    expect(result).toEqual(mockUser);
  });

  it('throws on unauthorized', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 401, json: () => Promise.resolve({ error: 'Unauthorized' }),
    });
    await expect(authApi.getProfile()).rejects.toThrow('Unauthorized');
  });
});

// ============================================================================
// authApi — updateProfile
// ============================================================================

describe('authApi — updateProfile', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'valid-token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends PUT to /auth/profile with update data', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '', capturedHeaders: Record<string, string> = {};
    const mockUser = { id: 'u1', name: 'Updated Name', email: 'test@example.com', phone: '1234567890', kycStatus: 'verified', balance: 50000, createdAt: '2025-01-01' };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve(mockUser) };
    });

    const result = await authApi.updateProfile({ name: 'Updated Name', phone: '0987654321' });

    expect(capturedMethod).toBe('PUT');
    expect(capturedUrl).toBe(`${API_BASE}/auth/profile`);
    expect(JSON.parse(capturedBody)).toEqual({ name: 'Updated Name', phone: '0987654321' });
    expect(capturedHeaders['Authorization']).toBe('Bearer valid-token');
    expect(result).toEqual(mockUser);
  });

  it('sends partial update with only name', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ id: 'u1', name: 'Only Name', email: 't@t.com', phone: '123', kycStatus: 'verified', balance: 0, createdAt: '2025-01-01' }) };
    });

    await authApi.updateProfile({ name: 'Only Name' });
    expect(JSON.parse(capturedBody)).toEqual({ name: 'Only Name' });
  });

  it('sends partial update with only phone', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ id: 'u1', name: 'User', email: 't@t.com', phone: '999', kycStatus: 'verified', balance: 0, createdAt: '2025-01-01' }) };
    });

    await authApi.updateProfile({ phone: '9999999999' });
    expect(JSON.parse(capturedBody)).toEqual({ phone: '9999999999' });
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ message: 'Internal server error' }),
    });
    await expect(authApi.updateProfile({ name: 'Fail' })).rejects.toThrow('Internal server error');
  });
});
