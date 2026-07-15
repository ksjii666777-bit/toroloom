/**
 * ============================================================================
 * Toroloom — RiskRewardCharts Unit Tests
 * ============================================================================
 *
 * Tests the RiskRewardCharts component and its four sub-components:
 *   - RRRatioCard: R:R ratio display with color-coded rating
 *   - ConsecutiveStreaks: win/loss streak indicators
 *   - DrawdownBar: drawdown depth, episodes, duration
 *   - WinLossBar: proportional win/loss distribution bar
 *
 * Edge cases covered:
 *   - R:R = Infinity (avgLoss = 0, all winning trades)
 *   - All wins (winningPeriods = totalPeriods, no losses)
 *   - All losses (no wins)
 *   - Zero drawdown (perfect equity curve)
 *   - Empty / zero metrics
 *   - Poor R:R (< 1)
 *   - High drawdown scenarios
 *   - Single drawdown episode
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';

// ──── Mock Theme Context ───────────────────────────────────────────────────

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A',
      text: '#FFFFFF',
      textSecondary: '#B0B0B0',
      textMuted: '#666680',
      primary: '#6C63FF',
      accent: '#00D2FF',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      bgCard: '#1A1A2E',
      bgCardLight: '#25253D',
      bgInput: '#1E1E32',
      border: '#2A2A44',
      divider: '#2A2A44',
      bgSecondary: '#16162A',
      warning: '#FFC107',
      borderLight: '#3A3A54',
      white: '#FFFFFF',
      transparent: 'transparent',
      danger: '#FF1744',
    },
  }),
}));

// ──── Module under test ────────────────────────────────────────────────────

import RiskRewardCharts from '../components/fno/RiskRewardCharts';
import type { BacktestMetrics } from '../services/backtestEngine';

// ──── Helpers ──────────────────────────────────────────────────────────────

function buildMetrics(overrides: Partial<BacktestMetrics> = {}): BacktestMetrics {
  return {
    totalPnl: 15000,
    totalReturnPercent: 12.5,
    totalPeriods: 100,
    winningPeriods: 60,
    losingPeriods: 40,
    winRate: 60,
    avgWin: 1200,
    avgLoss: 800,
    profitFactor: 2.25,
    maxDrawdown: 5000,
    maxDrawdownPercent: 12.5,
    sharpeRatio: 1.8,
    sortinoRatio: 2.1,
    calmarRatio: 3.0,
    bestPeriod: 3500,
    worstPeriod: -2000,
    returnStdDev: 1500,
    avgReturn: 150,
    probabilityOfProfit: 72.5,
    rewardRiskRatio: 1.5,
    maxConsecutiveWins: 8,
    maxConsecutiveLosses: 4,
    drawdownEpisodes: 3,
    avgDrawdownDepth: 4.2,
    maxDrawdownDuration: 15,
    ...overrides,
  };
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('RiskRewardCharts', () => {
  // ── Basic rendering ────────────────────────────────────────────────────

  it('renders the section header', () => {
    const { getByText } = render(<RiskRewardCharts metrics={buildMetrics()} />);
    expect(getByText('Risk / Reward Profile')).toBeDefined();
  });

  it('renders without crashing with normal metrics', () => {
    const { toJSON } = render(<RiskRewardCharts metrics={buildMetrics()} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders all four sub-sections', () => {
    const { getByText } = render(<RiskRewardCharts metrics={buildMetrics()} />);
    expect(getByText('R:R Ratio')).toBeDefined();
    expect(getByText('Consecutive Streaks')).toBeDefined();
    expect(getByText('Drawdown Analysis')).toBeDefined();
    expect(getByText('Win / Loss Distribution')).toBeDefined();
  });

  it('displays the R:R ratio value formatted to 2 decimal places', () => {
    const { getByText } = render(
      <RiskRewardCharts metrics={buildMetrics({ rewardRiskRatio: 2.453 })} />
    );
    expect(getByText('2.45')).toBeDefined();
  });

  it('displays the correct streak values', () => {
    const { getAllByText } = render(
      <RiskRewardCharts metrics={buildMetrics({ maxConsecutiveWins: 12, maxConsecutiveLosses: 5 })} />
    );
    expect(getAllByText('12').length).toBeGreaterThan(0);
    expect(getAllByText('5').length).toBeGreaterThan(0);
  });

  it('displays drawdown episode count and duration', () => {
    const { getByText } = render(
      <RiskRewardCharts metrics={buildMetrics({ drawdownEpisodes: 7, maxDrawdownDuration: 42 })} />
    );
    expect(getByText('7')).toBeDefined();
    expect(getByText('42')).toBeDefined();
  });

  it('displays win/loss distribution numbers', () => {
    const { getByText } = render(
      <RiskRewardCharts metrics={buildMetrics({ winningPeriods: 75, losingPeriods: 25, totalPeriods: 100 })} />
    );
    expect(getByText(/75/)).toBeDefined();
    expect(getByText(/25/)).toBeDefined();
  });

  // ── R:R = Infinity (all winning trades, no losses) ─────────────────────

  describe('R:R = Infinity (all winning trades)', () => {
    it('renders the infinity symbol for R:R ratio', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            rewardRiskRatio: Infinity,
            avgWin: 1200,
            avgLoss: 0,
            winningPeriods: 100,
            losingPeriods: 0,
            totalPeriods: 100,
          })}
        />
      );
      expect(getByText('∞')).toBeDefined();
    });

    it('shows Excellent rating for infinite R:R', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            rewardRiskRatio: Infinity,
            avgWin: 1200,
            avgLoss: 0,
            winningPeriods: 100,
            losingPeriods: 0,
          })}
        />
      );
      expect(getByText('🏆 Excellent')).toBeDefined();
    });
  });

  // ── All wins (100% win rate, no losses) ────────────────────────────────

  describe('100% win rate (all wins)', () => {
    it('shows no loss bar segment visible in distribution — only win counts', () => {
      const metrics = buildMetrics({
        winningPeriods: 100,
        losingPeriods: 0,
        totalPeriods: 100,
        avgLoss: 0,
        rewardRiskRatio: Infinity,
      });
      const { getByText } = render(<RiskRewardCharts metrics={metrics} />);
      // 100% win = "Win 100%" text
      expect(getByText(/100%/)).toBeDefined();
      // Loss should show 0%
      expect(getByText(/0%/)).toBeDefined();
    });

    it('shows zero for max consecutive losses', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            winningPeriods: 100,
            losingPeriods: 0,
            maxConsecutiveWins: 100,
            maxConsecutiveLosses: 0,
          })}
        />
      );
      // Need to find "0" that represents loss streak (not from other sections)
      const allZero = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            winningPeriods: 100,
            losingPeriods: 0,
            maxConsecutiveWins: 100,
            maxConsecutiveLosses: 0,
            drawdownEpisodes: 0,
            avgDrawdownDepth: 0,
            maxDrawdownDuration: 0,
            maxDrawdownPercent: 0,
            avgLoss: 0,
            rewardRiskRatio: Infinity,
          })}
        />
      );
      // Consecutive Streaks section has "Max Win Streak" and "Max Loss Streak"
      expect(allZero.getByText('0')).toBeDefined();
    });
  });

  // ── All losses (0% win rate) ───────────────────────────────────────────

  describe('All losses (no wins)', () => {
    it('shows Loss 100% when all periods are losses', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            winningPeriods: 0,
            losingPeriods: 100,
            totalPeriods: 100,
            winRate: 0,
            avgWin: 0,
            avgLoss: 500,
            profitFactor: 0,
            rewardRiskRatio: 0,
            maxConsecutiveWins: 0,
            maxConsecutiveLosses: 100,
          })}
        />
      );
      expect(getByText(/100%/)).toBeDefined();
    });

    it('shows N/A rating for zero R:R (no wins)', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            rewardRiskRatio: 0,
            avgWin: 0,
            avgLoss: 800,
            winningPeriods: 0,
            losingPeriods: 100,
          })}
        />
      );
      expect(getByText('— N/A')).toBeDefined();
    });
  });

  // ── Zero drawdown (perfect equity curve) ───────────────────────────────

  describe('Zero drawdown', () => {
    it('shows 0.0% max drawdown depth', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxDrawdown: 0,
            maxDrawdownPercent: 0,
            drawdownEpisodes: 0,
            avgDrawdownDepth: 0,
            maxDrawdownDuration: 0,
          })}
        />
      );
      expect(getByText('0.0%')).toBeDefined();
    });

    it('shows 0 drawdown episodes', () => {
      const zeroElements = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxDrawdown: 0,
            maxDrawdownPercent: 0,
            drawdownEpisodes: 0,
            avgDrawdownDepth: 0,
            maxDrawdownDuration: 0,
            maxConsecutiveWins: 8,
            maxConsecutiveLosses: 4,
          })}
        />
      );
      // "0" in episodes section
      expect(zeroElements.getByText('0')).toBeDefined();
    });

    it('shows 0 longest drawdown duration', () => {
      const metrics = buildMetrics({
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        drawdownEpisodes: 0,
        avgDrawdownDepth: 0,
        maxDrawdownDuration: 0,
      });
      const { getByText } = render(<RiskRewardCharts metrics={metrics} />);
      expect(getByText('0')).toBeDefined();
    });
  });

  // ── Empty / zeroed metrics ─────────────────────────────────────────────

  describe('Empty / zeroed metrics', () => {
    const emptyMetrics: BacktestMetrics = {
      totalPnl: 0,
      totalReturnPercent: 0,
      totalPeriods: 0,
      winningPeriods: 0,
      losingPeriods: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      bestPeriod: 0,
      worstPeriod: 0,
      returnStdDev: 0,
      avgReturn: 0,
      probabilityOfProfit: 0,
      rewardRiskRatio: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      drawdownEpisodes: 0,
      avgDrawdownDepth: 0,
      maxDrawdownDuration: 0,
    };

    it('renders without crashing with all zeros', () => {
      const { toJSON } = render(<RiskRewardCharts metrics={emptyMetrics} />);
      expect(toJSON()).toBeTruthy();
    });

    it('shows N/A rating for R:R when all metrics are zero', () => {
      const { getByText } = render(<RiskRewardCharts metrics={emptyMetrics} />);
      expect(getByText('— N/A')).toBeDefined();
    });

    it('shows 0.00 R:R value', () => {
      const { getByText } = render(<RiskRewardCharts metrics={emptyMetrics} />);
      expect(getByText('0.00')).toBeDefined();
    });

    it('shows 0.0% for max drawdown', () => {
      const { getByText } = render(<RiskRewardCharts metrics={emptyMetrics} />);
      expect(getByText('0.0%')).toBeDefined();
    });

    it('shows 0 episodes and 0 duration', () => {
      const { getAllByText } = render(<RiskRewardCharts metrics={emptyMetrics} />);
      expect(getAllByText('0').length).toBeGreaterThanOrEqual(3);
    });

    it('shows 0% win rate in distribution', () => {
      const { getByText } = render(<RiskRewardCharts metrics={emptyMetrics} />);
      expect(getByText(/0%/)).toBeDefined();
    });
  });

  // ── Poor R:R ratio (< 1) ───────────────────────────────────────────────

  describe('Poor R:R ratio', () => {
    it('shows Poor rating for R:R < 1', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            rewardRiskRatio: 0.55,
            avgWin: 440,
            avgLoss: 800,
          })}
        />
      );
      expect(getByText('⚠️ Poor')).toBeDefined();
    });

    it('shows Fair rating for R:R between 1 and 1.5', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            rewardRiskRatio: 1.2,
            avgWin: 960,
            avgLoss: 800,
          })}
        />
      );
      expect(getByText('👌 Fair')).toBeDefined();
    });

    it('shows Good rating for R:R between 1.5 and 2', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            rewardRiskRatio: 1.75,
            avgWin: 1400,
            avgLoss: 800,
          })}
        />
      );
      expect(getByText('👍 Good')).toBeDefined();
    });

    it('shows Great rating for R:R between 2 and 3', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            rewardRiskRatio: 2.5,
            avgWin: 2000,
            avgLoss: 800,
          })}
        />
      );
      expect(getByText('💪 Great')).toBeDefined();
    });

    it('shows Excellent rating for R:R >= 3', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            rewardRiskRatio: 3.5,
            avgWin: 2800,
            avgLoss: 800,
          })}
        />
      );
      expect(getByText('🏆 Excellent')).toBeDefined();
    });
  });

  // ── High drawdown ──────────────────────────────────────────────────────

  describe('High drawdown', () => {
    it('shows deep drawdown percentage', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxDrawdown: 45000,
            maxDrawdownPercent: 45.0,
            drawdownEpisodes: 8,
            avgDrawdownDepth: 18.3,
            maxDrawdownDuration: 67,
          })}
        />
      );
      expect(getByText('45.0%')).toBeDefined();
    });

    it('shows high episode count', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxDrawdown: 45000,
            maxDrawdownPercent: 45.0,
            drawdownEpisodes: 8,
            avgDrawdownDepth: 18.3,
            maxDrawdownDuration: 67,
          })}
        />
      );
      expect(getByText('8')).toBeDefined();
    });

    it('shows long drawdown duration', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxDrawdown: 45000,
            maxDrawdownPercent: 45.0,
            drawdownEpisodes: 8,
            avgDrawdownDepth: 18.3,
            maxDrawdownDuration: 120,
          })}
        />
      );
      expect(getByText('120')).toBeDefined();
    });

    it('shows average drawdown depth percentage', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxDrawdown: 45000,
            maxDrawdownPercent: 45.0,
            drawdownEpisodes: 8,
            avgDrawdownDepth: 18.3,
            maxDrawdownDuration: 67,
          })}
        />
      );
      expect(getByText('18.3%')).toBeDefined();
    });
  });

  // ── Single drawdown episode ────────────────────────────────────────────

  describe('Single drawdown episode', () => {
    it('shows exactly 1 episode', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxDrawdown: 15000,
            maxDrawdownPercent: 15.0,
            drawdownEpisodes: 1,
            avgDrawdownDepth: 15.0,
            maxDrawdownDuration: 30,
          })}
        />
      );
      expect(getByText('1')).toBeDefined();
    });
  });

  // ── Large consecutive streaks ──────────────────────────────────────────

  describe('Large consecutive streaks', () => {
    it('shows large win streak number', () => {
      const { getAllByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxConsecutiveWins: 999,
            maxConsecutiveLosses: 1,
            totalPeriods: 1000,
            winningPeriods: 999,
            losingPeriods: 1,
          })}
        />
      );
      // "999" should appear somewhere (win streak, possibly also total periods 1000 rendered)
      const matches = getAllByText('999');
      expect(matches.length).toBeGreaterThan(0);
    });

    it('shows large loss streak number', () => {
      const { getAllByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxConsecutiveWins: 1,
            maxConsecutiveLosses: 250,
            totalPeriods: 251,
            winningPeriods: 1,
            losingPeriods: 250,
          })}
        />
      );
      const matches = getAllByText('250');
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  // ── Boundary: zero-length streaks (single period) ──────────────────────

  describe('Single-period streaks', () => {
    it('handles 1-win/1-loss scenario', () => {
      const ones = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxConsecutiveWins: 1,
            maxConsecutiveLosses: 1,
          })}
        />
      );
      expect(ones.getByText('1')).toBeDefined();
    });
  });

  // ── Verify no crash with undefined-like values ─────────────────────────

  describe('Stability with extreme values', () => {
    it('handles very large R:R ratio (10.5)', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            rewardRiskRatio: 10.5,
            avgWin: 8400,
            avgLoss: 800,
          })}
        />
      );
      expect(getByText('10.50')).toBeDefined();
      expect(getByText('🏆 Excellent')).toBeDefined();
    });

    it('handles very small R:R ratio (0.05)', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            rewardRiskRatio: 0.05,
            avgWin: 40,
            avgLoss: 800,
          })}
        />
      );
      expect(getByText('0.05')).toBeDefined();
      expect(getByText('⚠️ Poor')).toBeDefined();
    });

    it('handles negative totalPnl (strategy losing money overall)', () => {
      const { toJSON } = render(
        <RiskRewardCharts
          metrics={buildMetrics({ totalPnl: -5000, totalReturnPercent: -8.3 })}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it('handles very large drawdown percentage (99.9%)', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            maxDrawdown: 999000,
            maxDrawdownPercent: 99.9,
            drawdownEpisodes: 1,
            avgDrawdownDepth: 99.9,
            maxDrawdownDuration: 252,
          })}
        />
      );
      expect(getByText('99.9%')).toBeDefined();
    });
  });

  // ── Win/Loss Distribution edge cases ───────────────────────────────────

  describe('Win/Loss Distribution edge cases', () => {
    it('handles 50/50 split', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            winningPeriods: 50,
            losingPeriods: 50,
            totalPeriods: 100,
          })}
        />
      );
      expect(getByText(/50%/)).toBeDefined();
    });

    it('handles single total period (1 win, 0 losses)', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            winningPeriods: 1,
            losingPeriods: 0,
            totalPeriods: 1,
            rewardRiskRatio: Infinity,
          })}
        />
      );
      expect(getByText(/100%/)).toBeDefined();
    });

    it('handles single total period (0 wins, 1 loss)', () => {
      const { getByText } = render(
        <RiskRewardCharts
          metrics={buildMetrics({
            winningPeriods: 0,
            losingPeriods: 1,
            totalPeriods: 1,
            rewardRiskRatio: 0,
            avgWin: 0,
            avgLoss: 500,
          })}
        />
      );
      expect(getByText(/100%/)).toBeDefined();
    });
  });
});
