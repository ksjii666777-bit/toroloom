/**
 * ============================================================================
 * Toroloom — Subscription Zod Schemas
 * ============================================================================
 */

import { z } from 'zod';

const planIdEnum = z.enum(['plan_free', 'plan_pro', 'plan_elite']);
const billingPeriodEnum = z.enum(['monthly', 'yearly']);

// ──── POST /api/subscriptions/upgrade ──────────────────────────────────────

export const upgradeSubscriptionSchema = z.object({
  planId: planIdEnum,
  billingPeriod: billingPeriodEnum.default('monthly'),
  razorpayOrderId: z.string().max(64).optional(),
  tenantId: z.string().max(64).optional(),
});

export type UpgradeSubscriptionInput = z.infer<typeof upgradeSubscriptionSchema>;

// ──── POST /api/subscriptions/cancel ───────────────────────────────────────

export const cancelSubscriptionSchema = z.object({});

export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;

// ──── POST /api/subscriptions/check-feature ────────────────────────────────

export const checkFeatureSchema = z.object({
  feature: z.string().min(1).max(64),
});

export type CheckFeatureInput = z.infer<typeof checkFeatureSchema>;
