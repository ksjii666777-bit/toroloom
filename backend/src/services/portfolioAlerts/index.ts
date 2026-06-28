/**
 * ============================================================================
 * Toroloom — Server-Side Portfolio Alert Rules
 * ============================================================================
 *
 * Stores and evaluates portfolio alert rules on the server, sending Expo
 * push notifications when thresholds are breached. Mirrors the frontend
 * evaluation logic so alerts fire reliably even when the app is killed.
 *
 * Usage:
 *   import { evaluatePortfolioAlerts } from '../services/portfolioAlerts';
 *   const { fired } = await evaluatePortfolioAlerts(userId, portfolioData);
 * ============================================================================
 */

import type { StorageEngine, NotificationData } from '../storage/types';
import { saveNotification } from '../notifications';
import { sendExpoPushNotification } from '../pushNotifications';

// ==================== Types ====================

export type PortfolioAlertKind =
  | 'portfolio_pnl_pct'
  | 'portfolio_pnl_abs'
  | 'portfolio_peak_drawdown'
  | 'consecutive_loss_days';

export interface PortfolioAlertRule {
  id: string;
  userId: string;
  kind: PortfolioAlertKind;
  label: string;
  threshold: number;
  direction: 'above' | 'below';
  triggered: boolean;
  createdAt: string;
  enabled: boolean;
}

export interface PortfolioData {
  totalReturnPercent: number;
  totalReturn: number;
  totalInvested: number;
  currentValue: number;
  peakValue: number;
  consecutiveLossDays: number;
}

export interface EvaluationResult {
  ruleId: string;
  ruleLabel: string;
  kind: PortfolioAlertKind;
  title: string;
  message: string;
  value: number;
}

// ==================== Internal State ====================

/** In-memory fallback storage for rules when no storage engine is configured. */
let inMemoryRules: PortfolioAlertRule[] = [];
let ruleStorage: StorageEngine | null = null;

/**
 * Per-user badge count tracking for the app icon badge.
 * Persisted via the storage engine when configured, falling back to
 * in-memory Map so badge counts survive server restarts.
 */
const userBadgeCounts = new Map<string, number>();
let badgeCountStorage: StorageEngine | null = null;

/**
 * Wire a storage engine for badge count persistence.
 */
export function configureBadgeCountPersistence(storage: StorageEngine): void {
  badgeCountStorage = storage;
}

/**
 * Get the current badge count for a user.
 * Reads from storage if available, else from in-memory map.
 */
export async function getUserBadgeCount(userId: string): Promise<number> {
  // Try storage first
  if (badgeCountStorage) {
    const count = await badgeCountStorage.loadBadgeCount(userId);
    // Sync the in-memory cache so synchronous callers still work
    if (count > 0) userBadgeCounts.set(userId, count);
    return count;
  }
  return userBadgeCounts.get(userId) || 0;
}

/**
 * Increment the badge count for a user and return the new value.
 * Persists to storage when configured.
 */
export async function incrementUserBadgeCount(userId: string): Promise<number> {
  const current = badgeCountStorage
    ? await badgeCountStorage.loadBadgeCount(userId)
    : (userBadgeCounts.get(userId) || 0);
  const next = current + 1;
  userBadgeCounts.set(userId, next);
  if (badgeCountStorage) {
    await badgeCountStorage.saveBadgeCount(userId, next);
  }
  return next;
}

/**
 * Reset the badge count for a user to 0.
 * Persists to storage when configured.
 */
export async function resetUserBadgeCount(userId: string): Promise<void> {
  userBadgeCounts.delete(userId);
  if (badgeCountStorage) {
    await badgeCountStorage.saveBadgeCount(userId, 0);
  }
}

// ==================== Rule CRUD ====================

/**
 * Configure persistence for portfolio alert rules.
 * Optionally wires a StorageEngine so rules survive restarts.
 */
export function configurePortfolioAlertStorage(storage: StorageEngine): void {
  ruleStorage = storage;
}

/**
 * Save (create or update) a portfolio alert rule.
 */
export async function savePortfolioAlertRule(rule: PortfolioAlertRule): Promise<void> {
  if (ruleStorage) {
    // Persist rules as notification-like data using a special prefix
    const ruleData: NotificationData = {
      id: `rule_${rule.id}`,
      userId: rule.userId,
      type: 'portfolio_alert',
      title: `RULE:${rule.kind}`,
      message: JSON.stringify(rule),
      read: true,
      timestamp: rule.createdAt,
    };
    await ruleStorage.saveNotification(ruleData);
  }

  const idx = inMemoryRules.findIndex(r => r.id === rule.id);
  if (idx >= 0) {
    inMemoryRules[idx] = rule;
  } else {
    inMemoryRules.push(rule);
  }
}

/**
 * Get all portfolio alert rules for a user.
 */
export async function getPortfolioAlertRules(userId: string): Promise<PortfolioAlertRule[]> {
  const rules = inMemoryRules.filter(r => r.userId === userId);

  // If we have storage but no in-memory rules, hydrate from storage
  if (rules.length === 0 && ruleStorage) {
    const notifications = await ruleStorage.loadNotifications(userId);
    const storedRules: PortfolioAlertRule[] = [];
    for (const n of notifications) {
      if (n.title?.startsWith('RULE:') && n.message) {
        try {
          const rule = JSON.parse(n.message) as PortfolioAlertRule;
          storedRules.push(rule);
        } catch {
          // Skip malformed entries
        }
      }
    }
    // Sync to in-memory
    inMemoryRules = inMemoryRules.filter(r => r.userId !== userId).concat(storedRules);
    return storedRules;
  }

  return rules;
}

/**
 * Delete a portfolio alert rule.
 */
export async function deletePortfolioAlertRule(ruleId: string): Promise<void> {
  inMemoryRules = inMemoryRules.filter(r => r.id !== ruleId);
  if (ruleStorage) {
    await ruleStorage.deleteNotification(`rule_${ruleId}`);
  }
}

/**
 * Update specific fields on a rule.
 */
export async function updatePortfolioAlertRule(
  ruleId: string,
  updates: Partial<PortfolioAlertRule>,
): Promise<void> {
  const idx = inMemoryRules.findIndex(r => r.id === ruleId);
  if (idx >= 0) {
    inMemoryRules[idx] = { ...inMemoryRules[idx], ...updates };
    if (ruleStorage) {
      await savePortfolioAlertRule(inMemoryRules[idx]);
    }
  }
}

/**
 * Reset the portfolio alert service state (for testing).
 * Clears in-memory rules and storage reference.
 */
export function resetPortfolioAlertService(): void {
  inMemoryRules = [];
  ruleStorage = null;
  badgeCountStorage = null;
  userBadgeCounts.clear();
}

/**
 * Reset all triggers for a user's rules (for a new trading day).
 */
export async function resetPortfolioAlertTriggers(userId: string): Promise<void> {
  for (const rule of inMemoryRules) {
    if (rule.userId === userId) {
      rule.triggered = false;
    }
  }
  if (ruleStorage) {
    // Re-persist all rules with triggers reset
    const userRules = inMemoryRules.filter(r => r.userId === userId);
    for (const rule of userRules) {
      await savePortfolioAlertRule(rule);
    }
  }
}

// ==================== Evaluation ====================

/**
 * Evaluate all portfolio alert rules for a user against the current
 * portfolio data. Fires in-app notifications and Expo push notifications
 * for any rule that breaches its threshold.
 *
 * Returns a list of fired evaluations.
 */
export async function evaluatePortfolioAlerts(
  userId: string,
  data: PortfolioData,
  pushToken?: string | null,
): Promise<EvaluationResult[]> {
  const rules = await getPortfolioAlertRules(userId);
  const firedResults: EvaluationResult[] = [];

  for (const rule of rules) {
    if (!rule.enabled || rule.triggered) continue;

    let hit = false;
    let title = '';
    let message = '';
    let value = 0;

    switch (rule.kind) {
      case 'portfolio_pnl_pct': {
        if (data.totalReturnPercent <= rule.threshold) {
          hit = true;
          title = '⚠️ Portfolio Alert: P&L Threshold Breached';
          message = `Your portfolio P&L is ${data.totalReturnPercent.toFixed(1)}% (₹${Math.abs(data.totalReturn).toLocaleString('en-IN')}). Triggered at ${rule.threshold}% loss threshold.`;
          value = data.totalReturnPercent;
        }
        break;
      }
      case 'portfolio_pnl_abs': {
        const lossAbs = Math.abs(data.totalReturn);
        if (data.totalReturn < 0 && lossAbs >= rule.threshold) {
          hit = true;
          title = '⚠️ Portfolio Alert: Loss Threshold Breached';
          message = `Your portfolio loss is ₹${lossAbs.toLocaleString('en-IN')}. Triggered at ₹${rule.threshold.toLocaleString('en-IN')} loss limit.`;
          value = lossAbs;
        }
        break;
      }
      case 'portfolio_peak_drawdown': {
        if (data.peakValue > 0) {
          const drawdown = ((data.peakValue - data.currentValue) / data.peakValue) * 100;
          if (drawdown >= rule.threshold) {
            hit = true;
            title = '📉 Portfolio Drawdown Alert';
            message = `Portfolio is down ${drawdown.toFixed(1)}% from its peak of ₹${data.peakValue.toLocaleString('en-IN')}. Threshold: ${rule.threshold}% drawdown.`;
            value = drawdown;
          }
        }
        break;
      }
      case 'consecutive_loss_days': {
        if (data.consecutiveLossDays >= rule.threshold) {
          hit = true;
          title = '🔴 Consecutive Loss Days Alert';
          message = `Portfolio has ${data.consecutiveLossDays} consecutive days of negative P&L. Threshold: ${rule.threshold} days. Consider reviewing your strategy.`;
          value = data.consecutiveLossDays;
        }
        break;
      }
    }

    if (hit) {
      // Mark rule as triggered
      await updatePortfolioAlertRule(rule.id, { triggered: true });

      // Save in-app notification
      const notif: NotificationData = {
        id: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId,
        type: 'portfolio_alert',
        title,
        message,
        read: false,
        timestamp: new Date().toISOString(),
        data: { kind: rule.kind, value, threshold: rule.threshold, ruleId: rule.id },
      };
      await saveNotification(notif);

      // Increment the per-user badge count
      const badgeCount = await incrementUserBadgeCount(userId);

      // Send Expo push notification if push token is available.
      // Include the badge count so the iOS/Android app icon badge updates
      // even when the app is killed.
      if (pushToken) {
        await sendExpoPushNotification(pushToken, title, message, {
          kind: rule.kind,
          value,
          threshold: rule.threshold,
          ruleId: rule.id,
          screen: 'PortfolioAlerts',
        }, badgeCount);
      }

      firedResults.push({
        ruleId: rule.id,
        ruleLabel: rule.label,
        kind: rule.kind,
        title,
        message,
        value,
      });
    }
  }

  return firedResults;
}


