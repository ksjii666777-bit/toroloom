/**
 * ============================================================================
 * Toroloom — Legal Consent Store Tests
 * ============================================================================
 *
 * Covers the ToS version-tracking lifecycle:
 *   - Initial state (nothing accepted, not loaded)
 *   - loadConsent: restores a persisted record, flags re-acceptance when the
 *     stored version differs from LEGAL_DOCUMENT_VERSION, handles empty +
 *     corrupt storage
 *   - accept: persists { version, acceptedAt }, updates state, hides the
 *     overlay, emits the analytics event with the right method
 *   - showReacceptance / hideReacceptance gating on needsReacceptance
 *   - resetConsent: GDPR erasure path (storage wipe + state reset)
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStorage, mockLogEvent } = vi.hoisted(() => ({
  mockStorage: {} as Record<string, string>,
  mockLogEvent: vi.fn(),
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

import {
  useLegalConsentStore,
  LEGAL_DOCUMENT_VERSION,
  getLegalConsent,
} from '../store/legalConsentStore';

describe('legalConsentStore', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    mockLogEvent.mockClear();
    useLegalConsentStore.setState({
      acceptedVersion: null,
      isConsentLoaded: false,
      isReacceptanceVisible: false,
      needsReacceptance: false,
    });
  });

  describe('initial state', () => {
    it('starts with nothing accepted and consent not loaded', () => {
      expect(useLegalConsentStore.getState().acceptedVersion).toBeNull();
      expect(useLegalConsentStore.getState().isConsentLoaded).toBe(false);
      expect(useLegalConsentStore.getState().needsReacceptance).toBe(false);
      expect(useLegalConsentStore.getState().isReacceptanceVisible).toBe(false);
    });

    it('exposes the current document version', () => {
      expect(LEGAL_DOCUMENT_VERSION).toBe('2026-01-01');
    });
  });

  describe('loadConsent', () => {
    it('restores a persisted current-version record with no re-acceptance needed', async () => {
      mockStorage['toroloom_legal_consent'] = JSON.stringify({
        version: LEGAL_DOCUMENT_VERSION,
        acceptedAt: '2026-06-01T00:00:00.000Z',
      });

      await useLegalConsentStore.getState().loadConsent();

      const s = useLegalConsentStore.getState();
      expect(s.acceptedVersion).toBe(LEGAL_DOCUMENT_VERSION);
      expect(s.isConsentLoaded).toBe(true);
      expect(s.needsReacceptance).toBe(false);
    });

    it('flags re-acceptance when the stored version is outdated', async () => {
      mockStorage['toroloom_legal_consent'] = JSON.stringify({
        version: '2025-01-01',
        acceptedAt: '2025-06-01T00:00:00.000Z',
      });

      await useLegalConsentStore.getState().loadConsent();

      const s = useLegalConsentStore.getState();
      expect(s.acceptedVersion).toBe('2025-01-01');
      expect(s.isConsentLoaded).toBe(true);
      expect(s.needsReacceptance).toBe(true);
    });

    it('handles empty storage as never accepted', async () => {
      await useLegalConsentStore.getState().loadConsent();

      const s = useLegalConsentStore.getState();
      expect(s.acceptedVersion).toBeNull();
      expect(s.isConsentLoaded).toBe(true);
      expect(s.needsReacceptance).toBe(false);
    });

    it('treats a corrupt record as never accepted', async () => {
      mockStorage['toroloom_legal_consent'] = '{not json';

      await useLegalConsentStore.getState().loadConsent();

      const s = useLegalConsentStore.getState();
      expect(s.acceptedVersion).toBeNull();
      expect(s.isConsentLoaded).toBe(true);
      expect(s.needsReacceptance).toBe(false);
    });
  });

  describe('accept', () => {
    it('persists the current version and updates state', async () => {
      await useLegalConsentStore.getState().accept('signup');

      const s = useLegalConsentStore.getState();
      expect(s.acceptedVersion).toBe(LEGAL_DOCUMENT_VERSION);
      expect(s.isConsentLoaded).toBe(true);
      expect(s.needsReacceptance).toBe(false);

      const raw = JSON.parse(mockStorage['toroloom_legal_consent']);
      expect(raw.version).toBe(LEGAL_DOCUMENT_VERSION);
      expect(typeof raw.acceptedAt).toBe('string');
    });

    it('emits the analytics event with method and version', async () => {
      await useLegalConsentStore.getState().accept('signup');
      expect(mockLogEvent).toHaveBeenCalledWith('legal_consent_accepted', {
        method: 'signup',
        version: LEGAL_DOCUMENT_VERSION,
      });

      mockLogEvent.mockClear();
      await useLegalConsentStore.getState().accept('reacceptance');
      expect(mockLogEvent).toHaveBeenCalledWith('legal_consent_accepted', {
        method: 'reacceptance',
        version: LEGAL_DOCUMENT_VERSION,
      });
    });

    it('hides the re-acceptance overlay and clears the flag on accept', async () => {
      useLegalConsentStore.setState({
        needsReacceptance: true,
        isReacceptanceVisible: true,
        acceptedVersion: '2025-01-01',
      });

      await useLegalConsentStore.getState().accept('reacceptance');

      const s = useLegalConsentStore.getState();
      expect(s.isReacceptanceVisible).toBe(false);
      expect(s.needsReacceptance).toBe(false);
      expect(s.acceptedVersion).toBe(LEGAL_DOCUMENT_VERSION);
    });
  });

  describe('showReacceptance / hideReacceptance', () => {
    it('shows only when re-acceptance is needed', () => {
      useLegalConsentStore.setState({ needsReacceptance: false });
      useLegalConsentStore.getState().showReacceptance();
      expect(useLegalConsentStore.getState().isReacceptanceVisible).toBe(false);

      useLegalConsentStore.setState({ needsReacceptance: true });
      useLegalConsentStore.getState().showReacceptance();
      expect(useLegalConsentStore.getState().isReacceptanceVisible).toBe(true);
    });

    it('hides without touching the needsReacceptance flag', () => {
      useLegalConsentStore.setState({ needsReacceptance: true, isReacceptanceVisible: true });
      useLegalConsentStore.getState().hideReacceptance();

      const s = useLegalConsentStore.getState();
      expect(s.isReacceptanceVisible).toBe(false);
      expect(s.needsReacceptance).toBe(true);
    });
  });

  describe('resetConsent (GDPR erasure)', () => {
    it('wipes storage and resets state', async () => {
      await useLegalConsentStore.getState().accept('signup');
      expect(mockStorage['toroloom_legal_consent']).toBeDefined();

      useLegalConsentStore.getState().resetConsent();

      const s = useLegalConsentStore.getState();
      expect(s.acceptedVersion).toBeNull();
      expect(s.isReacceptanceVisible).toBe(false);
      expect(s.needsReacceptance).toBe(false);
      expect(s.isConsentLoaded).toBe(true);
    });
  });

  describe('getLegalConsent helper', () => {
    it('returns null before acceptance and a record after', async () => {
      expect(getLegalConsent()).toBeNull();

      await useLegalConsentStore.getState().accept('signup');
      expect(getLegalConsent()?.version).toBe(LEGAL_DOCUMENT_VERSION);
    });
  });
});
