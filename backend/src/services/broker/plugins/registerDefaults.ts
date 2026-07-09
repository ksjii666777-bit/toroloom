/**
 * ============================================================================
 * Toroloom — Default Broker Plugin Registrations
 * ============================================================================
 *
 * Registers all built-in broker plugins with the global BrokerRegistry.
 * Call `registerDefaultPlugins()` once during server startup.
 *
 * To add a new broker:
 *   import { registry } from '../registry';
 *   import { myBrokerPlugin } from './myBroker';
 *   registry.register(myBrokerPlugin);
 *
 * ============================================================================
 */

import { registry } from '../registry';
import type { BrokerPlugin } from '../plugin';
import type { BrokerConfig } from '../interface';
import { MockBroker } from '../mockBroker';
import { ZerodhaBroker } from '../zerodhaBroker';
import { AngelBroker } from '../angelBroker';
import { GrowwBroker } from '../growwBroker';

// ──── Mock Broker ─────────────────────────────────────────────────────────

const mockPlugin: BrokerPlugin = {
  type: 'mock',
  label: 'Mock Broker',
  tagline: 'Development & testing mode',
  region: 'other',
  capabilities: ['stocks', 'etfs', 'realtime_data', 'historical_data', 'edis', 'brokerage_calc'],
  authModes: [],
  priority: 999,
  hasAPI: true,
  icon: '🎯',
  color: '#6B7280',
  gradient: ['#6B7280', '#374151'] as const,
  features: ['Simulated Data', 'No Config Required', 'Test Orders'],
  factory: () => new MockBroker(),
  initialize: async (instance, _config) => {
    return instance.authenticate({ apiKey: 'mock' });
  },
  defaultConfig: { apiKey: 'mock' },
};

// ──── Zerodha Kite Connect ────────────────────────────────────────────────

const zerodhaPlugin: BrokerPlugin = {
  type: 'zerodha',
  label: 'Zerodha',
  tagline: "India's biggest stock broker",
  region: 'india',
  capabilities: ['stocks', 'etfs', 'options', 'futures', 'mutual_funds', 'realtime_data', 'historical_data'],
  authModes: ['credentials', 'oauth'],
  priority: 20,
  hasAPI: true,
  oauthUrl: (config) =>
    `https://kite.trade/connect/login?api_key=${config.apiKey || ''}&v=3`,
  icon: 'Z',
  color: '#2874F0',
  gradient: ['#2874F0', '#1A5FCC'] as const,
  features: ['Kite Connect API', '₹0 Brokerage', 'Trading + Demat'],
  credentialFields: [], // Zero-API Gateway — no credentials needed
  factory: () => new ZerodhaBroker(),
  initialize: async (instance, config) => {
    return instance.authenticate(config);
  },
  defaultConfig: {} as Partial<BrokerConfig>, // Filled from env at startup
};

// ──── Angel One SmartAPI ──────────────────────────────────────────────────

const angelPlugin: BrokerPlugin = {
  type: 'angel',
  label: 'Angel One',
  tagline: "India's largest retail broking house",
  region: 'india',
  capabilities: ['stocks', 'etfs', 'options', 'futures', 'mutual_funds', 'realtime_data', 'historical_data', 'edis', 'brokerage_calc'],
  authModes: ['credentials'],
  priority: 25,
  hasAPI: true,
  icon: 'A',
  color: '#FF6B00',
  gradient: ['#FF6B00', '#CC5500'] as const,
  features: ['SmartAPI', 'Free Equity Delivery', 'EDIS Support'],
  credentialFields: [], // Zero-API Gateway — no credentials needed
  factory: () => new AngelBroker(),
  initialize: async (instance, config) => {
    return instance.authenticate(config);
  },
  defaultConfig: {} as Partial<import('../../broker/interface').BrokerConfig>, // Filled from env at startup
};

// ──── Groww Trade API ─────────────────────────────────────────────────────

const growwPlugin: BrokerPlugin = {
  type: 'groww',
  label: 'Groww',
  tagline: 'Simple, modern investing platform',
  region: 'india',
  capabilities: ['stocks', 'etfs', 'mutual_funds'],
  authModes: ['credentials'],
  priority: 30,
  hasAPI: true,
  icon: 'G',
  color: '#00A86B',
  gradient: ['#00A86B', '#008050'] as const,
  features: ['Trade API', 'Zero Commission', 'Mutual Funds'],
  credentialFields: [], // Zero-API Gateway — no credentials needed
  factory: () => new GrowwBroker(),
  initialize: async (instance, config) => {
    return instance.authenticate(config);
  },
  defaultConfig: {} as Partial<BrokerConfig>, // Filled from env at startup
};

// ──── Register All ────────────────────────────────────────────────────────

/**
 * Register all built-in broker plugins.
 * Call once during server startup.
 */
export function registerDefaultPlugins(): void {
  registry.register(mockPlugin);
  registry.register(zerodhaPlugin);
  registry.register(angelPlugin);
  registry.register(growwPlugin);
}

/**
 * Update plugin default configs from environment variables after env is loaded.
 * DEPRECATED: Broker API credentials have been removed per Zero-API Gateway mandate.
 * All broker connections use WebView session extraction (proxyClient.ts) instead.
 * This function is kept as a no-op to avoid breaking the startup sequence.
 */
export function updatePluginEnvConfig(_env: any): void {
  // Intentionally empty — Zero-API Gateway handles all broker auth via
  // SecureSessionSync WebView extraction. No API keys needed.
}
