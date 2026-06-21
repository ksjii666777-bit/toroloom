import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS} from '../../constants/theme';
import type { ChatMessage } from '../../types';
import { useChatStore } from '../../store/chatStore';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupMessagesByDate(messages: ChatMessage[]) {
  const groups: { date: string; messages: typeof messages }[] = [];
  for (const msg of messages) {
    const dateKey = msg.timestamp.split('T')[0];
    const last = groups[groups.length - 1];
    if (last && last.messages[0].timestamp.split('T')[0] === dateKey) {
      last.messages.push(msg);
    } else {
      groups.push({ date: formatDateSeparator(msg.timestamp), messages: [msg] });
    }
  }
  return groups;
}

function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[bubbleStyles.wrapper, { opacity: fadeAnim, alignItems: isOwn ? 'flex-end' : 'flex-start' }]}>
      {!isOwn && <Text style={[bubbleStyles.senderLabel, { color: colors.primary }]}>{message.userName}</Text>}
      <View
        style={[
          bubbleStyles.bubble,
          isOwn
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.bgCardLight, borderBottomLeftRadius: 4 },
        ]}
      >
        {message.type === 'trade' && (
          <View style={bubbleStyles.tradeTag}>
            <Ionicons name="cash" size={12} color="#F59E0B" />
            <Text style={bubbleStyles.tradeText}>Trade Idea</Text>
          </View>
        )}
        {message.type === 'alert' && (
          <View style={bubbleStyles.alertTag}>
            <Ionicons name="alert-circle" size={12} color="#EF4444" />
            <Text style={bubbleStyles.alertText}>Alert</Text>
          </View>
        )}
        <Text style={[bubbleStyles.text, { color: isOwn ? '#FFFFFF' : colors.text }]}>
          {message.content}
        </Text>
        <View style={bubbleStyles.metaRow}>
          <Text style={[bubbleStyles.time, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted }]}>
            {formatTime(message.timestamp)}
          </Text>
          {isOwn && (
            <Ionicons
              name={message.read ? 'checkmark-done' : 'checkmark'}
              size={12}
              color={message.read ? '#34D399' : 'rgba(255,255,255,0.5)'}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.xs, paddingHorizontal: SPACING.xl },
  senderLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2, marginLeft: 4 },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  text: { fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  time: { fontSize: 10, fontWeight: '400' },
  tradeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#F59E0B20',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tradeText: { fontSize: 10, fontWeight: '600', color: '#F59E0B' },
  alertTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#EF444420',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  alertText: { fontSize: 10, fontWeight: '600', color: '#EF4444' },
});

function DateSeparator({ date }: { date: string }) {
  const { colors } = useTheme();
  return (
    <View style={dateSepStyles.container}>
      <View style={[dateSepStyles.line, { backgroundColor: colors.border }]} />
      <Text style={[dateSepStyles.text, { color: colors.textMuted }]}>{date}</Text>
      <View style={[dateSepStyles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const dateSepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginVertical: SPACING.md,
  },
  line: { flex: 1, height: 1 },
  text: { fontSize: 11, fontWeight: '500', marginHorizontal: SPACING.md },
});

export default function ChatRoomScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { roomId } = route.params || {};
  const { rooms, messages, sendMessage, setTyping, typingUsers, markRoomRead } = useChatStore();
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const room = rooms.find((r) => r.id === roomId);
  const roomMessages = messages[roomId] || [];
  const typing = typingUsers[roomId] || [];

  const messageGroups = useMemo(() => groupMessagesByDate(roomMessages), [roomMessages]);

  // Mark room as read on mount
  useEffect(() => {
    if (roomId) markRoomRead(roomId);
  }, [roomId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [roomMessages.length]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    sendMessage(roomId, inputText.trim());
    setInputText('');
    setTyping(roomId, 'Rahul Sharma', false);
  }, [inputText, roomId, sendMessage, setTyping]);

  const handleChangeText = useCallback(
    (text: string) => {
      setInputText(text);
      setTyping(roomId, 'Rahul Sharma', text.length > 0);
    },
    [roomId, setTyping]
  );

  // Simulate other users typing
  useEffect(() => {
    if (inputText.length > 0) {
      const timer = setTimeout(() => {
        const otherUsers = room?.participants
          .filter((p) => p.userId !== 'user_1' && p.isOnline)
          .map((p) => p.userName) || [];
        if (otherUsers.length > 0 && Math.random() > 0.7) {
          const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
          setTyping(roomId, randomUser, true);
          setTimeout(() => setTyping(roomId, randomUser, false), 2000);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [inputText, roomId, room]);

  const onlineCount = room?.participants.filter((p) => p.isOnline).length || 0;

  return (
    <View style={[chatStyles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[chatStyles.header, { paddingTop: insets.top + 8, backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        <View style={chatStyles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={chatStyles.headerInfo}>
            <Text style={[chatStyles.headerName, { color: colors.text }]} numberOfLines={1}>
              {room?.name || 'Chat'}
            </Text>
            <Text style={[chatStyles.headerStatus, { color: colors.textMuted }]}>
              {typing.length > 0
                ? `${typing.join(', ')} typing...`
                : room?.type === 'group'
                ? `${onlineCount} online`
                : onlineCount > 0
                ? 'Online'
                : 'Offline'}
            </Text>
          </View>
          {room?.type === 'group' && (
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={chatStyles.messagesContainer}
        >
          {messageGroups.map((group, gi) => (
            <View key={gi}>
              <DateSeparator date={group.date} />
              {group.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} isOwn={msg.userId === 'user_1'} />
              ))}
            </View>
          ))}

          {/* Typing indicator */}
          {typing.length > 0 && (
            <View style={chatStyles.typingContainer}>
              <View style={[chatStyles.typingBubble, { backgroundColor: colors.bgCardLight }]}>
                <View style={chatStyles.typingDot} />
                <View style={[chatStyles.typingDot, chatStyles.typingDotMid]} />
                <View style={chatStyles.typingDot} />
              </View>
            </View>
          )}

          <View style={{ height: SPACING.lg }} />
        </ScrollView>

        {/* Input Bar */}
        <View
          style={[
            chatStyles.inputBar,
            { backgroundColor: colors.bgSecondary, borderTopColor: colors.border },
          ]}
        >
          <View style={[chatStyles.inputContainer, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
            <TextInput
              ref={inputRef}
              style={[chatStyles.textInput, { color: colors.text }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={handleChangeText}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim()}
              style={[chatStyles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.bgCard }]}
            >
              <Ionicons name="send" size={16} color={inputText.trim() ? '#FFFFFF' : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const chatStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700' },
  headerStatus: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  messagesContainer: { paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  typingContainer: { paddingLeft: SPACING.xl, marginBottom: SPACING.xs },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
    opacity: 0.5,
  },
  typingDotMid: { opacity: 0.7 },
  inputBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    paddingBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    paddingLeft: SPACING.md,
    paddingRight: 4,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 80,
    paddingVertical: 6,
    paddingRight: SPACING.sm,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
