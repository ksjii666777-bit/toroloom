import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import SyncConflictModal from './SyncConflictModal';
import { useOfflineStore } from '../../store/offlineStore';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

/**
 * SyncConflictModal — a full-screen modal that appears when offline mutations
 * fail to sync due to data conflicts (409 Conflict, version mismatch, etc.).
 *
 * Lets the user review each failed mutation and choose to keep local changes,
 * retry (use server), or dismiss.
 *
 * This component is self-contained (reads from offlineStore). The stories
 * below mock store state with simulated conflicts.
 */
const meta: Meta<typeof SyncConflictModal> = {
  title: 'UI/SyncConflictModal',
  component: SyncConflictModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof SyncConflictModal>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateConflict(
  id: string,
  mutationType: string,
  symbol: string,
  quantity: number,
  price: number,
  error: string,
  enqueuedMinutesAgo: number,
) {
  return {
    id,
    mutationId: `mut_${id}`,
    mutationType,
    localPayload: { symbol, quantity, price } as Record<string, unknown>,
    serverPayload: null,
    error,
    enqueuedAt: new Date(Date.now() - enqueuedMinutesAgo * 60_000).toISOString(),
    status: 'pending' as const,
  };
}

const MOCK_CONFLICTS = [
  generateConflict('c1', 'BUY_STOCK', 'RELIANCE', 10, 2850, 'Version conflict: server data is newer', 2),
  generateConflict('c2', 'SELL_STOCK', 'TCS', 5, 3950, '409 Conflict — stale version', 5),
  generateConflict('c3', 'ADD_TO_WATCHLIST', 'HDFCBANK', 0, 0, 'Watchlist already exists on server', 8),
  generateConflict('c4', 'MODIFY_ORDER', 'INFY', 20, 1850, 'Order already modified since last sync', 15),
];

const SINGLE_CONFLICT = [
  generateConflict('c1', 'BUY_STOCK', 'RELIANCE', 10, 2850, 'Version conflict: server data is newer', 2),
];

// ─── Seed the offline store with mock conflicts ─────────────────────────────

function useSeedConflicts(conflicts: typeof MOCK_CONFLICTS) {
  useEffect(() => {
    useOfflineStore.setState({
      conflicts: conflicts as any,
      pendingTotal: conflicts.length,
      syncing: false,
      syncResult: null,
      refreshFreshness: async () => {},
      resolveConflict: (conflictId: string, resolution: 'pending' | 'resolved_keep_local' | 'resolved_use_server' | 'dismissed') => {
        useOfflineStore.setState({
          conflicts: useOfflineStore.getState().conflicts.map((c) =>
            c.id === conflictId ? { ...c, status: resolution } : c
          ),
        });
      },
      computeSyncStatus: () => {},
      clearResolvedConflicts: () => {},
    } as any);

    return () => {
      useOfflineStore.setState({
        conflicts: [],
        pendingCount: 0,
      } as any);
    };
  }, [conflicts]);
}

// ─── Multiple Conflicts ────────────────────────────────────────────────────

export const MultipleConflicts: Story = {
  name: 'Multiple Conflicts',
  render: function Render() {
    useSeedConflicts(MOCK_CONFLICTS);
    return <SyncConflictModal />;
  },
};

// ─── Single Conflict ───────────────────────────────────────────────────────

export const SingleConflict: Story = {
  name: 'Single Conflict',
  render: function Render() {
    useSeedConflicts(SINGLE_CONFLICT);
    return <SyncConflictModal />;
  },
};

// ─── Trigger Button Demo ───────────────────────────────────────────────────

export const TriggerDemo: Story = {
  name: 'Trigger Demo (Open Modal)',
  render: function Render() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      if (visible) {
        useOfflineStore.setState({
          conflicts: MOCK_CONFLICTS as any,
          pendingCount: MOCK_CONFLICTS.length,
        } as any);
      } else {
        useOfflineStore.setState({ conflicts: [], pendingCount: 0 } as any);
      }
      return () => {
        useOfflineStore.setState({ conflicts: [], pendingCount: 0 } as any);
      };
    }, [visible]);

    return (
      <View style={{ padding: SPACING.lg, gap: SPACING.md }}>
        <Text style={{ color: '#E0E6ED', fontSize: 15, fontWeight: '600' }}>
          Sync Conflict Modal
        </Text>
        <Text style={{ color: '#64748B', fontSize: 13 }}>
          Click the button below to trigger the modal with 4 mock conflicts:
        </Text>
        <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
          {['BUY_RELIANCE × 10', 'SELL_TCS × 5', 'WATCHLIST_HDFCBANK', 'MODIFY_INFY × 20'].map((item, i) => (
            <View key={i} style={styles.mockRow}>
              <Ionicons name="warning-outline" size={14} color="#F97316" />
              <Text style={styles.mockRowText}>{item}</Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => setVisible(true)}
          style={({ pressed }) => [
            styles.triggerBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={16} color="#0D0D0D" />
          <Text style={styles.triggerBtnText}>Open Modal</Text>
        </Pressable>
        <SyncConflictModal />
      </View>
    );
  },
};

const styles = StyleSheet.create({
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(249, 115, 22, 0.06)',
    borderRadius: BORDER_RADIUS.xs,
  },
  mockRowText: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '500',
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F97316',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  triggerBtnText: {
    color: '#0D0D0D',
    fontSize: 14,
    fontWeight: '700',
  },
});
