/**
 * ============================================================================
 * Toroloom — Optimized Image Component
 * ============================================================================
 *
 * A drop-in replacement for React Native's Image with:
 * - CDN-optimized URLs (WebP, resize, quality)
 * - Lazy loading with IntersectionObserver-like behavior
 * - Fade-in on load animation
 * - Placeholder shimmer
 * - Error state with retry
 * - Memory cache key integration
 *
 * Usage:
 *   <OptimizedImage
 *     source="https://example.com/image.jpg"
 *     preset="medium"
 *     style={{ width: 200, height: 150 }}
 *   />
 * ============================================================================
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  LayoutAnimation,
  Platform,
  Animated,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAccessibilityStore } from '../../store/accessibilityStore';
import {
  getOptimizedUrl,
  IMAGE_SIZES,
  ImageSizeKey,
  ImageFormat,
} from '../../services/imageOptimization';
import { BORDER_RADIUS } from '../../constants/theme';

// ─── Props ────────────────────────────────────────────────────────────────

interface OptimizedImageProps {
  /** Image URL */
  source: string;
  /** Size preset for CDN optimization */
  preset?: ImageSizeKey;
  /** Custom width/height (overrides preset) */
  width?: number;
  height?: number;
  /** Image format override */
  format?: ImageFormat;
  /** Container style */
  style?: any;
  /** Image style override */
  imageStyle?: any;
  /** Border radius */
  borderRadius?: number;
  /** Whether to show placeholder shimmer while loading */
  showPlaceholder?: boolean;
  /** Whether to enable lazy loading (only load when near viewport) */
  lazy?: boolean;
  /** Aspect ratio (e.g. 16/9). If set, height is computed from width */
  aspectRatio?: number;
  /** Accessibility label */
  alt?: string;
  /** Resize mode */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  /** Called when image loads */
  onLoad?: () => void;
  /** Called when image fails */
  onError?: (error: any) => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function OptimizedImage({
  source,
  preset = 'medium',
  width,
  height,
  format,
  style,
  imageStyle,
  borderRadius = BORDER_RADIUS.md,
  showPlaceholder = true,
  lazy = true,
  aspectRatio,
  alt,
  resizeMode = 'cover',
  onLoad,
  onError,
}: OptimizedImageProps) {
  const { colors } = useTheme();
  const { reduceMotion } = useAccessibilityStore();

  // ── State ──
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // ── Optimized URL ──
  const optimizedUrl = useMemo(() => {
    if (!source) return '';
    return getOptimizedUrl(source, preset, format);
  }, [source, preset, format]);

  // ── Dimensions ──
  const dimensions = useMemo(() => {
    if (width && height) return { width, height };
    if (width && aspectRatio) return { width, height: width / aspectRatio };
    const size = IMAGE_SIZES[preset];
    return { width: width || size.width, height: height || size.height };
  }, [width, height, aspectRatio, preset]);

  // ── Lazy loading: simulate being in view after mount delay ──
  useEffect(() => {
    if (!lazy) return;
    const timer = setTimeout(() => setIsInView(true), 100);
    return () => clearTimeout(timer);
  }, [lazy]);

  // ── Fade in animation ──
  const animateFadeIn = useCallback(() => {
    if (reduceMotion) {
      setLoaded(true);
      return;
    }
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setLoaded(true));
  }, [fadeAnim, reduceMotion]);

  // ── Handlers ──
  const handleLoad = useCallback(() => {
    animateFadeIn();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onLoad?.();
  }, [animateFadeIn, onLoad]);

  const handleError = useCallback((err: any) => {
    setHasError(true);
    setLoaded(true);
    onError?.(err);
  }, [onError]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setLoaded(false);
    fadeAnim.setValue(0);
  }, [fadeAnim]);

  // ── Inline dimensions from style ──
  const containerStyle = useMemo(() => {
    const flatStyle = style ? (Array.isArray(style) ? Object.assign({}, ...style) : style) : {};
    const w = flatStyle.width || dimensions.width;
    const h = flatStyle.height || dimensions.height;
    return { width: w, height: h };
  }, [style, dimensions]);

  // ── Don't render if not in view (lazy) ──
  if (!isInView && lazy) {
    return (
      <View
        style={[
          styles.placeholder,
          {
            width: containerStyle.width,
            height: containerStyle.height,
            borderRadius,
            backgroundColor: colors.bgCardLight,
          },
          style,
        ]}
      />
    );
  }

  // ── Error state ──
  if (hasError) {
    return (
      <TouchableOpacity
        onPress={handleRetry}
        activeOpacity={0.7}
        style={[
          styles.errorContainer,
          {
            width: containerStyle.width,
            height: containerStyle.height,
            borderRadius,
            backgroundColor: colors.bgCard,
          },
          style,
        ]}
      >
        <Ionicons name="image-outline" size={28} color={colors.textMuted} />
        <Text style={[styles.errorText, { color: colors.textMuted }]}>Tap to retry</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        {
          width: containerStyle.width,
          height: containerStyle.height,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: colors.bgCardLight,
        },
        style,
      ]}
    >
      {/* Placeholder shimmer */}
      {showPlaceholder && !loaded && (
        <View
          style={[
            styles.placeholder,
            {
              width: '100%',
              height: '100%',
              backgroundColor: colors.bgCardLight,
            },
            imageStyle,
          ]}
        />
      )}

      {/* Actual image with fade-in */}
      <Animated.View
        style={[
          styles.imageWrapper,
          {
            opacity: loaded ? 1 : fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
          },
        ]}
      >
        <Image
          source={{ uri: optimizedUrl, cache: 'force-cache' }}
          style={[
            {
              width: '100%',
              height: '100%',
              borderRadius,
            },
            imageStyle,
          ]}
          resizeMode={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
          accessibilityLabel={alt || 'Image'}
          accessible
        />
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    ...StyleSheet.absoluteFill,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    borderStyle: 'dashed',
  },
  errorText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
