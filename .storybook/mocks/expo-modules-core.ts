/**
 * Mock for expo-modules-core — used by Storybook (web Vite) so that
 * components importing expo modules don't crash trying to use
 * TurboModuleRegistry or other React Native internals that don't
 * exist in react-native-web.
 */

// Shared base class for expo native references
class NativeModuleBase {
  __esModule: boolean = true;
}

export class SharedObject {
  release(): void {}
}

export class SharedRef<T = any> extends SharedObject {
  nativeRefType: string = 'unknown';
  data: T | null = null;
}

export class NativeModule extends NativeModuleBase {
  __esModule: boolean = true;
}

// Module-level instance used by requireNativeModule helpers
const _defaultNativeModule = new NativeModuleBase();

export async function reloadAppAsync(_reason: string): Promise<void> {
  console.warn('[Storybook] reloadAppAsync called — not available in browser');
}

export class EventEmitter {
  addListener() {
    return { remove: () => {} };
  }
  removeAllListeners() {}
  emit() {}
}

/**
 * LegacyEventEmitter — used by expo-task-manager and expo-notifications.
 */
export class LegacyEventEmitter {
  private _eventType: string;
  constructor(eventType: string) {
    this._eventType = eventType;
  }
  addListener(listener: (...args: any[]) => void) {
    return { remove: () => {} };
  }
  removeAllListeners() {}
  emit(..._args: any[]) {}
  listenerCount(): number {
    return 0;
  }
}

/**
 * installOnUIRuntime — used by expo internals for reanimated-like functionality.
 * No-op in the browser.
 */
export function installOnUIRuntime(): void {}

/**
 * uuid — v4 UUID generator. Used by expo-notifications.
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function requireNativeModule(_moduleName: string) {
  return _defaultNativeModule;
}

export function requireOptionalNativeModule(_moduleName: string) {
  return _defaultNativeModule;
}

export function requireNativeViewManager(_viewName: string) {
  return () => null;
}

export function registerWebModule(module: Record<string, unknown>) {
  return module;
}

export const Platform = {
  OS: 'web',
  isDOM: true,
  select: (selections: Record<string, unknown>) => selections.web ?? selections.default ?? selections.ios ?? selections.android,
};

export const CodedError = class CodedError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'CodedError';
  }
};

export const UnavailabilityError = class UnavailabilityError extends Error {
  constructor(moduleName: string, propertyName: string) {
    super(`The module '${moduleName}' is unavailable: '${propertyName}' is not available on this platform.`);
    this.name = 'UnavailabilityError';
  }
};

export function requireNativeModuleAsync(_moduleName: string) {
  return Promise.resolve(_defaultNativeModule);
}

export const PermissionStatus = {
  GRANTED: 'granted',
  UNDETERMINED: 'undetermined',
  DENIED: 'denied',
} as const;

export function createPermissionHook(_permissionMethod: any) {
  return () => [PermissionStatus.UNDETERMINED, () => {}] as const;
}

export class PermissionHookBehavior {
  static Default = 0;
}

const expoModulesCore = {
  EventEmitter,
  LegacyEventEmitter,
  SharedObject,
  SharedRef,
  NativeModule,
  requireNativeModule,
  requireOptionalNativeModule,
  requireNativeViewManager,
  registerWebModule,
  Platform,
  CodedError,
  UnavailabilityError,
  requireNativeModuleAsync,
  PermissionStatus,
  createPermissionHook,
  reloadAppAsync,
  installOnUIRuntime,
  uuid,
};

export default expoModulesCore;
