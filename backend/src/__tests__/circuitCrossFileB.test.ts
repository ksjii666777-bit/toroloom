/**
 * ============================================================================
 * Toroloom — Cross-File Isolation Test: CircuitBreaker File B
 * ============================================================================
 *
 * Verifies that after File A runs and calls circuitRegistry.resetAll() in
 * its afterAll, this file starts with a completely clean circuit breaker
 * registry.
 *
 * If File A's afterAll did NOT call resetAll(), this file would inherit:
 *   - 2 circuit breakers ('cross_file_a_breaker_1', 'cross_file_a_breaker_2')
 *   - Both in OPEN state with failure counts of 5
 *   - CircuitRegistry.getAll() would return 2 entries
 *
 * Run with File A in the same vitest process:
 *   npx vitest run --config vitest.cross-file.config.ts \
 *     src/__tests__/circuitCrossFileA.test.ts \
 *     src/__tests__/circuitCrossFileB.test.ts
 *
 * Environment:
 *   In-memory only (no DB required).
 * ============================================================================
 */

import { describe, it, expect, afterAll } from 'vitest';
import { getCircuitBreaker, circuitRegistry, CircuitState } from '../services/circuitBreaker';

describe('Cross-File Isolation — CircuitBreaker File B', () => {
  afterAll(() => {
    // Clean up after ourselves
    circuitRegistry.resetAll();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Isolation assertions — these fail if File A's circuit breakers leaked
  // ═══════════════════════════════════════════════════════════════════════════

  it('should start with an empty circuit breaker registry (no leakage from File A)', () => {
    const all = circuitRegistry.getAll();
    expect(all.size).toBe(0);
  });

  it('should start with no pre-existing circuit breakers by name', () => {
    // File A created 2 breakers. If resetAll() was not called in afterAll,
    // getCircuitBreaker would return those stale instances with OPEN state.
    const all = circuitRegistry.getAll();
    expect(all.has('cross_file_a_breaker_1')).toBe(false);
    expect(all.has('cross_file_a_breaker_2')).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Independent operation — File B creates its own circuit breakers
  // ═══════════════════════════════════════════════════════════════════════════

  it('should create its own circuit breakers independently', () => {
    const cb = getCircuitBreaker('cross_file_b_breaker');
    expect(cb).toBeDefined();
    expect(cb.name).toBe('cross_file_b_breaker');
    expect(cb.snapshot().state).toBe(CircuitState.CLOSED);

    // Only 1 breaker should exist
    const all = circuitRegistry.getAll();
    expect(all.size).toBe(1);
    expect(all.has('cross_file_b_breaker')).toBe(true);
  });

  it('should trip and reset its own circuit breaker independently', async () => {
    const cb = getCircuitBreaker('cross_file_b_breaker');

    // Trip it
    for (let i = 0; i < 5; i++) {
      await cb.recordFailure();
    }
    expect(cb.snapshot().state).toBe(CircuitState.OPEN);

    // Reset it
    cb.reset();
    expect(cb.snapshot().state).toBe(CircuitState.CLOSED);
    expect(cb.snapshot().totalFailures).toBe(0);
    expect(cb.snapshot().totalCalls).toBe(0);
  });

  it('should have no File A circuit breakers in registry (final verification)', () => {
    const all = circuitRegistry.getAll();
    expect(all.has('cross_file_a_breaker_1')).toBe(false);
    expect(all.has('cross_file_a_breaker_2')).toBe(false);
    // Only our own breaker exists
    expect(all.has('cross_file_b_breaker')).toBe(true);
    expect(all.size).toBe(1);
  });
});
