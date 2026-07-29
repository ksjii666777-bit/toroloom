/**
 * ============================================================================
 * Toroloom — TaxSummaryCard Unit Tests
 * ============================================================================
 *
 * Tests cover:
 *   1. Renders STCG row (label, gains, estimated tax)
 *   2. Renders LTCG row (label, gains, estimated tax)
 *   3. Renders total estimated tax
 *   4. Shows/hides tax-harvesting tip based on totalEstimatedTax > 0
 *   5. Color coding: positive gains → green, negative → red
 *   6. Edge cases: zero values, negative gains, zero tax
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';
import TaxSummaryCard from '../components/TaxSummaryCard';
import type { TaxSummaryData } from '../components/TaxSummaryCard';

// ──── Mock Theme ──────────────────────────────────────────────

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      marketUp: '#00C853',
      marketDown: '#FF3D00',
      warning: '#FFAB40',
      text: '#E0E6ED',
      textSecondary: '#64748B',
      textMuted: '#475569',
      divider: 'rgba(255,255,255,0.05)',
      bgCard: 'rgba(255,255,255,0.03)',
      border: 'rgba(255,255,255,0.08)',
    },
  }),
}));

// ──── Mock useT ───────────────────────────────────────────────

const periodReport: Record<string, string> = {
  taxSummary: 'Tax Summary',
  stcgLabel: 'STCG (15%)',
  ltcgLabel: 'LTCG (10%)',
  estimatedTax: 'Estimated Tax',
  taxHarvestingTip: 'Consider tax-loss harvesting to offset gains.',
};

function resolveT(key: string): string {
  const parts = key.split('.');
  const ns = parts[0];
  const subKey = parts.slice(1).join('.');
  if (ns === 'periodReport' && subKey in periodReport) {
    return periodReport[subKey];
  }
  return key;
}

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

// ──── Mock formatCurrency ─────────────────────────────────────

function mockFormatCurrency(val: number, compact?: boolean): string {
  const sign = val >= 0 ? '+' : '-';
  const abs = Math.abs(val);
  if (compact && abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  if (compact && abs >= 100) return `${sign}₹${(abs / 100).toFixed(1)}H`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

vi.mock('../utils/formatters', () => ({
  formatCurrency: mockFormatCurrency,
}));

// ──── Helpers ─────────────────────────────────────────────────

function buildCg(overrides?: Partial<TaxSummaryData>): TaxSummaryData {
  return {
    shortTerm: { gains: 45000, estimatedTax: 6750 },
    longTerm: { gains: 120000, estimatedTax: 2000 },
    totalEstimatedTax: 8750,
    ...overrides,
  };
}

// ──── Tests ───────────────────────────────────────────────────

describe('TaxSummaryCard', () => {
  describe('renders STCG row', () => {
    it('shows STCG label', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      expect(getByText('STCG (15%)')).toBeDefined();
    });

    it('shows STCG gains value', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      expect(getByText('+₹45.0K')).toBeDefined();
    });

    it('shows STCG estimated tax', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      expect(getByText('₹6,750')).toBeDefined();
    });
  });

  describe('renders LTCG row', () => {
    it('shows LTCG label', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      expect(getByText('LTCG (10%)')).toBeDefined();
    });

    it('shows LTCG gains value', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      expect(getByText('+₹120.0K')).toBeDefined();
    });

    it('shows LTCG estimated tax', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      expect(getByText('₹2,000')).toBeDefined();
    });
  });

  describe('renders total estimated tax', () => {
    it('shows total estimated tax label', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      expect(getByText('Estimated Tax')).toBeDefined();
    });

    it('shows total estimated tax value', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      // 8750 → compact +₹8.8K
      expect(getByText('+₹8.8K')).toBeDefined();
    });

    it('uses warning color when tax > 0', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      expect(getByText('+₹8.8K')).toBeDefined();
    });
  });

  describe('tax-harvesting tip', () => {
    it('shows tip when totalEstimatedTax > 0', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      expect(getByText(/Consider tax-loss harvesting/)).toBeDefined();
    });

    it('hides tip when totalEstimatedTax is 0', () => {
      const cg = buildCg({ totalEstimatedTax: 0 });
      const { queryByText } = render(<TaxSummaryCard cg={cg} />);
      expect(queryByText(/Consider tax-loss harvesting/)).toBeNull();
    });
  });

  describe('color coding', () => {
    it('shows positive STCG gains in marketUp color (green)', () => {
      const { getByText } = render(<TaxSummaryCard cg={buildCg()} />);
      expect(getByText('+₹45.0K')).toBeDefined();
    });

    it('shows negative STCG gains in marketDown color (red)', () => {
      const cg = buildCg({ shortTerm: { gains: -10000, estimatedTax: 0 } });
      const { getByText } = render(<TaxSummaryCard cg={cg} />);
      expect(getByText('₹10.0K')).toBeDefined();
    });

    it('shows negative LTCG gains in marketDown color (red)', () => {
      const cg = buildCg({ longTerm: { gains: -5000, estimatedTax: 0 } });
      const { getByText } = render(<TaxSummaryCard cg={cg} />);
      expect(getByText('₹5.0K')).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles zero gains and zero tax', () => {
      const cg = buildCg({
        shortTerm: { gains: 0, estimatedTax: 0 },
        longTerm: { gains: 0, estimatedTax: 0 },
        totalEstimatedTax: 0,
      });
      const { getByText, queryByText } = render(<TaxSummaryCard cg={cg} />);
      expect(getByText('+₹0')).toBeDefined();
      expect(queryByText(/Consider tax-loss harvesting/)).toBeNull();
    });

    it('handles large gains values', () => {
      const cg = buildCg({
        shortTerm: { gains: 500000, estimatedTax: 75000 },
        longTerm: { gains: 2000000, estimatedTax: 190000 },
        totalEstimatedTax: 265000,
      });
      const { getByText } = render(<TaxSummaryCard cg={cg} />);
      expect(getByText('+₹500.0K')).toBeDefined();
      expect(getByText('+₹2000.0K')).toBeDefined();
      expect(getByText('+₹265.0K')).toBeDefined();
    });
  });
});
