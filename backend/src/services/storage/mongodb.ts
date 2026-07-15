/**
 * ============================================================================
 * Toroloom MongoDB Storage Engine
 * ============================================================================
 *
 * Persists audit events, risk profiles, and broker state to MongoDB.
 * Uses the `mongodb` driver with the native Node.js client.
 *
 * Collections:
 *   audit_events   — Append-only event log (documents with hash chain)
 *   risk_profiles  — Per-user risk engine state (single document per user)
 *   broker_state   — Single document for broker connection metadata
 *
 * Indexes:
 *   audit_events: { userId: 1 }, { eventType: 1 }, { timestamp: -1 }
 *   risk_profiles: { userId: 1 } (unique)
 * ============================================================================
 */

import type { Collection, Db, MongoClient, MongoClientOptions, Filter } from 'mongodb';
import type { StorageEngine, BrokerStateData, AuditFilter, NotificationData, CommunityPostData, UserSubscriptionData, SnapTradeConnectionData, TelegramLinkData, CouponData, CouponUsageData } from './types';
import type { AuditEvent, AuditTrailSnapshot } from '../auditTrail';
import type { RiskProfile } from '../riskEngine/types';

/**
 * Wait for `ms` – used in exponential backoff.
 */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Default MongoClient options.
 *
 *   serverSelectionTimeoutMS: 5s – fail fast on unreachable server
 *   connectTimeoutMS: 10s – cap the initial TCP handshake wait
 *   socketTimeoutMS: 30s – idle socket timeout (prevents connection
 *     leaks under heavy load)
 *   maxPoolSize: 20 – concurrent operation limit
 *   minPoolSize: 2 – keep a baseline for burst absorption
 *   retryWrites: true – built-in driver-level retry on transient errors
 */
const DEFAULT_CLIENT_OPTIONS: MongoClientOptions = {
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 30_000,
  maxPoolSize: 20,
  minPoolSize: 2,
  retryWrites: true,
};

export class MongoDBStorage implements StorageEngine {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private initialized = false;
  private connectAttempts = 0;

  constructor(
    private uri: string,
    private dbName: string,
  ) {}

  // ──── Lifecycle ────

  /**
   * Connect to MongoDB with exponential backoff retry.
   *
   * Retry schedule:
   *   attempt 1 → 500 ms
   *   attempt 2 → 1 000 ms
   *   attempt 3 → 2 000 ms
   *   attempt 4 → 4 000 ms
   *   attempt 5 → 8 000 ms (cap)
   *   ...        8 000 ms until success
   */
  async connect(): Promise<void> {
    const { MongoClient } = await import('mongodb');

    // Retry loop with exponential backoff (max 5 attempts ≈ ~9s total wait)
    const MAX_ATTEMPTS = 5;
    const MAX_BACKOFF_MS = 8_000;
    while (this.connectAttempts < MAX_ATTEMPTS) {
      this.connectAttempts++;
      try {
        this.client = new MongoClient(this.uri, DEFAULT_CLIENT_OPTIONS);
        await this.client.connect();

        // Verify the connection is usable
        await this.client.db().admin().ping();

        this.db = this.client.db(this.dbName);
        await this.createIndexes();
        this.initialized = true;
        return;
      } catch (err: any) {
        // If we created a client but connect failed, close it to avoid resource leak
        if (this.client) {
          try { await this.client.close(); } catch { /* ignore close errors */ }
          this.client = null;
        }

        const backoff = Math.min(500 * Math.pow(2, this.connectAttempts - 1), MAX_BACKOFF_MS);
        console.error(
          `[MongoDB] Connection attempt ${this.connectAttempts}/${MAX_ATTEMPTS} failed: ${err.message}. ` +
          `Retrying in ${backoff}ms...`,
        );
        await sleep(backoff);
      }
    }

    throw new Error(
      `MongoDB connection failed after ${MAX_ATTEMPTS} attempts. ` +
      `Check that the database is running and MONGODB_URI is correct.`,
    );
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.initialized = false;
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.client || !this.db || !this.initialized) return false;
    try {
      await this.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Not connected');

    const audit = this.db.collection<AuditEvent>('audit_events');
    await audit.createIndex({ userId: 1 });
    await audit.createIndex({ eventType: 1 });
    await audit.createIndex({ timestamp: -1 });

    const risk = this.db.collection('risk_profiles');
    await risk.createIndex({ userId: 1 }, { unique: true });

    const notif = this.db.collection('notifications');
    await notif.createIndex({ userId: 1 });
    await notif.createIndex({ timestamp: -1 });

    const badge = this.db.collection('badge_counts');
    await badge.createIndex({ userId: 1 }, { unique: true });

    const posts = this.db.collection('community_posts');
    await posts.createIndex({ timestamp: -1 });

    const subs = this.db.collection('subscriptions');
    await subs.createIndex({ userId: 1 }, { unique: true });

    const tg = this.db.collection('telegram_links');
    await tg.createIndex({ userId: 1 }, { unique: true });
  }

  private getAuditCollection(): Collection<AuditEvent> {
    if (!this.db) throw new Error('MongoDB not connected');
    return this.db.collection('audit_events');
  }

  private getRiskCollection(): Collection<RiskProfile & { _id?: string }> {
    if (!this.db) throw new Error('MongoDB not connected');
    return this.db.collection('risk_profiles');
  }

  private getBrokerCollection(): Collection<BrokerStateData & { _id?: string }> {
    if (!this.db) throw new Error('MongoDB not connected');
    return this.db.collection('broker_state');
  }

  private getNotificationCollection(): Collection<NotificationData & { _id?: string }> {
    if (!this.db) throw new Error('MongoDB not connected');
    return this.db.collection('notifications');
  }

  private getCommunityCollection(): Collection<CommunityPostData & { _id?: string }> {
    if (!this.db) throw new Error('MongoDB not connected');
    return this.db.collection('community_posts');
  }

  /**
   * Typed helper to query by any field (e.g., { id, userId }).
   * The native driver's Filter<WithId<T>> only allows known keys,
   * but we need to filter by our unique `id` field. This cast is
   * safe because we control the document structure.
   */
  private byId<T>(id: string): Filter<T> {
    return { id } as unknown as Filter<T>;
  }

  // ──── Audit Trail ────

  async appendEvent(event: AuditEvent): Promise<AuditEvent> {
    const col = this.getAuditCollection();
    await col.insertOne(event);
    return event;
  }

  async getLatestEvent(): Promise<AuditEvent | null> {
    const col = this.getAuditCollection();
    const doc = await col.findOne({}, { sort: { timestamp: -1 } });
    if (!doc) return null;
    const { _id, ...event } = doc;
    return event as unknown as AuditEvent;
  }

  async getEventCount(): Promise<number> {
    const col = this.getAuditCollection();
    return col.countDocuments();
  }

  async queryEvents(filter: AuditFilter): Promise<AuditEvent[]> {
    const col = this.getAuditCollection();
    const query: any = {};

    if (filter.userId) query.userId = filter.userId;
    if (filter.eventType) {
      query.eventType = Array.isArray(filter.eventType)
        ? { $in: filter.eventType }
        : filter.eventType;
    }
    if (filter.startTime || filter.endTime) {
      query.timestamp = {};
      if (filter.startTime) query.timestamp.$gte = filter.startTime;
      if (filter.endTime) query.timestamp.$lte = filter.endTime;
    }

    let cursor = col.find(query).sort({ timestamp: -1 });

    if (filter.offset) cursor = cursor.skip(filter.offset);
    if (filter.limit) cursor = cursor.limit(filter.limit);

    const docs = await cursor.toArray();
    return docs.map(({ _id, ...event }) => event as unknown as AuditEvent);
  }

  async getEvent(id: string): Promise<AuditEvent | null> {
    const col = this.getAuditCollection();
    const doc = await col.findOne(this.byId<AuditEvent>(id));
    if (!doc) return null;
    const { _id, ...event } = doc;
    return event as unknown as AuditEvent;
  }

  async getAllEvents(): Promise<AuditEvent[]> {
    const col = this.getAuditCollection();
    const docs = await col.find({}).sort({ timestamp: 1 }).toArray();
    return docs.map(({ _id, ...event }) => event as unknown as AuditEvent);
  }

  async clearForTesting(): Promise<void> {
    if (!this.db) return;
    await this.db.collection('audit_events').deleteMany({});
    await this.db.collection('risk_profiles').deleteMany({});
    await this.db.collection('broker_state').deleteMany({});
    await this.db.collection('notifications').deleteMany({});
    await this.db.collection('badge_counts').deleteMany({});
    await this.db.collection('community_posts').deleteMany({});
    await this.db.collection('telegram_links').deleteMany({});
    await this.db.collection('subscriptions').deleteMany({});
    await this.db.collection('coupons').deleteMany({});
    await this.db.collection('coupon_usage').deleteMany({});
  }

  // ──── Risk Profiles ────

  async loadRiskProfile(userId: string): Promise<RiskProfile | null> {
    const col = this.getRiskCollection();
    const doc: any = await col.findOne({ userId });
    if (!doc) return null;
    const { _id, ...profile } = doc;
    return profile as unknown as RiskProfile;
  }

  async saveRiskProfile(profile: RiskProfile): Promise<void> {
    const col = this.getRiskCollection();
    await col.replaceOne(
      { userId: profile.userId },
      profile as unknown as RiskProfile & { _id?: string },
      { upsert: true },
    );
  }

  async deleteRiskProfile(userId: string): Promise<void> {
    const col = this.getRiskCollection();
    await col.deleteOne({ userId } as unknown as Filter<RiskProfile & { _id?: string }>);
  }

  // ──── Broker State ────

  async loadBrokerState(): Promise<BrokerStateData> {
    const col = this.getBrokerCollection();
    const doc: any = await col.findOne({ _id: 'broker_state' });
    if (!doc) return { currentBrokerType: null, dedupCache: {} };
    const { _id, ...state } = doc;
    return state as unknown as BrokerStateData;
  }

  async saveBrokerState(state: BrokerStateData): Promise<void> {
    const col = this.getBrokerCollection();
    await col.replaceOne(
      { _id: 'broker_state' } as unknown as Filter<BrokerStateData & { _id?: string }>,
      { _id: 'broker_state', ...state } as unknown as BrokerStateData & { _id?: string },
      { upsert: true },
    );
  }

  // ──── Notifications ────

  async saveNotification(notification: NotificationData): Promise<void> {
    const col = this.getNotificationCollection();
    await col.updateOne(
      { id: notification.id } as unknown as Filter<NotificationData & { _id?: string }>,
      {
        // Updated on conflict — matches Postgres ON CONFLICT DO UPDATE SET
        $set: {
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: notification.read,
          timestamp: notification.timestamp,
          data: notification.data,
          metadata: notification.metadata,
        },
        // Only set on insert — preserves userId on conflict
        $setOnInsert: {
          userId: notification.userId,
        },
      },
      { upsert: true },
    );
  }

  async loadNotifications(userId: string): Promise<NotificationData[]> {
    const col = this.getNotificationCollection();
    const docs = await col
      .find({ userId } as unknown as Filter<NotificationData & { _id?: string }>)
      .sort({ timestamp: -1 })
      .toArray();
    return docs.map(({ _id, ...data }) => data as unknown as NotificationData);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const col = this.getNotificationCollection();
    await col.updateOne(
      { id: notificationId } as unknown as Filter<NotificationData & { _id?: string }>,
      { $set: { read: true } },
    );
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const col = this.getNotificationCollection();
    await col.updateMany(
      { userId, read: false } as unknown as Filter<NotificationData & { _id?: string }>,
      { $set: { read: true } },
    );
  }

  async deleteNotification(notificationId: string): Promise<void> {
    const col = this.getNotificationCollection();
    await col.deleteOne({ id: notificationId } as unknown as Filter<NotificationData & { _id?: string }>);
  }

  // ──── Telegram Links ────

  async loadTelegramLink(userId: string): Promise<TelegramLinkData | null> {
    if (!this.db) return null;
    const col = this.db.collection<TelegramLinkData & { _id?: string }>('telegram_links');
    const doc = await col.findOne({ userId } as any);
    if (!doc) return null;
    const { _id, ...link } = doc;
    return link as TelegramLinkData;
  }

  async saveTelegramLink(userId: string, link: TelegramLinkData): Promise<void> {
    if (!this.db) return;
    const col = this.db.collection('telegram_links');
    await col.updateOne(
      { userId },
      { $set: { ...link, userId } },
      { upsert: true },
    );
  }

  async deleteTelegramLink(userId: string): Promise<void> {
    if (!this.db) return;
    const col = this.db.collection('telegram_links');
    await col.deleteOne({ userId });
  }

  async loadAllTelegramLinks(): Promise<TelegramLinkData[]> {
    if (!this.db) return [];
    const col = this.db.collection<TelegramLinkData & { _id?: string }>('telegram_links');
    const docs = await col.find({}).toArray();
    return docs.map(({ _id, ...link }) => link as TelegramLinkData);
  }

  // ──── SnapTrade Connections ────

  async loadSnapTradeConnection(userId: string): Promise<SnapTradeConnectionData | null> {
    if (!this.db) return null;
    const col = this.db.collection('snap_trade_connections');
    const doc: any = await col.findOne({ userId });
    if (!doc) return null;
    const { _id, ...conn } = doc;
    return conn as unknown as SnapTradeConnectionData;
  }

  async saveSnapTradeConnection(userId: string, connection: SnapTradeConnectionData): Promise<void> {
    if (!this.db) return;
    const col = this.db.collection('snap_trade_connections');
    await col.updateOne(
      { userId },
      { $set: { userId, ...connection } },
      { upsert: true },
    );
  }

  async deleteSnapTradeConnection(userId: string): Promise<void> {
    if (!this.db) return;
    const col = this.db.collection('snap_trade_connections');
    await col.deleteOne({ userId });
  }

  // ──── Subscriptions ────

  async loadSubscription(userId: string): Promise<UserSubscriptionData | null> {
    if (!this.db) return null;
    const col = this.db.collection('subscriptions');
    const doc: any = await col.findOne({ userId });
    if (!doc) return null;
    const { _id, ...sub } = doc;
    return sub as unknown as UserSubscriptionData;
  }

  async saveSubscription(userId: string, sub: UserSubscriptionData): Promise<void> {
    if (!this.db) return;
    const col = this.db.collection('subscriptions');
    await col.updateOne(
      { userId },
      { $set: sub },
      { upsert: true },
    );
  }

  // ──── Coupons ────

  async loadCoupon(code: string): Promise<CouponData | null> {
    if (!this.db) return null;
    const col = this.db.collection<CouponData & { _id?: string }>('coupons');
    const doc = await col.findOne({ code: code.toUpperCase() } as any);
    if (!doc) return null;
    const { _id, ...coupon } = doc;
    return coupon as CouponData;
  }

  async saveCoupon(coupon: CouponData): Promise<void> {
    if (!this.db) return;
    const col = this.db.collection('coupons');
    await col.updateOne(
      { code: coupon.code.toUpperCase() },
      { $set: { ...coupon, code: coupon.code.toUpperCase() } },
      { upsert: true },
    );
  }

  async deleteCoupon(code: string): Promise<void> {
    if (!this.db) return;
    await this.db.collection('coupon_usage').deleteMany({ code: code.toUpperCase() });
    await this.db.collection('coupons').deleteOne({ code: code.toUpperCase() });
  }

  async loadAllCoupons(): Promise<CouponData[]> {
    if (!this.db) return [];
    const col = this.db.collection<CouponData & { _id?: string }>('coupons');
    const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map(({ _id, ...coupon }) => coupon as CouponData);
  }

  async incrementCouponUsage(code: string): Promise<void> {
    if (!this.db) return;
    await this.db.collection('coupons').updateOne(
      { code: code.toUpperCase() },
      { $inc: { currentUses: 1 }, $set: { updatedAt: new Date().toISOString() } },
    );
  }

  async recordCouponUsage(usage: CouponUsageData): Promise<void> {
    if (!this.db) return;
    await this.db.collection('coupon_usage').insertOne(usage as any);
  }

  async hasUserUsedCoupon(code: string, userId: string): Promise<boolean> {
    if (!this.db) return false;
    const col = this.db.collection('coupon_usage');
    const doc = await col.findOne({ code: code.toUpperCase(), userId } as any);
    return !!doc;
  }

  async loadUserCouponUsages(userId: string): Promise<CouponUsageData[]> {
    if (!this.db) return [];
    const col = this.db.collection<CouponUsageData & { _id?: string }>('coupon_usage');
    const docs = await col.find({ userId } as any).sort({ usedAt: -1 }).toArray();
    return docs.map(({ _id, ...data }) => data as CouponUsageData);
  }

  // ──── Badge Counts ────

  async loadBadgeCount(userId: string): Promise<number> {
    if (!this.db) return 0;
    const col = this.db.collection('badge_counts');
    const doc = await col.findOne({ userId });
    return (doc?.count as number) ?? 0;
  }

  async saveBadgeCount(userId: string, count: number): Promise<void> {
    if (!this.db) return;
    const col = this.db.collection('badge_counts');
    await col.updateOne(
      { userId },
      { $set: { userId, count } },
      { upsert: true },
    );
  }

  // ──── Community ────

  async saveCommunityPost(post: CommunityPostData): Promise<void> {
    const col = this.getCommunityCollection();
    await col.updateOne(
      { id: post.id } as unknown as Filter<CommunityPostData & { _id?: string }>,
      {
        // Updated on conflict — matches Postgres ON CONFLICT DO UPDATE SET
        $set: {
          content: post.content,
          likes: post.likes,
          comments: post.comments,
          tags: post.tags,
        },
        // Only set on insert — preserves user_name, user_avatar, timestamp on conflict
        $setOnInsert: {
          userId: post.userId,
          userName: post.userName,
          userAvatar: post.userAvatar,
          timestamp: post.timestamp,
        },
      },
      { upsert: true },
    );
  }

  async loadCommunityPosts(): Promise<CommunityPostData[]> {
    const col = this.getCommunityCollection();
    const docs = await col
      .find({})
      .sort({ timestamp: -1 })
      .toArray();
    return docs.map(({ _id, ...data }) => data as unknown as CommunityPostData);
  }

  async loadCommunityPost(id: string): Promise<CommunityPostData | null> {
    const col = this.getCommunityCollection();
    const doc = await col.findOne({ id } as unknown as Filter<CommunityPostData & { _id?: string }>);
    if (!doc) return null;
    const { _id, ...post } = doc;
    return post as unknown as CommunityPostData;
  }

  async likeCommunityPost(postId: string): Promise<void> {
    const col = this.getCommunityCollection();
    await col.updateOne(
      { id: postId } as unknown as Filter<CommunityPostData & { _id?: string }>,
      { $inc: { likes: 1 } },
    );
  }

  async deleteCommunityPost(postId: string): Promise<void> {
    const col = this.getCommunityCollection();
    await col.deleteOne({ id: postId } as unknown as Filter<CommunityPostData & { _id?: string }>);
  }
}
