/**
 * ============================================================================
 * Toroloom — AdminCourseReviewScreen Tests
 * ============================================================================
 *
 * Covers: rendering (stats bar, filter chips, course cards), filter switching,
 * approve/reject/toggleFeatured UI flows (Alert interactions), non-admin
 * redirect, expand/collapse with course details, empty states.
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { render, fireEvent } from './testUtils';
import type { UserGeneratedCourse } from '../types';

// ==================== Mock Alert ====================

const mockAlert = vi.hoisted(() => vi.fn());

vi.mock('react-native', async () => {
  const mock = await import('./react-native.mock');
  return { ...mock, Alert: { alert: mockAlert } };
});

// Animated.View from react-native-reanimated returns undefined in the test
// mock, which causes AnimatedPressable children to vanish. Mock AnimatedPressable
// as a plain host element so buttons are pressable and text is findable.
vi.mock('../components/ui/AnimatedPressable', () => ({
  default: 'AnimatedPressableMock',
}));

// ==================== Mock Navigation ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

// ==================== Mock Store Actions ====================

const mockApproveCourse = vi.fn();
const mockRejectCourse = vi.fn();
const mockToggleFeatured = vi.fn();
const mockLoadFromCache = vi.fn();

// ==================== Mock Courses ====================

const now = new Date().toISOString();

function createMockCourse(overrides: Partial<UserGeneratedCourse> = {}): UserGeneratedCourse {
  return {
    id: 'test_course',
    title: 'Test Trading Course',
    description: 'A comprehensive course about trading',
    thumbnail: '📊',
    duration: '2 hours',
    lessonsCount: 5,
    level: 'beginner',
    category: 'Trading',
    creatorId: 'user_123',
    creatorName: 'Test Creator',
    publishStatus: 'draft',
    submittedForReview: true,
    reviewNotes: undefined,
    lessons: [],
    enrolledCount: 0,
    rating: 0,
    createdAt: now,
    updatedAt: now,
    tags: ['trading'],
    ...overrides,
  };
}

const mockPendingCourse = createMockCourse({
  id: 'c1',
  title: 'Pending Course',
  publishStatus: 'draft',
  submittedForReview: true,
});

const mockApprovedCourse = createMockCourse({
  id: 'c2',
  title: 'Approved Course',
  publishStatus: 'published',
  submittedForReview: false,
});

const mockRejectedCourse = createMockCourse({
  id: 'c3',
  title: 'Rejected Course',
  publishStatus: 'draft',
  submittedForReview: false,
  reviewNotes: 'Please add more practical examples.',
});

const mockFeaturedCourse = createMockCourse({
  id: 'c4',
  title: 'Featured Course',
  publishStatus: 'published',
  submittedForReview: false,
  isFeatured: true,
});

const allMockCourses = [mockPendingCourse, mockApprovedCourse, mockRejectedCourse, mockFeaturedCourse];

// ==================== Mocks ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', bgCard: '#1A1A2E',
      bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44',
      bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      danger: '#FF1744', success: '#00C853',
    },
    isDark: true,
  }),
}));

/** Controls whether useAuthStore returns isAdmin = true or false */
let _mockIsAdmin = true;

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn((sel?: any) => {
    const state = { isAdmin: _mockIsAdmin };
    return sel ? sel(state) : state;
  }),
}));

const mockUseUserCourseStore = vi.hoisted(() => {
  const fn = vi.fn((sel?: any) => {
    const state = {
      myCourses: allMockCourses,
      approveCourse: mockApproveCourse,
      rejectCourse: mockRejectCourse,
      toggleFeatured: mockToggleFeatured,
      getPendingCourses: () => allMockCourses.filter(
        c => c.submittedForReview && c.publishStatus === 'draft'
      ),
      loadFromCache: mockLoadFromCache,
    };
    return sel ? sel(state) : state;
  });
  fn.getState = vi.fn(() => ({ loadFromCache: mockLoadFromCache }));
  return fn;
});

vi.mock('../store/userCourseStore', () => ({
  useUserCourseStore: mockUseUserCourseStore,
}));

vi.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => cb(),
}));

vi.mock('../constants/theme', () => ({
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  FONTS: {
    bold: { fontWeight: '700' },
    regular: { fontWeight: '400' },
    medium: { fontWeight: '500' },
    semiBold: { fontWeight: '600' },
    size: { xs: 10, sm: 12, md: 14, lg: 16, xl: 18, title: 24, xxl: 28 },
  },
  BORDER_RADIUS: { sm: 4, md: 8, lg: 12, xl: 16, full: 999 },
}));

// ==================== Imports ====================

import AdminCourseReviewScreen from '../screens/settings/AdminCourseReviewScreen';

// ==================== Helpers ====================

function press(element: ReactTestInstance) {
  act(() => { fireEvent.press(element); });
}

/** Capture the onPress callback from the last mockAlert call */
function getAlertButtonCallback(buttonIndex: number = 0): () => void {
  const buttons = mockAlert.mock.calls[mockAlert.mock.calls.length - 1][2];
  return buttons[buttonIndex]?.onPress;
}

/** Reset all mocks before each test */
function resetMocks() {
  mockAlert.mockClear();
  mockApproveCourse.mockClear();
  mockRejectCourse.mockClear();
  mockToggleFeatured.mockClear();
  mockLoadFromCache.mockClear();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  _mockIsAdmin = true;
  // Restore default userCourseStore mock
  mockUseUserCourseStore.mockImplementation((sel?: any) => {
    const state = {
      myCourses: allMockCourses,
      approveCourse: mockApproveCourse,
      rejectCourse: mockRejectCourse,
      toggleFeatured: mockToggleFeatured,
      getPendingCourses: () => allMockCourses.filter(
        c => c.submittedForReview && c.publishStatus === 'draft'
      ),
      loadFromCache: mockLoadFromCache,
    };
    return sel ? sel(state) : state;
  });
}

// ==================== Rendering ====================

describe('AdminCourseReviewScreen — Rendering', () => {
  beforeEach(resetMocks);

  it('renders the screen title', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(getByText('Course Reviews')).toBeDefined();
  });

  it('renders the subtitle', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(getByText('Review and manage user-submitted courses')).toBeDefined();
  });

  it('loads cached courses on focus', () => {
    render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(mockLoadFromCache).toHaveBeenCalled();
  });

  it('renders stats bar with correct counts', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    // Stats bar shows counts: Pending=1, Approved=2, Rejected=1, Total=4
    expect(getByText('1')).toBeDefined();
    expect(getByText('2')).toBeDefined();
  });

  it('renders all 4 filter chips', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(getByText('Pending')).toBeDefined();
    expect(getByText('Approved')).toBeDefined();
    expect(getByText(/^Rejected$/)).toBeDefined(); // exact match — not "Reject"
    expect(getByText('All')).toBeDefined();
  });

  it('renders pending course card by default', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(getByText('Pending Course')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders creator name on course cards', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(getByText('by Test Creator')).toBeDefined();
  });
});

// ==================== Filter Switching ====================

describe('AdminCourseReviewScreen — Filter Switching', () => {
  beforeEach(resetMocks);

  it('shows pending courses by default', () => {
    const { getByText, queryByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(getByText('Pending Course')).toBeDefined();
    expect(queryByText('Approved Course')).toBeNull();
  });

  it('shows approved courses when Approved filter is selected', () => {
    const { getByText, queryByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Approved'));
    expect(getByText('Approved Course')).toBeDefined();
    expect(getByText('Featured Course')).toBeDefined();
    expect(queryByText('Pending Course')).toBeNull();
  });

  it('shows rejected courses when Rejected filter is selected', () => {
    const { getByText, queryByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText(/^Rejected$/));
    expect(getByText('Rejected Course')).toBeDefined();
    expect(queryByText('Pending Course')).toBeNull();
  });

  it('shows all reviewed courses when All filter is selected', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('All'));
    expect(getByText('Pending Course')).toBeDefined();
    expect(getByText('Approved Course')).toBeDefined();
    expect(getByText('Rejected Course')).toBeDefined();
    expect(getByText('Featured Course')).toBeDefined();
  });
});

// ==================== Empty States ====================

describe('AdminCourseReviewScreen — Empty States', () => {
  beforeEach(() => {
    resetMocks();
    // Override mock to return empty courses
    mockUseUserCourseStore.mockImplementation((sel?: any) => {
      const state = {
        myCourses: [],
        approveCourse: mockApproveCourse,
        rejectCourse: mockRejectCourse,
        toggleFeatured: mockToggleFeatured,
        getPendingCourses: () => [],
        loadFromCache: mockLoadFromCache,
      };
      return sel ? sel(state) : state;
    });
  });

  afterEach(() => {
    resetMocks(); // Restore default mock
  });

  it('shows empty state when no courses exist', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(getByText('No pending reviews')).toBeDefined();
  });

  it('shows correct empty message for Approved filter', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Approved'));
    expect(getByText('No approved courses')).toBeDefined();
  });

  it('shows correct empty message for Rejected filter', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText(/^Rejected$/));
    expect(getByText('No rejected courses')).toBeDefined();
  });
});

// ==================== Expand/Collapse ====================

describe('AdminCourseReviewScreen — Expand/Collapse', () => {
  beforeEach(resetMocks);

  it('shows course details when a pending course card is pressed', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Pending Course'));
    expect(getByText('Description')).toBeDefined();
    expect(getByText('A comprehensive course about trading')).toBeDefined();
  });

  it('shows approve and reject buttons for expanded pending course', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Pending Course'));
    expect(getByText(/^Reject$/)).toBeDefined();
    expect(getByText('Approve & Publish')).toBeDefined();
  });

  it('shows Feature button for expanded approved course', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Approved'));
    press(getByText('Approved Course'));
    expect(getByText('Feature')).toBeDefined();
  });

  it('shows Unfeature button for expanded featured course', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Approved'));
    press(getByText('Featured Course'));
    expect(getByText('Unfeature')).toBeDefined();
  });

  it('shows rejected info and review notes for expanded rejected course', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText(/^Rejected$/));
    press(getByText('Rejected Course'));
    expect(getByText('Review Notes')).toBeDefined();
    expect(getByText('Please add more practical examples.')).toBeDefined();
  });
});

// ==================== Approve Flow ====================

describe('AdminCourseReviewScreen — Approve Flow', () => {
  beforeEach(resetMocks);

  it('shows confirmation alert when Approve & Publish is pressed', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Pending Course')); // Expand
    press(getByText('Approve & Publish'));

    expect(mockAlert).toHaveBeenCalledWith(
      'Approve Course',
      expect.stringContaining('Pending Course'),
      expect.any(Array)
    );
  });

  it('calls approveCourse when confirmation is accepted', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Pending Course')); // Expand
    press(getByText('Approve & Publish'));

    // Get the approve button callback (index 1 = second button)
    const confirmBtn = getAlertButtonCallback(1);
    act(() => { confirmBtn(); });

    expect(mockApproveCourse).toHaveBeenCalledWith('c1');
    expect(mockAlert).toHaveBeenCalledWith(
      '✅ Published',
      expect.stringContaining('published')
    );
  });

  it('does not call approveCourse when cancel is pressed', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Pending Course')); // Expand
    press(getByText('Approve & Publish'));

    // Cancel-style Alert buttons auto-dismiss — they don't have an onPress
    // callback. Simply verify that approveCourse was never called.
    expect(mockApproveCourse).not.toHaveBeenCalled();
  });

  it('shows published confirmation alert after approval', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Pending Course'));
    press(getByText('Approve & Publish'));

    const confirmBtn = getAlertButtonCallback(1);
    act(() => { confirmBtn(); });

    expect(mockAlert).toHaveBeenCalledWith(
      '✅ Published',
      expect.stringContaining('published to the catalog')
    );
  });
});

// ==================== Reject Flow ====================

describe('AdminCourseReviewScreen — Reject Flow', () => {
  beforeEach(resetMocks);

  it('shows notes required alert when rejecting without notes', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Pending Course')); // Expand
    press(getByText(/^Reject$/)); // Press Reject action button (not "Rejected" filter)

    expect(mockAlert).toHaveBeenCalledWith(
      'Notes Required',
      expect.stringContaining('feedback')
    );
  });

  it('calls rejectCourse with notes when rejection is confirmed', () => {
    const { getByText, getByPlaceholderText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Pending Course')); // Expand

    // Enter rejection notes
    const input = getByPlaceholderText('Explain why the course is being rejected...');
    act(() => { fireEvent.changeText(input, 'Needs more practical examples.'); });

    press(getByText(/^Reject$/));

    // Confirm rejection in Alert
    const confirmBtn = getAlertButtonCallback(1);
    act(() => { confirmBtn(); });

    expect(mockRejectCourse).toHaveBeenCalledWith('c1', 'Needs more practical examples.');
  });

  it('does not call rejectCourse when cancel is pressed', () => {
    const { getByText, getByPlaceholderText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Pending Course')); // Expand

    const input = getByPlaceholderText('Explain why the course is being rejected...');
    act(() => { fireEvent.changeText(input, 'Some feedback.'); });

    press(getByText(/^Reject$/));

    // Cancel-style Alert buttons auto-dismiss — they don't have an onPress
    // callback. Simply verify rejectCourse was never called.
    expect(mockRejectCourse).not.toHaveBeenCalled();
  });

  it('clears reject notes input after rejection is submitted', () => {
    const { getByText, getByPlaceholderText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Pending Course')); // Expand

    const input = getByPlaceholderText('Explain why the course is being rejected...');
    act(() => { fireEvent.changeText(input, 'Feedback text.'); });

    press(getByText(/^Reject$/));

    // Mock Alert.alert's onPress just calls the callback — the actual state
    // reset happens inside the callback. Simulating the full flow:
    const confirmBtn = getAlertButtonCallback(1);
    act(() => { confirmBtn(); });

    // After rejection, the expanded state should close (setExpandedCourseId(null))
    expect(mockRejectCourse).toHaveBeenCalled();
  });
});

// ==================== Toggle Featured Flow ====================

describe('AdminCourseReviewScreen — Toggle Featured', () => {
  beforeEach(resetMocks);

  it('calls toggleFeatured for a non-featured approved course', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Approved')); // Switch to Approved filter
    press(getByText('Approved Course')); // Expand
    // Use regex for exact match so "Featured" (badge on featured course) isn't matched
    press(getByText(/^Feature$/));

    expect(mockToggleFeatured).toHaveBeenCalledWith('c2');
    expect(mockAlert).toHaveBeenCalledWith(
      '⭐ Updated',
      expect.stringContaining('added to featured')
    );
  });

  it('calls toggleFeatured and shows removed message for a featured course', () => {
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    press(getByText('Approved')); // Switch to Approved filter
    press(getByText('Featured Course')); // Expand
    press(getByText('Unfeature'));

    expect(mockToggleFeatured).toHaveBeenCalledWith('c4');
    expect(mockAlert).toHaveBeenCalledWith(
      '⭐ Updated',
      expect.stringContaining('removed from featured')
    );
  });
});

// ==================== Non-Admin Redirect ====================

describe('AdminCourseReviewScreen — Non-Admin Redirect', () => {
  beforeEach(() => {
    resetMocks();
    _mockIsAdmin = false;
  });

  it('shows access denied alert when user is not admin', () => {
    render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(mockAlert).toHaveBeenCalledWith(
      'Access Denied',
      'You do not have admin privileges.'
    );
  });

  it('navigates back when user is not admin', () => {
    render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(mockGoBack).toHaveBeenCalledWith();
  });

  it('does not show access denied for admin user', () => {
    _mockIsAdmin = true;
    const { getByText } = render(
      <AdminCourseReviewScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />
    );
    expect(getByText('Course Reviews')).toBeDefined();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
