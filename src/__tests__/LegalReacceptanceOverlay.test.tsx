/**
 * ============================================================================
 * Toroloom — Legal Re-acceptance Overlay Tests
 * ============================================================================
 *
 * The overlay gates the whole app when the persisted ToS version differs
 * from LEGAL_DOCUMENT_VERSION:
 *   - Renders nothing while the consent store says hidden
 *   - Renders title/body + both actions when visible
 *   - "Review updates" navigates to the Legal screen (terms section) via
 *     navigationRef and does NOT dismiss by itself
 *   - "Accept" records re-acceptance through the real consent store —
 *     which persists the current version and hides the overlay
 *   - Modal is not dismissible via onRequestClose (mandatory acceptance)
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-test-renderer';
import { render } from './testUtils';

const { mockStorage, mockLogEvent, mockNavigateFromRef } = vi.hoisted(() => ({
  mockStorage: {} as Record<string, string>,
  mockLogEvent: vi.fn(),
  mockNavigateFromRef: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

vi.mock('../services/analytics', () => ({
  analytics: { logEvent: (...args: unknown[]) => mockLogEvent(...args) },
}));

vi.mock('../navigation/navigationRef', () => ({
  navigateFromRef: (...args: unknown[]) => mockNavigateFromRef(...args),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', bgCard: '#1A1A2E', border: '#2A2A44',
      bgOverlay: 'rgba(0,0,0,0.7)', bgInput: '#12121F', white: '#FFFFFF',
    },
  }),
}));

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      const strings: Record<string, string> = {
        'legal.reacceptanceTitle': 'Our terms have been updated',
        'legal.reacceptanceBody': 'Review the changes and accept to continue using Toroloom.',
        'legal.reacceptanceReview': 'Review updated terms',
        'legal.reacceptanceAccept': 'I accept the updated terms',
      };
      return strings[key] ?? key;
    },
  }),
}));

import LegalReacceptanceOverlay from '../components/LegalReacceptanceOverlay';
import {
  useLegalConsentStore,
  LEGAL_DOCUMENT_VERSION,
} from '../store/legalConsentStore';

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  useLegalConsentStore.setState({
    acceptedVersion: '2025-01-01',
    isConsentLoaded: true,
    isReacceptanceVisible: false,
    needsReacceptance: true,
  });
});

describe('LegalReacceptanceOverlay', () => {
  it('renders nothing while the overlay is hidden', () => {
    const { root } = render(<LegalReacceptanceOverlay />);
    expect(containsText(root, 'Our terms have been updated')).toBe(false);
  });

  it('renders title, body and both actions when visible', () => {
    useLegalConsentStore.setState({ isReacceptanceVisible: true });
    const { getByText } = render(<LegalReacceptanceOverlay />);
    expect(getByText('Our terms have been updated')).toBeDefined();
    expect(getByText('Review the changes and accept to continue using Toroloom.')).toBeDefined();
    expect(getByText('Review updated terms')).toBeDefined();
    expect(getByText('I accept the updated terms')).toBeDefined();
  });

  it('review button navigates to the Legal screen terms section via navigationRef', () => {
    useLegalConsentStore.setState({ isReacceptanceVisible: true });
    const { getByTestId } = render(<LegalReacceptanceOverlay />);
    act(() => {
      getByTestId('legal-reacceptance-review').props.onPress?.();
    });
    expect(mockNavigateFromRef).toHaveBeenCalledWith('Legal', { section: 'terms' });
    // Reviewing alone must not dismiss — acceptance is mandatory.
    expect(useLegalConsentStore.getState().isReacceptanceVisible).toBe(true);
  });

  it('accept records the current version through the store and hides the overlay', async () => {
    useLegalConsentStore.setState({ isReacceptanceVisible: true });
    const { getByTestId } = render(<LegalReacceptanceOverlay />);

    act(() => {
      getByTestId('legal-reacceptance-accept').props.onPress?.();
    });
    await act(async () => {});

    const s = useLegalConsentStore.getState();
    expect(s.acceptedVersion).toBe(LEGAL_DOCUMENT_VERSION);
    expect(s.isReacceptanceVisible).toBe(false);
    expect(s.needsReacceptance).toBe(false);
    expect(mockStorage['toroloom_legal_consent']).toBeDefined();
    expect(mockLogEvent).toHaveBeenCalledWith('legal_consent_accepted', {
      method: 'reacceptance',
      version: LEGAL_DOCUMENT_VERSION,
    });
  });

  it('modal onRequestClose is intentionally a no-op (mandatory acceptance)', () => {
    useLegalConsentStore.setState({ isReacceptanceVisible: true });
    const { root } = render(<LegalReacceptanceOverlay />);
    const modal = findModal(root);
    expect(modal).toBeDefined();
    const before = useLegalConsentStore.getState().isReacceptanceVisible;
    act(() => {
      modal.props.onRequestClose?.();
    });
    expect(useLegalConsentStore.getState().isReacceptanceVisible).toBe(before);
  });
});

/** Walk the tree to find the Modal element. */
function findModal(node: any): any {
  if (!node) return undefined;
  if (node.type === 'Modal' || node.props?.onRequestClose !== undefined) return node;
  for (const child of node.children ?? []) {
    const hit = findModal(child);
    if (hit) return hit;
  }
  return undefined;
}

/** True when any Text node in the subtree contains the given string. */
function containsText(node: any, needle: string): boolean {
  if (!node) return false;
  if (typeof node === 'string') return node.includes(needle);
  if (typeof node === 'object' && 'type' in node) {
    if ((node.children ?? []).some((c: any) => typeof c === 'string' && c.includes(needle))) {
      return true;
    }
  }
  return (node.children ?? []).some((c: any) => containsText(c, needle));
}
