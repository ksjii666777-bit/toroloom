/**
 * ============================================================================
 * Toroloom — Onboarding Store Tests
 * ============================================================================
 *
 * Tests the onboarding store: complete, skip, setCurrentStep, load, reset,
 * referral source, and the ONBOARDING_STEPS constant.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOnboardingStore, ONBOARDING_STEPS } from '../store/onboardingStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== Constants ====================

const STORAGE_KEY = 'toroloom_onboarding';

// ==================== Initial State ====================

describe('OnboardingStore — Initial State', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      hasCompletedOnboarding: false,
      currentStep: 0,
      isFirstLaunch: true,
      initialized: false,
      referralSource: null,
    });
  });

  it('starts with onboarding not completed', () => {
    const state = useOnboardingStore.getState();
    expect(state.hasCompletedOnboarding).toBe(false);
  });

  it('starts at step 0', () => {
    expect(useOnboardingStore.getState().currentStep).toBe(0);
  });

  it('starts with isFirstLaunch true', () => {
    expect(useOnboardingStore.getState().isFirstLaunch).toBe(true);
  });

  it('starts with initialized false', () => {
    expect(useOnboardingStore.getState().initialized).toBe(false);
  });

  it('starts with referralSource null', () => {
    expect(useOnboardingStore.getState().referralSource).toBeNull();
  });
});

// ==================== ONBOARDING_STEPS Constant ====================

describe('OnboardingStore — ONBOARDING_STEPS', () => {
  it('has exactly 6 steps', () => {
    expect(ONBOARDING_STEPS).toHaveLength(6);
  });

  it('each step has required fields', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.id).toBeDefined();
      expect(step.title).toBeDefined();
      expect(step.subtitle).toBeDefined();
      expect(step.description).toBeDefined();
      expect(step.icon).toBeDefined();
      expect(step.gradient).toBeDefined();
      expect(step.gradient).toHaveLength(2);
      expect(step.highlight).toBeDefined();
    }
  });

  it('all step ids are unique', () => {
    const ids = ONBOARDING_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('first step is welcome', () => {
    expect(ONBOARDING_STEPS[0].id).toBe('welcome');
    expect(ONBOARDING_STEPS[0].title).toBe('Welcome to Toroloom');
  });
});

// ==================== setCurrentStep ====================

describe('OnboardingStore — setCurrentStep', () => {
  beforeEach(() => {
    useOnboardingStore.setState({ currentStep: 0 });
  });

  it('sets the current step', () => {
    useOnboardingStore.getState().setCurrentStep(2);
    expect(useOnboardingStore.getState().currentStep).toBe(2);
  });

  it('clamps to 0 when negative', () => {
    useOnboardingStore.getState().setCurrentStep(-1);
    expect(useOnboardingStore.getState().currentStep).toBe(0);
  });

  it('clamps to max step index', () => {
    const maxIndex = ONBOARDING_STEPS.length - 1;
    useOnboardingStore.getState().setCurrentStep(99);
    expect(useOnboardingStore.getState().currentStep).toBe(maxIndex);
  });

  it('can step to the last valid index', () => {
    const maxIndex = ONBOARDING_STEPS.length - 1;
    useOnboardingStore.getState().setCurrentStep(maxIndex);
    expect(useOnboardingStore.getState().currentStep).toBe(maxIndex);
  });
});

// ==================== setReferralSource ====================

describe('OnboardingStore — setReferralSource', () => {
  beforeEach(() => {
    useOnboardingStore.setState({ referralSource: null, currentStep: 0 });
  });

  it('sets the referral source', () => {
    useOnboardingStore.getState().setReferralSource('referral-link');
    expect(useOnboardingStore.getState().referralSource).toBe('referral-link');
  });

  it('skips to step 1 when referral is set', () => {
    useOnboardingStore.getState().setReferralSource('google-play');
    expect(useOnboardingStore.getState().currentStep).toBe(1);
  });

  it('can set multiple different sources', () => {
    useOnboardingStore.getState().setReferralSource('facebook-ads');
    expect(useOnboardingStore.getState().referralSource).toBe('facebook-ads');

    useOnboardingStore.getState().setReferralSource('organic');
    expect(useOnboardingStore.getState().referralSource).toBe('organic');
  });
});

// ==================== loadOnboardingState ====================

describe('OnboardingStore — loadOnboardingState', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      hasCompletedOnboarding: false,
      isFirstLaunch: true,
      initialized: false,
    });
  });

  it('sets isFirstLaunch true when no stored data exists', async () => {
    await useOnboardingStore.getState().loadOnboardingState();
    const state = useOnboardingStore.getState();
    expect(state.isFirstLaunch).toBe(true);
    expect(state.hasCompletedOnboarding).toBe(false);
    expect(state.initialized).toBe(true);
  });

  it('restores completed state from storage', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ completed: true, completedAt: '2025-06-01T00:00:00.000Z' })
    );

    await useOnboardingStore.getState().loadOnboardingState();
    const state = useOnboardingStore.getState();
    expect(state.hasCompletedOnboarding).toBe(true);
    expect(state.isFirstLaunch).toBe(false);
    expect(state.initialized).toBe(true);
  });

  it('restores skipped state from storage', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ completed: true, skipped: true, completedAt: '2025-06-01T00:00:00.000Z' })
    );

    await useOnboardingStore.getState().loadOnboardingState();
    const state = useOnboardingStore.getState();
    expect(state.hasCompletedOnboarding).toBe(true);
    expect(state.isFirstLaunch).toBe(false);
    expect(state.initialized).toBe(true);
  });

  it('handles corrupted stored data gracefully', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'not-valid-json');
    await useOnboardingStore.getState().loadOnboardingState();
    const state = useOnboardingStore.getState();
    expect(state.isFirstLaunch).toBe(true);
    expect(state.hasCompletedOnboarding).toBe(false);
    expect(state.initialized).toBe(true);
  });

  it('handles AsyncStorage failure gracefully', async () => {
    vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage error'));

    await useOnboardingStore.getState().loadOnboardingState();
    const state = useOnboardingStore.getState();
    expect(state.isFirstLaunch).toBe(true);
    expect(state.hasCompletedOnboarding).toBe(false);
    expect(state.initialized).toBe(true);
  });
});

// ==================== completeOnboarding ====================

describe('OnboardingStore — completeOnboarding', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      hasCompletedOnboarding: false,
      isFirstLaunch: true,
    });
  });

  it('sets hasCompletedOnboarding to true', async () => {
    await useOnboardingStore.getState().completeOnboarding();
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
  });

  it('sets isFirstLaunch to false', async () => {
    await useOnboardingStore.getState().completeOnboarding();
    expect(useOnboardingStore.getState().isFirstLaunch).toBe(false);
  });

  it('persists to AsyncStorage with completed flag', async () => {
    await useOnboardingStore.getState().completeOnboarding();

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed.completed).toBe(true);
    expect(parsed.completedAt).toBeDefined();
  });

  it('still updates state when storage save fails', async () => {
    vi.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Storage error'));

    await useOnboardingStore.getState().completeOnboarding();
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
    expect(useOnboardingStore.getState().isFirstLaunch).toBe(false);
  });
});

// ==================== skipOnboarding ====================

describe('OnboardingStore — skipOnboarding', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      hasCompletedOnboarding: false,
      isFirstLaunch: true,
    });
  });

  it('sets hasCompletedOnboarding to true', async () => {
    await useOnboardingStore.getState().skipOnboarding();
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
  });

  it('sets isFirstLaunch to false', async () => {
    await useOnboardingStore.getState().skipOnboarding();
    expect(useOnboardingStore.getState().isFirstLaunch).toBe(false);
  });

  it('persists to AsyncStorage with skipped flag', async () => {
    await useOnboardingStore.getState().skipOnboarding();

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed.completed).toBe(true);
    expect(parsed.skipped).toBe(true);
    expect(parsed.completedAt).toBeDefined();
  });

  it('still updates state when storage save fails', async () => {
    vi.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Storage error'));

    await useOnboardingStore.getState().skipOnboarding();
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
    expect(useOnboardingStore.getState().isFirstLaunch).toBe(false);
  });
});

// ==================== resetOnboarding ====================

describe('OnboardingStore — resetOnboarding', () => {
  beforeEach(() => {
    // Start from a completed state
    useOnboardingStore.setState({
      hasCompletedOnboarding: true,
      currentStep: 3,
      isFirstLaunch: false,
      initialized: true,
    });
  });

  it('sets hasCompletedOnboarding to false', async () => {
    await useOnboardingStore.getState().resetOnboarding();
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
  });

  it('resets currentStep to 0', async () => {
    await useOnboardingStore.getState().resetOnboarding();
    expect(useOnboardingStore.getState().currentStep).toBe(0);
  });

  it('keeps initialized as true', async () => {
    await useOnboardingStore.getState().resetOnboarding();
    expect(useOnboardingStore.getState().initialized).toBe(true);
  });

  it('removes onboarding data from AsyncStorage', async () => {
    // First persist some data
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: true }));
    expect(await AsyncStorage.getItem(STORAGE_KEY)).not.toBeNull();

    await useOnboardingStore.getState().resetOnboarding();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('still updates state when storage removal fails', async () => {
    vi.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('Storage error'));

    await useOnboardingStore.getState().resetOnboarding();
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
    expect(useOnboardingStore.getState().currentStep).toBe(0);
  });
});
