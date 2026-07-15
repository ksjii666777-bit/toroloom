/**
 * ============================================================================
 * Toroloom — SnapTrade Service (Official SDK)
 * ============================================================================
 *
 * Uses the official `snaptrade-typescript-sdk` (v10) for all SnapTrade API
 * interactions:
 *
 *   npm install snaptrade-typescript-sdk
 *
 * Key SDK methods used:
 *   - authentication.registerSnapTradeUser()   — Register user
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

import { Snaptrade } from 'snaptrade-typescript-sdk';
import { env } from '../config/env';

// ──── Types (re-exported from SDK for convenience) ─────────────────────────

export interface SnapTradeUser {
  userId: string;
  userSecret: string;
}

// ──── Service ──────────────────────────────────────────────────────────────

class SnapTradeService {
  private _client: Snaptrade | null = null;

  /**
   * Lazy-initialized SnapTrade SDK client.
   * Uses `consumerKey` and `clientId` from env.
   */
  private get client(): Snaptrade {
    if (!this._client) {
      this._client = new Snaptrade({
        clientId: env.snapTradeClientId,
        consumerKey: env.snapTradeConsumerKey,
      });
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
   * @param userId - Your internal user ID (prefixed as toroloom_{userId})
   * @returns The userSecret (must be stored encrypted)
   */
  async registerUser(userId: string): Promise<SnapTradeUser> {
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
   * DELETE /snapTrade/deleteUser
   */
  async deleteUser(userId: string): Promise<void> {
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
   * @param userId - SnapTrade user ID
   * @param userSecret - SnapTrade user secret
   * @param redirectUri - URI to redirect to after OAuth
   * @returns The Connection Portal URL
   */
  async getConnectionLink(
    userId: string,
    userSecret: string,
    redirectUri: string,
  ): Promise<{ url: string }> {
    const response = await this.client.authentication.loginSnapTradeUser({
      userId,
      userSecret,
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
    const response = await this.client.connections.listBrokerageAuthorizations({
      userId,
      userSecret,
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
    const response = await this.client.connections.detailBrokerageAuthorization({
      authorizationId,
      userId,
      userSecret,
    });
    return response.data || null;
  }

  // ── Accounts ─────────────────────────────────────────────────────────

  /**
   * List all accounts for a user.
   * GET /accounts
   */
  async getAccounts(userId: string, userSecret: string): Promise<any[]> {
    const response = await this.client.accountInformation.listUserAccounts({
      userId,
      userSecret,
    });
    return response.data || [];
  }

  /**
   * Get holdings for a specific account.
   * GET /accounts/{accountId}/holdings
   */
  async getHoldings(
    userId: string,
    userSecret: string,
    accountId: string,
  ): Promise<any> {
    const response = await this.client.accountInformation.getUserHoldings({
      userId,
      userSecret,
      accountId,
    });
    return response.data || {};
  }

  /**
   * Get all positions for a specific account.
   * GET /accounts/{accountId}/positions/all
   */
  async getPositions(
    userId: string,
    userSecret: string,
    accountId: string,
  ): Promise<any[]> {
    const response = await this.client.accountInformation.getAllAccountPositions({
      userId,
      userSecret,
      accountId,
    });
    return response.data?.positions || [];
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
    const response = await this.client.accountInformation.getUserAccountDetails({
      userId,
      userSecret,
      accountId,
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
    const response = await this.client.accountInformation.getUserAccountBalance({
      userId,
      userSecret,
      accountId,
    });
    return response.data || [];
  }

  /**
   * Get recent orders for an account.
   * GET /accounts/{accountId}/orders
   */
  async getOrders(
    userId: string,
    userSecret: string,
    accountId: string,
  ): Promise<any[]> {
    const response = await this.client.accountInformation.getUserAccountOrders({
      userId,
      userSecret,
      accountId,
      state: 'all',
      days: 30,
    });
    return response.data || [];
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
    const response = await this.client.trading.placeForceOrder({
      userId,
      userSecret,
      account_id: accountId,
      action: order.action as any,
      symbol: order.symbol,
      order_type: (order.orderType === 'StopLoss' ? 'Stop' : order.orderType) as any,
      time_in_force: (order.timeInForce === 'Gtc' ? 'GTC' : (order.timeInForce || 'Day')) as any,
      price: order.price,
      stop: order.stopPrice,
      units: order.quantity,
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
    const response = await this.client.trading.cancelUserAccountOrder({
      userId,
      userSecret,
      accountId,
      brokerage_order_id: brokerageOrderId,
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
      const response = await this.client.connections.removeBrokerageAuthorization({
        authorizationId,
        userId,
        userSecret,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ──── Singleton Export ─────────────────────────────────────────────────────

export const snapTradeService = new SnapTradeService();
