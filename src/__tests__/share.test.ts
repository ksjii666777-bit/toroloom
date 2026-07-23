/**
 * ============================================================================
 * Toroloom — Share Utility Tests
 * ============================================================================
 *
 * Tests all exported functions from src/utils/share.ts.
 * Mock implementations are set in beforeEach (after vi.clearAllMocks) to
 * ensure they persist through test isolation.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Self-contained react-native mock — empty vi.fn() stubs (no implementations)
vi.mock('react-native', () => ({
  Share: { share: vi.fn(), sharedAction: 'sharedAction', dismissedAction: 'dismissedAction' },
  Alert: { alert: vi.fn() },
  Linking: { canOpenURL: vi.fn(), openURL: vi.fn() },
}));

// Mock expo-clipboard
vi.mock('expo-clipboard', () => ({
  setStringAsync: vi.fn(),
}));

import { Share, Alert, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import {
  shareNative,
  shareCopyLink,
  shareWhatsApp,
  shareTwitter,
  shareTelegram,
  SHARE_ACTIONS,
  showShareSheet,
} from '../utils/share';
import type { ShareContent } from '../utils/share';

// ── Test fixtures ──────────────────────────────────────────────────────────

const defaultContent: ShareContent = {
  title: 'Test Post',
  message: 'Check out this amazing content!',
  url: 'https://toroloom.app/post/123',
  authorName: 'TestUser',
};

const contentWithoutUrl: ShareContent = {
  title: 'No URL',
  message: 'Just a text message',
};

// ── Reset + default implementations ────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Set default mock implementations AFTER clearAllMocks so they persist
  (Share.share as ReturnType<typeof vi.fn>).mockResolvedValue({ action: 'sharedAction' });
  (Alert.alert as ReturnType<typeof vi.fn>).mockImplementation(() => {});
  (Linking.canOpenURL as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  (Linking.openURL as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (Clipboard.setStringAsync as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

// ============================================================================
// SHARE_ACTIONS — Static config
// ============================================================================

describe('SHARE_ACTIONS', () => {
  it('exports exactly 5 actions', () => {
    expect(SHARE_ACTIONS).toHaveLength(5);
  });

  it('includes all expected share actions', () => {
    const ids = SHARE_ACTIONS.map(a => a.id);
    expect(ids).toEqual(['native', 'copy', 'whatsapp', 'twitter', 'telegram']);
  });

  it('each action has required fields', () => {
    for (const action of SHARE_ACTIONS) {
      expect(typeof action.id).toBe('string');
      expect(typeof action.label).toBe('string');
      expect(typeof action.icon).toBe('string');
      expect(typeof action.color).toBe('string');
      expect(typeof action.action).toBe('function');
    }
  });

  it('native action points to shareNative', () => {
    const native = SHARE_ACTIONS.find(a => a.id === 'native')!;
    expect(native.action).toBe(shareNative);
  });

  it('copy action points to shareCopyLink', () => {
    const copy = SHARE_ACTIONS.find(a => a.id === 'copy')!;
    expect(copy.action).toBe(shareCopyLink);
  });

  it('whatsapp action points to shareWhatsApp', () => {
    const wa = SHARE_ACTIONS.find(a => a.id === 'whatsapp')!;
    expect(wa.action).toBe(shareWhatsApp);
  });

  it('twitter action points to shareTwitter', () => {
    const tw = SHARE_ACTIONS.find(a => a.id === 'twitter')!;
    expect(tw.action).toBe(shareTwitter);
  });

  it('telegram action points to shareTelegram', () => {
    const tg = SHARE_ACTIONS.find(a => a.id === 'telegram')!;
    expect(tg.action).toBe(shareTelegram);
  });
});

// ============================================================================
// shareNative
// ============================================================================

describe('shareNative', () => {
  it('calls Share.share with title and message when url is provided', async () => {
    const result = await shareNative(defaultContent);

    expect(result).toBe(true);
    expect(Share.share).toHaveBeenCalledTimes(1);
    expect(Share.share).toHaveBeenCalledWith({
      message: `Check out this amazing content!\n\nhttps://toroloom.app/post/123\n\n— TestUser`,
      title: 'Test Post',
    });
  });

  it('calls Share.share without url when not provided', async () => {
    const result = await shareNative(contentWithoutUrl);

    expect(result).toBe(true);
    expect(Share.share).toHaveBeenCalledWith({
      message: 'Just a text message\n\n— Toroloom',
      title: 'No URL',
    });
  });

  it('uses default title when not provided', async () => {
    await shareNative({ message: 'test', url: 'https://example.com' });

    expect(Share.share).toHaveBeenCalledWith({
      message: 'test\n\nhttps://example.com\n\n— Toroloom',
      title: 'Toroloom',
    });
  });

  it('returns false when Share.share is dismissed', async () => {
    (Share.share as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      action: 'dismissedAction',
    });

    const result = await shareNative(defaultContent);
    expect(result).toBe(false);
  });

  it('triggers haptic success on successful share', async () => {
    await shareNative(defaultContent);

    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it('returns false when Share.share throws', async () => {
    (Share.share as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Share failed'),
    );

    const result = await shareNative(defaultContent);
    expect(result).toBe(false);
  });

  it('includes author name in message when provided', async () => {
    await shareNative(defaultContent);

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('— TestUser'),
      }),
    );
  });

  it('uses Toroloom as default author when not provided', async () => {
    await shareNative({ message: 'test' });

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('— Toroloom'),
      }),
    );
  });
});

// ============================================================================
// shareCopyLink
// ============================================================================

describe('shareCopyLink', () => {
  it('copies message and url to clipboard', async () => {
    const result = await shareCopyLink(defaultContent);

    expect(result).toBe(true);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'Check out this amazing content!\n\nhttps://toroloom.app/post/123',
    );
  });

  it('copies only message when url is not provided', async () => {
    const result = await shareCopyLink(contentWithoutUrl);

    expect(result).toBe(true);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Just a text message');
  });

  it('shows alert confirmation after copying', async () => {
    await shareCopyLink(defaultContent);

    expect(Alert.alert).toHaveBeenCalledWith('Copied!', 'Link copied to clipboard.');
  });

  it('triggers haptic success after copying', async () => {
    await shareCopyLink(defaultContent);

    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it('returns false when Clipboard.setStringAsync throws', async () => {
    (Clipboard.setStringAsync as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Clipboard error'),
    );

    const result = await shareCopyLink(defaultContent);
    expect(result).toBe(false);
  });
});

// ============================================================================
// shareWhatsApp
// ============================================================================

describe('shareWhatsApp', () => {
  it('opens WhatsApp with encoded message and url', async () => {
    const result = await shareWhatsApp(defaultContent);

    expect(result).toBe(true);
    expect(Linking.canOpenURL).toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalled();
  });

  it('calls canOpenURL with whatsapp:// scheme first', async () => {
    await shareWhatsApp(defaultContent);

    expect(Linking.canOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('whatsapp://'),
    );
  });

  it('falls back to https://wa.me when app scheme is not supported', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(false)   // whatsapp:// not supported
      .mockResolvedValueOnce(true);   // https://wa.me is supported

    const result = await shareWhatsApp(defaultContent);

    expect(result).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/'),
    );
  });

  it('returns false when no WhatsApp URL is supported', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await shareWhatsApp(defaultContent);
    expect(result).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('returns false when Linking throws', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Linking error'),
    );

    const result = await shareWhatsApp(defaultContent);
    expect(result).toBe(false);
  });
});

// ============================================================================
// shareTwitter
// ============================================================================

describe('shareTwitter', () => {
  it('opens Twitter with truncated message (max 200 chars) and url', async () => {
    const longContent: ShareContent = {
      message: 'A'.repeat(500),
      url: 'https://toroloom.app/post/long',
    };

    const result = await shareTwitter(longContent);

    expect(result).toBe(true);
    expect(Linking.openURL).toHaveBeenCalled();
    const openedUrl = (Linking.openURL as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(openedUrl).toContain(encodeURIComponent('A'.repeat(200) + '...'));
    expect(openedUrl).toContain(encodeURIComponent('https://toroloom.app/post/long'));
  });

  it('does not add ellipsis for short messages', async () => {
    await shareTwitter(defaultContent);

    const openedUrl = (Linking.openURL as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(openedUrl).not.toContain('...');
  });

  it('includes url in tweet when provided', async () => {
    await shareTwitter(defaultContent);

    const openedUrl = (Linking.openURL as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(openedUrl).toContain(encodeURIComponent('https://toroloom.app/post/123'));
  });

  it('tries twitter://post scheme first, then https fallback', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(false)   // twitter:// not supported
      .mockResolvedValueOnce(true);   // https:// is supported

    await shareTwitter(defaultContent);

    expect(Linking.canOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('twitter://'),
    );
    expect(Linking.canOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('https://twitter.com/'),
    );
  });

  it('returns false when no URL is supported', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await shareTwitter(defaultContent);
    expect(result).toBe(false);
  });

  it('returns false on error', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Linking error'),
    );

    const result = await shareTwitter(defaultContent);
    expect(result).toBe(false);
  });
});

// ============================================================================
// shareTelegram
// ============================================================================

describe('shareTelegram', () => {
  it('opens Telegram with encoded message and url', async () => {
    const result = await shareTelegram(defaultContent);

    expect(result).toBe(true);
    expect(Linking.openURL).toHaveBeenCalled();
  });

  it('calls canOpenURL with tg:// scheme first', async () => {
    await shareTelegram(defaultContent);

    expect(Linking.canOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('tg://'),
    );
  });

  it('falls back to https://t.me when tg:// is not supported', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(false)   // tg:// not supported
      .mockResolvedValueOnce(true);   // https://t.me is supported

    const result = await shareTelegram(defaultContent);

    expect(result).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('https://t.me/'),
    );
  });

  it('includes url parameter in https fallback', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await shareTelegram(defaultContent);

    const openedUrl = (Linking.openURL as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(openedUrl).toContain('url=');
    expect(openedUrl).toContain('text=');
  });

  it('uses empty url in https fallback when no url provided', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await shareTelegram(contentWithoutUrl);

    const openedUrl = (Linking.openURL as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(openedUrl).toContain('url=');
    expect(openedUrl).not.toContain(encodeURIComponent('https://'));
  });

  it('returns false when no URL is supported', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await shareTelegram(defaultContent);
    expect(result).toBe(false);
  });

  it('returns false on error', async () => {
    (Linking.canOpenURL as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Linking error'),
    );

    const result = await shareTelegram(defaultContent);
    expect(result).toBe(false);
  });

  it('does not include author name in message', async () => {
    await shareTelegram(defaultContent);

    const openedUrl = (Linking.openURL as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(openedUrl).not.toContain(encodeURIComponent('TestUser'));
  });
});

// ============================================================================
// showShareSheet
// ============================================================================

describe('showShareSheet', () => {
  it('shows Alert with share options', () => {
    showShareSheet(defaultContent);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Share Post',
      'Share this post with your network',
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining('📤') }),
        expect.objectContaining({ text: expect.stringContaining('🔗') }),
        expect.objectContaining({ text: expect.stringContaining('💬') }),
        expect.objectContaining({ text: expect.stringContaining('🐦') }),
        expect.objectContaining({ text: expect.stringContaining('✈️') }),
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
      ]),
      { cancelable: true },
    );
  });

  it('includes exactly 5 share options plus Cancel', () => {
    showShareSheet(defaultContent);

    const buttons = (Alert.alert as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(buttons).toHaveLength(6);
  });
});
