/**
 * ============================================================================
 * Toroloom — StockNewsSection
 * ============================================================================
 *
 * Fetches and displays news articles for a specific stock symbol.
 * Shows 3-5 latest articles with title, source, sentiment badge, and time.
 *
 * ============================================================================
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { newsApi } from '../../services/api';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { MarketNewsItem } from '../../types';

interface StockNewsSectionProps {
  symbol: string;
}

export default function StockNewsSection({ symbol }: StockNewsSectionProps) {
  const { colors } = useTheme();
  const [articles, setArticles] = useState<MarketNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const result = await newsApi.getNewsForSymbol(symbol);
      setArticles(result.articles?.slice(0, 5) || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.header}>
          <Ionicons name="newspaper-outline" size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Latest News</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading news...</Text>
        </View>
      </View>
    );
  }

  if (error || articles.length === 0) {
    return null; // Don't show empty/error state
  }

  const sentimentColor = (s: string) =>
    s === 'positive' ? '#22C55E' : s === 'negative' ? '#EF4444' : '#FFAB40';

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="newspaper-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Latest News</Text>
        <TouchableOpacity onPress={fetchNews} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {articles.map((article, i) => (
        <TouchableOpacity
          key={article.id || `news-${i}`}
          style={[
            styles.articleRow,
            i < articles.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider },
          ]}
          onPress={() => {
            // Article link not available in MarketNewsItem type
          }}
          activeOpacity={0.7}
        >
          <View style={styles.articleContent}>
            <Text style={[styles.articleTitle, { color: colors.text }]} numberOfLines={2}>
              {article.title}
            </Text>
            <View style={styles.articleMeta}>
              {article.source && (
                <Text style={[styles.articleSource, { color: colors.textMuted }]}>
                  {article.source}
                </Text>
              )}
              {article.publishedAt && (
                <Text style={[styles.articleTime, { color: colors.textMuted }]}>
                  · {timeAgo(article.publishedAt)}
                </Text>
              )}
              {article.sentiment && (
                <View style={[styles.sentimentBadge, { backgroundColor: sentimentColor(article.sentiment) + '20' }]}>
                  <Text style={[styles.sentimentText, { color: sentimentColor(article.sentiment) }]}>
                    {article.sentiment === 'positive' ? '↑' : article.sentiment === 'negative' ? '↓' : '•'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    flex: 1,
  },
  refreshBtn: {
    padding: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  loadingText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  articleContent: {
    flex: 1,
  },
  articleTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    lineHeight: 18,
    marginBottom: 4,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  articleSource: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  articleTime: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  sentimentBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentimentText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
