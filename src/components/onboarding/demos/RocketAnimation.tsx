/**
 * Interactive rocket launch animation for onboarding.
 * Users tap to launch the rocket and complete the demo.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, BounceIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface RocketAnimationProps {
  onInteract: () => void;
  onDemoComplete?: () => void;
  interacted: boolean;
}

export function RocketAnimation({ onInteract, onDemoComplete, interacted }: RocketAnimationProps) {
  const [launched, setLaunched] = useState(false);
  const rocketY = useSharedValue(0);
  const rocketRotate = useSharedValue(0);
  const glowOpacity = useSharedValue(0.6);
  const flameScale = useSharedValue(1);

  useEffect(() => {
    if (!launched) {
      glowOpacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 1000 }), withTiming(0.4, { duration: 1000 })),
        -1,
        true,
      );
      flameScale.value = withRepeat(
        withSequence(withTiming(1.3, { duration: 400 }), withTiming(1, { duration: 400 })),
        -1,
        true,
      );
    }
  }, [launched, glowOpacity, flameScale]);

  const handleLaunch = () => {
    if (launched) return;
    onInteract();
    onDemoComplete?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLaunched(true);
    rocketY.value = withTiming(-200, { duration: 1200 });
    rocketRotate.value = withTiming(-15, { duration: 1200 });
    glowOpacity.value = withTiming(0, { duration: 800 });
  };

  const rocketStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: rocketY.value },
      { rotate: `${rocketRotate.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: flameScale.value }],
  }));

  return (
    <View style={styles.container}>
      <Pressable onPress={handleLaunch} disabled={launched}>
        <Animated.View style={[styles.rocketWrapper, rocketStyle]}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <View style={styles.rocketIcon}>
            <Ionicons name="rocket" size={64} color="#FFFFFF" />
          </View>
          <Animated.View style={[styles.flame, flameStyle]}>
            <LinearGradient
              colors={['#FF6B35', '#FFAB40', 'transparent']}
              style={styles.flameGradient}
            />
          </Animated.View>
        </Animated.View>
      </Pressable>

      {!launched && !interacted && (
        <Text style={styles.hint}>🚀 Tap to launch!</Text>
      )}
      {launched && (
        <Animated.View entering={BounceIn.duration(500)} style={styles.launchMsg}>
          <Text style={styles.launchMsgText}>✨ Blast off! Let's start your journey</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  rocketWrapper: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  glow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.15)' },
  rocketIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  flame: { position: 'absolute', bottom: -30, width: 40, height: 50, zIndex: 1 },
  flameGradient: { width: '100%', height: '100%', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  launchMsg: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20 },
  launchMsgText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter-Medium' },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
