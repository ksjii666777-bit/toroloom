/**
 * ============================================================================
 * Toroloom InMemory Storage Engine
 * ============================================================================
 *
 * Default persistence backend. Stores everything in process memory.
 * No external dependencies required. Used for development, testing,
 * and as the fallback when no database is configured.
 *
 * In production, swap to PostgreSQLStorage or MongoDBStorage via env.
 * ============================================================================
 */

import type { StorageEngine, BrokerStateData, AuditFilter, NotificationData, CommunityPostData } from './types';
import type { AuditEvent, AuditTrailSnapshot } from '../auditTrail';
import type { RiskProfile } from '../riskEngine/types';

export class InMemoryStorage implements StorageEngine {
  // ──── Audit Trail ────
  private events: AuditEvent[] = [];

  async appendEvent(event: AuditEvent): Promise<AuditEvent> {
    this.events.push(event);
    return event;
  }

  async getLatestEvent(): Promise<AuditEvent | null> {
    return this.events.length > 0 ? this.events[this.events.length - 1] : null;
  }

  async getEventCount(): Promise<number> {
    return this.events.length;
  }

  async queryEvents(filter: AuditFilter): Promise<AuditEvent[]> {
    let filtered = [...this.events];

    if (filter.userId) {
      filtered = filtered.filter((e) => e.userId === filter.userId);
    }
    if (filter.eventType) {
      const types = Array.isArray(filter.eventType)
        ? filter.eventType
        : [filter.eventType];
      filtered = filtered.filter((e) => types.includes(e.eventType));
    }
    if (filter.startTime) {
      filtered = filtered.filter((e) => e.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      filtered = filtered.filter((e) => e.timestamp <= filter.endTime!);
    }

    // Reverse chronological
    filtered.reverse();

    if (filter.offset) {
      filtered = filtered.slice(filter.offset);
    }
    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  async getEvent(id: string): Promise<AuditEvent | null> {
    return this.events.find((e) => e.id === id) ?? null;
  }

  async getAllEvents(): Promise<AuditEvent[]> {
    return [...this.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async clearForTesting(): Promise<void> {
    this.events = [];
  }

  // ──── Risk Profiles ────
  private riskProfiles = new Map<string, RiskProfile>();

  async loadRiskProfile(userId: string): Promise<RiskProfile | null> {
    return this.riskProfiles.get(userId) ?? null;
  }

  async saveRiskProfile(profile: RiskProfile): Promise<void> {
    this.riskProfiles.set(profile.userId, profile);
  }

  async deleteRiskProfile(userId: string): Promise<void> {
    this.riskProfiles.delete(userId);
  }

  // ──── Badge Counts ────
  private badgeCounts = new Map<string, number>();

  async loadBadgeCount(userId: string): Promise<number> {
    return this.badgeCounts.get(userId) ?? 0;
  }

  async saveBadgeCount(userId: string, count: number): Promise<void> {
    this.badgeCounts.set(userId, count);
  }

  // ──── Broker State ────
  private brokerCurrentType: string | null = null;
  private brokerDedupCache: Record<string, { lastEvent: 'BROKER_CONNECTED' | 'BROKER_DISCONNECTED'; timestamp: number }> = {};

  async loadBrokerState(): Promise<BrokerStateData> {
    return {
      currentBrokerType: this.brokerCurrentType,
      dedupCache: { ...this.brokerDedupCache },
    };
  }

  async saveBrokerState(state: BrokerStateData): Promise<void> {
    this.brokerCurrentType = state.currentBrokerType;
    this.brokerDedupCache = { ...state.dedupCache };
  }

  // ──── Notifications ────
  private notifications: NotificationData[] = [];

  async saveNotification(notification: NotificationData): Promise<void> {
    const idx = this.notifications.findIndex((n) => n.id === notification.id);
    if (idx >= 0) {
      // Preserve userId on conflict — matches Postgres (user_id omitted from ON CONFLICT DO UPDATE SET)
      this.notifications[idx].type = notification.type;
      this.notifications[idx].title = notification.title;
      this.notifications[idx].message = notification.message;
      this.notifications[idx].read = notification.read;
      this.notifications[idx].timestamp = notification.timestamp;
      this.notifications[idx].data = notification.data;
      this.notifications[idx].metadata = notification.metadata;
    } else {
      this.notifications.push(notification);
    }
  }

  async loadNotifications(userId: string): Promise<NotificationData[]> {
    return this.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) notif.read = true;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    this.notifications
      .filter((n) => n.userId === userId)
      .forEach((n) => { n.read = true; });
  }

  async deleteNotification(notificationId: string): Promise<void> {
    this.notifications = this.notifications.filter((n) => n.id !== notificationId);
  }

  // ──── Community ────
  private communityPosts: CommunityPostData[] = [];

  async saveCommunityPost(post: CommunityPostData): Promise<void> {
    const idx = this.communityPosts.findIndex((p) => p.id === post.id);
    if (idx >= 0) {
      // Preserve user_name, user_avatar, timestamp on conflict — matches Postgres ON CONFLICT DO UPDATE SET
      this.communityPosts[idx].content = post.content;
      this.communityPosts[idx].likes = post.likes;
      this.communityPosts[idx].comments = post.comments;
      this.communityPosts[idx].tags = post.tags;
    } else {
      this.communityPosts.push(post);
    }
  }

  async loadCommunityPosts(): Promise<CommunityPostData[]> {
    return [...this.communityPosts].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async loadCommunityPost(id: string): Promise<CommunityPostData | null> {
    return this.communityPosts.find((p) => p.id === id) ?? null;
  }

  async likeCommunityPost(postId: string): Promise<void> {
    const post = this.communityPosts.find((p) => p.id === postId);
    if (post) post.likes += 1;
  }

  async deleteCommunityPost(postId: string): Promise<void> {
    this.communityPosts = this.communityPosts.filter((p) => p.id !== postId);
  }

  // ──── Lifecycle ────
  async connect(): Promise<void> {
    // Nothing to do for in-memory
  }

  async disconnect(): Promise<void> {
    this.events = [];
    this.riskProfiles.clear();
    this.brokerCurrentType = null;
    this.brokerDedupCache = {};
    this.notifications = [];
    this.communityPosts = [];
  }

  async isHealthy(): Promise<boolean> {
    return true; // Always healthy
  }
}
