import { env } from '../../config/env';
import { IBroker, BrokerConfig } from './interface';
import { MockBroker } from './mockBroker';
import { ZerodhaBroker } from './zerodhaBroker';
import { AngelBroker } from './angelBroker';
import { getCircuitBreaker, CircuitOpenError } from '../circuitBreaker';
import { auditTrail } from '../auditTrail';
import type { StorageEngine } from '../storage/types';

let brokerInstance: IBroker | null = null;
let currentBrokerType: 'zerodha' | 'angel' | 'mock' | null = null;

/**
 * Optional StorageEngine for persisting broker state across restarts.
 * Set at server startup via configureBrokerPersistence().
 */
let brokerStorage: StorageEngine | null = null;

/**
 * Deduplication tracker for broker connectivity events.
 * Tracks the last-known state per broker type so we don't flood
 * the audit trail with repeated BROKER_DISCONNECTED entries
 * every time getBroker() is called while a circuit is OPEN.
 */
const brokerStateCache = new Map<
  'zerodha' | 'angel' | 'mock',
  { lastEvent: 'BROKER_CONNECTED' | 'BROKER_DISCONNECTED'; timestamp: number }
>();

interface BrokerFactoryEntry {
  type: 'zerodha' | 'angel' | 'mock';
  factory: () => IBroker;
  config: BrokerConfig;
}

/**
 * Configure the broker factory with a StorageEngine for persistence.
 * Call this during server startup AFTER storage is initialized.
 */
export function configureBrokerPersistence(storage: StorageEngine): void {
  brokerStorage = storage;
}

/**
 * Load persisted broker state from storage and replay into the dedup cache.
 * Call this during server startup after configureBrokerPersistence().
 */
export async function loadBrokerStateFromStorage(): Promise<void> {
  if (!brokerStorage) return;
  const state = await brokerStorage.loadBrokerState();
  if (state.currentBrokerType) {
    currentBrokerType = state.currentBrokerType as any;
  }
  for (const [key, val] of Object.entries(state.dedupCache)) {
    brokerStateCache.set(key as any, val);
  }
}

/**
 * Persist the current broker state (type + dedup cache) to storage.
 */
async function persistBrokerState(): Promise<void> {
  if (!brokerStorage) return;
  const dedupCache: Record<string, { lastEvent: 'BROKER_CONNECTED' | 'BROKER_DISCONNECTED'; timestamp: number }> = {};
  for (const [key, val] of brokerStateCache) {
    dedupCache[key] = val;
  }
  await brokerStorage.saveBrokerState({
    currentBrokerType,
    dedupCache,
  });
}

/**
 * Dedup-aware helper to log a BROKER_DISCONNECTED event.
 * Only appends to the audit trail if this broker type wasn't
 * already known to be disconnected, preventing audit trail flooding.
 */
async function tryLogDisconnection(
  type: 'zerodha' | 'angel' | 'mock',
  reason: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const prevState = brokerStateCache.get(type);
  if (prevState?.lastEvent === 'BROKER_DISCONNECTED') return;

  brokerStateCache.set(type, {
    lastEvent: 'BROKER_DISCONNECTED',
    timestamp: Date.now(),
  });

  await auditTrail.append({
    userId: 'system',
    eventType: 'BROKER_DISCONNECTED',
    data: { brokerType: type, reason },
    ...(metadata ? { metadata } : {}),
  });

  await persistBrokerState();
}

/**
 * Create an authenticated broker instance with fallback chain.
 *
 * Strategy:
 *   1. Try the configured broker first (env.broker)
 *   2. If it fails → fall back to the next broker in chain
 *   3. Always fall back to MockBroker as the last resort
 *   4. Each broker call is protected by its own circuit breaker
 */
async function createBrokerWithFallback(): Promise<IBroker> {
  const brokers: BrokerFactoryEntry[] = [
    {
      type: 'zerodha',
      factory: () => new ZerodhaBroker(),
      config: {
        apiKey: env.zerodha.apiKey,
        apiSecret: env.zerodha.apiSecret,
        accessToken: env.zerodha.accessToken,
        requestToken: env.zerodha.requestToken,
      },
    },
    {
      type: 'angel',
      factory: () => new AngelBroker(),
      config: {
        apiKey: env.angel.apiKey,
        clientId: env.angel.clientId,
        accessToken: env.angel.accessToken,
        password: env.angel.password,
        totp: env.angel.totp,
      },
    },
    {
      type: 'mock',
      factory: () => new MockBroker(),
      config: { apiKey: 'mock' },
    },
  ];

  // Determine starting index based on configured broker preference
  const startIndex = env.broker === 'zerodha' ? 0 : env.broker === 'angel' ? 1 : 2;

  let lastError: Error | null = null;

  for (let i = startIndex; i < brokers.length; i++) {
    const { type, factory, config } = brokers[i];

    // Check circuit breaker — skip if circuit is OPEN for this broker
    const cb = getCircuitBreaker(`broker-${type}`, {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 60_000, // 1 minute cooldown for broker circuits
      retryCount: 1,
    });

    if (!cb.isAvailable()) {
      await tryLogDisconnection(type, 'Circuit breaker OPEN', { circuitSnapshot: cb.snapshot() });
      continue; // Skip this broker — circuit is open
    }

    try {
      const broker = await cb.call(async () => {
        const instance = factory();
        await instance.authenticate(config);
        return instance;
      });

      // Connection successful — record it
      currentBrokerType = type;
      brokerStateCache.set(type, {
        lastEvent: 'BROKER_CONNECTED',
        timestamp: Date.now(),
      });
      await auditTrail.append({
        userId: 'system',
        eventType: 'BROKER_CONNECTED',
        data: { brokerType: type, mode: env.isMock ? 'mock' : 'live' },
      });
      await persistBrokerState();

      return broker;
    } catch (error: any) {
      lastError = error;

      if (error instanceof CircuitOpenError) {
        await tryLogDisconnection(type, error.message);
      } else {
        await auditTrail.append({
          userId: 'system',
          eventType: 'BROKER_FAILOVER',
          data: {
            failedBroker: type,
            nextBroker: i + 1 < brokers.length ? brokers[i + 1].type : 'none',
            error: error.message,
          },
        });
      }

      continue;
    }
  }

  throw new Error(
    `All brokers unavailable after fallback chain. ` +
    `Last error: ${lastError?.message || 'Unknown error'}. ` +
    `Circuit states: ${brokers.map(b => {
      const cb = getCircuitBreaker(`broker-${b.type}`);
      return `${b.type}=${cb.snapshot().state}`;
    }).join(', ')}`,
  );
}

/**
 * Creates and authenticates the broker instance based on environment config.
 * Uses a fallback chain with circuit breaker protection.
 */
export async function getBroker(): Promise<IBroker> {
  if (brokerInstance?.isConnected()) {
    return brokerInstance;
  }

  const broker = await createBrokerWithFallback();
  brokerInstance = broker;
  return broker;
}

/**
 * Get the current broker type (for observability/debugging).
 */
export function getCurrentBrokerType(): string | null {
  return currentBrokerType;
}

/** Reset broker connection (e.g., on logout) */
export function resetBroker(): void {
  brokerInstance = null;
  currentBrokerType = null;
  brokerStateCache.clear();
}

/**
 * Reset the deduplication state for a specific broker type.
 */
export function resetBrokerDeduplication(type: 'zerodha' | 'angel' | 'mock'): void {
  brokerStateCache.delete(type);
}

/**
 * Get the current deduplication state (for testing/observability).
 */
export function getBrokerDeduplicationState(): Map<
  'zerodha' | 'angel' | 'mock',
  { lastEvent: string; timestamp: number }
> {
  return new Map(brokerStateCache);
}
