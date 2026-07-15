/**
 * Toroloom — Chat Room Screen
 *
 * Full-featured chat room with messages, typing indicator, date separators,
 * and trade/alert tags. Integrates with useChatStore.
 */
import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useChatStore } from '../../store/chatStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { ChatMessage } from '../../types';

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getDate() === now.getDate()
    && date.getMonth() === now.getMonth()
    && date.getFullYear() === now.getFullYear();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatRoomScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const roomId: string = route?.params?.roomId ?? '';
  const [inputText, setInputText] = React.useState('');

  const rooms = useChatStore(s => s.rooms);
  const messages = useChatStore(s => s.messages);
  const typingUsers = useChatStore(s => s.typingUsers);
  const sendMessage = useChatStore(s => s.sendMessage);
  const markRoomRead = useChatStore(s => s.markRoomRead);

  const room = rooms.find(r => r.id === roomId);
  const roomMessages: ChatMessage[] = messages[roomId] || [];
  const typing: string[] = typingUsers[roomId] || [];

  // Call markRoomRead on mount
  useEffect(() => {
    if (roomId) {
      markRoomRead(roomId);
    }
  }, [roomId, markRoomRead]);

  // Compute online count
  const onlineCount = useMemo(() => {
    if (!room) return 0;
    return room.participants.filter(p => p.isOnline).length;
  }, [room]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || !roomId) return;
    sendMessage(roomId, inputText.trim());
    setInputText('');
  }, [inputText, roomId, sendMessage]);

  const scrollRef = useRef<ScrollView>(null);
  const headerTitle = room?.name || 'Chat';
  const firstMsgDate = roomMessages[0]?.timestamp ? new Date(roomMessages[0].timestamp) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary, borderColor: colors.border, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack?.()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{headerTitle}</Text>
          {room && (
            <Text style={[styles.headerStatus, { color: colors.accent }]}>
              {onlineCount > 0 ? `${onlineCount} online` : 'Offline'}
            </Text>
          )}
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.listContent}
      >
        {firstMsgDate && (
          <View style={styles.dateSeparator}>
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {isToday(firstMsgDate) ? 'Today' : firstMsgDate.toLocaleDateString()}
            </Text>
          </View>
        )}
        {roomMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No messages yet</Text>
          </View>
        ) : (
          roomMessages.map((msg) => {
            const isOwn = msg.userId === 'user_1';
            return (
              <View key={msg.id} style={[styles.messageBubble, { backgroundColor: colors.bgCard }]}>
                {!isOwn && (
                  <Text style={[styles.msgUser, { color: colors.primary }]}>
                    {msg.userName}
                  </Text>
                )}
                {msg.type === 'trade' && (
                  <View style={[styles.tag, { backgroundColor: colors.success + '20' }]}>
                    <Text style={[styles.tagText, { color: colors.success }]}>Trade Idea</Text>
                  </View>
                )}
                {msg.type === 'alert' && (
                  <View style={[styles.tag, { backgroundColor: colors.danger + '20' }]}>
                    <Text style={[styles.tagText, { color: colors.danger }]}>Alert</Text>
                  </View>
                )}
                <Text style={[styles.msgContent, { color: colors.text }]}>{msg.content}</Text>
                <Text style={[styles.msgTime, { color: colors.textMuted }]}>{formatTime(msg.timestamp)}</Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Typing Indicator */}
      {typing.length > 0 && (
        <View style={[styles.typingBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.typingText, { color: colors.textMuted }]}>
            {typing.join(', ')} typing...
          </Text>
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
        <TextInput
          style={[styles.chatInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          onPress={handleSend}
        >
          <Ionicons name="send" size={18} color="#FFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: FONTS.size.md, fontWeight: '700' },
  headerStatus: { fontSize: FONTS.size.xs, marginTop: 1 },
  listContent: { padding: SPACING.xl, gap: SPACING.sm },
  messageBubble: { padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, gap: 4 },
  msgUser: { fontSize: FONTS.size.xs, fontWeight: '700' },
  msgContent: { fontSize: FONTS.size.sm, lineHeight: 20 },
  msgTime: { fontSize: FONTS.size.xs, marginTop: 2 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10, fontWeight: '700' },
  dateSeparator: { alignItems: 'center', paddingVertical: SPACING.sm },
  dateText: { fontSize: FONTS.size.xs, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FONTS.size.sm },
  typingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  typingText: { fontSize: FONTS.size.xs, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    gap: SPACING.sm, borderTopWidth: 1,
  },
  chatInput: {
    flex: 1, height: 40, borderRadius: BORDER_RADIUS.full,
    borderWidth: 1, paddingHorizontal: SPACING.md, fontSize: FONTS.size.sm,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
