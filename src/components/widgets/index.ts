/**
 * Toroloom — Widget Components Barrel Export
 */

export { default as BaseWidget } from './BaseWidget';
export { default as PnLWidget } from './PnLWidget';
export { default as HoldingsWidget } from './HoldingsWidget';
export { default as RiskMetricsWidget } from './RiskMetricsWidget';
export { default as SectorAllocationWidget } from './SectorAllocationWidget';
export { default as RecentTradesWidget } from './RecentTradesWidget';
export { default as MarketOverviewWidget } from './MarketOverviewWidget';
export { default as PerformanceChartWidget } from './PerformanceChartWidget';
export { default as WidgetGrid } from './WidgetGrid';

export { WIDGET_REGISTRY, getWidgetMeta, getWidgetsByCategory } from './WidgetRegistry';

export type {
  WidgetType,
  WidgetSize,
  DashboardWidget,
  WidgetMeta,
  WidgetLayout,
} from '../../types/widgets';
