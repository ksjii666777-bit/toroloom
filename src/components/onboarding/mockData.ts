/**
 * Mock data for onboarding demo components.
 * Extracted from OnboardingScreen.tsx to reduce file size.
 */

export const MOCK_BROKERS = [
  { id: 'zerodha', label: 'Zerodha', tagline: "India's biggest stock broker", icon: 'Z', color: '#2874F0', gradient: ['#2874F0', '#1A5FCC'] as const },
  { id: 'angel', label: 'Angel One', tagline: "India's largest retail broking house", icon: 'A', color: '#FF6B00', gradient: ['#FF6B00', '#CC5500'] as const },
  { id: 'groww', label: 'Groww', tagline: 'Simple, modern investing platform', icon: 'G', color: '#00A86B', gradient: ['#00A86B', '#008050'] as const },
];

export const MOCK_SECTORS = [
  { name: 'Tech', value: 45, color: '#3B82F6', icon: 'hardware-chip' },
  { name: 'Finance', value: 25, color: '#00E676', icon: 'wallet' },
  { name: 'Energy', value: 18, color: '#FFAB40', icon: 'flame' },
  { name: 'Health', value: 12, color: '#FF5252', icon: 'medkit' },
];

export const MOCK_CANDLE_DATA = [
  { date: 'Mon', open: 100, high: 108, low: 98, close: 106, volume: 1200 },
  { date: 'Tue', open: 106, high: 112, low: 104, close: 110, volume: 1500 },
  { date: 'Wed', open: 110, high: 115, low: 107, close: 108, volume: 1000 },
  { date: 'Thu', open: 108, high: 118, low: 106, close: 116, volume: 1800 },
  { date: 'Fri', open: 116, high: 122, low: 114, close: 120, volume: 2200 },
  { date: 'Sat', open: 120, high: 125, low: 118, close: 124, volume: 1600 },
  { date: 'Sun', open: 124, high: 130, low: 122, close: 128, volume: 2000 },
];

export const MOCK_BADGES = [
  { id: 'first-trade', icon: '🎯', label: 'First Trade', color: '#3B82F6' },
  { id: 'streak-3', icon: '🔥', label: '3-Day Streak', color: '#FFAB40' },
  { id: 'course-beginner', icon: '📘', label: 'Learner', color: '#10B981' },
  { id: 'market-pro', icon: '📊', label: 'Market Pro', color: '#8B5CF6' },
];
