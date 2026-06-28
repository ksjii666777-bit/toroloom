/**
 * ============================================================================
 * Toroloom — Portfolio Alerts Service Unit Tests
 * ============================================================================
 *
 * Covers all exported functions of the portfolioAlerts service:
 *   - configureBadgeCountPersistence / getUserBadgeCount / increment / reset
 *   - configurePortfolioAlertStorage
 *   - savePortfolioAlertRule / getPortfolioAlertRules / delete / update
 *   - resetPortfolioAlertTriggers
 *   - evaluatePortfolioAlerts (all 4 rule kinds)
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/portfolioAlerts.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryStorage } from '../services/storage/inMemory';
import {
  PortfolioAlertRule,
  PortfolioData,
  configureBadgeCountPersistence,
  configurePortfolioAlertStorage,
  getUserBadgeCount,
  incrementUserBadgeCount,
  resetUserBadgeCount,
  savePortfolioAlertRule,
  getPortfolioAlertRules,
  deletePortfolioAlertRule,
  updatePortfolioAlertRule,
  resetPortfolioAlertTriggers,
  resetPortfolioAlertService,
  evaluatePortfolioAlerts,
} from '../services/portfolioAlerts';

// Mock the notifications and pushNotifications dependencies
vi.mock('../services/notifications', () => ({
  saveNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/pushNotifications', () => ({
  sendExpoPushNotification: vi.fn().mockResolvedValue({ status: 'ok', id: 'ticket-123' }),
}));

import { saveNotification } from '../services/notifications';
import { sendExpoPushNotification } from '../services/pushNotifications';

describe('Portfolio Alerts Service', () => {
  let storage: InMemoryStorage;
  const USER_ID = 'user-alert-001';

  beforeEach(() => {
    storage = new InMemoryStorage();
    resetPortfolioAlertService();
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Badge Count Management
  // ─────────────────────────────────────────────────────────────────────────

  describe('Badge Count', () => {
    it('should return 0 for unknown user', async () => {
      const count = await getUserBadgeCount('unknown');
      expect(count).toBe(0);
    });

    it('should increment badge count', async () => {
      const count1 = await incrementUserBadgeCount(USER_ID);
      expect(count1).toBe(1);

      const count2 = await incrementUserBadgeCount(USER_ID);
      expect(count2).toBe(2);
    });

    it('should persist badge count to storage when configured', async () => {
      configureBadgeCountPersistence(storage);
      await incrementUserBadgeCount(USER_ID);

      const count = await getUserBadgeCount(USER_ID);
      expect(count).toBe(1);

      // Verify it's actually in storage
      expect(await storage.loadBadgeCount(USER_ID)).toBe(1);
    });

    it('should reset badge count to 0', async () => {
      await incrementUserBadgeCount(USER_ID);
      await incrementUserBadgeCount(USER_ID);
      await incrementUserBadgeCount(USER_ID);

      await resetUserBadgeCount(USER_ID);

      const count = await getUserBadgeCount(USER_ID);
      expect(count).toBe(0);
    });

    it('should reset persisted badge count in storage', async () => {
      configureBadgeCountPersistence(storage);
      await incrementUserBadgeCount(USER_ID);

      await resetUserBadgeCount(USER_ID);

      expect(await storage.loadBadgeCount(USER_ID)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rule CRUD (In-Memory)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Rule CRUD — In-Memory', () => {
    const sampleRule: PortfolioAlertRule = {
      id: 'rule-1',
      userId: USER_ID,
      kind: 'portfolio_pnl_pct',
      label: '5% Loss Alert',
      threshold: 5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };

    it('should save a new rule', async () => {
      await savePortfolioAlertRule(sampleRule);

      const rules = await getPortfolioAlertRules(USER_ID);
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('rule-1');
      expect(rules[0].kind).toBe('portfolio_pnl_pct');
    });

    it('should update an existing rule on re-save', async () => {
      await savePortfolioAlertRule(sampleRule);
      await savePortfolioAlertRule({ ...sampleRule, threshold: 10, label: '10% Loss Alert' });

      const rules = await getPortfolioAlertRules(USER_ID);
      expect(rules).toHaveLength(1);
      expect(rules[0].threshold).toBe(10);
      expect(rules[0].label).toBe('10% Loss Alert');
    });

    it('should return empty array for user with no rules', async () => {
      const rules = await getPortfolioAlertRules(USER_ID);
      expect(rules).toEqual([]);
    });

    it('should not return other users rules', async () => {
      await savePortfolioAlertRule(sampleRule);

      const rules = await getPortfolioAlertRules('other-user');
      expect(rules).toEqual([]);
    });

    it('should delete a rule', async () => {
      await savePortfolioAlertRule(sampleRule);
      await deletePortfolioAlertRule('rule-1');

      const rules = await getPortfolioAlertRules(USER_ID);
      expect(rules).toEqual([]);
    });

    it('should update specific fields on a rule', async () => {
      await savePortfolioAlertRule(sampleRule);
      await updatePortfolioAlertRule('rule-1', { triggered: true, enabled: false });

      const rules = await getPortfolioAlertRules(USER_ID);
      expect(rules[0].triggered).toBe(true);
      expect(rules[0].enabled).toBe(false);
      // Other fields unchanged
      expect(rules[0].kind).toBe('portfolio_pnl_pct');
      expect(rules[0].threshold).toBe(5);
    });

    it('should do nothing when updating non-existent rule', async () => {
      // Should not throw
      await expect(updatePortfolioAlertRule('non-existent', { enabled: false })).resolves.toBeUndefined();
    });

    it('should delete non-existent rule without error', async () => {
      await expect(deletePortfolioAlertRule('non-existent')).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rule CRUD (With Storage)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Rule CRUD — Persisted', () => {
    const sampleRule: PortfolioAlertRule = {
      id: 'rule-persist-1',
      userId: USER_ID,
      kind: 'portfolio_pnl_abs',
      label: '₹10k Loss Alert',
      threshold: 10000,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };

    beforeEach(() => {
      configurePortfolioAlertStorage(storage);
    });

    it('should persist rule to storage on save', async () => {
      await savePortfolioAlertRule(sampleRule);

      // Check stored notification
      const notifs = await storage.loadNotifications(USER_ID);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].id).toBe('rule_rule-persist-1');
      expect(notifs[0].title).toBe('RULE:portfolio_pnl_abs');
    });

    it('should hydrate rules from storage when in-memory is empty', async () => {
      // Save rule directly to storage (simulating restart)
      const ruleData = {
        id: `rule_${sampleRule.id}`,
        userId: sampleRule.userId,
        type: 'portfolio_alert',
        title: `RULE:${sampleRule.kind}`,
        message: JSON.stringify(sampleRule),
        read: true,
        timestamp: sampleRule.createdAt,
      };
      await storage.saveNotification(ruleData as any);

      // getPortfolioAlertRules should hydrate from storage
      const rules = await getPortfolioAlertRules(USER_ID);
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('rule-persist-1');
      expect(rules[0].threshold).toBe(10000);
    });

    it('should delete rule from storage when deleted in-memory', async () => {
      await savePortfolioAlertRule(sampleRule);
      await deletePortfolioAlertRule('rule-persist-1');

      const notifs = await storage.loadNotifications(USER_ID);
      expect(notifs).toEqual([]);
    });

    it('should update rule in storage on update', async () => {
      await savePortfolioAlertRule(sampleRule);
      await updatePortfolioAlertRule('rule-persist-1', { threshold: 20000 });

      // Re-read from storage
      const rules = await getPortfolioAlertRules(USER_ID);
      expect(rules[0].threshold).toBe(20000);
    });

    it('should skip malformed notification data during hydration', async () => {
      // Save a notification with invalid JSON
      await storage.saveNotification({
        id: 'rule_bad',
        userId: USER_ID,
        type: 'portfolio_alert',
        title: 'RULE:portfolio_pnl_pct',
        message: 'not-valid-json',
        read: true,
        timestamp: new Date().toISOString(),
      });

      const rules = await getPortfolioAlertRules(USER_ID);
      // Should skip the malformed entry
      expect(rules.filter(r => r.id === 'bad')).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Trigger Management
  // ─────────────────────────────────────────────────────────────────────────

  describe('Trigger Reset', () => {
    it('should reset triggered flags for a user', async () => {
      const rule1: PortfolioAlertRule = {
        id: 'r1', userId: USER_ID, kind: 'portfolio_pnl_pct',
        label: 'Alert 1', threshold: 5, direction: 'below',
        triggered: true, createdAt: new Date().toISOString(), enabled: true,
      };
      const rule2: PortfolioAlertRule = {
        id: 'r2', userId: USER_ID, kind: 'portfolio_pnl_abs',
        label: 'Alert 2', threshold: 10000, direction: 'below',
        triggered: true, createdAt: new Date().toISOString(), enabled: true,
      };
      await savePortfolioAlertRule(rule1);
      await savePortfolioAlertRule(rule2);

      await resetPortfolioAlertTriggers(USER_ID);

      const rules = await getPortfolioAlertRules(USER_ID);
      expect(rules.every(r => r.triggered === false)).toBe(true);
    });

    it('should not affect other users rules', async () => {
      const rule1: PortfolioAlertRule = {
        id: 'r1', userId: USER_ID, kind: 'portfolio_pnl_pct',
        label: 'Alert 1', threshold: 5, direction: 'below',
        triggered: true, createdAt: new Date().toISOString(), enabled: true,
      };
      const rule2: PortfolioAlertRule = {
        id: 'r2', userId: 'other-user', kind: 'portfolio_pnl_pct',
        label: 'Other Alert', threshold: 5, direction: 'below',
        triggered: true, createdAt: new Date().toISOString(), enabled: true,
      };
      await savePortfolioAlertRule(rule1);
      await savePortfolioAlertRule(rule2);

      await resetPortfolioAlertTriggers(USER_ID);

      const otherRules = await getPortfolioAlertRules('other-user');
      expect(otherRules[0].triggered).toBe(true);
    });

    it('should re-persist rules when storage is configured', async () => {
      configurePortfolioAlertStorage(storage);
      const rule: PortfolioAlertRule = {
        id: 'r1', userId: USER_ID, kind: 'portfolio_pnl_pct',
        label: 'Alert', threshold: 5, direction: 'below',
        triggered: true, createdAt: new Date().toISOString(), enabled: true,
      };
      await savePortfolioAlertRule(rule);

      await resetPortfolioAlertTriggers(USER_ID);

      // Verify storage reflects the reset
      const notifs = await storage.loadNotifications(USER_ID);
      const storedRule = JSON.parse(notifs[0].message);
      expect(storedRule.triggered).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Evaluation — All 4 Rule Kinds
  // ─────────────────────────────────────────────────────────────────────────

  describe('Evaluation', () => {
    const mockData: PortfolioData = {
      totalReturnPercent: -8.5,
      totalReturn: -25000,
      totalInvested: 300000,
      currentValue: 275000,
      peakValue: 350000,
      consecutiveLossDays: 5,
    };

    beforeEach(() => {
      // Ensure evaluation has push token to test both notification paths
      vi.clearAllMocks();
    });

    it('should trigger portfolio_pnl_pct alert when loss exceeds threshold', async () => {
      await savePortfolioAlertRule({
        id: 'r1', userId: USER_ID, kind: 'portfolio_pnl_pct',
        label: '5% Loss', threshold: 5, direction: 'below',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData, 'ExponentPushToken[abc123]');

      expect(fired).toHaveLength(1);
      expect(fired[0].kind).toBe('portfolio_pnl_pct');
      expect(fired[0].value).toBe(-8.5);

      // Should have saved in-app notification
      expect(saveNotification).toHaveBeenCalledTimes(1);
      // Should have sent push
      expect(sendExpoPushNotification).toHaveBeenCalledTimes(1);
      expect(sendExpoPushNotification).toHaveBeenCalledWith(
        'ExponentPushToken[abc123]',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ kind: 'portfolio_pnl_pct' }),
        expect.any(Number),
      );

      // Rule should now be triggered
      const rules = await getPortfolioAlertRules(USER_ID);
      expect(rules[0].triggered).toBe(true);
    });

    it('should NOT trigger portfolio_pnl_pct when loss is below threshold', async () => {
      // Condition: data.totalReturnPercent (-8.5) <= threshold (-20) → false → doesn't trigger
      await savePortfolioAlertRule({
        id: 'r1', userId: USER_ID, kind: 'portfolio_pnl_pct',
        label: '20% Loss', threshold: -20, direction: 'below',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);
      expect(fired).toHaveLength(0);
    });

    it('should trigger portfolio_pnl_abs alert when loss exceeds threshold', async () => {
      await savePortfolioAlertRule({
        id: 'r2', userId: USER_ID, kind: 'portfolio_pnl_abs',
        label: '₹10k Loss', threshold: 10000, direction: 'below',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);

      expect(fired).toHaveLength(1);
      expect(fired[0].kind).toBe('portfolio_pnl_abs');
      expect(fired[0].value).toBe(25000);
    });

    it('should NOT trigger portfolio_pnl_abs when loss is below threshold', async () => {
      await savePortfolioAlertRule({
        id: 'r2', userId: USER_ID, kind: 'portfolio_pnl_abs',
        label: '₹50k Loss', threshold: 50000, direction: 'below',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);
      expect(fired).toHaveLength(0);
    });

    it('should trigger portfolio_peak_drawdown alert when drawdown exceeds threshold', async () => {
      await savePortfolioAlertRule({
        id: 'r3', userId: USER_ID, kind: 'portfolio_peak_drawdown',
        label: '20% Drawdown', threshold: 20, direction: 'above',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);

      expect(fired).toHaveLength(1);
      expect(fired[0].kind).toBe('portfolio_peak_drawdown');
      // Drawdown = (350000 - 275000) / 350000 * 100 = 21.43%
      expect(fired[0].value).toBeCloseTo(21.43, 1);
    });

    it('should NOT trigger drawdown alert when drawdown is below threshold', async () => {
      await savePortfolioAlertRule({
        id: 'r3', userId: USER_ID, kind: 'portfolio_peak_drawdown',
        label: '50% Drawdown', threshold: 50, direction: 'above',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);
      expect(fired).toHaveLength(0);
    });

    it('should handle peakValue of 0 without error (no division by zero)', async () => {
      await savePortfolioAlertRule({
        id: 'r3', userId: USER_ID, kind: 'portfolio_peak_drawdown',
        label: '20% Drawdown', threshold: 20, direction: 'above',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      const zeroPeakData: PortfolioData = { ...mockData, peakValue: 0 };
      const fired = await evaluatePortfolioAlerts(USER_ID, zeroPeakData, 'ExponentPushToken[abc]');

      expect(fired).toHaveLength(0);
    });

    it('should trigger consecutive_loss_days alert', async () => {
      await savePortfolioAlertRule({
        id: 'r4', userId: USER_ID, kind: 'consecutive_loss_days',
        label: '3 Days Loss', threshold: 3, direction: 'above',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);

      expect(fired).toHaveLength(1);
      expect(fired[0].kind).toBe('consecutive_loss_days');
      expect(fired[0].value).toBe(5);
    });

    it('should NOT trigger consecutive_loss_days when below threshold', async () => {
      await savePortfolioAlertRule({
        id: 'r4', userId: USER_ID, kind: 'consecutive_loss_days',
        label: '10 Days Loss', threshold: 10, direction: 'above',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);
      expect(fired).toHaveLength(0);
    });

    it('should skip disabled rules', async () => {
      await savePortfolioAlertRule({
        id: 'r1', userId: USER_ID, kind: 'portfolio_pnl_pct',
        label: '5% Loss', threshold: 5, direction: 'below',
        triggered: false, createdAt: new Date().toISOString(), enabled: false,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);
      expect(fired).toHaveLength(0);
    });

    it('should skip already triggered rules', async () => {
      await savePortfolioAlertRule({
        id: 'r1', userId: USER_ID, kind: 'portfolio_pnl_pct',
        label: '5% Loss', threshold: 5, direction: 'below',
        triggered: true, createdAt: new Date().toISOString(), enabled: true,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);
      expect(fired).toHaveLength(0);
    });

    it('should NOT send push notification when pushToken is null', async () => {
      await savePortfolioAlertRule({
        id: 'r1', userId: USER_ID, kind: 'portfolio_pnl_pct',
        label: '5% Loss', threshold: 5, direction: 'below',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      await evaluatePortfolioAlerts(USER_ID, mockData, null);

      expect(sendExpoPushNotification).not.toHaveBeenCalled();
      // But in-app notification should still be saved
      expect(saveNotification).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple rules firing at once', async () => {
      // Create 3 rules that will all fire
      await savePortfolioAlertRule({
        id: 'r1', userId: USER_ID, kind: 'portfolio_pnl_pct',
        label: '5% Loss', threshold: 5, direction: 'below',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });
      await savePortfolioAlertRule({
        id: 'r2', userId: USER_ID, kind: 'portfolio_pnl_abs',
        label: '₹10k Loss', threshold: 10000, direction: 'below',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });
      await savePortfolioAlertRule({
        id: 'r3', userId: USER_ID, kind: 'consecutive_loss_days',
        label: '3 Days', threshold: 3, direction: 'above',
        triggered: false, createdAt: new Date().toISOString(), enabled: true,
      });

      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);

      expect(fired).toHaveLength(3);
      expect(fired.map(f => f.kind).sort()).toEqual([
        'consecutive_loss_days',
        'portfolio_pnl_abs',
        'portfolio_pnl_pct',
      ]);

      // All 3 rules should now be triggered
      const rules = await getPortfolioAlertRules(USER_ID);
      expect(rules.every(r => r.triggered)).toBe(true);
    });

    it('should return empty array when no rules exist', async () => {
      const fired = await evaluatePortfolioAlerts(USER_ID, mockData);
      expect(fired).toEqual([]);
    });
  });
});
