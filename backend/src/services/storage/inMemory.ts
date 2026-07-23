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

import type { StorageEngine, BrokerStateData, AuditFilter, NotificationData, CommunityPostData, UserSubscriptionData, SnapTradeConnectionData, TelegramLinkData, CouponData, CouponUsageData, WebhookStorageData, WebhookDeliveryLogData, ApiKeyStorageData } from './types';
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

  // ──── Telegram Links ────
  private telegramLinks = new Map<string, TelegramLinkData>();

  async loadTelegramLink(userId: string): Promise<TelegramLinkData | null> {
    return this.telegramLinks.get(userId) ?? null;
  }

  async saveTelegramLink(userId: string, link: TelegramLinkData): Promise<void> {
    this.telegramLinks.set(userId, link);
  }

  async deleteTelegramLink(userId: string): Promise<void> {
    this.telegramLinks.delete(userId);
  }

  async loadAllTelegramLinks(): Promise<TelegramLinkData[]> {
    return Array.from(this.telegramLinks.values());
  }

  // ──── SnapTrade Connections ────
  private snapTradeConnections = new Map<string, SnapTradeConnectionData>();

  async loadSnapTradeConnection(userId: string): Promise<SnapTradeConnectionData | null> {
    return this.snapTradeConnections.get(userId) ?? null;
  }

  async saveSnapTradeConnection(userId: string, connection: SnapTradeConnectionData): Promise<void> {
    this.snapTradeConnections.set(userId, connection);
  }

  async deleteSnapTradeConnection(userId: string): Promise<void> {
    this.snapTradeConnections.delete(userId);
  }

  // ──── Coupons ────
  private coupons = new Map<string, CouponData>();
  private couponUsages: CouponUsageData[] = [];

  async loadCoupon(code: string): Promise<CouponData | null> {
    return this.coupons.get(code.toUpperCase()) ?? null;
  }

  async saveCoupon(coupon: CouponData): Promise<void> {
    this.coupons.set(coupon.code.toUpperCase(), coupon);
  }

  async deleteCoupon(code: string): Promise<void> {
    this.coupons.delete(code.toUpperCase());
    this.couponUsages = this.couponUsages.filter(u => u.code.toUpperCase() !== code.toUpperCase());
  }

  async loadAllCoupons(): Promise<CouponData[]> {
    return Array.from(this.coupons.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async incrementCouponUsage(code: string): Promise<void> {
    const coupon = this.coupons.get(code.toUpperCase());
    if (coupon) {
      coupon.currentUses++;
      coupon.updatedAt = new Date().toISOString();
    }
  }

  async recordCouponUsage(usage: CouponUsageData): Promise<void> {
    this.couponUsages.push(usage);
  }

  async hasUserUsedCoupon(code: string, userId: string): Promise<boolean> {
    return this.couponUsages.some(
      u => u.code.toUpperCase() === code.toUpperCase() && u.userId === userId
    );
  }

  async loadUserCouponUsages(userId: string): Promise<CouponUsageData[]> {
    return this.couponUsages
      .filter(u => u.userId === userId)
      .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime());
  }

  async loadAllCouponUsages(): Promise<CouponUsageData[]> {
    return [...this.couponUsages].sort(
      (a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()
    );
  }

  // ──── Subscriptions ────
  private subscriptions = new Map<string, UserSubscriptionData>();

  async loadSubscription(userId: string): Promise<UserSubscriptionData | null> {
    return this.subscriptions.get(userId) ?? null;
  }

  async saveSubscription(userId: string, sub: UserSubscriptionData): Promise<void> {
    this.subscriptions.set(userId, sub);
  }

  async loadAllSubscriptions(): Promise<UserSubscriptionData[]> {
    return Array.from(this.subscriptions.values());
  }

  // ──── API Keys ────
  private apiKeys = new Map<string, ApiKeyStorageData>();

  async saveApiKey(key: ApiKeyStorageData): Promise<void> {
    this.apiKeys.set(key.id, key);
  }

  async loadApiKeyByHash(hash: string): Promise<ApiKeyStorageData | null> {
    for (const key of this.apiKeys.values()) {
      if (key.keyHash === hash) return key;
    }
    return null;
  }

  async loadUserApiKeys(userId: string): Promise<ApiKeyStorageData[]> {
    return Array.from(this.apiKeys.values()).filter(k => k.userId === userId);
  }

  async loadApiKey(id: string): Promise<ApiKeyStorageData | null> {
    return this.apiKeys.get(id) ?? null;
  }

  async deleteApiKey(id: string): Promise<void> {
    this.apiKeys.delete(id);
  }

  async touchApiKey(id: string): Promise<void> {
    const key = this.apiKeys.get(id);
    if (key) {
      key.lastUsedAt = new Date().toISOString();
      key.updatedAt = new Date().toISOString();
    }
  }

  // ──── Webhooks ────
  private webhooks: WebhookStorageData[] = [];
  private webhookLogs: WebhookDeliveryLogData[] = [];

  async saveWebhook(webhook: WebhookStorageData): Promise<void> {
    const idx = this.webhooks.findIndex(w => w.id === webhook.id);
    if (idx >= 0) {
      this.webhooks[idx] = webhook;
    } else {
      this.webhooks.push(webhook);
    }
  }

  async loadWebhook(id: string): Promise<WebhookStorageData | null> {
    return this.webhooks.find(w => w.id === id) ?? null;
  }

  async loadUserWebhooks(userId: string): Promise<WebhookStorageData[]> {
    return this.webhooks.filter(w => w.userId === userId);
  }

  async loadActiveWebhooksByEvent(event: string): Promise<WebhookStorageData[]> {
    return this.webhooks.filter(w => w.isActive && w.events.includes(event));
  }

  async deleteWebhook(id: string): Promise<void> {
    this.webhooks = this.webhooks.filter(w => w.id !== id);
  }

  async saveWebhookDeliveryLog(log: WebhookDeliveryLogData): Promise<void> {
    const idx = this.webhookLogs.findIndex(l => l.id === log.id);
    if (idx >= 0) {
      this.webhookLogs[idx] = log;
    } else {
      this.webhookLogs.push(log);
    }
  }

  async loadWebhookDeliveryLogs(webhookId: string, limit?: number): Promise<WebhookDeliveryLogData[]> {
    let logs = this.webhookLogs
      .filter(l => l.webhookId === webhookId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (limit) logs = logs.slice(0, limit);
    return logs;
  }

  // ──── Idempotency ────
  private processedEvents = new Set<string>();

  async markEventProcessed(eventId: string): Promise<void> {
    this.processedEvents.add(eventId);
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    return this.processedEvents.has(eventId);
  }

  // ──── Lifecycle ────
  async connect(): Promise<void> {
    // Nothing to do for in-memory
  }

  async disconnect(): Promise<void> {
    this.events = [];
    this.riskProfiles.clear();
    this.badgeCounts.clear();
    this.brokerCurrentType = null;
    this.brokerDedupCache = {};
    this.notifications = [];
    this.communityPosts = [];
    this.webhooks = [];
    this.webhookLogs = [];
    this.processedEvents.clear();
    this.subscriptions.clear();
    this.telegramLinks.clear();
    this.apiKeys.clear();
    this.coupons.clear();
    this.couponUsages = [];
  }

  async isHealthy(): Promise<boolean> {
    return true; // Always healthy
  }
}
