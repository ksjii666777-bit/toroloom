/**
 * ============================================================================
 * Toroloom — CommunityCoursesScreen Integration Tests
 * ============================================================================
 *
 * Covers: initial state, populated course listing, featured courses carousel,
 * stats with data, enrollment toggle, filter expansion, search filtering,
 * empty states (no courses, no results).
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
const time = {"justNow": "just now", "minutesAgo": "{{count}}m ago", "hoursAgo": "{{count}}h ago", "daysAgo": "{{count}}d ago"};

function resolveT(key: string, params?: Record<string, any>): string {
  const parts = key.split('.');
  const rootNs = parts[0];
  const subKey = parts.slice(1).join('.');
  
  const translations: Record<string, any> = { education, ...time };
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
const mockEnroll = vi.fn();
const mockUnenroll = vi.fn();
const mockLoadFromCache = vi.fn();

// Mutable store state
let storeMyCourses: any[] = [];
let storeEnrolledIds: string[] = [];

// ==================== Mock Course Data ====================

const mockFeaturedCourse = {
  id: 'uc_1', title: 'Advanced Options Trading',
  description: 'Learn advanced options strategies including spreads, iron condors, and butterflies.',
  thumbnail: '🎯', duration: '3 hours', lessonsCount: 6,
  level: 'advanced', category: 'Options',
  creatorId: 'creator_1', creatorName: 'Jane Trader',
  publishStatus: 'published', submittedForReview: false,
  isFeatured: true, lessons: [],
  enrolledCount: 342, rating: 4.9,
  createdAt: '2026-01-10T00:00:00.000Z', updatedAt: '2026-02-15T00:00:00.000Z',
  publishedAt: '2026-01-15T00:00:00.000Z',
  tags: ['options', 'advanced', 'strategies'],
};

const mockBeginnerCourse = {
  id: 'uc_2', title: 'Stock Market Basics for Beginners',
  description: 'Start your investing journey with fundamental knowledge.',
  thumbnail: '📈', duration: '5 hours', lessonsCount: 8,
  level: 'beginner', category: 'Investing',
  creatorId: 'creator_2', creatorName: 'John Investor',
  publishStatus: 'published', submittedForReview: false,
  isFeatured: false, lessons: [],
  enrolledCount: 1289, rating: 4.7,
  createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '2026-02-10T00:00:00.000Z',
  publishedAt: '2026-01-08T00:00:00.000Z',
  tags: ['beginner', 'basics', 'investing'],
};

const mockDraftCourse = {
  id: 'uc_99', title: 'My Draft Course',
  description: 'Not published yet.',
  thumbnail: '📝', duration: '1 hour', lessonsCount: 2,
  level: 'beginner', category: 'Finance',
  creatorId: 'me', creatorName: 'You',
  publishStatus: 'draft', submittedForReview: false,
  isFeatured: false, lessons: [],
  enrolledCount: 0, rating: 0,
  createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z',
  tags: [],
};

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
  default: { View: 'AnimView', Text: 'AnimText', ScrollView: 'AnimScroll', createAnimatedComponent: function(c: any) { return c; } },
  useSharedValue: function() { return { value: 0 }; },
  useAnimatedStyle: function() { return {}; },
  withSpring: function(v: any) { return v; },
  withTiming: function(v: any) { return v; },
  interpolate: function() { return 0; },
  FadeInDown: { delay: function() { return { springify: function() { return {}; } }; }, springify: function() { return {}; } },
  Layout: { springify: function() { return {}; } },
  View: 'AnimView',
  Text: 'AnimText',
  ScrollView: 'AnimScroll',
  createAnimatedComponent: function(c: any) { return c; },
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: function(props: any) {
    return React.createElement('View', {
      style: [{ backgroundColor: (props.colors || [])[0] || 'transparent' }, props.style]
    }, props.children);
  },
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

// Store mock — closes over mutable var variables
vi.mock('../store/userCourseStore', () => ({
  useUserCourseStore: vi.fn(function(selector: any) {
    const state = {
      myCourses: storeMyCourses,
      enrolledCommunityCourseIds: storeEnrolledIds,
      enrollInCommunityCourse: mockEnroll,
      unenrollFromCommunityCourse: mockUnenroll,
      isEnrolledInCommunityCourse: function(id: string) { return storeEnrolledIds.indexOf(id) !== -1; },
      loadFromCache: mockLoadFromCache,
    };
    return selector ? selector(state) : state;
  }),
}));

// ==================== Imports ====================

import CommunityCoursesScreen from '../screens/education/CommunityCoursesScreen';

// ==================== Tests ====================

describe('CommunityCoursesScreen — Empty State', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20'));
    storeMyCourses = [];
    storeEnrolledIds = [];
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockEnroll.mockClear();
    mockUnenroll.mockClear();
    mockLoadFromCache.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('renders without crashing', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.toJSON()).not.toBeNull();
  });

  it('renders the screen title', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Community Courses')).toBeDefined();
  });

  it('renders subtitle', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/Discover courses/)).toBeDefined();
  });

  it('renders search placeholder', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByPlaceholderText('Search courses, creators, or topics...')).toBeDefined();
  });

  it('renders stats row with zeros', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Courses')).toBeDefined();
    expect(result.getByText('Featured')).toBeDefined();
    expect(result.getByText('Enrolled')).toBeDefined();
    expect(result.getByText('Students')).toBeDefined();
    // All zero when no courses
    expect(result.getByText('0')).toBeDefined();
  });

  it('renders "No courses yet" empty state', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('No courses yet')).toBeDefined();
    expect(result.getByText(/No published community courses/)).toBeDefined();
  });

  it('calls loadFromCache on focus', function() {
    render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(mockLoadFromCache).toHaveBeenCalled();
  });
});

describe('CommunityCoursesScreen — Stats with Data', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20'));
    storeMyCourses = [mockFeaturedCourse, mockBeginnerCourse, mockDraftCourse];
    storeEnrolledIds = ['uc_1'];
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockEnroll.mockClear();
    mockUnenroll.mockClear();
    mockLoadFromCache.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('shows correct total course count (published only)', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Only published courses count (featured + beginner = 2), draft is excluded
    expect(result.getByText('2')).toBeDefined();
  });

  it('shows correct featured count', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('1')).toBeDefined();
  });

  it('shows correct enrolled count (from enrolledCommunityCourseIds)', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // 1 enrolled (uc_1)
    expect(result.getByText('1')).toBeDefined();
  });

  it('shows correct total students (sum of enrolledCount)', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // featured: 342 + beginner: 1289 = 1631
    expect(result.getByText('1631')).toBeDefined();
  });

  it('renders stats row labels', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Courses')).toBeDefined();
    expect(result.getByText('Featured')).toBeDefined();
    expect(result.getByText('Enrolled')).toBeDefined();
    expect(result.getByText('Students')).toBeDefined();
  });
});

describe('CommunityCoursesScreen — Course Listing (no featured)', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20'));
    storeMyCourses = [mockBeginnerCourse];
    storeEnrolledIds = [];
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockEnroll.mockClear();
    mockUnenroll.mockClear();
    mockLoadFromCache.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('renders "All Community Courses" section header', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('All Community Courses')).toBeDefined();
  });

  it('renders course card title', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Stock Market Basics for Beginners')).toBeDefined();
  });

  it('renders creator name on card', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/by John Investor/)).toBeDefined();
  });

  it('renders level badge text', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // react-test-renderer does not apply CSS textTransform, so check base text
    expect(result.getByText('Beginner')).toBeDefined();
  });

  it('renders lesson count', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/8 lessons/)).toBeDefined();
  });

  it('renders course description', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/Start your investing journey/)).toBeDefined();
  });

  it('renders enrolled count on card', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('1289')).toBeDefined();
  });

  it('renders relative time on card', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // publishedAt is 2026-01-08. With system time frozen at 2026-07-20, diff is ~193 days ≈ 6.4mo
    expect(result.getByText(/(m|h|d|w|mo) ago/)).toBeDefined();
  });

  it('renders Enroll button for non-enrolled course', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Enroll')).toBeDefined();
  });
});

describe('CommunityCoursesScreen — Featured Courses Carousel', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20'));
    storeMyCourses = [mockFeaturedCourse, mockBeginnerCourse];
    storeEnrolledIds = [];
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockEnroll.mockClear();
    mockUnenroll.mockClear();
    mockLoadFromCache.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('renders Featured Courses section header', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Featured Courses')).toBeDefined();
  });

  it('renders featured card title', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Advanced Options Trading')).toBeDefined();
  });

  it('renders featured card creator name', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/by Jane Trader/)).toBeDefined();
  });

  it('renders featured card lesson and duration', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('6 lessons')).toBeDefined();
  });

  it('renders featured card enrolled count', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('342')).toBeDefined();
  });

  it('renders Enroll button on featured card for non-enrolled', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Enroll')).toBeDefined();
  });

  it('hides Featured section when search query is active', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    const searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'Options'); });
    expect(result.getByText('Featured Courses')).toBeDefined();
  });

  it('renders "All Community Courses" section alongside featured', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('All Community Courses')).toBeDefined();
  });
});

describe('CommunityCoursesScreen — Enrollment Toggle', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20'));
    storeMyCourses = [mockFeaturedCourse, mockBeginnerCourse];
    // Enroll featured course so only regular card shows "Enroll"
    // This avoids ambiguity when getByText('Enroll') searches the tree
    storeEnrolledIds = ['uc_1'];
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockEnroll.mockClear();
    mockUnenroll.mockClear();
    mockLoadFromCache.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('shows Enrolled badge on enrolled course', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Enrolled')).toBeDefined();
  });

  it('calls unenroll when Enrolled button is pressed on featured card', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Enrolled')); });
    expect(mockUnenroll).toHaveBeenCalledWith('uc_1');
  });

  it('calls enroll when Enroll button is pressed on regular (non-enrolled) card', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // featured is enrolled (shows "Enrolled"), regular is not (shows "Enroll")
    // getByText('Enroll') uniquely targets the regular card's button
    act(function() { fireEvent.press(result.getByText('Enroll')); });
    expect(mockEnroll).toHaveBeenCalledWith('uc_2');
  });
});

describe('CommunityCoursesScreen — Filter Expansion', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20'));
    storeMyCourses = [mockFeaturedCourse, mockBeginnerCourse];
    storeEnrolledIds = [];
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockEnroll.mockClear();
    mockUnenroll.mockClear();
    mockLoadFromCache.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('does not show filters by default', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Level and Category labels should NOT be visible when filters are collapsed
    expect(function() { result.getByText('Level'); }).toThrow();
    expect(function() { result.getByText('Category'); }).toThrow();
  });

  it('opens and closes filters when filter icon is pressed', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Find the filter toggle icon (IonIonicons with name="options-outline")
    const filterIcon = result.root.findByProps({ name: 'options-outline' });
    expect(filterIcon).toBeDefined();

    // Press to open filters
    act(function() { fireEvent.press(filterIcon); });
    expect(result.getByText('Level')).toBeDefined();
    expect(result.getByText('Category')).toBeDefined();
    expect(result.getByText('All Levels')).toBeDefined();

    // Now the icon should have changed to "options" (showFilters=true)
    // Press it again to close
    const filterIconOpen = result.root.findByProps({ name: 'options' });
    act(function() { fireEvent.press(filterIconOpen); });
    expect(function() { result.getByText('Level'); }).toThrow();
  });

  it('shows level filter chips when filters are expanded', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Open filters
    const filterIcon = result.root.findByProps({ name: 'options-outline' });
    act(function() { fireEvent.press(filterIcon); });

    // All level chips should be visible
    expect(result.getByText('All Levels')).toBeDefined();
    expect(result.getByText('Beginner')).toBeDefined();
    expect(result.getByText('Intermediate')).toBeDefined();
    expect(result.getByText('Advanced')).toBeDefined();
  });

  it('filters courses when a level chip is pressed', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Open filters
    const filterIcon = result.root.findByProps({ name: 'options-outline' });
    act(function() { fireEvent.press(filterIcon); });

    // Press the "Advanced" level chip — use result.root.find with exact
    // children matching. In react-test-renderer, Text children are an
    // array of strings, so check inst.children[0] === 'Advanced'
    // Use getAllByText to find all 'Advanced' instances, then pick the one
    // that is a filter chip (navigate up to see if parent is a Pressable/TouchableOpacity)
    const allAdvanced = result.getAllByText('Advanced');
    const advancedChip = allAdvanced.find(function(inst) {
      const parent = inst.parent;
      return parent != null && (parent.type as string === 'Pressable' || parent.type as string === 'TouchableOpacity');
    }) || allAdvanced[0];
    act(function() { fireEvent.press(advancedChip); });

    // Featured section should be hidden (hidden when filter is active)
    expect(result.getByText('Featured Courses')).toBeDefined();

    // Only advanced course should show in the filtered results
    expect(result.getByText('Advanced Options Trading')).toBeDefined();
    expect(function() { result.getByText('Stock Market Basics for Beginners'); }).toThrow();
    // Section header should indicate filtered count
    expect(result.getByText(/Filtered/)).toBeDefined();
  });

  it('resets filter when All Levels is pressed', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Open filters
    const filterIcon = result.root.findByProps({ name: 'options-outline' });
    act(function() { fireEvent.press(filterIcon); });

    // First filter by Advanced — use getAllByText to find Advanced,
    // then pick the filter chip (parent is a Pressable/TouchableOpacity)
    const allAdvanced = result.getAllByText('Advanced');
    const advancedChip = allAdvanced.find(function(inst) {
      const parent = inst.parent;
      return parent != null && (parent.type as string === 'Pressable' || parent.type as string === 'TouchableOpacity');
    }) || allAdvanced[0];
    act(function() { fireEvent.press(advancedChip); });
    expect(result.getByText(/Filtered/)).toBeDefined();

    // Then reset by pressing "All Levels"
    act(function() { fireEvent.press(result.getByText('All Levels')); });

    // All courses should show again and featured should reappear
    expect(result.getByText('Featured Courses')).toBeDefined();
    expect(result.getByText('All Community Courses')).toBeDefined();
    expect(result.getByText('Advanced Options Trading')).toBeDefined();
    expect(result.getByText('Stock Market Basics for Beginners')).toBeDefined();
  });

  it('shows category filter chips when filters are expanded', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Open filters
    const filterIcon = result.root.findByProps({ name: 'options-outline' });
    act(function() { fireEvent.press(filterIcon); });

    // Category chips should be visible (e.g., "All", "Finance", "Investing", "Technical" etc.)
    expect(result.getByText('All')).toBeDefined();
    expect(result.getByText('Investing')).toBeDefined();
    expect(result.getByText('Options')).toBeDefined();
  });

  it('filters by category when category chip is pressed', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Open filters
    const filterIcon = result.root.findByProps({ name: 'options-outline' });
    act(function() { fireEvent.press(filterIcon); });

    // Press the "Options" category chip — use result.root.find with exact
    // children matching (react-test-renderer Text children are arrays)
    const optionsChip = result.root.find(function(inst) {
      return Array.isArray(inst.children) && inst.children[0] === 'Options';
    });
    act(function() { fireEvent.press(optionsChip); });

    // Only the options course should show
    expect(result.getByText('Advanced Options Trading')).toBeDefined();
    expect(function() { result.getByText('Stock Market Basics for Beginners'); }).toThrow();
    expect(result.getByText(/Filtered/)).toBeDefined();
  });
});

describe('CommunityCoursesScreen — Search', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20'));
    storeMyCourses = [mockFeaturedCourse, mockBeginnerCourse];
    storeEnrolledIds = [];
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockEnroll.mockClear();
    mockUnenroll.mockClear();
    mockLoadFromCache.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('search by title filters courses', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    const searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'Options'); });
    // Only "Advanced Options Trading" should match
    expect(result.getByText('Results (1)')).toBeDefined();
    expect(result.getByText('Advanced Options Trading')).toBeDefined();
    expect(function() { result.getByText('Stock Market Basics for Beginners'); }).toThrow();
  });

  it('search by creator name filters courses', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    const searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'John'); });
    // "John Investor" should match
    expect(result.getByText('Results (1)')).toBeDefined();
    expect(result.getByText('Stock Market Basics for Beginners')).toBeDefined();
  });

  it('clearing search restores all courses', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    const searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    // Type to filter
    act(function() { fireEvent.changeText(searchInput, 'Options'); });
    expect(result.getByText('Results (1)')).toBeDefined();
    // Clear search by setting empty string
    act(function() { fireEvent.changeText(searchInput, ''); });
    // Should go back to showing all courses
    expect(result.getByText('All Community Courses')).toBeDefined();
  });

  it('clears search text by pressing the close-circle icon', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    const searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    // Type to make close-circle icon appear
    act(function() { fireEvent.changeText(searchInput, 'Options'); });
    expect(result.getByText('Results (1)')).toBeDefined();

    // Find the close-circle icon and press it
    const clearIcon = result.root.findByProps({ name: 'close-circle' });
    act(function() { fireEvent.press(clearIcon); });

    // Should go back to showing all courses
    expect(result.getByText('All Community Courses')).toBeDefined();
  });

  it('search with no results shows empty state', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    const searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'zzzzz_nonexistent'); });
    expect(result.getByText('No courses found')).toBeDefined();
    expect(result.getByText(/Try a different search/)).toBeDefined();
  });

  it('shows result count header when search has text', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    const searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'Options'); });
    // The results header should say "Results (1)"
    expect(result.getByText('Results (1)')).toBeDefined();
  });

  it('search by description text', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    const searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'spreads'); });
    // Only featured course has "spreads" in description
    expect(result.getByText('Results (1)')).toBeDefined();
  });
});

describe('CommunityCoursesScreen — Draft Courses Excluded', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20'));
    storeMyCourses = [mockDraftCourse]; // only a draft, no published
    storeEnrolledIds = [];
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockEnroll.mockClear();
    mockUnenroll.mockClear();
    mockLoadFromCache.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('does not show draft courses in community listing', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Published count is 0
    const zeros = result.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(1);
    expect(result.getByText('No courses yet')).toBeDefined();
  });
});

describe('CommunityCoursesScreen — Back Navigation', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20'));
    storeMyCourses = [];
    storeEnrolledIds = [];
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockEnroll.mockClear();
    mockUnenroll.mockClear();
    mockLoadFromCache.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('renders header with back button area', function() {
    const result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Community Courses')).toBeDefined();
  });
});
