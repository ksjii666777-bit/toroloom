// =============================================================================
// Toroloom — Financial Glossary Screen
// Searchable dictionary of 100+ financial terms with categories and detail view
// =============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Dimensions, Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { triggerHaptic } from '../../utils/haptics';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { glossaryTerms } from '../../constants/glossaryData';
import type { GlossaryTerm } from '../../types';

// ─── Category colors ─────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Equity: '#3B82F6',
  Derivatives: '#8B5CF6',
  'Mutual Funds': '#00E676',
  'Technical Analysis': '#FF6B6B',
  'Fundamental Analysis': '#06B6D4',
  Tax: '#FFAB40',
  Economy: '#FF6B00',
  IPO: '#FF5252',
  'Bonds & Debt': '#6C63FF',
  'Gold & Commodities': '#FFD700',
  'Real Estate': '#10B981',
  Trading: '#00D2FF',
  'Crypto & Digital Assets': '#F59E0B',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#64748B';
}

// ─── Group terms by alphabet ─────────────────────────────────────────────────
function groupByAlphabet(terms: GlossaryTerm[]): { type: 'alpha'; letter: string; terms: GlossaryTerm[] }[] {
  const map = new Map<string, GlossaryTerm[]>();
  for (const t of terms) {
    const letter = t.term[0].toUpperCase();
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(t);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, terms]) => ({ type: 'alpha' as const, letter, terms }));
}

// ─── Group terms by category ─────────────────────────────────────────────────
function groupByCategory(terms: GlossaryTerm[]): { type: 'category'; category: string; terms: GlossaryTerm[] }[] {
  const map = new Map<string, GlossaryTerm[]>();
  for (const t of terms) {
    if (!map.has(t.category)) map.set(t.category, []);
    map.get(t.category)!.push(t);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, terms]) => ({ type: 'category' as const, category, terms }));
}

export default function GlossaryScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(null);
  const [sortBy, setSortBy] = useState<'alpha' | 'category'>('alpha');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // ─── Derived data ────────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = new Set(glossaryTerms.map(t => t.category));
    return Array.from(cats).sort();
  }, []);

  const filteredTerms = useMemo(() => {
    let result = glossaryTerms;

    if (showFavorites) {
      result = result.filter(t => favorites.has(t.id));
    }

    if (selectedCategory) {
      result = result.filter(t => t.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t =>
        t.term.toLowerCase().includes(q) ||
        t.shortDefinition.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }

    return result;
  }, [searchQuery, selectedCategory, showFavorites, favorites]);

  const groupedTerms = useMemo(() => {
    const terms = filteredTerms;
    if (sortBy === 'alpha') return groupByAlphabet(terms);
    return groupByCategory(terms);
  }, [filteredTerms, sortBy]);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const toggleFavorite = useCallback((id: string) => {
    triggerHaptic();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleTermPress = useCallback((term: GlossaryTerm) => {
    triggerHaptic();
    setSelectedTerm(term);
  }, []);

  const handleRelatedTermPress = useCallback((relatedId: string) => {
    const term = glossaryTerms.find(t => t.id === relatedId);
    if (term) setSelectedTerm(term);
  }, []);

  // ─── Render term card ────────────────────────────────────────────────────────

  const renderTermCard = (term: GlossaryTerm, index: number) => (
    <Animated.View
      key={term.id}
      entering={FadeInDown.delay((index % 10) * 40).springify()}
    >
      <TouchableOpacity
        style={styles.termCard}
        onPress={() => handleTermPress(term)}
        onLongPress={() => toggleFavorite(term.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.termIconContainer, { backgroundColor: getCategoryColor(term.category) + '18' }]}>
          <Text style={styles.termIcon}>{term.icon || '📘'}</Text>
        </View>
        <View style={styles.termInfo}>
          <Text style={styles.termTitle} numberOfLines={1}>{term.term}</Text>
          <Text style={styles.termCategory}>{term.category}</Text>
        </View>
        <View style={styles.termRight}>
          {favorites.has(term.id) && (
            <Ionicons name="heart" size={14} color="#FF5252" style={{ marginBottom: 2 }} />
          )}
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  // ─── Render term detail modal ───────────────────────────────────────────────

  const renderTermDetail = () => {
    if (!selectedTerm) return null;
    return (
      <View style={styles.detailOverlay}>
        <TouchableOpacity
          style={styles.detailBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedTerm(null)}
        />
        <Animated.View
          entering={FadeInUp.springify()}
          style={styles.detailContainer}
        >
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <View style={[styles.detailIconContainer, { backgroundColor: getCategoryColor(selectedTerm.category) + '20' }]}>
                <Text style={styles.detailIcon}>{selectedTerm.icon || '📘'}</Text>
              </View>
              <Text style={styles.detailTitle}>{selectedTerm.term}</Text>
              <View style={[styles.detailCategoryBadge, { backgroundColor: getCategoryColor(selectedTerm.category) + '20' }]}>
                <Text style={[styles.detailCategoryText, { color: getCategoryColor(selectedTerm.category) }]}>
                  {selectedTerm.category}
                </Text>
              </View>
            </View>

            {/* Short definition */}
            <View style={[styles.detailSection, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
              <Ionicons name="bulb-outline" size={16} color={colors.primary} />
              <Text style={[styles.shortDefText, { color: colors.text }]}>
                {selectedTerm.shortDefinition}
              </Text>
            </View>

            {/* Detailed definition */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Detailed Explanation</Text>
              <Text style={styles.detailParagraph}>{selectedTerm.detailedDefinition}</Text>
            </View>

            {/* Example */}
            {selectedTerm.example && (
              <View style={[styles.detailSection, { backgroundColor: '#FFAB40' + '08', borderColor: '#FFAB40' + '20' }]}>
                <View style={styles.detailRow}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#FFAB40" />
                  <Text style={[styles.detailSectionTitle, { color: '#FFAB40', fontSize: 12 }]}>
                    Example
                  </Text>
                </View>
                <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
                  {selectedTerm.example}
                </Text>
              </View>
            )}

            {/* Tags */}
            {selectedTerm.tags && selectedTerm.tags.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Tags</Text>
                <View style={styles.tagsRow}>
                  {selectedTerm.tags.map((tag, i) => (
                    <View key={i} style={[styles.tag, { backgroundColor: colors.textMuted + '15' }]}>
                      <Text style={[styles.tagText, { color: colors.textMuted }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Related terms */}
            {selectedTerm.relatedTerms && selectedTerm.relatedTerms.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Related Terms</Text>
                <View style={styles.relatedRow}>
                  {selectedTerm.relatedTerms.map((relId) => {
                    const relTerm = glossaryTerms.find(t => t.id === relId);
                    if (!relTerm) return null;
                    return (
                      <TouchableOpacity
                        key={relId}
                        style={[styles.relatedChip, { backgroundColor: getCategoryColor(relTerm.category) + '15' }]}
                        onPress={() => handleRelatedTermPress(relId)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.relatedChipText, { color: getCategoryColor(relTerm.category) }]}>
                          {relTerm.term}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.detailActions}>
              <TouchableOpacity
                style={[styles.detailActionBtn, { backgroundColor: '#FF5252' + '15' }]}
                onPress={() => toggleFavorite(selectedTerm.id)}
              >
                <Ionicons
                  name={favorites.has(selectedTerm.id) ? 'heart' : 'heart-outline'}
                  size={18}
                  color="#FF5252"
                />
                <Text style={[styles.detailActionText, { color: '#FF5252' }]}>
                  {favorites.has(selectedTerm.id) ? 'Remove Bookmark' : 'Bookmark'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity
            style={styles.detailCloseBtn}
            onPress={() => setSelectedTerm(null)}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  // ─── Main render ────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Financial Glossary</Text>
          <Text style={styles.subtitle}>{glossaryTerms.length} terms</Text>
        </View>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterBtn}>
          <Ionicons
            name={showFilters ? 'options' : 'options-outline'}
            size={22}
            color={showFilters ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search terms, categories, or tags..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter bar */}
      {showFilters && (
        <Animated.View entering={FadeInDown.springify()} style={styles.filterBar}>
          {/* Sort toggle */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Sort by</Text>
            <View style={styles.sortToggle}>
              <TouchableOpacity
                style={[styles.sortBtn, sortBy === 'alpha' && { backgroundColor: colors.primary + '20' }]}
                onPress={() => setSortBy('alpha')}
              >
                <Text style={[styles.sortBtnText, { color: sortBy === 'alpha' ? colors.primary : colors.textMuted }]}>
                  A–Z
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortBtn, sortBy === 'category' && { backgroundColor: colors.primary + '20' }]}
                onPress={() => setSortBy('category')}
              >
                <Text style={[styles.sortBtnText, { color: sortBy === 'category' ? colors.primary : colors.textMuted }]}>
                  Category
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Favorites filter */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.favToggle, showFavorites && { backgroundColor: '#FF5252' + '20' }]}
              onPress={() => setShowFavorites(!showFavorites)}
            >
              <Ionicons name={showFavorites ? 'heart' : 'heart-outline'} size={16} color="#FF5252" />
              <Text style={[styles.favToggleText, showFavorites && { color: '#FF5252' }]}>
                Bookmarks ({favorites.size})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Category filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            <TouchableOpacity
              style={[styles.categoryChip, !selectedCategory && { backgroundColor: colors.primary + '20' }]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryChipText, !selectedCategory && { color: colors.primary }]}>
                All
              </Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  { borderColor: getCategoryColor(cat) + '30' },
                  selectedCategory === cat && { backgroundColor: getCategoryColor(cat) + '20' },
                ]}
                onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              >
                <View style={[styles.catDot, { backgroundColor: getCategoryColor(cat) }]} />
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: selectedCategory === cat ? getCategoryColor(cat) : colors.textMuted },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Results count */}
      <View style={styles.resultInfo}>
        <Text style={styles.resultCount}>
          {filteredTerms.length} {filteredTerms.length === 1 ? 'term' : 'terms'} found
        </Text>
      </View>

      {/* Terms list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {groupedTerms.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              No terms found
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {showFavorites
                ? 'Save bookmarks by long-pressing any term'
                : 'Try a different search or clear filters'}
            </Text>
          </View>
        ) : (
          groupedTerms.map((group, gi) => (
            <View key={group.type === 'alpha' ? group.letter : group.category} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupLetterCircle, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.groupLetter, { color: colors.primary }]}>
                    {group.type === 'alpha' ? group.letter : group.category[0]}
                  </Text>
                </View>
                <Text style={styles.groupTitle}>{group.type === 'alpha' ? `Letter ${group.letter}` : group.category}</Text>
                <Text style={styles.groupCount}>{group.terms.length}</Text>
              </View>
              {group.terms.map((term, i) => renderTermCard(term, i))}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Term Detail Modal */}
      {renderTermDetail()}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    paddingHorizontal: SPACING.md,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    marginLeft: SPACING.sm,
    height: 44,
  },

  // Filters
  filterBar: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  sortToggle: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.bgDark,
    borderRadius: BORDER_RADIUS.sm,
    padding: 2,
  },
  sortBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sortBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  favToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  favToggleText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginTop: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },

  // Results info
  resultInfo: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  resultCount: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },

  // Groups
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  groupSection: {
    marginBottom: SPACING.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  groupLetterCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupLetter: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  groupTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    flex: 1,
  },
  groupCount: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },

  // Term card
  termCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  termIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termIcon: {
    fontSize: 18,
  },
  termInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  termTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  termCategory: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  termRight: {
    alignItems: 'center',
    gap: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Detail modal
  detailOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  detailBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  detailContainer: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    maxHeight: Dimensions.get('window').height * 0.85,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  detailCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  detailIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 28,
  },
  detailTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
    textAlign: 'center',
  },
  detailCategoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  detailCategoryText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  detailSection: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  shortDefText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    lineHeight: 22,
  },
  detailSectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailParagraph: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exampleText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  tagText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  relatedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  relatedChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  relatedChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  detailActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  detailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
  },
  detailActionText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
});
