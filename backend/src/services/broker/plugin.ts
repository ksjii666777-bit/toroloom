/**
 * ============================================================================
 * Toroloom Broker Plugin System — Type Definitions
 * ============================================================================
 *
 * Defines the contract for third-party broker plugins. Anyone can add a new
 * broker by implementing this interface and registering it with the registry.
 *
 * There are two plugin paths:
 *   1. API-Based (hasAPI: true)  → implements IBroker directly (e.g. Zerodha, IBKR)
 *   2. Zero-API  (hasAPI: false) → uses WebView session extraction + proxy client
 *
 * ============================================================================
 */

import type { IBroker, BrokerConfig } from './interface';

// ──── Region & Capability Types ───────────────────────────────────────────

export type BrokerRegion =
  | 'global'      // Multi-region / worldwide (e.g. Interactive Brokers)
  | 'asia'
  | 'india'
  | 'us'
  | 'europe'
  | 'uk'
  | 'canada'
  | 'australia'
  | 'singapore'
  | 'japan'
  | 'brazil'
  | 'uae'
  | 'other';

export type BrokerCapability =
  | 'stocks'
  | 'options'
  | 'futures'
  | 'forex'
  | 'mutual_funds'
  | 'etfs'
  | 'bonds'
  | 'crypto'
  | 'ipo'
  | 'margin'
  | 'short_selling'
  | 'fractional_shares'
  | 'realtime_data'
  | 'historical_data'
  | 'edis'          // Electronic De-mat Insurance (India specific)
  | 'brokerage_calc';

// ──── Credential Field Schema ─────────────────────────────────────────────

/**
 * Describes a single credential field required by this broker.
 * Used by the frontend to dynamically render credential forms.
 */
export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'secret' | 'totp';
  required: boolean;
  placeholder?: string;
  /** Regular expression for client-side validation */
  pattern?: string;
  /** Error message shown when validation fails */
  validationError?: string;
  /** Which auth modes this field applies to (default: all) */
  authModes?: ('credentials' | 'oauth')[];
}

// ──── Auth Mode ───────────────────────────────────────────────────────────

export type AuthMode = 'credentials' | 'oauth' | 'zero_api';

// ──── Broker Plugin Interface ─────────────────────────────────────────────

/**
 * A broker plugin descriptor. Every broker in the system implements this.
 * The plugin provides:
 *   - Identity: type, label, region
 *   - Metadata: capabilities, auth modes
 *   - Factory: how to create an IBroker instance
 *   - Config schema: what credentials the user needs to provide
 */
export interface BrokerPlugin {
  /** Unique machine-readable identifier (e.g. 'zerodha', 'interactive-brokers') */
  type: string;

  /** Human-readable display name (e.g. 'Zerodha', 'Interactive Brokers') */
  label: string;

  /** Short tagline shown on broker cards */
  tagline: string;

  /** Primary region this broker serves */
  region: BrokerRegion;

  /** All regions this broker can trade in (for global brokers) */
  regions?: BrokerRegion[];

  /** What the broker can do */
  capabilities: BrokerCapability[];

  /** Supported authentication modes */
  authModes: AuthMode[];

  /**
   * Priority in the fallback chain. Lower = tried first.
   * - 0 = explicit user selection (not auto-fallback)
   * - 10 = global broker (Interactive Brokers)
   * - 20 = regional primary (Zerodha for India)
   * - 30 = regional secondary
   * - 40 = regional tertiary
   * - 999 = mock/dev
   */
  priority: number;

  /** Whether this broker has an official API (true) or needs Zero-API gateway (false) */
  hasAPI: boolean;

  /** URL for OAuth flow (if authModes includes 'oauth') */
  oauthUrl?: string | ((config: Record<string, string>) => string);

  /** URLs for Zero-API WebView session extraction */
  zeroApiUrls?: {
    login: string;
    dashboardPatterns: string[];
    mfaPatterns?: string[];
  };

  /** Credential fields the user must provide (for 'credentials' mode) */
  credentialFields?: CredentialField[];

  /** Default config values (e.g. from env) used for auto-connect */
  defaultConfig?: Partial<BrokerConfig>;

  /** Icon identifier (emoji or icon set key) */
  icon?: string;

  /** Theme color (hex) */
  color?: string;

  /** Gradient colors (two hex values) */
  gradient?: readonly [string, string];

  /** Feature highlights shown on the broker card */
  features?: string[];

  /** Factory function: creates a broker instance (not yet authenticated) */
  factory: (config: BrokerConfig) => IBroker;

  /**
   * Optional async initializer that authenticates the broker instance
   * created by factory(). Receives both the instance and config so it
   * can authenticate the same object that will be returned to callers.
   */
  initialize?: (instance: IBroker, config: BrokerConfig) => Promise<boolean>;
}

// ──── Registration Metadata (what the registry exposes) ───────────────────

/**
 * Public metadata about a registered broker plugin.
 * This is what gets returned to the frontend via API.
 * It excludes the factory and sensitive internal details.
 */
export interface BrokerPluginMeta {
  type: string;
  label: string;
  tagline: string;
  region: BrokerRegion;
  regions?: BrokerRegion[];
  capabilities: BrokerCapability[];
  authModes: AuthMode[];
  hasAPI: boolean;
  hasOAuth: boolean;
  hasZeroApi: boolean;
  icon?: string;
  color?: string;
  gradient?: readonly [string, string];
  features?: string[];
  credentialFields?: CredentialField[];
}
