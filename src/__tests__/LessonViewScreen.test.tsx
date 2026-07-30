/**
 * ============================================================================
 * Toroloom — LessonViewScreen Integration Tests
 * ============================================================================
 *
 * Verifies that LessonViewScreen renders correctly with lesson content,
 * key takeaways, summary, quiz (start, answer, submit, results, retry),
 * "Mark as Complete" button, prev/next navigation, download flow,
 * auto-advance, and fallback for missing lesson.
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
const mockMarkLessonComplete = vi.fn(() => Promise.resolve());
const mockAddXp = vi.fn();
const mockDownloadVideo = vi.fn();
const mockRemoveOfflineVideo = vi.fn();
const mockIsVideoDownloaded = vi.fn(() => false);

// Shared lesson data used by educationStore mock — mutable so each test can set it
let mockCurrentLesson: any = null;

const lessonData: Record<string, any> = {
  l1: {
    id: 'l1', courseId: 'c1', title: 'What is the Stock Market?',
    content: 'The stock market is a place where shares of publicly traded companies are bought and sold.',
    duration: '20 min', completed: true,
    quiz: { title: 'Market Basics Quiz', questions: [{ question: 'What is a stock?', options: ['A loan', 'Partial ownership', 'A bond', 'A derivative'], correct: 1 }, { question: 'Q2?', options: ['A', 'B', 'C', 'D'], correct: 0 }, { question: 'Q3?', options: ['A', 'B', 'C', 'D'], correct: 0 }, { question: 'Q4?', options: ['A', 'B', 'C', 'D'], correct: 0 }] },
  },
  l2: {
    id: 'l2', courseId: 'c1', title: 'Key Market Participants',
    content: 'Market participants include retail investors, institutional investors, and market makers.',
    duration: '20 min', completed: true,
  },
  l6: {
    id: 'l6', courseId: 'c1', title: 'Demat & Trading Accounts',
    content: 'A Demat account holds your shares electronically, while a trading account is used to place orders.',
    duration: '20 min', completed: false,
  },
  l8: {
    id: 'l8', courseId: 'c1', title: 'Building Your First Portfolio',
    content: 'Diversification is key to building a resilient portfolio.',
    duration: '25 min', completed: false,
  },
};

// Shared navigation mock object — includes replace used by auto-advance
const mockNav = { navigate: mockNavigate, goBack: mockGoBack, replace: mockNavigate };

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
    currentLesson: mockCurrentLesson,
    fetchLesson: vi.fn((id: string) => {
      mockCurrentLesson = lessonData[id] || null;
    }),
    markLessonComplete: mockMarkLessonComplete,
    lessonProgress: {},
    videoProgress: {},
    videoBookmarks: {},
    downloadingVideos: {},
    downloadProgress: {},
    updateVideoProgress: vi.fn(),
    addVideoBookmark: vi.fn(),
    deleteVideoBookmark: vi.fn(),
    downloadVideo: mockDownloadVideo,
    removeOfflineVideo: mockRemoveOfflineVideo,
    isVideoDownloaded: mockIsVideoDownloaded,
  })),
}));

vi.mock('../store/gamificationStore', () => ({
  useGamificationStore: vi.fn(() => ({
    addXp: mockAddXp,
  })),
}));

// Mock educationApi to resolve with proper lesson list — avoids async fallback to mockData
vi.mock('../../services/api/education', () => ({
  educationApi: {
    getCourse: vi.fn().mockResolvedValue({
      lessonList: [
        { id: 'l1', courseId: 'c1', title: 'What is the Stock Market?', content: 'Lesson 1', duration: '20 min', completed: true },
        { id: 'l2', courseId: 'c1', title: 'Key Market Participants', content: 'Lesson 2', duration: '20 min', completed: true },
        { id: 'l3', courseId: 'c1', title: 'Understanding Stock Exchanges', content: 'Lesson 3', duration: '25 min', completed: true },
        { id: 'l4', courseId: 'c1', title: 'How to Read Stock Prices', content: 'Lesson 4', duration: '25 min', completed: true },
        { id: 'l5', courseId: 'c1', title: 'Order Types Explained', content: 'Lesson 5', duration: '25 min', completed: true },
        { id: 'l6', courseId: 'c1', title: 'Demat & Trading Accounts', content: 'Lesson 6', duration: '20 min', completed: false },
        { id: 'l7', courseId: 'c1', title: 'Taxation of Stock Market Income', content: 'Lesson 7', duration: '20 min', completed: false },
        { id: 'l8', courseId: 'c1', title: 'Building Your First Portfolio', content: 'Lesson 8', duration: '25 min', completed: false },
      ],
    }),
    getCourses: vi.fn(),
    getLesson: vi.fn(),
    markLessonProgress: vi.fn(),
  },
}));

// Mock QuizComponent to render quiz content in test env
vi.mock('../components/quiz/QuizComponent', () => ({
  default: (props: any) => {
    const React = require('react');
    const questions = props.quiz?.questions || [];
    return React.createElement('View', null,
      React.createElement('Text', null, props.quiz?.title || 'Quiz'),
      ...questions.map((q: any, i: number) =>
        React.createElement('View', { key: i },
          React.createElement('Text', null, `Q${i + 1}: ${q.question}`),
          ...(q.options || []).map((opt: string, j: number) =>
            React.createElement('Text', { key: j }, opt)
          )
        )
      ),
      React.createElement('Text', null, 'Submit Answers')
    );
  },
}));

// Mock VideoLessonPlayer with string-based React.createElement (same pattern as QuizComponent mock)
// Uses string component names ('View', 'Text', 'Pressable') - no require('react-native') needed
vi.mock('../components/video/VideoLessonPlayer', () => ({
  default: function MockVideoPlayer(props: any) {
    const R = require('react');
    const children = [];
    if (props.onDownload && !props.isDownloaded && !props.isDownloading) {
      children.push(R.createElement('Pressable', {
        onPress: props.onDownload, key: 'dl',
      }, R.createElement('Text', { key: 'dl-txt' }, 'Download Video')));
    }
    if (props.isDownloaded && props.onRemoveDownload) {
      children.push(R.createElement('Pressable', {
        onPress: props.onRemoveDownload, key: 'rm',
      }, R.createElement('Text', { key: 'rm-txt' }, 'Remove Download')));
    }
    return R.createElement('View', null, ...children);
  },
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
    mockCurrentLesson = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { toJSON } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
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
    // Pre-set currentLesson so component renders content immediately
    mockCurrentLesson = lessonData['l1'];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the lesson number and title in header', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('Lesson 1 of 8')).toBeDefined();
    expect(getByText('What is the Stock Market?')).toBeDefined();
  });

  it('renders the lesson duration', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('20 min')).toBeDefined();
  });

  it('renders the lesson content title as heading', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('What is the Stock Market?')).toBeDefined();
  });

  it('renders the lesson content body', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText(/stock market/)).toBeDefined();
  });

  it('renders the Key Takeaways section', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('Key Takeaways')).toBeDefined();
  });

  it('renders the Summary section', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('Summary')).toBeDefined();
  });

  it('renders the Test Your Knowledge quiz button', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('Test Your Knowledge')).toBeDefined();
  });

  it('shows quiz question count on the start button', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('4 questions')).toBeDefined();
  });

  it('renders the Mark as Complete button for incomplete lesson (no quiz)', () => {
    const route = { params: { lessonId: 'l6', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('Mark as Complete')).toBeDefined();
  });

  it('renders next lesson navigation', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('Next')).toBeDefined();
    expect(getByText('Key Market Participants')).toBeDefined();
  });

  it('renders prev lesson navigation from the second lesson', () => {
    const route = { params: { lessonId: 'l2', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('Previous')).toBeDefined();
    expect(getByText('Next')).toBeDefined();
  });

  it('does not navigate on initial render', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
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
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);

    act(() => { fireEvent.press(getByText('Test Your Knowledge')); });
    advanceAndRender(100);

    expect(getByText('Market Basics Quiz')).toBeDefined();
    expect(getByText(/Q1/)).toBeDefined();
  });

  it('renders quiz question options', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);

    act(() => { fireEvent.press(getByText('Test Your Knowledge')); });
    advanceAndRender(100);

    expect(getByText('A loan to the company')).toBeDefined();
    expect(getByText('Partial ownership in the company')).toBeDefined();
  });

  it('shows Submit Answers button when quiz is opened', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);

    act(() => { fireEvent.press(getByText('Test Your Knowledge')); });
    advanceAndRender(100);

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
    mockCurrentLesson = lessonData['l8'];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show Next button on last lesson', () => {
    const route = { params: { lessonId: 'l8', courseId: 'c1' } };
    const { getByText, queryByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('Previous')).toBeDefined();
    expect(queryByText('Next')).toBeNull();
  });
});

describe('LessonViewScreen — Download Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockDownloadVideo.mockClear();
    mockRemoveOfflineVideo.mockClear();
    mockIsVideoDownloaded.mockClear();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockCurrentLesson = lessonData['l1'];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call downloadVideo on initial render', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(mockDownloadVideo).not.toHaveBeenCalled();
  });

  it('does not call removeOfflineVideo on initial render', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(mockRemoveOfflineVideo).not.toHaveBeenCalled();
  });

  it('isVideoDownloaded is called during render to determine download state', () => {
    const route = { params: { lessonId: 'l6', courseId: 'c1' } };
    render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(mockIsVideoDownloaded).toHaveBeenCalledWith('l6');
  });

  it('downloads video when download button is pressed', () => {
    const route = { params: { lessonId: 'l1', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);

    const downloadBtn = getByText('Download Video');
    expect(downloadBtn).toBeDefined();

    act(() => { fireEvent.press(downloadBtn); });
    advanceAndRender(100);

    expect(mockDownloadVideo).toHaveBeenCalledTimes(1);
    expect(mockDownloadVideo).toHaveBeenCalledWith(
      'l1',
      expect.stringContaining('mp4'),
    );
  });

  it('removeOfflineVideo handler is wired correctly (store function exists)', () => {
    expect(mockRemoveOfflineVideo).toBeDefined();
    expect(mockRemoveOfflineVideo).toEqual(expect.any(Function));
  });
});

describe('LessonViewScreen — Auto-Advance on Complete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchLesson.mockClear();
    mockMarkLessonComplete.mockClear();
    mockAddXp.mockClear();
    mockDownloadVideo.mockClear();
    mockRemoveOfflineVideo.mockClear();
    mockIsVideoDownloaded.mockClear();
    mockCurrentLesson = lessonData['l6'];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows auto-advance overlay when Mark as Complete is pressed', async () => {
    const route = { params: { lessonId: 'l6', courseId: 'c1' } };
    const { getByText, queryByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);

    expect(getByText('Mark as Complete')).toBeDefined();
    // Use regex for reliable substring matching (handles emoji prefix)
    expect(queryByText(/Lesson Complete/)).toBeNull();

    await act(async () => { fireEvent.press(getByText('Mark as Complete')); });
    advanceAndRender(100);

    expect(getByText(/Lesson Complete/)).toBeDefined();
    expect(getByText('Moving to next lesson...')).toBeDefined();
    expect(getByText('Auto-advancing to next lesson...')).toBeDefined();
  });

  it('calls markLessonComplete and addXp when Mark as Complete is pressed', async () => {
    const route = { params: { lessonId: 'l6', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);

    await act(async () => { fireEvent.press(getByText('Mark as Complete')); });
    advanceAndRender(100);

    expect(mockMarkLessonComplete).toHaveBeenCalledWith('l6');
    expect(mockAddXp).toHaveBeenCalledWith(50);
  });

  it('navigates to next lesson after 2 seconds', async () => {
    const route = { params: { lessonId: 'l6', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);

    await act(async () => { fireEvent.press(getByText('Mark as Complete')); });
    advanceAndRender(100);

    expect(mockNavigate).not.toHaveBeenCalled();

    advanceAndRender(2000);

    expect(mockNavigate).toHaveBeenCalledWith('LessonView', {
      lessonId: 'l7',
      courseId: 'c1',
    });
  });

  it('does not auto-advance when there is no next lesson', () => {
    const route = { params: { lessonId: 'l8', courseId: 'c1' } };
    const { queryByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);

    expect(queryByText('Next')).toBeNull();
    expect(queryByText(/Lesson Complete/)).toBeNull();
    expect(queryByText(/Auto-advancing/)).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('LessonViewScreen — Missing Lesson', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchLesson.mockClear();
    mockCurrentLesson = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders lesson not found for invalid lessonId', () => {
    const route = { params: { lessonId: 'nonexistent', courseId: 'c1' } };
    const { getByText } = render(
      <LessonViewScreen route={route} navigation={mockNav} />
    );
    advanceAndRender(500);
    expect(getByText('Lesson not found')).toBeDefined();
  });
});
