/**
 * ============================================================================
 * Toroloom — Widget Registry
 * ============================================================================
 *
 * Central registry of all available widget types with their metadata.
 * Used by the Widget Gallery screen and the dashboard to render widgets.
 *
 * ============================================================================
 */

import type { WidgetMeta, WidgetType } from '../../types/widgets';

export const WIDGET_REGISTRY: Record<WidgetType, WidgetMeta> = {
  pnl: {
    type: 'pnl',
    name: 'P&L Overview',
    description: 'Real-time profit & loss with mini sparkline chart',
    icon: 'trending-up',
    color: '#00E676',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
    minTier: 'free',
    category: 'performance',
    isPro: false,
  },
  holdings: {
    type: 'holdings',
    name: 'Holdings Breakdown',
    description: 'Portfolio holdings with value allocation and P&L',
    icon: 'pie-chart',
    color: '#3B82F6',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
    minTier: 'free',
    category: 'holdings',
    isPro: false,
  },
  risk_metrics: {
    type: 'risk_metrics',
    name: 'Risk Metrics',
    description: 'Sharpe ratio, Sortino, max drawdown & volatility',
    icon: 'shield',
    color: '#8B5CF6',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
    minTier: 'pro',
    category: 'risk',
    isPro: true,
  },
  sector_allocation: {
    type: 'sector_allocation',
    name: 'Sector Allocation',
    description: 'Sector-wise portfolio allocation donut chart',
    icon: 'business',
    color: '#FFC107',
    sizes: ['medium', 'large'],
    defaultSize: 'medium',
    minTier: 'pro',
    category: 'holdings',
    isPro: true,
  },
  recent_trades: {
    type: 'recent_trades',
    name: 'Recent Trades',
    description: 'Latest buy/sell trades with P&L',
    icon: 'swap-horizontal',
    color: '#06B6D4',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
    minTier: 'free',
    category: 'performance',
    isPro: false,
  },
  market_overview: {
    type: 'market_overview',
    name: 'Market Overview',
    description: 'Nifty, Sensex & key market indices snapshot',
    icon: 'stats-chart',
    color: '#F97316',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
    minTier: 'elite',
    category: 'market',
    isPro: true,
  },
  performance_chart: {
    type: 'performance_chart',
    name: 'Performance Chart',
    description: 'Portfolio value over time with interactive area chart',
    icon: 'pulse',
    color: '#00BCD4',
    sizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
    minTier: 'free',
    category: 'performance',
    isPro: false,
  },
};

/** Get all widget types sorted by category then name */
export function getWidgetsByCategory(): Record<string, WidgetMeta[]> {
  const grouped: Record<string, WidgetMeta[]> = {};
  for (const meta of Object.values(WIDGET_REGISTRY)) {
    if (!grouped[meta.category]) grouped[meta.category] = [];
    grouped[meta.category].push(meta);
  }
  return grouped;
}

/** Get a single widget meta by type */
export function getWidgetMeta(type: WidgetType): WidgetMeta {
  return WIDGET_REGISTRY[type];
}
