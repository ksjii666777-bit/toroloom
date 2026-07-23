import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SkeletonBlock, SkeletonCard, SkeletonList, PortfolioSkeleton } from './SkeletonLoader';
import { SPACING } from '../../constants/theme';

/**
 * SkeletonLoader — loading placeholder components for shimmer effects.
 *
 * Four sub-components:
 * - `SkeletonBlock` — a single shimmering block (rect, circle, or text variant)
 * - `SkeletonCard` — a card with optional avatar, action, and configurable lines
 * - `SkeletonList` — a repeated list of SkeletonCard items
 * - `PortfolioSkeleton` — a full portfolio summary placeholder
 */

const meta: Meta<typeof SkeletonBlock> = {
  title: 'UI/SkeletonLoader',
  component: SkeletonBlock,
  tags: ['autodocs'],
  argTypes: {
    width: { control: 'text', description: 'Block width (number or % string)' },
    height: { control: 'number', description: 'Block height in px' },
    borderRadius: { control: 'number', description: 'Border radius in px' },
    variant: {
      control: 'select',
      options: ['rect', 'circle', 'text'],
      description: 'Shape variant (circle forces full roundness)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SkeletonBlock>;

// ─── SkeletonBlock ─────────────────────────────────────────────────────────

export const RectBlock: Story = {
  args: {
    width: 200,
    height: 120,
    variant: 'rect',
    borderRadius: 12,
  },
};

export const CircleBlock: Story = {
  args: {
    width: 60,
    height: 60,
    variant: 'circle',
  },
};

export const TextLine: Story = {
  args: {
    width: '60%',
    height: 14,
    variant: 'text',
    borderRadius: 4,
  },
};

export const WideTextLine: Story = {
  args: {
    width: '85%',
    height: 14,
    variant: 'text',
    borderRadius: 4,
  },
};

// ─── SkeletonCard (render functions) ───────────────────────────────────────

export const CardSimple: Story = {
  name: 'Card — Simple (2 lines, no avatar)',
  render: () => <SkeletonCard lines={2} hasAvatar={false} hasAction={false} />,
};

export const CardWithAvatar: Story = {
  name: 'Card — With Avatar',
  render: () => <SkeletonCard lines={2} hasAvatar hasAction={false} />,
};

export const CardWithAction: Story = {
  name: 'Card — With Action Button',
  render: () => <SkeletonCard lines={2} hasAvatar hasAction />,
};

export const CardFull: Story = {
  name: 'Card — Full (3 lines + Avatar + Action)',
  render: () => <SkeletonCard lines={3} hasAvatar hasAction />,
};

export const CardManyLines: Story = {
  name: 'Card — 5 Lines + Avatar',
  render: () => <SkeletonCard lines={5} hasAvatar hasAction={false} />,
};

// ─── SkeletonList (render functions) ───────────────────────────────────────

export const ListDefault: Story = {
  name: 'List — Default (5 items)',
  render: () => <SkeletonList count={5} />,
};

export const ListCompact: Story = {
  name: 'List — Compact (3 items, no avatars)',
  render: () => (
    <SkeletonList count={3} cardProps={{ hasAvatar: false, lines: 2 }} />
  ),
};

export const ListDetailed: Story = {
  name: 'List — Detailed (2 items, full)',
  render: () => (
    <SkeletonList count={2} cardProps={{ hasAvatar: true, hasAction: true, lines: 4 }} />
  ),
};

// ─── PortfolioSkeleton ─────────────────────────────────────────────────────

export const PortfolioSummary: Story = {
  name: 'Portfolio — Summary Card',
  render: () => <PortfolioSkeleton />,
};

// ─── All Variants Showcase ─────────────────────────────────────────────────

export const AllVariants: Story = {
  name: 'All Variants',
  render: () => (
    <ScrollView style={{ flex: 1 }}>
      <View style={{ gap: SPACING.lg, paddingBottom: 40 }}>

        <View>
          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Skeleton Blocks
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <SkeletonBlock width={60} height={60} variant="circle" />
            <SkeletonBlock width={120} height={80} variant="rect" borderRadius={12} />
            <SkeletonBlock width="30%" height={14} variant="text" borderRadius={4} />
          </View>
        </View>

        <View>
          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Skeleton Cards
          </Text>
          <SkeletonCard lines={3} hasAvatar hasAction />
          <View style={{ height: SPACING.sm }} />
          <SkeletonCard lines={2} hasAvatar={false} hasAction={false} />
        </View>

        <View>
          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Skeleton List
          </Text>
          <SkeletonList count={3} />
        </View>

        <View>
          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Portfolio Skeleton
          </Text>
          <PortfolioSkeleton />
        </View>

      </View>
    </ScrollView>
  ),
};
