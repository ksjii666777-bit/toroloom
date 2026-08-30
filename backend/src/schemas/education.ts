/**
 * ============================================================================
 * Toroloom — Education Zod Schemas
 * ============================================================================
 */

import { z } from 'zod';

// ──── GET /api/education/courses ───────────────────────────────────────────

export const getCoursesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().max(64).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

export type GetCoursesQueryInput = z.infer<typeof getCoursesQuerySchema>;

// ──── GET /api/education/courses/:id ───────────────────────────────────────

export const getCourseByIdSchema = z.object({
  id: z.string().min(1).max(64),
});

export type GetCourseByIdInput = z.infer<typeof getCourseByIdSchema>;

// ──── GET /api/education/lessons/:id ───────────────────────────────────────

export const getLessonByIdSchema = z.object({
  id: z.string().min(1).max(64),
});

export type GetLessonByIdInput = z.infer<typeof getLessonByIdSchema>;

// ──── PUT /api/education/lessons/:id/progress ──────────────────────────────

export const updateLessonProgressSchema = z.object({
  id: z.string().min(1).max(64),
});

export type UpdateLessonProgressInput = z.infer<typeof updateLessonProgressSchema>;

// ──── PUT /api/education/lessons/:id/progress (body) ───────────────────────

export const updateLessonProgressBodySchema = z.object({
  completed: z.boolean().default(true),
  score: z.number().min(0).max(100).optional(),
  timeSpentSeconds: z.number().int().min(0).optional(),
});

export type UpdateLessonProgressBodyInput = z.infer<typeof updateLessonProgressBodySchema>;
