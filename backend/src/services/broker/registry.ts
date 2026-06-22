/**
 * ============================================================================
 * Toroloom Broker Registry — Dynamic Broker Plugin Registration & Discovery
 * ============================================================================
 *
 * The BrokerRegistry replaces the old hardcoded fallback chain with a
 * dynamic, plugin-based system. Anyone can add a new broker by:
 *   1. Implementing IBroker (or using Zero-API gateway)
 *   2. Creating a BrokerPlugin descriptor
 *   3. Calling BrokerRegistry.register(plugin)
 *
 * Features:
 *   - Register/unregister brokers dynamically at runtime
 *   - Discover brokers by region, capability, or auth mode
 *   - Plugin-based fallback chain with configurable priority
 *   - Frontend-facing metadata (broker cards, credential forms)
 *   - Circuit breaker integration per broker
 *
 * Usage:
 *   import { registry } from './registry';
 *   registry.register(zerodhaPlugin);
 *   registry.register(angelPlugin);
 *   const brokers = registry.getAvailableBrokers('india');
 *   const broker = await registry.createBroker('zerodha', config);
 *
 * ============================================================================
 */

import type { IBroker, BrokerConfig } from './interface';
import type {
  BrokerPlugin,
  BrokerPluginMeta,
  BrokerRegion,
  BrokerCapability,
} from './plugin';
import { getCircuitBreaker, CircuitOpenError } from '../circuitBreaker';
import { auditTrail } from '../auditTrail';
import { setBrokerConnected, incrementBrokerAuthError, incrementBrokerReconnects } from '../metrics';

// ──── Event Types ─────────────────────────────────────────────────────────

export type RegistryEventType =
  | 'broker-registered'
  | 'broker-unregistered'
  | 'broker-connected'
  | 'broker-disconnected'
  | 'broker-failover';

export type RegistryEventHandler = (event: RegistryEventType, data: any) => void;

// ──── Registry Class ──────────────────────────────────────────────────────

class BrokerRegistry {
  private plugins = new Map<string, BrokerPlugin>();
  private instances = new Map<string, IBroker | null>();   // userId → broker inst
  private connectionTypes = new Map<string, string>();     // userId → broker type
  private listeners = new Set<RegistryEventHandler>();

  // ── Event Bus ─────────────────────────────────────────────────────────

  on(handler: RegistryEventHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private emit(event: RegistryEventType, data: any): void {
    for (const handler of this.listeners) {
      try { handler(event, data); } catch { /* swallow listener errors */ }
    }
  }

  // ── Plugin Registration ──────────────────────────────────────────────

  /**
   * Register a broker plugin. If a plugin with the same type already exists,
   * it will be overwritten (useful for hot-reloading or overriding defaults).
   */
  register(plugin: BrokerPlugin): void {
    if (!plugin.type) throw new Error('BrokerPlugin.type is required');
    if (!plugin.factory) throw new Error(`BrokerPlugin ${plugin.type} must have a factory`);

    this.plugins.set(plugin.type, plugin);
    this.emit('broker-registered', { type: plugin.type, label: plugin.label });

    // Create a circuit breaker for this broker (idempotent — returns existing if present)
    getCircuitBreaker(`broker-${plugin.type}`, {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 60_000,
      retryCount: 1,
    });
  }

  /**
   * Unregister a broker plugin. Cleans up any active instances.
   */
  unregister(type: string): boolean {
    const plugin = this.plugins.get(type);
    if (!plugin) return false;

    this.plugins.delete(type);
    this.emit('broker-unregistered', { type, label: plugin.label });
    return true;
  }

  /**
   * Check if a broker type is registered.
   */
  has(type: string): boolean {
    return this.plugins.has(type);
  }

  /**
   * Get a registered plugin by type.
   */
  getPlugin(type: string): BrokerPlugin | undefined {
    return this.plugins.get(type);
  }

  /**
   * Get all registered plugin metadata (safe for frontend consumption).
   */
  getAllPlugins(): BrokerPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all registered plugin metadata, sorted by priority (lower first).
   */
  getAllMeta(): BrokerPluginMeta[] {
    return Array.from(this.plugins.values())
      .sort((a, b) => a.priority - b.priority)
      .map(p => this.toMeta(p));
  }

  /**
   * Get brokers available for a specific region, sorted by priority.
   */
  getByRegion(region: BrokerRegion): BrokerPluginMeta[] {
    return Array.from(this.plugins.values())
      .filter(p => p.region === region || p.regions?.includes(region))
      .sort((a, b) => a.priority - b.priority)
      .map(p => this.toMeta(p));
  }

  /**
   * Get brokers that support a specific capability.
   */
  getByCapability(capability: BrokerCapability): BrokerPluginMeta[] {
    return Array.from(this.plugins.values())
      .filter(p => p.capabilities.includes(capability))
      .sort((a, b) => a.priority - b.priority)
      .map(p => this.toMeta(p));
  }

  /**
   * Get brokers matching a query (searches type, label, tagline).
   */
  search(query: string): BrokerPluginMeta[] {
    const q = query.toLowerCase();
    return Array.from(this.plugins.values())
      .filter(p =>
        p.type.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.tagline?.toLowerCase().includes(q)
      )
      .map(p => this.toMeta(p));
  }

  /**
   * Get the count of registered brokers.
   */
  get count(): number {
    return this.plugins.size;
  }

  // ── Broker Creation ──────────────────────────────────────────────────

  /**
   * Create and authenticate a broker instance for a specific plugin.
   * Respects circuit breaker state.
   *
   * @param type - Broker plugin type
   * @param config - Authentication configuration
   * @returns An authenticated IBroker instance
   * @throws Error if plugin not found, circuit is open, or auth fails
   */
  async createBroker(type: string, config: BrokerConfig): Promise<IBroker> {
    const plugin = this.plugins.get(type);
    if (!plugin) {
      throw new Error(`Broker plugin not found: ${type}. Available: ${Array.from(this.plugins.keys()).join(', ')}`);
    }

    const cb = getCircuitBreaker(`broker-${type}`);
    if (!cb.isAvailable()) {
      throw new CircuitOpenError(`Circuit breaker OPEN for ${type}`);
    }

    try {
      const broker = await cb.call(async () => {
        const instance = plugin.factory(config);

        if (plugin.initialize) {
          const authResult = await plugin.initialize(config);
          if (!authResult) {
            incrementBrokerAuthError(type);
            throw new Error(`Authentication failed for broker: ${type}`);
          }
        }

        return instance;
      });

      setBrokerConnected(type, true);
      this.emit('broker-connected', { type, label: plugin.label });
      return broker;
    } catch (error: any) {
      incrementBrokerAuthError(type);
      this.emit('broker-disconnected', { type, label: plugin.label, error: error.message });
      throw error;
    }
  }

  /**
   * Create a broker with automatic fallback chain.
   * Tries brokers in priority order until one succeeds.
   *
   * @param startType - Optional broker type to try first
   * @param configOverride - Optional config overrides per broker type
   * @returns An authenticated IBroker instance
   * @throws Error if ALL brokers are unavailable
   */
  async createWithFallback(
    startType?: string,
    configOverride?: Record<string, Partial<BrokerConfig>>,
  ): Promise<{ broker: IBroker; type: string }> {
    const sorted = Array.from(this.plugins.values())
      .sort((a, b) => a.priority - b.priority);

    // If a specific type is requested, try it first
    const ordered = startType
      ? [
          ...sorted.filter(p => p.type === startType),
          ...sorted.filter(p => p.type !== startType),
        ]
      : sorted;

    let lastError: Error | null = null;

    for (const plugin of ordered) {
      const cb = getCircuitBreaker(`broker-${plugin.type}`);

      if (!cb.isAvailable()) {
        lastError = new Error(`Circuit breaker OPEN for ${plugin.type}`);
        this.emit('broker-disconnected', {
          type: plugin.type,
          label: plugin.label,
          reason: 'circuit_open',
          circuitSnapshot: cb.snapshot(),
        });
        continue;
      }

      try {
        const config = {
          ...this.getDefaultConfig(plugin),
          ...(configOverride?.[plugin.type] || {}),
        };

        const broker = await this.createBroker(plugin.type, config as BrokerConfig);
        return { broker, type: plugin.type };
      } catch (error: any) {
        lastError = error;
        incrementBrokerReconnects(plugin.type);
        this.emit('broker-failover', {
          failed: plugin.type,
          label: plugin.label,
          error: error.message,
          next: ordered.find(p => p.type !== plugin.type)?.type,
        });
        continue;
      }
    }

    throw new Error(
      `All brokers unavailable. Last error: ${lastError?.message || 'Unknown'}`,
    );
  }

  // ── Connection Management ────────────────────────────────────────────

  /**
   * Store a broker connection for a user.
   */
  setUserConnection(userId: string, brokerType: string, instance: IBroker | null): void {
    if (instance) {
      this.instances.set(userId, instance);
      this.connectionTypes.set(userId, brokerType);
    } else {
      this.instances.delete(userId);
      this.connectionTypes.delete(userId);
    }
  }

  /**
   * Get the broker instance for a user.
   */
  getUserBroker(userId: string): IBroker | undefined {
    return this.instances.get(userId) ?? undefined;
  }

  /**
   * Get the broker type connected for a user.
   */
  getUserBrokerType(userId: string): string | undefined {
    return this.connectionTypes.get(userId);
  }

  /**
   * Reset all connections (e.g. on logout).
   */
  resetConnections(): void {
    this.instances.clear();
    this.connectionTypes.clear();
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private toMeta(plugin: BrokerPlugin): BrokerPluginMeta {
    return {
      type: plugin.type,
      label: plugin.label,
      tagline: plugin.tagline || '',
      region: plugin.region,
      regions: plugin.regions,
      capabilities: plugin.capabilities,
      authModes: plugin.authModes,
      hasAPI: plugin.hasAPI,
      hasOAuth: plugin.authModes.includes('oauth'),
      hasZeroApi: plugin.authModes.includes('zero_api'),
      icon: plugin.icon,
      color: plugin.color,
      gradient: plugin.gradient,
      features: plugin.features,
      credentialFields: plugin.credentialFields,
    };
  }

  private getDefaultConfig(plugin: BrokerPlugin): Partial<BrokerConfig> {
    return plugin.defaultConfig || { apiKey: '' };
  }
}

// ──── Singleton ───────────────────────────────────────────────────────────

/**
 * Global singleton instance of the BrokerRegistry.
 * Import this anywhere to register or query brokers.
 */
export const registry = new BrokerRegistry();
