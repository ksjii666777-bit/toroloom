/**
 * ============================================================================
 * Toroloom — AppNavigator route coverage guard
 * ============================================================================
 *
 * Every route registered in AppNavigator.tsx must have a matching entry in the
 * typed param lists: `RootStackParamList` for the stack navigator and
 * `TabParamList` for the bottom tabs.
 *
 * This mirrors what `createNativeStackNavigator<RootStackParamList>()`
 * enforces at compile time, but runs in CI via vitest — so a route added to
 * AppNavigator without a corresponding param-list entry (or a param-list key
 * with no registered screen) fails loudly, naming the offending routes.
 *
 * Sources are read from disk and parsed structurally:
 *   - `<Stack.Screen name="X" .../>` / `<Tab.Screen name="X" .../>` literals
 *   - `key:` entries inside the `RootStackParamList = { ... }` /
 *     `TabParamList = { ... }` blocks in src/types/index.ts
 *
 * The second describe block holds type-level assertions (`expectTypeOf`). These
 * are enforced by `tsc --noEmit` (esbuild strips types when vitest runs, so they
 * are runtime no-ops) — keep tsc in CI to make them bite.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NavigatorScreenParams } from '@react-navigation/native';
import type {
  PlaceOrderRouteParams,
  RootStackParamList,
  SnapTradeOrderRouteParams,
  TabParamList,
} from '../types';

// Test lives in <root>/src/__tests__ — climb two levels to the repo root.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const readSource = (relative: string): string =>
  fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');

/**
 * Every static `name="X"` literal on a <Stack.Screen/> or <Tab.Screen/> tag.
 *
 * `name` is expected to be the first prop of the tag (true for every Screen in
 * AppNavigator). The match window is bounded to 120 chars so a `name="..."`
 * inside an `options` prop (e.g. `<Icon name="star" />`) can never be
 * mistaken for the route name.
 */
function extractScreenNames(source: string, navigator: 'Stack' | 'Tab'): string[] {
  const pattern = new RegExp(
    `<(?:${navigator})\\.Screen\\b[\\s\\S]{0,120}?name=["']([A-Za-z0-9_]+)["']`,
    'g',
  );
  return [...source.matchAll(pattern)].map((match) => match[1] ?? '');
}

/** Keys of `export type X = { ... }` — every `key:` at the start of a line. */
function extractParamListKeys(source: string, typeName: string): string[] {
  const start = source.indexOf(`${typeName} = {`);
  if (start === -1) {
    throw new Error(`"${typeName} = {" not found in src/types/index.ts — was the type renamed?`);
  }
  const end = source.indexOf('\n};', start);
  if (end === -1) {
    throw new Error(`Closing "};" for ${typeName} not found in src/types/index.ts`);
  }
  const block = source.slice(start, end);
  // Line-anchored: inline param fields (e.g. `StockDetail: { stockId: string }`)
  // never appear at the start of a line, so only true route keys are captured.
  return [...block.matchAll(/\n\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/g)].map(
    (match) => match[1] ?? '',
  );
}

const appNavigatorSource = readSource('src/navigation/AppNavigator.tsx');
const typesSource = readSource('src/types/index.ts');

const stackScreens = extractScreenNames(appNavigatorSource, 'Stack');
const tabScreens = extractScreenNames(appNavigatorSource, 'Tab');
const stackKeys = extractParamListKeys(typesSource, 'RootStackParamList');
const tabKeys = extractParamListKeys(typesSource, 'TabParamList');

describe('AppNavigator route ↔ param-list coverage', () => {
  it('parses the registered screens (sanity: extraction is not silently empty)', () => {
    expect(stackScreens.length).toBeGreaterThan(50);
    // Route names must be unique — a duplicated registration is a bug.
    expect(new Set(stackScreens).size).toBe(stackScreens.length);
    // Tab order matches the registrations in AppNavigator.tsx.
    expect(tabScreens).toEqual(['More', 'Home', 'Markets', 'Portfolio', 'Watchlist']);
  });

  it('every Stack.Screen route name exists in RootStackParamList', () => {
    const missing = stackScreens.filter((name) => !stackKeys.includes(name));
    expect(missing, 'Routes registered in AppNavigator but missing from RootStackParamList').toEqual(
      [],
    );
  });

  it('every Tab.Screen route name exists in TabParamList', () => {
    const missing = tabScreens.filter((name) => !tabKeys.includes(name));
    expect(missing, 'Tab routes registered in AppNavigator but missing from TabParamList').toEqual(
      [],
    );
  });

  it('the param lists contain no unregistered (dead) routes', () => {
    const deadStack = stackKeys.filter((key) => !stackScreens.includes(key));
    const deadTabs = tabKeys.filter((key) => !tabScreens.includes(key));
    expect(
      [...deadStack, ...deadTabs],
      'Param-list keys with no matching Screen registration in AppNavigator',
    ).toEqual([]);
  });
});

describe('type-level route contracts (compile-time, run under vitest)', () => {
  it('representative route names are valid keys of the param lists', () => {
    type StackKey = keyof RootStackParamList;
    expectTypeOf<'StockDetail'>().toExtend<StackKey>();
    expectTypeOf<'SnapTradeOrder'>().toExtend<StackKey>();
    expectTypeOf<'PlaceOrder'>().toExtend<StackKey>();
    expectTypeOf<'ChatRoom'>().toExtend<StackKey>();
    expectTypeOf<'Certificate'>().toExtend<StackKey>();
    expectTypeOf<'MainTabs'>().toExtend<StackKey>();

    type TabKey = keyof TabParamList;
    expectTypeOf<'More'>().toExtend<TabKey>();
    expectTypeOf<'Watchlist'>().toExtend<TabKey>();
  });

  it('SnapTradeOrder prefill prices stay numbers; PlaceOrder prefill stays strings', () => {
    expectTypeOf<SnapTradeOrderRouteParams['prefillStop']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<SnapTradeOrderRouteParams['prefillLimit']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<PlaceOrderRouteParams['prefillLimit']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<PlaceOrderRouteParams['prefillTrigger']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<PlaceOrderRouteParams['tradeType']>().toEqualTypeOf<'buy' | 'sell' | undefined>();
  });

  it('MainTabs nests the tab navigator params', () => {
    expectTypeOf<RootStackParamList['MainTabs']>().toEqualTypeOf<
      NavigatorScreenParams<TabParamList> | undefined
    >();
  });
});
