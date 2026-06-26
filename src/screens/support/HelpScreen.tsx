import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Dimensions, TextInput, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS, COLORS } from '../../constants/theme';
import { supportApi, FAQ } from '../../services/api/support';


const { width } = Dimensions.get('window');

// Fallback FAQs used when the backend is unreachable
const fallbackFAQs: FAQ[] = [
  { id: 'faq_1', question: 'How do I start investing?', answer: 'Complete your KYC verification first, then add funds to your account. You can start buying stocks, mutual funds, or set up SIPs directly from the app.', category: 'Getting Started', order: 1 },
  { id: 'faq_2', question: 'What are the charges and brokerage fees?', answer: 'We offer zero brokerage on equity delivery trades. Intraday and F&O trades have flat ₹20 per order. Mutual funds have zero commission. DP charges are ₹15 per scrip.', category: 'Charges', order: 2 },
  { id: 'faq_3', question: 'How long does KYC verification take?', answer: 'KYC verification typically takes 24-48 hours after submitting all required documents. You can check your KYC status in Profile & KYC section.', category: 'Account', order: 3 },
  { id: 'faq_4', question: 'How do I withdraw money from my account?', answer: 'Go to More > Withdraw. Funds are typically credited to your linked bank account within T+1 day. Minimum withdrawal is ₹100.', category: 'Account', order: 4 },
  { id: 'faq_5', question: 'What is a SIP and how do I start one?', answer: 'SIP (Systematic Investment Plan) lets you invest a fixed amount in mutual funds regularly. Go to Mutual Funds, select a fund, and choose SIP option with your preferred frequency.', category: 'Investing', order: 5 },
  { id: 'faq_6', question: 'How are my investments taxed?', answer: 'Equity gains held >1 year: 10% LTCG above ₹1L. Short-term: 15%. Mutual fund taxation varies by type. Consult a tax advisor for personalized advice.', category: 'Tax', order: 6 },
  { id: 'faq_7', question: 'Can I trade in US stocks?', answer: 'Yes! We support investing in top US stocks through our international trading platform. Additional documentation may be required for US market access.', category: 'Trading', order: 7 },
  { id: 'faq_8', question: 'What is the "Financial Bodyguard" feature?', answer: 'Financial Bodyguard is our risk management system that helps protect your portfolio. You can set daily loss limits, position size limits, and get real-time risk alerts.', category: 'Features', order: 8 },
  { id: 'faq_9', question: 'How do I reset my password?', answer: 'Go to the login screen and tap "Forgot Password". Enter your registered email or phone number to receive reset instructions.', category: 'Account', order: 9 },
  { id: 'faq_10', question: 'Is my money safe with Toroloom?', answer: 'Yes. We are SEBI-registered and your funds are held in a separate trust account. We use 256-bit encryption and two-factor authentication for all transactions.', category: 'Security', order: 10 },
];

const quickTopics = [
  { icon: 'person-add', label: 'Open Account', color: '#6C63FF', search: 'open account' },
  { icon: 'card', label: 'Add Funds', color: '#00C853', search: 'add funds invest' },
  { icon: 'swap-horizontal', label: 'Transfer', color: '#00D2FF', search: 'withdraw transfer money' },
  { icon: 'document-text', label: 'KYC Status', color: '#FFC107', search: 'kyc verification' },
  { icon: 'shield-checkmark', label: 'Account Safety', color: '#6C63FF', search: 'safe money security' },
  { icon: 'receipt', label: 'Charges', color: '#FF6B6B', search: 'charges brokerage fees' },
];

const contactOptions = [
  { icon: 'call', label: 'Call Support', detail: '1800-123-4567', hours: 'Mon-Sat, 9AM - 6PM', gradient: GRADIENTS.success, link: 'tel:18001234567' },
  { icon: 'mail', label: 'Email Us', detail: 'support@toroloom.com', hours: 'Response within 24 hrs', gradient: GRADIENTS.primary, link: 'mailto:support@toroloom.com' },
  { icon: 'chatbubbles', label: 'Live Chat', detail: 'Chat with our team', hours: 'Available 24/7', gradient: GRADIENTS.accent, link: '' },
];

export default function HelpScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>(fallbackFAQs);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [faqSectionY, setFaqSectionY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Fetch FAQs from backend on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await supportApi.getFAQs();
        if (mounted) {
          setFaqs(data.sort((a, b) => a.order - b.order));
        }
      } catch {
        // Backend unavailable — using fallback FAQs
      } finally {
        if (mounted) setLoadingFaqs(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return faqs.filter(faq => {
      const text = (faq.question + ' ' + faq.answer).toLowerCase();
      // Match if any term is found (OR logic — multiple words broaden the search)
      return terms.some(term => text.includes(term));
    });
  }, [searchQuery, faqs]);

  const toggleFaq = (question: string) => {
    setExpandedFaq(expandedFaq === question ? null : question);
  };

  const handleTopicPress = useCallback((topic: typeof quickTopics[0]) => {
    setSearchQuery(topic.search);
    setExpandedFaq(null);
    // Scroll to FAQ section after a brief delay so state updates first
    setTimeout(() => {
      if (faqSectionY > 0 && scrollRef.current) {
        scrollRef.current.scrollTo({ y: faqSectionY - 16, animated: true });
      }
    }, 100);
  }, [faqSectionY]);

  const handleContact = (option: typeof contactOptions[0]) => {
    if (option.link) {
      Linking.openURL(option.link).catch(() => {});
    }
  };

  const onFaqSectionLayout = useCallback((e: LayoutChangeEvent) => {
    setFaqSectionY(e.nativeEvent.layout.y);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Help & Support</Text>
            <Text style={styles.subtitle}>We're here to help you</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={searchQuery ? colors.primary : colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search help articles..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Topics */}
        <Text style={styles.sectionTitle}>Quick Help</Text>
        <View style={styles.topicsGrid}>
          {quickTopics.map((topic, i) => (
            <TouchableOpacity
              key={i}
              style={styles.topicItem}
              onPress={() => handleTopicPress(topic)}
              activeOpacity={0.6}
            >
              <View style={[styles.topicIcon, { backgroundColor: topic.color + '20' }]}>
                <Ionicons name={topic.icon as keyof typeof Ionicons.glyphMap} size={22} color={topic.color} />
              </View>
              <Text style={styles.topicLabel}>{topic.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact Options */}
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <View style={styles.contactRow}>
          {contactOptions.map((option, i) => (
            <TouchableOpacity
              key={i}
              style={styles.contactCard}
              onPress={() => handleContact(option)}
            >
              <LinearGradient colors={option.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.contactIcon}>
                <Ionicons name={option.icon as keyof typeof Ionicons.glyphMap} size={22} color={COLORS.white} />
              </LinearGradient>
              <Text style={styles.contactLabel}>{option.label}</Text>
              <Text style={styles.contactDetail}>{option.detail}</Text>
              <Text style={styles.contactHours}>{option.hours}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection} onLayout={onFaqSectionLayout}>
          <View style={styles.faqHeader}>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            <Text style={styles.faqCount}>
              {loadingFaqs
                ? 'Loading...'
                : filteredFaqs.length < faqs.length
                  ? `${filteredFaqs.length} of ${faqs.length}`
                  : `${faqs.length} articles`}
            </Text>
          </View>

          {loadingFaqs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading articles...</Text>
            </View>
          ) : filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, i) => {
            const isExpanded = expandedFaq === faq.id;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
                onPress={() => toggleFaq(faq.id)}
                activeOpacity={0.7}
              >
                <View style={styles.faqQuestionRow}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={isExpanded ? colors.primary : colors.textMuted}
                  />
                </View>
                {isExpanded && (
                  <View style={styles.faqAnswerContainer}>
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
          ) : (
            <View style={styles.noResults}>
              <Ionicons name="search-outline" size={48} color={colors.textMuted} />
              <Text style={styles.noResultsTitle}>No results found</Text>
              <Text style={styles.noResultsSubtitle}>
                Try a different search term or browse the topics above
              </Text>
            </View>
          )}
        </View>

        {/* App Info */}
        <View style={styles.appInfoCard}>
          <View style={styles.appInfoRow}>
            <View>
              <Text style={styles.appInfoLabel}>App Version</Text>
              <Text style={styles.appInfoValue}>2.1.0 (Build 42)</Text>
            </View>
            <View style={styles.appInfoDivider} />
            <View>
              <Text style={styles.appInfoLabel}>Last Updated</Text>
              <Text style={styles.appInfoValue}>May 2025</Text>
            </View>
          </View>
          <View style={styles.footerLinks}>
            <TouchableOpacity style={styles.footerLink}>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
            <View style={styles.footerLinkDot} />
            <TouchableOpacity style={styles.footerLink}>
              <Text style={styles.footerLinkText}>Terms of Service</Text>
            </TouchableOpacity>
            <View style={styles.footerLinkDot} />
            <TouchableOpacity style={styles.footerLink}>
              <Text style={styles.footerLinkText}>Licenses</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.copyright}>© 2025 Toroloom. All rights reserved.</Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerContent: {
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
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    gap: SPACING.sm,
    marginBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.text,
    height: '100%',
  },
  searchClear: {
    padding: 4,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  topicItem: {
    width: (width - SPACING.xl * 2 - SPACING.md * 2) / 3,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  topicIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.text,
    textAlign: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  contactCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 6,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  contactDetail: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  contactHours: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  faqSection: {
    marginBottom: SPACING.xxl,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  faqCount: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  faqItem: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  faqItemExpanded: {
    borderColor: colors.primary + '40',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  faqQuestion: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
    flex: 1,
    marginRight: SPACING.md,
    lineHeight: 20,
  },
  faqAnswerContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: SPACING.md,
  },
  faqAnswer: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  appInfoCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  appInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  appInfoLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  appInfoValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
    textAlign: 'center',
    marginTop: 2,
  },
  appInfoDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.divider,
    marginHorizontal: SPACING.xxl,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  footerLink: {
    paddingVertical: 4,
  },
  footerLinkText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.primary,
  },
  footerLinkDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl + SPACING.lg,
    gap: SPACING.md,
  },
  loadingText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.sm,
  },
  noResultsTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginTop: SPACING.sm,
  },
  noResultsSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  copyright: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
});
