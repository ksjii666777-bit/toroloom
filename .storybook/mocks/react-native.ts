/**
 * Comprehensive React Native mock for Storybook (web Vite).
 *
 * Re-exports everything from react-native-web, plus adds stubs for
 * React Native internals that don't exist in react-native-web
 * (e.g., TurboModuleRegistry, NativeModules, DeviceEventEmitter).
 */

// Re-export everything from react-native-web
export * from 'react-native-web';

// ─── Missing React Native internals ────────────────────────────────────────

export const TurboModuleRegistry = {
  get(name: string) {
    return null;
  },
  getEnforcing(name: string) {
    return null;
  },
};

export const NativeModules = {
  ExpoModulesCore: {
    installModules: () => {},
  },
  UIManager: {
    getViewManagerConfig: () => ({}),
    createView: () => 0,
    updateView: () => {},
    removeSubviewsFromContainerWithID: () => {},
    manageChildren: () => {},
    blur: () => {},
    focus: () => {},
    measure: () => {},
    measureInWindow: () => {},
    measureInPage: () => {},
    dispatchViewManagerCommand: () => {},
    addAnimation: () => {},
    customBubblingEventTypes: {},
    customDirectEventTypes: {},
    viewManagerConfigs: {},
  },
  PlatformConstants: {
    forceTouch: false,
    interfaceIdiom: 'web',
    isTesting: false,
    osVersion: 'web',
    reactNativeVersion: { major: 0, minor: 76, patch: 0 },
  },
  SourceCode: {
    scriptURL: 'storybook://web',
  },
};

export const DeviceEventEmitter = {
  addListener: () => ({ remove: () => {} }),
  removeAllListeners: () => {},
  emit: () => {},
  listeners: () => [],
  removeListener: () => {},
  removeCurrentListener: () => {},
  addNamedListener: () => ({ remove: () => {} }),
};

export const RNNativeModules = NativeModules;

export const PlatformConstants = NativeModules.PlatformConstants;

export const TVEventEmitter = DeviceEventEmitter;
