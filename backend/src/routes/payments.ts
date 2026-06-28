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
// Creates a Razorpay order for a subscription plan

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
          type: 'subscription',
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
  } catch (error: unknown) {
    console.error('[Payments] create-order error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to create order' });
  }
});

// ============ POST /api/payments/create-fund-order ============
// Creates a Razorpay order for adding funds to the user's wallet

router.post('/create-fund-order', async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'INR' } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'A valid positive amount is required' });
      return;
    }

    if (amount < 500) {
      res.status(400).json({ error: 'Minimum add amount is ₹500' });
      return;
    }

    if (amount > 500000) {
      res.status(400).json({ error: 'Maximum add amount is ₹5,00,000 per transaction' });
      return;
    }

    const amountInPaise = Math.round(amount * 100);

    const razorpay = getRazorpayClient();
    const { keyId } = resolveRazorpayKeys();

    if (razorpay && keyId) {
      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency,
        receipt: `toroloom_fund_${Date.now()}`,
        notes: {
          userId: req.user!.userId,
          type: 'fund_add',
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
        amount: amountInPaise,
        currency,
      });
    }
  } catch (error: unknown) {
    console.error('[Payments] create-fund-order error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to create fund order' });
  }
});

// ============ POST /api/payments/verify ============
// Verifies a completed Razorpay payment (supports both subscription & fund-add)

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, planId, tenantId, type } = req.body;

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      res.status(400).json({ error: 'Missing required payment fields' });
      return;
    }

    if (!planId && type !== 'fund_add') {
      res.status(400).json({ error: 'Missing planId for subscription payment' });
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

    if (type === 'fund_add') {
      // Handle fund-add verification
      console.log(`[Payments] User ${req.user!.userId} added funds, ` +
        `payment ${razorpayPaymentId}, tenant: ${tenantId || 'default'}`);

      res.json({
        success: true,
        message: 'Payment verified successfully. Funds will be credited to your account.',
        type: 'fund_add',
      });
    } else {
      // Handle subscription verification
      if (!planId) {
        res.status(400).json({ error: 'Missing planId for subscription payment' });
        return;
      }

      console.log(`[Payments] User ${req.user!.userId} subscribed to ${planId}, ` +
        `payment ${razorpayPaymentId}, tenant: ${tenantId || 'default'}`);

      res.json({
        success: true,
        message: 'Payment verified successfully. Your subscription is now active.',
        type: 'subscription',
      });
    }
  } catch (error: unknown) {
    console.error('[Payments] verify error:', error);
    res.status(500).json({ error: (error as Error).message || 'Payment verification failed' });
  }
});

export default router;
