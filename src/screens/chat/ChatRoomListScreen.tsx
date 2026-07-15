/**
 * Toroloom — Chat Room List Screen
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

const MOCK_ROOMS = [
  { id: '1', name: 'Trading Discussion', members: 234, unread: 3 },
  { id: '2', name: 'Nifty Options', members: 189, unread: 0 },
  { id: '3', name: 'Stock Picks', members: 312, unread: 7 },
  { id: '4', name: 'Technical Analysis', members: 156, unread: 1 },
];

export default function ChatRoomListScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');

  const filtered = MOCK_ROOMS.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.title, { color: colors.text }]}>Chat Rooms</Text>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
          placeholder="Search rooms..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.roomCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigation.navigate('ChatRoom', { roomId: item.id })}
          >
            <View style={styles.roomInfo}>
              <Text style={[styles.roomName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.roomMeta, { color: colors.textMuted }]}>{item.members} members</Text>
            </View>
            {item.unread > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>{item.unread}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No rooms found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60, gap: SPACING.md },
  title: { fontSize: FONTS.size.xl, fontWeight: '700' },
  searchInput: { height: 40, borderRadius: BORDER_RADIUS.md, borderWidth: 1, paddingHorizontal: SPACING.md, fontSize: FONTS.size.sm },
  list: { padding: SPACING.xl, gap: SPACING.sm },
  roomCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, gap: SPACING.md },
  roomInfo: { flex: 1 },
  roomName: { fontSize: FONTS.size.md, fontWeight: '600' },
  roomMeta: { fontSize: FONTS.size.xs, marginTop: 2 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FONTS.size.sm },
});
