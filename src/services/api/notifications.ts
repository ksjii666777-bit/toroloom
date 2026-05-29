import { api } from './client';
import type { AppNotification } from '../../types';

export interface UnreadCount {
  count: number;
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
};
