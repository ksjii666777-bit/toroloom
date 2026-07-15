"""
Create minimal viable implementations for 9 screen files that were
corrupted by the batch Pressable fix script and don't exist in git HEAD.

Each file must export a default function component matching the import
in AppNavigator.tsx and/or test files.
"""

import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SCREENS = {
    "src/screens/education/CertificateScreen.tsx": '''/**
 * Toroloom — Certificate Screen
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function CertificateScreen({ navigation }: any) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.title, { color: colors.text }]}>Certificates</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <Ionicons name="ribbon-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Certificates Yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Complete courses to earn certificates
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60 },
  title: { fontSize: FONTS.size.xl, fontWeight: '700' },
  content: { padding: SPACING.xl },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: SPACING.md },
  emptyTitle: { fontSize: FONTS.size.lg, fontWeight: '700' },
  emptyDesc: { fontSize: FONTS.size.sm, textAlign: 'center', lineHeight: 20 },
});
''',

    "src/screens/chat/ChatRoomListScreen.tsx": '''/**
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
''',

    "src/screens/chat/ChatRoomScreen.tsx": '''/**
 * Toroloom — Chat Room Screen
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

const MOCK_MESSAGES = [
  { id: '1', user: 'TraderA', text: 'Nifty looking strong today!', time: '10:30 AM' },
  { id: '2', user: 'TraderB', text: 'Yes, 23500 CE building up nicely', time: '10:32 AM' },
  { id: '3', user: 'TraderC', text: 'What\'s the PCR looking like?', time: '10:35 AM' },
];

export default function ChatRoomScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const [messages] = useState(MOCK_MESSAGES);
  const [input, setInput] = useState('');

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Room {route?.params?.roomId || ''}</Text>
          <Text style={[styles.headerStatus, { color: colors.marketUp }]}>● Online</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.messageBubble, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.messageUser, { color: colors.primary }]}>{item.user}</Text>
            <Text style={[styles.messageText, { color: colors.text }]}>{item.text}</Text>
            <Text style={[styles.messageTime, { color: colors.textMuted }]}>{item.time}</Text>
          </View>
        )}
      />

      <View style={[styles.inputBar, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
        <TextInput
          style={[styles.chatInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="send" size={18} color="#FFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, paddingTop: 56, borderBottomWidth: 1, gap: SPACING.md },
  backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: FONTS.size.md, fontWeight: '700' },
  headerStatus: { fontSize: FONTS.size.xs, marginTop: 1 },
  list: { padding: SPACING.xl, gap: SPACING.sm },
  messageBubble: { padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, gap: 4 },
  messageUser: { fontSize: FONTS.size.xs, fontWeight: '700' },
  messageText: { fontSize: FONTS.size.sm, lineHeight: 20 },
  messageTime: { fontSize: FONTS.size.xs, marginTop: 2 },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm, borderTopWidth: 1 },
  chatInput: { flex: 1, height: 40, borderRadius: BORDER_RADIUS.full, borderWidth: 1, paddingHorizontal: SPACING.md, fontSize: FONTS.size.sm },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
''',

    "src/screens/journal/BehavioralJournalScreen.tsx": '''/**
 * Toroloom — Behavioral Journal Screen
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function BehavioralJournalScreen({ navigation }: any) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.title, { color: colors.text }]}>Trading Journal</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Track your trading psychology</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <Ionicons name="journal-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Journal Entries</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Start documenting your trades and emotions to improve your trading psychology
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  content: { padding: SPACING.xl },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: SPACING.md },
  emptyTitle: { fontSize: FONTS.size.lg, fontWeight: '700' },
  emptyDesc: { fontSize: FONTS.size.sm, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
});
''',

    "src/screens/markets/USMarketsScreen.tsx": '''/**
 * Toroloom — US Markets Screen
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function USMarketsScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.title, { color: colors.text }]}>US Markets</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>S&P 500 · Nasdaq · Dow Jones</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>S&P 500</Text>
          <Text style={styles.cardValue}>5,432.10</Text>
          <Text style={styles.cardChange}>+0.32%</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nasdaq</Text>
          <Text style={styles.cardValue}>17,123.45</Text>
          <Text style={styles.cardChange}>+0.51%</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dow Jones</Text>
          <Text style={styles.cardValue}>39,876.50</Text>
          <Text style={styles.cardChange}>-0.12%</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  content: { padding: SPACING.xl, gap: SPACING.md },
  card: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 4 },
  cardTitle: { fontSize: FONTS.size.md, fontWeight: '600' },
  cardValue: { fontSize: FONTS.size.xl, fontWeight: '800', fontFamily: 'monospace' },
  cardChange: { fontSize: FONTS.size.sm, fontWeight: '600' },
});
''',

    "src/screens/news/EconomicCalendarScreen.tsx": '''/**
 * Toroloom — Economic Calendar Screen
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function EconomicCalendarScreen({ navigation }: any) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.title, { color: colors.text }]}>Economic Calendar</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Events</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Upcoming economic events will appear here
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800' },
  content: { padding: SPACING.xl },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: SPACING.md },
  emptyTitle: { fontSize: FONTS.size.lg, fontWeight: '700' },
  emptyDesc: { fontSize: FONTS.size.sm, textAlign: 'center', maxWidth: 280 },
});
''',

    "src/screens/news/IPOCalendarScreen.tsx": '''/**
 * Toroloom — IPO Calendar Screen
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function IPOCalendarScreen({ navigation }: any) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.title, { color: colors.text }]}>IPO Calendar</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <Ionicons name="rocket-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Upcoming IPOs</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Upcoming IPO listings will appear here
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800' },
  content: { padding: SPACING.xl },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: SPACING.md },
  emptyTitle: { fontSize: FONTS.size.lg, fontWeight: '700' },
  emptyDesc: { fontSize: FONTS.size.sm, textAlign: 'center', maxWidth: 280 },
});
''',

    "src/screens/settings/FeatureFlagsScreen.tsx": '''/**
 * Toroloom — Feature Flags Screen
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function FeatureFlagsScreen({ navigation }: any) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.title, { color: colors.text }]}>Feature Flags</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Experimental Features</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800' },
  content: { padding: SPACING.xl },
  sectionLabel: { fontSize: FONTS.size.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
''',

    "src/screens/trade/StrategyPerformanceScreen.tsx": '''/**
 * Toroloom — Strategy Performance Screen
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function StrategyPerformanceScreen({ navigation }: any) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.title, { color: colors.text }]}>Strategy Performance</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Data Yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Strategy performance metrics will appear here after backtesting
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800' },
  content: { padding: SPACING.xl },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: SPACING.md },
  emptyTitle: { fontSize: FONTS.size.lg, fontWeight: '700' },
  emptyDesc: { fontSize: FONTS.size.sm, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
});
''',
}

def main():
    created = 0
    skipped = 0
    for rel_path, content in SCREENS.items():
        full_path = os.path.join(PROJECT_ROOT, rel_path)
        # Create parent dirs
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        if os.path.exists(full_path):
            # Check if file has meaningful content (> 20 lines means it's probably intact)
            with open(full_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            if len(lines) > 30:
                print(f"  SKIP (already has content): {rel_path}")
                skipped += 1
                continue
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  CREATED: {rel_path}")
        created += 1
    
    print(f"\nDone: {created} created, {skipped} skipped")

if __name__ == '__main__':
    main()
