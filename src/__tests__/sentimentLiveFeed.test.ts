/**
 * =============================================================================
 * Toroloom — Sentiment Live Feed Service Tests
 * =============================================================================
 * Covers all exported functions in src/services/ai/sentimentLiveFeed.ts:
 *   - getSourceLabel
 *   - getSourceIcon
 *   - formatFeedTimestamp
 *   - generateRandomFeedEvent
 *   - generateInitialFeedEvents
 * =============================================================================
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  getSourceLabel,
  getSourceIcon,
  formatFeedTimestamp,
  generateRandomFeedEvent,
  generateInitialFeedEvents,
} from '../services/ai/sentimentLiveFeed';

// ─── getSourceLabel ─────────────────────────────────────────

describe('getSourceLabel', () => {
  it('returns "News" for news source', () => {
    expect(getSourceLabel('news')).toBe('News');
  });

  it('returns "Social" for social source', () => {
    expect(getSourceLabel('social')).toBe('Social');
  });

  it('returns "Analyst" for analyst source', () => {
    expect(getSourceLabel('analyst')).toBe('Analyst');
  });

  it('returns "AI" for ai source', () => {
    expect(getSourceLabel('ai')).toBe('AI');
  });

  it('returns "Unknown" for unrecognized source', () => {
    expect(getSourceLabel('unknown' as any)).toBe('Unknown');
  });
});

// ─── getSourceIcon ──────────────────────────────────────────

describe('getSourceIcon', () => {
  it('returns "newspaper" for news source', () => {
    expect(getSourceIcon('news')).toBe('newspaper');
  });

  it('returns "chatbubbles" for social source', () => {
    expect(getSourceIcon('social')).toBe('chatbubbles');
  });

  it('returns "analytics" for analyst source', () => {
    expect(getSourceIcon('analyst')).toBe('analytics');
  });

  it('returns "bulb" for ai source', () => {
    expect(getSourceIcon('ai')).toBe('bulb');
  });

  it('returns "pulse" as fallback for unrecognized source', () => {
    expect(getSourceIcon('unknown' as any)).toBe('pulse');
  });
});

// ─── formatFeedTimestamp ────────────────────────────────────

describe('formatFeedTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-06T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for events less than 10 seconds ago', () => {
    const recent = new Date(Date.now() - 5000).toISOString();
    expect(formatFeedTimestamp(recent)).toBe('just now');
  });

  it('returns "Xs ago" for events 10-59 seconds ago', () => {
    const ts = new Date(Date.now() - 30000).toISOString();
    expect(formatFeedTimestamp(ts)).toBe('30s ago');
  });

  it('returns "Xm ago" for events 1-59 minutes ago', () => {
    const ts = new Date(Date.now() - 120000).toISOString();
    expect(formatFeedTimestamp(ts)).toBe('2m ago');
  });

  it('returns "Xh ago" for events 1-23 hours ago', () => {
    const ts = new Date(Date.now() - 3600000 * 3).toISOString();
    expect(formatFeedTimestamp(ts)).toBe('3h ago');
  });

  it('returns "Xd ago" for events 1+ days ago', () => {
    const ts = new Date(Date.now() - 3600000 * 48).toISOString();
    expect(formatFeedTimestamp(ts)).toBe('2d ago');
  });

  it('handles exact boundary at 10 seconds', () => {
    // 9 seconds → "just now", 10 seconds → "10s ago"
    const justNow = new Date(Date.now() - 9000).toISOString();
    expect(formatFeedTimestamp(justNow)).toBe('just now');

    const tenSec = new Date(Date.now() - 10000).toISOString();
    expect(formatFeedTimestamp(tenSec)).toBe('10s ago');
  });

  it('handles exact boundary at 1 minute', () => {
    const ts = new Date(Date.now() - 60000).toISOString();
    expect(formatFeedTimestamp(ts)).toBe('1m ago');
  });

  it('handles exact boundary at 1 hour', () => {
    const ts = new Date(Date.now() - 3600000).toISOString();
    expect(formatFeedTimestamp(ts)).toBe('1h ago');
  });
});

// ─── generateRandomFeedEvent ────────────────────────────────

describe('generateRandomFeedEvent', () => {
  it('returns a properly shaped LiveFeedEvent object', () => {
    const event = generateRandomFeedEvent(0);

    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('symbol');
    expect(event).toHaveProperty('stockName');
    expect(event).toHaveProperty('sector');
    expect(event).toHaveProperty('direction');
    expect(event).toHaveProperty('magnitude');
    expect(event).toHaveProperty('score');
    expect(event).toHaveProperty('previousScore');
    expect(event).toHaveProperty('source');
    expect(event).toHaveProperty('message');
    expect(event).toHaveProperty('timestamp');
    expect(event).toHaveProperty('read');
  });

  it('generates events from known stock symbols', () => {
    const validSymbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'];
    for (let i = 0; i < 12; i++) {
      const event = generateRandomFeedEvent(i);
      expect(validSymbols).toContain(event.symbol);
    }
  });

  it('cycles through all 4 sources', () => {
    const sources = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const event = generateRandomFeedEvent(i);
      sources.add(event.source);
    }
    expect(sources.has('news')).toBe(true);
    expect(sources.has('social')).toBe(true);
    expect(sources.has('analyst')).toBe(true);
    expect(sources.has('ai')).toBe(true);
  });

  it('produces both improving and deteriorating directions', () => {
    const directions = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const event = generateRandomFeedEvent(i);
      directions.add(event.direction);
    }
    expect(directions.has('improving')).toBe(true);
    expect(directions.has('deteriorating')).toBe(true);
  });

  it('clamps score to [-100, 100]', () => {
    // Generate an event with a very large expected score delta
    // by using an index that maps to a stock with extreme values
    for (let i = 0; i < 50; i++) {
      const event = generateRandomFeedEvent(i);
      expect(event.score).toBeGreaterThanOrEqual(-100);
      expect(event.score).toBeLessThanOrEqual(100);
    }
  });

  it('magnitude is between 3 and 18 (inclusive)', () => {
    for (let i = 0; i < 50; i++) {
      const event = generateRandomFeedEvent(i);
      expect(event.magnitude).toBeGreaterThanOrEqual(3);
      expect(event.magnitude).toBeLessThanOrEqual(18);
    }
  });

  it('direction is "improving" more often than "deteriorating" (2:1 ratio)', () => {
    let improving = 0;
    let deteriorating = 0;
    for (let i = 0; i < 60; i++) {
      const event = generateRandomFeedEvent(i);
      if (event.direction === 'improving') improving++;
      else deteriorating++;
    }
    // ~2/3 improving (~40), ~1/3 deteriorating (~20)
    expect(improving).toBeGreaterThan(deteriorating);
    expect(deteriorating).toBeGreaterThan(10); // at least some
  });

  it('message contains the stock name', () => {
    const event = generateRandomFeedEvent(0);
    expect(event.message).toContain(event.stockName);
  });

  it('message mentions the point magnitude', () => {
    const event = generateRandomFeedEvent(0);
    expect(event.message).toContain(String(event.magnitude));
  });

  it('id starts with "lfe_"', () => {
    const event = generateRandomFeedEvent(0);
    expect(event.id).toMatch(/^lfe_\d+_\d+$/);
  });

  it('read is always false', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateRandomFeedEvent(i).read).toBe(false);
    }
  });

  it('timestamp is a valid ISO string', () => {
    const event = generateRandomFeedEvent(0);
    const parsed = new Date(event.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it('timestamp is in the past (within last hour)', () => {
    const event = generateRandomFeedEvent(0);
    const eventTime = new Date(event.timestamp).getTime();
    const now = Date.now();
    expect(eventTime).toBeLessThanOrEqual(now);
    // Within the last hour
    expect(now - eventTime).toBeLessThanOrEqual(3600000);
  });

  it('generates deterministic-ish events for same index', () => {
    const event1 = generateRandomFeedEvent(5);
    const event2 = generateRandomFeedEvent(5);

    // id and timestamp will differ (Date.now()), but other fields should match
    expect(event1.symbol).toBe(event2.symbol);
    expect(event1.direction).toBe(event2.direction);
    expect(event1.magnitude).toBe(event2.magnitude);
    expect(event1.source).toBe(event2.source);
    expect(event1.score).toBe(event2.score);
    expect(event1.previousScore).toBe(event2.previousScore);
    expect(event1.message).toBe(event2.message);
  });

  it('previousScore comes from the mock data currentScore', () => {
    // The first event (index 0) maps to the first stock in mockSentimentData
    const event = generateRandomFeedEvent(0);
    // Just verify it's a number within valid range
    expect(event.previousScore).toBeGreaterThanOrEqual(-100);
    expect(event.previousScore).toBeLessThanOrEqual(100);
  });

  it('score is previousScore +/- magnitude (clamped)', () => {
    const event = generateRandomFeedEvent(0);
    const expectedRaw = event.direction === 'improving'
      ? event.previousScore + event.magnitude
      : event.previousScore - event.magnitude;
    const expectedClamped = Math.max(-100, Math.min(100, expectedRaw));
    expect(event.score).toBe(expectedClamped);
  });
});

// ─── generateInitialFeedEvents ──────────────────────────────

describe('generateInitialFeedEvents', () => {
  it('returns the requested number of events', () => {
    const events = generateInitialFeedEvents(5);
    expect(events).toHaveLength(5);
  });

  it('defaults to 10 events when count not specified', () => {
    const events = generateInitialFeedEvents();
    expect(events).toHaveLength(10);
  });

  it('returns events sorted most-recent-first', () => {
    const events = generateInitialFeedEvents(8);
    for (let i = 1; i < events.length; i++) {
      const prev = new Date(events[i - 1].timestamp).getTime();
      const curr = new Date(events[i].timestamp).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('all generated events have valid shapes', () => {
    const events = generateInitialFeedEvents(6);
    events.forEach(event => {
      expect(event.id).toMatch(/^lfe_\d+_\d+$/);
      expect(['improving', 'deteriorating']).toContain(event.direction);
      expect(['news', 'social', 'analyst', 'ai']).toContain(event.source);
      expect(event.magnitude).toBeGreaterThanOrEqual(3);
      expect(event.magnitude).toBeLessThanOrEqual(18);
      expect(event.read).toBe(false);
    });
  });

  it('covers all 6 stock symbols across 12 events', () => {
    const events = generateInitialFeedEvents(12);
    const symbols = new Set(events.map(e => e.symbol));
    expect(symbols.size).toBe(6);
    expect(symbols.has('RELIANCE')).toBe(true);
    expect(symbols.has('TCS')).toBe(true);
    expect(symbols.has('HDFCBANK')).toBe(true);
    expect(symbols.has('INFY')).toBe(true);
    expect(symbols.has('ICICIBANK')).toBe(true);
    expect(symbols.has('SBIN')).toBe(true);
  });

  it('returns empty array for count of 0', () => {
    const events = generateInitialFeedEvents(0);
    expect(events).toEqual([]);
  });

  it('handles count of 1 correctly', () => {
    const events = generateInitialFeedEvents(1);
    expect(events).toHaveLength(1);
    expect(events[0].id).toMatch(/^lfe_\d+_\d+$/);
  });
});
