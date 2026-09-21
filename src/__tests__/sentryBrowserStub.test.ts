/**
 * ============================================================================
 * Toroloom — Sentry Browser Stub Guard Tests
 * ============================================================================
 *
 * metro.config.js stubs out @sentry-internal/{replay,replay-canvas,feedback}
 * on native builds to keep DOM-only code out of the bundle. This test guards
 * the contract that keeps the app alive:
 *
 *   1. Every name @sentry/browser imports from (or re-exports through) the
 *      stubbed packages MUST exist in metro/sentry-browser-stub.js.
 *      (Missing `buildFeedbackIntegration` caused the deterministic
 *      "TypeError: undefined is not a function" release cold-start crash —
 *      E2E "Login screen never appeared".)
 *
 *   2. Names that @sentry/browser CALLS at module init (top level of a
 *      module) must be INERT in the stub — they must return a value, never
 *      throw, because throwing kills the runtime before first paint.
 *
 * Run with a real node_modules/@sentry/browser present; skips otherwise.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const BROWSER_DIR = path.resolve(__dirname, '../../node_modules/@sentry/browser/build/npm/esm/prod');
const STUB_PATH = path.resolve(__dirname, '../../metro/sentry-browser-stub.js');

/** Names the browser SDK executes at module top level (from its own sources). */
const TOP_LEVEL_CALLED = new Set(['buildFeedbackIntegration']);

const browserAvailable = fs.existsSync(BROWSER_DIR);

describe.skipIf(!browserAvailable)('sentry browser stub guard', () => {
  const stubSource = fs.readFileSync(STUB_PATH, 'utf8');

  /** Scan browser prod modules for imports/re-exports of the stubbed packages. */
  function collectImportedNames(): Map<string, { via: string; statements: string[] }> {
    const imported = new Map<string, { via: string; statements: string[] }>();
    const files = fs
      .readdirSync(BROWSER_DIR)
      .filter((f) => f.endsWith('.js') && !f.endsWith('.map'));

    for (const file of files) {
      const src = fs.readFileSync(path.join(BROWSER_DIR, file), 'utf8');
      // import { a, b as c } from '@sentry-internal/...'
      const importRe = /import\s*\{([^}]+)\}\s*from\s*'(@sentry-internal\/(?:replay|replay-canvas|feedback))'/g;
      // export { a, b } from '@sentry-internal/...'
      const exportRe = /export\s*\{([^}]+)\}\s*from\s*'(@sentry-internal\/(?:replay|replay-canvas|feedback))'/g;

      for (const re of [importRe, exportRe]) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
          const names = m[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => {
              // `a as b` → imported name is `a`
              const [orig] = s.split(/\s+as\s+/);
              return orig.trim();
            });
          for (const name of names) {
            const entry = imported.get(name) ?? { via: file, statements: [] };
            entry.statements.push(`${file}: ${m[0].slice(0, 90)}`);
            imported.set(name, entry);
          }
        }
      }
    }
    return imported;
  }

  it('stub exports every name @sentry/browser imports from stubbed packages', () => {
    const imported = collectImportedNames();
    expect(imported.size).toBeGreaterThan(0); // sanity: scan actually found the surface

    const missing: string[] = [];
    for (const [name, meta] of imported) {
      const exported = new RegExp(
        `export\\s+(async\\s+)?function\\s+${name}\\b|export\\s+const\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`,
      ).test(stubSource);
      if (!exported) {
        missing.push(`${name} (imported via ${meta.via})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('names called at module init are inert in the stub (no throw at import time)', async () => {
    // Import the stub through Vite so top-level evaluation happens.
    const mod = await import('../../metro/sentry-browser-stub.js');
    for (const name of TOP_LEVEL_CALLED) {
      const fn = (mod as Record<string, unknown>)[name];
      expect(typeof fn, `${name} must be exported`).toBe('function');
      // It is called at module init by @sentry/browser — must return a value.
      const result = (fn as () => unknown)();
      expect(result, `${name}() must return an inert integration`).toBeTruthy();
    }
  });

  it('stub returns an integration-shaped object from buildFeedbackIntegration', async () => {
    const mod = await import('../../metro/sentry-browser-stub.js');
    const integration = (mod as { buildFeedbackIntegration: () => unknown }).buildFeedbackIntegration();
    expect(integration).toMatchObject({ name: expect.any(String) });
  });
});
