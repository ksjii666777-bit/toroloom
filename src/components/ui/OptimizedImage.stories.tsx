import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import OptimizedImage from './OptimizedImage';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';

/**
 * OptimizedImage — a drop-in replacement for React Native Image with
 * CDN-optimized URLs (WebP, resize, quality), fade-in animation,
 * placeholder shimmer, lazy loading, and error state with retry.
 *
 * Supports preset sizes, custom dimensions, and aspect ratio mode.
 */
const meta: Meta<typeof OptimizedImage> = {
  title: 'UI/OptimizedImage',
  component: OptimizedImage,
  tags: ['autodocs'],
  argTypes: {
    preset: {
      control: 'select',
      options: ['thumbnail', 'small', 'medium', 'large', 'hero'],
      description: 'Size preset for CDN optimization',
    },
    resizeMode: {
      control: 'select',
      options: ['cover', 'contain', 'stretch', 'center'],
      description: 'Image resize mode',
    },
    showPlaceholder: { control: 'boolean' },
    lazy: { control: 'boolean' },
    aspectRatio: { control: 'number' },
    borderRadius: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof OptimizedImage>;

// ─── Sample image URL ──────────────────────────────────────────────────────

const SAMPLE_IMAGE =
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80';

const SAMPLE_IMAGE_2 =
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80';

// ─── Default ───────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    source: SAMPLE_IMAGE,
    preset: 'medium',
    style: { width: 300, height: 200 },
    alt: 'Stock market chart',
  },
};

// ─── Presets Grid ──────────────────────────────────────────────────────────

const presetSizes: { key: string; width: number; height: number }[] = [
  { key: 'thumbnail', width: 60, height: 60 },
  { key: 'small', width: 120, height: 90 },
  { key: 'medium', width: 200, height: 150 },
  { key: 'large', width: 280, height: 200 },
];

export const Presets: Story = {
  name: 'Size Presets',
  render: () => (
    <View style={{ gap: SPACING.md }}>
      {presetSizes.map(({ key, width, height }) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <OptimizedImage
            source={SAMPLE_IMAGE}
            preset={key as any}
            style={{ width, height }}
            alt={`${key} preset`}
          />
          <View>
            <Text style={{ color: '#E0E6ED', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
              {key}
            </Text>
            <Text style={{ color: '#64748B', fontSize: 11 }}>
              {width} × {height}
            </Text>
          </View>
        </View>
      ))}
    </View>
  ),
};

// ─── With Aspect Ratio ─────────────────────────────────────────────────────

export const WithAspectRatio: Story = {
  args: {
    source: SAMPLE_IMAGE,
    width: 300,
    aspectRatio: 16 / 9,
    alt: '16:9 aspect ratio image',
  },
};

// ─── Round (Avatar) ────────────────────────────────────────────────────────

export const RoundAvatar: Story = {
  name: 'Round (Avatar)',
  args: {
    source: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80',
    preset: 'thumbnail',
    style: { width: 64, height: 64 },
    borderRadius: 32,
    alt: 'User avatar',
    resizeMode: 'cover',
  },
};

// ─── Custom Border Radius ──────────────────────────────────────────────────

export const CustomBorderRadius: Story = {
  args: {
    source: SAMPLE_IMAGE_2,
    preset: 'medium',
    style: { width: 280, height: 180 },
    borderRadius: 24,
    alt: 'Rounded image',
  },
};

// ─── Contain Mode ──────────────────────────────────────────────────────────

export const ContainMode: Story = {
  args: {
    source: SAMPLE_IMAGE,
    preset: 'medium',
    style: { width: 200, height: 200 },
    resizeMode: 'contain',
    alt: 'Image in contain mode',
  },
};

// ─── Lazy Loading ──────────────────────────────────────────────────────────

export const LazyLoading: Story = {
  args: {
    source: SAMPLE_IMAGE,
    preset: 'large',
    style: { width: 300, height: 200 },
    lazy: true,
    alt: 'Lazy loaded image',
  },
};

// ─── No Placeholder ────────────────────────────────────────────────────────

export const NoPlaceholder: Story = {
  args: {
    source: SAMPLE_IMAGE_2,
    preset: 'medium',
    style: { width: 280, height: 180 },
    showPlaceholder: false,
    alt: 'Image without placeholder shimmer',
  },
};

// ─── Error State ───────────────────────────────────────────────────────────

export const ErrorState: Story = {
  name: 'Error State (broken URL)',
  args: {
    source: 'https://invalid-url.example.com/image.jpg',
    preset: 'medium',
    style: { width: 280, height: 180 },
    alt: 'Broken image shows error state',
  },
};

// ─── All States Grid ───────────────────────────────────────────────────────

export const AllStates: Story = {
  name: 'All States',
  render: () => (
    <View style={{ gap: SPACING.md }}>
      <OptimizedImage
        source={SAMPLE_IMAGE}
        preset="medium"
        style={{ width: '100%', height: 140 }}
        alt="Loaded image example"
      />
      <OptimizedImage
        source="https://invalid-url.example.com/image.jpg"
        preset="medium"
        style={{ width: '100%', height: 80 }}
        alt="Error state example"
      />
      <OptimizedImage
        source={SAMPLE_IMAGE_2}
        preset="small"
        style={{ width: '100%', height: 80 }}
        lazy
        alt="Lazy loaded example"
      />
    </View>
  ),
};
