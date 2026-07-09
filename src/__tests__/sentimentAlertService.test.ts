/**
 * =============================================================================
 * Toroloom — Sentiment Alert Service Tests
 * =============================================================================
 * Covers all exported functions in src/services/ai/sentimentAlertService.ts:
 *   - getSensitivityThreshold
 *   - getSensitivityLabel
 *   - evaluateRule
 *   - evaluateAllRules
 *   - generateAlertMessage
 *   - createTriggerRecord
 *   - createDefaultRule
 *   - getMockAlertRules / getMockAlertTriggers
 * =============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  getSensitivityThreshold,
  getSensitivityLabel,
  evaluateRule,
  evaluateAllRules,
  generateAlertMessage,
  createTriggerRecord,
  createDefaultRule,
  getMockAlertRules,
  getMockAlertTriggers,
} from '../services/ai/sentimentAlertService';
import type { SentimentAlertRule, SentimentDataPoint } from '../types';

// ─── Mock Data ──────────────────────────────────────────────

function makeHistory(scores: number[]): SentimentDataPoint[] {
  return scores.map((score, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    overallScore: score,
    sourceBreakdown: { newsScore: 0, socialScore: 0, analystScore: 0, aiScore: 0 },
    articleCount: 10,
    mentionCount: 100,
  }));
}

function makeRule(overrides: Partial<SentimentAlertRule> = {}): SentimentAlertRule {
  return {
    id: 'test_rule_1',
    symbol: 'RELIANCE',
    stockName: 'Reliance Industries Ltd.',
    sector: 'Energy',
    sensitivity: 'medium',
    direction: 'both',
    triggered: false,
    enabled: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── getSensitivityThreshold ────────────────────────────────

describe('getSensitivityThreshold', () => {
  it('returns 25 for low sensitivity', () => {
    expect(getSensitivityThreshold('low')).toBe(25);
  });

  it('returns 15 for medium sensitivity', () => {
    expect(getSensitivityThreshold('medium')).toBe(15);
  });

  it('returns 10 for high sensitivity', () => {
    expect(getSensitivityThreshold('high')).toBe(10);
  });

  it('defaults to 15 for unknown sensitivity', () => {
    expect(getSensitivityThreshold('unknown')).toBe(15);
  });
});

// ─── getSensitivityLabel ────────────────────────────────────

describe('getSensitivityLabel', () => {
  it('returns label for low', () => {
    const label = getSensitivityLabel('low');
    expect(label).toContain('Large');
  });

  it('returns label for medium', () => {
    const label = getSensitivityLabel('medium');
    expect(label).toContain('Moderate');
  });

  it('returns label for high', () => {
    const label = getSensitivityLabel('high');
    expect(label).toContain('noticeable');
  });
});

// ─── evaluateRule ───────────────────────────────────────────

describe('evaluateRule', () => {
  it('returns null for disabled rule', () => {
    const rule = makeRule({ enabled: false });
    expect(evaluateRule(rule, makeHistory([0, 30]))).toBeNull();
  });

  it('returns null for already triggered rule', () => {
    const rule = makeRule({ triggered: true });
    expect(evaluateRule(rule, makeHistory([0, 30]))).toBeNull();
  });

  it('returns null for insufficient history', () => {
    const rule = makeRule();
    expect(evaluateRule(rule, makeHistory([10]))).toBeNull();
  });

  it('returns null for shift below sensitivity threshold', () => {
    const rule = makeRule({ sensitivity: 'low' }); // 25pt threshold
    expect(evaluateRule(rule, makeHistory([0, 10, 20]))).toBeNull(); // only 20pt shift
  });

  it('returns improving result for large positive shift', () => {
    const rule = makeRule({ sensitivity: 'medium', direction: 'both' });
    const result = evaluateRule(rule, makeHistory([0, 50]));
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('improving');
    expect(result!.magnitude).toBeGreaterThanOrEqual(45);
  });

  it('returns deteriorating result for large negative shift', () => {
    const rule = makeRule({ sensitivity: 'medium', direction: 'both' });
    const result = evaluateRule(rule, makeHistory([30, -30]));
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('deteriorating');
    expect(result!.magnitude).toBeGreaterThanOrEqual(55);
  });

  it('filters by direction', () => {
    const rule = makeRule({ sensitivity: 'medium', direction: 'improving' });
    // Deteriorating shift should not trigger
    expect(evaluateRule(rule, makeHistory([30, -20]))).toBeNull();
    // Improving shift should trigger
    const result = evaluateRule(rule, makeHistory([-20, 30]));
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('improving');
  });

  it('triggers for both directions when direction is both', () => {
    const rule = makeRule({ sensitivity: 'medium', direction: 'both' });
    expect(evaluateRule(rule, makeHistory([-30, 20]))).not.toBeNull();
    expect(evaluateRule(rule, makeHistory([30, -20]))).not.toBeNull();
  });

  it('returns previous and current scores', () => {
    const rule = makeRule();
    const result = evaluateRule(rule, makeHistory([10, 40]));
    expect(result!.previousScore).toBe(10);
    expect(result!.score).toBe(40);
  });
});

// ─── evaluateAllRules ───────────────────────────────────────

describe('evaluateAllRules', () => {
  it('returns empty array for empty rules', () => {
    const results = evaluateAllRules([], new Map());
    expect(results).toEqual([]);
  });

  it('evaluates multiple rules and returns only triggered ones', () => {
    const rules = [
      makeRule({ id: 'r1', symbol: 'RELIANCE', sensitivity: 'medium', direction: 'both', enabled: true, triggered: false }),
      makeRule({ id: 'r2', symbol: 'TCS', sensitivity: 'medium', direction: 'both', enabled: true, triggered: false }),
    ];
    const sentimentMap = new Map<string, SentimentDataPoint[]>();
    sentimentMap.set('RELIANCE', makeHistory([-20, 40]));  // 60pt → triggers
    sentimentMap.set('TCS', makeHistory([0, 5]));          // 5pt → doesn't trigger

    const results = evaluateAllRules(rules, sentimentMap);
    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('r1');
  });

  it('skips rules with no sentiment data', () => {
    const rules = [makeRule({ symbol: 'MISSING' })];
    const results = evaluateAllRules(rules, new Map());
    expect(results).toEqual([]);
  });
});

// ─── generateAlertMessage ───────────────────────────────────

describe('generateAlertMessage', () => {
  it('generates message for improving sentiment', () => {
    const rule = makeRule();
    const msg = generateAlertMessage(rule, { magnitude: 25, direction: 'improving', score: 40, previousScore: 15 });
    expect(msg).toContain('📈');
    expect(msg).toContain('Reliance');
    expect(msg).toContain('improving');
    expect(msg).toContain('25');
  });

  it('generates message for deteriorating sentiment', () => {
    const rule = makeRule();
    const msg = generateAlertMessage(rule, { magnitude: 30, direction: 'deteriorating', score: -20, previousScore: 10 });
    expect(msg).toContain('📉');
    expect(msg).toContain('deteriorating');
    expect(msg).toContain('-20');
  });
});

// ─── createTriggerRecord ────────────────────────────────────

describe('createTriggerRecord', () => {
  it('creates a trigger record with correct fields', () => {
    const rule = makeRule();
    const trigger = createTriggerRecord(rule, { magnitude: 20, direction: 'improving', score: 50, previousScore: 30 });
    expect(trigger.ruleId).toBe(rule.id);
    expect(trigger.symbol).toBe('RELIANCE');
    expect(trigger.magnitude).toBe(20);
    expect(trigger.direction).toBe('improving');
    expect(trigger.score).toBe(50);
    expect(trigger.previousScore).toBe(30);
    expect(trigger.read).toBe(false);
    expect(trigger.message).toContain('📈');
    expect(trigger.timestamp).toBeTruthy();
  });

  it('rounds magnitude to one decimal', () => {
    const rule = makeRule();
    const trigger = createTriggerRecord(rule, { magnitude: 25.555, direction: 'deteriorating', score: -10, previousScore: 15 });
    expect(trigger.magnitude).toBe(25.6);
  });
});

// ─── createDefaultRule ──────────────────────────────────────

describe('createDefaultRule', () => {
  it('creates a rule with sensible defaults', () => {
    const rule = createDefaultRule('TCS', 'Tata Consultancy Services', 'Technology');
    expect(rule.symbol).toBe('TCS');
    expect(rule.stockName).toBe('Tata Consultancy Services');
    expect(rule.sector).toBe('Technology');
    expect(rule.sensitivity).toBe('medium');
    expect(rule.direction).toBe('both');
    expect(rule.enabled).toBe(true);
    expect(rule.triggered).toBe(false);
    expect(rule.id).toContain('sar_');
    expect(rule.createdAt).toBeTruthy();
  });
});

// ─── Mock Data ──────────────────────────────────────────────

describe('getMockAlertRules', () => {
  it('returns 3 mock rules', () => {
    const rules = getMockAlertRules();
    expect(rules).toHaveLength(3);
    expect(rules[0].symbol).toBe('RELIANCE');
    expect(rules[1].symbol).toBe('TCS');
    expect(rules[2].symbol).toBe('HDFCBANK');
  });
});

describe('getMockAlertTriggers', () => {
  it('returns 3 mock triggers', () => {
    const triggers = getMockAlertTriggers();
    expect(triggers).toHaveLength(3);
    expect(triggers.every(t => t.message)).toBe(true);
  });

  it('has one unread trigger', () => {
    const triggers = getMockAlertTriggers();
    expect(triggers.filter(t => !t.read)).toHaveLength(1);
  });
});
