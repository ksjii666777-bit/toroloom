/**
 * ============================================================================
 * Toroloom — Webhook Delivery Service
 * ============================================================================
 *
 * Manages webhook configurations and delivers events to registered URLs.
 *
 * Features:
 *   - HMAC-SHA256 signed payloads (X-Webhook-Signature header)
 *   - Exponential backoff retry (3 attempts: 1s, 3s, 9s)
 *   - Delivery logging with response body capture
 *   - Atomic update of deliveryCount / successCount / lastTriggeredAt
 *   - Payload includes event name, timestamp, and data envelope
 *
 * Usage:
 *   import { configureWebhookPersistence, dispatchWebhookEvent } from './services/webhookService';
 *
 *   // Wire storage at startup
 *   configureWebhookPersistence(storage);
 *
 *   // Dispatch an event
 *   await dispatchWebhookEvent('trade:executed', { symbol: 'RELIANCE', ... });
 * ============================================================================
 */

import crypto from 'crypto';
import type { StorageEngine, WebhookStorageData, WebhookDeliveryLogData } from './storage/types';

// ──── Module-level storage reference ──────────────────────────────────────
let _storage: StorageEngine | null = null;

/**
 * Wire the storage engine into the webhook service.
 * Must be called once during server startup (from server.ts).
 */
export function configureWebhookPersistence(storage: StorageEngine): void {
  _storage = storage;
}

function getStorage(): StorageEngine {
  if (!_storage) throw new Error('Webhook persistence not configured. Call configureWebhookPersistence() first.');
  return _storage;
}

// ──── ID Generation ───────────────────────────────────────────────────────

function generateId(prefix: string = 'wh'): string {
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

function generateSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

function maskSecret(secret: string): string {
  if (secret.length <= 12) return secret;
  return `${secret.slice(0, 7)}...${secret.slice(-4)}`;
}

// ──── CRUD Operations ────────────────────────────────────────────────────

export interface CreateWebhookInput {
  name: string;
  url: string;
  events: string[];
  description?: string;
}

export async function createWebhook(
  userId: string,
  input: CreateWebhookInput,
): Promise<WebhookStorageData> {
  const now = new Date().toISOString();
  const secret = generateSecret();
  const webhook: WebhookStorageData = {
    id: generateId(),
    userId,
    name: input.name.trim(),
    url: input.url.trim(),
    secret,
    events: input.events,
    isActive: true,
    lastTriggeredAt: null,
    deliveryCount: 0,
    successCount: 0,
    description: input.description?.trim() || '',
    createdAt: now,
    updatedAt: now,
  };
  await getStorage().saveWebhook(webhook);
  return webhook;
}

export async function updateWebhook(
  id: string,
  userId: string,
  updates: Partial<Pick<WebhookStorageData, 'name' | 'url' | 'events' | 'isActive' | 'description'>>,
): Promise<WebhookStorageData | null> {
  const storage = getStorage();
  const existing = await storage.loadWebhook(id);
  if (!existing || existing.userId !== userId) return null;

  const updated: WebhookStorageData = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await storage.saveWebhook(updated);
  return updated;
}

export async function getWebhook(id: string, userId: string): Promise<WebhookStorageData | null> {
  const storage = getStorage();
  const wh = await storage.loadWebhook(id);
  if (!wh || wh.userId !== userId) return null;
  return wh;
}

export async function listUserWebhooks(userId: string): Promise<WebhookStorageData[]> {
  return getStorage().loadUserWebhooks(userId);
}

export async function deleteWebhook(id: string, userId: string): Promise<boolean> {
  const storage = getStorage();
  const wh = await storage.loadWebhook(id);
  if (!wh || wh.userId !== userId) return false;
  await storage.deleteWebhook(id);
  return true;
}

// ──── Delivery Logs ───────────────────────────────────────────────────────

export async function getWebhookDeliveryLogs(
  webhookId: string,
  userId: string,
  limit?: number,
): Promise<WebhookDeliveryLogData[]> {
  const storage = getStorage();
  const wh = await storage.loadWebhook(webhookId);
  if (!wh || wh.userId !== userId) return [];
  return storage.loadWebhookDeliveryLogs(webhookId, limit);
}

// ──── Event Dispatch ──────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_DELIVERY_TIMEOUT_MS = 15_000;
const RESPONSE_BODY_MAX_LENGTH = 1024;

/**
 * Dispatch an event to all active webhooks subscribed to the given event type.
 *
 * This is a fire-and-forget function — errors are logged but not thrown.
 * Call it from anywhere in the backend whenever a notable event occurs.
 *
 * @param event - The event type string (e.g., 'trade:executed')
 * @param payload - The event data to send to subscribers
 * @param userId - Optional: if provided, only dispatch to this user's webhooks
 */
export async function dispatchWebhookEvent(
  event: string,
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  const storage = getStorage();

  try {
    let webhooks: WebhookStorageData[];
    if (userId) {
      // Dispatch only to this user's active webhooks that subscribe to this event
      const userWebhooks = await storage.loadUserWebhooks(userId);
      webhooks = userWebhooks.filter(w => w.isActive && w.events.includes(event));
    } else {
      webhooks = await storage.loadActiveWebhooksByEvent(event);
    }

    if (webhooks.length === 0) return;

    const payloadBody = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    await Promise.allSettled(
      webhooks.map(wh => deliverWithRetry(wh, event, payloadBody)),
    );
  } catch (err) {
    console.error(`[Webhook] Error dispatching event ${event}:`, err);
  }
}

/**
 * Send a test ping to a specific webhook.
 * Returns the delivery result without persisting to the delivery log.
 */
export async function sendTestPing(
  webhookId: string,
  userId: string,
): Promise<{ success: boolean; statusCode: number; duration: number; responseBody: string; errorMessage: string | null }> {
  const storage = getStorage();
  const wh = await storage.loadWebhook(webhookId);
  if (!wh || wh.userId !== userId) {
    return { success: false, statusCode: 0, duration: 0, responseBody: '', errorMessage: 'Webhook not found' };
  }

  const payloadBody = JSON.stringify({
    event: 'ping',
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test ping from Toroloom webhook system.' },
  });

  return attemptDelivery(wh, 'ping', payloadBody);
}

// ──── Delivery Logic ──────────────────────────────────────────────────────

async function deliverWithRetry(
  wh: WebhookStorageData,
  event: string,
  payloadBody: string,
): Promise<void> {
  let lastResult: { success: boolean; statusCode: number; duration: number; responseBody: string; errorMessage: string | null } | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(3, attempt - 2);
      await sleep(backoff);
    }

    lastResult = await attemptDelivery(wh, event, payloadBody);

    if (lastResult.success) break;
  }

  // Persist the delivery log
  const storage = getStorage();
  const logEntry: WebhookDeliveryLogData = {
    id: generateId('whlog'),
    webhookId: wh.id,
    event,
    statusCode: lastResult?.statusCode ?? 0,
    success: lastResult?.success ?? false,
    duration: lastResult?.duration ?? 0,
    responseBody: lastResult?.responseBody?.slice(0, RESPONSE_BODY_MAX_LENGTH) ?? '',
    errorMessage: lastResult?.errorMessage ?? null,
    timestamp: new Date().toISOString(),
  };

  try {
    await storage.saveWebhookDeliveryLog(logEntry);

    // Update webhook stats
    const updated: WebhookStorageData = {
      ...wh,
      deliveryCount: wh.deliveryCount + 1,
      successCount: logEntry.success ? wh.successCount + 1 : wh.successCount,
      lastTriggeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storage.saveWebhook(updated);
  } catch (err) {
    console.error(`[Webhook] Error persisting delivery log for ${wh.id}:`, err);
  }
}

async function attemptDelivery(
  wh: WebhookStorageData,
  event: string,
  payloadBody: string,
): Promise<{ success: boolean; statusCode: number; duration: number; responseBody: string; errorMessage: string | null }> {
  const signature = crypto
    .createHmac('sha256', wh.secret)
    .update(payloadBody)
    .digest('hex');

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MAX_DELIVERY_TIMEOUT_MS);

    const response = await fetch(wh.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'User-Agent': 'Toroloom-Webhook/1.0',
      },
      body: payloadBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const duration = Date.now() - startTime;
    let responseBody = '';
    try {
      responseBody = await response.text();
    } catch {
      responseBody = '<unable to read response body>';
    }

    const success = response.status >= 200 && response.status < 300;

    return {
      success,
      statusCode: response.status,
      duration,
      responseBody: responseBody.slice(0, RESPONSE_BODY_MAX_LENGTH),
      errorMessage: success ? null : `HTTP ${response.status}${responseBody ? ': ' + responseBody.slice(0, 200) : ''}`,
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    const errorMsg = err.name === 'AbortError'
      ? `Request timed out after ${MAX_DELIVERY_TIMEOUT_MS}ms`
      : err.message || 'Unknown error';

    return {
      success: false,
      statusCode: 0,
      duration,
      responseBody: '',
      errorMessage: errorMsg,
    };
  }
}

// ──── Helpers ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ──── Exported helpers for the frontend ───────────────────────────────────

export { generateSecret, maskSecret, generateId };
