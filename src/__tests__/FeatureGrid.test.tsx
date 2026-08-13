/**
 * ============================================================================
 * Toroloom — FeatureGrid Tests
 * ============================================================================
 *
 * Covers the responsive tile grid:
 *   - Item rendering (labels + icons)
 *   - Column count calculation (explicit prop, width breakpoints, font scale)
 *   - Label truncation (2-line max, tail ellipsis)
 *   - Badge rendering (shown when set, hidden when absent)
 *   - Disabled state (accessibility + press passthrough)
 *   - Tone → background mapping
 *   - Press callback wiring
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Dimensions, Text } from 'react-native';
import { FeatureGrid, FeatureItem } from '../components/patterns/FeatureGrid';
import { render, fireEvent } from './testUtils';

// ==================== Mock ThemeContext ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#05070D',
      surfaceElevated: '#141824',
      primaryDim: 'rgba(59,130,246,0.14)',
      successDim: 'rgba(34,197,94,0.14)',
      dangerDim: 'rgba(239,68,68,0.14)',
      warningDim: 'rgba(245,158,11,0.14)',
      borderSubtle: 'rgba(255,255,255,0.06)',
      textSecondary: '#94A3B8',
      danger: '#EF4444',
    },
  }),
}));

// ==================== Dimensions spy ====================
// FeatureGrid reads width/fontScale from useWindowDimensions(), which the
// shared react-native mock routes through Dimensions.get('window').

let dims = { width: 390, height: 844, scale: 3, fontScale: 1 };
let dimsSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  dims = { width: 390, height: 844, scale: 3, fontScale: 1 };
  dimsSpy = vi.spyOn(Dimensions, 'get').mockImplementation(() => dims);
});

afterEach(() => {
  dimsSpy?.mockRestore();
});

// ==================== Test data ====================

const items: FeatureItem[] = [
  {
    key: 'trade',
    label: 'Trade',
    icon: <Text>⚡</Text>,
    onPress: () => {},
  },
  {
    key: 'portfolio',
    label: 'Portfolio',
    icon: <Text>📊</Text>,
    onPress: () => {},
  },
  {
    key: 'watchlist',
    label: 'Watchlist',
    icon: <Text>⭐</Text>,
    onPress: () => {},
  },
  {
    key: 'markets',
    label: 'Markets',
    icon: <Text>📈</Text>,
    onPress: () => {},
  },
];

// Host elements only (type === string). findAll also yields composite
// instances (the Dummy component fn), which double-count every node.
const isHost = (n: any) => typeof n.type === 'string';

function tileByLabel(root: any, label: string) {
  return root.findAll(
    (inst: any) => isHost(inst) && inst.props?.accessibilityLabel === label
  )[0];
}

function resolveTileStyle(tile: any) {
  // style is a function ({pressed}) => [...] in the real component.
  const style = tile.props?.style;
  return typeof style === 'function' ? style({ pressed: false }) : style;
}

function flexBasisOf(tile: any): string | undefined {
  const style = resolveTileStyle(tile);
  const list = Array.isArray(style) ? style : [style];
  for (const s of list) {
    if (s && typeof s === 'object' && s.flexBasis != null) return String(s.flexBasis);
  }
  return undefined;
}

/** True when a style array describes the badge View (absolute + minWidth 18). */
function badgeStyle(style: any): boolean {
  const list = Array.isArray(style) ? style : [style];
  return list.some(
    (s: any) => s && typeof s === 'object' && s.position === 'absolute' && s.minWidth === 18
  );
}

// ==================== Tests ====================

describe('FeatureGrid', () => {
  it('renders every item label and icon', () => {
    const { root, getByText } = render(<FeatureGrid items={items} />);
    expect(getByText('Trade')).toBeDefined();
    expect(getByText('Portfolio')).toBeDefined();
    expect(getByText('Watchlist')).toBeDefined();
    expect(getByText('Markets')).toBeDefined();
    // 4 tiles rendered (host Pressable elements only)
    expect(
      root.findAll((n: any) => isHost(n) && n.props?.accessibilityRole === 'button')
    ).toHaveLength(4);
  });

  // ── Column calculation ────────────────────────────────────────────

  it('defaults to 3 columns on phones (width 390)', () => {
    const { root } = render(<FeatureGrid items={items} />);
    expect(flexBasisOf(tileByLabel(root, 'Trade'))).toBe(`${100 / 3}%`);
    expect(flexBasisOf(tileByLabel(root, 'Markets'))).toBe(`${100 / 3}%`);
  });

  it('uses 4 columns on tablets (width >= 600)', () => {
    dims = { ...dims, width: 700 };
    const { root } = render(<FeatureGrid items={items} />);
    expect(flexBasisOf(tileByLabel(root, 'Trade'))).toBe('25%');
  });

  it('respects an explicit columns prop over responsive defaults', () => {
    dims = { ...dims, width: 700 };
    const { root } = render(<FeatureGrid items={items} columns={2} />);
    expect(flexBasisOf(tileByLabel(root, 'Trade'))).toBe('50%');
  });

  it('falls back to 3 columns when fontScale is large, even on tablets', () => {
    dims = { width: 700, height: 844, scale: 3, fontScale: 1.3 };
    const { root } = render(<FeatureGrid items={items} />);
    expect(flexBasisOf(tileByLabel(root, 'Trade'))).toBe(`${100 / 3}%`);
  });

  it('recomputes columns when the window changes', () => {
    const { root, update } = render(<FeatureGrid items={items} />);
    expect(flexBasisOf(tileByLabel(root, 'Trade'))).toBe(`${100 / 3}%`);
    dims = { width: 700, height: 844, scale: 3, fontScale: 1 };
    act(() => {
      update(<FeatureGrid items={items} />);
    });
    expect(flexBasisOf(tileByLabel(root, 'Trade'))).toBe('25%');
  });

  // ── Label truncation ───────────────────────────────────────────────

  it('clamps labels to 2 lines with tail ellipsis', () => {
    const { root } = render(<FeatureGrid items={items} />);
    const labelText = root.findAll(
      (n: any) => isHost(n) && n.type === 'Text' && n.props?.numberOfLines === 2
    );
    expect(labelText).toHaveLength(items.length);
    for (const t of labelText) {
      expect(t.props.ellipsizeMode).toBe('tail');
    }
  });

  // ── Badges ─────────────────────────────────────────────────────────

  it('renders the badge when badge is set (number)', () => {
    const withBadge = [...items, {
      key: 'alerts',
      label: 'Alerts',
      icon: <Text>🔔</Text>,
      onPress: () => {},
      badge: 3,
    }];
    const { getByText } = render(<FeatureGrid items={withBadge} />);
    expect(getByText('3')).toBeDefined();
  });

  it('renders the badge when badge is a string', () => {
    const withBadge = [...items, {
      key: 'alerts',
      label: 'Alerts',
      icon: <Text>🔔</Text>,
      onPress: () => {},
      badge: 'New',
    }];
    const { getByText } = render(<FeatureGrid items={withBadge} />);
    expect(getByText('New')).toBeDefined();
  });

  it('does not render a badge when badge is absent', () => {
    const { root, getByText } = render(<FeatureGrid items={items} />);
    expect(getByText('Trade')).toBeDefined();
    // Badge host View = absolute, minWidth 18. Assert NONE exist.
    const badges = root.findAll((n: any) => isHost(n) && badgeStyle(n.props?.style));
    expect(badges).toHaveLength(0);
  });

  it('renders a badge for 0 (the component checks `badge != null`)', () => {
    const withZero = [...items, {
      key: 'alerts',
      label: 'Alerts',
      icon: <Text>🔔</Text>,
      onPress: () => {},
      badge: 0,
    }];
    const { root, getByText } = render(<FeatureGrid items={withZero} />);
    expect(getByText('Alerts')).toBeDefined();
    // 0 is not null → badge renders (draft behavior: `item.badge != null`)
    expect(getByText('0')).toBeDefined();
    const badges = root.findAll((n: any) => isHost(n) && badgeStyle(n.props?.style));
    expect(badges).toHaveLength(1);
  });

  // ── Disabled state ─────────────────────────────────────────────────

  it('marks disabled tiles via accessibilityState', () => {
    const withDisabled = [
      ...items,
      {
        key: 'locked',
        label: 'Premium Only',
        icon: <Text>🔒</Text>,
        onPress: () => {},
        disabled: true,
      },
    ];
    const { root } = render(<FeatureGrid items={withDisabled} />);
    const locked = tileByLabel(root, 'Premium Only');
    expect(locked).toBeDefined();
    expect(locked.props.accessibilityState?.disabled).toBe(true);
    expect(locked.props.disabled).toBe(true);
    // Enabled tiles are NOT disabled
    expect(tileByLabel(root, 'Trade').props.accessibilityState?.disabled).toBe(false);
  });

  it('wires disabled state onto the Pressable (native Pressable swallows presses)', () => {
    const onPress = vi.fn();
    const withDisabled: FeatureItem[] = [
      {
        key: 'locked',
        label: 'Locked',
        icon: <Text>🔒</Text>,
        onPress,
        disabled: true,
      },
    ];
    const { root } = render(<FeatureGrid items={withDisabled} />);
    const locked = tileByLabel(root, 'Locked');
    // The Dummy Pressable mock forwards all props; the real RN Pressable
    // uses `disabled` + accessibilityState to swallow presses natively.
    expect(locked.props.disabled).toBe(true);
    expect(locked.props.accessibilityState?.disabled).toBe(true);
    expect(locked.props.onPress).toBe(onPress);
  });

  it('fires onPress for an enabled tile', () => {
    const onPress = vi.fn();
    const single: FeatureItem[] = [{
      key: 'trade',
      label: 'Trade',
      icon: <Text>⚡</Text>,
      onPress,
    }];
    const { root } = render(<FeatureGrid items={single} />);
    fireEvent.press(tileByLabel(root, 'Trade'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // ── testID passthrough (needed for Maestro E2E flows) ─────────────

  it('forwards testID to the tile Pressable', () => {
    const withTestIds: FeatureItem[] = [
      { key: 'markets', label: 'Markets', icon: <Text>📈</Text>, onPress: () => {}, testID: 'home-quick-markets' },
      { key: 'learn', label: 'Learn', icon: <Text>🎓</Text>, onPress: () => {}, testID: 'home-quick-learn' },
    ];
    const { root } = render(<FeatureGrid items={withTestIds} />);
    expect(tileByLabel(root, 'Markets').props.testID).toBe('home-quick-markets');
    expect(tileByLabel(root, 'Learn').props.testID).toBe('home-quick-learn');
  });

  // ── Tone mapping ──────────────────────────────────────────────────

  it('maps each tone to the theme background (per-tile association)', () => {
    const tones = ['neutral', 'accent', 'positive', 'negative', 'warning'] as const;
    const expectedBg: Record<(typeof tones)[number], string> = {
      neutral: '#141824',                    // surfaceElevated
      accent: 'rgba(59,130,246,0.14)',       // primaryDim
      positive: 'rgba(34,197,94,0.14)',      // successDim
      negative: 'rgba(239,68,68,0.14)',      // dangerDim
      warning: 'rgba(245,158,11,0.14)',      // warningDim
    };
    const toned: FeatureItem[] = tones.map((tone) => ({
      key: tone,
      label: tone,
      icon: <Text>●</Text>,
      onPress: () => {},
      tone,
    }));
    const { root } = render(<FeatureGrid items={toned} />);
    for (const tone of tones) {
      const tile = tileByLabel(root, tone);
      expect(tile).toBeDefined();
      // The iconBox is the first host View child of the tile.
      const iconBox = root.findAll(
        (n: any) =>
          isHost(n) &&
          n.props?.style &&
          Array.isArray(n.props.style) &&
          n.props.style.some((s: any) => s && s.width === 52 && s.height === 52) &&
          n.props.style.some((s: any) => s && s.backgroundColor === expectedBg[tone])
      );
      expect(iconBox.length).toBeGreaterThan(0);
    }
  });
});
