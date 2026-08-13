import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Text, View } from 'react-native';
import AppScreen from './AppScreen';
import Button from './Button';
import Card from './Card';
import { SPACING } from '../../constants/theme';

/**
 * AppScreen — the shared screen scaffold.
 *
 * Owns safe-area insets, status bar, bottom chrome padding (tab bar / home
 * indicator), optional pull-to-refresh, pinned header/footer chrome, and
 * tablet centering. Every screen should render inside it.
 */
const meta: Meta<typeof AppScreen> = {
  title: 'UI/AppScreen',
  component: AppScreen,
  tags: ['autodocs'],
  argTypes: {
    scroll: { control: 'boolean' },
    hasTabBar: { control: 'boolean' },
    bottomInsetExtra: { control: 'number' },
    padded: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof AppScreen>;

// ─── Basic ─────────────────────────────────────────────────────────────────

export const Basic: Story = {
  args: {
    children: (
      <View style={{ gap: SPACING.md }}>
        <Card title="Welcome" subtitle="A minimal scrolling screen">
          <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
            AppScreen provides the background, safe-area padding, and
            scroll container so screens can focus on content.
          </Text>
        </Card>
      </View>
    ),
  },
};

// ─── Pinned Header ─────────────────────────────────────────────────────────

export const WithHeader: Story = {
  name: 'With Pinned Header',
  args: {
    header: (
      <View
        style={{
          padding: SPACING.lg,
          backgroundColor: '#0F1420',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700' }}>
          Portfolio Analytics
        </Text>
        <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>
          Pinned header — content scrolls underneath it
        </Text>
      </View>
    ),
    children: (
      <View style={{ gap: SPACING.md }}>
        <Card title="PnL" subtitle="This month">
          <Text style={{ color: '#E0E6ED', fontSize: 14 }}>+₹2,37,300 (+19.1%)</Text>
        </Card>
        <Card title="Holdings" subtitle="Scroll this list">
          <Text style={{ color: '#E0E6ED', fontSize: 14 }}>RELIANCE · TCS · HDFCBANK</Text>
        </Card>
      </View>
    ),
  },
};

// ─── Sticky Footer CTA ─────────────────────────────────────────────────────

export const WithFooter: Story = {
  name: 'With Sticky Footer CTA',
  args: {
    footer: (
      <Button title="Place Order" variant="primary" onPress={() => {}} />
    ),
    children: (
      <View style={{ gap: SPACING.md }}>
        <Card title="Order Ticket" subtitle="RELIANCE · NSE">
          <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
            Quantity 10 @ ₹2,890 = ₹28,900
          </Text>
        </Card>
        <Card title="Margin Required" subtitle="CNC · Intraday">
          <Text style={{ color: '#E0E6ED', fontSize: 14 }}>₹28,900</Text>
        </Card>
      </View>
    ),
  },
};

// ─── Pull To Refresh ───────────────────────────────────────────────────────

export const WithPullToRefresh: Story = {
  name: 'With Pull-To-Refresh',
  args: {
    refreshing: false,
    onRefresh: () => {},
    children: (
      <View style={{ gap: SPACING.md }}>
        <Card title="Live Prices" subtitle="Pull down to refresh">
          <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
            RefreshControl is wired to tintColor/colors tokens from the theme.
          </Text>
        </Card>
      </View>
    ),
  },
};

// ─── Scroll Disabled ───────────────────────────────────────────────────────

export const ScrollDisabled: Story = {
  name: 'Scroll Disabled',
  args: {
    scroll: false,
    children: (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
          Fixed, non-scrolling layout — good for modals and steppers.
        </Text>
      </View>
    ),
  },
};

// ─── Backdrop Overlay ──────────────────────────────────────────────────────

export const WithOverlay: Story = {
  name: 'With Backdrop Overlay',
  args: {
    overlay: (
      <View
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(3,6,12,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ backgroundColor: '#121826', borderRadius: 12, padding: SPACING.lg }}>
          <Text style={{ color: '#F8FAFC', fontSize: 14 }}>Focused search overlay</Text>
        </View>
      </View>
    ),
    children: (
      <Card title="Markets" subtitle="Tap anywhere to dismiss">
        <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
          The overlay prop renders an absolutely-positioned backdrop above the
          scroll body — used for search focus, filters, or modals.
        </Text>
      </Card>
    ),
  },
};

// ─── Full Showcase ─────────────────────────────────────────────────────────

export const AllVariants: Story = {
  name: 'All Variants',
  render: () => (
    <View style={{ gap: SPACING.lg }}>
      <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Basic scroll
      </Text>
      <AppScreen>
        <Card title="Scrolling screen" subtitle="Standard usage">
          <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
            Default padding, bottom inset, and keyboard handling applied.
          </Text>
        </Card>
      </AppScreen>

      <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Tab bar screen
      </Text>
      <AppScreen hasTabBar>
        <Card title="Inside a tab" subtitle="hasTabBar=true">
          <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
            Bottom padding accounts for the tab bar height, not the inset.
          </Text>
        </Card>
      </AppScreen>
    </View>
  ),
};
