/**
 * ============================================================================
 * Toroloom — Cross-File Isolation Test: CircuitBreaker File A
 * ============================================================================
 *
 * Creates and trips circuit breakers in the global circuitRegistry singleton,
 * then calls circuitRegistry.resetAll() in afterAll. If the cleanup is
 * missing or broken, File B will inherit these circuit breakers with their
 * OPEN state and its assertions will fail.
 *
 * Run with File B in the same vitest process:
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

describe('Cross-File Isolation — CircuitBreaker File A', () => {
  afterAll(() => {
    // CRITICAL: Reset all circuit breakers so File B starts with an empty
    // registry. Without this, File B inherits File A's circuit breakers
    // complete with their OPEN state and accumulated failure counts.
    circuitRegistry.resetAll();
  });

  it('should create circuit breakers in the global registry', () => {
    const cb1 = getCircuitBreaker('cross_file_a_breaker_1');
    const cb2 = getCircuitBreaker('cross_file_a_breaker_2');

    expect(cb1.name).toBe('cross_file_a_breaker_1');
    expect(cb2.name).toBe('cross_file_a_breaker_2');

    // Verify they are in the registry
    const all = circuitRegistry.getAll();
    expect(all.has('cross_file_a_breaker_1')).toBe(true);
    expect(all.has('cross_file_a_breaker_2')).toBe(true);
  });

  it('should trip circuit breakers to OPEN state', async () => {
    const cb1 = getCircuitBreaker('cross_file_a_breaker_1');
    const cb2 = getCircuitBreaker('cross_file_a_breaker_2');

    // Trip both circuit breakers (default failureThreshold = 5)
    for (let i = 0; i < 5; i++) {
      await cb1.recordFailure();
      await cb2.recordFailure();
    }

    // Verify both are OPEN
    expect(cb1.snapshot().state).toBe(CircuitState.OPEN);
    expect(cb1.snapshot().isOpen).toBe(true);
    expect(cb1.snapshot().totalFailures).toBe(5);
    expect(cb1.isAvailable()).toBe(false);

    expect(cb2.snapshot().state).toBe(CircuitState.OPEN);
    expect(cb2.snapshot().isOpen).toBe(true);
    expect(cb2.snapshot().totalFailures).toBe(5);
    expect(cb2.isAvailable()).toBe(false);
  });

  it('should have 2 circuit breakers in the registry before cleanup', () => {
    const all = circuitRegistry.getAll();
    expect(all.size).toBe(2);
    // Both should still be OPEN
    expect(all.get('cross_file_a_breaker_1')!.snapshot().state).toBe(CircuitState.OPEN);
    expect(all.get('cross_file_a_breaker_2')!.snapshot().state).toBe(CircuitState.OPEN);
  });
});
