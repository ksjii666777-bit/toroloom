/**
 * ============================================================================
 * Toroloom — GDPR Zod Schemas
 * ============================================================================
 *
 * Request validation schemas for GDPR endpoints.
 * Reference: GDPR Articles 15, 17, 20
 * ============================================================================
 */

import { z } from 'zod';

// ──── POST /api/gdpr/export ────────────────────────────────────────────────

export const exportDataSchema = z.object({
  /** Format of the export: json, csv */
  format: z.enum(['json', 'csv']).default('json'),
  /** Specific data categories to export (empty = all) */
  categories: z.array(z.enum([
    'profile',
    'portfolio',
    'tradeHistory',
    'watchlists',
    'subscription',
    'notifications',
    'apiKeys',
    'community',
    'education',
    'analytics',
  ])).default([]),
});

export type ExportDataInput = z.infer<typeof exportDataSchema>;

// ──── POST /api/gdpr/delete ────────────────────────────────────────────────

export const deleteDataSchema = z.object({
  /** User must confirm deletion with their email */
  confirmEmail: z.string().email(),
  /** Explicit confirmation flag */
  confirmDeletion: z.literal(true),
  /** Optional reason for deletion */
  reason: z.string().max(500).optional(),
});

export type DeleteDataInput = z.infer<typeof deleteDataSchema>;

// ──── POST /api/gdpr/check-retention ───────────────────────────────────────

export const checkRetentionSchema = z.object({});

export type CheckRetentionInput = z.infer<typeof checkRetentionSchema>;
