/**
 * ============================================================================
 * Toroloom — API Client
 * ============================================================================
 *
 * Lightweight fetch wrapper used by all stores to talk to the backend.
 * Attaches the auth token automatically and normalises error responses.
 *
 * ACQUISITION COMPLIANCE:
 *   The base URL MUST be set via configureApi() before any API calls.
 *   No hardcoded default — the acquiring organization must explicitly
 *   configure the backend endpoint for their environment.
 *
 *   Configure during app initialization:
 *     import { configureApi } from './services/api/client';
 *     configureApi({
 *       baseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.toroloom.app/api',
 *       getToken: () => authStore.getState().token,
 *     });
 *
 * ============================================================================
 */

import { log } from '../../utils/logger';

// Must be explicitly configured. No hardcoded fallback.
let _baseUrl = '';
let _getToken: () => string | null = () => null;

/**
 * Configure the API client with the backend base URL and token provider.
 * Call this once during app initialization, before any API calls.
 *
 * @param config.baseUrl — The backend API root URL (e.g., 'https://api.toroloom.app/api')
 * @param config.getToken — Function that returns the current auth token (or null)
 */
export function configureApi(config: { baseUrl?: string; getToken?: () => string | null }) {
  if (config.baseUrl !== undefined) _baseUrl = config.baseUrl;
  if (config.getToken !== undefined) _getToken = config.getToken;
}

export function getBaseUrl() {
  if (!_baseUrl) {
    log.warn(
      '[API Client] Base URL not configured. Call configureApi() before making API calls.\n' +
      '  Example: configureApi({ baseUrl: "https://api.toroloom.app/api" })',
    );
  }
  return _baseUrl;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(typeof body === 'string' ? body : body?.error || body?.message || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
  opts?: { skipAuth?: boolean },
): Promise<T> {
  const token = _getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token && !opts?.skipAuth) headers['Authorization'] = `Bearer ${token}`;

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new ApiError(0, { error: 'API base URL not configured. Call configureApi() first.' });
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json);
  return json as T;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export const api = {
  get: <T>(path: string, opts?: { skipAuth?: boolean }) =>
    request<T>('GET', path, undefined, opts),

  post: <T>(path: string, body?: any, opts?: { skipAuth?: boolean }) =>
    request<T>('POST', path, body, opts),

  put: <T>(path: string, body?: any, opts?: { skipAuth?: boolean }) =>
    request<T>('PUT', path, body, opts),

  delete: <T>(path: string, opts?: { skipAuth?: boolean }) =>
    request<T>('DELETE', path, undefined, opts),

  /** True if the error is a network / connectivity error */
  isNetworkError(err: unknown): boolean {
    if (err instanceof TypeError && err.message === 'Failed to fetch') return true;
    if (err instanceof ApiError) return false; // server responded
    return false;
  },

  /** Convenience: call an API and fall back to `fallback` on failure */
  async withFallback<T>(call: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await call();
    } catch {
      return fallback;
    }
  },
};

export { ApiError };
