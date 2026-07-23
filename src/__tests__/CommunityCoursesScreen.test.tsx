/**
 * ============================================================================
 * Toroloom — CommunityCoursesScreen Integration Tests
 * ============================================================================
 *
 * Covers: initial state, populated course listing, featured courses carousel,
 * stats with data, enrollment toggle, filter expansion, search filtering,
 * empty states (no courses, no results).
 */

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
var storeMyCourses: any[] = [];
var storeEnrolledIds: string[] = [];

// ==================== Mock Course Data ====================

var mockFeaturedCourse = {
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

var mockBeginnerCourse = {
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

var mockDraftCourse = {
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
  useFocusEffect: function(cb: () => void) { React.useEffect(function() { cb(); }, []); },
}));

// Store mock — closes over mutable var variables
vi.mock('../store/userCourseStore', () => ({
  useUserCourseStore: vi.fn(function(selector: any) {
    var state = {
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
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.toJSON()).not.toBeNull();
  });

  it('renders the screen title', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Community Courses')).toBeDefined();
  });

  it('renders subtitle', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/Discover courses/)).toBeDefined();
  });

  it('renders search placeholder', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByPlaceholderText('Search courses, creators, or topics...')).toBeDefined();
  });

  it('renders stats row with zeros', function() {
    var result = render(
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
    var result = render(
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
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Only published courses count (featured + beginner = 2), draft is excluded
    expect(result.getByText('2')).toBeDefined();
  });

  it('shows correct featured count', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('1')).toBeDefined();
  });

  it('shows correct enrolled count (from enrolledCommunityCourseIds)', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // 1 enrolled (uc_1)
    expect(result.getByText('1')).toBeDefined();
  });

  it('shows correct total students (sum of enrolledCount)', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // featured: 342 + beginner: 1289 = 1631
    expect(result.getByText('1631')).toBeDefined();
  });

  it('renders stats row labels', function() {
    var result = render(
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
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('All Community Courses')).toBeDefined();
  });

  it('renders course card title', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Stock Market Basics for Beginners')).toBeDefined();
  });

  it('renders creator name on card', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/by John Investor/)).toBeDefined();
  });

  it('renders level badge text', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // react-test-renderer does not apply CSS textTransform, so check base text
    expect(result.getByText('Beginner')).toBeDefined();
  });

  it('renders lesson count', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/8 lessons/)).toBeDefined();
  });

  it('renders course description', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/Start your investing journey/)).toBeDefined();
  });

  it('renders enrolled count on card', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('1289')).toBeDefined();
  });

  it('renders relative time on card', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // publishedAt is 2026-01-08. With system time frozen at 2026-07-20, diff is ~193 days ≈ 6.4mo
    expect(result.getByText(/(m|h|d|w|mo) ago/)).toBeDefined();
  });

  it('renders Enroll button for non-enrolled course', function() {
    var result = render(
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
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Featured Courses')).toBeDefined();
  });

  it('renders featured card title', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Advanced Options Trading')).toBeDefined();
  });

  it('renders featured card creator name', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/by Jane Trader/)).toBeDefined();
  });

  it('renders featured card lesson and duration', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('6 lessons')).toBeDefined();
  });

  it('renders featured card enrolled count', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('342')).toBeDefined();
  });

  it('renders Enroll button on featured card for non-enrolled', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Enroll')).toBeDefined();
  });

  it('hides Featured section when search query is active', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    var searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'Options'); });
    expect(function() { result.getByText('Featured Courses'); }).toThrow();
  });

  it('renders "All Community Courses" section alongside featured', function() {
    var result = render(
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
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Enrolled')).toBeDefined();
  });

  it('calls unenroll when Enrolled button is pressed on featured card', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Enrolled')); });
    expect(mockUnenroll).toHaveBeenCalledWith('uc_1');
  });

  it('calls enroll when Enroll button is pressed on regular (non-enrolled) card', function() {
    var result = render(
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
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Level and Category labels should NOT be visible when filters are collapsed
    expect(function() { result.getByText('Level'); }).toThrow();
    expect(function() { result.getByText('Category'); }).toThrow();
  });

  it('opens and closes filters when filter icon is pressed', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Find the filter toggle icon (IonIonicons with name="options-outline")
    var filterIcon = result.root.findByProps({ name: 'options-outline' });
    expect(filterIcon).toBeDefined();

    // Press to open filters
    act(function() { fireEvent.press(filterIcon); });
    expect(result.getByText('Level')).toBeDefined();
    expect(result.getByText('Category')).toBeDefined();
    expect(result.getByText('All Levels')).toBeDefined();

    // Now the icon should have changed to "options" (showFilters=true)
    // Press it again to close
    var filterIconOpen = result.root.findByProps({ name: 'options' });
    act(function() { fireEvent.press(filterIconOpen); });
    expect(function() { result.getByText('Level'); }).toThrow();
  });

  it('shows level filter chips when filters are expanded', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Open filters
    var filterIcon = result.root.findByProps({ name: 'options-outline' });
    act(function() { fireEvent.press(filterIcon); });

    // All level chips should be visible
    expect(result.getByText('All Levels')).toBeDefined();
    expect(result.getByText('Beginner')).toBeDefined();
    expect(result.getByText('Intermediate')).toBeDefined();
    expect(result.getByText('Advanced')).toBeDefined();
  });

  it('filters courses when a level chip is pressed', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Open filters
    var filterIcon = result.root.findByProps({ name: 'options-outline' });
    act(function() { fireEvent.press(filterIcon); });

    // Press the "Advanced" level chip — use result.root.find with exact
    // children matching. In react-test-renderer, Text children are an
    // array of strings, so check inst.children[0] === 'Advanced'
    // Use getAllByText to find all 'Advanced' instances, then pick the one
    // that is a filter chip (navigate up to see if parent is a Pressable/TouchableOpacity)
    var allAdvanced = result.getAllByText('Advanced');
    var advancedChip = allAdvanced.find(function(inst) {
      var parent = inst.parent;
      return parent != null && (parent.type as string === 'Pressable' || parent.type as string === 'TouchableOpacity');
    }) || allAdvanced[0];
    act(function() { fireEvent.press(advancedChip); });

    // Featured section should be hidden (hidden when filter is active)
    expect(function() { result.getByText('Featured Courses'); }).toThrow();

    // Only advanced course should show in the filtered results
    expect(result.getByText('Advanced Options Trading')).toBeDefined();
    expect(function() { result.getByText('Stock Market Basics for Beginners'); }).toThrow();
    // Section header should indicate filtered count
    expect(result.getByText(/Filtered/)).toBeDefined();
  });

  it('resets filter when All Levels is pressed', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Open filters
    var filterIcon = result.root.findByProps({ name: 'options-outline' });
    act(function() { fireEvent.press(filterIcon); });

    // First filter by Advanced — use getAllByText to find Advanced,
    // then pick the filter chip (parent is a Pressable/TouchableOpacity)
    var allAdvanced = result.getAllByText('Advanced');
    var advancedChip = allAdvanced.find(function(inst) {
      var parent = inst.parent;
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
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Open filters
    var filterIcon = result.root.findByProps({ name: 'options-outline' });
    act(function() { fireEvent.press(filterIcon); });

    // Category chips should be visible (e.g., "All", "Finance", "Investing", "Technical" etc.)
    expect(result.getByText('All')).toBeDefined();
    expect(result.getByText('Investing')).toBeDefined();
    expect(result.getByText('Options')).toBeDefined();
  });

  it('filters by category when category chip is pressed', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Open filters
    var filterIcon = result.root.findByProps({ name: 'options-outline' });
    act(function() { fireEvent.press(filterIcon); });

    // Press the "Options" category chip — use result.root.find with exact
    // children matching (react-test-renderer Text children are arrays)
    var optionsChip = result.root.find(function(inst) {
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
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    var searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'Options'); });
    // Only "Advanced Options Trading" should match
    expect(result.getByText('Results (1)')).toBeDefined();
    expect(result.getByText('Advanced Options Trading')).toBeDefined();
    expect(function() { result.getByText('Stock Market Basics for Beginners'); }).toThrow();
  });

  it('search by creator name filters courses', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    var searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'John'); });
    // "John Investor" should match
    expect(result.getByText('Results (1)')).toBeDefined();
    expect(result.getByText('Stock Market Basics for Beginners')).toBeDefined();
  });

  it('clearing search restores all courses', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    var searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    // Type to filter
    act(function() { fireEvent.changeText(searchInput, 'Options'); });
    expect(result.getByText('Results (1)')).toBeDefined();
    // Clear search by setting empty string
    act(function() { fireEvent.changeText(searchInput, ''); });
    // Should go back to showing all courses
    expect(result.getByText('All Community Courses')).toBeDefined();
  });

  it('clears search text by pressing the close-circle icon', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    var searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    // Type to make close-circle icon appear
    act(function() { fireEvent.changeText(searchInput, 'Options'); });
    expect(result.getByText('Results (1)')).toBeDefined();

    // Find the close-circle icon and press it
    var clearIcon = result.root.findByProps({ name: 'close-circle' });
    act(function() { fireEvent.press(clearIcon); });

    // Should go back to showing all courses
    expect(result.getByText('All Community Courses')).toBeDefined();
  });

  it('search with no results shows empty state', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    var searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'zzzzz_nonexistent'); });
    expect(result.getByText('No courses found')).toBeDefined();
    expect(result.getByText(/Try a different search/)).toBeDefined();
  });

  it('shows result count header when search has text', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    var searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
    act(function() { fireEvent.changeText(searchInput, 'Options'); });
    // The results header should say "Results (1)"
    expect(result.getByText('Results (1)')).toBeDefined();
  });

  it('search by description text', function() {
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    var searchInput = result.getByPlaceholderText('Search courses, creators, or topics...');
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
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Published count is 0
    var zeros = result.getAllByText('0');
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
    var result = render(
      <CommunityCoursesScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Community Courses')).toBeDefined();
  });
});
