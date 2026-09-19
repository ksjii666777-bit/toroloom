#!/usr/bin/env node
/**
 * ============================================================================
 * Toroloom — Supply-Chain Hardening: Install-Script Allowlist
 * ============================================================================
 *
 * CI installs dependencies with `npm ci --ignore-scripts` so that NO package
 * lifecycle script (preinstall/install/postinstall) executes by default.
 * A compromised or typosquatted package can otherwise run arbitrary code on
 * the CI runner during install — the classic npm supply-chain attack.
 *
 * This helper is the second half of that defence:
 *
 *   --verify (default)
 *       Scans BOTH package-lock.json files for packages that declare install
 *       scripts (lockfile `hasInstallScript` flag) and FAILS if any package
 *       is not explicitly allowlisted below. A dependency update that sneaks
 *       in a NEW install script therefore turns CI red instead of silently
 *       executing on the runner.
 *
 *   --rebuild
 *       verify() + explicitly runs ONLY the allowlisted packages' scripts via
 *       `npm rebuild <pkg> ...`, for the few trusted packages that genuinely
 *       need their postinstall (binary download / codegen). Used right after
 *       the hardened install in CI jobs.
 *
 * Trusted packages are listed WITH a reason. Review this list when a
 * dependency update PR touches any of these packages.
 *
 * Local dev machines keep the normal `npm install` (scripts on) — this
 * hardening is CI-only.
 *
 * Usage:
 *   node scripts/install-scripts-allowlist.mjs [--rebuild] [--only=root|backend|both]
 *
 * Exit codes: 0 = pass, 1 = unallowlisted install script found, 2 = helper error.
 * ============================================================================
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Packages whose install scripts are TRUSTED to run in CI.
 * Everything else with an install script fails the build.
 * Keep reasons current — this list is the supply-chain trust boundary.
 */
const ALLOWLIST = {
  root: {
    '@sentry/cli':
      'Downloads the sentry-cli platform binary needed for sourcemap upload (well-known Sentry SDK).',
    esbuild:
      'Falls back to downloading its platform binary; normally resolved via optionalDependencies. Used by vite/vitest transforms.',
    protobufjs:
      'Generates light runtime files; ships pregenerated in the published tarball (Firebase dependency chain).',
    '@shopify/react-native-skia':
      'Prepares native libs; not required under vitest (mocked) but allowlisted so install-mode parity holds.',
    '@firebase/util':
      'Well-known Google SDK install script (no-op hygiene step).',
    fsevents:
      'macOS-only file watcher; never executes on ubuntu CI runners.',
  },
  backend: {
    'msgpackr-extract':
      'Optional native accelerator for msgpackr with a pure-JS fallback; trusted maintainer (kriszyp).',
    fsevents: 'macOS-only file watcher; never executes on ubuntu CI runners.',
  },
};

const WORKSPACES = {
  root: { label: 'root (Expo app)', lock: path.join(ROOT, 'package-lock.json'), dir: ROOT },
  backend: { label: 'backend (API)', lock: path.join(ROOT, 'backend', 'package-lock.json'), dir: path.join(ROOT, 'backend') },
};

function parseArgs(argv) {
  const opts = { rebuild: false, only: 'both' };
  for (const arg of argv) {
    if (arg === '--rebuild') opts.rebuild = true;
    else if (arg.startsWith('--only=')) {
      const v = arg.slice('--only='.length);
      if (!['root', 'backend', 'both'].includes(v)) {
        throw new Error(`invalid --only value: ${v}`);
      }
      opts.only = v;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

function scanWorkspace(ws) {
  const lock = JSON.parse(fs.readFileSync(ws.lock, 'utf8'));
  const pkgs = lock.packages ?? {};
  const found = [];
  for (const [key, info] of Object.entries(pkgs)) {
    if (!info.hasInstallScript) continue;
    if (!key) continue; // root package entry
    found.push({ name: key.replace(/^node_modules\//, '') });
  }
  found.sort((a, b) => a.name.localeCompare(b.name));
  return found;
}

function npmRebuild(dir, names) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npm, ['rebuild', ...names, '--no-audit', '--no-fund'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    throw new Error(`npm rebuild ${names.join(' ')} exited with ${res.status}`);
  }
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`usage: node scripts/install-scripts-allowlist.mjs [--rebuild] [--only=root|backend|both]\nerror: ${err.message}`);
    process.exit(2);
  }

  const scopes = opts.only === 'both' ? ['root', 'backend'] : [opts.only];
  let failed = false;

  for (const scope of scopes) {
    const ws = WORKSPACES[scope];
    const allow = new Set(Object.keys(ALLOWLIST[scope]));
    console.log(`\n── ${ws.label} ─────────────────────────────────────────────`);

    let found;
    try {
      found = scanWorkspace(ws);
    } catch (err) {
      console.error(`  ✖ could not scan lockfile: ${err.message}`);
      process.exit(2);
    }

    if (found.length === 0) {
      console.log('  no packages declare install scripts');
      continue;
    }

    const rejected = [];
    for (const { name } of found) {
      if (allow.has(name)) {
        console.log(`  ✔ ${name}  (allowlisted)`);
      } else {
        rejected.push(name);
        failed = true;
        console.error(`  ✖ ${name}  NOT allowlisted — install script blocked`);
      }
    }

    if (opts.rebuild) {
      const toRun = found.filter(({ name }) => allow.has(name)).map(({ name }) => name);
      if (toRun.length) {
        console.log(`  → running allowlisted scripts: ${toRun.join(', ')}`);
        try {
          npmRebuild(ws.dir, toRun);
        } catch (err) {
          console.error(`  ✖ ${err.message}`);
          process.exit(2);
        }
      }
    }

    if (rejected.length) {
      console.error(
        `\n  New/unknown install scripts must be reviewed before they can run in CI.\n` +
          `  If genuinely trusted and required, add them to ALLOWLIST.${scope} in\n` +
          `  scripts/install-scripts-allowlist.mjs with a one-line reason.`,
      );
    }
  }

  // Root project's own postinstall (razorpay artifact cleanup) is skipped by
  // --ignore-scripts; run it explicitly so CI state matches local installs.
  if (opts.rebuild && (opts.only === 'root' || opts.only === 'both')) {
    const cleaner = path.join(ROOT, 'scripts', 'clean-rn-razorpay-build.mjs');
    if (fs.existsSync(cleaner)) {
      console.log('\n→ project postinstall: clean-rn-razorpay-build.mjs');
      const res = spawnSync(process.execPath, [cleaner], { cwd: ROOT, stdio: 'inherit' });
      if (res.status !== 0) {
        console.error(`✖ clean-rn-razorpay-build.mjs exited with ${res.status}`);
        process.exit(2);
      }
    }
  }

  console.log('\n────────────────────────────────────────────────────────────');
  if (failed) {
    console.error('✖ Install-script allowlist check FAILED — untrusted install scripts blocked.');
    process.exit(1);
  }
  console.log(opts.rebuild ? '✔ Allowlisted install scripts verified and executed.' : '✔ Install-script allowlist check passed.');
}

main();
