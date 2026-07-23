/**
 * ============================================================================
 * Toroloom — Dashboard Widget Types
 * ============================================================================
 *
 * Types for the draggable widget system on the Portfolio Analytics Dashboard.
 * Each widget type corresponds to a visual analytics card that can be added,
 * removed, resized, and reordered on the dashboard.
 *
 * ============================================================================
 */

/** Available widget types in the analytics dashboard */
export type WidgetType =
  | 'pnl'
  | 'holdings'
  | 'risk_metrics'
  | 'sector_allocation'
  | 'recent_trades'
  | 'market_overview'
  | 'performance_chart';

/** Size variant for each widget — controls card dimensions */
export type WidgetSize = 'small' | 'medium' | 'large';

/** A single widget instance on the dashboard */
export interface DashboardWidget {
  /** Unique widget instance ID */
  id: string;
  /** Widget type identifier */
  type: WidgetType;
  /** Display title shown in the widget header */
  title: string;
  /** Display order in the grid (lower = first) */
  order: number;
  /** Card size */
  size: WidgetSize;
  /** Whether the widget is visible on the dashboard */
  visible: boolean;
  /** Optional per-widget configuration */
  config?: Record<string, any>;
}

/** Metadata about a widget type — used in the gallery and registry */
export interface WidgetMeta {
  /** Widget type identifier */
  type: WidgetType;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Icon name (Ionicons) */
  icon: string;
  /** Theme color for the widget card */
  color: string;
  /** Available sizes for this widget */
  sizes: WidgetSize[];
  /** Default size when first added */
  defaultSize: WidgetSize;
  /** Minimum subscription tier required */
  minTier: 'free' | 'pro' | 'elite';
  /** Category for gallery grouping */
  category: 'performance' | 'holdings' | 'risk' | 'market';
  /** Whether this is a pro-only widget */
  isPro: boolean;
}

/** Full widget layout configuration */
export interface WidgetLayout {
  /** Widget instances */
  widgets: DashboardWidget[];
  /** Layout version for migration */
  version: number;
}

/** Grid column span for each widget size */
export const WIDGET_SIZE_SPANS: Record<WidgetSize, { cols: number; rows: number }> = {
  small: { cols: 1, rows: 1 },
  medium: { cols: 2, rows: 1 },
  large: { cols: 2, rows: 2 },
};
