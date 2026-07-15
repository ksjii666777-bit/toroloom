/**
 * ============================================================================
 * Toroloom — Revenue Share Dashboard Store
 * ============================================================================
 *
 * Manages creator earnings from courses, referrals, tips, subscriptions, and
 * commissions. Provides payout request tracking and monthly history.
 * ============================================================================
 */

import { create } from 'zustand';
import {
  RevenueTransaction, PayoutRequest, MonthlyEarnings,
  RevenueSource, PayoutStatus,
} from '../types';

// ─── Mock Data ─────────────────────────────────────────────────────────────

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();
const daysFromNow = (d: number) => new Date(now + d * 86400000).toISOString();

const mockTransactions: RevenueTransaction[] = [
  { id: 'txn_1', source: 'courses',    amount: 499, fee: 49, netAmount: 450, description: 'Sale: Advanced Options Strategies',  reference: 'course_1', referenceName: 'Advanced Options Strategies',  createdAt: daysAgo(1),  paidOut: false },
  { id: 'txn_2', source: 'referrals',  amount: 200, fee: 0,  netAmount: 200, description: 'Referral bonus — Rohan Mehta joined',  reference: 'ref_1',   referenceName: 'Rohan Mehta',                  createdAt: daysAgo(2),  paidOut: false },
  { id: 'txn_3', source: 'tips',       amount: 100, fee: 5,  netAmount: 95,  description: 'Tip from Vikram on your NIFTY analysis', createdAt: daysAgo(3),  paidOut: false },
  { id: 'txn_4', source: 'courses',    amount: 799, fee: 79, netAmount: 720, description: 'Sale: Complete Trading Blueprint',     reference: 'course_2', referenceName: 'Complete Trading Blueprint',      createdAt: daysAgo(5),  paidOut: false },
  { id: 'txn_5', source: 'referrals',  amount: 200, fee: 0,  netAmount: 200, description: 'Referral bonus — Sneha Patel joined',   reference: 'ref_2',   referenceName: 'Sneha Patel',                   createdAt: daysAgo(7),  paidOut: false },
  { id: 'txn_6', source: 'subscriptions', amount: 999, fee: 99, netAmount: 900, description: 'Premium subscription revenue share', createdAt: daysAgo(8),  paidOut: true  },
  { id: 'txn_7', source: 'tips',       amount: 50,  fee: 2,  netAmount: 48,  description: 'Tip from Ananya on weekly outlook post', createdAt: daysAgo(10), paidOut: true  },
  { id: 'txn_8', source: 'courses',    amount: 349, fee: 34, netAmount: 315, description: 'Sale: Options Basics for Beginners',     reference: 'course_3', referenceName: 'Options Basics for Beginners',   createdAt: daysAgo(12), paidOut: true  },
  { id: 'txn_9', source: 'commissions', amount: 1500, fee: 150, netAmount: 1350, description: 'Affiliate commission — Angel Broking', createdAt: daysAgo(14), paidOut: true  },
  { id: 'txn_10', source: 'referrals', amount: 200, fee: 0,  netAmount: 200, description: 'Referral bonus — Amit Kumar joined',     reference: 'ref_3',   referenceName: 'Amit Kumar',                    createdAt: daysAgo(15), paidOut: true  },
  { id: 'txn_11', source: 'courses',   amount: 599, fee: 59, netAmount: 540, description: 'Sale: Technical Analysis Masterclass',    reference: 'course_4', referenceName: 'Technical Analysis Masterclass', createdAt: daysAgo(18), paidOut: true  },
  { id: 'txn_12', source: 'tips',      amount: 75,  fee: 3,  netAmount: 72,  description: 'Tip from Deepak on your RELIANCE analysis', createdAt: daysAgo(20), paidOut: true  },
];

const mockPayoutHistory: PayoutRequest[] = [
  { id: 'pay_1', amount: 5000,  status: 'completed', method: 'UPI',     destination: 'rahul@upi',     requestedAt: daysAgo(25), processedAt: daysAgo(23), transactionId: 'txn_pay_1' },
  { id: 'pay_2', amount: 3200,  status: 'completed', method: 'Bank',   destination: 'HDFC ****1234',  requestedAt: daysAgo(50), processedAt: daysAgo(47), transactionId: 'txn_pay_2' },
  { id: 'pay_3', amount: 8000,  status: 'completed', method: 'UPI',     destination: 'rahul@upi',     requestedAt: daysAgo(80), processedAt: daysAgo(78), transactionId: 'txn_pay_3' },
  { id: 'pay_4', amount: 2500,  status: 'processing', method: 'UPI',   destination: 'rahul@upi',     requestedAt: daysAgo(1),  failureReason: undefined },
  { id: 'pay_5', amount: 10000, status: 'failed',    method: 'Bank',   destination: 'HDFC ****1234',  requestedAt: daysAgo(90), processedAt: daysAgo(90), failureReason: 'Insufficient funds', transactionId: 'txn_pay_5' },
];

// Compute monthly history from transactions
function buildMonthlyHistory(transactions: RevenueTransaction[]): MonthlyEarnings[] {
  const monthMap = new Map<string, { total: number; breakdown: Partial<Record<RevenueSource, number>>; count: number }>();

  for (const txn of transactions) {
    const d = new Date(txn.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const existing = monthMap.get(key) || { total: 0, breakdown: {}, count: 0 };
    existing.total += txn.netAmount;
    existing.breakdown[txn.source] = (existing.breakdown[txn.source] || 0) + txn.netAmount;
    existing.count += 1;
    monthMap.set(key, existing);
  }

  return Array.from(monthMap.entries())
    .map(([key, data]) => ({
      month: new Date(key + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      monthStart: new Date(key + '-01').toISOString(),
      total: Math.round(data.total * 100) / 100,
      breakdown: data.breakdown,
      transactionCount: data.count,
    }))
    .sort((a, b) => new Date(b.monthStart).getTime() - new Date(a.monthStart).getTime());
}

// ─── Store ─────────────────────────────────────────────────────────────────

interface RevenueStoreState {
  /** Full dashboard state */
  dashboard: {
    totalEarnings: number;
    totalFees: number;
    netEarnings: number;
    totalPaidOut: number;
    pendingBalance: number;
    breakdownBySource: Record<RevenueSource, { amount: number; count: number; label: string; icon: string; color: string }>;
    recentTransactions: RevenueTransaction[];
    monthlyHistory: MonthlyEarnings[];
    payoutHistory: PayoutRequest[];
    isPayoutInProgress: boolean;
  };

  /** Request a new payout */
  requestPayout: (amount: number, method: string, destination: string) => Promise<boolean>;
  /** Refresh from source (mock for now) */
  refresh: () => void;
}

const SOURCE_META: Record<RevenueSource, { label: string; icon: string; color: string }> = {
  courses:       { label: 'Course Sales',      icon: 'school',         color: '#6C63FF' },
  referrals:    { label: 'Referrals',          icon: 'gift',           color: '#00C853' },
  tips:         { label: 'Community Tips',     icon: 'heart',          color: '#FF6B6B' },
  subscriptions:{ label: 'Subscriptions',      icon: 'diamond',        color: '#3B82F6' },
  commissions:  { label: 'Commissions',        icon: 'cash',           color: '#FFC107' },
};

function computeDashboard() {
  const transactions = [...mockTransactions];
  const paidTransactions = transactions.filter(t => t.paidOut);
  const unpaidTransactions = transactions.filter(t => !t.paidOut);

  const totalEarnings = transactions.reduce((s, t) => s + t.amount, 0);
  const totalFees = transactions.reduce((s, t) => s + t.fee, 0);
  const netEarnings = transactions.reduce((s, t) => s + t.netAmount, 0);
  const totalPaidOut = paidTransactions.reduce((s, t) => s + t.netAmount, 0);
  const pendingBalance = unpaidTransactions.reduce((s, t) => s + t.netAmount, 0);

  // Build breakdown by source
  const breakdownBySource = {} as Record<RevenueSource, { amount: number; count: number; label: string; icon: string; color: string }>;
  for (const source of Object.keys(SOURCE_META) as RevenueSource[]) {
    const sourceTxns = transactions.filter(t => t.source === source);
    breakdownBySource[source] = {
      amount: sourceTxns.reduce((s, t) => s + t.netAmount, 0),
      count: sourceTxns.length,
      ...SOURCE_META[source],
    };
  }

  return {
    totalEarnings,
    totalFees,
    netEarnings,
    totalPaidOut,
    pendingBalance,
    breakdownBySource,
    recentTransactions: transactions.slice(0, 10),
    monthlyHistory: buildMonthlyHistory(transactions),
    payoutHistory: mockPayoutHistory,
    isPayoutInProgress: mockPayoutHistory.some(p => p.status === 'pending' || p.status === 'processing'),
  };
}

export const useRevenueStore = create<RevenueStoreState>((set, get) => ({
  dashboard: computeDashboard(),

  requestPayout: async (amount, method, destination) => {
    // Simulate API call
    const newPayout: PayoutRequest = {
      id: `pay_${Date.now()}`,
      amount,
      status: 'processing',
      method,
      destination,
      requestedAt: new Date().toISOString(),
    };

    set(s => ({
      dashboard: {
        ...s.dashboard,
        pendingBalance: s.dashboard.pendingBalance - amount,
        isPayoutInProgress: true,
        payoutHistory: [newPayout, ...s.dashboard.payoutHistory],
      },
    }));

    // Simulate success after 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    set(s => ({
      dashboard: {
        ...s.dashboard,
        isPayoutInProgress: false,
        payoutHistory: s.dashboard.payoutHistory.map(p =>
          p.id === newPayout.id
            ? { ...p, status: 'completed' as PayoutStatus, processedAt: new Date().toISOString(), transactionId: `txn_pay_${Date.now()}` }
            : p
        ),
      },
    }));

    return true;
  },

  refresh: () => {
    set({ dashboard: computeDashboard() });
  },
}));
