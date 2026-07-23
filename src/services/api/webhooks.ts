/**
 * ============================================================================
 * Toroloom — Webhook API Client
 * ============================================================================
 *
 * Frontend API client for managing webhook configurations.
 *
 * Usage:
 *   import { webhookApi } from '../../services/api/webhooks';
 *   const webhooks = await webhookApi.list();
 * ============================================================================
 */

import { api } from './client';
import type { WebhookConfig, WebhookDeliveryLog } from '../../types';

export const webhookApi = {
  /** Create a new webhook */
  create: (data: {
    name: string;
    url: string;
    events: string[];
    description?: string;
  }) =>
    api.post<{ success: boolean; data: WebhookConfig }>('/user/webhooks', data),

  /** List all webhooks for the authenticated user */
  list: () =>
    api.get<{ success: boolean; data: WebhookConfig[] }>('/user/webhooks'),

  /** Get a single webhook by ID */
  get: (id: string) =>
    api.get<{ success: boolean; data: WebhookConfig }>(`/user/webhooks/${id}`),

  /** Update a webhook */
  update: (id: string, data: {
    name?: string;
    url?: string;
    events?: string[];
    isActive?: boolean;
    description?: string;
  }) =>
    api.put<{ success: boolean; data: WebhookConfig }>(`/user/webhooks/${id}`, data),

  /** Delete a webhook */
  delete: (id: string) =>
    api.delete<{ success: boolean; data: { deleted: boolean } }>(`/user/webhooks/${id}`),

  /** Send a test ping to the webhook */
  testPing: (id: string) =>
    api.post<{ success: boolean; data: {
      success: boolean;
      statusCode: number;
      duration: number;
      responseBody: string;
      errorMessage: string | null;
    } }>(`/user/webhooks/${id}/test`),

  /** Get delivery logs for a webhook */
  getLogs: (id: string, limit?: number) =>
    api.get<{ success: boolean; data: WebhookDeliveryLog[] }>(
      `/user/webhooks/${id}/logs${limit ? `?limit=${limit}` : ''}`,
    ),
};
