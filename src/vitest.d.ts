/// <reference types="vitest/globals" />

// __DEV__ is a global boolean provided by Expo / React Native / Metro bundler.
// It is true in development builds and false in production. vitest's Node
// environment does not define it, so we declare it here and set it in setup.ts.
declare var __DEV__: boolean | undefined;
