/**
 * ============================================================================
 * Toroloom — Telegram Bot Routes
 * ============================================================================
 *
 * Manages Telegram bot linking for users:
 *
 *   POST /api/telegram/generate-code  → Generate a link code for the user
 *   GET  /api/telegram/status         → Check if user's Telegram is linked
 *   POST /api/telegram/unlink         → Unlink Telegram from account
 *   POST /api/telegram/test           → Send a test message
 *
 * All routes require authMiddleware.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  generateLinkCode,
  isUserLinked,
  getUserLink,
  unlinkUser,
  sendTestMessage,
} from '../services/telegramBot';

const router = Router();
router.use(authMiddleware);

// ──── POST /api/telegram/generate-code ──────────────────────────────────

router.post('/generate-code', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const code = generateLinkCode(userId);

    res.json({
      success: true,
      code,
      instructions: `Open Telegram, find @ToroloomBot, and send: /start ${code}`,
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to generate code';
    console.error('[Telegram] /generate-code error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ──── GET /api/telegram/status ──────────────────────────────────────────

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const linked = isUserLinked(userId);
    const link = linked ? getUserLink(userId) : undefined;

    res.json({
      linked,
      chatId: link?.chatId,
      firstName: link?.firstName,
      username: link?.username,
      linkedAt: link?.linkedAt,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to check status';
    console.error('[Telegram] /status error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ──── POST /api/telegram/unlink ─────────────────────────────────────────

router.post('/unlink', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const unlinked = unlinkUser(userId);

    res.json({
      success: unlinked,
      message: unlinked
        ? 'Telegram unlinked successfully'
        : 'No Telegram connection found',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to unlink';
    console.error('[Telegram] /unlink error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ──── POST /api/telegram/test ───────────────────────────────────────────

router.post('/test', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    if (!isUserLinked(userId)) {
      res.status(400).json({ success: false, message: 'Telegram not linked. Generate a code first.' });
      return;
    }

    const sent = await sendTestMessage(userId);

    res.json({
      success: sent,
      message: sent
        ? 'Test message sent! Check your Telegram.'
        : 'Failed to send test message. Make sure you have started the bot.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to send test';
    console.error('[Telegram] /test error:', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
