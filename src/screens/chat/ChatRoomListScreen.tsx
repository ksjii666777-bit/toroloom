import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { useChatStore } from '../../store/chatStore';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { ChatRoom } from '../../types';

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  const now = Date.now();
  const date = new Date(iso).getTime();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function RoomAvatar({ name, type }: { name: string; type: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
  const colorIndex = name.length % colors.length;

  return (
    <View style={[roomAvatarStyles.avatar, { backgroundColor: colors[colorIndex] + '25' }]}>
      {type === 'group' ? (
        <Ionicons name="people" size={20} color={colors[colorIndex]} />
      ) : (
        <Text style={[roomAvatarStyles.initials, { color: colors[colorIndex] }]}>{initials}</Text>
      )}
    </View>
  );
}

const roomAvatarStyles = StyleSheet.create({
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontSize: 18,
    fontWeight: '700',
  },
});

interface RoomCardProps {
  room: ChatRoom;
  onPress: () => void;
}

const RoomCard = React.memo(function RoomCard({ room, onPress }: RoomCardProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View
        style={[
          roomCardStyles.card,
          { backgroundColor: colors.bgCard, borderColor: colors.border },
          room.unreadCount > 0 && { borderLeftColor: colors.primary, borderLeftWidth: 3 },
        ]}
      >
        <RoomAvatar name={room.name} type={room.type} />
        <View style={roomCardStyles.content}>
          <View style={roomCardStyles.topRow}>
            <Text style={[roomCardStyles.roomName, { color: colors.text }]} numberOfLines={1}>
              {room.name}
            </Text>
            <View style={roomCardStyles.metaRow}>
              {room.type === 'group' && room.participants.length > 0 && (
                <Text style={[roomCardStyles.participantCount, { color: colors.textMuted }]}>
                  {room.participants.length}
                </Text>
              )}
              {room.lastMessageTime && (
                <Text style={[roomCardStyles.time, { color: colors.textMuted }]}>
                  {formatTimestamp(room.lastMessageTime)}
                </Text>
              )}
            </View>
          </View>
          <View style={roomCardStyles.bottomRow}>
            <View style={roomCardStyles.messagePreview}>
              {room.lastMessageSender && (
                <Text style={[roomCardStyles.sender, { color: colors.textMuted }]}>
                  {room.lastMessageSender}:{' '}
                </Text>
              )}
              <Text
                style={[roomCardStyles.lastMessage, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {room.lastMessage || 'No messages yet'}
              </Text>
            </View>
            {room.unreadCount > 0 && (
              <View style={[roomCardStyles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={roomCardStyles.unreadText}>
                  {room.unreadCount > 9 ? '9+' : room.unreadCount}
                </Text>
              </View>
            )}
          </View>
          {room.topic && (
            <View style={roomCardStyles.topicRow}>
              <Ionicons name="pricetag-outline" size={10} color={colors.textMuted} />
              <Text style={[roomCardStyles.topicText, { color: colors.textMuted }]} numberOfLines={1}>
                {room.topic}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const roomCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  content: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  time: {
    fontSize: 11,
    fontWeight: '400',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messagePreview: {
    flex: 1,
    flexDirection: 'row',
    marginRight: SPACING.sm,
  },
  sender: {
    fontSize: 13,
    fontWeight: '500',
  },
  lastMessage: {
    fontSize: 13,
    flex: 1,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  topicText: {
    fontSize: 11,
    fontWeight: '400',
  },
});

export default function ChatRoomListScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { rooms, activeRoomId, setActiveRoom, typingUsers } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const totalUnread = useMemo(() => rooms.reduce((sum, r) => sum + r.unreadCount, 0), [rooms]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    const q = searchQuery.toLowerCase();
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.lastMessage && r.lastMessage.toLowerCase().includes(q)) ||
        (r.topic && r.topic.toLowerCase().includes(q))
    );
  }, [rooms, searchQuery]);

  const sortedRooms = useMemo(() => {
    return [...filteredRooms].sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
      const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return bTime - aTime;
    });
  }, [filteredRooms]);

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => {
      const next = !prev;
      if (next) setTimeout(() => searchRef.current?.focus(), 200);
      else setSearchQuery('');
      return next;
    });
  }, []);

  const handleRoomPress = useCallback(
    (roomId: string) => {
      setActiveRoom(roomId);
      navigation.navigate('ChatRoom', { roomId });
    },
    [navigation, setActiveRoom]
  );

  return (
    <View style={[listStyles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[listStyles.header, { paddingTop: insets.top + 12 }]}>
        <View style={listStyles.headerTop}>
          <View>
            <Text style={[listStyles.title, { color: colors.text }]}>Messages</Text>
            <Text style={[listStyles.subtitle, { color: colors.textMuted }]}>
              {rooms.length} conversations
              {totalUnread > 0 && ` · ${totalUnread} unread`}
            </Text>
          </View>
          <AnimatedPressable onPress={toggleSearch} haptic="light" scaleTo={0.9}>
            <View style={[listStyles.iconBtn, { backgroundColor: colors.bgCardLight }]}>
              <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={colors.text} />
            </View>
          </AnimatedPressable>
        </View>

        {showSearch && (
          <View
            style={[
              listStyles.searchContainer,
              { backgroundColor: colors.bgCardLight, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              ref={searchRef}
              style={[listStyles.searchInput, { color: colors.text }]}
              placeholder="Search conversations..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Room List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={listStyles.listContainer}
      >
        {rooms.length === 0 && (
          <View style={listStyles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={[listStyles.emptyTitle, { color: colors.textMuted }]}>No conversations</Text>
            <Text style={[listStyles.emptySubtitle, { color: colors.textMuted }]}>
              Join a chat room to start discussing trading ideas
            </Text>
          </View>
        )}

        {sortedRooms.map((room) => (
          <RoomCard key={room.id} room={room} onPress={() => handleRoomPress(room.id)} />
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const listStyles = StyleSheet.create({
  container: { flex: 1 },
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
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
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
  searchInput: { flex: 1, fontSize: 14, fontWeight: '400', padding: 0 },
  listContainer: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: SPACING.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, fontWeight: '400', textAlign: 'center', paddingHorizontal: 40 },
});
