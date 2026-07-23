/**
 * ============================================================================
 * Toroloom — Referral Store Unit Tests
 * ============================================================================
 *
 * Tests referral stats loading (API + fallback), referral code generation,
 * and the share link getter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useReferralStore } from '../store/referralStore';
import type { ReferralStats } from '../types';

// ──── Mock referralApi ─────────────────────────────────────────────────────

vi.mock('../services/api/referral', () => ({
  referralApi: {
    getStats: vi.fn(),
    generateCode: vi.fn(),
  },
}));

// ──── Fixtures ─────────────────────────────────────────────────────────────

const mockStats: ReferralStats = {
  code: 'USER123',
  totalReferrals: 10,
  activeReferrals: 7,
  totalEarned: 750,
  pendingRewards: 150,
  rewardPerReferral: 100,
  shareLink: 'https://toroloom.app/ref/USER123',
  rewards: [
    { id: 'r1', referredUserId: 'u1', referredUserName: 'Alice', joinedAt: '2025-01-15', status: 'pending' as const, reward: 100, createdAt: '2025-01-15T00:00:00.000Z' },
    { id: 'r2', referredUserId: 'u2', referredUserName: 'Bob', joinedAt: '2025-02-01', status: 'credited' as const, reward: 100, createdAt: '2025-02-01T00:00:00.000Z' },
  ],
};

const mockFallbackStats: ReferralStats = {
  code: 'RAHUL12',
  totalReferrals: 5,
  activeReferrals: 4,
  totalEarned: 400,
  pendingRewards: 100,
  rewardPerReferral: 100,
  shareLink: 'App soon available on Play Store',
  rewards: [],
};

// ──── Tests ────────────────────────────────────────────────────────────────

describe('ReferralStore — Initial State', () => {
  beforeEach(() => {
    useReferralStore.setState({ referralStats: null, isLoading: false, error: null });
  });

  it('starts with null referralStats', () => {
    expect(useReferralStore.getState().referralStats).toBeNull();
  });

  it('starts with isLoading false', () => {
    expect(useReferralStore.getState().isLoading).toBe(false);
  });

  it('starts with error null', () => {
    expect(useReferralStore.getState().error).toBeNull();
  });
});

describe('ReferralStore — loadReferralStats', () => {
  beforeEach(() => {
    useReferralStore.setState({ referralStats: null, isLoading: false, error: null });
    vi.clearAllMocks();
  });

  it('sets isLoading true during fetch, false after', async () => {
    const { referralApi } = await import('../services/api/referral');
    vi.mocked(referralApi.getStats).mockResolvedValue(mockStats);

    const promise = useReferralStore.getState().loadReferralStats();
    expect(useReferralStore.getState().isLoading).toBe(true);

    await promise;
    expect(useReferralStore.getState().isLoading).toBe(false);
  });

  it('populates referralStats from API on success', async () => {
    const { referralApi } = await import('../services/api/referral');
    vi.mocked(referralApi.getStats).mockResolvedValue(mockStats);

    await useReferralStore.getState().loadReferralStats();
    expect(useReferralStore.getState().referralStats).toEqual(mockStats);
    expect(useReferralStore.getState().error).toBeNull();
  });

  it('falls back to mockReferralStats when API fails', async () => {
    const { referralApi } = await import('../services/api/referral');
    vi.mocked(referralApi.getStats).mockRejectedValue(new Error('Network error'));

    await useReferralStore.getState().loadReferralStats();
    expect(useReferralStore.getState().referralStats).toBeDefined();
    expect(useReferralStore.getState().referralStats!.code).toBe('RAHUL12');
    expect(useReferralStore.getState().referralStats!.totalReferrals).toBe(5);
    expect(useReferralStore.getState().isLoading).toBe(false);
  });

  it('clears error before loading', async () => {
    useReferralStore.setState({ error: 'Previous error' });
    const { referralApi } = await import('../services/api/referral');
    vi.mocked(referralApi.getStats).mockResolvedValue(mockStats);

    await useReferralStore.getState().loadReferralStats();
    expect(useReferralStore.getState().error).toBeNull();
  });
});

describe('ReferralStore — generateReferralCode', () => {
  beforeEach(() => {
    useReferralStore.setState({ referralStats: null, isLoading: false, error: null });
    vi.clearAllMocks();
  });

  it('sets isLoading true during generation, false after', async () => {
    const { referralApi } = await import('../services/api/referral');
    vi.mocked(referralApi.generateCode).mockResolvedValue({
      code: 'NEWCODE',
      shareLink: 'https://toroloom.app/ref/NEWCODE',
    });

    // Set stats so the code path that updates stats is exercised
    useReferralStore.setState({ referralStats: mockStats });

    const promise = useReferralStore.getState().generateReferralCode();
    expect(useReferralStore.getState().isLoading).toBe(true);

    const code = await promise;
    expect(useReferralStore.getState().isLoading).toBe(false);
    expect(code).toBe('NEWCODE');
  });

  it('updates code and shareLink in existing stats', async () => {
    const { referralApi } = await import('../services/api/referral');
    vi.mocked(referralApi.generateCode).mockResolvedValue({
      code: 'NEWCODE',
      shareLink: 'https://toroloom.app/ref/NEWCODE',
    });

    useReferralStore.setState({ referralStats: mockStats });

    await useReferralStore.getState().generateReferralCode();
    const stats = useReferralStore.getState().referralStats;
    expect(stats!.code).toBe('NEWCODE');
    expect(stats!.shareLink).toBe('https://toroloom.app/ref/NEWCODE');
    // Other fields unchanged
    expect(stats!.totalReferrals).toBe(10);
    expect(stats!.totalEarned).toBe(750);
  });

  it('returns null and does not crash when API fails', async () => {
    const { referralApi } = await import('../services/api/referral');
    vi.mocked(referralApi.generateCode).mockRejectedValue(new Error('API error'));

    const code = await useReferralStore.getState().generateReferralCode();
    expect(code).toBeNull();
    expect(useReferralStore.getState().isLoading).toBe(false);
  });

  it('does not update stats when currentStats is null (API success)', async () => {
    const { referralApi } = await import('../services/api/referral');
    vi.mocked(referralApi.generateCode).mockResolvedValue({
      code: 'NEWCODE',
      shareLink: 'https://toroloom.app/ref/NEWCODE',
    });

    // referralStats is null
    const code = await useReferralStore.getState().generateReferralCode();
    expect(code).toBe('NEWCODE');
    expect(useReferralStore.getState().referralStats).toBeNull();
  });

  it('clears error before generating', async () => {
    useReferralStore.setState({ error: 'Some error' });
    const { referralApi } = await import('../services/api/referral');
    vi.mocked(referralApi.generateCode).mockResolvedValue({
      code: 'CODE',
      shareLink: 'https://toroloom.app/ref/CODE',
    });
    useReferralStore.setState({ referralStats: mockStats });

    await useReferralStore.getState().generateReferralCode();
    expect(useReferralStore.getState().error).toBeNull();
  });
});

describe('ReferralStore — getShareLink', () => {
  beforeEach(() => {
    useReferralStore.setState({ referralStats: null, isLoading: false, error: null });
  });

  it('returns shareLink when referralStats exist', () => {
    useReferralStore.setState({ referralStats: mockStats });
    expect(useReferralStore.getState().getShareLink()).toBe('https://toroloom.app/ref/USER123');
  });

  it('returns fallback message when referralStats is null', () => {
    expect(useReferralStore.getState().getShareLink()).toBe('App soon available on Play Store');
  });

  it('returns fallback message when shareLink is empty in stats', () => {
    useReferralStore.setState({ referralStats: { ...mockStats, shareLink: '' } });
    expect(useReferralStore.getState().getShareLink()).toBe('App soon available on Play Store');
  });
});
