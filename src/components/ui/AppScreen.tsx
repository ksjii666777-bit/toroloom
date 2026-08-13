import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  RefreshControl,
  ScrollViewProps,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { LAYOUT, SPACING } from '../../constants/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  /** true when the screen sits inside the bottom tab navigator */
  hasTabBar?: boolean;
  /** extra bottom room for a FAB or sticky CTA */
  bottomInsetExtra?: number;
  padded?: boolean;
  header?: React.ReactNode;      // pinned, does NOT scroll
  footer?: React.ReactNode;      // pinned sticky CTA
  /**
   * absolutely-positioned backdrop rendered above body (e.g. search overlay).
   * Rendered last, so it also covers a pinned `footer` — make it dismissible.
   */
  overlay?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
};

/**
 * AppScreen — the shared screen scaffold for Toroloom.
 *
 * Owns safe-area handling, status bar, bottom chrome inset (tab bar / home
 * indicator), optional pull-to-refresh, and tablet centering via
 * `LAYOUT.maxContentWidth`. Screens supply `children` and optionally a
 * pinned `header`, a pinned sticky `footer` (CTAs), or a `ScrollView`
 * passthrough via `scrollProps`.
 *
 * Note: `scrollProps` only applies when `scroll=true`. Its
 * `contentContainerStyle` and `refreshControl` are MERGED with (not
 * replaced by) the default padding/centering and pull-to-refresh — a
 * consumer-supplied value wins on conflict.
 */
export default function AppScreen({
  children,
  scroll = true,
  hasTabBar = false,
  bottomInsetExtra = 0,
  padded = true,
  header,
  footer,
  overlay,
  refreshing,
  onRefresh,
  contentStyle,
  scrollProps,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Tab bar already consumes the bottom system inset, so screens inside it
  // only need the bar height. Standalone screens need the raw inset.
  const bottomPad =
    (hasTabBar ? LAYOUT.tabBarHeight : Math.max(insets.bottom, SPACING.base)) +
    bottomInsetExtra +
    SPACING.xl;

  const sidePad = padded ? LAYOUT.screenX : 0;
  const centering =
    width > LAYOUT.maxContentWidth + 32
      ? { maxWidth: LAYOUT.maxContentWidth, alignSelf: 'center' as const, width: '100%' as const }
      : null;

  // Pop container/refresh overrides out of scrollProps so they MERGE with
  // (not replace) the screen padding + tablet centering defaults.
  const {
    contentContainerStyle: scrollContentStyle,
    refreshControl: scrollRefreshControl,
    ...restScrollProps
  } = scrollProps ?? {};

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        { paddingHorizontal: sidePad, paddingBottom: bottomPad },
        centering,
        contentStyle,
        scrollContentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        scrollRefreshControl ??
        (onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textSecondary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined)
      }
      {...restScrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flex,
        { paddingHorizontal: sidePad, paddingBottom: bottomPad },
        centering,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      {header}
      {body}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: hasTabBar
                ? SPACING.md
                : Math.max(insets.bottom, SPACING.base),
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
      {/* overlay must position itself (e.g. StyleSheet.absoluteFill) */}
      {overlay}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    flex: {
      flex: 1,
    },
    footer: {
      paddingHorizontal: LAYOUT.screenX,
      paddingTop: SPACING.md,
      backgroundColor: colors.surfaceElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
