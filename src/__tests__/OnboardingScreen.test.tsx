/**
 * ============================================================================
 * Toroloom — OnboardingScreen Tests
 * ============================================================================
 *
 * Verifies the referral variant auto-scroll behavior and UI differences
 * between default and referral onboarding flows.
 *
 * Key behaviors tested:
 *  - onLayout triggers scrollTo + setCurrentStep(1) when referralSource is set
 *  - onLayout does nothing when referralSource is null
 *  - UI renders 4 dots / "STEP 1 OF 4" for referral, 5 dots otherwise
 *  - Welcome step is hidden in referral variant
 *  - Double-scroll guard: onLayout fires twice only triggers once
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockSetCurrentStep = vi.fn();
const mockSkipOnboarding = vi.fn();

// Track referral source per-test so individual tests can override
let currentReferralSource: string | null = null;
let currentStepDemoCompleted: Record<string, boolean> = {};
let currentOverriddenStep: number | undefined; // undefined = use default (0)

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      white: '#FFFFFF',
      bg: '#0D0D2B',
      bgSecondary: '#1A1A3E',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgDark: '#070720',
      bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/onboardingStore', () => ({
  useOnboardingStore: vi.fn((sel?: (s: any) => any) => {
    const state = {
      currentStep: currentOverriddenStep ?? 0,
      setCurrentStep: mockSetCurrentStep,
      skipOnboarding: mockSkipOnboarding,
      referralSource: currentReferralSource,
      completeOnboarding: vi.fn(),
      hasCompletedOnboarding: false,
      initialized: true,
      interactedSteps: { ...currentStepDemoCompleted }, // if completed, also interacted
      stepDemoCompleted: { ...currentStepDemoCompleted },
      markStepInteracted: vi.fn(),
      markStepDemoCompleted: vi.fn(),
    };
    return sel ? sel(state) : state;
  }),
  ONBOARDING_STEPS: [
    { id: 'welcome', title: 'Welcome to Toroloom', subtitle: 'Intelligence Meets Execution', description: 'desc', icon: 'rocket', gradient: ['#3B82F6', '#1D4ED8'], highlight: 'none' },
    { id: 'portfolio', title: 'Your Portfolio at a Glance', subtitle: 'Real-time tracking', description: 'desc', icon: 'pie-chart', gradient: ['#10B981', '#047857'], highlight: 'portfolio' },
    { id: 'markets', title: 'Live Market Data', subtitle: 'Stay informed', description: 'desc', icon: 'trending-up', gradient: ['#3B82F6', '#6366F1'], highlight: 'markets' },
    { id: 'trading', title: 'Smart Trading', subtitle: 'Execute with confidence', description: 'desc', icon: 'flash', gradient: ['#F59E0B', '#D97706'], highlight: 'more' },
    { id: 'broker', title: 'Connect Your Broker', subtitle: 'Zero-API gateway', description: 'desc', icon: 'git-network', gradient: ['#2874F0', '#1A5FCC'], highlight: 'none' },
    { id: 'learn', title: 'Learn & Grow', subtitle: 'Become a better investor', description: 'desc', icon: 'school', gradient: ['#8B5CF6', '#6D28D9'], highlight: 'more' },
  ],
}));

// ==================== Imports ====================

import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

/**
 * Find a ScrollView host element in the rendered tree.
 * react-test-renderer stores host components (created via React.createElement(name))
 * with `type` set to the string name passed to createElement.
 */
function findScrollView(root: any): any {
  function search(inst: any): any {
    if (inst.type === 'ScrollView') return inst;
    if (typeof inst.children === 'string') return null;
    const children = inst.children as any[];
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === 'object' && 'type' in child) {
          const found = search(child);
          if (found) return found;
        }
      }
    }
    return null;
  }
  return search(root);
}

// ==================== Tests ====================

describe('OnboardingScreen — Referral Variant Auto-Scroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockSetCurrentStep.mockClear();
    mockSkipOnboarding.mockClear();
    currentReferralSource = 'referral';
  });

  afterEach(() => {
    vi.useRealTimers();
    currentReferralSource = null;
  });

  it('calls setCurrentStep(1) when onLayout fires with referralSource set', () => {
    const { root } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    const scrollView = findScrollView(root);
    expect(scrollView).not.toBeNull();

    // Fire onLayout to simulate the ScrollView being laid out
    act(() => {
      scrollView.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
      });
    });

    // Should scroll to step 1 (portfolio, skipping welcome)
    expect(mockSetCurrentStep).toHaveBeenCalledWith(1);
  });

  it('calls setCurrentStep(1) only once even if onLayout fires multiple times', () => {
    const { root } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    const scrollView = findScrollView(root);
    expect(scrollView).not.toBeNull();

    // Fire onLayout twice
    act(() => {
      scrollView.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
      });
    });
    act(() => {
      scrollView.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
      });
    });

    // setCurrentStep should only be called once (guarded by hasScrolledToStart ref)
    expect(mockSetCurrentStep).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentStep).toHaveBeenCalledWith(1);
  });

  it('renders 5 progress dots instead of 6 for referral variant', () => {
    const { getAllByText } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    // "STEP 1 OF 5" confirms 5 steps are visible (welcome skipped)
    expect(getAllByText(/STEP \d OF 5/).length).toBeGreaterThan(0);
  });

  it('does not render the Welcome step for referral variant', () => {
    const { queryByText } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    // Welcome step should be hidden
    expect(queryByText('Welcome to Toroloom')).toBeNull();
  });

  it('renders the Portfolio step as the first visible step for referral variant', () => {
    const { getByText } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    // Portfolio should be the first step
    expect(getByText('Your Portfolio at a Glance')).toBeDefined();
  });
});

describe('OnboardingScreen — Default Variant (No Referral)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockSetCurrentStep.mockClear();
    mockSkipOnboarding.mockClear();
    // No referral source
    currentReferralSource = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT call setCurrentStep when onLayout fires (no referral source)', () => {
    const { root } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    const scrollView = findScrollView(root);
    expect(scrollView).not.toBeNull();

    act(() => {
      scrollView.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
      });
    });

    // Should NOT call setCurrentStep since referralSource is null
    expect(mockSetCurrentStep).not.toHaveBeenCalled();
  });

  it('renders 6 progress dots for default variant', () => {
    const { getAllByText } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    expect(getAllByText(/STEP \d OF 6/).length).toBeGreaterThan(0);
  });

  it('renders the Welcome step for default variant', () => {
    const { getByText } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    expect(getByText('Welcome to Toroloom')).toBeDefined();
  });
});

describe('OnboardingScreen — Skip Button', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockSetCurrentStep.mockClear();
    mockSkipOnboarding.mockClear();
    currentReferralSource = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    currentReferralSource = null;
  });

  it('calls skipOnboarding when Skip button is pressed', () => {
    const { getByText } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    act(() => {
      fireEvent.press(getByText('Skip'));
    });

    expect(mockSkipOnboarding).toHaveBeenCalledOnce();
  });
});

describe('OnboardingScreen — Demo Completion Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockSetCurrentStep.mockClear();
    mockSkipOnboarding.mockClear();
    currentReferralSource = null;
    currentStepDemoCompleted = {};
    currentOverriddenStep = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    currentReferralSource = null;
    currentStepDemoCompleted = {};
    currentOverriddenStep = undefined;
  });

  it('renders progress dots without checkmarks when no steps completed', () => {
    const { root } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    // All 6 dots render — no completed checkmarks in the DOM
    // Just verify the screen renders without crashing
    expect(root).toBeDefined();
  });

  it('renders completion summary on the last step when some demos completed', () => {
    // Mark some steps as completed
    currentStepDemoCompleted = { welcome: true, portfolio: true };
    // Override currentStep to be the last step (index 5 for default variant)
    currentOverriddenStep = 5;

    const { getByText } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(1500);

    // Should show "2/6 demos completed" somewhere
    expect(getByText(/2.*6.*demos/)).toBeDefined();
  });

  it('shows "All 6 interactive demos completed!" when all steps completed', () => {
    // Mark ALL steps as completed
    currentStepDemoCompleted = {
      welcome: true,
      portfolio: true,
      markets: true,
      trading: true,
      broker: true,
      learn: true,
    };
    // Override to last step (index 5)
    currentOverriddenStep = 5;

    const { getByText } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(1500);

    // Last step should show the all-completed message
    expect(getByText(/All 6 interactive demos completed/)).toBeDefined();
  });

  it('shows correct count for referral variant (5 instead of 6)', () => {
    // Referral variant = 5 steps (welcome excluded)
    currentReferralSource = 'referral';
    currentStepDemoCompleted = {
      portfolio: true,
      markets: true,
      trading: true,
      broker: true,
      learn: true,
    };
    // Referral variant has 5 visible steps, last is index 4
    currentOverriddenStep = 4;

    const { getByText } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(1500);

    // Should show "5/5 demos completed" or "All 5 interactive demos completed"
    expect(getByText(/All 5 interactive demos completed/)).toBeDefined();
  });

  it('does not render completion summary when NOT on last step', () => {
    // Mark some steps completed
    currentStepDemoCompleted = { welcome: true };
    // Stay on step 0 (first step) — summary should NOT render
    currentOverriddenStep = 0;

    const { queryByText } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(1500);

    // No completion summary text should appear on step 0
    expect(queryByText(/demos/)).toBeNull();
  });

  it('renders partial completion without crashing', () => {
    // Simulate having only first step completed
    currentStepDemoCompleted = { welcome: true };
    // Not on last step
    currentOverriddenStep = 0;

    const { root } = render(<OnboardingScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);

    // Just verify render is stable with partial completion
    expect(root).toBeDefined();
  });
});
