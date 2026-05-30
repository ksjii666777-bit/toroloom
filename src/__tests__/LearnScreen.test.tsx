import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react-test-renderer';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', bgCard: '#1A1A2E',
      bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44',
      bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      danger: '#FF1744', white: '#FFFFFF', success: '#00C853',
    },
  }),
}));

const mockNavigate = vi.fn();

const defaultCourses = [
  { id: 'c1', title: 'Stock Market Basics', thumbnail: '📈', level: 'beginner', duration: '2 hours', lessons: 10, enrolledCount: 15420, rating: 4.7, progress: 30 },
  { id: 'c2', title: 'Technical Analysis', thumbnail: '📊', level: 'intermediate', duration: '4 hours', lessons: 8, enrolledCount: 8900, rating: 4.5, progress: 0 },
  { id: 'c3', title: 'Advanced Trading Strategies', thumbnail: '🎯', level: 'advanced', duration: '6 hours', lessons: 12, enrolledCount: 3200, rating: 4.8, progress: 100 },
];

let mockStoreState: any = {};

vi.mock('../store/educationStore', () => ({
  useEducationStore: () => mockStoreState,
}));

import LearnScreen from '../screens/tabs/LearnScreen';

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState = {
    courses: defaultCourses,
  };
});

describe('LearnScreen', () => {
  it('renders the screen title', () => {
    vi.useFakeTimers();
    const { getByText, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(getByText('Learning Hub')).toBeDefined();
    unmount();
    vi.useRealTimers();
  });

  it('renders the subtitle', () => {
    vi.useFakeTimers();
    const { getByText, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(getByText('Master the markets, one lesson at a time')).toBeDefined();
    unmount();
    vi.useRealTimers();
  });

  it('renders All Courses section', () => {
    vi.useFakeTimers();
    const { getByText, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(getByText('All Courses')).toBeDefined();
    unmount();
    vi.useRealTimers();
  });

  it('renders course titles', () => {
    vi.useFakeTimers();
    const { getByText, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(getByText('Stock Market Basics')).toBeDefined();
    expect(getByText('Technical Analysis')).toBeDefined();
    expect(getByText('Advanced Trading Strategies')).toBeDefined();
    unmount();
    vi.useRealTimers();
  });

  it('renders course level badges', () => {
    vi.useFakeTimers();
    const { getByText, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(getByText('beginner')).toBeDefined();
    expect(getByText('intermediate')).toBeDefined();
    expect(getByText('advanced')).toBeDefined();
    unmount();
    vi.useRealTimers();
  });

  it('renders course durations', () => {
    vi.useFakeTimers();
    const { getByText, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(getByText('2 hours')).toBeDefined();
    expect(getByText('4 hours')).toBeDefined();
    expect(getByText('6 hours')).toBeDefined();
    unmount();
    vi.useRealTimers();
  });

  it('renders course ratings', () => {
    vi.useFakeTimers();
    const { getByText, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(getByText('4.7')).toBeDefined();
    expect(getByText('4.5')).toBeDefined();
    expect(getByText('4.8')).toBeDefined();
    unmount();
    vi.useRealTimers();
  });

  it('renders enrolled counts', () => {
    vi.useFakeTimers();
    const { getByText, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(getByText('15,420')).toBeDefined();
    expect(getByText('8,900')).toBeDefined();
    unmount();
    vi.useRealTimers();
  });

  it('renders Continue Learning section when courses have progress', () => {
    vi.useFakeTimers();
    const { getByText, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(getByText('Continue Learning')).toBeDefined();
    unmount();
    vi.useRealTimers();
  });

  it('renders progress percentages', () => {
    vi.useFakeTimers();
    const { getByText, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(getByText('30% complete')).toBeDefined();
    unmount();
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    vi.useFakeTimers();
    const { toJSON, unmount } = render(<LearnScreen navigation={{ navigate: mockNavigate } as any} />);
    act(() => { vi.advanceTimersByTime(600); });
    expect(toJSON()).toBeTruthy();
    unmount();
    vi.useRealTimers();
  });
});
