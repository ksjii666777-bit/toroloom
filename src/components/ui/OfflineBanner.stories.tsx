import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import OfflineBanner from './OfflineBanner';
import { useConnectivityStore } from '../../store/connectivityStore';
import { useOfflineStore } from '../../store/offlineStore';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';

/**
 * OfflineBanner — an animated status bar that appears when the app is
 * offline or has pending mutations. Shows data freshness per store,
 * pending mutation count, and allows manual sync / refresh.
 *
 * This component is self-contained (reads from Zustand stores). The stories
 * below mock store state to simulate different scenarios.
 */
const meta: Meta<typeof OfflineBanner> = {
  title: 'UI/OfflineBanner',
  component: OfflineBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof OfflineBanner>;

// ─── Mock wrapper that sets store state ────────────────────────────────────

function withStore(mock: () => void) {
  return () => {
    useEffect(() => {
      mock();
      return () => {
        // Reset to defaults on unmount
        useConnectivityStore.setState({
          combinedOffline: false,
          reconnectedAt: null,
          wentOfflineAt: null,
          onReconnect: () => () => {},
        });
        useOfflineStore.setState({
          freshness: {
            portfolio: { isStale: false, ageLabel: 'just now', lastSyncedAt: new Date().toISOString() },
            market: { isStale: false, ageLabel: 'just now', lastSyncedAt: new Date().toISOString() },
            watchlist: { isStale: false, ageLabel: 'just now', lastSyncedAt: new Date().toISOString() },
            education: { isStale: false, ageLabel: 'just now', lastSyncedAt: new Date().toISOString() },
            openOrders: { isStale: false, ageLabel: 'just now', lastSyncedAt: new Date().toISOString() },
            fno: { isStale: false, ageLabel: 'just now', lastSyncedAt: new Date().toISOString() },
            community: { isStale: false, ageLabel: 'just now', lastSyncedAt: new Date().toISOString() },
            aiInsights: { isStale: false, ageLabel: 'just now', lastSyncedAt: new Date().toISOString() },
          },
          conflicts: [],
          pendingTotal: 0,
          pendingGroups: [],
          isSyncing: false,
          lastSyncResult: null,
          setSyncing: () => {},
          setPendingGroups: () => {},
          setSyncResult: () => {},
          markSynced: () => {},
          refreshFreshness: async () => {},
          resolveConflict: () => {},
          clearResolvedConflicts: () => {},
          computeSyncStatus: () => {},
        } as any);
      };
    }, []);
    return <OfflineBanner />;
  };
}

const now = new Date().toISOString();
const fiveMinAgo = new Date(Date.now() - 300_000).toISOString();
const thirtyMinAgo = new Date(Date.now() - 1_800_000).toISOString();
const twoHoursAgo = new Date(Date.now() - 7_200_000).toISOString();

// ─── Offline State ─────────────────────────────────────────────────────────

export const OfflineState: Story = {
  name: 'Offline State',
  render: withStore(() => {
    useConnectivityStore.setState({
      combinedOffline: true,
      reconnectedAt: null,
      wentOfflineAt: new Date(),
      onReconnect: () => () => {},
    });
    useOfflineStore.setState({
      freshness: {
        portfolio: { isStale: false, ageLabel: '2 min ago', lastSyncedAt: fiveMinAgo },
        market: { isStale: true, ageLabel: '30 min ago', lastSyncedAt: thirtyMinAgo },
        watchlist: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        education: { isStale: true, ageLabel: '2 hours ago', lastSyncedAt: twoHoursAgo },
        openOrders: { isStale: false, ageLabel: '5 min ago', lastSyncedAt: fiveMinAgo },
        fno: { isStale: true, ageLabel: '30 min ago', lastSyncedAt: thirtyMinAgo },
        community: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        aiInsights: { isStale: false, ageLabel: '2 min ago', lastSyncedAt: fiveMinAgo },
      },
      pendingTotal: 0,
      pendingGroups: [],
      isSyncing: false,
      lastSyncResult: null,
      syncStatus: 'online',
    } as any);
  }),
};

// ─── Pending Mutations ─────────────────────────────────────────────────────

export const PendingMutations: Story = {
  name: 'Pending Mutations',
  render: withStore(() => {
    useConnectivityStore.setState({
      combinedOffline: false,
      reconnectedAt: new Date(),
      wentOfflineAt: new Date(Date.now() - 600_000),
      onReconnect: () => () => {},
    });
    useOfflineStore.setState({
      freshness: {
        portfolio: { isStale: true, ageLabel: '10 min ago', lastSyncedAt: fiveMinAgo },
        market: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        watchlist: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        education: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        openOrders: { isStale: false, ageLabel: '5 min ago', lastSyncedAt: fiveMinAgo },
        fno: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        community: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        aiInsights: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
      },
      pendingTotal: 3,
      pendingGroups: [
        { type: 'BUY_STOCK', count: 2, oldestAt: new Date(Date.now() - 120_000).toISOString() },
        { type: 'ADD_TO_WATCHLIST', count: 1, oldestAt: new Date(Date.now() - 60_000).toISOString() },
      ],
      isSyncing: false,
      lastSyncResult: null,
      syncStatus: 'pending',
    } as any);
  }),
};

// ─── Syncing In Progress ───────────────────────────────────────────────────

export const SyncingState: Story = {
  name: 'Syncing',
  render: withStore(() => {
    useConnectivityStore.setState({
      combinedOffline: false,
      reconnectedAt: new Date(),
      wentOfflineAt: new Date(Date.now() - 600_000),
      onReconnect: () => () => {},
    });
    useOfflineStore.setState({
      freshness: {
        portfolio: { isStale: true, ageLabel: '15 min ago', lastSyncedAt: new Date(Date.now() - 900_000).toISOString() },
        market: { isStale: true, ageLabel: '15 min ago', lastSyncedAt: new Date(Date.now() - 900_000).toISOString() },
        watchlist: { isStale: true, ageLabel: '15 min ago', lastSyncedAt: new Date(Date.now() - 900_000).toISOString() },
        education: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        openOrders: { isStale: false, ageLabel: '5 min ago', lastSyncedAt: fiveMinAgo },
        fno: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        community: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        aiInsights: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
      },
      pendingTotal: 5,
      pendingGroups: [
        { type: 'BUY_STOCK', count: 3, oldestAt: new Date(Date.now() - 180_000).toISOString() },
        { type: 'SELL_STOCK', count: 2, oldestAt: new Date(Date.now() - 120_000).toISOString() },
      ],
      isSyncing: true,
      lastSyncResult: null,
      syncStatus: 'syncing',
    } as any);
  }),
};

// ─── All Synced ─────────────────────────────────────────────────────────────

export const AllSynced: Story = {
  name: 'All Synced',
  render: withStore(() => {
    useConnectivityStore.setState({
      combinedOffline: false,
      reconnectedAt: new Date(),
      wentOfflineAt: null,
      onReconnect: () => () => {},
    });
    useOfflineStore.setState({
      freshness: {
        portfolio: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        market: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        watchlist: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        education: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        openOrders: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        fno: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        community: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
        aiInsights: { isStale: false, ageLabel: 'just now', lastSyncedAt: now },
      },
      pendingTotal: 0,
      pendingGroups: [],
      isSyncing: false,
      lastSyncResult: null,
      syncStatus: 'online',
    } as any);
  }),
};
