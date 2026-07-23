/**
 * ============================================================================
 * Toroloom — Per-User Upstox API Manager
 * ============================================================================
 *
 * Manages authenticated UpstoxBroker instances per user.
 * Each user connects their own Upstox account via OAuth 2.0,
 * and the manager stores the access token in memory.
 *
 * For production with PostgreSQL, extend to store encrypted tokens.
 *
 * Usage:
 *   import { upstoxUserManager } from './upstoxUserManager';
 *   await upstoxUserManager.connect(userId, accessToken);
 *   const holdings = await upstoxUserManager.getHoldings(userId);
 *   await upstoxUserManager.disconnect(userId);
 * ============================================================================
 */

import { UpstoxBroker } from './upstoxBroker';
import type { Position, MarketQuote, TradeHistory, OpenOrder, OrderPayload, BrokerConfig } from './interface';

interface UpstoxUserSession {
  broker: UpstoxBroker;
  accessToken: string;
  connectedAt: number;
  lastUsedAt: number;
  clientId?: string;
}

class UpstoxUserManager {
  /** In-memory map of userId → UpstoxBroker session */
  private sessions = new Map<string, UpstoxUserSession>();

  /** Cleanup interval for stale sessions (30 min inactivity) */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly STALE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

  constructor() {
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanupStaleSessions(), 10 * 60 * 1000);
  }

  /**
   * Connect a user's Upstox account.
   *
   * @param userId - Internal user ID
   * @param accessToken - Upstox OAuth access token
   * @param clientId - Upstox client ID (optional, for reference)
   * @returns true if connected successfully
   */
  async connect(
    userId: string,
    accessToken: string,
    clientId?: string,
  ): Promise<boolean> {
    // Disconnect existing session if any
    await this.disconnect(userId);

    const broker = new UpstoxBroker();

    const success = await broker.authenticate({ accessToken } as BrokerConfig);

    if (!success) {
      throw new Error('Upstox authentication failed. Check your access token.');
    }

    this.sessions.set(userId, {
      broker,
      accessToken,
      connectedAt: Date.now(),
      lastUsedAt: Date.now(),
      clientId,
    });

    console.log(`[UpstoxUserManager] User ${userId} connected Upstox${clientId ? ` (client: ${clientId})` : ''}`);
    return true;
  }

  /**
   * Connect via OAuth auth code exchange.
   * Server uses client_id + client_secret + auth_code to get access token.
   */
  async connectViaOAuth(
    userId: string,
    authCode: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<{ success: boolean; accessToken: string }> {
    // Disconnect existing session if any
    await this.disconnect(userId);

    const broker = new UpstoxBroker();

    const success = await broker.authenticate({
      clientId,
      apiSecret: clientSecret,
      authCode,
      redirectUri,
    } as any);

    if (!success) {
      throw new Error('Upstox OAuth authentication failed.');
    }

    // Extract the access token from the broker's internal state
    // After successful authenticate, the broker stores the token
    const brokerAny = broker as any;
    const token = brokerAny.accessToken || '';

    this.sessions.set(userId, {
      broker,
      accessToken: token,
      connectedAt: Date.now(),
      lastUsedAt: Date.now(),
      clientId,
    });

    console.log(`[UpstoxUserManager] User ${userId} connected Upstox via OAuth`);
    return { success: true, accessToken: token };
  }

  /**
   * Check if a user has an active Upstox connection.
   */
  isConnected(userId: string): boolean {
    const session = this.sessions.get(userId);
    if (!session) return false;
    if (!session.broker.isConnected()) {
      this.sessions.delete(userId);
      return false;
    }
    return true;
  }

  /**
   * Get the authenticated UpstoxBroker instance for a user.
   * @throws Error if user not connected
   */
  private getBroker(userId: string): UpstoxBroker {
    const session = this.sessions.get(userId);
    if (!session) {
      throw new Error('Upstox not connected. Connect your Upstox account first.');
    }
    session.lastUsedAt = Date.now();
    return session.broker;
  }

  // ──── Portfolio Methods ──────────────────────────────────────────

  async getHoldings(userId: string): Promise<Position[]> {
    return this.getBroker(userId).getHoldings();
  }

  async getPositions(userId: string): Promise<Position[]> {
    return this.getBroker(userId).getPositions();
  }

  async getTradeHistory(userId: string): Promise<TradeHistory[]> {
    return this.getBroker(userId).getTradeHistory();
  }

  async getQuote(userId: string, symbol: string): Promise<MarketQuote> {
    return this.getBroker(userId).getQuote(symbol);
  }

  // ──── Trading Methods ────────────────────────────────────────────

  async getOpenOrders(userId: string): Promise<OpenOrder[]> {
    return this.getBroker(userId).getOpenOrders();
  }

  async placeOrder(userId: string, order: OrderPayload) {
    return this.getBroker(userId).placeOrder(order);
  }

  async modifyOrder(userId: string, order: any) {
    return this.getBroker(userId).modifyOrder(order);
  }

  async cancelOrder(userId: string, order: any) {
    return this.getBroker(userId).cancelOrder(order);
  }

  // ──── Session Management ─────────────────────────────────────────

  async disconnect(userId: string): Promise<boolean> {
    const session = this.sessions.get(userId);
    if (!session) return false;
    this.sessions.delete(userId);
    console.log(`[UpstoxUserManager] User ${userId} disconnected Upstox`);
    return true;
  }

  getConnectionInfo(userId: string): { connected: boolean; clientId?: string; connectedAt?: number } {
    const session = this.sessions.get(userId);
    if (!session) return { connected: false };
    return {
      connected: true,
      clientId: session.clientId,
      connectedAt: session.connectedAt,
    };
  }

  getActiveCount(): number {
    return this.sessions.size;
  }

  // ──── Cleanup ────────────────────────────────────────────────────

  private cleanupStaleSessions(): void {
    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastUsedAt > this.STALE_TIMEOUT_MS) {
        console.log(`[UpstoxUserManager] Cleaning up stale session for user ${userId}`);
        this.sessions.delete(userId);
      }
    }
  }

  resetAll(): void {
    this.sessions.clear();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/** Global singleton */
export const upstoxUserManager = new UpstoxUserManager();
