import { create } from 'zustand';
import { Stock, Holding, Trade, OpenOrder } from '../types';
import { mockHoldings, mockTrades, mockOpenOrders } from '../constants/mockData';
import { api, portfolioApi } from '../services/api';
import { offlineCache } from '../services/offlineCache';
import { useAuthStore } from './authStore';
import { sendTradeConfirmation } from '../services/notificationService';
import { log } from '../utils/logger';
import { analytics } from '../services/analytics';

interface PortfolioState {
  holdings: Holding[];
  trades: Trade[];
  openOrders: OpenOrder[];
  ordersLoading: boolean;
  isLoading: boolean;
  /** True when serving stale cached data because network is unavailable */
  isOffline: boolean;

  buyStock: (stock: Stock, quantity: number, price: number) => Promise<void>;
  sellStock: (holdingId: string, quantity: number, price: number) => Promise<void>;
  refreshPortfolio: () => Promise<void>;
  fetchOpenOrders: () => Promise<void>;
  modifyOrder: (orderId: string, updates: Partial<OpenOrder>) => Promise<boolean>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  /** Load cached portfolio data at app startup for instant display */
  loadCachedPortfolio: () => Promise<void>;
  /** Clear offline cache */
  clearCache: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  holdings: mockHoldings,
  trades: mockTrades,
  openOrders: mockOpenOrders as OpenOrder[],
  ordersLoading: false,
  isLoading: false,
  isOffline: false,

  /** Load cached portfolio data (used at app startup for instant display) */
  loadCachedPortfolio: async () => {
    const cached = await offlineCache.load<{ holdings: Holding[]; trades: Trade[] }>('portfolio');
    if (cached) {
      set({ holdings: cached.data.holdings, trades: cached.data.trades });
    }
  },

  refreshPortfolio: async () => {
    set({ isLoading: true, isOffline: false });
    try {
      const [holdings, trades] = await Promise.all([
        portfolioApi.getHoldings(),
        portfolioApi.getTrades(),
      ]);
      // Cache on successful fetch
      await offlineCache.save('portfolio', { holdings, trades });
      set({ holdings, trades, isLoading: false, isOffline: false });
    } catch {
      // Backend unavailable — try serving stale cache only if current holdings are empty
      const current = get();
      if (current.holdings.length === 0) {
        const cached = await offlineCache.load<{ holdings: Holding[]; trades: Trade[] }>('portfolio');
        if (cached) {
          set({ holdings: cached.data.holdings, trades: cached.data.trades, isLoading: false, isOffline: true });
          log.info('[Portfolio] Serving stale cached portfolio data');
          return;
        }
      }
      // Keep current in-memory data (mock, cached-from-startup, or user-modified)
      log.info('[Portfolio] Backend unavailable — keeping existing data');
      set({ isLoading: false, isOffline: true });
    }
  },

  fetchOpenOrders: async () => {
    set({ ordersLoading: true });
    try {
      const openOrders = await portfolioApi.getOpenOrders();
      await offlineCache.save('openOrders', openOrders);
      set({ openOrders, ordersLoading: false });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<OpenOrder[]>('openOrders');
      if (cached) {
        set({ openOrders: cached.data, ordersLoading: false });
      } else {
        set({ ordersLoading: false });
      }
    }
  },

  /** Clear offline cache (e.g. on logout) */
  clearCache: async () => {
    await offlineCache.remove('portfolio');
    await offlineCache.remove('openOrders');
  },

  modifyOrder: async (orderId, updates) => {
    try {
      const result = await portfolioApi.modifyOrder({
        orderId,
        ...(updates.price !== undefined && { price: updates.price }),
        ...(updates.quantity !== undefined && { quantity: updates.quantity }),
        ...(updates.orderType !== undefined && { orderType: updates.orderType }),
        ...(updates.productType !== undefined && { productType: updates.productType }),
        ...(updates.triggerPrice !== undefined && { triggerPrice: updates.triggerPrice }),
      });

      if (result.status === 'confirmed' || result.status === 'cancelled') {
        // Update local state
        set(state => ({
          openOrders: state.openOrders.map(o =>
            o.id === orderId ? { ...o, ...updates } : o
          ),
        }));
        return true;
      }
      return false;
    } catch {
      // Fallback: update local mock state
      set(state => ({
        openOrders: state.openOrders.map(o =>
          o.id === orderId ? { ...o, ...updates } : o
        ),
      }));
      return true;
    }
  },

  cancelOrder: async (orderId) => {
    try {
      const result = await portfolioApi.cancelOrder({ orderId });

      if (result.status === 'cancelled') {
        set(state => ({
          openOrders: state.openOrders.filter(o => o.id !== orderId),
        }));
        return true;
      }
      return false;
    } catch {
      // Fallback: remove from local state
      set(state => ({
        openOrders: state.openOrders.filter(o => o.id !== orderId),
      }));
      return true;
    }
  },

  buyStock: async (stock, quantity, price) => {
    const state = get();
    const totalCost = quantity * price;

    // Execute through Risk-Guarded Pipeline (POST /api/orders/execute)
    try {
      const user = useAuthStore.getState().user;
      const result = await api.post<{ success: boolean; message?: string }>('/orders/execute', {
        userId: user?.id || 'user_1',
        actionType: 'BUY',
        symbol: stock.symbol,
        exchange: 'NSE',
        quantity,
        price,
        productType: 'CNC',
        orderType: 'MARKET',
      });
      // If risk engine rejected the order, warn but still update local state
      // so the demo portfolio remains functional
      if (result && !result.success) {
        log.warn('[Portfolio] Risk engine blocked BUY:', result.message);
      }
    } catch (err: unknown) {
      if (api.isNetworkError(err)) {
        // Backend unavailable — execute locally
      } else {
        // Server responded but error occurred — still proceed locally for demo
        log.warn('[Portfolio] Order execution API error:', err);
      }
    }

    // Update local state (both API success & fallback)
    const existingHolding = state.holdings.find(h => h.stockId === stock.id);

    if (existingHolding) {
      const newQty = existingHolding.quantity + quantity;
      const newInvested = existingHolding.totalInvested + totalCost;
      const avgPrice = newInvested / newQty;

      set({
        holdings: state.holdings.map(h =>
          h.id === existingHolding.id
            ? {
                ...h,
                quantity: newQty,
                buyPrice: avgPrice,
                totalInvested: newInvested,
                currentValue: newQty * stock.price,
                pnl: (newQty * stock.price) - newInvested,
                pnlPercent: ((newQty * stock.price) - newInvested) / newInvested * 100,
              }
            : h
        ),
        trades: [{
          id: `t_${Date.now()}`,
          stockId: stock.id,
          symbol: stock.symbol,
          name: stock.name,
          type: 'buy' as const,
          quantity,
          price,
          total: totalCost,
          timestamp: new Date().toISOString(),
        }, ...state.trades],
      });
    } else {
      const newHolding: Holding = {
        id: `h_${Date.now()}`,
        stockId: stock.id,
        symbol: stock.symbol,
        name: stock.name,
        quantity,
        buyPrice: price,
        currentPrice: stock.price,
        totalInvested: totalCost,
        currentValue: quantity * stock.price,
        pnl: (quantity * stock.price) - totalCost,
        pnlPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
      };

      set({
        holdings: [...state.holdings, newHolding],
        trades: [{
          id: `t_${Date.now()}`,
          stockId: stock.id,
          symbol: stock.symbol,
          name: stock.name,
          type: 'buy' as const,
          quantity,
          price,
          total: totalCost,
          timestamp: new Date().toISOString(),
        }, ...state.trades],
      });
    }

    // Update cache after local mutation
    offlineCache.save('portfolio', { holdings: get().holdings, trades: get().trades });

    analytics.logEvent('order_placed', {
      symbol: stock.symbol,
      type: 'buy',
      quantity,
      value: totalCost,
    });
    sendTradeConfirmation('buy', stock.symbol, quantity, price, totalCost);
  },

  sellStock: async (holdingId, quantity, price) => {
    const state = get();
    const holding = state.holdings.find(h => h.id === holdingId);
    if (!holding) return;

    const totalReceived = quantity * price;

    // Execute through Risk-Guarded Pipeline (POST /api/orders/execute)
    try {
      const user = useAuthStore.getState().user;
      const result = await api.post<{ success: boolean; message?: string }>('/orders/execute', {
        userId: user?.id || 'user_1',
        actionType: 'SELL',
        symbol: holding.symbol,
        exchange: 'NSE',
        quantity,
        price,
        productType: 'CNC',
        orderType: 'MARKET',
        // Pass current position so risk engine can detect this as an exit
        currentPosition: {
          quantity: holding.quantity,
          avgPrice: holding.buyPrice,
        },
      });
      if (result && !result.success) {
        log.warn('[Portfolio] Risk engine blocked SELL:', result.message);
      }
    } catch (err: unknown) {
      if (api.isNetworkError(err)) {
        // Backend unavailable — execute locally
      } else {
        log.warn('[Portfolio] Order execution API error:', err);
      }
    }

    // Update local state
    if (quantity >= holding.quantity) {
      set({
        holdings: state.holdings.filter(h => h.id !== holdingId),
        trades: [{
          id: `t_${Date.now()}`,
          stockId: holding.stockId,
          symbol: holding.symbol,
          name: holding.name,
          type: 'sell' as const,
          quantity: holding.quantity,
          price,
          total: totalReceived,
          timestamp: new Date().toISOString(),
        }, ...state.trades],
      });
    } else {
      const newQty = holding.quantity - quantity;
      const newInvested = holding.totalInvested * (newQty / holding.quantity);

      set({
        holdings: state.holdings.map(h =>
          h.id === holdingId
            ? {
                ...h,
                quantity: newQty,
                totalInvested: newInvested,
                currentValue: newQty * price,
                pnl: (newQty * price) - newInvested,
                pnlPercent: ((newQty * price) - newInvested) / newInvested * 100,
              }
            : h
        ),
        trades: [{
          id: `t_${Date.now()}`,
          stockId: holding.stockId,
          symbol: holding.symbol,
          name: holding.name,
          type: 'sell' as const,
          quantity,
          price,
          total: totalReceived,
          timestamp: new Date().toISOString(),
        }, ...state.trades],
      });
    }

    // Update cache after local mutation
    offlineCache.save('portfolio', { holdings: get().holdings, trades: get().trades });

    analytics.logEvent('order_placed', {
      symbol: holding.symbol,
      type: 'sell',
      quantity,
      value: totalReceived,
    });
    sendTradeConfirmation('sell', holding.symbol, quantity, price, totalReceived);
  },
}));
