/**
 * ============================================================================
 * Toroloom — Sentiment Live Feed Service
 * ============================================================================
 *
 * Generates simulated real-time sentiment change events for the HomeScreen
 * live feed section. Each event represents a detected sentiment shift for a
 * stock from a specific source (news, social, analyst, or AI).
 *
 * All functions are pure — no side effects, no API calls.
 * ============================================================================
 */

import { mockSentimentData } from '../../constants/mockData';

// ─── Types ─────────────────────────────────────────────────

export interface LiveFeedEvent {
  id: string;
  symbol: string;
  stockName: string;
  sector: string;
  direction: 'improving' | 'deteriorating';
  magnitude: number;       // Score change magnitude
  score: number;           // Current overall score
  previousScore: number;   // Previous overall score
  source: 'news' | 'social' | 'analyst' | 'ai';
  message: string;
  timestamp: string;
  read: boolean;
}

const SOURCE_LABELS: Record<LiveFeedEvent['source'], string> = {
  news: 'News',
  social: 'Social',
  analyst: 'Analyst',
  ai: 'AI',
};

const SOURCE_ICONS: Record<LiveFeedEvent['source'], string> = {
  news: 'newspaper',
  social: 'chatbubbles',
  analyst: 'analytics',
  ai: 'bulb',
};

/** Get human-readable source label */
export function getSourceLabel(source: LiveFeedEvent['source']): string {
  return SOURCE_LABELS[source] ?? 'Unknown';
}

/** Get icon name for source */
export function getSourceIcon(source: LiveFeedEvent['source']): string {
  return SOURCE_ICONS[source] ?? 'pulse';
}

/** Format a relative timestamp like "just now", "2m ago", "1h ago" */
export function formatFeedTimestamp(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Generate a deterministic-ish random score change for a stock */
function randomScoreDelta(symbol: string, seed: number): number {
  // Use a simple hash of symbol + seed to produce deterministic variance
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = ((hash << 5) - hash) + symbol.charCodeAt(i);
    hash |= 0;
  }
  const pseudoRand = Math.abs(Math.sin(hash * 9301 + seed * 49297) % 1);
  // Range: 3-18 points, biased toward smaller changes
  return Math.round(3 + pseudoRand * 15);
}

/** Available stock symbols for generating events */
const FEED_STOCKS = mockSentimentData.map(s => ({
  symbol: s.symbol,
  name: s.name,
  sector: s.sector,
  currentScore: s.currentScore,
}));

const SOURCES: LiveFeedEvent['source'][] = ['news', 'social', 'analyst', 'ai'];

/** Message templates for improving sentiment */
const IMPROVING_TEMPLATES = [
  (name: string, pts: number, src: string) =>
    `${name} sentiment rising ${pts}pts on ${src.toLowerCase()} buzz`,
  (name: string, pts: number, src: string) =>
    `${src} indicators positive for ${name} — up ${pts}pts`,
  (name: string, pts: number) =>
    `${name} gaining bullish momentum, +${pts}pts across sources`,
  (name: string, pts: number, src: string) =>
    `${src} sentiment upgrade for ${name} (+${pts}pts)`,
  (name: string, pts: number) =>
    `Positive shift detected for ${name} — ${pts}pt improvement`,
];

/** Message templates for deteriorating sentiment */
const DETERIORATING_TEMPLATES = [
  (name: string, pts: number, src: string) =>
    `${name} sentiment slipping ${pts}pts on ${src.toLowerCase()} chatter`,
  (name: string, pts: number, src: string) =>
    `${src} signals turning cautious on ${name} (${pts}pts)`,
  (name: string, pts: number) =>
    `${name} showing bearish pressure, down ${pts}pts`,
  (name: string, pts: number, src: string) =>
    `${src} downgrade for ${name} (${pts}pts decline)`,
  (name: string, pts: number) =>
    `Negative sentiment shift for ${name} — ${pts}pt drop`,
];

/** Generate a single live feed event for a random stock */
export function generateRandomFeedEvent(eventIndex: number): LiveFeedEvent {
  const stock = FEED_STOCKS[eventIndex % FEED_STOCKS.length];
  const direction: 'improving' | 'deteriorating' =
    (eventIndex + stock.symbol.length) % 3 === 0 ? 'deteriorating' : 'improving';
  const magnitude = randomScoreDelta(stock.symbol, eventIndex);
  const source = SOURCES[eventIndex % SOURCES.length];
  const scoreDelta = direction === 'improving' ? magnitude : -magnitude;
  const previousScore = stock.currentScore;
  const score = Math.max(-100, Math.min(100, previousScore + scoreDelta));

  const templates = direction === 'improving' ? IMPROVING_TEMPLATES : DETERIORATING_TEMPLATES;
  const template = templates[eventIndex % templates.length];
  const message = template(stock.name, magnitude, getSourceLabel(source));

  // Simulate events spread over the past hour
  const agoMs = Math.min(eventIndex * 3000 + Math.floor(Math.random() * 2000), 3600000);

  return {
    id: `lfe_${eventIndex}_${Date.now()}`,
    symbol: stock.symbol,
    stockName: stock.name,
    sector: stock.sector,
    direction,
    magnitude,
    score,
    previousScore,
    source,
    message,
    timestamp: new Date(Date.now() - agoMs).toISOString(),
    read: false,
  };
}

/** Generate initial batch of feed events (most recent first) */
export function generateInitialFeedEvents(count: number = 10): LiveFeedEvent[] {
  const events: LiveFeedEvent[] = [];
  for (let i = count - 1; i >= 0; i--) {
    events.push(generateRandomFeedEvent(i));
  }
  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
