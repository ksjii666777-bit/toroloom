import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, Platform, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import {
  DEFAULT_OPTIMIZATION_CONFIG, ImageFormat, ImageSizeKey,
  IMAGE_SIZES, IMAGE_SIZE_LABELS, isWebPSupported,
  formatBytes, estimateWebPSavings, suggestSizePreset,
} from '../../services/imageOptimization';
import OptimizedImage from '../../components/ui/OptimizedImage';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

export default function CDNOptimizationScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Settings State ──
  const [cdnEnabled, setCdnEnabled] = useState(DEFAULT_OPTIMIZATION_CONFIG.cdnEnabled);
  const [imageFormat, setImageFormat] = useState<ImageFormat>(DEFAULT_OPTIMIZATION_CONFIG.format);
  const [quality, setQuality] = useState(DEFAULT_OPTIMIZATION_CONFIG.quality);
  const [lazyLoading, setLazyLoading] = useState(DEFAULT_OPTIMIZATION_CONFIG.lazyLoading);
  const [previewSize, setPreviewSize] = useState<ImageSizeKey>('medium');

  const webpSupported = useMemo(() => isWebPSupported(), []);

  // Sample image URLs for preview (these are real public domain images)
  const sampleImages = useMemo(() => [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200',  // Stock market
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200',  // Trading chart
    'https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?w=1200',  // Crypto
  ], []);

  const [previewIndex, setPreviewIndex] = useState(0);

  const currentSize = IMAGE_SIZES[previewSize];
  const sizeLabel = IMAGE_SIZE_LABELS[previewSize];

  const handleResetDefaults = useCallback(() => {
    Alert.alert(
      t('cdnOptimization.resetTitle'),
      t('cdnOptimization.resetMsg'),
      [
        { text: t('app.cancel'), style: 'cancel' },
        {
          text: t('cdnOptimization.resetConfirm'),
          onPress: () => {
            setCdnEnabled(DEFAULT_OPTIMIZATION_CONFIG.cdnEnabled);
            setImageFormat(DEFAULT_OPTIMIZATION_CONFIG.format);
            setQuality(DEFAULT_OPTIMIZATION_CONFIG.quality);
            setLazyLoading(DEFAULT_OPTIMIZATION_CONFIG.lazyLoading);
            setPreviewSize('medium');
          },
        },
      ],
    );
  }, [t]);

  const qualityOptions = [60, 70, 80, 85, 90];

  const getQualityDesc = useCallback((q: number): string => {
    const descs: Record<number, string> = {
      60: t('cdnOptimization.qFast'),
      70: t('cdnOptimization.qThumbnail'),
      80: t('cdnOptimization.qHigh'),
      85: t('cdnOptimization.qVeryHigh'),
      90: t('cdnOptimization.qMax'),
    };
    return descs[q] || t('cdnOptimization.qStandard');
  }, [t]);

  // Simulate savings based on quality
  const webpSavings = useMemo(() => {
    const originalSize = 512000; // 500KB
    return estimateWebPSavings(originalSize);
  }, []);

  const formatConfig: Partial<Record<ImageFormat, { icon: keyof typeof Ionicons.glyphMap; color: string; labelKey: string; descKey: string }>> = {
    webp: { icon: 'image', color: '#8B5CF6', labelKey: 'cdnOptimization.formatWebp', descKey: 'cdnOptimization.webpDesc' },
    jpeg: { icon: 'document', color: '#3B82F6', labelKey: 'cdnOptimization.formatJpeg', descKey: 'cdnOptimization.jpegDesc' },
    png: { icon: 'albums', color: '#00C853', labelKey: 'cdnOptimization.formatPng', descKey: 'cdnOptimization.pngDesc' },
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('cdnOptimization.title')}</Text>
          <Text style={styles.subtitle}>{t('cdnOptimization.subtitle')}</Text>
        </View>

        {/* ── Status Card ── */}
        <Animated.View entering={FadeInDown.springify()} style={[styles.statusCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Ionicons name="checkmark-circle" size={20} color={cdnEnabled ? '#00C853' : colors.textMuted} />
              <Text style={[styles.statusLabel, { color: cdnEnabled ? '#00C853' : colors.textMuted }]}>
                {cdnEnabled ? t('cdnOptimization.cdnActive') : t('cdnOptimization.cdnDisabled')}
              </Text>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
              <Ionicons name="image" size={20} color={imageFormat === 'webp' ? '#8B5CF6' : colors.textMuted} />
              <Text style={styles.statusLabel}>{imageFormat.toUpperCase()}</Text>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
              <Ionicons name="speedometer" size={20} color={colors.primary} />
              <Text style={styles.statusLabel}>{t('cdnOptimization.quality', { percent: quality })}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── WebP Support Alert ── */}
        {!webpSupported && imageFormat === 'webp' && (
          <View style={styles.alertCard}>
            <Ionicons name="warning" size={16} color="#FFC107" />
            <Text style={styles.alertText}>{t('cdnOptimization.webpAlert')}</Text>
          </View>
        )}

        {/* ── CDN Toggle ── */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('cdnOptimization.cdnOptimization')}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#00C85320' }]}>
                <Ionicons name="cloud-download" size={18} color="#00C853" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('cdnOptimization.enableCdn')}</Text>
                <Text style={styles.settingDesc}>{t('cdnOptimization.enableCdnDesc')}</Text>
              </View>
            </View>
            <Switch
              value={cdnEnabled}
              onValueChange={setCdnEnabled}
              trackColor={{ false: colors.bgCardLight, true: '#00C85360' }}
              thumbColor={cdnEnabled ? '#00C853' : colors.textMuted}
              ios_backgroundColor={colors.bgCardLight}
            />
          </View>
        </Animated.View>

        {/* ── Format Selector ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('cdnOptimization.outputFormat')}</Text>
          <Text style={styles.sectionDesc}>{t('cdnOptimization.outputFormatDesc')}</Text>

          <View style={styles.formatRow}>
            {(['webp', 'jpeg', 'png'] as ImageFormat[]).map(format => {
              const isActive = imageFormat === format;
              const fc = formatConfig[format];
              if (!fc) return null;
              return (
                <AnimatedPressable
                  key={format}
                  onPress={() => setImageFormat(format)}
                  haptic="selection"
                  scaleTo={0.94}
                >
                  <View style={[
                    styles.formatCard,
                    isActive && { borderColor: fc.color, backgroundColor: fc.color + '15' },
                    !isActive && { opacity: 0.7 },
                  ]}>
                    <Ionicons
                      name={fc.icon}
                      size={22}
                      color={isActive ? fc.color : colors.textMuted}
                    />
                    <Text style={[styles.formatLabel, isActive && { color: fc.color }]}>
                      {t(fc.labelKey)}
                    </Text>
                    <Text style={styles.formatDesc}>
                      {t(fc.descKey)}
                    </Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>

          {imageFormat === 'webp' && (
            <View style={styles.savingsCard}>
              <Ionicons name="trending-down" size={16} color="#00C853" />
              <Text style={styles.savingsText}>
                {t('cdnOptimization.savingsLabel', {
                  percent: webpSavings.savingsPercent,
                  savings: webpSavings.savingsFormatted,
                })}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ── Quality Slider (simplified as radio buttons) ── */}
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('cdnOptimization.quality', { percent: quality })}</Text>
          <Text style={styles.sectionDesc}>{getQualityDesc(quality)}</Text>
          <View style={styles.qualityRow}>
            {qualityOptions.map(q => (
              <AnimatedPressable
                key={q}
                onPress={() => setQuality(q)}
                haptic="selection"
                scaleTo={0.92}
              >
                <View style={[
                  styles.qualityChip,
                  quality === q && { backgroundColor: colors.primary + '25', borderColor: colors.primary },
                ]}>
                  <Text style={[
                    styles.qualityChipText,
                    quality === q && { color: colors.primary },
                  ]}>{q}</Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>
        </Animated.View>

        {/* ── Lazy Loading ── */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="hourglass" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{t('cdnOptimization.lazyLoading')}</Text>
                <Text style={styles.settingDesc}>{t('cdnOptimization.lazyLoadingDesc')}</Text>
              </View>
            </View>
            <Switch
              value={lazyLoading}
              onValueChange={setLazyLoading}
              trackColor={{ false: colors.bgCardLight, true: colors.primary + '60' }}
              thumbColor={lazyLoading ? colors.primary : colors.textMuted}
              ios_backgroundColor={colors.bgCardLight}
            />
          </View>
        </Animated.View>

        {/* ── Preset Size Preview ── */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('cdnOptimization.sizePreset')}</Text>
          <Text style={styles.sectionDesc}>{sizeLabel.description}</Text>

          <View style={styles.presetRow}>
            {(Object.keys(IMAGE_SIZE_LABELS) as ImageSizeKey[]).map(key => {
              const isActive = previewSize === key;
              const l = IMAGE_SIZE_LABELS[key];
              return (
                <AnimatedPressable
                  key={key}
                  onPress={() => setPreviewSize(key)}
                  haptic="selection"
                  scaleTo={0.94}
                >
                  <View style={[
                    styles.presetChip,
                    isActive && { backgroundColor: colors.primary + '25', borderColor: colors.primary },
                  ]}>
                    <Text style={[styles.presetChipLabel, isActive && { color: colors.primary }]}>
                      {l.label}
                    </Text>
                    <Text style={styles.presetChipSize}>
                      {IMAGE_SIZES[key].width}×{IMAGE_SIZES[key].height}
                    </Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>

          {/* Live Preview */}
          <View style={styles.previewContainer}>
            <OptimizedImage
              source={sampleImages[previewIndex]}
              preset={previewSize}
              borderRadius={BORDER_RADIUS.md}
              lazy={false}
              alt={t('cdnOptimization.previewAlt', { size: previewSize })}
            />
            <Text style={styles.previewSizeText}>
              {t('cdnOptimization.previewSizeText', {
                width: currentSize.width,
                height: currentSize.height,
                quality,
                format: imageFormat.toUpperCase(),
              })}
            </Text>
          </View>

          {/* Cycle Preview Image */}
          <AnimatedPressable
            onPress={() => setPreviewIndex(prev => (prev + 1) % sampleImages.length)}
            haptic="light"
            scaleTo={0.97}
          >
            <View style={styles.cycleBtn}>
              <Ionicons name="shuffle" size={16} color={colors.primary} />
              <Text style={styles.cycleBtnText}>{t('cdnOptimization.switchImage')}</Text>
            </View>
          </AnimatedPressable>
        </Animated.View>

        {/* ── Reset Button ── */}
        <AnimatedPressable onPress={handleResetDefaults} haptic="medium" scaleTo={0.97}>
          <View style={styles.resetBtn}>
            <Ionicons name="refresh" size={18} color={colors.textMuted} />
            <Text style={styles.resetBtnText}>{t('cdnOptimization.resetDefaults')}</Text>
          </View>
        </AnimatedPressable>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 20 },
  header: { paddingTop: 60, marginBottom: SPACING.lg },
  title: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted, marginTop: 4 },
  statusCard: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusItem: { flex: 1, alignItems: 'center', gap: 4 },
  statusDivider: { width: 1, height: 36, backgroundColor: colors.divider },
  statusLabel: { ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.text },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, backgroundColor: '#FFC10715', borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: '#FFC10730', marginBottom: SPACING.lg,
  },
  alertText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: '#FFC107', flex: 1 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg, color: colors.text, marginBottom: SPACING.sm },
  sectionDesc: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted, marginBottom: SPACING.md },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1, marginRight: SPACING.md },
  settingIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text },
  settingDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
  formatRow: { flexDirection: 'row', gap: SPACING.sm },
  formatCard: {
    flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5, borderColor: colors.border, gap: 4,
  },
  formatLabel: { ...FONTS.bold, fontSize: FONTS.size.sm, color: colors.text },
  formatDesc: { ...FONTS.regular, fontSize: 9, color: colors.textMuted },
  savingsCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginTop: SPACING.md, padding: SPACING.sm, backgroundColor: '#00C85310',
    borderRadius: BORDER_RADIUS.sm,
  },
  savingsText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: '#00C853', flex: 1 },
  qualityRow: { flexDirection: 'row', gap: SPACING.sm },
  qualityChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
  },
  qualityChipText: { ...FONTS.bold, fontSize: FONTS.size.md, color: colors.text },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  presetChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  presetChipLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text },
  presetChipSize: { ...FONTS.regular, fontSize: 9, color: colors.textMuted, marginTop: 1 },
  previewContainer: { marginBottom: SPACING.sm, borderRadius: BORDER_RADIUS.md, overflow: 'hidden' },
  previewSizeText: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  cycleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: colors.primary + '40', borderStyle: 'dashed',
  },
  cycleBtnText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.primary },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.xl,
  },
  resetBtnText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.textMuted },
});
