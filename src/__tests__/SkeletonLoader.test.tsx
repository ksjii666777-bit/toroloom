/**
 * ============================================================================
 * Toroloom — SkeletonLoader Tests
 * ============================================================================
 *
 * Tests the skeleton loading components: SkeletonBlock (base building block),
 * SkeletonCard (composite card), SkeletonList (mapped list), and
 * PortfolioSkeleton (dashboard variant).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { SkeletonBlock, SkeletonCard, SkeletonList, PortfolioSkeleton } from '../components/ui/SkeletonLoader';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      bgCard: '#FFFFFF',
      bgCardLight: '#F0F2F8',
      border: '#E0E0F0',
      textMuted: '#9A9AB0',
    },
  }),
}));

describe('SkeletonBlock', () => {
  it('renders with default props', () => {
    const { toJSON } = render(<SkeletonBlock />);
    expect(toJSON).toBeDefined();
  });

  it('renders with custom width and height', () => {
    const { toJSON } = render(<SkeletonBlock width={120} height={40} />);
    expect(toJSON).toBeDefined();
  });

  it('renders with circle variant', () => {
    const { toJSON } = render(<SkeletonBlock variant="circle" width={48} height={48} />);
    expect(toJSON).toBeDefined();
  });

  it('renders with text variant', () => {
    const { toJSON } = render(<SkeletonBlock variant="text" width="80%" height={14} />);
    expect(toJSON).toBeDefined();
  });

  it('renders with custom borderRadius', () => {
    const { toJSON } = render(<SkeletonBlock width={100} height={30} borderRadius={16} />);
    expect(toJSON).toBeDefined();
  });
});

describe('SkeletonCard', () => {
  it('renders with default props (3 lines, avatar)', () => {
    const { toJSON } = render(<SkeletonCard />);
    expect(toJSON).toBeDefined();
  });

  it('renders with more lines', () => {
    const { toJSON } = render(<SkeletonCard lines={4} />);
    expect(toJSON).toBeDefined();
  });

  it('renders without avatar', () => {
    const { toJSON } = render(<SkeletonCard hasAvatar={false} />);
    expect(toJSON).toBeDefined();
  });

  it('renders with action button', () => {
    const { toJSON } = render(<SkeletonCard hasAction={true} />);
    expect(toJSON).toBeDefined();
  });
});

describe('SkeletonList', () => {
  it('renders default count of 5 cards', () => {
    const { toJSON } = render(<SkeletonList />);
    expect(toJSON).toBeDefined();
  });

  it('renders custom count', () => {
    const { toJSON } = render(<SkeletonList count={3} />);
    expect(toJSON).toBeDefined();
  });

  it('renders with custom card props', () => {
    const { toJSON } = render(
      <SkeletonList count={2} cardProps={{ hasAvatar: false, hasAction: true }} />
    );
    expect(toJSON).toBeDefined();
  });
});

describe('PortfolioSkeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<PortfolioSkeleton />);
    expect(toJSON).toBeDefined();
  });
});
