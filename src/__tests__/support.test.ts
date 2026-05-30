/**
 * ============================================================================
 * Toroloom — Support API Tests
 * ============================================================================
 *
 * Tests the supportApi module: getFAQs, getFAQ, searchFAQs.
 * Each test mocks globalThis.fetch to verify correct URL construction,
 * HTTP methods, and query parameters.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.unmock('../services/api/support');

import { configureApi } from '../services/api/client';
import { supportApi } from '../services/api/support';
import type { Mock } from 'vitest';

const API_BASE = 'http://localhost:3000/api';
const originalFetch = globalThis.fetch;

// ============================================================================
// supportApi — getFAQs
// ============================================================================

describe('supportApi — getFAQs', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /support/faqs', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockFAQs = [
      { id: 'faq1', question: 'How do I start trading?', answer: 'First, complete your KYC...', category: 'getting-started', order: 1 },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockFAQs) };
    });

    const result = await supportApi.getFAQs();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/support/faqs`);
    expect(result).toEqual(mockFAQs);
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await supportApi.getFAQs();
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('returns empty array when no FAQs', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await supportApi.getFAQs();
    expect(result).toEqual([]);
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to fetch FAQs' }),
    });
    await expect(supportApi.getFAQs()).rejects.toThrow('Failed to fetch FAQs');
  });

  it('throws on network failure', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(supportApi.getFAQs()).rejects.toThrow('Failed to fetch');
  });
});

// ============================================================================
// supportApi — getFAQ
// ============================================================================

describe('supportApi — getFAQ', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /support/faqs/{faqId}', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockFAQ = { id: 'faq1', question: 'How do I start trading?', answer: 'Complete KYC first...', category: 'getting-started', order: 1 };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockFAQ) };
    });

    const result = await supportApi.getFAQ('faq1');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/support/faqs/faq1`);
    expect(result).toEqual(mockFAQ);
  });

  it('throws on 404 for unknown FAQ', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'FAQ not found' }),
    });
    await expect(supportApi.getFAQ('invalid')).rejects.toThrow('FAQ not found');
  });
});

// ============================================================================
// supportApi — searchFAQs
// ============================================================================

describe('supportApi — searchFAQs', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET with encoded search query', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockResults = [
      { id: 'faq2', question: 'What is KYC?', answer: 'KYC stands for Know Your Customer...', category: 'account', order: 2 },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockResults) };
    });

    const result = await supportApi.searchFAQs('KYC process');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/support/faqs/search?q=KYC%20process`);
    expect(result).toEqual(mockResults);
  });

  it('handles special characters in query', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await supportApi.searchFAQs('tax & filing');
    expect(capturedUrl).toBe(`${API_BASE}/support/faqs/search?q=tax%20%26%20filing`);
  });

  it('returns empty array for no results', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await supportApi.searchFAQs('ZZZZ');
    expect(result).toEqual([]);
  });

  it('handles empty search query', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await supportApi.searchFAQs('');
    expect(capturedUrl).toBe(`${API_BASE}/support/faqs/search?q=`);
  });
});
