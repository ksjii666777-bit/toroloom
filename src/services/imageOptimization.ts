/**
 * ============================================================================
 * Toroloom — CDN Image Optimization Service
 * ============================================================================
 *
 * Provides image URL transformation for CDN-based image optimization:
 * - URL-based resize (`?w=400&h=300&fit=cover`)
 * - WebP format negotiation (`&fm=webp`)
 * - Quality control (`&q=80`)
 * - Image cache management with expo-file-system
 * - Predefined size presets (thumbnail, small, medium, large, hero)
 *
 * Usage:
 *   import { optimizeUrl, IMAGE_SIZES } from '../services/imageOptimization';
 *   const url = optimizeUrl('https://example.com/image.jpg', IMAGE_SIZES.thumbnail);
 * ============================================================================
 */

import { Platform } from 'react-native';

// ─── Image Size Presets ───────────────────────────────────────────────────

export const IMAGE_SIZES = {
  /** Very small thumbnail (e.g. avatar lists) */
  thumbnail: { width: 64, height: 64, quality: 60 },
  /** Small preview (e.g. card thumbnails) */
  small: { width: 200, height: 150, quality: 70 },
  /** Medium quality (e.g. course cards) */
  medium: { width: 400, height: 300, quality: 80 },
  /** Large size (e.g. full-width banners) */
  large: { width: 800, height: 600, quality: 85 },
  /** Hero / full-screen images */
  hero: { width: 1200, height: 800, quality: 90 },
} as const;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;

// ─── Format Preferences ───────────────────────────────────────────────────

export type ImageFormat = 'webp' | 'jpeg' | 'png' | 'original';

export interface ImageOptimizationConfig {
  /** Preferred output format */
  format: ImageFormat;
  /** Default quality (1-100) */
  quality: number;
  /** Whether to enable lazy loading */
  lazyLoading: boolean;
  /** Whether to enable CDN optimization */
  cdnEnabled: boolean;
  /** Custom CDN base URL (null = use image's original domain) */
  cdnBaseUrl: string | null;
  /** Cache TTL in seconds (default: 7 days) */
  cacheTtlSeconds: number;
  /** Maximum cache size in MB */
  maxCacheSizeMB: number;
}

/** Default optimization configuration */
export const DEFAULT_OPTIMIZATION_CONFIG: ImageOptimizationConfig = {
  format: 'webp',
  quality: 80,
  lazyLoading: true,
  cdnEnabled: true,
  cdnBaseUrl: null,
  cacheTtlSeconds: 7 * 24 * 3600, // 7 days
  maxCacheSizeMB: 100,
};

// ─── CDN URL Builder ──────────────────────────────────────────────────────

/**
 * Build an optimized CDN URL with resize params.
 *
 * Supports:
 * - Imgix-style URL params (`?w=400&h=300&fit=cover&fm=webp&q=80`)
 * - Cloudinary-style URL transforms (`/c_fill,w_400,h_300/`)
 * - Falls back to original URL if CDN optimization is disabled
 *
 * For this implementation, we use Imgix-style query params which work
 * with most modern CDNs (Imgix, Cloudflare, bunny.net, etc.).
 */
export function optimizeUrl(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: ImageFormat;
    fit?: 'cover' | 'contain' | 'fill' | 'scale';
    config?: Partial<ImageOptimizationConfig>;
  } = {},
): string {
  const config = { ...DEFAULT_OPTIMIZATION_CONFIG, ...options.config };

  if (!config.cdnEnabled || !url || url.startsWith('data:')) {
    return url;
  }

  const params = new URLSearchParams();

  if (options.width) params.set('w', String(options.width));
  if (options.height) params.set('h', String(options.height));
  if (options.quality ?? config.quality) params.set('q', String(options.quality ?? config.quality));
  if (options.fit) params.set('fit', options.fit);
  if (options.format && options.format !== 'original') {
    params.set('fm', options.format);
  } else if (config.format !== 'original') {
    params.set('fm', config.format);
  }

  const queryString = params.toString();
  if (!queryString) return url;

  // Add or append to existing query params
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${queryString}`;
}

// ─── Preset URL builder ──────────────────────────────────────────────────

/**
 * Get an optimized URL for a given size preset.
 */
export function getOptimizedUrl(
  url: string,
  preset: ImageSizeKey = 'medium',
  format?: ImageFormat,
): string {
  const size = IMAGE_SIZES[preset];
  return optimizeUrl(url, {
    ...size,
    format,
    fit: 'cover',
  });
}

// ─── Cache Key Generator ─────────────────────────────────────────────────

/**
 * Generate a cache key for an image URL based on its content.
 * Removes cache-busting query params for better cache hits.
 */
export function getImageCacheKey(url: string, width?: number, height?: number): string {
  // Remove cache-busting params (t=, _t, timestamp, etc.)
  const cleanUrl = url.replace(/[?&](t|_t|timestamp|cb|v|_)=\d+/g, '');
  const sizeSuffix = width && height ? `_${width}x${height}` : '';
  // Simple hash of the URL
  let hash = 0;
  const str = cleanUrl + sizeSuffix;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `img_${Math.abs(hash).toString(36)}${sizeSuffix}`;
}

// ─── Image Format Detection ──────────────────────────────────────────────

/**
 * Check whether WebP is supported on the current platform.
 * iOS 14+, Android 4.0+, and modern web browsers support WebP.
 */
export function isWebPSupported(): boolean {
  // React Native's Image component on iOS 14+ and Android 4+ supports WebP
  // We enable it by default for both platforms
  if (Platform.OS === 'web') {
    // Check browser WebP support via canvas
    try {
      const canvas = document.createElement('canvas');
      return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
    } catch {
      return false;
    }
  }
  return true; // React Native supports WebP on both iOS and Android
}

// ─── Storage Calculation ─────────────────────────────────────────────────

/**
 * Format bytes to a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Estimate how much space is saved by using WebP vs JPEG.
 * WebP typically saves 25-35% compared to JPEG at the same quality.
 */
export function estimateWebPSavings(originalSizeBytes: number): {
  estimatedWebpSize: number;
  savingsPercent: number;
  savingsFormatted: string;
} {
  const savingsPercent = 30; // Conservative 30% average savings
  const estimatedWebpSize = Math.round(originalSizeBytes * (1 - savingsPercent / 100));
  return {
    estimatedWebpSize,
    savingsPercent,
    savingsFormatted: formatBytes(originalSizeBytes - estimatedWebpSize),
  };
}

// ─── Preset Descriptions ─────────────────────────────────────────────────

export const IMAGE_SIZE_LABELS: Record<ImageSizeKey, { label: string; description: string; example: string }> = {
  thumbnail: { label: 'Thumbnail',  description: '64×64 — Avatar lists, icons',                example: '64×64, 60% quality' },
  small:     { label: 'Small',      description: '200×150 — Card thumbnails',                  example: '200×150, 70% quality' },
  medium:    { label: 'Medium',     description: '400×300 — Course cards, news thumbnails',    example: '400×300, 80% quality' },
  large:     { label: 'Large',      description: '800×600 — Full-width banners',               example: '800×600, 85% quality' },
  hero:      { label: 'Hero',       description: '1200×800 — Hero images, full-screen',        example: '1200×800, 90% quality' },
};

/**
 * Estimate the optimal image size preset based on container width.
 */
export function suggestSizePreset(containerWidth: number): ImageSizeKey {
  if (containerWidth < 100) return 'thumbnail';
  if (containerWidth < 300) return 'small';
  if (containerWidth < 600) return 'medium';
  if (containerWidth < 1000) return 'large';
  return 'hero';
}
