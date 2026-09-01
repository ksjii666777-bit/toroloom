import { create } from 'zustand';
import { CommunityPost, Comment } from '../types';
import { mockPosts } from '../constants/mockData';
import { communityApi } from '../services/api/community';
import { offlineCache } from '../services/offlineCache';
import { registerCacheWarming } from '../services/cacheWarmingService';
import { extractMentionedUsers } from '../utils/mentions';
import { sendMentionNotification, sendReplyNotification } from '../services/notificationService';
import { log } from '../utils/logger';

/** Monotonic counter — keeps locally-created post/comment ids unique even when
 * two creations land in the same Date.now() tick (CI-fast collisions). */
let _communityIdSeq = 0;
const genCommunityId = (prefix: string) => `${prefix}_${Date.now()}_${_communityIdSeq++}`;

export type FeedSort = 'hot' | 'new' | 'top';

// ─── Hot Algorithm: time-decay scoring ─────────────────────────────────────
// Posts lose ~50% of their "score" every 6 hours (half-life = 6h).
// score = (likes × 0.6 + comments × 0.4) × recencyMultiplier
// recencyMultiplier = 2 ^ (-hoursAged / 6)
//
// This ensures fresh, engaging content surfaces while older viral
// posts naturally slide down.
// ────────────────────────────────────────────────────────────────────────────

const HOT_HALF_LIFE_HOURS = 6;

function hotScore(post: { likes: number; comments: number; timestamp: string }): number {
  const engagement = post.likes * 0.6 + post.comments * 0.4;
  const hoursAged = (Date.now() - new Date(post.timestamp).getTime()) / (1000 * 60 * 60);
  const recencyMultiplier = Math.pow(0.5, hoursAged / HOT_HALF_LIFE_HOURS);
  // Ensure even zero-engagement posts get a tiny base score so recency still
  // matters as a tie-breaker.
  return (engagement + 0.01) * recencyMultiplier;
}

interface CommunityState {
  posts: CommunityPost[];
  comments: Record<string, Comment[]>;
  isLoading: boolean;
  isRefreshing: boolean;
  totalPages: number;
  currentPage: number;
  feedSort: FeedSort;
  bookmarkedPostIds: string[];
  likedPostIds: string[];
  
  fetchPosts: (page?: number, tag?: string) => Promise<void>;
  refreshPosts: () => Promise<void>;
  addPost: (content: string, tags: string[]) => Promise<void>;
  /** Load cached community posts at app startup for instant display */
  loadCachedCommunity: () => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  bookmarkPost: (postId: string) => void;
  setFeedSort: (sort: FeedSort) => void;
  fetchComments: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: mockPosts,
  comments: {},
  isLoading: false,
  isRefreshing: false,
  totalPages: 1,
  currentPage: 1,
  feedSort: 'hot',
  bookmarkedPostIds: ['p1', 'p3'],
  likedPostIds: ['p1', 'p4'],

  fetchPosts: async (page = 1, tag?: string) => {
    set({ isLoading: true });
    try {
      const { feedSort } = get();
      const data = await communityApi.getPosts(page, 10, tag, feedSort);
      set({
        posts: data.posts,
        totalPages: data.totalPages,
        currentPage: data.page,
        isLoading: false,
      });
      // Cache on successful fetch
      await offlineCache.save('community', { posts: get().posts, totalPages: data.totalPages });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<{ posts: CommunityPost[]; totalPages: number }>('community');
      if (cached) {
        set({ posts: cached.data.posts, totalPages: cached.data.totalPages, isLoading: false });
        log.info('[Community] Serving stale cached posts');
        return;
      }
      // Keep existing data
      set({ isLoading: false });
    }
  },

  refreshPosts: async () => {
    set({ isRefreshing: true });
    try {
      const { feedSort } = get();
      const data = await communityApi.getPosts(1, 10, undefined, feedSort);
      set({
        posts: data.posts,
        totalPages: data.totalPages,
        currentPage: 1,
        isRefreshing: false,
      });
      // Cache on successful fetch
      await offlineCache.save('community', { posts: get().posts, totalPages: data.totalPages });
    } catch {
      // Backend unavailable — sort mock data
      const { feedSort } = get();
      const sorted = [...mockPosts];
      if (feedSort === 'top') {
        sorted.sort((a, b) => b.likes - a.likes);
      } else if (feedSort === 'new') {
        sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } else {
        // hot: time-decay scoring
        sorted.sort((a, b) => hotScore(b) - hotScore(a));
      }
      set({ posts: sorted, isRefreshing: false });
    }
  },

  addPost: async (content, tags) => {
    const postAuthor = 'Rahul Sharma';

    let postId: string;
    try {
      const created = await communityApi.createPost(content, tags);
      postId = created.id;
      set(state => ({
        posts: [created, ...state.posts],
      }));
      // Cache after mutation
      await offlineCache.save('community', { posts: get().posts, totalPages: get().totalPages });
    } catch {
      // Backend unavailable — create locally
      postId = genCommunityId('p');
      set(state => ({
        posts: [{
          id: postId,
          userId: 'user_1',
          userName: postAuthor,
          content,
          likes: 0,
          comments: 0,
          timestamp: new Date().toISOString(),
          tags,
        }, ...state.posts],
      }));
      // Cache after local mutation
      await offlineCache.save('community', { posts: get().posts, totalPages: get().totalPages });
    }

    // ── Send @mention notifications ──────────────────────────────────
    try {
      const mentionedUsernames = extractMentionedUsers(content);
      if (mentionedUsernames.length > 0) {
        log.info(`[Community] Post ${postId} mentions: ${mentionedUsernames.join(', ')}`);
        // Fire a local push notification for each mentioned user.
        // In production this would be handled server-side; here we fire
        // a local notification as a best-effort UX signal.
        for (const _username of mentionedUsernames) {
          await sendMentionNotification(postAuthor, postId, content);
          // Only send one notification per post to avoid spam
          break;
        }
      }
    } catch {
      // Mention notifications are best-effort — don't break the post flow
    }
  },

  likePost: async (postId) => {
    const { likedPostIds } = get();
    const isLiked = likedPostIds.includes(postId);

    try {
      await communityApi.likePost(postId);
    } catch {
      // Backend unavailable — execute locally
    }

    // Toggle liked state: increment when liking, decrement when unliking
    set(state => ({
      posts: state.posts.map(p =>
        p.id === postId ? { ...p, likes: Math.max(0, p.likes + (isLiked ? -1 : 1)) } : p
      ),
      likedPostIds: isLiked
        ? state.likedPostIds.filter(id => id !== postId)
        : [...state.likedPostIds, postId],
    }));
    // Cache after mutation
    await offlineCache.save('community', { posts: get().posts, totalPages: get().totalPages });
  },

  bookmarkPost: async (postId) => {
    set(state => ({
      bookmarkedPostIds: state.bookmarkedPostIds.includes(postId)
        ? state.bookmarkedPostIds.filter(id => id !== postId)
        : [...state.bookmarkedPostIds, postId],
    }));
    // Cache after local mutation
    await offlineCache.save('community', { posts: get().posts, totalPages: get().totalPages });
  },

  setFeedSort: (sort) => {
    set({ feedSort: sort });
    // Re-sort posts based on the selected sort
    const { posts } = get();
    const sorted = [...posts];
    if (sort === 'top') {
      sorted.sort((a, b) => b.likes - a.likes);
    } else if (sort === 'new') {
      sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else {
      // hot: time-decay scoring
      sorted.sort((a, b) => hotScore(b) - hotScore(a));
    }
    set({ posts: sorted });
  },

  fetchComments: async (postId) => {
    try {
      const comments = await communityApi.getComments(postId);
      set(state => ({
        comments: { ...state.comments, [postId]: comments },
      }));
    } catch {
      // Generate mock comments
      const mockComments: Comment[] = [
        { id: `c_${postId}_1`, postId, userId: 'u2', userName: 'Priya Patel', content: 'Great insight! Thanks for sharing your analysis.', timestamp: new Date(Date.now() - 3600000).toISOString() },
        { id: `c_${postId}_2`, postId, userId: 'u3', userName: 'Arun Kumar', content: 'I agree with this. The technical setup looks promising.', timestamp: new Date(Date.now() - 7200000).toISOString() },
        { id: `c_${postId}_3`, postId, userId: 'u5', userName: 'Vikram Reddy', content: 'Adding this to my watchlist. Thanks for the tip! 🔥', timestamp: new Date(Date.now() - 10800000).toISOString() },
      ];
      set(state => ({
        comments: { ...state.comments, [postId]: mockComments },
      }));
    }
  },

  loadCachedCommunity: async () => {
    const cached = await offlineCache.load<{ posts: CommunityPost[]; totalPages: number }>('community');
    if (cached) {
      set({ posts: cached.data.posts, totalPages: cached.data.totalPages });
    }
  },

  addComment: async (postId, content) => {
    const commentAuthor = 'Rahul Sharma';
    const newComment: Comment = {
      id: genCommunityId(`c_${postId}`),
      postId,
      userId: 'user_1',
      userName: commentAuthor,
      content,
      timestamp: new Date().toISOString(),
    };

    set(state => ({
      comments: {
        ...state.comments,
        [postId]: [...(state.comments[postId] || []), newComment],
      },
      posts: state.posts.map(p =>
        p.id === postId ? { ...p, comments: p.comments + 1 } : p
      ),
    }));

    // ── Send reply notification to post author ───────────────────────
    try {
      const post = get().posts.find(p => p.id === postId);
      if (post && post.userId !== 'user_1') {
        // Don't notify yourself when you reply to your own post
        await sendReplyNotification(commentAuthor, postId, content);
      }
    } catch {
      // Reply notifications are best-effort
    }

    // ── Send @mention notifications from comment ─────────────────────
    try {
      const mentionedUsernames = extractMentionedUsers(content);
      if (mentionedUsernames.length > 0) {
        log.info(`[Community] Comment on ${postId} mentions: ${mentionedUsernames.join(', ')}`);
        for (const _username of mentionedUsernames) {
          await sendMentionNotification(commentAuthor, postId, content);
          break; // One notification per comment
        }
      }
    } catch {
      // Mention notifications are best-effort
    }
  },
}));

// Register for cache warming (priority 4 — stable content)
registerCacheWarming('community', () => useCommunityStore.getState().fetchPosts(), 4);
