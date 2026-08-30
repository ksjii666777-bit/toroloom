/**
 * ============================================================================
 * Toroloom — Share Analytics Store
 * ============================================================================
 *
 * Tracks share events locally for analytics dashboard:
 *   - Total shares per platform
 *   - Shares by content type (stock, post, course, advisor)
 *   - Share history with timestamps
 *   - Top shared content
 *
 * ============================================================================
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from '../services/analytics';

// ── Types ──────────────────────────────────────────────────────────────────

export type SharePlatform = 'native' | 'copy' | 'whatsapp' | 'twitter' | 'telegram';
export type ShareContentType = 'stock' | 'post' | 'course' | 'advisor' | 'general';

export interface ShareEvent {
  id: string;
  platform: SharePlatform;
  contentType: ShareContentType;
  contentId?: string;
  contentSymbol?: string;
  timestamp: number;
}

export interface ShareStats {
  totalShares: number;
  sharesByPlatform: Record<SharePlatform, number>;
  sharesByContentType: Record<ShareContentType, number>;
  recentShares: ShareEvent[];
  topSharedStocks: { symbol: string; count: number }[];
  topSharedPosts: { postId: string; count: number }[];
  lastShareTime?: number;
}

interface ShareAnalyticsState {
  /** All share events */
  events: ShareEvent[];
  /** Whether data has been loaded from AsyncStorage */
  initialized: boolean;

  // ── Actions ──
  /** Record a share event */
  trackShare: (params: {
    platform: SharePlatform;
    contentType: ShareContentType;
    contentId?: string;
    contentSymbol?: string;
  }) => void;
  /** Get aggregated share stats */
  getStats: () => ShareStats;
  /** Get shares for a specific content item */
  getSharesForContent: (contentType: ShareContentType, contentId: string) => number;
  /** Get shares for a specific stock */
  getSharesForStock: (symbol: string) => number;
  /** Clear all share history */
  clearHistory: () => void;
  /** Load persisted data */
  loadFromStorage: () => Promise<void>;
  /** Persist to AsyncStorage */
  saveToStorage: () => Promise<void>;
}

// ── Storage Key ────────────────────────────────────────────────────────────

const STORAGE_KEY = '@toroloom_share_analytics';
const MAX_EVENTS = 1000; // Keep last 1000 events

// ── Helpers ────────────────────────────────────────────────────────────────

function generateEventId(): string {
  return `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useShareAnalyticsStore = create<ShareAnalyticsState>((set, get) => ({
  events: [],
  initialized: false,

  trackShare: (params) => {
    const event: ShareEvent = {
      id: generateEventId(),
      platform: params.platform,
      contentType: params.contentType,
      contentId: params.contentId,
      contentSymbol: params.contentSymbol,
      timestamp: Date.now(),
    };

    // Add to events (prepend for chronological order)
    const events = [event, ...get().events].slice(0, MAX_EVENTS);
    set({ events });

    // Log to Firebase Analytics
    analytics.logEvent('share_completed', {
      platform: params.platform,
      contentType: params.contentType,
      contentId: params.contentId,
      contentSymbol: params.contentSymbol,
    });

    // Persist async (don't block UI)
    get().saveToStorage().catch(() => {});
  },

  getStats: () => {
    const { events } = get();

    const sharesByPlatform: Record<SharePlatform, number> = {
      native: 0,
      copy: 0,
      whatsapp: 0,
      twitter: 0,
      telegram: 0,
    };

    const sharesByContentType: Record<ShareContentType, number> = {
      stock: 0,
      post: 0,
      course: 0,
      advisor: 0,
      general: 0,
    };

    const stockCounts = new Map<string, number>();
    const postCounts = new Map<string, number>();

    for (const event of events) {
      sharesByPlatform[event.platform]++;
      sharesByContentType[event.contentType]++;

      if (event.contentType === 'stock' && event.contentSymbol) {
        stockCounts.set(event.contentSymbol, (stockCounts.get(event.contentSymbol) || 0) + 1);
      }
      if (event.contentType === 'post' && event.contentId) {
        postCounts.set(event.contentId, (postCounts.get(event.contentId) || 0) + 1);
      }
    }

    // Top shared stocks (sorted by count desc, max 10)
    const topSharedStocks = Array.from(stockCounts.entries())
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top shared posts (sorted by count desc, max 10)
    const topSharedPosts = Array.from(postCounts.entries())
      .map(([postId, count]) => ({ postId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalShares: events.length,
      sharesByPlatform,
      sharesByContentType,
      recentShares: events.slice(0, 20), // Last 20 shares
      topSharedStocks,
      topSharedPosts,
      lastShareTime: events[0]?.timestamp,
    };
  },

  getSharesForContent: (contentType, contentId) => {
    return get().events.filter(
      e => e.contentType === contentType && e.contentId === contentId
    ).length;
  },

  getSharesForStock: (symbol) => {
    return get().events.filter(
      e => e.contentType === 'stock' && e.contentSymbol === symbol
    ).length;
  },

  clearHistory: () => {
    set({ events: [] });
    get().saveToStorage().catch(() => {});
  },

  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const events = JSON.parse(stored) as ShareEvent[];
        set({ events, initialized: true });
      } else {
        set({ initialized: true });
      }
    } catch {
      set({ initialized: true });
    }
  },

  saveToStorage: async () => {
    try {
      const { events } = get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  },
}));

// Auto-load on import
useShareAnalyticsStore.getState().loadFromStorage();
