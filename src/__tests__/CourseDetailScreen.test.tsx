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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockFetchLesson = vi.fn();
const mockMarkLessonComplete = vi.fn();
const mockAddXp = vi.fn();

// Shared course data used by both mockData and educationStore mocks
// vi.hoisted ensures this runs before vi.mock() factories
const mockCourseForTest = vi.hoisted(() => ({
  id: 'c1',
  title: 'Stock Market Basics',
  description: 'Everything you need to know to start investing in the stock market.',
  thumbnail: '📈',
  duration: '5 hours',
  lessons: 8,
  progress: 75,
  level: 'beginner',
  category: 'Fundamentals',
  rating: 4.8,
  enrolledCount: 24500,
}));

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
    courses: [],
    currentLesson: null,
    fetchCourses: vi.fn(),
    fetchLesson: mockFetchLesson,
    markLessonComplete: mockMarkLessonComplete,
    lessonProgress: {},
    certificates: [],
  })),
}));

vi.mock('../store/gamificationStore', () => ({
  useGamificationStore: vi.fn(() => ({
    addXp: mockAddXp,
  })),
}));

// ==================== Mock educationApi ====================
// setup.ts mocks '../services/api/education' with getCourse REJECTING, which would
// force the screen down the fallback dynamic import('../../constants/mockData')
// path — that dynamic import resolves via a macrotask and hangs under vitest.
// Override locally (same pattern as LessonViewScreen.test.tsx) so getCourse
// RESOLVES with the lesson list, letting the screen use its primary .then() path.
vi.mock('../services/api/education', () => {
  const lessonList = [
    {
      id: 'l1', courseId: 'c1', title: 'What is the Stock Market?',
      content: 'Lesson 1 content', duration: '20 min', completed: true,
    },
    {
      id: 'l2', courseId: 'c1', title: 'Key Market Participants',
      content: 'Lesson 2 content', duration: '20 min', completed: true,
    },
    {
      id: 'l3', courseId: 'c1', title: 'Understanding Stock Exchanges',
      content: 'Lesson 3 content', duration: '25 min', completed: true,
    },
    {
      id: 'l4', courseId: 'c1', title: 'How to Read Stock Prices',
      content: 'Lesson 4 content', duration: '25 min', completed: true,
    },
    {
      id: 'l5', courseId: 'c1', title: 'Order Types Explained',
      content: 'Lesson 5 content', duration: '25 min', completed: true,
    },
    {
      id: 'l6', courseId: 'c1', title: 'Demat & Trading Accounts',
      content: 'Lesson 6 content', duration: '20 min', completed: false,
    },
    {
      id: 'l7', courseId: 'c1', title: 'Taxation of Stock Market Income',
      content: 'Lesson 7 content', duration: '20 min', completed: false,
    },
    {
      id: 'l8', courseId: 'c1', title: 'Building Your First Portfolio',
      content: 'Lesson 8 content', duration: '25 min', completed: false,
    },
  ];
  return {
    educationApi: {
      getCourses: vi.fn(),
      getCourse: vi.fn().mockResolvedValue({ lessonList }),
      getLesson: vi.fn(),
      markLessonProgress: vi.fn(),
    },
  };
});

// Now add courses to the educationStore mock using the shared course data
vi.mocked(useEducationStore).mockImplementation(() => ({
  courses: [mockCourseForTest],
  currentLesson: null,
  fetchCourses: vi.fn(),
  fetchLesson: mockFetchLesson,
  markLessonComplete: mockMarkLessonComplete,
  lessonProgress: {},
  certificates: [],
}));

// ==================== Imports ====================

import CourseDetailScreen from '../screens/education/CourseDetailScreen';
// Imported AFTER vi.mock hoisting so it resolves to the mocked vi.fn() used by
// vi.mocked(useEducationStore).mockImplementation(...) below
import { useEducationStore } from '../store/educationStore';

// ==================== Mock useT hook ====================
const education: Record<string, string> = {
    'aboutThisCourse': 'About this Course',
    'completed': 'Completed',
    'continueLearning': 'Continue Learning',
    'courseNotFound': 'Course not found',
    'courseProgress': 'Course Progress',
    'duration': 'Duration',
    'enrolled': 'enrolled',
    'getCertificate': '🎓 Get Certificate',
    'lessonDone': 'Done',
    'lessonQuiz': 'Quiz',
    'lessonsProgress': 'Lessons ({{completed}}/{{total}})',
    'nextLesson': 'Next Lesson',
    'rating': 'rating',
    'remainingCount': 'Remaining',
    'startCourse': 'Start Course',
    'viewCertificate': 'View Certificate',
};

const translations: Record<string, any> = {
  education,
};


function resolveT(key: string, params?: Record<string, any>): string {
  const parts = key.split('.');
  const rootNs = parts[0];
  const subKey = parts.slice(1).join('.');

  const obj = translations[rootNs];
  if (!obj) {
    const parts2 = key.split('.');
    const lastSeg = parts2[parts2.length - 1] || key;
    return lastSeg
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s: string) => s.toUpperCase())
      .trim();
  }

  if (params && params.count !== undefined && params.count !== 1) {
    const pluralKey = subKey + '_plural';
    if (pluralKey in obj && typeof obj[pluralKey] === 'string') {
      let result: string = obj[pluralKey];
      result = result.replace(/\{\{(\w+)\}\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
      return result;
    }
  }

  if (subKey in obj && typeof obj[subKey] === 'string') {
    let result: string = obj[subKey];
    if (params) {
      result = result.replace(/\{\{(\w+)\}\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
    }
    return result;
  }

  const lastSeg = parts[parts.length - 1] || key;
  return lastSeg
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s: string) => s.toUpperCase())
    .trim();
}


vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
  default: () => ({
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));



// ==================== Helpers ====================

// The screen populates courseLessons from educationApi.getCourse(courseId) which is
// locally mocked to RESOLVE with the lesson list (primary .then() path — no dynamic
// import). Since getCourse resolves via a pure microtask, a plain await act() chain
// flushes the promise + React state updates — no setImmediate (macrotask) needed.
// NOTE: CourseDetailScreen schedules NO timers, so tests deliberately do NOT use
// vi.useFakeTimers().
async function flushMicrotasks() {
  await act(async () => {});
  await act(async () => {});
}

// ==================== Tests ====================

describe('CourseDetailScreen — Loading State', () => {
  it('renders without crashing during loading', async () => {
    const route = { params: { courseId: 'c1' } };
    const { toJSON, unmount } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(toJSON).not.toBeNull();
    // Let the getCourse → import → setCourseLessons chain settle and unmount so no
    // pending async work leaks into the next test.
    await flushMicrotasks();
    unmount();
  });
});

describe('CourseDetailScreen — Loaded Content', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchLesson.mockClear();
    mockMarkLessonComplete.mockClear();
    mockAddXp.mockClear();
  });

  it('renders the course title from mock data', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('Stock Market Basics')).toBeDefined();
  });

  it('renders the course description in the hero', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText(/investing in the stock market/)).toBeDefined();
  });

  it('renders the level badge', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('beginner')).toBeDefined();
  });

  it('renders the category badge', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('Fundamentals')).toBeDefined();
  });

  it('renders Course Progress section', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('Course Progress')).toBeDefined();
  });

  it('renders progress stats (Completed, Remaining, Duration)', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('Completed')).toBeDefined();
    expect(getByText('Remaining')).toBeDefined();
    expect(getByText('Duration')).toBeDefined();
  });

  it('renders About this Course section', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('About this Course')).toBeDefined();
  });

  it('renders the enrolled count stat', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText(/enrolled/)).toBeDefined();
  });

  it('renders the rating stat', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText(/rating/)).toBeDefined();
  });

  it('renders the Lessons section title with count', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText(/Lessons/)).toBeDefined();
  });

  it('renders individual lesson titles from mock data', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('What is the Stock Market?')).toBeDefined();
    expect(getByText('Key Market Participants')).toBeDefined();
    expect(getByText('How to Read Stock Prices')).toBeDefined();
  });

  it('renders lesson durations', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('20 min')).toBeDefined();
    expect(getByText('25 min')).toBeDefined();
  });

  it('renders the Continue Learning button (5 of 8 lessons completed in real data)', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('Continue Learning')).toBeDefined();
  });

  it('renders the Next Lesson badge on the next incomplete lesson', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('Next Lesson')).toBeDefined();
  });

  it('does not navigate on initial render', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('Stock Market Basics')).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

describe('CourseDetailScreen — Missing Course', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchLesson.mockClear();
  });

  it('renders course not found for invalid courseId', async () => {
    const route = { params: { courseId: 'nonexistent' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    expect(getByText('Course not found')).toBeDefined();
  });
});

describe('CourseDetailScreen — Lesson Navigation', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchLesson.mockClear();
    mockMarkLessonComplete.mockClear();
    mockAddXp.mockClear();
  });

  it('navigates to LessonView when Continue Learning button is pressed', async () => {
    const route = { params: { courseId: 'c1' } };
    const { getByText } = render(
      <CourseDetailScreen route={route as any} navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    await flushMicrotasks();
    act(() => { fireEvent.press(getByText('Continue Learning')); });
    expect(mockNavigate).toHaveBeenCalledWith('LessonView', {
      lessonId: 'l6',
      courseId: 'c1',
    });
  });
});
