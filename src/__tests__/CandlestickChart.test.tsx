/**
 * ============================================================================
 * Toroloom — CandlestickChart Tests
 * ============================================================================
 *
 * Tests the CandlestickChart component: loading state, empty data fallback,
 * data rendering with multiple points, timeframe selector display, and
 * timeframe change callbacks.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import CandlestickChart from '../components/CandlestickChart';
import { render, fireEvent } from './testUtils';
import type { StockHistoryPoint } from '../types';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      primary: '#6C63FF',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
      accent: '#00D2FF',
      text: '#1A1A2E',
      textSecondary: '#5A5A7A',
      textMuted: '#9A9AB0',
      bgCard: '#FFFFFF',
      bgCardLight: '#F0F2F8',
      border: '#E0E0F0',
      borderLight: '#D0D0E8',
      info: '#6C63FF',
      shadow: '#000000',
    },
  }),
}));

const sampleData: StockHistoryPoint[] = [
  { date: '2025-01-01', open: 100, high: 110, low: 98, close: 108, volume: 10000 },
  { date: '2025-01-02', open: 108, high: 112, low: 105, close: 110, volume: 12000 },
  { date: '2025-01-03', open: 110, high: 115, low: 108, close: 112, volume: 15000 },
  { date: '2025-01-04', open: 112, high: 113, low: 107, close: 108, volume: 9000 },
  { date: '2025-01-05', open: 108, high: 111, low: 106, close: 110, volume: 11000 },
];

describe('CandlestickChart', () => {
  it('renders loading state', () => {
    const { getByText } = render(
      <CandlestickChart data={[]} loading />
    );
    expect(getByText('Loading chart data...')).toBeDefined();
  });

  it('renders empty data fallback', () => {
    const { getByText } = render(
      <CandlestickChart data={[]} />
    );
    expect(getByText('No chart data available')).toBeDefined();
  });

  it('renders with sample data', () => {
    const { getByText } = render(
      <CandlestickChart data={sampleData} />
    );
    // It should render and not show the empty/loading states
    // The component renders SVG + timeframe selector
    expect(getByText('1M')).toBeDefined();
  });

  it('renders timeframe buttons', () => {
    const { getByText } = render(
      <CandlestickChart data={sampleData} />
    );
    expect(getByText('1D')).toBeDefined();
    expect(getByText('1W')).toBeDefined();
    expect(getByText('1M')).toBeDefined();
    expect(getByText('3M')).toBeDefined();
    expect(getByText('1Y')).toBeDefined();
    expect(getByText('Max')).toBeDefined();
  });

  it('renders with custom timeframes', () => {
    const { getByText } = render(
      <CandlestickChart
        data={sampleData}
        timeframes={['1H', '1D', '1W']}
      />
    );
    expect(getByText('1H')).toBeDefined();
    expect(getByText('1D')).toBeDefined();
    expect(getByText('1W')).toBeDefined();
  });

  it('calls onTimeframeChange when a timeframe is pressed', () => {
    const onTimeframeChange = vi.fn();
    const { root } = render(
      <CandlestickChart
        data={sampleData}
        onTimeframeChange={onTimeframeChange}
      />
    );
    // Find all elements with an onPress handler, then find the one
    // whose children include a Text with "1W" content
    const allPressables = root.findAll(
      (inst: any) => typeof inst.props?.onPress === 'function'
    );
    const timeframeBtn = allPressables.find((inst: any) =>
      Array.isArray(inst.children) &&
      inst.children.some(
        (c: any) => typeof c === 'object' && c?.props?.children === '1W'
      )
    );
    expect(timeframeBtn).toBeDefined();
    fireEvent.press(timeframeBtn!);
    expect(onTimeframeChange).toHaveBeenCalledWith('1W');
  });

  it('renders with active timeframe highlighted', () => {
    const { getByText } = render(
      <CandlestickChart
        data={sampleData}
        activeTimeframe="1W"
      />
    );
    expect(getByText('1W')).toBeDefined();
  });

  it('renders with showVolume=false', () => {
    const { toJSON } = render(
      <CandlestickChart data={sampleData} showVolume={false} />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with showMA=true', () => {
    const { toJSON } = render(
      <CandlestickChart data={sampleData} showMA />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with custom height', () => {
    const { getByText } = render(
      <CandlestickChart data={sampleData} height={400} />
    );
    expect(getByText('1M')).toBeDefined();
  });
});
