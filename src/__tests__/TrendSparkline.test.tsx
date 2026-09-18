/**
 * Toroloom — TrendSparkline Component Tests
 *
 * Unit tests for the reusable SVG sparkline used in Global Markets country
 * views (index trends beside the open/closed badge):
 *   - Up-trend uses marketUp color, down-trend uses marketDown color
 *   - Explicit color prop overrides trend colors
 *   - Renders nothing for empty / single-point data
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';
import TrendSparkline from '../components/ui/TrendSparkline';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { marketUp: '#00C853', marketDown: '#FF1744' },
    isDark: true,
  }),
}));

describe('TrendSparkline', () => {
  const upTrend = [100, 101, 102, 103, 104];
  const downTrend = [104, 103, 102, 101, 100];

  it('renders for a valid series', () => {
    const { toJSON } = render(<TrendSparkline data={upTrend} testID="spark" />);
    expect(toJSON()).not.toBeNull();
  });

  it('uses marketUp color for an up-trending series', () => {
    const { toJSON } = render(<TrendSparkline data={upTrend} />);
    expect(JSON.stringify(toJSON())).toContain('#00C853');
  });

  it('uses marketDown color for a down-trending series', () => {
    const { toJSON } = render(<TrendSparkline data={downTrend} />);
    expect(JSON.stringify(toJSON())).toContain('#FF1744');
  });

  it('prefers the explicit color prop over trend colors', () => {
    const { toJSON } = render(<TrendSparkline data={downTrend} color="#6C63FF" />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('#6C63FF');
    expect(json).not.toContain('#FF1744');
  });

  it('renders nothing for empty data', () => {
    const { toJSON } = render(<TrendSparkline data={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing for a single point', () => {
    const { toJSON } = render(<TrendSparkline data={[42]} />);
    expect(toJSON()).toBeNull();
  });

  it('treats a flat series (last === first) as up', () => {
    const { toJSON } = render(<TrendSparkline data={[50, 50, 50]} />);
    expect(JSON.stringify(toJSON())).toContain('#00C853');
  });
});
