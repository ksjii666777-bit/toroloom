/**
 * Horizontal list of market news cards.
 * Extracted from HomeScreen.tsx for better modularity.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

interface NewsItem {
  id?: string;
  title: string;
  source: string;
  category: string;
  sentiment: string;
  publishedAt: string;
}

interface MarketNewsProps {
  news: NewsItem[];
  navigation: NativeStackNavigationProp<RootStackParamList> | any;
  colors: any;
}

export function MarketNews({ news, navigation, colors }: MarketNewsProps) {
  const { t } = useT();

  if (news.length === 0) return null;

  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('home.marketNews')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NewsFeed')}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>{t('home.allNews')}</Text>
        </TouchableOpacity>
      </View>
      <FlashList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={news}
        keyExtractor={(item: any, i: number) => item.id || String(i)}
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigation.navigate('NewsFeed')}
            activeOpacity={0.7}
          >
            <View style={[styles.categoryBadge, {
              backgroundColor: item.sentiment === 'positive' ? '#00C85320' : item.sentiment === 'negative' ? '#FF174420' : '#FFAB4020',
            }]}>
              <Text style={[styles.categoryText, {
                color: item.sentiment === 'positive' ? '#00C853' : item.sentiment === 'negative' ? '#FF1744' : '#FFAB40',
              }]}>
                {item.category.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.source, { color: colors.textMuted }]}>
              {item.source} · {new Date(item.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  title: { ...FONTS.bold, fontSize: FONTS.size.md },
  seeAll: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  card: { width: 200, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginRight: SPACING.md },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: BORDER_RADIUS.xs, marginBottom: SPACING.sm },
  categoryText: { ...FONTS.bold, fontSize: 9, letterSpacing: 0.5 },
  cardTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: SPACING.xs },
  source: { ...FONTS.regular, fontSize: FONTS.size.xs },
});
