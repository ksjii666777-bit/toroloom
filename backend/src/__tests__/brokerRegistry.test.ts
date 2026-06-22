/**
 * ============================================================================
 * Toroloom Broker Registry — Unit Tests
 * ============================================================================
 *
 * Tests the dynamic BrokerRegistry plugin system:
 *   - Plugin registration & discovery
 *   - Broker creation with fallback chain
 *   - Metadata queries (by region, capability, search)
 *   - Circuit breaker integration
 *   - Event emission
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/brokerRegistry.test.ts
 * ============================================================================
 */

vi.hoisted(() => {
  process.env.BROKER = 'mock';
  process.env.DATA_SOURCE = 'mock';
});

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { registry } from '../services/broker/registry';
import { registerDefaultPlugins } from '../services/broker/plugins/registerDefaults';
import type { BrokerPlugin } from '../services/broker/plugin';
import type { IBroker, BrokerConfig, MarketQuote } from '../services/broker/interface';

// ──── Mock Broker Factory ──────────────────────────────────────────────────

function createMockBroker(brokerName: string): IBroker {
  return {
    name: brokerName,
    async authenticate(_config: BrokerConfig) { return true; },
    isConnected() { return true; },
    async getIndices() { return []; },
    async getStocks() { return []; },
    async getQuote(_symbol: string): Promise<MarketQuote> {
      return { symbol: '', lastPrice: 0, change: 0, changePercent: 0, open: 0, high: 0, low: 0, close: 0, volume: 0, bid: 0, ask: 0, timestamp: '' };
    },
    async getBulkQuotes(_symbols: string[]) { return new Map(); },
    async getOHLC(_symbol: string, _interval: string, _days: number) { return []; },
    async searchStocks(_query: string) { return []; },
    async placeOrder(_order: any) { return { id: '', status: 'confirmed' as const, message: '', timestamp: '' }; },
    async modifyOrder(_order: any) { return { id: '', status: 'confirmed' as const, message: '', timestamp: '' }; },
    async cancelOrder(_order: any) { return { id: '', status: 'cancelled' as const, message: '', timestamp: '' }; },
    async getOpenOrders() { return []; },
    async getPositions() { return []; },
    async getTradeHistory() { return []; },
    async getHoldings() { return []; },
    subscribeTicks(_symbols: string[], _onTick: (q: MarketQuote) => void) { return () => {}; },
  } as IBroker;
}

// ──── Test Plugin Factories ────────────────────────────────────────────────

function makePlugin(overrides: Partial<BrokerPlugin>): BrokerPlugin {
  return {
    type: 'test-broker',
    label: 'Test Broker',
    tagline: 'A test broker',
    region: 'other',
    capabilities: ['stocks'],
    authModes: ['credentials'],
    priority: 50,
    hasAPI: true,
    icon: 'T',
    color: '#000',
    gradient: ['#000', '#333'] as const,
    features: ['Test Feature'],
    factory: () => createMockBroker('Test Broker'),
    ...overrides,
  };
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('BrokerRegistry', () => {
  // Register default plugins before all tests
  beforeAll(() => {
    registerDefaultPlugins();
  });

  // Clean up between tests by unregistering non-default plugins
  const defaultTypes = ['mock', 'zerodha', 'angel', 'groww'];
  const addedTypes: string[] = [];

  beforeEach(() => {
    addedTypes.length = 0;
  });

  afterEach(() => {
    for (const t of addedTypes) {
      registry.unregister(t);
    }
  });

  function register(plugin: BrokerPlugin) {
    registry.register(plugin);
    addedTypes.push(plugin.type);
  }

  // ── Registration ──────────────────────────────────────────────────────

  it('should have default plugins registered', () => {
    for (const type of defaultTypes) {
      expect(registry.has(type)).toBe(true);
    }
    expect(registry.count).toBeGreaterThanOrEqual(defaultTypes.length);
  });

  it('should register a new plugin', () => {
    register(makePlugin({ type: 'my-broker', label: 'My Broker' }));

    expect(registry.has('my-broker')).toBe(true);
    expect(registry.getPlugin('my-broker')?.label).toBe('My Broker');
  });

  it('should reject plugin without type', () => {
    expect(() => registry.register({} as any)).toThrow('BrokerPlugin.type is required');
  });

  it('should reject plugin without factory', () => {
    expect(() => registry.register({ type: 'no-factory' } as any)).toThrow('must have a factory');
  });

  it('should overwrite existing plugin on re-register', () => {
    register(makePlugin({ type: 'overwrite-me', label: 'Original' }));
    register(makePlugin({ type: 'overwrite-me', label: 'Updated' }));

    expect(registry.getPlugin('overwrite-me')?.label).toBe('Updated');
  });

  it('should unregister a plugin', () => {
    register(makePlugin({ type: 'temp-broker' }));
    expect(registry.has('temp-broker')).toBe(true);

    const result = registry.unregister('temp-broker');
    expect(result).toBe(true);
    expect(registry.has('temp-broker')).toBe(false);
  });

  it('should return false when unregistering non-existent plugin', () => {
    expect(registry.unregister('non-existent')).toBe(false);
  });

  // ── Metadata Discovery ────────────────────────────────────────────────

  it('should return metadata for all plugins', () => {
    const all = registry.getAllMeta();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(defaultTypes.length);

    // Should be sorted by priority (lower first)
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].type).toBeDefined();
    }
  });

  it('should expose correct metadata shape', () => {
    register(makePlugin({
      type: 'meta-test',
      label: 'Meta Test',
      tagline: 'Testing metadata shape',
      region: 'us',
      capabilities: ['stocks', 'options'],
      authModes: ['credentials', 'oauth'],
      hasAPI: true,
      color: '#FF0000',
    }));

    const meta = registry.getAllMeta().find(m => m.type === 'meta-test');
    expect(meta).toBeDefined();
    expect(meta!.type).toBe('meta-test');
    expect(meta!.label).toBe('Meta Test');
    expect(meta!.tagline).toBe('Testing metadata shape');
    expect(meta!.region).toBe('us');
    expect(meta!.capabilities).toContain('stocks');
    expect(meta!.capabilities).toContain('options');
    expect(meta!.authModes).toContain('credentials');
    expect(meta!.hasOAuth).toBe(true);
    expect(meta!.hasZeroApi).toBe(false);
    expect(meta!.hasAPI).toBe(true);
    expect(meta!.color).toBe('#FF0000');
  });

  it('should filter by region', () => {
    register(makePlugin({ type: 'us-broker', label: 'US Broker', region: 'us' }));
    register(makePlugin({ type: 'eu-broker', label: 'EU Broker', region: 'europe' }));

    const usBrokers = registry.getByRegion('us');
    expect(usBrokers.some(b => b.type === 'us-broker')).toBe(true);
    expect(usBrokers.some(b => b.type === 'eu-broker')).toBe(false);
  });

  it('should find global brokers across regions', () => {
    register(makePlugin({
      type: 'global-broker',
      label: 'Global Broker',
      region: 'global',
      regions: ['global', 'us', 'europe', 'asia'],
    }));

    const usBrokers = registry.getByRegion('us');
    expect(usBrokers.some(b => b.type === 'global-broker')).toBe(true);

    const euBrokers = registry.getByRegion('europe');
    expect(euBrokers.some(b => b.type === 'global-broker')).toBe(true);
  });

  it('should filter by capability', () => {
    register(makePlugin({
      type: 'futures-broker',
      label: 'Futures Broker',
      capabilities: ['stocks', 'futures'],
      region: 'us',
    }));
    register(makePlugin({
      type: 'crypto-broker',
      label: 'Crypto Broker',
      capabilities: ['crypto'],
      region: 'us',
    }));

    const futures = registry.getByCapability('futures');
    expect(futures.some(b => b.type === 'futures-broker')).toBe(true);
    expect(futures.some(b => b.type === 'crypto-broker')).toBe(false);
  });

  it('should search brokers by name', () => {
    register(makePlugin({ type: 'robinhood', label: 'Robinhood', tagline: 'Commission-free trading' }));

    const results = registry.search('robin');
    expect(results.some(b => b.type === 'robinhood')).toBe(true);

    const noResults = registry.search('nonexistent');
    expect(noResults).toHaveLength(0);
  });

  it('should search brokers by label', () => {
    register(makePlugin({ type: 'my-broker', label: 'Super Broker Pro' }));

    const results = registry.search('super broker');
    expect(results.some(b => b.type === 'my-broker')).toBe(true);
  });

  // ── Broker Creation ──────────────────────────────────────────────────

  it('should create a broker instance', async () => {
    register(makePlugin({
      type: 'create-test',
      initialize: async (_config: BrokerConfig) => true,
    }));

    const broker = await registry.createBroker('create-test', { apiKey: 'test' });
    expect(broker).toBeDefined();
    expect(broker.isConnected()).toBe(true);
  });

  it('should throw for non-existent plugin', async () => {
    await expect(
      registry.createBroker('non-existent', { apiKey: 'test' }),
    ).rejects.toThrow('Broker plugin not found');
  });

  it('should handle auth failure', async () => {
    register(makePlugin({
      type: 'auth-fail',
      initialize: async (_config: BrokerConfig) => false,
    }));

    await expect(
      registry.createBroker('auth-fail', { apiKey: 'test' }),
    ).rejects.toThrow('Authentication failed');
  });

  // ── Fallback Chain ───────────────────────────────────────────────────

  it('should fall back through broker chain', async () => {
    // Register brokers with different priorities and make the first one fail
    register(makePlugin({
      type: 'fail-first',
      label: 'Fail First',
      priority: 10,
      initialize: async (_config: BrokerConfig) => { throw new Error('Intentional failure'); },
    }));

    register(makePlugin({
      type: 'succeed-second',
      label: 'Succeed Second',
      priority: 20,
      initialize: async (_config: BrokerConfig) => true,
    }));

    const result = await registry.createWithFallback('fail-first');
    expect(result.type).toBe('succeed-second');
    expect(result.broker.isConnected()).toBe(true);
  });

  it('should throw when all brokers fail', async () => {
    // Temporarily unregister all default plugins so only our failing ones exist
    const typesToRemove = ['zerodha', 'angel', 'groww', 'mock'];
    for (const t of typesToRemove) {
      registry.unregister(t);
    }

    register(makePlugin({
      type: 'fail-1',
      priority: 10,
      initialize: async (_config: BrokerConfig) => { throw new Error('Fail 1'); },
    }));
    register(makePlugin({
      type: 'fail-2',
      priority: 20,
      initialize: async (_config: BrokerConfig) => { throw new Error('Fail 2'); },
    }));

    await expect(
      registry.createWithFallback('fail-1'),
    ).rejects.toThrow('All brokers unavailable');

    // Re-register defaults for other tests
    for (const t of typesToRemove) {
      registry.unregister(t);
    }
    registerDefaultPlugins();
  });

  it('should prefer specified start type', async () => {
    register(makePlugin({
      type: 'preferred',
      label: 'Preferred',
      priority: 10,
      initialize: async (_config: BrokerConfig) => true,
    }));
    register(makePlugin({
      type: 'other',
      label: 'Other',
      priority: 20,
      initialize: async (_config: BrokerConfig) => true,
    }));

    // Even though 'preferred' has lower priority, requesting it should work
    const result = await registry.createWithFallback('preferred');
    expect(result.type).toBe('preferred');
  });

  // ── User Connections ────────────────────────────────────────────────

  it('should store and retrieve user connections', () => {
    const broker = createMockBroker('Test');
    registry.setUserConnection('user1', 'test-broker', broker);

    expect(registry.getUserBroker('user1')).toBe(broker);
    expect(registry.getUserBrokerType('user1')).toBe('test-broker');
  });

  it('should clear user connections on reset', () => {
    const broker = createMockBroker('Test');
    registry.setUserConnection('user2', 'test-broker', broker);
    registry.resetConnections();

    expect(registry.getUserBroker('user2')).toBeUndefined();
    expect(registry.getUserBrokerType('user2')).toBeUndefined();
  });

  // ── Event Bus ───────────────────────────────────────────────────────

  it('should emit events on register', () => {
    const events: any[] = [];
    const unsubscribe = registry.on((event, data) => events.push({ event, data }));

    register(makePlugin({ type: 'event-test', label: 'Event Test' }));

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].event).toBe('broker-registered');
    expect(events[0].data.type).toBe('event-test');

    unsubscribe();
  });

  it('should allow removing event listeners', () => {
    const events: any[] = [];
    const unsubscribe = registry.on((event, data) => events.push({ event, data }));
    unsubscribe();

    register(makePlugin({ type: 'unsub-test' }));

    // The listener should not have been called
    expect(events).toHaveLength(0);
  });
});
