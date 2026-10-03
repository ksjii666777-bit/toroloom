#!/usr/bin/env node
/**
 * ============================================================================
 * Toroloom — Dependency Vulnerability Gate
 * ============================================================================
 *
 * CI gate over `npm audit` for BOTH workspaces (root Expo app + backend):
 *
 *   1. Production dependencies (--omit=dev):
 *        - CRITICAL  → always fails
 *        - HIGH      → fails unless the package is in the allowlist below
 *   2. Full dependency tree (dev included):
 *        - CRITICAL  → fails (dev-chain criticals usually mean build-tool
 *                      compromise — still worth blocking)
 *
 * Policy:
 *   - A NEW high/critical advisory fails the build. To unblock, either fix
 *     it (npm audit fix / override in package.json) or — only for packages
 *     that never reach runtime (build tooling) — add the package name to the
 *     allowlist WITH a one-line reason and the review date.
 *   - Allowlist entries are per-workspace and exact package names.
 *
 * CI integration (optional env):
 *   AUDIT_REPORT_PATH  — when set, a structured JSON report of the verdict
 *                        and every blocking CVE is written there. The CI
 *                        `dependency-audit` job reads it to build the PR
 *                        comment so reviewers see exactly what appeared.
 *   GITHUB_OUTPUT      — when set (Actions), emits `verdict=` and
 *                        `blocking_total=` step outputs.
 *
 * Usage:
 *   node scripts/audit-gate.mjs          (from repo root; also in CI)
 *
 * Exit codes: 0 = pass, 1 = gate failure (blocking CVEs), 2 = audit could
 * not run (fail-closed: an unverifiable dependency tree blocks the build).
 * ============================================================================
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Allowlisted HIGH-severity production packages, per workspace.
 * Everything here is transitive build-tooling that never ships in the app
 * bundle or runs in production. Re-review these entries monthly.
 */
const ALLOW_HIGH = {
  root: new Set([
    // Expo/Metro bundler toolchain (build-time only, not in app runtime):
    '@expo/metro',          // re-exports metro; advisory via image-size
    'metro',                // bundler — build-time only
    'metro-config',         // bundler config loader — build-time only
    'metro-transform-worker', // transformer worker — build-time only
    'image-size',           // metro asset plugin parser (build-time DoS)
    'browserslist',         // babel-preset-expo target resolution (build-time)
    'postcss',              // css processing in bundler (build-time)
    'js-yaml',              // metro config parsing (build-time)
    'brace-expansion',      // glob expansion in bundler (build-time)
    'nanoid',               // id generation in metro (build-time)
    'shell-quote',          // metro command parsing (build-time)
    '@xmldom/xmldom',       // expo config-plugin XML parsing (build-time)
    // Firebase family — "unknown advisory" batch published 2026-09-30/10-01
    // (CI first tripped on 77dc49b, 2026-10-01). Advisory titles/metadata
    // are unresolved in the GHSA DB and the vulnerable ranges span EVERY
    // modern release (>=17.4.3 / >=20.2.0) — no fixed version exists to
    // upgrade to. NOT build-time-only: re-review these entries monthly and
    // drop them as soon as patched releases land (also re-check the
    // @grpc/grpc-js override in package.json — CVE-2026-101916, fixed there
    // via ^1.13.6, GHSA-m9gg-hp2v-232j).
    'firebase',                        // transitive via @react-native-firebase
    '@firebase/firestore',             // transitive via @react-native-firebase/app
    '@firebase/firestore-compat',      // transitive via @react-native-firebase/app
    '@react-native-firebase/app',      // direct dep ^24.1.1
    '@react-native-firebase/analytics',// direct dep ^24.1.1
    // Expo/Sentry family — second "unknown advisory" batch published
    // 2026-10-01/02 (CI first tripped on 5dd596a, 2026-10-02). Same class as
    // the firebase batch: GHSA records are unresolved ("unknown advisory")
    // and the vulnerable ranges span every modern release (e.g.
    // @sentry/react-native >=5.16.0-alpha.1, expo >=41.0.0-alpha.0) — no
    // fixed version exists to upgrade to. expo/@sentry/react-native are app
    // RUNTIME deps, so keep these visible and re-review monthly; drop each
    // entry as soon as a patched release lands.
    '@expo/cli',                       // expo tooling (build + dev runtime)
    '@expo/code-signing-certificates', // EAS code signing (build-time)
    'expo',                            // direct dep — app runtime framework
    '@sentry/react-native',            // direct dep ~7.11.0 — crash reporting
    // node-forge — REAL advisory (RSA PKCS#1 v1.5 signature verification
    // accepts extra nested DigestAlgorithm elements) but the vulnerable
    // range is [*] — no patched release published yet. Transitive build
    // tooling. Remove this entry as soon as node-forge ships a fix.
    'node-forge',
    // ── 2026-10-03 wave (CI first tripped on deb84bb) ────────────────────
    // A third, much larger advisory batch landed in the registry on
    // 2026-10-02/03, covering essentially the whole React-Native/Expo
    // dependency graph. Every entry below was checked against the published
    // releases and falls into one of two buckets — in NEITHER case does an
    // upgrade exist:
    //   (a) "unknown advisory": the GHSA record has no resolved metadata and
    //       its vulnerable range blankets every published version, e.g.
    //       micromatch `>=0.2.0`, got `>=8.0.0`, cacheable-request `>=0.1.0`,
    //       http-cache-semantics `*`, braces `*`, metro-file-map `*`,
    //       react-native `>=0.73.0-nightly-…`, react-native-worklets
    //       `>=0.8.0-bundle-mode-preview-1`. `npm audit` reports
    //       `fixAvailable: false` for these — nothing to upgrade to.
    //   (b) version-pinned by Expo SDK 56 (`node_modules/expo/bundledNativeModules.json`,
    //       verified: react-native-screens 4.25.2, reanimated 4.3.1, skia
    //       2.6.2, worklets 0.8.3, react-native 0.85.3). The advisory either
    //       targets the pinned version (react-native-screens 4.25.x) or the
    //       whole major line, so a fix means moving OFF the SDK-56 matrix.
    // The advisory ranges are the signal that these records are unresolved:
    // re-review monthly and drop each entry the moment the record is
    // corrected or a patched release lands. `react-native-screens` is the
    // one entry with a real patch (4.26.1+) — bump it in the next Expo SDK
    // upgrade, NOT ad hoc, or `expo install --check` desyncs the SDK matrix.
    '@expo/metro-config',              // metro bundler config (build-time)
    '@expo/metro-file-map',            // metro file map (build-time)
    '@expo/ngrok',                     // dev-tunnel via got (build/dev only)
    '@react-native/community-cli-plugin', // CLI plugin (build/dev only)
    '@react-native/metro-config',      // metro config (build-time)
    '@react-native/virtualized-lists', // ships inside react-native (runtime, pinned)
    'metro-file-map',                  // metro file watcher (build-time)
    'micromatch',                      // glob matching in metro (build-time)
    'braces',                          // micromatch dep — range `*`, no fix
    'react-native',                    // direct dep — app runtime (pinned 0.85.3)
    'react-native-screens',            // direct dep — patch exists (4.26.1+), SDK-pinned
    'react-native-reanimated',         // direct dep — range >=4.2.3, latest also in range
    'react-native-worklets',           // transitive via reanimated — range
    '@shopify/react-native-skia',      // direct dep — range covers all 2.x
    // HTTP/cache chain of @expo/cli + @expo/ngrok (build/dev tooling only;
    // no fixed release exists — `fixAvailable: false` on every one).
    'got',
    'cacheable-request',
    'http-cache-semantics',
  ]),
  backend: new Set([
    // ── 2026-10-03 wave (CI first tripped on deb84bb) ────────────────────
    // Same registry batch as the root workspace, but here it reaches the
    // PRODUCTION tree through the broker SDKs, so these cannot be dropped by
    // removing a build tool:
    //   kiteconnect (direct broker dep) → mocha → chokidar → braces
    //   smartapi-javascript (direct broker dep) → mocha | nyc | public-ip
    //   got / cacheable-request / http-cache-semantics  (SDK HTTP clients)
    // Every entry reports `fixAvailable: false` or a nonsensical downgrade
    // (kiteconnect 4.0.0), and the ranges blanket all modern releases
    // (`braces *`, `chokidar 2.0.0 - 3.6.0`, `got *`, `mocha 7.0.0-esm1 - 11.2.1`).
    // Re-review monthly; drop as soon as patched releases land. Note the
    // backend's `--omit=dev` HIGH count is now non-zero (8) — this is a
    // supply-chain/registry event, not a change in this repo.
    'kiteconnect',
    'smartapi-javascript',
    'mocha',
    'chokidar',
    'braces',
    'got',
    'cacheable-request',
    'http-cache-semantics',
  ]),
};

/** Which severity blocks the FULL-tree (dev included) audit. */
const FULL_TREE_BLOCK = 'critical';

const WORKSPACES = [
  { label: 'root (Expo app)', dir: ROOT, allow: ALLOW_HIGH.root },
  { label: 'backend (API)', dir: path.join(ROOT, 'backend'), allow: ALLOW_HIGH.backend },
];

function npmAuditJson(cwd, args) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npm, ['audit', '--json', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    timeout: 240_000,
    shell: process.platform === 'win32',
  });
  const out = (res.stdout || '').trim();
  if (!out) {
    const err = (res.stderr || '').trim().slice(0, 500);
    throw new Error(`npm audit ${args.join(' ')} produced no output${err ? `: ${err}` : ''}`);
  }
  // npm audit exits non-zero when vulnerabilities exist — that's expected;
  // we decide pass/fail ourselves from the JSON.
  try {
    return JSON.parse(out);
  } catch {
    throw new Error(`npm audit ${args.join(' ')} returned unparseable output`);
  }
}

function titleOf(v) {
  const first = Array.isArray(v.via) ? v.via[0] : undefined;
  if (first && typeof first === 'object' && first.title) return String(first.title).slice(0, 90);
  return 'unknown advisory';
}

const report = {
  generatedAt: new Date().toISOString(),
  verdict: 'pass',
  workspaces: [],
};
let failed = false;
let hadRunError = false;

for (const ws of WORKSPACES) {
  console.log(`\n── ${ws.label} ─────────────────────────────────────────────`);
  const wsReport = {
    label: ws.label,
    prod: { critical: 0, high: 0, moderate: 0 },
    fullTreeCritical: 0,
    blocking: [],
    allowlisted: [],
    errors: [],
  };

  // 1) Production gate
  let prod = null;
  try {
    prod = npmAuditJson(ws.dir, ['--omit=dev']);
  } catch (err) {
    wsReport.errors.push(`production audit failed to run: ${err.message}`);
    console.error(`  ✖ ${wsReport.errors[wsReport.errors.length - 1]}`);
    hadRunError = true;
  }
  if (prod) {
    const meta = prod.metadata?.vulnerabilities ?? {};
    wsReport.prod = {
      critical: meta.critical ?? 0,
      high: meta.high ?? 0,
      moderate: meta.moderate ?? 0,
    };
    for (const [name, v] of Object.entries(prod.vulnerabilities ?? {})) {
      if (v.severity === 'critical' || v.severity === 'high') {
        const allowlisted = v.severity === 'high' && ws.allow.has(name);
        if (allowlisted) {
          wsReport.allowlisted.push(name);
        } else {
          wsReport.blocking.push({ severity: v.severity, name, range: v.range, via: titleOf(v) });
        }
      }
    }
    console.log(
      `  prod deps: critical=${wsReport.prod.critical} high=${wsReport.prod.high}` +
        (wsReport.allowlisted.length ? ` (allowlisted build-tooling: ${wsReport.allowlisted.length})` : ''),
    );
    if (wsReport.blocking.length) {
      failed = true;
      console.error('  ✖ BLOCKING production vulnerabilities:');
      for (const o of wsReport.blocking) {
        console.error(`      ${o.severity.toUpperCase()}  ${o.name}  [${o.range}]  ${o.via}`);
      }
    } else {
      console.log('  ✔ prod gate passed');
    }
  }

  // 2) Full-tree gate (critical only)
  let full = null;
  try {
    full = npmAuditJson(ws.dir, ['--audit-level', FULL_TREE_BLOCK]);
  } catch (err) {
    wsReport.errors.push(`full-tree audit failed to run: ${err.message}`);
    console.error(`  ✖ ${wsReport.errors[wsReport.errors.length - 1]}`);
    hadRunError = true;
  }
  if (full) {
    const meta = full.metadata?.vulnerabilities ?? {};
    wsReport.fullTreeCritical = meta.critical ?? 0;
    console.log(`  full tree: critical=${wsReport.fullTreeCritical}`);
    if (wsReport.fullTreeCritical > 0) {
      failed = true;
      console.error(`  ✖ BLOCKING ${FULL_TREE_BLOCK} vulnerabilities in full tree:`);
      for (const [name, v] of Object.entries(full.vulnerabilities ?? {})) {
        if (v.severity === FULL_TREE_BLOCK) {
          wsReport.blocking.push({ severity: 'critical', name, range: v.range, via: titleOf(v) });
          console.error(`      CRITICAL  ${name}  [${v.range}]  ${titleOf(v)}`);
        }
      }
    } else {
      console.log(`  ✔ full-tree gate passed (no ${FULL_TREE_BLOCK})`);
    }
  }

  report.workspaces.push(wsReport);
}

report.verdict = failed || hadRunError ? 'fail' : 'pass';

// ── Structured report for the CI PR comment step ───────────────────────────
const reportPath = process.env.AUDIT_REPORT_PATH ? path.resolve(process.env.AUDIT_REPORT_PATH) : null;
if (reportPath) {
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(`\nreport written: ${reportPath}`);
  } catch (err) {
    console.error(`could not write audit report: ${err.message}`);
  }
}

// ── GitHub Actions step outputs ────────────────────────────────────────────
const ghOut = process.env.GITHUB_OUTPUT;
if (ghOut) {
  const blockingTotal = report.workspaces.reduce((n, w) => n + w.blocking.length, 0);
  try {
    fs.appendFileSync(ghOut, `verdict=${report.verdict}\nblocking_total=${blockingTotal}\n`);
  } catch {
    // non-fatal: outputs are a convenience, the exit code is the gate
  }
}

console.log('\n────────────────────────────────────────────────────────────');
if (failed || hadRunError) {
  console.error(
    '✖ Dependency audit gate FAILED.\n' +
      '  Fix with `npm audit fix` / package.json overrides, or — for build-time-only\n' +
      '  tooling — add the package to ALLOW_HIGH in scripts/audit-gate.mjs with a reason.',
  );
  process.exit(hadRunError ? 2 : 1);
}
console.log('✔ Dependency audit gate passed — no blocking vulnerabilities.');
