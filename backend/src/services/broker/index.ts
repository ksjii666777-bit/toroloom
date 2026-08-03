import { env } from '../../config/env';
import { IBroker } from './interface';
import { registry } from './registry';
import { registerDefaultPlugins, updatePluginEnvConfig } from './plugins/registerDefaults';
import { getCircuitBreaker } from '../circuitBreaker';
import { auditTrail } from '../auditTrail';
import type { StorageEngine } from '../storage/types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { setBrokerConnected, incrementBrokerAuthError, incrementBrokerReconnects } from '../metrics';

let brokerInstance: IBroker | null = null;
let currentBrokerType: string | null = null;

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
const brokerStateCache = new Map<string, { lastEvent: 'BROKER_CONNECTED' | 'BROKER_DISCONNECTED'; timestamp: number }>();

// ─── Initialize default plugins on first import ─────────────────────────
// This runs when the module is first loaded (e.g. during server startup).
// Safe to call multiple times — registry.register overwrites duplicates.
registerDefaultPlugins();
updatePluginEnvConfig(env);

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
    currentBrokerType = state.currentBrokerType;
  }
  for (const [key, val] of Object.entries(state.dedupCache)) {
    brokerStateCache.set(key, val);
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
 * Creates and authenticates the broker instance.
 * Uses the registry's fallback chain (dynamic, plugin-based).
 */
async function createBrokerWithFallback(): Promise<IBroker> {
  const configuredBroker = env.broker !== 'mock' ? env.broker : undefined;

  try {
    const { broker, type } = await registry.createWithFallback(configuredBroker, {
      // Only provide env-based config overrides; the registry uses
      // defaultConfig from each plugin, which was populated by updatePluginEnvConfig
    });

    // Connection successful — record it
    currentBrokerType = type;
    brokerStateCache.set(type, {
      lastEvent: 'BROKER_CONNECTED',
      timestamp: Date.now(),
    });
    setBrokerConnected(type, true);
    await auditTrail.append({
      userId: 'system',
      eventType: 'BROKER_CONNECTED',
      data: { brokerType: type, mode: env.isMock ? 'mock' : 'live' },
    });
    await persistBrokerState();

    return broker;
  } catch (error) {
    // All brokers unavailable — record the disconnection (deduped) so the
    // persisted state and audit trail reflect the outage.
    await recordBrokerDisconnected(configuredBroker);
    throw error;
  }
}

/**
 * Record BROKER_DISCONNECTED for broker types whose circuits are unavailable,
 * deduplicating consecutive disconnections so the audit trail isn't flooded
 * while a circuit stays OPEN across repeated getBroker() calls. Also persists
 * the updated dedup cache so a restart knows the broker went down.
 */
async function recordBrokerDisconnected(preferredType?: string): Promise<void> {
  const affected = new Set<string>();
  if (preferredType) affected.add(preferredType);
  for (const plugin of registry.getAllPlugins()) {
    if (!getCircuitBreaker(`broker-${plugin.type}`).isAvailable()) {
      affected.add(plugin.type);
    }
  }
  if (affected.size === 0) return;

  const primary = preferredType || [...affected][0];
  let transitioned = false;
  for (const type of affected) {
    if (brokerStateCache.get(type)?.lastEvent !== 'BROKER_DISCONNECTED') {
      brokerStateCache.set(type, {
        lastEvent: 'BROKER_DISCONNECTED',
        timestamp: Date.now(),
      });
      transitioned = true;
    }
  }
  // Only write when something actually changed: the state was already
  // persisted on the transition, so a no-op (repeat circuit-open call)
  // can safely skip both the audit append and the DB write.
  if (transitioned) {
    await auditTrail.append({
      userId: 'system',
      eventType: 'BROKER_DISCONNECTED',
      data: { brokerType: primary, mode: env.isMock ? 'mock' : 'live' },
    });
    await persistBrokerState();
  }
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
  registry.resetConnections();
}

/**
 * Reset the deduplication state for a specific broker type.
 */
export function resetBrokerDeduplication(type: string): void {
  brokerStateCache.delete(type);
}

/**
 * Get the current deduplication state (for testing/observability).
 */
export function getBrokerDeduplicationState(): Map<string, { lastEvent: string; timestamp: number }> {
  return new Map(brokerStateCache);
}
