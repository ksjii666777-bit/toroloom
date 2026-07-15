/**
 * ============================================================================
 * Toroloom — Telegram Bot Routes Tests
 * ============================================================================
 *
 * Tests for the Telegram linking API endpoints:
 *   POST /api/telegram/generate-code  → Generate a link code
 *   GET  /api/telegram/status         → Check link status
 *   POST /api/telegram/unlink         → Unlink Telegram
 *   POST /api/telegram/test           → Send test message
 *
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: () => void) => {
    req.user = { userId: 'test_user_123' };
    next();
  },
}));

// Mock telegramBot service
vi.mock('../services/telegramBot', () => ({
  generateLinkCode: vi.fn(() => 'TESTCODE1'),
  isUserLinked: vi.fn(() => false),
  getUserLink: vi.fn(() => undefined),
  unlinkUser: vi.fn(() => true),
  sendTestMessage: vi.fn(() => Promise.resolve(true)),
}));

import telegramRoutes from '../routes/telegram';
import {
  generateLinkCode,
  isUserLinked,
  getUserLink,
  unlinkUser,
  sendTestMessage,
} from '../services/telegramBot';

const app = express();
app.use(express.json());
app.use('/api/telegram', telegramRoutes);

describe('Telegram Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/telegram/generate-code', () => {
    it('should generate a link code', async () => {
      const res = await request(app)
        .post('/api/telegram/generate-code')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.code).toBeDefined();
      expect(res.body.instructions).toContain('Open Telegram');
      expect(res.body.expiresIn).toBe(600);
      expect(generateLinkCode).toHaveBeenCalledWith('test_user_123');
    });
  });

  describe('GET /api/telegram/status', () => {
    it('should return unlinked status when not linked', async () => {
      vi.mocked(isUserLinked).mockReturnValue(false);

      const res = await request(app)
        .get('/api/telegram/status')
        .expect(200);

      expect(res.body.linked).toBe(false);
      expect(res.body.chatId).toBeUndefined();
    });

    it('should return linked status when linked', async () => {
      vi.mocked(isUserLinked).mockReturnValue(true);
      vi.mocked(getUserLink).mockReturnValue({
        chatId: 12345,
        firstName: 'Test',
        username: 'testuser',
        linkedAt: '2026-07-14T00:00:00.000Z',
      });

      const res = await request(app)
        .get('/api/telegram/status')
        .expect(200);

      expect(res.body.linked).toBe(true);
      expect(res.body.chatId).toBe(12345);
      expect(res.body.firstName).toBe('Test');
      expect(res.body.username).toBe('testuser');
      expect(res.body.linkedAt).toBeDefined();
    });
  });

  describe('POST /api/telegram/unlink', () => {
    it('should unlink Telegram when linked', async () => {
      vi.mocked(unlinkUser).mockReturnValue(true);

      const res = await request(app)
        .post('/api/telegram/unlink')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('unlinked');
      expect(unlinkUser).toHaveBeenCalledWith('test_user_123');
    });

    it('should return success even when not linked', async () => {
      vi.mocked(unlinkUser).mockReturnValue(false);

      const res = await request(app)
        .post('/api/telegram/unlink')
        .expect(200);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No Telegram connection');
    });
  });

  describe('POST /api/telegram/test', () => {
    it('should send test message when linked', async () => {
      vi.mocked(isUserLinked).mockReturnValue(true);
      vi.mocked(sendTestMessage).mockResolvedValue(true);

      const res = await request(app)
        .post('/api/telegram/test')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Test message sent');
      expect(sendTestMessage).toHaveBeenCalledWith('test_user_123');
    });

    it('should reject test message when not linked', async () => {
      vi.mocked(isUserLinked).mockReturnValue(false);

      const res = await request(app)
        .post('/api/telegram/test')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not linked');
    });

    it('should handle send failure gracefully', async () => {
      vi.mocked(isUserLinked).mockReturnValue(true);
      vi.mocked(sendTestMessage).mockResolvedValue(false);

      const res = await request(app)
        .post('/api/telegram/test')
        .expect(200);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Failed to send');
    });
  });
});
