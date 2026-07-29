/**
 * ============================================================================
 * Toroloom — MyCoursesScreen Integration Tests
 * ============================================================================
 *
 * Covers: header, stats, empty state, filter chips, course listing,
 * status badges, review status section, and course creation.
 */


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

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockCreateDraft = vi.fn();
const mockLoadFromCache = vi.fn();

// Mutable store data — var for hoisting (declared before vi.mock for closure access)
let mockCoursesList: any[] = [];
let mockStatsResult = { totalCourses: 0, publishedCourses: 0, draftCourses: 0, totalEnrollments: 0, totalLessons: 0, averageRating: 0, totalEarnings: 0 };

// ==================== vi.mock Factories ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: function() {
    return {
      colors: {
        primary: '#6C63FF', primaryLight: '#8B83FF', primaryDark: '#4A42CC',
        primaryGradient: ['#6C63FF', '#4834D4'],
        secondary: '#FF6B6B', success: '#00C853', danger: '#FF1744', warning: '#FFC107',
        accent: '#FF6B9D', marketUp: '#00C853', marketDown: '#FF1744', marketNeutral: '#FFC107',
        text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
        white: '#FFFFFF', bg: '#0D0D2B', bgSecondary: '#1A1A3E', bgCard: '#222255',
        bgCardLight: '#2A2A5E', bgInput: '#1E1E4A', bgDark: '#070720',
        bgOverlay: 'rgba(0,0,0,0.5)', border: '#2A2A5E', borderLight: '#3A3A7E',
        divider: '#1E1E4A', transparent: 'transparent',
        background: '#0D0D2B', card: '#222255', notification: '#FF6B6B',
      },
      isDark: true,
    };
  },
}));

vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimView', Text: 'AnimText', createAnimatedComponent: function(c: any) { return c; } },
  useSharedValue: function() { return { value: 0 }; },
  useAnimatedStyle: function() { return {}; },
  withSpring: function(v: any) { return v; },
  withTiming: function(v: any) { return v; },
  interpolate: function() { return 0; },
  FadeInDown: { delay: function() { return { springify: function() { return {}; } }; } },
  Layout: { springify: function() { return {}; } },
  View: 'AnimView',
  Text: 'AnimText',
  createAnimatedComponent: function(c: any) { return c; },
}));

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: function() { return { navigate: mockNavigate, goBack: mockGoBack }; },
  useFocusEffect: function(cb: () => void) { React.useEffect(function() { cb(); }, [cb]); },
}));

// User course store mock — with getState() for useFocusEffect
vi.mock('../store/userCourseStore', () => {
  const fn = vi.fn(function(selector) {
    const state = {
      myCourses: mockCoursesList,
      editingCourse: null,
      loading: false,
      saving: false,
      enrolledCommunityCourseIds: [],
      deleteCourse: vi.fn(),
      duplicateCourse: vi.fn(),
      submitForReview: vi.fn(),
      archiveCourse: vi.fn(),
      unarchiveCourse: vi.fn(),
      setEditingCourse: vi.fn(),
      getStats: function() { return mockStatsResult; },
      createDraft: mockCreateDraft,
      loadFromCache: mockLoadFromCache,
    };
    return selector ? selector(state) : state;
  });
  (fn as any).getState = function() {
    return { loadFromCache: mockLoadFromCache, createDraft: mockCreateDraft };
  };
  return { useUserCourseStore: fn };
});

// ==================== Import ====================

import MyCoursesScreen from '../screens/education/MyCoursesScreen';

// ==================== Tests ====================

describe('MyCoursesScreen — Initial State', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    mockCoursesList = [];
    mockStatsResult = { totalCourses: 0, publishedCourses: 0, draftCourses: 0, totalEnrollments: 0, totalLessons: 0, averageRating: 0, totalEarnings: 0 };
    mockCreateDraft.mockReset();
    mockLoadFromCache.mockReset();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('renders without crashing', function() {
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.toJSON()).not.toBeNull();
  });

  it('renders the screen title', function() {
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('My Courses')).toBeDefined();
  });

  it('renders subtitle', function() {
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/Create and manage your own courses/)).toBeDefined();
  });

  it('renders stats bar with zeroes', function() {
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Total')).toBeDefined();
    expect(result.getByText('Published')).toBeDefined();
    expect(result.getByText('Drafts')).toBeDefined();
    expect(result.getByText('Students')).toBeDefined();
  });

  it('renders Create New Course button', function() {
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Create New Course')).toBeDefined();
  });

  it('renders filter chips', function() {
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('All')).toBeDefined();
    expect(result.getByText('Published')).toBeDefined();
    expect(result.getByText('Draft')).toBeDefined();
    expect(result.getByText('Archived')).toBeDefined();
  });

  it('renders empty state when no courses exist', function() {
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('No courses yet')).toBeDefined();
  });

  it('calls loadFromCache on focus', function() {
    render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(mockLoadFromCache).toHaveBeenCalled();
  });
});

describe('MyCoursesScreen — With Courses', function() {
  const mockPublished = {
    id: 'uc_10', title: 'Options Strategies', description: 'Learn options strategies.',
    thumbnail: '🎯', duration: '3 hours', lessonsCount: 6,
    level: 'intermediate', category: 'Options',
    creatorId: 'me', creatorName: 'You', publishStatus: 'published',
    submittedForReview: false, isFeatured: true, lessons: [],
    enrolledCount: 234, rating: 4.8,
    createdAt: '2026-01-10T00:00:00.000Z', updatedAt: '2026-02-15T00:00:00.000Z',
    publishedAt: '2026-01-15T00:00:00.000Z', tags: ['options'],
  };

  const mockDraft = {
    id: 'uc_11', title: 'My New Course', description: 'A course I am working on.',
    thumbnail: '📚', duration: '1 hour', lessonsCount: 2,
    level: 'beginner', category: 'Finance',
    creatorId: 'me', creatorName: 'You', publishStatus: 'draft',
    submittedForReview: false, isFeatured: false, lessons: [],
    enrolledCount: 0, rating: 0,
    createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-10T00:00:00.000Z',
    tags: [],
  };

  beforeEach(function() {
    vi.useFakeTimers();
    mockCoursesList = [mockPublished, mockDraft];
    mockStatsResult = { totalCourses: 2, publishedCourses: 1, draftCourses: 1, totalEnrollments: 234, totalLessons: 8, averageRating: 4.8, totalEarnings: 0 };
    mockCreateDraft.mockReset();
    mockLoadFromCache.mockReset();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('renders course card titles', function() {
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Options Strategies')).toBeDefined();
    expect(result.getByText('My New Course')).toBeDefined();
  });

  it('renders status badges', function() {
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Published')).toBeDefined();
    expect(result.getByText('Draft')).toBeDefined();
  });

  it('renders lesson counts on cards', function() {
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('6 lessons')).toBeDefined();
    expect(result.getByText('2 lessons')).toBeDefined();
  });

  it('creates a draft when Create New Course is pressed', function() {
    const draftCourse = { ...mockDraft, id: 'uc_new' };
    mockCreateDraft.mockReturnValue(draftCourse);
    const result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Create New Course')); });
    expect(mockCreateDraft).toHaveBeenCalled();
  });
});
