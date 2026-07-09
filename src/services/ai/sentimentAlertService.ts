/**
 * ============================================================================
 * Toroloom — Sentiment Alert Service
 * ============================================================================
 *
 * Pure functions for evaluating sentiment shift alert rules against
 * sentiment data, and generating human-readable alert messages.
 *
 * All functions are pure — no side effects, no API calls.
 * ============================================================================
 */

import type { SentimentAlertRule, SentimentAlertTrigger, SentimentDataPoint } from '../../types';
import { detectSentimentShift } from './sentimentAnalyzer';

// ─── Constants ──────────────────────────────────────────────

const SENSITIVITY_THRESHOLDS: Record<string, number> = {
  low: 25,     // Only flag large shifts (25+ points)
  medium: 15,  // Default — flag moderate shifts (15+ points)
  high: 10,    // Flag small shifts (10+ points)
};

const SENSITIVITY_LABELS: Record<string, string> = {
  low: 'Low — Large shifts only',
  medium: 'Medium — Moderate shifts',
  high: 'High — Any noticeable shift',
};

// ─── Sensitivity Helpers ──────────────────────────────────

/** Get the score threshold for a given sensitivity level */
export function getSensitivityThreshold(sensitivity: string): number {
  return SENSITIVITY_THRESHOLDS[sensitivity] ?? 15;
}

/** Get human-readable label for a sensitivity level */
export function getSensitivityLabel(sensitivity: string): string {
  return SENSITIVITY_LABELS[sensitivity] ?? SENSITIVITY_LABELS.medium;
}

// ─── Evaluate Single Rule ──────────────────────────────────

/**
 * Evaluate a single sentiment alert rule against historical sentiment data.
 * Returns null if the rule does not trigger.
 */
export function evaluateRule(
  rule: SentimentAlertRule,
  history: SentimentDataPoint[],
): { magnitude: number; direction: 'improving' | 'deteriorating'; score: number; previousScore: number } | null {
  if (!rule.enabled || rule.triggered || history.length < 2) return null;

  const shift = detectSentimentShift(history);
  const threshold = getSensitivityThreshold(rule.sensitivity);

  if (!shift.hasShifted || shift.magnitude < threshold) return null;

  // Check direction filter — shift.direction is 'stable' | 'improving' | 'deteriorating'
  // but after hasShifted check, it can only be 'improving' | 'deteriorating'
  const alertDirection = shift.direction as 'improving' | 'deteriorating';
  if (rule.direction !== 'both' && rule.direction !== alertDirection) return null;

  // Get current and previous scores for the message
  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const previousScore = sorted[0].overallScore;
  const score = sorted[sorted.length - 1].overallScore;

  return { magnitude: shift.magnitude, direction: alertDirection, score, previousScore };
}

// ─── Evaluate All Rules ───────────────────────────────────

/**
 * Evaluate all alert rules against sentiment data and return
 * only the rules that triggered, along with trigger details.
 */
export function evaluateAllRules(
  rules: SentimentAlertRule[],
  sentimentMap: Map<string, SentimentDataPoint[]>,
): { rule: SentimentAlertRule; result: { magnitude: number; direction: 'improving' | 'deteriorating'; score: number; previousScore: number } }[] {
  const results: { rule: SentimentAlertRule; result: { magnitude: number; direction: 'improving' | 'deteriorating'; score: number; previousScore: number } }[] = [];

  for (const rule of rules) {
    const history = sentimentMap.get(rule.symbol);
    if (!history || history.length < 2) continue;

    const result = evaluateRule(rule, history);
    if (result) {
      results.push({ rule, result });
    }
  }

  return results;
}

// ─── Generate Alert Message ───────────────────────────────

/**
 * Generate a human-readable alert message for a triggered sentiment rule.
 */
export function generateAlertMessage(
  rule: SentimentAlertRule,
  trigger: { magnitude: number; direction: string; score: number; previousScore: number },
): string {
  const directionEmoji = trigger.direction === 'improving' ? '📈' : '📉';
  const points = Math.round(trigger.magnitude);
  const scoreChange = trigger.score - trigger.previousScore;
  const scoreSign = scoreChange >= 0 ? '+' : '';

  return `${directionEmoji} ${rule.stockName} sentiment ${trigger.direction} by ${points}pts (${scoreSign}${Math.round(scoreChange)}). Score: ${trigger.score > 0 ? '+' : ''}${trigger.score}.`;
}

// ─── Create Trigger Record ────────────────────────────────

/**
 * Create a SentimentAlertTrigger record from a rule and trigger result.
 */
export function createTriggerRecord(
  rule: SentimentAlertRule,
  result: { magnitude: number; direction: 'improving' | 'deteriorating'; score: number; previousScore: number },
): SentimentAlertTrigger {
  return {
    id: `sat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ruleId: rule.id,
    symbol: rule.symbol,
    stockName: rule.stockName,
    magnitude: Math.round(result.magnitude * 10) / 10,
    direction: result.direction,
    score: result.score,
    previousScore: result.previousScore,
    message: generateAlertMessage(rule, result),
    timestamp: new Date().toISOString(),
    read: false,
  };
}

// ─── Create Default Rule ──────────────────────────────────

/**
 * Create a new SentimentAlertRule with sensible defaults.
 */
export function createDefaultRule(
  symbol: string,
  stockName: string,
  sector: string,
): SentimentAlertRule {
  return {
    id: `sar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    symbol,
    stockName,
    sector,
    sensitivity: 'medium',
    direction: 'both',
    triggered: false,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
}

// ─── Mock Alert Rules ─────────────────────────────────────

export function getMockAlertRules(): SentimentAlertRule[] {
  return [
    {
      id: 'sar_mock_1',
      symbol: 'RELIANCE',
      stockName: 'Reliance Industries Ltd.',
      sector: 'Energy',
      sensitivity: 'medium',
      direction: 'deteriorating',
      triggered: false,
      enabled: true,
      createdAt: '2026-06-28T10:00:00.000Z',
    },
    {
      id: 'sar_mock_2',
      symbol: 'TCS',
      stockName: 'Tata Consultancy Services',
      sector: 'Technology',
      sensitivity: 'high',
      direction: 'both',
      triggered: false,
      enabled: true,
      createdAt: '2026-06-27T14:30:00.000Z',
    },
    {
      id: 'sar_mock_3',
      symbol: 'HDFCBANK',
      stockName: 'HDFC Bank Ltd.',
      sector: 'Finance',
      sensitivity: 'low',
      direction: 'improving',
      triggered: false,
      enabled: false,
      createdAt: '2026-06-25T09:00:00.000Z',
    },
  ];
}

export function getMockAlertTriggers(): SentimentAlertTrigger[] {
  return [
    {
      id: 'sat_mock_1',
      ruleId: 'sar_mock_1',
      symbol: 'RELIANCE',
      stockName: 'Reliance Industries Ltd.',
      magnitude: 22,
      direction: 'deteriorating',
      score: -15,
      previousScore: 7,
      message: '📉 Reliance Industries Ltd. sentiment deteriorating by 22pts (-22). Score: -15.',
      timestamp: '2026-06-29T08:15:00.000Z',
      read: true,
    },
    {
      id: 'sat_mock_2',
      ruleId: 'sar_mock_2',
      symbol: 'TCS',
      stockName: 'Tata Consultancy Services',
      magnitude: 18,
      direction: 'improving',
      score: 45,
      previousScore: 27,
      message: '📈 Tata Consultancy Services sentiment improving by 18pts (+18). Score: +45.',
      timestamp: '2026-06-28T16:30:00.000Z',
      read: true,
    },
    {
      id: 'sat_mock_3',
      ruleId: 'sar_mock_1',
      symbol: 'RELIANCE',
      stockName: 'Reliance Industries Ltd.',
      magnitude: 35,
      direction: 'improving',
      score: 30,
      previousScore: -5,
      message: '📈 Reliance Industries Ltd. sentiment improving by 35pts (+35). Score: +30.',
      timestamp: '2026-06-25T11:45:00.000Z',
      read: false,
    },
  ];
}
