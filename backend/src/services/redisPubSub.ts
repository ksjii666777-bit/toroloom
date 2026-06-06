/**
 * ============================================================================
 * Toroloom — Redis Pub/Sub Service
 * ============================================================================
 *
 * Lightweight wrapper around ioredis providing a shared pub/sub channel
 * for cross-worker communication in cluster mode.
 *
 * Usage (via clusterIPC.ts — not called directly):
 *   await redisPubSub.connect(env.redisUrl);
 *   await redisPubSub.publish('ws:conn', JSON.stringify({ type: 'inc', userId }));
 *   await redisPubSub.subscribe('ws:conn_sync', handler);
 *   await redisPubSub.disconnect();
 *
 * Architecture:
 *   Worker ──publish──→ Redis ──deliver──→ Primary (aggregator)
 *   Primary ──publish──→ Redis ──deliver──→ All Workers
 *
 * Each process creates TWO connections:
 *   1. Publisher  — used for sending messages (can be shared with other ops)
 *   2. Subscriber — dedicated connection (Redis requires a dedicated conn for SUBSCRIBE)
 * ============================================================================
 */

import Redis from 'ioredis';

type MessageCallback = (channel: string, message: string) => void;

class RedisPubSub {
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  /** Per-channel handler sets so we can unsubscribe individual handlers */
  private handlers = new Map<string, Set<MessageCallback>>();
  private _connected = false;

  // ──── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Connect to Redis and set up the subscriber's message listener.
   * Both connections are lazy by default (ioredis auto-connects).
   */
  async connect(url: string): Promise<void> {
    if (this._connected) return;

    this.publisher = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 3000),
      lazyConnect: true,
    });

    this.subscriber = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 3000),
      lazyConnect: true,
      // Subscriber connections must disable reconnection attempts that
      // would interfere with the SUBSCRIBE state; ioredis handles this.
    });

    // Wire up the subscriber's message router
    this.subscriber.on('message', (channel: string, message: string) => {
      const channelHandlers = this.handlers.get(channel);
      if (!channelHandlers) return;
      for (const handler of channelHandlers) {
        try {
          handler(channel, message);
        } catch (err) {
          console.error(`[RedisPubSub] Handler error on channel ${channel}:`, err);
        }
      }
    });

    // Connect both clients
    await Promise.all([
      this.publisher.connect(),
      this.subscriber.connect(),
    ]);

    this._connected = true;
    console.log('   [RedisPubSub] Connected');
  }

  // ──── Publish ───────────────────────────────────────────────────────────

  /**
   * Publish a message to a Redis channel. All subscribers on that channel
   * (across all workers + primary) will receive it.
   */
  async publish(channel: string, message: string): Promise<void> {
    if (!this.publisher || !this._connected) return;
    try {
      await this.publisher.publish(channel, message);
    } catch (err) {
      console.error(`[RedisPubSub] Publish error on ${channel}:`, err);
    }
  }

  // ──── Subscribe / Unsubscribe ───────────────────────────────────────────

  /**
   * Subscribe to a channel. The handler will be invoked for every message
   * published to that channel. Multiple handlers per channel are supported.
   */
  async subscribe(channel: string, handler: MessageCallback): Promise<void> {
    if (!this.subscriber || !this._connected) return;

    const isNewChannel = !this.handlers.has(channel);
    if (isNewChannel) {
      this.handlers.set(channel, new Set());
    }

    this.handlers.get(channel)!.add(handler);

    if (isNewChannel) {
      await this.subscriber.subscribe(channel);
    }
  }

  /**
   * Remove a specific handler from a channel. If no handlers remain,
   * unsubscribes from the channel entirely.
   */
  async unsubscribe(channel: string, handler: MessageCallback): Promise<void> {
    if (!this.subscriber || !this._connected) return;

    const channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) return;

    channelHandlers.delete(handler);

    if (channelHandlers.size === 0) {
      this.handlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  // ──── Disconnect ────────────────────────────────────────────────────────

  /**
   * Gracefully disconnect both Redis connections.
   */
  async disconnect(): Promise<void> {
    this._connected = false;
    this.handlers.clear();

    const tasks: Promise<unknown>[] = [];
    if (this.publisher) {
      tasks.push(this.publisher.quit().catch(() => {}));
    }
    if (this.subscriber) {
      tasks.push(this.subscriber.quit().catch(() => {}));
    }
    await Promise.all(tasks);

    this.publisher = null;
    this.subscriber = null;
  }

  // ──── Status ────────────────────────────────────────────────────────────

  get connected(): boolean {
    return this._connected;
  }
}

export const redisPubSub = new RedisPubSub();
