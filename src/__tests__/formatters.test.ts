/**
 * ============================================================================
 * Toroloom — Formatter Utility Tests
 * ============================================================================
 *
 * Tests all pure utility functions in src/utils/formatters.ts.
 * These are pure functions with no external dependencies, making them the
 * simplest and most reliable place to start testing.
 */

import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatChange,
  formatPercent,
  formatNumber,
  formatDate,
  formatTimeAgo,
  formatTimestamp,
  hexToRgba,
  formatCompactNumber,
  getChangeColor,
  getGradientForChange,
} from '../utils/formatters';

// ============ formatCurrency ============
describe('formatCurrency', () => {
  it('formats whole number in INR', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('₹');
    expect(result).toContain('1,000');
  });

  it('formats large number in INR with commas', () => {
    const result = formatCurrency(1234567);
    expect(result).toContain('₹');
    expect(result).toContain('12,34,567'); // Indian numbering system
  });

  it('formats decimal values correctly', () => {
    const result = formatCurrency(99.99);
    expect(result).toContain('₹');
    expect(result).toContain('99.99');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('₹');
    expect(result).toContain('0');
  });

  it('formats negative values', () => {
    const result = formatCurrency(-500);
    expect(result).toContain('-');
    expect(result).toContain('₹');
  });

  it('uses compact format for thousands (K)', () => {
    const result = formatCurrency(2500, true);
    expect(result).toBe('₹2.5K');
  });

  it('uses compact format for lakhs (L)', () => {
    const result = formatCurrency(150000, true);
    expect(result).toBe('₹1.50L');
  });

  it('uses compact format for crores (Cr)', () => {
    const result = formatCurrency(10000000, true);
    expect(result).toBe('₹1.00Cr');
  });

  it('does not compact values under 1000', () => {
    const result = formatCurrency(999, true);
    expect(result).toContain('₹');
    expect(result).not.toContain('K');
  });
});

// ============ formatChange ============
describe('formatChange', () => {
  it('formats positive change with up arrow', () => {
    const result = formatChange(45.20, 1.59);
    expect(result).toContain('▲');
    expect(result).toContain('45.20');
    expect(result).toContain('1.59');
  });

  it('formats negative change with down arrow', () => {
    const result = formatChange(-34.50, -0.88);
    expect(result).toContain('▼');
    expect(result).toContain('34.50');
    expect(result).toContain('0.88');
  });

  it('handles zero change', () => {
    const result = formatChange(0, 0);
    expect(result).toContain('▲');
    expect(result).toContain('0.00');
  });
});

// ============ formatPercent ============
describe('formatPercent', () => {
  it('formats positive percent with + sign', () => {
    expect(formatPercent(1.59)).toBe('+1.59%');
  });

  it('formats negative percent', () => {
    expect(formatPercent(-0.88)).toBe('-0.88%');
  });

  it('handles zero percent', () => {
    expect(formatPercent(0)).toBe('+0.00%');
  });

  it('formats large percent values', () => {
    expect(formatPercent(125.6)).toBe('+125.60%');
  });
});

// ============ formatNumber ============
describe('formatNumber', () => {
  it('formats number with Indian commas', () => {
    expect(formatNumber(1234567)).toBe('12,34,567');
  });

  it('formats small number without commas', () => {
    expect(formatNumber(999)).toBe('999');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

// ============ formatDate ============
describe('formatDate', () => {
  it('formats date string with default pattern', () => {
    const result = formatDate('2025-05-24');
    expect(result).toContain('May');
  });

  it('formats date with custom pattern', () => {
    const result = formatDate('2025-05-24', 'yyyy-MM-dd');
    expect(result).toBe('2025-05-24');
  });
});

// ============ formatTimeAgo ============
describe('formatTimeAgo', () => {
  it('returns relative time for recent date', () => {
    const result = formatTimeAgo(new Date().toISOString());
    expect(result).toContain('less than a minute ago');
  });

  it('handles dates far in the past', () => {
    const result = formatTimeAgo('2020-01-01');
    expect(result).toContain('ago');
  });
});

// ============ formatTimestamp ============
describe('formatTimestamp', () => {
  it('formats today timestamp with "Today" prefix', () => {
    const now = new Date().toISOString();
    const result = formatTimestamp(now);
    expect(result).toContain('Today');
  });

  it('formats yesterday timestamp with "Yesterday" prefix', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const result = formatTimestamp(yesterday);
    expect(result).toContain('Yesterday');
  });

  it('formats older date with date format', () => {
    const oldDate = '2025-01-15T10:00:00';
    const result = formatTimestamp(oldDate);
    expect(result).toContain('Jan');
  });
});

// ============ hexToRgba ============
describe('hexToRgba', () => {
  it('converts hex color to rgba', () => {
    expect(hexToRgba('#6C63FF', 0.5)).toBe('rgba(108,99,255,0.5)');
  });

  it('handles full opacity', () => {
    expect(hexToRgba('#00C853', 1)).toBe('rgba(0,200,83,1)');
  });

  it('handles zero opacity', () => {
    expect(hexToRgba('#FF1744', 0)).toBe('rgba(255,23,68,0)');
  });
});

// ============ formatCompactNumber ============
describe('formatCompactNumber', () => {
  it('formats thousands as K', () => {
    expect(formatCompactNumber(2500)).toBe('2.5K');
  });

  it('formats lakhs as L', () => {
    expect(formatCompactNumber(150000)).toBe('1.50L');
  });

  it('formats crores as Cr', () => {
    expect(formatCompactNumber(10000000)).toBe('1.00Cr');
  });

  it('keeps numbers under 1000 as-is', () => {
    expect(formatCompactNumber(999)).toBe('999');
  });
});

// ============ getChangeColor ============
describe('getChangeColor', () => {
  it('returns green for positive', () => {
    expect(getChangeColor(true)).toBe('#00C853');
  });

  it('returns red for negative', () => {
    expect(getChangeColor(false)).toBe('#FF1744');
  });
});

// ============ getGradientForChange ============
describe('getGradientForChange', () => {
  it('returns green gradient for positive', () => {
    const gradient = getGradientForChange(true);
    expect(gradient[0]).toBe('#00C853');
    expect(gradient[1]).toBe('#009624');
  });

  it('returns red gradient for negative', () => {
    const gradient = getGradientForChange(false);
    expect(gradient[0]).toBe('#FF1744');
    expect(gradient[1]).toBe('#D50000');
  });
});
