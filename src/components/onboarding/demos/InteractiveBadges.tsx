/**
 * Interactive badges unlock demo for onboarding.
 * Users tap badges to unlock them and complete the demo.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { BounceIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../../hooks/useT';
import * as Haptics from 'expo-haptics';
import { MOCK_BADGES } from '../mockData';

interface InteractiveBadgesProps {
  onInteract: () => void;
  onDemoComplete?: () => void;
}

export function InteractiveBadges({ onInteract, onDemoComplete }: InteractiveBadgesProps) {
  const { t } = useT();
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});

  const handleBadgeTap = (id: string) => {
    onInteract();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = { ...unlocked, [id]: !unlocked[id] };
    setUnlocked(next);
    if (Object.values(next).filter(Boolean).length >= MOCK_BADGES.length) {
      setTimeout(() => onDemoComplete?.(), 400);
    }
  };

  const unlockedCount = Object.values(unlocked).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('onboarding.tapBadgesToUnlock')}</Text>
      <Text style={styles.progress}>
        {unlockedCount} / {MOCK_BADGES.length} unlocked
      </Text>

      <View style={styles.grid}>
        {MOCK_BADGES.map((badge) => {
          const isUnlocked = unlocked[badge.id];
          return (
            <Pressable
              key={badge.id}
              onPress={() => handleBadgeTap(badge.id)}
              style={[
                styles.card,
                isUnlocked && { borderColor: badge.color, backgroundColor: badge.color + '15' },
              ]}
            >
              <Animated.View
                entering={BounceIn.duration(300)}
                style={[
                  styles.iconCircle,
                  isUnlocked && { backgroundColor: badge.color + '30' },
                ]}
              >
                <Text style={styles.emoji}>{badge.icon}</Text>
              </Animated.View>
              <Text style={[styles.label, isUnlocked && { color: badge.color }]}>
                {badge.label}
              </Text>
              {isUnlocked && (
                <View style={[styles.unlockedTag, { backgroundColor: badge.color }]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {unlockedCount >= MOCK_BADGES.length && (
        <Animated.View entering={BounceIn.duration(500)} style={styles.allUnlocked}>
          <Text style={styles.allUnlockedText}>🎉 All badges unlocked! You're a pro!</Text>
        </Animated.View>
      )}

      {unlockedCount === 0 && (
        <Text style={styles.hint}>👆 Tap badges to unlock them</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  title: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter-SemiBold', marginBottom: 4, textAlign: 'center' },
  progress: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  card: { width: '45%', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  emoji: { fontSize: 22 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'Inter-Medium', textAlign: 'center' },
  unlockedTag: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  allUnlocked: { marginTop: 12, padding: 10, backgroundColor: 'rgba(0,230,118,0.12)', borderRadius: 10, alignItems: 'center' },
  allUnlockedText: { color: '#00E676', fontSize: 13, fontFamily: 'Inter-SemiBold' },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
