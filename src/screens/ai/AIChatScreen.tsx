import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import AppScreen from '../../components/ui/AppScreen';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useMarketStore } from '../../store/marketStore';
import { useMutualFundStore } from '../../store/mutualFundStore';
import { useAIStore } from '../../store/aiStore';
import { aiApi } from '../../services/api/ai';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';


// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

// ============================================================================
// Sample questions for quick access
// ============================================================================

const SAMPLE_QUESTION_KEYS = [
  { icon: '💰', labelKey: 'ai.qPortfolioValue', query: 'What is my total portfolio value?' },
  { icon: '📈', labelKey: 'ai.qBestPerformer', query: 'Which is my best performing stock?' },
  { icon: '📉', labelKey: 'ai.qWorstPerformer', query: 'Which is my worst performing stock?' },
  { icon: '🏆', labelKey: 'ai.qTotalPnl', query: 'What is my total profit and loss?' },
  { icon: '📊', labelKey: 'ai.qSectorAllocation', query: 'How is my portfolio allocated across sectors?' },
  { icon: '🔄', labelKey: 'ai.qSipStatus', query: 'How are my SIP investments doing?' },
];

// ============================================================================
// AI Response Builder
// ============================================================================

interface PortfolioContext {
  totalValue: number;
  totalInvested: number;
  totalPnl: number;
  totalPnlPercent: number;
  holdingsCount: number;
  winners: number;
  losers: number;
  bestHolding: { name: string; pnlPercent: number } | null;
  worstHolding: { name: string; pnlPercent: number } | null;
  topSector: string;
  sipCount: number;
  sipTotalInvested: number;
  sipTotalValue: number;
  marketStatus: 'up' | 'down' | 'mixed';
}

function buildPortfolioContext(): PortfolioContext {
  const portfolio = usePortfolioStore.getState();
  const market = useMarketStore.getState();
  const mf = useMutualFundStore.getState();

  const holdings = portfolio.holdings;
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested = holdings.reduce((s, h) => s + h.totalInvested, 0);
  const totalPnl = totalValue - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const winners = holdings.filter(h => h.pnl >= 0).length;
  const losers = holdings.filter(h => h.pnl < 0).length;

  const sortedByPnl = [...holdings].sort((a, b) => b.pnlPercent - a.pnlPercent);
  const bestHolding = sortedByPnl.length > 0 ? { name: sortedByPnl[0].name, pnlPercent: sortedByPnl[0].pnlPercent } : null;
  const worstHolding = sortedByPnl.length > 0 ? { name: sortedByPnl[sortedByPnl.length - 1].name, pnlPercent: sortedByPnl[sortedByPnl.length - 1].pnlPercent } : null;

  // Sector allocation
  const sectors = new Map<string, number>();
  for (const h of holdings) {
    const stock = market.stocks.find(s => s.id === h.stockId);
    const sector = stock?.sector || 'Other';
    sectors.set(sector, (sectors.get(sector) || 0) + h.currentValue);
  }
  let topSector = 'N/A';
  let maxVal = 0;
  sectors.forEach((val, key) => {
    if (val > maxVal) { maxVal = val; topSector = key; }
  });

  // SIP data
  const sipCount = mf.sipPlans.length;
  const sipTotalInvested = mf.sipPlans.reduce((s, p) => s + p.totalInvested, 0);
  const sipTotalValue = mf.sipPlans.reduce((s, p) => s + p.currentValue, 0);

  // Market status
  const positiveIndices = market.indices.filter(i => i.isPositive).length;
  const totalIndices = market.indices.length;
  const marketStatus = positiveIndices === totalIndices ? 'up' : positiveIndices === 0 ? 'down' : 'mixed';

  return {
    totalValue, totalInvested, totalPnl, totalPnlPercent,
    holdingsCount: holdings.length,
    winners, losers,
    bestHolding, worstHolding,
    topSector, sipCount, sipTotalInvested, sipTotalValue, marketStatus,
  };
}

function generateResponse(query: string, ctx: PortfolioContext, t: any): string {
  const q = query.toLowerCase();

  // Helper to format response with portfolio context
  const pnlEmoji = ctx.totalPnl >= 0 ? '📈' : '📉';
  const pnlSign = ctx.totalPnl >= 0 ? '+' : '';

  // Portfolio value
  if (q.includes('portfolio value') || q.includes('worth') || q.includes('total value') || q.includes('how much')) {
    return t('ai.chatPortfolioWorth', {
      value: formatCurrency(ctx.totalValue),
      count: ctx.holdingsCount,
      invested: formatCurrency(ctx.totalInvested),
      emoji: pnlEmoji,
      sign: pnlSign,
      pnl: formatCurrency(ctx.totalPnl),
      pct: ctx.totalPnlPercent.toFixed(1),
      result: ctx.totalPnl >= 0 ? t('ai.chatProfit') : t('ai.chatLoss'),
    });
  }

  // P&L / profit and loss
  if (q.includes('pnl') || q.includes('profit') || q.includes('loss') || q.includes('return') || q.includes('performance')) {
    let resp = t('ai.chatPerformance', {
      invested: formatCurrency(ctx.totalInvested),
      value: formatCurrency(ctx.totalValue),
      emoji: pnlEmoji,
      sign: pnlSign,
      pnl: formatCurrency(ctx.totalPnl),
      pct: ctx.totalPnlPercent.toFixed(1),
      winners: ctx.winners,
      losers: ctx.losers,
      winRate: ctx.holdingsCount > 0 ? ((ctx.winners / ctx.holdingsCount) * 100).toFixed(0) : 0,
    });

    if (ctx.bestHolding) resp += '\n\n' + t('ai.chatBestLine', { name: ctx.bestHolding.name, pct: ctx.bestHolding.pnlPercent.toFixed(1) });
    if (ctx.worstHolding) resp += '\n\n' + t('ai.chatWorstLine', { name: ctx.worstHolding.name, pct: ctx.worstHolding.pnlPercent.toFixed(1) });

    return resp;
  }

  // Best performer
  if (q.includes('best') || q.includes('top') || q.includes('highest')) {
    if (ctx.bestHolding) {
      return t('ai.chatBestPerformer', { name: ctx.bestHolding.name, pct: ctx.bestHolding.pnlPercent.toFixed(1) });
    }
    return t('ai.chatNoHoldingsBest');
  }

  // Worst performer
  if (q.includes('worst') || q.includes('lowest') || q.includes('underperform')) {
    if (ctx.worstHolding) {
      return t('ai.chatWorstPerformer', { name: ctx.worstHolding.name, pct: ctx.worstHolding.pnlPercent.toFixed(1) });
    }
    return t('ai.chatNoHoldingsShort');
  }

  // Sector allocation
  if (q.includes('sector') || q.includes('allocation') || q.includes('diversif') || q.includes('spread')) {
    return t('ai.chatSectorAllocation', {
      sector: ctx.topSector,
      count: ctx.holdingsCount,
      extra: ctx.holdingsCount < 3 ? t('ai.chatSectorTipExtra') : '',
    });
  }

  // SIP / mutual fund
  if (q.includes('sip') || q.includes('mutual fund') || q.includes('mf')) {
    if (ctx.sipCount > 0) {
      const sipReturns = ctx.sipTotalValue - ctx.sipTotalInvested;
      const sipReturnsPct = ctx.sipTotalInvested > 0 ? (sipReturns / ctx.sipTotalInvested) * 100 : 0;
      return t('ai.chatSipSummary', {
        count: ctx.sipCount,
        invested: formatCurrency(ctx.sipTotalInvested),
        value: formatCurrency(ctx.sipTotalValue),
        emoji: sipReturns >= 0 ? '📈' : '📉',
        sign: sipReturns >= 0 ? '+' : '',
        returns: formatCurrency(sipReturns),
        pct: sipReturnsPct.toFixed(1),
      });
    }
    return t('ai.chatNoSips');
  }

  // Holdings count / summary
  if (q.includes('holding') || q.includes('stock') || q.includes('how many') || q.includes('count')) {
    return t('ai.chatHoldingsSummary', {
      count: ctx.holdingsCount,
      winners: ctx.winners,
      losers: ctx.losers,
      invested: formatCurrency(ctx.totalInvested),
      value: formatCurrency(ctx.totalValue),
    });
  }

  // Market
  if (q.includes('market') || q.includes('nifty') || q.includes('sensex') || q.includes('index')) {
    const indices = useMarketStore.getState().indices;
    if (indices.length > 0) {
      const status = ctx.marketStatus === 'up' ? t('ai.chatMarketUp') : ctx.marketStatus === 'down' ? t('ai.chatMarketDown') : t('ai.chatMarketMixed');
      const lines = indices.map(i => `${i.shortName}: ${formatCurrency(i.currentValue)} (${i.isPositive ? '+' : ''}${i.changePercent.toFixed(2)}%)`).join('\n');
      return t('ai.chatMarketOverview', { status, indices: lines });
    }
    return t('ai.chatMarketUnavailable');
  }

  // AI insights
  if (q.includes('insight') || q.includes('recommend') || q.includes('analyze') || q.includes('should i') || q.includes('advice')) {
    const insights = useAIStore.getState().insights;
    if (insights.length > 0) {
      const top = insights.slice(0, 3);
      const items = top.map(i => `• *${i.symbol}*: ${i.summary} (${i.type} · ${i.confidence}% confidence)`).join('\n');
      return t('ai.chatInsightsSummary', { items });
    }
    return t('ai.chatNoInsights');
  }

  // General / fallback with contextual portfolio summary
  return t('ai.chatPortfolioOverview', {
    count: ctx.holdingsCount,
    value: formatCurrency(ctx.totalValue),
    emoji: pnlEmoji,
    sign: pnlSign,
    pnl: formatCurrency(ctx.totalPnl),
    pct: ctx.totalPnlPercent.toFixed(1),
  });
}

// ============================================================================
// Component
// ============================================================================

export default function AIChatScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'AIChat'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: t('ai.chatWelcome'),
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  // Fetch active AI provider on mount
  React.useEffect(() => {
    aiApi.getStatus().then(s => {
      setActiveProvider(s.activeProvider);
    }).catch(() => {
      // Provider info is non-critical — silently fail
    });
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const query = (text || inputText).trim();
    if (!query || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: query,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    // Simulate AI thinking delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 700));

    const ctx = buildPortfolioContext();
    const responseText = generateResponse(query, ctx, t);

    const assistantMsg: ChatMessage = {
      id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'assistant',
      text: responseText,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, assistantMsg]);
    setIsThinking(false);
  }, [inputText, isThinking, t]);

  const handleQuickQuestion = useCallback((query: string) => {
    handleSend(query);
  }, [handleSend]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <View style={[styles.messageRow, item.role === 'user' ? styles.userRow : styles.assistantRow]}>
      {item.role === 'assistant' && (
        <View style={[styles.avatarCircle, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="bulb" size={16} color={colors.primary} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          item.role === 'user' ? styles.userBubble : styles.assistantBubble,
          { backgroundColor: item.role === 'user' ? colors.primary : colors.bgCard, borderColor: colors.border },
        ]}
      >
        <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
          {item.text.split('\n').map((line, i) => {
            // Simple markdown-like formatting for bold
            const parts = line.split(/(\*\*[^*]+\*\*)/g);
            return (
              <Text key={`chat_${i}`}>
                {parts.map((part, j) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <Text key={j} style={{ fontWeight: '700', color: item.role === 'user' ? colors.white : colors.text }}>{part.slice(2, -2)}</Text>;
                  }
                  return <Text key={j}>{part}</Text>;
                })}
                {'\n'}
              </Text>
            );
          })}
        </Text>
        <Text style={[styles.timestamp, { color: item.role === 'user' ? 'rgba(255,255,255,0.6)' : colors.textMuted }]}>
          {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  ), [colors, styles]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <AppScreen scroll={false} padded={false} header={
      <View style={[styles.header, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="bulb" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('ai.chatHeaderTitle')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{t('ai.chatHeaderSubtitle')}</Text>
              {activeProvider && (
                <View style={[styles.providerBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '25' }]}>
                  <Text style={[styles.providerBadgeText, { color: colors.primary }]} numberOfLines={1}>
                    {activeProvider === 'Choreo Claude' ? 'Claude' :
                     activeProvider === 'Google Gemini' ? 'Gemini' :
                     activeProvider === 'OpenRouter' ? 'OpenRouter' :
                     activeProvider}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <Pressable
          style={[styles.backBtn, { backgroundColor: colors.bgCard }]}
          onPress={() => setMessages([{
            id: 'welcome',
            role: 'assistant',
            text: t('ai.chatWelcomeBack'),
            timestamp: Date.now(),
          }])}
        >
          <Ionicons name="refresh" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      } footer={
      <View style={[styles.inputBar, { backgroundColor: colors.bgSecondary, borderTopColor: colors.border }]}>
        <View style={[styles.inputRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t('ai.askPortfolio')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            blurOnSubmit
          />
          <Pressable
            style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.bgCard }]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isThinking}
          >
            <Ionicons
              name="send"
              size={18}
              color={inputText.trim() ? colors.white : colors.textMuted}
            />
          </Pressable>
        </View>
      </View>
      }>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <>
            {/* Quick questions (show only when no messages besides welcome) */}
            {messages.length === 1 && (
              <View style={styles.quickGrid}>
                {SAMPLE_QUESTION_KEYS.map((q, i) => (
                  <Pressable
                    key={`chat_${i}`}
                    style={[styles.quickChip, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    onPress={() => handleQuickQuestion(q.query)}
                  >
                    <Text style={styles.quickIcon}>{q.icon}</Text>
                    <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>{t(q.labelKey)}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Thinking indicator */}
            {isThinking && (
              <View style={[styles.thinkingRow]}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="bulb" size={16} color={colors.primary} />
                </View>
                <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.thinkingText, { color: colors.textMuted }]}>{t('ai.chatThinking')}</Text>
                </View>
              </View>
            )}

            <View style={{ height: 20 }} />
          </>
        }
      />

    </AppScreen>
    </KeyboardAvoidingView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingBottom: 12,
      borderBottomWidth: 1,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: BORDER_RADIUS.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: FONTS.size.lg,
      fontFamily: FONTS.semiBold.fontFamily,
      fontWeight: FONTS.semiBold.fontWeight,
    },
    headerSubtitle: {
      fontSize: FONTS.size.xs,
      fontFamily: FONTS.regular.fontFamily,
    },
    providerBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: BORDER_RADIUS.xs,
      borderWidth: 0.5,
    },
    providerBadgeText: {
      fontSize: 9,
      fontFamily: FONTS.medium.fontFamily,
      fontWeight: FONTS.medium.fontWeight,
      letterSpacing: 0.3,
    },
    messagesList: {
      padding: SPACING.lg,
      paddingBottom: 0,
    },
    messageRow: {
      flexDirection: 'row',
      marginBottom: SPACING.md,
      gap: 8,
      alignItems: 'flex-end',
    },
    userRow: {
      justifyContent: 'flex-end',
    },
    assistantRow: {
      justifyContent: 'flex-start',
    },
    avatarCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    bubble: {
      maxWidth: '80%',
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
    },
    userBubble: {
      borderBottomRightRadius: 4,
    },
    assistantBubble: {
      borderBottomLeftRadius: 4,
    },
    userText: {
      color: colors.white,
      fontSize: FONTS.size.md,
      fontFamily: FONTS.regular.fontFamily,
      lineHeight: 20,
    },
    assistantText: {
      color: colors.textSecondary,
      fontSize: FONTS.size.sm,
      fontFamily: FONTS.regular.fontFamily,
      lineHeight: 20,
    },
    timestamp: {
      fontSize: FONTS.size.xs,
      fontFamily: FONTS.regular.fontFamily,
      marginTop: 4,
      textAlign: 'right',
    },
    // ── Thinking indicator ──
    thinkingRow: {
      flexDirection: 'row',
      marginBottom: SPACING.md,
      gap: 8,
      alignItems: 'center',
    },
    thinkingText: {
      fontSize: FONTS.size.xs,
      fontFamily: FONTS.regular.fontFamily,
      marginTop: 4,
    },
    // ── Quick question chips ──
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
      marginBottom: SPACING.md,
    },
    quickChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
    },
    quickIcon: {
      fontSize: 14,
    },
    quickLabel: {
      fontSize: FONTS.size.sm,
      fontFamily: FONTS.medium.fontFamily,
      fontWeight: FONTS.medium.fontWeight,
    },
    // ── Input bar ──
    inputBar: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderRadius: BORDER_RADIUS.xl,
      borderWidth: 1,
      paddingLeft: SPACING.md,
      paddingRight: SPACING.xs,
      paddingVertical: SPACING.xs,
    },
    input: {
      flex: 1,
      fontSize: FONTS.size.md,
      fontFamily: FONTS.regular.fontFamily,
      maxHeight: 100,
      paddingVertical: SPACING.sm,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: BORDER_RADIUS.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
