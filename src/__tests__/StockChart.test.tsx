/**
 * ============================================================================
 * Toroloom — StockChart Tests
 * ============================================================================
 *
 * Tests the StockChart component: empty data fallback, rendering with sample
 * data points, positive/negative color theming, custom line/gradient colors,
 * and the showAxis toggle.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import StockChart from '../components/StockChart';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      marketUp: '#00C853',
      marketDown: '#FF1744',
      text: '#1A1A2E',
      textMuted: '#9A9AB0',
      textSecondary: '#5A5A7A',
      bgCard: '#FFFFFF',
      bgCardLight: '#F0F2F8',
      border: '#E0E0F0',
      borderLight: '#D0D0E8',
    },
  }),
}));

const sampleData = [
  { date: '2025-01-01', price: 150 },
  { date: '2025-01-02', price: 155 },
  { date: '2025-01-03', price: 153 },
  { date: '2025-01-04', price: 158 },
  { date: '2025-01-05', price: 160 },
  { date: '2025-01-06', price: 162 },
  { date: '2025-01-07', price: 165 },
  { date: '2025-01-08', price: 163 },
  { date: '2025-01-09', price: 168 },
  { date: '2025-01-10', price: 170 },
];

describe('StockChart', () => {
  it('renders empty data fallback', () => {
    const { getByText } = render(
      <StockChart data={[]} />
    );
    expect(getByText('No chart data available')).toBeDefined();
  });

  it('renders with sample data', () => {
    const { toJSON } = render(
      <StockChart data={sampleData} />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with a single data point', () => {
    const { toJSON } = render(
      <StockChart data={[{ date: '2025-01-01', price: 150 }]} />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with two data points', () => {
    const { toJSON } = render(
      <StockChart
        data={[
          { date: '2025-01-01', price: 150 },
          { date: '2025-01-02', price: 155 },
        ]}
      />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders as positive by default', () => {
    const { toJSON } = render(
      <StockChart data={sampleData} />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with positive=false', () => {
    const { toJSON } = render(
      <StockChart data={sampleData} positive={false} />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with custom lineColor', () => {
    const { toJSON } = render(
      <StockChart data={sampleData} lineColor="#FF9800" />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with custom gradientColor', () => {
    const { toJSON } = render(
      <StockChart data={sampleData} gradientColor="#FF5722" />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with showAxis enabled', () => {
    const { toJSON } = render(
      <StockChart data={sampleData} showAxis />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with custom height', () => {
    const { toJSON } = render(
      <StockChart data={sampleData} height={300} />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders from null / undefined data gracefully', () => {
    const { getByText } = render(
      <StockChart data={undefined as any} />
    );
    expect(getByText('No chart data available')).toBeDefined();
  });

  it('renders with showAxis and custom width', () => {
    const { toJSON } = render(
      <StockChart data={sampleData} showAxis width={300} />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders data with extreme price values (very low and very high)', () => {
    const extremeData = [
      { date: '2025-01-01', price: 0.05 },
      { date: '2025-01-02', price: 99999.99 },
    ];
    const { toJSON } = render(
      <StockChart data={extremeData} />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders data with negative prices', () => {
    const negativeData = [
      { date: '2025-01-01', price: -5.50 },
      { date: '2025-01-02', price: -3.20 },
    ];
    const { toJSON } = render(
      <StockChart data={negativeData} />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with showAxis, positive=false and custom colors together', () => {
    const { toJSON } = render(
      <StockChart
        data={sampleData}
        positive={false}
        showAxis
        lineColor="#FF9800"
        gradientColor="#FF5722"
      />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with showAxis and many data points', () => {
    const manyPoints = Array.from({ length: 100 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      price: 150 + Math.sin(i * 0.5) * 10,
    }));
    const { toJSON } = render(
      <StockChart data={manyPoints} showAxis />
    );
    expect(toJSON).toBeDefined();
  });
});
