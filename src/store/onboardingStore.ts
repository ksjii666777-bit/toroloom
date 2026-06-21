import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from '../services/analytics';

// ============================================================================
// Onboarding Step Definitions
// ============================================================================

export interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  gradient: [string, string];
  highlight?: 'home' | 'markets' | 'portfolio' | 'more' | 'none';
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Toroloom',
    subtitle: 'Intelligence Meets Execution',
    description:
      'Your all-in-one platform for smart investing. Track markets, manage your portfolio, get AI-powered insights, and execute trades — all from one place.',
    icon: 'rocket',
    gradient: ['#3B82F6', '#1D4ED8'] as [string, string],
    highlight: 'none',
  },
  {
    id: 'portfolio',
    title: 'Your Portfolio at a Glance',
    subtitle: 'Real-time tracking',
    description:
      'Monitor your investments with real-time P&L tracking, interactive charts, sector allocation analysis, and performance metrics. Never miss a beat with live price updates.',
    icon: 'pie-chart',
    gradient: ['#10B981', '#047857'] as [string, string],
    highlight: 'portfolio',
  },
  {
    id: 'markets',
    title: 'Live Market Data',
    subtitle: 'Stay informed',
    description:
      'Access real-time stock prices, market indices, candlestick charts with technical indicators (RSI, MACD, Bollinger Bands), and AI-powered insights to make informed decisions.',
    icon: 'trending-up',
    gradient: ['#3B82F6', '#6366F1'] as [string, string],
    highlight: 'markets',
  },
  {
    id: 'trading',
    title: 'Smart Trading',
    subtitle: 'Execute with confidence',
    description:
      'Place market, limit, and SL orders with ease. Set up price alerts, manage open orders, and track your trade history. Multi-broker support for Zerodha and Angel One.',
    icon: 'flash',
    gradient: ['#F59E0B', '#D97706'] as [string, string],
    highlight: 'more',
  },
  {
    id: 'learn',
    title: 'Learn & Grow',
    subtitle: 'Become a better investor',
    description:
      'Access a growing library of financial courses, interactive quizzes, and AI-driven insights. Connect with the community, share ideas, and earn badges as you progress.',
    icon: 'school',
    gradient: ['#8B5CF6', '#6D28D9'] as [string, string],
    highlight: 'more',
  },
];

// ============================================================================
// Store Interface
// ============================================================================

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  isFirstLaunch: boolean;
  initialized: boolean;
  /** Set to 'referral' when user signed up via referral link — skips welcome step */
  referralSource: string | null;

  // Actions
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  setCurrentStep: (step: number) => void;
  loadOnboardingState: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  /** Mark onboarding as referred — causes the welcome step to be skipped */
  setReferralSource: (source: string) => void;
}

export const useOnboardingStore = create<OnboardingState>((set, _get) => ({
  hasCompletedOnboarding: false,
  currentStep: 0,
  isFirstLaunch: true,
  initialized: false,
  referralSource: null,

  loadOnboardingState: async () => {
    try {
      const stored = await AsyncStorage.getItem('toroloom_onboarding');
      if (stored) {
        const parsed = JSON.parse(stored);
        const completed = parsed.completed || false;
        set({
          hasCompletedOnboarding: completed,
          isFirstLaunch: false,
          initialized: true,
        });
        // Re-set user property on reload so Firebase has the latest value
        if (completed) {
          analytics.setUserProperty(
            'onboarding_status',
            parsed.skipped ? 'skipped' : 'completed'
          ).catch(() => {});
        }
      } else {
        set({ isFirstLaunch: true, hasCompletedOnboarding: false, initialized: true });
      }
    } catch {
      set({ isFirstLaunch: true, hasCompletedOnboarding: false, initialized: true });
    }
  },

  completeOnboarding: async () => {
    try {
      await AsyncStorage.setItem(
        'toroloom_onboarding',
        JSON.stringify({ completed: true, completedAt: new Date().toISOString() })
      );
      set({ hasCompletedOnboarding: true, isFirstLaunch: false });

      // Track completion in analytics
      analytics.logEvent('onboarding_completed', { completed: true }).catch(() => {});
      analytics.setUserProperty('onboarding_status', 'completed').catch(() => {});
    } catch {
      set({ hasCompletedOnboarding: true, isFirstLaunch: false });
    }
  },

  skipOnboarding: async () => {
    try {
      await AsyncStorage.setItem(
        'toroloom_onboarding',
        JSON.stringify({ completed: true, skipped: true, completedAt: new Date().toISOString() })
      );
      set({ hasCompletedOnboarding: true, isFirstLaunch: false });

      // Track skip in analytics
      analytics.logEvent('onboarding_completed', { completed: true, skipped: true }).catch(() => {});
      analytics.setUserProperty('onboarding_status', 'skipped').catch(() => {});
    } catch {
      set({ hasCompletedOnboarding: true, isFirstLaunch: false });
    }
  },

  setCurrentStep: (step: number) => {
    set({ currentStep: Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, step)) });
  },

  /** Mark onboarding as referred — next time onboarding renders, it skips the welcome step */
  setReferralSource: (source: string) => {
    set({ referralSource: source, currentStep: 1 });

    // Track referral variant start in analytics
    analytics.logEvent('onboarding_started', {
      source,
      variant: 'referral',
    }).catch(() => {});
    analytics.setUserProperty('referral_source', source).catch(() => {});
  },

  /** Reset onboarding so the navigator shows the walkthrough again */
  resetOnboarding: async () => {
    try {
      await AsyncStorage.removeItem('toroloom_onboarding');
      set({ hasCompletedOnboarding: false, currentStep: 0, isFirstLaunch: false, initialized: true });

      // Track replay in analytics
      analytics.logEvent('onboarding_completed', { completed: false, replay: true }).catch(() => {});
      analytics.setUserProperty('onboarding_status', 'replay').catch(() => {});
    } catch {
      set({ hasCompletedOnboarding: false, currentStep: 0, isFirstLaunch: false, initialized: true });
    }
  },
}));
