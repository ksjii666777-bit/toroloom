/**
 * ============================================================================
 * Toroloom — Payment Zod Schemas
 * ============================================================================
 *
 * Request validation schemas for all payment endpoints.
 * Keeps validation logic separate from route handlers.
 *
 * ============================================================================
 */

import { z } from 'zod';

// ──── Shared ────────────────────────────────────────────────────────────────

const planIdEnum = z.enum(['plan_pro', 'plan_elite']);
const billingPeriodEnum = z.enum(['monthly', 'yearly']);
const currencyEnum = z.enum(['INR', 'USD', 'EUR', 'GBP']);

// ──── POST /api/payments/create-order ──────────────────────────────────────

export const createOrderSchema = z.object({
  planId: planIdEnum,
  billingPeriod: billingPeriodEnum.default('monthly'),
  tenantId: z.string().max(64).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ──── POST /api/payments/verify ────────────────────────────────────────────

export const verifyPaymentSchema = z.object({
  razorpayPaymentId: z.string().min(1).max(64),
  razorpayOrderId: z.string().min(1).max(64),
  razorpaySignature: z.string().min(1).max(128),
  planId: planIdEnum.optional(),
  type: z.enum(['subscription', 'fund_add', 'consultation']).default('subscription'),
  tenantId: z.string().max(64).optional(),
  consultationId: z.string().max(64).optional(),
}).refine(
  (data) => {
    // planId is required for subscription payments
    if (data.type === 'subscription' && !data.planId) return false;
    // consultationId is required for consultation payments
    if (data.type === 'consultation' && !data.consultationId) return false;
    return true;
  },
  {
    message: 'planId is required for subscription payments, consultationId for consultation payments',
  },
);

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

// ──── POST /api/payments/create-mandate ────────────────────────────────────

export const createMandateSchema = z.object({
  planId: planIdEnum,
  billingPeriod: billingPeriodEnum.default('monthly'),
  customerName: z.string().max(100).optional(),
  customerEmail: z.string().email().max(254).optional(),
  customerContact: z.string().max(15).optional(),
  tenantId: z.string().max(64).optional(),
});

export type CreateMandateInput = z.infer<typeof createMandateSchema>;

// ──── POST /api/payments/create-subscription ───────────────────────────────

export const createSubscriptionSchema = z.object({
  planId: planIdEnum,
  billingPeriod: billingPeriodEnum.default('monthly'),
  totalCount: z.number().int().min(1).max(120).optional(),
  tenantId: z.string().max(64).optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

// ──── POST /api/payments/create-fund-order ─────────────────────────────────

export const createFundOrderSchema = z.object({
  amount: z.number().positive().min(500).max(500000),
  currency: currencyEnum.default('INR'),
});

export type CreateFundOrderInput = z.infer<typeof createFundOrderSchema>;

// ──── POST /api/payments/create-paid-order ─────────────────────────────────

export const createPaidOrderSchema = z.object({
  amount: z.number().positive(),
  currency: currencyEnum.default('INR'),
  receipt: z.string().max(128).optional(),
});

export type CreatePaidOrderInput = z.infer<typeof createPaidOrderSchema>;

// ──── POST /api/payments/create-consultation-order ─────────────────────────

export const createConsultationOrderSchema = z.object({
  consultationId: z.string().min(1).max(64),
  amount: z.number().positive(),
  advisorName: z.string().max(100).optional(),
  advisorId: z.string().max(64).optional(),
});

export type CreateConsultationOrderInput = z.infer<typeof createConsultationOrderSchema>;
