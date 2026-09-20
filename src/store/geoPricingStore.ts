/**
 * ============================================================================
 * Toroloom — Geo-Pricing Store
 * ============================================================================
 *
 * Holds the user's pricing region for the Global Pricing page:
 *   - detectedRegion: derived from the device timezone on initialize()
 *   - regionOverride: manual pick from the region chips (persisted)
 *
 * The effective region is `override ?? detected ?? 'in'` (see the pure
 * effectiveRegion() in services/pricing/geoPricing).
 *
 * Persisted in AsyncStorage under 'toroloom_geo_pricing_region'.
 * ============================================================================
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  detectRegion,
  getDeviceTimezone,
  type PricingRegion,
} from '../services/pricing/geoPricing';

export interface GeoPricingState {
  /** Manually chosen region from the chips. null = follow auto-detection */
  regionOverride: PricingRegion | null;
  /** Region derived from the device timezone during initialize() */
  detectedRegion: PricingRegion | null;
  /** True once initialize() has run */
  initialized: boolean;

  /** @param timezone injectable for tests; defaults to the device timezone */
  initialize: (timezone?: string | null) => Promise<void>;
  /** Chip tap. Pass null to return to auto-detection. */
  setRegionOverride: (region: PricingRegion | null) => Promise<void>;
  /** GDPR erasure: drop the override (detection is not personal data) */
  clearRegion: () => Promise<void>;
}

const STORAGE_KEY = 'toroloom_geo_pricing_region';

export const useGeoPricingStore = create<GeoPricingState>((set) => ({
  regionOverride: null,
  detectedRegion: null,
  initialized: false,

  initialize: async (timezone?: string | null) => {
    let override: PricingRegion | null = null;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { region?: PricingRegion | null };
        if (parsed.region === 'in' || parsed.region === 'us' || parsed.region === 'eu') {
          override = parsed.region;
        }
      }
    } catch {
      // corrupted/absent storage → fall through with no override
    }
    const tz = timezone !== undefined ? timezone : getDeviceTimezone();
    set({ regionOverride: override, detectedRegion: detectRegion(tz), initialized: true });
  },

  setRegionOverride: async (region) => {
    set({ regionOverride: region });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ region }));
    } catch {
      // Persistence failure is non-fatal — in-memory value is already set
    }
  },

  clearRegion: async () => {
    set({ regionOverride: null });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore — nothing left to clear
    }
  },
}));
