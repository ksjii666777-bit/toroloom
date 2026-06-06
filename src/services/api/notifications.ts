import { api } from './client';
import type { AppNotification } from '../../types';
import type { PortfolioAlertRule } from '../../store/notificationStore';

export interface UnreadCount {
  count: number;
}

export interface PushTokenResponse {
  success: boolean;
  userId: string;
  registered?: boolean;
}

export interface PortfolioRuleSyncResponse {
  success: boolean;
  count: number;
}

export interface PortfolioEvaluateResponse {
  evaluated: boolean;
  rulesFired: number;
  badgeCount: number;
  fired: Array<{
    ruleId: string;
    ruleLabel: string;
    kind: string;
    title: string;
    message: string;
    value: number;
  }>;
}

export const notificationApi = {
  getAll: (unreadOnly = false) =>
    api.get<AppNotification[]>(`/notifications${unreadOnly ? '?unread=true' : ''}`),

  markRead: (notificationId: string) =>
    api.put<AppNotification>(`/notifications/${notificationId}/read`),

  markAllRead: () =>
    api.put<{ success: boolean }>('/notifications/read-all'),

  getUnreadCount: () =>
    api.get<UnreadCount>('/notifications/unread-count'),

  createPriceAlert: (symbol: string, targetPrice: number) =>
    api.post<AppNotification>('/notifications/price-alert', { symbol, targetPrice }),

  // ── Expo Push Token ─────────────────────────────────────────

  /** Register the user's Expo push token with the backend. */
  registerPushToken: (pushToken: string) =>
    api.post<PushTokenResponse>('/notifications/push-token', { pushToken }),

  /** Check if the current user has a push token registered. */
  getPushTokenStatus: () =>
    api.get<PushTokenResponse>('/notifications/push-token'),

  /** Unregister the current user's push token. */
  unregisterPushToken: () =>
    api.delete<{ success: boolean }>('/notifications/push-token'),

  // ── Portfolio Alert Rules Sync ─────────────────────────────

  /** Sync all portfolio alert rules to the backend for server-side evaluation. */
  syncPortfolioAlertRules: (rules: PortfolioAlertRule[]) =>
    api.post<PortfolioRuleSyncResponse>('/notifications/portfolio-rules/sync', { rules }),

  /** Get the portfolio alert rules from the backend. */
  getPortfolioAlertRules: () =>
    api.get<PortfolioAlertRule[]>('/notifications/portfolio-rules'),

  /** Trigger a server-side evaluation of portfolio alerts. */
  evaluatePortfolioAlerts: (portfolioData?: Record<string, any>, badgeCount?: number) =>
    api.post<PortfolioEvaluateResponse>('/notifications/portfolio-alert/evaluate', {
      portfolioData: portfolioData || undefined,
      badgeCount,
    }),

  /** Get the current badge count from the backend (for syncing after app restart). */
  getBadgeCount: () =>
    api.get<{ badgeCount: number }>('/notifications/badge-count'),

  /** Reset triggered state on all portfolio alert rules. */
  resetPortfolioAlertTriggers: () =>
    api.post<{ success: boolean; count: number }>('/notifications/portfolio-alert/reset-triggers'),
};
