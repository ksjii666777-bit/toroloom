/**
 * ============================================================================
 * Toroloom — NFO Store Unit Tests
 * ============================================================================
 *
 * Tests NFO application lifecycle: fetch, apply, status update, stats,
 * bookmarks, and edge cases.
 *
 * The store is pure in-memory (no API mocking needed).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useNFOStore } from '../store/nfoStore';
import type { NFOItem } from '../types';

// ──── Helpers ──────────────────────────────────────────────────────────────

function getState() {
  return useNFOStore.getState();
}

/** Reset the store to its initial state between tests. */
function resetStore() {
  useNFOStore.setState(useNFOStore.getInitialState());
}

/**
 * A minimal NFOItem fixture for testing applyForNFO without depending
 * on the mock data structure specifics (just the required fields).
 */
const mockNFO: NFOItem = {
  id: 'test_nfo_1',
  amcName: 'Test AMC',
  logo: 'TA',
  schemeName: 'Test Growth Fund',
  category: 'Equity',
  subCategory: 'Large Cap',
  openDate: '2026-07-20',
  closeDate: '2026-07-30',
  maturityDate: '2029-07-30',
  minInvestment: 5000,
  maxInvestment: 500000,
  entryLoad: 0,
  exitLoad: '0%',
  expenseRatio: 1.5,
  targetSize: 5000,
  collectedAmount: 0,
  totalInvestors: 0,
  subscriptionStatus: 'open',
  riskLevel: 'moderate',
  benchmark: 'Nifty 50',
  fundManagers: ['Test Manager'],
  assetAllocation: [
    { label: 'Equity', percent: 80, color: '#3B82F6' },
    { label: 'Debt', percent: 15, color: '#00E676' },
    { label: 'Cash', percent: 5, color: '#FFC107' },
  ],
  topSectors: ['Technology', 'Finance'],
  objective: 'To generate long-term capital appreciation by investing in equity and equity-related instruments.',
  strategy: 'The scheme will invest predominantly in large cap companies with strong fundamentals.',
  amcRating: 4,
  amcAum: '₹10,000 Cr',
  amcFundsCount: 25,
  about: 'A test NFO for unit tests.',
  strengths: ['Experienced fund management team', 'Proven investment process'],
  risks: ['Market risk', 'Concentration risk'],
  isBookmarked: false,
  applications: 0,
};

// ──── Tests ────────────────────────────────────────────────────────────────

describe('NFOStore — Initial State', () => {
  beforeEach(() => resetStore());

  it('loads NFOs from mock data', () => {
    const nfos = getState().nfos;
    expect(nfos.length).toBeGreaterThan(0);
    expect(nfos[0].id).toBeDefined();
    expect(nfos[0].schemeName).toBeDefined();
  });

  it('loads seed applications from mock data', () => {
    expect(getState().applications.length).toBeGreaterThan(0);
  });

  it('starts with isLoading false', () => {
    expect(getState().isLoading).toBe(false);
  });

  it('starts with selectedNFO null', () => {
    expect(getState().selectedNFO).toBeNull();
  });

  it('seed applications include alloted and submitted statuses', () => {
    const apps = getState().applications;
    expect(apps.filter(a => a.status === 'allotted').length).toBeGreaterThanOrEqual(1);
    expect(apps.filter(a => a.status === 'submitted').length).toBeGreaterThanOrEqual(1);
  });
});

describe('NFOStore — fetchNFOs', () => {
  beforeEach(() => resetStore());

  it('sets isLoading false after fetch completes', async () => {
    await getState().fetchNFOs();
    expect(getState().isLoading).toBe(false);
  });

  it('does not change the existing NFOs array', async () => {
    const before = getState().nfos.length;
    await getState().fetchNFOs();
    expect(getState().nfos).toHaveLength(before);
  });
});

describe('NFOStore — applyForNFO', () => {
  beforeEach(() => resetStore());

  it('creates a new application with submitted status', () => {
    const app = getState().applyForNFO(mockNFO, 50000);

    expect(app.nfoId).toBe('test_nfo_1');
    expect(app.schemeName).toBe('Test Growth Fund');
    expect(app.amount).toBe(50000);
    expect(app.status).toBe('submitted');
    expect(app.appliedAt).toBeDefined();
  });

  it('sets navAtAllotment to 10 (standard NFO price)', () => {
    const app = getState().applyForNFO(mockNFO, 50000);
    expect(app.navAtAllotment).toBe(10);
  });

  it('computes unitsAllotted as amount / 10', () => {
    const app = getState().applyForNFO(mockNFO, 50000);
    expect(app.unitsAllotted).toBe(5000);
  });

  it('sets currentNav and currentValue equal to amount at creation', () => {
    const app = getState().applyForNFO(mockNFO, 50000);
    expect(app.currentNav).toBe(10);
    expect(app.currentValue).toBe(50000);
  });

  it('prepends the new application to the list', () => {
    const before = getState().applications.length;
    getState().applyForNFO(mockNFO, 10000);
    expect(getState().applications).toHaveLength(before + 1);
    expect(getState().applications[0].schemeName).toBe('Test Growth Fund');
  });

  it('preserves existing seed applications', () => {
    getState().applyForNFO(mockNFO, 25000);
    const seedApp = getState().applications.find(a => a.id === 'nfo_app_1');
    expect(seedApp).toBeDefined();
  });

  it('generates unique application IDs', () => {
    const app1 = getState().applyForNFO(mockNFO, 10000);
    const app2 = getState().applyForNFO(mockNFO, 20000);
    expect(app1.id).not.toBe(app2.id);
    expect(app1.id).toMatch(/^nfo_app_/);
  });

  it('copies amcName, logo, and category from the NFO item', () => {
    const app = getState().applyForNFO(mockNFO, 15000);
    expect(app.amcName).toBe('Test AMC');
    expect(app.logo).toBe('TA');
    expect(app.category).toBe('Equity');
  });

  it('handles minimum investment amount', () => {
    const app = getState().applyForNFO(mockNFO, mockNFO.minInvestment);
    expect(app.amount).toBe(5000);
    expect(app.unitsAllotted).toBe(500);
  });

  it('handles large investment amounts', () => {
    const app = getState().applyForNFO(mockNFO, 500000);
    expect(app.amount).toBe(500000);
    expect(app.unitsAllotted).toBe(50000);
  });
});

describe('NFOStore — updateApplication', () => {
  beforeEach(() => resetStore());

  it('updates application status to allotted', () => {
    getState().updateApplication('nfo_app_1', { status: 'allotted' });
    const app = getState().applications.find(a => a.id === 'nfo_app_1');
    expect(app).toBeDefined();
    expect(app!.status).toBe('allotted');
  });

  it('updates currentNav and currentValue together', () => {
    getState().updateApplication('nfo_app_1', { currentNav: 12.5, currentValue: 62500 });
    const app = getState().applications.find(a => a.id === 'nfo_app_1');
    expect(app!.currentNav).toBe(12.5);
    expect(app!.currentValue).toBe(62500);
  });

  it('preserves existing fields when only partial updates are provided', () => {
    getState().updateApplication('nfo_app_1', { status: 'matured' });
    const app = getState().applications.find(a => a.id === 'nfo_app_1');
    expect(app!.status).toBe('matured');
    expect(app!.schemeName).toBe('HDFC Manufacturing Fund'); // unchanged
    expect(app!.amount).toBe(50000); // unchanged
  });

  it('does nothing for non-existent application', () => {
    const before = getState().applications.length;
    getState().updateApplication('non_existent', { status: 'matured' });
    expect(getState().applications).toHaveLength(before);
  });

  it('only updates the targeted application', () => {
    getState().updateApplication('nfo_app_1', { status: 'matured' });
    const app2 = getState().applications.find(a => a.id === 'nfo_app_2');
    expect(app2!.status).toBe('allotted'); // unchanged
  });
});

describe('NFOStore — getApplicationsForNFO', () => {
  beforeEach(() => resetStore());

  it('returns applications for a specific NFO', () => {
    const apps = getState().getApplicationsForNFO('nfo_1');
    expect(apps.length).toBeGreaterThan(0);
    expect(apps[0].nfoId).toBe('nfo_1');
  });

  it('returns multiple applications for the same NFO', () => {
    getState().applyForNFO(mockNFO, 10000);
    getState().applyForNFO(mockNFO, 20000);
    const apps = getState().getApplicationsForNFO('test_nfo_1');
    expect(apps).toHaveLength(2);
  });

  it('returns empty array when no applications match', () => {
    const apps = getState().getApplicationsForNFO('non_existent_nfo');
    expect(apps).toHaveLength(0);
  });
});

describe('NFOStore — getApplicationStats', () => {
  beforeEach(() => resetStore());

  it('counts total applications', () => {
    const stats = getState().getApplicationStats();
    expect(stats.total).toBe(getState().applications.length);
  });

  it('counts submitted applications', () => {
    const stats = getState().getApplicationStats();
    const submittedCount = getState().applications.filter(a => a.status === 'submitted').length;
    expect(stats.submitted).toBe(submittedCount);
  });

  it('counts allotted applications', () => {
    const stats = getState().getApplicationStats();
    const allottedCount = getState().applications.filter(a => a.status === 'allotted').length;
    expect(stats.allotted).toBe(allottedCount);
  });

  it('counts in_progress applications', () => {
    const stats = getState().getApplicationStats();
    const inProgressCount = getState().applications.filter(a => a.status === 'in_progress').length;
    expect(stats.inProgress).toBe(inProgressCount);
  });

  it('counts matured applications', () => {
    const stats = getState().getApplicationStats();
    const maturedCount = getState().applications.filter(a => a.status === 'matured').length;
    expect(stats.matured).toBe(maturedCount);
  });

  it('computes totalInvestment across all applications', () => {
    const stats = getState().getApplicationStats();
    const expected = getState().applications.reduce((sum, a) => sum + a.amount, 0);
    expect(stats.totalInvestment).toBe(expected);
  });

  it('computes totalCurrent across all applications', () => {
    const stats = getState().getApplicationStats();
    const expected = getState().applications.reduce((sum, a) => sum + a.currentValue, 0);
    expect(stats.totalCurrent).toBe(expected);
  });

  it('computes totalReturn as totalCurrent - totalInvestment', () => {
    const stats = getState().getApplicationStats();
    expect(stats.totalReturn).toBe(stats.totalCurrent - stats.totalInvestment);
  });

  it('updates stats after a new application', () => {
    const before = getState().getApplicationStats();
    getState().applyForNFO(mockNFO, 50000);
    const stats = getState().getApplicationStats();
    expect(stats.total).toBe(before.total + 1);
    expect(stats.submitted).toBe(before.submitted + 1);
    expect(stats.totalInvestment).toBe(before.totalInvestment + 50000);
  });

  it('updates stats after status change', () => {
    getState().updateApplication('nfo_app_3', { status: 'matured' });
    const stats = getState().getApplicationStats();
    expect(stats.matured).toBeGreaterThan(0);
  });
});

describe('NFOStore — clearSeedData', () => {
  beforeEach(() => resetStore());

  it('empties the applications array', () => {
    getState().clearSeedData();
    expect(getState().applications).toHaveLength(0);
  });

  it('does not affect NFOs list', () => {
    const nfosBefore = getState().nfos.length;
    getState().clearSeedData();
    expect(getState().nfos).toHaveLength(nfosBefore);
  });
});

describe('NFOStore — setSelectedNFO', () => {
  beforeEach(() => resetStore());

  it('sets selectedNFO to the given NFO', () => {
    getState().setSelectedNFO(mockNFO);
    expect(getState().selectedNFO).toEqual(mockNFO);
  });

  it('clears selectedNFO when passing null', () => {
    getState().setSelectedNFO(mockNFO);
    getState().setSelectedNFO(null);
    expect(getState().selectedNFO).toBeNull();
  });
});

describe('NFOStore — toggleBookmark', () => {
  beforeEach(() => resetStore());

  it('toggles isBookmarked from false to true', () => {
    // Find an NFO that starts with isBookmarked: false
    const nfo = getState().nfos.find(n => !n.isBookmarked);
    expect(nfo).toBeDefined();
    getState().toggleBookmark(nfo!.id);
    const updated = getState().nfos.find(n => n.id === nfo!.id);
    expect(updated!.isBookmarked).toBe(true);
  });

  it('toggles isBookmarked from true to false', () => {
    // nfo_1 and nfo_4 start with isBookmarked: true
    getState().toggleBookmark('nfo_1');
    const updated = getState().nfos.find(n => n.id === 'nfo_1');
    expect(updated!.isBookmarked).toBe(false);
  });

  it('does nothing for non-existent NFO', () => {
    const before = getState().nfos.length;
    getState().toggleBookmark('non_existent');
    expect(getState().nfos).toHaveLength(before);
  });

  it('only toggles the targeted NFO', () => {
    const nfo2Before = getState().nfos.find(n => n.id === 'nfo_2')!.isBookmarked;
    getState().toggleBookmark('nfo_1');
    const nfo2After = getState().nfos.find(n => n.id === 'nfo_2')!.isBookmarked;
    expect(nfo2After).toBe(nfo2Before);
  });
});

describe('NFOStore — Edge Cases', () => {
  beforeEach(() => resetStore());

  it('applyForNFO followed by updateApplication — full lifecycle', () => {
    const app = getState().applyForNFO(mockNFO, 50000);
    expect(app.status).toBe('submitted');

    getState().updateApplication(app.id, {
      status: 'allotted',
      currentNav: 10.85,
      currentValue: 54250,
    });
    const updated = getState().applications.find(a => a.id === app.id);
    expect(updated!.status).toBe('allotted');
    expect(updated!.currentNav).toBe(10.85);
    expect(updated!.currentValue).toBe(54250);
  });

  it('applyForNFO for an existing NFO from the mock list', () => {
    const hdfcNfo = getState().nfos.find(n => n.id === 'nfo_1')!;
    const app = getState().applyForNFO(hdfcNfo, 75000);
    expect(app.nfoId).toBe('nfo_1');
    expect(app.schemeName).toBe('HDFC Manufacturing Fund');
    expect(app.amcName).toBe('HDFC Mutual Fund');
    expect(app.logo).toBe('HF');
  });

  it('multiple applications accumulate correctly', () => {
    getState().applyForNFO(mockNFO, 10000);
    getState().applyForNFO(mockNFO, 20000);
    getState().applyForNFO(mockNFO, 30000);

    const beforeCount = getState().applications.length;
    expect(beforeCount).toBeGreaterThanOrEqual(3 + 3); // 3 seed + 3 new
    const nfoApps = getState().getApplicationsForNFO('test_nfo_1');
    expect(nfoApps).toHaveLength(3);
  });

  it('getApplicationStats with zero applications after clear', () => {
    getState().clearSeedData();
    const stats = getState().getApplicationStats();
    expect(stats.total).toBe(0);
    expect(stats.submitted).toBe(0);
    expect(stats.allotted).toBe(0);
    expect(stats.inProgress).toBe(0);
    expect(stats.matured).toBe(0);
    expect(stats.totalInvestment).toBe(0);
    expect(stats.totalCurrent).toBe(0);
    expect(stats.totalReturn).toBe(0);
  });

  it('toggleBookmark preserves other fields', () => {
    const nfo = getState().nfos.find(n => n.id === 'nfo_1')!;
    const schemeName = nfo.schemeName;
    getState().toggleBookmark('nfo_1');
    const updated = getState().nfos.find(n => n.id === 'nfo_1')!;
    expect(updated.schemeName).toBe(schemeName);
    expect(updated.amcName).toBeDefined();
    expect(updated.assetAllocation).toBeDefined();
  });

  it('getApplicationsForNFO returns correct results after applyForNFO', () => {
    const testNfo = getState().nfos.find(n => n.id === 'nfo_4')!;
    // nfo_4 has no seed applications
    const before = getState().getApplicationsForNFO('nfo_4');
    expect(before).toHaveLength(0);

    getState().applyForNFO(testNfo, 50000);
    getState().applyForNFO(testNfo, 75000);

    const after = getState().getApplicationsForNFO('nfo_4');
    expect(after).toHaveLength(2);
    expect(after[0].amount).toBe(75000); // most recent first
    expect(after[1].amount).toBe(50000);
  });
});
