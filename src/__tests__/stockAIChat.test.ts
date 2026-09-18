/**
 * ============================================================================
 * Toroloom — Per-Stock AI Chat Response Logic Tests
 * ============================================================================
 *
 * Tests generateStockResponse — the stock-focused response generator used
 * when AI Chat is opened from a stock detail screen (focus mode):
 *   - Price / LTP questions route to the price answer
 *   - Buy / sell / entry / target questions route to trade advice
 *   - News / sentiment questions route to the news prompt
 *   - Fundamentals / valuation questions route to fundamentals guidance
 *   - Anything else falls back to the stock overview
 *   - Name, symbol and formatted price are always passed to i18n
 *   - Matching is case-insensitive
 */

import { describe, it, expect } from 'vitest';
import { generateStockResponse } from '../screens/ai/AIChatScreen';

// Passthrough translator: returns "key|params" so tests can assert exactly
// which i18n key was selected and which interpolation params were passed.
const t = (key: string, params?: Record<string, unknown>) =>
  `${key}|${JSON.stringify(params ?? {})}`;

const STOCK = {
  name: 'Reliance Industries',
  symbol: 'RELIANCE',
  price: 2500,
  sector: 'Energy',
};

function paramsOf(result: string): Record<string, unknown> {
  const json = result.split('|')[1];
  return JSON.parse(json) as Record<string, unknown>;
}

function keyOf(result: string): string {
  return result.split('|')[0];
}

// ==================== Routing ====================

describe('generateStockResponse — routing', () => {
  it('routes price/LTP questions to the price answer', () => {
    expect(keyOf(generateStockResponse('What is the current price?', STOCK, t))).toBe('ai.chatStockPrice');
    expect(keyOf(generateStockResponse('Show me LTP', STOCK, t))).toBe('ai.chatStockPrice');
    expect(keyOf(generateStockResponse('At what level is it trading?', STOCK, t))).toBe('ai.chatStockPrice');
  });

  it('routes buy/sell/entry/target questions to trade advice', () => {
    expect(keyOf(generateStockResponse('Should I buy RELIANCE now?', STOCK, t))).toBe('ai.chatStockAdvice');
    expect(keyOf(generateStockResponse('When should I sell?', STOCK, t))).toBe('ai.chatStockAdvice');
    expect(keyOf(generateStockResponse('What is a good entry point?', STOCK, t))).toBe('ai.chatStockAdvice');
    expect(keyOf(generateStockResponse('What target should I set?', STOCK, t))).toBe('ai.chatStockAdvice');
  });

  it('routes news/sentiment questions to the news prompt', () => {
    expect(keyOf(generateStockResponse('Any latest news?', STOCK, t))).toBe('ai.chatStockNewsPrompt');
    expect(keyOf(generateStockResponse('What is the market sentiment?', STOCK, t))).toBe('ai.chatStockNewsPrompt');
    expect(keyOf(generateStockResponse('Any fresh headlines?', STOCK, t))).toBe('ai.chatStockNewsPrompt');
  });

  it('routes fundamentals/valuation questions to fundamentals guidance', () => {
    expect(keyOf(generateStockResponse('How are the fundamentals?', STOCK, t))).toBe('ai.chatStockFundamentals');
    expect(keyOf(generateStockResponse('Is the valuation reasonable?', STOCK, t))).toBe('ai.chatStockFundamentals');
    expect(keyOf(generateStockResponse('What is the PE ratio?', STOCK, t))).toBe('ai.chatStockFundamentals');
    expect(keyOf(generateStockResponse('How is the balance sheet?', STOCK, t))).toBe('ai.chatStockFundamentals');
  });

  it('falls back to the stock overview for anything else', () => {
    expect(keyOf(generateStockResponse('Tell me about this company', STOCK, t))).toBe('ai.chatStockOverview');
    expect(keyOf(generateStockResponse('hello', STOCK, t))).toBe('ai.chatStockOverview');
  });

  it('matching is case-insensitive', () => {
    expect(keyOf(generateStockResponse('WHAT IS THE PRICE?', STOCK, t))).toBe('ai.chatStockPrice');
    expect(keyOf(generateStockResponse('LATEST NEWS PLEASE', STOCK, t))).toBe('ai.chatStockNewsPrompt');
  });

  it('price questions win over later categories when a query overlaps', () => {
    // "price" branch is checked first — overlapping queries route there
    expect(keyOf(generateStockResponse('news about the price', STOCK, t))).toBe('ai.chatStockPrice');
    // "buy" checked before news
    expect(keyOf(generateStockResponse('should I buy after this news', STOCK, t))).toBe('ai.chatStockAdvice');
  });
});

// ==================== Interpolation params ====================

describe('generateStockResponse — interpolation params', () => {
  it('always passes the stock name, symbol and formatted price', () => {
    const result = generateStockResponse('some random question', STOCK, t);
    const params = paramsOf(result);

    expect(params.name).toBe('Reliance Industries');
    expect(params.symbol).toBe('RELIANCE');
    // formatCurrency output — non-empty string containing the rupee sign
    expect(typeof params.price).toBe('string');
    expect(params.price).toContain('₹');
  });

  it('works without an optional sector field', () => {
    const noSector = { name: 'Test Corp', symbol: 'TEST', price: 100 };
    const result = generateStockResponse('hello', noSector, t);
    const params = paramsOf(result);

    expect(params.name).toBe('Test Corp');
    expect(params.symbol).toBe('TEST');
  });
});
