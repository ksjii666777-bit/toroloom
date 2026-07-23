/**
 * ============================================================================
 * Toroloom — Widget Grid Layout (Draggable)
 * ============================================================================
 *
 * Arranges dashboard widgets in a responsive list with real drag-to-reorder
 * via react-native-draggable-flatlist. Long-press any widget to enter drag
 * mode, then drag up/down to reorder with smooth spring animations.
 *
 * Dependencies: react-native-draggable-flatlist (already installed)
 *               GestureHandlerRootView is at App.tsx root.
 *
 * The list uses scrollEnabled={false} so the parent ScrollView in the
 * dashboard screen handles all vertical scrolling. This avoids the
 * nested-virtualized-list anti-pattern.
 *
 * ============================================================================
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useTheme } from '../../context/ThemeContext';
import { useWidgetStore } from '../../store/widgetStore';
import BaseWidget from './BaseWidget';
import PnLWidget from './PnLWidget';
import HoldingsWidget from './HoldingsWidget';
import RiskMetricsWidget from './RiskMetricsWidget';
import SectorAllocationWidget from './SectorAllocationWidget';
import RecentTradesWidget from './RecentTradesWidget';
import MarketOverviewWidget from './MarketOverviewWidget';
import PerformanceChartWidget from './PerformanceChartWidget';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants/theme';
import type { WidgetType, WidgetSize, DashboardWidget } from '../../types/widgets';

// ──── Widget Component Map ──────────────────────────────────────────────

const WIDGET_COMPONENTS: Record<WidgetType, React.ComponentType<{ size: WidgetSize }>> = {
  pnl: PnLWidget,
  holdings: HoldingsWidget,
  risk_metrics: RiskMetricsWidget,
  sector_allocation: SectorAllocationWidget,
  recent_trades: RecentTradesWidget,
  market_overview: MarketOverviewWidget,
  performance_chart: PerformanceChartWidget,
};

// ──── Draggable Widget Row ───────────────────────────────────────────────

function DraggableWidgetRow({ item, drag, isActive }: RenderItemParams<DashboardWidget>) {
  const { colors } = useTheme();
  const WidgetComponent = WIDGET_COMPONENTS[item.type];

  if (!item.visible) return null;

  return (
    <ScaleDecorator>
      <View
        style={[
          rowStyles.container,
          {
            backgroundColor: colors.bgCard,
            borderColor: isActive ? colors.primary + '60' : 'transparent',
            shadowColor: isActive ? colors.primary : 'transparent',
            shadowOpacity: isActive ? 0.3 : 0,
            shadowRadius: isActive ? 12 : 0,
            elevation: isActive ? 8 : 0,
          },
        ]}
      >
        <BaseWidget
          widgetId={item.id}
          type={item.type}
          title={item.title}
          size={item.size}
          onLongPress={drag}
        >
          <WidgetComponent size={item.size} />
        </BaseWidget>
      </View>
    </ScaleDecorator>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
  },
});

// ──── Empty State ─────────────────────────────────────────────────────────

function EmptyState({ onAddWidget }: { onAddWidget: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={emptyStyles.container}>
      <View style={[emptyStyles.iconWrap, { backgroundColor: colors.primary + '20' }]}>
        <Ionicons name="grid-outline" size={32} color={colors.primary} />
      </View>
      <Text style={[emptyStyles.title, { color: colors.text }]}>No Widgets Yet</Text>
      <Text style={[emptyStyles.subtitle, { color: colors.textMuted }]}>
        Add widgets to customize your analytics dashboard
      </Text>
      <Pressable
        style={({ pressed }) => [
          emptyStyles.addBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={onAddWidget}
      >
        <Ionicons name="add" size={20} color="#FFF" />
        <Text style={emptyStyles.addBtnText}>Browse Widgets</Text>
      </Pressable>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center', lineHeight: 20 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  addBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#FFF' },
});

// ──── Footer: Add Widget Button ───────────────────────────────────────────

function ListFooter({ onAddWidget, colors }: { onAddWidget: () => void; colors: any }) {
  return (
    <Pressable
      style={({ pressed }) => [
        footerStyles.btn,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={onAddWidget}
    >
      <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
      <Text style={[footerStyles.text, { color: colors.primary }]}>Add Widget</Text>
    </Pressable>
  );
}

const footerStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md + 2,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: SPACING.xs,
  },
  text: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
});

// ──── Main Grid Component ────────────────────────────────────────────────

interface WidgetGridProps {
  onAddWidget: () => void;
}

export default function WidgetGrid({ onAddWidget }: WidgetGridProps) {
  const { colors } = useTheme();
  const { layout, reorderWidgets } = useWidgetStore();

  const visibleWidgets = layout.widgets.filter(w => w.visible);

  const handleDragEnd = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      if (from !== to) {
        reorderWidgets(from, to);
      }
    },
    [reorderWidgets],
  );

  const renderItem = useCallback(
    (params: RenderItemParams<DashboardWidget>) => <DraggableWidgetRow {...params} />,
    [],
  );

  const keyExtractor = useCallback((item: DashboardWidget) => item.id, []);

  if (visibleWidgets.length === 0) {
    return <EmptyState onAddWidget={onAddWidget} />;
  }

  return (
    <DraggableFlatList
      data={visibleWidgets}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onDragEnd={handleDragEnd}
      scrollEnabled={false}
      activationDistance={10}
      ListFooterComponent={<ListFooter onAddWidget={onAddWidget} colors={colors} />}
      contentContainerStyle={gridStyles.content}
      showsVerticalScrollIndicator={false}
    />
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────

const gridStyles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
});
