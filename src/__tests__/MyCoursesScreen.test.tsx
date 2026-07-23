/**
 * ============================================================================
 * Toroloom — MyCoursesScreen Integration Tests
 * ============================================================================
 *
 * Covers: header, stats, empty state, filter chips, course listing,
 * status badges, review status section, and course creation.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockCreateDraft = vi.fn();
const mockLoadFromCache = vi.fn();

// Mutable store data — var for hoisting (declared before vi.mock for closure access)
var mockCoursesList: any[] = [];
var mockStatsResult = { totalCourses: 0, publishedCourses: 0, draftCourses: 0, totalEnrollments: 0, totalLessons: 0, averageRating: 0, totalEarnings: 0 };

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
  useFocusEffect: function(cb: () => void) { React.useEffect(function() { cb(); }, []); },
}));

// User course store mock — with getState() for useFocusEffect
vi.mock('../store/userCourseStore', () => {
  var fn = vi.fn(function(selector) {
    var state = {
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
    var result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.toJSON()).not.toBeNull();
  });

  it('renders the screen title', function() {
    var result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('My Courses')).toBeDefined();
  });

  it('renders subtitle', function() {
    var result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/Create and manage your own courses/)).toBeDefined();
  });

  it('renders stats bar with zeroes', function() {
    var result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Total')).toBeDefined();
    expect(result.getByText('Published')).toBeDefined();
    expect(result.getByText('Drafts')).toBeDefined();
    expect(result.getByText('Students')).toBeDefined();
  });

  it('renders Create New Course button', function() {
    var result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Create New Course')).toBeDefined();
  });

  it('renders filter chips', function() {
    var result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('All')).toBeDefined();
    expect(result.getByText('Published')).toBeDefined();
    expect(result.getByText('Draft')).toBeDefined();
    expect(result.getByText('Archived')).toBeDefined();
  });

  it('renders empty state when no courses exist', function() {
    var result = render(
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
  var mockPublished = {
    id: 'uc_10', title: 'Options Strategies', description: 'Learn options strategies.',
    thumbnail: '🎯', duration: '3 hours', lessonsCount: 6,
    level: 'intermediate', category: 'Options',
    creatorId: 'me', creatorName: 'You', publishStatus: 'published',
    submittedForReview: false, isFeatured: true, lessons: [],
    enrolledCount: 234, rating: 4.8,
    createdAt: '2026-01-10T00:00:00.000Z', updatedAt: '2026-02-15T00:00:00.000Z',
    publishedAt: '2026-01-15T00:00:00.000Z', tags: ['options'],
  };

  var mockDraft = {
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
    var result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Options Strategies')).toBeDefined();
    expect(result.getByText('My New Course')).toBeDefined();
  });

  it('renders status badges', function() {
    var result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Published')).toBeDefined();
    expect(result.getByText('Draft')).toBeDefined();
  });

  it('renders lesson counts on cards', function() {
    var result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('6 lessons')).toBeDefined();
    expect(result.getByText('2 lessons')).toBeDefined();
  });

  it('creates a draft when Create New Course is pressed', function() {
    var draftCourse = { ...mockDraft, id: 'uc_new' };
    mockCreateDraft.mockReturnValue(draftCourse);
    var result = render(
      <MyCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Create New Course')); });
    expect(mockCreateDraft).toHaveBeenCalled();
  });
});
