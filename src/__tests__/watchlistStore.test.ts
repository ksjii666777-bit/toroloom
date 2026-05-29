/**
 * ============================================================================
 * Toroloom — Watchlist Store Tests
 * ============================================================================
 *
 * Tests the watchlist store: CRUD operations on watchlists,
 * adding/removing stocks, and checking if a stock is in any watchlist.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWatchlistStore } from '../store/watchlistStore';
import { Stock } from '../types';

// Mock watchlistApi to trigger local fallback for all operations
vi.mock('../services/api/watchlist', () => ({
  watchlistApi: {
    getAll: vi.fn(() => Promise.reject(new Error('mock'))),
    addStock: vi.fn(() => Promise.reject(new Error('mock'))),
    removeStock: vi.fn(() => Promise.reject(new Error('mock'))),
    create: vi.fn(() => Promise.reject(new Error('mock'))),
    delete: vi.fn(() => Promise.reject(new Error('mock'))),
  },
}));

// Minimal stock fixture
const mockStock: Stock = {
  id: 'RELIANCE',
  symbol: 'RELIANCE',
  name: 'Reliance Industries Ltd.',
  sector: 'Energy',
  price: 2890.50,
  change: 45.20,
  changePercent: 1.59,
  isPositive: true,
  marketCap: '₹19,56,000 Cr',
  volume: '12.5M',
  high52: 3020.00,
  low52: 2200.00,
  pe: 28.5,
  pb: 3.2,
  dividend: 0.85,
};

const mockStock2: Stock = {
  id: 'TCS',
  symbol: 'TCS',
  name: 'Tata Consultancy Services',
  sector: 'Technology',
  price: 3890.00,
  change: -34.50,
  changePercent: -0.88,
  isPositive: false,
  marketCap: '₹14,20,000 Cr',
  volume: '8.2M',
  high52: 4200.00,
  low52: 3300.00,
  pe: 35.2,
  pb: 12.5,
  dividend: 1.20,
};

describe('WatchlistStore — CRUD Operations', () => {
  beforeEach(() => {
    useWatchlistStore.setState({
      watchlists: [],
      isLoading: false,
    });
  });

  it('starts with empty watchlists', () => {
    const state = useWatchlistStore.getState();
    expect(state.watchlists).toEqual([]);
  });

  it('creates a watchlist locally', async () => {
    await useWatchlistStore.getState().createWatchlist('My Watchlist');
    const state = useWatchlistStore.getState();
    expect(state.watchlists).toHaveLength(1);
    expect(state.watchlists[0].name).toBe('My Watchlist');
    expect(state.watchlists[0].stocks).toEqual([]);
    expect(state.watchlists[0].id).toBeDefined();
  });

  it('creates multiple watchlists', async () => {
    await useWatchlistStore.getState().createWatchlist('Watchlist A');
    await useWatchlistStore.getState().createWatchlist('Watchlist B');
    const state = useWatchlistStore.getState();
    expect(state.watchlists).toHaveLength(2);
  });

  it('adds a stock to a watchlist', async () => {
    await useWatchlistStore.getState().createWatchlist('My Watchlist');
    const wlId = useWatchlistStore.getState().watchlists[0].id;

    await useWatchlistStore.getState().addToWatchlist(wlId, mockStock);
    const state = useWatchlistStore.getState();
    expect(state.watchlists[0].stocks).toHaveLength(1);
    expect(state.watchlists[0].stocks[0].symbol).toBe('RELIANCE');
  });

  it('adds multiple stocks to a watchlist', async () => {
    await useWatchlistStore.getState().createWatchlist('My Watchlist');
    const wlId = useWatchlistStore.getState().watchlists[0].id;

    await useWatchlistStore.getState().addToWatchlist(wlId, mockStock);
    await useWatchlistStore.getState().addToWatchlist(wlId, mockStock2);
    const state = useWatchlistStore.getState();
    expect(state.watchlists[0].stocks).toHaveLength(2);
  });

  it('removes a stock from a watchlist', async () => {
    await useWatchlistStore.getState().createWatchlist('My Watchlist');
    const wlId = useWatchlistStore.getState().watchlists[0].id;

    await useWatchlistStore.getState().addToWatchlist(wlId, mockStock);
    await useWatchlistStore.getState().addToWatchlist(wlId, mockStock2);
    await useWatchlistStore.getState().removeFromWatchlist(wlId, 'RELIANCE', 'RELIANCE');
    const state = useWatchlistStore.getState();
    expect(state.watchlists[0].stocks).toHaveLength(1);
    expect(state.watchlists[0].stocks[0].symbol).toBe('TCS');
  });

  it('deletes a watchlist', async () => {
    await useWatchlistStore.getState().createWatchlist('Watchlist A');
    await useWatchlistStore.getState().createWatchlist('Watchlist B');
    const wlId = useWatchlistStore.getState().watchlists[0].id;

    await useWatchlistStore.getState().deleteWatchlist(wlId);
    const state = useWatchlistStore.getState();
    expect(state.watchlists).toHaveLength(1);
    expect(state.watchlists[0].name).toBe('Watchlist B');
  });

  it('checks if a stock is in any watchlist', async () => {
    await useWatchlistStore.getState().createWatchlist('My Watchlist');
    const wlId = useWatchlistStore.getState().watchlists[0].id;

    expect(useWatchlistStore.getState().isInWatchlist('RELIANCE')).toBe(false);
    await useWatchlistStore.getState().addToWatchlist(wlId, mockStock);
    expect(useWatchlistStore.getState().isInWatchlist('RELIANCE')).toBe(true);
  });
});
