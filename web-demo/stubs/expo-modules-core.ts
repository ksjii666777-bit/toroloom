/**
 * Web stub for `expo-modules-core`.
 *
 * Some transitive dependency in the OfflineBanner chain imports it, and its
 * TypeScript source deep-imports react-native internals (`TurboModuleRegistry`)
 * that react-native-web doesn't export. Native TurboModules don't exist on the
 * web, so a no-op surface is safe — nothing in the demo calls it.
 */

const noop = (): void => undefined;

export const Platform = {
  OS: 'web',
  select: (obj: unknown): unknown => {
    const o = obj as Record<string, unknown> | undefined;
    if (!o) return undefined;
    return o.web ?? o.default ?? o;
  },
  isDOMAvailable: true,
};

export const requireNativeModule = (): null => null;
export const requireOptionalNativeModule = (): null => null;
export const registerWebModule = <T,>(m: T): T => m;
export const requireNativeViewManager = (): null => null;
export const addWebViewManager = noop;
export const reloadAppAsync = async (): Promise<void> => undefined;
export const installOnUIRuntime = noop;

export const PermissionStatus = {
  GRANTED: 'granted',
  UNDETERMINED: 'undetermined',
  DENIED: 'denied',
} as const;

/** Hook factory matching expo-modules-core's createPermissionHook signature. */
export function createPermissionHook() {
  return () => ({
    status: PermissionStatus.GRANTED,
    canAskAgain: true,
    granted: true,
    ask: async (): Promise<{ status: string; granted: boolean; canAskAgain: boolean }> => ({
      status: PermissionStatus.GRANTED,
      granted: true,
      canAskAgain: true,
    }),
  });
}

export class EventEmitter {
  addListener() { return { remove: noop }; }
  removeListener() { return this; }
  removeAllListeners() { return this; }
  emit() { return true; }
  listenerCount() { return 0; }
}

export class LegacyEventEmitter {
  addListener() { return { remove: noop }; }
  removeListener() { return this; }
  removeAllListeners() { return this; }
  emit() { return true; }
  listenerCount() { return 0; }
}

export class NativeModule {}
export class SharedObject {}
export class SharedRef {}
export class SharedValue<T = unknown> {
  value: T;
  constructor(v: T) { this.value = v; }
}

export const NativeModulesProxy: Record<string, unknown> = {};
export const NativeModules: Record<string, unknown> = {};
export const TurboModuleRegistry = { get: (): null => null, getEnforcing: (): null => null };
export const SyntheticPlatformEmitter = { emit: noop };

export class CodedError extends Error {}
export class UnavailabilityError extends Error {}

export const uuid = { v4: (): string => '00000000-0000-4000-8000-000000000000' };
export const getRandomValues = <T,>(arr: T[]): T[] => arr;
export const isRunningInExpoGo = false;
export const createWebModule = <T,>(m: T): T => m;
export const installWebModule = <T,>(m: T): T => m;
export const Device = { getDeviceId: (): string => 'demo' };

export default {
  Platform,
  EventEmitter,
  LegacyEventEmitter,
  NativeModule,
  SharedObject,
  SharedRef,
  SharedValue,
  NativeModulesProxy,
  NativeModules,
  TurboModuleRegistry,
  SyntheticPlatformEmitter,
  CodedError,
  UnavailabilityError,
  uuid,
  requireNativeModule,
  requireOptionalNativeModule,
  requireNativeViewManager,
  registerWebModule,
  reloadAppAsync,
  installOnUIRuntime,
  PermissionStatus,
  createPermissionHook,
  isRunningInExpoGo,
};
