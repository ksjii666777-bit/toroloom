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
import { configureApi } from '../services/api/client';

describe('WSRegistry', () => {
  beforeEach(() => {
    // Reset mode to real (the production default) and configure a base URL
    // so real mode resolves to the real WebSocket instance.
    setWSMode('real');
    configureApi({ baseUrl: 'https://api.example.com/api' });
  });

  // ── Default Mode ────────────────────────────────────────────────────

  it('defaults to real mode', () => {
    expect(getWSMode()).toBe('real');
  });

  it('returns mockWebSocket singleton in mock mode', () => {
    setWSMode('mock');
    expect(getActiveWS()).toBe(mockWebSocket);
  });

  it('falls back to mock when real mode has no base URL configured', () => {
    configureApi({ baseUrl: '' });
    setWSMode('real');
    // Without a backend URL, getActiveWS() must not return a real service
    // that would fail to connect — it falls back to the in-process mock.
    expect(getActiveWS()).toBe(mockWebSocket);
    expect(getWSMode()).toBe('real'); // mode itself stays real
  });

  // ── Mode Switching ──────────────────────────────────────────────────

  it('switches to real mode', () => {
    const instance = setWSMode('real');
    expect(getWSMode()).toBe('real');
    expect(instance).toBeDefined();
    // Real instance should be a DIFFERENT object than the mock singleton
    expect(instance).not.toBe(mockWebSocket);
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
    expect(getWSMode()).toBe('real');

    setWSMode('mock');
    expect(getWSMode()).toBe('mock');

    setWSMode('real');
    expect(getWSMode()).toBe('real');

    setWSMode('mock');
    expect(getWSMode()).toBe('mock');
  });
});
