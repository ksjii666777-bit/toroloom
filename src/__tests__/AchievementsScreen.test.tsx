import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { default as AchievementsScreen } from '../screens/achievements/AchievementsScreen';

// Mock ThemeContext
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
      bgCard: '#1A1A2E',
      bgCardLight: '#25253D',
      bgInput: '#1E1E32',
      border: '#2A2A44',
      divider: '#2A2A44',
      bgSecondary: '#16162A',
      warning: '#FFC107',
    },
  }),
}));

const mockBadges = [
  { id: 'b1', name: 'First Trade', icon: '📈', description: 'Complete your first trade', requirement: 'Place 1 trade', unlocked: true, unlockedAt: '2025-01-15T10:00:00Z' },
  { id: 'b2', name: 'Quick Learner', icon: '📚', description: 'Complete 5 lessons', requirement: 'Complete 5 lessons', unlocked: true, unlockedAt: '2025-02-01T10:00:00Z' },
  { id: 'b3', name: 'Risk Taker', icon: '🎯', description: 'Take a high-risk trade', requirement: 'Place 1 high-risk trade', unlocked: false },
  { id: 'b4', name: 'Market Analyst', icon: '🔍', description: 'Analyze 10 stocks', requirement: 'Analyze 10 stocks', unlocked: false },
];

vi.mock('../store/gamificationStore', () => ({
  useGamificationStore: () => ({
    userLevel: { level: 3, title: 'Smart Saver', xp: 2450, xpToNext: 5000, totalXp: 2450 },
    badges: mockBadges,
  }),
}));

describe('AchievementsScreen', () => {
  const mockGoBack = vi.fn();
  const defaultProps = { navigation: { goBack: mockGoBack } };

  beforeEach(() => {
    mockGoBack.mockClear();
  });

  describe('Header', () => {
    it('renders the title', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('Achievements')).toBeDefined();
    });

    it('shows badge count subtitle', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('2 of 4 badges unlocked')).toBeDefined();
    });
  });

  describe('Level Card', () => {
    it('shows current level number', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('3')).toBeDefined();
    });

    it('shows level title', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('Smart Saver')).toBeDefined();
    });

    it('shows total XP', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('2,450 Total XP')).toBeDefined();
    });

    it('shows XP progress values', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('2,450 / 5,000 XP')).toBeDefined();
    });

    it('shows the level progression label', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('Level 3 → 4')).toBeDefined();
    });
  });

  describe('Stats Grid', () => {
    it('shows Total Badges label', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('Total Badges')).toBeDefined();
    });

    it('shows Unlocked label', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('Unlocked')).toBeDefined();
    });

    it('shows Locked label', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('Locked')).toBeDefined();
    });

    it('shows Completion label', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('Completion')).toBeDefined();
    });
  });

  describe('Badges Grid', () => {
    it('shows all badge names', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('First Trade')).toBeDefined();
      expect(getByText('Quick Learner')).toBeDefined();
      expect(getByText('Risk Taker')).toBeDefined();
      expect(getByText('Market Analyst')).toBeDefined();
    });

    it('shows unlock date for unlocked badge', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('15 Jan')).toBeDefined();
    });
  });

  describe('Tab Toggle', () => {
    it('shows All Badges tab', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('All Badges')).toBeDefined();
    });

    it('shows Unlocked tab with count', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('Unlocked (2)')).toBeDefined();
    });
  });

  describe('Upcoming Challenges', () => {
    it('shows section heading', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('Upcoming Challenges')).toBeDefined();
    });

    it('shows challenge descriptions', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('Place 10 trades')).toBeDefined();
      expect(getByText('Complete 10 lessons')).toBeDefined();
    });

    it('shows XP rewards', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      expect(getByText('+200 XP')).toBeDefined();
      expect(getByText('+150 XP')).toBeDefined();
    });
  });

  describe('Badge Detail Modal', () => {
    it('shows badge details when tapped', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      act(() => { fireEvent.press(getByText('First Trade')); });
      expect(getByText('Complete your first trade')).toBeDefined();
      expect(getByText('Place 1 trade')).toBeDefined();
      expect(getByText('Unlocked')).toBeDefined();
    });

    it('shows Got it! button in modal', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      act(() => { fireEvent.press(getByText('First Trade')); });
      expect(getByText('Got it!')).toBeDefined();
    });

    it('shows locked requirement for locked badge', () => {
      const { getByText } = render(<AchievementsScreen {...defaultProps} />);
      act(() => { fireEvent.press(getByText('Risk Taker')); });
      expect(getByText('Take a high-risk trade')).toBeDefined();
      expect(getByText('Locked')).toBeDefined();
    });
  });
});
