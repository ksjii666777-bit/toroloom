/**
 * ============================================================================
 * Toroloom — Mutual Fund Store Tests
 * ============================================================================
 *
 * Tests the mutual fund store: fetching funds/SIPs, investing in funds,
 * and starting SIP plans.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMutualFundStore } from '../store/mutualFundStore';
import { mutualFundApi } from '../services/api/mutualFunds';

// Mock mutualFundApi to reject so local fallback is triggered
vi.mock('../services/api/mutualFunds', () => ({
  mutualFundApi: {
    getFunds: vi.fn(() => Promise.reject(new Error('mock'))),
    getSIPs: vi.fn(() => Promise.reject(new Error('mock'))),
    createSIP: vi.fn(() => Promise.reject(new Error('mock'))),
  },
}));

describe('MutualFundStore — Initial State', () => {
  beforeEach(() => {
    useMutualFundStore.setState({
      funds: [],
      sipPlans: [],
      isLoading: false,
    });
  });

  it('starts with empty state when reset', () => {
    const state = useMutualFundStore.getState();
    expect(state.funds).toEqual([]);
    expect(state.sipPlans).toEqual([]);
    expect(state.isLoading).toBe(false);
  });
});

describe('MutualFundStore — Fund Operations', () => {
  beforeEach(() => {
    useMutualFundStore.setState({
      funds: [
        { id: 'mf1', name: 'Parag Parikh Flexi Cap Fund', category: 'Flexi Cap', nav: 67.45, dayChange: 0.89, dayChangePercent: 1.34, oneYearReturn: 28.5, threeYearReturn: 72.3, fiveYearReturn: 125.6, riskLevel: 'high', minInvestment: 1000, fundSize: '₹45,678 Cr', rating: 5 },
        { id: 'mf2', name: 'HDFC Mid-Cap Fund', category: 'Mid Cap', nav: 156.30, dayChange: 1.23, dayChangePercent: 0.79, oneYearReturn: 35.2, threeYearReturn: 85.6, fiveYearReturn: 145.8, riskLevel: 'high', minInvestment: 500, fundSize: '₹32,456 Cr', rating: 4 },
      ],
      sipPlans: [],
      isLoading: false,
    });
  });

  it('invests in a fund (lump sum)', () => {
    expect(() => {
      useMutualFundStore.getState().investInFund('mf1', 10000);
    }).not.toThrow();
  });

  it('starts a SIP with local fallback', async () => {
    await useMutualFundStore.getState().startSIP('mf1', 5000, 'monthly');
    const state = useMutualFundStore.getState();
    expect(state.sipPlans).toHaveLength(1);
    expect(state.sipPlans[0].fundName).toBe('Parag Parikh Flexi Cap Fund');
    expect(state.sipPlans[0].amount).toBe(5000);
    expect(state.sipPlans[0].frequency).toBe('monthly');
    expect(state.sipPlans[0].totalInvested).toBe(5000);
  });

  it('starts SIP with quarterly frequency', async () => {
    await useMutualFundStore.getState().startSIP('mf2', 3000, 'quarterly');
    const state = useMutualFundStore.getState();
    expect(state.sipPlans[0].frequency).toBe('quarterly');
  });

  it('starts multiple SIPs', async () => {
    await useMutualFundStore.getState().startSIP('mf1', 5000, 'monthly');
    await useMutualFundStore.getState().startSIP('mf2', 3000, 'monthly');
    expect(useMutualFundStore.getState().sipPlans).toHaveLength(2);
  });

  it('handles investing in non-existent fund gracefully', async () => {
    await useMutualFundStore.getState().startSIP('non_existent', 1000, 'monthly');
    // Should not throw and should not add a SIP (because fund not found in mockFunds)
    expect(useMutualFundStore.getState().sipPlans).toHaveLength(0);
  });
});

describe('MutualFundStore — Fetch Operations', () => {
  it('sets loading state during fetch', () => {
    useMutualFundStore.getState().fetchFunds();
    expect(useMutualFundStore.getState().isLoading).toBe(true);
  });

  it('fetches SIPs', () => {
    expect(() => {
      useMutualFundStore.getState().fetchSIPs();
    }).not.toThrow();
  });
});

describe('MutualFundStore — Fetch Fund Success', () => {
  beforeEach(() => {
    useMutualFundStore.setState({
      funds: [],
      sipPlans: [],
      isLoading: false,
    });
  });

  it('loads funds from the backend on success', async () => {
    const mockApiFunds = [
      { id: 'api_fund_1', name: 'API Fund 1', category: 'Large Cap', nav: 100, dayChange: 0.5, dayChangePercent: 0.5, oneYearReturn: 15, threeYearReturn: 45, fiveYearReturn: 90, riskLevel: 'moderate', minInvestment: 500, fundSize: '₹10,000 Cr', rating: 4 },
    ];
    vi.mocked(mutualFundApi.getFunds).mockResolvedValueOnce(mockApiFunds as any);

    await useMutualFundStore.getState().fetchFunds();

    const state = useMutualFundStore.getState();
    expect(state.funds).toEqual(mockApiFunds);
    expect(state.isLoading).toBe(false);
  });

  it('loads SIPs from the backend on success', async () => {
    const mockApiSIPs = [
      { id: 'sip_api_1', fundId: 'fund_1', fundName: 'API SIP Fund', amount: 5000, frequency: 'monthly', nextDate: '2025-07-01', totalInvested: 15000, currentValue: 16200, returns: 8 },
    ];
    vi.mocked(mutualFundApi.getSIPs).mockResolvedValueOnce(mockApiSIPs as any);

    await useMutualFundStore.getState().fetchSIPs();

    expect(useMutualFundStore.getState().sipPlans).toEqual(mockApiSIPs);
  });
});

describe('MutualFundStore — Start SIP Success', () => {
  beforeEach(() => {
    useMutualFundStore.setState({
      funds: [
        { id: 'mf1', name: 'Parag Parikh Flexi Cap Fund', category: 'Flexi Cap', nav: 67.45, dayChange: 0.89, dayChangePercent: 1.34, oneYearReturn: 28.5, threeYearReturn: 72.3, fiveYearReturn: 125.6, riskLevel: 'high', minInvestment: 1000, fundSize: '₹45,678 Cr', rating: 5 },
      ],
      sipPlans: [],
      isLoading: false,
    });
  });

  it('starts SIP via backend API when available', async () => {
    const createdSIP = { id: 'sip_created', fundId: 'mf1', fundName: 'Parag Parikh Flexi Cap Fund', amount: 5000, frequency: 'monthly', nextDate: '2025-07-01', totalInvested: 5000, currentValue: 5000, returns: 0 };
    vi.mocked(mutualFundApi.createSIP).mockResolvedValueOnce(createdSIP as any);

    await useMutualFundStore.getState().startSIP('mf1', 5000, 'monthly');

    const state = useMutualFundStore.getState();
    expect(state.sipPlans).toHaveLength(1);
    expect(state.sipPlans[0]).toEqual(createdSIP);
  });
});
