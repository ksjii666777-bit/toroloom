/**
 * ============================================================================
 * Toroloom — A/B Test Store Unit Tests
 * ============================================================================
 *
 * Tests the complete A/B experiment lifecycle: CRUD, status transitions,
 * variant management, metric simulation, and computed helpers.
 *
 * The store is pure in-memory (no API mocking needed).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useABTestStore } from '../store/abTestStore';
import type { ABExperiment } from '../types';

// ──── Helpers ──────────────────────────────────────────────────────────────

function getState() {
  return useABTestStore.getState();
}

/** Reset the store to its initial mock state between tests. */
function resetStore() {
  useABTestStore.setState(useABTestStore.getInitialState());
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('ABTestStore — Initial State', () => {
  beforeEach(() => resetStore());

  it('loads 5 mock experiments', () => {
    expect(getState().experiments).toHaveLength(5);
  });

  it('has a running experiment (Home Screen Layout)', () => {
    const exp = getState().experiments.find(e => e.id === 'exp_1');
    expect(exp).toBeDefined();
    expect(exp!.status).toBe('running');
    expect(exp!.name).toBe('Home Screen Layout');
  });

  it('has a completed experiment with a winner', () => {
    const exp = getState().experiments.find(e => e.id === 'exp_3');
    expect(exp).toBeDefined();
    expect(exp!.status).toBe('completed');
    expect(exp!.hasWinner).toBe(true);
    expect(exp!.winnerVariantId).toBe('exp_3_var_2');
  });

  it('has a draft experiment', () => {
    const exp = getState().experiments.find(e => e.id === 'exp_4');
    expect(exp).toBeDefined();
    expect(exp!.status).toBe('draft');
  });

  it('has a paused experiment', () => {
    const exp = getState().experiments.find(e => e.id === 'exp_5');
    expect(exp).toBeDefined();
    expect(exp!.status).toBe('paused');
  });

  it('starts with selectedExperimentId null', () => {
    expect(getState().selectedExperimentId).toBeNull();
  });
});

describe('ABTestStore — createExperiment', () => {
  beforeEach(() => resetStore());

  it('creates a new experiment with draft status', () => {
    const id = getState().createExperiment(
      'Test Experiment',
      'Description',
      'test_feature',
      ['test'],
      [{ name: 'Control', description: 'Current', trafficPercent: 50, color: '#000', isControl: true }],
    );

    const exp = getState().experiments.find(e => e.id === id);
    expect(exp).toBeDefined();
    expect(exp!.name).toBe('Test Experiment');
    expect(exp!.description).toBe('Description');
    expect(exp!.featureKey).toBe('test_feature');
    expect(exp!.status).toBe('draft');
    expect(exp!.tags).toEqual(['test']);
    expect(exp!.totalUsers).toBe(0);
    expect(exp!.owner).toBe('You');
    expect(exp!.hasWinner).toBe(false);
    expect(exp!.startedAt).toBeNull();
    expect(exp!.endedAt).toBeNull();
    expect(exp!.createdAt).toBeDefined();
  });

  it('prepends the new experiment to the list', () => {
    const before = getState().experiments.length;
    getState().createExperiment('New', 'Desc', 'key', [], [
      { name: 'Control', description: 'Current', trafficPercent: 100, color: '#000', isControl: true },
    ]);
    expect(getState().experiments).toHaveLength(before + 1);
    expect(getState().experiments[0].name).toBe('New');
  });

  it('auto-selects the newly created experiment', () => {
    const id = getState().createExperiment('New', 'Desc', 'key', [], [
      { name: 'Control', description: 'Current', trafficPercent: 100, color: '#000', isControl: true },
    ]);
    expect(getState().selectedExperimentId).toBe(id);
  });

  it('generates unique experiment IDs', () => {
    const id1 = getState().createExperiment('A', 'Desc', 'key', [], [
      { name: 'Control', description: 'Current', trafficPercent: 100, color: '#000', isControl: true },
    ]);
    const id2 = getState().createExperiment('B', 'Desc', 'key', [], [
      { name: 'Control', description: 'Current', trafficPercent: 100, color: '#000', isControl: true },
    ]);
    expect(id1).not.toBe(id2);
  });

  it('creates variants with correct structure', () => {
    const id = getState().createExperiment('Test', 'Desc', 'key', [], [
      { name: 'Control', description: 'Current layout', trafficPercent: 60, color: '#333', isControl: true },
      { name: 'Variant A', description: 'New layout', trafficPercent: 40, color: '#666', isControl: false },
    ]);

    const exp = getState().experiments.find(e => e.id === id);
    expect(exp!.variants).toHaveLength(2);
    expect(exp!.variants[0].isControl).toBe(true);
    expect(exp!.variants[0].name).toBe('Control');
    expect(exp!.variants[0].assignedUsers).toBe(0);
    expect(exp!.variants[0].conversions).toBe(0);
    expect(exp!.variants[0].conversionRate).toBe(0);
    expect(exp!.variants[0].confidence).toBe(0);
    expect(exp!.variants[1].isControl).toBe(false);
    expect(exp!.variants[1].id).toContain(`${id}_var_1`);
  });
});

describe('ABTestStore — updateExperiment', () => {
  beforeEach(() => resetStore());

  it('updates experiment fields partially', () => {
    getState().updateExperiment('exp_1', { name: 'Updated Name', description: 'Updated description' });
    const exp = getState().experiments.find(e => e.id === 'exp_1');
    expect(exp!.name).toBe('Updated Name');
    expect(exp!.description).toBe('Updated description');
    // Other fields unchanged
    expect(exp!.status).toBe('running');
  });

  it('does nothing for non-existent experiment', () => {
    const before = getState().experiments.length;
    getState().updateExperiment('non_existent', { name: 'Nope' });
    expect(getState().experiments).toHaveLength(before);
  });
});

describe('ABTestStore — deleteExperiment', () => {
  beforeEach(() => resetStore());

  it('removes the experiment from the list', () => {
    getState().deleteExperiment('exp_1');
    expect(getState().experiments.find(e => e.id === 'exp_1')).toBeUndefined();
    expect(getState().experiments).toHaveLength(4);
  });

  it('clears selectedExperimentId when deleted experiment was selected', () => {
    getState().selectExperiment('exp_2');
    getState().deleteExperiment('exp_2');
    expect(getState().selectedExperimentId).toBeNull();
  });

  it('keeps selectedExperimentId when deleting a different experiment', () => {
    getState().selectExperiment('exp_1');
    getState().deleteExperiment('exp_2');
    expect(getState().selectedExperimentId).toBe('exp_1');
  });

  it('does nothing for non-existent experiment', () => {
    const before = getState().experiments.length;
    getState().deleteExperiment('non_existent');
    expect(getState().experiments).toHaveLength(before);
  });
});

describe('ABTestStore — startExperiment', () => {
  beforeEach(() => resetStore());

  it('sets status to running on a draft experiment', () => {
    getState().startExperiment('exp_4');
    const exp = getState().experiments.find(e => e.id === 'exp_4');
    expect(exp!.status).toBe('running');
  });

  it('assigns users and conversions to variants', () => {
    getState().startExperiment('exp_4');
    const exp = getState().experiments.find(e => e.id === 'exp_4');
    expect(exp!.totalUsers).toBeGreaterThan(0);
    expect(exp!.variants[0].assignedUsers).toBeGreaterThan(0);
    expect(exp!.variants[1].assignedUsers).toBeGreaterThan(0);
    expect(exp!.variants[1].conversionRate).toBeGreaterThan(0);
  });

  it('sets startedAt timestamp', () => {
    getState().startExperiment('exp_4');
    const exp = getState().experiments.find(e => e.id === 'exp_4');
    expect(exp!.startedAt).not.toBeNull();
  });

  it('computes confidence for non-control variants', () => {
    getState().startExperiment('exp_4');
    const exp = getState().experiments.find(e => e.id === 'exp_4');
    expect(exp!.variants[1].confidence).toBeGreaterThanOrEqual(0);
  });

  it('does nothing for a running experiment', () => {
    // Remember the variants before
    const before = getState().experiments.find(e => e.id === 'exp_1');
    getState().startExperiment('exp_1');
    const after = getState().experiments.find(e => e.id === 'exp_1');
    expect(after!.status).toBe('running');
    // Should not have changed
    expect(after!.variants[0].assignedUsers).toBe(before!.variants[0].assignedUsers);
  });

  it('does nothing for a completed experiment', () => {
    getState().startExperiment('exp_3');
    const exp = getState().experiments.find(e => e.id === 'exp_3');
    expect(exp!.status).toBe('completed');
  });

  it('does nothing for a paused experiment', () => {
    getState().startExperiment('exp_5');
    const exp = getState().experiments.find(e => e.id === 'exp_5');
    expect(exp!.status).toBe('paused');
  });

  it('does nothing for an archived experiment (via updateExperiment)', () => {
    getState().archiveExperiment('exp_1');
    getState().startExperiment('exp_1');
    const exp = getState().experiments.find(e => e.id === 'exp_1');
    expect(exp!.status).toBe('archived');
  });

  it('does nothing for non-existent experiment', () => {
    const before = getState().experiments.length;
    getState().startExperiment('non_existent');
    expect(getState().experiments).toHaveLength(5);
  });
});

describe('ABTestStore — pauseExperiment', () => {
  beforeEach(() => resetStore());

  it('pauses a running experiment', () => {
    getState().pauseExperiment('exp_1');
    expect(getState().experiments.find(e => e.id === 'exp_1')!.status).toBe('paused');
  });

  it('does nothing for a draft experiment', () => {
    getState().pauseExperiment('exp_4');
    expect(getState().experiments.find(e => e.id === 'exp_4')!.status).toBe('draft');
  });

  it('does nothing for a completed experiment', () => {
    getState().pauseExperiment('exp_3');
    expect(getState().experiments.find(e => e.id === 'exp_3')!.status).toBe('completed');
  });

  it('does nothing for a paused experiment', () => {
    getState().pauseExperiment('exp_5');
    expect(getState().experiments.find(e => e.id === 'exp_5')!.status).toBe('paused');
  });
});

describe('ABTestStore — resumeExperiment', () => {
  beforeEach(() => resetStore());

  it('resumes a paused experiment', () => {
    getState().resumeExperiment('exp_5');
    expect(getState().experiments.find(e => e.id === 'exp_5')!.status).toBe('running');
  });

  it('does nothing for a running experiment', () => {
    getState().resumeExperiment('exp_1');
    expect(getState().experiments.find(e => e.id === 'exp_1')!.status).toBe('running');
  });

  it('does nothing for a draft experiment', () => {
    getState().resumeExperiment('exp_4');
    expect(getState().experiments.find(e => e.id === 'exp_4')!.status).toBe('draft');
  });
});

describe('ABTestStore — completeExperiment', () => {
  beforeEach(() => resetStore());

  it('completes a running experiment', () => {
    getState().completeExperiment('exp_1');
    const exp = getState().experiments.find(e => e.id === 'exp_1');
    expect(exp!.status).toBe('completed');
    expect(exp!.endedAt).not.toBeNull();
  });

  it('determines a winner when a non-control variant has high confidence', () => {
    // exp_2 has a variant with confidence 72 (area chart at 72% confidence)
    getState().completeExperiment('exp_2');
    const exp = getState().experiments.find(e => e.id === 'exp_2');
    expect(exp!.hasWinner).toBe(false); // 72 < 80
    expect(exp!.winnerVariantId).toBeUndefined();
  });

  it('marks winner when confidence >= 80', () => {
    // exp_1 variant has confidence 89
    getState().completeExperiment('exp_1');
    const exp = getState().experiments.find(e => e.id === 'exp_1');
    // The second variant (cards) has confidence 89 >= 80
    expect(exp!.hasWinner).toBe(true);
    expect(exp!.winnerVariantId).toBe('exp_1_var_2');
  });

  it('does nothing for a draft experiment', () => {
    getState().completeExperiment('exp_4');
    expect(getState().experiments.find(e => e.id === 'exp_4')!.status).toBe('draft');
  });

  it('does nothing for non-existent experiment', () => {
    const before = getState().experiments.length;
    getState().completeExperiment('non_existent');
    expect(getState().experiments).toHaveLength(before);
  });

  it('completes a paused experiment too', () => {
    getState().completeExperiment('exp_5');
    expect(getState().experiments.find(e => e.id === 'exp_5')!.status).toBe('completed');
  });
});

describe('ABTestStore — archiveExperiment', () => {
  beforeEach(() => resetStore());

  it('archives any experiment regardless of current status', () => {
    getState().archiveExperiment('exp_3');
    expect(getState().experiments.find(e => e.id === 'exp_3')!.status).toBe('archived');
  });

  it('archives a running experiment', () => {
    getState().archiveExperiment('exp_1');
    expect(getState().experiments.find(e => e.id === 'exp_1')!.status).toBe('archived');
  });

  it('archives a draft experiment', () => {
    getState().archiveExperiment('exp_4');
    expect(getState().experiments.find(e => e.id === 'exp_4')!.status).toBe('archived');
  });
});

describe('ABTestStore — addVariant', () => {
  beforeEach(() => resetStore());

  it('adds a variant to a draft experiment', () => {
    getState().addVariant('exp_4', 'Variant B', 'New option', 30, '#FF0000');
    const exp = getState().experiments.find(e => e.id === 'exp_4');
    expect(exp!.variants).toHaveLength(3);
    const added = exp!.variants[2];
    expect(added.name).toBe('Variant B');
    expect(added.description).toBe('New option');
    expect(added.trafficPercent).toBe(30);
    expect(added.color).toBe('#FF0000');
    expect(added.isControl).toBe(false);
    expect(added.assignedUsers).toBe(0);
  });

  it('does nothing for a running experiment', () => {
    const before = getState().experiments.find(e => e.id === 'exp_1')!.variants.length;
    getState().addVariant('exp_1', 'Variant C', 'Extra', 10, '#FFF');
    expect(getState().experiments.find(e => e.id === 'exp_1')!.variants).toHaveLength(before);
  });

  it('does nothing for a non-existent experiment', () => {
    const before = getState().experiments.length;
    getState().addVariant('non_existent', 'Variant', 'Desc', 50, '#000');
    expect(getState().experiments).toHaveLength(before);
  });
});

describe('ABTestStore — removeVariant', () => {
  beforeEach(() => resetStore());

  it('removes a non-control variant from an experiment', () => {
    getState().removeVariant('exp_1', 'exp_1_var_2');
    const exp = getState().experiments.find(e => e.id === 'exp_1');
    expect(exp!.variants).toHaveLength(1);
    expect(exp!.variants[0].isControl).toBe(true);
  });

  it('does not remove the control variant', () => {
    getState().removeVariant('exp_1', 'exp_1_var_1');
    const exp = getState().experiments.find(e => e.id === 'exp_1');
    expect(exp!.variants).toHaveLength(2); // still 2 because control is protected
    expect(exp!.variants[0].isControl).toBe(true);
  });

  it('does nothing for non-existent experiment', () => {
    const before = getState().experiments.length;
    getState().removeVariant('non_existent', 'var_1');
    expect(getState().experiments).toHaveLength(before);
  });
});

describe('ABTestStore — simulateMetrics', () => {
  beforeEach(() => resetStore());

  it('adds traffic and conversions to a running experiment', () => {
    const before = getState().experiments.find(e => e.id === 'exp_1')!.totalUsers;
    getState().simulateMetrics('exp_1');
    const after = getState().experiments.find(e => e.id === 'exp_1')!.totalUsers;
    expect(after).toBeGreaterThan(before);
  });

  it('recomputes conversion rates after simulation', () => {
    const before = getState().experiments.find(e => e.id === 'exp_1')!.variants[1].conversionRate;
    getState().simulateMetrics('exp_1');
    const after = getState().experiments.find(e => e.id === 'exp_1')!.variants[1].conversionRate;
    expect(after).toBeGreaterThanOrEqual(0);
  });

  it('does nothing for a draft experiment', () => {
    const before = getState().experiments.find(e => e.id === 'exp_4')!.totalUsers;
    getState().simulateMetrics('exp_4');
    const after = getState().experiments.find(e => e.id === 'exp_4')!.totalUsers;
    expect(after).toBe(before);
  });

  it('does nothing for a completed experiment', () => {
    const before = getState().experiments.find(e => e.id === 'exp_3')!.totalUsers;
    getState().simulateMetrics('exp_3');
    const after = getState().experiments.find(e => e.id === 'exp_3')!.totalUsers;
    expect(after).toBe(before);
  });

  it('does nothing for non-existent experiment', () => {
    const before = getState().experiments.length;
    getState().simulateMetrics('non_existent');
    expect(getState().experiments).toHaveLength(before);
  });
});

describe('ABTestStore — selectExperiment', () => {
  beforeEach(() => resetStore());

  it('sets selectedExperimentId', () => {
    getState().selectExperiment('exp_1');
    expect(getState().selectedExperimentId).toBe('exp_1');
  });

  it('clears selection when passing null', () => {
    getState().selectExperiment('exp_1');
    getState().selectExperiment(null);
    expect(getState().selectedExperimentId).toBeNull();
  });
});

describe('ABTestStore — getExperimentById', () => {
  beforeEach(() => resetStore());

  it('returns the experiment when found', () => {
    const exp = getState().getExperimentById('exp_1');
    expect(exp).toBeDefined();
    expect(exp!.name).toBe('Home Screen Layout');
  });

  it('returns undefined for non-existent id', () => {
    expect(getState().getExperimentById('non_existent')).toBeUndefined();
  });
});

describe('ABTestStore — getMetricSnapshot', () => {
  beforeEach(() => resetStore());

  it('computes totalExposed and totalConversions for running experiment', () => {
    const snap = getState().getMetricSnapshot('exp_1');
    expect(snap.experimentId).toBe('exp_1');
    expect(snap.totalExposed).toBeGreaterThan(0);
    expect(snap.totalConversions).toBeGreaterThan(0);
    expect(snap.overallConversionRate).toBeGreaterThan(0);
    expect(snap.computedAt).toBeDefined();
  });

  it('computes liftOverControl for experiments with control', () => {
    const snap = getState().getMetricSnapshot('exp_1');
    // The overall conversion rate vs the control rate should give some lift value
    expect(typeof snap.liftOverControl).toBe('number');
  });

  it('returns empty snapshot for non-existent experiment', () => {
    const snap = getState().getMetricSnapshot('non_existent');
    expect(snap.experimentId).toBe('non_existent');
    expect(snap.totalExposed).toBe(0);
    expect(snap.totalConversions).toBe(0);
    expect(snap.overallConversionRate).toBe(0);
    expect(snap.liftOverControl).toBe(0);
  });

  it('computes snapshot for completed experiment', () => {
    const snap = getState().getMetricSnapshot('exp_3');
    expect(snap.totalExposed).toBe(7000);
    expect(snap.totalConversions).toBe(2100 + 1512 + 840);
    expect(snap.overallConversionRate).toBeGreaterThan(0);
  });
});

describe('ABTestStore — getFilteredExperiments', () => {
  beforeEach(() => resetStore());

  it('returns all experiments when status is "all"', () => {
    expect(getState().getFilteredExperiments('all')).toHaveLength(5);
  });

  it('filters by running status', () => {
    const filtered = getState().getFilteredExperiments('running');
    expect(filtered).toHaveLength(2);
    filtered.forEach(e => expect(e.status).toBe('running'));
  });

  it('filters by draft status', () => {
    const filtered = getState().getFilteredExperiments('draft');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('exp_4');
  });

  it('filters by completed status', () => {
    const filtered = getState().getFilteredExperiments('completed');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('exp_3');
  });

  it('filters by paused status', () => {
    const filtered = getState().getFilteredExperiments('paused');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('exp_5');
  });

  it('filters by archived status (none initially)', () => {
    const filtered = getState().getFilteredExperiments('archived');
    expect(filtered).toHaveLength(0);
  });
});

describe('ABTestStore — Edge Cases', () => {
  beforeEach(() => resetStore());

  it('addVariant when only draft experiments accept variants', () => {
    // Try adding to all status types
    getState().addVariant('exp_1', 'V', 'D', 10, '#000'); // running
    getState().addVariant('exp_3', 'V', 'D', 10, '#000'); // completed
    getState().addVariant('exp_5', 'V', 'D', 10, '#000'); // paused
    getState().addVariant('exp_4', 'V', 'D', 10, '#000'); // draft

    expect(getState().experiments.find(e => e.id === 'exp_1')!.variants).toHaveLength(2);
    expect(getState().experiments.find(e => e.id === 'exp_3')!.variants).toHaveLength(3);
    expect(getState().experiments.find(e => e.id === 'exp_5')!.variants).toHaveLength(2);
    expect(getState().experiments.find(e => e.id === 'exp_4')!.variants).toHaveLength(3);
  });

  it('completeExperiment on experiment with all low confidence — no winner', () => {
    // exp_5 has confidence 45 on its non-control variant (< 80)
    getState().completeExperiment('exp_5');
    const exp = getState().experiments.find(e => e.id === 'exp_5');
    expect(exp!.status).toBe('completed');
    expect(exp!.hasWinner).toBe(false);
    expect(exp!.winnerVariantId).toBeUndefined();
  });

  it('simulateMetrics does not mutate other experiments', () => {
    const beforeExp2 = getState().experiments.find(e => e.id === 'exp_2')!.totalUsers;
    getState().simulateMetrics('exp_1');
    const afterExp2 = getState().experiments.find(e => e.id === 'exp_2')!.totalUsers;
    expect(afterExp2).toBe(beforeExp2);
  });

  it('deleteExperiment does not affect other experiments', () => {
    getState().deleteExperiment('exp_1');
    expect(getState().experiments.find(e => e.id === 'exp_2')).toBeDefined();
    expect(getState().experiments.find(e => e.id === 'exp_3')).toBeDefined();
    expect(getState().experiments.find(e => e.id === 'exp_4')).toBeDefined();
    expect(getState().experiments.find(e => e.id === 'exp_5')).toBeDefined();
  });

  it('lifecycle: draft → start → pause → resume → complete', () => {
    const id = getState().createExperiment('Lifecycle', 'Test', 'key', [], [
      { name: 'Control', description: 'Current', trafficPercent: 50, color: '#000', isControl: true },
      { name: 'Variant', description: 'New', trafficPercent: 50, color: '#FFF', isControl: false },
    ]);

    expect(getState().getExperimentById(id)!.status).toBe('draft');

    getState().startExperiment(id);
    expect(getState().getExperimentById(id)!.status).toBe('running');
    expect(getState().getExperimentById(id)!.startedAt).not.toBeNull();

    getState().pauseExperiment(id);
    expect(getState().getExperimentById(id)!.status).toBe('paused');

    getState().resumeExperiment(id);
    expect(getState().getExperimentById(id)!.status).toBe('running');

    getState().completeExperiment(id);
    expect(getState().getExperimentById(id)!.status).toBe('completed');
    expect(getState().getExperimentById(id)!.endedAt).not.toBeNull();
  });
});
