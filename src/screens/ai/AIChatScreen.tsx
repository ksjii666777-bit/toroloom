import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useMarketStore } from '../../store/marketStore';
import { useMutualFundStore } from '../../store/mutualFundStore';
import { useAIStore } from '../../store/aiStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';

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

const SAMPLE_QUESTIONS = [
  { icon: '💰', label: 'Portfolio value?', query: 'What is my total portfolio value?' },
  { icon: '📈', label: 'Best performer', query: 'Which is my best performing stock?' },
  { icon: '📉', label: 'Worst performer', query: 'Which is my worst performing stock?' },
  { icon: '🏆', label: 'Total P&L', query: 'What is my total profit and loss?' },
  { icon: '📊', label: 'Sector allocation', query: 'How is my portfolio allocated across sectors?' },
  { icon: '🔄', label: 'SIP status', query: 'How are my SIP investments doing?' },
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

function generateResponse(query: string, ctx: PortfolioContext): string {
  const q = query.toLowerCase();

  // Helper to format response with portfolio context
  const pnlEmoji = ctx.totalPnl >= 0 ? '📈' : '📉';
  const pnlSign = ctx.totalPnl >= 0 ? '+' : '';

  // Portfolio value
  if (q.includes('portfolio value') || q.includes('worth') || q.includes('total value') || q.includes('how much')) {
    return `Your portfolio is worth **${formatCurrency(ctx.totalValue)}** across ${ctx.holdingsCount} holdings.\n\n` +
      `You've invested ${formatCurrency(ctx.totalInvested)} total. ${pnlEmoji} **${pnlSign}${formatCurrency(ctx.totalPnl)}** (${pnlSign}${ctx.totalPnlPercent.toFixed(1)}%) overall ${ctx.totalPnl >= 0 ? 'profit' : 'loss'}.`;
  }

  // P&L / profit and loss
  if (q.includes('pnl') || q.includes('profit') || q.includes('loss') || q.includes('return') || q.includes('performance')) {
    let resp = `📊 **Portfolio Performance**\n\n` +
      `Total Invested: ${formatCurrency(ctx.totalInvested)}\n` +
      `Current Value: ${formatCurrency(ctx.totalValue)}\n` +
      `${pnlEmoji} P&L: ${pnlSign}${formatCurrency(ctx.totalPnl)} (${pnlSign}${ctx.totalPnlPercent.toFixed(1)}%)\n\n` +
      `📈 Winning: ${ctx.winners} holdings\n` +
      `📉 Losing: ${ctx.losers} holdings\n` +
      `💰 Win Rate: ${ctx.holdingsCount > 0 ? ((ctx.winners / ctx.holdingsCount) * 100).toFixed(0) : 0}%`;

    if (ctx.bestHolding) resp += `\n\n⭐ **Best:** ${ctx.bestHolding.name} (+${ctx.bestHolding.pnlPercent.toFixed(1)}%)`;
    if (ctx.worstHolding) resp += `\n\n⚠️ **Worst:** ${ctx.worstHolding.name} (${ctx.worstHolding.pnlPercent.toFixed(1)}%)`;

    return resp;
  }

  // Best performer
  if (q.includes('best') || q.includes('top') || q.includes('highest')) {
    if (ctx.bestHolding) {
      return `🏆 **Best Performer**\n\nYour top performing holding is **${ctx.bestHolding.name}** with a gain of **+${ctx.bestHolding.pnlPercent.toFixed(1)}%**. Great pick! 🎯`;
    }
    return "You don't have any holdings yet. Start investing to see your best performer!";
  }

  // Worst performer
  if (q.includes('worst') || q.includes('lowest') || q.includes('underperform')) {
    if (ctx.worstHolding) {
      return `⚠️ **Needs Attention**\n\nYour worst performing holding is **${ctx.worstHolding.name}** at **${ctx.worstHolding.pnlPercent.toFixed(1)}%**. Consider reviewing your strategy for this stock.`;
    }
    return "You don't have any holdings yet.";
  }

  // Sector allocation
  if (q.includes('sector') || q.includes('allocation') || q.includes('diversif') || q.includes('spread')) {
    return `📊 **Sector Allocation**\n\nYour top sector is **${ctx.topSector}**. You have ${ctx.holdingsCount} holdings across different sectors.\n\n` +
      `💡 Tip: A well-diversified portfolio across 5+ sectors helps manage risk. ${ctx.holdingsCount < 3 ? 'Consider adding more sectors for better diversification.' : ''}`;
  }

  // SIP / mutual fund
  if (q.includes('sip') || q.includes('mutual fund') || q.includes('mf')) {
    if (ctx.sipCount > 0) {
      const sipReturns = ctx.sipTotalValue - ctx.sipTotalInvested;
      const sipReturnsPct = ctx.sipTotalInvested > 0 ? (sipReturns / ctx.sipTotalInvested) * 100 : 0;
      return `🔄 **SIP Summary**\n\nActive SIPs: ${ctx.sipCount}\n` +
        `Total Invested: ${formatCurrency(ctx.sipTotalInvested)}\n` +
        `Current Value: ${formatCurrency(ctx.sipTotalValue)}\n` +
        `${sipReturns >= 0 ? '📈' : '📉'} Returns: ${sipReturns >= 0 ? '+' : ''}${formatCurrency(sipReturns)} (${sipReturns >= 0 ? '+' : ''}${sipReturnsPct.toFixed(1)}%)\n\n` +
        `💰 Systematic investing builds wealth over time! Keep it up! 💪`;
    }
    return "You don't have any active SIPs yet. Consider starting one to build wealth systematically! 💰";
  }

  // Holdings count / summary
  if (q.includes('holding') || q.includes('stock') || q.includes('how many') || q.includes('count')) {
    return `📦 **Holdings Summary**\n\nYou have **${ctx.holdingsCount} holdings** in your portfolio.\n` +
      `📈 ${ctx.winners} profitable · 📉 ${ctx.losers} at loss\n` +
      `💰 Total invested: ${formatCurrency(ctx.totalInvested)}\n` +
      `💵 Current value: ${formatCurrency(ctx.totalValue)}`;
  }

  // Market
  if (q.includes('market') || q.includes('nifty') || q.includes('sensex') || q.includes('index')) {
    const indices = useMarketStore.getState().indices;
    if (indices.length > 0) {
      return `📊 **Market Overview**\n\nMarket is trading **${ctx.marketStatus === 'up' ? '🟢 higher' : ctx.marketStatus === 'down' ? '🔴 lower' : '🟡 mixed'}** today.\n\n` +
        indices.map(i => `${i.shortName}: ${formatCurrency(i.currentValue)} (${i.isPositive ? '+' : ''}${i.changePercent.toFixed(2)}%)`).join('\n') +
        '\n\n📌 Data refreshes in real-time.';
    }
    return 'Market data is currently unavailable. Please check back later.';
  }

  // AI insights
  if (q.includes('insight') || q.includes('recommend') || q.includes('analyze') || q.includes('should i') || q.includes('advice')) {
    const insights = useAIStore.getState().insights;
    if (insights.length > 0) {
      const top = insights.slice(0, 3);
      return `🤖 **AI Insights Summary**\n\n` +
        top.map(i => `• *${i.symbol}*: ${i.summary} (${i.type} · ${i.confidence}% confidence)`).join('\n') +
        `\n\n📌 View all insights in the AI Insights section.`;
    }
    return "No AI insights available right now. Pull to refresh or try again later.";
  }

  // General / fallback with contextual portfolio summary
  return `👋 **Portfolio Overview**\n\n` +
    `Here's a quick snapshot of your investments:\n\n` +
    `💼 **${ctx.holdingsCount}** holdings · 💰 **${formatCurrency(ctx.totalValue)}** total value\n` +
    `${pnlEmoji} **${pnlSign}${formatCurrency(ctx.totalPnl)}** (${pnlSign}${ctx.totalPnlPercent.toFixed(1)}%) overall\n\n` +
    `💡 Try asking:\n` +
    `• "What is my portfolio value?"\n` +
    `• "How are my SIPs doing?"\n` +
    `• "Which stock should I analyze?"\n` +
    `• "Show me market overview"`;
}

// ============================================================================
// Component
// ============================================================================

export default function AIChatScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "👋 **Welcome to AI Assistant!**\n\nAsk me anything about your portfolio, stocks, market, or investments. I can help you with:\n\n💰 Portfolio value & P&L 📊 Sector allocation 📈 Stock performance 🔄 SIP status\n\nTry one of the quick questions below!",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = useCallback(async (text?: string) => {
    const query = (text || inputText).trim();
    if (!query || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
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
    const responseText = generateResponse(query, ctx);

    const assistantMsg: ChatMessage = {
      id: `ai_${Date.now()}`,
      role: 'assistant',
      text: responseText,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, assistantMsg]);
    setIsThinking(false);
  }, [inputText, isThinking]);

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
              <Text key={i}>
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
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="bulb" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>AI Assistant</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Portfolio & Market Q&A</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.bgCard }]}
          onPress={() => setMessages([{
            id: 'welcome',
            role: 'assistant',
            text: "👋 **Welcome back!**\n\nAsk me anything about your portfolio, stocks, or market.\n\nTry:\n• \"How is my portfolio doing?\"\n• \"Best performing stock?\"\n• \"SIP summary\"",
            timestamp: Date.now(),
          }])}
        >
          <Ionicons name="refresh" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
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
                {SAMPLE_QUESTIONS.map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.quickChip, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    onPress={() => handleQuickQuestion(q.query)}
                  >
                    <Text style={styles.quickIcon}>{q.icon}</Text>
                    <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>{q.label}</Text>
                  </TouchableOpacity>
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
                  <Text style={[styles.thinkingText, { color: colors.textMuted }]}>Analyzing your portfolio...</Text>
                </View>
              </View>
            )}

            <View style={{ height: 20 }} />
          </>
        }
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.bgSecondary, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={[styles.inputRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about your portfolio..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.bgCard }]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isThinking}
          >
            <Ionicons
              name="send"
              size={18}
              color={inputText.trim() ? colors.white : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>
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
      marginTop: 1,
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
