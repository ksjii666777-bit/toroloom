/**
 * ============================================================================
 * Toroloom — LearnScreen Frozen Navigation Object Regression Tests
 * ============================================================================
 *
 * Verifies that LearnScreen does NOT crash with the error:
 *   "You attempted to set the key 'current' with the value 'undefined' on
 *    an object that is meant to be immutable and has been frozen."
 *
 * Fix: Switched LearnScreen from react-native's Animated.View to reanimated's
 * Animated.View for continueStyles[i] and courseStyles[i].
 *
 * These tests simulate React Navigation v7 dev-mode behaviour by passing
 * Object.freeze()-d navigation objects into LearnScreen.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-test-renderer';
import { render, fireEvent } from './testUtils';

// ==================== Mocks ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', bgCard: '#1A1A2E',
      bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44',
      bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      danger: '#FF1744', white: '#FFFFFF', success: '#00C853',
    },
  }),
}));

const mockNavigate = vi.fn();

const defaultCourses = [
  { id: 'c1', title: 'Stock Market Basics', thumbnail: '\uD83D\uDCC8', level: 'beginner', duration: '2 hours', lessons: 10, enrolledCount: 15420, rating: 4.7, progress: 30 },
  { id: 'c2', title: 'Technical Analysis', thumbnail: '\uD83D\uDCCA', level: 'intermediate', duration: '4 hours', lessons: 8, enrolledCount: 8900, rating: 4.5, progress: 0 },
  { id: 'c3', title: 'Advanced Trading Strategies', thumbnail: '\uD83C\uDFAF', level: 'advanced', duration: '6 hours', lessons: 12, enrolledCount: 3200, rating: 4.8, progress: 100 },
];

let mockStoreState: any = {};

vi.mock('../store/educationStore', () => ({
  useEducationStore: () => mockStoreState,
}));

// Must be imported AFTER mocks
import LearnScreen from '../screens/tabs/LearnScreen';

// ==================== Helpers ====================

function renderWithTimeTravel(jsx: React.ReactElement) {
  vi.useFakeTimers();
  const result = render(jsx);
  act(() => { vi.advanceTimersByTime(600); });
  return { ...result, cleanup: () => { result.unmount(); vi.useRealTimers(); } };
}

function createFrozenNavigation() {
  return Object.freeze({
    navigate: mockNavigate,
    canGoBack: true,
    goBack: vi.fn(),
    getId: () => 'Learn',
    getState: () =>
      Object.freeze({
        key: 'Learn',
        name: 'Learn',
        params: {},
        routes: [],
        index: 0,
        stale: false,
        type: 'tab',
      }),
  });
}

// ==================== Tests ====================

describe('LearnScreen — Frozen Navigation Object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = { courses: defaultCourses };
  });

  describe('render resilience with frozen navigation', () => {
    it('renders without crashing when navigation is a frozen object', () => {
      const frozenNav = createFrozenNavigation();
      const { toJSON, cleanup } = renderWithTimeTravel(
        <LearnScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders without crashing when navigation state is deeply frozen', () => {
      const state = Object.freeze({
        key: 'Learn',
        name: 'Learn',
        params: Object.freeze({}),
        routes: Object.freeze([]),
      });
      const frozenNav = Object.freeze({
        navigate: mockNavigate,
        getState: () => state,
        getId: () => 'Learn',
      });
      const { toJSON, cleanup } = renderWithTimeTravel(
        <LearnScreen navigation={frozenNav as any} />,
      );
      expect(toJSON()).toBeTruthy();
      cleanup();
    });

    it('renders full content with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <LearnScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Learning Hub')).toBeDefined();
      expect(getByText('Master the markets, one lesson at a time')).toBeDefined();
      expect(getByText('All Courses')).toBeDefined();
      expect(getByText('Continue Learning')).toBeDefined();
      cleanup();
    });

    it('renders course titles with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <LearnScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Stock Market Basics')).toBeDefined();
      expect(getByText('Technical Analysis')).toBeDefined();
      expect(getByText('Advanced Trading Strategies')).toBeDefined();
      cleanup();
    });

    it('renders course level badges with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <LearnScreen navigation={frozenNav as any} />,
      );
      expect(getByText('beginner')).toBeDefined();
      expect(getByText('intermediate')).toBeDefined();
      expect(getByText('advanced')).toBeDefined();
      cleanup();
    });

    it('renders progress percentages with frozen navigation', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <LearnScreen navigation={frozenNav as any} />,
      );
      expect(getByText('30% complete')).toBeDefined();
      cleanup();
    });
  });

  describe('frozen object mutation detection', () => {
    it('does NOT attempt to set properties on frozen navigation during mount', () => {
      const frozenNav = createFrozenNavigation();
      expect(() => {
        renderWithTimeTravel(<LearnScreen navigation={frozenNav as any} />);
      }).not.toThrow();
    });

    it('does NOT mutate frozen navigation after re-render', () => {
      const frozenNav = createFrozenNavigation();
      const { update, cleanup } = renderWithTimeTravel(
        <LearnScreen navigation={frozenNav as any} />,
      );
      expect(() => {
        update(<LearnScreen navigation={frozenNav as any} />);
      }).not.toThrow();
      cleanup();
    });

    it('handles mount with frozen navigation then unmounts gracefully', () => {
      const frozenNav = createFrozenNavigation();
      const { unmount } = renderWithTimeTravel(
        <LearnScreen navigation={frozenNav as any} />,
      );
      expect(() => { unmount(); }).not.toThrow();
    });
  });

  describe('navigation still works through frozen object', () => {
    it('navigates to CourseDetail when a course is pressed', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <LearnScreen navigation={frozenNav as any} />,
      );
      fireEvent.press(getByText('Stock Market Basics'));
      expect(mockNavigate).toHaveBeenCalledWith('CourseDetail', {
        courseId: 'c1',
        course: defaultCourses[0],
      });
      cleanup();
    });

    it('does not navigate without explicit interaction', () => {
      const frozenNav = createFrozenNavigation();
      const { getByText, cleanup } = renderWithTimeTravel(
        <LearnScreen navigation={frozenNav as any} />,
      );
      expect(getByText('Learning Hub')).toBeDefined();
      expect(mockNavigate).not.toHaveBeenCalled();
      cleanup();
    });
  });
});
