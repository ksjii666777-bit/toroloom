import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Animated,
  Keyboard,
  Modal,
  Share,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { mockNews } from '../../constants/mockData';
import { MarketNewsItem } from '../../types';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

const { width } = Dimensions.get('window');

type NewsCategory = 'all' | 'markets' | 'economy' | 'corporate' | 'ipo' | 'global' | 'policy';
const CATEGORIES: { key: NewsCategory; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'newspaper' },
  { key: 'markets', label: 'Markets', icon: 'trending-up' },
  { key: 'corporate', label: 'Corporate', icon: 'business' },
  { key: 'economy', label: 'Economy', icon: 'globe' },
  { key: 'policy', label: 'Policy', icon: 'shield-checkmark' },
  { key: 'ipo', label: 'IPO', icon: 'rocket' },
  { key: 'global', label: 'Global', icon: 'earth' },
];

const SENTIMENT_CONFIG = {
  positive: { icon: 'trending-up', color: '#10B981', bgColor: '#10B98120', label: 'Positive' },
  negative: { icon: 'trending-down', color: '#EF4444', bgColor: '#EF444420', label: 'Negative' },
  neutral: { icon: 'remove', color: '#F59E0B', bgColor: '#F59E0B20', label: 'Neutral' },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Sentiment Badge ───────────────────────────────────────
function SentimentBadge({ sentiment }: { sentiment: MarketNewsItem['sentiment'] }) {
  const config = SENTIMENT_CONFIG[sentiment];
  return (
    <View style={[sentimentBadgeStyles.container, { backgroundColor: config.bgColor }]}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[sentimentBadgeStyles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const sentimentBadgeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});

// ─── Category Chip ─────────────────────────────────────────
function CategoryChip({
  category,
  isActive,
  onPress,
}: {
  category: (typeof CATEGORIES)[0];
  isActive: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        categoryChipStyles.chip,
        {
          backgroundColor: isActive ? colors.primary : colors.bgCardLight,
          borderColor: isActive ? colors.primary : colors.border,
        },
      ]}
    >
      <Ionicons
        name={category.icon as any}
        size={14}
        color={isActive ? '#FFFFFF' : colors.textSecondary}
      />
      <Text
        style={[
          categoryChipStyles.label,
          { color: isActive ? '#FFFFFF' : colors.textSecondary },
        ]}
      >
        {category.label}
      </Text>
    </TouchableOpacity>
  );
}

const categoryChipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});

// ─── News Card ────────────────────────────────────────────
function NewsCard({
  article,
  onPress,
  onBookmark,
  index,
}: {
  article: MarketNewsItem;
  onPress: () => void;
  onBookmark: () => void;
  index: number;
}) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(index * 60)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const categoryLabel = CATEGORIES.find(c => c.key === article.category)?.label || article.category;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <AnimatedPressable onPress={onPress} haptic="light" scaleTo={0.98}>
        <View style={[newsCardStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Category Badge */}
          <View style={newsCardStyles.topRow}>
            <View style={[newsCardStyles.categoryBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[newsCardStyles.categoryText, { color: colors.primary }]}>{categoryLabel}</Text>
            </View>
            <View style={newsCardStyles.topActions}>
              {article.symbol && (
                <View style={[newsCardStyles.symbolBadge, { backgroundColor: colors.bgCardLight }]}>
                  <Text style={[newsCardStyles.symbolText, { color: colors.warning }]}>{article.symbol}</Text>
                </View>
              )}
              <TouchableOpacity onPress={onBookmark} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                  name={article.bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={article.bookmarked ? colors.warning : colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Title */}
          <Text style={[newsCardStyles.title, { color: colors.text }]} numberOfLines={2}>
            {article.title}
          </Text>

          {/* Summary */}
          <Text style={[newsCardStyles.summary, { color: colors.textSecondary }]} numberOfLines={2}>
            {article.summary}
          </Text>

          {/* Bottom Row */}
          <View style={newsCardStyles.bottomRow}>
            <SentimentBadge sentiment={article.sentiment} />
            <View style={newsCardStyles.metaRow}>
              <Text style={[newsCardStyles.source, { color: colors.textMuted }]}>{article.source}</Text>
              <Text style={[newsCardStyles.dot, { color: colors.textMuted }]}>·</Text>
              <Text style={[newsCardStyles.time, { color: colors.textMuted }]}>
                {formatRelativeTime(article.publishedAt)}
              </Text>
              {!article.read && <View style={[newsCardStyles.unreadDot, { backgroundColor: colors.primary }]} />}
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const newsCardStyles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  symbolText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  source: {
    fontSize: 11,
    fontWeight: '500',
  },
  dot: {
    fontSize: 11,
  },
  time: {
    fontSize: 11,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
  },
});

// ─── Article Detail Modal ─────────────────────────────────
function ArticleDetailModal({
  article,
  visible,
  onClose,
  onBookmark,
}: {
  article: MarketNewsItem | null;
  visible: boolean;
  onClose: () => void;
  onBookmark: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handleShare = useCallback(async () => {
    if (!article) return;
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\n${article.summary}\n\nvia Toroloom`,
      });
    } catch {
      // User cancelled share
    }
  }, [article]);

  if (!article) return null;

  const categoryLabel = CATEGORIES.find(c => c.key === article.category)?.label || article.category;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[detailStyles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <LinearGradient
          colors={['rgba(59,130,246,0.1)', 'transparent']}
          style={[detailStyles.header, { paddingTop: insets.top + 12 }]}
        >
          <View style={detailStyles.headerRow}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={detailStyles.headerActions}>
              <TouchableOpacity onPress={onBookmark} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                  name={article.bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={22}
                  color={article.bookmarked ? colors.warning : colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="share-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={detailStyles.content}
        >
          {/* Meta Row */}
          <View style={detailStyles.metaRow}>
            <View style={[detailStyles.categoryBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[detailStyles.categoryText, { color: colors.primary }]}>{categoryLabel}</Text>
            </View>
            {article.symbol && (
              <View style={[detailStyles.symbolBadge, { backgroundColor: colors.bgCardLight }]}>
                <Text style={[detailStyles.symbolText, { color: colors.warning }]}>{article.symbol}</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={[detailStyles.title, { color: colors.text }]}>{article.title}</Text>

          {/* Source & Time */}
          <View style={detailStyles.sourceRow}>
            <SentimentBadge sentiment={article.sentiment} />
            <Text style={[detailStyles.sourceText, { color: colors.textMuted }]}>
              {article.source} · {formatRelativeTime(article.publishedAt)}
            </Text>
          </View>

          {/* Summary */}
          <View style={[detailStyles.summaryBox, { backgroundColor: colors.bgCardLight, borderLeftColor: colors.primary }]}>
            <Text style={[detailStyles.summaryText, { color: colors.textSecondary }]}>{article.summary}</Text>
          </View>

          {/* Full Content */}
          <Text style={[detailStyles.bodyText, { color: colors.text }]}>{article.content}</Text>

          {/* Published Date */}
          <Text style={[detailStyles.footerDate, { color: colors.textMuted }]}>
            Published: {new Date(article.publishedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.huge,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  symbolBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  symbolText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: SPACING.md,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryBox: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    marginBottom: SPACING.lg,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: SPACING.xxl,
  },
  footerDate: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
});

// ─── Main Screen ──────────────────────────────────────────
export default function NewsFeedScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('all');
  const [news, setNews] = useState<MarketNewsItem[]>(mockNews);
  const [selectedArticle, setSelectedArticle] = useState<MarketNewsItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const searchRef = useRef<TextInput>(null);

  // Extract trending symbols from current news
  const trendingSymbols = useMemo(() => {
    const symbols = new Set<string>();
    news.forEach(a => {
      if (a.symbol) symbols.add(a.symbol);
    });
    return Array.from(symbols).slice(0, 6);
  }, [news]);

  // Breaking news: top 3 unread articles sorted by most recent
  const breakingNews = useMemo(() => {
    return [...news]
      .filter(a => !a.read)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 3);
  }, [news]);

  // Filtered & searched news
  const filteredNews = useMemo(() => {
    let items = activeCategory === 'all' ? news : news.filter(a => a.category === activeCategory);

    // Filter by bookmarked
    if (showBookmarkedOnly) {
      items = items.filter(a => a.bookmarked);
    }

    // Filter by symbol
    if (activeSymbol) {
      items = items.filter(a => a.symbol === activeSymbol);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q) ||
          (a.symbol && a.symbol.toLowerCase().includes(q))
      );
    }

    // Sort: unread first, then by date (newest first)
    return items.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [news, activeCategory, searchQuery, showBookmarkedOnly, activeSymbol]);

  const bookmarkCount = useMemo(() => news.filter(n => n.bookmarked).length, [news]);
  const unreadCount = useMemo(() => news.filter(n => !n.read).length, [news]);

  // Bookmark toggle
  const toggleBookmark = useCallback((articleId: string) => {
    setNews(prev =>
      prev.map(a => (a.id === articleId ? { ...a, bookmarked: !a.bookmarked } : a))
    );
  }, []);

  // Mark as read when opening detail
  const openArticle = useCallback((article: MarketNewsItem) => {
    setSelectedArticle(article);
    setModalVisible(true);
    if (!article.read) {
      setNews(prev =>
        prev.map(a => (a.id === article.id ? { ...a, read: true } : a))
      );
    }
  }, []);

  const toggleSearch = useCallback(() => {
    setShowSearch(prev => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchRef.current?.focus(), 200);
      } else {
        setSearchQuery('');
        Keyboard.dismiss();
      }
      return next;
    });
  }, []);

  return (
    <View style={[feedStyles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[feedStyles.header, { paddingTop: insets.top + 12 }]}>
        <View style={feedStyles.headerTop}>
          <View>
            <Text style={[feedStyles.title, { color: colors.text }]}>Market News</Text>
            <Text style={[feedStyles.subtitle, { color: colors.textMuted }]}>
              {unreadCount > 0
                ? `${unreadCount} unread · ${filteredNews.length} articles`
                : `${filteredNews.length} articles`}
              {bookmarkCount > 0 && ` · ${bookmarkCount} bookmarked`}
            </Text>
          </View>
          <View style={feedStyles.headerActions}>
            <AnimatedPressable onPress={toggleSearch} haptic="light" scaleTo={0.9}>
              <View style={[feedStyles.iconBtn, { backgroundColor: colors.bgCardLight }]}>
                <Ionicons
                  name={showSearch ? 'close' : 'search'}
                  size={20}
                  color={colors.text}
                />
              </View>
            </AnimatedPressable>
          </View>
        </View>

        {/* Search Bar */}
        {showSearch && (
          <View style={[feedStyles.searchContainer, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              ref={searchRef}
              style={[feedStyles.searchInput, { color: colors.text }]}
              placeholder="Search news, symbols, sources..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Breaking News Banner */}
        {breakingNews.length > 0 && !showSearch && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: SPACING.sm }}
          >
            {breakingNews.map(item => {
              const categoryLabel = CATEGORIES.find(c => c.key === item.category)?.label || item.category;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[feedStyles.breakingCard, { backgroundColor: colors.primary, borderColor: colors.primaryLight }]}
                  onPress={() => openArticle(item)}
                  activeOpacity={0.85}
                >
                  <View style={feedStyles.breakingTop}>
                    <View style={feedStyles.breakingBadge}>
                      <Text style={feedStyles.breakingBadgeText}>BREAKING</Text>
                    </View>
                    <Text style={feedStyles.breakingCategory}>{categoryLabel}</Text>
                  </View>
                  <Text style={feedStyles.breakingTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={feedStyles.breakingTime}>
                    {formatRelativeTime(item.publishedAt)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Category Chips + Bookmark filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={feedStyles.categoriesContainer}
        >
          {/* Bookmarks toggle chip */}
          <TouchableOpacity
            onPress={() => {
              setShowBookmarkedOnly(prev => !prev);
              if (showBookmarkedOnly) setActiveCategory('all');
            }}
            activeOpacity={0.7}
            style={[
              categoryChipStyles.chip,
              {
                backgroundColor: showBookmarkedOnly ? colors.warning : colors.bgCardLight,
                borderColor: showBookmarkedOnly ? colors.warning : colors.border,
              },
            ]}
          >
            <Ionicons
              name={showBookmarkedOnly ? 'bookmark' : 'bookmark-outline'}
              size={14}
              color={showBookmarkedOnly ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[
                categoryChipStyles.label,
                { color: showBookmarkedOnly ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              Saved
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map(cat => (
            <CategoryChip
              key={cat.key}
              category={cat}
              isActive={activeCategory === cat.key}
              onPress={() => {
                setActiveCategory(cat.key);
                if (cat.key !== 'all') setShowBookmarkedOnly(false);
              }}
            />
          ))}
        </ScrollView>
      </View>      {/* Trending Symbols */}
        {trendingSymbols.length > 0 && !showSearch && (
          <View style={feedStyles.trendingSection}>
            <View style={feedStyles.trendingHeader}>
              <Ionicons name="trending-up" size={14} color={colors.textMuted} />
              <Text style={[feedStyles.trendingLabel, { color: colors.textMuted }]}>Trending</Text>
            </View>
            <View style={feedStyles.trendingRow}>
              {trendingSymbols.map(sym => (
                <TouchableOpacity
                  key={sym}
                  style={[
                    feedStyles.trendingChip,
                    {
                      backgroundColor: activeSymbol === sym ? colors.warning + '20' : colors.bgCardLight,
                      borderColor: activeSymbol === sym ? colors.warning : colors.border,
                    },
                  ]}
                  onPress={() => setActiveSymbol(prev => prev === sym ? null : sym)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={activeSymbol === sym ? 'close-circle' : 'pricetag'}
                    size={12}
                    color={activeSymbol === sym ? colors.warning : colors.textSecondary}
                  />
                  <Text
                    style={[
                      feedStyles.trendingChipText,
                      { color: activeSymbol === sym ? colors.warning : colors.textSecondary },
                    ]}
                  >
                    {sym}
                  </Text>
                </TouchableOpacity>
              ))}
              {activeSymbol && (
                <TouchableOpacity
                  style={[feedStyles.trendingChip, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}
                  onPress={() => setActiveSymbol(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[feedStyles.trendingChipText, { color: colors.textMuted, fontSize: 11 }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* News List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={feedStyles.listContainer}
      >
        {filteredNews.length === 0 ? (
          <View style={feedStyles.emptyState}>
            <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
            <Text style={[feedStyles.emptyTitle, { color: colors.textMuted }]}>No articles found</Text>
            <Text style={[feedStyles.emptySubtitle, { color: colors.textMuted }]}>
              {searchQuery
                ? 'Try a different search term or category'
                : 'No news articles in this category yet'}
            </Text>
          </View>
        ) : (
          <>
            {/* Results count */}
            <Text style={[feedStyles.resultCount, { color: colors.textMuted }]}>
              Showing {filteredNews.length} article{filteredNews.length !== 1 ? 's' : ''}
            </Text>

            {/* Hero Featured Card — first article gets hero treatment */}
            {filteredNews.length > 0 && (
              <TouchableOpacity
                onPress={() => openArticle(filteredNews[0])}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[colors.primary + '25', colors.bgCard]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[feedStyles.heroCard, { borderColor: colors.primary + '30' }]}
                >
                  {/* Hero category badge */}
                  <View style={feedStyles.heroTop}>
                    <View style={[feedStyles.heroBadge, { backgroundColor: colors.primary }]}>
                      <Text style={feedStyles.heroBadgeText}>
                        {CATEGORIES.find(c => c.key === filteredNews[0].category)?.label || filteredNews[0].category}
                      </Text>
                    </View>
                    {filteredNews[0].symbol && (
                      <View style={[feedStyles.heroSymbol, { backgroundColor: colors.bgCardLight + 'CC' }]}>
                        <Text style={[feedStyles.heroSymbolText, { color: colors.warning }]}>{filteredNews[0].symbol}</Text>
                      </View>
                    )}
                  </View>

                  {/* Hero title */}
                  <Text style={[feedStyles.heroTitle, { color: colors.text }]} numberOfLines={2}>
                    {filteredNews[0].title}
                  </Text>

                  {/* Hero summary */}
                  <Text style={[feedStyles.heroSummary, { color: colors.textSecondary }]} numberOfLines={2}>
                    {filteredNews[0].summary}
                  </Text>

                  {/* Hero bottom */}
                  <View style={feedStyles.heroBottom}>
                    <SentimentBadge sentiment={filteredNews[0].sentiment} />
                    <View style={feedStyles.heroMeta}>
                      <Text style={[feedStyles.heroSource, { color: colors.textMuted }]}>{filteredNews[0].source}</Text>
                      <Text style={[feedStyles.heroDot, { color: colors.textMuted }]}>·</Text>
                      <Text style={[feedStyles.heroTime, { color: colors.textMuted }]}>
                        {formatRelativeTime(filteredNews[0].publishedAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Read now arrow */}
                  <View style={feedStyles.heroArrow}>
                    <Text style={[feedStyles.heroArrowText, { color: colors.primary }]}>Read Now</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* News Cards — start from index 1 (skip hero) */}
            {filteredNews.slice(1).map((article, index) => (
              <NewsCard
                key={article.id}
                article={article}
                index={index}
                onPress={() => openArticle(article)}
                onBookmark={() => toggleBookmark(article.id)}
              />
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Article Detail Modal */}
      <ArticleDetailModal
        article={selectedArticle}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onBookmark={() => selectedArticle && toggleBookmark(selectedArticle.id)}
      />
    </View>
  );
}

const feedStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    padding: 0,
  },
  // ── Breaking News Banner ──
  breakingCard: {
    width: width * 0.75,
    marginRight: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  breakingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  breakingBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  breakingBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  breakingCategory: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },
  breakingTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  breakingTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Trending Symbols ──
  trendingSection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  trendingLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  trendingChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Hero Featured Card ──
  heroCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  heroSymbol: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  heroSymbolText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: SPACING.sm,
  },
  heroSummary: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroSource: {
    fontSize: 11,
    fontWeight: '500',
  },
  heroDot: {
    fontSize: 11,
  },
  heroTime: {
    fontSize: 11,
  },
  heroArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.md,
  },
  heroArrowText: {
    fontSize: 12,
    fontWeight: '700',
  },

  categoriesContainer: {
    gap: 8,
    paddingBottom: SPACING.md,
  },
  listContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  resultCount: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
