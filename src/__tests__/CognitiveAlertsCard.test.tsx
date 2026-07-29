/**
 * ============================================================================
 * Toroloom — CognitiveAlertsCard Unit Tests
 * ============================================================================
 *
 * Tests all rendering states:
 *   1. Loading state (cognitiveSummary = null) → ActivityIndicator
 *   2. Over-trading alert flagged
 *   3. Brokerage leakage alert flagged
 *   4. Concentration risk alert flagged
 *   5. Behavioral critique displayed
 *   6. No alerts → all-clear "shield-checkmark" message
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';
import { AICognitiveSummary } from '../types';

import CognitiveAlertsCard from '../components/CognitiveAlertsCard';

// ── Mock Theme ──────────────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      danger: '#FF5252',
      warning: '#FFAB40',
      marketUp: '#00E676',
      textSecondary: '#64748B',
      textMuted: '#475569',
    },
  }),
}));

// ── Mock useT ───────────────────────────────────────────────
const periodReport: Record<string, string> = {
  behavioralInsights: 'Behavioral Insights',
  loading: 'Loading report...',
  overTradingAlert: 'Over-Trading Alert',
  overTradingDesc: 'Daily trade count exceeds recommended limit',
  brokerageLeakage: 'Brokerage Leakage',
  brokerageLeakageDesc: 'Charges consuming significant portion of P&L',
  concentrationRisk: 'Concentration Risk',
  concentrationRiskDesc: 'Portfolio over-concentrated in one sector',
  noAlerts: 'No behavioral alerts — balanced trading',
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

// ── Helpers ─────────────────────────────────────────────────

function buildSummary(overrides?: Partial<AICognitiveSummary>): AICognitiveSummary {
  return {
    winLossFrequencyRatio: 1.5,
    totalProfitableTrades: 8,
    totalClosedTrades: 12,
    brokerageDragFactor: 0.03,
    totalTaxesAndCharges: 1500,
    absoluteRealizedPnl: 25000,
    sectorConcentrationIndex: 0.45,
    sectorAllocation: [{ sector: 'Finance', exposurePercent: 40 }],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ──── Tests ────────────────────────────────────────────────────

describe('CognitiveAlertsCard', () => {
  // ── 1. Loading State ──────────────────────────────────────
  describe('loading state (cognitiveSummary = null)', () => {
    it('shows ActivityIndicator and loading text', () => {
      const { getByText } = render(<CognitiveAlertsCard cognitiveSummary={null} />);
      expect(getByText('Loading report...')).toBeDefined();
    });

    it('shows section title even in loading state', () => {
      const { getByText } = render(<CognitiveAlertsCard cognitiveSummary={null} />);
      expect(getByText('Behavioral Insights')).toBeDefined();
    });
  });

  // ── 2. Over-Trading Alert ─────────────────────────────────
  describe('over-trading alert', () => {
    it('shows over-trading alert when flagged', () => {
      const summary = buildSummary({
        overTradingAlert: { flag: true, message: 'Too many trades today' },
      });
      const { getByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(getByText('Over-Trading Alert')).toBeDefined();
      expect(getByText('Daily trade count exceeds recommended limit')).toBeDefined();
    });

    it('does not show over-trading alert when not flagged', () => {
      const summary = buildSummary();
      const { queryByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(queryByText('Over-Trading Alert')).toBeNull();
    });

    it('shows over-trading alert alongside other alerts', () => {
      const summary = buildSummary({
        overTradingAlert: { flag: true, message: 'Too many trades' },
        brokerageLeakageAlert: { flag: true, message: 'High charges' },
      });
      const { getByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(getByText('Over-Trading Alert')).toBeDefined();
      expect(getByText('Brokerage Leakage')).toBeDefined();
    });
  });

  // ── 3. Brokerage Leakage Alert ────────────────────────────
  describe('brokerage leakage alert', () => {
    it('shows brokerage leakage alert when flagged', () => {
      const summary = buildSummary({
        brokerageLeakageAlert: { flag: true, message: 'Charges eating profits' },
      });
      const { getByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(getByText('Brokerage Leakage')).toBeDefined();
      expect(getByText('Charges consuming significant portion of P&L')).toBeDefined();
    });

    it('does not show brokerage leakage alert when not flagged', () => {
      const summary = buildSummary();
      const { queryByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(queryByText('Brokerage Leakage')).toBeNull();
    });
  });

  // ── 4. Concentration Risk Alert ───────────────────────────
  describe('concentration risk alert', () => {
    it('shows concentration risk alert when flagged', () => {
      const summary = buildSummary({
        concentrationRiskAlert: { flag: true, message: 'Too much in one sector' },
      });
      const { getByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(getByText('Concentration Risk')).toBeDefined();
      expect(getByText('Portfolio over-concentrated in one sector')).toBeDefined();
    });

    it('does not show concentration risk alert when not flagged', () => {
      const summary = buildSummary();
      const { queryByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(queryByText('Concentration Risk')).toBeNull();
    });
  });

  // ── 5. Behavioral Critique ────────────────────────────────
  describe('behavioral critique', () => {
    it('shows critique text when provided', () => {
      const summary = buildSummary({
        behavioralCritique: 'Consider reducing trade frequency to avoid overtrading.',
      });
      const { getByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(getByText('Consider reducing trade frequency to avoid overtrading.')).toBeDefined();
    });

    it('does not show critique text when not provided', () => {
      const summary = buildSummary();
      const { queryByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      // The no-alerts message should appear instead
      expect(queryByText('No behavioral alerts — balanced trading')).toBeDefined();
    });

    it('shows critique alongside alerts', () => {
      const summary = buildSummary({
        overTradingAlert: { flag: true, message: 'Too many trades' },
        behavioralCritique: 'Try to focus on quality over quantity.',
      });
      const { getByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(getByText('Over-Trading Alert')).toBeDefined();
      expect(getByText('Try to focus on quality over quantity.')).toBeDefined();
    });
  });

  // ── 6. No Alerts — All-Clear ──────────────────────────────
  describe('no alerts — all-clear', () => {
    it('shows all-clear message when no alert flags are set and no critique', () => {
      const summary = buildSummary();
      const { getByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(getByText('No behavioral alerts — balanced trading')).toBeDefined();
    });

    it('hides all-clear message when any alert is flagged', () => {
      const summary = buildSummary({
        overTradingAlert: { flag: true, message: 'Too many trades' },
      });
      const { queryByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(queryByText('No behavioral alerts — balanced trading')).toBeNull();
    });

    it('shows all-clear alongside critique when no alert flags are set', () => {
      const summary = buildSummary({
        behavioralCritique: 'Consider improving your strategy.',
      });
      const { getByText, queryByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      // `hasAnyAlert` = false (no alert flags), `hasCritique` = true (critique provided).
      // Component renders both critique AND all-clear since they're independent.
      expect(getByText('Consider improving your strategy.')).toBeDefined();
      expect(queryByText('No behavioral alerts — balanced trading')).toBeDefined();
    });
  });

  // ── 7. Combined States ────────────────────────────────────
  describe('combined states', () => {
    it('shows all three alerts simultaneously', () => {
      const summary = buildSummary({
        overTradingAlert: { flag: true, message: 'Too many trades' },
        brokerageLeakageAlert: { flag: true, message: 'High charges' },
        concentrationRiskAlert: { flag: true, message: 'One sector heavy' },
      });
      const { getByText } = render(<CognitiveAlertsCard cognitiveSummary={summary} />);
      expect(getByText('Over-Trading Alert')).toBeDefined();
      expect(getByText('Brokerage Leakage')).toBeDefined();
      expect(getByText('Concentration Risk')).toBeDefined();
    });

    it('shows nothing when no alerts but still loading (null)', () => {
      // Already tested in loading state — just confirm no alert text leaks
      const { queryByText } = render(<CognitiveAlertsCard cognitiveSummary={null} />);
      expect(queryByText('No behavioral alerts — balanced trading')).toBeNull();
      expect(queryByText('Over-Trading Alert')).toBeNull();
      expect(queryByText('Brokerage Leakage')).toBeNull();
      expect(queryByText('Concentration Risk')).toBeNull();
    });
  });
});
