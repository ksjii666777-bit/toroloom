/**
 * ============================================================================
 * Toroloom — Strategy Performance Store Tests
 * ============================================================================
 *
 * Tests the strategy performance tracker store: adding executed strategies,
 * P&L updates, status changes, notes, cleanup, and stats computation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStrategyPerformanceStore } from '../store/strategyPerformanceStore';
import type { ExecutedStrategy, NewExecutedStrategy } from '../types/performance';

// ──── Mocks: isolate from persistence and logging ──────────────────────────

vi.mock('../services/offlineCache', () => ({
  offlineCache: {
    load: vi.fn(() => Promise.resolve(null)),
    save: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// ──── Fixtures ─────────────────────────────────────────────────────────────

const mockInput: NewExecutedStrategy = {
  name: 'Iron Condor',
  symbol: 'NIFTY',
  legCount: 4,
  totalLegs: 4,
  successfulLegs: 4,
  failedLegs: 0,
  totalValue: 100_000,
  targetPnl: 15_000,
  targetReturnPercent: 15,
  backtestWinRate: 72,
  backtestSharpe: 1.8,
  backtestPop: 68,
};

const mockInputSmall: NewExecutedStrategy = {
  ...mockInput,
  name: 'Short Straddle',
  totalValue: 50_000,
  targetPnl: 8_000,
  targetReturnPercent: 16,
  backtestWinRate: 65,
  backtestSharpe: 1.4,
  backtestPop: 55,
};

const mockInputPartial: NewExecutedStrategy = {
  ...mockInput,
  name: 'Strangle (Partial)',
  successfulLegs: 0,
  failedLegs: 2,
};

const mockInputZeroTarget: NewExecutedStrategy = {
  ...mockInput,
  targetReturnPercent: 0,
};

const mockInputZeroValue: NewExecutedStrategy = {
  ...mockInput,
  name: 'Zero Value',
  totalValue: 0,
};

// ──── Tests ────────────────────────────────────────────────────────────────

describe('StrategyPerformanceStore — Initial State', () => {
  beforeEach(() => {
    useStrategyPerformanceStore.setState({
      executedStrategies: [],
      hydrated: false,
      loading: true,
    });
  });

  it('starts with empty strategies list', () => {
    const state = useStrategyPerformanceStore.getState();
    expect(state.executedStrategies).toEqual([]);
    expect(state.hydrated).toBe(false);
    expect(state.loading).toBe(true);
  });

  it('has getStats returning zeroed stats when empty', () => {
    const stats = useStrategyPerformanceStore.getState().getStats();
    expect(stats.totalExecuted).toBe(0);
    expect(stats.activeCount).toBe(0);
    expect(stats.closedCount).toBe(0);
    expect(stats.partialCount).toBe(0);
    expect(stats.totalPnl).toBe(0);
    expect(stats.winningCount).toBe(0);
    expect(stats.losingCount).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.bestStrategy).toBe('-');
    expect(stats.bestPnl).toBe(0);
    expect(stats.worstStrategy).toBe('-');
    expect(stats.worstPnl).toBe(0);
    expect(stats.totalDeployed).toBe(0);
  });
});

describe('StrategyPerformanceStore — addExecutedStrategy', () => {
  beforeEach(() => {
    useStrategyPerformanceStore.setState({
      executedStrategies: [],
      hydrated: true,
      loading: false,
    });
  });

  it('adds a new strategy with a generated ID matching the sp_ pattern', () => {
    const id = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    expect(id).toMatch(/^sp_\d+_[a-z0-9]{6}$/);
  });

  it('prepends the newest strategy at the beginning of the list', () => {
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputSmall);

    const strategies = useStrategyPerformanceStore.getState().executedStrategies;
    expect(strategies).toHaveLength(2);
    expect(strategies[0].name).toBe('Short Straddle'); // most recent first
    expect(strategies[1].name).toBe('Iron Condor');
  });

  it('sets initial P&L to the 0.1 % brokerage cost (negative)', () => {
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    const s = useStrategyPerformanceStore.getState().executedStrategies[0];

    // 100_000 × 0.001 = 100
    expect(s.currentPnl).toBe(-100);
    expect(s.currentPnlPercent).toBe(-0.1);
    expect(s.pnlUpdates).toHaveLength(1);
    expect(s.pnlUpdates[0].pnl).toBe(-100);
    expect(s.pnlUpdates[0].cumulativePnl).toBe(-100);
  });

  it('sets status to "active" when all legs succeed', () => {
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].status,
    ).toBe('active');
  });

  it('sets status to "partial" when all legs fail', () => {
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputPartial);
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].status,
    ).toBe('partial');
  });

  it('copies all input fields faithfully to the new strategy record', () => {
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    const s = useStrategyPerformanceStore.getState().executedStrategies[0];

    expect(s.name).toBe('Iron Condor');
    expect(s.symbol).toBe('NIFTY');
    expect(s.legCount).toBe(4);
    expect(s.totalLegs).toBe(4);
    expect(s.successfulLegs).toBe(4);
    expect(s.failedLegs).toBe(0);
    expect(s.totalValue).toBe(100_000);
    expect(s.targetPnl).toBe(15_000);
    expect(s.targetReturnPercent).toBe(15);
    expect(s.backtestWinRate).toBe(72);
    expect(s.backtestSharpe).toBe(1.8);
    expect(s.backtestPop).toBe(68);
    expect(s.notes).toBe('');
  });

  it('stores a valid ISO timestamp for executedAt', () => {
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    const iso =
      useStrategyPerformanceStore.getState().executedStrategies[0].executedAt;
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it('sets currentPnlPercent to 0 when targetReturnPercent is 0', () => {
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputZeroTarget);
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].currentPnlPercent,
    ).toBe(0);
  });

  it('returns the generated ID', () => {
    const id = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].id,
    ).toBe(id);
  });
});

describe('StrategyPerformanceStore — updateStrategyPnl', () => {
  let strategyId: string;

  beforeEach(() => {
    useStrategyPerformanceStore.setState({
      executedStrategies: [],
      hydrated: true,
      loading: false,
    });
    strategyId = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
  });

  it('sets currentPnl to the new value', () => {
    useStrategyPerformanceStore.getState().updateStrategyPnl(strategyId, 5_000);
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].currentPnl,
    ).toBe(5_000);
  });

  it('appends a PnLUpdate with period pnl = diff from last cumulative', () => {
    useStrategyPerformanceStore.getState().updateStrategyPnl(strategyId, 5_000);
    const updates =
      useStrategyPerformanceStore.getState().executedStrategies[0].pnlUpdates;

    expect(updates).toHaveLength(2);
    // lastCumulative was -100  →  periodPnl = 5_000 - (-100) = 5_100
    expect(updates[1].pnl).toBe(5_100);
    expect(updates[1].cumulativePnl).toBe(5_000);
  });

  it('tracks a sequence of P&L updates correctly', () => {
    useStrategyPerformanceStore.getState().updateStrategyPnl(strategyId, 2_000);
    useStrategyPerformanceStore.getState().updateStrategyPnl(strategyId, 5_000);
    useStrategyPerformanceStore.getState().updateStrategyPnl(strategyId, 3_000);

    const updates =
      useStrategyPerformanceStore.getState().executedStrategies[0].pnlUpdates;

    expect(updates).toHaveLength(4); // 1 initial + 3 updates
    // initial  → cum = -100
    // +2_000   → period = 2_000 - (-100) = 2_100,   cum = 2_000
    // +5_000   → period = 5_000 - 2_000   = 3_000,   cum = 5_000
    // +3_000   → period = 3_000 - 5_000   = -2_000,  cum = 3_000
    expect(updates[0].cumulativePnl).toBe(-100);
    expect(updates[1].pnl).toBe(2_100);
    expect(updates[1].cumulativePnl).toBe(2_000);
    expect(updates[2].pnl).toBe(3_000);
    expect(updates[2].cumulativePnl).toBe(5_000);
    expect(updates[3].pnl).toBe(-2_000);
    expect(updates[3].cumulativePnl).toBe(3_000);
  });

  it('recalculates currentPnlPercent = (newPnl / totalValue) × 100', () => {
    useStrategyPerformanceStore.getState().updateStrategyPnl(strategyId, 5_000);
    // (5_000 / 100_000) × 100 = 5.0  (rounded to 1dp internally)
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].currentPnlPercent,
    ).toBe(5.0);
  });

  it('sets currentPnlPercent to 0 when totalValue is 0', () => {
    const idZero =
      useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputZeroValue);
    useStrategyPerformanceStore.getState().updateStrategyPnl(idZero, 100);
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].currentPnlPercent,
    ).toBe(0);
  });

  it('does nothing when the strategy ID does not exist', () => {
    useStrategyPerformanceStore.getState().updateStrategyPnl('does_not_exist', 5_000);
    const s =
      useStrategyPerformanceStore.getState().executedStrategies[0];
    expect(s.currentPnl).toBe(-100); // untouched
    expect(s.pnlUpdates).toHaveLength(1);
  });

  it('handles negative P&L (drawdown) correctly', () => {
    useStrategyPerformanceStore.getState().updateStrategyPnl(strategyId, -500);
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].currentPnl,
    ).toBe(-500);
  });

  it('handles zero P&L (breakeven) correctly', () => {
    useStrategyPerformanceStore.getState().updateStrategyPnl(strategyId, 0);
    const updates =
      useStrategyPerformanceStore.getState().executedStrategies[0].pnlUpdates;
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].currentPnl,
    ).toBe(0);
    // from -100 → 0: period pnl = 0 - (-100) = 100
    expect(updates[1].pnl).toBe(100);
    expect(updates[1].cumulativePnl).toBe(0);
  });
});

describe('StrategyPerformanceStore — setStrategyStatus', () => {
  let strategyId: string;

  beforeEach(() => {
    useStrategyPerformanceStore.setState({
      executedStrategies: [],
      hydrated: true,
      loading: false,
    });
    strategyId = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
  });

  it('transitions status to "closed"', () => {
    useStrategyPerformanceStore.getState().setStrategyStatus(strategyId, 'closed');
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].status,
    ).toBe('closed');
  });

  it('transitions status to "partial"', () => {
    useStrategyPerformanceStore.getState().setStrategyStatus(strategyId, 'partial');
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].status,
    ).toBe('partial');
  });

  it('transitions status back to "active"', () => {
    useStrategyPerformanceStore.getState().setStrategyStatus(strategyId, 'closed');
    useStrategyPerformanceStore.getState().setStrategyStatus(strategyId, 'active');
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].status,
    ).toBe('active');
  });

  it('does nothing for a non-existent strategy ID', () => {
    useStrategyPerformanceStore.getState().setStrategyStatus('nope', 'closed');
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].status,
    ).toBe('active'); // unchanged
  });
});

describe('StrategyPerformanceStore — setStrategyNotes', () => {
  let strategyId: string;

  beforeEach(() => {
    useStrategyPerformanceStore.setState({
      executedStrategies: [],
      hydrated: true,
      loading: false,
    });
    strategyId = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
  });

  it('attaches notes to the specified strategy', () => {
    useStrategyPerformanceStore.getState().setStrategyNotes(
      strategyId,
      'Followed the plan — exited at target.',
    );
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].notes,
    ).toBe('Followed the plan — exited at target.');
  });

  it('overwrites existing notes', () => {
    useStrategyPerformanceStore.getState().setStrategyNotes(strategyId, 'First take');
    useStrategyPerformanceStore.getState().setStrategyNotes(strategyId, 'Revised take');
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].notes,
    ).toBe('Revised take');
  });

  it('does nothing for a non-existent strategy ID', () => {
    useStrategyPerformanceStore.getState().setStrategyNotes('nope', 'Should not appear');
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].notes,
    ).toBe('');
  });

  it('accepts empty string (clearing notes)', () => {
    useStrategyPerformanceStore.getState().setStrategyNotes(strategyId, 'temp');
    useStrategyPerformanceStore.getState().setStrategyNotes(strategyId, '');
    expect(
      useStrategyPerformanceStore.getState().executedStrategies[0].notes,
    ).toBe('');
  });
});

describe('StrategyPerformanceStore — removeStrategy', () => {
  let id1: string;
  let id2: string;

  beforeEach(() => {
    useStrategyPerformanceStore.setState({
      executedStrategies: [],
      hydrated: true,
      loading: false,
    });
    id1 = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    id2 = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputSmall);
  });

  it('removes only the specified strategy', () => {
    useStrategyPerformanceStore.getState().removeStrategy(id1);
    const remaining = useStrategyPerformanceStore.getState().executedStrategies;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });

  it('does nothing for a non-existent ID', () => {
    useStrategyPerformanceStore.getState().removeStrategy('non_existent');
    expect(useStrategyPerformanceStore.getState().executedStrategies).toHaveLength(2);
  });

  it('leaves list empty after removing all strategies one-by-one', () => {
    useStrategyPerformanceStore.getState().removeStrategy(id1);
    useStrategyPerformanceStore.getState().removeStrategy(id2);
    expect(useStrategyPerformanceStore.getState().executedStrategies).toEqual([]);
  });
});

describe('StrategyPerformanceStore — clearAll', () => {
  beforeEach(() => {
    useStrategyPerformanceStore.setState({
      executedStrategies: [],
      hydrated: true,
      loading: false,
    });
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputSmall);
  });

  it('removes all strategies from the list', () => {
    expect(useStrategyPerformanceStore.getState().executedStrategies).toHaveLength(2);
    useStrategyPerformanceStore.getState().clearAll();
    expect(useStrategyPerformanceStore.getState().executedStrategies).toEqual([]);
  });

  it('leaves other state properties (hydrated, loading) unchanged', () => {
    useStrategyPerformanceStore.getState().clearAll();
    const { hydrated, loading } = useStrategyPerformanceStore.getState();
    expect(hydrated).toBe(true);
    expect(loading).toBe(false);
  });
});

describe('StrategyPerformanceStore — getStats', () => {
  beforeEach(() => {
    useStrategyPerformanceStore.setState({
      executedStrategies: [],
      hydrated: true,
      loading: false,
    });
  });

  it('returns fully zeroed stats for an empty strategy list', () => {
    const stats = useStrategyPerformanceStore.getState().getStats();
    expect(stats.totalExecuted).toBe(0);
    expect(stats.activeCount).toBe(0);
    expect(stats.closedCount).toBe(0);
    expect(stats.partialCount).toBe(0);
    expect(stats.totalPnl).toBe(0);
    expect(stats.winningCount).toBe(0);
    expect(stats.losingCount).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.bestStrategy).toBe('-');
    expect(stats.worstStrategy).toBe('-');
    expect(stats.totalDeployed).toBe(0);
  });

  it('counts active / closed / partial strategies correctly', () => {
    const id1 = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputSmall);
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputPartial);
    useStrategyPerformanceStore.getState().setStrategyStatus(id1, 'closed');

    const stats = useStrategyPerformanceStore.getState().getStats();
    expect(stats.totalExecuted).toBe(3);
    expect(stats.activeCount).toBe(1);  // mockInputSmall
    expect(stats.closedCount).toBe(1);  // mockInput (→closed)
    expect(stats.partialCount).toBe(1); // mockInputPartial (starts partial)
  });

  it('separates winning vs losing strategies by currentPnl > 0 / < 0', () => {
    const ids = [
      useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput),
      useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputSmall),
    ];
    // Both start at -100 → 2 losing
    expect(useStrategyPerformanceStore.getState().getStats().losingCount).toBe(2);

    useStrategyPerformanceStore.getState().updateStrategyPnl(ids[1], 5_000);
    const stats = useStrategyPerformanceStore.getState().getStats();
    expect(stats.winningCount).toBe(1);
    expect(stats.losingCount).toBe(1);
    expect(stats.winRate).toBe(50); // 1/2 × 100
  });

  it('ignores break-even strategies (currentPnl === 0) for win/loss counts', () => {
    const ids = [
      useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput),
      useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputSmall),
      useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputPartial),
    ];
    // All start at -100; push #1 to 0 exactly
    useStrategyPerformanceStore.getState().updateStrategyPnl(ids[0], 0);
    // #2 still at -100, #3 still at -100
    const stats = useStrategyPerformanceStore.getState().getStats();
    expect(stats.winningCount).toBe(0);
    expect(stats.losingCount).toBe(2);
    // winRate = Math.round(0/3 * 100) = 0
    expect(stats.winRate).toBe(0);
  });

  it('identifies the best and worst performing strategies', () => {
    const id1 = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    const id2 = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputSmall);

    useStrategyPerformanceStore.getState().updateStrategyPnl(id1, 10_000);
    useStrategyPerformanceStore.getState().updateStrategyPnl(id2, -5_000);

    const stats = useStrategyPerformanceStore.getState().getStats();
    expect(stats.bestStrategy).toBe('Iron Condor');
    expect(stats.bestPnl).toBe(10_000);
    expect(stats.worstStrategy).toBe('Short Straddle');
    expect(stats.worstPnl).toBe(-5_000);
  });

  it('handles a single strategy as both best and worst', () => {
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    useStrategyPerformanceStore.getState().updateStrategyPnl(
      useStrategyPerformanceStore.getState().executedStrategies[0].id,
      3_000,
    );

    const stats = useStrategyPerformanceStore.getState().getStats();
    expect(stats.bestStrategy).toBe('Iron Condor');
    expect(stats.bestPnl).toBe(3_000);
    expect(stats.worstStrategy).toBe('Iron Condor');
    expect(stats.worstPnl).toBe(3_000);
  });

  it('sums totalPnl as the sum of all currentPnl values', () => {
    const id1 = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);       // -100
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputSmall);               //  -50

    useStrategyPerformanceStore.getState().updateStrategyPnl(id1, 10_000);
    // id1 → 10_000, id2 → -50 (initial for 50_000 value)
    expect(useStrategyPerformanceStore.getState().getStats().totalPnl).toBe(9_950);
  });

  it('sums totalDeployed as the sum of all totalValue', () => {
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);       // 100_000
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputSmall); //  50_000
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputPartial); // 100_000

    expect(useStrategyPerformanceStore.getState().getStats().totalDeployed).toBe(250_000);
  });

  it('rounds winRate to the nearest integer', () => {
    const id1 = useStrategyPerformanceStore.getState().addExecutedStrategy(mockInput);
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputSmall);
    useStrategyPerformanceStore.getState().addExecutedStrategy(mockInputPartial);

    // 1 winner out of 3 → 33.33...% → Math.round → 33
    useStrategyPerformanceStore.getState().updateStrategyPnl(id1, 10_000);
    expect(useStrategyPerformanceStore.getState().getStats().winRate).toBe(33);
  });

  it('returns 0 winRate when there are no strategies (no division by zero)', () => {
    useStrategyPerformanceStore.setState({ executedStrategies: [] });
    expect(useStrategyPerformanceStore.getState().getStats().winRate).toBe(0);
  });
});

describe('StrategyPerformanceStore — hydrate', () => {
  beforeEach(() => {
    useStrategyPerformanceStore.setState({
      executedStrategies: [],
      hydrated: false,
      loading: true,
    });
  });

  it('sets hydrated=true / loading=false when no cached data exists', async () => {
    await useStrategyPerformanceStore.getState().hydrate();
    expect(useStrategyPerformanceStore.getState().hydrated).toBe(true);
    expect(useStrategyPerformanceStore.getState().loading).toBe(false);
    expect(useStrategyPerformanceStore.getState().executedStrategies).toEqual([]);
  });

  it('loads cached strategies when offlineCache returns data', async () => {
    const { offlineCache } = await import('../services/offlineCache');

    const cachedStrategy: ExecutedStrategy = {
      id: 'cached_1',
      name: 'Cached Strategy',
      symbol: 'BANKNIFTY',
      legCount: 2,
      totalLegs: 2,
      successfulLegs: 2,
      failedLegs: 0,
      totalValue: 75_000,
      executedAt: '2025-05-01T08:00:00.000Z',
      pnlUpdates: [
        { date: '2025-05-01T08:00:00.000Z', pnl: 2_000, cumulativePnl: 2_000 },
      ],
      currentPnl: 2_000,
      currentPnlPercent: 2.67,
      targetPnl: 10_000,
      targetReturnPercent: 13.33,
      backtestWinRate: 70,
      backtestSharpe: 1.6,
      backtestPop: 65,
      status: 'active',
      notes: 'Restored from cache',
    };

    vi.mocked(offlineCache.load).mockResolvedValueOnce({
      data: [cachedStrategy],
      source: 'fresh',
    });

    await useStrategyPerformanceStore.getState().hydrate();
    const state = useStrategyPerformanceStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.executedStrategies).toHaveLength(1);
    expect(state.executedStrategies[0].name).toBe('Cached Strategy');
    expect(state.executedStrategies[0].currentPnl).toBe(2_000);
    expect(state.executedStrategies[0].notes).toBe('Restored from cache');
  });

  it('ignores empty array cached data', async () => {
    const { offlineCache } = await import('../services/offlineCache');
    vi.mocked(offlineCache.load).mockResolvedValueOnce({
      data: [],
      source: 'fresh',
    });

    await useStrategyPerformanceStore.getState().hydrate();
    expect(useStrategyPerformanceStore.getState().executedStrategies).toEqual([]);
  });

  it('handles cache load error gracefully (sets hydrated/loading, keeps empty)', async () => {
    const { offlineCache } = await import('../services/offlineCache');
    vi.mocked(offlineCache.load).mockRejectedValueOnce(
      new Error('Storage unavailable'),
    );

    await useStrategyPerformanceStore.getState().hydrate();
    expect(useStrategyPerformanceStore.getState().hydrated).toBe(true);
    expect(useStrategyPerformanceStore.getState().loading).toBe(false);
    expect(useStrategyPerformanceStore.getState().executedStrategies).toEqual([]);
  });
});
