/**
 * ============================================================================
 * Toroloom — Community Zod Schemas
 * ============================================================================
 */

import { z } from 'zod';

// ──── GET /api/community/posts ─────────────────────────────────────────────

export const getPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  tag: z.string().max(64).optional(),
  sort: z.enum(['hot', 'top', 'new']).default('hot'),
  search: z.string().max(200).optional(),
});

export type GetPostsQueryInput = z.infer<typeof getPostsQuerySchema>;

// ──── GET /api/community/posts/:id ─────────────────────────────────────────

export const getPostByIdSchema = z.object({
  id: z.string().min(1).max(64),
});

export type GetPostByIdInput = z.infer<typeof getPostByIdSchema>;

// ──── POST /api/community/posts ────────────────────────────────────────────

export const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  tags: z.array(z.string().max(32)).max(10).default([]),
  title: z.string().max(200).optional(),
  imageUrl: z.string().url().max(500).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// ──── POST /api/community/posts/:id/like ───────────────────────────────────

export const likePostSchema = z.object({
  id: z.string().min(1).max(64),
});

export type LikePostInput = z.infer<typeof likePostSchema>;

// ──── POST /api/community/posts/:id/comments ───────────────────────────────

export const createCommentSchema = z.object({
  id: z.string().min(1).max(64),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// ──── POST /api/community/posts/:id/comments (body) ────────────────────────

export const createCommentBodySchema = z.object({
  content: z.string().min(1).max(2000),
});

export type CreateCommentBodyInput = z.infer<typeof createCommentBodySchema>;

// ──── GET /api/community/posts/:id/comments ────────────────────────────────

export const getCommentsSchema = z.object({
  id: z.string().min(1).max(64),
});

export type GetCommentsInput = z.infer<typeof getCommentsSchema>;
