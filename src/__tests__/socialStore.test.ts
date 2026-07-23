/**
 * ============================================================================
 * Toroloom — Social Trading Store Tests
 * ============================================================================
 *
 * Tests leaderboard sorting/fetching, follow/unfollow, copy-trading (start,
 * stop, pause), trader search, and the isFollowing/isCopying helpers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSocialStore } from '../store/socialStore';
import { socialApi } from '../services/api/social';
import type { LeaderboardEntry } from '../types';

// ──── Mock socialApi so tests never hit the network ────────────────────────
// Note: vi.mock is hoisted above imports by vitest, so the import of socialApi
// below resolves to this mock.

vi.mock('../services/api/social', () => ({
  socialApi: {
    getLeaderboard: vi.fn(() => Promise.resolve({ entries: [], total: 0, page: 1, totalPages: 1 })),
    followTrader: vi.fn(() => Promise.resolve()),
    unfollowTrader: vi.fn(() => Promise.resolve()),
    startCopyTrading: vi.fn(() => Promise.resolve()),
    stopCopyTrading: vi.fn(() => Promise.resolve()),
    toggleCopyPause: vi.fn(() => Promise.resolve()),
    searchTraders: vi.fn(() => Promise.resolve([])),
  },
}));

// ──── Capture initial leaderboard (from the store's zustand create) ────────

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [...useSocialStore.getState().leaderboard];

// ──── Helpers ──────────────────────────────────────────────────────────────

/** Known trader IDs from the storeʼs internal mockTraders array */
const TRADER_1 = 'trader_1'; // Arun Kumar    – swing_trading,    PnL=2_850_000
const TRADER_2 = 'trader_2'; // Priya Patel   – value_investing,  PnL=4_200_000
const TRADER_3 = 'trader_3'; // Vikram Reddy  – momentum,         PnL=1_850_000
const TRADER_4 = 'trader_4'; // Neha Singh    – options_selling,  PnL=1_350_000
const TRADER_5 = 'trader_5'; // Rohit Mehra   – intraday,         PnL=980_000

/** Reset the store to a known baseline */
function resetState(overrides?: Record<string, unknown>) {
  useSocialStore.setState({
    leaderboard: [...INITIAL_LEADERBOARD],
    leaderboardSort: 'pnl',
    leaderboardPeriod: 'ALL',
    isLoadingLeaderboard: false,
    followedTraderIds: [TRADER_1, TRADER_4],
    followingTraders: INITIAL_LEADERBOARD.filter(
      e => e.id === TRADER_1 || e.id === TRADER_4,
    ),
    copyRelations: [
      {
        traderId: TRADER_1, traderName: 'Arun Kumar', allocationPercent: 50,
        investmentAmount: 250_000, totalPnl: 18_500, activeTrades: 3,
        startedAt: '2025-02-15T00:00:00Z', isPaused: false,
      },
      {
        traderId: TRADER_4, traderName: 'Neha Singh', allocationPercent: 30,
        investmentAmount: 150_000, totalPnl: 9_200, activeTrades: 2,
        startedAt: '2025-03-01T00:00:00Z', isPaused: false,
      },
    ],
    copiedTrades: [
      { id: 'ct_1', traderId: TRADER_1, traderName: 'Arun Kumar', symbol: 'NIFTY', action: 'buy', quantity: 50, price: 23_450, executedAt: new Date(Date.now() - 86400000).toISOString(), pnl: 1_250, pnlPercent: 1.07, isOpen: true, allocationPercent: 50 },
      { id: 'ct_2', traderId: TRADER_1, traderName: 'Arun Kumar', symbol: 'BANKNIFTY', action: 'sell', quantity: 25, price: 49_200, executedAt: new Date(Date.now() - 172800000).toISOString(), pnl: 3_400, pnlPercent: 2.76, isOpen: false, allocationPercent: 50 },
      { id: 'ct_3', traderId: TRADER_4, traderName: 'Neha Singh', symbol: 'NIFTY', action: 'sell', quantity: 75, price: 23_380, executedAt: new Date(Date.now() - 43200000).toISOString(), pnl: 1_800, pnlPercent: 1.03, isOpen: true, allocationPercent: 30 },
    ],
    searchQuery: '',
    searchResults: [],
    ...overrides,
  });
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('SocialStore — Initial State', () => {
  it('has 8 traders in the leaderboard sorted by PnL descending', () => {
    const { leaderboard } = useSocialStore.getState();
    expect(leaderboard).toHaveLength(8);
    for (let i = 1; i < leaderboard.length; i++) {
      expect(leaderboard[i - 1].totalPnl).toBeGreaterThanOrEqual(leaderboard[i].totalPnl);
    }
  });

  it('assigns sequential ranks starting at 1', () => {
    const { leaderboard } = useSocialStore.getState();
    leaderboard.forEach((entry, i) => expect(entry.rank).toBe(i + 1));
  });

  it('defaults sort to pnl, period to ALL, loading to false', () => {
    const s = useSocialStore.getState();
    expect(s.leaderboardSort).toBe('pnl');
    expect(s.leaderboardPeriod).toBe('ALL');
    expect(s.isLoadingLeaderboard).toBe(false);
  });

  it('has two pre-followed traders (trader_1 and trader_4)', () => {
    const s = useSocialStore.getState();
    expect(s.followedTraderIds).toEqual([TRADER_1, TRADER_4]);
    expect(s.followingTraders).toHaveLength(2);
    expect(s.followingTraders.map(t => t.id)).toEqual([TRADER_1, TRADER_4]);
  });

  it('has two pre-existing copy relations and three copied trades', () => {
    const s = useSocialStore.getState();
    expect(s.copyRelations).toHaveLength(2);
    expect(s.copyRelations[0].traderId).toBe(TRADER_1);
    expect(s.copyRelations[1].traderId).toBe(TRADER_4);
    expect(s.copiedTrades).toHaveLength(3);
  });

  it('starts with empty search state', () => {
    const s = useSocialStore.getState();
    expect(s.searchQuery).toBe('');
    expect(s.searchResults).toEqual([]);
  });
});

// ──── fetchLeaderboard ─────────────────────────────────────────────────────

describe('SocialStore — fetchLeaderboard', () => {
  beforeEach(() => {
    resetState();
    vi.mocked(socialApi.getLeaderboard).mockReset();
    vi.mocked(socialApi.getLeaderboard).mockResolvedValue({ entries: [], total: 0, page: 1, totalPages: 1 });
  });

  it('sets isLoadingLeaderboard true during fetch, false after', async () => {
    let resolve!: (v: { entries: LeaderboardEntry[]; total: number; page: number; totalPages: number }) => void;
    vi.mocked(socialApi.getLeaderboard).mockImplementationOnce(
      () => new Promise(r => { resolve = r; }),
    );

    const promise = useSocialStore.getState().fetchLeaderboard();
    expect(useSocialStore.getState().isLoadingLeaderboard).toBe(true);

    resolve({ entries: [], total: 0, page: 1, totalPages: 1 });
    await promise;
    expect(useSocialStore.getState().isLoadingLeaderboard).toBe(false);
  });

  it('updates leaderboardSort and leaderboardPeriod when provided', async () => {
    await useSocialStore.getState().fetchLeaderboard('returns', '1M');
    const s = useSocialStore.getState();
    expect(s.leaderboardSort).toBe('returns');
    expect(s.leaderboardPeriod).toBe('1M');
  });

  it('calls socialApi.getLeaderboard and populates leaderboard from API on success', async () => {
    const apiEntry: LeaderboardEntry = {
      ...INITIAL_LEADERBOARD[0],
      rank: 1, change: 'same', rankChange: 0,
    };
    vi.mocked(socialApi.getLeaderboard).mockResolvedValueOnce({
      entries: [apiEntry], total: 1, page: 1, totalPages: 1,
    });

    await useSocialStore.getState().fetchLeaderboard('winRate', '3M');

    expect(socialApi.getLeaderboard).toHaveBeenCalledWith('winRate', '3M');
    expect(useSocialStore.getState().leaderboard).toEqual([apiEntry]);
  });

  it('falls back to local sort by followers when API fails', async () => {
    vi.mocked(socialApi.getLeaderboard).mockRejectedValueOnce(new Error('Network error'));

    await useSocialStore.getState().fetchLeaderboard('followers', 'ALL');
    const { leaderboard } = useSocialStore.getState();
    expect(leaderboard).toHaveLength(8);
    for (let i = 1; i < leaderboard.length; i++) {
      expect(leaderboard[i - 1].followers).toBeGreaterThanOrEqual(leaderboard[i].followers);
    }
  });

  it('falls back to local sort by returns when API fails', async () => {
    vi.mocked(socialApi.getLeaderboard).mockRejectedValueOnce(new Error('Error'));

    await useSocialStore.getState().fetchLeaderboard('returns', 'ALL');
    const { leaderboard } = useSocialStore.getState();
    for (let i = 1; i < leaderboard.length; i++) {
      expect(leaderboard[i - 1].totalPnlPercent).toBeGreaterThanOrEqual(
        leaderboard[i].totalPnlPercent,
      );
    }
  });

  it('falls back to local sort by trades when API fails', async () => {
    vi.mocked(socialApi.getLeaderboard).mockRejectedValueOnce(new Error('Error'));

    await useSocialStore.getState().fetchLeaderboard('trades', 'ALL');
    const { leaderboard } = useSocialStore.getState();
    for (let i = 1; i < leaderboard.length; i++) {
      expect(leaderboard[i - 1].totalTrades).toBeGreaterThanOrEqual(leaderboard[i].totalTrades);
    }
  });

  it('uses current sort/period from state when arguments omitted', async () => {
    resetState({ leaderboardSort: 'winRate', leaderboardPeriod: '1M' });
    vi.mocked(socialApi.getLeaderboard).mockRejectedValueOnce(new Error('Error'));

    await useSocialStore.getState().fetchLeaderboard();
    const { leaderboard, isLoadingLeaderboard } = useSocialStore.getState();
    expect(isLoadingLeaderboard).toBe(false);
    expect(leaderboard).toHaveLength(8);
  });
});

// ──── setLeaderboardSort / setLeaderboardPeriod ────────────────────────────

describe('SocialStore — setLeaderboardSort / setLeaderboardPeriod', () => {
  beforeEach(() => {
    resetState();
    vi.mocked(socialApi.getLeaderboard).mockReset();
    vi.mocked(socialApi.getLeaderboard).mockResolvedValue({ entries: [], total: 0, page: 1, totalPages: 1 });
  });

  it('setLeaderboardSort updates sort and calls fetchLeaderboard', async () => {
    useSocialStore.getState().setLeaderboardSort('followers');
    await vi.waitFor(() => {
      expect(useSocialStore.getState().leaderboardSort).toBe('followers');
    });
    expect(socialApi.getLeaderboard).toHaveBeenCalledWith('followers', 'ALL');
  });

  it('setLeaderboardPeriod updates period and calls fetchLeaderboard', async () => {
    useSocialStore.getState().setLeaderboardPeriod('1Y');
    await vi.waitFor(() => {
      expect(useSocialStore.getState().leaderboardPeriod).toBe('1Y');
    });
    expect(socialApi.getLeaderboard).toHaveBeenCalledWith('pnl', '1Y');
  });
});

// ──── followTrader ─────────────────────────────────────────────────────────

describe('SocialStore — followTrader', () => {
  beforeEach(() => resetState());

  it('adds the trader ID to followedTraderIds', async () => {
    await useSocialStore.getState().followTrader(TRADER_2);
    expect(useSocialStore.getState().followedTraderIds).toContain(TRADER_2);
  });

  it('appends the trader profile to followingTraders with correct name', async () => {
    await useSocialStore.getState().followTrader(TRADER_2);
    const trader = useSocialStore.getState().followingTraders.find(t => t.id === TRADER_2);
    expect(trader).toBeDefined();
    expect(trader!.name).toBe('Priya Patel');
  });

  it('does nothing for a non-existent trader ID', async () => {
    const before = [...useSocialStore.getState().followedTraderIds];
    await useSocialStore.getState().followTrader('non_existent');
    expect(useSocialStore.getState().followedTraderIds).toEqual(before);
  });

  it('calls socialApi.followTrader', async () => {
    await useSocialStore.getState().followTrader(TRADER_2);
    expect(socialApi.followTrader).toHaveBeenCalledWith(TRADER_2);
  });

  it('keeps local state even when the API call fails', async () => {
    vi.mocked(socialApi.followTrader).mockRejectedValueOnce(new Error('API down'));

    await useSocialStore.getState().followTrader(TRADER_3);
    expect(useSocialStore.getState().followedTraderIds).toContain(TRADER_3);
  });

  it('allows following the same trader twice (duplicate in array)', async () => {
    await useSocialStore.getState().followTrader(TRADER_1);
    const ids = useSocialStore.getState().followedTraderIds;
    expect(ids.filter(id => id === TRADER_1).length).toBe(2);
  });
});

// ──── unfollowTrader ───────────────────────────────────────────────────────

describe('SocialStore — unfollowTrader', () => {
  beforeEach(() => resetState());

  it('removes the trader ID from followedTraderIds', async () => {
    await useSocialStore.getState().unfollowTrader(TRADER_1);
    expect(useSocialStore.getState().followedTraderIds).not.toContain(TRADER_1);
  });

  it('removes the trader profile from followingTraders', async () => {
    await useSocialStore.getState().unfollowTrader(TRADER_1);
    expect(useSocialStore.getState().followingTraders.map(t => t.id)).not.toContain(TRADER_1);
  });

  it('leaves other followed traders intact', async () => {
    await useSocialStore.getState().unfollowTrader(TRADER_1);
    expect(useSocialStore.getState().followedTraderIds).toContain(TRADER_4);
    expect(useSocialStore.getState().followingTraders).toHaveLength(1);
  });

  it('is a no-op when the trader was not followed', async () => {
    const before = [...useSocialStore.getState().followedTraderIds];
    await useSocialStore.getState().unfollowTrader(TRADER_5);
    expect(useSocialStore.getState().followedTraderIds).toEqual(before);
  });

  it('calls socialApi.unfollowTrader', async () => {
    await useSocialStore.getState().unfollowTrader(TRADER_1);
    expect(socialApi.unfollowTrader).toHaveBeenCalledWith(TRADER_1);
  });
});

// ──── startCopyTrading ─────────────────────────────────────────────────────

describe('SocialStore — startCopyTrading', () => {
  beforeEach(() => resetState());

  it('adds a new copy relation with zero P&L and zero active trades', async () => {
    await useSocialStore.getState().startCopyTrading(TRADER_2, 40, 200_000);
    const r = useSocialStore.getState().copyRelations.find(x => x.traderId === TRADER_2);
    expect(r).toBeDefined();
    expect(r!.allocationPercent).toBe(40);
    expect(r!.investmentAmount).toBe(200_000);
    expect(r!.totalPnl).toBe(0);
    expect(r!.activeTrades).toBe(0);
    expect(r!.isPaused).toBe(false);
  });

  it('does nothing for a non-existent trader ID', async () => {
    const before = useSocialStore.getState().copyRelations.length;
    await useSocialStore.getState().startCopyTrading('ghost', 50, 100_000);
    expect(useSocialStore.getState().copyRelations).toHaveLength(before);
  });

  it('calls socialApi.startCopyTrading with correct params', async () => {
    await useSocialStore.getState().startCopyTrading(TRADER_3, 60, 300_000);
    expect(socialApi.startCopyTrading).toHaveBeenCalledWith(TRADER_3, 60, 300_000);
  });

  it('preserves existing copy relations when adding a new one', async () => {
    await useSocialStore.getState().startCopyTrading(TRADER_3, 20, 100_000);
    expect(useSocialStore.getState().copyRelations).toHaveLength(3);
  });
});

// ──── stopCopyTrading ──────────────────────────────────────────────────────

describe('SocialStore — stopCopyTrading', () => {
  beforeEach(() => resetState());

  it('removes the copy relation for the specified trader', async () => {
    expect(useSocialStore.getState().copyRelations.find(r => r.traderId === TRADER_1)).toBeDefined();
    await useSocialStore.getState().stopCopyTrading(TRADER_1);
    expect(useSocialStore.getState().copyRelations.find(r => r.traderId === TRADER_1)).toBeUndefined();
  });

  it('removes all copied trades for that trader', async () => {
    await useSocialStore.getState().stopCopyTrading(TRADER_1);
    const remaining = useSocialStore.getState().copiedTrades.filter(t => t.traderId === TRADER_1);
    expect(remaining).toHaveLength(0);
  });

  it('keeps unrelated relations and trades intact', async () => {
    await useSocialStore.getState().stopCopyTrading(TRADER_1);
    expect(useSocialStore.getState().copyRelations).toHaveLength(1);
    expect(useSocialStore.getState().copyRelations[0].traderId).toBe(TRADER_4);
    expect(useSocialStore.getState().copiedTrades).toHaveLength(1);
    expect(useSocialStore.getState().copiedTrades[0].traderId).toBe(TRADER_4);
  });

  it('is a no-op for a trader without a copy relation', async () => {
    const before = useSocialStore.getState().copyRelations.length;
    await useSocialStore.getState().stopCopyTrading(TRADER_5);
    expect(useSocialStore.getState().copyRelations).toHaveLength(before);
  });

  it('calls socialApi.stopCopyTrading', async () => {
    await useSocialStore.getState().stopCopyTrading(TRADER_4);
    expect(socialApi.stopCopyTrading).toHaveBeenCalledWith(TRADER_4);
  });
});

// ──── toggleCopyPause ──────────────────────────────────────────────────────

describe('SocialStore — toggleCopyPause', () => {
  beforeEach(() => resetState());

  it('toggles isPaused from false to true', async () => {
    await useSocialStore.getState().toggleCopyPause(TRADER_1);
    const r = useSocialStore.getState().copyRelations.find(c => c.traderId === TRADER_1);
    expect(r!.isPaused).toBe(true);
  });

  it('toggles isPaused back to false on second call', async () => {
    await useSocialStore.getState().toggleCopyPause(TRADER_1);
    await useSocialStore.getState().toggleCopyPause(TRADER_1);
    const r = useSocialStore.getState().copyRelations.find(c => c.traderId === TRADER_1);
    expect(r!.isPaused).toBe(false);
  });

  it('does nothing for a trader without a copy relation', async () => {
    await useSocialStore.getState().toggleCopyPause(TRADER_5);
    const r = useSocialStore.getState().copyRelations.find(c => c.traderId === TRADER_5);
    expect(r).toBeUndefined();
  });

  it('calls socialApi.toggleCopyPause with the trader ID', async () => {
    await useSocialStore.getState().toggleCopyPause(TRADER_4);
    expect(socialApi.toggleCopyPause).toHaveBeenCalledWith(TRADER_4);
  });
});

// ──── searchTraders ────────────────────────────────────────────────────────

describe('SocialStore — searchTraders', () => {
  beforeEach(() => {
    resetState();
    vi.mocked(socialApi.searchTraders).mockReset();
    vi.mocked(socialApi.searchTraders).mockResolvedValue([]);
  });

  it('returns empty results for an empty query', async () => {
    await useSocialStore.getState().searchTraders('');
    expect(useSocialStore.getState().searchResults).toEqual([]);
    expect(useSocialStore.getState().searchQuery).toBe('');
  });

  it('returns empty results for whitespace-only query', async () => {
    await useSocialStore.getState().searchTraders('   ');
    expect(useSocialStore.getState().searchResults).toEqual([]);
  });

  it('searches by trader name case-insensitively (falls back to local)', async () => {
    vi.mocked(socialApi.searchTraders).mockRejectedValueOnce(new Error('Fallback'));

    await useSocialStore.getState().searchTraders('arun');
    const results = useSocialStore.getState().searchResults;
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(t => t.name.toLowerCase().includes('arun'))).toBe(true);
  });

  it('searches by strategy name (falls back to local)', async () => {
    vi.mocked(socialApi.searchTraders).mockRejectedValueOnce(new Error('Fallback'));

    await useSocialStore.getState().searchTraders('swing');
    const results = useSocialStore.getState().searchResults;
    expect(results.length).toBeGreaterThanOrEqual(2);
    results.forEach(t => {
      expect(t.strategy.toLowerCase()).toContain('swing');
    });
  });

  it('searches by stock symbol in topStocks (falls back to local)', async () => {
    vi.mocked(socialApi.searchTraders).mockRejectedValueOnce(new Error('Fallback'));

    await useSocialStore.getState().searchTraders('TCS');
    const results = useSocialStore.getState().searchResults;
    expect(results.length).toBeGreaterThanOrEqual(1);
    results.forEach(t => {
      expect(t.topStocks.some(s => s.toLowerCase().includes('tcs'))).toBe(true);
    });
  });

  it('updates searchQuery for non-empty query', async () => {
    vi.mocked(socialApi.searchTraders).mockRejectedValueOnce(new Error('Fallback'));

    await useSocialStore.getState().searchTraders('priya');
    expect(useSocialStore.getState().searchQuery).toBe('priya');
  });

  it('uses API results when socialApi.searchTraders succeeds', async () => {
    const mockResult = [{ id: 'api_1', name: 'API Trader', strategy: 'custom' }];
    vi.mocked(socialApi.searchTraders).mockResolvedValueOnce(mockResult as any);

    await useSocialStore.getState().searchTraders('api');
    expect(socialApi.searchTraders).toHaveBeenCalledWith('api');
    expect(useSocialStore.getState().searchResults).toEqual(mockResult);
  });

  it('falls back to local search when API fails', async () => {
    vi.mocked(socialApi.searchTraders).mockRejectedValueOnce(new Error('API error'));

    await useSocialStore.getState().searchTraders('nifty');
    const results = useSocialStore.getState().searchResults;
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

// ──── clearSearch ──────────────────────────────────────────────────────────

describe('SocialStore — clearSearch', () => {
  beforeEach(() => resetState());

  it('resets searchResults to empty array', () => {
    useSocialStore.setState({ searchResults: [{ id: 'x', name: 'X' } as any] });
    useSocialStore.getState().clearSearch();
    expect(useSocialStore.getState().searchResults).toEqual([]);
  });

  it('resets searchQuery to empty string', () => {
    useSocialStore.setState({ searchQuery: 'test' });
    useSocialStore.getState().clearSearch();
    expect(useSocialStore.getState().searchQuery).toBe('');
  });
});

// ──── isFollowing / isCopying helpers ──────────────────────────────────────

describe('SocialStore — isFollowing / isCopying', () => {
  beforeEach(() => resetState());

  it('isFollowing returns true for followed traders, false otherwise', () => {
    expect(useSocialStore.getState().isFollowing(TRADER_1)).toBe(true);
    expect(useSocialStore.getState().isFollowing(TRADER_4)).toBe(true);
    expect(useSocialStore.getState().isFollowing(TRADER_2)).toBe(false);
    expect(useSocialStore.getState().isFollowing('unknown')).toBe(false);
  });

  it('isCopying returns true for copied traders, false otherwise', () => {
    expect(useSocialStore.getState().isCopying(TRADER_1)).toBe(true);
    expect(useSocialStore.getState().isCopying(TRADER_4)).toBe(true);
    expect(useSocialStore.getState().isCopying(TRADER_2)).toBe(false);
    expect(useSocialStore.getState().isCopying('unknown')).toBe(false);
  });
});
