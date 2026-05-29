/**
 * ============================================================================
 * Toroloom Circuit Breaker — High-Stakes Transaction Gateway Protector
 * ============================================================================
 *
 * Implements the Circuit Breaker pattern to protect downstream services
 * (broker APIs, database, WebSocket) from cascading failures.
 *
 * States:
 *   CLOSED   → Normal operation. Requests pass through. Failures are counted.
 *   OPEN     → Failure threshold exceeded. Requests are rejected immediately.
 *              After `timeoutMs`, transitions to HALF_OPEN.
 *   HALF_OPEN → A single probe request is allowed. If it succeeds → CLOSED.
 *               If it fails → OPEN again.
 *
 * Thread-safety: All state mutations are guarded by a Promise-based mutex.
 * Concurrent probes in HALF_OPEN state are prevented by a probeInProgress flag.
 *
 * Usage:
 *   const cb = new CircuitBreaker('zerodha-broker', {
 *     failureThreshold: 5,
 *     successThreshold: 2,
 *     timeoutMs: 30000,
 *   });
 *
 *   const result = await cb.call(() => broker.placeOrder(order));
 * ============================================================================
 */

// ==================== Types ====================

export enum CircuitState {
  /** Normal operation — requests pass through */
  CLOSED = 'CLOSED',
  /** Failure threshold exceeded — requests are rejected immediately */
  OPEN = 'OPEN',
  /** Probe state — single request allowed to test recovery */
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold: number;
  /** Number of consecutive successes in HALF_OPEN to close the circuit (default: 2) */
  successThreshold: number;
  /** Milliseconds to wait before transitioning from OPEN to HALF_OPEN (default: 30000) */
  timeoutMs: number;
  /** Number of retry attempts before recording a failure (default: 1) */
  retryCount: number;
}

export interface CircuitBreakerSnapshot {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
  isOpen: boolean;
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 30_000,
  retryCount: 1,
};

// ==================== Internal State ====================

interface InternalState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

// ==================== Simple Promise Mutex ====================

class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

// ==================== Circuit Breaker ====================

export class CircuitBreaker {
  readonly name: string;
  private config: CircuitBreakerConfig;
  private state: InternalState;
  private mutex = new Mutex();
  /** Prevents concurrent probe requests in HALF_OPEN state */
  private probeInProgress = false;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  private createInitialState(): InternalState {
    return {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      nextAttemptTime: null,
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    };
  }

  // ==================== Public API ====================

  /**
   * Execute a protected operation through the circuit breaker.
   * Throws if the circuit is OPEN (request not sent) or if the operation fails.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    await this.mutex.acquire();
    try {
      // ── Check if we should allow the request ──
      if (!this.canProceed()) {
        // Request was not attempted — don't count it as a call
        throw new CircuitOpenError(
          `Circuit breaker "${this.name}" is OPEN. ` +
          `Next attempt at ${this.state.nextAttemptTime ? new Date(this.state.nextAttemptTime).toISOString() : 'unknown'}. ` +
          `Failures: ${this.state.totalFailures}`,
        );
      }

      // If HALF_OPEN, only one probe at a time
      if (this.state.state === CircuitState.HALF_OPEN) {
        if (this.probeInProgress) {
          throw new CircuitOpenError(
            `Circuit breaker "${this.name}" is HALF_OPEN with a probe in progress. Try again later.`,
          );
        }
        this.probeInProgress = true;
      }

      this.mutex.release(); // Release before executing the operation
    } catch (error) {
      this.mutex.release();
      throw error;
    }

    // Execute the operation outside the mutex to avoid holding the lock
    try {
      return await this.executeWithRetry(fn);
    } finally {
      // Clear the probe flag after completion
      this.probeInProgress = false;
    }
  }

  /**
   * Check if the circuit is available to accept requests.
   * Does not mutate state — use for pre-checks.
   */
  isAvailable(): boolean {
    const s = this.state;

    if (s.state === CircuitState.CLOSED) return true;

    if (s.state === CircuitState.OPEN) {
      // Check if timeout has elapsed → can attempt HALF_OPEN
      if (s.nextAttemptTime !== null && Date.now() >= s.nextAttemptTime) {
        return true;
      }
      return false;
    }

    // HALF_OPEN — available only if no probe is in progress
    return !this.probeInProgress;
  }

  /**
   * Manually record a failure (for operations that fail outside call()).
   */
  async recordFailure(): Promise<void> {
    await this.mutex.acquire();
    try {
      this.state.failureCount++;
      this.state.totalFailures++;
      this.state.totalCalls++;
      this.state.lastFailureTime = Date.now();

      if (this.state.failureCount >= this.config.failureThreshold) {
        this.tripOpen();
      }
    } finally {
      this.mutex.release();
    }
  }

  /**
   * Manually record a success (for operations that succeed outside call()).
   */
  async recordSuccess(): Promise<void> {
    await this.mutex.acquire();
    try {
      this.recordSuccessInternal();
    } finally {
      this.mutex.release();
    }
  }

  /**
   * Reset the circuit breaker to its initial CLOSED state.
   */
  reset(): void {
    this.state = this.createInitialState();
    this.probeInProgress = false;
  }

  /**
   * Get a snapshot of the current state for monitoring/observability.
   */
  snapshot(): CircuitBreakerSnapshot {
    const s = this.state;
    return {
      name: this.name,
      state: s.state,
      failureCount: s.failureCount,
      successCount: s.successCount,
      lastFailureTime: s.lastFailureTime,
      lastSuccessTime: s.lastSuccessTime,
      nextAttemptTime: s.nextAttemptTime,
      totalCalls: s.totalCalls,
      totalFailures: s.totalFailures,
      totalSuccesses: s.totalSuccesses,
      isOpen: s.state === CircuitState.OPEN,
    };
  }

  /**
   * Get the current config (read-only).
   */
  getConfig(): Readonly<CircuitBreakerConfig> {
    return { ...this.config };
  }

  // ==================== Private Methods ====================

  private canProceed(): boolean {
    const s = this.state;

    if (s.state === CircuitState.CLOSED) return true;

    if (s.state === CircuitState.OPEN) {
      // Check if the timeout has elapsed
      if (s.nextAttemptTime !== null && Date.now() >= s.nextAttemptTime) {
        // Transition to HALF_OPEN
        this.state.state = CircuitState.HALF_OPEN;
        this.state.successCount = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN — allow probe if none in progress
    return !this.probeInProgress;
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    const maxRetries = Math.max(1, this.config.retryCount);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await fn();
        // ── Success! ──
        await this.mutex.acquire();
        try {
          this.recordSuccessInternal();
        } finally {
          this.mutex.release();
        }
        return result;
      } catch (error: any) {
        lastError = error;
        // Don't count CircuitOpenError as a failure (it's our own rejection)
        if (error instanceof CircuitOpenError) throw error;

        // If not the last attempt, continue to retry
        if (attempt < maxRetries - 1) {
          continue;
        }

        // Last attempt failed — record the failure
        await this.mutex.acquire();
        try {
          this.state.failureCount++;
          this.state.totalFailures++;
          this.state.lastFailureTime = Date.now();
          this.state.totalCalls++;

          if (this.state.failureCount >= this.config.failureThreshold) {
            this.tripOpen();
          }
        } finally {
          this.mutex.release();
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  private recordSuccessInternal(): void {
    this.state.successCount++;
    this.state.totalSuccesses++;
    this.state.totalCalls++;
    this.state.lastSuccessTime = Date.now();

    if (this.state.state === CircuitState.HALF_OPEN) {
      if (this.state.successCount >= this.config.successThreshold) {
        // Circuit healed — close it
        this.state.state = CircuitState.CLOSED;
        this.state.failureCount = 0;
        this.state.successCount = 0;
        this.state.nextAttemptTime = null;
      }
    } else if (this.state.state === CircuitState.CLOSED) {
      // Success in CLOSED state — reset failure count
      this.state.failureCount = 0;
    }
  }

  private tripOpen(): void {
    this.state.state = CircuitState.OPEN;
    this.state.nextAttemptTime = Date.now() + this.config.timeoutMs;
    this.state.failureCount = 0;
    this.state.successCount = 0;
  }
}

// ==================== Error Type ====================

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// ==================== Registry ====================

/**
 * Global circuit breaker registry.
 * Each downstream service gets its own named circuit breaker.
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let cb = this.breakers.get(name);
    if (!cb) {
      cb = new CircuitBreaker(name, config);
      this.breakers.set(name, cb);
    }
    return cb;
  }

  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  resetAll(): void {
    for (const cb of this.breakers.values()) {
      cb.reset();
    }
  }
}

export const circuitRegistry = new CircuitBreakerRegistry();

/**
 * Convenience function to get a named circuit breaker.
 */
export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>,
): CircuitBreaker {
  return circuitRegistry.get(name, config);
}
