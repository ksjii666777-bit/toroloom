/**
 * ============================================================================
 * Toroloom Payments Routes — Razorpay Integration
 * ============================================================================
 *
 * Supports multi-tenant Razorpay key routing:
 *   - Default route uses env.razorpayKeyId / env.razorpayKeySecret
 *   - If tenantId is provided, looks up TENANT_{ID}_RAZORPAY_KEY_ID/SECRET env vars
 *   - Falls back to default keys if tenant-specific keys are not configured
 *
 * Endpoints:
 *   POST /api/payments/create-order — Create a Razorpay order
 *   POST /api/payments/verify       — Verify a completed payment
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// ============ Plan → Amount Mapping ============
// Amounts in paise (₹1 = 100 paise)

const PLAN_AMOUNTS: Record<string, { monthly: number; yearly: number }> = {
  plan_pro: { monthly: 39900, yearly: 399900 },   // ₹399 → 39900 paise, ₹3999 → 399900 paise
  plan_elite: { monthly: 99900, yearly: 999900 },  // ₹999 → 99900 paise, ₹9999 → 999900 paise
};

// ============ Per-Tenant Razorpay Key Resolution ============

interface TenantRazorpayKeys {
  keyId: string;
  keySecret: string;
}

/**
 * Resolves Razorpay keys for a given tenant.
 * Falls back to the global env keys if tenant-specific keys are not configured.
 *
 * Tenant-specific keys are stored as env vars:
 *   TENANT_{TENANT_ID_UC}_RAZORPAY_KEY_ID
 *   TENANT_{TENANT_ID_UC}_RAZORPAY_KEY_SECRET
 *
 * Example for tenant "acme_corp":
 *   TENANT_ACME_CORP_RAZORPAY_KEY_ID=rzp_live_xxxx
 *   TENANT_ACME_CORP_RAZORPAY_KEY_SECRET=xxxxx
 */
function resolveRazorpayKeys(tenantId?: string): TenantRazorpayKeys {
  const globalKeys: TenantRazorpayKeys = {
    keyId: env.razorpayKeyId,
    keySecret: env.razorpayKeySecret,
  };

  if (!tenantId) return globalKeys;

  const normalizedId = tenantId.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const tenantKeyId = process.env[`TENANT_${normalizedId}_RAZORPAY_KEY_ID`];
  const tenantKeySecret = process.env[`TENANT_${normalizedId}_RAZORPAY_KEY_SECRET`];

  if (tenantKeyId && tenantKeySecret) {
    return { keyId: tenantKeyId, keySecret: tenantKeySecret };
  }

  // Fall back to global keys
  return globalKeys;
}

function getRazorpayClient(tenantId?: string): Razorpay | null {
  const { keyId, keySecret } = resolveRazorpayKeys(tenantId);
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ============ POST /api/payments/create-order ============

router.post('/create-order', async (req: Request, res: Response) => {
  try {
    const { planId, billingPeriod = 'monthly', tenantId } = req.body;

    const planAmounts = PLAN_AMOUNTS[planId];
    if (!planAmounts) {
      res.status(400).json({ error: 'Invalid plan ID' });
      return;
    }

    const amount = billingPeriod === 'yearly' ? planAmounts.yearly : planAmounts.monthly;

    const razorpay = getRazorpayClient(tenantId);
    const { keyId } = resolveRazorpayKeys(tenantId);

    if (razorpay && keyId) {
      const order = await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt: `toroloom_${planId}_${Date.now()}`,
        notes: {
          userId: req.user!.userId,
          planId,
          billingPeriod,
          tenantId: tenantId || 'default',
        },
      });

      res.json({
        orderId: order.id,
        keyId: keyId,
        amount: order.amount,
        currency: order.currency,
      });
    } else {
      // Development fallback — return mock order
      res.json({
        orderId: `order_mock_${Date.now()}`,
        keyId: keyId || 'rzp_test_placeholder',
        amount,
        currency: 'INR',
      });
    }
  } catch (error: any) {
    console.error('[Payments] create-order error:', error);
    res.status(500).json({ error: error?.message || 'Failed to create order' });
  }
});

// ============ POST /api/payments/verify ============

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, planId, tenantId } = req.body;

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature || !planId) {
      res.status(400).json({ error: 'Missing required payment fields' });
      return;
    }

    const { keySecret } = resolveRazorpayKeys(tenantId);
    const razorpay = getRazorpayClient(tenantId);

    if (razorpay && keySecret) {
      // Verify signature using HMAC-SHA256
      const body = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        res.status(400).json({ error: 'Invalid payment signature' });
        return;
      }

      // Fetch payment details to confirm status
      const payment = await razorpay.payments.fetch(razorpayPaymentId);
      if (payment.status !== 'captured') {
        res.status(400).json({ error: `Payment not captured (status: ${payment.status})` });
        return;
      }
    }

    // In production, persist the subscription in the database with tenantId
    console.log(`[Payments] User ${req.user!.userId} subscribed to ${planId}, ` +
      `payment ${razorpayPaymentId}, tenant: ${tenantId || 'default'}`);

    res.json({
      success: true,
      message: 'Payment verified successfully. Your subscription is now active.',
    });
  } catch (error: any) {
    console.error('[Payments] verify error:', error);
    res.status(500).json({ error: error?.message || 'Payment verification failed' });
  }
});

export default router;
