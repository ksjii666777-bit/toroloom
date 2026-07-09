/**
 * ============================================================================
 * Toroloom — Telegram Bot API Client
 * ============================================================================
 *
 * Frontend API client for linking/unlinking Telegram and sending test messages.
 * ============================================================================
 */

import { api } from './client';

export interface TelegramStatus {
  linked: boolean;
  chatId?: number;
  firstName?: string;
  username?: string;
  linkedAt?: string;
}

export interface TelegramLinkCode {
  success: boolean;
  code: string;
  instructions: string;
  expiresIn: number;
}

export const telegramApi = {
  /**
   * Generate a link code that the user sends to @ToroloomBot.
   */
  generateCode: () =>
    api.post<TelegramLinkCode>('/telegram/generate-code'),

  /**
   * Check if the current user's Telegram is linked.
   */
  getStatus: () =>
    api.get<TelegramStatus>('/telegram/status'),

  /**
   * Unlink Telegram from the current user's account.
   */
  unlink: () =>
    api.post<{ success: boolean; message: string }>('/telegram/unlink'),

  /**
   * Send a test message to verify Telegram is working.
   */
  sendTest: () =>
    api.post<{ success: boolean; message: string }>('/telegram/test'),
};
