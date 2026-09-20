/**
 * ============================================================================
 * Toroloom — Prop Account Store Tests
 * ============================================================================
 *
 * Lifecycle through the REAL store with the global AsyncStorage mock:
 *   - startChallenge freezes config + startDate + phase 1, persists
 *   - advancePhase moves through phases, caps at the last one
 *   - markFailed / abandonChallenge record outcome + endedPhase
 *   - loadAccount restores a persisted challenge (round-trip)
 *   - clearAccount wipes memory + storage (GDPR)
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePropAccountStore } from '../store/propAccountStore';
import { makeCustomConfig } from '../services/propFirm/challengePresets';

const KEY = 'toroloom_prop_account';

const config = () => makeCustomConfig({
  accountSize: 1000000,
  phases: [
    { number: 1, profitTargetPercent: 10 },
    { number: 2, profitTargetPercent: 5 },
    { number: 3, profitTargetPercent: null },
  ],
});

describe('Prop Account Store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePropAccountStore.setState({ challenge: null, initialized: false });
  });

  it('starts with no challenge', () => {
    expect(usePropAccountStore.getState().challenge).toBeNull();
    expect(usePropAccountStore.getState().initialized).toBe(false);
  });

  it('startChallenge freezes the config at phase 1 and persists', async () => {
    const cfg = config();
    await usePropAccountStore.getState().startChallenge(cfg);

    const challenge = usePropAccountStore.getState().challenge;
    expect(challenge).not.toBeNull();
    expect(challenge!.phase).toBe(1);
    expect(challenge!.outcome).toBe('active');
    expect(challenge!.config.accountSize).toBe(1000000);
    expect(challenge!.startDate).toBeTruthy();

    const stored = JSON.parse((await AsyncStorage.getItem(KEY))!);
    expect(stored.phase).toBe(1);
    expect(stored.config.maxDailyLossPercent).toBe(5);
  });

  it('advancePhase walks the phases and caps at the last one', async () => {
    await usePropAccountStore.getState().startChallenge(config());
    await usePropAccountStore.getState().advancePhase();
    expect(usePropAccountStore.getState().challenge!.phase).toBe(2);

    await usePropAccountStore.getState().advancePhase();
    expect(usePropAccountStore.getState().challenge!.phase).toBe(3);

    // Last phase is "funded" — advancing again must not run past the array
    await usePropAccountStore.getState().advancePhase();
    expect(usePropAccountStore.getState().challenge!.phase).toBe(3);
  });

  it('markFailed records the outcome and the phase it happened in', async () => {
    await usePropAccountStore.getState().startChallenge(config());
    await usePropAccountStore.getState().advancePhase();
    await usePropAccountStore.getState().markFailed();

    const challenge = usePropAccountStore.getState().challenge!;
    expect(challenge.outcome).toBe('failed');
    expect(challenge.endedPhase).toBe(2);
  });

  it('abandonChallenge leaves the config intact for review', async () => {
    await usePropAccountStore.getState().startChallenge(config());
    await usePropAccountStore.getState().abandonChallenge();

    const challenge = usePropAccountStore.getState().challenge!;
    expect(challenge.outcome).toBe('abandoned');
    expect(challenge.config.accountSize).toBe(1000000);
  });

  it('loadAccount restores a persisted challenge (round-trip)', async () => {
    await usePropAccountStore.getState().startChallenge(config());
    await usePropAccountStore.getState().advancePhase();

    // Simulate a fresh app launch
    usePropAccountStore.setState({ challenge: null, initialized: false });
    await usePropAccountStore.getState().loadAccount();

    const challenge = usePropAccountStore.getState().challenge;
    expect(challenge).not.toBeNull();
    expect(challenge!.phase).toBe(2);
    expect(challenge!.config.provider).toBe('custom');
    expect(usePropAccountStore.getState().initialized).toBe(true);
  });

  it('loadAccount tolerates corrupt storage', async () => {
    await AsyncStorage.setItem(KEY, '{not json');
    await usePropAccountStore.getState().loadAccount();
    expect(usePropAccountStore.getState().challenge).toBeNull();
    expect(usePropAccountStore.getState().initialized).toBe(true);
  });

  it('clearAccount wipes both memory and storage (GDPR erasure)', async () => {
    await usePropAccountStore.getState().startChallenge(config());
    await usePropAccountStore.getState().clearAccount();

    expect(usePropAccountStore.getState().challenge).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});
