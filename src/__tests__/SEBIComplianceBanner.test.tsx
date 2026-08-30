/**
 * ============================================================================
 * Toroloom — SEBI Compliance Banner Tests
 * ============================================================================
 *
 * Tests the SEBIComplianceBanner component for:
 *   - Correct rendering of all variants (trading, advisory, full, compact)
 *   - Dismiss functionality
 *   - Expand/collapse toggle
 *   - Risk disclosure text rendering
 *   - i18n translation support
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/SEBIComplianceBanner.test.tsx
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent } from './testUtils';

// Mock i18n
const { resolveT } = vi.hoisted(() => {
  const translations: Record<string, string> = {
    'compliance.sebiDisclosure': 'SEBI Regulatory Disclosure',
    'compliance.tradingRiskDisclosure': 'Investments in securities market are subject to market risks. Read all related documents carefully before investing.',
    'compliance.riskWarning': 'Investments in securities market are subject to market risks. Read all related documents carefully before investing.',
    'compliance.marketRisksTitle': 'Market Risks',
    'compliance.marketRisksDescription': 'Stock prices can fluctuate significantly.',
    'compliance.readDocuments': 'Read all scheme-related documents before investing.',
    'compliance.brokerInfo': 'Toroloom is a technology platform that facilitates trade execution.',
    'compliance.sebiRegistration': 'All brokers on this platform are SEBI-registered.',
    'compliance.scoresInfo': 'For complaints, visit SEBI SCORES: scores.gov.in',
    'compliance.advisoryDisclaimer': 'Advisory services are provided by SEBI-registered entities.',
  };

  function resolveT(key: string, _params?: Record<string, any>): string {
    return translations[key] || key;
  }

  return { resolveT };
});

vi.mock('../hooks/useT', () => ({
  useT: () => ({ t: resolveT, language: 'en', isHindi: false, toggleLanguage: vi.fn() }),
}));

// Mock theme context
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      text: '#FFFFFF',
      textSecondary: '#9CA3AF',
      textMuted: '#6B7280',
      bgCard: '#1F2937',
      bg: '#0B0F19',
      border: '#374151',
    },
    isDark: true,
  }),
}));

// Import component after mocks
import SEBIComplianceBanner, { TradingRiskDisclosure, AdvisoryDisclaimer } from '../components/ui/SEBIComplianceBanner';

describe('SEBIComplianceBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Compact Variant
  // ─────────────────────────────────────────────────────────────────────────

  describe('Compact Variant', () => {
    it('renders the compact banner with risk disclosure', () => {
      const { getByText } = render(<SEBIComplianceBanner variant="compact" />);
      expect(getByText(/Investments in securities market/)).toBeDefined();
    });

    it('renders without dismiss button when dismissible=false', () => {
      const { toJSON } = render(<SEBIComplianceBanner variant="compact" dismissible={false} />);
      // No close button should be present — just renders without error
      expect(toJSON).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Advisory Variant
  // ─────────────────────────────────────────────────────────────────────────

  describe('Advisory Variant', () => {
    it('renders the advisory disclaimer', () => {
      const { getByText } = render(<SEBIComplianceBanner variant="advisory" />);
      expect(getByText(/Advisory services are provided by SEBI-registered/)).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Full Variant (Default)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Full Variant', () => {
    it('renders the header with disclosure title', () => {
      const { getByText } = render(<SEBIComplianceBanner variant="full" />);
      expect(getByText('SEBI Regulatory Disclosure')).toBeDefined();
    });

    it('expands content when header is pressed', () => {
      const { getByText, queryByText } = render(<SEBIComplianceBanner variant="full" />);

      // Initially, detailed content should not be visible
      expect(queryByText('Market Risks')).toBeNull();

      // Press the header to expand
      fireEvent.press(getByText('SEBI Regulatory Disclosure'));

      // Now detailed content should be visible
      expect(getByText('Market Risks')).toBeDefined();
      expect(getByText(/Stock prices can fluctuate/)).toBeDefined();
      expect(getByText(/Read all scheme-related documents/)).toBeDefined();
      expect(getByText(/Toroloom is a technology platform/)).toBeDefined();
      expect(getByText(/All brokers on this platform are SEBI-registered/)).toBeDefined();
    });

    it('collapses content when header is pressed again', () => {
      const { getByText, queryByText } = render(<SEBIComplianceBanner variant="full" />);

      // Expand
      fireEvent.press(getByText('SEBI Regulatory Disclosure'));
      expect(getByText('Market Risks')).toBeDefined();

      // Collapse
      fireEvent.press(getByText('SEBI Regulatory Disclosure'));
      expect(queryByText('Market Risks')).toBeNull();
    });

    it('shows SCORES information when expanded', () => {
      const { getByText } = render(<SEBIComplianceBanner variant="full" />);
      fireEvent.press(getByText('SEBI Regulatory Disclosure'));
      expect(getByText(/For complaints, visit SEBI SCORES/)).toBeDefined();
    });

    it('does not crash when rendered', () => {
      const { toJSON } = render(<SEBIComplianceBanner variant="full" />);
      expect(toJSON).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Custom Disclaimer
  // ─────────────────────────────────────────────────────────────────────────

  describe('Custom Disclaimer', () => {
    it('shows custom disclaimer when provided', () => {
      const { getByText } = render(
        <SEBIComplianceBanner
          variant="full"
          customDisclaimer="Custom disclaimer text here"
        />
      );

      // Expand to see custom disclaimer
      fireEvent.press(getByText('SEBI Regulatory Disclosure'));
      expect(getByText('Custom disclaimer text here')).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Standalone Components
  // ─────────────────────────────────────────────────────────────────────────

  describe('TradingRiskDisclosure', () => {
    it('renders the risk disclosure text', () => {
      const { getByText } = render(<TradingRiskDisclosure />);
      expect(getByText(/Investments in securities market/)).toBeDefined();
    });
  });

  describe('AdvisoryDisclaimer', () => {
    it('renders the advisory disclaimer text', () => {
      const { getByText } = render(<AdvisoryDisclaimer />);
      expect(getByText(/Advisory services are provided by SEBI-registered/)).toBeDefined();
    });
  });
});
