import { create } from 'zustand';
import { Course, Lesson, VideoProgress, VideoBookmark, CourseCertificate, QuizResult } from '../types';
import { mockCourses, mockLessons } from '../constants/mockData';
import { educationApi } from '../services/api/education';
import { offlineCache } from '../services/offlineCache';
import { log } from '../utils/logger';
import { sendEducationalReminder } from '../services/notificationService';

interface EducationState {
  courses: Course[];
  currentLesson: Lesson | null;
  lessonProgress: Record<string, boolean>;
  /** Video playback progress per lesson */
  videoProgress: Record<string, VideoProgress>;
  /** Video bookmarks per lesson */
  videoBookmarks: Record<string, VideoBookmark[]>;
  /** Certificates issued for completed courses */
  certificates: CourseCertificate[];
  /** Whether a certificate PDF generation is in progress */
  isGeneratingCertificate: boolean;
  isLoading: boolean;
  fetchCourses: () => Promise<void>;
  fetchLesson: (lessonId: string) => Promise<void>;
  loadCachedCourses: () => Promise<void>;
  enrollInCourse: (courseId: string) => void;
  markLessonComplete: (lessonId: string) => Promise<void>;
  setCurrentLesson: (lesson: Lesson | null) => void;
  scheduleDailyReminder: () => Promise<void>;
  /** Update video playback progress for a lesson */
  updateVideoProgress: (lessonId: string, progress: { lastPosition: number; duration: number; watchedPercent: number }) => void;
  /** Add a bookmark at a specific timestamp in a video */
  addVideoBookmark: (lessonId: string, time: number, label: string) => void;
  /** Delete a bookmark */
  deleteVideoBookmark: (lessonId: string, bookmarkId: string) => void;
  /** Generate a certificate for a completed course */
  generateCertificate: (courseId: string) => Promise<CourseCertificate | null>;
  /** Get certificate for a specific course */
  getCertificateForCourse: (courseId: string) => CourseCertificate | undefined;
  /** Quiz attempt history per lesson */
  quizHistory: Record<string, QuizResult[]>;
  /** Record a quiz attempt result */
  recordQuizAttempt: (lessonId: string, result: QuizResult) => void;
  /** Get best quiz result for a lesson */
  getBestQuizResult: (lessonId: string) => QuizResult | undefined;
  /** Get all quiz attempts for a lesson */
  getQuizAttempts: (lessonId: string) => QuizResult[];
  /** Get aggregated quiz stats across all attempts */
  getOverallQuizStats: () => { totalAttempts: number; avgScore: number; quizzesPassed: number; totalQuizzes: number };
  /** Check if a course is eligible for a certificate */
  isCourseComplete: (courseId: string) => boolean;
}

let bookmarkIdCounter = 0;

export const useEducationStore = create<EducationState>((set, get) => ({
  courses: mockCourses,
  currentLesson: null,
  lessonProgress: {},
  videoProgress: {},
  videoBookmarks: {},
  certificates: [],
  isGeneratingCertificate: false,
  isLoading: false,
  quizHistory: {},

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

  /** Update video playback progress for a lesson */
  updateVideoProgress: (lessonId, { lastPosition, duration, watchedPercent }) => {
    set(state => ({
      videoProgress: {
        ...state.videoProgress,
        [lessonId]: {
          lessonId,
          lastPosition,
          duration,
          watchedPercent,
          completed: watchedPercent >= 95,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  },

  /** Add a bookmark at a specific timestamp */
  addVideoBookmark: (lessonId, time, label) => {
    const bookmarkId = `bm_${++bookmarkIdCounter}_${Date.now()}`;
    set(state => {
      const existing = state.videoBookmarks[lessonId] || [];
      return {
        videoBookmarks: {
          ...state.videoBookmarks,
          [lessonId]: [
            ...existing,
            { id: bookmarkId, lessonId, time, label, createdAt: new Date().toISOString() },
          ],
        },
      };
    });
  },

  /** Delete a bookmark */
  deleteVideoBookmark: (lessonId, bookmarkId) => {
    set(state => {
      const existing = state.videoBookmarks[lessonId] || [];
      return {
        videoBookmarks: {
          ...state.videoBookmarks,
          [lessonId]: existing.filter(b => b.id !== bookmarkId),
        },
      };
    });
  },

  /** Record a quiz attempt result */
  recordQuizAttempt: (lessonId, result) => {
    set(state => {
      const existing = state.quizHistory[lessonId] || [];
      return {
        quizHistory: {
          ...state.quizHistory,
          [lessonId]: [...existing, result],
        },
      };
    });
  },

  /** Get best quiz result for a lesson */
  getBestQuizResult: (lessonId) => {
    const attempts = get().quizHistory[lessonId] || [];
    if (attempts.length === 0) return undefined;
    return attempts.reduce((best, curr) =>
      curr.percentage > best.percentage ? curr : best
    );
  },

  /** Get all quiz attempts for a lesson */
  getQuizAttempts: (lessonId) => {
    return get().quizHistory[lessonId] || [];
  },

  /** Get aggregated quiz stats across all attempts */
  getOverallQuizStats: () => {
    const state = get();
    const allAttempts = Object.values(state.quizHistory).flat();
    const totalAttempts = allAttempts.length;
    const avgScore = totalAttempts > 0
      ? Math.round(allAttempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts)
      : 0;
    const quizzesPassed = allAttempts.filter(a => a.passed).length;
    
    // Count unique quiz IDs that have at least one attempt
    const uniqueQuizIds = new Set(allAttempts.map(a => a.quizId));
    
    return {
      totalAttempts,
      avgScore,
      quizzesPassed,
      totalQuizzes: uniqueQuizIds.size,
    };
  },

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

  /** Check if a course has all its lessons completed */
  isCourseComplete: (courseId) => {
    const state = get();
    const courseLessons = mockLessons.filter(l => l.courseId === courseId);
    if (courseLessons.length === 0) return false;
    return courseLessons.every(l => state.lessonProgress[l.id] || l.completed);
  },

  /** Get certificate for a specific course */
  getCertificateForCourse: (courseId) => {
    return get().certificates.find(c => c.courseId === courseId);
  },

  /** Generate a certificate for a completed course */
  generateCertificate: async (courseId) => {
    const state = get();
    const course = state.courses.find(c => c.id === courseId);
    if (!course) return null;

    // Check if already generated
    const existing = state.certificates.find(c => c.courseId === courseId);
    if (existing) return existing;

    // Verify course is complete
    const courseLessons = mockLessons.filter(l => l.courseId === courseId);
    const completedCount = courseLessons.filter(l => state.lessonProgress[l.id] || l.completed).length;
    if (completedCount < course.lessons) return null;

    set({ isGeneratingCertificate: true });

    try {
      // Calculate quiz performance
      let totalQuizCorrect = 0;
      let totalQuizQuestions = 0;
      for (const lesson of courseLessons) {
        if (lesson.quiz) {
          for (const _q of lesson.quiz.questions) {
            totalQuizQuestions++;
            // In real app, track actual answers; here use lesson.quiz.score as proxy
          }
          if (lesson.quiz.score !== undefined) {
            const correct = Math.round((lesson.quiz.score / 100) * lesson.quiz.questions.length);
            totalQuizCorrect += correct;
          }
        }
      }
      const quizPercent = totalQuizQuestions > 0
        ? Math.round((totalQuizCorrect / totalQuizQuestions) * 100)
        : undefined;

      const { generateSerialNumber, calculateGrade, generateCertificatePDF } = await import('../utils/certificateGenerator');

      const cert: CourseCertificate = {
        id: `cert_${courseId}_${Date.now()}`,
        courseId,
        courseTitle: course.title,
        userName: 'Student', // Will be replaced with actual user name
        completedLessons: completedCount,
        totalLessons: course.lessons,
        grade: calculateGrade(quizPercent),
        quizScore: totalQuizCorrect,
        quizPercent,
        issuedAt: new Date().toISOString(),
        serialNumber: generateSerialNumber(),
      };

      // Generate PDF in background
      const pdfUri = await generateCertificatePDF(cert);

      const finalCert: CourseCertificate = {
        ...cert,
        pdfUri: pdfUri || undefined,
      };

      set(state => ({
        certificates: [...state.certificates, finalCert],
        isGeneratingCertificate: false,
      }));

      return finalCert;
    } catch (error) {
      console.error('[EducationStore] Certificate generation failed:', error);
      set({ isGeneratingCertificate: false });
      return null;
    }
  },
}));
