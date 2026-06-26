import { create } from 'zustand';
import { Course, Lesson } from '../types';
import { mockCourses, mockLessons } from '../constants/mockData';
import { educationApi } from '../services/api';
import { offlineCache } from '../services/offlineCache';
import { log } from '../utils/logger';
import { sendEducationalReminder } from '../services/notificationService';

interface EducationState {
  courses: Course[];
  currentLesson: Lesson | null;
  lessonProgress: Record<string, boolean>;
  isLoading: boolean;
  fetchCourses: () => Promise<void>;
  fetchLesson: (lessonId: string) => Promise<void>;
  loadCachedCourses: () => Promise<void>;
  enrollInCourse: (courseId: string) => void;
  markLessonComplete: (lessonId: string) => Promise<void>;
  setCurrentLesson: (lesson: Lesson | null) => void;
  scheduleDailyReminder: () => Promise<void>;
}

export const useEducationStore = create<EducationState>((set, get) => ({
  courses: mockCourses,
  currentLesson: null,
  lessonProgress: {},
  isLoading: false,

  /** Load cached courses at app startup for instant display */
  loadCachedCourses: async () => {
    const cached = await offlineCache.load<{ courses: Course[] }>('education');
    if (cached) {
      set({ courses: cached.data.courses });
    }
  },

  fetchCourses: async () => {
    set({ isLoading: true });
    try {
      const courses = await educationApi.getCourses();
      await offlineCache.save('education', { courses });
      set({ courses, isLoading: false });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<{ courses: Course[] }>('education');
      if (cached) {
        set({ courses: cached.data.courses, isLoading: false });
        log.info('[Education] Serving stale cached courses');
        return;
      }
      set({ isLoading: false });
    }
  },

  fetchLesson: async (lessonId) => {
    set({ isLoading: true });
    try {
      const lesson = await educationApi.getLesson(lessonId);
      set({ currentLesson: lesson, isLoading: false });
    } catch {
      // Fall back to local mock data
      const lesson = mockLessons.find(l => l.id === lessonId);
      if (lesson) set({ currentLesson: lesson });
      set({ isLoading: false });
    }
  },

  enrollInCourse: (_courseId) => {
    // Enroll logic — no backend endpoint yet
  },

  markLessonComplete: async (lessonId) => {
    // Try backend first
    try {
      await educationApi.markLessonProgress(lessonId);
    } catch {
      // Backend unavailable — update locally
    }

    set(state => {
      const newProgress = { ...state.lessonProgress, [lessonId]: true };
      const totalLessons = state.courses.reduce((sum, c) => sum + c.lessons, 0);
      const completedCount = Object.keys(newProgress).length;

      return {
        lessonProgress: newProgress,
        courses: state.courses.map(c => ({
          ...c,
          progress: c.lessons > 0
            ? Math.min(100, Math.round((completedCount / totalLessons) * 100))
            : 0,
        })),
      };
    });

    // Send notification
    const state = get();
    const allLessons = state.courses.flatMap(c =>
      mockLessons?.filter(l => l.courseId === c.id) || []
    );
    const lesson = allLessons.find(l => l.id === lessonId);
    if (lesson) {
      const course = state.courses.find(c => c.id === lesson.courseId);
      if (course) {
        sendEducationalReminder(course.title, lesson.title, 'new_lesson');
      }
    }
  },

  setCurrentLesson: (lesson) => set({ currentLesson: lesson }),

  scheduleDailyReminder: async () => {
    const { useNotificationStore } = await import('./notificationStore');
    useNotificationStore.getState().addNotification({
      id: `rem_${Date.now()}`,
      type: 'educational',
      title: '📚 Daily Learning Reminder',
      message: 'Time for your daily stock market lesson! Keep learning and growing.',
      read: false,
      timestamp: new Date().toISOString(),
    });
  },
}));
