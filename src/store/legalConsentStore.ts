/**
 * ============================================================================
 * Toroloom — Legal Consent Store
 * ============================================================================
 *
 * Tracks which version of the Terms of Service / Privacy Policy the user has
 * accepted, and whether the app is showing a re-acceptance prompt.
 *
 * Design:
 *   - `LEGAL_DOCUMENT_VERSION` is bumped whenever legal content meaningfully
 *     changes (new clauses, changed broker/fee terms, policy updates). The
 *     re-acceptance overlay appears for every user whose stored acceptance
 *     predates the bump.
 *   - Acceptance is recorded at SIGNUP (explicit checkbox) and re-confirmed
 *     via the re-acceptance overlay when the version changes.
 *   - `accept` is idempotent and persists to AsyncStorage — safe to call from
 *     both signup and the overlay.
 *
 * Storage keys (also referenced by GDPR erasure in GDPRScreen):
 *   toroloom_legal_consent   — JSON { version, acceptedAt }
 *
 * Analytics:
 *   `legal_consent_accepted` (broadened AnalyticsEvents entry) — emitted on
 *   first acceptance (method: 'signup') and on re-acceptance (method: 'reacceptance').
 * ============================================================================
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from '../services/analytics';

/**
 * Bump this whenever legal content changes meaningfully.
 * Format: ISO date of the change (UTC). Template content ships as 2026-01-01;
 * replace with the real version when lawyer-reviewed copy lands.
 */
export const LEGAL_DOCUMENT_VERSION = '2026-01-01';

const STORAGE_KEY = 'toroloom_legal_consent';

export interface LegalConsentRecord {
  /** Version string of the accepted document set */
  version: string;
  /** ISO timestamp of acceptance */
  acceptedAt: string;
}

interface LegalConsentState {
  /** Version the user last accepted; null = never accepted */
  acceptedVersion: string | null;
  /** True once loadConsent() has run (prevents prompt flash before restore) */
  isConsentLoaded: boolean;
  /** Whether the re-acceptance overlay should be visible right now */
  isReacceptanceVisible: boolean;
  /** True when the stored version predates LEGAL_DOCUMENT_VERSION */
  needsReacceptance: boolean;

  /** Restore persisted consent (call once at app start, alongside loadStoredAuth) */
  loadConsent: () => Promise<void>;
  /** Record acceptance of the current LEGAL_DOCUMENT_VERSION */
  accept: (method: 'signup' | 'reacceptance') => Promise<void>;
  /** Show/hide the re-acceptance overlay */
  showReacceptance: () => void;
  hideReacceptance: () => void;
  /** GDPR Article 17 erasure: wipe the stored consent record + reset state */
  resetConsent: () => void;
}

export const useLegalConsentStore = create<LegalConsentState>((set, get) => ({
  acceptedVersion: null,
  isConsentLoaded: false,
  isReacceptanceVisible: false,
  needsReacceptance: false,

  loadConsent: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const record = JSON.parse(raw) as LegalConsentRecord;
        set({
          acceptedVersion: record.version,
          isConsentLoaded: true,
          needsReacceptance: record.version !== LEGAL_DOCUMENT_VERSION,
        });
        return;
      }
    } catch {
      // Corrupt record — treat as never accepted (prompt will show)
    }
    set({ acceptedVersion: null, isConsentLoaded: true, needsReacceptance: false });
  },

  accept: async (method) => {
    const record: LegalConsentRecord = {
      version: LEGAL_DOCUMENT_VERSION,
      acceptedAt: new Date().toISOString(),
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Persistence failure shouldn't block signup — state is still set
    }
    set({
      acceptedVersion: record.version,
      isConsentLoaded: true,
      needsReacceptance: false,
      isReacceptanceVisible: false,
    });
    analytics.logEvent('legal_consent_accepted', { method, version: record.version });
  },

  showReacceptance: () => {
    if (get().needsReacceptance) set({ isReacceptanceVisible: true });
  },

  hideReacceptance: () => set({ isReacceptanceVisible: false }),

  resetConsent: () => {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    set({
      acceptedVersion: null,
      isConsentLoaded: true,
      isReacceptanceVisible: false,
      needsReacceptance: false,
    });
  },
}));

/** Convenience helper for tests and callers wanting the current record. */
export const getLegalConsent = (): LegalConsentRecord | null => {
  const { acceptedVersion } = useLegalConsentStore.getState();
  return acceptedVersion ? { version: acceptedVersion, acceptedAt: '' } : null;
};
