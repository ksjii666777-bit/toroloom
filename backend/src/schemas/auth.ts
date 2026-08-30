/**
 * ============================================================================
 * Toroloom — Auth Zod Schemas
 * ============================================================================
 */

import { z } from 'zod';

// ──── POST /api/auth/login ─────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ──── POST /api/auth/signup ────────────────────────────────────────────────

export const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  phone: z.string().min(10).max(15),
  password: z.string().min(6).max(128),
});

export type SignupInput = z.infer<typeof signupSchema>;
