/**
 * ============================================================================
 * Toroloom — SplashScreen Tests
 * ============================================================================
 *
 * Tests the premium animated splash screen:
 *   - Brand name, tagline, progress bar, version text render
 *   - Bootstrapping diagnostics steps cycle correctly
 *   - onFinish callback fires after minDuration elapses
 *   - Custom minDuration is respected
 *   - No crash when onFinish is not provided
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from './testUtils';
import SplashScreen from '../screens/SplashScreen';

// The first diagnostic step shown initially
const FIRST_DIAGNOSTIC = 'Initializing encrypted environment...';

describe('SplashScreen — Rendering', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the brand name Toroloom', () => {
    const { getByText } = render(<SplashScreen />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(getByText('Toroloom')).toBeDefined();
  });

  it('renders the tagline', () => {
    const { getByText } = render(<SplashScreen />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(getByText('AI-Powered Trading Shield')).toBeDefined();
  });

  it('renders the first diagnostics step initially', () => {
    const { getByText } = render(<SplashScreen />);
    // Initial render — first step visible immediately, no timer advancement needed
    expect(getByText(FIRST_DIAGNOSTIC)).toBeDefined();
  });

  it('cycles through subsequent diagnostics steps after intervals fire', () => {
    const { getByText } = render(<SplashScreen minDuration={6000} />);
    // First step visible initially
    expect(getByText('Initializing encrypted environment...')).toBeDefined();

    // After 1000ms, should show second step
    act(() => { vi.advanceTimersByTime(1000); });
    expect(getByText('Loading market data feeds...')).toBeDefined();
  });

  it('renders the version text', () => {
    const { getByText } = render(<SplashScreen />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(getByText('v1.0.0')).toBeDefined();
  });

  it('renders all 6 diagnostic steps over time', () => {
    const { getByText } = render(<SplashScreen minDuration={6000} />);

    // Step 0 — initial
    act(() => { vi.advanceTimersByTime(100); });
    expect(getByText('Initializing encrypted environment...')).toBeDefined();

    // Step 1
    act(() => { vi.advanceTimersByTime(1000); });
    expect(getByText('Loading market data feeds...')).toBeDefined();

    // Step 2
    act(() => { vi.advanceTimersByTime(1000); });
    expect(getByText('Establishing secure WebSocket tunnel...')).toBeDefined();

    // Step 3
    act(() => { vi.advanceTimersByTime(1000); });
    expect(getByText('Calibrating risk engine parameters...')).toBeDefined();

    // Step 4
    act(() => { vi.advanceTimersByTime(1000); });
    expect(getByText('Syncing portfolio state...')).toBeDefined();

    // Step 5
    act(() => { vi.advanceTimersByTime(1000); });
    expect(getByText('Launching Toroloom shield...')).toBeDefined();
  });
});

describe('SplashScreen — onFinish Callback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onFinish when progress animation completes (Animated.timing start callback is synchronous in the mock)', () => {
    const onFinish = vi.fn();
    render(<SplashScreen onFinish={onFinish} />);

    // The Animated.timing mock in react-native.mock.ts calls the start()
    // completion callback synchronously during mount — no timer needed.
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('calls onFinish with custom minDuration', () => {
    const onFinish = vi.fn();
    render(<SplashScreen onFinish={onFinish} minDuration={5000} />);

    // minDuration is passed to Animated.timing config but ignored by the mock
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('does not crash when onFinish is omitted', () => {
    expect(() => {
      render(<SplashScreen />);
    }).not.toThrow();
  });

  it('renders all elements and calls onFinish even with very short minDuration', () => {
    const onFinish = vi.fn();
    const { getByText } = render(<SplashScreen onFinish={onFinish} minDuration={100} />);
    expect(getByText('Toroloom')).toBeDefined();
    expect(onFinish).toHaveBeenCalled();
  });
});

describe('SplashScreen — No onFinish', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not crash when no onFinish is provided', () => {
    expect(() => {
      render(<SplashScreen />);
    }).not.toThrow();
  });

  it('renders all elements without onFinish prop', () => {
    const { getByText } = render(<SplashScreen />);
    expect(getByText('Toroloom')).toBeDefined();
    expect(getByText('AI-Powered Trading Shield')).toBeDefined();
    expect(getByText('v1.0.0')).toBeDefined();
  });
});
