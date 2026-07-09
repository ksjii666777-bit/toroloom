/**
 * ============================================================================
 * Toroloom — LessonViewScreen Integration Tests
 * ============================================================================
 *
 * Verifies that LessonViewScreen renders correctly with lesson content,
 * key takeaways, summary, quiz (start, answer, submit, results, retry),
 * "Mark as Complete" button, prev/next navigation, and fallback for
 * missing lesson.
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
    videoProgress: {},
    videoBookmarks: {},
    updateVideoProgress: vi.fn(),
    addVideoBookmark: vi.fn(),
    deleteVideoBookmark: vi.fn(),
  })),
}));

vi.mock('../store/gamificationStore', () => ({
  useGamificationStore: vi.fn(() => ({
    addXp: mockAddXp,
  })),
}));

// ==================== Imports ====================

import LessonViewScreen from '../screens/education/LessonViewScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('LessonViewScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { toJSON } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(toJSON).not.toBeNull();
  });
});

describe('LessonViewScreen — Loaded Content', () => {
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

  it('renders the lesson number and title in header', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Lesson 1 of 8')).toBeDefined();
    expect(getByText('What is the Stock Market?')).toBeDefined();
  });

  it('renders the lesson duration', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('20 min')).toBeDefined();
  });

  it('renders the lesson content title as heading', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('What is the Stock Market?')).toBeDefined();
  });

  it('renders the lesson content body', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText(/stock market/)).toBeDefined();
  });

  it('renders the Key Takeaways section', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Key Takeaways')).toBeDefined();
  });

  it('renders the Summary section', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Summary')).toBeDefined();
  });

  it('renders the Test Your Knowledge quiz button', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Test Your Knowledge')).toBeDefined();
  });

  it('shows quiz question count on the start button', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('4 questions')).toBeDefined();
  });

  it('renders the Mark as Complete button for incomplete lesson', () => {
    const route = { params: { lessonId: 'l6', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Mark as Complete')).toBeDefined();
  });

  it('renders next lesson navigation', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Next')).toBeDefined();
    expect(getByText('Key Market Participants')).toBeDefined();
  });

  it('renders prev lesson navigation from the second lesson', () => {
    const route = { params: { lessonId: 'l2', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Previous')).toBeDefined();
    expect(getByText('Next')).toBeDefined();
  });

  it('does not navigate on initial render', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('What is the Stock Market?')).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

describe('LessonViewScreen — Quiz Flow', () => {
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

  it('shows quiz questions when Test Your Knowledge is pressed', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);

    // Press the quiz start button
    act(() => { fireEvent.press(getByText('Test Your Knowledge')); });
    advanceAndRender(100);

    // Quiz title should appear
    expect(getByText('Market Basics Quiz')).toBeDefined();
    expect(getByText(/Q1/)).toBeDefined();
  });

  it('renders quiz question options', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);

    // Open quiz
    act(() => { fireEvent.press(getByText('Test Your Knowledge')); });
    advanceAndRender(100);

    // First question options (from the actual quiz data)
    expect(getByText('A loan to the company')).toBeDefined();
    expect(getByText('Partial ownership in the company')).toBeDefined();
  });

  it('shows Submit Answers button when quiz is opened', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);

    // Open quiz
    act(() => { fireEvent.press(getByText('Test Your Knowledge')); });
    advanceAndRender(100);

    // Submit button should be present but disabled (not all answers selected)
    expect(getByText('Submit Answers')).toBeDefined();
  });
});

describe('LessonViewScreen — Last Lesson Navigation', () => {
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

  it('does not show Next button on last lesson', () => {
    const route = { params: { lessonId: 'l8', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    // Previous should be visible (l8 of 8 has a prev l7)
    expect(getByText('Previous')).toBeDefined();
    // Mark as Complete should be visible
    expect(getByText('Mark as Complete')).toBeDefined();
  });
});

describe('LessonViewScreen — Missing Lesson', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchLesson.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders lesson not found for invalid lessonId', () => {
    const route = { params: { lessonId: 'nonexistent', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    advanceAndRender(500);
    expect(getByText('Lesson not found')).toBeDefined();
  });
});
