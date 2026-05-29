import { create } from 'zustand';
import { Badge, UserLevel } from '../types';
import { mockBadges, mockUserLevel } from '../constants/mockData';

function getLevelTitle(level: number): string {
  if (level >= 50) return 'Market Legend';
  if (level >= 40) return 'Investor Guru';
  if (level >= 30) return 'Trading Master';
  if (level >= 20) return 'Market Expert';
  if (level >= 15) return 'Seasoned Trader';
  if (level >= 10) return 'Trading Pro';
  if (level >= 7) return 'Active Investor';
  if (level >= 5) return 'Smart Saver';
  if (level >= 3) return 'Curious Learner';
  return 'New Investor';
}

interface GamificationState {
  userLevel: UserLevel;
  badges: Badge[];
  addXp: (amount: number) => void;
  unlockBadge: (badgeId: string) => void;
}

export const useGamificationStore = create<GamificationState>((set) => ({
  userLevel: mockUserLevel,
  badges: mockBadges,

  addXp: (amount) => {
    set(state => {
      const newTotalXp = state.userLevel.totalXp + amount;
      const xpToNext = state.userLevel.xpToNext;
      const newXp = state.userLevel.xp + amount;

      if (newXp >= xpToNext) {
        return {
          userLevel: {
            ...state.userLevel,
            level: state.userLevel.level + 1,
            xp: newXp - xpToNext,
            xpToNext: Math.round(xpToNext * 1.2),
            totalXp: newTotalXp,
            title: getLevelTitle(state.userLevel.level + 1),
          },
        };
      }

      return {
        userLevel: { ...state.userLevel, xp: newXp, totalXp: newTotalXp },
      };
    });
  },

  unlockBadge: (badgeId) => {
    set(state => ({
      badges: state.badges.map(b =>
        b.id === badgeId ? { ...b, unlocked: true, unlockedAt: new Date().toISOString() } : b
      ),
    }));
  },
}));
