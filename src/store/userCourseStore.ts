import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserGeneratedCourse, CourseDraftLesson, CreatorStats, Quiz, QuizQuestion } from '../types';
import { offlineCache } from '../services/offlineCache';
import { log } from '../utils/logger';

let courseIdCounter = 122; // Continue from existing mock courses
let lessonIdCounter = 220;

/** Generate a unique course ID */
function genCourseId(): string {
  return `uc_${++courseIdCounter}_${Date.now()}`;
}

/** Generate a unique lesson ID */
function genLessonId(): string {
  return `ul_${++lessonIdCounter}_${Date.now()}`;
}

interface UserCourseState {
  /** All user-generated courses owned by the current user */
  myCourses: UserGeneratedCourse[];
  /** Currently editing course (null = not editing) */
  editingCourse: UserGeneratedCourse | null;
  loading: boolean;
  saving: boolean;

  // ── Actions ──

  /** Create a new empty draft course */
  createDraft: () => UserGeneratedCourse;
  /** Save the currently editing course to myCourses */
  saveCourse: (course: UserGeneratedCourse) => void;
  /** Set the editing course */
  setEditingCourse: (course: UserGeneratedCourse | null) => void;
  /** Delete a course (with confirmation handled by UI) */
  deleteCourse: (courseId: string) => void;
  /** Duplicate a course (creates a new draft copy) */
  duplicateCourse: (courseId: string) => UserGeneratedCourse | null;
  /** Submit course for review */
  submitForReview: (courseId: string) => void;
  /** Archive a course */
  archiveCourse: (courseId: string) => void;
  /** Un-archive / restore a course */
  unarchiveCourse: (courseId: string) => void;
  /** Add a lesson to the editing course */
  addLesson: (courseId: string) => CourseDraftLesson | null;
  /** Remove a lesson from a course */
  removeLesson: (courseId: string, lessonId: string) => void;
  /** Update a lesson's fields */
  updateLesson: (courseId: string, lessonId: string, updates: Partial<CourseDraftLesson>) => void;
  /** Add a quiz to a lesson */
  addQuizToLesson: (courseId: string, lessonId: string) => void;
  /** Remove quiz from a lesson */
  removeQuizFromLesson: (courseId: string, lessonId: string) => void;
  /** Add a question to a lesson's quiz */
  addQuestionToQuiz: (courseId: string, lessonId: string) => void;
  /** Update a quiz question */
  updateQuizQuestion: (courseId: string, lessonId: string, questionId: string, updates: Partial<QuizQuestion>) => void;
  /** Remove a question from a quiz */
  removeQuestionFromQuiz: (courseId: string, lessonId: string, questionId: string) => void;
  /** Compute creator stats */
  getStats: () => CreatorStats;
  /** Load from cache on app start */
  loadFromCache: () => Promise<void>;

  // ── Admin Review Actions ──

  /** Admin: approve a submitted course and publish it */
  approveCourse: (courseId: string, notes?: string) => void;
  /** Admin: reject a submitted course with review notes */
  rejectCourse: (courseId: string, notes: string) => void;
  /** Admin: toggle featured status on a course */
  toggleFeatured: (courseId: string) => void;
  /** Get all courses pending review */
  getPendingCourses: () => UserGeneratedCourse[];
  /** Get all courses that have been reviewed (approved or rejected) */
  getReviewedCourses: () => UserGeneratedCourse[];

  // ── Community Course Enrollment ──

  /** IDs of community courses the current user has enrolled in */
  enrolledCommunityCourseIds: string[];
  /** Enroll in a community course */
  enrollInCommunityCourse: (courseId: string) => void;
  /** Unenroll from a community course */
  unenrollFromCommunityCourse: (courseId: string) => void;
  /** Check if enrolled in a community course */
  isEnrolledInCommunityCourse: (courseId: string) => boolean;
  /** Get all published community courses (from all creators) */
  getCommunityCourses: () => UserGeneratedCourse[];
}

// ─── Default Draft ─────────────────────────────────────────────

function createEmptyDraft(): UserGeneratedCourse {
  const id = genCourseId();
  return {
    id,
    title: '',
    description: '',
    thumbnail: '📚',
    duration: '0 min',
    lessonsCount: 0,
    level: 'beginner',
    category: 'Finance',
    creatorId: 'current_user',
    creatorName: 'You',
    publishStatus: 'draft',
    submittedForReview: false,
    lessons: [],
    enrolledCount: 0,
    rating: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
  };
}

export const useUserCourseStore = create<UserCourseState>()(
  persist(
    (set, get) => ({
      myCourses: [],
      editingCourse: null,
      loading: false,
      saving: false,
      enrolledCommunityCourseIds: [],

      createDraft: () => {
        const draft = createEmptyDraft();
        set(state => ({ myCourses: [...state.myCourses, draft] }));
        return draft;
      },

      saveCourse: (course) => {
        const now = new Date().toISOString();
        const updated = { ...course, updatedAt: now };
        set(state => ({
          myCourses: state.myCourses.map(c => c.id === updated.id ? updated : c),
          editingCourse: updated,
        }));
        // Persist to offline cache
        offlineCache.save('userCourses', { courses: get().myCourses }).catch(() => {});
      },

      setEditingCourse: (course) => set({ editingCourse: course }),

      deleteCourse: (courseId) => {
        set(state => ({
          myCourses: state.myCourses.filter(c => c.id !== courseId),
          editingCourse: state.editingCourse?.id === courseId ? null : state.editingCourse,
        }));
        offlineCache.save('userCourses', { courses: get().myCourses }).catch(() => {});
      },

      duplicateCourse: (courseId) => {
        const source = get().myCourses.find(c => c.id === courseId);
        if (!source) return null;
        const { id: _id, createdAt: _created, publishedAt: _pub, ...rest } = source;
        const dup: UserGeneratedCourse = {
          ...rest,
          id: genCourseId(),
          title: `${source.title} (Copy)` as string,
          publishStatus: 'draft',
          submittedForReview: false,
          enrolledCount: 0,
          rating: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lessons: source.lessons?.map(l => ({
            ...l,
            id: genLessonId(),
          })),
        };
        set(state => ({ myCourses: [...state.myCourses, dup] }));
        offlineCache.save('userCourses', { courses: get().myCourses }).catch(() => {});
        return dup;
      },

      submitForReview: (courseId) => {
        set(state => ({
          myCourses: state.myCourses.map(c =>
            c.id === courseId
              ? { ...c, submittedForReview: true, updatedAt: new Date().toISOString() }
              : c
          ),
          editingCourse: state.editingCourse?.id === courseId
            ? { ...state.editingCourse, submittedForReview: true, updatedAt: new Date().toISOString() }
            : state.editingCourse,
        }));
      },

      archiveCourse: (courseId) => {
        set(state => ({
          myCourses: state.myCourses.map(c =>
            c.id === courseId
              ? { ...c, publishStatus: 'archived', updatedAt: new Date().toISOString() }
              : c
          ),
        }));
      },

      unarchiveCourse: (courseId) => {
        set(state => ({
          myCourses: state.myCourses.map(c =>
            c.id === courseId
              ? { ...c, publishStatus: 'draft', updatedAt: new Date().toISOString() }
              : c
          ),
        }));
      },

      addLesson: (courseId) => {
        const lesson: CourseDraftLesson = {
          id: genLessonId(),
          title: '',
          content: '',
          duration: '5 min',
        };
        set(state => ({
          myCourses: state.myCourses.map(c =>
            c.id === courseId
              ? {
                  ...c,
                  lessons: [...(c.lessons || []), lesson],
                  lessonsCount: (c.lessons?.length || 0) + 1,
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
          editingCourse: state.editingCourse?.id === courseId
            ? {
                ...state.editingCourse,
                lessons: [...(state.editingCourse.lessons || []), lesson],
                lessonsCount: (state.editingCourse.lessons?.length || 0) + 1,
                updatedAt: new Date().toISOString(),
              }
            : state.editingCourse,
        }));
        return lesson;
      },

      removeLesson: (courseId, lessonId) => {
        set(state => {
          const removeFromCourse = (c: UserGeneratedCourse) => ({
            ...c,
            lessons: (c.lessons || []).filter(l => l.id !== lessonId),
            lessonsCount: Math.max(0, (c.lessons?.length || 0) - 1),
            updatedAt: new Date().toISOString(),
          });
          return {
            myCourses: state.myCourses.map(c => c.id === courseId ? removeFromCourse(c) : c),
            editingCourse: state.editingCourse?.id === courseId
              ? removeFromCourse(state.editingCourse)
              : state.editingCourse,
          };
        });
      },

      updateLesson: (courseId, lessonId, updates) => {
        set(state => {
          const updateInCourse = (c: UserGeneratedCourse) => ({
            ...c,
            lessons: (c.lessons || []).map(l =>
              l.id === lessonId ? { ...l, ...updates } : l
            ),
            updatedAt: new Date().toISOString(),
          });
          return {
            myCourses: state.myCourses.map(c => c.id === courseId ? updateInCourse(c) : c),
            editingCourse: state.editingCourse?.id === courseId
              ? updateInCourse(state.editingCourse)
              : state.editingCourse,
          };
        });
      },

      addQuizToLesson: (courseId, lessonId) => {
        const newQuiz: Quiz = {
          id: `qz_${Date.now()}`,
          title: 'Untitled Quiz',
          questions: [
            {
              id: `qq_${Date.now()}_1`,
              question: '',
              options: ['', '', '', ''],
              correctAnswer: 0,
              explanation: '',
            },
          ],
          score: 0,
          passed: false,
        };
        set(state => {
          const addQuiz = (c: UserGeneratedCourse) => ({
            ...c,
            lessons: (c.lessons || []).map(l =>
              l.id === lessonId ? { ...l, quiz: newQuiz } : l
            ),
            updatedAt: new Date().toISOString(),
          });
          return {
            myCourses: state.myCourses.map(c => c.id === courseId ? addQuiz(c) : c),
            editingCourse: state.editingCourse?.id === courseId
              ? addQuiz(state.editingCourse)
              : state.editingCourse,
          };
        });
      },

      removeQuizFromLesson: (courseId, lessonId) => {
        set(state => {
          const removeQuiz = (c: UserGeneratedCourse) => ({
            ...c,
            lessons: (c.lessons || []).map(l =>
              l.id === lessonId ? { ...l, quiz: undefined } : l
            ),
            updatedAt: new Date().toISOString(),
          });
          return {
            myCourses: state.myCourses.map(c => c.id === courseId ? removeQuiz(c) : c),
            editingCourse: state.editingCourse?.id === courseId
              ? removeQuiz(state.editingCourse)
              : state.editingCourse,
          };
        });
      },

      addQuestionToQuiz: (courseId, lessonId) => {
        const newQuestion: QuizQuestion = {
          id: `qq_${Date.now()}`,
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 0,
          explanation: '',
        };
        set(state => {
          const addQ = (c: UserGeneratedCourse) => ({
            ...c,
            lessons: (c.lessons || []).map(l =>
              l.id === lessonId && l.quiz
                ? { ...l, quiz: { ...l.quiz, questions: [...l.quiz.questions, newQuestion] } }
                : l
            ),
            updatedAt: new Date().toISOString(),
          });
          return {
            myCourses: state.myCourses.map(c => c.id === courseId ? addQ(c) : c),
            editingCourse: state.editingCourse?.id === courseId
              ? addQ(state.editingCourse)
              : state.editingCourse,
          };
        });
      },

      updateQuizQuestion: (courseId, lessonId, questionId, updates) => {
        set(state => {
          const updateQ = (c: UserGeneratedCourse) => ({
            ...c,
            lessons: (c.lessons || []).map(l =>
              l.id === lessonId && l.quiz
                ? {
                    ...l,
                    quiz: {
                      ...l.quiz,
                      questions: l.quiz.questions.map(q =>
                        q.id === questionId ? { ...q, ...updates } : q
                      ),
                    },
                  }
                : l
            ),
            updatedAt: new Date().toISOString(),
          });
          return {
            myCourses: state.myCourses.map(c => c.id === courseId ? updateQ(c) : c),
            editingCourse: state.editingCourse?.id === courseId
              ? updateQ(state.editingCourse)
              : state.editingCourse,
          };
        });
      },

      removeQuestionFromQuiz: (courseId, lessonId, questionId) => {
        set(state => {
          const removeQ = (c: UserGeneratedCourse) => ({
            ...c,
            lessons: (c.lessons || []).map(l =>
              l.id === lessonId && l.quiz
                ? { ...l, quiz: { ...l.quiz, questions: l.quiz.questions.filter(q => q.id !== questionId) } }
                : l
            ),
            updatedAt: new Date().toISOString(),
          });
          return {
            myCourses: state.myCourses.map(c => c.id === courseId ? removeQ(c) : c),
            editingCourse: state.editingCourse?.id === courseId
              ? removeQ(state.editingCourse)
              : state.editingCourse,
          };
        });
      },

      getStats: () => {
        const { myCourses } = get();
        const published = myCourses.filter(c => c.publishStatus === 'published');
        return {
          totalCourses: myCourses.length,
          publishedCourses: published.length,
          draftCourses: myCourses.filter(c => c.publishStatus === 'draft').length,
          totalEnrollments: myCourses.reduce((sum, c) => sum + c.enrolledCount, 0),
          totalLessons: myCourses.reduce((sum, c) => sum + c.lessonsCount, 0),
          averageRating: published.length > 0
            ? published.reduce((sum, c) => sum + c.rating, 0) / published.length
            : 0,
          totalEarnings: 0, // No monetization yet
        };
      },

      loadFromCache: async () => {
        try {
          const cached = await offlineCache.load<{ courses: UserGeneratedCourse[] }>('userCourses');
          if (cached) {
            set({ myCourses: cached.data.courses });
          }
        } catch (err) {
          log.info('[UserCourseStore] No cached courses found');
        }
      },

      // ── Admin Review Actions ──

      approveCourse: (courseId, notes) => {
        const now = new Date().toISOString();
        const course = get().myCourses.find(c => c.id === courseId);
        set(state => ({
          myCourses: state.myCourses.map(c =>
            c.id === courseId
              ? {
                  ...c,
                  publishStatus: 'published',
                  submittedForReview: false,
                  reviewNotes: notes || undefined,
                  publishedAt: now,
                  updatedAt: now,
                }
              : c
          ),
        }));
        offlineCache.save('userCourses', { courses: get().myCourses }).catch(() => {});

        // Send in-app + push notification about the approval
        if (course) {
          import('./notificationStore').then(({ useNotificationStore }) => {
            useNotificationStore.getState().addNotification({
              id: `cr_app_${Date.now()}`,
              type: 'course_review',
              title: '✅ Course Approved!',
              message: `Your course "${course.title}" has been approved and is now published! 🎉`,
              read: false,
              timestamp: new Date().toISOString(),
              data: { courseId, action: 'approved', courseTitle: course.title },
            });
          }).catch(() => {});
        }
      },

      rejectCourse: (courseId, notes) => {
        const now = new Date().toISOString();
        const course = get().myCourses.find(c => c.id === courseId);
        set(state => ({
          myCourses: state.myCourses.map(c =>
            c.id === courseId
              ? {
                  ...c,
                  submittedForReview: false,
                  publishStatus: 'draft',
                  reviewNotes: notes,
                  updatedAt: now,
                }
              : c
          ),
        }));
        offlineCache.save('userCourses', { courses: get().myCourses }).catch(() => {});

        // Send in-app + push notification about the rejection
        if (course) {
          import('./notificationStore').then(({ useNotificationStore }) => {
            useNotificationStore.getState().addNotification({
              id: `cr_rej_${Date.now()}`,
              type: 'course_review',
              title: '📝 Course Update — Needs Changes',
              message: `Your course "${course.title}" was not approved. Feedback: ${notes}`,
              read: false,
              timestamp: new Date().toISOString(),
              data: { courseId, action: 'rejected', courseTitle: course.title, reviewNotes: notes },
            });
          }).catch(() => {});
        }
      },

      toggleFeatured: (courseId) => {
        set(state => ({
          myCourses: state.myCourses.map(c =>
            c.id === courseId
              ? { ...c, isFeatured: !c.isFeatured, updatedAt: new Date().toISOString() }
              : c
          ),
        }));
        offlineCache.save('userCourses', { courses: get().myCourses }).catch(() => {});
      },

      getPendingCourses: () => {
        return get().myCourses.filter(c => c.submittedForReview && c.publishStatus === 'draft');
      },

      getReviewedCourses: () => {
        return get().myCourses.filter(c =>
          c.publishStatus === 'published' ||
          (c.publishStatus === 'draft' && !c.submittedForReview && (c.reviewNotes || c.publishedAt))
        );
      },

      // ── Community Course Enrollment ──

      enrollInCommunityCourse: (courseId) => {
        const already = get().enrolledCommunityCourseIds.includes(courseId);
        if (already) return;
        set(state => ({
          enrolledCommunityCourseIds: [...state.enrolledCommunityCourseIds, courseId],
          myCourses: state.myCourses.map(c =>
            c.id === courseId
              ? { ...c, enrolledCount: c.enrolledCount + 1, updatedAt: new Date().toISOString() }
              : c
          ),
        }));
        offlineCache.save('userCourses', { courses: get().myCourses }).catch(() => {});
      },

      unenrollFromCommunityCourse: (courseId) => {
        set(state => ({
          enrolledCommunityCourseIds: state.enrolledCommunityCourseIds.filter(id => id !== courseId),
          myCourses: state.myCourses.map(c =>
            c.id === courseId
              ? { ...c, enrolledCount: Math.max(0, c.enrolledCount - 1), updatedAt: new Date().toISOString() }
              : c
          ),
        }));
        offlineCache.save('userCourses', { courses: get().myCourses }).catch(() => {});
      },

      isEnrolledInCommunityCourse: (courseId) => {
        return get().enrolledCommunityCourseIds.includes(courseId);
      },

      getCommunityCourses: () => {
        return get().myCourses.filter(c => c.publishStatus === 'published');
      },
    }),
    {
      name: 'toroloom-user-courses',
      partialize: (state) => ({
        myCourses: state.myCourses,
        enrolledCommunityCourseIds: state.enrolledCommunityCourseIds,
      }),
    }
  )
);
