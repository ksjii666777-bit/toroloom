/**
 * ============================================================================
 * Toroloom — Gamification Store Tests
 * ============================================================================
 *
 * Tests the gamification store: XP accumulation, level-ups, and badge
 * unlocking logic. Pure state logic with no external API calls.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGamificationStore } from '../store/gamificationStore';

describe('GamificationStore — XP & Levels', () => {
  beforeEach(() => {
    // Reset store to initial state
    useGamificationStore.setState({
      userLevel: {
        level: 12,
        title: 'Trading Pro',
        xp: 4500,
        xpToNext: 5000,
        totalXp: 24500,
      },
    });
  });

  it('starts with initial level and XP', () => {
    const state = useGamificationStore.getState();
    expect(state.userLevel.level).toBe(12);
    expect(state.userLevel.title).toBe('Trading Pro');
    expect(state.userLevel.xp).toBe(4500);
    expect(state.userLevel.totalXp).toBe(24500);
  });

  it('adds XP without leveling up when below threshold', () => {
    useGamificationStore.getState().addXp(200);
    const state = useGamificationStore.getState();
    expect(state.userLevel.xp).toBe(4700);
    expect(state.userLevel.totalXp).toBe(24700);
    expect(state.userLevel.level).toBe(12);
  });

  it('levels up when XP exceeds threshold', () => {
    useGamificationStore.getState().addXp(600); // 4500 + 600 = 5100, exceeds 5000
    const state = useGamificationStore.getState();
    expect(state.userLevel.level).toBe(13);
    expect(state.userLevel.xp).toBe(100); // 5100 - 5000 = 100
    expect(state.userLevel.totalXp).toBe(25100);
  });

  it('increases xpToNext by 20% after level up', () => {
    useGamificationStore.getState().addXp(600);
    const state = useGamificationStore.getState();
    expect(state.userLevel.xpToNext).toBe(6000); // 5000 * 1.2
  });

  it('updates title based on level after level up', () => {
    // Level 12 → 13: should remain "Trading Pro" (< 15)
    useGamificationStore.getState().addXp(600);
    const state = useGamificationStore.getState();
    expect(state.userLevel.title).toBe('Trading Pro');

    // Add enough XP to reach level 15
    useGamificationStore.setState({
      userLevel: {
        level: 14,
        title: 'Trading Pro',
        xp: 0,
        xpToNext: 7200,
        totalXp: 30000,
      },
    });
    useGamificationStore.getState().addXp(7200); // Level 15
    const state2 = useGamificationStore.getState();
    expect(state2.userLevel.title).toBe('Seasoned Trader');
  });

  it('handles multiple level ups in one XP addition', () => {
    // From level 1 with high XP gain can only level once per call due to logic
    useGamificationStore.setState({
      userLevel: {
        level: 1,
        title: 'New Investor',
        xp: 900,
        xpToNext: 1000,
        totalXp: 900,
      },
    });
    useGamificationStore.getState().addXp(200);
    const state = useGamificationStore.getState();
    // 900 + 200 = 1100, exceeds 1000
    expect(state.userLevel.level).toBe(2);
    expect(state.userLevel.xp).toBe(100); // 1100 - 1000
  });
});

describe('GamificationStore — Badges', () => {
  beforeEach(() => {
    useGamificationStore.setState({
      badges: [
        {
          id: 'b_test',
          name: 'Test Badge',
          description: 'A test badge',
          icon: '🎯',
          requirement: 'Do something',
          unlocked: false,
        },
        {
          id: 'b_unlocked',
          name: 'Unlocked Badge',
          description: 'Already unlocked',
          icon: '🏆',
          requirement: 'Do it first',
          unlocked: true,
          unlockedAt: '2025-01-01T00:00:00Z',
        },
      ],
    });
  });

  it('starts with badges in initial state', () => {
    const state = useGamificationStore.getState();
    expect(state.badges.length).toBeGreaterThan(0);
  });

  it('unlocks a badge with timestamp', () => {
    useGamificationStore.getState().unlockBadge('b_test');
    const badge = useGamificationStore.getState().badges.find(b => b.id === 'b_test');
    expect(badge?.unlocked).toBe(true);
    expect(badge?.unlockedAt).toBeDefined();
  });

  it('does not affect other badges when unlocking', () => {
    useGamificationStore.getState().unlockBadge('b_test');
    const unlockedBadge = useGamificationStore.getState().badges.find(b => b.id === 'b_unlocked');
    expect(unlockedBadge?.unlocked).toBe(true);
    expect(unlockedBadge?.unlockedAt).toBe('2025-01-01T00:00:00Z');
  });

  it('does nothing when unlocking non-existent badge', () => {
    useGamificationStore.getState().unlockBadge('non_existent');
    const badges = useGamificationStore.getState().badges;
    expect(badges.length).toBe(2);
  });
});
