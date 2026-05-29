/**
 * ============================================================================
 * Toroloom — React Native Mock
 * ============================================================================
 *
 * This mock replaces the real `react-native` module during tests via
 * vitest's `resolve.alias`.  The real react-native package ships with
 * Flow-typed syntax (`import typeof`) that Node.js / Vite cannot parse,
 * so we substitute a clean mock at the Vite resolution level.
 *
 * Components that need more advanced native behaviour (Animated, LayoutAnimation,
 * etc.) can extend this mock as needed.
 */

import React from 'react';
import type { ComponentType } from 'react';

// ── Re-export types ——————————————————————————————————————————
export type { TextStyle, ViewStyle, ImageStyle, StyleProp } from 'react-native';

// ── Dummy component factory ——————————————————————————————————
/**
 * Creates a mock component that renders a host element with the given name.
 *
 * Must use `React.createElement(name, ...)` so that react-test-renderer sees
 * a host component (string type) which its `toJSON()` can serialize.
 * Previously we returned `props.children ?? null`, which caused `toJSON()`
 * to return `null` in React 19 because only host components are serialized.
 */
function dummyComponent(name: string): ComponentType<any> {
  const Dummy: ComponentType<any> = (props: any) => {
    // ReactTestRenderer needs actual host elements (string type) to serialize.
    // Forward all props so onPress, style, etc. can be found by fireEvent.
    const { children, ...rest } = props;
    return React.createElement(name, rest, children);
  };
  Dummy.displayName = name;
  return Dummy;
}

// ── Core components ———————————————————————————————————————————
export const View = dummyComponent('View');
export const Text = dummyComponent('Text');
export const Image = dummyComponent('Image');
export const ScrollView = dummyComponent('ScrollView');
export const FlatList = dummyComponent('FlatList');
export const SectionList = dummyComponent('SectionList');
export const TouchableOpacity = dummyComponent('TouchableOpacity');
export const TouchableHighlight = dummyComponent('TouchableHighlight');
export const TouchableWithoutFeedback = dummyComponent('TouchableWithoutFeedback');
export const Pressable = dummyComponent('Pressable');
export const ActivityIndicator = dummyComponent('ActivityIndicator');
export const Modal = dummyComponent('Modal');
export const KeyboardAvoidingView = dummyComponent('KeyboardAvoidingView');
export const SafeAreaView = dummyComponent('SafeAreaView');
export const StatusBar = dummyComponent('StatusBar');
export const Switch = dummyComponent('Switch');
export const TextInput = dummyComponent('TextInput');
export const RefreshControl = dummyComponent('RefreshControl');
export const Keyboard = dummyComponent('Keyboard');

// ── StyleSheet ————————————————————————————————————————————————
export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
  hairlineWidth: () => 1,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const,
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const,
  flatten: <T>(style: T | T[]): T => (Array.isArray(style) ? style[0] : style),
  setStyleAttributePreprocessor: () => {},
};

// ── Dimensions ———————————————————————————————————————————————
export const Dimensions = {
  get: (_: string) => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
};

// ── Platform —————————————————————————————————————————————————
export const Platform = {
  OS: 'ios' as const,
  Version: '16.0',
  select: <T extends Record<string, any>>(specs: T) => specs.ios ?? specs.default,
  isPad: false,
  isTV: false,
  isTesting: true,
  constants: {
    forceTouchAvailable: false,
    interfaceIdiom: 'phone',
    osVersion: '16.0',
    systemName: 'iOS',
  },
};

// ── Animated ——————————————————————————————————————————————————
class AnimatedValue {
  _value: number;
  _listeners: Array<(value: number) => void> = [];

  constructor(value: number) {
    this._value = value;
  }

  setValue(value: number) {
    this._value = value;
  }

  addListener(cb: (value: number) => void) {
    this._listeners.push(cb);
  }

  removeListener(cb: (value: number) => void) {
    this._listeners = this._listeners.filter((l) => l !== cb);
  }

  interpolate(_config: any) {
    return { __isInterpolation: true };
  }
}

export const Animated = {
  Value: AnimatedValue,
  View: dummyComponent('Animated.View'),
  Text: dummyComponent('Animated.Text'),
  Image: dummyComponent('Animated.Image'),
  ScrollView: dummyComponent('Animated.ScrollView'),
  timing: (_value: any, _config: any) => ({ start: (cb?: () => void) => cb?.(), stop: () => {} }),
  spring: (_value: any, _config: any) => ({ start: (cb?: () => void) => cb?.(), stop: () => {} }),
  sequence: (_animations: any[]) => ({ start: (cb?: () => void) => cb?.(), stop: () => {} }),
  parallel: (_animations: any[]) => ({ start: (cb?: () => void) => cb?.(), stop: () => {} }),
  stagger: (_delay: number, _animations: any[]) => ({ start: (cb?: () => void) => cb?.(), stop: () => {} }),
  loop: (_animation: any) => ({ start: (cb?: () => void) => cb?.(), stop: () => {} }),
  delay: (_ms: number) => ({ start: (cb?: () => void) => cb?.(), stop: () => {} }),
  event: (_argMapping: any[], _config?: any) => () => {},
};

// ── PixelRatio ———————————————————————————————————————————————
export const PixelRatio = {
  get: () => 3,
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (size: number) => size * 3,
  roundToNearestPixel: (size: number) => Math.round(size * 3) / 3,
  startDetecting: () => {},
};

// ── LayoutAnimation ———————————————————————————————————————————
export const LayoutAnimation = {
  configureNext: () => {},
  create: (_duration: number, _type: any, _property: any) => {},
  Presets: {
    easeInEaseOut: { duration: 300, create: { type: 'easeInEaseOut' }, update: { type: 'easeInEaseOut' } },
    linear: { duration: 300, create: { type: 'linear' }, update: { type: 'linear' } },
    spring: { duration: 300, create: { type: 'spring' }, update: { type: 'spring' } },
  },
  Types: {
    spring: 'spring',
    linear: 'linear',
    easeInEaseOut: 'easeInEaseOut',
    easeIn: 'easeIn',
    easeOut: 'easeOut',
    keyboard: 'keyboard',
  },
  Properties: {
    opacity: 'opacity',
    scaleX: 'scaleX',
    scaleY: 'scaleY',
    scaleXY: 'scaleXY',
  },
};

// ── Color utilities ——————————————————————————————————————————
export const PlatformColor = (_color: string) => ({ __isPlatformColor: true });
export const DynamicColorIOS = (_color: any) => ({ __isDynamicColorIOS: true });
export const processColor = (color: any) => color;

// ── Appearance ———————————————————————————————————————————————
export const Appearance = {
  getColorScheme: () => 'light' as const,
  addChangeListener: () => ({ remove: () => {} }),
  removeChangeListener: () => {},
};

// ── AppState —————————————————————————————————————————————————
export const AppState = {
  currentState: 'active' as const,
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
};

// ── Clipboard ————————————————————————————————————————————————
export const Clipboard = {
  getString: () => Promise.resolve(''),
  setString: (_text: string) => {},
};

// ── Vibration ————————————————————————————————————————————————
export const Vibration = {
  vibrate: (_pattern?: number | number[]) => {},
  cancel: () => {},
};

// ── NativeModules ————————————————————————————————————————————
export const NativeModules = {
  UIManager: {
    createView: () => {},
    setChildren: () => {},
    manageChildren: () => {},
    updateView: () => {},
    focus: () => {},
    blur: () => {},
  },
  PlatformConstants: {
    forceTouchAvailable: false,
    interfaceIdiom: 'phone',
    osVersion: '16.0',
    systemName: 'iOS',
  },
};

// ── Utility exports ———————————————————————————————————————————
export const I18nManager = {
  allowRTL: false,
  forceRTL: false,
  isRTL: false,
  doLeftAndRightSwapInRTL: true,
  getConstants: () => ({ isRTL: false, doLeftAndRightSwapInRTL: true }),
};

export const InteractionManager = {
  runAfterInteractions: (cb: () => void) => cb(),
  createInteractionHandle: () => 1,
  clearInteractionHandle: () => {},
};

// ── TurboModuleRegistry ——————————————————————————————————————
export const TurboModuleRegistry = {
  get: (_name: string) => null,
  getEnforcing: (_name: string) => null,
};

// ── Default export ———————————————————————————————————————————
const ReactNative = {
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  SectionList,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  Pressable,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  SafeAreaView: dummyComponent('SafeAreaView'),
  StatusBar,
  Switch,
  TextInput,
  RefreshControl,
  Keyboard,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  PixelRatio,
  LayoutAnimation,
  PlatformColor,
  DynamicColorIOS,
  processColor,
  Appearance,
  AppState,
  Clipboard,
  Vibration,
  NativeModules,
  I18nManager,
  InteractionManager,
  TurboModuleRegistry,
};

export default ReactNative;
