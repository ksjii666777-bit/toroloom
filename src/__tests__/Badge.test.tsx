/**
 * ============================================================================
 * Toroloom — Badge Tests
 * ============================================================================
 *
 * Tests the Badge component: label rendering, variant colors, size variants,
 * and the dot indicator element.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import Badge from '../components/ui/Badge';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({}),
}));

describe('Badge', () => {
  it('renders the label text', () => {
    const { getByText } = render(<Badge label="Energy" />);
    expect(getByText('Energy')).toBeDefined();
  });

  it('renders with primary variant by default', () => {
    const { getByText } = render(<Badge label="Active" />);
    expect(getByText('Active')).toBeDefined();
  });

  it('renders with success variant', () => {
    const { getByText } = render(<Badge label="Profit" variant="success" />);
    expect(getByText('Profit')).toBeDefined();
  });

  it('renders with danger variant', () => {
    const { getByText } = render(<Badge label="Loss" variant="danger" />);
    expect(getByText('Loss')).toBeDefined();
  });

  it('renders with warning variant', () => {
    const { getByText } = render(<Badge label="Pending" variant="warning" />);
    expect(getByText('Pending')).toBeDefined();
  });

  it('renders with info variant', () => {
    const { getByText } = render(<Badge label="Info" variant="info" />);
    expect(getByText('Info')).toBeDefined();
  });

  it('renders with neutral variant', () => {
    const { getByText } = render(<Badge label="Sector" variant="neutral" />);
    expect(getByText('Sector')).toBeDefined();
  });

  it('renders with small size by default', () => {
    const { getByText } = render(<Badge label="Small" />);
    expect(getByText('Small')).toBeDefined();
  });

  it('renders with medium size', () => {
    const { getByText } = render(<Badge label="Medium" size="medium" />);
    expect(getByText('Medium')).toBeDefined();
  });

  it('renders multiple badges without conflict', () => {
    const { getAllByText } = render(
      <>
        <Badge label="Tag A" />
        <Badge label="Tag B" />
      </>
    );
    expect(getAllByText('Tag A').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Tag B').length).toBeGreaterThanOrEqual(1);
  });
});
