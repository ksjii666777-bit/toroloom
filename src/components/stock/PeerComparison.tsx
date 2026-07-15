import React from 'react';
import { View, Text, StyleSheet, Pressable, } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { Stock } from '../../types';

interface PeerComparisonProps {
  currentStock: Stock;
  peers: Stock[];
  onPeerPress: (stockId: string, symbol: string) => void;
  formatMarketCap: (marketCap: string) => string;
  /** Optional sector name shown as subtitle */
  sectorName?: string;
}

export default function PeerComparison({
  currentStock,
  peers,
  onPeerPress,
  formatMarketCap,
  sectorName,
}: PeerComparisonProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (peers.length === 0) return null;

  const allPeers = [currentStock, ...peers];
  const maxPE = Math.max(...allPeers.map(p => p.pe), 1);

  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
        <Text style={styles.sectionTitle}>Peer Comparison</Text>
        {sectorName && (
          <Text style={{ ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted }}>{sectorName}</Text>
        )}
      </View>

      {/* Table header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerCell, styles.cellSymbol, { color: colors.textMuted }]}>Symbol</Text>
        <Text style={[styles.headerCell, { color: colors.textMuted }]}>P/E</Text>
        <Text style={[styles.headerCell, { color: colors.textMuted }]}>M.Cap</Text>
        <Text style={[styles.headerCell, { color: colors.textMuted }]}>Chg%</Text>
      </View>

      {/* Current stock (highlighted) */}
      <View style={[styles.row, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' }]}>
        <View style={styles.cellSymbol}>
          <Text style={[styles.symbolText, { color: colors.primary }]}>{currentStock.symbol}</Text>
          <View style={[styles.youBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.youBadgeText, { color: colors.primary }]}>YOU</Text>
          </View>
        </View>
        <View style={styles.cellWithBar}>
          <Text style={[styles.cellText, { color: colors.text }]}>{currentStock.pe.toFixed(1)}</Text>
          <View style={[styles.barBg, { backgroundColor: colors.bgInput }]}>
            <View style={[styles.barFill, { width: `${(currentStock.pe / maxPE) * 100}%`, backgroundColor: colors.primary, opacity: 0.7 }]} />
          </View>
        </View>
        <Text style={[styles.cellText, { color: colors.text }]}>{formatMarketCap(currentStock.marketCap)}</Text>
        <Text style={[styles.cellText, { color: currentStock.changePercent >= 0 ? colors.marketUp : colors.marketDown }]}>
          {currentStock.changePercent >= 0 ? '+' : ''}{currentStock.changePercent.toFixed(2)}%
        </Text>
      </View>

      {/* Peer stocks */}
      {peers.map(p => (
        <Pressable
          key={p.id}
          style={[styles.row, { borderColor: colors.border }]}
          onPress={() => onPeerPress(p.id, p.symbol)}
        >
          <Text style={[styles.symbolText, styles.cellSymbol, { color: colors.text }]}>{p.symbol}</Text>
          <View style={styles.cellWithBar}>
            <Text style={[styles.cellText, { color: colors.text }]}>{p.pe.toFixed(1)}</Text>
            <View style={[styles.barBg, { backgroundColor: colors.bgInput }]}>
              <View style={[styles.barFill, { width: `${(p.pe / maxPE) * 100}%`, backgroundColor: colors.textMuted, opacity: 0.3 }]} />
            </View>
          </View>
          <Text style={[styles.cellText, { color: colors.text }]}>{formatMarketCap(p.marketCap)}</Text>
          <Text style={[styles.cellText, { color: p.changePercent >= 0 ? colors.marketUp : colors.marketDown }]}>
            {p.changePercent >= 0 ? '+' : ''}{p.changePercent.toFixed(2)}%
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    sectionTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.text,
      marginBottom: SPACING.md,
    },
    header: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
    },
    headerCell: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.xs,
      flex: 1,
      textAlign: 'right',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderRadius: BORDER_RADIUS.sm,
      marginTop: 2,
    },
    cellSymbol: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    symbolText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
    cellText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      flex: 1,
      textAlign: 'right',
    },
    cellWithBar: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 3,
    },
    youBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    youBadgeText: {
      ...FONTS.bold,
      fontSize: 8,
    },
    barBg: {
      width: '100%',
      height: 3,
      borderRadius: 2,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 2,
    },
  });
