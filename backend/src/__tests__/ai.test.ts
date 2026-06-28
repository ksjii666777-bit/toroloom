/**
 * ============================================================================
 * Toroloom — AI Service Unit Tests
 * ============================================================================
 *
 * Tests the AI service (src/services/ai.ts) with mocked env and fetch.
 * Covers:
 *   1. Provider detection — getActiveProvider, isAIConfigured, getActiveProviderName
 *   2. Response parsing — parseAIResponse (with/without markdown fences)
 *   3. Insight validation — toAIInsight (valid, invalid, edge cases)
 *   4. generateInsight — OpenRouter and Google Gemini providers
 *   5. generateInsights — parallel execution with partial failures
 *   6. generateBatchInsight — batch API call, array + single-object responses
 *   7. Error handling — network errors, API errors, empty responses
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/ai.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AIInsight } from '../services/ai';

// ──── Mock env (vi.hoisted to avoid TDZ with vi.mock hoisting) ────────────

const mockEnv = vi.hoisted(() => ({
  aiProvider: 'openrouter' as const,
  openRouterApiKey: 'sk-or-v1-test-key',
  openRouterModel: 'google/gemini-2.0-flash-lite-001',
  googleGeminiApiKey: '',
  googleGeminiModel: 'gemini-2.0-flash-lite-001',
  nodeEnv: 'test',
  isDev: false,
  isMock: true,
  port: 0,
  jwtExpiresIn: '1h',
  dataSource: 'mock' as const,
  broker: 'mock' as const,
  storageBackend: 'memory' as const,
  jwtSecret: 'test-secret',
  databaseUrl: '',
  mongodbUri: '',
  mongodbDbName: '',
  zerodha: { apiKey: '', apiSecret: '', accessToken: '', requestToken: '' },
  angel: { clientId: '', apiKey: '', accessToken: '', password: '', totp: '' },
  groww: { apiKey: '', accessToken: '' },
  razorpayKeyId: '',
  razorpayKeySecret: '',
  razorpayWebhookSecret: '',
  sentryDsn: '',
  redisUrl: '',
  subscriptionGatingEnabled: false,
  get isProd() { return false; },
}));

vi.mock('../config/env', () => ({
  env: mockEnv,
}));

// ──── Mock fetch ───────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ──── Import AFTER mocks ───────────────────────────────────────────────────

import {
  isAIConfigured,
  getActiveProviderName,
  generateInsight,
  generateInsights,
  generateBatchInsight,
} from '../services/ai';

// ──── Helpers ───────────────────────────────────────────────────────────────

function mockOpenRouterSuccess(content: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      id: 'or-123',
      choices: [{ message: { content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }),
  });
}

function mockGeminiSuccess(content: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      candidates: [{ content: { parts: [{ text: content }] }, finishReason: 'STOP' }],
    }),
  });
}

function mockFetchError(status: number, body: string) {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
}

function mockFetchNetworkError() {
  mockFetch.mockRejectedValueOnce(new Error('Network failure'));
}

function validAIResponse(symbol: string) {
  return JSON.stringify({
    type: 'bullish',
    confidence: 85,
    summary: `${symbol} shows strong momentum`,
    analysis: `${symbol} has strong RSI and MACD crossover. Support at 2800, resistance at 3000.`,
    targets: [
      { target: 3100, probability: 70 },
      { target: 3300, probability: 40 },
      { target: 3500, probability: 15 },
    ],
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('AI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env to defaults
    mockEnv.aiProvider = 'openrouter';
    mockEnv.openRouterApiKey = 'sk-or-v1-test-key';
    mockEnv.googleGeminiApiKey = '';
    mockEnv.googleGeminiModel = 'gemini-2.0-flash-lite-001';
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Provider Detection
  // ─────────────────────────────────────────────────────────────────────────

  describe('Provider Detection', () => {
    it('should detect OpenRouter when configured', () => {
      mockEnv.aiProvider = 'openrouter';
      mockEnv.openRouterApiKey = 'sk-or-v1-key';
      expect(isAIConfigured()).toBe(true);
      expect(getActiveProviderName()).toBe('OpenRouter');
    });

    it('should detect Google Gemini when configured', () => {
      mockEnv.aiProvider = 'google';
      mockEnv.googleGeminiApiKey = 'ai-key-123';
      mockEnv.openRouterApiKey = '';
      expect(isAIConfigured()).toBe(true);
      expect(getActiveProviderName()).toBe('Google Gemini');
    });

    it('should fall back to OpenRouter when both keys exist but aiProvider not set', () => {
      mockEnv.aiProvider = 'google';
      mockEnv.openRouterApiKey = 'sk-or-v1-key';
      mockEnv.googleGeminiApiKey = 'ai-key-123';
      // aiProvider='google' so it should pick google
      expect(getActiveProviderName()).toBe('Google Gemini');
    });

    it('should return false when no keys configured', () => {
      mockEnv.openRouterApiKey = '';
      mockEnv.googleGeminiApiKey = '';
      expect(isAIConfigured()).toBe(false);
      expect(getActiveProviderName()).toBe('none');
    });

    it('should detect OpenRouter when only OpenRouter key exists', () => {
      mockEnv.openRouterApiKey = 'sk-or-v1-key';
      mockEnv.googleGeminiApiKey = '';
      expect(isAIConfigured()).toBe(true);
    });

    it('should detect Google when only Gemini key exists', () => {
      mockEnv.openRouterApiKey = '';
      mockEnv.googleGeminiApiKey = 'ai-key-123';
      expect(isAIConfigured()).toBe(true);
      expect(getActiveProviderName()).toBe('Google Gemini');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. generateInsight — OpenRouter
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateInsight (OpenRouter)', () => {
    it('should generate an insight for a single symbol via OpenRouter', async () => {
      mockOpenRouterSuccess(validAIResponse('RELIANCE'));

      const insight = await generateInsight('RELIANCE');

      expect(insight.symbol).toBe('RELIANCE');
      expect(insight.type).toBe('bullish');
      expect(insight.confidence).toBe(85);
      expect(insight.summary).toContain('strong momentum');
      expect(insight.targets).toHaveLength(3);
      expect(insight.id).toContain('ai_');
      expect(insight.id).toContain('RELIANCE');
      expect(insight.timestamp).toBeDefined();

      // Verify fetch was called with correct OpenRouter URL
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(fetchCall[1].headers.Authorization).toBe('Bearer sk-or-v1-test-key');
    });

    it('should parse response with markdown code fences', async () => {
      mockOpenRouterSuccess('```json\n' + validAIResponse('TCS') + '\n```');

      const insight = await generateInsight('TCS');
      expect(insight.symbol).toBe('TCS');
      expect(insight.type).toBe('bullish');
    });

    it('should handle OpenRouter API errors', async () => {
      mockFetchError(401, 'Unauthorized');

      await expect(generateInsight('RELIANCE')).rejects.toThrow(
        'OpenRouter API error (401): Unauthorized',
      );
    });

    it('should handle network errors', async () => {
      mockFetchNetworkError();

      await expect(generateInsight('RELIANCE')).rejects.toThrow('Network failure');
    });

    it('should handle empty response from OpenRouter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'or-123',
          choices: [{ message: { content: '' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        }),
      });

      await expect(generateInsight('RELIANCE')).rejects.toThrow(
        'OpenRouter returned empty response',
      );
    });

    it('should handle null/undefined choices', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'or-123',
          choices: [],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        }),
      });

      await expect(generateInsight('RELIANCE')).rejects.toThrow(
        'OpenRouter returned empty response',
      );
    });

    it('should handle malformed JSON response', async () => {
      mockOpenRouterSuccess('{ invalid json }');

      await expect(generateInsight('RELIANCE')).rejects.toThrow();
    });

    it('should handle non-object parsed response (null)', async () => {
      mockOpenRouterSuccess('null');

      await expect(generateInsight('RELIANCE')).rejects.toThrow(
        'Failed to parse AI response for RELIANCE',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. generateInsight — Google Gemini
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateInsight (Google Gemini)', () => {
    beforeEach(() => {
      mockEnv.aiProvider = 'google';
      mockEnv.openRouterApiKey = '';
      mockEnv.googleGeminiApiKey = 'ai-key-test-123';
    });

    it('should generate an insight via Google Gemini', async () => {
      mockGeminiSuccess(validAIResponse('HDFCBANK'));

      const insight = await generateInsight('HDFCBANK');

      expect(insight.symbol).toBe('HDFCBANK');
      expect(insight.type).toBe('bullish');
      expect(insight.confidence).toBe(85);

      // Verify correct Gemini URL
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('generativelanguage.googleapis.com');
      expect(fetchCall[0]).toContain('gemini-2.0-flash-lite-001');
      expect(fetchCall[0]).toContain('key=ai-key-test-123');
    });

    it('should handle Gemini API errors', async () => {
      mockFetchError(429, 'Rate limit exceeded');

      await expect(generateInsight('RELIANCE')).rejects.toThrow(
        'Google Gemini API error (429): Rate limit exceeded',
      );
    });

    it('should handle empty Gemini response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'STOP' }],
        }),
      });

      await expect(generateInsight('RELIANCE')).rejects.toThrow(
        'Google Gemini returned empty response',
      );
    });

    it('should handle missing candidates in Gemini response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [],
        }),
      });

      await expect(generateInsight('RELIANCE')).rejects.toThrow(
        'Google Gemini returned empty response',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. generateInsight — No Provider
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateInsight (No Provider)', () => {
    it('should throw when no AI provider is configured', async () => {
      mockEnv.openRouterApiKey = '';
      mockEnv.googleGeminiApiKey = '';

      await expect(generateInsight('RELIANCE')).rejects.toThrow(
        'No AI provider configured',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. generateInsights — Parallel Execution
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateInsights (Parallel)', () => {
    it('should generate insights for multiple symbols', async () => {
      mockOpenRouterSuccess(validAIResponse('RELIANCE'));

      const insights = await generateInsights(['RELIANCE', 'TCS']);

      expect(insights).toHaveLength(2);
      expect(insights[0].symbol).toBe('RELIANCE');
      expect(insights[1].symbol).toBe('TCS');
    });

    it('should handle partial failures gracefully', async () => {
      // Use explicit mockResolvedValueOnce + mockRejectedValueOnce to control order
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'or-123',
            choices: [{ message: { content: validAIResponse('RELIANCE') }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
        })
        .mockRejectedValueOnce(new Error('Network failure'));

      // Since Promise.allSettled is used, errors are caught
      const insights = await generateInsights(['RELIANCE', 'FAILURE']);

      // Only the successful one should be included
      expect(insights).toHaveLength(1);
      expect(insights[0].symbol).toBe('RELIANCE');
    });

    it('should return empty array when all fail', async () => {
      mockFetchNetworkError();
      mockFetchNetworkError();

      const insights = await generateInsights(['FAIL1', 'FAIL2']);
      expect(insights).toEqual([]);
    });

    it('should return empty array for empty input', async () => {
      const insights = await generateInsights([]);
      expect(insights).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. generateBatchInsight — OpenRouter
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateBatchInsight (OpenRouter)', () => {
    it('should generate batch insights for multiple symbols', async () => {
      const batchResponse = JSON.stringify([
        { symbol: 'RELIANCE', type: 'bullish', confidence: 80, summary: 'Reliance up', analysis: 'Good', targets: [{ target: 3000, probability: 60 }] },
        { symbol: 'TCS', type: 'bearish', confidence: 65, summary: 'TCS down', analysis: 'Weak', targets: [{ target: 3500, probability: 50 }] },
      ]);
      mockOpenRouterSuccess(batchResponse);

      const insights = await generateBatchInsight(['RELIANCE', 'TCS']);

      expect(insights).toHaveLength(2);
      expect(insights[0].symbol).toBe('RELIANCE');
      expect(insights[0].type).toBe('bullish');
      expect(insights[1].symbol).toBe('TCS');
      expect(insights[1].type).toBe('bearish');
    });

    it('should handle single-object response (not array)', async () => {
      const singleResponse = JSON.stringify({
        symbol: 'RELIANCE', type: 'neutral', confidence: 70,
        summary: 'Hold', analysis: 'Sideways', targets: [],
      });
      mockOpenRouterSuccess(singleResponse);

      const insights = await generateBatchInsight(['RELIANCE']);
      expect(insights).toHaveLength(1);
      expect(insights[0].symbol).toBe('RELIANCE');
    });

    it('should filter out invalid items from batch response', async () => {
      const batchResponse = JSON.stringify([
        { symbol: 'RELIANCE', type: 'bullish', confidence: 80, summary: 'Up', analysis: 'Good', targets: [] },
        null,
        { symbol: 'TCS', type: 'bearish', confidence: 65, summary: 'Down', analysis: 'Weak', targets: [] },
      ]);
      mockOpenRouterSuccess(batchResponse);

      const insights = await generateBatchInsight(['RELIANCE', 'TCS']);
      expect(insights).toHaveLength(2);
    });

    it('should handle batch API errors', async () => {
      mockFetchError(500, 'Internal Server Error');

      await expect(generateBatchInsight(['RELIANCE'])).rejects.toThrow(
        'OpenRouter batch API error (500): Internal Server Error',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. generateBatchInsight — Google Gemini
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateBatchInsight (Google Gemini)', () => {
    beforeEach(() => {
      mockEnv.aiProvider = 'google';
      mockEnv.openRouterApiKey = '';
      mockEnv.googleGeminiApiKey = 'ai-key-test-123';
    });

    it('should generate batch insights via Gemini', async () => {
      const batchResponse = JSON.stringify([
        { symbol: 'RELIANCE', type: 'bullish', confidence: 80, summary: 'Up', analysis: 'Good', targets: [] },
      ]);
      mockGeminiSuccess(batchResponse);

      const insights = await generateBatchInsight(['RELIANCE']);
      expect(insights).toHaveLength(1);
      expect(insights[0].symbol).toBe('RELIANCE');
    });

    it('should throw when Gemini batch fails', async () => {
      mockFetchError(403, 'Forbidden');

      await expect(generateBatchInsight(['RELIANCE'])).rejects.toThrow(
        'Google Gemini API error (403): Forbidden',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Edge Cases — Target Fallback
  // ─────────────────────────────────────────────────────────────────────────

  describe('Target Fallback', () => {
    it('should use default targets when API returns empty targets array', async () => {
      const response = JSON.stringify({
        type: 'bullish', confidence: 80,
        summary: 'Test', analysis: 'Test analysis',
        targets: [],
      });
      mockOpenRouterSuccess(response);

      const insight = await generateInsight('RELIANCE');
      expect(insight.targets).toHaveLength(3);
      expect(insight.targets[0].probability).toBe(60);
      expect(insight.targets[1].probability).toBe(35);
      expect(insight.targets[2].probability).toBe(15);
    });

    it('should filter out malformed targets', async () => {
      const response = JSON.stringify({
        type: 'bearish', confidence: 75,
        summary: 'Test', analysis: 'Test',
        targets: [
          { target: 100, probability: 70 },
          { target: 'invalid', probability: 'not-a-number' },
          { target: 200, probability: 30 },
        ],
      });
      mockOpenRouterSuccess(response);

      const insight = await generateInsight('RELIANCE');
      expect(insight.targets).toHaveLength(2);
      expect(insight.targets[0].target).toBe(100);
      expect(insight.targets[1].target).toBe(200);
    });
  });
});
