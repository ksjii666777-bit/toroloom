/**
 * Toroloom AI Service — OpenRouter, Google Gemini & Choreo Claude API
 *
 * Supports multiple AI providers:
 *   1. OpenRouter (unified API — Gemini, GPT, Claude)
 *   2. Google Gemini (direct API)
 *   3. Choreo API Gateway → Anthropic Claude
 *
 * Set env vars:
 *   OPENROUTER_API_KEY=sk-or-v1-...
 *   GOOGLE_GEMINI_API_KEY=...
 *   CHOREO_CLAUDE_API_KEY=<JWT token>
 *   CHOREO_CLAUDE_ENDPOINT=https://eg-...azure.bijiraapis.dev/.../v1.0
 */

import { env } from '../config/env';

// ──── Types ────────────────────────────────────────────────────────────────

export interface AIInsight {
  id: string;
  stockId: string;
  symbol: string;
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  analysis: string;
  targets: { target: number; probability: number }[];
  timestamp: string;
  /** Diagnostic field showing which AI provider generated this insight. */
  _provider?: string;
}

interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
    finishReason: string;
  }[];
}

/** Anthropic Claude Messages API response (via Choreo gateway) */
interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: { type: 'text'; text: string }[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ──── Constants ────────────────────────────────────────────────────────────

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GOOGLE_GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const CHOREO_ANTHROPIC_PATH = '/v1/messages';

const SYSTEM_PROMPT = `You are Toroloom AI, an expert Indian stock market analyst assistant.
You provide concise, data-driven stock analysis for NSE/BSE-listed companies.

For every stock analysis you must respond with VALID JSON ONLY (no markdown, no code fences).
The JSON must follow this exact schema:
{
  "type": "bullish" | "bearish" | "neutral",
  "confidence": number (60-95),
  "summary": string (one line summary),
  "analysis": string (detailed 3-4 sentence analysis covering technicals, fundamentals, and market sentiment),
  "targets": [
    { "target": number (target price), "probability": number (0-100) }
  ]
}

Targets should have 3 entries: most likely, moderate probability, and low probability.
Confidence must reflect how certain the model is about the prediction.
Analysis should reference real technical indicators (RSI, MACD, moving averages, support/resistance levels).
If no real data is available, note that the analysis is based on general market knowledge.`;

const BATCH_SYSTEM_PROMPT = `You are Toroloom AI, an expert Indian stock market analyst assistant.
You provide concise stock analysis for NSE/BSE-listed companies.

For the requested stocks, respond with a JSON array ONLY (no markdown, no code fences).
Each element must follow this exact schema:
{
  "symbol": string (the stock symbol),
  "type": "bullish" | "bearish" | "neutral",
  "confidence": number (60-95),
  "summary": string (one line),
  "analysis": string (2-3 sentences),
  "targets": [
    { "target": number, "probability": number }
  ]
}

Return them in a JSON array format: [{...}, {...}, ...]`;

// ──── AI Service ───────────────────────────────────────────────────────────

/**
 * Determine which AI provider to use based on env config and available keys.
 */
function getActiveProvider(): 'openrouter' | 'google' | 'choreo' | null {
  if (env.aiProvider === 'choreo' && env.choreoClaudeApiKey) return 'choreo';
  if (env.aiProvider === 'google' && env.googleGeminiApiKey) return 'google';
  if (env.aiProvider === 'openrouter' && env.openRouterApiKey) return 'openrouter';
  // Fallback: use whichever key is available
  if (env.choreoClaudeApiKey) return 'choreo';
  if (env.openRouterApiKey) return 'openrouter';
  if (env.googleGeminiApiKey) return 'google';
  return null;
}

/**
 * Check if any AI provider is configured with a valid API key.
 */
export function isAIConfigured(): boolean {
  return getActiveProvider() !== null;
}

/**
 * Get the human-readable name of the active provider.
 */
export function getActiveProviderName(): string {
  const provider = getActiveProvider();
  if (provider === 'google') return 'Google Gemini';
  if (provider === 'openrouter') return 'OpenRouter';
  if (provider === 'choreo') return 'Choreo Claude';
  return 'none';
}

/**
 * Validate that a parsed object conforms to the AIInsight shape.
 * Returns a cleaned insight or null if the object is unusable.
 */
function toAIInsight(raw: any, symbol: string): AIInsight | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = ['bullish', 'bearish', 'neutral'].includes(raw.type) ? raw.type : 'neutral';
  const confidence = typeof raw.confidence === 'number' && raw.confidence >= 0 && raw.confidence <= 100
    ? raw.confidence : 70;
  const summary = typeof raw.summary === 'string' ? raw.summary : `AI analysis for ${symbol}`;
  const analysis = typeof raw.analysis === 'string' ? raw.analysis : `Analysis for ${symbol} generated by AI.`;
  const targets = Array.isArray(raw.targets) ? raw.targets.filter(
    (t: any) => t && typeof t.target === 'number' && typeof t.probability === 'number'
  ) : [];

  return {
    id: `ai_${Date.now()}_${symbol}`,
    stockId: symbol,
    symbol,
    name: symbol,
    type,
    confidence,
    summary,
    analysis,
    targets: targets.length > 0 ? targets : [
      { target: 0, probability: 60 },
      { target: 0, probability: 35 },
      { target: 0, probability: 15 },
    ],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse AI response JSON string, stripping markdown code fences.
 */
function parseAIResponse(content: string): any {
  const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

/**
 * Call Anthropic Claude via Choreo API Gateway.
 * Uses the Anthropic Messages API format through the Choreo-managed endpoint.
 * Authentication is via Bearer JWT (Choreo Internal Key).
 */
async function callChoreoClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const url = env.choreoClaudeEndpoint.replace(/\/+$/, '') + CHOREO_ANTHROPIC_PATH;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.choreoClaudeApiKey}`,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.choreoClaudeModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Choreo Claude API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const content = data.content?.[0]?.text;

  if (!content) {
    throw new Error('Choreo Claude returned empty response');
  }

  return content;
}

/**
 * Call Google Gemini API directly.
 */
async function callGoogleGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const url = `${GOOGLE_GEMINI_API_URL}/${env.googleGeminiModel}:generateContent?key=${env.googleGeminiApiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Google Gemini API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('Google Gemini returned empty response');
  }

  return content;
}

/**
 * Generate an AI insight for a given stock symbol.
 * Uses the active AI provider (OpenRouter or Google Gemini).
 */
export async function generateInsight(symbol: string): Promise<AIInsight> {
  const provider = getActiveProvider();
  if (!provider) {
    throw new Error('No AI provider configured. Set OPENROUTER_API_KEY or GOOGLE_GEMINI_API_KEY.');
  }

  const userPrompt = `Analyze the Indian stock ${symbol} listed on NSE. Provide a detailed analysis with technical and fundamental factors. Include specific support and resistance levels, RSI, and trend analysis where applicable. Return VALID JSON ONLY following the schema.`;

  try {
    let content: string;

    if (provider === 'choreo') {
      content = await callChoreoClaude(SYSTEM_PROMPT, userPrompt);
    } else if (provider === 'google') {
      content = await callGoogleGemini(SYSTEM_PROMPT, userPrompt);
    } else {
      // OpenRouter (default)
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.openRouterApiKey}`,
          'HTTP-Referer': 'https://toroloom.app',
          'X-Title': 'Toroloom',
        },
        body: JSON.stringify({
          model: env.openRouterModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as OpenRouterResponse;
      content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('OpenRouter returned empty response');
      }
    }

    const parsed = parseAIResponse(content);
    const insight = toAIInsight(parsed, symbol);
    if (!insight) {
      throw new Error(`Failed to parse AI response for ${symbol}`);
    }
    return insight;
  } catch (error: any) {
    console.error(`[AI Service] Failed to generate insight (${provider}):`, error.message);
    throw error;
  }
}

/**
 * Generate insights for multiple symbols in parallel.
 * Each symbol gets its own API call — faster overall but uses more tokens.
 */
export async function generateInsights(symbols: string[]): Promise<AIInsight[]> {
  const results = await Promise.allSettled(symbols.map(s => generateInsight(s)));
  const insights: AIInsight[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      insights.push(r.value);
    }
  }
  return insights;
}

/**
 * Generate insights for multiple symbols in a SINGLE API call.
 * More token-efficient but the AI needs to handle all symbols at once.
 * Supports both OpenRouter and Google Gemini providers.
 */
export async function generateBatchInsight(symbols: string[]): Promise<AIInsight[]> {
  const provider = getActiveProvider();
  if (!provider) {
    throw new Error('No AI provider configured. Set OPENROUTER_API_KEY or GOOGLE_GEMINI_API_KEY.');
  }

  const userPrompt = `Analyze the following Indian stocks listed on NSE: ${symbols.join(', ')}.
For each stock, provide: type (bullish/bearish/neutral), confidence score, one-line summary, detailed 2-3 sentence analysis, and 3 price targets.
Return VALID JSON ARRAY ONLY following the schema.`;

  try {
    let content: string;

    if (provider === 'choreo') {
      content = await callChoreoClaude(BATCH_SYSTEM_PROMPT, userPrompt);
    } else if (provider === 'google') {
      content = await callGoogleGemini(BATCH_SYSTEM_PROMPT, userPrompt);
    } else {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.openRouterApiKey}`,
          'HTTP-Referer': 'https://toroloom.app',
          'X-Title': 'Toroloom',
        },
        body: JSON.stringify({
          model: env.openRouterModel,
          messages: [
            { role: 'system', content: BATCH_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 8192,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`OpenRouter batch API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as OpenRouterResponse;
      content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('OpenRouter returned empty batch response');
      }
    }

    const parsedArray = parseAIResponse(content);

    // Handle both array and single-object responses
    const items = Array.isArray(parsedArray) ? parsedArray : [parsedArray];

    // Use the same validator as single-insight generation
    return items
      .map((item: any) => toAIInsight(item, item?.symbol || 'unknown'))
      .filter((insight): insight is AIInsight => insight !== null);
  } catch (error: any) {
    console.error(`[AI Service] Batch analysis failed (${provider}):`, error.message);
    throw error;
  }
}
