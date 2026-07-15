/**
 * ============================================================================
 * Toroloom — SyncConflictModal
 * ============================================================================
 *
 * Full-screen modal that appears when mutations fail to sync due to data
 * conflicts (409 Conflict, stale data, version mismatch, etc.). Lets the user
 * review each failed mutation and decide what to do: keep local, use server,
 * or dismiss.
 *
 * Usage:
 *   import { useConflictModal } from '../../hooks/useConflictModal';
 *   const { showModal, openModal, closeModal } = useConflictModal();
 *   <SyncConflictModal />
 *
 * Placed globally in AppNavigator, next to UpgradePromptModal.
 * ============================================================================
 */

import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useOfflineStore, type SyncConflict } from '../../store/offlineStore';
import { offlineMutationQueue } from '../../services/offlineMutationQueue';
import { log } from '../../utils/logger';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import Button from './Button';

const { width } = Dimensions.get('window');

// ──── Formatted conflict type labels ───────────────────────────────────────

const MUTATION_LABELS: Record<string, string> = {
  BUY_STOCK: 'Buy Order',
  SELL_STOCK: 'Sell Order',
  ADD_TO_WATCHLIST: 'Add to Watchlist',
  REMOVE_FROM_WATCHLIST: 'Remove from Watchlist',
  CREATE_WATCHLIST: 'Create Watchlist',
  DELETE_WATCHLIST: 'Delete Watchlist',
  MODIFY_ORDER: 'Modify Order',
  CANCEL_ORDER: 'Cancel Order',
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return 'just now';
    if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'unknown';
  }
}

function summarizePayload(payload?: Record<string, unknown>): string {
  if (!payload) return '';
  const parts: string[] = [];
  if (payload.symbol) parts.push(String(payload.symbol));
  if (payload.quantity) parts.push(`Qty: ${payload.quantity}`);
  if (payload.price) parts.push(`₹${Number(payload.price).toLocaleString('en-IN')}`);
  return parts.join(' · ');
}

// ──── Component ────────────────────────────────────────────────────────────

export default function SyncConflictModal() {
  const insets = useSafeAreaInsets();
  const conflicts = useOfflineStore((s) => s.conflicts);
  const pendingConflicts = useMemo(
    () => conflicts.filter((c) => c.status === 'pending'),
    [conflicts],
  );
  const resolveConflict = useOfflineStore((s) => s.resolveConflict);
  const computeSyncStatus = useOfflineStore((s) => s.computeSyncStatus);
  const refreshFreshness = useOfflineStore((s) => s.refreshFreshness);
  const clearResolvedConflicts = useOfflineStore((s) => s.clearResolvedConflicts);

  const [isVisible, setIsVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const prevConflictCount = useRef(pendingConflicts.length);

  // ── Show modal when new conflicts appear ──
  useEffect(() => {
    if (pendingConflicts.length > 0 && pendingConflicts.length > prevConflictCount.current) {
      setIsVisible(true);
    }
    prevConflictCount.current = pendingConflicts.length;
  }, [pendingConflicts.length]);

  // ── Animations ──
  const backdropOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.85);
  const modalTranslateY = useSharedValue(80);

  useEffect(() => {
    if (isVisible) {
      backdropOpacity.value = withTiming(1, { duration: 300 });
      modalScale.value = withSpring(1, { stiffness: 100, damping: 14 });
      modalTranslateY.value = withSpring(0, { stiffness: 100, damping: 14 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 250 });
      modalScale.value = withTiming(0.85, { duration: 200 });
      modalTranslateY.value = withTiming(80, { duration: 200 });
    }
  }, [isVisible, backdropOpacity, modalScale, modalTranslateY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    opacity: interpolate(modalScale.value, [0.85, 1], [0, 1]),
    transform: [
      { scale: modalScale.value },
      { translateY: modalTranslateY.value },
    ],
  }));

  // ── Actions ──
  const handleResolve = useCallback(
    async (conflictId: string, resolution: SyncConflict['status']) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActionLoading(conflictId);

      resolveConflict(conflictId, resolution);

      // If resolved to use server, remove the mutation from queue
      if (resolution === 'resolved_use_server' || resolution === 'dismissed') {
        const conflict = conflicts.find((c) => c.id === conflictId);
        if (conflict) {
          await offlineMutationQueue.remove(conflict.mutationId);
        }
      }

      setActionLoading(null);
      computeSyncStatus();
    },
    [conflicts, resolveConflict, computeSyncStatus],
  );

  const handleResolveAll = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const unresolved = pendingConflicts;

    for (const conflict of unresolved) {
      resolveConflict(conflict.id, 'dismissed');
      await offlineMutationQueue.remove(conflict.mutationId);
    }

    await refreshFreshness();
    computeSyncStatus();
    setIsVisible(false);
  }, [pendingConflicts, resolveConflict, refreshFreshness, computeSyncStatus]);

  const handleRetryAll = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const unresolved = pendingConflicts;

    for (const conflict of unresolved) {
      resolveConflict(conflict.id, 'resolved_use_server');
    }

    await offlineMutationQueue.processAll();
    await refreshFreshness();
    computeSyncStatus();
    clearResolvedConflicts();
    setIsVisible(false);
  }, [pendingConflicts, resolveConflict, refreshFreshness, computeSyncStatus, clearResolvedConflicts]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsVisible(false);
    computeSyncStatus();
  }, [computeSyncStatus]);

  if (!isVisible || pendingConflicts.length === 0) return null;

  return (
    <View style={styles.root} pointerEvents="auto">
      {/* Backdrop */}
      <Pressable
        style={({pressed}) => [StyleSheet.absoluteFill, {opacity: pressed ? 1 : 1}]}
        onPress={handleClose}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      {/* Modal */}
      <Animated.View
        style={[
          styles.modalContainer,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
          modalStyle,
        ]}
      >
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.modalGradient}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="warning" size={22} color="#F97316" />
              </View>
              <View>
                <Text style={styles.title}>Sync Conflicts</Text>
                <Text style={styles.subtitle}>
                  {pendingConflicts.length} mutation{pendingConflicts.length !== 1 ? 's' : ''} failed to sync
                </Text>
              </View>
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>

          {/* ── Conflict List ── */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {pendingConflicts.map((conflict) => (
              <View key={conflict.id} style={styles.conflictCard}>
                <View style={styles.conflictHeader}>
                  <View style={styles.conflictTypeBadge}>
                    <Ionicons
                      name={
                        conflict.mutationType.startsWith('BUY') || conflict.mutationType.startsWith('SELL')
                          ? 'swap-horizontal'
                          : 'bookmark'
                      }
                      size={12}
                      color="#F97316"
                    />
                    <Text style={styles.conflictTypeText}>
                      {MUTATION_LABELS[conflict.mutationType] || conflict.mutationType}
                    </Text>
                  </View>
                  <Text style={styles.conflictTime}>
                    {formatTimestamp(conflict.enqueuedAt)}
                  </Text>
                </View>

                {/* Payload summary */}
                {conflict.localPayload && (
                  <Text style={styles.payloadText}>
                    {summarizePayload(conflict.localPayload)}
                  </Text>
                )}

                {/* Error message */}
                <View style={styles.errorBox}>
                  <Ionicons name="information-circle" size={10} color="#EF4444" />
                  <Text style={styles.errorText}>{conflict.error}</Text>
                </View>

                {/* Resolution actions */}
                <View style={styles.resolutionRow}>
                  <Pressable
                    style={[styles.resolveBtn, styles.resolveDismiss]}
                    onPress={() => handleResolve(conflict.id, 'dismissed')}
                    disabled={actionLoading === conflict.id}
                  >
                    <Text style={styles.resolveDismissText}>Dismiss</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.resolveBtn, styles.resolveRetry]}
                    onPress={() => handleResolve(conflict.id, 'resolved_use_server')}
                    disabled={actionLoading === conflict.id}
                  >
                    <Ionicons name="refresh-outline" size={11} color="#22C55E" />
                    <Text style={styles.resolveRetryText}>Retry</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.resolveBtn, styles.resolveKeep]}
                    onPress={() => handleResolve(conflict.id, 'resolved_keep_local')}
                    disabled={actionLoading === conflict.id}
                  >
                    <Ionicons name="checkmark-outline" size={11} color="#3B82F6" />
                    <Text style={styles.resolveKeepText}>Keep</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* ── Bulk Actions ── */}
          <View style={styles.bulkActions}>
            <Pressable
              style={styles.bulkDismissBtn}
              onPress={handleResolveAll}
            >
              <Text style={styles.bulkDismissText}>Dismiss All</Text>
            </Pressable>
            <Pressable
              style={styles.bulkRetryBtn}
              onPress={handleRetryAll}
            >
              <Ionicons name="refresh-outline" size={14} color="#0D0D0D" />
              <Text style={styles.bulkRetryText}>Retry All</Text>
            </Pressable>
          </View>

          {/* ── Footnote ── */}
          <Text style={styles.footnote}>
            Conflicts occur when your local data is older than the server version.
            Choose "Keep" to preserve your local changes, "Retry" to re-send, or
            "Dismiss" to discard.
          </Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ──── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 9998,
    elevation: 9998,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 420,
    maxHeight: '80%',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 24,
  },
  modalGradient: {
    padding: SPACING.lg,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: '#FFFFFF',
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Scroll / Conflict Cards ──
  scrollArea: {
    maxHeight: 320,
    marginBottom: SPACING.md,
  },
  conflictCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  conflictTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  conflictTypeText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: '#F97316',
  },
  conflictTime: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.4)',
  },
  payloadText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: SPACING.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: BORDER_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  errorText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: '#EF4444',
    flex: 1,
  },

  // ── Resolution Row ──
  resolutionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  resolveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
  },
  resolveDismiss: {
    borderColor: 'rgba(255,255,255,0.15)',
  },
  resolveDismissText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.6)',
  },
  resolveRetry: {
    borderColor: 'rgba(34, 197, 94, 0.3)',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  resolveRetryText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: '#22C55E',
  },
  resolveKeep: {
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  resolveKeepText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: '#3B82F6',
  },

  // ── Bulk Actions ──
  bulkActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  bulkDismissBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bulkDismissText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.6)',
  },
  bulkRetryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#22C55E',
  },
  bulkRetryText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: '#0D0D0D',
  },

  // ── Footnote ──
  footnote: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 16,
  },
});
