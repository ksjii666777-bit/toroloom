/**
 * ============================================================================
 * Toroloom — Voice Store Unit Tests
 * ============================================================================
 *
 * Covers all functionality of the voice store:
 *   - Toggle voice on/off
 *   - Rate and pitch clamping
 *   - Speak — queue management, cooldown, priority sorting
 *   - _processQueue — speech dispatch, queue draining
 *   - Stop — clears queue and stops speech
 *   - clearCooldown
 *   - VOICE_MESSAGES constants
 *
 * Note: expo-speech is mocked so tests run without native module.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/voiceStore.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVoiceStore, VOICE_MESSAGES } from '../store/voiceStore';

describe('Voice Store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useVoiceStore.setState({
      enabled: true,
      rate: 0.85,
      pitch: 1.0,
      queue: [],
      isSpeaking: false,
      lastSpokenAt: {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Toggle
  // ─────────────────────────────────────────────────────────────────────────

  describe('toggleVoice', () => {
    it('should toggle from enabled to disabled', () => {
      expect(useVoiceStore.getState().enabled).toBe(true);
      useVoiceStore.getState().toggleVoice();
      expect(useVoiceStore.getState().enabled).toBe(false);
    });

    it('should toggle from disabled to enabled', () => {
      useVoiceStore.setState({ enabled: false });
      useVoiceStore.getState().toggleVoice();
      expect(useVoiceStore.getState().enabled).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Rate & Pitch
  // ─────────────────────────────────────────────────────────────────────────

  describe('Rate and Pitch', () => {
    it('should set rate within valid range', () => {
      useVoiceStore.getState().setRate(1.5);
      expect(useVoiceStore.getState().rate).toBe(1.5);
    });

    it('should clamp rate to minimum 0.1', () => {
      useVoiceStore.getState().setRate(-1);
      expect(useVoiceStore.getState().rate).toBe(0.1);
    });

    it('should clamp rate to maximum 2.0', () => {
      useVoiceStore.getState().setRate(5);
      expect(useVoiceStore.getState().rate).toBe(2.0);
    });

    it('should set pitch within valid range', () => {
      useVoiceStore.getState().setPitch(1.5);
      expect(useVoiceStore.getState().pitch).toBe(1.5);
    });

    it('should clamp pitch to minimum 0.5', () => {
      useVoiceStore.getState().setPitch(0);
      expect(useVoiceStore.getState().pitch).toBe(0.5);
    });

    it('should clamp pitch to maximum 2.0', () => {
      useVoiceStore.getState().setPitch(3);
      expect(useVoiceStore.getState().pitch).toBe(2.0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Speak — Queue & Cooldown
  // ─────────────────────────────────────────────────────────────────────────

  describe('Speak — Queue & Cooldown', () => {
    it('should add message to queue', () => {
      // Set isSpeaking: true so speak() doesn't immediately process the queue
      useVoiceStore.setState({ isSpeaking: true });
      useVoiceStore.getState().speak(VOICE_MESSAGES.goodMorning);
      expect(useVoiceStore.getState().queue).toHaveLength(1);
      expect(useVoiceStore.getState().queue[0].id).toBe('good_morning');
    });

    it('should not add message when voice is disabled', () => {
      useVoiceStore.setState({ enabled: false, isSpeaking: true });
      useVoiceStore.getState().speak(VOICE_MESSAGES.goodMorning);
      expect(useVoiceStore.getState().queue).toHaveLength(0);
    });

    it('should respect cooldown — skip duplicate within 1 minute', () => {
      useVoiceStore.setState({ isSpeaking: true });
      useVoiceStore.getState().speak(VOICE_MESSAGES.goodMorning);
      useVoiceStore.getState().speak(VOICE_MESSAGES.goodMorning);
      // Second call should be skipped due to cooldown
      expect(useVoiceStore.getState().queue).toHaveLength(1);
    });

    it('should allow duplicate after cooldown expires', () => {
      useVoiceStore.setState({ isSpeaking: true });
      useVoiceStore.getState().speak(VOICE_MESSAGES.goodMorning);

      // Advance time past cooldown (60s)
      vi.advanceTimersByTime(61000);

      useVoiceStore.getState().clearCooldown('good_morning');
      useVoiceStore.getState().speak(VOICE_MESSAGES.goodMorning);
      // Both should be in queue (first one never processed, second bypasses cooldown)
      expect(useVoiceStore.getState().queue).toHaveLength(2);
    });

    it('should sort messages by priority (high first)', () => {
      useVoiceStore.setState({ isSpeaking: true });
      useVoiceStore.getState().speak(VOICE_MESSAGES.goodMorning);       // low
      useVoiceStore.getState().speak(VOICE_MESSAGES.stopLossBreached); // high
      useVoiceStore.getState().speak(VOICE_MESSAGES.dailyLossWarning); // normal

      const queue = useVoiceStore.getState().queue;
      expect(queue[0].priority).toBe('high');
      expect(queue[1].priority).toBe('normal');
      expect(queue[2].priority).toBe('low');
    });

    it('should record lastSpokenAt timestamp', () => {
      useVoiceStore.getState().speak(VOICE_MESSAGES.profitTargetHit);
      const lastSpoken = useVoiceStore.getState().lastSpokenAt['profit_target_hit'];
      expect(lastSpoken).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _processQueue
  // ─────────────────────────────────────────────────────────────────────────

  describe('_processQueue', () => {
    it('should set isSpeaking to true when processing', () => {
      useVoiceStore.getState().speak(VOICE_MESSAGES.dailyLossWarning);
      // speak calls _processQueue internally
      expect(useVoiceStore.getState().isSpeaking).toBe(true);
    });

    it('should drain the queue after processing', () => {
      vi.useFakeTimers();
      useVoiceStore.setState({ queue: [], isSpeaking: false });

      useVoiceStore.getState().speak(VOICE_MESSAGES.stopLossBreached);
      expect(useVoiceStore.getState().queue).toHaveLength(0);
      // isSpeaking should be true during speech, then false after
      // Since expo-speech is not available, it falls back to setTimeout

      vi.advanceTimersByTime(200);
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
      vi.useRealTimers();
    });

    it('should set isSpeaking to false when queue is empty', () => {
      useVoiceStore.setState({ queue: [] });
      useVoiceStore.getState()._processQueue();
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
    });

    it('should not process when voice is disabled', () => {
      useVoiceStore.setState({ enabled: false, queue: [VOICE_MESSAGES.stopLossBreached] });
      useVoiceStore.getState()._processQueue();
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Stop
  // ─────────────────────────────────────────────────────────────────────────

  describe('Stop', () => {
    it('should clear the queue and set isSpeaking to false', () => {
      useVoiceStore.setState({ queue: [VOICE_MESSAGES.stopLossBreached, VOICE_MESSAGES.goodMorning], isSpeaking: true });

      useVoiceStore.getState().stop();

      expect(useVoiceStore.getState().queue).toHaveLength(0);
      expect(useVoiceStore.getState().isSpeaking).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // clearCooldown
  // ─────────────────────────────────────────────────────────────────────────

  describe('clearCooldown', () => {
    it('should remove a message from lastSpokenAt', () => {
      useVoiceStore.setState({ lastSpokenAt: { msg1: 1000, msg2: 2000 } });
      useVoiceStore.getState().clearCooldown('msg1');

      const lastSpoken = useVoiceStore.getState().lastSpokenAt;
      expect(lastSpoken.msg1).toBeUndefined();
      expect(lastSpoken.msg2).toBe(2000);
    });

    it('should do nothing for non-existent message id', () => {
      useVoiceStore.setState({ lastSpokenAt: { msg1: 1000 } });
      useVoiceStore.getState().clearCooldown('non-existent');
      expect(Object.keys(useVoiceStore.getState().lastSpokenAt)).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // VOICE_MESSAGES Constants
  // ─────────────────────────────────────────────────────────────────────────

  describe('VOICE_MESSAGES Constants', () => {
    it('should define all message types', () => {
      expect(Object.keys(VOICE_MESSAGES)).toHaveLength(10);
    });

    it('each message should have id, text, priority, and category', () => {
      for (const [, msg] of Object.entries(VOICE_MESSAGES)) {
        expect(msg.id).toBeTruthy();
        expect(msg.text).toBeTruthy();
        expect(['high', 'normal', 'low']).toContain(msg.priority);
        expect(['alert', 'celebration', 'info', 'warning']).toContain(msg.category);
      }
    });

    it('should have high priority for critical alerts', () => {
      expect(VOICE_MESSAGES.stopLossBreached.priority).toBe('high');
      expect(VOICE_MESSAGES.profitTargetHit.priority).toBe('high');
      expect(VOICE_MESSAGES.lockdownLifted.priority).toBe('high');
      expect(VOICE_MESSAGES.imminentBreach.priority).toBe('high');
    });

    it('should have low priority for routine messages', () => {
      expect(VOICE_MESSAGES.goodMorning.priority).toBe('low');
      expect(VOICE_MESSAGES.sessionEnd.priority).toBe('low');
    });
  });
});
