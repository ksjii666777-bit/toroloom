/**
 * ============================================================================
 * Toroloom — Post Detail Screen
 * ============================================================================
 *
 * Full-screen post detail with:
 *   - Post header with user avatar, name, verified badge, timestamp
 *   - Post content with tags
 *   - Like (animated spring), bookmark, share actions
 *   - Comments section with pull-to-refresh, skeleton loading, long-press copy
 *   - Auto-growing comment input with character count
 *   - Staggered entrance animations for comments
 * ============================================================================
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, RefreshControl, Dimensions,
} from 'react-native';
import Animated, {
  FadeIn, useSharedValue, useAnimatedStyle, withSpring,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';
import { useCommunityStore } from '../../store/communityStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatTimeAgo } from '../../utils/formatters';
import Badge from '../../components/ui/Badge';
import { triggerHaptic } from '../../utils/haptics';
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics';
import { showShareSheet, ShareContent } from '../../utils/share';

const { width } = Dimensions.get('window');
const VERIFIED_USERS = ['Priya Patel', 'Arun Kumar', 'Vikram Reddy'];
const MAX_COMMENT_LENGTH = 500;

// ─── Animated Like Button ───────────────────────────────────────────────────

function AnimatedLikeButton({
  isLiked, count, onPress, actionBtnStyle, actionTextStyle,
}: {
  isLiked: boolean; count: number; onPress: () => void;
  actionBtnStyle: any; actionTextStyle: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.4, { stiffness: 200, damping: 10 }),
      withSpring(1, { stiffness: 150, damping: 12 }),
    );
    triggerHaptic();
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity style={actionBtnStyle} onPress={handlePress} activeOpacity={0.7}>
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={20}
          color={isLiked ? '#FF3B30' : '#9CA3AF'}
        />
      </Animated.View>
      <Text style={[actionTextStyle, isLiked && { color: '#FF3B30' }]}>
        {count}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Comment Skeleton ───────────────────────────────────────────────────────

function CommentSkeleton() {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    const animate = () => {
      opacity.value = withSequence(
        withSpring(1, { stiffness: 60, damping: 8 }),
        withSpring(0.3, { stiffness: 60, damping: 8 }),
      );
    };
    animate();
    const interval = setInterval(animate, 1200);
    return () => clearInterval(interval);
  }, []);

  const skeletonStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const bar = (w: number) => (
    <Animated.View
      style={[skeletonStyle, { width: w, height: 10, borderRadius: 5, backgroundColor: '#9CA3AF30', marginBottom: 6 }]}
    />
  );

  return (
    <>
      {[1, 2, 3].map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row', gap: 12, padding: 16, marginBottom: 8,
            borderRadius: 12, backgroundColor: '#9CA3AF10',
          }}
        >
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#9CA3AF20' }} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Animated.View style={[skeletonStyle, { width: 80, height: 12, borderRadius: 4, backgroundColor: '#9CA3AF30' }]} />
            </View>
            {bar(width * 0.6)}
            {bar(width * 0.35)}
          </View>
        </View>
      ))}
    </>
  );
}

// ─── Autogrowing TextInput ──────────────────────────────────────────────────

function AutoGrowingInput({
  value, onChangeText, placeholder, placeholderTextColor, maxLength, style,
}: {
  value: string; onChangeText: (t: string) => void;
  placeholder: string; placeholderTextColor: string;
  maxLength: number; style: any;
}) {
  const [height, setHeight] = useState(40);

  return (
    <TextInput
      style={[style, { height: Math.min(Math.max(40, height), 100) }]}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      value={value}
      onChangeText={onChangeText}
      onContentSizeChange={e => setHeight(e.nativeEvent.contentSize.height)}
      multiline
      maxLength={maxLength}
    />
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function PostDetailScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { postId } = route.params;
  const scrollRef = useRef<ScrollView>(null);

  const {
    posts, comments, likedPostIds, bookmarkedPostIds, isLoading,
    fetchComments, addComment, likePost, bookmarkPost,
  } = useCommunityStore();
  const [commentText, setCommentText] = useState('');
  const [isRefreshingComments, setIsRefreshingComments] = useState(false);
  const [isCommentSending, setIsCommentSending] = useState(false);
  const [copiedCommentId, setCopiedCommentId] = useState<string | null>(null);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const post = useMemo(() => posts.find(p => p.id === postId), [posts, postId]);
  const postComments = comments[postId] || [];
  const isLiked = likedPostIds.includes(postId);
  const isBookmarked = bookmarkedPostIds.includes(postId);
  const isCommentLoading = isLoading && !commentsLoaded;

  useEffect(() => {
    if (postId) {
      setCommentsLoaded(false);
      fetchComments(postId).finally(() => setCommentsLoaded(true));
    }
  }, [postId]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleLike = useCallback(() => {
    likePost(postId);
  }, [postId, likePost]);

  const handleBookmark = useCallback(() => {
    bookmarkPost(postId);
    triggerHaptic();
  }, [postId, bookmarkPost]);

  const handleShare = useCallback(() => {
    if (!post) return;
    notificationAsync(NotificationFeedbackType.Success);
    const shareContent: ShareContent = {
      title: 'Toroloom Community Post',
      message: post.content,
      authorName: post.userName,
    };
    showShareSheet(shareContent);
  }, [post]);

  const handleRefreshComments = useCallback(async () => {
    setIsRefreshingComments(true);
    await fetchComments(postId);
    setIsRefreshingComments(false);
    triggerHaptic();
  }, [postId, fetchComments]);

  const handleSendComment = useCallback(async () => {
    if (!commentText.trim() || isCommentSending) return;
    setIsCommentSending(true);
    try {
      await addComment(postId, commentText.trim());
      setCommentText('');
      notificationAsync(NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setIsCommentSending(false);
    }
  }, [postId, commentText, addComment, isCommentSending]);

  const handleCopyComment = useCallback(async (commentId: string, content: string) => {
    await Clipboard.setStringAsync(content);
    setCopiedCommentId(commentId);
    notificationAsync(NotificationFeedbackType.Success);
    setTimeout(() => setCopiedCommentId(null), 1500);
  }, []);

  // ── Post not found ────────────────────────────────────────────────────

  if (!post) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center' }}>
          <View style={[styles.notFoundIcon, { backgroundColor: colors.textMuted + '15' }]}>
            <Ionicons name="sad-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyText, { marginTop: SPACING.md }]}>Post not found</Text>
          <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
            This post may have been deleted or doesn't exist.
          </Text>
          <TouchableOpacity
            style={[styles.goBackBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  const isVerified = VERIFIED_USERS.includes(post.userName);
  const charsLeft = MAX_COMMENT_LENGTH - commentText.length;

  // ── Main Render ───────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingComments}
            onRefresh={handleRefreshComments}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgSecondary}
          />
        }
      >
        {/* ── Post Card ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(400)}>
          <View style={[styles.postCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {/* Author Header */}
            <View style={styles.postHeader}>
              <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
                <Text style={styles.avatarText}>{post.userName[0]}</Text>
              </View>
              <View style={styles.postUser}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName}>{post.userName}</Text>
                  {isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#00E676" />
                    </View>
                  )}
                </View>
                <Text style={styles.postTime}>{formatTimeAgo(post.timestamp)}</Text>
              </View>
            </View>

            {/* Content */}
            <Text style={styles.postContent}>{post.content}</Text>

            {/* Tags */}
            {post.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {post.tags.map((tag: string) => (
                  <Badge key={tag} label={tag} variant="primary" size="medium" />
                ))}
              </View>
            )}

            {/* Action Row */}
            <View style={[styles.actionRow, { borderTopColor: colors.divider }]}>
              <AnimatedLikeButton
                isLiked={isLiked}
                count={post.likes + (isLiked ? 1 : 0)}
                onPress={handleLike}
                actionBtnStyle={styles.actionBtn}
                actionTextStyle={styles.actionText}
              />
              <TouchableOpacity style={styles.actionBtn} onPress={handleBookmark}>
                <Ionicons
                  name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={isBookmarked ? '#FFAB40' : colors.textMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ── Comments Header ────────────────────────────────────────── */}
        <View style={styles.commentsHeader}>
          <Ionicons name="chatbubbles" size={18} color={colors.primary} />
          <Text style={[styles.commentsTitle, { color: colors.text }]}>
            Comments ({postComments.length})
          </Text>
        </View>

        {/* ── Comments List ──────────────────────────────────────────── */}
        {isCommentLoading ? (
          <CommentSkeleton />
        ) : postComments.length === 0 ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.emptyComments}>
            <View style={[styles.emptyCommentsIcon, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.primary + '60'} />
            </View>
            <Text style={[styles.emptyCommentsTitle, { color: colors.text }]}>
              No comments yet
            </Text>
            <Text style={[styles.emptyCommentsText, { color: colors.textMuted }]}>
              Be the first to share your thoughts on this post!
            </Text>
          </Animated.View>
        ) : (
          postComments.map((comment, idx) => {
            const commentVerified = VERIFIED_USERS.includes(comment.userName);
            const isCopied = copiedCommentId === comment.id;
            return (
              <Animated.View
                key={comment.id}
                entering={FadeIn.duration(300).delay(idx * 60)}
                style={[
                  styles.commentCard,
                  {
                    backgroundColor: colors.bgInput,
                    borderColor: isCopied ? colors.primary + '40' : colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.commentTouchable}
                  onLongPress={() => handleCopyComment(comment.id, comment.content)}
                  activeOpacity={0.9}
                  delayLongPress={400}
                >
                  <View style={[styles.commentAvatar, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.commentAvatarText, { color: colors.primary }]}>
                      {comment.userName[0]}
                    </Text>
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentNameRow}>
                      <Text style={[styles.commentUserName, { color: colors.text }]}>
                        {comment.userName}
                      </Text>
                      {commentVerified && (
                        <Ionicons name="checkmark-circle" size={12} color="#00E676" />
                      )}
                    </View>
                    <Text style={[styles.commentContent, { color: colors.textSecondary }]}>
                      {comment.content}
                    </Text>
                    <View style={styles.commentFooter}>
                      <Text style={[styles.commentTime, { color: colors.textMuted }]}>
                        {formatTimeAgo(comment.timestamp)}
                      </Text>
                      {isCopied && (
                        <View style={styles.copiedBadge}>
                          <Ionicons name="checkmark" size={10} color="#FFF" />
                          <Text style={styles.copiedBadgeText}>Copied</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}

        <View style={{ height: SPACING.huge }} />
      </ScrollView>

      {/* ── Comment Input ───────────────────────────────────────────── */}
      <View style={[styles.commentInputContainer, {
        backgroundColor: colors.bgSecondary,
        borderTopColor: colors.divider,
      }]}>
        {commentText.length > 0 && (
          <View style={styles.charCountRow}>
            <Text style={[styles.charCountText, {
              color: charsLeft < 50 ? (charsLeft < 10 ? '#FF3B30' : '#FFAB40') : colors.textMuted,
            }]}>
              {charsLeft} characters left
            </Text>
          </View>
        )}
        <View style={[styles.commentInputRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <AutoGrowingInput
            style={[styles.commentInput, { color: colors.text }]}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={MAX_COMMENT_LENGTH}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              {
                backgroundColor: commentText.trim() && !isCommentSending
                  ? colors.primary
                  : colors.textMuted + '30',
              },
            ]}
            onPress={handleSendComment}
            disabled={!commentText.trim() || isCommentSending}
          >
            {isCommentSending ? (
              <View style={styles.sendSpinner}>
                <View style={[styles.sendSpinnerDot, { backgroundColor: '#FFF' }]} />
              </View>
            ) : (
              <Ionicons name="send" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 60, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md,
      borderBottomWidth: 1,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text },
    shareBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    scrollContent: { flex: 1 },
    scrollInner: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

    // Post Card
    postCard: {
      borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
      padding: SPACING.lg, marginBottom: SPACING.xl,
    },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
    avatar: {
      width: 44, height: 44, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
    },
    avatarText: { ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.primary },
    postUser: { flex: 1 },
    userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    userName: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text },
    verifiedBadge: {
      width: 18, height: 18, borderRadius: 9,
      backgroundColor: '#00E67620', justifyContent: 'center', alignItems: 'center',
    },
    postTime: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
    postContent: { ...FONTS.regular, fontSize: FONTS.size.md, color: colors.text, lineHeight: 22 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.md },
    actionRow: {
      flexDirection: 'row', gap: SPACING.xxl, marginTop: SPACING.lg,
      paddingTop: SPACING.md, borderTopWidth: 1,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    actionText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted },

    // Comments
    commentsHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
    commentsTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg },

    emptyComments: { alignItems: 'center', paddingVertical: SPACING.huge, gap: SPACING.md },
    emptyCommentsIcon: {
      width: 64, height: 64, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
    },
    emptyCommentsTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
    emptyCommentsText: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center', lineHeight: 20, paddingHorizontal: 40 },

    commentCard: {
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1, marginBottom: SPACING.sm,
    },
    commentTouchable: {
      flexDirection: 'row', padding: SPACING.md, gap: SPACING.md,
    },
    commentAvatar: {
      width: 32, height: 32, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center',
    },
    commentAvatarText: { ...FONTS.bold, fontSize: FONTS.size.md },
    commentBody: { flex: 1 },
    commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    commentUserName: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
    commentContent: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 2, lineHeight: 18 },
    commentFooter: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
    },
    commentTime: { ...FONTS.regular, fontSize: 10 },
    copiedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2,
      borderRadius: 8,
    },
    copiedBadgeText: { ...FONTS.medium, fontSize: 9, color: '#FFF' },

    // Comment Input
    commentInputContainer: {
      paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
      borderTopWidth: 1,
    },
    charCountRow: {
      flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4,
    },
    charCountText: { ...FONTS.regular, fontSize: 10 },
    commentInputRow: {
      flexDirection: 'row', alignItems: 'flex-end',
      borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    },
    commentInput: {
      flex: 1, ...FONTS.regular, fontSize: FONTS.size.md,
      maxHeight: 100, paddingVertical: 0, paddingTop: 0,
    },
    sendBtn: {
      width: 36, height: 36, borderRadius: 18,
      justifyContent: 'center', alignItems: 'center',
      marginLeft: SPACING.sm,
    },
    sendSpinner: {
      width: 16, height: 16, borderRadius: 8,
      borderWidth: 2, borderColor: '#FFF',
      justifyContent: 'center', alignItems: 'center',
    },
    sendSpinnerDot: {
      width: 4, height: 4, borderRadius: 2,
    },

    // Not Found
    notFoundIcon: {
      width: 80, height: 80, borderRadius: 24,
      justifyContent: 'center', alignItems: 'center',
    },
    emptyText: { ...FONTS.semiBold, fontSize: FONTS.size.lg, color: colors.text },
    emptySubtext: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
    goBackBtn: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 10, borderRadius: BORDER_RADIUS.full,
      marginTop: SPACING.xl,
    },
    goBackText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#FFF' },
  });
