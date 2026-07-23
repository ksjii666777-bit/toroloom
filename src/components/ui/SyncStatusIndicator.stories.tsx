import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect } from 'react';
import SyncStatusIndicator from './SyncStatusIndicator';
import { useOfflineStore } from '../../store/offlineStore';

/**
 * SyncStatusIndicator — a persistent pill-like indicator showing the current
 * sync/offline status at a glance. Smaller than the full OfflineBanner, it
 * provides always-visible awareness of connectivity and data freshness.
 *
 * Status colors:
 *   - Green  → Online, all synced
 *   - Yellow → Pending mutations waiting to sync
 *   - Red    → Offline — viewing cached data
 *   - Blue   → Syncing in progress
 *   - Orange → Conflicts detected — needs user action
 */
const meta: Meta<typeof SyncStatusIndicator> = {
  title: 'UI/SyncStatusIndicator',
  component: SyncStatusIndicator,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof SyncStatusIndicator>;

// ─── Wrapper ────────────────────────────────────────────────────────────────

function withStore(storeState: Record<string, any>) {
  return () => {
    useEffect(() => {
      useOfflineStore.setState(storeState);
      return () => {
        useOfflineStore.setState({
          pendingTotal: 0,
          isSyncing: false,
          lastSyncResult: null,
          conflicts: [],
          syncStatus: 'online',
        } as any);
      };
    }, []);
    return <SyncStatusIndicator />;
  };
}

// ─── Online — All Synced ───────────────────────────────────────────────────

export const Online: Story = {
  name: 'Online — All Synced',
  render: withStore({
    pendingTotal: 0,
    isSyncing: false,
    lastSyncResult: 'success',
    conflicts: [],
    syncStatus: 'online' as const,
  }),
};

// ─── Pending Mutations ─────────────────────────────────────────────────────

export const Pending: Story = {
  name: 'Pending Mutations',
  render: withStore({
    pendingTotal: 3,
    isSyncing: false,
    lastSyncResult: null,
    conflicts: [],
    syncStatus: 'pending' as const,
  }),
};

// ─── Syncing In Progress ───────────────────────────────────────────────────

export const Syncing: Story = {
  name: 'Syncing...',
  render: withStore({
    pendingTotal: 5,
    isSyncing: true,
    lastSyncResult: null,
    conflicts: [],
    syncStatus: 'syncing' as const,
  }),
};

// ─── Offline ────────────────────────────────────────────────────────────────

export const Offline: Story = {
  name: 'Offline',
  render: withStore({
    pendingTotal: 0,
    isSyncing: false,
    lastSyncResult: null,
    conflicts: [],
    syncStatus: 'offline' as const,
  }),
};

// ─── Conflicts Detected ────────────────────────────────────────────────────

export const Conflicts: Story = {
  name: 'Conflicts',
  render: withStore({
    pendingTotal: 2,
    isSyncing: false,
    lastSyncResult: 'failed',
    conflicts: [
      {
        id: 'c1',
        mutationType: 'BUY_STOCK',
        status: 'pending' as const,
        error: '409 Conflict',
      },
    ],
    syncStatus: 'conflict' as const,
  }),
};

// ─── Individual story for each status (AllStates removed due to store sharing) ─
// The individual stories above (Online, Pending, Syncing, Offline, Conflicts)
// each render one state at a time. Multiple states cannot be shown
// simultaneously because they all read from the same single Zustand store.
