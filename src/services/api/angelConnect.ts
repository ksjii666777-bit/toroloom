/**
 * ============================================================================
 * Toroloom — Angel One SmartAPI (REMOVED — replaced by SnapTrade)
 * ============================================================================
 *
 * This file has been replaced by src/services/api/snaptrade.ts.
 *
 * SnapTrade provides unified OAuth-based broker connection for 20+ brokers
 * including Angel One, Zerodha, Dhan, Upstox, Groww, and more.
 *
 * Migration:
 *   ❌ Old: await angelConnectApi.connect(clientId, password, totp)
 *   ✅ New: await snapTradeApi.register()
 *           await snapTradeApi.getConnectLink()  → open OAuth URL
 *           await snapTradeApi.handleCallback(authorizationId)
 *           await snapTradeApi.getHoldings()
 *
 * ============================================================================
 */
/**
 * Stub angelConnectApi for backward compatibility.
 * New integrations should use snapTradeApi from ./snaptrade.ts instead.
 */
export const angelConnectApi = {
  connect: async (_clientId: string, _password: string, _totp: string): Promise<{ success: boolean; message: string }> => {
    return { success: false, message: 'Angel One SmartAPI is deprecated. Use SnapTrade OAuth instead.' };
  },
  status: async (): Promise<{ connected: boolean }> => {
    return { connected: false };
  },
  holdings: async (): Promise<{ success: boolean; data: any[] }> => {
    return { success: false, data: [] };
  },
  disconnect: async (): Promise<void> => {
    // no-op
  },
};

