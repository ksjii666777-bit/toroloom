/**
 * ============================================================================
 * Toroloom Storage Engine — Abstract Persistence Interface
 * ============================================================================
 *
 * Defines the contract for all persistence backends: InMemory, PostgreSQL,
 * and MongoDB. The factory in index.ts picks the active backend from env.
 *
 * Five domains:
 *   1. Audit Trail — append-only event log with SHA-256 hash chaining
 *   2. Risk Profiles — per-user Financial Bodyguard state
 *   3. Broker State — current broker type + dedup cache
 *   4. Notifications — per-user push notification records
 *   5. Community — user-generated posts and interactions
 * ============================================================================
 */

import type { AuditEvent, AuditEventType } from '../auditTrail';
import type { RiskProfile } from '../riskEngine/types';

// ==================== Audit Domain ====================

export interface AuditFilter {
  userId?: string;
  eventType?: AuditEventType | AuditEventType[];
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface AuditAppendParams {
  userId: string;
  eventType: AuditEventType;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ==================== Broker State Domain ====================

// ==================== Telegram User Link Domain ====================

export interface TelegramLinkData {
  userId: string;
  chatId: number;
  firstName: string;
  username?: string;
  linkedAt: string;
}

// ==================== SnapTrade Connection Domain ====================

export interface SnapTradeConnectionData {
  snapTradeUserId: string;
  encryptedUserSecret: string;
  authorizationId: string;
  accountId: string;
  brokerName: string;
  brokerSlug: string;
  accountName: string;
  connectedAt: string;
}

// ==================== Broker State Domain ====================

export interface BrokerStateEntry {
  lastEvent: 'BROKER_CONNECTED' | 'BROKER_DISCONNECTED';
  timestamp: number;
}

export interface BrokerStateData {
  currentBrokerType: string | null;
  dedupCache: Record<string, BrokerStateEntry>;
}

// ==================== Notification Domain ====================

export interface NotificationData {
  id: string;
  userId: string;
  type: 'price_alert' | 'trade' | 'news' | 'system' | 'educational' | 'portfolio_alert';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ==================== Subscription Domain ====================

export interface UserSubscriptionData {
  userId: string;
  tier: 'free' | 'pro' | 'elite';
  planId: string;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  paymentMethod?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  lastPaymentDate?: string;
  tenantId?: string;
  updatedAt: string;
}

// ==================== Coupon Domain ====================

export interface CouponData {
  code: string;
  type: 'percentage' | 'fixed' | 'free_trial';
  value: number;
  trialDays?: number;
  minPlanTier?: 'free' | 'pro' | 'elite';
  maxUses: number;
  currentUses: number;
  expiresAt: string | null;
  isActive: boolean;
  description: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CouponUsageData {
  id: string;
  code: string;
  userId: string;
  planId: string;
  discountAmount: number;
  originalPrice: number;
  finalPrice: number;
  usedAt: string;
}

// ==================== Community Domain ====================

export interface CommunityPostData {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  likes: number;
  comments: number;
  timestamp: string;
  tags: string[];
}

// ==================== Storage Engine Interface ====================

export interface StorageEngine {
  // ──── Audit Trail ────

  /** Append an event. Returns the computed event (with id, timestamp, hashes). */
  appendEvent(
    params: AuditAppendParams & {
      id: string;
      timestamp: string;
      previousHash: string;
      hash: string;
    },
  ): Promise<AuditEvent>;

  /** Get the latest event (needed for computing next previousHash). */
  getLatestEvent(): Promise<AuditEvent | null>;

  /** Count total events. */
  getEventCount(): Promise<number>;

  /** Query events with filters. */
  queryEvents(filter: AuditFilter): Promise<AuditEvent[]>;

  /** Get a single event by ID. */
  getEvent(id: string): Promise<AuditEvent | null>;

  /** Get ALL events in insertion order (for verifyIntegrity). */
  getAllEvents(): Promise<AuditEvent[]>;

  /** Clear all events (testing only). */
  clearForTesting(): Promise<void>;

  // ──── Risk Profiles ────

  /** Load a risk profile from storage. */
  loadRiskProfile(userId: string): Promise<RiskProfile | null>;

  /** Save (insert or overwrite) a risk profile. */
  saveRiskProfile(profile: RiskProfile): Promise<void>;

  /** Delete a risk profile. */
  deleteRiskProfile(userId: string): Promise<void>;

  // ──── Broker State ────

  /** Load the persisted broker state. */
  loadBrokerState(): Promise<BrokerStateData>;

  /** Save the broker state after any mutation. */
  saveBrokerState(state: BrokerStateData): Promise<void>;

  // ──── Notifications ────

  /** Save (insert or overwrite) a notification. */
  saveNotification(notification: NotificationData): Promise<void>;

  /** Load all notifications for a user, most recent first. */
  loadNotifications(userId: string): Promise<NotificationData[]>;

  /** Mark a single notification as read. */
  markNotificationRead(notificationId: string): Promise<void>;

  /** Mark all notifications for a user as read. */
  markAllNotificationsRead(userId: string): Promise<void>;

  /** Delete a notification by ID. */
  deleteNotification(notificationId: string): Promise<void>;

  // ──── Community ────

  /** Save (insert or overwrite) a community post. */
  saveCommunityPost(post: CommunityPostData): Promise<void>;

  /** Load all community posts, most recent first. */
  loadCommunityPosts(): Promise<CommunityPostData[]>;

  /** Load a single community post by ID. */
  loadCommunityPost(id: string): Promise<CommunityPostData | null>;

  /** Increment the like count on a community post. */
  likeCommunityPost(postId: string): Promise<void>;

  /** Delete a community post by ID. */
  deleteCommunityPost(postId: string): Promise<void>;

  // ──── Badge Counts ────

  /** Load the current badge count for a user. Returns 0 if not set. */
  loadBadgeCount(userId: string): Promise<number>;

  /** Save (overwrite) the badge count for a user. */
  saveBadgeCount(userId: string, count: number): Promise<void>;

  // ──── Subscriptions ────

  /** Load subscription for a user. Returns null if not set. */
  loadSubscription(userId: string): Promise<UserSubscriptionData | null>;

  /** Save (insert or overwrite) a user's subscription. */
  saveSubscription(userId: string, sub: UserSubscriptionData): Promise<void>;

  // ──── SnapTrade Connections ────

  /** Load the SnapTrade connection for a user. Returns null if not set. */
  loadSnapTradeConnection(userId: string): Promise<SnapTradeConnectionData | null>;

  /** Save (insert or overwrite) a SnapTrade connection for a user. */
  saveSnapTradeConnection(userId: string, connection: SnapTradeConnectionData): Promise<void>;

  /** Delete a SnapTrade connection for a user. */
  deleteSnapTradeConnection(userId: string): Promise<void>;

  // ──── Telegram Links ────

  /** Load the Telegram link for a user. Returns null if not set. */
  loadTelegramLink(userId: string): Promise<TelegramLinkData | null>;

  /** Save (insert or overwrite) a Telegram link for a user. */
  saveTelegramLink(userId: string, link: TelegramLinkData): Promise<void>;

  /** Delete a Telegram link for a user. */
  deleteTelegramLink(userId: string): Promise<void>;

  /** Load ALL Telegram links (for cache hydration after restart). */
  loadAllTelegramLinks(): Promise<TelegramLinkData[]>;

  // ──── Coupons ────

  /** Load a coupon by code. Returns null if not found. */
  loadCoupon(code: string): Promise<CouponData | null>;

  /** Save (insert or overwrite) a coupon. */
  saveCoupon(coupon: CouponData): Promise<void>;

  /** Delete a coupon by code. */
  deleteCoupon(code: string): Promise<void>;

  /** Load all coupons (for admin listing). */
  loadAllCoupons(): Promise<CouponData[]>;

  /** Increment the usage count for a coupon. */
  incrementCouponUsage(code: string): Promise<void>;

  /** Record a coupon usage by a user. */
  recordCouponUsage(usage: CouponUsageData): Promise<void>;

  /** Check if a user has already used a coupon code. */
  hasUserUsedCoupon(code: string, userId: string): Promise<boolean>;

  /** Load all coupon usages for a user (history). */
  loadUserCouponUsages(userId: string): Promise<CouponUsageData[]>;

  // ──── Lifecycle ────

  /** Initialize the storage backend (connect, create tables, etc.). */
  connect(): Promise<void>;

  /** Graceful shutdown. */
  disconnect(): Promise<void>;

  /** Health check. */
  isHealthy(): Promise<boolean>;
}
