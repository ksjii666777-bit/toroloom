import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// TOROLOOM — Institutional-Grade Luxury Design System
// Deep Sapphire Black · Emerald Green · Electric Blue · Crimson Red
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  // Background — Deep midnight canvas
  bg: '#06080C',
  bgSecondary: '#0A0D14',
  bgCard: 'rgba(255,255,255,0.03)',
  bgCardLight: 'rgba(255,255,255,0.045)',
  bgInput: '#0A0D14',
  bgDark: '#040608',
  bgOverlay: 'rgba(6,8,12,0.85)',

  // Brand — Electric Blue
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#2563EB',
  primaryGradient: ['#3B82F6', '#1D4ED8'] as const,

  // Secondary — Rose Crimson for alerts
  secondary: '#FF5252',
  secondaryLight: '#FF8A80',
  secondaryGradient: ['#FF5252', '#D32F2F'] as const,

  // Accent — Muted Emerald for growth indicators
  accent: '#00E676',
  accentLight: '#69F0AE',
  accentGradient: ['#00E676', '#00C853'] as const,

  // Success / Risk
  success: '#00E676',
  successLight: '#69F0AE',
  danger: '#FF5252',
  dangerLight: '#FF8A80',
  warning: '#FFAB40',
  warningLight: '#FFD180',

  // Market — muted terminal palette
  marketUp: '#00E676',
  marketDown: '#FF5252',
  marketNeutral: '#FFAB40',

  // Text — Platinum Silver & Muted Slate
  text: '#E0E6ED',
  textSecondary: '#64748B',
  textMuted: '#475569',
  textDark: '#0A0D14',
  textOnPrimary: '#FFFFFF',

  // UI — Subtle micro-borders
  border: 'rgba(255,255,255,0.07)',
  borderLight: 'rgba(255,255,255,0.12)',
  divider: 'rgba(255,255,255,0.05)',
  shadow: '#000000',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Categories (kept for sector data — not container backgrounds)
  tech: '#3B82F6',
  finance: '#00E676',
  healthcare: '#FF5252',
  energy: '#FFAB40',
  consumer: '#8B5CF6',
  industrial: '#06B6D4',
};

export const LIGHT_COLORS = {
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#2563EB',
  primaryGradient: ['#3B82F6', '#1D4ED8'] as const,

  secondary: '#FF5252',
  secondaryLight: '#FF8A80',
  secondaryGradient: ['#FF5252', '#D32F2F'] as const,

  accent: '#00E676',
  accentLight: '#69F0AE',
  accentGradient: ['#00E676', '#00C853'] as const,

  success: '#00E676',
  successLight: '#69F0AE',
  danger: '#FF5252',
  dangerLight: '#FF8A80',
  warning: '#FFAB40',
  warningLight: '#FFD180',

  marketUp: '#00E676',
  marketDown: '#FF5252',
  marketNeutral: '#FFAB40',

  // Background — Light mode (crisp white)
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
  finance: '#00E676',
  healthcare: '#FF5252',
  energy: '#FFAB40',
  consumer: '#8B5CF6',
  industrial: '#06B6D4',
};

export type ThemeColors = typeof COLORS;

export const GRADIENTS = {
  // Interactive elements (buttons, CTAs) — kept for action, not containers
  primary: ['#3B82F6', '#1D4ED8'] as const,
  secondary: ['#FF5252', '#D32F2F'] as const,
  accent: ['#00E676', '#00C853'] as const,

  // Data accents (subdued, used only for emphasis on data)
  success: ['rgba(0,230,118,0.15)', 'rgba(0,200,83,0.08)'] as const,
  danger: ['rgba(255,82,82,0.15)', 'rgba(211,47,47,0.08)'] as const,
  warning: ['rgba(255,171,64,0.12)', 'rgba(255,143,0,0.06)'] as const,
  gold: ['rgba(255,171,64,0.12)', 'rgba(255,143,0,0.06)'] as const,

  // Glassmorphic card gradients (subtle, no solid colors)
  card: ['rgba(255,255,255,0.035)', 'rgba(255,255,255,0.015)'] as const,
  midnight: ['#06080C', '#0A0D14'] as const,

  // Thematic (for section backgrounds — low opacity)
  purple: ['rgba(139,92,246,0.10)', 'rgba(109,40,217,0.05)'] as const,
  emerald: ['rgba(0,230,118,0.10)', 'rgba(0,200,83,0.05)'] as const,
  electric: ['rgba(59,130,246,0.10)', 'rgba(99,102,241,0.05)'] as const,
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
