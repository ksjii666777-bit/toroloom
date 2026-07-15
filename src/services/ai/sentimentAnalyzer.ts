/**
 * ============================================================================
 * Toroloom — Sentiment Analysis Engine
 * ============================================================================
 *
 * Pure functions for computing market sentiment from multiple sources:
 *   - computeAggregatedSentiment(): Combine news, social, analyst, and AI scores
 *   - classifySentiment(): Convert numerical score to label
 *   - analyzeNewsSentiment(): Score a batch of news articles
 *   - computePriceCorrelation(): Measure correlation between sentiment and price
 *   - detectSentimentShift(): Detect significant sentiment changes
 *   - extractKeywords(): Extract trending keywords from articles
 *
 * All functions are pure — no side effects, no API calls.
 * ============================================================================
 */

import type { SentimentSourceBreakdown, SentimentDataPoint} from '../../types';

// ─── Constants ──────────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  'beat', 'surge', 'rally', 'gains', 'profit', 'growth', 'bullish', 'upgrade',
  'outperform', 'positive', 'strong', 'record', 'boost', 'momentum', 'recovery',
  'expansion', 'innovation', 'dividend', 'buyback', 'approved', 'launch',
  'partnership', 'acquisition', 'expansion', 'breakthrough', 'uptrend',
]);

const NEGATIVE_WORDS = new Set([
  'decline', 'loss', 'fall', 'drop', 'bearish', 'downgrade', 'negative',
  'weak', 'debt', 'default', 'lawsuit', 'probe', 'ban', 'penalty', 'crash',
  'plunge', 'selloff', 'red', 'underperform', 'risk', 'warning', 'cut',
  'layoff', 'resignation', 'fraud', 'investigation', 'delay', 'slowdown',
]);

// ─── Helper: Aggregate score from source breakdown ──────────

/**
 * Compute overall sentiment score from source breakdown.
 * Weighted: news (30%), social (25%), analyst (25%), AI (20%).
 */
export function computeAggregatedSentiment(breakdown: SentimentSourceBreakdown): number {
  const weights = {
    newsScore: 0.30,
    socialScore: 0.25,
    analystScore: 0.25,
    aiScore: 0.20,
  };

  const weighted = 
    breakdown.newsScore * weights.newsScore +
    breakdown.socialScore * weights.socialScore +
    breakdown.analystScore * weights.analystScore +
    breakdown.aiScore * weights.aiScore;

  return Math.round(Math.max(-100, Math.min(100, weighted)));
}

// ─── Classify Sentiment ────────────────────────────────────

/**
 * Classify a numerical sentiment score into a label.
 * Score ranges from -100 (extremely bearish) to +100 (extremely bullish).
 */
export function classifySentiment(score: number): {
  label: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
} {
  const absolute = Math.abs(score);
  const confidence = Math.min(95, Math.round(absolute * 0.8 + 15));

  if (score >= 20) return { label: 'bullish', confidence };
  if (score <= -20) return { label: 'bearish', confidence };
  return { label: 'neutral', confidence: Math.max(30, confidence) };
}

// ─── Analyze News Sentiment ─────────────────────────────────

/**
 * Score a batch of news articles and return average sentiment.
 * Uses keyword matching as a simplified scoring approach.
 */
export function analyzeNewsSentiment(articles: { title: string; summary?: string }[]): {
  score: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  topKeywords: string[];
} {
  if (articles.length === 0) {
    return { score: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0, topKeywords: [] };
  }

  let totalScore = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  const keywordFreq = new Map<string, number>();

  for (const article of articles) {
    const text = `${article.title} ${article.summary || ''}`.toLowerCase();
    let articleScore = 0;

    // Count positive and negative word matches
    for (const word of POSITIVE_WORDS) {
      if (text.includes(word)) {
        articleScore += 5;
        keywordFreq.set(word, (keywordFreq.get(word) || 0) + 1);
      }
    }
    for (const word of NEGATIVE_WORDS) {
      if (text.includes(word)) {
        articleScore -= 5;
        keywordFreq.set(word, (keywordFreq.get(word) || 0) + 1);
      }
    }

    // Clamp per-article score to [-100, 100]
    articleScore = Math.max(-100, Math.min(100, articleScore));
    totalScore += articleScore;

    if (articleScore > 10) positiveCount++;
    else if (articleScore < -10) negativeCount++;
    else neutralCount++;
  }

  const avgScore = Math.round(totalScore / articles.length);

  // Get top 10 keywords by frequency
  const topKeywords = Array.from(keywordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return { score: avgScore, positiveCount, negativeCount, neutralCount, topKeywords };
}

// ─── Compute Score Change ─────────────────────────────────

/**
 * Compute the change between current and previous sentiment scores.
 */
export function computeScoreChange(currentScore: number, previousScore: number): number {
  return Math.round((currentScore - previousScore) * 10) / 10;
}

// ─── Detect Sentiment Shift ───────────────────────────────

export interface SentimentShift {
  hasShifted: boolean;
  magnitude: number;    // Absolute change
  direction: 'improving' | 'deteriorating' | 'stable';
  alert: string | null;
}

/**
 * Detect significant sentiment changes over a period.
 * Flags shifts greater than 15 points.
 */
export function detectSentimentShift(
  history: SentimentDataPoint[],
): SentimentShift {
  if (history.length < 2) {
    return { hasShifted: false, magnitude: 0, direction: 'stable', alert: null };
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const first = sorted[0].overallScore;
  const last = sorted[sorted.length - 1].overallScore;
  const magnitude = Math.abs(last - first);

  if (magnitude < 15) {
    return { hasShifted: false, magnitude, direction: 'stable', alert: null };
  }

  const direction = last > first ? 'improving' : 'deteriorating';
  const points = Math.round(magnitude);
  const alert = direction === 'improving'
    ? `Sentiment improved by ${points} points over the period`
    : `Sentiment deteriorated by ${points} points over the period`;

  return { hasShifted: true, magnitude, direction, alert };
}

// ─── Compute Sentiment Stability ──────────────────────────

/**
 * Measure how volatile the sentiment has been over a period.
 * Lower = more stable. Based on standard deviation of daily scores.
 */
export function computeSentimentStability(history: SentimentDataPoint[]): {
  stabilityScore: number;    // 0-100 (higher = more stable)
  volatility: 'low' | 'moderate' | 'high';
} {
  if (history.length < 3) {
    return { stabilityScore: 100, volatility: 'low' };
  }

  const scores = history.map(h => h.overallScore);
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Normalize: stdDev of 0 = 100% stable, stdDev of 50+ = 0% stable
  const stability = Math.max(0, Math.min(100, Math.round(100 - stdDev * 2)));

  const volatility = stdDev < 10 ? 'low' : stdDev < 25 ? 'moderate' : 'high';

  return { stabilityScore: stability, volatility };
}

// ─── Compute Price-Sentiment Correlation ──────────────────

/**
 * Compute a simplified correlation between sentiment scores and price direction.
 * Returns a value from -1 (perfect inverse) to +1 (perfect correlation).
 */
export function computePriceCorrelation(
  sentimentData: SentimentDataPoint[],
  priceData: { date: string; price: number }[],
): { correlation: number; interpretation: string } {
  if (sentimentData.length < 5 || priceData.length < 5) {
    return { correlation: 0, interpretation: 'Insufficient data for correlation' };
  }

  // Build pairs by matching dates
  const priceMap = new Map(priceData.map(p => [p.date, p.price]));
  const pairs: { sentiment: number; priceChange: number }[] = [];

  for (let i = 0; i < sentimentData.length - 1; i++) {
    const currentDate = sentimentData[i].date;
    const nextDate = sentimentData[i + 1].date;
    const currentPrice = priceMap.get(currentDate);
    const nextPrice = priceMap.get(nextDate);

    if (currentPrice && nextPrice && currentPrice > 0) {
      const priceChange = ((nextPrice - currentPrice) / currentPrice) * 100;
      pairs.push({
        sentiment: sentimentData[i].overallScore,
        priceChange,
      });
    }
  }

  if (pairs.length < 3) {
    return { correlation: 0, interpretation: 'Insufficient data pairs' };
  }

  // Pearson correlation
  const n = pairs.length;
  const sumX = pairs.reduce((s, p) => s + p.sentiment, 0);
  const sumY = pairs.reduce((s, p) => s + p.priceChange, 0);
  const sumXY = pairs.reduce((s, p) => s + p.sentiment * p.priceChange, 0);
  const sumX2 = pairs.reduce((s, p) => s + p.sentiment ** 2, 0);
  const sumY2 = pairs.reduce((s, p) => s + p.priceChange ** 2, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));

  const correlation = denominator === 0 ? 0 : Math.max(-1, Math.min(1, numerator / denominator));

  let interpretation: string;
  const abs = Math.abs(correlation);
  if (abs > 0.7) interpretation = 'Strong correlation between sentiment and price';
  else if (abs > 0.4) interpretation = 'Moderate correlation between sentiment and price';
  else if (abs > 0.2) interpretation = 'Weak correlation between sentiment and price';
  else interpretation = 'No significant correlation between sentiment and price';

  if (correlation < 0) interpretation += ' (inverse relationship)';

  return { correlation: Math.round(correlation * 100) / 100, interpretation };
}

// ─── Generate Sentiment Overview ──────────────────────────

/**
 * Generate a summary text for the overall market/stocks sentiment state.
 */
export function generateSentimentOverview(
  stocks: { symbol: string; score: number; label: string }[],
): string {
  if (stocks.length === 0) return 'No stocks in watchlist';

  const bullish = stocks.filter(s => s.label === 'bullish').length;
  const bearish = stocks.filter(s => s.label === 'bearish').length;
  const neutral = stocks.filter(s => s.label === 'neutral').length;
  const avgScore = Math.round(stocks.reduce((s, stock) => s + stock.score, 0) / stocks.length);

  const pct = Math.round((bullish / stocks.length) * 100);

  if (pct >= 60) {
    return `Market sentiment is broadly bullish (${pct}% of stocks). Average score: ${avgScore > 0 ? '+' : ''}${avgScore}.`;
  }
  if (pct >= 40) {
    return `Market sentiment is mixed with a ${bullish > bearish ? 'positive' : 'negative'} bias. ${bullish} bullish, ${bearish} bearish, ${neutral} neutral.`;
  }
  if (bearish > bullish) {
    return `Market sentiment leans bearish (${bearish} bearish vs ${bullish} bullish). Average score: ${avgScore}.`;
  }
  return `Market sentiment is balanced with ${neutral} neutral stocks. Average score: ${avgScore > 0 ? '+' : ''}${avgScore}.`;
}
