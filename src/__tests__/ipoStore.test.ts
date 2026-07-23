/**
 * ============================================================================
 * Toroloom — IPO Store Unit Tests
 * ============================================================================
 *
 * Tests IPO application lifecycle: fetch, apply, allotment update, stats,
 * bookmarks, and edge cases.
 *
 * The store is pure in-memory (no API mocking needed).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useIPOStore } from '../store/ipoStore';
import type { IPOItem } from '../types';

// ──── Helpers ──────────────────────────────────────────────────────────────

function getState() {
  return useIPOStore.getState();
}

/** Reset the store to its initial state between tests. */
function resetStore() {
  useIPOStore.setState(useIPOStore.getInitialState());
}

/**
 * A minimal IPOItem fixture for testing applyForIPO without depending
 * on the mock data structure specifics (just the required fields).
 */
const mockIPO: IPOItem = {
  id: 'test_ipo_1',
  companyName: 'Test IPO Company',
  logo: 'TI',
  sector: 'Technology',
  openDate: '2026-07-20',
  closeDate: '2026-07-24',
  listingDate: '2026-08-01',
  priceBand: { min: 100, max: 120 },
  lotSize: 50,
  minInvestment: 6000,
  issueSize: 5000,
  freshIssue: 3000,
  offerForSale: 2000,
  totalShares: 50000000,
  totalBids: 0,
  totalBidAmount: 0,
  subscriptionStatus: 'open',
  subscriptionQIB: 0,
  subscriptionHNI: 0,
  subscriptionRetail: 0,
  subscriptionTotal: 0,
  gmp: 20,
  gmpPercent: 18.2,
  expectedListingPrice: 138,
  expectedListingGain: 15.0,
  leadManagers: ['Test Manager'],
  registrar: 'Test Registrar',
  rating: 4,
  revenue: 1000,
  netProfit: 150,
  peRatio: 25,
  roe: 15,
  about: 'A test IPO company for unit tests.',
  strengths: ['Strong team'],
  risks: ['Market risk'],
  applications: 0,
  sharesApplied: 0,
  isBookmarked: false,
};

// ──── Tests ────────────────────────────────────────────────────────────────

describe('IPOStore — Initial State', () => {
  beforeEach(() => resetStore());

  it('loads IPOs from mock data', () => {
    const ipos = getState().ipos;
    expect(ipos.length).toBeGreaterThan(0);
    expect(ipos[0].id).toBeDefined();
    expect(ipos[0].companyName).toBeDefined();
  });

  it('loads 3 seed applications', () => {
    expect(getState().applications).toHaveLength(3);
  });

  it('starts with isLoading false', () => {
    expect(getState().isLoading).toBe(false);
  });

  it('starts with selectedIPO null', () => {
    expect(getState().selectedIPO).toBeNull();
  });

  it('seed applications have different statuses', () => {
    const apps = getState().applications;
    expect(apps.find(a => a.status === 'allotted')).toBeDefined();
    expect(apps.find(a => a.status === 'not_allotted')).toBeDefined();
    expect(apps.find(a => a.status === 'submitted')).toBeDefined();
  });
});

describe('IPOStore — fetchIPOs', () => {
  beforeEach(() => resetStore());

  it('sets isLoading false after fetch completes', async () => {
    await getState().fetchIPOs();
    expect(getState().isLoading).toBe(false);
  });

  it('does not change the existing IPOs array', async () => {
    const before = getState().ipos.length;
    await getState().fetchIPOs();
    expect(getState().ipos).toHaveLength(before);
  });
});

describe('IPOStore — applyForIPO', () => {
  beforeEach(() => resetStore());

  it('creates a new application with submitted status', () => {
    const app = getState().applyForIPO(mockIPO, 3, 110, 'test@upi');

    expect(app.ipoId).toBe('test_ipo_1');
    expect(app.companyName).toBe('Test IPO Company');
    expect(app.bidLots).toBe(3);
    expect(app.bidPrice).toBe(110);
    expect(app.upiId).toBe('test@upi');
    expect(app.status).toBe('submitted');
    expect(app.appliedAt).toBeDefined();
  });

  it('computes bidQuantity as bidLots * lotSize', () => {
    const app = getState().applyForIPO(mockIPO, 3, 110, 'test@upi');
    expect(app.bidQuantity).toBe(3 * 50); // 150
  });

  it('computes totalAmount as bidQuantity * bidPrice', () => {
    const app = getState().applyForIPO(mockIPO, 3, 110, 'test@upi');
    expect(app.totalAmount).toBe(150 * 110); // 16500
  });

  it('prepends the new application to the list', () => {
    const before = getState().applications.length;
    getState().applyForIPO(mockIPO, 1, 100, 'user@upi');
    expect(getState().applications).toHaveLength(before + 1);
    expect(getState().applications[0].companyName).toBe('Test IPO Company');
  });

  it('preserves existing seed applications', () => {
    getState().applyForIPO(mockIPO, 1, 100, 'user@upi');
    const seedApp = getState().applications.find(a => a.id === 'ipo_app_seed_1');
    expect(seedApp).toBeDefined();
    expect(seedApp!.companyName).toBe('Vishal Mega Mart');
  });

  it('generates unique application IDs', () => {
    const app1 = getState().applyForIPO(mockIPO, 1, 100, 'u1@upi');
    const app2 = getState().applyForIPO(mockIPO, 2, 110, 'u2@upi');
    expect(app1.id).not.toBe(app2.id);
    expect(app1.id).toMatch(/^ipo_app_/);
  });

  it('copies logo and sector from the IPO item', () => {
    const app = getState().applyForIPO(mockIPO, 1, 100, 'u@upi');
    expect(app.logo).toBe('TI');
    expect(app.sector).toBe('Technology');
  });

  it('handles single lot application', () => {
    const app = getState().applyForIPO(mockIPO, 1, 100, 'u@upi');
    expect(app.bidLots).toBe(1);
    expect(app.bidQuantity).toBe(50);
    expect(app.totalAmount).toBe(5000);
  });

  it('handles large lot count', () => {
    const app = getState().applyForIPO(mockIPO, 100, 120, 'u@upi');
    expect(app.bidLots).toBe(100);
    expect(app.bidQuantity).toBe(100 * 50);
    expect(app.totalAmount).toBe(5000 * 120);
  });
});

describe('IPOStore — updateAllotment', () => {
  beforeEach(() => resetStore());

  it('updates application status to allotted', () => {
    getState().updateAllotment('ipo_app_seed_3', 'allotted', 120, 520, 9.5);
    const app = getState().applications.find(a => a.id === 'ipo_app_seed_3');
    expect(app).toBeDefined();
    expect(app!.status).toBe('allotted');
    expect(app!.sharesAllotted).toBe(120);
    expect(app!.listingPrice).toBe(520);
    expect(app!.listingGain).toBe(9.5);
    expect(app!.allotmentDate).toBeDefined();
  });

  it('updates application status to not_allotted', () => {
    getState().updateAllotment('ipo_app_seed_3', 'not_allotted');
    const app = getState().applications.find(a => a.id === 'ipo_app_seed_3');
    expect(app!.status).toBe('not_allotted');
    expect(app!.allotmentDate).toBeDefined();
  });

  it('preserves existing fields when optional fields are not provided', () => {
    // Seed app 3 has no sharesAllotted yet
    getState().updateAllotment('ipo_app_seed_3', 'allotted', 60);
    const app = getState().applications.find(a => a.id === 'ipo_app_seed_3');
    expect(app!.sharesAllotted).toBe(60);
    // listingPrice and listingGain should stay undefined
    expect(app!.listingPrice).toBeUndefined();
    expect(app!.listingGain).toBeUndefined();
  });

  it('does nothing for non-existent application', () => {
    const before = getState().applications.length;
    getState().updateAllotment('non_existent', 'allotted');
    expect(getState().applications).toHaveLength(before);
  });

  it('only updates the targeted application', () => {
    getState().updateAllotment('ipo_app_seed_1', 'allotted', 120, 432, 20.0);
    const app2 = getState().applications.find(a => a.id === 'ipo_app_seed_2');
    expect(app2!.status).toBe('not_allotted'); // unchanged
  });
});

describe('IPOStore — getApplicationsForIPO', () => {
  beforeEach(() => resetStore());

  it('returns applications for a specific IPO', () => {
    const apps = getState().getApplicationsForIPO('ipo_3');
    expect(apps).toHaveLength(1);
    expect(apps[0].companyName).toBe('Vishal Mega Mart');
  });

  it('returns multiple applications for the same IPO', () => {
    const ipo = getState().ipos.find(i => i.id === 'ipo_3')!;
    getState().applyForIPO(ipo, 2, 360, 'test@upi');
    const apps = getState().getApplicationsForIPO('ipo_3');
    expect(apps).toHaveLength(2);
  });

  it('returns empty array when no applications match', () => {
    const apps = getState().getApplicationsForIPO('non_existent_ipo');
    expect(apps).toHaveLength(0);
  });
});

describe('IPOStore — getApplicationStats', () => {
  beforeEach(() => resetStore());

  it('counts total applications', () => {
    const stats = getState().getApplicationStats();
    expect(stats.total).toBe(3);
  });

  it('counts submitted applications', () => {
    const stats = getState().getApplicationStats();
    expect(stats.submitted).toBe(1);
  });

  it('counts allotted applications', () => {
    const stats = getState().getApplicationStats();
    expect(stats.allotted).toBe(1);
  });

  it('counts not_allotted applications', () => {
    const stats = getState().getApplicationStats();
    expect(stats.notAllotted).toBe(1);
  });

  it('computes totalInvestment across all applications', () => {
    const stats = getState().getApplicationStats();
    expect(stats.totalInvestment).toBeGreaterThan(0);
  });

  it('computes profitFromAllotted from allotted applications', () => {
    const stats = getState().getApplicationStats();
    // Seed app 1 (Vishal Mega Mart, allotted): bidPrice=360, listingPrice=432,
    // sharesAllotted=120 → profit = (432-360)*120 = 8640
    expect(stats.profitFromAllotted).toBeGreaterThan(0);
  });

  it('counts pending applications (pending + pending_allotment status)', () => {
    const stats = getState().getApplicationStats();
    expect(stats.pending).toBe(0); // none of the seed apps have pending status
  });

  it('updates stats after a new application', () => {
    getState().applyForIPO(mockIPO, 2, 100, 'u@upi');
    const stats = getState().getApplicationStats();
    expect(stats.total).toBe(4);
    expect(stats.submitted).toBe(2); // was 1, added 1 more submitted
    expect(stats.totalInvestment).toBeGreaterThan(0);
  });

  it('updates stats after allotment status change', () => {
    getState().updateAllotment('ipo_app_seed_3', 'allotted', 120, 500, 10);
    const stats = getState().getApplicationStats();
    expect(stats.allotted).toBe(2); // was 1, now 2
    expect(stats.submitted).toBe(0); // was 1, now 0
  });
});

describe('IPOStore — clearSeedData', () => {
  beforeEach(() => resetStore());

  it('empties the applications array', () => {
    getState().clearSeedData();
    expect(getState().applications).toHaveLength(0);
  });

  it('does not affect IPOs list', () => {
    const iposBefore = getState().ipos.length;
    getState().clearSeedData();
    expect(getState().ipos).toHaveLength(iposBefore);
  });
});

describe('IPOStore — setSelectedIPO', () => {
  beforeEach(() => resetStore());

  it('sets selectedIPO to the given IPO', () => {
    getState().setSelectedIPO(mockIPO);
    expect(getState().selectedIPO).toEqual(mockIPO);
  });

  it('clears selectedIPO when passing null', () => {
    getState().setSelectedIPO(mockIPO);
    getState().setSelectedIPO(null);
    expect(getState().selectedIPO).toBeNull();
  });
});

describe('IPOStore — toggleBookmark', () => {
  beforeEach(() => resetStore());

  it('toggles isBookmarked from false to true', () => {
    // Find an IPO that starts with isBookmarked: false
    const ipo = getState().ipos.find(i => !i.isBookmarked);
    expect(ipo).toBeDefined();
    getState().toggleBookmark(ipo!.id);
    const updated = getState().ipos.find(i => i.id === ipo!.id);
    expect(updated!.isBookmarked).toBe(true);
  });

  it('toggles isBookmarked from true to false', () => {
    // ipo_1 starts with isBookmarked: true
    getState().toggleBookmark('ipo_1');
    const updated = getState().ipos.find(i => i.id === 'ipo_1');
    expect(updated!.isBookmarked).toBe(false);
  });

  it('does nothing for non-existent IPO', () => {
    const before = getState().ipos.length;
    getState().toggleBookmark('non_existent');
    expect(getState().ipos).toHaveLength(before);
  });

  it('only toggles the targeted IPO', () => {
    const ipo1Before = getState().ipos.find(i => i.id === 'ipo_1')!.isBookmarked;
    getState().toggleBookmark('ipo_2');
    const ipo1After = getState().ipos.find(i => i.id === 'ipo_1')!.isBookmarked;
    expect(ipo1After).toBe(ipo1Before); // unchanged
  });
});

describe('IPOStore — Edge Cases', () => {
  beforeEach(() => resetStore());

  it('applyForIPO followed by updateAllotment — full lifecycle', () => {
    const app = getState().applyForIPO(mockIPO, 5, 110, 'user@upi');
    expect(app.status).toBe('submitted');

    getState().updateAllotment(app.id, 'allotted', 250, 140, 27.3);
    const updated = getState().applications.find(a => a.id === app.id);
    expect(updated!.status).toBe('allotted');
    expect(updated!.sharesAllotted).toBe(250);
    expect(updated!.listingGain).toBe(27.3);
  });

  it('applyForIPO for an existing IPO from the mock list', () => {
    const lgIpo = getState().ipos.find(i => i.id === 'ipo_1')!;
    const app = getState().applyForIPO(lgIpo, 2, 475, 'rahul@upi');
    expect(app.ipoId).toBe('ipo_1');
    expect(app.companyName).toBe('LG Electronics India');
    expect(app.bidQuantity).toBe(2 * lgIpo.lotSize);
  });

  it('multiple applications accumulate correctly', () => {
    getState().applyForIPO(mockIPO, 1, 100, 'a@upi');
    getState().applyForIPO(mockIPO, 2, 110, 'b@upi');
    getState().applyForIPO(mockIPO, 3, 120, 'c@upi');

    expect(getState().applications).toHaveLength(6); // 3 seed + 3 new
    const ipoApps = getState().getApplicationsForIPO('test_ipo_1');
    expect(ipoApps).toHaveLength(3);
  });

  it('getApplicationStats with zero applications after clear', () => {
    getState().clearSeedData();
    const stats = getState().getApplicationStats();
    expect(stats.total).toBe(0);
    expect(stats.submitted).toBe(0);
    expect(stats.allotted).toBe(0);
    expect(stats.notAllotted).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.totalInvestment).toBe(0);
    expect(stats.profitFromAllotted).toBe(0);
  });

  it('toggleBookmark preserves other fields', () => {
    const ipo = getState().ipos.find(i => i.id === 'ipo_1')!;
    const companyName = ipo.companyName;
    getState().toggleBookmark('ipo_1');
    const updated = getState().ipos.find(i => i.id === 'ipo_1')!;
    expect(updated.companyName).toBe(companyName);
    expect(updated.sector).toBeDefined();
    expect(updated.priceBand).toBeDefined();
  });
});
