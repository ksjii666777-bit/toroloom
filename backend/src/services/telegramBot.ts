/**
 * ============================================================================
 * Toroloom — Telegram Bot Notification Service
 * ============================================================================
 *
 * Sends real-time trading alerts, price notifications, and portfolio updates
 * to users via Telegram bot. Users link their Telegram account by sending
 * /start to the bot and entering the generated code in the app.
 *
 * Architecture:
 *   - TelegramBot singleton (lazy-initialized via configureTelegramBot)
 *   - Link flow: app generates code → user sends it to bot → bot confirms
 *   - Messages are sent via the bot's API using chat IDs stored per user
 *
 * Usage:
 *   import { telegramBot } from '../services/telegramBot';
 *   await telegramBot.sendMessage(chatId, 'Hello!');
 * ============================================================================
 */

import TelegramBot from 'node-telegram-bot-api';

// Logger — uses console directly since no backend logger utility exists
const log = {
  info: (msg: string) => console.log(`[TelegramBot] ${msg}`),
  warn: (msg: string) => console.warn(`[TelegramBot] ${msg}`),
  error: (msg: string, err?: any) => console.error(`[TelegramBot] ${msg}`, err || ''),
};

// ──── Types ──────────────────────────────────────────────────────────────

export interface TelegramUserLink {
  /** Telegram chat ID (numeric) */
  chatId: number;
  /** Display name from Telegram */
  firstName: string;
  /** Optional username @handle */
  username?: string;
  /** When the link was established */
  linkedAt: string;
}

interface PendingLink {
  userId: string;
  code: string;
  createdAt: number;
}

// ──── State ──────────────────────────────────────────────────────────────

let bot: TelegramBot | null = null;
let botToken: string = '';
let botInitialized = false;

/** Map of userId → TelegramUserLink (in-memory; can be extended to storage) */
const userLinks = new Map<string, TelegramUserLink>();

/** Map of link code → PendingLink (for the /start flow) */
const pendingLinks = new Map<string, PendingLink>();

// Clean up expired pending links every 5 minutes
const PENDING_LINK_TTL_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, link] of pendingLinks) {
    if (now - link.createdAt > PENDING_LINK_TTL_MS) {
      pendingLinks.delete(code);
    }
  }
}, 5 * 60 * 1000);

// ──── Initialization ────────────────────────────────────────────────────

export interface TelegramBotConfig {
  token: string;
}

/**
 * Initialize the Telegram bot with the bot token.
 * Must be called at server startup (from server.ts).
 * If token is empty, the bot runs in "dry mode" (logs messages, doesn't send).
 */
export function configureTelegramBot(config: TelegramBotConfig): void {
  botToken = config.token;

  if (!botToken) {
    log.info('[TelegramBot] No token configured — running in dry mode');
    botInitialized = true;
    return;
  }

  try {
    bot = new TelegramBot(botToken, { polling: true });
    botInitialized = true;

    // Handle /start command for linking
    bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const linkCode = match?.[1]?.trim();

      if (!linkCode) {
        // No link code — send a welcome message with instructions
        await bot!.sendMessage(
          chatId,
          `🤖 *Welcome to Toroloom Bot!*\n\n` +
          `Get real-time trading alerts, price notifications, and portfolio updates ` +
          `sent directly to your Telegram.\n\n` +
          `To link your account:\n` +
          `1. Open the Toroloom app\n` +
          `2. Go to Settings → Connect Telegram\n` +
          `3. You'll get a code — send it here:\n\n` +
          `   \`/start YOUR_CODE\`\n\n` +
          `Need help? Contact support@toroloom.com`,
          { parse_mode: 'Markdown' },
        );
        return;
      }

      // Try to match the link code
      const pending = pendingLinks.get(linkCode);
      if (!pending) {
        await bot!.sendMessage(
          chatId,
          `❌ *Invalid or expired code.*\n\n` +
          `Please generate a new code from the Toroloom app and try again.\n` +
          `Codes expire after 10 minutes.`,
          { parse_mode: 'Markdown' },
        );
        return;
      }

      // Link successful!
      const link: TelegramUserLink = {
        chatId,
        firstName: msg.from?.first_name || 'User',
        username: msg.from?.username,
        linkedAt: new Date().toISOString(),
      };

      userLinks.set(pending.userId, link);
      pendingLinks.delete(linkCode);

      await bot!.sendMessage(
        chatId,
        `✅ *Telegram Linked Successfully!* 🎉\n\n` +
        `Hi ${link.firstName}! Your Toroloom account is now connected.\n\n` +
        `You'll start receiving:\n` +
        `📊 Portfolio alerts\n` +
        `🎯 Price target notifications\n` +
        `✅ Trade confirmation updates\n` +
        `📰 Market news & insights\n\n` +
        `To unlink, go to Toroloom App → Settings → Telegram.`,
        { parse_mode: 'Markdown' },
      );

      log.info(`[TelegramBot] User ${pending.userId} linked to Telegram chat ${chatId} (@${link.username || 'none'})`);
    });

    // Handle errors
    bot.on('polling_error', (error: any) => {
      log.error('[TelegramBot] Polling error:', error.message || error);
    });

    log.info('[TelegramBot] Bot initialized with polling');
  } catch (error: any) {
    log.error('[TelegramBot] Failed to initialize:', error.message || error);
    botInitialized = true; // Still mark as initialized so the app doesn't hang
  }
}

// ──── Public API ────────────────────────────────────────────────────────

/**
 * Generate a unique link code for a user to connect their Telegram.
 * Returns the code that the user should send to the bot via /start <code>.
 */
export function generateLinkCode(userId: string): string {
  // Clean up any existing pending link for this user
  for (const [code, link] of pendingLinks) {
    if (link.userId === userId) {
      pendingLinks.delete(code);
    }
  }

  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  pendingLinks.set(code, {
    userId,
    code,
    createdAt: Date.now(),
  });

  return code;
}

/**
 * Check if a user has Telegram linked.
 */
export function isUserLinked(userId: string): boolean {
  return userLinks.has(userId);
}

/**
 * Get the Telegram link info for a user.
 */
export function getUserLink(userId: string): TelegramUserLink | undefined {
  return userLinks.get(userId);
}

/**
 * Unlink a user's Telegram account.
 */
export function unlinkUser(userId: string): boolean {
  return userLinks.delete(userId);
}

/**
 * Send a text message to a user via Telegram.
 * Returns true if the message was sent successfully.
 */
export async function sendMessage(
  userId: string,
  message: string,
  options?: { parse_mode?: 'Markdown' | 'HTML'; disable_notification?: boolean },
): Promise<boolean> {
  const link = userLinks.get(userId);
  if (!link) {
    log.warn(`[TelegramBot] User ${userId} has no linked Telegram`);
    return false;
  }

  if (!bot || !botToken) {
    log.info(`[TelegramBot] Dry mode: Would send to ${link.chatId}: ${message.substring(0, 80)}...`);
    return true; // Pretend success in dry mode
  }

  try {
    await bot.sendMessage(link.chatId, message, {
      parse_mode: options?.parse_mode || 'Markdown',
      disable_notification: options?.disable_notification || false,
    });
    return true;
  } catch (error: any) {
    log.error(`[TelegramBot] Failed to send to ${link.chatId}:`, error.message || error);

    // If bot was blocked or chat not found, unlink the user
    if (error.response?.statusCode === 403) {
      log.warn(`[TelegramBot] Bot blocked by user ${userId} — unlinking`);
      unlinkUser(userId);
    }

    return false;
  }
}

/**
 * Send a rich notification with buttons to a user.
 */
export async function sendNotification(
  userId: string,
  title: string,
  body: string,
  buttons?: { text: string; url?: string; callback_data?: string }[],
): Promise<boolean> {
  const link = userLinks.get(userId);
  if (!link) return false;

  let message = `*${title}*\n\n${body}`;

  if (!bot || !botToken) {
    log.info(`[TelegramBot] Dry mode: ${title} → ${userId}`);
    return true;
  }

  try {
    const replyMarkup = buttons && buttons.length > 0
      ? {
          inline_keyboard: buttons.map(btn => [{
            text: btn.text,
            url: btn.url,
            callback_data: btn.callback_data,
          }]),
        }
      : undefined;

    await bot.sendMessage(link.chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    });
    return true;
  } catch (error: any) {
    log.error(`[TelegramBot] sendNotification failed:`, error);
    return false;
  }
}

/**
 * Send a trading alert to a user.
 */
export async function sendTradingAlert(
  userId: string,
  alertType: 'price_target' | 'trade_executed' | 'portfolio_alert' | 'market_news',
  data: {
    symbol?: string;
    price?: number;
    quantity?: number;
    direction?: 'buy' | 'sell' | 'above' | 'below';
    message: string;
  },
): Promise<boolean> {
  const emoji = alertType === 'price_target' ? '🎯'
    : alertType === 'trade_executed' ? '✅'
    : alertType === 'portfolio_alert' ? '📊'
    : '📰';

  const title = `${emoji} ${alertType === 'price_target' ? 'Price Alert'
    : alertType === 'trade_executed' ? 'Trade Executed'
    : alertType === 'portfolio_alert' ? 'Portfolio Update'
    : 'Market News'}`;

  let body = data.message;

  // Add price/symbol context if available
  if (data.symbol && data.price) {
    body += `\n\n📈 *${data.symbol}* — ₹${data.price.toLocaleString('en-IN')}`;
  }
  if (data.quantity) {
    body += `\n📦 Qty: ${data.quantity}`;
  }

  const buttons = data.symbol
    ? [{ text: `🔍 View ${data.symbol}`, callback_data: `view_${data.symbol}` }]
    : undefined;

  return sendNotification(userId, title, body, buttons);
}

/**
 * Send a test message to verify Telegram is working.
 */
export async function sendTestMessage(userId: string): Promise<boolean> {
  return sendMessage(
    userId,
    `✅ *Toroloom Telegram Connected!*\n\n` +
    `Your notifications are working perfectly. You'll now receive:\n\n` +
    `• 📊 Portfolio alerts and P&L updates\n` +
    `• 🎯 Price target hits & drops\n` +
    `• ✅ Trade confirmations\n` +
    `• 📰 Market news & AI insights\n\n` +
    `_Sent via Toroloom Bot_ 🤖`,
  );
}

/**
 * Get the total number of linked Telegram users.
 */
export function getLinkedUserCount(): number {
  return userLinks.size;
}

/**
 * Get all linked Telegram users (for admin use).
 */
export function getAllLinkedUsers(): Map<string, TelegramUserLink> {
  return new Map(userLinks);
}

export { bot as telegramBotInstance };
