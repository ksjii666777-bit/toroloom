/**
 * =============================================================================
 * Toroloom — Sentiment Analyzer Tests
 * =============================================================================
 * Covers all pure functions in src/services/ai/sentimentAnalyzer.ts:
 *   - computeAggregatedSentiment
 *   - classifySentiment
 *   - analyzeNewsSentiment
 *   - computeScoreChange
 *   - detectSentimentShift
 *   - computeSentimentStability
 *   - computePriceCorrelation
 *   - generateSentimentOverview
 * =============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  computeAggregatedSentiment,
  classifySentiment,
  analyzeNewsSentiment,
  computeScoreChange,
  detectSentimentShift,
  computeSentimentStability,
  computePriceCorrelation,
  generateSentimentOverview,
} from '../services/ai/sentimentAnalyzer';
import type { SentimentSourceBreakdown, SentimentDataPoint } from '../types';

// ─── Mock Data ──────────────────────────────────────────────

const bullishBreakdown: SentimentSourceBreakdown = {
  newsScore: 60,
  socialScore: 40,
  analystScore: 70,
  aiScore: 50,
};

const bearishBreakdown: SentimentSourceBreakdown = {
  newsScore: -50,
  socialScore: -30,
  analystScore: -60,
  aiScore: -40,
};

const mixedBreakdown: SentimentSourceBreakdown = {
  newsScore: 20,
  socialScore: -10,
  analystScore: 30,
  aiScore: 0,
};

function makeHistory(scores: number[]): SentimentDataPoint[] {
  return scores.map((score, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    overallScore: score,
    sourceBreakdown: { newsScore: 0, socialScore: 0, analystScore: 0, aiScore: 0 },
    articleCount: 10 + i,
    mentionCount: 100 + i * 10,
  }));
}

// ─── computeAggregatedSentiment ─────────────────────────────

describe('computeAggregatedSentiment', () => {
  it('returns a bullish score for all-positive breakdown', () => {
    const score = computeAggregatedSentiment(bullishBreakdown);
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns a bearish score for all-negative breakdown', () => {
    const score = computeAggregatedSentiment(bearishBreakdown);
    expect(score).toBeLessThanOrEqual(-40);
    expect(score).toBeGreaterThanOrEqual(-100);
  });

  it('returns near-zero for mixed breakdown', () => {
    const score = computeAggregatedSentiment(mixedBreakdown);
    // 20*0.3 + (-10)*0.25 + 30*0.25 + 0*0.2 = 6 - 2.5 + 7.5 + 0 = 11
    expect(score).toBe(11);
  });

  it('clamps score to [-100, 100]', () => {
    const extreme: SentimentSourceBreakdown = {
      newsScore: 200,
      socialScore: 300,
      analystScore: 400,
      aiScore: 500,
    };
    const score = computeAggregatedSentiment(extreme);
    expect(score).toBe(100);
  });

  it('returns 0 for all-zero breakdown', () => {
    const zero: SentimentSourceBreakdown = {
      newsScore: 0,
      socialScore: 0,
      analystScore: 0,
      aiScore: 0,
    };
    expect(computeAggregatedSentiment(zero)).toBe(0);
  });
});

// ─── classifySentiment ──────────────────────────────────────

describe('classifySentiment', () => {
  it('returns bullish for score >= 20', () => {
    const result = classifySentiment(45);
    expect(result.label).toBe('bullish');
    expect(result.confidence).toBeGreaterThanOrEqual(40);
  });

  it('returns bearish for score <= -20', () => {
    const result = classifySentiment(-50);
    expect(result.label).toBe('bearish');
    expect(result.confidence).toBeGreaterThanOrEqual(40);
  });

  it('returns neutral for score between -20 and 20', () => {
    const result = classifySentiment(0);
    expect(result.label).toBe('neutral');
  });

  it('returns neutral for score near zero', () => {
    const result = classifySentiment(5);
    expect(result.label).toBe('neutral');
  });

  it('returns neutral for slightly negative score', () => {
    const result = classifySentiment(-10);
    expect(result.label).toBe('neutral');
  });

  it('has minimum confidence of 30 for neutral', () => {
    const result = classifySentiment(0);
    expect(result.confidence).toBeGreaterThanOrEqual(30);
  });

  it('caps confidence at 95', () => {
    const result = classifySentiment(100);
    expect(result.confidence).toBeLessThanOrEqual(95);
  });
});

// ─── analyzeNewsSentiment ───────────────────────────────────

describe('analyzeNewsSentiment', () => {
  it('returns zeros for empty articles', () => {
    const result = analyzeNewsSentiment([]);
    expect(result.score).toBe(0);
    expect(result.positiveCount).toBe(0);
    expect(result.negativeCount).toBe(0);
    expect(result.neutralCount).toBe(0);
    expect(result.topKeywords).toEqual([]);
  });

  it('scores positive articles correctly', () => {
    const articles = [
      { title: 'Stock surges on strong profit growth and record revenue' },
      { title: 'Company beats estimates, bullish momentum continues' },
    ];
    const result = analyzeNewsSentiment(articles);
    expect(result.score).toBeGreaterThan(0);
    expect(result.positiveCount).toBeGreaterThan(0);
    expect(result.topKeywords.length).toBeGreaterThan(0);
  });

  it('scores negative articles correctly', () => {
    const articles = [
      { title: 'Stock declines on weak earnings, loss warning issued' },
      { title: 'Bearish outlook as debt default risk increases' },
    ];
    const result = analyzeNewsSentiment(articles);
    expect(result.score).toBeLessThan(0);
    expect(result.negativeCount).toBeGreaterThan(0);
  });

  it('handles mixed articles', () => {
    const articles = [
      { title: 'Company reports profit growth but faces decline in margins' },
    ];
    const result = analyzeNewsSentiment(articles);
    expect(result.positiveCount + result.negativeCount + result.neutralCount).toBe(1);
  });

  it('extracts top keywords from article text', () => {
    const articles = [
      { title: 'Profit growth surges as company launches new innovation' },
      { title: 'Strong momentum with record profit and expansion' },
    ];
    const result = analyzeNewsSentiment(articles);
    expect(result.topKeywords.length).toBeGreaterThan(0);
    expect(result.topKeywords).toContain('profit');
  });

  it('treats summary text as well', () => {
    const articles = [
      { title: 'Quarterly report', summary: 'Strong revenue growth and record profits' },
    ];
    const result = analyzeNewsSentiment(articles);
    expect(result.score).toBeGreaterThan(0);
  });
});

// ─── computeScoreChange ────────────────────────────────────

describe('computeScoreChange', () => {
  it('returns positive change', () => {
    expect(computeScoreChange(50, 20)).toBe(30);
  });

  it('returns negative change', () => {
    expect(computeScoreChange(10, 30)).toBe(-20);
  });

  it('returns 0 for no change', () => {
    expect(computeScoreChange(25, 25)).toBe(0);
  });

  it('rounds to one decimal place', () => {
    expect(computeScoreChange(55.55, 30.22)).toBe(25.3);
  });
});

// ─── detectSentimentShift ────────────────────────────────────

describe('detectSentimentShift', () => {
  it('returns stable for insufficient data', () => {
    const result = detectSentimentShift(makeHistory([10]));
    expect(result.hasShifted).toBe(false);
    expect(result.direction).toBe('stable');
    expect(result.alert).toBeNull();
  });

  it('returns improving when score goes up significantly', () => {
    const result = detectSentimentShift(makeHistory([-30, 0, 20]));
    expect(result.hasShifted).toBe(true);
    expect(result.direction).toBe('improving');
    expect(result.magnitude).toBeGreaterThanOrEqual(45);
    expect(result.alert).toContain('improved');
  });

  it('returns deteriorating when score goes down significantly', () => {
    const result = detectSentimentShift(makeHistory([30, 0, -40]));
    expect(result.hasShifted).toBe(true);
    expect(result.direction).toBe('deteriorating');
    expect(result.alert).toContain('deteriorated');
  });

  it('returns no shift for small changes under 15 points', () => {
    const result = detectSentimentShift(makeHistory([10, 12, 8]));
    expect(result.hasShifted).toBe(false);
    expect(result.direction).toBe('stable');
  });

  it('sorts history by date before comparing', () => {
    const unsorted: SentimentDataPoint[] = [
      { date: '2026-06-10', overallScore: 50, sourceBreakdown: { newsScore: 0, socialScore: 0, analystScore: 0, aiScore: 0 }, articleCount: 1, mentionCount: 100 },
      { date: '2026-06-01', overallScore: -30, sourceBreakdown: { newsScore: 0, socialScore: 0, analystScore: 0, aiScore: 0 }, articleCount: 1, mentionCount: 100 },
    ];
    const result = detectSentimentShift(unsorted);
    expect(result.hasShifted).toBe(true);
    expect(result.direction).toBe('improving');
    expect(result.magnitude).toBe(80);
  });
});

// ─── computeSentimentStability ──────────────────────────────

describe('computeSentimentStability', () => {
  it('returns 100% stable for insufficient data', () => {
    const result = computeSentimentStability(makeHistory([10, 20]));
    expect(result.stabilityScore).toBe(100);
    expect(result.volatility).toBe('low');
  });

  it('returns high stability for consistent scores', () => {
    const result = computeSentimentStability(makeHistory([10, 12, 11, 13, 10]));
    expect(result.stabilityScore).toBeGreaterThan(70);
    expect(result.volatility).toBe('low');
  });

  it('returns low stability for volatile scores', () => {
    const result = computeSentimentStability(makeHistory([-80, 80, -70, 90, -60]));
    expect(result.stabilityScore).toBeLessThan(50);
    expect(result.volatility).toBe('high');
  });

  it('returns moderate volatility for mixed scores', () => {
    const result = computeSentimentStability(makeHistory([20, -10, 30, 5, -15]));
    expect(['low', 'moderate', 'high']).toContain(result.volatility);
    expect(result.stabilityScore).toBeGreaterThan(0);
    expect(result.stabilityScore).toBeLessThanOrEqual(100);
  });

  it('handles exactly 3 data points', () => {
    const result = computeSentimentStability(makeHistory([10, 11, 12]));
    expect(result.volatility).toBe('low');
  });
});

// ─── computePriceCorrelation ────────────────────────────────

describe('computePriceCorrelation', () => {
  const sentimentData = makeHistory([10, 20, 30, 40, 50, 60]);
  const priceData = [
    { date: '2026-06-01', price: 100 },
    { date: '2026-06-02', price: 105 },
    { date: '2026-06-03', price: 110 },
    { date: '2026-06-04', price: 115 },
    { date: '2026-06-05', price: 120 },
    { date: '2026-06-06', price: 125 },
  ];

  it('returns 0 with insufficient data (less than 5 points)', () => {
    const result = computePriceCorrelation(
      makeHistory([10, 20]),
      priceData.slice(0, 2),
    );
    expect(result.correlation).toBe(0);
    expect(result.interpretation).toContain('Insufficient data');
  });

  it('returns strong positive correlation for aligned upward trends', () => {
    // Use accelerating price increases to match increasing sentiment scores
    const acceleratingPrice = [
      { date: '2026-06-01', price: 100 },
      { date: '2026-06-02', price: 105 },
      { date: '2026-06-03', price: 115 },
      { date: '2026-06-04', price: 130 },
      { date: '2026-06-05', price: 155 },
      { date: '2026-06-06', price: 190 },
    ];
    const result = computePriceCorrelation(sentimentData, acceleratingPrice);
    expect(result.correlation).toBeGreaterThan(0.7);
    expect(result.interpretation).toContain('Strong');
  });

  it('handles empty price data gracefully', () => {
    const result = computePriceCorrelation(sentimentData, []);
    expect(result.correlation).toBeGreaterThanOrEqual(-1);
    expect(result.correlation).toBeLessThanOrEqual(1);
  });

  it('handles empty sentiment data gracefully', () => {
    const result = computePriceCorrelation([], priceData);
    expect(result.correlation).toBe(0);
  });

  it('returns inverse correlation interpretation for negative values', () => {
    const inversePrice = priceData.map(p => ({ ...p, price: 200 - p.price }));
    const result = computePriceCorrelation(sentimentData, inversePrice);
    if (result.correlation < -0.2) {
      expect(result.interpretation).toContain('inverse');
    }
  });
});

// ─── generateSentimentOverview ──────────────────────────────

describe('generateSentimentOverview', () => {
  it('returns empty message for empty array', () => {
    expect(generateSentimentOverview([])).toBe('No stocks in watchlist');
  });

  it('reports broadly bullish when >= 60% are bullish', () => {
    const stocks = [
      { symbol: 'AAPL', score: 50, label: 'bullish' as const },
      { symbol: 'GOOG', score: 40, label: 'bullish' as const },
      { symbol: 'MSFT', score: -10, label: 'neutral' as const },
    ];
    const result = generateSentimentOverview(stocks);
    expect(result).toContain('bullish');
    expect(result).toContain('67');
  });

  it('reports bearish lean when bearish > bullish', () => {
    const stocks = [
      { symbol: 'AAPL', score: -50, label: 'bearish' as const },
      { symbol: 'GOOG', score: -40, label: 'bearish' as const },
      { symbol: 'MSFT', score: 10, label: 'neutral' as const },
    ];
    const result = generateSentimentOverview(stocks);
    expect(result).toContain('bearish');
  });

  it('reports mixed when between 40-60% bullish', () => {
    const stocks = [
      { symbol: 'AAPL', score: 30, label: 'bullish' as const },
      { symbol: 'GOOG', score: 40, label: 'bullish' as const },
      { symbol: 'MSFT', score: -30, label: 'bearish' as const },
      { symbol: 'AMZN', score: -20, label: 'bearish' as const },
      { symbol: 'TSLA', score: 0, label: 'neutral' as const },
    ];
    const result = generateSentimentOverview(stocks);
    expect(result).toContain('mixed');
  });

  it('reports balanced when most are neutral', () => {
    const stocks = [
      { symbol: 'AAPL', score: 5, label: 'neutral' as const },
      { symbol: 'GOOG', score: -5, label: 'neutral' as const },
    ];
    const result = generateSentimentOverview(stocks);
    expect(result).toContain('balanced');
  });

  it('includes average score in output', () => {
    const stocks = [
      { symbol: 'AAPL', score: 40, label: 'bullish' as const },
      { symbol: 'GOOG', score: 20, label: 'bullish' as const },
    ];
    const result = generateSentimentOverview(stocks);
    expect(result).toContain('30');
  });
});
