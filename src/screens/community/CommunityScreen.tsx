/**
 * ============================================================================
 * Toroloom — Community Screen
 * ============================================================================
 *
 * Community feed with:
 *   - Feed tabs: Hot / New / Top
 *   - Post cards with animated like, bookmark, share
 *   - Verified badges on trusted users
 *   - User avatar → Profile navigation
 *   - Pull to refresh
 *   - Create post with tags
 *   - Trending topics
 * ============================================================================
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence,
  BounceIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useCommunityStore, FeedSort } from '../../store/communityStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { formatTimeAgo } from '../../utils/formatters';
import { triggerHaptic } from '../../utils/haptics';
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics';
import { showShareSheet, ShareContent } from '../../utils/share';
import { parseMentions } from '../../utils/mentions';
import { communityApi, UserSearchResult } from '../../services/api/community';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import AppScreen from '../../components/ui/AppScreen';



const trendingTags = ['RELIANCE', 'Nifty', 'SIP', 'Budget2025', 'TCS', 'IPO', 'Dividend', 'Crypto'];

const FEED_TABS: { key: FeedSort; label: string; icon: string }[] = [
  { key: 'hot', label: 'Hot', icon: 'flame' },
  { key: 'new', label: 'New', icon: 'time' },
  { key: 'top', label: 'Top', icon: 'trending-up' },
];

// Verified users (would come from backend)
const VERIFIED_USERS = ['Priya Patel', 'Arun Kumar', 'Vikram Reddy'];

// ─── Animated Like Button ───────────────────────────────────────────────────

function LikeButton({
  isLiked, count, onPress, styles,
}: {
  isLiked: boolean; count: number; onPress: () => void;
  styles: any;
}) {
  const scale = useSharedValue(1);
  const color = isLiked ? '#FF3B30' : '#9CA3AF';

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
  }, [onPress, scale]);

  return (
    <Pressable style={({pressed}) => [styles.postAction, {opacity: pressed ? 0.7 : 1}]} onPress={handlePress}>
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={18}
          color={color}
        />
      </Animated.View>
      <Text style={[styles.actionText, isLiked && { color: '#FF3B30' }]}>{count}</Text>
    </Pressable>
  );
}

// ─── Mention-Aware Text ─────────────────────────────────────────────────────

function MentionText({
  content,
  colors,
  onMentionPress,
}: {
  content: string;
  colors: any;
  onMentionPress: (username: string) => void;
}) {
  const segments = useMemo(() => parseMentions(content), [content]);

  return (
    <Text style={{ lineHeight: 22 }}>
      {segments.map((seg, i) => {
        if (seg.type === 'mention') {
          return (
            <Text
              key={`m-${i}`}
              style={{ color: colors.primary, fontWeight: '600' }}
              onPress={() => onMentionPress(seg.username)}
            >
              {seg.text}
            </Text>
          );
        }
        return <Text key={`t-${i}`}>{seg.text}</Text>;
      })}
    </Text>
  );
}

// ─── Post Card ──────────────────────────────────────────────────────────────

function PostCard({
  post,
  isLiked,
  isBookmarked,
  onLike,
  onBookmark,
  onUserPress,
  onPostPress,
  onShare,
  onMentionPress,
  colors,
  styles,
}: {
  post: any;
  isLiked: boolean;
  isBookmarked: boolean;
  onLike: () => void;
  onBookmark: () => void;
  onUserPress: () => void;
  onPostPress: () => void;
  onShare: () => void;
  onMentionPress: (username: string) => void;
  colors: any;
  styles: any;
}) {
  const verifiedUsersSet = new Set(VERIFIED_USERS);
  const isVerified = verifiedUsersSet.has(post.userName);

  return (
    <Pressable
      style={({pressed}) => [styles.postCard, {opacity: pressed ? 0.7 : 1}]}
      onPress={onPostPress}
    >
      {/* Header: Avatar + Name + Verified Badge + Timestamp */}
      <View style={styles.postHeader}>
        <Pressable onPress={onUserPress} style={({pressed}) => ({opacity: pressed ? 0.7 : 1})}>
          <View style={[styles.postAvatar, { backgroundColor: colors.primary + '30' }]}>
            <Text style={styles.avatarText}>{post.userName[0]}</Text>
          </View>
        </Pressable>
        <Pressable style={({pressed}) => [styles.postUser, {opacity: pressed ? 0.7 : 1}]} onPress={onUserPress}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{post.userName}</Text>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#00E676" />
              </View>
            )}
          </View>
          <Text style={styles.postTime}>{formatTimeAgo(post.timestamp)}</Text>
        </Pressable>
        {/* Bookmark */}
        <Pressable
          style={styles.bookmarkBtn}
          onPress={onBookmark}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={isBookmarked ? '#FFAB40' : colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.postContent}>
        <MentionText content={post.content} colors={colors} onMentionPress={onMentionPress} />
      </View>

      {/* Tags */}
      {post.tags.length > 0 && (
        <View style={styles.postTags}>
          {post.tags.map((tag: string) => (
            <Badge key={tag} label={tag} variant="primary" size="medium" />
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <LikeButton isLiked={isLiked} count={post.likes} onPress={onLike} styles={styles} />

        <Pressable style={({pressed}) => [styles.postAction, {opacity: pressed ? 0.7 : 1}]} onPress={onPostPress}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
          <Text style={styles.actionText}>{post.comments}</Text>
        </Pressable>

        <Pressable style={({pressed}) => [styles.postAction, {opacity: pressed ? 0.7 : 1}]} onPress={onShare}>
          <Ionicons name="share-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Main Community Screen ─────────────────────────────────────────────────

export default function CommunityScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Community'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    posts, feedSort, bookmarkedPostIds, likedPostIds, isRefreshing,
    setFeedSort, likePost, bookmarkPost, addPost, refreshPosts,
  } = useCommunityStore();

  const [showPostInput, setShowPostInput] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [_mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<UserSearchResult[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handlePost = useCallback(() => {
    if (postContent.trim()) {
      addPost(postContent.trim(), []);
      setPostContent('');
      setShowPostInput(false);
      setShowMentionSuggestions(false);
      notificationAsync(NotificationFeedbackType.Success);
    }
  }, [postContent, addPost]);

  const handleContentChange = useCallback(async (text: string) => {
    setPostContent(text);

    // Detect @mention trigger
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex >= 0) {
      const afterAt = text.slice(lastAtIndex + 1);
      // Only trigger if we're at the end of a word (no space after @query yet)
      const hasSpaceAfterQuery = /\s/.test(afterAt);
      if (!hasSpaceAfterQuery && afterAt.length > 0) {
        setMentionQuery(afterAt);
        setShowMentionSuggestions(true);
        try {
          const results = await communityApi.searchUsers(afterAt);
          setMentionSuggestions(results.slice(0, 5));
        } catch {
          setMentionSuggestions([]);
        }
        return;
      }
    }
    setShowMentionSuggestions(false);
    setMentionSuggestions([]);
  }, []);

  const handleMentionSelect = useCallback((user: UserSearchResult) => {
    const lastAtIndex = postContent.lastIndexOf('@');
    const beforeAt = postContent.slice(0, lastAtIndex);
    setPostContent(`${beforeAt}@${user.name} `);
    setShowMentionSuggestions(false);
    setMentionSuggestions([]);
  }, [postContent]);

  const handleLike = useCallback((postId: string) => {
    likePost(postId);
  }, [likePost]);

  const handleBookmark = useCallback((postId: string) => {
    bookmarkPost(postId);
    triggerHaptic();
  }, [bookmarkPost]);

  const handleShare = useCallback(async (post: any) => {
    const shareContent: ShareContent = {
      title: 'Toroloom Community Post',
      message: post.content,
      authorName: post.userName,
    };
    showShareSheet(shareContent);
  }, []);

  const handleUserPress = useCallback((userId: string, _userName: string) => {
    // Navigate to profile or social trader profile
    navigation.navigate('TraderProfile', { traderId: userId });
  }, [navigation]);

  const handlePostPress = useCallback((postId: string) => {
    navigation.navigate('CommunityPost', { postId });
  }, [navigation]);

  // ── Memoized Sets for O(1) lookups inside posts.map() ──
  const likedSet = useMemo(() => new Set(likedPostIds), [likedPostIds]);
  const bookmarkedSet = useMemo(() => new Set(bookmarkedPostIds), [bookmarkedPostIds]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <AppScreen
      padded={false}
      refreshing={isRefreshing}
      onRefresh={refreshPosts}
      contentStyle={styles.scrollContent}
      header={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('community.title')}</Text>
            <Pressable
              style={styles.newPostBtn}
              onPress={() => {
                setShowPostInput(!showPostInput);
                triggerHaptic();
              }}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      }
    >
        {/* Create Post Input */}
        {showPostInput && (
          <Animated.View entering={BounceIn.duration(300)} style={styles.createPost}>
            <TextInput
              style={styles.postInput}
              placeholder={t('community.shareThoughts')}
              placeholderTextColor={colors.textMuted}
              value={postContent}
              onChangeText={handleContentChange}
              multiline
              autoFocus
            />
            {/* @Mention Autocomplete Suggestions */}
            {showMentionSuggestions && mentionSuggestions.length > 0 && (
              <View style={styles.mentionSuggestions}>
                {mentionSuggestions.map(user => (
                  <Pressable
                    key={user.id}
                    style={styles.mentionItem}
                    onPress={() => handleMentionSelect(user)}
                  >
                    <View style={[styles.mentionAvatar, { backgroundColor: colors.primary + '30' }]}>
                      <Text style={{ color: colors.primary, ...FONTS.bold, fontSize: FONTS.size.sm }}>{user.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text }}>{user.name}</Text>
                        {user.isVerified && (
                          <Ionicons name="checkmark-circle" size={12} color="#00E676" />
                        )}
                      </View>
                    </View>
                    <Ionicons name="at" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}
            <View style={styles.createPostActions}>
              <View style={styles.tagRow}>
                {['Stocks', 'Analysis', 'Question', 'Tips'].map(tag => (
                  <Pressable key={tag} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.createPostBtns}>
                <Button
                  title={t('app.cancel')}
                  variant="ghost"
                  size="small"
                  onPress={() => { setShowPostInput(false); setPostContent(''); }}
                />
                <Button
                  title={t('community.post')}
                  size="small"
                  onPress={handlePost}
                  disabled={!postContent.trim()}
                />
              </View>
            </View>
          </Animated.View>
        )}

        {/* Feed Tabs */}
        <View style={styles.feedTabs}>
          {FEED_TABS.map(tab => (
            <Pressable
              key={tab.key}
              style={[styles.feedTab, feedSort === tab.key && styles.feedTabActive]}
              onPress={() => {
                triggerHaptic();
                setFeedSort(tab.key);
              }}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={feedSort === tab.key ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.feedTabText, feedSort === tab.key && styles.feedTabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Trending Tags */}
        <View style={styles.trendingSection}>
          <View style={styles.trendingHeader}>
            <Ionicons name="flame" size={18} color={colors.warning} />
            <Text style={styles.trendingTitle}>{t('community.trendingTopics')}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {trendingTags.map(tag => (
              <Pressable key={tag} style={styles.trendingTag}>
                <Text style={styles.trendingTagText}>#{tag}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Posts */}
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            isLiked={likedSet.has(post.id)}
            isBookmarked={bookmarkedSet.has(post.id)}
            onLike={() => handleLike(post.id)}
            onBookmark={() => handleBookmark(post.id)}
            onUserPress={() => handleUserPress(post.userId, post.userName)}
            onPostPress={() => handlePostPress(post.id)}
            onShare={() => handleShare(post)}
            onMentionPress={(username) => navigation.navigate('TraderProfile', { traderId: username })}
            colors={colors}
            styles={styles}
          />
        ))}

    </AppScreen>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
  header: {
    // AppScreen already pads for the status-bar/safe-area inset
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
      color: colors.text,
    },
    newPostBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingBottom: 20,
    },
    createPost: {
      margin: SPACING.xl,
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    postInput: {
      color: colors.text,
      fontSize: FONTS.size.md,
      minHeight: 80,
      textAlignVertical: 'top',
      fontFamily: 'System',
    },
    createPostActions: {
      marginTop: SPACING.md,
      gap: SPACING.md,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    tagChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.bgInput,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tagChipText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textSecondary,
    },
    createPostBtns: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: SPACING.sm,
    },
    mentionSuggestions: {
      marginTop: SPACING.sm,
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    mentionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      gap: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    mentionAvatar: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    feedTabs: {
      flexDirection: 'row',
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
      backgroundColor: colors.bgInput,
      borderRadius: BORDER_RADIUS.md,
      padding: 3,
    },
    feedTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
    },
    feedTabActive: {
      backgroundColor: colors.bgCard,
    },
    feedTabText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
    },
    feedTabTextActive: {
      color: colors.primary,
      ...FONTS.semiBold,
    },
    trendingSection: {
      paddingHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
    },
    trendingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    trendingTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    trendingTag: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: SPACING.sm,
    },
    trendingTagText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      color: colors.primary,
    },
    postCard: {
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.md,
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    postAvatar: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.primary + '30',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    avatarText: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.primary,
    },
    postUser: {
      flex: 1,
    },
    userNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    userName: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    verifiedBadge: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#00E67620',
      justifyContent: 'center',
      alignItems: 'center',
    },
    postTime: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    bookmarkBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    postContent: {
      ...FONTS.regular,
      fontSize: FONTS.size.md,
      color: colors.text,
      lineHeight: 22,
      marginTop: SPACING.sm,
    },
    postTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
      marginTop: SPACING.md,
    },
    postActions: {
      flexDirection: 'row',
      gap: SPACING.xxl,
      marginTop: SPACING.lg,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    postAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    actionText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
    },
  });
