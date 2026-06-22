/**
 * ============================================================================
 * Interactive Brokers — BrokerPlugin Registration
 * ============================================================================
 *
 * Register IBKR with the dynamic BrokerRegistry.
 * The plugin provides metadata, factory, credential fields, and default config.
 *
 * Usage:
 *   import { ibkrPlugin } from './ibkrPlugin';
 *   registry.register(ibkrPlugin);
 *
 * ============================================================================
 */

import { registry } from '../registry';
import type { BrokerPlugin } from '../plugin';
import { IbkrBroker } from '../ibkrBroker';

export const ibkrPlugin: BrokerPlugin = {
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
  priority: 10, // Tried first after explicit user preference
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
    apiKey: 'ibkr', // Required by BrokerConfig interface
  },
};

/**
 * Register the IBKR plugin with the global registry.
 * Call this during server startup alongside registerDefaultPlugins().
 */
export function registerIbkrPlugin(): void {
  // Only register if IBKR_GATEWAY_URL is configured or explicitly requested
  if (process.env.IBKR_GATEWAY_URL || process.env.IBKR_ENABLED === 'true') {
    registry.register(ibkrPlugin);
    console.log('[IBKR Plugin] Registered Interactive Brokers plugin');
  } else {
    console.log('[IBKR Plugin] Skipped (set IBKR_GATEWAY_URL or IBKR_ENABLED=true to enable)');
  }
}
