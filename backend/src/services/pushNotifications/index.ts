/**
 * ============================================================================
 * Toroloom — Expo Push Notification Sender
 * ============================================================================
 *
 * Sends push notifications via the Expo Push API
 * (https://exp.host/--/api/v2/push/send).
 *
 * Usage:
 *   import { sendExpoPushNotification } from '../services/pushNotifications';
 *   await sendExpoPushNotification(pushToken, title, body, data);
 * ============================================================================
 */

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/** Maximum recipients per batch request (Expo limit is 100). */
const BATCH_SIZE = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  /** Sets the iOS/Android app icon badge number. 0 removes the badge. */
  badge?: number;
}

export interface ExpoPushResponse {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Send a push notification to a single Expo push token.
 *
 * @param badge - Optional number to set on the iOS/Android app icon badge.
 *                Pass the total unread count so the badge updates even
 *                when the app is killed.
 */
export async function sendExpoPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  badge?: number,
): Promise<ExpoPushResponse> {
  // Validate token format — Expo push tokens start with "ExponentPushToken[" and end with "]"
  if (!pushToken || !pushToken.startsWith('ExponentPushToken[') || !pushToken.endsWith(']')) {
    return { status: 'error', message: 'Invalid push token format' };
  }

  try {
    const message: ExpoPushMessage = {
      to: pushToken,
      title,
      body,
      data: data || {},
      sound: 'default',
      priority: 'high',
    };
    if (badge !== undefined) {
      message.badge = badge;
    }

    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result: any = await response.json();
    const ticket = result.data?.[0] as any;

    if (!ticket) {
      return { status: 'error', message: 'Empty response from Expo API' };
    }

    if (ticket.status === 'error') {
      return {
        status: 'error',
        message: ticket.message || 'Expo push error',
        details: ticket.details,
      };
    }

    return { status: 'ok', id: ticket.id };
  } catch (err: any) {
    return { status: 'error', message: err.message || 'Network error' };
  }
}

/**
 * Send push notifications in batches to multiple Expo push tokens.
 * Handles rate limiting and error reporting per recipient.
 */
export async function sendBulkExpoPushNotifications(
  messages: { pushToken: string; title: string; body: string; data?: Record<string, unknown> }[],
): Promise<ExpoPushResponse[]> {
  const results: ExpoPushResponse[] = [];

  // Process in batches of 100 (Expo API limit)
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);

    const payload = batch.map(m => ({
      to: m.pushToken,
      title: m.title,
      body: m.body,
      data: m.data || {},
      sound: 'default' as const,
      priority: 'high' as const,
    }));

    try {
      const response = await fetch(EXPO_PUSH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: any = await response.json();
      const tickets: any[] = result.data || [];

      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'error') {
          results.push({
            status: 'error',
            message: ticket.message || 'Expo push error',
            details: ticket.details,
          });
        } else {
          results.push({ status: 'ok', id: ticket.id });
        }
      });
    } catch (err: any) {
      batch.forEach(() => {
        results.push({ status: 'error', message: err.message || 'Network error' });
      });
    }
  }

  return results;
}
