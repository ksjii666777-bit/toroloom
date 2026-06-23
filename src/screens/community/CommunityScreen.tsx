import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useCommunityStore } from '../../store/communityStore';
import { SPACING, FONTS, BORDER_RADIUS} from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { formatTimeAgo } from '../../utils/formatters';

Dimensions.get('window');

const trendingTags = ['RELIANCE', 'Nifty', 'SIP', 'Budget2025', 'TCS', 'IPO', 'Dividend', 'Crypto'];

export default function CommunityScreen({ _navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { posts, likePost, addPost } = useCommunityStore();
  const [showPostInput, setShowPostInput] = useState(false);
  const [postContent, setPostContent] = useState('');

  const handlePost = () => {
    if (postContent.trim()) {
      addPost(postContent.trim(), []);
      setPostContent('');
      setShowPostInput(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Community</Text>
          <TouchableOpacity style={styles.newPostBtn} onPress={() => setShowPostInput(!showPostInput)}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Create Post Input */}
        {showPostInput && (
          <View style={styles.createPost}>
            <TextInput
              style={styles.postInput}
              placeholder="Share your thoughts with the community..."
              placeholderTextColor={colors.textMuted}
              value={postContent}
              onChangeText={setPostContent}
              multiline
              autoFocus
            />
            <View style={styles.createPostActions}>
              <View style={styles.tagRow}>
                {['Stocks', 'Analysis', 'Question', 'Tips'].map(tag => (
                  <TouchableOpacity key={tag} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.createPostBtns}>
                <Button title="Cancel" variant="ghost" size="small" onPress={() => { setShowPostInput(false); setPostContent(''); }} />
                <Button title="Post" size="small" onPress={handlePost} disabled={!postContent.trim()} />
              </View>
            </View>
          </View>
        )}

        {/* Trending Tags */}
        <View style={styles.trendingSection}>
          <View style={styles.trendingHeader}>
            <Ionicons name="flame" size={18} color={colors.warning} />
            <Text style={styles.trendingTitle}>Trending Topics</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {trendingTags.map(tag => (
              <TouchableOpacity key={tag} style={styles.trendingTag}>
                <Text style={styles.trendingTagText}>#{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Posts */}
        {posts.map(post => (
          <TouchableOpacity key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <View style={styles.postAvatar}>
                <Text style={styles.avatarText}>{post.userName[0]}</Text>
              </View>
              <View style={styles.postUser}>
                <Text style={styles.userName}>{post.userName}</Text>
                <Text style={styles.postTime}>{formatTimeAgo(post.timestamp)}</Text>
              </View>
            </View>
            <Text style={styles.postContent}>{post.content}</Text>
            {post.tags.length > 0 && (
              <View style={styles.postTags}>
                {post.tags.map(tag => (
                  <Badge key={tag} label={tag} variant="primary" size="medium" />
                ))}
              </View>
            )}
            <View style={styles.postActions}>
              <TouchableOpacity style={styles.postAction} onPress={() => likePost(post.id)}>
                <Ionicons name="heart-outline" size={18} color={colors.textMuted} />
                <Text style={styles.actionText}>{post.likes}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.postAction}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
                <Text style={styles.actionText}>{post.comments}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.postAction}>
                <Ionicons name="share-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      paddingTop: 60,
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
    userName: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    postTime: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    postContent: {
      ...FONTS.regular,
      fontSize: FONTS.size.md,
      color: colors.text,
      lineHeight: 22,
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
