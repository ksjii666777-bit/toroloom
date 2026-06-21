/**
 * ============================================================================
 * Toroloom — Contract Note Upload & Parse Screen
 * ============================================================================
 *
 * Premium fin-tech UI for uploading broker PDF contract notes, extracting
 * text via the backend, parsing structured trades, and displaying results
 * in the signature Toroloom dark theme.
 *
 * Features:
 *   - File picker button with glassmorphic styling
 *   - Animated loading state during PDF extraction
 *   - Parsed trade results table with buy/sell color coding
 *   - Broker detection badge
 *   - Error state with retry capability
 *   - Deep Midnight Canvas (#07080B) with neon cyan accents
 *
 * Navigation: route.params can accept { brokerFormat?: string }
 *
 * ============================================================================
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import {
  pickAndParseContractNote,
  pickAndParseBatchContractNotes,
  parseContractNoteText,
  exportSingleToCSV,
  exportBatchToCSV,
  exportSelectedToCSV,
} from '../../services/gateway/pdfExtractor';
import type {
  ContractNoteParseResult,
  BatchParseResult,
} from '../../services/gateway/pdfExtractor';
import type { ParsedTrade } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Constants ─────────────────────────────────────────────────────────────

const NEON_CYAN = '#00F2FE';
const MIDNIGHT_BG = '#07080B';
const GLASS_WHITE = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.08)';

// ─── Component ─────────────────────────────────────────────────────────────

export default function ContractNoteUploadScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(), []);

  const brokerFormat = route?.params?.brokerFormat as string | undefined;

  // State
  const [parseResult, setParseResult] = useState<ContractNoteParseResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [expandedFileIndex, setExpandedFileIndex] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Entrance animation
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Handle file picker ──────────────────────────────────────
  const handlePickPDF = useCallback(async () => {
    // Clear any previous batch state so loading indicators work correctly
    setBatchResult(null);
    setBatchProgress(null);
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await pickAndParseContractNote({ brokerFormat });
      setParseResult(result);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Parse Failed',
          result.error || 'Could not extract any trades from this document.',
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [brokerFormat]);

  // ── Handle batch upload ────────────────────────────────────
  const handleBatchUpload = useCallback(async () => {
    // Clear previous single-file result to avoid loading state collision
    setParseResult(null);
    setBatchResult(null);
    setIsLoading(true);
    setBatchProgress('Opening file picker...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Show a brief progress message before the picker opens
      setBatchProgress('Select multiple PDF files...');

      const result = await pickAndParseBatchContractNotes({
        brokerFormat,
        onProgress: (current, total, filename) => {
          setBatchProgress(`Processing file ${current}/${total} — ${filename}`);
        },
      });
      setBatchResult(result);
      setBatchProgress(null);

      if (result.succeeded > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Batch Parse Complete',
          `Processed ${result.totalFiles} file(s). ${result.succeeded} succeeded, ${result.failed} failed. No trades were extracted.`,
        );
      }
    } catch (error: any) {
      setBatchProgress(null);
      Alert.alert('Error', error.message || 'Batch upload failed.');
    } finally {
      setIsLoading(false);
    }
  }, [brokerFormat]);

  // ── Handle paste text ───────────────────────────────────────
  const handleParsePastedText = useCallback(() => {
    if (!pastedText.trim()) {
      Alert.alert('Empty', 'Please paste your contract note text first.');
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = parseContractNoteText(pastedText, brokerFormat);
      setParseResult(result);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'No Trades Found',
          result.error || 'Could not extract any trades from the pasted text. Make sure it contains broker contract note data.',
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to parse pasted text.');
    } finally {
      setIsLoading(false);
    }
  }, [pastedText, brokerFormat]);

  // ── Export to CSV ───────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);

  // ── Batch export handler ────────────────────────────────────
  const handleExportBatchCSV = useCallback(async () => {
    if (!batchResult) return;
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await exportBatchToCSV(batchResult);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Export Failed',
          result.error || 'Could not export CSV. Please try again.',
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Export failed unexpectedly.');
    } finally {
      setIsExporting(false);
    }
  }, [batchResult]);

  // ── Single export handler ───────────────────────────────────
  const handleExportSingleCSV = useCallback(async () => {
    if (!parseResult) return;
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await exportSingleToCSV(parseResult);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Export Failed',
          result.error || 'Could not export CSV. Please try again.',
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Export failed unexpectedly.');
    } finally {
      setIsExporting(false);
    }
  }, [parseResult]);

  // ── Toggle file selection ────────────────────────────────────
  const toggleFileSelection = useCallback((index: number) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // ── Select / Deselect all files ─────────────────────────────
  const toggleSelectAll = useCallback(() => {
    if (!batchResult) return;
    setSelectedFiles(prev => {
      if (prev.size === batchResult.files.length) {
        return new Set();
      }
      return new Set(batchResult.files.map((_, i) => i));
    });
  }, [batchResult]);

  // ── Handle Export Selected ──────────────────────────────────
  const handleExportSelectedCSV = useCallback(async () => {
    if (!batchResult || selectedFiles.size === 0) return;
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await exportSelectedToCSV(batchResult, selectedFiles);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Export Failed',
          result.error || 'Could not export CSV. Please try again.',
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Export failed unexpectedly.');
    } finally {
      setIsExporting(false);
    }
  }, [batchResult, selectedFiles]);

  // ── Clear results ───────────────────────────────────────────
  const handleClear = useCallback(() => {
    setParseResult(null);
    setBatchResult(null);
    setBatchProgress(null);
    setExpandedFileIndex(null);
    setPastedText('');
    setShowPasteInput(false);
    setSelectedFiles(new Set());
    setIsSelecting(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <View style={styles.container}>
      {/* ── Header ────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: 60 + insets.top }]}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.93}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </AnimatedPressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Contract Note Parser</Text>
          <Text style={styles.headerSubtitle}>
            Upload broker PDF or paste text to extract trades
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Action Buttons ──────────────────────────────────── */}
        <Animated.View style={[{ opacity: fadeAnim }]}>
          {/* Upload Card */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePickPDF}
            disabled={isLoading}
            style={styles.actionCard}
          >
            <LinearGradient
              colors={['rgba(0,242,254,0.08)', 'rgba(0,242,254,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionCardGradient}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="document-attach" size={28} color={NEON_CYAN} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Upload PDF Contract Note</Text>
                <Text style={styles.actionSubtitle}>
                  Select a PDF from your device
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Batch Upload Card */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleBatchUpload}
            disabled={isLoading}
            style={[styles.actionCard, { marginTop: SPACING.sm }]}
          >
            <LinearGradient
              colors={['rgba(108,99,255,0.08)', 'rgba(108,99,255,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionCardGradient}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(108,99,255,0.12)' }]}>
                <Ionicons name="layers" size={28} color="#6C63FF" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Batch Upload (Multi)</Text>
                <Text style={styles.actionSubtitle}>
                  Select multiple PDFs to process at once
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Paste Text Card */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setShowPasteInput(!showPasteInput);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[styles.actionCard, { marginTop: SPACING.sm }]}
          >
            <LinearGradient
              colors={['rgba(255,140,0,0.08)', 'rgba(210,105,30,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionCardGradient}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(255,140,0,0.12)' }]}>
                <Ionicons name="clipboard" size={28} color="#FF8C00" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Paste Contract Note Text</Text>
                <Text style={styles.actionSubtitle}>
                  Copy-paste from your broker's email or portal
                </Text>
              </View>
              <Ionicons
                name={showPasteInput ? 'chevron-up' : 'chevron-forward'}
                size={20}
                color="rgba(255,255,255,0.3)"
              />
            </LinearGradient>
          </TouchableOpacity>

          {/* Paste Text Input Area */}
          {showPasteInput && (
            <Animated.View style={[styles.pasteArea, { opacity: fadeAnim }]}>
              <View style={styles.pasteInputContainer}>
                <TextInput
                  style={styles.pasteInput}
                  placeholder="Paste your contract note text here..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  numberOfLines={8}
                  value={pastedText}
                  onChangeText={setPastedText}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <TouchableOpacity
                onPress={handleParsePastedText}
                disabled={isLoading || !pastedText.trim()}
                style={[styles.parseBtn, (!pastedText.trim()) && { opacity: 0.5 }]}
              >
                <LinearGradient
                  colors={['#FF8C00', '#D2691E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.parseBtnGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.parseBtnText}>Parse Text</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Loading State (single file) ──────────────────────────── */}
        {isLoading && !batchProgress && !batchResult && (
          <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
            <ActivityIndicator size="large" color={NEON_CYAN} />
            <Text style={styles.loadingText}>Parsing contract note...</Text>
            <Text style={styles.loadingSubtext}>
              Extracting text and identifying trades
            </Text>
          </Animated.View>
        )}

        {/* ── Batch Progress ───────────────────────────────────────── */}
        {isLoading && batchProgress && (
          <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
            <View style={styles.batchProgressIcon}>
              <Ionicons name="layers" size={32} color={NEON_CYAN} />
            </View>
            <Text style={styles.loadingText}>Batch Processing</Text>
            <Text style={styles.loadingSubtext}>{batchProgress}</Text>
            <View style={styles.batchProgressBar}>
              <View style={styles.batchProgressBarFill} />
            </View>
          </Animated.View>
        )}

        {/* ── Batch Results Section ────────────────────────────── */}
        {batchResult && batchResult.totalFiles > 0 && (
          <Animated.View style={{ opacity: fadeAnim, marginTop: SPACING.xl }}>
            {/* Batch Summary Card */}
            <View style={styles.glassCard}>
              <View style={styles.glassCardInner}>
                <View style={styles.resultHeader}>
                  <View style={[styles.resultIconCircle, { backgroundColor: 'rgba(108,99,255,0.1)' }]}>
                    <Ionicons name="layers" size={24} color="#6C63FF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: SPACING.md }}>
                    <Text style={styles.resultTitle}>Batch Results</Text>
                    <Text style={styles.resultSubtitle}>
                      {batchResult.succeeded} succeeded · {batchResult.failed} failed · {batchResult.totalFiles} total
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleClear} style={styles.clearBtn} testID="clearBtn">
                    <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{batchResult.mergedTrades.length}</Text>
                    <Text style={styles.statLabel}>Merged</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#10B981' }]}>
                      {batchResult.mergedTrades.filter(t => t.transaction_type === 'BUY').length}
                    </Text>
                    <Text style={styles.statLabel}>Buys</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#FF6B00' }]}>
                      {batchResult.mergedTrades.filter(t => t.transaction_type === 'SELL').length}
                    </Text>
                    <Text style={styles.statLabel}>Sells</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#6C63FF' }]}>
                      {batchResult.rawTradeCount}
                    </Text>
                    <Text style={styles.statLabel}>Raw</Text>
                  </View>
                </View>

                {/* Dedup info */}
                {batchResult.rawTradeCount > batchResult.mergedTrades.length && (
                  <View style={styles.sourceRow}>
                    <Ionicons name="funnel" size={12} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.sourceText}>
                      Deduplicated {batchResult.rawTradeCount - batchResult.mergedTrades.length} duplicate trade(s)
                    </Text>
                  </View>
                )}

                {/* Brokers detected */}
                {batchResult.brokersDetected.length > 0 && (
                  <View style={styles.batchBrokersRow}>
                    {batchResult.brokersDetected.map(br => (
                      <View key={br} style={[styles.brokerBadge, { borderColor: brokerColor(br) + '40', marginTop: SPACING.sm }]}>
                        <View style={[styles.brokerDot, { backgroundColor: brokerColor(br) }]} />
                        <Text style={[styles.brokerBadgeText, { color: brokerColor(br) }]}>
                          {brokerLabel(br)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}                  {/* Select / Export row */}
                <View style={styles.batchActionsRow}>
                  {/* Select All toggle */}
                  <TouchableOpacity
                    onPress={() => {
                      setIsSelecting(!isSelecting);
                      if (isSelecting) setSelectedFiles(new Set());
                    }}
                    style={styles.selectToggleBtn}
                  >
                    <Ionicons
                      name={isSelecting ? 'close-outline' : 'checkbox-outline'}
                      size={14}
                      color="rgba(255,255,255,0.5)"
                    />
                    <Text style={styles.selectToggleText}>
                      {isSelecting ? 'Done' : 'Select'}
                    </Text>
                  </TouchableOpacity>

                  {/* Select All / Deselect All (visible in selection mode) */}
                  {isSelecting && (
                    <TouchableOpacity
                      onPress={toggleSelectAll}
                      style={styles.selectAllBtn}
                    >
                      <Ionicons
                        name={selectedFiles.size === batchResult.files.length && batchResult.files.length > 0 ? 'checkbox' : 'square-outline'}
                        size={14}
                        color="#6C63FF"
                      />
                      <Text style={styles.selectAllText}>
                        {selectedFiles.size === batchResult.files.length ? 'Deselect All' : 'Select All'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Export All CSV button */}
                  <TouchableOpacity
                    onPress={handleExportBatchCSV}
                    disabled={isExporting || isLoading}
                    style={[styles.exportBtn, (isExporting || isLoading) && { opacity: 0.5 }]}
                  >
                    <Ionicons name="download-outline" size={14} color="#6C63FF" />
                    <Text style={styles.exportBtnText}>
                      {isExporting ? 'Exporting...' : 'Export All CSV'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Export Selected button (visible in selection mode with items selected) */}
                {isSelecting && selectedFiles.size > 0 && (
                  <TouchableOpacity
                    onPress={handleExportSelectedCSV}
                    disabled={isExporting || isLoading}
                    style={[styles.exportSelectedBtn, (isExporting || isLoading) && { opacity: 0.5 }]}
                  >
                    <Ionicons name="download-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.exportSelectedBtnText}>
                      {isExporting ? 'Exporting...' : `Export Selected (${selectedFiles.size})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Per-File Breakdown */}
            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg, marginBottom: SPACING.md, color: '#FFFFFF' }]}>
              Per-File Breakdown
            </Text>
            {batchResult.files.map((file, i) => (
              <View key={i} style={[styles.glassCard, { marginBottom: SPACING.sm }]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setExpandedFileIndex(expandedFileIndex === i ? null : i)}
                  style={styles.glassCardInner}
                >
                  {/* Selection checkbox (selection mode) */}
                  {isSelecting && (
                    <TouchableOpacity
                      onPress={() => toggleFileSelection(i)}
                      style={styles.checkboxContainer}
                    >
                      <View style={[
                        styles.checkbox,
                        selectedFiles.has(i) && styles.checkboxSelected,
                      ]}>
                        {selectedFiles.has(i) && (
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                  <View style={styles.batchFileRow}>
                    <View style={[styles.batchFileIcon, { backgroundColor: file.success ? 'rgba(16,185,129,0.1)' : 'rgba(255,107,0,0.1)' }]}>
                      <Ionicons
                        name={file.success ? 'checkmark-circle' : 'alert-circle'}
                        size={20}
                        color={file.success ? '#10B981' : '#FF6B00'}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                      <Text style={styles.batchFileName} numberOfLines={1}>
                        {file.filename}
                      </Text>
                      <Text style={styles.batchFileMeta}>
                        {file.trades.length} trade(s)
                        {file.pages ? ` · ${file.pages} page(s)` : ''}
                        {file.brokerDetected ? ` · ${brokerLabel(file.brokerDetected)}` : ''}
                      </Text>
                    </View>
                    <Ionicons
                      name={expandedFileIndex === i ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="rgba(255,255,255,0.3)"
                    />
                  </View>

                  {/* Expanded: error or trade list */}
                  {expandedFileIndex === i && (
                    <View style={{ marginTop: SPACING.md }}>
                      {!file.success && file.error && (
                        <Text style={styles.errorText}>{file.error}</Text>
                      )}
                      {file.trades.length > 0 && (
                        <>
                          {/* Mini table header */}
                          <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Symbol</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Type</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'right' }]}>Qty</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Price</Text>
                          </View>
                          {file.trades.slice(0, 20).map((trade, j) => (
                            <View
                              key={j}
                              style={[styles.tableRow, j % 2 === 1 && { backgroundColor: 'rgba(255,255,255,0.02)' }]}
                            >
                              <Text style={[styles.symbolText, { flex: 1.5, fontSize: 12 }]}>{trade.asset_symbol}</Text>
                              <View style={{ flex: 0.6 }}>
                                <View style={[styles.typeBadge, {
                                  backgroundColor: trade.transaction_type === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(255,107,0,0.15)',
                                  paddingHorizontal: 6, paddingVertical: 2,
                                }]}>
                                  <Text style={[styles.typeBadgeText, {
                                    color: trade.transaction_type === 'BUY' ? '#10B981' : '#FF6B00', fontSize: 9,
                                  }]}>
                                    {trade.transaction_type === 'BUY' ? 'B' : 'S'}
                                  </Text>
                                </View>
                              </View>
                              <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'right', fontSize: 12 }]}>
                                {trade.filled_quantity}
                              </Text>
                              <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontSize: 12 }]}>
                                ₹{trade.execution_price.toFixed(2)}
                              </Text>
                            </View>
                          ))}
                          {file.trades.length > 20 && (
                            <Text style={styles.batchFileMeta}>
                              +{file.trades.length - 20} more trade(s)
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ))}

            {/* ── Merged Trades Table ──────────────────────────── */}
            {batchResult.mergedTrades.length > 0 && (
              <View style={[styles.glassCard, { marginTop: SPACING.md }]}>
                <View style={styles.glassCardInner}>
                  <Text style={styles.tableTitle}>
                    Merged Trades ({batchResult.mergedTrades.length})
                  </Text>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Symbol</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Type</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>Qty</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Price</Text>
                  </View>
                  {batchResult.mergedTrades.map((trade, i) => (
                    <View
                      key={`merged-${i}`}
                      style={[styles.tableRow, i % 2 === 1 && { backgroundColor: 'rgba(255,255,255,0.02)' }]}
                    >
                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.symbolText}>{trade.asset_symbol}</Text>
                        <Text style={styles.dateText}>{formatDate(trade.execution_timestamp)}</Text>
                      </View>
                      <View style={{ flex: 0.7 }}>
                        <View style={[styles.typeBadge, {
                          backgroundColor: trade.transaction_type === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(255,107,0,0.15)',
                        }]}>
                          <Text style={[styles.typeBadgeText, {
                            color: trade.transaction_type === 'BUY' ? '#10B981' : '#FF6B00',
                          }]}>
                            {trade.transaction_type === 'BUY' ? 'B' : 'S'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right' }]}>
                        {trade.filled_quantity}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                        ₹{trade.execution_price.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Single Parse Results Section ──────────────────────── */}
        {parseResult && (
          <Animated.View style={{ opacity: fadeAnim, marginTop: SPACING.xl }}>
            {/* Summary Card */}
            <View style={styles.glassCard}>
              <View style={styles.glassCardInner}>
                <View style={styles.resultHeader}>
                  <View style={styles.resultIconCircle}>
                    <Ionicons
                      name={parseResult.success ? 'checkmark-circle' : 'alert-circle'}
                      size={24}
                      color={parseResult.success ? '#10B981' : '#FF6B00'}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: SPACING.md }}>
                    <Text style={styles.resultTitle}>
                      {parseResult.success ? 'Trades Extracted' : 'Parsing Incomplete'}
                    </Text>
                    <Text style={styles.resultSubtitle}>
                      {parseResult.filename || 'Contract Note'}
                      {parseResult.pages ? ` · ${parseResult.pages} page(s)` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleClear} style={styles.clearBtn} testID="clearBtn">
                    <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{parseResult.trades.length}</Text>
                    <Text style={styles.statLabel}>Trades</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#10B981' }]}>
                      {parseResult.trades.filter(t => t.transaction_type === 'BUY').length}
                    </Text>
                    <Text style={styles.statLabel}>Buys</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#FF6B00' }]}>
                      {parseResult.trades.filter(t => t.transaction_type === 'SELL').length}
                    </Text>
                    <Text style={styles.statLabel}>Sells</Text>
                  </View>

                  {/* Broker Badge */}
                  {parseResult.brokerDetected && (
                    <View style={[styles.brokerBadge, { borderColor: brokerColor(parseResult.brokerDetected) + '40' }]}>
                      <View style={[styles.brokerDot, { backgroundColor: brokerColor(parseResult.brokerDetected) }]} />
                      <Text style={[styles.brokerBadgeText, { color: brokerColor(parseResult.brokerDetected) }]}>
                        {brokerLabel(parseResult.brokerDetected)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Source label */}
                {parseResult.source && (
                  <View style={styles.sourceRow}>
                    <Ionicons
                      name={parseResult.source === 'backend' ? 'cloud-done' : 'phone-portrait'}
                      size={12}
                      color="rgba(255,255,255,0.3)"
                    />
                    <Text style={styles.sourceText}>
                      {parseResult.source === 'backend' ? 'Extracted via server' : 'Local fallback parse'}
                    </Text>
                  </View>
                )}

                {/* Export CSV button (single) */}
                {parseResult.success && parseResult.trades.length > 0 && (
                  <TouchableOpacity
                    onPress={handleExportSingleCSV}
                    disabled={isExporting || isLoading}
                    style={[styles.exportBtn, (isExporting || isLoading) && { opacity: 0.5 }]}
                  >
                    <Ionicons name="download-outline" size={14} color={NEON_CYAN} />
                    <Text style={[styles.exportBtnText, { color: NEON_CYAN }]}>
                      {isExporting ? 'Exporting...' : 'Export CSV'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Trades Table ─────────────────────────────────── */}
            {parseResult.trades.length > 0 && (
              <View style={[styles.glassCard, { marginTop: SPACING.md }]}>
                <View style={styles.glassCardInner}>
                  <Text style={styles.tableTitle}>Parsed Trades</Text>

                  {/* Table Header */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Symbol</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Type</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>Qty</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Price</Text>
                  </View>

                  {/* Trade Rows */}
                  {parseResult.trades.map((trade, i) => (
                    <View
                      key={`${trade.execution_timestamp}-${trade.asset_symbol}-${i}`}
                      style={[
                        styles.tableRow,
                        i % 2 === 1 && { backgroundColor: 'rgba(255,255,255,0.02)' },
                      ]}
                    >
                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.symbolText}>{trade.asset_symbol}</Text>
                        <Text style={styles.dateText}>
                          {formatDate(trade.execution_timestamp)}
                        </Text>
                      </View>
                      <View style={{ flex: 0.7 }}>
                        <View
                          style={[
                            styles.typeBadge,
                            {
                              backgroundColor:
                                trade.transaction_type === 'BUY'
                                  ? 'rgba(16,185,129,0.15)'
                                  : 'rgba(255,107,0,0.15)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeBadgeText,
                              {
                                color:
                                  trade.transaction_type === 'BUY' ? '#10B981' : '#FF6B00',
                              },
                            ]}
                          >
                            {trade.transaction_type === 'BUY' ? 'B' : 'S'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right' }]}>
                        {trade.filled_quantity}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                        ₹{trade.execution_price.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Error Message ─────────────────────────────────── */}
            {!parseResult.success && parseResult.error && (
              <View style={[styles.glassCard, { marginTop: SPACING.md }]}>
                <View style={styles.glassCardInner}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Ionicons name="information-circle" size={18} color="#FF6B00" />
                    <Text style={styles.errorText}>{parseResult.error}</Text>
                  </View>
                  <TouchableOpacity onPress={handlePickPDF} style={styles.retryBtn}>
                    <Text style={styles.retryBtnText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Raw Text ────────────────────────────────────────── */}
            {parseResult.rawText && parseResult.rawText.length > 200 && (
              <View style={[styles.glassCard, { marginTop: SPACING.md }]}>
                <View style={styles.glassCardInner}>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Raw Extracted Text',
                        parseResult.rawText!.substring(0, 5000) +
                          (parseResult.rawText!.length > 5000
                            ? `\n\n... (${parseResult.rawText!.length - 5000} more characters)`
                            : ''),
                      );
                    }}
                  >
                    <Text style={styles.rawTextTitle}>
                      Raw Text ({parseResult.rawText.length} chars)
                    </Text>
                    <Text style={styles.rawTextPreview} numberOfLines={3}>
                      {parseResult.rawText.substring(0, 200)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function brokerColor(broker: string | undefined): string {
  switch (broker) {
    case 'zerodha': return '#2874F0';
    case 'angel': return '#FF6B00';
    case 'groww': return '#00A86B';
    case 'icici_direct': return '#FF6600';
    case 'hdfc_securities': return '#004C8C';
    case 'kotak_securities': return '#9B2B6B';
    default: return '#00F2FE';
  }
}

function brokerLabel(broker: string | undefined): string {
  if (!broker) return 'Auto-Detected';
  return broker
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return iso.substring(0, 10);
  }
}

// ─── Styles ────────────────────────────────────────────────────────────────

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: MIDNIGHT_BG,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.lg,
      backgroundColor: MIDNIGHT_BG,
    },
    headerTitleContainer: {
      marginLeft: SPACING.md,
      flex: 1,
    },
    headerTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
      color: '#FFFFFF',
    },
    headerSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.5)',
      marginTop: 2,
    },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: 20,
    },

    // ── Action Cards ───────────────────────────────────────────
    actionCard: {
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: GLASS_BORDER,
    },
    actionCardGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.lg,
    },
    actionIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: 'rgba(0,242,254,0.08)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionTextContainer: {
      flex: 1,
      marginLeft: SPACING.md,
    },
    actionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: '#FFFFFF',
    },
    actionSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.5)',
      marginTop: 2,
    },

    // ── Paste Area ────────────────────────────────────────────
    pasteArea: {
      marginTop: SPACING.md,
    },
    pasteInputContainer: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: GLASS_BORDER,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      minHeight: 180,
    },
    pasteInput: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: '#FFFFFF',
      lineHeight: 20,
      minHeight: 160,
      textAlignVertical: 'top',
    },
    parseBtn: {
      marginTop: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      overflow: 'hidden',
    },
    parseBtnGradient: {
      paddingVertical: SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
    },
    parseBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: '#FFFFFF',
    },

    // ── Loading ──────────────────────────────────────────────
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 60,
      gap: 12,
    },
    loadingText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: '#FFFFFF',
      marginTop: SPACING.md,
    },
    loadingSubtext: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.4)',
    },

    // ── Glassmorphic Cards ────────────────────────────────────
    glassCard: {
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
    },
    glassCardInner: {
      backgroundColor: GLASS_WHITE,
      borderWidth: 1,
      borderColor: GLASS_BORDER,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
    },

    // ── Results ──────────────────────────────────────────────
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    resultIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: 'rgba(16,185,129,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    resultTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: '#FFFFFF',
    },
    resultSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.4)',
      marginTop: 2,
    },
    clearBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.06)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ── Stats ─────────────────────────────────────────────────
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.lg,
      gap: SPACING.lg,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.xxl,
      color: '#FFFFFF',
    },
    statLabel: {
      ...FONTS.regular,
      fontSize: 10,
      color: 'rgba(255,255,255,0.4)',
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    brokerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      marginLeft: 'auto',
    },
    brokerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    brokerBadgeText: {
      ...FONTS.medium,
      fontSize: 9,
      letterSpacing: 0.3,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: SPACING.sm,
    },
    sourceText: {
      ...FONTS.regular,
      fontSize: 9,
      color: 'rgba(255,255,255,0.3)',
    },

    // ── Trade Table ───────────────────────────────────────────
    tableTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: '#FFFFFF',
      marginBottom: SPACING.md,
    },
    tableHeader: {
      flexDirection: 'row',
      paddingBottom: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: GLASS_BORDER,
    },
    tableHeaderCell: {
      ...FONTS.medium,
      fontSize: 10,
      color: 'rgba(255,255,255,0.4)',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      paddingHorizontal: 4,
    },
    tableCell: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.8)',
    },
    symbolText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: '#FFFFFF',
    },
    dateText: {
      ...FONTS.regular,
      fontSize: 9,
      color: 'rgba(255,255,255,0.4)',
      marginTop: 2,
    },
    typeBadge: {
      borderRadius: BORDER_RADIUS.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: 'flex-start',
    },
    typeBadgeText: {
      ...FONTS.bold,
      fontSize: 10,
    },

    // ── Error ─────────────────────────────────────────────────
    errorText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.6)',
      flex: 1,
      marginLeft: SPACING.sm,
      lineHeight: 18,
    },
    retryBtn: {
      backgroundColor: 'rgba(255,107,0,0.15)',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      alignSelf: 'flex-start',
      marginTop: SPACING.md,
      borderWidth: 1,
      borderColor: 'rgba(255,107,0,0.3)',
    },
    retryBtnText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      color: '#FF6B00',
    },

    // ── Batch ─────────────────────────────────────────────────
    batchProgressIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: 'rgba(0,242,254,0.08)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    batchProgressBar: {
      width: 200,
      height: 3,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 2,
      overflow: 'hidden',
      marginTop: SPACING.sm,
    },
    batchProgressBarFill: {
      width: '50%',
      height: '100%',
      backgroundColor: NEON_CYAN,
      borderRadius: 2,
    },
    batchBrokersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    batchFileRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    batchFileIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    batchFileName: {
      ...FONTS.medium,
      fontSize: 12,
      color: '#FFFFFF',
    },
    batchFileMeta: {
      ...FONTS.regular,
      fontSize: 10,
      color: 'rgba(255,255,255,0.4)',
      marginTop: 1,
    },
    sectionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: '#FFFFFF',
    },

    // ── Export & Selection ─────────────────────────────────────
    batchActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.lg,
      gap: SPACING.sm,
    },
    selectToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: GLASS_BORDER,
    },
    selectToggleText: {
      ...FONTS.medium,
      fontSize: 11,
      color: 'rgba(255,255,255,0.5)',
    },
    selectAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: 'rgba(108,99,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(108,99,255,0.2)',
    },
    selectAllText: {
      ...FONTS.medium,
      fontSize: 11,
      color: '#6C63FF',
    },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: 'rgba(108,99,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(108,99,255,0.25)',
    },
    exportBtnText: {
      ...FONTS.medium,
      fontSize: 11,
      color: '#6C63FF',
    },
    exportSelectedBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: SPACING.sm,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: 'rgba(108,99,255,0.25)',
      borderWidth: 1,
      borderColor: '#6C63FF',
    },
    exportSelectedBtnText: {
      ...FONTS.medium,
      fontSize: 11,
      color: '#FFFFFF',
    },
    checkboxContainer: {
      marginRight: SPACING.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.25)',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    checkboxSelected: {
      borderColor: '#6C63FF',
      backgroundColor: '#6C63FF',
    },

    // ── Raw Text ──────────────────────────────────────────────
    rawTextTitle: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.4)',
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    rawTextPreview: {
      ...FONTS.regular,
      fontSize: 10,
      color: 'rgba(255,255,255,0.3)',
      fontFamily: 'monospace',
      lineHeight: 14,
    },
  });
