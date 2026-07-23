/**
 * ============================================================================
 * Toroloom — Admin Store
 * ============================================================================
 *
 * Admin dashboard data store with mock fallback. Covers:
 *   - System health (backend, Redis, DB, Queue, WebSocket)
 *   - User management (list, search, suspend/activate)
 *   - Dashboard stats (total users, active subs, MRR, new signups)
 * ============================================================================
 */

import { create } from 'zustand';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SystemService {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number; // ms
  uptime: number; // percentage
  lastChecked: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: 'free' | 'pro' | 'elite';
  status: 'active' | 'suspended' | 'inactive';
  joinedAt: string;
  lastActive: string;
  kycStatus: 'verified' | 'pending' | 'none';
  totalTrades: number;
  totalPnl: number;
}

export interface AdminStats {
  totalUsers: number;
  activeToday: number;
  newSignupsToday: number;
  totalSubscriptions: number;
  mrr: number;
  monthlyChurn: number;
  pendingKyc: number;
  openOrders: number;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockServices: SystemService[] = [
  { name: 'Backend API', status: 'healthy', latency: 42, uptime: 99.97, lastChecked: new Date().toISOString() },
  { name: 'PostgreSQL', status: 'healthy', latency: 8, uptime: 99.99, lastChecked: new Date().toISOString() },
  { name: 'Redis Cache', status: 'healthy', latency: 3, uptime: 100, lastChecked: new Date().toISOString() },
  { name: 'BullMQ Queue', status: 'healthy', latency: 15, uptime: 99.95, lastChecked: new Date().toISOString() },
  { name: 'WebSocket', status: 'degraded', latency: 78, uptime: 98.3, lastChecked: new Date().toISOString() },
  { name: 'Razorpay', status: 'healthy', latency: 210, uptime: 99.89, lastChecked: new Date().toISOString() },
];

const mockStats: AdminStats = {
  totalUsers: 2847,
  activeToday: 342,
  newSignupsToday: 18,
  totalSubscriptions: 892,
  mrr: 284500,
  monthlyChurn: 3.2,
  pendingKyc: 23,
  openOrders: 156,
};

const mockUsers: AdminUser[] = [
  { id: 'u1', name: 'Rahul Sharma', email: 'rahul@email.com', phone: '+91-9876543210', plan: 'elite', status: 'active', joinedAt: '2025-08-15', lastActive: '2026-07-19', kycStatus: 'verified', totalTrades: 342, totalPnl: 185000 },
  { id: 'u2', name: 'Priya Patel', email: 'priya@email.com', phone: '+91-9876543211', plan: 'pro', status: 'active', joinedAt: '2025-10-01', lastActive: '2026-07-19', kycStatus: 'verified', totalTrades: 128, totalPnl: 52000 },
  { id: 'u3', name: 'Amit Singh', email: 'amit@email.com', phone: '+91-9876543212', plan: 'free', status: 'active', joinedAt: '2026-01-10', lastActive: '2026-07-18', kycStatus: 'pending', totalTrades: 15, totalPnl: -3200 },
  { id: 'u4', name: 'Sneha Reddy', email: 'sneha@email.com', phone: '+91-9876543213', plan: 'elite', status: 'active', joinedAt: '2025-06-20', lastActive: '2026-07-19', kycStatus: 'verified', totalTrades: 567, totalPnl: 425000 },
  { id: 'u5', name: 'Vikram Joshi', email: 'vikram@email.com', phone: '+91-9876543214', plan: 'pro', status: 'suspended', joinedAt: '2025-09-05', lastActive: '2026-06-28', kycStatus: 'verified', totalTrades: 89, totalPnl: -15000 },
  { id: 'u6', name: 'Ananya Gupta', email: 'ananya@email.com', phone: '+91-9876543215', plan: 'free', status: 'active', joinedAt: '2026-03-15', lastActive: '2026-07-17', kycStatus: 'none', totalTrades: 3, totalPnl: 1200 },
  { id: 'u7', name: 'Arun Kumar', email: 'arun@email.com', phone: '+91-9876543216', plan: 'pro', status: 'inactive', joinedAt: '2025-11-20', lastActive: '2026-06-01', kycStatus: 'verified', totalTrades: 45, totalPnl: 8900 },
  { id: 'u8', name: 'Deepika Mishra', email: 'deepika@email.com', phone: '+91-9876543217', plan: 'elite', status: 'active', joinedAt: '2025-07-01', lastActive: '2026-07-19', kycStatus: 'verified', totalTrades: 234, totalPnl: 112000 },
  { id: 'u9', name: 'Karan Mehta', email: 'karan@email.com', phone: '+91-9876543218', plan: 'free', status: 'active', joinedAt: '2026-04-10', lastActive: '2026-07-16', kycStatus: 'pending', totalTrades: 0, totalPnl: 0 },
  { id: 'u10', name: 'Neha Verma', email: 'neha@email.com', phone: '+91-9876543219', plan: 'pro', status: 'active', joinedAt: '2025-12-01', lastActive: '2026-07-19', kycStatus: 'verified', totalTrades: 78, totalPnl: 34500 },
];

// ─── Store ──────────────────────────────────────────────────────────────────

interface AdminState {
  /** Dashboard stats */
  stats: AdminStats;
  /** System health services */
  services: SystemService[];
  /** All users */
  users: AdminUser[];
  /** Loading flags */
  isLoading: boolean;

  // ── Actions ──

  /** Refresh all admin data (mock) */
  refresh: () => Promise<void>;
  /** Toggle user suspended status */
  toggleUserStatus: (userId: string) => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  stats: mockStats,
  services: mockServices,
  users: mockUsers,
  isLoading: false,

  refresh: async () => {
    set({ isLoading: true });
    // Simulate API call
    await new Promise((r) => setTimeout(r, 600));
    // Add slight randomization to stats to simulate live data
    set({
      stats: {
        ...mockStats,
        newSignupsToday: mockStats.newSignupsToday + Math.floor(Math.random() * 5),
        activeToday: mockStats.activeToday + Math.floor(Math.random() * 20 - 10),
      },
      services: mockServices.map((s) => ({
        ...s,
        latency: s.latency + Math.floor(Math.random() * 10 - 5),
        lastChecked: new Date().toISOString(),
      })),
      isLoading: false,
    });
  },

  toggleUserStatus: (userId) => {
    const user = get().users.find((u) => u.id === userId);
    if (!user) return;
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    set({
      users: get().users.map((u) =>
        u.id === userId ? { ...u, status: newStatus } : u,
      ),
    });
  },
}));
