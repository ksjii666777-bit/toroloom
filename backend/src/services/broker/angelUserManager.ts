/**
 * ============================================================================
 * Toroloom — Per-User Angel One SmartAPI Manager
 * ============================================================================
 *
 * Manages authenticated AngelBroker instances per user.
 * Each user connects their own Angel One account using their credentials,
 * and the manager creates/authenticates/stores the broker instance.
 *
 * Credentials are stored in-memory only (not persisted to disk).
 * For production with PostgreSQL, extend to store encrypted credentials.
 *
 * Usage:
 *   import { angelUserManager } from './angelUserManager';
 *   await angelUserManager.connect(userId, clientId, password, totp);
 *   const holdings = await angelUserManager.getHoldings(userId);
 *   await angelUserManager.disconnect(userId);
 * ============================================================================
 */

import { AngelBroker } from './angelBroker';
import type { Position, MarketQuote, TradeHistory } from './interface';

interface AngelUserSession {
  broker: AngelBroker;
  clientId: string;
  connectedAt: number;
  lastUsedAt: number;
  // For re-authentication if needed
  password: string;
  totp: string;
}

class AngelUserManager {
  /** In-memory map of userId → AngelBroker session */
  private sessions = new Map<string, AngelUserSession>();

  /** Cleanup interval for stale sessions (30 min inactivity) */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly STALE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

  constructor() {
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanupStaleSessions(), 10 * 60 * 1000);
  }

  /**
   * Connect a user's Angel One account.
   * Creates and authenticates an AngelBroker instance with the user's credentials.
   *
   * @param userId - Internal user ID
   * @param clientId - Angel One client ID (trading account code)
   * @param password - Angel One trading password
   * @param totp - Angel One TOTP Base32 secret (from SmartAPI portal)
   * @param apiKey - Server-level Angel SmartAPI API key (from env)
   * @returns true if authenticated successfully
   * @throws Error if authentication fails
   */
  async connect(
    userId: string,
    clientId: string,
    password: string,
    totp: string,
    apiKey: string,
  ): Promise<boolean> {
    // Disconnect existing session if any
    await this.disconnect(userId);

    const broker = new AngelBroker();

    const success = await broker.authenticate({
      apiKey,
      clientId,
      password,
      totp,
    });

    if (!success) {
      throw new Error('Angel One authentication failed. Check your credentials.');
    }

    this.sessions.set(userId, {
      broker,
      clientId,
      connectedAt: Date.now(),
      lastUsedAt: Date.now(),
      password,
      totp,
    });

    console.log(`[AngelUserManager] User ${userId} connected Angel One (client: ${clientId})`);
    return true;
  }

  /**
   * Check if a user has an active Angel One connection.
   */
  isConnected(userId: string): boolean {
    const session = this.sessions.get(userId);
    if (!session) return false;
    if (!session.broker.isConnected()) {
      // Try to re-authenticate
      this.sessions.delete(userId);
      return false;
    }
    return true;
  }

  /**
   * Get the authenticated AngelBroker instance for a user.
   * Does NOT check isConnected() here — AngelBroker's own requireAuth()
   * handles auto-reauthentication internally using stored password/TOTP.
   * @throws Error if user not connected
   */
  private getBroker(userId: string): AngelBroker {
    const session = this.sessions.get(userId);
    if (!session) {
      throw new Error('Angel One not connected. Connect your Angel One account first.');
    }
    session.lastUsedAt = Date.now();
    return session.broker;
  }

  // ──── Portfolio Methods ──────────────────────────────────────────

  /**
   * Get holdings for the connected user.
   */
  async getHoldings(userId: string): Promise<Position[]> {
    const broker = this.getBroker(userId);
    return broker.getHoldings();
  }

  /**
   * Get positions for the connected user.
   */
  async getPositions(userId: string): Promise<Position[]> {
    const broker = this.getBroker(userId);
    return broker.getPositions();
  }

  /**
   * Get trade history for the connected user.
   */
  async getTradeHistory(userId: string): Promise<TradeHistory[]> {
    const broker = this.getBroker(userId);
    return broker.getTradeHistory();
  }

  /**
   * Get a quote for a symbol (uses the first connected user's broker
   * or throws if no one is connected).
   */
  async getQuote(userId: string, symbol: string): Promise<MarketQuote> {
    const broker = this.getBroker(userId);
    return broker.getQuote(symbol);
  }

  // ──── Session Management ─────────────────────────────────────────

  /**
   * Disconnect a user's Angel One account. Returns true if was connected.
   */
  async disconnect(userId: string): Promise<boolean> {
    const session = this.sessions.get(userId);
    if (!session) return false;
    this.sessions.delete(userId);
    console.log(`[AngelUserManager] User ${userId} disconnected Angel One`);
    return true;
  }

  /**
   * Get connection info for a user.
   */
  getConnectionInfo(userId: string): { connected: boolean; clientId?: string; connectedAt?: number } {
    const session = this.sessions.get(userId);
    if (!session) return { connected: false };
    return {
      connected: true,
      clientId: session.clientId,
      connectedAt: session.connectedAt,
    };
  }

  /**
   * Get total active connections count.
   */
  getActiveCount(): number {
    return this.sessions.size;
  }

  // ──── Cleanup ────────────────────────────────────────────────────

  /**
   * Remove stale sessions (30 min inactivity).
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastUsedAt > this.STALE_TIMEOUT_MS) {
        console.log(`[AngelUserManager] Cleaning up stale session for user ${userId}`);
        this.sessions.delete(userId);
      }
    }
  }

  /**
   * Reset all connections (e.g., on server shutdown).
   */
  resetAll(): void {
    this.sessions.clear();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/** Global singleton */
export const angelUserManager = new AngelUserManager();
