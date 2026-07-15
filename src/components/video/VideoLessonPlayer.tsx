// =============================================================================
// Toroloom — Video Lesson Player Component
// Interactive video player with:
//   - Play/Pause, Seek bar, Time display
//   - Playback speed controls (0.5x, 1x, 1.5x, 2x)
//   - Fullscreen toggle
//   - Synchronized transcript view
//   - Bookmark support
//   - Progress tracking
// =============================================================================

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { TranscriptEntry, VideoBookmark, VideoProgress } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

// ─── Props ──────────────────────────────────────────────────────────────────

interface VideoLessonPlayerProps {
  videoUrl: string;
  transcript?: TranscriptEntry[];
  bookmarks?: VideoBookmark[];
  progress?: VideoProgress;
  onAddBookmark?: (time: number, label: string) => void;
  onDeleteBookmark?: (bookmarkId: string) => void;
  onProgressUpdate?: (p: { lastPosition: number; duration: number; watchedPercent: number }) => void;
  onVideoComplete?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getActiveTranscript(
  transcript: TranscriptEntry[],
  currentTime: number,
): TranscriptEntry | null {
  let closest: TranscriptEntry | null = null;
  let minDiff = Infinity;
  for (const entry of transcript) {
    if (currentTime >= entry.startTime && currentTime <= entry.endTime) return entry;
    const diff = Math.abs(currentTime - entry.startTime);
    if (diff < minDiff) { minDiff = diff; closest = entry; }
  }
  return closest;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function VideoLessonPlayer({
  videoUrl, transcript, bookmarks = [], progress,
  onAddBookmark, onDeleteBookmark, onProgressUpdate, onVideoComplete,
}: VideoLessonPlayerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const player = useVideoPlayer(videoUrl, (p) => { p.loop = false; });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(progress?.lastPosition || 0);
  const [duration, setDuration] = useState(progress?.duration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const transcriptScrollRef = useRef<ScrollView>(null);
  const watchedRef = useRef<Set<number>>(new Set());

  // Listen for status changes
  useEffect(() => {
    const unsubPlay = player.addListener('playingChange', (e) => { setIsPlaying(e.isPlaying); });
    const unsubStatus = player.addListener('statusChange', (e) => {
      if (e.status === 'readyToPlay') {
        setDuration(player.duration || 0);
        // Resume from last position if exists
        if (progress?.lastPosition && progress.lastPosition > 0) {
          player.currentTime = progress.lastPosition;
        }
      }
    });

    const interval = setInterval(() => {
      const t = player.currentTime;
      if (t !== undefined && !isNaN(t)) {
        setCurrentTime(t);
        if (duration > 0) {
          const pct = Math.floor((t / duration) * 100);
          watchedRef.current.add(pct);
          onProgressUpdate?.({
            lastPosition: t,
            duration,
            watchedPercent: Math.min(100, watchedRef.current.size),
          });
          if (duration - t < 1.5 && watchedRef.current.size > 90) {
            onVideoComplete?.();
          }
        }
      }
    }, 500);

    return () => { unsubPlay?.remove(); unsubStatus?.remove(); clearInterval(interval); };
  }, [player, duration, videoUrl, onProgressUpdate, onVideoComplete, playbackSpeed, progress?.lastPosition]);

  const togglePlay = useCallback(() => {
    if (isPlaying) player.pause(); else player.play();
  }, [player, isPlaying]);

  const handleSeek = useCallback((time: number) => {
    player.currentTime = time;
    setCurrentTime(time);
  }, [player]);

  const handleSpeedChange = useCallback((s: number) => {
    player.playbackRate = s;
    setPlaybackSpeed(s);
  }, [player]);

  const handleAddBookmark = useCallback(() => {
    if (onAddBookmark && currentTime > 1) {
      const active = transcript ? getActiveTranscript(transcript, currentTime) : null;
      const label = active ? active.text.substring(0, 60) + '...' : `At ${formatTime(currentTime)}`;
      onAddBookmark(currentTime, label);
    }
  }, [currentTime, transcript, onAddBookmark]);

  const handleSeekBack = useCallback(() => handleSeek(Math.max(0, currentTime - 10)), [currentTime, handleSeek]);
  const handleSeekFwd = useCallback(() => handleSeek(Math.min(duration, currentTime + 10)), [currentTime, duration, handleSeek]);

  const activeTranscript = useMemo(() => {
    if (!transcript) return null;
    return getActiveTranscript(transcript, currentTime);
  }, [transcript, currentTime]);

  const watchPercent = useMemo(() => {
    if (duration <= 0) return 0;
    return Math.min(100, Math.round((currentTime / duration) * 100));
  }, [currentTime, duration]);

  // Auto-scroll transcript
  useEffect(() => {
    if (showTranscript && activeTranscript && transcript) {
      const idx = transcript.indexOf(activeTranscript);
      if (idx >= 0) {
        transcriptScrollRef.current?.scrollTo({ y: idx * 52, animated: true });
      }
    }
  }, [activeTranscript, showTranscript, transcript]);

  return (
    <View style={styles.container}>
      {/* ─── Video Player ─── */}
      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          fullscreenOptions={{ enable: true }}
          nativeControls={false}
          contentFit="contain"
        />

        {/* Play/Pause Center Button (always visible when paused) */}
        {!isPlaying && (
          <Pressable style={({pressed}) => [styles.centerOverlay, {opacity: pressed ? 1 : 1}]} onPress={togglePlay}>
            <View style={styles.centerPlayBtn}>
              <Ionicons name="play" size={40} color="#FFF" />
            </View>
          </Pressable>
        )}

        {/* Controls overlay (always visible) */}
        <View style={styles.controlsBottom} pointerEvents="box-none">
          {/* Seek bar */}
          <View style={styles.seekRow}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Pressable
              style={({pressed}) => [styles.seekTrack, {opacity: pressed ? 1 : 1}]}
              onPress={(e) => {
                const x = e.nativeEvent.locationX;
                const trackWidth = SCREEN_WIDTH - SPACING.md * 4 - 100;
                const ratio = Math.max(0, Math.min(1, x / trackWidth));
                handleSeek(ratio * (duration || 1));
              }}
            >
              <View style={[styles.seekTrackFill, { width: `${watchPercent}%` as any }]} />
              <View style={[styles.seekThumb, { left: `${watchPercent}%` as any }]} />
            </Pressable>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>

          {/* Bottom controls row */}
          <View style={styles.controlsRow}>
            <View style={styles.leftControls}>
              <Pressable onPress={togglePlay} style={styles.ctrlBtn}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#FFF" />
              </Pressable>
              <Pressable onPress={handleSeekBack} style={styles.ctrlBtn}>
                <Ionicons name="play-back" size={14} color="#FFF" />
              </Pressable>
              <Pressable onPress={handleSeekFwd} style={styles.ctrlBtn}>
                <Ionicons name="play-forward" size={14} color="#FFF" />
              </Pressable>
            </View>
            <View style={styles.rightControls}>
              {/* Speed */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.speedScroll}>
                {SPEED_OPTIONS.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.speedBtn, playbackSpeed === s && styles.speedBtnActive]}
                    onPress={() => handleSpeedChange(s)}
                  >
                    <Text style={[styles.speedText, playbackSpeed === s && styles.speedTextActive]}>
                      {s}x
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable onPress={handleAddBookmark} style={styles.ctrlBtn}>
                <Ionicons name="bookmark-outline" size={16} color="#FFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* ─── Info Row ─── */}
      <View style={styles.infoRow}>
        <View style={styles.watchStats}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.watchStatText}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
          <View style={[styles.pctBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.pctText, { color: colors.primary }]}>{watchPercent}%</Text>
          </View>
        </View>
        <Text style={styles.speedTextInfo}>{playbackSpeed}x speed</Text>
      </View>

      {/* ─── Transcript / Bookmarks Tabs ─── */}
      {(transcript?.length || bookmarks.length) ? (
        <View style={styles.tabBar}>
          {transcript && transcript.length > 0 && (
            <Pressable style={[styles.tab, showTranscript && styles.tabActive]}
              onPress={() => { setShowTranscript(true); setShowBookmarks(false); }}>
              <Ionicons name="chatbubbles-outline" size={14}
                color={showTranscript ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabText, showTranscript && styles.tabTextActive]}>Transcript</Text>
            </Pressable>
          )}
          <Pressable style={[styles.tab, showBookmarks && styles.tabActive]}
            onPress={() => { setShowBookmarks(true); setShowTranscript(false); }}>
            <Ionicons name="bookmark" size={14}
              color={showBookmarks ? colors.primary : colors.textMuted} />
            <Text style={[styles.tabText, showBookmarks && styles.tabTextActive]}>
              Bookmarks ({bookmarks.length})
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ─── Transcript ─── */}
      {showTranscript && transcript && transcript.length > 0 && (
        <ScrollView ref={transcriptScrollRef} style={styles.transcriptBox} showsVerticalScrollIndicator={false}>
          {transcript.map((e, i) => {
            const isActive = activeTranscript === e;
            return (
              <Pressable key={i}
                style={({pressed}) => [[styles.transcriptLine, isActive && styles.transcriptLineActive], {opacity: pressed ? 0.7 : 1}]}
                onPress={() => handleSeek(e.startTime)}
              >
                <Text style={[styles.transcriptTime, { color: isActive ? colors.primary : colors.textMuted }]}>
                  {formatTime(e.startTime)}
                </Text>
                <View style={{ flex: 1 }}>
                  {e.speaker ? <Text style={[styles.transcriptSpeaker, { color: colors.primary }]}>{e.speaker}</Text> : null}
                  <Text style={[styles.transcriptText, { color: isActive ? colors.text : colors.textSecondary }]}>
                    {e.text}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ─── Bookmarks ─── */}
      {showBookmarks && (
        <View style={styles.bookmarksBox}>
          {bookmarks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bookmark-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No bookmarks yet. Tap the bookmark icon while watching.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {[...bookmarks].sort((a, b) => a.time - b.time).map((bm) => (
                <View key={bm.id} style={[styles.bookmarkRow, { borderBottomColor: colors.divider }]}>
                  <Pressable style={styles.bookmarkLeft} onPress={() => handleSeek(bm.time)}>
                    <View style={[styles.bmTimeBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Ionicons name="bookmark" size={10} color={colors.primary} />
                      <Text style={[styles.bmTime, { color: colors.primary }]}>{formatTime(bm.time)}</Text>
                    </View>
                    <Text style={[styles.bmLabel, { color: colors.text }]} numberOfLines={2}>{bm.label}</Text>
                  </Pressable>
                  <Pressable onPress={() => onDeleteBookmark?.(bm.id)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: { backgroundColor: colors.bg, borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md },

  videoContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', position: 'relative' },
  video: { width: '100%', height: '100%' },

  // Center play overlay
  centerOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  centerPlayBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  // Bottom controls
  controlsBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 8, paddingBottom: 6 },
  seekRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  timeText: { fontSize: 10, fontWeight: '600', color: '#FFF', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', minWidth: 36, textAlign: 'center' },
  seekTrack: { flex: 1, height: 20, justifyContent: 'center', position: 'relative' },
  seekTrackFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary, position: 'absolute', left: 0, top: 8 },
  seekThumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, position: 'absolute', top: 3, marginLeft: -7 },

  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leftControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rightControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctrlBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  speedScroll: { flexDirection: 'row', maxWidth: 140 },
  speedBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 2 },
  speedBtnActive: { backgroundColor: colors.primary },
  speedText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  speedTextActive: { color: '#FFF' },

  // Info row
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  watchStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  watchStatText: { fontSize: 11, color: colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  pctBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  pctText: { fontSize: 10, fontWeight: '700' },
  speedTextInfo: { fontSize: 11, fontWeight: '500', color: colors.textMuted },

  // Tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 12, gap: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },

  // Transcript
  transcriptBox: { maxHeight: 180, paddingHorizontal: 12, paddingVertical: 4 },
  transcriptLine: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderRadius: 6, marginBottom: 2 },
  transcriptLineActive: { backgroundColor: colors.primary + '15' },
  transcriptTime: { fontSize: 10, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', width: 40, marginRight: 8, paddingTop: 2 },
  transcriptSpeaker: { fontSize: 10, fontWeight: '700', marginBottom: 1 },
  transcriptText: { fontSize: 12, lineHeight: 18 },

  // Bookmarks
  bookmarksBox: { maxHeight: 180, paddingHorizontal: 12, paddingVertical: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 20 },
  bookmarkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  bookmarkLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bmTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  bmTime: { fontSize: 10, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  bmLabel: { fontSize: 12, flex: 1 },
});
