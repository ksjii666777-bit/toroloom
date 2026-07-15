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
import { IbkrBroker } from '../ibkrBroker';

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
// ──── Interactive Brokers (Global Trading) ────────────────────────────────

const ibkrPlugin: BrokerPlugin = {
  type: 'interactive-brokers',
  label: 'Interactive Brokers',
  tagline: 'Trade global markets — stocks, options, futures, forex & more',
  region: 'global',
  regions: ['global', 'us', 'europe', 'uk', 'canada', 'australia', 'singapore', 'japan', 'brazil', 'uae', 'india', 'asia'],
  capabilities: [
    'stocks', 'options', 'futures', 'forex', 'etfs', 'bonds',
    'margin', 'short_selling', 'realtime_data', 'historical_data',
  ],
  authModes: ['credentials'],
  priority: 10,
  hasAPI: true,
  icon: 'I',
  color: '#FF6B35',
  gradient: ['#FF6B35', '#E55D2B'] as const,
  features: [
    'Global Markets (100+ Countries)',
    'Stocks, Options, Futures, Forex',
    'Client Portal REST API',
    'Live Market Data',
  ],
  credentialFields: [
    {
      key: 'gatewayUrl',
      label: 'Gateway URL',
      type: 'text',
      required: false,
      placeholder: 'http://localhost:5000',
      validationError: 'Must be a valid URL',
    },
    {
      key: 'accountId',
      label: 'Account ID (optional)',
      type: 'text',
      required: false,
      placeholder: 'Auto-detected if empty',
    },
  ],
  factory: () => new IbkrBroker(),
  initialize: async (instance, config) => {
    return instance.authenticate(config);
  },
  defaultConfig: {
    gatewayUrl: process.env.IBKR_GATEWAY_URL || 'http://localhost:5000',
    accountId: process.env.IBKR_ACCOUNT_ID || '',
    apiKey: 'ibkr',
  },
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
  registry.register(ibkrPlugin);
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
