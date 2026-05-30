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
import { watchlistApi } from '../services/api/watchlist';

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

describe('WatchlistStore — CRUD Operations (Local Fallback)', () => {
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

  it('checks across multiple watchlists for isInWatchlist', async () => {
    await useWatchlistStore.getState().createWatchlist('Watchlist A');
    await useWatchlistStore.getState().createWatchlist('Watchlist B');
    const wlA = useWatchlistStore.getState().watchlists[0].id;

    await useWatchlistStore.getState().addToWatchlist(wlA, mockStock);
    expect(useWatchlistStore.getState().isInWatchlist('RELIANCE')).toBe(true);
    expect(useWatchlistStore.getState().isInWatchlist('TCS')).toBe(false);
  });

  it('removeFromWatchlist does nothing when watchlistId does not match', async () => {
    await useWatchlistStore.getState().createWatchlist('My Watchlist');
    const wlId = useWatchlistStore.getState().watchlists[0].id;
    await useWatchlistStore.getState().addToWatchlist(wlId, mockStock);

    // Try removing from a non-existent watchlist — should be a no-op
    await useWatchlistStore.getState().removeFromWatchlist('non_existent', 'RELIANCE', 'RELIANCE');
    expect(useWatchlistStore.getState().watchlists[0].stocks).toHaveLength(1);
  });
});

describe('WatchlistStore — API Success Paths', () => {
  beforeEach(() => {
    // Make API methods resolve successfully
    vi.mocked(watchlistApi.getAll).mockResolvedValue([
      { id: 'api_wl_1', name: 'Remote Watchlist', stocks: [mockStock], createdAt: '2025-01-01' },
    ]);
    vi.mocked(watchlistApi.addStock).mockResolvedValue({ id: 'api_wl_1', name: 'Remote Watchlist', stocks: [mockStock], createdAt: '2025-01-01' });
    vi.mocked(watchlistApi.removeStock).mockResolvedValue(undefined as any);
    vi.mocked(watchlistApi.create).mockResolvedValue({
      id: 'api_wl_new', name: 'Remote Created', stocks: [], createdAt: '2025-06-01',
    });
    vi.mocked(watchlistApi.delete).mockResolvedValue(undefined as any);

    useWatchlistStore.setState({ watchlists: [], isLoading: false });
  });

  it('fetchWatchlists loads data from API', async () => {
    await useWatchlistStore.getState().fetchWatchlists();
    const state = useWatchlistStore.getState();
    expect(state.watchlists).toHaveLength(1);
    expect(state.watchlists[0].name).toBe('Remote Watchlist');
    expect(state.watchlists[0].stocks).toHaveLength(1);
  });

  it('fetchWatchlists sets loading state', async () => {
    // Don't await — check loading is true during the pending promise
    const promise = useWatchlistStore.getState().fetchWatchlists();
    expect(useWatchlistStore.getState().isLoading).toBe(true);
    await promise;
    expect(useWatchlistStore.getState().isLoading).toBe(false);
  });

  it('addToWatchlist persists via API and updates state', async () => {
    useWatchlistStore.setState({
      watchlists: [{ id: 'wl1', name: 'My WL', stocks: [], createdAt: '2025-01-01' }],
    });

    await useWatchlistStore.getState().addToWatchlist('wl1', mockStock);
    expect(watchlistApi.addStock).toHaveBeenCalledWith('wl1', 'RELIANCE');
    expect(useWatchlistStore.getState().watchlists[0].stocks).toHaveLength(1);
  });

  it('removeFromWatchlist persists via API and updates state', async () => {
    useWatchlistStore.setState({
      watchlists: [{ id: 'wl1', name: 'My WL', stocks: [mockStock], createdAt: '2025-01-01' }],
    });

    await useWatchlistStore.getState().removeFromWatchlist('wl1', 'RELIANCE', 'RELIANCE');
    expect(watchlistApi.removeStock).toHaveBeenCalledWith('wl1', 'RELIANCE');
    expect(useWatchlistStore.getState().watchlists[0].stocks).toHaveLength(0);
  });

  it('createWatchlist persists via API and adds to state', async () => {
    await useWatchlistStore.getState().createWatchlist('Remote Created');
    expect(watchlistApi.create).toHaveBeenCalledWith('Remote Created');
    expect(useWatchlistStore.getState().watchlists).toHaveLength(1);
    expect(useWatchlistStore.getState().watchlists[0].id).toBe('api_wl_new');
  });

  it('deleteWatchlist persists via API and removes from state', async () => {
    useWatchlistStore.setState({
      watchlists: [{ id: 'wl1', name: 'To Delete', stocks: [], createdAt: '2025-01-01' }],
    });

    await useWatchlistStore.getState().deleteWatchlist('wl1');
    expect(watchlistApi.delete).toHaveBeenCalledWith('wl1');
    expect(useWatchlistStore.getState().watchlists).toHaveLength(0);
  });
});

describe('WatchlistStore — API Failure (already covered in CRUD tests above)', () => {
  beforeEach(() => {
    useWatchlistStore.setState({ watchlists: [], isLoading: false });
  });

  it('fetchWatchlists keeps existing data on API failure', async () => {
    vi.mocked(watchlistApi.getAll).mockRejectedValueOnce(new Error('Network error'));

    useWatchlistStore.setState({ watchlists: [{ id: 'existing', name: 'Existing', stocks: [mockStock], createdAt: '2025-01-01' }] });
    await useWatchlistStore.getState().fetchWatchlists();

    const state = useWatchlistStore.getState();
    expect(state.watchlists).toHaveLength(1);
    expect(state.watchlists[0].name).toBe('Existing');
    expect(state.isLoading).toBe(false);
  });

  it('addToWatchlist updates state even when API fails', async () => {
    vi.mocked(watchlistApi.addStock).mockRejectedValueOnce(new Error('Network error'));

    useWatchlistStore.setState({
      watchlists: [{ id: 'wl1', name: 'My WL', stocks: [], createdAt: '2025-01-01' }],
    });

    await useWatchlistStore.getState().addToWatchlist('wl1', mockStock);
    // State should still update even though API failed
    expect(useWatchlistStore.getState().watchlists[0].stocks).toHaveLength(1);
  });

  it('createWatchlist creates locally when API fails', async () => {
    vi.mocked(watchlistApi.create).mockRejectedValueOnce(new Error('Network error'));

    await useWatchlistStore.getState().createWatchlist('Local WL');
    const state = useWatchlistStore.getState();
    expect(state.watchlists).toHaveLength(1);
    // Local ID starts with w_local_
    expect(state.watchlists[0].id).toMatch(/^w_local_/);
    expect(state.watchlists[0].name).toBe('Local WL');
    expect(state.watchlists[0].stocks).toEqual([]);
  });
});
