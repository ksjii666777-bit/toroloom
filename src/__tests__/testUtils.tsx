/**
 * ============================================================================
 * Toroloom — Custom Test Utilities
 * ============================================================================
 *
 * Lightweight render + query helpers built on react-test-renderer.
 * Replaces @testing-library/react-native which has compatibility issues
 * with vitest due to react-native's Flow-typed source files.
 */

import { act } from 'react';
import TestRenderer from 'react-test-renderer';
import type { ReactElement } from 'react';

// ── Types ────────────────────────────────────────────────────
export interface RenderResult {
  /** The root TestRenderer instance */
  root: TestRenderer.ReactTestInstance;
  /** The JSON-serialised tree for snapshot-like assertions */
  toJSON: () => ReturnType<TestRenderer.ReactTestRenderer['toJSON']>;
  /** Re-render with new element */
  update: (element: ReactElement) => void;
  /** Unmount the rendered tree */
  unmount: () => void;
  /** Find a single element whose text children match the given string/regex */
  getByText: (match: string | RegExp) => TestRenderer.ReactTestInstance;
  /** Find a single element whose text children match (returns null if not found) */
  queryByText: (match: string | RegExp) => TestRenderer.ReactTestInstance | null;
  /** Find all elements whose text children match */
  getAllByText: (match: string | RegExp) => TestRenderer.ReactTestInstance[];
  /** Find a single element by testID prop */
  getByTestId: (id: string) => TestRenderer.ReactTestInstance;
  /** Find a single element by testID prop (returns null if not found) */
  queryByTestId: (id: string) => TestRenderer.ReactTestInstance | null;
  /** Find a single element by placeholder prop */
  getByPlaceholderText: (text: string) => TestRenderer.ReactTestInstance;
  /** Find a single element by placeholder prop (returns null if not found) */
  queryByPlaceholderText: (text: string) => TestRenderer.ReactTestInstance | null;
}

// ── Text extractor ───────────────────────────────────────────
/** Recursively walk a test instance tree and collect all text strings. */
function collectText(instance: TestRenderer.ReactTestInstance): string[] {
  const results: string[] = [];
  if (typeof instance.children === 'string') {
    results.push(instance.children);
  } else if (Array.isArray(instance.children)) {
    for (const child of instance.children) {
      if (typeof child === 'string') {
        results.push(child);
      } else if (child && typeof child === 'object' && 'children' in child) {
        results.push(...collectText(child as any));
      }
    }
  }
  return results;
}

/** Check if a test instance's text matches the given string or regex. */
function textMatches(
  instance: TestRenderer.ReactTestInstance,
  match: string | RegExp
): boolean {
  const text = collectText(instance).join('');
  if (typeof match === 'string') {
    return text.includes(match);
  }
  return match.test(text);
}

// ── Render ───────────────────────────────────────────────────
export function render(component: ReactElement): RenderResult {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(component);
  });

  /** Full tree traversal — DFS to find matching element. */
  function findInTree(
    predicate: (inst: TestRenderer.ReactTestInstance) => boolean,
    all: false
  ): TestRenderer.ReactTestInstance;
  function findInTree(
    predicate: (inst: TestRenderer.ReactTestInstance) => boolean,
    all: true
  ): TestRenderer.ReactTestInstance[];
  function findInTree(
    predicate: (inst: TestRenderer.ReactTestInstance) => boolean,
    all: boolean
  ): TestRenderer.ReactTestInstance | TestRenderer.ReactTestInstance[] | null {
    const results: TestRenderer.ReactTestInstance[] = [];

    function walk(inst: TestRenderer.ReactTestInstance) {
      if (predicate(inst)) {
        results.push(inst);
      }
      if (typeof inst.children !== 'string' && Array.isArray(inst.children)) {
        for (const child of inst.children) {
          if (child && typeof child === 'object' && 'type' in child) {
            walk(child as TestRenderer.ReactTestInstance);
          }
        }
      }
    }

    // Start from the root's children
    const root = renderer.root;
    if (Array.isArray(root.children)) {
      for (const child of root.children) {
        if (child && typeof child === 'object' && 'type' in child) {
          walk(child as TestRenderer.ReactTestInstance);
        }
      }
    }

    if (all) return results;
    return results[0] ?? null;
  }

  function getByText(match: string | RegExp): TestRenderer.ReactTestInstance {
    // Return the DEEPEST match (leaf element closest to actual text), not the first.
    // This prevents parent containers from matching because they recursively contain
    // the text of all descendants.
    const all = getAllByText(match);
    if (all.length === 0) {
      throw new Error(
        `Unable to find an element with text: ${match instanceof RegExp ? match.toString() : match}`
      );
    }
    return all[all.length - 1];
  }

  function queryByText(
    match: string | RegExp
  ): TestRenderer.ReactTestInstance | null {
    // queryByText returns the FIRST match (DFS order includes parent containers).
    // For existence checks this is fine, but getByText prefers deepest match.
    return findInTree((inst) => textMatches(inst, match), false) as TestRenderer.ReactTestInstance | null;
  }

  function getAllByText(
    match: string | RegExp
  ): TestRenderer.ReactTestInstance[] {
    // Returns ALL matches in DFS order (parent-first). Use last element for deepest.
    return findInTree((inst) => textMatches(inst, match), true) as TestRenderer.ReactTestInstance[];
  }

  function getByTestId(id: string): TestRenderer.ReactTestInstance {
    const el = queryByTestId(id);
    if (!el) {
      throw new Error(`Unable to find an element with testID: ${id}`);
    }
    return el;
  }

  function queryByTestId(
    id: string
  ): TestRenderer.ReactTestInstance | null {
    return findInTree(
      (inst) => {
        const props = inst.props as Record<string, any>;
        return props.testID === id;
      },
      false
    ) as TestRenderer.ReactTestInstance | null;
  }

  function getByPlaceholderText(
    text: string
  ): TestRenderer.ReactTestInstance {
    const el = queryByPlaceholderText(text);
    if (!el) {
      throw new Error(`Unable to find an element with placeholder: ${text}`);
    }
    return el;
  }

  function queryByPlaceholderText(
    text: string
  ): TestRenderer.ReactTestInstance | null {
    return findInTree(
      (inst) => {
        const props = inst.props as Record<string, any>;
        return props.placeholder === text;
      },
      false
    ) as TestRenderer.ReactTestInstance | null;
  }

  return {
    get root() {
      return renderer.root;
    },
    toJSON: () => renderer.toJSON(),
    update: (el) => renderer.update(el),
    unmount: () => renderer.unmount(),
    getByText,
    queryByText,
    getAllByText,
    getByTestId,
    queryByTestId,
    getByPlaceholderText,
    queryByPlaceholderText,
  };
}

// ── FireEvent ────────────────────────────────────────────────
/** Walk up the test-instance tree to find a prop on an ancestor. */
function findPropOnAncestor(
  element: TestRenderer.ReactTestInstance,
  propName: string
): any {
  let current: TestRenderer.ReactTestInstance | null = element;
  while (current) {
    const val = (current.props as Record<string, any>)?.[propName];
    if (val !== undefined) return val;
    current = current.parent as TestRenderer.ReactTestInstance | null;
  }
  return undefined;
}

/**
 * Find an element anywhere in the tree that has the given prop.
 * Uses DFS from renderer.root.
 */
function findByProp(
  root: TestRenderer.ReactTestInstance,
  propName: string
): TestRenderer.ReactTestInstance | null {
  function search(inst: TestRenderer.ReactTestInstance): TestRenderer.ReactTestInstance | null {
    if ((inst.props as Record<string, any>)?.[propName] !== undefined) return inst;
    if (typeof inst.children === 'string') return null;
    const children = inst.children as TestRenderer.ReactTestInstance[];
    for (const child of children) {
      if (child && typeof child === 'object' && 'type' in child) {
        const found = search(child);
        if (found) return found;
      }
    }
    return null;
  }
  const children = root.children as TestRenderer.ReactTestInstance[];
  for (const child of children) {
    if (child && typeof child === 'object' && 'type' in child) {
      const found = search(child);
      if (found) return found;
    }
  }
  return null;
}

export const fireEvent = {
  /**
   * Simulate a text change on an element by calling its `onChangeText` prop
   * (or `onChange` prop as fallback).
   */
  changeText(element: TestRenderer.ReactTestInstance, text: string): void {
    let handler = findPropOnAncestor(element, 'onChangeText');
    if (typeof handler !== 'function') {
      handler = findPropOnAncestor(element, 'onChange');
    }
    if (typeof handler !== 'function') {
      let root = element;
      while (root.parent) root = root.parent;
      handler = findByProp(root, 'onChangeText')?.props?.onChangeText;
    }
    if (typeof handler === 'function') {
      handler(text);
    }
  },

  /**
   * Simulate a scroll-to-end event.
   */
  scrollToEnd(element: TestRenderer.ReactTestInstance): void {
    let handler = findPropOnAncestor(element, 'onEndReached');
    if (typeof handler !== 'function') {
      let root = element;
      while (root.parent) root = root.parent;
      handler = findByProp(root, 'onEndReached')?.props?.onEndReached;
    }
    if (typeof handler === 'function') {
      handler();
    }
  },

  /**
   * Simulate a press on an element by calling its `onPress` prop.
   * Wraps in act() so React processes state updates and re-renders.
   *
   * Strategy: first tries walking up the parent chain (standard React TestRenderer
   * behavior).  Falls back to a full tree DFS if the parent chain doesn't have
   * an onPress, because in React 19 the parent chain may not include expected
   * intermediate elements.
   */
  press(element: TestRenderer.ReactTestInstance): void {
    let handler = findPropOnAncestor(element, 'onPress');
    if (typeof handler !== 'function') {
      // Fallback: search the full tree from root
      // Walk up to the root first
      let root = element;
      while (root.parent) root = root.parent;
      handler = findByProp(root, 'onPress')?.props?.onPress;
    }
    if (typeof handler === 'function') {
      act(() => {
        handler();
      });
    }
  },

  /**
   * Generic event dispatcher.  Calls `props[eventName]` using tree-search
   * fallback similar to press().
   * Wraps in act() so React processes state updates and re-renders.
   */
  trigger(
    element: TestRenderer.ReactTestInstance,
    eventName: string,
    ...args: any[]
  ): void {
    let handler = findPropOnAncestor(element, eventName);
    if (typeof handler !== 'function') {
      let root = element;
      while (root.parent) root = root.parent;
      handler = findByProp(root, eventName)?.props?.[eventName];
    }
    if (typeof handler === 'function') {
      act(() => {
        handler(...args);
      });
    }
  },
};
