/**
 * ============================================================================
 * Toroloom — Widget Registry Tests
 * ============================================================================
 *
 * Pure unit tests (no rendering) for the widget type registry:
 *   • WIDGET_REGISTRY covers every WidgetType exhaustively
 *   • Each entry satisfies the meta shape contract (name, icon, color,
 *     sizes, defaultSize ∈ sizes, minTier, category, isPro)
 *   • getWidgetMeta returns the correct entry
 *   • getWidgetsByCategory groups every widget exactly once (covering the
 *     first-widget-in-category guard branch)
 *   • Tier gating contract (free vs pro/elite widgets)
 *
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import { WIDGET_REGISTRY, getWidgetMeta, getWidgetsByCategory } from '../components/widgets/WidgetRegistry';
import type { WidgetType } from '../types/widgets';

// Mirrors the WidgetType union in src/types/widgets.ts — if a new widget type
// is added there without a registry entry, this test breaks.
const ALL_TYPES: WidgetType[] = [
  'pnl',
  'holdings',
  'risk_metrics',
  'sector_allocation',
  'recent_trades',
  'market_overview',
  'performance_chart',
];

const ALL_SIZES = ['small', 'medium', 'large'] as const;

describe('WIDGET_REGISTRY', () => {
  it('registers every widget type exhaustively', () => {
    expect(Object.keys(WIDGET_REGISTRY).sort()).toEqual([...ALL_TYPES].sort());
  });

  it('has a unique type-per-entry and valid name/icon/color for each', () => {
    for (const [type, meta] of Object.entries(WIDGET_REGISTRY)) {
      expect(meta.type).toBe(type);
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.icon.length).toBeGreaterThan(0);
      expect(meta.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('keeps defaultSize inside the sizes array for every widget', () => {
    for (const meta of Object.values(WIDGET_REGISTRY)) {
      expect(meta.sizes.length).toBeGreaterThan(0);
      expect(meta.sizes).toContain(meta.defaultSize);
      expect(ALL_SIZES).toContain(meta.defaultSize);
    }
  });

  it('assigns every widget a valid category and minTier', () => {
    const validCategories = ['performance', 'holdings', 'risk', 'market'];
    const validTiers = ['free', 'pro', 'elite'];
    for (const meta of Object.values(WIDGET_REGISTRY)) {
      expect(validCategories).toContain(meta.category);
      expect(validTiers).toContain(meta.minTier);
      expect(typeof meta.isPro).toBe('boolean');
    }
  });

  it('flags tier-gated widgets as pro and free widgets as free', () => {
    // free tier: isPro false
    for (const type of ['pnl', 'holdings', 'recent_trades', 'performance_chart'] as const) {
      expect(WIDGET_REGISTRY[type].isPro).toBe(false);
      expect(WIDGET_REGISTRY[type].minTier).toBe('free');
    }
    // gated: risk_metrics (pro), sector_allocation (pro), market_overview (elite)
    expect(WIDGET_REGISTRY.risk_metrics.isPro).toBe(true);
    expect(WIDGET_REGISTRY.sector_allocation.isPro).toBe(true);
    expect(WIDGET_REGISTRY.market_overview.isPro).toBe(true);
    expect(WIDGET_REGISTRY.market_overview.minTier).toBe('elite');
  });
});

describe('getWidgetMeta', () => {
  it('returns the registry entry for a known type', () => {
    expect(getWidgetMeta('pnl')).toBe(WIDGET_REGISTRY.pnl);
    expect(getWidgetMeta('holdings').name).toBe('Holdings Breakdown');
    expect(getWidgetMeta('performance_chart').icon).toBe('pulse');
  });
});

describe('getWidgetsByCategory', () => {
  it('groups every widget exactly once', () => {
    const grouped = getWidgetsByCategory();
    const all = Object.values(grouped).flat();
    expect(all).toHaveLength(ALL_TYPES.length);
    expect(new Set(all.map((m) => m.type)).size).toBe(ALL_TYPES.length);
  });

  it('splits into the expected category buckets', () => {
    const grouped = getWidgetsByCategory();
    expect(Object.keys(grouped).sort()).toEqual(['holdings', 'market', 'performance', 'risk']);
    expect(grouped.performance.map((m) => m.type).sort()).toEqual(['performance_chart', 'pnl', 'recent_trades']);
    expect(grouped.holdings.map((m) => m.type).sort()).toEqual(['holdings', 'sector_allocation']);
    expect(grouped.risk.map((m) => m.type)).toEqual(['risk_metrics']);
    expect(grouped.market.map((m) => m.type)).toEqual(['market_overview']);
  });
});
