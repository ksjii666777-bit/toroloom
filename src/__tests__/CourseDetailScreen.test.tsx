/**
 * ============================================================================
 * Toroloom — CourseDetailScreen Integration Tests
 * ============================================================================
 *
 * Verifies that CourseDetailScreen renders correctly with course hero,
 * progress section, about section, lessons list, "Next Lesson" badge,
 * "Continue Learning" button, missing course fallback, and navigation.
 *
 * NOTE: course/lesson IDs here match the REAL data in courseContent.ts
 *       (c1, l1, l2, l3, ... l8), NOT the old mock IDs.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockFetchLesson = vi.fn();
const mockMarkLessonComplete = vi.fn();
const mockAddXp = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      white: '#FFFFFF',
      bg: '#0D0D2B',
      bgSecondary: '#1A1A3E',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgDark: '#070720',
      bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/educationStore', () => ({
  useEducationStore: vi.fn(() => ({
    currentLesson: null,
    fetchLesson: mockFetchLesson,
    markLessonComplete: mockMarkLessonComplete,
    lessonProgress: {},
  })),
}));

vi.mock('../store/gamificationStore', () => ({
  useGamificationStore: vi.fn(() => ({
    addXp: mockAddXp,
  })),
}));

// ==================== Imports ====================

import CourseDetailScreen from '../screens/education/CourseDetailScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('CourseDetailScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const route = { params: { courseId: 'c1' } };
    const { toJSON } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(toJSON).not.toBeNull();
  });
});

describe('CourseDetailScreen — Loaded Content', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchLesson.mockClear();
    mockMarkLessonComplete.mockClear();
    mockAddXp.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the course title from mock data', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Stock Market Basics')).toBeDefined();
  });

  it('renders the course description in the hero', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText(/investing in the stock market/)).toBeDefined();
  });

  it('renders the level badge', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('beginner')).toBeDefined();
  });

  it('renders the category badge', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Fundamentals')).toBeDefined();
  });

  it('renders Course Progress section', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Course Progress')).toBeDefined();
  });

  it('renders progress stats (Completed, Remaining, Duration)', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Completed')).toBeDefined();
    expect(getByText('Remaining')).toBeDefined();
    expect(getByText('Duration')).toBeDefined();
  });

  it('renders About this Course section', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('About this Course')).toBeDefined();
  });

  it('renders the enrolled count stat', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText(/enrolled/)).toBeDefined();
  });

  it('renders the rating stat', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText(/rating/)).toBeDefined();
  });

  it('renders the Lessons section title with count', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText(/Lessons/)).toBeDefined();
  });

  it('renders individual lesson titles from mock data', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('What is the Stock Market?')).toBeDefined();
    expect(getByText('Key Market Participants')).toBeDefined();
    expect(getByText('How to Read Stock Prices')).toBeDefined();
  });

  it('renders lesson durations', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('20 min')).toBeDefined();
    expect(getByText('25 min')).toBeDefined();
  });

  it('renders the Continue Learning button (5 of 8 lessons completed in real data)', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Continue Learning')).toBeDefined();
  });

  it('renders the Next Lesson badge on the next incomplete lesson', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Next Lesson')).toBeDefined();
  });

  it('does not navigate on initial render', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Stock Market Basics')).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

describe('CourseDetailScreen — Missing Course', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchLesson.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders course not found for invalid courseId', () => {
    const route = { params: { courseId: 'nonexistent' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Course not found')).toBeDefined();
  });
});

describe('CourseDetailScreen — Lesson Navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchLesson.mockClear();
    mockMarkLessonComplete.mockClear();
    mockAddXp.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates to LessonView when Continue Learning button is pressed', () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    act(() => { fireEvent.press(getByText('Continue Learning')); });
    expect(mockNavigate).toHaveBeenCalledWith('LessonView', {
      lessonId: 'l6',
      courseId: 'c1',
    });
  });
});
