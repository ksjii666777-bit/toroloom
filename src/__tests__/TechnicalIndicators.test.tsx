/**
 * ============================================================================
 * Toroloom — Technical Indicators Unit Tests
 * ============================================================================
 *
 * Tests component rendering with react-test-renderer (via testUtils).
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/TechnicalIndicators.test.tsx
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from './testUtils';
import TechnicalIndicators from '../components/TechnicalIndicators';
import type { StockHistoryPoint } from '../types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      text: '#FFF', textSecondary: '#999', textMuted: '#666',
      primary: '#3B82F6', accent: '#00D2FF', bg: '#000', bgCard: '#111',
      bgInput: '#222', border: '#333', borderLight: '#444',
      marketUp: '#10B981', marketDown: '#EF4444', warning: '#F59E0B',
    },
  }),
}));

vi.mock('../components/ChartCrosshairContext', () => ({
  useChartCrosshair: () => ({ focusedIndex: null, setFocusedIndex: vi.fn() }),
}));

vi.mock('../constants/theme', () => ({
  FONTS: { size: { xs: 10, sm: 12, md: 14, lg: 16 } },
  SPACING: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
  BORDER_RADIUS: { sm: 4, md: 6, lg: 8, xl: 12, full: 999 },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateData(count: number): StockHistoryPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2025-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
    open: 100 + i,
    high: 110 + i,
    low: 90 + i,
    close: 105 + i,
    volume: 1000000,
  }));
}

describe('TechnicalIndicators', () => {
  describe('Insufficient Data', () => {
    it('should show empty state when no data', () => {
      const { getByText } = render(<TechnicalIndicators data={[]} />);
      expect(getByText('Need at least 15 data points for indicators')).toBeTruthy();
    });

    it('should show empty state with <15 points', () => {
      const { getByText } = render(<TechnicalIndicators data={generateData(10)} />);
      expect(getByText('Need at least 15 data points for indicators')).toBeTruthy();
    });
  });

  describe('Sufficient Data', () => {
    it('should render toggle chips', () => {
      const { getByText } = render(<TechnicalIndicators data={generateData(30)} />);
      expect(getByText('RSI')).toBeTruthy();
      expect(getByText('MACD')).toBeTruthy();
      expect(getByText('Bollinger')).toBeTruthy();
    });

    it('should render RSI panel header', () => {
      const { getByText } = render(<TechnicalIndicators data={generateData(30)} />);
      expect(getByText('RSI (14)')).toBeTruthy();
    });

    it('should render MACD panel header', () => {
      const { getByText } = render(<TechnicalIndicators data={generateData(30)} />);
      expect(getByText('MACD (12,26,9)')).toBeTruthy();
    });

    it('should render Bollinger panel header', () => {
      const { getByText } = render(<TechnicalIndicators data={generateData(30)} />);
      expect(getByText('Bollinger (20,2)')).toBeTruthy();
    });
  });

  describe('Controlled Indicators', () => {
    it('should only show specified indicators', () => {
      const { queryByText } = render(<TechnicalIndicators data={generateData(30)} indicators={['rsi']} />);
      expect(queryByText('RSI (14)')).toBeTruthy();
      expect(queryByText('MACD (12,26,9)')).toBeNull();
      expect(queryByText('Bollinger (20,2)')).toBeNull();
    });
  });

  describe('Toggle Callback', () => {
    it('should call onIndicatorToggle when chip pressed', () => {
      const onToggle = vi.fn();
      const { getByText } = render(<TechnicalIndicators data={generateData(30)} onIndicatorToggle={onToggle} />);
      // fireEvent.press walks up the parent chain to find onPress on TouchableOpacity
      fireEvent.press(getByText('RSI'));
      expect(onToggle).toHaveBeenCalledWith('rsi');
    });
  });

  describe('Edge Cases', () => {
    it('should render with minimum viable data (16 points for RSI to show 2 values)', () => {
      // RSI needs period+1=15 points minimum, but needs 2+ valid values to render the panel
      const { getByText } = render(<TechnicalIndicators data={generateData(16)} />);
      expect(getByText('RSI (14)')).toBeTruthy();
    });

    it('should render with large dataset (200 points)', () => {
      const { getByText } = render(<TechnicalIndicators data={generateData(200)} />);
      expect(getByText('RSI (14)')).toBeTruthy();
    });

    it('should render with identical close prices', () => {
      const flat = generateData(30).map(p => ({ ...p, close: 100 }));
      const { getByText } = render(<TechnicalIndicators data={flat} />);
      expect(getByText('RSI (14)')).toBeTruthy();
    });
  });
});
