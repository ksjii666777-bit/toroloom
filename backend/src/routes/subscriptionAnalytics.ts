/**
 * ============================================================================
 * Toroloom — Subscription Analytics Routes (Admin)
 * ============================================================================
 *
 * Provides subscription analytics for the admin dashboard:
 *
 *   GET /api/subscription-analytics/overview
 *     — Active subscriptions (total + by tier)
 *     — MRR (Monthly Recurring Revenue)
 *     — Churn rate (30-day)
 *     — Monthly revenue breakdown (last 6 months)
 *     — Trial conversion rate
 *     — Payment failure rate
 *
 * All endpoints:
 *   - Require auth + admin role
 *   - Data sourced from _subscriptionStore (the same in-memory/DB store
 *     used by the subscription routes)
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import type { UserSubscriptionData } from '../services/storage/types';

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

// ──── Subscription store reference (set at startup) ────────────────────────

let _subscriptionStore: {
  loadAllSubscriptions(): Promise<UserSubscriptionData[]>;
} | null = null;

/**
 * Wire the subscription store into this module.
 * Called from server.ts after configureSubscriptionPersistence.
 */
export function configureSubscriptionAnalyticsStore(storage: {
  loadAllSubscriptions(): Promise<UserSubscriptionData[]>;
}): void {
  _subscriptionStore = storage;
}

// ──── Tier → monthly price map ────────────────────────────────────────────

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  plan_free:  { monthly: 0,     yearly: 0 },
  plan_pro:   { monthly: 399,   yearly: 3999 },
  plan_elite: { monthly: 999,   yearly: 9999 },
};

function getMonthlyPrice(planId: string): number {
  return PLAN_PRICES[planId]?.monthly ?? 0;
}

// ──── Analytics helpers ────────────────────────────────────────────────────

interface SubscriptionAnalyticsOverview {
  totalSubscriptions: number;
  activeSubscriptions: number;
  tierBreakdown: {
    free: number;
    pro: number;
    elite: number;
  };
  statusBreakdown: {
    active: number;
    trial: number;
    expired: number;
    cancelled: number;
  };
  mrr: number;                         // Monthly Recurring Revenue (INR)
  averageRevenuePerUser: number;       // ARPU (INR/month)
  churnRate30Day: number;              // % churned in last 30 days
  churnRate90Day: number;              // % churned in last 90 days
  monthlyRevenue: {                    // Last 6 months revenue breakdown
    month: string;                     // "Jan 2026"
    revenue: number;
    newSubscribers: number;
    churnedSubscribers: number;
  }[];
  trialConversionRate: number;         // % of trial users who converted
  trialUsers: number;
  paymentFailureRate: number;          // % of paid users with payment failures
  usersInGracePeriod: number;
}

function computeOverview(subscriptions: UserSubscriptionData[]): SubscriptionAnalyticsOverview {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // ── Tier & Status breakdown ──────────────────────────────────────
  const tierBreakdown = { free: 0, pro: 0, elite: 0 };
  const statusBreakdown = { active: 0, trial: 0, expired: 0, cancelled: 0 };
  let activeSubscriptions = 0;
  let totalMrr = 0;
  let trialUsers = 0;
  let trialConverted = 0;
  let paidUsersWithFailures = 0;
  let totalPaidUsers = 0;
  let usersInGracePeriod = 0;
  let churned30Day = 0;
  let churned90Day = 0;
  let totalUsersWithEndDate = 0;

  // Monthly revenue tracking (last 6 months)
  const monthlyBuckets: Map<string, { revenue: number; newSubs: number; churned: number }> = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthlyBuckets.set(key, { revenue: 0, newSubs: 0, churned: 0 });
  }

  for (const sub of subscriptions) {
    // Tier
    if (sub.tier === 'free' || sub.tier === 'pro' || sub.tier === 'elite') {
      tierBreakdown[sub.tier]++;
    }

    // Status
    const status = sub.status || 'active';
    if (status in statusBreakdown) {
      statusBreakdown[status as keyof typeof statusBreakdown]++;
    }

    // Active subs
    if (status === 'active' || status === 'trial') {
      activeSubscriptions++;
    }

    // MRR (only active/trial paid subscriptions)
    if ((status === 'active' || status === 'trial') && sub.tier !== 'free') {
      totalMrr += getMonthlyPrice(sub.planId);
    }

    // Trial tracking
    if (sub.isTrialUsed || sub.status === 'trial') {
      trialUsers++;
      if (sub.status === 'active' && sub.tier !== 'free') {
        trialConverted++;
      }
    }

    // Payment failures
    if (sub.tier !== 'free') {
      totalPaidUsers++;
      if ((sub.paymentFailureCount || 0) > 0) {
        paidUsersWithFailures++;
      }
    }

    // Grace period
    if (sub.gracePeriodEndDate && new Date(sub.gracePeriodEndDate) > now) {
      usersInGracePeriod++;
    }

    // Churn: user whose subscription ended (status === 'expired' or 'cancelled')
    // and the end date is within the window
    const endDate = sub.endDate ? new Date(sub.endDate) : null;
    if (endDate && (status === 'expired' || status === 'cancelled')) {
      totalUsersWithEndDate++;
      if (endDate >= thirtyDaysAgo && endDate <= now) {
        churned30Day++;
      }
      if (endDate >= ninetyDaysAgo && endDate <= now) {
        churned90Day++;
      }
    }

    // Monthly revenue buckets (last 6 months) — distribute revenue by start date
    const startDate = sub.startDate ? new Date(sub.startDate) : null;
    if (startDate && sub.tier !== 'free') {
      const startKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyBuckets.has(startKey)) {
        const bucket = monthlyBuckets.get(startKey)!;
        bucket.newSubs++;
        bucket.revenue += getMonthlyPrice(sub.planId);
      }
    }
  }

  // Compute monthly revenue (last 6 months from the data)
  const monthlyRevenue = Array.from(monthlyBuckets.entries()).map(([key, data]) => {
    const [year, month] = key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return {
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      revenue: data.revenue,
      newSubscribers: data.newSubs,
      churnedSubscribers: data.churned,
    };
  });

  // Churn rate as percentage
  const churnRate30Day = totalUsersWithEndDate > 0
    ? Math.round((churned30Day / totalUsersWithEndDate) * 100)
    : 0;
  const churnRate90Day = totalUsersWithEndDate > 0
    ? Math.round((churned90Day / totalUsersWithEndDate) * 100)
    : 0;

  // Trial conversion rate
  const trialConversionRate = trialUsers > 0
    ? Math.round((trialConverted / trialUsers) * 100)
    : 0;

  // Payment failure rate
  const paymentFailureRate = totalPaidUsers > 0
    ? Math.round((paidUsersWithFailures / totalPaidUsers) * 100)
    : 0;

  // ARPU
  const averageRevenuePerUser = activeSubscriptions > 0
    ? Math.round(totalMrr / activeSubscriptions)
    : 0;

  return {
    totalSubscriptions: subscriptions.length,
    activeSubscriptions,
    tierBreakdown,
    statusBreakdown,
    mrr: totalMrr,
    averageRevenuePerUser,
    churnRate30Day,
    churnRate90Day,
    monthlyRevenue,
    trialConversionRate,
    trialUsers,
    paymentFailureRate,
    usersInGracePeriod,
  };
}

// ──── Routes ────────────────────────────────────────────────────────────────

/**
 * GET /api/subscription-analytics/overview
 *
 * Returns the subscription analytics overview for the admin dashboard.
 * Data is computed in-memory from the subscription store (no Redis cache
 * needed since this aggregates all subscriptions which rarely changes).
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    if (!_subscriptionStore) {
      res.status(503).json({ error: 'Subscription store not available' });
      return;
    }

    const subscriptions = await _subscriptionStore.loadAllSubscriptions();
    const overview = computeOverview(subscriptions);

    res.json(overview);
  } catch (error: unknown) {
    console.error('[SubscriptionAnalytics] /overview error:', (error as Error).message);
    res.status(500).json({ error: 'Failed to compute subscription analytics' });
  }
});

export default router;
