// =============================================================================
// Toroloom — Share Utility
// Enhanced sharing with copy link, WhatsApp, Twitter, and native share sheet
// =============================================================================

import { Share, Alert} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Linking } from 'react-native';

export interface ShareContent {
  /** Post or item title */
  title?: string;
  /** Main content/message to share */
  message: string;
  /** URL link to the content */
  url?: string;
  /** Username of the author */
  authorName?: string;
}

/**
 * Share via the native share sheet (default)
 */
export async function shareNative(content: ShareContent): Promise<boolean> {
  try {
    const shareMessage = content.url
      ? `${content.message}\n\n${content.url}\n\n— ${content.authorName || 'Toroloom'}`
      : `${content.message}\n\n— ${content.authorName || 'Toroloom'}`;

    const result = await Share.share({
      message: shareMessage,
      title: content.title || 'Toroloom',
    });

    if (result.action === Share.sharedAction) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Copy post content and/or link to clipboard
 */
export async function shareCopyLink(content: ShareContent): Promise<boolean> {
  try {
    const text = content.url
      ? `${content.message}\n\n${content.url}`
      : content.message;

    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Link copied to clipboard.');
    return true;
  } catch {
    return false;
  }
}

/**
 * Share to WhatsApp
 */
export async function shareWhatsApp(content: ShareContent): Promise<boolean> {
  try {
    const text = encodeURIComponent(
      `${content.message}\n\n— ${content.authorName || 'Toroloom'}${
        content.url ? `\n\n${content.url}` : ''
      }`
    );

    // Try WhatsApp URLs for both platforms
    const whatsappUrls = [
      `whatsapp://send?text=${text}`,
      `https://wa.me/?text=${text}`,
    ];

    for (const url of whatsappUrls) {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Share to Twitter/X
 */
export async function shareTwitter(content: ShareContent): Promise<boolean> {
  try {
    const tweetText = encodeURIComponent(
      `${content.message.substring(0, 200)}${
        content.message.length > 200 ? '...' : ''
      }${content.url ? `\n\n${content.url}` : ''}`
    );

    const twitterUrls = [
      `twitter://post?message=${tweetText}`,
      `https://twitter.com/intent/tweet?text=${tweetText}`,
    ];

    for (const url of twitterUrls) {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Share to Telegram
 */
export async function shareTelegram(content: ShareContent): Promise<boolean> {
  try {
    const text = encodeURIComponent(
      `${content.message}${content.url ? `\n\n${content.url}` : ''}`
    );

    const telegramUrls = [
      `tg://msg?text=${text}`,
      `https://t.me/share/url?url=${encodeURIComponent(content.url || '')}&text=${encodeURIComponent(content.message)}`,
    ];

    for (const url of telegramUrls) {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Share Action Types ────────────────────────────────────────────────────

export interface ShareAction {
  id: string;
  label: string;
  icon: string;
  color: string;
  action: (content: ShareContent) => Promise<boolean>;
}

export const SHARE_ACTIONS: ShareAction[] = [
  {
    id: 'native',
    label: 'Share to...',
    icon: '📤',
    color: '#3B82F6',
    action: shareNative,
  },
  {
    id: 'copy',
    label: 'Copy Link',
    icon: '🔗',
    color: '#64748B',
    action: shareCopyLink,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    color: '#25D366',
    action: shareWhatsApp,
  },
  {
    id: 'twitter',
    label: 'Twitter / X',
    icon: '🐦',
    color: '#1DA1F2',
    action: shareTwitter,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: '✈️',
    color: '#0088CC',
    action: shareTelegram,
  },
];

/**
 * Show a share action sheet via Alert with all available share options
 */
export function showShareSheet(content: ShareContent): void {
  const buttons = SHARE_ACTIONS.map(action => ({
    text: `${action.icon} ${action.label}`,
    onPress: () => action.action(content),
  }));

  Alert.alert(
    'Share Post',
    'Share this post with your network',
    [...buttons, { text: 'Cancel', style: 'cancel' as const }],
    { cancelable: true }
  );
}


