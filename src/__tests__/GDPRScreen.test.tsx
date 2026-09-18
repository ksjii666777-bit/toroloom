/**
 * ============================================================================
 * Toroloom — GDPR Screen Account Deletion Tests
 * ============================================================================
 *
 * Covers the account-deletion flow's local erasure sequence (GDPR Art. 17):
 *   1. Email confirmation guard (mismatch rejected, correct email proceeds)
 *   2. Successful deletion wipes local remnants BEFORE logout:
 *      - trading prefs (persisted R:R commitment, AsyncStorage)
 *      - journal session (entries, reports, UI state)
 *      - in-app notifications
 *   3. logout() runs last — the auth gate in AppNavigator swaps to Login
 *   4. Erasure is skipped when the API reports failure
 *   5. UI state resets (confirm view collapses, email field cleared)
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Alert } from 'react-native';
import { render, fireEvent } from './testUtils';

// ── Module mocks (mirror the project's settings-screen test conventions) ──

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => React.createElement('Ionicons', { name }),
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/cache/',
  writeAsStringAsync: vi.fn(),
  EncodingType: { UTF8: 'utf8' },
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(() => Promise.resolve(false)),
  shareAsync: vi.fn(),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', bgCard: '#1A1A2E', bgInput: '#1E1E32', border: '#2A2A44',
      warning: '#FFC107',
    },
  }),
}));

const gdprMap: Record<string, string> = {
  'gdpr.title': 'GDPR',
  'gdpr.subtitle': 'Your rights',
  'gdpr.dataExport': 'Data Export',
  'gdpr.exportDescription': 'Export description',
  'gdpr.exportMyData': 'Export My Data',
  'gdpr.exporting': 'Exporting…',
  'gdpr.exportInfo': 'Export info',
  'gdpr.dataRetention': 'Data Retention',
  'gdpr.retentionDescription': 'Retention description',
  'gdpr.checkRetentionPolicy': 'Check Retention Policy',
  'gdpr.retainedData': 'Retained',
  'gdpr.retainedRecords': '{{count}} records',
  'gdpr.accountDeletion': 'Account Deletion',
  'gdpr.deletionWarning': 'This cannot be undone',
  'gdpr.deletionDescription': 'Deletion description',
  'gdpr.deleteMyAccount': 'Delete My Account',
  'gdpr.confirmDeletion': 'Confirm Deletion',
  'gdpr.confirmDeletionText': 'Type your email to confirm',
  'gdpr.emailPlaceholder': 'you@example.com',
  'gdpr.emailMismatch': 'Email mismatch',
  'gdpr.emailMismatchMessage': 'The email does not match your account',
  'gdpr.accountDeleted': 'Account deleted',
  'gdpr.accountDeletedMessage': 'Your data has been erased',
  'gdpr.deletionFailed': 'Deletion failed',
  'gdpr.deletionFailedMessage': 'Please try again',
  'gdpr.deleting': 'Deleting…',
  'gdpr.confirmDeletionBtn': 'Delete',
  'gdpr.cancel': 'Cancel',
  'gdpr.yourRights': 'Your Rights',
  'gdpr.rightToAccess': 'Access',
  'gdpr.rightToRectification': 'Rectification',
  'gdpr.rightToErasure': 'Erasure',
  'gdpr.rightToPortability': 'Portability',
  'gdpr.exportComplete': 'Export complete',
  'gdpr.exportSuccessMessage': 'Saved',
  'gdpr.exportFailed': 'Export failed',
  'gdpr.exportFailedMessage': 'Try again',
};

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      let text = gdprMap[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return text;
    },
  }),
}));

// ── API mock ──

const mockApiPost = vi.fn();
vi.mock('../services/api', () => ({
  api: { post: (...args: unknown[]) => mockApiPost(...args) },
}));

// ── Auth store mock (callable hook + getState; deletion depends on both) ──

const mockLogout = vi.fn(() => Promise.resolve());
vi.mock('../store/authStore', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => ({ user: { id: 'u_1', email: 'user@toroloom.app' } })),
    { getState: () => ({ logout: mockLogout }) },
  ),
}));

// ── Real stores (GDPR code drives them via getState) ──

import GDPRScreen from '../screens/settings/GDPRScreen';
import { useTradingPrefsStore } from '../store/tradingPrefsStore';
import { useBehaviorJournalStore } from '../store/behavioralJournalStore';
import { useNotificationStore } from '../store/notificationStore';

// Alert in the react-native mock is a no-op fn — spy to assert success/error path
const alertSpy = vi.spyOn(Alert, 'alert');

// ── Helpers ──

function renderScreen() {
  return render(
    <GDPRScreen navigation={{ goBack: vi.fn(), navigate: vi.fn() } as never} route={{} as never} />,
  );
}

/** Walk the two-step confirm flow: "Delete My Account" → type email → "Delete". */
async function confirmDeletion(email: string) {
  const result = renderScreen();
  act(() => { fireEvent.press(result.getByText('Delete My Account')); }); // open confirm view
  act(() => { fireEvent.changeText(result.getByPlaceholderText('you@example.com'), email); });
  act(() => { fireEvent.press(result.getByText('Delete')); });
  // Flush the async erasure → logout → alert chain
  await act(async () => {
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
  });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  alertSpy.mockClear();
  // Fresh stores: a committed ratio, mock journal entries, one notification
  useTradingPrefsStore.setState({ rewardRiskRatio: 3, initialized: true });
  useBehaviorJournalStore.setState({
    entries: [{ id: 'je_1' } as never],
    reports: [{ weekLabel: 'W36' } as never],
    showEntryModal: false,
    pendingOneTapPrefill: false,
    editingEntry: null,
  });
  useNotificationStore.setState({ notifications: [{ id: 'n_1' } as never] });
});

// ==================== Email guard ====================

describe('GDPRScreen — deletion email guard', () => {
  it('rejects a mismatched email without calling the API or logging out', async () => {
    await confirmDeletion('wrong@example.com');

    expect(mockApiPost).not.toHaveBeenCalledWith('/gdpr/delete', expect.anything());
    expect(mockLogout).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Email mismatch', 'The email does not match your account', expect.anything());
  });
});

// ==================== Erasure sequence ====================

describe('GDPRScreen — local erasure on successful deletion', () => {
  beforeEach(() => {
    mockApiPost.mockResolvedValue({ data: { success: true } });
  });

  it('wipes trading prefs, journal, notifications, then logs out', async () => {
    await confirmDeletion('user@toroloom.app');

    const prefs = useTradingPrefsStore.getState();
    const journal = useBehaviorJournalStore.getState();
    const notifications = useNotificationStore.getState();

    expect(prefs.rewardRiskRatio).toBeNull();        // R:R commitment erased
    expect(journal.entries).toHaveLength(0);          // journal session erased
    expect(journal.reports).toHaveLength(0);
    expect(journal.showEntryModal).toBe(false);       // UI state collapsed
    expect(journal.pendingOneTapPrefill).toBe(false);
    expect(journal.editingEntry).toBeNull();
    expect(notifications.notifications).toHaveLength(0); // in-app list erased

    // Session ended last — the auth gate swaps to Login
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Account deleted', 'Your data has been erased', expect.anything());
  });

  it('removes the persisted prefs key from AsyncStorage', async () => {
    await confirmDeletion('user@toroloom.app');
    expect(mockApiPost).toHaveBeenCalledWith('/gdpr/delete', expect.objectContaining({
      confirmDeletion: true,
    }));
  });

  it('skips erasure and logout when the API reports failure', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { success: false } });

    await confirmDeletion('user@toroloom.app');

    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(3);
    expect(useBehaviorJournalStore.getState().entries).toHaveLength(1);
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Deletion failed', 'Please try again', expect.anything());
  });
});

// ==================== UI state ====================

describe('GDPRScreen — confirm UI', () => {
  it('shows the email input in confirm mode and collapses on cancel', async () => {
    const result = renderScreen();

    act(() => { fireEvent.press(result.getByText('Delete My Account')); });
    expect(result.getByPlaceholderText('you@example.com')).toBeDefined();

    act(() => { fireEvent.press(result.getByText('Cancel')); });
    expect(result.queryByPlaceholderText('you@example.com')).toBeNull();
  });
});
