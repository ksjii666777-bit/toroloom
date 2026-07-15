/**
 * ============================================================================
 * Toroloom — Fullscreen Chart Modal
 * ============================================================================
 *
 * Full-screen overlay for the candlestick chart. Fills the entire screen,
 * hides the tab bar and header, and renders the chart at maximum dimensions
 * with expanded touch controls.
 *
 * Features:
 * - Orientation-aware layout (landscape = wider chart, compact header)
 * - Smooth fade + scale enter/exit animation
 * - Live connection indicator
 * ============================================================================
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import CandlestickChart, { ChartType } from '../CandlestickChart';
import type { DrawingAnnotation, DrawingToolType } from '../chart/DrawingTools';
import type { DetectedPattern } from '../chart/patternDetection';

// ============================================================================
// Orientation-aware dimensions
// ============================================================================

interface ScreenSize {
  width: number;
  height: number;
  isLandscape: boolean;
}

function getScreenSize(): ScreenSize {
  const { width, height } = Dimensions.get('window');
  return {
    width,
    height,
    isLandscape: width > height,
  };
}

// ============================================================================
// Props
// ============================================================================

interface FullscreenChartModalProps {
  visible: boolean;
  onClose: () => void;
  // Chart props
  candleHistory: any[];
  activeTimeframe: string;
  onTimeframeChange: (tf: string) => void;
  showMA: boolean;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  enableDrawing: boolean;
  drawings: DrawingAnnotation[];
  onDrawingsChange: (drawings: DrawingAnnotation[]) => void;
  activeDrawTool: DrawingToolType;
  onDrawToolChange: (tool: DrawingToolType) => void;
  showPatterns: boolean;
  patterns: DetectedPattern[];
  // Stock info for header
  symbol: string;
  name: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  isPositive: boolean;
  isConnected: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 300;
const COMPACT_HEADER_HEIGHT = 60;

// ============================================================================
// Component
// ============================================================================

export default function FullscreenChartModal({
  visible,
  onClose,
  candleHistory,
  activeTimeframe,
  onTimeframeChange,
  showMA,
  chartType,
  onChartTypeChange,
  enableDrawing,
  drawings,
  onDrawingsChange,
  activeDrawTool,
  onDrawToolChange,
  showPatterns,
  patterns,
  symbol,
  name,
  currentPrice,
  priceChange,
  priceChangePercent,
  isPositive,
  isConnected,
}: FullscreenChartModalProps) {
  const { colors } = useTheme();
  const { width, isLandscape, height } = useOrientation();

  // ── Animation ──
  const animValue = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(animValue, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setRendered(false);
      });
    }
  }, [visible, animValue]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ── Restore StatusBar on unmount ──
  useEffect(() => {
    return () => {
      StatusBar.setHidden(false);
    };
  }, []);

  if (!rendered && !visible) return null;

  // ── Orientation-aware layout ──
  const headerHeight = isLandscape ? COMPACT_HEADER_HEIGHT : 80;
  const headerPaddingTop = isLandscape ? 16 : 50;
  const chartHorizontalPadding = isLandscape ? 8 : SPACING.sm;
  const chartWidth = width - chartHorizontalPadding * 2;
  const chartHeight = height - headerHeight - (isLandscape ? 16 : 40);

  // ── Animated styles ──
  const overlayStyle = {
    opacity: animValue,
    transform: [
      {
        scale: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  };

  const styles = createStyles(colors);

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <StatusBar hidden />

      {/* ── Fullscreen Header ── */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={handleClose} style={({pressed}) => [styles.closeBtn, {opacity: pressed ? 0.7 : 1}]}>
            <Ionicons name="close" size={isLandscape ? 20 : 24} color={colors.text} />
          </Pressable>
          <View style={styles.stockInfo}>
            <Text style={[styles.symbol, isLandscape && { fontSize: FONTS.size.md }]}>
              {symbol}
            </Text>
            {!isLandscape && (
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
            )}
          </View>
        </View>

        <View style={styles.priceInfo}>
          <Text style={[styles.price, isLandscape && { fontSize: FONTS.size.lg }]}>
            {formatCurrency(currentPrice)}
          </Text>
          <View style={[styles.changeBadge, { backgroundColor: (isPositive ? colors.marketUp : colors.marketDown) + '20' }]}>
            <Text style={[styles.changeText, { color: isPositive ? colors.marketUp : colors.marketDown }]}>
              {isPositive ? '+' : ''}{priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.connectionDot,
            {
              backgroundColor: isConnected ? '#00C853' : '#888',
              width: isLandscape ? 6 : 8,
              height: isLandscape ? 6 : 8,
              borderRadius: isLandscape ? 3 : 4,
            },
          ]}
        />
      </View>

      {/* ── Full-width Chart ── */}
      <View style={[styles.chartContainer, { paddingHorizontal: chartHorizontalPadding }]}>
        <CandlestickChart
          data={candleHistory}
          height={chartHeight}
          width={chartWidth}
          timeframes={['1m', '5m', '15m', '1D', '1W', '1M', '3M', '1Y', 'Max']}
          activeTimeframe={activeTimeframe}
          onTimeframeChange={onTimeframeChange}
          showVolume={true}
          showMA={showMA}
          loading={candleHistory.length === 0}
          chartType={chartType}
          onChartTypeChange={onChartTypeChange}
          enableDrawing={enableDrawing}
          drawings={drawings}
          onDrawingsChange={onDrawingsChange}
          activeDrawTool={activeDrawTool}
          onDrawToolChange={onDrawToolChange}
          showPatterns={showPatterns}
          patterns={patterns}
        />
      </View>
    </Animated.View>
  );
}

// ============================================================================
// Hook: useOrientation
// ============================================================================

function useOrientation(): ScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>(getScreenSize);

  useEffect(() => {
    const handler = ({ window }: { window: { width: number; height: number } }) => {
      setScreenSize({
        width: window.width,
        height: window.height,
        isLandscape: window.width > window.height,
      });
    };
    const subscription = Dimensions.addEventListener('change', handler);
    return () => subscription.remove();
  }, []);

  return screenSize;
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 100,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      flex: 1,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.bgCard,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stockInfo: {
      flex: 1,
    },
    symbol: {
      ...FONTS.extraBold,
      fontSize: FONTS.size.lg,
      color: colors.text,
    },
    name: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textSecondary,
    },
    priceInfo: {
      alignItems: 'flex-end',
      marginRight: SPACING.sm,
    },
    price: {
      ...FONTS.black,
      fontSize: FONTS.size.xl,
      color: colors.text,
    },
    changeBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.full,
      marginTop: 2,
    },
    changeText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.xs,
    },
    connectionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    chartContainer: {
      flex: 1,
      paddingBottom: SPACING.md,
    },
  });
