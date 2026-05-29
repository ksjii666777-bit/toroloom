/**
 * ============================================================================
 * Toroloom — AI Insights Store Tests
 * ============================================================================
 *
 * Tests the AI store: initial state, fetchInsights
 * (with/without stockId, fallback when API fails), and generateInsight
 * simulation fallback.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from '../store/aiStore';

// Mock the AI API module so every call rejects, forcing the store into its
// fallback / catch behaviour (no real fetch calls).
vi.mock('../services/api/ai', () => ({
  aiApi: {
    getInsights: vi.fn().mockRejectedValue(new Error('Network error')),
    analyze: vi.fn().mockRejectedValue(new Error('Network error')),
  },
}));

describe('AIStore — Initial State', () => {
  beforeEach(() => {
    useAIStore.setState({
      insights: [],
      isLoading: false,
    });
  });

  it('starts with empty insights when reset', () => {
    const state = useAIStore.getState();
    expect(state.insights).toEqual([]);
    expect(state.isLoading).toBe(false);
  });
});

describe('AIStore — fetchInsights (API failure fallback)', () => {
  beforeEach(() => {
    useAIStore.setState({
      insights: [],
      isLoading: false,
    });
  });

  it('sets isLoading during fetch and clears it on failure', async () => {
    const promise = useAIStore.getState().fetchInsights();
    expect(useAIStore.getState().isLoading).toBe(true);
    await promise;
    expect(useAIStore.getState().isLoading).toBe(false);
  });

  it('filters mock insights by stockId when API fails', async () => {
    await useAIStore.getState().fetchInsights('RELIANCE');
    const state = useAIStore.getState();
    expect(state.insights.length).toBeGreaterThan(0);
    state.insights.forEach(insight => {
      expect(insight.stockId).toBe('RELIANCE');
    });
  });

  it('keeps existing insights when no stockId provided and API fails', async () => {
    await useAIStore.getState().fetchInsights();
    const state = useAIStore.getState();
    // When no stockId, catch block only sets isLoading: false, doesn't touch insights
    expect(state.insights).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('preserves existing insights when fetch fails without stockId', async () => {
    useAIStore.setState({
      insights: [{
        id: 'existing', stockId: 'TEST', symbol: 'TEST', name: 'Test',
        type: 'bullish', confidence: 80, summary: 'Test', analysis: 'Test',
        targets: [], timestamp: '2025-01-01',
      }],
    });

    await useAIStore.getState().fetchInsights();
    const state = useAIStore.getState();
    // When stockId is not provided, catch block doesn't modify insights at all
    expect(state.insights).toHaveLength(1);
    expect(state.insights[0].id).toBe('existing');
  });
});

describe('AIStore — generateInsight (API failure fallback)', () => {
  beforeEach(() => {
    useAIStore.setState({
      insights: [],
      isLoading: false,
    });
  });

  it('sets isLoading during generation and clears it on failure', async () => {
    const promise = useAIStore.getState().generateInsight('RELIANCE');
    expect(useAIStore.getState().isLoading).toBe(true);
    await promise;
    expect(useAIStore.getState().isLoading).toBe(false);
  });

  it('does not add an insight on API failure (only simulates delay)', async () => {
    useAIStore.setState({
      insights: [{
        id: 'existing', stockId: 'EXIST', symbol: 'EXIST', name: 'Existing',
        type: 'neutral', confidence: 50, summary: 'Existing', analysis: 'Existing',
        targets: [], timestamp: '2025-01-01',
      }],
    });

    await useAIStore.getState().generateInsight('RELIANCE');
    const state = useAIStore.getState();
    // On failure, generateInsight simulates a 2s delay then clears isLoading
    // But does not prepend any insight — keeps existing
    expect(state.insights).toHaveLength(1);
  });
});
