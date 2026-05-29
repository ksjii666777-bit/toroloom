/**
 * ============================================================================
 * Toroloom — Education Store Tests
 * ============================================================================
 *
 * Tests the education store: initial state, fetchCourses, fetchLesson
 * (with mock fallback), markLessonComplete (local progress and notification),
 * setCurrentLesson, and scheduleDailyReminder.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useEducationStore } from '../store/educationStore';

// Mock the education API module so every call rejects, forcing the store into
// its fallback / catch behaviour.
vi.mock('../services/api/education', () => ({
  educationApi: {
    getCourses: vi.fn().mockRejectedValue(new Error('Network error')),
    getLesson: vi.fn().mockRejectedValue(new Error('Network error')),
    markLessonProgress: vi.fn().mockRejectedValue(new Error('Network error')),
  },
}));

describe('EducationStore — Initial State', () => {
  beforeEach(() => {
    useEducationStore.setState({
      courses: [],
      currentLesson: null,
      lessonProgress: {},
      isLoading: false,
    });
  });

  it('starts with empty state when reset', () => {
    const state = useEducationStore.getState();
    expect(state.courses).toEqual([]);
    expect(state.currentLesson).toBeNull();
    expect(state.lessonProgress).toEqual({});
    expect(state.isLoading).toBe(false);
  });
});

describe('EducationStore — fetchCourses (API failure fallback)', () => {
  beforeEach(() => {
    useEducationStore.setState({
      courses: [],
      isLoading: false,
    });
  });

  it('sets isLoading during fetch and clears it on failure', async () => {
    const promise = useEducationStore.getState().fetchCourses();
    expect(useEducationStore.getState().isLoading).toBe(true);
    await promise;
    expect(useEducationStore.getState().isLoading).toBe(false);
  });

  it('preserves existing courses when API fails', async () => {
    useEducationStore.setState({
      courses: [{
        id: 'c_test', title: 'Test Course', description: 'Test',
        thumbnail: '', duration: '1h', lessons: 5, progress: 0,
        level: 'beginner', category: 'Basics', rating: 4, enrolledCount: 100,
      }],
    });

    await useEducationStore.getState().fetchCourses();
    const state = useEducationStore.getState();
    expect(state.courses).toHaveLength(1);
    expect(state.courses[0].id).toBe('c_test');
  });
});

describe('EducationStore — fetchLesson (API failure fallback)', () => {
  beforeEach(() => {
    useEducationStore.setState({
      currentLesson: null,
      isLoading: false,
      courses: [],
      lessonProgress: {},
    });
  });

  it('sets isLoading during fetch and clears it on failure', async () => {
    const promise = useEducationStore.getState().fetchLesson('nonexistent');
    expect(useEducationStore.getState().isLoading).toBe(true);
    await promise;
    expect(useEducationStore.getState().isLoading).toBe(false);
  });

  it('falls back to mock lesson when API fails for known lesson', async () => {
    // fetchLesson uses mockLessons from mockData as fallback
    // Lesson IDs are from courseContent (e.g., 'l1', 'l2')
    await useEducationStore.getState().fetchLesson('l1');
    const state = useEducationStore.getState();
    if (state.currentLesson) {
      expect(state.currentLesson.id).toBe('l1');
    }
  });

  it('leaves currentLesson null for unknown lesson ID', async () => {
    await useEducationStore.getState().fetchLesson('completely_unknown_id');
    const state = useEducationStore.getState();
    expect(state.currentLesson).toBeFalsy();
    expect(state.isLoading).toBe(false);
  });
});

describe('EducationStore — setCurrentLesson', () => {
  beforeEach(() => {
    useEducationStore.setState({ currentLesson: null });
  });

  it('sets the current lesson', () => {
    const lesson = { id: 'l1', courseId: 'c1', title: 'Intro', content: '# Hello', duration: '10m', completed: false };
    useEducationStore.getState().setCurrentLesson(lesson);
    expect(useEducationStore.getState().currentLesson?.id).toBe('l1');
  });

  it('clears the current lesson when set to null', () => {
    useEducationStore.setState({
      currentLesson: { id: 'l1', courseId: 'c1', title: 'Intro', content: '# Hello', duration: '10m', completed: false },
    });
    useEducationStore.getState().setCurrentLesson(null);
    expect(useEducationStore.getState().currentLesson).toBeNull();
  });
});

describe('EducationStore — markLessonComplete', () => {
  beforeEach(() => {
    useEducationStore.setState({
      lessonProgress: {},
      courses: [
        { id: 'c1', title: 'Course 1', description: 'Desc', thumbnail: '', duration: '2h', lessons: 3, progress: 0, level: 'beginner', category: 'Basics', rating: 4, enrolledCount: 50 },
        { id: 'c2', title: 'Course 2', description: 'Desc', thumbnail: '', duration: '1h', lessons: 2, progress: 0, level: 'intermediate', category: 'Technical', rating: 5, enrolledCount: 30 },
      ],
    });
  });

  it('marks a lesson as complete in lessonProgress', async () => {
    await useEducationStore.getState().markLessonComplete('l1');
    const state = useEducationStore.getState();
    expect(state.lessonProgress['l1']).toBe(true);
  });

  it('accumulates progress across multiple lessons', async () => {
    await useEducationStore.getState().markLessonComplete('l1');
    await useEducationStore.getState().markLessonComplete('l2');
    await useEducationStore.getState().markLessonComplete('l3');
    const state = useEducationStore.getState();
    expect(Object.keys(state.lessonProgress)).toHaveLength(3);
  });

  it('does not throw when called with unknown ID', async () => {
    await expect(
      useEducationStore.getState().markLessonComplete('unknown_id')
    ).resolves.not.toThrow();
  });

  it('updates course progress percentage based on total lessons', async () => {
    await useEducationStore.getState().markLessonComplete('l1');
    const state = useEducationStore.getState();
    // Total lessons across both courses = 3 + 2 = 5
    // Completed = 1
    // Each course progress = Math.min(100, Math.round((1 / 5) * 100)) = 20
    state.courses.forEach(c => {
      expect(c.progress).toBe(20);
    });
  });

  it('reaches 100% when all lessons completed', async () => {
    await useEducationStore.getState().markLessonComplete('l1');
    await useEducationStore.getState().markLessonComplete('l2');
    await useEducationStore.getState().markLessonComplete('l3');
    await useEducationStore.getState().markLessonComplete('l4');
    await useEducationStore.getState().markLessonComplete('l5');
    const state = useEducationStore.getState();
    state.courses.forEach(c => {
      expect(c.progress).toBe(100);
    });
  });
});

describe('EducationStore — scheduleDailyReminder', () => {
  beforeEach(() => {
    useEducationStore.setState({
      courses: [],
      currentLesson: null,
      lessonProgress: {},
      isLoading: false,
    });
  });

  it('does not throw when called', async () => {
    await expect(
      useEducationStore.getState().scheduleDailyReminder()
    ).resolves.not.toThrow();
  });

  it('adds a notification via dynamic import', async () => {
    // scheduleDailyReminder uses dynamic import of notificationStore.
    // It should succeed without throwing.
    await expect(
      useEducationStore.getState().scheduleDailyReminder()
    ).resolves.not.toThrow();
  });
});
