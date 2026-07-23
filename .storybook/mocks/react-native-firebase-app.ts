/**
 * Mock for @react-native-firebase/app — no-op in Storybook (web).
 * Firebase modules are not available in the browser via react-native-web.
 */
import { EventEmitter } from 'expo-modules-core';

// FirebaseApp interface
export interface FirebaseApp {
  name: string;
  options: Record<string, unknown>;
}

const mockApp: FirebaseApp = {
  name: '[DEFAULT]',
  options: {},
};

// Re-export EventEmitter since @react-native-firebase/app uses it
export { EventEmitter };

export function initializeApp(): FirebaseApp {
  return mockApp;
}

export function getApp(): FirebaseApp {
  return mockApp;
}

export function getApps(): FirebaseApp[] {
  return [mockApp];
}

export function deleteApp(): Promise<void> {
  return Promise.resolve();
}

export type ReactNativeFirebaseNamespace = {
  app: () => FirebaseApp;
  apps: FirebaseApp[];
  initializeApp: () => FirebaseApp;
};

const firebase = {
  app: () => mockApp,
  apps: [mockApp],
  initializeApp,
};

export default firebase;
