/**
 * ============================================================================
 * Toroloom — WebSocket Registry Tests
 * ============================================================================
 *
 * Tests the wsRegistry module: default mode, mode switching, singleton
 * resolution for mock and real services.
 *
 * NOTE: The setup.ts globally mocks wsRegistry.  We unmock it here to test
 * the real implementation.
 *
 * NOTE: The RealWebSocketService constructor only initialises private fields
 * (Maps, Sets, booleans) — it does NOT call WebSocket, so the real class can
 * be instantiated without any global mocks.  Only connect() needs WebSocket,
 * which is never called in these registry-level tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Unmock wsRegistry so we get the real implementation
vi.unmock('../services/wsRegistry');

// Do NOT mock RealWebSocketService — the constructor is side-effect free.
// WebSocket is only needed when connect() is called, which never happens
// in these registry-level tests.

// Import AFTER unmocking
import { getActiveWS, setWSMode, getWSMode } from '../services/wsRegistry';
import { mockWebSocket } from '../services/mockWebSocketService';

describe('WSRegistry', () => {
  beforeEach(() => {
    // Reset mode to mock before each test
    setWSMode('mock');
  });

  // ── Default Mode ────────────────────────────────────────────────────

  it('defaults to mock mode', () => {
    expect(getWSMode()).toBe('mock');
  });

  it('returns mockWebSocket singleton in mock mode', () => {
    expect(getActiveWS()).toBe(mockWebSocket);
  });

  // ── Mode Switching ──────────────────────────────────────────────────

  it('switches to real mode', () => {
    const instance = setWSMode('real');
    expect(getWSMode()).toBe('real');
    expect(instance).toBeDefined();
    // Real instance should have a connect method
    expect(typeof instance.connect).toBe('function');
  });

  it('switches back to mock mode', () => {
    setWSMode('real');
    setWSMode('mock');
    expect(getWSMode()).toBe('mock');
    expect(getActiveWS()).toBe(mockWebSocket);
  });

  it('returns the active instance for chaining', () => {
    const realInstance = setWSMode('real');
    expect(realInstance).toBe(getActiveWS());

    const mockInstance = setWSMode('mock');
    expect(mockInstance).toBe(mockWebSocket);
  });

  // ── Singleton Behavior ──────────────────────────────────────────────

  it('getActiveWS always returns the same mock singleton', () => {
    const a = getActiveWS();
    const b = getActiveWS();
    expect(a).toBe(b);
  });

  it('real mode returns the same instance on subsequent calls', () => {
    setWSMode('real');
    const a = getActiveWS();
    const b = getActiveWS();
    expect(a).toBe(b);
  });

  // ── Mode Persistence ────────────────────────────────────────────────

  it('survives multiple mode switches', () => {
    expect(getWSMode()).toBe('mock');

    setWSMode('real');
    expect(getWSMode()).toBe('real');

    setWSMode('mock');
    expect(getWSMode()).toBe('mock');

    setWSMode('real');
    expect(getWSMode()).toBe('real');
  });
});
