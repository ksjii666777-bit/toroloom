/**
 * ============================================================================
 * Toroloom — Order Zod Schemas
 * ============================================================================
 */

import { z } from 'zod';

// ──── Shared Enums ─────────────────────────────────────────────────────────

const exchangeEnum = z.enum(['NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX']);
const orderTypeEnum = z.enum(['LIMIT', 'MARKET', 'SL', 'SLM']);
const productTypeEnum = z.enum(['CNC', 'MIS', 'NRML']);
const actionTypeEnum = z.enum(['BUY', 'SELL', 'SQUARE_OFF', 'MODIFY', 'CANCEL']);

// ──── POST /api/orders/execute ─────────────────────────────────────────────

export const executeOrderSchema = z.object({
  actionType: actionTypeEnum.optional(),
  transactionType: actionTypeEnum.optional(), // Legacy alias
  symbol: z.string().min(1).max(20).transform(s => s.trim().toUpperCase()),
  exchange: exchangeEnum.default('NSE'),
  quantity: z.number().int().positive().max(100000),
  price: z.number().positive(),
  productType: productTypeEnum.default('CNC'),
  orderType: orderTypeEnum.default('MARKET'),
  metadata: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().min(8).max(128).optional(),
  currentPosition: z.object({
    quantity: z.number().int().positive(),
    avgPrice: z.number().positive(),
  }).optional(),
}).refine(
  (data) => data.actionType || data.transactionType,
  { message: 'actionType is required (BUY | SELL | SQUARE_OFF | MODIFY | CANCEL)' },
);

export type ExecuteOrderInput = z.infer<typeof executeOrderSchema>;

// ──── POST /api/orders/validate ────────────────────────────────────────────

export const validateOrderSchema = z.object({
  actionType: actionTypeEnum,
  symbol: z.string().min(1).max(20).optional(),
  quantity: z.number().int().positive().max(100000).optional(),
  price: z.number().positive().optional(),
  exchange: exchangeEnum.default('NSE'),
});

export type ValidateOrderInput = z.infer<typeof validateOrderSchema>;

// ──── POST /api/orders/modify ──────────────────────────────────────────────

export const modifyOrderSchema = z.object({
  orderId: z.string().min(1).max(64),
  symbol: z.string().max(20).optional(),
  exchange: z.string().max(4).optional(),
  quantity: z.number().int().positive().max(100000).optional(),
  price: z.number().positive().optional(),
  productType: productTypeEnum.optional(),
  orderType: orderTypeEnum.optional(),
  triggerPrice: z.number().positive().optional(),
});

export type ModifyOrderInput = z.infer<typeof modifyOrderSchema>;

// ──── POST /api/orders/cancel ──────────────────────────────────────────────

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1).max(64),
  symbol: z.string().max(20).optional(),
  exchange: z.string().max(4).optional(),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

// ──── POST /api/orders/place (legacy) ──────────────────────────────────────

export const placeOrderSchema = z.object({
  symbol: z.string().min(1).max(20),
  quantity: z.number().int().positive().max(100000),
  price: z.number().positive(),
  orderType: z.enum(['market', 'limit', 'sl', 'sl_m']).default('market'),
  productType: z.enum(['delivery', 'intraday', 'margin']).default('delivery'),
  triggerPrice: z.number().positive().optional(),
  side: z.enum(['buy', 'sell']),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
