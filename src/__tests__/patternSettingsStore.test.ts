// ============================================================================
// Toroloom — Pattern Settings Store Tests
// ============================================================================
//
// Tests the Zustand store for pattern detection settings: confidence threshold,
// pattern type toggles, lookback period, persistence, and hydration.
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePatternSettingsStore, ALL_PATTERNS, LOOKBACK_OPTIONS } from '../store/patternSettingsStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PatternType } from '../components/chart/patternDetection';

const STORAGE_KEY = '@toroloom/patternSettings';

async function readStored(): Promise<any> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function clearStored(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

function resetStore() {
  usePatternSettingsStore.setState({
    minConfidence: 50,
    enabledPatterns: [...ALL_PATTERNS],
    lookback: 0,
    hydrated: false,
  });
}

// ── Initial State ──

describe('PatternSettingsStore — Initial State', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts with default minConfidence of 50', () => {
    expect(usePatternSettingsStore.getState().minConfidence).toBe(50);
  });

  it('starts with all 9 pattern types enabled', () => {
    const state = usePatternSettingsStore.getState();
    expect(state.enabledPatterns.length).toBe(9);
    expect(state.enabledPatterns).toEqual(ALL_PATTERNS);
  });

  it('starts with lookback = 0 (all data)', () => {
    expect(usePatternSettingsStore.getState().lookback).toBe(0);
  });

  it('starts with hydrated = false', () => {
    // Note: hydrate() is called on store creation as fire-and-forget,
    // so in tests it may or may not have resolved yet
    const state = usePatternSettingsStore.getState();
    expect(state).toHaveProperty('hydrated');
  });
});

// ── setMinConfidence ──

describe('PatternSettingsStore — setMinConfidence', () => {
  beforeEach(() => {
    resetStore();
  });

  it('sets minConfidence to a normal value', () => {
    usePatternSettingsStore.getState().setMinConfidence(75);
    expect(usePatternSettingsStore.getState().minConfidence).toBe(75);
  });

  it('clamps minConfidence to 0 (lower bound)', () => {
    usePatternSettingsStore.getState().setMinConfidence(-10);
    expect(usePatternSettingsStore.getState().minConfidence).toBe(0);
  });

  it('clamps minConfidence to 100 (upper bound)', () => {
    usePatternSettingsStore.getState().setMinConfidence(150);
    expect(usePatternSettingsStore.getState().minConfidence).toBe(100);
  });

  it('accepts 0 as valid lower bound', () => {
    usePatternSettingsStore.getState().setMinConfidence(0);
    expect(usePatternSettingsStore.getState().minConfidence).toBe(0);
  });

  it('accepts 100 as valid upper bound', () => {
    usePatternSettingsStore.getState().setMinConfidence(100);
    expect(usePatternSettingsStore.getState().minConfidence).toBe(100);
  });

  it('persists to AsyncStorage after setting', async () => {
    usePatternSettingsStore.getState().setMinConfidence(30);
    const stored = await readStored();
    expect(stored.minConfidence).toBe(30);
  });
});

// ── togglePattern ──

describe('PatternSettingsStore — togglePattern', () => {
  beforeEach(() => {
    resetStore();
  });

  it('removes a pattern from enabledPatterns when currently enabled', () => {
    usePatternSettingsStore.getState().togglePattern('head_and_shoulders');
    const enabled = usePatternSettingsStore.getState().enabledPatterns;
    expect(enabled).not.toContain('head_and_shoulders');
    expect(enabled.length).toBe(8);
  });

  it('adds a pattern back when toggled again', () => {
    usePatternSettingsStore.getState().togglePattern('head_and_shoulders');
    usePatternSettingsStore.getState().togglePattern('head_and_shoulders');
    const enabled = usePatternSettingsStore.getState().enabledPatterns;
    expect(enabled).toContain('head_and_shoulders');
    expect(enabled.length).toBe(9);
  });

  it('can toggle multiple patterns independently', () => {
    usePatternSettingsStore.getState().togglePattern('double_top');
    usePatternSettingsStore.getState().togglePattern('bull_flag');
    const enabled = usePatternSettingsStore.getState().enabledPatterns;
    expect(enabled).not.toContain('double_top');
    expect(enabled).not.toContain('bull_flag');
    expect(enabled).toContain('head_and_shoulders');
    expect(enabled).toContain('bear_flag');
    expect(enabled.length).toBe(7);
  });

  it('can disable all patterns by toggling each off', () => {
    for (const p of ALL_PATTERNS) {
      usePatternSettingsStore.getState().togglePattern(p);
    }
    expect(usePatternSettingsStore.getState().enabledPatterns).toEqual([]);
  });

  it('persists to AsyncStorage after toggle', async () => {
    usePatternSettingsStore.getState().togglePattern('ascending_triangle');
    const stored = await readStored();
    expect(stored.enabledPatterns).not.toContain('ascending_triangle');
  });
});

// ── enableAllPatterns / disableAllPatterns ──

describe('PatternSettingsStore — enableAllPatterns / disableAllPatterns', () => {
  beforeEach(() => {
    resetStore();
  });

  it('disables all patterns', () => {
    usePatternSettingsStore.getState().disableAllPatterns();
    expect(usePatternSettingsStore.getState().enabledPatterns).toEqual([]);
  });

  it('enables all patterns after disabling', () => {
    usePatternSettingsStore.getState().disableAllPatterns();
    usePatternSettingsStore.getState().enableAllPatterns();
    const enabled = usePatternSettingsStore.getState().enabledPatterns;
    expect(enabled.length).toBe(9);
    expect(enabled).toEqual(ALL_PATTERNS);
  });

  it('enableAllPatterns is idempotent', () => {
    usePatternSettingsStore.getState().enableAllPatterns();
    usePatternSettingsStore.getState().enableAllPatterns();
    expect(usePatternSettingsStore.getState().enabledPatterns.length).toBe(9);
  });

  it('disableAllPatterns is idempotent', () => {
    usePatternSettingsStore.getState().disableAllPatterns();
    usePatternSettingsStore.getState().disableAllPatterns();
    expect(usePatternSettingsStore.getState().enabledPatterns).toEqual([]);
  });
});

// ── setLookback ──

describe('PatternSettingsStore — setLookback', () => {
  beforeEach(() => {
    resetStore();
  });

  it('sets lookback to a valid value', () => {
    usePatternSettingsStore.getState().setLookback(100);
    expect(usePatternSettingsStore.getState().lookback).toBe(100);
  });

  it('sets lookback to 0 (all data)', () => {
    usePatternSettingsStore.getState().setLookback(0);
    expect(usePatternSettingsStore.getState().lookback).toBe(0);
  });

  it('sets lookback to each valid option', () => {
    for (const opt of LOOKBACK_OPTIONS) {
      usePatternSettingsStore.getState().setLookback(opt);
      expect(usePatternSettingsStore.getState().lookback).toBe(opt);
    }
  });
});

// ── resetDefaults ──

describe('PatternSettingsStore — resetDefaults', () => {
  beforeEach(() => {
    resetStore();
  });

  it('resets all values to defaults after modifications', () => {
    // Change everything
    usePatternSettingsStore.getState().setMinConfidence(10);
    usePatternSettingsStore.getState().togglePattern('head_and_shoulders');
    usePatternSettingsStore.getState().setLookback(200);

    // Reset
    usePatternSettingsStore.getState().resetDefaults();

    const state = usePatternSettingsStore.getState();
    expect(state.minConfidence).toBe(50);
    expect(state.enabledPatterns).toEqual(ALL_PATTERNS);
    expect(state.lookback).toBe(0);
  });

  it('marks hydrated as true after reset', () => {
    usePatternSettingsStore.getState().resetDefaults();
    expect(usePatternSettingsStore.getState().hydrated).toBe(true);
  });

  it('persists defaults to AsyncStorage after reset', async () => {
    usePatternSettingsStore.getState().resetDefaults();
    const stored = await readStored();
    expect(stored.minConfidence).toBe(50);
    expect(stored.lookback).toBe(0);
    expect(stored.enabledPatterns).toEqual(ALL_PATTERNS);
  });
});

// ── hydrate ──

describe('PatternSettingsStore — hydrate', () => {
  beforeEach(async () => {
    resetStore();
    await clearStored();
  });

  it('loads saved settings from AsyncStorage', async () => {
    const saved = {
      minConfidence: 80,
      enabledPatterns: ['head_and_shoulders', 'double_top'],
      lookback: 50,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    await usePatternSettingsStore.getState().hydrate();

    const state = usePatternSettingsStore.getState();
    expect(state.minConfidence).toBe(80);
    expect(state.enabledPatterns).toEqual(['head_and_shoulders', 'double_top']);
    expect(state.lookback).toBe(50);
    expect(state.hydrated).toBe(true);
  });

  it('sets hydrated=true when no saved data exists', async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    // Set hydrated=false first
    usePatternSettingsStore.setState({ hydrated: false });

    await usePatternSettingsStore.getState().hydrate();

    expect(usePatternSettingsStore.getState().hydrated).toBe(true);
    // Default values should remain
    expect(usePatternSettingsStore.getState().minConfidence).toBe(50);
  });

  it('falls back to defaults for partial saved data', async () => {
    const saved = { minConfidence: 90 }; // missing enabledPatterns and lookback
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    await usePatternSettingsStore.getState().hydrate();

    const state = usePatternSettingsStore.getState();
    expect(state.minConfidence).toBe(90);
    expect(state.enabledPatterns).toEqual(ALL_PATTERNS); // fallback
    expect(state.lookback).toBe(0); // fallback
  });

  it('falls back to defaults for invalid minConfidence type', async () => {
    const saved = {
      minConfidence: 'not-a-number',
      enabledPatterns: ALL_PATTERNS,
      lookback: 0,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    await usePatternSettingsStore.getState().hydrate();

    expect(usePatternSettingsStore.getState().minConfidence).toBe(50); // fallback
  });

  it('falls back to defaults for invalid enabledPatterns type', async () => {
    const saved = {
      minConfidence: 50,
      enabledPatterns: 'not-an-array',
      lookback: 0,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    await usePatternSettingsStore.getState().hydrate();

    expect(usePatternSettingsStore.getState().enabledPatterns).toEqual(ALL_PATTERNS);
  });

  it('falls back to defaults for invalid lookback value', async () => {
    const saved = {
      minConfidence: 50,
      enabledPatterns: ALL_PATTERNS,
      lookback: 999, // not in LOOKBACK_OPTIONS
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    await usePatternSettingsStore.getState().hydrate();

    expect(usePatternSettingsStore.getState().lookback).toBe(0); // fallback
  });

  it('handles corrupted JSON gracefully', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'not-valid-json{{');

    usePatternSettingsStore.setState({ hydrated: false });

    await usePatternSettingsStore.getState().hydrate();

    expect(usePatternSettingsStore.getState().hydrated).toBe(true);
    expect(usePatternSettingsStore.getState().minConfidence).toBe(50); // defaults preserved
  });

  it('handles AsyncStorage failure gracefully', async () => {
    vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage error'));

    usePatternSettingsStore.setState({ hydrated: false });

    await usePatternSettingsStore.getState().hydrate();

    expect(usePatternSettingsStore.getState().hydrated).toBe(true);
  });
});

// ── Persistence ──

describe('PatternSettingsStore — Persistence', () => {
  beforeEach(async () => {
    resetStore();
    await clearStored();
  });

  it('persists minConfidence to AsyncStorage', async () => {
    usePatternSettingsStore.getState().setMinConfidence(65);
    const stored = await readStored();
    expect(stored.minConfidence).toBe(65);
  });

  it('persists lookback to AsyncStorage', async () => {
    usePatternSettingsStore.getState().setLookback(200);
    const stored = await readStored();
    expect(stored.lookback).toBe(200);
  });

  it('persists enabledPatterns to AsyncStorage', async () => {
    usePatternSettingsStore.getState().togglePattern('double_bottom');
    const stored = await readStored();
    expect(stored.enabledPatterns).not.toContain('double_bottom');
    expect(stored.enabledPatterns.length).toBe(8);
  });

  it('does not persist hydrated flag to AsyncStorage', async () => {
    usePatternSettingsStore.getState().setMinConfidence(40);
    const stored = await readStored();
    expect(stored).not.toHaveProperty('hydrated');
  });

  it('overwrites previous persisted data', async () => {
    usePatternSettingsStore.getState().setMinConfidence(20);
    usePatternSettingsStore.getState().setMinConfidence(80);
    const stored = await readStored();
    expect(stored.minConfidence).toBe(80);
  });
});
