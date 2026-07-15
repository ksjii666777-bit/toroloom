/**
 * ============================================================================
 * Toroloom — Feature Flags & A/B Testing Types
 * ============================================================================
 *
 * Lightweight in-app experiment framework for:
 *   - Feature Flags (boolean on/off per flag)
 *   - A/B Tests (multi-variant experiments with weighted assignment)
 *   - Gradual rollouts (percentage-based enablement)
 *   - Dev overrides (override any flag at runtime via settings)
 *
 * Bucketing: User IDs are hashed deterministically so each user always
 * sees the same variant within a session (and across sessions when
 * bucketing is based on userId).
 *
 * ============================================================================
 */

// ═════════════════════════════════════════════════════════════════════════
// Feature Flags
// ═════════════════════════════════════════════════════════════════════════

/** All known feature flags for the app. Add new flags here. */
export type FeatureFlagKey =
  | 'new_home_dashboard'       // Redesigned Home Screen layout
  | 'enhanced_charts'          // Advanced charting with indicators
  | 'social_trading_v2'        // Next-gen social trading features
  | 'ai_recommendations'       // AI-powered stock recommendations
  | 'simplified_onboarding'    // Streamlined onboarding flow
  | 'dark_mode_default'        // Default to dark mode for new users
  | 'quick_trade'              // One-tap quick trade button
  | 'portfolio_insights'       // Advanced portfolio insights panel
  | 'watchlist_analytics'      // Analytics per watchlist
  | 'paper_trading'            // Virtual paper trading mode
  | 'notifications_v2'         // Enhanced notification system
  | 'screener_ai_filters';     // AI-powered screener filters

/** Metadata for a single feature flag */
export interface FeatureFlagMeta {
  key: FeatureFlagKey;
  label: string;
  description: string;
  category: 'ui' | 'trading' | 'social' | 'ai' | 'onboarding' | 'experimental';
  /** Default enabled state (false = opt-in, true = opt-out) */
  defaultValue: boolean;
  /** If set, gradually roll out to this % of users (0-100) */
  rolloutPercent?: number;
  /** Whether this flag requires a backend API to function */
  requiresBackend?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// A/B Experiments
// ═════════════════════════════════════════════════════════════════════════

/** Possible experiment variant identifiers */
export type ExperimentVariant =
  | 'control'
  | 'variant_a'
  | 'variant_b'
  | 'variant_c';

/** Configuration for a single A/B experiment */
export interface ExperimentConfig {
  /** Unique experiment ID (e.g. 'onboarding_flow_v2') */
  id: string;
  /** Human-readable name */
  name: string;
  /** What this experiment is testing */
  description: string;
  /** Available variants */
  variants: ExperimentVariant[];
  /** Distribution weights (must sum to 100). e.g. [50, 25, 25] */
  weights: number[];
  /** Whether the experiment is currently running */
  isActive: boolean;
  /** Optional user segment filter (e.g. only new users) */
  targetSegment?: 'all' | 'new_users' | 'active_traders' | 'premium';
  /** ISO date when experiment started */
  startedAt?: string;
  /** ISO date when experiment ended */
  endedAt?: string;
}

/** Computed state of an experiment for the current user */
export interface ExperimentAssignment {
  config: ExperimentConfig;
  assignedVariant: ExperimentVariant;
  isEnrolled: boolean;
}

/** All known experiments. Add new experiments here. */
export type ExperimentId =
  | 'onboarding_flow_v2'
  | 'home_layout_test'
  | 'trade_btn_placement'
  | 'portfolio_layout';

// ═════════════════════════════════════════════════════════════════════════
// Defaults
// ═════════════════════════════════════════════════════════════════════════

/** Default configuration for all feature flags */
export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagKey, FeatureFlagMeta> = {
  new_home_dashboard: {
    key: 'new_home_dashboard',
    label: 'New Home Dashboard',
    description: 'Redesigned home screen with widget-based layout',
    category: 'ui',
    defaultValue: false,
    rolloutPercent: 25,
  },
  enhanced_charts: {
    key: 'enhanced_charts',
    label: 'Enhanced Charts',
    description: 'Advanced charting with technical indicators',
    category: 'trading',
    defaultValue: true,
  },
  social_trading_v2: {
    key: 'social_trading_v2',
    label: 'Social Trading v2',
    description: 'Next-gen social trading with leaderboard overhaul',
    category: 'social',
    defaultValue: false,
    rolloutPercent: 10,
  },
  ai_recommendations: {
    key: 'ai_recommendations',
    label: 'AI Recommendations',
    description: 'AI-powered stock recommendations on dashboard',
    category: 'ai',
    defaultValue: false,
    rolloutPercent: 50,
  },
  simplified_onboarding: {
    key: 'simplified_onboarding',
    label: 'Simplified Onboarding',
    description: 'Streamlined 3-step onboarding flow',
    category: 'onboarding',
    defaultValue: false,
    rolloutPercent: 30,
  },
  dark_mode_default: {
    key: 'dark_mode_default',
    label: 'Dark Mode Default',
    description: 'Default to dark theme for new users',
    category: 'ui',
    defaultValue: true,
  },
  quick_trade: {
    key: 'quick_trade',
    label: 'Quick Trade',
    description: 'One-tap trade button on stock detail',
    category: 'trading',
    defaultValue: false,
    rolloutPercent: 20,
  },
  portfolio_insights: {
    key: 'portfolio_insights',
    label: 'Portfolio Insights',
    description: 'AI-driven portfolio insights panel',
    category: 'ai',
    defaultValue: true,
  },
  watchlist_analytics: {
    key: 'watchlist_analytics',
    label: 'Watchlist Analytics',
    description: 'Performance analytics per watchlist',
    category: 'trading',
    defaultValue: false,
    rolloutPercent: 15,
  },
  paper_trading: {
    key: 'paper_trading',
    label: 'Paper Trading',
    description: 'Virtual paper trading mode with ₹1L mock balance',
    category: 'experimental',
    defaultValue: false,
  },
  notifications_v2: {
    key: 'notifications_v2',
    label: 'Notifications v2',
    description: 'Enhanced notification system with categories',
    category: 'ui',
    defaultValue: true,
  },
  screener_ai_filters: {
    key: 'screener_ai_filters',
    label: 'AI Screener Filters',
    description: 'AI-powered natural language screener filters',
    category: 'ai',
    defaultValue: false,
    rolloutPercent: 5,
  },
};

/** Default experiments configuration */
export const DEFAULT_EXPERIMENTS: Record<ExperimentId, ExperimentConfig> = {
  onboarding_flow_v2: {
    id: 'onboarding_flow_v2',
    name: 'Onboarding Flow v2',
    description: 'Test new onboarding flow with interactive demo vs short intro',
    variants: ['control', 'variant_a'],
    weights: [50, 50],
    isActive: false,
    targetSegment: 'new_users',
  },
  home_layout_test: {
    id: 'home_layout_test',
    name: 'Home Layout Test',
    description: 'Test widget placement on home screen',
    variants: ['control', 'variant_a', 'variant_b'],
    weights: [50, 25, 25],
    isActive: false,
  },
  trade_btn_placement: {
    id: 'trade_btn_placement',
    name: 'Trade Button Placement',
    description: 'Test trade button position (bottom vs floating)',
    variants: ['control', 'variant_a'],
    weights: [50, 50],
    isActive: false,
  },
  portfolio_layout: {
    id: 'portfolio_layout',
    name: 'Portfolio Layout',
    description: 'Test portfolio screen sections ordering',
    variants: ['control', 'variant_a'],
    weights: [70, 30],
    isActive: false,
  },
};
