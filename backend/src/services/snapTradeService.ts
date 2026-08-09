/**
 * ============================================================================
 * Toroloom — SnapTrade Service (Official SDK v11)
 * ============================================================================
 *
 * Uses the official `snaptrade-typescript-sdk` (v11) for all SnapTrade API
 * interactions. Supports BOTH auth modes via `SnaptradeAuth`:
 *
 *   - commercialApiKey  → Partner keys (clientId + consumerKey + registerUser)
 *   - personalApiKey    → Personal keys (clientId + consumerKey, NO registerUser)
 *
 * In personal mode:
 *   - `registerUser()` is NOT available (SnapTrade auto-provisions the user)
 *   - All calls OMIT `userId` / `userSecret` (the key IS the user context)
 *
 * Key SDK methods used:
 *   - authentication.loginSnapTradeUser()       — Get OAuth connection portal URL
 *   - connections.listBrokerageAuthorizations()  — List connections
 *   - connections.detailBrokerageAuthorization() — Get single connection
 *   - connections.removeBrokerageAuthorization() — Disconnect
 *   - accountInformation.listUserAccounts()     — List accounts
 *   - accountInformation.getUserHoldings()       — Get holdings
 *   - accountInformation.getAllAccountPositions() — Get positions
 *   - trading.placeForceOrder()                  — Place order
 *   - trading.cancelOrder()                      — Cancel order
 *
 * ============================================================================
 */

import { Snaptrade, SnaptradeAuth } from 'snaptrade-typescript-sdk';
import { env } from '../config/env';

// ──── Types (re-exported from SDK for convenience) ─────────────────────────

export interface SnapTradeUser {
  userId: string;
  userSecret: string;
}

// ──── Service ──────────────────────────────────────────────────────────────

class SnapTradeService {
  private _client: Snaptrade<any> | null = null;

  /** Personal keys auto-provision their user — there is no registerUser step. */
  isPersonalMode(): boolean {
    return env.snapTradeMode === 'personal';
  }

  /**
   * Lazy-initialized SnapTrade SDK client.
   * Uses `consumerKey` + `clientId` from env; auth mode from env.snapTradeMode.
   */
  private get client(): Snaptrade<any> {
    if (!this._client) {
      const auth = this.isPersonalMode()
        ? SnaptradeAuth.personalApiKey({
            clientId: env.snapTradeClientId,
            consumerKey: env.snapTradeConsumerKey,
          })
        : SnaptradeAuth.commercialApiKey({
            clientId: env.snapTradeClientId,
            consumerKey: env.snapTradeConsumerKey,
          });
      this._client = new Snaptrade({ auth } as any);
    }
    return this._client;
  }

  /**
   * Check if SnapTrade is configured (credentials are set).
   */
  isConfigured(): boolean {
    return !!(env.snapTradeClientId && env.snapTradeConsumerKey);
  }

  // ── User Management ──────────────────────────────────────────────────

  /**
   * Register a user with SnapTrade.
   * POST /snapTrade/registerUser
   *
   * NOTE: In personal mode this is a NO-OP — SnapTrade auto-provisions the
   * user at signup, so there is no userSecret to create or store. The route
   * layer should treat personal mode as always-registered.
   *
   * @param userId - Your internal user ID (prefixed as toroloom_{userId})
   * @returns The userSecret (must be stored encrypted) or a no-op marker
   */
  async registerUser(userId: string): Promise<SnapTradeUser> {
    if (this.isPersonalMode()) {
      console.log(`[SnapTrade] Personal mode — user ${userId} is auto-provisioned, skipping registerUser`);
      // Personal keys don't create users; return a sentinel so the route can
      // short-circuit gracefully. A real personal session never needs this.
      return { userId, userSecret: 'personal-auto-provisioned' };
    }
    const response = await this.client.authentication.registerSnapTradeUser({
      userId,
    });
    const data = response.data;
    if (!data || !data.userSecret) {
      throw new Error('SnapTrade registerUser failed: no userSecret in response');
    }
    return { userId, userSecret: data.userSecret };
  }

  /**
   * Delete a user from SnapTrade.
   * DELETE /snapTrade/deleteUser (commercial mode only)
   */
  async deleteUser(userId: string): Promise<void> {
    if (this.isPersonalMode()) {
      console.warn('[SnapTrade] deleteUser is not available in personal mode — skipping');
      return;
    }
    await this.client.authentication.deleteSnapTradeUser({ userId });
  }

  // ── Connection / OAuth ───────────────────────────────────────────────

  /**
   * Get the SnapTrade Connection Portal URL for the user to connect their broker.
   * The user opens this URL in a browser, logs into their broker, and the
   * connection is established.
   *
   * POST /snapTrade/login
   *
   * @param userId - SnapTrade user ID (omitted in personal mode)
   * @param userSecret - SnapTrade user secret (omitted in personal mode)
   * @param redirectUri - URI to redirect to after OAuth
   * @returns The Connection Portal URL
   */
  async getConnectionLink(
    userId: string,
    userSecret: string,
    redirectUri: string,
  ): Promise<{ url: string }> {
    const personal = this.isPersonalMode();
    const response = await this.client.authentication.loginSnapTradeUser({
      ...(personal ? {} : { userId, userSecret }),
      customRedirect: redirectUri,
      immediateRedirect: true,
      connectionPortalVersion: 'v4',
    });
    const data = response.data;
    if (!data || !('redirectURI' in data) || !data.redirectURI) {
      throw new Error('SnapTrade getConnectionLink failed: no redirectURI');
    }
    return { url: data.redirectURI };
  }

  /**
   * Get all connections (brokerage authorizations) for a user.
   * GET /authorizations
   */
  async getAuthorizations(
    userId: string,
    userSecret: string,
  ): Promise<any[]> {
    const personal = this.isPersonalMode();
    const response = await this.client.connections.listBrokerageAuthorizations({
      ...(personal ? {} : { userId, userSecret }),
    });
    return response.data || [];
  }

  /**
   * Get a single connection by ID.
   * GET /authorizations/{authorizationId}
   */
  async getAuthorization(
    authorizationId: string,
    userId: string,
    userSecret: string,
  ): Promise<any | null> {
    const personal = this.isPersonalMode();
    const response = await this.client.connections.detailBrokerageAuthorization({
      authorizationId,
      ...(personal ? {} : { userId, userSecret }),
    });
    return response.data || null;
  }

  // ── Accounts ─────────────────────────────────────────────────────────

  /**
   * List all accounts for a user.
   * GET /accounts
   */
  async getAccounts(userId: string, userSecret: string): Promise<any[]> {
    const personal = this.isPersonalMode();
    const response = await this.client.accountInformation.listUserAccounts({
      ...(personal ? {} : { userId, userSecret }),
    });
    return response.data || [];
  }

  /**
   * Get holdings for a specific account.
   *
   * NOTE: the legacy GET /accounts/{accountId}/holdings endpoint (getUserHoldings)
   * returns HTTP 410 for accounts created after 2026-04-25, so holdings are
   * derived from the unified positions endpoint + balance instead.
   */
  async getHoldings(
    userId: string,
    userSecret: string,
    accountId: string,
  ): Promise<any> {
    const personal = this.isPersonalMode();
    const positions = await this.getPositions(userId, userSecret, accountId);
    let balances: any[] = [];
    try {
      const response = await this.client.accountInformation.getUserAccountBalance({
        accountId,
        ...(personal ? {} : { userId, userSecret }),
      });
      balances = this._normalizeBalances(response.data || []);
    } catch {
      // Balance is best-effort — holdings still return positions.
    }
    return { holdings: positions, balances };
  }

  /**
   * Get all positions for a specific account.
   * GET /accounts/{accountId}/positions/all
   *
   * Returns normalized, flat positions:
   *   { symbol, name, units, price, avgCost, pnl, pnlPercent, currency }
   * (v11 returns instrument.symbol + string-typed units/price/cost_basis.)
   */
  async getPositions(
    userId: string,
    userSecret: string,
    accountId: string,
  ): Promise<any[]> {
    const personal = this.isPersonalMode();
    const response = await this.client.accountInformation.getAllAccountPositions({
      accountId,
      ...(personal ? {} : { userId, userSecret }),
    });
    return this._normalizePositions(response.data?.results || []);
  }

  /** Normalize v11 AccountPosition[] → flat position objects. */
  private _normalizePositions(raw: any[]): any[] {
    return raw.map((p: any) => {
      const symbol = String(p.instrument?.symbol || p.instrument?.raw_symbol || p.symbol || '');
      const units = Number(p.units) || 0;
      const price = Number(p.price) || 0;
      const avgCost = Number(p.cost_basis) || 0;
      const pnl = avgCost > 0 ? (price - avgCost) * units : 0;
      const pnlPercent = avgCost > 0 ? ((price - avgCost) / avgCost) * 100 : 0;
      return {
        symbol,
        name: p.instrument?.description || '',
        units,
        price,
        avgCost,
        pnl,
        pnlPercent,
        currency: p.currency || 'USD',
      };
    });
  }

  /** Normalize v11 Balance[] → flat { currency, total, cash, buyingPower }. */
  private _normalizeBalances(raw: any[]): any[] {
    return raw.map((b: any) => {
      const bpSnake = Number(b.buying_power);
      const bpCamel = Number(b.buyingPower);
      const buyingPower = !Number.isNaN(bpSnake) ? bpSnake : !Number.isNaN(bpCamel) ? bpCamel : 0;
      const cash = Number(b.cash) || 0;
      return {
        currency: b.currency?.code || 'USD',
        cash,
        buyingPower,
        total: cash,
      };
    });
  }

  /**
   * Get account details.
   * GET /accounts/{accountId}
   */
  async getAccountDetails(
    userId: string,
    userSecret: string,
    accountId: string,
  ): Promise<any | null> {
    const personal = this.isPersonalMode();
    const response = await this.client.accountInformation.getUserAccountDetails({
      accountId,
      ...(personal ? {} : { userId, userSecret }),
    });
    return response.data || null;
  }

  /**
   * Get account balance.
   * GET /accounts/{accountId}/balances
   */
  async getAccountBalance(
    userId: string,
    userSecret: string,
    accountId: string,
  ): Promise<any[]> {
    const personal = this.isPersonalMode();
    const response = await this.client.accountInformation.getUserAccountBalance({
      accountId,
      ...(personal ? {} : { userId, userSecret }),
    });
    return this._normalizeBalances(response.data || []);
  }

  /**
   * Get recent orders for an account.
   * GET /accounts/{accountId}/orders
   *
   * Returns normalized, flat orders:
   *   { id, symbol, action, quantity, price, status, filledQuantity, createdAt }
   */
  async getOrders(
    userId: string,
    userSecret: string,
    accountId: string,
  ): Promise<any[]> {
    const personal = this.isPersonalMode();
    const response = await this.client.accountInformation.getUserAccountOrders({
      accountId,
      ...(personal ? {} : { userId, userSecret }),
      state: 'all',
      days: 30,
    });
    const raw = response.data || [];
    return raw.map((o: any) => ({
      id: o.brokerage_order_id || o.id || '',
      symbol: o.symbol || o.universal_symbol?.symbol || '',
      action: o.action || '',
      quantity: Number(o.total_quantity) || 0,
      price: Number(o.execution_price) || Number(o.limit_price) || 0,
      status: o.status || '',
      filledQuantity: Number(o.filled_quantity) || 0,
      createdAt: o.time_placed || o.created_at || '',
    }));
  }

  // ── Trading ──────────────────────────────────────────────────────────

  /**
   * Place an order via SnapTrade.
   * POST /accounts/{accountId}/trading/force
   */
  async placeOrder(
    userId: string,
    userSecret: string,
    accountId: string,
    order: {
      symbol: string;
      action: 'BUY' | 'SELL';
      orderType: 'Market' | 'Limit' | 'StopLimit' | 'Stop' | 'StopLoss';
      quantity: number;
      price?: number;
      stopPrice?: number;
      timeInForce?: 'Day' | 'GTC' | 'Gtc';
    },
  ): Promise<any> {
    const personal = this.isPersonalMode();
    const response = await this.client.trading.placeForceOrder({
      account_id: accountId,
      action: order.action as any,
      symbol: order.symbol,
      order_type: (order.orderType === 'StopLoss' ? 'Stop' : order.orderType) as any,
      time_in_force: (order.timeInForce === 'Gtc' ? 'GTC' : (order.timeInForce || 'Day')) as any,
      price: order.price,
      stop: order.stopPrice,
      units: order.quantity,
      ...(personal ? {} : { userId, userSecret }),
    } as any);
    return response.data || {};
  }

  /**
   * Cancel an order.
   * POST /accounts/{accountId}/trading/cancel
   */
  async cancelOrder(
    userId: string,
    userSecret: string,
    accountId: string,
    brokerageOrderId: string,
  ): Promise<any> {
    const personal = this.isPersonalMode();
    const response = await this.client.trading.cancelUserAccountOrder({
      accountId,
      brokerage_order_id: brokerageOrderId,
      ...(personal ? {} : { userId, userSecret }),
    } as any);
    return response.data || {};
  }

  // ── Disconnect ───────────────────────────────────────────────────────

  /**
   * Disconnect/remove a broker authorization.
   * DELETE /authorizations/{authorizationId}
   */
  async disconnect(
    authorizationId: string,
    userId: string,
    userSecret: string,
  ): Promise<boolean> {
    try {
      const personal = this.isPersonalMode();
      const _response = await this.client.connections.removeBrokerageAuthorization({
        authorizationId,
        ...(personal ? {} : { userId, userSecret }),
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ──── Singleton Export ─────────────────────────────────────────────────────

export const snapTradeService = new SnapTradeService();
