import { api } from './client';
import type { Course, Lesson } from '../../types';

export interface CourseDetail extends Course {
  lessonList: Lesson[];
}

export const educationApi = {
  getCourses: () => api.get<Course[]>('/education/courses'),

  getCourse: (courseId: string) =>
    api.get<CourseDetail>(`/education/courses/${courseId}`),

  getLesson: (lessonId: string) =>
    api.get<Lesson>(`/education/lessons/${lessonId}`),

  markLessonProgress: (lessonId: string) =>
    api.put<Lesson>(`/education/lessons/${lessonId}/progress`),
};
