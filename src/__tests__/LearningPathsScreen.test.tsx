
// ==================== Mock useT hook ====================
const education = {
  "myCourses": "My Courses",
  "createManageSubtitle": "Create and manage your own courses",
  "total": "Total",
  "published": "Published",
  "drafts": "Drafts",
  "students": "Students",
  "createNewCourse": "Create New Course",
  "noCoursesYet": "No courses yet",
  "noCoursesSubtitle": "Tap \"Create New Course\" to start building your first course!",
  "submitForReview": "Submit for Review",
  "cannotSubmit": "Cannot Submit",
  "cannotSubmitMsg": "Please add a title and at least one lesson before submitting for review.",
  "archiveCourse": "Archive Course",
  "restoreCourse": "Restore Course",
  "duplicate": "Duplicate",
  "deleteCourse": "Delete Course",
  "deleteCourseConfirm": "Are you sure you want to delete \"{{title}}\"? This action cannot be undone.",
  "untitledCourse": "Untitled Course",
  "noDescription": "No description yet",
  "pending": "Pending",
  "reviewStatus": "Review Status",
  "pendingReview": "🟡 Pending Review",
  "approved": "Approved",
  "rejected": "Rejected",
  "needsChanges": "❌ Rejected — Needs Changes",
  "submitted": "Submitted",
  "courseOptions": "Course Options",
  "communityCourses": "Community Courses",
  "communitySubtitle": "Discover courses created by fellow traders",
  "searchCoursesCreators": "Search courses, creators, or topics...",
  "featuredCourses": "Featured Courses",
  "title": "Courses",
  "allCommunityCourses": "All Community Courses",
  "filteredResults": "Filtered ({{count}})",
  "noCoursesFound": "No courses found",
  "noCoursesMatch": "No courses match \"{{query}}\". Try a different search term.",
  "noCommunityCourses": "No published community courses yet. Check back later!",
  "enroll": "Enroll",
  "byCreator": "by {{name}}",
  "enrolled": "Enrolled",
  "lessonsCount": "{{count}} lessons",
  "courseNotFound": "Course not found",
  "courseProgress": "Course Progress",
  "completed": "Completed",
  "remainingCount": "Remaining",
  "aboutThisCourse": "About this Course",
  "duration": "Duration",
  "lessonsProgress": "Lessons ({{completed}}/{{total}})",
  "lessonDone": "Done",
  "lessonQuiz": "Quiz",
  "nextLesson": "Next Lesson",
  "startCourse": "Start Course",
  "continueLearning": "Continue",
  "viewCertificate": "View Certificate",
  "getCertificate": "🎓 Get Certificate",
  "rating": "rating",
  "learningPaths": "Learning Paths",
  "learningPathsSubtitle": "Curated sequences to master the markets",
  "paths": "Paths",
  "learners": "Learners",
  "lessonsLabel": "Lessons",
  "coursesProgress": "{{completed}}/{{total}} courses · {{percent}}% complete",
  "continuePath": "Continue Path →",
  "startPath": "Start Path →",
  "sortCategory": "Category",
  "allLevels": "All Levels",
  "beginner": "Beginner",
  "intermediate": "Intermediate",
  "advanced": "Advanced"
};

function resolveT(key: string, params?: Record<string, any>): string {
  const parts = key.split('.');
  const rootNs = parts[0];
  const subKey = parts.slice(1).join('.');
  
  const translations: Record<string, any> = { education };
  const obj = translations[rootNs];
  if (!obj) {
    const parts2 = key.split('.');
    const lastSeg = parts2[parts2.length - 1] || key;
    return lastSeg
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s: string) => s.toUpperCase())
      .trim();
  }
  
  // Check for plural variant FIRST when count !== 1
  if (params && params.count !== undefined && params.count !== 1) {
    const pluralKey = subKey + '_plural';
    if (pluralKey in obj && typeof obj[pluralKey] === 'string') {
      let result: string = obj[pluralKey];
      result = result.replace(/\{\{(\w+)\}\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
      return result;
    }
  }
  
  // Fall back to singular
  if (subKey in obj && typeof obj[subKey] === 'string') {
    let result: string = obj[subKey];
    if (params) {
      result = result.replace(/\{\{(\w+)\}\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
    }
    return result;
  }
  
  // Fallback: return last key segment as readable text
  const lastSeg = subKey || key;
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

// ==================== Mock mockData for dynamic import ====================
const mockPaths = vi.hoisted(() => [
  {
    id: 'path_beginner', title: 'Investing Fundamentals',
    description: 'Learn the core principles of investing in the stock market.',
    icon: '🌱', level: 'beginner', totalDuration: '17 hours', totalLessons: 24,
    enrolledCount: 25000,
    targetAudience: 'Complete beginners to the stock market',
    skillsGained: ['Stock Market Basics', 'Financial Literacy', 'Reading Charts', 'Market Psychology'],
    courseIds: ['c1', 'c2'],
    gradient: ['#00E676', '#00B248'] as [string, string],
  },
  {
    id: 'path_intermediate', title: 'Technical & Fundamental Trader',
    description: 'Master technical analysis and fundamental analysis.',
    icon: '📊', level: 'intermediate', totalDuration: '32 hours', totalLessons: 45,
    enrolledCount: 18000,
    targetAudience: 'Level up with professional trading skills',
    skillsGained: ['Technical Analysis', 'Fundamental Analysis', 'Risk Management', 'Trading Psychology'],
    courseIds: ['c3', 'c4'],
    gradient: ['#6C63FF', '#4834D4'] as [string, string],
  },
  {
    id: 'path_advanced', title: 'Options & Portfolio Pro',
    description: 'Go pro with advanced options strategies and portfolio optimization.',
    icon: '🎯', level: 'advanced', totalDuration: '40 hours', totalLessons: 55,
    enrolledCount: 12000,
    targetAudience: 'Go pro with advanced portfolio management',
    skillsGained: ['Options Strategies', 'Portfolio Optimization', 'Advanced Technicals', 'Risk Arbitrage'],
    courseIds: ['c5', 'c6'],
    gradient: ['#FF5252', '#D50000'] as [string, string],
  },
]);

vi.mock('../constants/mockData', () => ({ mockLearningPaths: mockPaths }));

import React, { act } from 'react';
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
    fetchCourses: vi.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────
/** Flush pending microtasks and React state updates so dynamic import resolves. */
async function flushMicrotasks() {
  await act(async () => {
    await new Promise(resolve => setImmediate(resolve));
  });
}

// ── Tests ─────────────────────────────────────────────────────

describe('LearningPathsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the screen title', async () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />);
    await flushMicrotasks();
    expect(getByText('Learning Paths')).toBeTruthy();
  });

  it('renders all 3 learning path cards', async () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />);
    await flushMicrotasks();
    expect(getByText('Investing Fundamentals')).toBeTruthy();
    expect(getByText('Technical & Fundamental Trader')).toBeTruthy();
    expect(getByText('Options & Portfolio Pro')).toBeTruthy();
  });

  it('shows summary stats in banner', async () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />);
    await flushMicrotasks();
    expect(getByText('Paths')).toBeTruthy();
    expect(getByText('Courses')).toBeTruthy();
    expect(getByText('Lessons')).toBeTruthy();
    expect(getByText('Learners')).toBeTruthy();
  });

  it('shows skill chips for each path', async () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />);
    await flushMicrotasks();
    expect(getByText('Stock Market Basics')).toBeTruthy();
    expect(getByText('Technical Analysis')).toBeTruthy();
    expect(getByText('Options Strategies')).toBeTruthy();
  });

  it('shows duration and lesson counts from mock data', async () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />);
    await flushMicrotasks();
    mockLearningPaths.forEach(path => {
      expect(getByText(path.totalDuration)).toBeTruthy();
      expect(getByText(`${path.totalLessons} lessons`)).toBeTruthy();
    });
  });

  it('shows target audience for paths', async () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />);
    await flushMicrotasks();
    expect(getByText(/Complete beginners/i)).toBeTruthy();
    expect(getByText(/Level up with professional/i)).toBeTruthy();
    expect(getByText(/Go pro with advanced/i)).toBeTruthy();
  });

  it('displays start CTA text', async () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />);
    await flushMicrotasks();
    expect(getByText('Start Path →')).toBeTruthy();
  });

  it('shows grammar-friendly level labels', async () => {
    const { getAllByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />);
    await flushMicrotasks();
    expect(getAllByText('Beginner').length).toBeGreaterThan(0);
    expect(getAllByText('Intermediate').length).toBeGreaterThan(0);
    expect(getAllByText('Advanced').length).toBeGreaterThan(0);
  });

  it('navigates to detail view when a path card is pressed', async () => {
    const { getByText } = render(<LearningPathsScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />);
    await flushMicrotasks();
    fireEvent.press(getByText('Investing Fundamentals'));
    expect(mockNavigate).toHaveBeenCalledWith('LearningPathDetail', { pathId: 'path_beginner' });
  });
});
