/**
 * ============================================================================
 * Toroloom — AIInsightsScreen Integration Tests
 * ============================================================================
 *
 * Verifies that AIInsightsScreen renders correctly with AI insight data,
 * market overview, stock analysis cards, confidence badges, and targets.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from './testUtils';
import { mockAIInsights } from '../constants/mockData';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      white: '#FFFFFF',
      bg: '#0D0D2B',
      bgSecondary: '#1A1A3E',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgDark: '#070720',
      bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/aiStore', () => ({
  useAIStore: vi.fn(() => ({
    insights: mockAIInsights,
  })),
}));

// ==================== Imports ====================

import AIInsightsScreen from '../screens/ai/AIInsightsScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('AIInsightsScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const { toJSON } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    expect(toJSON).not.toBeNull();
  });
});

describe('AIInsightsScreen — Loaded Content', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header title', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('AI Insights')).toBeDefined();
  });

  it('renders the subtitle', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Powered by advanced market analysis')).toBeDefined();
  });

  it('renders the AI Market Overview card', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('AI Market Overview')).toBeDefined();
  });

  it('renders insight type counts in overview (bullish/bearish/neutral)', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText(/bullish/)).toBeDefined();
    expect(getByText(/bearish/)).toBeDefined();
    expect(getByText(/neutral/)).toBeDefined();
  });

  it('renders the Stock Analysis section title', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Stock Analysis')).toBeDefined();
  });

  it('renders all stock symbols from insights', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined();
    expect(getByText('SBIN')).toBeDefined();
  });

  it('renders insight type badges (Bullish, Bearish, Neutral)', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Bullish')).toBeDefined();
    expect(getByText('Bearish')).toBeDefined();
    expect(getByText('Neutral')).toBeDefined();
  });

  it('renders confidence badges for each insight', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('85% Confidence')).toBeDefined();
    expect(getByText('72% Confidence')).toBeDefined();
    expect(getByText('65% Confidence')).toBeDefined();
    expect(getByText('88% Confidence')).toBeDefined();
  });

  it('renders insight summary text', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Strong breakout above resistance with high volume')).toBeDefined();
    expect(getByText('Forming lower highs; weak momentum')).toBeDefined();
    expect(getByText('Consolidating in a range; wait for breakout')).toBeDefined();
    expect(getByText('Strong uptrend with high institutional interest')).toBeDefined();
  });

  it('renders target prices for each insight', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // RELIANCE targets
    expect(getByText('₹2,950.00')).toBeDefined();
    expect(getByText('₹3,020.00')).toBeDefined();
    expect(getByText('₹3,100.00')).toBeDefined();
    // SBIN targets
    expect(getByText('₹820.00')).toBeDefined();
    expect(getByText('₹850.00')).toBeDefined();
    expect(getByText('₹900.00')).toBeDefined();
  });

  it('renders target labels (Target 1, Target 2, Target 3)', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Target 1')).toBeDefined();
    expect(getByText('Target 2')).toBeDefined();
    expect(getByText('Target 3')).toBeDefined();
  });

  it('renders probability percentages for targets', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('75% probability')).toBeDefined();
    expect(getByText('45% probability')).toBeDefined();
    expect(getByText('25% probability')).toBeDefined();
  });

  it('renders insight analysis text (at least first few chars)', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // Each insight has analysis truncated to 3 lines — check key phrases
    expect(getByText(/RELIANCE has broken/)).toBeDefined();
    expect(getByText(/TCS is showing signs/)).toBeDefined();
    expect(getByText(/HDFC Bank is consolidating/)).toBeDefined();
    expect(getByText(/SBI is in a strong uptrend/)).toBeDefined();
  });

  it('does not call navigate on initial render', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('AI Insights')).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('AIInsightsScreen — Empty Insights', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    // Override to return empty insights
    vi.mocked(useAIStore).mockImplementation(() => ({ insights: [] }));
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore default
    vi.mocked(useAIStore).mockImplementation(() => ({ insights: mockAIInsights }));
  });

  it('renders gracefully with no insights', () => {
    const { toJSON } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(toJSON).not.toBeNull();
  });

  it('renders overview with zero counts when no insights', () => {
    const { getByText } = render(<AIInsightsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // The overview counts should be 0 for all types
    expect(getByText(/0 bullish/)).toBeDefined();
  });
});

// Re-import for mock override type safety
import { useAIStore } from '../store/aiStore';
