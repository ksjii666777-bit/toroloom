/**
 * ============================================================================
 * Toroloom — KYC Store Tests
 * ============================================================================
 *
 * Tests the zustand KYC store with AsyncStorage persistence:
 *   - Initial state
 *   - loadKycState (no stored data, restores, corrupted data, errors)
 *   - markStepCompleted / markStepIncomplete
 *   - setPanNumber (PAN masking)
 *   - setAadhaarLastFour / setDigiLockerLinked
 *   - resetKyc
 *
 * Framework: vitest
 * Pattern: follows onboardingStore.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useKycStore } from '../store/kycStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'toroloom_kyc';

// ==================== Helpers ====================

function resetStore() {
  useKycStore.setState({
    initialized: false,
    completedSteps: { pan: false, aadhaar: false, digilocker: false, bank: false },
    panNumber: undefined,
    aadhaarLastFour: undefined,
    digiLockerLinked: false,
    lastUpdated: null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Initial State
// ═══════════════════════════════════════════════════════════════════════════

describe('kycStore — Initial State', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts with initialized false', () => {
    expect(useKycStore.getState().initialized).toBe(false);
  });

  it('all KYC steps start as incomplete', () => {
    const steps = useKycStore.getState().completedSteps;
    expect(steps.pan).toBe(false);
    expect(steps.aadhaar).toBe(false);
    expect(steps.digilocker).toBe(false);
    expect(steps.bank).toBe(false);
  });

  it('no optional fields are set', () => {
    const state = useKycStore.getState();
    expect(state.panNumber).toBeUndefined();
    expect(state.aadhaarLastFour).toBeUndefined();
    expect(state.digiLockerLinked).toBe(false);
    expect(state.lastUpdated).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// loadKycState
// ═══════════════════════════════════════════════════════════════════════════

describe('kycStore — loadKycState', () => {
  beforeEach(() => {
    resetStore();
  });

  it('sets initialized true when no stored data exists', async () => {
    await useKycStore.getState().loadKycState();
    const state = useKycStore.getState();
    expect(state.initialized).toBe(true);
    expect(state.completedSteps.pan).toBe(false);
  });

  it('restores completed steps from storage', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      completedSteps: { pan: true, aadhaar: true, digilocker: false, bank: false },
      panNumber: 'XXXXX1234F',
      aadhaarLastFour: '3456',
      digiLockerLinked: false,
      lastUpdated: '2025-06-30T10:00:00.000Z',
    }));

    await useKycStore.getState().loadKycState();
    const state = useKycStore.getState();

    expect(state.initialized).toBe(true);
    expect(state.completedSteps.pan).toBe(true);
    expect(state.completedSteps.aadhaar).toBe(true);
    expect(state.completedSteps.digilocker).toBe(false);
    expect(state.completedSteps.bank).toBe(false);
    expect(state.panNumber).toBe('XXXXX1234F');
    expect(state.aadhaarLastFour).toBe('3456');
    expect(state.lastUpdated).toBe('2025-06-30T10:00:00.000Z');
  });

  it('restores fully completed KYC state', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      completedSteps: { pan: true, aadhaar: true, digilocker: true, bank: true },
      panNumber: 'XXXXX1234F',
      aadhaarLastFour: '5678',
      digiLockerLinked: true,
      lastUpdated: '2025-07-01T00:00:00.000Z',
    }));

    await useKycStore.getState().loadKycState();
    const state = useKycStore.getState();

    expect(state.completedSteps.pan).toBe(true);
    expect(state.completedSteps.aadhaar).toBe(true);
    expect(state.completedSteps.digilocker).toBe(true);
    expect(state.completedSteps.bank).toBe(true);
    expect(state.digiLockerLinked).toBe(true);
  });

  it('handles corrupted stored data gracefully', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'not-valid-json');
    await useKycStore.getState().loadKycState();
    const state = useKycStore.getState();
    expect(state.initialized).toBe(true);
    expect(state.completedSteps.pan).toBe(false);
  });

  it('handles AsyncStorage failure gracefully', async () => {
    vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage error'));
    await useKycStore.getState().loadKycState();
    const state = useKycStore.getState();
    expect(state.initialized).toBe(true);
    expect(state.completedSteps.pan).toBe(false);
  });

  it('handles partially corrupted stored data (missing fields)', async () => {
    // Only stores panNumber, no completedSteps
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ panNumber: 'TEST123' }));
    await useKycStore.getState().loadKycState();
    const state = useKycStore.getState();
    expect(state.initialized).toBe(true);
    // Should have default false for all steps
    expect(state.completedSteps.pan).toBe(false);
    expect(state.panNumber).toBe('TEST123');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// markStepCompleted
// ═══════════════════════════════════════════════════════════════════════════

describe('kycStore — markStepCompleted', () => {
  beforeEach(() => {
    resetStore();
  });

  it('marks a single step as completed', async () => {
    await useKycStore.getState().markStepCompleted('pan');
    const state = useKycStore.getState();
    expect(state.completedSteps.pan).toBe(true);
    expect(state.completedSteps.aadhaar).toBe(false);
  });

  it('updates lastUpdated timestamp', async () => {
    await useKycStore.getState().markStepCompleted('pan');
    expect(useKycStore.getState().lastUpdated).not.toBeNull();
  });

  it('persists to AsyncStorage', async () => {
    await useKycStore.getState().markStepCompleted('pan');

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed.completedSteps.pan).toBe(true);
    expect(parsed.completedSteps.aadhaar).toBe(false);
  });

  it('marks multiple steps sequentially', async () => {
    await useKycStore.getState().markStepCompleted('pan');
    await useKycStore.getState().markStepCompleted('aadhaar');
    await useKycStore.getState().markStepCompleted('digilocker');

    const state = useKycStore.getState();
    expect(state.completedSteps.pan).toBe(true);
    expect(state.completedSteps.aadhaar).toBe(true);
    expect(state.completedSteps.digilocker).toBe(true);
    expect(state.completedSteps.bank).toBe(false);
  });

  it('still updates state when storage save fails', async () => {
    vi.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Storage error'));

    await useKycStore.getState().markStepCompleted('aadhaar');
    expect(useKycStore.getState().completedSteps.aadhaar).toBe(true);
  });

  it('marks all 4 steps as completed', async () => {
    await useKycStore.getState().markStepCompleted('pan');
    await useKycStore.getState().markStepCompleted('aadhaar');
    await useKycStore.getState().markStepCompleted('digilocker');
    await useKycStore.getState().markStepCompleted('bank');

    const steps = useKycStore.getState().completedSteps;
    expect(steps.pan).toBe(true);
    expect(steps.aadhaar).toBe(true);
    expect(steps.digilocker).toBe(true);
    expect(steps.bank).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// markStepIncomplete
// ═══════════════════════════════════════════════════════════════════════════

describe('kycStore — markStepIncomplete', () => {
  beforeEach(async () => {
    resetStore();
    // Start with pan completed
    await useKycStore.getState().markStepCompleted('pan');
  });

  it('marks a completed step as incomplete', async () => {
    await useKycStore.getState().markStepIncomplete('pan');
    expect(useKycStore.getState().completedSteps.pan).toBe(false);
  });

  it('persists the change to AsyncStorage', async () => {
    await useKycStore.getState().markStepIncomplete('pan');

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed.completedSteps.pan).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// setPanNumber (PAN Masking)
// ═══════════════════════════════════════════════════════════════════════════

describe('kycStore — setPanNumber (masking)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('stores masked PAN (last 5 visible)', async () => {
    await useKycStore.getState().setPanNumber('ABCDE1234F');
    expect(useKycStore.getState().panNumber).toBe('XXXXX1234F');
  });

  it('persists masked PAN to AsyncStorage', async () => {
    await useKycStore.getState().setPanNumber('PQRST5678G');

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed.panNumber).toBe('XXXXX5678G');
  });

  it('stores short strings without masking', async () => {
    await useKycStore.getState().setPanNumber('AB');
    expect(useKycStore.getState().panNumber).toBe('AB');
  });

  it('handles empty string', async () => {
    await useKycStore.getState().setPanNumber('');
    expect(useKycStore.getState().panNumber).toBe('');
  });

  it('updates lastUpdated when setting PAN', async () => {
    await useKycStore.getState().setPanNumber('ABCDE1234F');
    expect(useKycStore.getState().lastUpdated).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// setAadhaarLastFour & setDigiLockerLinked
// ═══════════════════════════════════════════════════════════════════════════

describe('kycStore — setAadhaarLastFour', () => {
  beforeEach(() => {
    resetStore();
  });

  it('stores Aadhaar last four digits', async () => {
    await useKycStore.getState().setAadhaarLastFour('3456');
    expect(useKycStore.getState().aadhaarLastFour).toBe('3456');
  });

  it('persists to AsyncStorage', async () => {
    await useKycStore.getState().setAadhaarLastFour('7890');

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed.aadhaarLastFour).toBe('7890');
  });

  it('updates lastUpdated', async () => {
    await useKycStore.getState().setAadhaarLastFour('1234');
    expect(useKycStore.getState().lastUpdated).not.toBeNull();
  });
});

describe('kycStore — setDigiLockerLinked', () => {
  beforeEach(() => {
    resetStore();
  });

  it('sets DigiLocker linked to true', async () => {
    await useKycStore.getState().setDigiLockerLinked(true);
    expect(useKycStore.getState().digiLockerLinked).toBe(true);
  });

  it('sets DigiLocker linked to false', async () => {
    // First set to true
    await useKycStore.getState().setDigiLockerLinked(true);
    // Then set back to false
    await useKycStore.getState().setDigiLockerLinked(false);
    expect(useKycStore.getState().digiLockerLinked).toBe(false);
  });

  it('persists to AsyncStorage', async () => {
    await useKycStore.getState().setDigiLockerLinked(true);

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed.digiLockerLinked).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// resetKyc
// ═══════════════════════════════════════════════════════════════════════════

describe('kycStore — resetKyc', () => {
  beforeEach(async () => {
    resetStore();
    // Set up with some data
    await useKycStore.getState().markStepCompleted('pan');
    await useKycStore.getState().markStepCompleted('aadhaar');
    await useKycStore.getState().setPanNumber('ABCDE1234F');
    await useKycStore.getState().setAadhaarLastFour('3456');
    await useKycStore.getState().setDigiLockerLinked(true);
  });

  it('resets all completed steps to false', async () => {
    await useKycStore.getState().resetKyc();
    const steps = useKycStore.getState().completedSteps;
    expect(steps.pan).toBe(false);
    expect(steps.aadhaar).toBe(false);
    expect(steps.digilocker).toBe(false);
    expect(steps.bank).toBe(false);
  });

  it('clears optional fields', async () => {
    await useKycStore.getState().resetKyc();
    const state = useKycStore.getState();
    expect(state.panNumber).toBeUndefined();
    expect(state.aadhaarLastFour).toBeUndefined();
    expect(state.digiLockerLinked).toBe(false);
    expect(state.lastUpdated).toBeNull();
  });

  it('removes data from AsyncStorage', async () => {
    // Verify data exists before reset
    expect(await AsyncStorage.getItem(STORAGE_KEY)).not.toBeNull();

    await useKycStore.getState().resetKyc();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('still updates state when storage removal fails', async () => {
    vi.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('Storage error'));

    await useKycStore.getState().resetKyc();
    expect(useKycStore.getState().completedSteps.pan).toBe(false);
  });

  it('can start fresh after reset', async () => {
    await useKycStore.getState().resetKyc();
    await useKycStore.getState().markStepCompleted('digilocker');
    expect(useKycStore.getState().completedSteps.digilocker).toBe(true);
    expect(useKycStore.getState().completedSteps.pan).toBe(false);
  });
});
