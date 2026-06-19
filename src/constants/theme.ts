import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// TOROLOOM — Institutional-Grade Luxury Design System
// Deep Sapphire Black · Emerald Green · Electric Blue · Crimson Red
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  // Background
  bg: '#0B0F19',
  bgSecondary: '#0E121D',
  bgCard: '#111827',
  bgCardLight: '#1A2235',
  bgInput: '#0F131E',
  bgDark: '#070A11',
  bgOverlay: 'rgba(7, 10, 17, 0.85)',

  // Brand — Sovereign Premium
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#2563EB',
  primaryGradient: ['#3B82F6', '#1D4ED8'] as const,

  // Secondary
  secondary: '#EF4444',
  secondaryLight: '#F87171',
  secondaryGradient: ['#EF4444', '#DC2626'] as const,

  // Accent — Emerald for growth
  accent: '#10B981',
  accentLight: '#34D399',
  accentGradient: ['#10B981', '#059669'] as const,

  // Success / Risk
  success: '#10B981',
  successLight: '#6EE7B7',
  danger: '#EF4444',
  dangerLight: '#FCA5A5',
  warning: '#F59E0B',
  warningLight: '#FCD34D',

  // Market
  marketUp: '#10B981',
  marketDown: '#EF4444',
  marketNeutral: '#F59E0B',

  // Text
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textDark: '#111827',
  textOnPrimary: '#FFFFFF',

  // UI — Crisp 1px borders
  border: '#1F2937',
  borderLight: '#374151',
  divider: '#1E293B',
  shadow: '#000000',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Categories
  tech: '#3B82F6',
  finance: '#10B981',
  healthcare: '#EF4444',
  energy: '#F59E0B',
  consumer: '#8B5CF6',
  industrial: '#06B6D4',
};

export const LIGHT_COLORS = {
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#2563EB',
  primaryGradient: ['#3B82F6', '#1D4ED8'] as const,

  secondary: '#EF4444',
  secondaryLight: '#F87171',
  secondaryGradient: ['#EF4444', '#DC2626'] as const,

  accent: '#10B981',
  accentLight: '#34D399',
  accentGradient: ['#10B981', '#059669'] as const,

  success: '#10B981',
  successLight: '#6EE7B7',
  danger: '#EF4444',
  dangerLight: '#FCA5A5',
  warning: '#F59E0B',
  warningLight: '#FCD34D',

  marketUp: '#10B981',
  marketDown: '#EF4444',
  marketNeutral: '#F59E0B',

  // Background — Light mode
  bg: '#F8FAFC',
  bgSecondary: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardLight: '#F1F5F9',
  bgInput: '#F1F5F9',
  bgDark: '#E2E8F0',
  bgOverlay: 'rgba(15, 23, 42, 0.3)',

  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textDark: '#0F172A',
  textOnPrimary: '#FFFFFF',

  border: '#E2E8F0',
  borderLight: '#CBD5E1',
  divider: '#E2E8F0',
  shadow: '#0F172A',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  tech: '#3B82F6',
  finance: '#10B981',
  healthcare: '#EF4444',
  energy: '#F59E0B',
  consumer: '#8B5CF6',
  industrial: '#06B6D4',
};

export type ThemeColors = typeof COLORS;

export const GRADIENTS = {
  primary: ['#3B82F6', '#1D4ED8'] as const,
  secondary: ['#EF4444', '#DC2626'] as const,
  accent: ['#10B981', '#059669'] as const,
  success: ['#10B981', '#047857'] as const,
  danger: ['#EF4444', '#B91C1C'] as const,
  warning: ['#F59E0B', '#D97706'] as const,
  card: ['#111827', '#0E121D'] as const,
  gold: ['#F59E0B', '#D97706'] as const,
  midnight: ['#0B0F19', '#111827'] as const,
  purple: ['#8B5CF6', '#6D28D9'] as const,
  emerald: ['#10B981', '#047857'] as const,
  electric: ['#3B82F6', '#6366F1'] as const,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

// Unified geometric typography with Inter font family + explicit tracking and line-height
// Fonts are loaded asynchronously via @expo-google-fonts/inter in App.tsx (useLoadFonts hook).
export const FONTS = {
  thin: { fontFamily: 'Inter-Thin', fontWeight: '100' as const, letterSpacing: 0.5 },
  light: { fontFamily: 'Inter-Light', fontWeight: '300' as const, letterSpacing: 0.3 },
  regular: { fontFamily: 'Inter-Regular', fontWeight: '400' as const, letterSpacing: 0.2 },
  medium: { fontFamily: 'Inter-Medium', fontWeight: '500' as const, letterSpacing: 0.15 },
  semiBold: { fontFamily: 'Inter-SemiBold', fontWeight: '600' as const, letterSpacing: 0.1 },
  bold: { fontFamily: 'Inter-Bold', fontWeight: '700' as const, letterSpacing: 0.05 },
  extraBold: { fontFamily: 'Inter-ExtraBold', fontWeight: '800' as const, letterSpacing: 0 },
  black: { fontFamily: 'Inter-Black', fontWeight: '900' as const, letterSpacing: -0.5 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '400' as const, letterSpacing: 0 },
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    xxxl: 24,
    title: 28,
    hero: 32,
    display: 40,
  },
};

export const LINE_HEIGHTS = {
  tight: 1.15,
  normal: 1.4,
  relaxed: 1.6,
};

export const SHADOWS = {
  small: {
    boxShadow: '0px 1px 2px rgba(0,0,0,0.3)',
    elevation: 2,
  },
  medium: {
    boxShadow: '0px 4px 8px rgba(0,0,0,0.4)',
    elevation: 5,
  },
  large: {
    boxShadow: '0px 8px 24px rgba(0,0,0,0.5)',
    elevation: 8,
  },
  glow: (color: string) => ({
    boxShadow: `0px 0px 20px ${color}40`,
    elevation: 6,
  }),
  inner: {
    boxShadow: 'inset 0px 2px 4px rgba(0,0,0,0.2)',
    elevation: 0,
  },
};

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
};

export const ICON_SIZE = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
  huge: 40,
};

export const SCREEN = { width, height };
export const IS_SMALL_DEVICE = width < 375;
