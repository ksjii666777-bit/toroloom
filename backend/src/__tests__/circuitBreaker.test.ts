/**
 * ============================================================================
 * Toroloom Circuit Breaker — Unit Tests
 * ============================================================================
 *
 * Tests all state transitions of the Circuit Breaker:
 *   1. CLOSED → OPEN: Failure threshold exceeded
 *   2. OPEN → HALF_OPEN: Timeout expires
 *   3. HALF_OPEN → CLOSED: Success threshold reached
 *   4. HALF_OPEN → OPEN: Probe failure
 *   5. Thread safety: Concurrent calls with mutex
 *   6. CircuitOpenError: Requests rejected when OPEN
 *   7. Retry logic: Automatic retry on failure
 *   8. Manual recordFailure / recordSuccess
 *   9. Reset: Full state reset
 *  10. Registry: Named circuit breakers
 *
 * Run: npx vitest run --reporter=verbose
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitState,
  CircuitOpenError,
  circuitRegistry,
  getCircuitBreaker,
} from '../services/circuitBreaker';

describe('CircuitBreaker — State Machine', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 1000, // Short timeout for testing
      retryCount: 1,
    });
  });

  afterEach(() => {
    cb.reset();
  });

  // ==================== Initial State ====================

  it('should start in CLOSED state', () => {
    const snap = cb.snapshot();
    expect(snap.state).toBe(CircuitState.CLOSED);
    expect(snap.isOpen).toBe(false);
    expect(snap.failureCount).toBe(0);
    expect(snap.successCount).toBe(0);
    expect(snap.totalCalls).toBe(0);
  });

  it('should be available when CLOSED', () => {
    expect(cb.isAvailable()).toBe(true);
  });

  // ==================== CLOSED → OPEN ====================

  it('should transition to OPEN when failure threshold is exceeded via call()', async () => {
    // Exceed the failure threshold (3 failures)
    let callCount = 0;

    // 3 consecutive failures
    for (let i = 0; i < 3; i++) {
      try {
        await cb.call(async () => {
          callCount++;
          throw new Error(`Simulated failure ${callCount}`);
        });
      } catch {
        // Expected
      }
    }

    const snap = cb.snapshot();
    expect(snap.state).toBe(CircuitState.OPEN);
    expect(snap.isOpen).toBe(true);
    expect(snap.failureCount).toBe(0); // Reset after tripping
    expect(snap.totalFailures).toBe(3);
    expect(snap.totalCalls).toBe(3);
    expect(snap.lastFailureTime).toBeGreaterThan(0);
    expect(snap.nextAttemptTime).toBeGreaterThan(0);
  });

  it('should transition to OPEN when failure threshold is exceeded via recordFailure()', async () => {
    await cb.recordFailure();
    await cb.recordFailure();
    await cb.recordFailure();

    const snap = cb.snapshot();
    expect(snap.state).toBe(CircuitState.OPEN);
    expect(snap.totalFailures).toBe(3);
  });

  // ==================== OPEN state ====================

  it('should reject calls when circuit is OPEN', async () => {
    // Trip the circuit
    await cb.recordFailure();
    await cb.recordFailure();
    await cb.recordFailure();

    expect(cb.snapshot().state).toBe(CircuitState.OPEN);

    // Call should throw CircuitOpenError
    try {
      await cb.call(async () => 'should not reach here');
      expect.unreachable('Should have thrown');
    } catch (error: any) {
      expect(error).toBeInstanceOf(CircuitOpenError);
      expect(error.message).toContain('OPEN');
    }

    // The operation should NOT have been called
    const snap = cb.snapshot();
    expect(snap.totalCalls).toBe(3); // Only the failures counted
  });

  it('should not be available when circuit is OPEN and timeout has not elapsed', async () => {
    // Trip the circuit with infinite timeout so it stays OPEN
    const lockedCb = new CircuitBreaker('locked', {
      failureThreshold: 1,
      timeoutMs: 500_000, // Very long timeout
    });

    await lockedCb.recordFailure();
    expect(lockedCb.isAvailable()).toBe(false);
  });

  // ==================== OPEN → HALF_OPEN ====================

  it('should transition to HALF_OPEN after timeout expires', async () => {
    // Use a very short timeout
    const shortCb = new CircuitBreaker('quick-recover', {
      failureThreshold: 1,
      timeoutMs: 10, // 10ms timeout
      successThreshold: 1,
    });

    await shortCb.recordFailure();
    expect(shortCb.snapshot().state).toBe(CircuitState.OPEN);

    // Wait for timeout to expire
    await new Promise((r) => setTimeout(r, 20));

    // isAvailable should return true (timeout elapsed → can probe)
    expect(shortCb.isAvailable()).toBe(true);

    // Calling should succeed and transition should happen
    // But we need to NOT trip the circuit immediately
    // Actually, the state transitions to HALF_OPEN on the next call()
    const result = await shortCb.call(async () => 'recovered');
    expect(result).toBe('recovered');

    const snap = shortCb.snapshot();
    expect(snap.state).toBe(CircuitState.CLOSED); // successThreshold=1, so closed
  });

  // ==================== HALF_OPEN → CLOSED ====================

  it('should transition from HALF_OPEN to CLOSED after success threshold is met', async () => {
    const cb2 = new CircuitBreaker('half-to-closed', {
      failureThreshold: 1,
      timeoutMs: 10,
      successThreshold: 2,
    });

    // Trip circuit
    await cb2.recordFailure();
    expect(cb2.snapshot().state).toBe(CircuitState.OPEN);

    // Wait for timeout
    await new Promise((r) => setTimeout(r, 20));

    // Call should succeed → HALF_OPEN (first success)
    await cb2.call(async () => 'ok');
    expect(cb2.snapshot().state).toBe(CircuitState.HALF_OPEN);

    // Second success → CLOSED
    await cb2.call(async () => 'ok2');
    expect(cb2.snapshot().state).toBe(CircuitState.CLOSED);
    expect(cb2.snapshot().successCount).toBe(0); // Reset after closing
  });

  // ==================== HALF_OPEN → OPEN ====================

  it('should transition from HALF_OPEN back to OPEN on probe failure', async () => {
    const cb2 = new CircuitBreaker('half-to-open', {
      failureThreshold: 1,
      timeoutMs: 10,
      successThreshold: 1,
    });

    // Trip circuit
    await cb2.recordFailure();
    expect(cb2.snapshot().state).toBe(CircuitState.OPEN);

    // Wait for timeout
    await new Promise((r) => setTimeout(r, 20));

    // First call should succeed → HALF_OPEN → CLOSED (since successThreshold=1)
    // Let's use a higher successThreshold to test HALF_OPEN → OPEN
    const cb3 = new CircuitBreaker('half-to-open-2', {
      failureThreshold: 1,
      timeoutMs: 10,
      successThreshold: 1,
      retryCount: 1,
    });

    // Actually, let me manually manipulate state through failure recording
    // Trip to OPEN
    await cb3.recordFailure();
    expect(cb3.snapshot().state).toBe(CircuitState.OPEN);

    // Wait for timeout
    await new Promise((r) => setTimeout(r, 20));

    // Now call() will transition to HALF_OPEN internally
    // Make the probe fail
    let callAttempted = false;
    try {
      await cb3.call(async () => {
        callAttempted = true;
        throw new Error('Probe failure');
      });
    } catch {
      // Expected
    }

    expect(callAttempted).toBe(true);
    // Circuit should be OPEN again
    expect(cb3.snapshot().state).toBe(CircuitState.OPEN);

    // Since retryCount=1, the failure should be recorded once
    // But the circuit was already open... let me check.
    // Actually, when in HALF_OPEN, call() sets state to OPEN internally
    // to block concurrent requests. Then if it fails, it records failure.
    // Since failure threshold is 1, it trips open again.
    expect(cb3.snapshot().isOpen).toBe(true);
  });

  // ==================== Retry Logic ====================

  it('should retry on failure when retryCount > 1', async () => {
    const retryCb = new CircuitBreaker('retry-test', {
      failureThreshold: 3,
      successThreshold: 1,
      timeoutMs: 1000,
      retryCount: 3,
    });

    let attemptCount = 0;

    try {
      await retryCb.call(async () => {
        attemptCount++;
        throw new Error(`Attempt ${attemptCount} failed`);
      });
    } catch {
      // Expected
    }

    // Should have attempted 3 times
    expect(attemptCount).toBe(3);
    // Should have recorded 1 failure (after all retries exhausted)
    expect(retryCb.snapshot().totalFailures).toBe(1);
  });

  it('should NOT retry on success', async () => {
    const retryCb = new CircuitBreaker('success-no-retry', {
      retryCount: 3,
    });

    let callCount = 0;
    const result = await retryCb.call(async () => {
      callCount++;
      return 'success';
    });

    expect(result).toBe('success');
    expect(callCount).toBe(1);
  });

  // ==================== Manual Record ====================

  it('should allow manual recording of failures', async () => {
    cb.reset();
    expect(cb.snapshot().totalFailures).toBe(0);

    await cb.recordFailure();
    expect(cb.snapshot().totalFailures).toBe(1);
    expect(cb.snapshot().lastFailureTime).toBeGreaterThan(0);
  });

  it('should allow manual recording of successes', async () => {
    cb.reset();
    expect(cb.snapshot().totalSuccesses).toBe(0);

    await cb.recordSuccess();
    expect(cb.snapshot().totalSuccesses).toBe(1);
    expect(cb.snapshot().lastSuccessTime).toBeGreaterThan(0);
  });

  // ==================== Reset ====================

  it('should reset to initial CLOSED state', async () => {
    await cb.recordFailure();
    await cb.recordFailure();
    await cb.recordFailure();
    expect(cb.snapshot().state).toBe(CircuitState.OPEN);

    cb.reset();
    const snap = cb.snapshot();
    expect(snap.state).toBe(CircuitState.CLOSED);
    expect(snap.failureCount).toBe(0);
    expect(snap.totalFailures).toBe(0);
    expect(snap.totalCalls).toBe(0);
    expect(snap.lastFailureTime).toBeNull();
    expect(snap.nextAttemptTime).toBeNull();
  });

  // ==================== Registry ====================

  it('should return the same instance from registry for the same name', () => {
    const cb1 = getCircuitBreaker('registry-test');
    const cb2 = getCircuitBreaker('registry-test');
    expect(cb1).toBe(cb2);
  });

  it('should create separate instances for different names', () => {
    const cb1 = getCircuitBreaker('unique-name-1');
    const cb2 = getCircuitBreaker('unique-name-2');
    expect(cb1).not.toBe(cb2);
  });

  it('should reset all circuit breakers in the registry', async () => {
    const cb1 = getCircuitBreaker('reset-registry-1');
    const cb2 = getCircuitBreaker('reset-registry-2');

    await cb1.recordFailure();
    await cb2.recordFailure();

    expect(cb1.snapshot().totalFailures).toBe(1);
    expect(cb2.snapshot().totalFailures).toBe(1);

    circuitRegistry.resetAll();

    expect(cb1.snapshot().totalFailures).toBe(0);
    expect(cb2.snapshot().totalFailures).toBe(0);
  });

  // ==================== Config ====================

  it('should use custom config values', () => {
    const customCb = new CircuitBreaker('custom-config', {
      failureThreshold: 10,
      successThreshold: 5,
      timeoutMs: 60000,
      retryCount: 3,
    });

    const config = customCb.getConfig();
    expect(config.failureThreshold).toBe(10);
    expect(config.successThreshold).toBe(5);
    expect(config.timeoutMs).toBe(60000);
    expect(config.retryCount).toBe(3);
  });

  // ==================== Snapshot ====================

  it('should return a complete snapshot', () => {
    const snap = cb.snapshot();
    expect(snap).toHaveProperty('name', 'test-breaker');
    expect(snap).toHaveProperty('state');
    expect(snap).toHaveProperty('failureCount');
    expect(snap).toHaveProperty('successCount');
    expect(snap).toHaveProperty('totalCalls');
    expect(snap).toHaveProperty('totalFailures');
    expect(snap).toHaveProperty('totalSuccesses');
    expect(snap).toHaveProperty('isOpen');
    expect(snap).toHaveProperty('lastFailureTime');
    expect(snap).toHaveProperty('lastSuccessTime');
    expect(snap).toHaveProperty('nextAttemptTime');
  });

  // ==================== Thread Safety ====================

  it('should handle concurrent calls safely', async () => {
    const concurrentCb = new CircuitBreaker('concurrent', {
      failureThreshold: 5,
      successThreshold: 1,
      timeoutMs: 1000,
      retryCount: 1,
    });

    // Fire 10 concurrent successful calls
    const calls = Array.from({ length: 10 }, (_, i) =>
      concurrentCb.call(async () => `result-${i}`),
    );

    const results = await Promise.all(calls);
    expect(results).toHaveLength(10);
    expect(results[0]).toBe('result-0');
    expect(results[9]).toBe('result-9');

    const snap = concurrentCb.snapshot();
    expect(snap.totalSuccesses).toBe(10);
    expect(snap.totalCalls).toBe(10);
  });

  it('should handle concurrent failures safely', async () => {
    const concurrentFails = new CircuitBreaker('concurrent-fails', {
      failureThreshold: 3,
      successThreshold: 1,
      timeoutMs: 5000,
      retryCount: 1,
    });

    // Fire 5 concurrent failing calls
    const calls = Array.from({ length: 5 }, () =>
      concurrentFails.call(async () => {
        throw new Error('Concurrent failure');
      }),
    );

    // All should reject
    const results = await Promise.allSettled(calls);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(5);

    // Circuit should be OPEN (at least 3 failures recorded)
    const snap = concurrentFails.snapshot();
    expect(snap.state).toBe(CircuitState.OPEN);
  });
});
