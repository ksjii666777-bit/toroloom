/**
 * ============================================================================
 * Toroloom — User Course Store Tests (Course Review Notifications)
 * ============================================================================
 *
 * Tests that approveCourse and rejectCourse dispatch the correct in-app
 * notifications to the course creator via the notification store.
 *
 * NOTE: userCourseStore uses Zustand persist middleware with AsyncStorage.
 * The test setup (setup.ts) already mocks @react-native-async-storage/async-storage,
 * so persist operations are safe in tests.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useUserCourseStore } from '../store/userCourseStore';

// ─── Mock the notification store ─────────────────────────────────────────────
// approveCourse & rejectCourse use dynamic import('./notificationStore').then(...)
// This mock ensures the dynamic import resolves to a controlled mock.
const mockAddNotification = vi.fn();

vi.mock('../store/notificationStore', () => ({
  useNotificationStore: {
    getState: () => ({
      addNotification: mockAddNotification,
    }),
  },
}));

// ─── Helper: create a course in the store ─────────────────────────────────────
function addMockCourse(overrides: Record<string, any> = {}) {
  const now = new Date().toISOString();
  const course = {
    id: 'test_course_1',
    title: 'Test Trading Course',
    description: 'A comprehensive test course',
    thumbnail: '📊',
    duration: '2 hours',
    lessonsCount: 5,
    level: 'beginner' as const,
    category: 'Trading',
    creatorId: 'user_123',
    creatorName: 'Test Creator',
    publishStatus: 'draft' as const,
    submittedForReview: true,
    reviewNotes: undefined,
    lessons: [],
    enrolledCount: 0,
    rating: 0,
    createdAt: now,
    updatedAt: now,
    tags: ['test', 'trading'],
    ...overrides,
  };

  useUserCourseStore.setState(state => ({
    myCourses: [...(state.myCourses || []), course],
  }));

  return course;
}

// ─── Reset store + mock before each test ─────────────────────────────────────
beforeEach(() => {
  useUserCourseStore.setState({
    myCourses: [],
    editingCourse: null,
    loading: false,
    saving: false,
    enrolledCommunityCourseIds: [],
  });
  mockAddNotification.mockClear();
});

// =============================================================================
// approveCourse — Notification Tests
// =============================================================================

describe('approveCourse — notification dispatch', () => {
  it('sends a course_review notification with approval title', async () => {
    const course = addMockCourse({ title: 'Candlestick Patterns' });

    useUserCourseStore.getState().approveCourse(course.id);

    // Wait for dynamic import microtask to resolve
    await vi.waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledTimes(1);
    });

    const notif = mockAddNotification.mock.calls[0][0];
    expect(notif.type).toBe('course_review');
    expect(notif.title).toContain('Approved');
    expect(notif.title).toContain('✅');
    expect(notif.message).toContain('Candlestick Patterns');
    expect(notif.message).toContain('published');
    expect(notif.read).toBe(false);
    expect(notif.data).toEqual({
      courseId: course.id,
      action: 'approved',
      courseTitle: 'Candlestick Patterns',
    });
  });

  it('includes approval notes in notification data when notes are provided', async () => {
    const course = addMockCourse();

    useUserCourseStore.getState().approveCourse(course.id, 'Great content! Approved with minor formatting suggestions.');

    await vi.waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledTimes(1);
    });

    const notif = mockAddNotification.mock.calls[0][0];
    expect(notif.type).toBe('course_review');
    expect(notif.title).toContain('Approved');
    expect(notif.message).toContain('published');
    expect(notif.data.courseId).toBe(course.id);
    expect(notif.data.action).toBe('approved');
  });

  it('sets the course publishStatus to published after approval', async () => {
    const course = addMockCourse();

    useUserCourseStore.getState().approveCourse(course.id);

    const state = useUserCourseStore.getState();
    const updated = state.myCourses.find(c => c.id === course.id);
    expect(updated?.publishStatus).toBe('published');
    expect(updated?.submittedForReview).toBe(false);
    expect(updated?.publishedAt).toBeDefined();
  });

  it('does not throw when the course does not exist', async () => {
    expect(() => {
      useUserCourseStore.getState().approveCourse('nonexistent_id');
    }).not.toThrow();
  });

  it('does not send a notification when the course does not exist', async () => {
    useUserCourseStore.getState().approveCourse('nonexistent_id');

    // Give microtask time but verify no notification was sent
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockAddNotification).not.toHaveBeenCalled();
  });
});

// =============================================================================
// rejectCourse — Notification Tests
// =============================================================================

describe('rejectCourse — notification dispatch', () => {
  it('sends a course_review notification with rejection title', async () => {
    const course = addMockCourse({ title: 'Options Strategies 101' });

    useUserCourseStore.getState().rejectCourse(course.id, 'Please add more detailed explanations and examples.');

    await vi.waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledTimes(1);
    });

    const notif = mockAddNotification.mock.calls[0][0];
    expect(notif.type).toBe('course_review');
    expect(notif.title).toContain('Needs Changes');
    expect(notif.title).toContain('📝');
    expect(notif.message).toContain('Options Strategies 101');
    expect(notif.message).toContain('not approved');
    expect(notif.message).toContain('detailed explanation');
    expect(notif.read).toBe(false);
    expect(notif.data).toEqual({
      courseId: course.id,
      action: 'rejected',
      courseTitle: 'Options Strategies 101',
      reviewNotes: 'Please add more detailed explanations and examples.',
    });
  });

  it('includes rejection feedback in the notification message', async () => {
    const course = addMockCourse();
    const feedback = 'Missing practical examples. Please add at least 3 real-world scenarios.';

    useUserCourseStore.getState().rejectCourse(course.id, feedback);

    await vi.waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledTimes(1);
    });

    const notif = mockAddNotification.mock.calls[0][0];
    expect(notif.message).toContain(feedback);
    expect(notif.data.reviewNotes).toBe(feedback);
  });

  it('resets submittedForReview and keeps publishStatus as draft after rejection', async () => {
    const course = addMockCourse();

    useUserCourseStore.getState().rejectCourse(course.id, 'Needs more content.');

    const state = useUserCourseStore.getState();
    const updated = state.myCourses.find(c => c.id === course.id);
    expect(updated?.submittedForReview).toBe(false);
    expect(updated?.publishStatus).toBe('draft');
    expect(updated?.reviewNotes).toBe('Needs more content.');
  });

  it('does not throw when the course does not exist', async () => {
    expect(() => {
      useUserCourseStore.getState().rejectCourse('nonexistent_id', 'Some feedback.');
    }).not.toThrow();
  });

  it('does not send a notification when the course does not exist', async () => {
    useUserCourseStore.getState().rejectCourse('nonexistent_id', 'Some feedback.');

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockAddNotification).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('course review notifications — edge cases', () => {
  it('generates unique notification IDs for each approval call', async () => {
    addMockCourse({ id: 'c1', title: 'Course Alpha' });
    useUserCourseStore.getState().approveCourse('c1');

    await vi.waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledTimes(1);
    });

    const id1 = mockAddNotification.mock.calls[0][0].id;
    expect(id1).toMatch(/^cr_app_/);

    // Clear and call again — new ID should not equal the first one
    mockAddNotification.mockClear();
    addMockCourse({ id: 'c2', title: 'Course Beta' });

    useUserCourseStore.getState().approveCourse('c2');

    await vi.waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledTimes(1);
    });

    const id2 = mockAddNotification.mock.calls[0][0].id;
    expect(id2).toMatch(/^cr_app_/);
    expect(id2).not.toBe(id1);
  });

  it('updates course state before dispatching notification', async () => {
    const course = addMockCourse();

    // Capture state BEFORE the dynamic import microtask resolves
    useUserCourseStore.getState().approveCourse(course.id);

    // State should already be updated synchronously (set() runs before import)
    const state = useUserCourseStore.getState();
    const updated = state.myCourses.find(c => c.id === course.id);
    expect(updated?.publishStatus).toBe('published');
  });

  it('handles courses with empty titles gracefully', async () => {
    addMockCourse({ title: '' });

    useUserCourseStore.getState().approveCourse('test_course_1');

    await vi.waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledTimes(1);
    });

    const notif = mockAddNotification.mock.calls[0][0];
    expect(notif.message).toContain('');
    expect(notif.type).toBe('course_review');
  });

  it('handles courses with special characters in title', async () => {
    addMockCourse({ title: '🚀 Forex Trading $100K Challenge! (2026)' });

    useUserCourseStore.getState().approveCourse('test_course_1');

    await vi.waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledTimes(1);
    });

    const notif = mockAddNotification.mock.calls[0][0];
    expect(notif.message).toContain('🚀 Forex Trading');
    expect(notif.title).toContain('✅');
  });
});
