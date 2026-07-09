import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import LearningPathsScreen from '../screens/education/LearningPathsScreen';
import { mockLearningPaths } from '../constants/mockData';

// ── Hoisted mocks ────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      white: '#FFFFFF',
      bg: '#0D0D2B',
      bgCard: '#222255',
      bgInput: '#1E1E4A',
      bgCardLight: '#2A2A5E',
      bgDark: '#070720',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
      bgSecondary: '#1A1A3E',
      bgOverlay: 'rgba(0,0,0,0.5)',
      primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      marketUp: '#00C853',
      marketDown: '#FF1744',
    },
    isDark: true,
  }),
}));

vi.mock('../store/educationStore', () => ({
  useEducationStore: () => ({
    courses: [],
    lessonProgress: {},
  }),
}));

// ── Tests ─────────────────────────────────────────────────────

describe('LearningPathsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the screen title', () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate }} />);
    expect(getByText('Learning Paths')).toBeTruthy();
  });

  it('renders all 3 learning path cards', () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate }} />);
    expect(getByText('Investing Fundamentals')).toBeTruthy();
    expect(getByText('Technical & Fundamental Trader')).toBeTruthy();
    expect(getByText('Options & Portfolio Pro')).toBeTruthy();
  });

  it('shows summary stats in banner', () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate }} />);
    expect(getByText('Paths')).toBeTruthy();
    expect(getByText('Courses')).toBeTruthy();
    expect(getByText('Lessons')).toBeTruthy();
    expect(getByText('Learners')).toBeTruthy();
  });

  it('shows skill chips for each path', () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate }} />);
    expect(getByText('Stock Market Basics')).toBeTruthy();
    expect(getByText('Technical Analysis')).toBeTruthy();
    expect(getByText('Options Strategies')).toBeTruthy();
  });

  it('shows duration and lesson counts from mock data', () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate }} />);
    mockLearningPaths.forEach(path => {
      expect(getByText(path.totalDuration)).toBeTruthy();
      expect(getByText(`${path.totalLessons} lessons`)).toBeTruthy();
    });
  });

  it('shows target audience for paths', () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate }} />);
    expect(getByText(/Complete beginners/i)).toBeTruthy();
    expect(getByText(/Level up with professional/i)).toBeTruthy();
    expect(getByText(/Go pro with advanced/i)).toBeTruthy();
  });

  it('displays start CTA text', () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate }} />);
    expect(getByText('Start Path →')).toBeTruthy();
  });

  it('shows grammar-friendly level labels', () => {
    const { getAllByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate }} />);
    expect(getAllByText('Beginner').length).toBeGreaterThan(0);
    expect(getAllByText('Intermediate').length).toBeGreaterThan(0);
    expect(getAllByText('Advanced').length).toBeGreaterThan(0);
  });

  it('navigates to detail view when a path card is pressed', () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate }} />);
    fireEvent.press(getByText('Investing Fundamentals'));
    expect(mockNavigate).toHaveBeenCalledWith('LearningPathDetail', { pathId: 'path_beginner' });
  });
});
