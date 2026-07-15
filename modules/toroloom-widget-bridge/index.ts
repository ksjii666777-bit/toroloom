/**
 * ============================================================================
 * Toroloom — Widget Native Bridge (Expo Local Module)
 * ============================================================================
 *
 * This local Expo module bridges the gap between the React Native JS layer
 * and native iOS/Android widget extensions by writing data to a shared
 * container (App Group on iOS, SharedPreferences on Android).
 *
 * The module is dynamically imported by widgetService.ts. If the native
 * module is unavailable (Expo Go / dev), it gracefully falls back to
 * AsyncStorage-only mode.
 *
 * iOS Implementation:
 *   - Uses UserDefaults(suiteName:) with App Group identifier
 *   - Calls WidgetCenter.shared.reloadAllTimelines() after data update
 *
 * Android Implementation:
 *   - Uses SharedPreferences with a dedicated prefs file
 *   - Broadcasts widget update intent via WidgetUpdateService
 *
 * ============================================================================
 */

import { NativeModules, Platform } from 'react-native';

const { ToroloomWidgetBridge } = NativeModules;

export interface WidgetBridgeInterface {
  /** Write portfolio snapshot JSON to the shared container */
  updateWidgetData(json: string): Promise<void>;
  /** Force widget timelines to reload */
  reloadWidgetTimelines(): Promise<void>;
  /** Read widget data from the shared container (for debugging) */
  getWidgetData(): Promise<string | null>;
}

/**
 * Default implementation that runs when the native module is not available
 * (e.g., in Expo Go, dev builds without the config plugin, or web).
 */
const fallbackBridge: WidgetBridgeInterface = {
  async updateWidgetData(_json: string) {
    // Data is already saved to AsyncStorage by widgetService.
    // Native bridge unavailable — widget data will be served from
    // AsyncStorage → file bridge on next widget refresh cycle.
    if (__DEV__) {
      console.log('[WidgetBridge] Native module unavailable — AsyncStorage fallback');
    }
  },
  async reloadWidgetTimelines() {
    // No-op in fallback mode
  },
  async getWidgetData() {
    return null;
  },
};

/**
 * The exported bridge object. Uses the native module if available,
 * otherwise falls back to the no-op implementation.
 *
 * NOTE: Uses module.exports (CommonJS) instead of ES export so that
 * widgetService.ts can access it via require() directly. Metro/Babel
 * compiles ES exports to { default, ... }, which breaks require()
 * access patterns (bridge?.updateWidgetData would be undefined).
 */
const widgetBridge: WidgetBridgeInterface = ToroloomWidgetBridge
  ? {
      updateWidgetData: ToroloomWidgetBridge.updateWidgetData,
      reloadWidgetTimelines: ToroloomWidgetBridge.reloadWidgetTimelines,
      getWidgetData: ToroloomWidgetBridge.getWidgetData,
    }
  : fallbackBridge;

// CommonJS export so widgetService.ts require() works directly
module.exports = widgetBridge;
