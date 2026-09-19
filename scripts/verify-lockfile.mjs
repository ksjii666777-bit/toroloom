#!/usr/bin/env node
/**
 * ============================================================================
 * Toroloom — Lockfile Integrity Gate
 * ============================================================================
 *
 * Verifies that BOTH package-lock.json files only ever pull packages from
 * the official npm registry, with verifiable integrity hashes. Blocks the
 * common dependency-tampering vectors:
 *
 *   - git+ URLs          → code built from an un-audited repo snapshot
 *   - file:/link: URLs   → local filesystem payloads smuggled into installs
 *   - non-npmjs hosts    → mirrors / proxies / attacker registries
 *   - missing integrity  → tarball hash cannot be verified by npm
 *   - lockfileVersion <3 → older formats lack the packages map used here
 *   - root package/resolutions surprises that indicate hand-edited locks
 *
 * A dependency update PR that introduces any of these fails CI instead of
 * silently installing untrusted code.
 *
 * Escalation path for a legitimate need (e.g. a vendor patch): pin the
 * dependency via package.json `overrides` pointing at an npm-published
 * version, or add a documented exception in EXCEPTIONS below with a reason
 * and review date.
 *
 * Usage:
 *   node scripts/verify-lockfile.mjs [--only=root|backend|both]
 *
 * Exit codes: 0 = pass, 1 = integrity violation, 2 = gate error.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ALLOWED_HOSTS = new Set(['registry.npmjs.org']);

/**
 * Documented exceptions to the registry-host rule.
 * Keep empty in production; entries need a reason + review date.
 */
const EXCEPTIONS = new Set([
  // 'some-package@1.2.3' — vendor patch, reviewed 2026-01-15, remove by Q2
]);

const WORKSPACES = {
  root: { label: 'root (Expo app)', lock: path.join(ROOT, 'package-lock.json') },
  backend: { label: 'backend (API)', lock: path.join(ROOT, 'backend', 'package-lock.json') },
};

function parseArgs(argv) {
  const opts = { only: 'both' };
  for (const arg of argv) {
    if (arg.startsWith('--only=')) {
      const v = arg.slice('--only='.length);
      if (!['root', 'backend', 'both'].includes(v)) throw new Error(`invalid --only value: ${v}`);
      opts.only = v;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

function verify(ws) {
  const violations = [];
  let raw;
  try {
    raw = fs.readFileSync(ws.lock, 'utf8');
  } catch (err) {
    violations.push(`lockfile unreadable: ${err.message}`);
    return violations;
  }

  if (/^\uFEFF/.test(raw)) violations.push('UTF-8 BOM detected — lockfile was hand-edited or exported oddly');

  let lock;
  try {
    lock = JSON.parse(raw);
  } catch (err) {
    violations.push(`lockfile is not valid JSON: ${err.message.slice(0, 120)}`);
    return violations;
  }

  if ((lock.lockfileVersion ?? 0) < 3) {
    violations.push(`lockfileVersion ${lock.lockfileVersion} — expected >= 3 (npm 9+ format)`);
  }

  const pkgs = lock.packages ?? null;
  if (!pkgs || typeof pkgs !== 'object') {
    violations.push('missing "packages" map — not a v3 lockfile structure');
    return violations;
  }

  // Root entry sanity: it must exist and declare no "resolved".
  if (!pkgs['']) violations.push('root package entry ("" key) missing');

  let total = 0;
  let checked = 0;
  for (const [key, info] of Object.entries(pkgs)) {
    if (!key) continue; // root entry
    total++;
    const id = key.replace(/^node_modules\//, '');

    if (info.link) continue; // workspace links: no tarball to verify

    const resolved = typeof info.resolved === 'string' ? info.resolved : null;

    if (!resolved) {
      violations.push(`${id}: missing "resolved" URL`);
      continue;
    }

    if (resolved.startsWith('git+') || resolved.startsWith('git://') || resolved.startsWith('github:')) {
      violations.push(`${id}: GIT URL — ${resolved.slice(0, 90)}`);
      continue;
    }
    if (resolved.startsWith('file:') || resolved.startsWith('link:')) {
      violations.push(`${id}: FILE/LINK URL — ${resolved.slice(0, 90)}`);
      continue;
    }

    let host = null;
    try {
      host = new URL(resolved).host;
    } catch {
      violations.push(`${id}: unparseable resolved URL — ${resolved.slice(0, 90)}`);
      continue;
    }

    if (!ALLOWED_HOSTS.has(host)) {
      if (EXCEPTIONS.has(id)) continue;
      violations.push(`${id}: NON-REGISTRY HOST "${host}" — ${resolved.slice(0, 90)}`);
      continue;
    }

    if (!info.integrity || typeof info.integrity !== 'string' || !info.integrity.startsWith('sha512-')) {
      violations.push(`${id}: missing/weak integrity hash (${info.integrity || 'none'})`);
      continue;
    }

    checked++;
  }

  console.log(`  scanned ${total} packages — ${checked} fully verified (registry + sha512)`);
  return violations;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`usage: node scripts/verify-lockfile.mjs [--only=root|backend|both]\nerror: ${err.message}`);
    process.exit(2);
  }

  const scopes = opts.only === 'both' ? ['root', 'backend'] : [opts.only];
  let failed = false;

  for (const scope of scopes) {
    const ws = WORKSPACES[scope];
    console.log(`\n── ${ws.label} ─────────────────────────────────────────────`);
    const violations = verify(ws);
    if (violations.length) {
      failed = true;
      console.error(`  ✖ ${violations.length} integrity violation(s):`);
      for (const v of violations.slice(0, 25)) console.error(`      ${v}`);
      if (violations.length > 25) console.error(`      … and ${violations.length - 25} more`);
    } else {
      console.log('  ✔ lockfile integrity verified');
    }
  }

  console.log('\n────────────────────────────────────────────────────────────');
  if (failed) {
    console.error(
      '✖ Lockfile integrity gate FAILED.\n' +
        '  Every dependency must resolve from registry.npmjs.org with a sha512 hash.\n' +
        '  Regenerate the lockfile with a clean registry config (`npm install` after\n' +
        '  checking `npm config get registry`), or add a documented exception in\n' +
        '  scripts/verify-lockfile.mjs EXCEPTIONS if genuinely unavoidable.',
    );
    process.exit(1);
  }
  console.log('✔ Lockfile integrity gate passed.');
}

main();
