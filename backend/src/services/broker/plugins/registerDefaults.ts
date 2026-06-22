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
  credentialFields: [
    { key: 'apiKey', label: 'API Key', type: 'text', required: true, placeholder: 'Enter your Kite API key', authModes: ['credentials'] },
    { key: 'apiSecret', label: 'API Secret', type: 'password', required: true, placeholder: 'Enter your API secret', authModes: ['credentials'] },
    { key: 'requestToken', label: 'Request Token', type: 'secret', required: false, placeholder: 'From OAuth redirect URL', authModes: ['oauth'] },
    { key: 'accessToken', label: 'Access Token', type: 'secret', required: false, placeholder: 'Existing access token', authModes: ['credentials'] },
  ],
  factory: () => new ZerodhaBroker(),
  initialize: async (config) => {
    const broker = new ZerodhaBroker();
    return broker.authenticate(config);
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
  credentialFields: [
    { key: 'apiKey', label: 'API Key', type: 'text', required: true, placeholder: 'Enter your SmartAPI key' },
    { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Enter your Angel One Client ID' },
    { key: 'password', label: 'Password', type: 'password', required: false, placeholder: 'Trading password' },
    { key: 'totp', label: 'TOTP Secret', type: 'totp', required: false, placeholder: 'Base32 TOTP secret' },
    { key: 'accessToken', label: 'Access Token', type: 'secret', required: false, placeholder: 'Existing JWT token' },
  ],
  factory: () => new AngelBroker(),
  initialize: async (config) => {
    const broker = new AngelBroker();
    return broker.authenticate(config);
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
  credentialFields: [
    { key: 'apiKey', label: 'API Key', type: 'text', required: true, placeholder: 'Enter your Groww API key' },
    { key: 'accessToken', label: 'Access Token', type: 'password', required: true, placeholder: 'Enter your access token' },
  ],
  factory: () => new GrowwBroker(),
  initialize: async (config) => {
    const broker = new GrowwBroker();
    return broker.authenticate(config);
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
 * Call after env.ts is initialized but before creating any broker.
 */
export function updatePluginEnvConfig(env: any): void {
  const zerodha = registry.getPlugin('zerodha');
  if (zerodha) {
    zerodha.defaultConfig = {
      apiKey: env.zerodha?.apiKey || '',
      apiSecret: env.zerodha?.apiSecret || '',
      accessToken: env.zerodha?.accessToken || '',
      requestToken: env.zerodha?.requestToken || '',
    } as any;
  }

  const angel = registry.getPlugin('angel');
  if (angel) {
    angel.defaultConfig = {
      apiKey: env.angel?.apiKey || '',
      clientId: env.angel?.clientId || '',
      accessToken: env.angel?.accessToken || '',
      password: env.angel?.password || '',
      totp: env.angel?.totp || '',
    } as any;
  }

  const groww = registry.getPlugin('groww');
  if (groww) {
    groww.defaultConfig = {
      apiKey: env.groww?.apiKey || '',
      accessToken: env.groww?.accessToken || '',
    } as any;
  }
}
