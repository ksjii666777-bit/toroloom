import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = { // dark theme
  // Primary
  primary: '#6C63FF',
  primaryLight: '#8B83FF',
  primaryDark: '#4A42CC',
  primaryGradient: ['#6C63FF', '#4834D4'] as const,

  // Secondary
  secondary: '#FF6B6B',
  secondaryLight: '#FF8E8E',
  secondaryGradient: ['#FF6B6B', '#EE5A24'] as const,

  // Accent
  accent: '#00D2FF',
  accentLight: '#33DDFF',
  accentGradient: ['#00D2FF', '#3A7BD5'] as const,

  // Success / Risk
  success: '#00C853',
  successLight: '#69F0AE',
  danger: '#FF1744',
  dangerLight: '#FF5252',
  warning: '#FFC107',
  warningLight: '#FFD54F',

  // Market
  marketUp: '#00C853',
  marketDown: '#FF1744',
  marketNeutral: '#FFC107',

  // Background
  bg: '#0D0D2B',
  bgSecondary: '#1A1A3E',
  bgCard: '#222255',
  bgCardLight: '#2A2A5E',
  bgInput: '#1E1E4A',
  bgDark: '#070720',
  bgOverlay: 'rgba(0,0,0,0.5)',

  // Text
  text: '#FFFFFF',
  textSecondary: '#B0B0D0',
  textMuted: '#6E6E9A',
  textDark: '#1A1A2E',
  textOnPrimary: '#FFFFFF',

  // UI
  border: '#2A2A5E',
  borderLight: '#3A3A7E',
  divider: '#1E1E4A',
  shadow: '#000000',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Categories
  tech: '#00D2FF',
  finance: '#6C63FF',
  healthcare: '#FF6B6B',
  energy: '#FFC107',
  consumer: '#FF9800',
  industrial: '#4CAF50',
};

export const LIGHT_COLORS = {
  // Primary - same brand colors
  primary: '#6C63FF',
  primaryLight: '#8B83FF',
  primaryDark: '#4A42CC',
  primaryGradient: ['#6C63FF', '#4834D4'] as const,

  // Secondary
  secondary: '#FF6B6B',
  secondaryLight: '#FF8E8E',
  secondaryGradient: ['#FF6B6B', '#EE5A24'] as const,

  // Accent
  accent: '#00D2FF',
  accentLight: '#33DDFF',
  accentGradient: ['#00D2FF', '#3A7BD5'] as const,

  // Success / Risk
  success: '#00C853',
  successLight: '#69F0AE',
  danger: '#FF1744',
  dangerLight: '#FF5252',
  warning: '#FFC107',
  warningLight: '#FFD54F',

  // Market
  marketUp: '#00C853',
  marketDown: '#FF1744',
  marketNeutral: '#FFC107',

  // Background - Light mode
  bg: '#F4F5FA',
  bgSecondary: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardLight: '#F0F2F8',
  bgInput: '#F0F2F8',
  bgDark: '#E8EAF0',
  bgOverlay: 'rgba(0,0,0,0.3)',

  // Text - Dark on light bg
  text: '#1A1A2E',
  textSecondary: '#5A5A7A',
  textMuted: '#9A9AB0',
  textDark: '#1A1A2E',
  textOnPrimary: '#FFFFFF',

  // UI
  border: '#E0E0F0',
  borderLight: '#D0D0E8',
  divider: '#E8E8F0',
  shadow: '#1A1A2E',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Categories
  tech: '#00D2FF',
  finance: '#6C63FF',
  healthcare: '#FF6B6B',
  energy: '#FFC107',
  consumer: '#FF9800',
  industrial: '#4CAF50',
};

export type ThemeColors = typeof COLORS;

export const GRADIENTS = {
  primary: ['#6C63FF', '#4834D4'] as const,
  secondary: ['#FF6B6B', '#EE5A24'] as const,
  accent: ['#00D2FF', '#3A7BD5'] as const,
  success: ['#00C853', '#009624'] as const,
  danger: ['#FF1744', '#D50000'] as const,
  warning: ['#FFC107', '#FF8F00'] as const,
  card: ['#222255', '#1A1A3E'] as const,
  gold: ['#FFD700', '#FFA000'] as const,
  midnight: ['#0D0D2B', '#1A1A3E'] as const,
  purple: ['#6C63FF', '#9C27B0'] as const,
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

export const FONTS = {
  thin: { fontFamily: 'System', fontWeight: '100' as const },
  light: { fontFamily: 'System', fontWeight: '300' as const },
  regular: { fontFamily: 'System', fontWeight: '400' as const },
  medium: { fontFamily: 'System', fontWeight: '500' as const },
  semiBold: { fontFamily: 'System', fontWeight: '600' as const },
  bold: { fontFamily: 'System', fontWeight: '700' as const },
  extraBold: { fontFamily: 'System', fontWeight: '800' as const },
  black: { fontFamily: 'System', fontWeight: '900' as const },
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

export const SHADOWS = {
  small: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  large: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 6,
  }),
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
